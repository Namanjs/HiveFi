import { logger } from "./services/logger";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { spawn } from "child_process";
import cors from "cors";
import rateLimit from 'express-rate-limit';
import * as dotenv from "dotenv";
import fs from "fs";
import { runCommandInSandbox } from "./services/sandbox";
import { handleToolApprovalResponse } from "./services/toolExecutor";

dotenv.config();

import { ethers } from "ethers";
import * as blockchain from "./services/blockchain";
import { orchestrate, analyzeIntent, registerCancellation } from "./services/orchestrator";
import * as registry from "./services/registry";
import * as ratings from "./services/ratings";
import * as llm from "./services/llm";
import * as taskHistory from "./services/taskHistory";
import { requireApiKey, isValidApiKey } from "./services/auth";
import { parseHiveFiError } from "./services/errorParser";

// Health Status state
let healthStatus: Record<string, boolean> = {};
export function getHealthStatus() {
  return Object.freeze({ ...healthStatus });
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
server.timeout = 300000; // 5 min — prevents hung requests during orchestration

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

io.use(async (socket, next) => {
  try {
    const apiKey = socket.handshake.query.apiKey || socket.handshake.headers["x-api-key"];
    if (typeof apiKey !== "string") {
      logger.warn(`Unauthorized WebSocket connection attempt: missing API key.`);
      return next(new Error("Unauthorized: Missing API Key"));
    }
    const valid = await isValidApiKey(apiKey);
    if (!valid) {
      logger.warn(`Unauthorized WebSocket connection attempt: invalid API key.`);
      return next(new Error("Unauthorized: Invalid API Key"));
    }
    next();
  } catch (err: any) {
    logger.error("Error during WebSocket handshake auth:", err);
    next(new Error("Internal Server Error during handshake auth"));
  }
});

io.on("connection", (socket: Socket) => {
  logger.info(`Client connected: ${socket.id}`);

  let activeRun: { kill: () => void } | null = null;

  // Terminal command execution stream
  socket.on("EXECUTE_COMMAND", (data: { command: string }) => {
    const { command } = data;
    logger.info(`Terminal executing command in sandbox: ${command}`);

    if (activeRun) {
      activeRun.kill();
    }

    // Spawn a bash process in the root monorepo directory (one level up from server/)
    const rootPath = path.resolve(__dirname, "..");
    const { process: proc, kill } = runCommandInSandbox(command, rootPath);
    activeRun = { kill };

    proc.stdout?.on("data", (chunk) => {
      socket.emit("TERMINAL_OUTPUT", { text: chunk.toString() });
    });

    proc.stderr?.on("data", (chunk) => {
      socket.emit("TERMINAL_OUTPUT", { text: chunk.toString(), isError: true });
    });

    proc.on("close", (code) => {
      socket.emit("TERMINAL_EXIT", { code: code ?? 0 });
      activeRun = null;
    });

    proc.on("error", (err) => {
      socket.emit("TERMINAL_OUTPUT", { text: `Failed to start process: ${err.message}\n`, isError: true });
      socket.emit("TERMINAL_EXIT", { code: 1 });
      activeRun = null;
    });

    // Handle process termination if client cancels or disconnects
    socket.on("disconnect", () => {
      if (activeRun) {
        activeRun.kill();
      }
    });
  });

  socket.on("CANCEL_EXECUTION", () => {
    logger.info(`Cancellation requested by client: ${socket.id}`);
    registerCancellation(socket.id);
  });

  socket.on("TOOL_APPROVAL_RESPONSE", (data: { id: string; approved: boolean }) => {
    handleToolApprovalResponse(data.id, data.approved);
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
    registerCancellation(socket.id);
  });
});

// GET /api/health
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

// Helper to recursively scan directory
function scanDirectory(dir: string, baseDir: string): Record<string, string> {
  let files: Record<string, string> = {};
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    const relPath = path.relative(baseDir, fullPath);
    
    // Ignore patterns
    if (
      item === "node_modules" ||
      item === ".git" ||
      item === "dist" ||
      item === "build" ||
      item === ".next" ||
      item === "package-lock.json" ||
      item === ".npm" ||
      item === ".pnpm-store"
    ) {
      continue;
    }
    
    if (stat.isDirectory()) {
      Object.assign(files, scanDirectory(fullPath, baseDir));
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      const binaryExtensions = [
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
        ".pdf", ".zip", ".tar", ".gz", ".rar", ".mp3", ".mp4",
        ".woff", ".woff2", ".ttf", ".eot", ".wasm"
      ];
      if (binaryExtensions.includes(ext)) continue;
      
      try {
        if (stat.size < 1000000) { // Limit to 1MB
          const content = fs.readFileSync(fullPath, "utf8");
          files[relPath] = content;
        }
      } catch (e: any) {
        logger.warn(`Failed to read file ${fullPath} during scanDirectory: ${e.message}`);
      }
    }
  }
  return files;
}

