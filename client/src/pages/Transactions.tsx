import { useState, useEffect } from "react";
import { ExternalLink, CheckCircle2, Clock, AlertCircle, Wallet } from "lucide-react";
import { useWallet } from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

interface Task {
  id: string;
  niche: string;
  prompt: string;
  amount: string;
  status: string;
  createdAt: number;
  txHash?: string;
}

export default function Transactions() {
  const { address, isConnected } = useWallet();
  const [transactions, setTransactions] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setTransactions([]);
      return;
    }

    async function fetchTransactions() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/${address}`);
        const data = await res.json();
        if (data.success && data.tasks) {
          setTransactions(data.tasks);
        } else {
          setError(data.error || "Failed to load transactions");
        }
      } catch (err: any) {
        setError(err.message || "Failed to connect to backend");
      } finally {
        setIsLoading(false);
      }
    }
    fetchTransactions();
  }, [address]);

  const getStatusIcon = (status: string) => {
    switch(status.toLowerCase()) {
      case "approved": return <CheckCircle2 size={14} className="text-emerald-400" />;
      case "pending": return <Clock size={14} className="text-yellow-400" />;
      case "rejected": return <AlertCircle size={14} className="text-red-400" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case "approved": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "pending": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "rejected": return "text-red-400 bg-red-400/10 border-red-400/20";
      default: return "text-gray-400 border-white/10 bg-white/5";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="w-full h-full p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Transaction Ledger</h1>
          <p className="text-[#888] mt-2">Immutable history of Escrow deposits and Specialist payouts.</p>
        </div>

        <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="p-6 text-xs font-mono tracking-wider text-[#888] uppercase">Task ID</th>
                  <th className="p-6 text-xs font-mono tracking-wider text-[#888] uppercase">Agent</th>
                  <th className="p-6 text-xs font-mono tracking-wider text-[#888] uppercase">Task Description</th>
                  <th className="p-6 text-xs font-mono tracking-wider text-[#888] uppercase">Amount</th>
                  <th className="p-6 text-xs font-mono tracking-wider text-[#888] uppercase">Status</th>
                  <th className="p-6 text-xs font-mono tracking-wider text-[#888] uppercase text-right">TxHash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {!isConnected ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-[#888]">
                      <Wallet size={48} className="mx-auto mb-4 opacity-20" />
                      <p>Connect your wallet to view transaction history.</p>
                    </td>
                  </tr>
                ) : isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-6"><div className="h-4 bg-white/10 rounded w-24 mb-2"></div><div className="h-3 bg-white/5 rounded w-32"></div></td>
                      <td className="p-6"><div className="h-4 bg-white/10 rounded w-32"></div></td>
                      <td className="p-6"><div className="h-4 bg-white/10 rounded w-48"></div></td>
                      <td className="p-6"><div className="h-4 bg-white/10 rounded w-16"></div></td>
                      <td className="p-6"><div className="h-6 bg-white/10 rounded-full w-24"></div></td>
                      <td className="p-6 text-right"><div className="h-4 bg-white/10 rounded w-24 ml-auto"></div></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-red-400">
                      <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                      <p>{error}</p>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-[#888]">
                      <Clock size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No transactions found for this wallet.</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                      <td className="p-6">
                        <span className="text-sm font-mono text-white">TX-{tx.id}</span>
                        <div className="text-[10px] text-[#666] mt-1">{formatDate(tx.createdAt)}</div>
                      </td>
                      <td className="p-6">
                        <span className="text-sm text-[var(--color-accent)] font-medium">{tx.niche}</span>
                      </td>
                      <td className="p-6">
                        <span className="text-sm text-[#ccc] truncate max-w-xs block">{tx.prompt}</span>
                      </td>
                      <td className="p-6">
                        <span className="text-sm font-bold text-white font-mono">{tx.amount} USDC</span>
                      </td>
                      <td className="p-6">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium uppercase ${getStatusColor(tx.status)}`}>
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        {tx.txHash ? (
                          <a href={`https://sepolia.etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-mono text-[#888] hover:text-[var(--color-accent)] transition-colors">
                            {tx.txHash.substring(0, 6)}...{tx.txHash.substring(tx.txHash.length - 4)}
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-sm font-mono text-[#444]">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
