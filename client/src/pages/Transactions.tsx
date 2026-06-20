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
      case "approved": return <CheckCircle2 size={13} className="text-[#10b981]" />;
      case "pending": return <Clock size={13} className="text-[#a1a1aa]" />;
      case "rejected": return <AlertCircle size={13} className="text-red-400" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case "approved": return "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20";
      case "pending": return "text-white bg-white/5 border-white/10";
      case "rejected": return "text-red-400 bg-red-400/10 border-red-400/20";
      default: return "text-[#a1a1aa] border-white/10 bg-white/5";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
        <div className="border-b border-white/10 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Transactions</h1>
          <p className="text-[#a1a1aa] mt-1.5 text-sm">Immutable history of Escrow deposits and Specialist payouts.</p>
        </div>

        <div className="bg-[#09090b] border border-white/10 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-[#09090b]/50">
                  <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Task ID</th>
                  <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Task Description</th>
                  <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-medium text-[#a1a1aa] uppercase tracking-wider text-right">TxHash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {!isConnected ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center">
                      <Wallet size={24} className="mx-auto mb-3 text-[#a1a1aa]" />
                      <p className="text-sm text-[#a1a1aa]">Connect your wallet to view transaction history.</p>
                    </td>
                  </tr>
                ) : isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-5"><div className="h-4 bg-[#18181b] rounded w-20 mb-2"></div><div className="h-3 bg-[#18181b]/50 rounded w-24"></div></td>
                      <td className="px-6 py-5"><div className="h-4 bg-[#18181b] rounded w-24"></div></td>
                      <td className="px-6 py-5"><div className="h-4 bg-[#18181b] rounded w-48"></div></td>
                      <td className="px-6 py-5"><div className="h-4 bg-[#18181b] rounded w-16"></div></td>
                      <td className="px-6 py-5"><div className="h-6 bg-[#18181b] rounded-md w-20"></div></td>
                      <td className="px-6 py-5 text-right"><div className="h-4 bg-[#18181b] rounded w-20 ml-auto"></div></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center">
                      <AlertCircle size={24} className="mx-auto mb-3 text-red-400" />
                      <p className="text-sm text-red-400">{error}</p>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center">
                      <Clock size={24} className="mx-auto mb-3 text-[#a1a1aa]" />
                      <p className="text-sm text-[#a1a1aa]">No transactions found for this wallet.</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-white/90">TX-{tx.id}</span>
                        <div className="text-[11px] text-[#a1a1aa] mt-1">{formatDate(tx.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/90 font-medium">{tx.niche}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#a1a1aa] truncate max-w-[200px] block" title={tx.prompt}>{tx.prompt}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-white/90 font-mono">{tx.amount} <span className="text-white/40 text-xs">USDC</span></span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium tracking-wide ${getStatusColor(tx.status)}`}>
                          {getStatusIcon(tx.status)}
                          {tx.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tx.txHash ? (
                          <a href={`https://sepolia.etherscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-mono text-[#a1a1aa] hover:text-white transition-colors">
                            {tx.txHash.substring(0, 6)}...{tx.txHash.substring(tx.txHash.length - 4)}
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-sm font-mono text-[#a1a1aa]/50">-</span>
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
