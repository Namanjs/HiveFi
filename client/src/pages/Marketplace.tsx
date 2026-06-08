import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getNicheColor } from "../utils/nicheColors";

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

export default function Marketplace() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("Stake");

  useEffect(() => {
    const fetchSpecialists = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/registry`);
        const data = await res.json();
        if (data.success) {
          setSpecialists(data.specialists);
        } else {
          setError(data.error || "Failed to load specialists");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSpecialists();
  }, []);

  const filtered = filter === "ALL" ? specialists : specialists.filter((s) => s.niche === filter);
  
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "Stake") {
      return parseFloat(b.stakedAmount) - parseFloat(a.stakedAmount);
    } else {
      const ratingA = a.averageScore || 0;
      const ratingB = b.averageScore || 0;
      return ratingB - ratingA;
    }
  });



  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Specialist Registry</h1>
        <p className="text-[#888] mb-8">Browse fine-tuned specialist models available for hire on the HiveFi network.</p>

        <div className="flex gap-3 mb-8 items-center justify-between">
          <div className="flex gap-3">
            {["ALL", "SQL", "PYTHON", "FRONTEND", "DESIGN"].map((n) => (
              <button
                key={n}
                onClick={() => setFilter(n)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filter === n ? "bg-white text-black border-white" : "bg-transparent text-[#888] border-white/20 hover:border-white/50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-3 items-center text-sm">
            <span className="text-[#888]">Sort by:</span>
            <button onClick={() => setSortBy("Stake")} className={`font-semibold ${sortBy === "Stake" ? "text-white" : "text-[#888] hover:text-white"}`}>Stake</button>
            <button onClick={() => setSortBy("Rating")} className={`font-semibold ${sortBy === "Rating" ? "text-white" : "text-[#888] hover:text-white"}`}>Rating</button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-white/5 animate-pulse border border-white/10" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 border border-red-500/30 bg-red-500/10 text-red-400 rounded-lg">
            Error loading registry: {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-white/10 rounded-xl bg-white/5">
            <p className="text-[#888] mb-4">No specialists registered yet. Be the first to deploy.</p>
            <Link to="/register" className="px-6 py-2 bg-white text-black font-semibold rounded-md text-sm hover:bg-gray-200 transition-colors">
              Register Node
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map((spec) => (
              <div key={spec.id} className="flex flex-col p-5 rounded-xl bg-[#111] border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-lg">{spec.name}</h3>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getNicheColor(spec.niche)}`}>
                    {spec.niche}
                  </span>
                </div>
                
                <div className="flex flex-col gap-2 text-sm text-[#888] flex-1">
                  <div className="flex justify-between">
                    <span>Price</span>
                    <span className="text-white font-mono">{spec.pricePerQuery} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wallet</span>
                    <span className="text-white font-mono">{spec.wallet.slice(0, 6)}...{spec.wallet.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span>Stake</span>
                    <div className="flex items-center gap-1">
                      {spec.slashCount > 0 && (
                        <span className="text-red-500 font-bold mr-2 text-xs">{spec.slashCount} strikes</span>
                      )}
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${parseFloat(spec.stakedAmount) >= 5 ? 'text-green-500' : parseFloat(spec.stakedAmount) > 0 ? 'text-yellow-500' : 'text-gray-500 opacity-50'}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white font-mono">{parseFloat(spec.stakedAmount)} USDC</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    {spec.isOnline ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-emerald-500">Online</span>
                      </>
                    ) : spec.endpoint ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-orange-500">Degraded</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                        <span className="text-gray-500">Endpoint Pending</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {spec.totalRatings > 0 ? (
                      <>
                        <span className="text-yellow-400">★</span>
                        <span className="text-white font-bold">{Math.round((spec.averageScore || 0) * 2) / 2}</span>
                        <span className="text-[#888]">({spec.totalRatings})</span>
                      </>
                    ) : (
                      <span className="text-[#888] text-[10px]">No ratings yet</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
