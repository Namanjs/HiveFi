import { useChat } from "./contexts/ChatContext";
import EarningsBar from "./components/EarningsBar";
import ChatPanel from "./components/ChatPanel";
import RightPanel from "./components/RightPanel";
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
    pendingIntent,
    handleSendMessage,
    executePrompt,
    handleCancelRequest,
    handleRate,
    availableModels,
    socketId,
  } = useChat();

  return (
    <div className="flex flex-col h-full w-full text-white bg-transparent min-w-0">
      <EarningsBar isServerConnected={!!socketId} />

      <main className="flex-1 min-h-0 min-w-0 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-4 md:p-6 overflow-hidden">
        <ErrorBoundary>
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
        </ErrorBoundary>

        <ErrorBoundary>
          <RightPanel
            executionStep={executionStep}
            activeSpecialists={activeSpecialists}
            currentExecutingNiche={currentExecutingNiche}
            latestTask={[...messages].reverse().find(m => m.sender === 'user')?.text || ""}
            availableModels={availableModels}
            events={events}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}
