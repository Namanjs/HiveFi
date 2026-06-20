import { useState, useEffect } from "react";
import { Database, Code2, PenTool, Layout, Activity, Shield, TrendingUp, AlertCircle, Wifi, WifiOff } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

interface Specialist {
  id: string;
  name: string;
  niche: string;
  pricePerQuery: string;
  wallet: string;
  isActive: boolean;
  endpoint: string | null;
  isOnline: boolean;
  averageScore: number | null;
  totalRatings: number;
  stakedAmount: string;
  slashCount: number;
}

function truncateWallet(wallet: string) {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export default function Specialists() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSpecialists() {
      try {
        const res = await fetch(`${API_BASE}/api/registry`);
        const data = await res.json();
        if (data.success && data.specialists) {
          const uniqueModels = new Map();
          data.specialists.forEach((m: any) => {
            if (!uniqueModels.has(m.name)) {
              uniqueModels.set(m.name, m);
            } else {
              const existing = uniqueModels.get(m.name);
              // Smart deduplication: Prefer the node that actually has ratings, or is online
              if (m.totalRatings > existing.totalRatings) {
                uniqueModels.set(m.name, m);
              } else if (m.totalRatings === existing.totalRatings && m.isOnline && !existing.isOnline) {
                uniqueModels.set(m.name, m);
              }
            }
          });
          setSpecialists(Array.from(uniqueModels.values()));
        } else {
          setError(data.error || "Failed to load specialists");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to connect to backend");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSpecialists();
  }, []);

  const onlineCount = specialists.filter((s) => s.isOnline).length;

  const getIconForNiche = (niche: string) => {
    switch (niche.toUpperCase()) {
      case "SQL": return { icon: Database, color: "text-[#3b82f6]" };
      case "PYTHON": return { icon: Code2, color: "text-[#eab308]" };
      case "FRONTEND": return { icon: Layout, color: "text-[#06b6d4]" };
      case "DESIGN": return { icon: PenTool, color: "text-[#ec4899]" };
      case "SECURITY": return { icon: Shield, color: "text-[#10b981]" };
      case "DEFI": return { icon: TrendingUp, color: "text-[#a855f7]" };
      default: return { icon: Database, color: "text-[#a1a1aa]" };
    }
  };

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
        <div className="flex items-end justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Specialist Swarm</h1>
            <p className="text-[#a1a1aa] mt-1.5 text-sm">Browse and configure active AI agents on the HiveFi network.</p>
          </div>
          <div className="flex items-center gap-2 bg-[#09090b] border border-white/10 px-3 py-1.5 rounded-lg shadow-sm">
            <Activity size={14} className="text-[#a1a1aa]" />
            <span className="text-xs font-medium text-white">
              {onlineCount}/{specialists.length} Online
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#09090b] border border-white/5 rounded-xl p-8 h-56 animate-pulse shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#18181b]"></div>
                  <div className="w-16 h-6 rounded bg-[#18181b]"></div>
                </div>
                <div className="w-3/4 h-5 rounded bg-[#18181b] mb-2"></div>
                <div className="w-1/2 h-3 rounded bg-[#18181b]"></div>
              </div>
            ))
          ) : error ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-[#09090b] border border-red-500/20 rounded-xl text-center shadow-sm">
              <AlertCircle size={32} className="mb-3 text-red-400" />
              <h3 className="text-sm font-semibold text-white mb-1">Connection Error</h3>
              <p className="text-xs text-[#a1a1aa]">{error}</p>
            </div>
          ) : specialists.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-[#09090b] border border-white/10 rounded-xl text-center shadow-sm">
              <Database size={32} className="mb-3 text-[#a1a1aa]" />
              <h3 className="text-sm font-semibold text-white mb-1">No Specialists Found</h3>
              <p className="text-xs text-[#a1a1aa]">There are currently no active agents registered on the network.</p>
            </div>
          ) : (
            specialists.map((spec) => {
              const { icon: Icon, color } = getIconForNiche(spec.niche);
              return (
                <div
                  key={spec.id}
                  className="group bg-[#09090b] border border-white/10 rounded-xl p-8 transition-all duration-300 shadow-sm hover:shadow-md hover:border-white/30 cursor-pointer hover:-translate-y-0.5 flex flex-col min-h-[220px]"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className={`w-10 h-10 rounded-lg bg-[#18181b] border border-white/5 flex items-center justify-center ${color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${
                          spec.isOnline
                            ? "bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]"
                            : "bg-white/5 border-white/10 text-[#a1a1aa]"
                        }`}
                      >
                        {spec.isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                        {spec.isOnline ? "Online" : "Offline"}
                      </div>
                      <div className="text-xs font-semibold text-white bg-[#18181b] border border-white/5 px-2 py-0.5 rounded font-mono">
                        {spec.pricePerQuery} <span className="text-[#a1a1aa] text-[10px]">USDC</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6 flex-1">
                    <h3 className="text-base font-semibold text-white truncate" title={spec.name}>{spec.name}</h3>
                    <p className="text-xs font-medium text-[#a1a1aa]">{spec.niche}</p>
                    <p className="text-[10px] font-mono text-[#a1a1aa]/60 mt-0.5">{truncateWallet(spec.wallet)}</p>
                  </div>

                  <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#a1a1aa] font-semibold uppercase tracking-wider mb-0.5">Rating</span>
                      <span className="text-xs text-white font-mono">
                        {spec.averageScore != null ? `★ ${spec.averageScore.toFixed(1)}` : "—"}
                      </span>
                      <span className="text-[9px] text-[#a1a1aa]/60">{spec.totalRatings} reviews</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#a1a1aa] font-semibold uppercase tracking-wider mb-0.5">Staked</span>
                      <span className="text-xs text-white font-mono">{spec.stakedAmount}</span>
                      <span className="text-[9px] text-[#a1a1aa]/60">USDC</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] text-[#a1a1aa] font-semibold uppercase tracking-wider mb-0.5">Status</span>
                      <span className={`text-[11px] font-medium ${spec.isActive ? "text-white" : "text-[#a1a1aa]"}`}>
                        {spec.isActive ? "Active" : "Inactive"}
                      </span>
                      {spec.slashCount > 0 && (
                        <span className="text-[9px] text-red-400 mt-0.5">{spec.slashCount} slash{spec.slashCount !== 1 ? "es" : ""}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
