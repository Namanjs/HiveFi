import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useWallet } from "../hooks/useWallet";

interface Message {
  sender: "user" | "assistant";
  text: string;
}

interface LogEvent {
  timestamp: Date;
  status: string;
  message: string;
  txHash?: string | null;
}

interface ChatContextType {
  socket: Socket | null;
  socketId: string | null;
  isConnected: boolean;
  messages: Message[];
  events: LogEvent[];
  executionStep: string | null;
  activeSpecialists: string[];
  currentExecutingNiche: string | null;
  isLoading: boolean;
  completedTask: { modelId: string; taskId: string; niche: string } | null;
  showAbstraction: boolean;
  activePanel: "swarm" | "log" | null;
  pendingIntent: any;
  pendingPrompt: string;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  activeStreamIndex: number | null;
  setActiveStreamIndex: React.Dispatch<React.SetStateAction<number | null>>;
  availableModels: any[];
  registryLoaded: boolean;
  setAvailableModels: React.Dispatch<React.SetStateAction<any[]>>;
  selectedModels: Record<string, string>;
  setSelectedModels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setEvents: React.Dispatch<React.SetStateAction<LogEvent[]>>;
  setExecutionStep: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveSpecialists: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentExecutingNiche: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCompletedTask: React.Dispatch<React.SetStateAction<{ modelId: string; taskId: string; niche: string } | null>>;
  setShowAbstraction: React.Dispatch<React.SetStateAction<boolean>>;
  setActivePanel: React.Dispatch<React.SetStateAction<"swarm" | "log" | null>>;
  setPendingIntent: React.Dispatch<React.SetStateAction<any>>;
  setPendingPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleSendMessage: (promptText: string, maxFee?: number) => Promise<void>;
  executePrompt: (nicheModels: Record<string, string>, maxFee?: number, intentOverride?: any) => Promise<void>;
  handleCancelRequest: () => void;
  handleRate: (score: number) => Promise<void>;
  workspaceFiles: Record<string, string>;
  activeFilePath: string | null;
  activeTab: "network" | "workspace" | "preview";
  rightPanelWidth: number;
  setWorkspaceFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setActiveFilePath: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveTab: React.Dispatch<React.SetStateAction<"network" | "workspace" | "preview">>;
  setRightPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  handleNewFile: (path: string) => void;
  handleDeleteFile: (path: string) => void;
  handleRenameFile: (oldPath: string, newPath: string) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const { address } = useWallet();

  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [executionStep, setExecutionStep] = useState<string | null>(null);
  const [activeSpecialists, setActiveSpecialists] = useState<string[]>([]);
  const [currentExecutingNiche, setCurrentExecutingNiche] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [completedTask, setCompletedTask] = useState<{ modelId: string; taskId: string; niche: string } | null>(null);
  const [showAbstraction, setShowAbstraction] = useState<boolean>(false);
  const [activePanel, setActivePanel] = useState<"swarm" | "log" | null>(null);
  const [pendingIntent, setPendingIntent] = useState<any>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string>("");

