import { logger } from "./services/logger";
import express, { Request, Response } from "express";
import helmet from "helmet";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import rateLimit from 'express-rate-limit';
import * as dotenv from "dotenv";

dotenv.config();

import { ethers } from "ethers";
import * as blockchain from "./services/blockchain";
import { orchestrate, analyzeIntent } from "./services/orchestrator";
import * as registry from "./services/registry";
import * as ratings from "./services/ratings";
import * as llm from "./services/llm";
import * as taskHistory from "./services/taskHistory";
import { requireApiKey } from "./services/auth";
import { parseHiveFiError } from "./services/errorParser";

// Health Status state
let healthStatus: Record<string, boolean> = {};
export function getHealthStatus() {
  return healthStatus;
}

// Background polling for health status
export function startHealthPoller() {
  setInterval(async () => {
    try {
      const specialists = await registry.getAllSpecialists();
      let onlineCount = 0;

      for (const spec of specialists) {
        if (spec.endpoint) {
          const isHealthy = await llm.checkSpecialistHealth(spec.endpoint);
          const wasHealthy = healthStatus[spec.id];
          healthStatus[spec.id] = isHealthy;
          
          if (isHealthy) onlineCount++;

          // Only log if the state changed (or first time seeing it online)
          if (wasHealthy !== isHealthy) {
            if (isHealthy) {
              logger.info(`[Swarm Monitor] Node Connected: ${spec.name} (${spec.id}) is online.`);
            } else if (wasHealthy === true) {
              // Only warn if it was previously online and suddenly went offline
              logger.warn(`[Swarm Monitor] Node Disconnected: ${spec.name} (${spec.id}) is unresponsive!`);
            }
          }
        } else {
          healthStatus[spec.id] = false;
        }
      }
      
      // Keep the heartbeat silent unless debugging
      logger.debug(`[Swarm Monitor] Network heartbeat complete: ${onlineCount}/${specialists.length} nodes active.`);
    } catch (err) {
      logger.error("[Swarm Monitor Error]", err);
    }
  }, 60000);
}

export const app = express();

const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https:", "data:"],
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const server = http.createServer(app);

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '10kb' }));

const globalLimiter = rateLimit({ windowMs: 60000, max: 100 });
const orchestrateLimiter = rateLimit({ windowMs: 60000, max: 10 });

app.use(globalLimiter);

// Socket.io Server Setup
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// GET /api/health
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

// POST /api/orchestrate Request Interfaces
interface OrchestrationRequestBody {
  prompt: string;
  socketId?: string;
  maxFee?: number;
  clientWallet?: string;
  delegationMode?: string;
  manualModelId?: string;
  customEndpoint?: string;
  preAnalyzedIntent?: any;
  nicheModels?: Record<string, string>;
}

