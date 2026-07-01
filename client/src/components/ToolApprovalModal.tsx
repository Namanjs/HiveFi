import { useState } from "react";
import { useChat } from "../contexts/ChatContext";
import { Terminal, ShieldAlert, Check, X, FileCode } from "lucide-react";

export default function ToolApprovalModal() {
  const { 
    pendingToolApproval, 
    setPendingToolApproval, 
    socket,
    setAutoApproveMedium
  } = useChat() as any;

  const [rememberDecision, setRememberDecision] = useState(false);

  if (!pendingToolApproval) return null;

  const { id, tool, params } = pendingToolApproval;

  const handleResponse = (approved: boolean) => {
    if (socket) {
      socket.emit("TOOL_APPROVAL_RESPONSE", { id, approved });
    }
    
    // If user checked "remember decision" and approved a medium-risk tool, save it
    if (approved && rememberDecision && (tool === "write_file" || tool === "install_packages")) {
      setAutoApproveMedium(true);
    }

    setPendingToolApproval(null);
  };

  const getToolTitle = () => {
    switch (tool) {
      case "write_file": return "Create/Overwrite File";
      case "install_packages": return "Install Dependencies";
      case "execute_command": return "Run Shell Command";
      case "read_file": return "Read File";
      case "list_directory": return "Inspect Directory";
      default: return "Execute Tool";
    }
  };

  const getRiskColor = () => {
    if (tool === "execute_command") return "text-red-400 border-red-500/20 bg-red-500/5";
    if (tool === "write_file" || tool === "install_packages") return "text-amber-400 border-amber-500/20 bg-amber-500/5";
    return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
  };

  const isMediumRisk = tool === "write_file" || tool === "install_packages";
  const isHighRisk = tool === "execute_command";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[4px] transition-all p-4">
      <div className="w-full max-w-lg border border-white/10 bg-[#161616]/95 backdrop-blur-md rounded-xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        
        {/* Risk Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium mb-4 ${getRiskColor()}`}>
          {isHighRisk ? (
            <ShieldAlert size={16} className="shrink-0 text-red-400 animate-pulse" />
          ) : (
            <ShieldAlert size={16} className="shrink-0 text-amber-400" />
          )}
          <span>
            {isHighRisk ? "Dangerous Action — Manual Approval Required" : "Medium Risk — Requesting Write Access"}
          </span>
        </div>

        <h3 className="text-base font-semibold text-white mb-1 font-sans">
          AI Agent Request: {getToolTitle()}
        </h3>
        <p className="text-xs text-white/40 mb-4 font-sans leading-relaxed">
          The active specialist node wants to execute the <span className="font-mono text-white/80 font-semibold bg-white/5 px-1.5 py-0.5 rounded">{tool}</span> tool on your local project directory.
        </p>

        {/* Parameters Section */}
        <div className="bg-black/40 border border-white/5 rounded-lg p-4 mb-4 font-mono text-xs text-white/80 max-h-48 overflow-y-auto">
          <div className="flex items-center gap-2 text-white/40 text-[10px] font-sans font-bold uppercase tracking-wider mb-2">
            {tool === "execute_command" ? <Terminal size={12} /> : <FileCode size={12} />}
            Parameters
          </div>

          {tool === "write_file" && (
            <div>
              <div className="text-[11px] text-[var(--color-accent)] mb-1">Path: <span className="text-white font-semibold">{params.path}</span></div>
              <pre className="mt-2 text-[10px] leading-normal opacity-80 whitespace-pre-wrap select-text p-2 bg-white/5 rounded border border-white/5 max-h-32 overflow-y-auto">
                {params.content || "Empty content"}
              </pre>
            </div>
          )}

          {tool === "install_packages" && (
            <div>
              <div className="text-[11px] text-[var(--color-accent)] mb-1">Manager: <span className="text-white">{params.manager || "npm"}</span></div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {params.packages?.map((pkg: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] text-white/90">{pkg}</span>
                ))}
              </div>
            </div>
          )}

          {tool === "execute_command" && (
            <div className="text-white/90 select-text p-2 bg-black/60 rounded border border-red-500/10 font-mono leading-relaxed break-all">
              $ {params.command}
            </div>
          )}

          {tool !== "write_file" && tool !== "install_packages" && tool !== "execute_command" && (
            <pre className="text-[10px] opacity-80 whitespace-pre-wrap">
              {JSON.stringify(params, null, 2)}
            </pre>
          )}
        </div>

        {/* Remember Decision Checkbox */}
        {isMediumRisk && (
          <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberDecision}
              onChange={(e) => setRememberDecision(e.target.checked)}
              className="rounded border-white/10 bg-black text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0 shrink-0"
            />
            <span className="text-[11px] text-white/50 hover:text-white/80 transition-colors">
              Trust this specialist and auto-approve future file writes/installs in this session
            </span>
          </label>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 text-xs">
          <button
            onClick={() => handleResponse(false)}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-white/10 hover:border-red-500/20 hover:bg-red-500/5 rounded-lg text-white/60 hover:text-red-400 transition-all font-sans font-semibold"
          >
            <X size={14} />
            Reject Request
          </button>
          <button
            onClick={() => handleResponse(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[var(--color-accent)] hover:brightness-110 text-black rounded-lg transition-all font-sans font-bold shadow-lg shadow-[var(--color-accent)]/15"
          >
            <Check size={14} />
            Approve & Execute
          </button>
        </div>
      </div>
    </div>
  );
}
