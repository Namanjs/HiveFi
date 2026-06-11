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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "minimized") {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [events, mode]);

  const getLogColor = (status: string) => {
    if (status === "SPECIALIST_UNAVAILABLE") return "text-orange-400";
    if (status === "CHAIN_STEP") return "text-[var(--color-secondary-accent)]";
    if (status.includes("PENDING")) return "text-yellow-500";
    if (status.includes("LOCKED") || status.includes("RELEASED") || status === "DIRECT_RESPONSE") return "text-[#10b981]";
    if (status === "ERROR" || status.includes("REJECTED")) return "text-red-500";
    return "text-[var(--color-text-primary)]";
  };

  const isMinimized = mode === "minimized";
  const isEnlarged = mode === "enlarged" || mode === "fullscreen";

  return (
    <div className="flex flex-col h-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 relative group">
      
      {/* Creative Terminal Glow Line */}
      <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent transition-opacity duration-500 ${isEnlarged ? "opacity-100 shadow-[0_0_15px_var(--color-accent)]" : "opacity-30"}`} />

      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <Terminal size={14} className="text-[var(--color-accent)] animate-pulse" />
          <span className="text-xs font-bold tracking-[0.15em] uppercase text-white drop-shadow-md">Event Log</span>
          {events.length > 0 && <span className="ml-2 text-[10px] bg-white/10 px-2 py-0.5 rounded-full">{events.length}</span>}
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleEnlarge && (
            <button onClick={onToggleEnlarge} className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors" data-tooltip-bottom={isEnlarged ? "Restore" : "Enlarge panel"}>
              {mode === "enlarged" || mode === "fullscreen" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          {onToggleFullScreen && (
            <button onClick={onToggleFullScreen} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${mode === "fullscreen" ? "text-[var(--color-accent)] bg-[var(--color-accent)]/20" : "text-white/50 hover:text-white"}`} data-tooltip-bottom-right="Toggle Fullscreen">
              <Monitor size={14} />
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col relative transition-opacity duration-300 ${isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-[13px] bg-black/20 scroll-smooth relative" ref={containerRef}>
          {/* Scanline overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none mix-blend-overlay" />
          
          {events.length === 0 ? (
            <div className="flex items-center gap-2 text-[#888] text-[12px]">
              <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-ping" />
              Awaiting system events...
            </div>
          ) : (
            events.map((evt, idx) => (
              <div key={idx} className="flex items-start gap-3 leading-relaxed animate-[slide-up_0.3s_ease-out_forwards] opacity-0 relative z-10">
                <span className="text-[#888] shrink-0 border-r border-[#333] pr-3">
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                </span>
                <span className="flex-1 text-gray-200">
                  <span className={`${getLogColor(evt.status)} drop-shadow-sm`}>
                    {evt.message}
                  </span>
                  {evt.txHash && (
                    <a
                      href={evt.isMock ? "#" : `https://sepolia.basescan.org/tx/${evt.txHash}`}
                      target={evt.isMock ? "_self" : "_blank"}
                      rel="noopener noreferrer"
                      className="inline-flex items-center ml-2 text-[var(--color-secondary-accent)] hover:text-white hover:underline transition-all bg-[var(--color-secondary-accent)]/10 px-2 py-0.5 rounded"
                      onClick={(e) => evt.isMock && e.preventDefault()}
                    >
                      {evt.isMock ? "Simulated Tx" : "View Tx"} <ExternalLink size={10} className="ml-1 inline" />
                    </a>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
