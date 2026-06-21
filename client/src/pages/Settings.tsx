import { useState, useEffect, useRef } from "react";
import { Key, Server, ShieldCheck, Wallet, Loader2, Coins, AlertCircle, Info } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { Contract, formatUnits, parseUnits } from "ethers";
import MockUSDCABI from "../config/MockUSDC.json";
import { DropdownMenu } from "../components/DropdownMenu";
import { motion, AnimatePresence, Variants } from "framer-motion";

const MOCK_USDC_ADDRESS = import.meta.env.VITE_MOCK_USDC_ADDRESS;
const HIVE_REGISTRY_ADDRESS = import.meta.env.VITE_HIVE_REGISTRY_ADDRESS;

function AllowanceTooltip() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const timeoutRef = useRef<any>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside if it was opened by click
  useEffect(() => {
    if (!isClicked) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsClicked(false);
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isClicked]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (isClicked) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isClicked) {
      setIsOpen(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (isClicked) {
      setIsClicked(false);
      setIsOpen(false);
    } else {
      setIsClicked(true);
      setIsOpen(true);
    }
  };

  return (
    <div 
      ref={tooltipRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        className="text-[#a1a1aa] hover:text-white transition-colors focus:outline-none flex items-center justify-center p-0.5 rounded-full hover:bg-white/10"
        aria-label="Allowance info"
      >
        <Info size={13} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 bottom-full right-0 mb-2 w-80 p-4 bg-[#09090b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-xl leading-relaxed text-xs text-[#a1a1aa] pointer-events-auto"
          >
            {/* Tooltip Arrow */}
            <div className="absolute top-full right-3 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#09090b]/95" />
            
            <strong className="text-white block mb-1 font-medium flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#a1a1aa]" /> Allowance Mechanics
            </strong>
            <p>
              The ERC-20 security standard prevents smart contracts from automatically increasing your allowance after refunding unspent fees. To avoid signing a new approval transaction for every Swarm operation, you can authorize an <strong className="text-white">Infinite</strong> allowance. The HiveRegistry strictly enforces cryptographic receipts, ensuring only the exact tokens consumed are deducted from your balance.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

  const handleApprove = async (amount: string, isInfinite: boolean = false) => {
    if (!signer || !MOCK_USDC_ADDRESS || !HIVE_REGISTRY_ADDRESS) return;
    setIsApproving(true);
    try {
      const usdcContract = new Contract(MOCK_USDC_ADDRESS, MockUSDCABI.abi, signer);
      const parsedAmount = isInfinite ? 115792089237316195423570985008687907853269984665640564039457584007913129639935n : parseUnits(amount, 6);
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

  // Framer Motion Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }
  };

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto custom-scrollbar">
      <motion.div 
        className="max-w-6xl mx-auto space-y-8 pb-12"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Professional Header */}
        <motion.div variants={cardVariants} className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
              Settings
            </h1>
            <p className="text-[#a1a1aa] mt-1.5 text-sm">Manage protocol configurations, models, and allowances.</p>
          </div>
          {isSaved && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="text-[11px] font-medium text-[#10b981] flex items-center gap-1.5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              Saved
            </motion.div>
          )}
        </motion.div>

        {/* Clean 2-Column Layout with Flex Columns to prevent odd spacing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6">
            {/* Card 1: Network & API Configuration */}
            <motion.div variants={cardVariants} className="bg-[#09090b] border border-white/10 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-white/5 bg-[#09090b]/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Server size={15} className="text-[#a1a1aa]" /> 
                  API Configuration
                </h3>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa] flex items-center gap-2">
                    <Key size={13} className="text-[#a1a1aa]" /> OpenAI API Key
                  </label>
                  <input 
                    type="password" 
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..." 
                    className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa] flex items-center gap-2">
                    <Key size={13} className="text-[#a1a1aa]" /> Anthropic API Key
                  </label>
                  <input 
                    type="password" 
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..." 
                    className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-white/20"
                  />
                </div>
              </div>
            </motion.div>

            {/* Card 2: Delegation Strategy */}
            <motion.div variants={cardVariants} className="bg-[#09090b] border border-white/10 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-white/5 bg-[#09090b]/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck size={15} className="text-[#a1a1aa]" /> 
                  Delegation Strategy
                </h3>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa]">
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
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-2"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#a1a1aa]">
                        Custom Endpoint URL
                      </label>
                      <input 
                        type="text" 
                        value={personalEndpoint}
                        onChange={(e) => setPersonalEndpoint(e.target.value)}
                        placeholder="http://localhost:8000/orchestrate" 
                        className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-white/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[#a1a1aa]">
                        Endpoint API Key (Optional)
                      </label>
                      <input 
                        type="password" 
                        value={personalApiKey}
                        onChange={(e) => setPersonalApiKey(e.target.value)}
                        placeholder="sk-..." 
                        className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-white/20"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-6">
            {/* Card 3: Spending & Allowances */}
            <motion.div variants={cardVariants} className="bg-[#09090b] border border-white/10 rounded-xl shadow-sm relative">
              <div className="px-6 py-5 border-b border-white/5 bg-[#09090b]/50 rounded-t-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Wallet size={15} className="text-[#a1a1aa]" /> 
                  Spending & Allowances
                </h3>
              </div>
              
              {!isConnected ? (
                <div className="p-10 text-center flex flex-col items-center justify-center">
                  <Wallet className="text-[#a1a1aa] mb-3" size={24} />
                  <p className="text-sm text-[#a1a1aa]">Connect your wallet to manage protocol spending limits.</p>
                </div>
              ) : (
                <div className="p-6 space-y-8">
                  <div className="space-y-4">
                    <label className="flex items-center justify-between text-xs font-medium text-[#a1a1aa]">
                      <span>Max Fee Per Prompt (USDC)</span>
                      <span className="text-white font-mono bg-[#18181b] px-2 py-0.5 rounded border border-white/10">${maxFee}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.05"
                      value={maxFee}
                      onChange={(e) => setMaxFee(e.target.value)}
                      className="w-full h-1.5 bg-[#18181b] border border-white/5 rounded-lg appearance-none cursor-pointer accent-white hover:accent-white/90 transition-all outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#18181b] border border-white/5 rounded-lg p-4 flex flex-col gap-1">
                      <span className="text-xs font-medium text-[#a1a1aa]">Wallet Balance</span>
                      <span className="text-sm font-mono text-white">{balance !== null ? balance : "0.00"} USDC</span>
                    </div>
                    <div className="bg-[#18181b] border border-white/5 rounded-lg p-4 flex flex-col gap-1 relative">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-[#a1a1aa]">Current Allowance</span>
                        <AllowanceTooltip />
                      </div>
                      <span className="text-sm font-mono text-white truncate" title={`${allowance} USDC`}>
                        {allowance && parseFloat(allowance) > 1e10 ? "Unlimited" : `${allowance} USDC`}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a1a1aa] font-mono">$</span>
                      <input 
                        type="number" 
                        value={newAllowanceAmount}
                        onChange={(e) => setNewAllowanceAmount(e.target.value)}
                        className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => handleApprove(newAllowanceAmount, false)}
                      disabled={isApproving}
                      className="px-6 py-2.5 bg-white text-black hover:bg-white/90 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                    >
                      {isApproving ? <Loader2 size={16} className="animate-spin" /> : "Approve"}
                    </button>
                    <button
                      onClick={() => handleApprove("0", true)}
                      disabled={isApproving}
                      className="px-4 py-2.5 bg-(--color-accent)/10 text-(--color-accent) hover:bg-(--color-accent)/20 border border-(--color-accent)/30 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center whitespace-nowrap"
                    >
                      Infinite
                    </button>
                  </div>

                </div>
              )}
            </motion.div>

            {/* Card 4: Testnet Faucet */}
            <motion.div variants={cardVariants} className="bg-[#09090b] border border-white/10 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-white/5 bg-[#09090b]/50">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Coins size={15} className="text-[#a1a1aa]" /> 
                  Testnet Faucet
                </h3>
              </div>
              
              {!isConnected ? (
                <div className="p-10 text-center flex flex-col items-center justify-center">
                  <Wallet className="text-[#a1a1aa] mb-3" size={24} />
                  <p className="text-sm text-[#a1a1aa]">Connect your wallet to claim test funds.</p>
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  <p className="text-sm text-[#a1a1aa] leading-relaxed">
                    HiveFi operates using Mock USDC on Ethereum Sepolia. You can claim <span className="text-white">100 USDC</span> every 24 hours to test the protocol and deploy agents.
                  </p>
                  
                  <button
                    onClick={handleClaimFaucet}
                    disabled={isClaiming || faucetSuccess}
                    className="w-full py-2.5 bg-[#18181b] hover:bg-[#27272a] text-white rounded-lg text-sm font-medium transition-colors border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isClaiming ? <Loader2 size={16} className="animate-spin" /> : <Coins size={16} />}
                    {faucetSuccess ? "Successfully Claimed!" : isClaiming ? "Claiming..." : "Claim 100 Test USDC"}
                  </button>
                  
                  {faucetError && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2"
                    >
                      <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-red-200">{faucetError}</span>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
