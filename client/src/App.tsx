import { useChat } from "./contexts/ChatContext";
import EarningsBar from "./components/EarningsBar";
import ChatPanel from "./components/ChatPanel";
import SwarmCanvas from "./components/SwarmCanvas";
import LogFeed from "./components/LogFeed";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  const {
    messages,
    events,
    executionStep,
    activeSpecialists,
    currentExecutingNiche,
    isLoading,
    completedTask,
    showAbstraction,
    activePanel,
    isFullScreen,
    pendingIntent,
    setShowAbstraction,
    setActivePanel,
    setIsFullScreen,
    handleSendMessage,
    executePrompt,
    handleCancelRequest,
    handleRate,
    availableModels,
    socketId
  } = useChat();

  return (
    <div className="flex flex-col h-full w-full text-white bg-transparent min-w-0">
      <EarningsBar
        isServerConnected={!!socketId}
        showAbstraction={showAbstraction}
        onToggleAbstraction={() => setShowAbstraction(!showAbstraction)}
      />

      <main
        className={`flex-1 min-h-0 min-w-0 grid grid-cols-1 p-4 md:p-6 overflow-hidden transition-all duration-500 smooth-spring ${showAbstraction
            ? isFullScreen
              ? "lg:grid-cols-[0px_1fr] gap-0"
              : "lg:grid-cols-[1fr_450px] gap-6"
            : "lg:grid-cols-[1fr_0px] gap-0"
          }`}
      >
        <div className={`transition-all duration-500 smooth-spring flex flex-col h-full min-h-0 w-full overflow-hidden min-w-0 ${isFullScreen && showAbstraction ? "hidden lg:flex lg:w-0 lg:opacity-0" : "opacity-100"
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
            pendingIntent={pendingIntent}
            onExecutePrompt={executePrompt}
          />
        </div>

        <div className={`flex flex-col gap-6 transition-all duration-500 smooth-spring min-h-0 min-w-0 ${showAbstraction ? "opacity-100 h-[600px] lg:h-full mt-6 lg:mt-0" : "opacity-0 h-0 lg:h-auto pointer-events-none"
          }`}>
          <div className={`transition-all duration-500 smooth-spring min-h-0 overflow-hidden ${activePanel === "log" ? "h-[60px] shrink-0" : "flex-1"
            }`}>
            <ErrorBoundary>
              <SwarmCanvas
                executionStep={executionStep}
                activeSpecialists={activeSpecialists}
                currentExecutingNiche={currentExecutingNiche}
                latestTask={[...messages].reverse().find(m => m.sender === 'user')?.text || ""}
                mode={activePanel === "log" ? "minimized" : isFullScreen && activePanel === "swarm" ? "fullscreen" : activePanel === "swarm" ? "enlarged" : "normal"}
                onToggleEnlarge={() => {
                  if (activePanel === "swarm" && !isFullScreen) setActivePanel(null);
                  else { setActivePanel("swarm"); setIsFullScreen(false); }
                }}
                onToggleFullScreen={() => {
                  if (isFullScreen && activePanel === "swarm") { setIsFullScreen(false); setActivePanel(null); }
                  else { setActivePanel("swarm"); setIsFullScreen(true); }
                }}
                availableModels={availableModels}
              />
            </ErrorBoundary>
          </div>

          <div className={`transition-all duration-500 smooth-spring min-h-0 overflow-hidden ${activePanel === "swarm" ? "h-[60px] shrink-0" : activePanel === "log" ? "flex-1" : "h-[300px] shrink-0"
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
