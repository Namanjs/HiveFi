import { Database, Code2, PenTool, Layout, Activity, Shield, TrendingUp } from "lucide-react";

export default function Specialists() {
  const specialists = [
    { name: "SQL Specialist", type: "Data Analysis", fee: "0.05", uses: 1240, rating: 4.9, icon: Database, color: "text-blue-400" },
    { name: "Python Expert", type: "Backend Logic", fee: "0.08", uses: 890, rating: 4.8, icon: Code2, color: "text-yellow-400" },
    { name: "Frontend Engineer", type: "UI/UX Code", fee: "0.06", uses: 2100, rating: 4.9, icon: Layout, color: "text-cyan-400" },
    { name: "UI Designer", type: "Visual Assets", fee: "0.04", uses: 560, rating: 4.7, icon: PenTool, color: "text-pink-400" },
    { name: "Smart Contract Auditor", type: "Security", fee: "0.15", uses: 320, rating: 5.0, icon: Shield, color: "text-emerald-400" },
    { name: "Market Analyst", type: "DeFi Research", fee: "0.07", uses: 1450, rating: 4.6, icon: TrendingUp, color: "text-purple-400" }
  ];

  return (
    <div className="w-full h-full p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide">Specialist Swarm</h1>
            <p className="text-[#888] mt-2">Browse and configure active AI agents on the HiveFi network.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
            <Activity size={16} className="text-[var(--color-accent)] animate-pulse" />
            <span className="text-sm font-mono text-white">Network Load: 34%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {specialists.map((spec, i) => {
            const Icon = spec.icon;
            return (
              <div key={i} className="group relative bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 overflow-hidden hover:border-[var(--color-accent)] transition-all duration-500 smooth-spring shadow-[0_8px_32px_rgba(0,0,0,0.5)] cursor-pointer hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                {/* Glow Effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -inset-2 bg-[var(--color-accent)]/5 rounded-3xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-500 pointer-events-none" />

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${spec.color}`}>
                    <Icon size={24} />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#888] font-mono uppercase tracking-wider mb-1">Base Fee</div>
                    <div className="text-sm font-bold text-white bg-white/10 px-3 py-1 rounded-full font-mono">{spec.fee} USDC</div>
                  </div>
                </div>

                <div className="space-y-1 relative z-10">
                  <h3 className="text-lg font-bold text-white">{spec.name}</h3>
                  <p className="text-sm text-[var(--color-accent)]">{spec.type}</p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#888] uppercase tracking-wider">Total Runs</span>
                    <span className="text-xs text-white font-mono">{spec.uses.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-[#888] uppercase tracking-wider">Rating</span>
                    <span className="text-xs text-white font-mono">★ {spec.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
