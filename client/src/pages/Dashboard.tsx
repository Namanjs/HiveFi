import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { HIVE_REGISTRY_ADDRESS, HIVE_REGISTRY_ABI, MOCK_USDC_ADDRESS } from "../config/contracts";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
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

interface TaskRecord {
  taskId: string;
  modelId: string;
  specialistWallet: string;
  niche: string;
  amount: string;
  status: 'approved' | 'rejected';
  timestamp: number;
}

interface DashboardData {
  models: Specialist[];
  totalEarned: string;
  tasks: TaskRecord[];
  ratings: {
    averageScore: number;
    totalRatings: number;
    distribution: { score: number; count: number }[];
  };
  totalStake: string;
}

export default function Dashboard() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [stakeInputs, setStakeInputs] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      alert("Please install MetaMask");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWallet(accounts[0]);
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      
      (window as any).ethereum.on('chainChanged', (c: string) => setChainId(parseInt(c, 16)));
      (window as any).ethereum.on('accountsChanged', (a: string[]) => setWallet(a[0] || null));
    } catch (err: any) {
      console.error(err);
    }
  };

  const switchNetwork = async () => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }], // 84532 Base Sepolia
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDashboardData = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/dashboard/${wallet}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        showToast(json.error || 'Failed to fetch dashboard data', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wallet && chainId === 84532) {
      fetchDashboardData();
    }
  }, [wallet, chainId]);

  const handleStake = async (modelId: string, amount: string) => {
    if (!wallet || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return;
    setTxPending(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/stake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, amount })
      });
      const stakeData = await res.json();
      if (!stakeData.success) throw new Error(stakeData.error);

      const usdcAbi = ["function approve(address spender, uint256 amount) public returns (bool)"];
      const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, usdcAbi, signer);
      const stakeBase = ethers.parseUnits(amount, 6);

      const approveTx = await usdcContract.approve(stakeData.contractAddress, stakeBase);
      await approveTx.wait();

      const registryContract = new ethers.Contract(stakeData.contractAddress, stakeData.abi, signer);
      const stakeTx = await registryContract.stakeForModel(modelId, stakeBase);
      await stakeTx.wait();

      showToast("Staked successfully!", "success");
      setStakeInputs(prev => ({ ...prev, [modelId]: "" }));
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      showToast("Staking failed: " + err.message, "error");
    } finally {
      setTxPending(false);
    }
  };

  const handleUnstake = async (modelId: string) => {
    if (!wallet) return;
    setTxPending(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(HIVE_REGISTRY_ADDRESS, HIVE_REGISTRY_ABI, signer);
      const tx = await contract.unstakeFromModel(modelId);
      await tx.wait();

      showToast("Unstaked successfully!", "success");
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      showToast("Unstaking failed: " + err.message, "error");
    } finally {
      setTxPending(false);
    }
  };



  if (!wallet) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center overflow-y-auto">
        <div className="max-w-xl mx-auto w-full text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Developer Dashboard</h1>
          <p className="text-[#888]">Connect your wallet to view your specialist models and earnings.</p>
        </div>
        <div className="p-8 rounded-xl bg-[#111] border border-white/10 text-center w-full max-w-md">
          <button onClick={connectWallet} className="px-6 py-3 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-colors w-full">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (chainId !== 84532) {
    return (
      <div className="p-8 h-full overflow-y-auto">
        <div className="p-8 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center max-w-xl mx-auto mt-20">
          <p className="text-yellow-400 mb-4">Please switch to Base Sepolia Network</p>
          <button onClick={switchNetwork} className="px-6 py-2 bg-yellow-500 text-black font-bold rounded-md hover:bg-yellow-400 transition-colors">
            Switch Network
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
            <p className="text-[#888]">Performance metrics for your models on HiveFi.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-emerald-400">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
          </div>
        </div>

        {/* Overview Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-xl bg-[#111] border border-white/10">
            <h3 className="text-[#888] text-sm mb-1">Total Earned</h3>
            <div className="text-3xl font-bold text-white">{data.totalEarned} <span className="text-sm font-normal text-[#888]">USDC</span></div>
          </div>
          <div className="p-5 rounded-xl bg-[#111] border border-white/10">
            <h3 className="text-[#888] text-sm mb-1">Tasks Completed</h3>
            <div className="text-3xl font-bold text-white">{data.tasks.filter(t => t.status === 'approved').length}</div>
          </div>
          <div className="p-5 rounded-xl bg-[#111] border border-white/10">
            <h3 className="text-[#888] text-sm mb-1">Average Rating</h3>
            <div className="text-3xl font-bold text-white flex items-end gap-2">
              {data.ratings.averageScore ? (Math.round(data.ratings.averageScore * 2) / 2).toFixed(1) : "—"}
              <span className="text-yellow-400 text-lg mb-1">★</span>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-[#111] border border-white/10">
            <h3 className="text-[#888] text-sm mb-1">Current Stake</h3>
            <div className="text-3xl font-bold text-white">{data.totalStake} <span className="text-sm font-normal text-[#888]">USDC</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* My Models Section */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">My Models</h2>
            {data.models.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#111] border border-white/10 text-[#888]">
                No models registered yet.
              </div>
            ) : (
              <div className="space-y-4">
                {data.models.map(spec => (
                  <div key={spec.id} className="p-5 rounded-xl bg-[#111] border border-white/10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{spec.name}</h3>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getNicheColor(spec.niche)}`}>
                          {spec.niche}
                        </span>
                        {!spec.isActive && <span className="px-2 py-0.5 rounded border border-red-500/30 bg-red-500/20 text-red-400 text-[10px] font-bold">DEACTIVATED</span>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#888]">
                        <div className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${parseFloat(spec.stakedAmount) >= 5 ? 'text-green-500' : parseFloat(spec.stakedAmount) > 0 ? 'text-yellow-500' : 'text-gray-500 opacity-50'}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
                          </svg>
                          <span className="font-mono text-white">{parseFloat(spec.stakedAmount)} USDC</span>
                        </div>
                        {spec.slashCount > 0 && <span className="text-red-500">{spec.slashCount} Strikes</span>}
                        <span>Price: {spec.pricePerQuery} USDC</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto items-center">
                      <input 
                        type="number"
                        placeholder="USDC Amount"
                        min="0"
                        step="1"
                        value={stakeInputs[spec.id] || ''}
                        onChange={(e) => setStakeInputs(prev => ({ ...prev, [spec.id]: e.target.value }))}
                        className="w-32 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-md text-sm text-white placeholder-[#555] focus:outline-none focus:border-emerald-500/50"
                      />
                      <button 
                        disabled={txPending || !stakeInputs[spec.id]}
                        onClick={() => handleStake(spec.id, stakeInputs[spec.id])}
                        className="px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 rounded-md text-sm font-semibold hover:bg-emerald-600/40 transition-colors flex-1 md:flex-none disabled:opacity-50"
                      >
                        Add Stake
                      </button>
                      {!spec.isActive && parseFloat(spec.stakedAmount) > 0 && (
                        <button 
                          disabled={txPending}
                          onClick={() => handleUnstake(spec.id)}
                          className="px-4 py-2 bg-white/5 text-white border border-white/10 rounded-md text-sm font-semibold hover:bg-white/10 transition-colors flex-1 md:flex-none disabled:opacity-50"
                        >
                          Unstake
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rating Trend */}
          <div>
            <h2 className="text-xl font-bold mb-4">Rating Trend</h2>
            <div className="p-5 rounded-xl bg-[#111] border border-white/10 h-[calc(100%-2rem)]">
              {data.ratings.totalRatings < 5 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-[#888] min-h-[200px]">
                  <span className="text-4xl mb-2">📊</span>
                  <p>Not enough data.</p>
                  <p className="text-sm">Need at least 5 ratings to show distribution.</p>
                  <p className="text-xs mt-2 text-[#555]">Current: {data.ratings.totalRatings} ratings</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <div className="text-4xl font-bold flex items-center gap-2">
                        {data.ratings.averageScore.toFixed(1)} <span className="text-yellow-400 text-2xl">★</span>
                      </div>
                      <p className="text-[#888] text-sm mt-1">{data.ratings.totalRatings} total ratings</p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.ratings.distribution.sort((a,b) => a.score - b.score)}>
                        <XAxis dataKey="score" tick={{fill: '#888', fontSize: 12}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#222'}} contentStyle={{backgroundColor: '#111', borderColor: '#333', borderRadius: '8px'}} />
                        <Bar dataKey="count" fill="#eab308" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Earnings History */}
        <div>
          <h2 className="text-xl font-bold mb-4">Earnings History</h2>
          <div className="rounded-xl bg-[#111] border border-white/10 overflow-hidden">
            {data.tasks.length === 0 ? (
              <div className="p-8 text-center text-[#888]">
                No tasks processed yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1a1a1a] text-[#888]">
                  <tr>
                    <th className="p-4 font-medium">Task ID</th>
                    <th className="p-4 font-medium">Niche</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.tasks.map((task, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-mono text-[#888]">{task.taskId.toString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getNicheColor(task.niche)}`}>
                          {task.niche}
                        </span>
                      </td>
                      <td className="p-4 font-mono">{parseFloat(task.amount).toFixed(2)} USDC</td>
                      <td className="p-4">
                        {task.status === 'approved' ? (
                          <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs">Approved</span>
                        ) : (
                          <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs">Rejected</span>
                        )}
                      </td>
                      <td className="p-4 text-[#888]">{new Date(task.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out]">
      <div className={`flex items-center gap-3 px-5 py-3 rounded-lg border shadow-xl backdrop-blur-md ${
        type === 'success' 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}>
        <span className="text-lg">{type === 'success' ? '✓' : '✕'}</span>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 text-[#888] hover:text-white transition-colors text-xs">✕</button>
      </div>
    </div>
  );
}