app.post("/api/orchestrate", orchestrateLimiter, requireApiKey, async (req: Request<{}, {}, OrchestrationRequestBody>, res: Response): Promise<any> => {
  const { prompt, socketId, maxFee, clientWallet, delegationMode, manualModelId, customEndpoint } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: "Prompt must be a non-empty string" });
  }

  if (prompt.length > 10000) {
    return res.status(400).json({ success: false, error: "Prompt exceeds maximum length of 10000 characters" });
  }

  // Retrieve client socket if available
  const socket = socketId ? io.sockets.sockets.get(socketId) : null;
  const targetSocket = socket || io; // fallback to broadcast if socket not found

  try {
    const result = await orchestrate(prompt, targetSocket, maxFee, clientWallet, delegationMode, manualModelId, customEndpoint, req.body.preAnalyzedIntent, req.body.nicheModels);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error("Orchestration error:", error);
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

app.post("/api/analyze-intent", orchestrateLimiter, requireApiKey, async (req: Request<{}, {}, OrchestrationRequestBody>, res: Response): Promise<any> => {
  const { prompt, maxFee, clientWallet, delegationMode, customEndpoint } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: "Prompt must be a non-empty string" });
  }

  if (prompt.length > 10000) {
    return res.status(400).json({ success: false, error: "Prompt exceeds maximum length of 10000 characters" });
  }

  try {
    const intent = await analyzeIntent(prompt, delegationMode, maxFee, clientWallet, customEndpoint);
    return res.json({ success: true, intent });
  } catch (error: any) {
    logger.error("Analyze intent error:", error);
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

// GET /api/registry
app.get("/api/registry", async (_req: Request, res: Response): Promise<any> => {
  try {
    const specialists = await registry.getAllSpecialists(getHealthStatus());
    return res.json({ success: true, specialists });
  } catch (error: any) {
    logger.error("Error fetching registry:", error);
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

// POST /api/registry/register-endpoint
app.post("/api/registry/register-endpoint", async (req: Request, res: Response): Promise<any> => {
  const { modelId, providerId, endpointUrl } = req.body;
  const id = providerId !== undefined ? providerId : modelId;
  
  if (id === undefined || id === null || !endpointUrl || typeof endpointUrl !== 'string') {
    return res.status(400).json({ success: false, error: "Missing required fields (providerId and endpointUrl)" });
  }
  
  try {
    new URL(endpointUrl);
  } catch (e) {
    return res.status(400).json({ success: false, error: "Invalid endpoint URL format" });
  }

  try {
    await registry.storeEndpoint(id, endpointUrl);
    return res.json({ success: true });
  } catch (error: any) {
    logger.error("Error storing endpoint:", error);
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

// POST /api/ratings
app.post("/api/ratings", async (req: Request, res: Response): Promise<any> => {
  const { modelId, taskId, score, niche } = req.body;
  if (!modelId || typeof modelId !== 'string' || 
      !taskId || typeof taskId !== 'string' || 
      !niche || typeof niche !== 'string' || 
      typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ success: false, error: "Invalid rating parameters" });
  }
  try {
    await ratings.submitRating(modelId, taskId, score, niche);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

// GET /api/ratings/:modelId
app.get("/api/ratings/:modelId", async (req: Request, res: Response): Promise<any> => {
  try {
    const summary = await ratings.getRating(req.params.modelId as string);
    return res.json({ success: true, summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

// POST /api/stake
app.post("/api/stake", async (req: Request, res: Response): Promise<any> => {
  const { providerId, amount } = req.body;
  
  if (!providerId || !amount) {
    return res.status(400).json({ success: false, error: "Missing required fields (providerId and amount)" });
  }

  const contractAddress = process.env.HIVE_REGISTRY_ADDRESS;
  const abi = [
    "function stakeForProvider(uint256 providerId, uint256 amount) external",
    "function unstakeFromProvider(uint256 providerId) external"
  ];
  
  return res.json({ success: true, contractAddress, abi });
});

// GET /api/dashboard/:walletAddress
app.get("/api/dashboard/:walletAddress", async (req: Request, res: Response): Promise<any> => {
  const walletAddress = (req.params.walletAddress as string).toLowerCase();
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ success: false, error: "Invalid wallet address format" });
  }
  
  try {
    const allSpecialists = await registry.getAllSpecialists(getHealthStatus());
    const userModels = allSpecialists.filter(s => s.wallet.toLowerCase() === walletAddress);
    
    const rawTasks = await taskHistory.getTasksByWallet(walletAddress);
    
    // Calculate total earned only on tasks performed as a specialist node (converted to USDC)
    const totalEarned = rawTasks
      .filter(t => t.status === 'approved' && t.specialistWallet?.toLowerCase() === walletAddress)
      .reduce((sum, t) => sum + parseFloat(ethers.formatUnits(t.amount, 6)), 0);
      
    // Format tasks to match what the client (Transactions page) expects
    const formattedTasks = rawTasks.map(t => {
      const specialist = allSpecialists.find(s => s.wallet.toLowerCase() === t.specialistWallet?.toLowerCase());
      return {
        id: t.taskId,
        niche: t.niche,
        modelName: specialist ? specialist.name : t.niche,
        modelAddress: t.specialistWallet,
        prompt: t.prompt || "Swarm execution job",
        amount: ethers.formatUnits(t.amount, 6),
        status: t.status,
        createdAt: t.timestamp,
        txHash: t.txHash || ""
      };
    });

    const ratingsData = await ratings.getRatingsData();

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    let totalRatings = 0;

    for (const model of userModels) {
      if (ratingsData[model.id] && ratingsData[model.id].history) {
        for (const record of ratingsData[model.id].history) {
          if (record.score >= 1 && record.score <= 5) {
            distribution[record.score as keyof typeof distribution]++;
            totalScore += record.score;
            totalRatings++;
          }
        }
      }
    }
    
    const averageScore = totalRatings > 0 ? totalScore / totalRatings : 0;
    let totalStake = 0;
    for (const m of userModels) {
      totalStake += parseFloat(m.stakedAmount || "0");
    }
      
    return res.json({
      success: true,
      models: userModels,
      totalEarned: totalEarned.toFixed(2),
      tasks: formattedTasks,
      ratings: {
        averageScore,
        totalRatings,
        distribution: Object.entries(distribution).map(([score, count]) => ({ score: parseInt(score), count }))
      },
      totalStake: totalStake.toFixed(2)
    });
  } catch (error: any) {
    logger.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await blockchain.initializeBlockchain();
    startHealthPoller();

    server.listen(PORT, () => {
      logger.info(`==================================================`);
      logger.info(`HiveFi Orchestrator Server running on port ${PORT} (TypeScript)`);
      logger.info(`==================================================`);
    });
  } catch (error) {
    logger.error("Failed to initialize blockchain. Ensure RPC URL, Private Keys, and Contract Addresses are configured in .env", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