  const [input, setInput] = useState<string>("");
  const [activeStreamIndex, setActiveStreamIndex] = useState<number | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, string>>({});
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"network" | "workspace" | "preview">("network");
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(480);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/registry`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.specialists) {
          const uniqueModels = new Map();
          data.specialists.forEach((m: any) => {
            uniqueModels.set(m.name, m);
          });
          setAvailableModels(Array.from(uniqueModels.values()));
          setRegistryLoaded(true);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (pendingIntent && pendingIntent.chain) {
      const newSelected: Record<string, string> = {};
      pendingIntent.chain.forEach((step: any) => {
        const niche = step.niche.toUpperCase();
        if (!newSelected[niche]) {
          const matchingModels = availableModels.filter(m => m.niche.toUpperCase() === niche);
          if (matchingModels.length > 0) {
            newSelected[niche] = matchingModels[0].id;
          }
        }
      });
      setSelectedModels(newSelected);
    }
  }, [pendingIntent, availableModels]);

  // Removed activeStreamIndex useEffect as responses are now instant

  useEffect(() => {
    const socketInstance: Socket = io(API_BASE, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
      setSocketId(socketInstance.id || null);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      setSocketId(null);
    });

    socketInstance.on("connect_error", () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("STATUS_UPDATE", (payload: any) => {
      setExecutionStep(payload.status);

      if (payload.niche) {
        if (payload.status === "EXECUTING_SPECIALIST" || payload.status === "EVALUATING_RESULT" || payload.status === "CHAIN_STEP") {
          setCurrentExecutingNiche(String(payload.niche).toUpperCase());
        }
      }

      let logMsg = "";
      switch (payload.status) {
        case "ANALYZING_INTENT":
          logMsg = "Orchestrator: Analyzing intent and model mapping...";
          break;
        case "CHAIN_STEP":
          logMsg = `Chain Step ${payload.stepIndex}/${payload.totalSteps}: Hiring ${payload.niche} specialist...`;
          break;
        case "ESCROW_TX_PENDING":
          logMsg = "Orchestrator: Dispatching L2 escrow deposit...";
          break;
        case "ESCROW_LOCKED":
          logMsg = `Escrow Locked: ${payload.amount || "0.05"} USDC secured. (Task ID: ${payload.taskId})`;
          setActiveSpecialists((prev) => [...prev, payload.niche]);
          break;
        case "EXECUTING_SPECIALIST":
          logMsg = `Specialist: Executing ${payload.niche || "task"}...`;
          break;
        case "EVALUATING_RESULT":
          logMsg = "Orchestrator: Verifying Specialist execution...";
          break;
        case "SETTLEMENT_TX_PENDING":
          logMsg = "Orchestrator: Target validation passed. Structuring payout...";
          break;
        case "FUNDS_RELEASED":
          logMsg = `Funds Released: ${payload.amount || "0.05"} USDC distributed. Swarm complete.`;
          if (payload.modelId && payload.taskId && payload.niche) {
            setCompletedTask({ modelId: payload.modelId, taskId: payload.taskId, niche: payload.niche });
          }
          break;
        case "TASK_REJECTED":
          logMsg = "Task Failed: Escrow returned to Orchestrator.";
          break;
        case "DIRECT_RESPONSE":
          logMsg = "Orchestrator: Prompt resolved natively. Skipping delegation.";
          break;
        default:
          logMsg = `System status: ${payload.status}`;
      }

      setEvents((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          status: payload.status,
          message: logMsg,
          txHash: payload.txHash || null,
        },
      ]);
    });

    socket.on("FILE_UPDATE", (payload: { path: string; content: string }) => {
      setWorkspaceFiles(prev => ({ ...prev, [payload.path]: payload.content }));
      setActiveFilePath(prev => prev || payload.path);
    });

    socket.on("FILE_DELETE", (payload: { path: string }) => {
      setWorkspaceFiles(prev => {
        const next = { ...prev };
        delete next[payload.path];
        return next;
      });
      setActiveFilePath(prev => prev === payload.path ? null : prev);
    });

    socket.on("CODE_GEN_COMPLETE", (payload: { files: Record<string, string>; fileTree: any[]; metadata: any }) => {
      setWorkspaceFiles(payload.files);
      const paths = Object.keys(payload.files);
      if (paths.length > 0) {
        setActiveFilePath(paths[0]);
        setActiveTab("workspace");
      }
      setIsLoading(false);
      setExecutionStep("COMPLETED");
      setMessages(prev => [...prev, {
        sender: "assistant",
        text: buildCompletionMessage(payload)
      }]);
    });

    return () => {
      socket.off("STATUS_UPDATE");
      socket.off("FILE_UPDATE");
      socket.off("FILE_DELETE");
      socket.off("CODE_GEN_COMPLETE");
    };
  }, [socket]);

  const handleNewFile = (path: string) => {
    setWorkspaceFiles(prev => {
      if (prev[path]) return prev;
      return { ...prev, [path]: '' };
    });
    setActiveFilePath(path);
  };

  const handleDeleteFile = (path: string) => {
    setWorkspaceFiles(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setActiveFilePath(prev => prev === path ? null : prev);
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    setWorkspaceFiles(prev => {
      const next = { ...prev };
      if (next[oldPath] !== undefined) {
        next[newPath] = next[oldPath];
        delete next[oldPath];
      }
      return next;
    });
    setActiveFilePath(newPath);
  };

  function buildCompletionMessage(payload: any): string {
    const files = Object.keys(payload.files).length;
    const steps = payload.metadata?.totalSteps || 0;
    const iters = payload.metadata?.iteration || 0;
    return `✅ **Code generation complete** for "${payload.metadata?.name || 'project'}"\n\n` +
      `- ${files} files created across ${steps} specialists\n` +
      `- ${iters + 1} iteration${iters > 0 ? 's' : ''} (review loop)\n` +
      `- Total cost: ${payload.metadata?.totalCost || '0'} USDC\n\n` +
      `Switch to the **Workspace** tab to view and edit the code, or the **Preview** tab to see it running.`;
  }

  const handleRate = async (score: number) => {
    if (!completedTask) return;
    try {
      await fetch(`${API_BASE}/api/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...completedTask, score }),
      });
    } catch (err) {
      console.error("Failed to submit rating", err);
    }
    setCompletedTask(null);
  };

  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setExecutionStep("ERROR");
    setEvents((prev) => [
      ...prev,
      { timestamp: new Date(), status: "ERROR", message: "User cancelled the request." },
    ]);
    setMessages((prev) => [
      ...prev,
      { sender: "assistant", text: "*(Request cancelled by user)*" },
    ]);
  };

  const executePrompt = async (nicheModels: Record<string, string>, maxFee?: number, intentOverride?: any, promptOverride?: string) => {
    setIsLoading(true);
    setPendingIntent(null);

    abortControllerRef.current = new AbortController();

    try {
      const delegationMode = localStorage.getItem("delegation_mode") || "builtin";
      const customEndpoint = localStorage.getItem("personal_endpoint") || "";
      const currentPrompt = promptOverride || pendingPrompt;
      const localMaxFee = localStorage.getItem("max_fee");
      const finalMaxFee = maxFee !== undefined ? maxFee : (localMaxFee ? parseFloat(localMaxFee) : 2.0);

      const response = await fetch(`${API_BASE}/api/orchestrate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "hivefi-dev-key-local"
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          socketId,
          maxFee: finalMaxFee,
          clientWallet: address,
          delegationMode,
          customEndpoint,
          preAnalyzedIntent: intentOverride || pendingIntent,
          nicheModels
        }),
        signal: abortControllerRef.current?.signal
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [...prev, { sender: "assistant", text: data.text }]);
        setExecutionStep("COMPLETED");
      } else {
        throw new Error(data.error || "Orchestration failed");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error(error);
        setMessages((prev) => [...prev, { sender: "assistant", text: `**Error:** ${error.message}` }]);
        setExecutionStep("ERROR");
      }
    } finally {
      setIsLoading(false);
      setCurrentExecutingNiche(null);
    }
  };

  const handleSendMessage = async (promptText: string, maxFee?: number) => {
    setIsLoading(true);
    setExecutionStep(null);
    setActiveSpecialists([]);
    setCurrentExecutingNiche(null);
    setPendingIntent(null);
    setPendingPrompt(promptText);

    abortControllerRef.current = new AbortController();

    try {
      setMessages((prev) => [...prev, { sender: "user", text: promptText }]);

      const delegationMode = localStorage.getItem("delegation_mode") || "builtin";
      const customEndpoint = localStorage.getItem("personal_endpoint") || "";

      const response = await fetch(`${API_BASE}/api/analyze-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "hivefi-dev-key-local"
        },
        body: JSON.stringify({
          prompt: promptText,
          maxFee,
          clientWallet: address,
          delegationMode,
          customEndpoint
        }),
        signal: abortControllerRef.current.signal
      });

      const data = await response.json();

      if (data.success) {
        if (data.intent && data.intent.delegate !== false) {
          if (delegationMode === "manual") {
            setPendingIntent(data.intent);
            setIsLoading(false);
          } else {
            // Auto-execute for built-in, hired, personal
            await executePrompt({}, maxFee, data.intent, promptText);
          }
        } else {
          await executePrompt({}, maxFee, data.intent, promptText);
        }
      } else {
        throw new Error(data.error || "Failed to analyze intent");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error(error);
        setMessages((prev) => [...prev, { sender: "assistant", text: `**Error:** ${error.message}` }]);
        setIsLoading(false);
      }
    }
  };

  const value = {
    socket,
    socketId,
    isConnected,
    messages,
    events,
    executionStep,
    activeSpecialists,
    currentExecutingNiche,
    isLoading,
    completedTask,
    showAbstraction,
    activePanel,
    pendingIntent,
    pendingPrompt,
    input,
    setInput,
    activeStreamIndex,
    setActiveStreamIndex,
    availableModels,
    registryLoaded,
    setAvailableModels,
    selectedModels,
    setSelectedModels,
    setMessages,
    setEvents,
    setExecutionStep,
    setActiveSpecialists,
    setCurrentExecutingNiche,
    setIsLoading,
    setCompletedTask,
    setShowAbstraction,
    setActivePanel,
    setPendingIntent,
    setPendingPrompt,
    handleSendMessage,
    executePrompt,
    handleCancelRequest,
    handleRate,
    workspaceFiles,
    activeFilePath,
    activeTab,
    setWorkspaceFiles,
    setActiveFilePath,
    setActiveTab,
    rightPanelWidth,
    setRightPanelWidth,
    handleNewFile,
    handleDeleteFile,
    handleRenameFile,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
