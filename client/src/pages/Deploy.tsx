import { useState, useRef, useEffect, useContext } from "react";
import { Bot, Network, ChevronDown, Loader2 } from "lucide-react";
import { WalletContext } from "../contexts/WalletContext";
import { Contract, parseUnits } from "ethers";
import { HIVE_REGISTRY_ADDRESS, MOCK_USDC_ADDRESS, HIVE_REGISTRY_ABI } from "../config/contracts";
import MockUSDCABI from "../config/MockUSDC.json";

interface SelectOption {
  value: string;
  label: string;
}

const formatError = (err: any) => {
  if (err?.code === "ACTION_REJECTED") return "Transaction was rejected by the user.";
  if (err?.message?.includes("insufficient funds")) return "Insufficient Sepolia ETH for gas fees.";
  if (err?.message?.includes("Faucet cooldown active")) return "You already claimed your test USDC from the faucet recently.";
  if (err?.message) {
    const msg = err.message;
    if (msg.length > 80) return msg.substring(0, 80) + "...";
    return msg;
  }
  return "An unexpected error occurred.";
};

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none transition-colors cursor-pointer flex justify-between items-center hover:border-white/20 hover:bg-white/10 focus:ring-2 focus:ring-[var(--color-accent)]"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        style={{ borderColor: isOpen ? "var(--color-accent)" : "" }}
      >
        <span className={selectedOption ? "text-white" : "text-white/40"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`transition-transform duration-300 text-white/50 ${isOpen ? "rotate-180 text-white" : ""}`} />
      </div>

      <div 
        className={`absolute top-full left-0 w-full mt-2 bg-[#1a1a1c]/95 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.8)] transition-all duration-300 z-[100] origin-top ${
          isOpen ? "opacity-100 scale-y-100 translate-y-0" : "opacity-0 scale-y-95 -translate-y-2 pointer-events-none"
        }`}
        role="listbox"
      >
        {options.map((opt) => (
          <div 
            key={opt.value}
            className={`px-4 py-3 text-sm cursor-pointer transition-colors flex items-center gap-2 outline-none ${
              value === opt.value 
                ? "bg-[var(--color-accent)]/20 text-white font-medium border-l-2 border-[var(--color-accent)]" 
                : "text-[#ccc] hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white border-l-2 border-transparent"
            }`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onChange(opt.value);
                setIsOpen(false);
              }
            }}
            tabIndex={isOpen ? 0 : -1}
            role="option"
            aria-selected={value === opt.value}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Deploy() {
  const [activeTab, setActiveTab] = useState<"deploy" | "manage">("deploy");
  const wallet = useContext(WalletContext);
  
  // Form State
  const [agentName, setAgentName] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [baseFee, setBaseFee] = useState("0.0001");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [selectedExistingAgent, setSelectedExistingAgent] = useState("");

  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState("");
  const [deployError, setDeployError] = useState("");
  const [deploySuccess, setDeploySuccess] = useState(false);

  const nicheOptions = [
    { value: "FRONTEND", label: "Frontend Engineer" },
    { value: "BACKEND", label: "Backend Engineer" },
    { value: "DESIGN", label: "UI/UX Designer" },
    { value: "SECURITY", label: "Smart Contract Audit" },
    { value: "DEFI", label: "DeFi Operations" },
    { value: "custom", label: "Custom Niche..." },
  ];

  const [existingAgents, setExistingAgents] = useState<{value: string, label: string}[]>([]);

  useEffect(() => {
    if (wallet?.address && activeTab === "manage") {
      fetch(`${import.meta.env.VITE_API_BASE}/api/dashboard/${wallet.address}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.models) {
            // Filter duplicates, keeping only the latest version of each model name
            const uniqueModels = new Map();
            data.models.forEach((m: any) => {
              uniqueModels.set(m.name, m); // Overwrites older versions with the same name
            });
            const filteredModels = Array.from(uniqueModels.values());

            setExistingAgents(filteredModels.map((m: any) => ({
              value: m.id,
              label: `${m.name} (${m.niche})`
            })));
            if (filteredModels.length > 0) {
              setSelectedExistingAgent(filteredModels[0].id);
            }
          }
        })
        .catch(console.error);
    }
  }, [wallet?.address, activeTab]);

  const handleDeploy = async () => {
    if (!wallet?.signer || !wallet?.address) {
      setDeployError("Please connect your wallet first");
      return;
    }

    if (!agentName || !baseFee || !endpointUrl) {
      setDeployError("Please fill out all required fields (Name, Base Fee, Endpoint URL)");
      return;
    }

    try {
      setIsDeploying(true);
      setDeployError("");
      setDeploySuccess(false);

      const registry = new Contract(HIVE_REGISTRY_ADDRESS, (HIVE_REGISTRY_ABI as any).abi || HIVE_REGISTRY_ABI, wallet.signer);
      const usdc = new Contract(MOCK_USDC_ADDRESS, MockUSDCABI.abi || MockUSDCABI, wallet.signer);

      const finalNiche = niche === "custom" ? customNiche : niche;
      const parsedFee = parseUnits(baseFee, 6); // USDC has 6 decimals
      const maxPrice = parseUnits("1000", 6); // Max price allowed
      const stakeAmount = parseUnits("10", 6); // 10 USDC stake required

      // 1. Get next model ID
      setDeployStep("Reading blockchain state...");
      const modelId = await registry.nextModelId();

      // 2. Register Model
      setDeployStep("Please confirm 'Register Model' transaction in your wallet...");
      const tx1 = await registry.registerModel(agentName, finalNiche, maxPrice);
      await tx1.wait();

      // 3. Get Test USDC from Faucet
      setDeployStep("Please confirm 'Claim Test USDC' transaction in your wallet...");
      try {
        const tx2 = await usdc.faucet();
        await tx2.wait();
      } catch (faucetErr: any) {
        console.warn("Faucet skipped (likely cooldown):", faucetErr.message);
        // We continue because they probably already have USDC from a previous attempt
      }

      // 4. Approve USDC
      setDeployStep("Please confirm 'Approve USDC' transaction in your wallet...");
      const tx3 = await usdc.approve(HIVE_REGISTRY_ADDRESS, stakeAmount);
      await tx3.wait();

      // 5. Register Provider
      setDeployStep(`Please confirm 'Register Provider' for Model ID ${modelId.toString()}...`);
      const tx4 = await registry.registerProvider(modelId, endpointUrl, parsedFee, stakeAmount);
      const receipt = await tx4.wait();

      // 6. Notify Backend
      setDeployStep("Notifying HiveFi Orchestrator...");
      
      // Extract Provider ID from ProviderRegistered event logs
      // Event: ProviderRegistered(uint256 indexed providerId, uint256 indexed modelId, address wallet, string endpoint, uint256 pricePerToken)
      let actualProviderId = modelId;
      for (const log of receipt.logs) {
        try {
          const parsed = registry.interface.parseLog(log);
          if (parsed && parsed.name === 'ProviderRegistered') {
            actualProviderId = parsed.args[0]; // providerId
            break;
          }
        } catch (e) {
          // ignore parsing errors for irrelevant logs
        }
      }

      // Auto-format the URL if it's missing the protocol
      let formattedUrl = endpointUrl.trim();
      if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
        formattedUrl = "https://" + formattedUrl;
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/registry/register-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: Number(modelId),
          providerId: Number(actualProviderId),
          endpointUrl: formattedUrl
        })
      });

      if (!response.ok) {
        let errorDetails = "";
        try {
          const body = await response.json();
          errorDetails = body.error || JSON.stringify(body);
        } catch {
          errorDetails = response.statusText;
        }
        throw new Error(`Failed to register endpoint with orchestrator: ${response.status} ${errorDetails}`);
      }

      setDeploySuccess(true);
      setDeployStep("Deployed Successfully!");

    } catch (err: any) {
      console.error(err);
      setDeployError(formatError(err));
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="w-full h-full p-8 overflow-y-auto pb-32">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wide">
              {activeTab === "deploy" ? "Deploy Specialist" : "Manage Specialist"}
            </h1>
            <p className="text-[#888] mt-2">
              {activeTab === "deploy" 
                ? "Configure a new AI agent, set its base fee, and deploy it to the HiveFi Swarm."
                : "Update configurations, modify fees, or adjust system prompts for your deployed agents."}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-1 shrink-0">
            <button 
              onClick={() => setActiveTab("deploy")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === "deploy" ? "bg-white/10 text-white shadow-md" : "text-[#888] hover:text-white"}`}
            >
              Deploy New
            </button>
            <button 
              onClick={() => setActiveTab("manage")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === "manage" ? "bg-white/10 text-white shadow-md" : "text-[#888] hover:text-white"}`}
            >
              Manage Existing
            </button>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-visible">
          {/* Decorative Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent)]/10 rounded-full blur-[100px] pointer-events-none z-0" />
          
          <form className="space-y-8 relative z-10" onSubmit={(e) => e.preventDefault()}>
            
            {activeTab === "manage" && (
              <div className="mb-8 pb-8 border-b border-white/5 animate-[slide-down_0.3s_ease-out]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">Select Agent to Manage</label>
                    <CustomSelect 
                      options={existingAgents} 
                      value={selectedExistingAgent} 
                      onChange={setSelectedExistingAgent} 
                      placeholder="Select a deployed agent..." 
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Bot className="text-[var(--color-accent)]" size={20} />
                Agent Identity
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">Agent Name</label>
                  <input value={agentName} onChange={e => setAgentName(e.target.value)} type="text" placeholder="e.g. Qwen Frontend Specialist" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors" />
                </div>
                <div className="space-y-3">
                  <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">Specialty Niche</label>
                  <CustomSelect 
                    options={nicheOptions} 
                    value={niche} 
                    onChange={setNiche} 
                    placeholder="Select Niche..." 
                  />
                  {niche === "custom" && (
                     <input value={customNiche} onChange={e => setCustomNiche(e.target.value)} type="text" placeholder="Enter custom niche label" className="w-full mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors animate-[slide-down_0.3s_ease-out]" />
                  )}
                </div>
              </div>
            </div>

            <hr className="border-white/5" />

            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Network className="text-[var(--color-secondary-accent)]" size={20} />
                Network Configuration
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">Railway Endpoint URL (Provider)</label>
                  <input value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} type="text" placeholder="e.g. https://specialist-models-production.up.railway.app" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors" />
                </div>
                <div className="space-y-3">
                  <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">Base Fee (USDC)</label>
                  <div className="relative">
                    <input value={baseFee} onChange={e => setBaseFee(e.target.value)} type="number" step="0.0001" placeholder="0.0001" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors pl-10" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888] font-mono">$</span>
                  </div>
                </div>
              </div>
            </div>

            {deployError && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
                {deployError}
              </div>
            )}
            
            {deploySuccess && (
              <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200 text-sm">
                Deployment and Registration Successful!
              </div>
            )}

            <div className="pt-6">
              {activeTab === "deploy" && (
                <button 
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  type="button" 
                  className={`w-full relative group font-bold py-4 rounded-xl overflow-hidden hover:scale-[1.02] transition-transform smooth-spring shadow-[0_0_20px_rgba(255,255,255,0.2)] ${isDeploying ? 'bg-white/50 text-black/50 cursor-not-allowed' : 'bg-white text-black'}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary-accent)] opacity-0 group-hover:opacity-10 transition-opacity" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isDeploying ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        {deployStep}
                      </>
                    ) : (
                      "Deploy Agent to Swarm"
                    )}
                  </span>
                </button>
              )}
              
              <div className="flex items-center justify-center gap-2 mt-6">
                <span className="text-sm font-mono text-[#888]">
                  {activeTab === "deploy" ? (
                    <>Deployment requires a <span className="font-bold text-white">10 USDC</span> stake on Ethereum Sepolia.</>
                  ) : (
                    <>Updates require a <span className="font-bold text-white">0.001 ETH</span> gas fee on Ethereum Sepolia.</>
                  )}
                </span>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
