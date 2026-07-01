import { useChat } from "./contexts/ChatContext";
import EarningsBar from "./components/EarningsBar";
import ChatPanel from "./components/ChatPanel";
import RightPanel from "./components/RightPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import ToolApprovalModal from "./components/ToolApprovalModal";

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

      <main className="flex-1 min-h-0 min-w-0 flex flex-wrap xl:flex-nowrap gap-6 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
        <div className="flex-1 min-w-[min(100%,400px)] h-[600px] xl:h-full min-h-0 shrink-0">
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
        </div>

        <div className="w-full xl:w-auto h-[600px] xl:h-full min-h-0 shrink-0 flex justify-center xl:block">
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
        </div>
      </main>

      <ToolApprovalModal />
    </div>
  );
}
