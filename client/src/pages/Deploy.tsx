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
        className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors cursor-pointer flex justify-between items-center hover:border-white/30 focus:ring-1 focus:ring-white/30"
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
        style={{ borderColor: isOpen ? "rgba(255,255,255,0.3)" : "" }}
      >
        <span className={selectedOption ? "text-white" : "text-[#a1a1aa]"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-200 text-[#a1a1aa] ${isOpen ? "rotate-180 text-white" : ""}`} />
      </div>

      <div 
        className={`absolute top-full left-0 w-full mt-1.5 bg-[#09090b] border border-white/10 rounded-lg overflow-hidden shadow-lg transition-all duration-200 z-[100] origin-top ${
          isOpen ? "opacity-100 scale-y-100 translate-y-0" : "opacity-0 scale-y-95 -translate-y-1 pointer-events-none"
        }`}
        role="listbox"
      >
        {options.map((opt) => (
          <div 
            key={opt.value}
            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 outline-none ${
              value === opt.value 
                ? "bg-white/10 text-white font-medium" 
                : "text-[#a1a1aa] hover:bg-white/5 hover:text-white focus:bg-white/5 focus:text-white"
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

      // 1. Register Model
      setDeployStep("Please confirm 'Register Model' transaction in your wallet...");
      const tx1 = await registry.registerModel(agentName, finalNiche, maxPrice);
      const receipt1 = await tx1.wait();

      // Extract Model ID from event
      let modelId: bigint;
      for (const log of receipt1.logs) {
        try {
          const parsed = registry.interface.parseLog(log);
          if (parsed && parsed.name === 'ModelRegistered') {
            modelId = parsed.args[0];
            break;
          }
        } catch (e) {
          // ignore irrelevant logs
        }
      }

      // 3. Get Test USDC from Faucet
      setDeployStep("Please confirm 'Claim Test USDC' transaction in your wallet...");
      try {
        const tx2 = await usdc.faucet();
        await tx2.wait();
      } catch (faucetErr: any) {
        console.warn("Faucet skipped (likely cooldown):", faucetErr.message);
        // We continue because they probably already have USDC from a previous attempt
      }

      // 3. Approve USDC
      setDeployStep("Please confirm 'Approve USDC' transaction in your wallet...");
      const tx3 = await usdc.approve(HIVE_REGISTRY_ADDRESS, stakeAmount);
      await tx3.wait();

      // 4. Register Provider
      setDeployStep(`Please confirm 'Register Provider' for Model ID ${modelId!.toString()}...`);
      const tx4 = await registry.registerProvider(modelId, endpointUrl, parsedFee, stakeAmount);
      const receipt = await tx4.wait();

      // 6. Notify Backend
      setDeployStep("Notifying HiveFi Orchestrator...");
      
      // Extract Provider ID from ProviderRegistered event logs
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
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto pb-32 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {activeTab === "deploy" ? "Deploy Specialist" : "Manage Specialist"}
            </h1>
            <p className="text-[#a1a1aa] mt-1.5 text-sm">
              {activeTab === "deploy" 
                ? "Configure a new AI agent, set its base fee, and deploy it to the HiveFi Swarm."
                : "Update configurations, modify fees, or adjust system prompts for your deployed agents."}
            </p>
          </div>

          {/* Mode Toggle Horizontal */}
          <div className="flex items-center bg-[#09090b] border border-white/10 rounded-lg p-1 shrink-0 shadow-sm">
            <button 
              onClick={() => setActiveTab("deploy")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "deploy" ? "bg-white text-black shadow-sm" : "text-[#a1a1aa] hover:text-white"}`}
            >
              Deploy New
            </button>
            <button 
              onClick={() => setActiveTab("manage")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "manage" ? "bg-white text-black shadow-sm" : "text-[#a1a1aa] hover:text-white"}`}
            >
              Manage Existing
            </button>
          </div>
        </div>

        <div className="bg-[#09090b] border border-white/10 rounded-xl p-6 md:p-10 shadow-sm">
          <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
            
            {activeTab === "manage" && (
              <div className="mb-8 pb-8 border-b border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#a1a1aa]">Select Agent to Manage</label>
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
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bot className="text-[#a1a1aa]" size={16} />
                Agent Identity
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa]">Agent Name</label>
                  <input value={agentName} onChange={e => setAgentName(e.target.value)} type="text" placeholder="e.g. Qwen Frontend Specialist" className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-[#a1a1aa]/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa]">Specialty Niche</label>
                  <CustomSelect 
                    options={nicheOptions} 
                    value={niche} 
                    onChange={setNiche} 
                    placeholder="Select Niche..." 
                  />
                  {niche === "custom" && (
                     <input value={customNiche} onChange={e => setCustomNiche(e.target.value)} type="text" placeholder="Enter custom niche label" className="w-full mt-3 bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-[#a1a1aa]/50 animate-[slide-down_0.2s_ease-out]" />
                  )}
                </div>
              </div>
            </div>

            <hr className="border-white/5" />

            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Network className="text-[#a1a1aa]" size={16} />
                Network Configuration
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa]">Railway Endpoint URL (Provider)</label>
                  <input value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} type="text" placeholder="https://specialist-models..." className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-[#a1a1aa]/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa]">Base Fee (USDC)</label>
                  <div className="relative">
                    <input value={baseFee} onChange={e => setBaseFee(e.target.value)} type="number" step="0.0001" placeholder="0.0001" className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-[#a1a1aa]/50" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] font-mono">$</span>
                  </div>
                </div>
              </div>
            </div>

            {deployError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
                <Loader2 className="shrink-0 hidden" />
                {deployError}
              </div>
            )}
            
            {deploySuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
                Deployment and Registration Successful!
              </div>
            )}

            <div className="pt-6">
              {activeTab === "deploy" && (
                <button 
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  type="button" 
                  className={`w-full py-3.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${isDeploying ? 'bg-white/50 text-black/50 cursor-not-allowed' : 'bg-white text-black hover:bg-white/90 shadow-sm'}`}
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      {deployStep}
                    </>
                  ) : (
                    "Deploy Agent to Swarm"
                  )}
                </button>
              )}
              
              <div className="flex items-center justify-center mt-4">
                <span className="text-xs text-[#a1a1aa]">
                  {activeTab === "deploy" ? (
                    <>Deployment requires a <span className="font-medium text-white">10 USDC</span> stake on Ethereum Sepolia.</>
                  ) : (
                    <>Updates require a <span className="font-medium text-white">0.001 ETH</span> gas fee on Ethereum Sepolia.</>
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
