import { useEffect, useRef } from "react";
import { Terminal, ExternalLink, Maximize2, Minimize2, Monitor } from "lucide-react";

interface LogEvent {
  timestamp: Date;
  status: string;
  message: string;
  txHash?: string | null;
  isMock?: boolean;
}

interface LogFeedProps {
  events: LogEvent[];
  mode?: "normal" | "enlarged" | "fullscreen" | "minimized";
  onToggleEnlarge?: () => void;
  onToggleFullScreen?: () => void;
}

export default function LogFeed({ events, mode = "normal", onToggleEnlarge, onToggleFullScreen }: LogFeedProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "minimized" || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const timeoutId = setTimeout(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [events, mode]);

  const getLogColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === "SPECIALIST_UNAVAILABLE") return "text-orange-400";
    if (s === "CHAIN_STEP") return "text-(--color-secondary-accent)";
    if (s.includes("PENDING")) return "text-yellow-500";
    if (s.includes("LOCKED") || s.includes("RELEASED") || s === "DIRECT_RESPONSE") return "text-[#10b981]";
    if (s === "ERROR" || s.includes("REJECTED")) return "text-red-500";
    return "text-(--color-text-primary)";
  };

  const isMinimized = mode === "minimized";
  const isEnlarged = mode === "enlarged" || mode === "fullscreen";

  return (
    <div className="flex flex-col h-full max-h-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-3xl shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)] overflow-hidden transition-all duration-500 relative group">
      
      <div className={`absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-(--color-accent) to-transparent transition-opacity duration-500 ${isEnlarged ? "opacity-100 shadow-[0_0_15px_var(--color-accent)]" : "opacity-30"}`} />

      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-linear-to-r from-white/5 to-transparent z-20">
        <div className="flex items-center gap-2 text-(--color-text-secondary)">
          <Terminal size={14} className="text-(--color-accent) animate-pulse" />
          <span className="text-xs font-bold tracking-[0.15em] uppercase text-white drop-shadow-md">Event Log</span>
          {events.length > 0 && <span className="ml-2 text-[10px] bg-white/10 px-2 py-0.5 rounded-full">{events.length}</span>}
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleEnlarge && (
            <button 
              type="button"
              onClick={onToggleEnlarge} 
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
              title={isEnlarged ? "Restore" : "Enlarge panel"}
              aria-label={isEnlarged ? "Restore event log panel" : "Enlarge event log panel"}
            >
              {isEnlarged ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          {onToggleFullScreen && (
            <button 
              type="button"
              onClick={onToggleFullScreen} 
              className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${mode === "fullscreen" ? "text-(--color-accent) bg-(--color-accent)/20" : "text-white/50 hover:text-white"}`}
              title="Toggle Fullscreen"
              aria-label="Toggle event log fullscreen"
            >
              <Monitor size={14} />
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col min-h-0 relative transition-opacity duration-300 ${isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="flex-1 overflow-y-auto bg-black/10 scroll-smooth relative no-scrollbar" ref={scrollContainerRef}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] bg-size-[100%_4px] pointer-events-none mix-blend-overlay" />
          
          <div className="p-6 pb-12 flex flex-col gap-6 font-mono text-[13px] relative">
            {events.length === 0 ? (
              <div className="flex items-center gap-2 text-[#888] text-[12px] min-h-full justify-center mx-auto">
                <div className="w-2 h-2 bg-(--color-accent) rounded-full animate-ping" />
                Awaiting system events...
              </div>
            ) : (
              <>
                {events.map((evt, idx) => (
                  <div key={idx} className="flex gap-4 shrink-0 animate-[slide-up_0.3s_ease-out_forwards]">
                    <div className="text-[#888] shrink-0 w-20 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                    </div>
                    <div className="flex-1 text-gray-200 border-l border-white/10 pl-4 leading-relaxed">
                      <div className={`${getLogColor(evt.status)} drop-shadow-sm`}>
                        {evt.message}
                      </div>
                      {evt.txHash && (
                        <a
                          href={evt.isMock ? "#" : `https://sepolia.basescan.org/tx/${evt.txHash}`}
                          target={evt.isMock ? "_self" : "_blank"}
                          rel="noopener noreferrer"
                          className="inline-flex items-center mt-1 text-(--color-secondary-accent) hover:text-white hover:underline transition-all bg-(--color-secondary-accent)/10 px-2 py-0.5 rounded"
                          onClick={(e) => evt.isMock && e.preventDefault()}
                        >
                          {evt.isMock ? "Simulated" : "View Tx"} <ExternalLink size={10} className="ml-1 inline" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                <div className="h-2 shrink-0" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
