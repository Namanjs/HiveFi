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
          setSpecialists(data.specialists);
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
      case "SQL": return { icon: Database, color: "text-blue-400" };
      case "PYTHON": return { icon: Code2, color: "text-yellow-400" };
      case "FRONTEND": return { icon: Layout, color: "text-cyan-400" };
      case "DESIGN": return { icon: PenTool, color: "text-pink-400" };
      case "SECURITY": return { icon: Shield, color: "text-emerald-400" };
      case "DEFI": return { icon: TrendingUp, color: "text-purple-400" };
      default: return { icon: Database, color: "text-gray-400" };
    }
  };

  return (
    <div className="w-full h-full p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide">Specialist Swarm</h1>
            <p className="text-[#888] mt-2">Browse and configure active AI agents on the HiveFi network.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
              <Activity size={16} className="text-(--color-accent) animate-pulse" />
              <span className="text-sm font-mono text-white">
                {onlineCount}/{specialists.length} Online
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-black/40 border border-white/10 rounded-3xl p-6 h-52 animate-pulse">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/5"></div>
                  <div className="w-16 h-6 rounded-full bg-white/10"></div>
                </div>
                <div className="w-3/4 h-6 rounded bg-white/10 mb-2"></div>
                <div className="w-1/2 h-4 rounded bg-white/5"></div>
              </div>
            ))
          ) : error ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white/5 border border-red-500/20 rounded-3xl text-red-400 text-center">
              <AlertCircle size={48} className="mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2">Connection Error</h3>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          ) : specialists.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-3xl text-[#888] text-center">
              <Database size={48} className="mb-4 opacity-20" />
              <h3 className="text-xl font-bold text-white mb-2">No Specialists Found</h3>
              <p className="text-sm">There are currently no active agents registered on the HiveFi network.</p>
            </div>
          ) : (
            specialists.map((spec) => {
              const { icon: Icon, color } = getIconForNiche(spec.niche);
              return (
                <div
                  key={spec.id}
                  className="group relative bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 overflow-hidden hover:border-(--color-accent) transition-all duration-500 smooth-spring shadow-[0_8px_32px_rgba(0,0,0,0.5)] cursor-pointer hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-(--color-accent) to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute -inset-2 bg-(--color-accent)/5 rounded-3xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-500 pointer-events-none" />

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${color}`}>
                      <Icon size={24} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border ${
                          spec.isOnline
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-white/5 border-white/10 text-white/40"
                        }`}
                      >
                        {spec.isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                        {spec.isOnline ? "Online" : "Offline"}
                      </div>
                      <div className="text-sm font-bold text-white bg-white/10 px-3 py-1 rounded-full font-mono">
                        {spec.pricePerQuery} USDC
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 relative z-10">
                    <h3 className="text-lg font-bold text-white">{spec.name}</h3>
                    <p className="text-sm text-(--color-accent)">{spec.niche}</p>
                    <p className="text-[10px] font-mono text-white/35 mt-1">{truncateWallet(spec.wallet)}</p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-3 relative z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#888] uppercase tracking-wider">Rating</span>
                      <span className="text-xs text-white font-mono">
                        {spec.averageScore != null ? `★ ${spec.averageScore.toFixed(1)}` : "—"}
                      </span>
                      <span className="text-[9px] text-white/30">{spec.totalRatings} reviews</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#888] uppercase tracking-wider">Staked</span>
                      <span className="text-xs text-white font-mono">{spec.stakedAmount}</span>
                      <span className="text-[9px] text-white/30">USDC</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-[#888] uppercase tracking-wider">Status</span>
                      <span className={`text-xs font-mono ${spec.isActive ? "text-emerald-400" : "text-amber-400"}`}>
                        {spec.isActive ? "Active" : "Inactive"}
                      </span>
                      {spec.slashCount > 0 && (
                        <span className="text-[9px] text-red-400/80">{spec.slashCount} slash{spec.slashCount !== 1 ? "es" : ""}</span>
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
