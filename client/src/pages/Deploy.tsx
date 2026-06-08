import { useState, useRef, useEffect } from "react";
import { Bot, Network, ChevronDown } from "lucide-react";

function CustomSelect({ options, value, onChange, placeholder }: any) {
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

  const selectedOption = options.find((o: any) => o.value === value);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none transition-colors cursor-pointer flex justify-between items-center hover:border-white/20 hover:bg-white/10"
        onClick={() => setIsOpen(!isOpen)}
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
      >
        {options.map((opt: any) => (
          <div 
            key={opt.value}
            className={`px-4 py-3 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
              value === opt.value 
                ? "bg-[var(--color-accent)]/20 text-white font-medium border-l-2 border-[var(--color-accent)]" 
                : "text-[#ccc] hover:bg-white/10 hover:text-white border-l-2 border-transparent"
            }`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
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
  
  // Form State
  const [niche, setNiche] = useState("");
  const [model, setModel] = useState("gpt4");
  const [customModelUrl, setCustomModelUrl] = useState("");
  const [selectedExistingAgent, setSelectedExistingAgent] = useState("");

  const nicheOptions = [
    { value: "code", label: "Code Generation" },
    { value: "data", label: "Data Analysis" },
    { value: "design", label: "UI/UX Design" },
    { value: "security", label: "Smart Contract Audit" },
    { value: "defi", label: "DeFi Operations" },
    { value: "custom", label: "Custom Niche..." },
  ];

  const modelOptions = [
    { value: "gpt4", label: "GPT-4o" },
    { value: "claude", label: "Claude 3.5 Sonnet" },
    { value: "llama3", label: "Llama 3 70B" },
    { value: "custom", label: "Custom Model (HuggingFace / API)" },
  ];

  const existingAgents = [
    { value: "agent_123", label: "SQL Specialist (Deployed)" },
    { value: "agent_456", label: "Frontend Engineer (Deployed)" }
  ];

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
                  <input type="text" placeholder="e.g. Rust Systems Expert" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors" />
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
                     <input type="text" placeholder="Enter custom niche label" className="w-full mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors animate-[slide-down_0.3s_ease-out]" />
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
                  <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">Base Model</label>
                  <CustomSelect 
                    options={modelOptions} 
                    value={model} 
                    onChange={setModel} 
                  />
                  {model === "custom" && (
                     <input 
                      type="text" 
                      placeholder="e.g. meta-llama/Llama-2-7b-chat-hf" 
                      value={customModelUrl}
                      onChange={(e) => setCustomModelUrl(e.target.value)}
                      className="w-full mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors animate-[slide-down_0.3s_ease-out]" 
                    />
                  )}
                </div>
                <div className="space-y-3">
                  <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">Base Fee (USDC)</label>
                  <div className="relative">
                    <input type="number" step="0.01" placeholder="0.05" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors pl-10" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888] font-mono">$</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="ml-1 text-xs font-mono text-[#888] uppercase tracking-wider">System Prompt Instructions</label>
                <textarea rows={4} placeholder="Describe how this agent should behave and execute tasks..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-accent)] focus:bg-white/10 transition-colors resize-none"></textarea>
              </div>
            </div>

            <div className="pt-6">
              <button type="button" className="w-full relative group bg-white text-black font-bold py-4 rounded-xl overflow-hidden hover:scale-[1.02] transition-transform smooth-spring shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary-accent)] opacity-0 group-hover:opacity-10 transition-opacity" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {activeTab === "deploy" ? "Deploy Agent to Swarm" : "Update Agent Parameters"}
                </span>
              </button>
              
              <div className="flex items-center justify-center gap-2 mt-6">
                <span className="text-sm font-mono text-[#888]">
                  {activeTab === "deploy" ? (
                    <>Deployment requires a <span className="font-bold text-white">0.01 ETH</span> stake on Base Sepolia.</>
                  ) : (
                    <>Updates require a <span className="font-bold text-white">0.001 ETH</span> gas fee on Base Sepolia.</>
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
