import { Wallet, Activity, Palette, Unplug } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";

interface EarningsBarProps {
  walletBalances: { orchestrator: string; specialists: Record<string, string> };
  isConnected: boolean;
  showAbstraction: boolean;
  onToggleAbstraction: () => void;
}

export default function EarningsBar({
  walletBalances,
  isConnected,
  showAbstraction,
  onToggleAbstraction,
}: EarningsBarProps) {
  const { address, isConnected: isWalletConnected, isConnecting, connectWallet, disconnectWallet } = useWallet();

  const totalSpecialistEarnings = Object.values(walletBalances.specialists || {})
    .reduce((sum, bal) => sum + parseFloat(bal), 0)
    .toFixed(2);

  const [theme, setTheme] = useState<string>(localStorage.getItem("theme") || "purple");
  const [showThemes, setShowThemes] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const themes = [
    { id: "purple", color: "bg-[#8b5cf6]" },
    { id: "cyan", color: "bg-[#06b6d4]" },
    { id: "emerald", color: "bg-[#10b981]" },
    { id: "rose", color: "bg-[#f43f5e]" },
    { id: "amber", color: "bg-[#f59e0b]" },
  ];
  return (
    <header className="flex flex-wrap items-center justify-between gap-y-4 px-4 md:px-8 py-4 text-white w-full z-50">

      {/* LEFT: Financials */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-3xl px-4 py-2 rounded-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:bg-white/5 transition-colors cursor-default">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Wallet size={14} style={{ color: "var(--color-secondary-accent)", filter: "drop-shadow(0 0 4px var(--color-secondary-accent))" }} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-[var(--color-text-secondary)] font-medium uppercase tracking-[0.15em]">Orchestrator</span>
            <span className="text-sm font-mono font-semibold text-white drop-shadow-sm">{walletBalances.orchestrator} <span className="text-[10px] text-white/50">USDC</span></span>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-3xl px-4 py-2 rounded-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:bg-white/5 transition-colors cursor-default">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Wallet size={14} style={{ color: "var(--color-accent)", filter: "drop-shadow(0 0 4px var(--color-accent))" }} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-[var(--color-text-secondary)] font-medium uppercase tracking-[0.15em]">Escrow</span>
            <span className="text-sm font-mono font-semibold text-white drop-shadow-sm">
              {totalSpecialistEarnings} <span className="text-[10px] text-white/50">USDC</span>
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT: Controls */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-3xl px-3 py-1.5 rounded-full border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-[#10b981] shadow-[0_0_8px_#10b981]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"}`} />
          <span className="text-[10px] font-medium tracking-wide text-[var(--color-text-secondary)] uppercase">{isConnected ? "Connected" : "Offline"}</span>
        </div>

        {/* Theme Selector */}
        <div className="flex items-center bg-black/40 backdrop-blur-3xl rounded-full border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all overflow-hidden p-1">
          <button 
            onClick={() => setShowThemes(!showThemes)}
            className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 transition-colors shrink-0"
            data-tooltip="Choose Theme"
          >
            <Palette size={14} className="text-white/70" />
          </button>
          
          <div className={`flex items-center transition-all duration-500 smooth-spring overflow-hidden ${showThemes ? "w-[120px] opacity-100 ml-2" : "w-0 opacity-0 ml-0"}`}>
            <div className="flex items-center gap-2 min-w-max">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setShowThemes(false); }}
                  className={`w-3.5 h-3.5 rounded-full ${t.color} transition-all duration-300 ${theme === t.id ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110" : "opacity-50 hover:opacity-100 hover:scale-110"}`}
                  data-tooltip={`Switch to ${t.id} theme`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Web3 Wallet Connect */}
        {isWalletConnected && address ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-3xl rounded-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
            <span className="text-xs font-mono text-white/90">
              {address.substring(0, 6)}...{address.substring(address.length - 4)}
            </span>
            <button 
              onClick={disconnectWallet}
              className="ml-2 p-1 rounded-lg hover:bg-white/10 text-[#888] hover:text-red-400 transition-colors"
              data-tooltip="Disconnect Wallet"
            >
              <Unplug size={14} />
            </button>
          </div>
        ) : (
          <button 
            onClick={connectWallet}
            disabled={isConnecting}
            className="relative group flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary-accent)] rounded-xl font-bold text-sm text-black shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105 transition-all smooth-spring overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Wallet size={16} />
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}

        <button 
          onClick={onToggleAbstraction}
          className={`px-4 py-2 rounded-xl border transition-all text-xs font-semibold tracking-wider uppercase flex items-center gap-2 ${
            showAbstraction 
              ? "bg-[var(--color-accent)]/20 border-[var(--color-accent)]/30 text-[var(--color-accent)] shadow-[0_0_15px_var(--color-accent-glow)]" 
              : "bg-white/5 border-white/10 text-[var(--color-text-secondary)] hover:bg-white/10 hover:text-white"
          }`}
        >
          <Activity size={14} />
          {showAbstraction ? "Hide Network" : "View Network"}
        </button>
      </div>
    </header>
  );
}
