import { useState, useEffect } from "react";
import { Key, Server, ShieldCheck, Wallet, Loader2, Coins, AlertCircle } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { Contract, formatUnits, parseUnits } from "ethers";
import MockUSDCABI from "../config/MockUSDC.json";
import { DropdownMenu } from "../components/DropdownMenu";

const MOCK_USDC_ADDRESS = import.meta.env.VITE_MOCK_USDC_ADDRESS;
const HIVE_REGISTRY_ADDRESS = import.meta.env.VITE_HIVE_REGISTRY_ADDRESS;

export default function Settings() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Delegation State
  const [delegationMode, setDelegationMode] = useState("builtin");
  const [personalEndpoint, setPersonalEndpoint] = useState("");
  const [personalApiKey, setPersonalApiKey] = useState("");

  // Web3 State
  const { address, isConnected, signer, provider } = useWallet();
  const [allowance, setAllowance] = useState<string>("0");
  const [balance, setBalance] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [newAllowanceAmount, setNewAllowanceAmount] = useState("50");
  const [maxFee, setMaxFee] = useState("2.00");
  
  // Faucet State
  const [isClaiming, setIsClaiming] = useState(false);
  const [faucetError, setFaucetError] = useState("");
  const [faucetSuccess, setFaucetSuccess] = useState(false);

  useEffect(() => {
    setOpenaiKey(localStorage.getItem("openai_key") || "");
    setAnthropicKey(localStorage.getItem("anthropic_key") || "");
    setRpcUrl(localStorage.getItem("rpc_url") || "https://sepolia.base.org");
    setMaxFee(localStorage.getItem("max_fee") || "2.00");
    setDelegationMode(localStorage.getItem("delegation_mode") || "builtin");
    setPersonalEndpoint(localStorage.getItem("personal_endpoint") || "");
    setPersonalApiKey(localStorage.getItem("personal_api_key") || "");
  }, []);

  useEffect(() => {
    if (isConnected && address && provider) {
      fetchAllowanceAndBalance();
    }
  }, [isConnected, address, provider]);

  const fetchAllowanceAndBalance = async () => {
    if (!address || !provider || !MOCK_USDC_ADDRESS) return;
    try {
      const usdcContract = new Contract(MOCK_USDC_ADDRESS, MockUSDCABI.abi, provider);
      
      const rawAllowance = await usdcContract.allowance(address, HIVE_REGISTRY_ADDRESS);
      setAllowance(formatUnits(rawAllowance, 6)); // Assuming 6 decimals for USDC

      const rawBalance = await usdcContract.balanceOf(address);
      setBalance(formatUnits(rawBalance, 6));
    } catch (err) {
      console.error("Failed to fetch allowance/balance", err);
    }
  };

  const handleApprove = async (amount: string) => {
    if (!signer || !MOCK_USDC_ADDRESS || !HIVE_REGISTRY_ADDRESS) return;
    setIsApproving(true);
    try {
      const usdcContract = new Contract(MOCK_USDC_ADDRESS, MockUSDCABI.abi, signer);
      const parsedAmount = parseUnits(amount, 6);
      const tx = await usdcContract.approve(HIVE_REGISTRY_ADDRESS, parsedAmount);
      await tx.wait();
      await fetchAllowanceAndBalance();
    } catch (err) {
      console.error("Failed to approve", err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleClaimFaucet = async () => {
    if (!signer || !MOCK_USDC_ADDRESS) return;
    setIsClaiming(true);
    setFaucetError("");
    setFaucetSuccess(false);
    try {
      const usdcContract = new Contract(MOCK_USDC_ADDRESS, MockUSDCABI.abi, signer);
      const tx = await usdcContract.faucet();
      await tx.wait();
      setFaucetSuccess(true);
      await fetchAllowanceAndBalance();
    } catch (err: any) {
      console.error("Faucet error", err);
      if (err.message && err.message.includes("Faucet cooldown")) {
        setFaucetError("You already claimed your test USDC recently. Please wait 24 hours.");
      } else {
        setFaucetError("Transaction failed. Make sure you have test ETH for gas.");
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // Auto-save when values change
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem("openai_key", openaiKey);
      localStorage.setItem("anthropic_key", anthropicKey);
      localStorage.setItem("rpc_url", rpcUrl);
      localStorage.setItem("max_fee", maxFee);
      localStorage.setItem("delegation_mode", delegationMode);
      localStorage.setItem("personal_endpoint", personalEndpoint);
      localStorage.setItem("personal_api_key", personalApiKey);
      window.dispatchEvent(new Event("local-storage-update"));
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }, 500);
    return () => clearTimeout(timeout);
  }, [openaiKey, anthropicKey, rpcUrl, maxFee, delegationMode, personalEndpoint, personalApiKey]);

  return (
    <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide flex items-center gap-3">
              Dashboard Settings
            </h1>
            <p className="text-[#888] mt-2">Manage your protocol preferences, delegation modes, and testnet funds.</p>
          </div>
          {isSaved && (
            <span className="text-sm text-green-400 animate-pulse bg-green-400/10 px-3 py-1.5 rounded-lg border border-green-400/20">
              Changes Saved Automatically
            </span>
          )}
        </div>

        {/* Dynamic Masonry Grid for Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 items-start gap-6">
          
          {/* Card 1: Network & API Configuration */}
          <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
              <Server size={18} className="text-(--color-accent)" /> 
              API Configuration
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#a1a1aa] tracking-wide ml-1">
                  <Key size={14} className="text-(--color-accent)" /> OpenAI API Key
                </label>
                <input 
                  type="password" 
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..." 
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#a1a1aa] tracking-wide ml-1">
                  <Key size={14} className="text-(--color-accent)" /> Anthropic API Key
                </label>
                <input 
                  type="password" 
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..." 
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Delegation Strategy */}
          <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#10b981]" /> 
              Delegation Strategy
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#a1a1aa] tracking-wide ml-1">
                  Active Mode
                </label>
                <DropdownMenu
                  label="Select Delegation Mode"
                  value={delegationMode}
                  onChange={(val) => setDelegationMode(val)}
                  options={[
                    { id: "builtin", label: "Built-in AI (Default)" },
                    { id: "manual", label: "Manual Selection (Pick models in Chat)" },
                    { id: "personal", label: "Personal AI (BYO-AI)" },
                    { id: "hired", label: "Hired Orchestrator (On-chain)" }
                  ]}
                />
              </div>

              {delegationMode === "personal" && (
                <div className="space-y-4 p-4 bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/30 rounded-xl mt-2 animate-[slide-down_0.2s_ease-out]">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#a1a1aa] tracking-wide ml-1">
                      Custom Endpoint URL
                    </label>
                    <input 
                      type="text" 
                      value={personalEndpoint}
                      onChange={(e) => setPersonalEndpoint(e.target.value)}
                      placeholder="http://localhost:8000/orchestrate" 
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#a1a1aa] tracking-wide ml-1">
                      Endpoint API Key (Optional)
                    </label>
                    <input 
                      type="password" 
                      value={personalApiKey}
                      onChange={(e) => setPersonalApiKey(e.target.value)}
                      placeholder="sk-..." 
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Testnet Faucet */}
          <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
              <Coins size={18} className="text-yellow-400" /> 
              Testnet Faucet
            </h3>
            
            {!isConnected ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center shadow-inner">
                <Wallet className="mx-auto text-[#a1a1aa] mb-4" size={24} />
                <p className="text-sm text-[#a1a1aa]">Connect your wallet to claim test funds.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#a1a1aa]">
                  HiveFi operates using Mock USDC on Ethereum Sepolia. You can claim 100 USDC every 24 hours to test the protocol.
                </p>
                <button
                  onClick={handleClaimFaucet}
                  disabled={isClaiming || faucetSuccess}
                  className="w-full py-3.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-xl font-bold transition-all border border-yellow-500/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClaiming ? <Loader2 size={18} className="animate-spin" /> : <Coins size={18} />}
                  {faucetSuccess ? "Successfully Claimed!" : isClaiming ? "Claiming..." : "Claim 100 Test USDC"}
                </button>
                <button
                  onClick={async () => {
                    if (!window.ethereum) return;
                    try {
                      await window.ethereum.request({
                        method: 'wallet_watchAsset',
                        params: {
                          type: 'ERC20',
                          options: {
                            address: MOCK_USDC_ADDRESS,
                            symbol: 'mUSDC',
                            decimals: 6,
                          },
                        },
                      });
                    } catch (error) {
                      console.error('Error importing token:', error);
                    }
                  }}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <Wallet size={18} />
                  Import Mock USDC to MetaMask
                </button>
                {faucetError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-red-200">{faucetError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 4: Spending & Allowances */}
          <div className="bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
              <Wallet size={18} className="text-[#3b82f6]" /> 
              Spending & Allowances
            </h3>
            
            {!isConnected ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center shadow-inner">
                <Wallet className="mx-auto text-[#a1a1aa] mb-4" size={24} />
                <p className="text-sm text-[#a1a1aa]">Connect your wallet to manage spending.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs font-semibold text-white/80 uppercase tracking-wide">
                    <span>Max Fee Per Prompt (USDC)</span>
                    <span className="text-[var(--color-accent)]">${maxFee}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.05"
                    value={maxFee}
                    onChange={(e) => setMaxFee(e.target.value)}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                  />
                  <div className="flex justify-between text-[10px] text-[#888] font-mono mt-1">
                    <span>$0.00</span>
                    <span>$10.00</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                    <span className="text-sm font-medium text-[#a1a1aa]">Wallet Balance</span>
                    <span className="text-sm font-mono font-bold text-white">{balance !== null ? `${balance} USDC` : "0.00 USDC"}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                    <span className="text-sm font-medium text-[#a1a1aa]">Current Allowance</span>
                    <span className="text-sm font-mono font-bold text-white">${allowance} USDC</span>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] font-mono">$</span>
                      <input 
                        type="number" 
                        value={newAllowanceAmount}
                        onChange={(e) => setNewAllowanceAmount(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 pl-8 text-white font-mono text-sm focus:outline-none focus:border-[#10b981]"
                      />
                    </div>
                    <button
                      onClick={() => handleApprove(newAllowanceAmount)}
                      disabled={isApproving}
                      className="px-4 py-3 bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] rounded-xl font-medium border border-[#10b981]/50 flex items-center justify-center min-w-[120px] transition-colors disabled:opacity-50"
                    >
                      {isApproving ? <Loader2 size={16} className="animate-spin" /> : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