// GET /api/files
app.get("/api/files", requireApiKey, (req: Request, res: Response) => {
  try {
    const projectRoot = path.resolve(__dirname, "..");
    const files = scanDirectory(projectRoot, projectRoot);
    res.json({ success: true, files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/files/write
app.post("/api/files/write", requireApiKey, (req: Request, res: Response) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: "filePath is required" });
    }
    const projectRoot = path.resolve(__dirname, "..");
    const fullPath = path.resolve(projectRoot, filePath);
    
    // Safety check to keep files within the workspace root
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content || "", "utf8");
    
    io.emit("FILE_UPDATE", { path: filePath, content });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/files/delete
app.post("/api/files/delete", requireApiKey, (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: "filePath is required" });
    }
    const projectRoot = path.resolve(__dirname, "..");
    const fullPath = path.resolve(projectRoot, filePath);
    
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    
    io.emit("FILE_DELETE", { path: filePath });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/files/rename
app.post("/api/files/rename", requireApiKey, (req: Request, res: Response) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      return res.status(400).json({ success: false, error: "oldPath and newPath are required" });
    }
    const projectRoot = path.resolve(__dirname, "..");
    const fullOldPath = path.resolve(projectRoot, oldPath);
    const fullNewPath = path.resolve(projectRoot, newPath);
    
    if (!fullOldPath.startsWith(projectRoot) || !fullNewPath.startsWith(projectRoot)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    if (fs.existsSync(fullOldPath)) {
      fs.mkdirSync(path.dirname(fullNewPath), { recursive: true });
      fs.renameSync(fullOldPath, fullNewPath);
    }
    
    io.emit("FILE_RENAME", { oldPath, newPath });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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

  req.setTimeout(300000, () => {
    if (!res.headersSent) {
      res.status(504).json({ success: false, error: "Orchestration timed out after 5 minutes" });
    }
  });

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: "Prompt must be a non-empty string" });
  }

  if (prompt.length > 10000) {
    return res.status(400).json({ success: false, error: "Prompt exceeds maximum length of 10000 characters" });
  }

  // Retrieve client socket if available
  const socket = socketId ? io.sockets.sockets.get(socketId) : null;
  const targetSocket = socket || { emit: () => {} }; // use noop socket instead of broadcasting to all

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

// GET /api/balances
app.get("/api/balances", requireApiKey, async (_req: Request, res: Response): Promise<any> => {
  try {
    const addresses = blockchain.getAddresses();
    const orchestratorBalance = await blockchain.getUSDCBalance(addresses.walletA);

    const specialists = await registry.getAllSpecialists(getHealthStatus());
    const specialistBalances: Record<string, string> = {};

    for (const spec of specialists) {
      if (spec.wallet) {
        specialistBalances[spec.id] = await blockchain.getUSDCBalance(spec.wallet);
      }
    }

    return res.json({
      success: true,
      orchestratorBalance,
      specialistBalances
    });
  } catch (error: any) {
    logger.error("Error fetching balances:", error);
    return res.status(500).json({ success: false, error: parseHiveFiError(error) });
  }
});

// POST /api/registry/register-endpoint
app.post("/api/registry/register-endpoint", requireApiKey, async (req: Request, res: Response): Promise<any> => {
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
app.post("/api/ratings", requireApiKey, async (req: Request, res: Response): Promise<any> => {
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

// Global error handler (must be after all routes)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: parseHiveFiError(err) });
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
