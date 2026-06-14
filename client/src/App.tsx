import { useState, useEffect, useRef } from "react";
import { useSocket } from "./hooks/useSocket";
import EarningsBar from "./components/EarningsBar";
import ChatPanel from "./components/ChatPanel";
import SwarmCanvas from "./components/SwarmCanvas";
import LogFeed from "./components/LogFeed";
import ErrorBoundary from "./components/ErrorBoundary";

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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export default function App() {
  const { socket, socketId, isConnected } = useSocket(API_BASE);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [executionStep, setExecutionStep] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useState<{ orchestrator: string; specialists: Record<string, string> }>({ orchestrator: "1000.00", specialists: {} });
  const [activeSpecialists, setActiveSpecialists] = useState<string[]>([]);
  const [currentExecutingNiche, setCurrentExecutingNiche] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [completedTask, setCompletedTask] = useState<{ modelId: string; taskId: string; niche: string } | null>(null);
  const [showAbstraction, setShowAbstraction] = useState<boolean>(false);
  const [activePanel, setActivePanel] = useState<"swarm" | "log" | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    async function fetchBalances() {
      try {
        const response = await fetch(`${API_BASE}/api/balances`);
        const data = await response.json();
        if (data.success || data.orchestrator) { // fallback check if we don't return success
          setWalletBalances({ orchestrator: data.orchestrator, specialists: data.specialists || {} });
        }
      } catch (err) {
        console.error("Error fetching initial balances:", err);
      }
    }
    
    const timer = setTimeout(fetchBalances, 1000);
    return () => clearTimeout(timer);
  }, [isConnected]);

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
          if (payload.balances) {
            setWalletBalances(payload.balances);
          }
          if (payload.modelId && payload.taskId && payload.niche) {
            setCompletedTask({ modelId: payload.modelId, taskId: payload.taskId, niche: payload.niche });
          }
          break;
        case "TASK_REJECTED":
          logMsg = "Task Failed: Escrow returned to Orchestrator.";
          if (payload.balances) {
            setWalletBalances(payload.balances);
          }
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

    return () => {
      socket.off("STATUS_UPDATE");
    };
  }, [socket]);

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

  const handleSendMessage = async (promptText: string, maxFee?: number) => {
    setIsLoading(true);
    setExecutionStep(null);
    setActiveSpecialists([]);
    setCurrentExecutingNiche(null);
    
    abortControllerRef.current = new AbortController();

    setMessages((prev) => [...prev, { sender: "user", text: promptText }]);

    try {
      const response = await fetch(`${API_BASE}/api/orchestrate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": "hivefi-dev-key-local"
        },
        body: JSON.stringify({ prompt: promptText, socketId, maxFee }),
        signal: abortControllerRef.current?.signal
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [...prev, { sender: "assistant", text: data.text }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "assistant", text: `Error: ${data.error}` },
        ]);
        setExecutionStep("ERROR");
        setEvents((prev) => [
          ...prev,
          { timestamp: new Date(), status: "ERROR", message: `Failed: ${data.error}` },
        ]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      setMessages((prev) => [
        ...prev,
        { 
          sender: "assistant", 
          text: `I am currently operating in **Offline Simulation Mode** since the backend orchestrator is disconnected.\n\nHowever, I can still process your UI requests. Here is an example of an execution plan:\n\n\`\`\`typescript\nfunction executeSwarmTask(niche: string) {\n  const baseFee = 0.05;\n  console.log(\`Dispatching \${niche} specialist to Base Sepolia...\`);\n  \n  return {\n    status: "ESCROW_LOCKED",\n    amount: baseFee\n  };\n}\n\`\`\`\n\nThe UI will automatically parse this code block. Try connecting the backend to execute real transactions!` 
        },
      ]);
      setExecutionStep("ERROR");
      setEvents((prev) => [
        ...prev,
        { timestamp: new Date(), status: "ERROR", message: `System offline. Mock response generated.` },
      ]);
    } finally {
      if (abortControllerRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full text-white bg-transparent min-w-0">
      <EarningsBar
        walletBalances={walletBalances}
        isConnected={isConnected}
        showAbstraction={showAbstraction}
        onToggleAbstraction={() => setShowAbstraction(!showAbstraction)}
      />

      <main 
        className={`flex-1 min-h-0 min-w-0 grid grid-cols-1 p-4 md:p-6 overflow-hidden transition-all duration-500 smooth-spring ${
          showAbstraction 
            ? isFullScreen 
              ? "lg:grid-cols-[0px_1fr] gap-0" 
              : "lg:grid-cols-[1fr_450px] gap-6" 
            : "lg:grid-cols-[1fr_0px] gap-0"
        }`}
      >
        <div className={`transition-all duration-500 smooth-spring flex flex-col h-full min-h-0 w-full overflow-hidden min-w-0 ${
          isFullScreen && showAbstraction ? "hidden lg:flex lg:w-0 lg:opacity-0" : "opacity-100"
        }`}>
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              executionStep={executionStep}
              currentNiche={currentExecutingNiche}
              ratingPrompt={completedTask}
              onRate={handleRate}
              onCancel={handleCancelRequest}
            />
        </div>

        <div className={`flex flex-col gap-6 transition-all duration-500 smooth-spring min-h-0 min-w-0 ${
            showAbstraction ? "opacity-100 h-[600px] lg:h-full mt-6 lg:mt-0" : "opacity-0 h-0 lg:h-auto pointer-events-none"
          }`}>
            <div className={`transition-all duration-500 smooth-spring min-h-0 overflow-hidden ${
              activePanel === "log" ? "h-[60px] shrink-0" : "flex-1"
            }`}>
              <ErrorBoundary>
              <SwarmCanvas 
                executionStep={executionStep} 
                activeSpecialists={activeSpecialists}
                currentExecutingNiche={currentExecutingNiche}
                mode={activePanel === "log" ? "minimized" : isFullScreen && activePanel === "swarm" ? "fullscreen" : activePanel === "swarm" ? "enlarged" : "normal"}
                onToggleEnlarge={() => {
                  if (activePanel === "swarm" && !isFullScreen) setActivePanel(null);
                  else { setActivePanel("swarm"); setIsFullScreen(false); }
                }}
                onToggleFullScreen={() => {
                  if (isFullScreen && activePanel === "swarm") { setIsFullScreen(false); setActivePanel(null); }
                  else { setActivePanel("swarm"); setIsFullScreen(true); }
                }}
              />
            </ErrorBoundary>
            </div>
            
            <div className={`transition-all duration-500 smooth-spring min-h-0 overflow-hidden ${
              activePanel === "swarm" ? "h-[60px] shrink-0" : activePanel === "log" ? "flex-1" : "h-[300px] shrink-0"
            }`}>
            <LogFeed 
              events={events}
              mode={activePanel === "swarm" ? "minimized" : isFullScreen && activePanel === "log" ? "fullscreen" : activePanel === "log" ? "enlarged" : "normal"}
              onToggleEnlarge={() => {
                if (activePanel === "log" && !isFullScreen) setActivePanel(null);
                else { setActivePanel("log"); setIsFullScreen(false); }
              }}
              onToggleFullScreen={() => {
                if (isFullScreen && activePanel === "log") { setIsFullScreen(false); setActivePanel(null); }
                else { setActivePanel("log"); setIsFullScreen(true); }
              }}
            />
            </div>
        </div>
      </main>
    </div>
  );
}
