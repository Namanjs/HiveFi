import { ExternalLink, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default function Transactions() {
  const transactions = [
    { id: "TX-9824", agent: "SQL Specialist", task: "Database Indexing", amount: "0.05", status: "Completed", date: "2 mins ago", hash: "0x8f...1b4a" },
    { id: "TX-9823", agent: "Python Expert", task: "Algorithm Optimization", amount: "0.08", status: "Completed", date: "15 mins ago", hash: "0x2c...9d3f" },
    { id: "TX-9822", agent: "Frontend Engineer", task: "React Refactor", amount: "0.06", status: "Pending", date: "1 hour ago", hash: "0x7a...4e21" },
    { id: "TX-9821", agent: "UI Designer", task: "Logo Assets", amount: "0.04", status: "Failed", date: "3 hours ago", hash: "0x1d...8c5b" },
    { id: "TX-9820", agent: "Market Analyst", task: "Data Scraping", amount: "0.07", status: "Completed", date: "5 hours ago", hash: "0x9b...2f7e" },
    { id: "TX-9819", agent: "Smart Contract Auditor", task: "Security Audit", amount: "0.15", status: "Completed", date: "1 day ago", hash: "0x5e...3a9c" },
  ];

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "Completed": return <CheckCircle2 size={14} className="text-emerald-400" />;
      case "Pending": return <Clock size={14} className="text-yellow-400" />;
      case "Failed": return <AlertCircle size={14} className="text-red-400" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "Completed": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "Pending": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "Failed": return "text-red-400 bg-red-400/10 border-red-400/20";
      default: return "text-gray-400";
    }
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
                {transactions.map((tx, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors group">
                    <td className="p-6">
                      <span className="text-sm font-mono text-white">{tx.id}</span>
                      <div className="text-[10px] text-[#666] mt-1">{tx.date}</div>
                    </td>
                    <td className="p-6">
                      <span className="text-sm text-[var(--color-accent)] font-medium">{tx.agent}</span>
                    </td>
                    <td className="p-6">
                      <span className="text-sm text-[#ccc]">{tx.task}</span>
                    </td>
                    <td className="p-6">
                      <span className="text-sm font-bold text-white font-mono">{tx.amount} USDC</span>
                    </td>
                    <td className="p-6">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {getStatusIcon(tx.status)}
                        {tx.status}
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <a href="#" className="inline-flex items-center gap-1.5 text-sm font-mono text-[#888] hover:text-white transition-colors">
                        {tx.hash}
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
