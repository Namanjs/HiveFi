import { useState, useEffect } from "react";
import { X, Settings, Key, Server, Save } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOpenaiKey(localStorage.getItem("openai_key") || "");
      setAnthropicKey(localStorage.getItem("anthropic_key") || "");
      setRpcUrl(localStorage.getItem("rpc_url") || "https://sepolia.base.org");
      setIsSaved(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      if (e.key === 'Tab') {
        const focusableElements = document.querySelectorAll(
          '.settings-modal button, .settings-modal input'
        );
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Auto-focus first input when opened
    setTimeout(() => {
      const firstInput = document.querySelector('.settings-modal input') as HTMLElement;
      if (firstInput) firstInput.focus();
    }, 100);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = () => {
    localStorage.setItem("openai_key", openaiKey);
    localStorage.setItem("anthropic_key", anthropicKey);
    localStorage.setItem("rpc_url", rpcUrl);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="settings-modal relative w-full max-w-md bg-[#121214]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-[slide-down_0.2s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center border border-[var(--color-accent)]/30">
              <Settings size={16} className="text-[var(--color-accent)]" />
            </div>
            <h2 id="settings-title" className="text-lg font-bold text-white tracking-wide">Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-[#888] hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-mono text-[#888] uppercase tracking-wider ml-1">
              <Key size={14} /> OpenAI API Key
            </label>
            <input 
              id="openai-key"
              type="password" 
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-mono text-[#888] uppercase tracking-wider ml-1">
              <Key size={14} /> Anthropic API Key
            </label>
            <input 
              type="password" 
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-mono text-[#888] uppercase tracking-wider ml-1">
              <Server size={14} /> Base Sepolia RPC URL
            </label>
            <input 
              type="text" 
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder="https://sepolia.base.org" 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex justify-end">
          <button 
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all smooth-spring ${
              isSaved 
                ? "bg-[#10b981] text-white" 
                : "bg-white text-black hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            }`}
          >
            {isSaved ? (
              <>Saved!</>
            ) : (
              <><Save size={16} /> Save Configuration</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
