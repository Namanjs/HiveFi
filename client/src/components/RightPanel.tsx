import { useRef, useCallback, useEffect, useMemo } from "react";
import { useChat } from "../contexts/ChatContext";
import SwarmCanvas from "./SwarmCanvas";
import LogFeed from "./LogFeed";
import CodePanel from "./CodePanel";
import PreviewPanel from "./PreviewPanel";

interface RightPanelProps {
  executionStep: string | null;
  activeSpecialists: string[];
  currentExecutingNiche?: string | null;
  latestTask?: string;
  availableModels?: any[];
  events: any[];
}

export default function RightPanel(props: RightPanelProps) {
  const {
    activeTab, setActiveTab, workspaceFiles,
    rightPanelWidth, setRightPanelWidth,
    activePanel, setActivePanel,
  } = useChat();

  const hasCode = Object.keys(workspaceFiles).length > 0;
  const hasFrontendFiles = useMemo(() => {
    return Object.keys(workspaceFiles).some(f =>
      !f.startsWith("server/") && !f.startsWith("api/") && !f.endsWith(".py")
    );
  }, [workspaceFiles]);

  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    if (activeTab === "network") return;
    isDragging.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, [activeTab]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = window.innerWidth - e.clientX;
    const clamped = Math.max(380, Math.min(1200, newWidth));
    setRightPanelWidth(clamped);
  }, [setRightPanelWidth]);

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const panelWidth = activeTab === "network" ? 480 : rightPanelWidth;

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-x-hidden w-full" style={{ maxWidth: panelWidth, width: panelWidth }}>
      <div
        ref={dragRef}
        onMouseDown={handleMouseDown}
        className={`w-1 shrink-0 cursor-ew-resize hover:bg-[var(--color-accent)]/50 transition-colors ${
          activeTab === "network"
            ? "cursor-default hover:bg-transparent"
            : "cursor-ew-resize"
        }`}
      />

      <div className="flex flex-col h-full min-h-0 flex-1 min-w-0">
        <div className="flex gap-0 border-b border-white/10 bg-black/40 shrink-0">
          <TabButton
            label="Network"
            tab="network"
            activeTab={activeTab}
            onClick={() => setActiveTab("network")}
          />
          <TabButton
            label="Workspace"
            tab="workspace"
            activeTab={activeTab}
            onClick={() => setActiveTab("workspace")}
            badge={hasCode ? Object.keys(workspaceFiles).length : undefined}
            disabled={!hasCode}
          />
          <TabButton
            label="Preview"
            tab="preview"
            activeTab={activeTab}
            onClick={() => setActiveTab("preview")}
            disabled={!hasFrontendFiles}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "network" && (
            <div className="flex flex-col h-full min-h-0 gap-4 pt-4">
              <div className={`transition-all duration-500 smooth-spring min-h-0 overflow-hidden ${
                activePanel === "log" ? "h-[60px] shrink-0" : "flex-1"
              }`}>
                <SwarmCanvas
                  {...props}
                  mode={activePanel === "log" ? "minimized" : activePanel === "swarm" ? "enlarged" : "normal"}
                  onToggleEnlarge={() => setActivePanel(activePanel === "swarm" ? null : "swarm")}
                />
              </div>

              <div className={`transition-all duration-500 smooth-spring min-h-0 overflow-hidden ${
                activePanel === "swarm" ? "h-[60px] shrink-0" : activePanel === "log" ? "flex-1" : "h-[300px] shrink-0"
              }`}>
                <LogFeed
                  events={props.events}
                  mode={activePanel === "swarm" ? "minimized" : activePanel === "log" ? "enlarged" : "normal"}
                  onToggleEnlarge={() => setActivePanel(activePanel === "log" ? null : "log")}
                />
              </div>
            </div>
          )}
          {activeTab === "workspace" && (
            <CodePanel />
          )}
          {activeTab === "preview" && (
            <PreviewPanel />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, tab, activeTab, onClick, badge, disabled }: {
  label: string;
  tab: string;
  activeTab: string;
  onClick: () => void;
  badge?: number;
  disabled?: boolean;
}) {
  const isActive = activeTab === tab;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative px-5 py-3 text-sm font-medium transition-all duration-200 
        ${isActive
          ? "text-white border-b-2 border-[var(--color-accent)]"
          : disabled
            ? "text-white/20 cursor-not-allowed"
            : "text-white/50 hover:text-white/80 border-b-2 border-transparent"
        }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
          {badge}
        </span>
      )}
    </button>
  );
}
