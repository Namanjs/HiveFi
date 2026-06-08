import { useState } from "react";
import { ethers } from "ethers";
import { HIVE_REGISTRY_ADDRESS, HIVE_REGISTRY_ABI, MOCK_USDC_ADDRESS } from "../config/contracts";

export default function RegisterNode() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "pending" | "success">("form");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  
  const [stakeAmount, setStakeAmount] = useState<string>("1");
  const [stakeTxHash, setStakeTxHash] = useState<string | null>(null);
  const [stakeLoading, setStakeLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    niche: "SQL",
    price: "",
    endpoint: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    
    if (!formData.name || formData.name.length > 50) return alert("Invalid name");
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) return alert("Invalid price");
    if (!formData.endpoint.startsWith("http")) return alert("Invalid endpoint URL");

    setLoading(true);
    setStep("pending");

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const contract = new ethers.Contract(HIVE_REGISTRY_ADDRESS, HIVE_REGISTRY_ABI, signer);
      const priceBase = ethers.parseUnits(formData.price, 6);
      
      const tx = await contract.registerModel(formData.name, formData.niche, priceBase, wallet);
      setTxHash(tx.hash);
      
      const receipt = await tx.wait();
      
      let parsedModelId = "";
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'ModelRegistered') {
            parsedModelId = parsed.args.modelId.toString();
            break;
          }
        } catch (e) {
        }
      }

      setModelId(parsedModelId);

      await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/registry/register-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: parsedModelId, endpointUrl: formData.endpoint }),
      });

      setStep("success");
    } catch (err: any) {
      console.error(err);
      alert("Registration failed: " + err.message);
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!wallet || !modelId) return;
    setStakeLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/stake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, amount: stakeAmount })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const usdcAbi = ["function approve(address spender, uint256 amount) public returns (bool)"];
      const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, usdcAbi, signer);
      const stakeBase = ethers.parseUnits(stakeAmount, 6);

      const approveTx = await usdcContract.approve(data.contractAddress, stakeBase);
      await approveTx.wait();

      const registryContract = new ethers.Contract(data.contractAddress, data.abi, signer);
      const stakeTx = await registryContract.stakeForModel(modelId, stakeBase);
      setStakeTxHash(stakeTx.hash);
      await stakeTx.wait();

    } catch (err: any) {
      console.error(err);
      alert("Staking failed: " + err.message);
    } finally {
      setStakeLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center overflow-y-auto">
        <div className="max-w-md w-full p-8 rounded-xl bg-[#111] border border-emerald-500/30 text-center my-auto">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">✓</div>
          <h2 className="text-2xl font-bold mb-4">Registration Successful!</h2>
          <p className="text-[#888] mb-6">Your model has been registered on Base Sepolia. Orchestrators can now hire your node.</p>
          <div className="bg-[#09090b] p-4 rounded-lg text-sm text-left font-mono space-y-2 border border-white/10 mb-6">
            <p><span className="text-[#666]">Model ID:</span> {modelId}</p>
            <p><span className="text-[#666]">Tx Hash:</span> <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{txHash?.slice(0, 10)}...</a></p>
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/10 text-left">
            <h3 className="font-bold mb-2">Signal Quality with Stake</h3>
            <p className="text-sm text-[#888] mb-4">Your model is registered. Stake USDC to signal quality and appear higher in search results.</p>
            
            {stakeTxHash ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm mb-4">
                Stake transaction confirmed! <br/>
                Tx: <a href={`https://sepolia.basescan.org/tx/${stakeTxHash}`} target="_blank" rel="noopener noreferrer" className="underline">{stakeTxHash.slice(0, 10)}...</a>
              </div>
            ) : (
              <div className="flex gap-2 items-center mb-4">
                <input 
                  type="number" 
                  min="1" 
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="bg-[#09090b] border border-white/10 rounded-md p-2 text-white w-24 focus:outline-none" 
                />
                <span className="text-[#888] text-sm">USDC (Min 1)</span>
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              {!stakeTxHash && (
                <button 
                  onClick={handleStake}
                  disabled={stakeLoading}
                  className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-md text-sm hover:bg-emerald-500 transition-colors w-full flex justify-center items-center gap-2"
                >
                  {stakeLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Stake Now"}
                </button>
              )}
              <button onClick={() => { setStep("form"); setStakeTxHash(null); setStakeAmount("1"); }} className="px-6 py-2 bg-white text-black font-semibold rounded-md text-sm hover:bg-gray-200 transition-colors w-full">
                {stakeTxHash ? "Register Another Model" : "Skip for now (Register Another)"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Register Specialist Node</h1>
        <p className="text-[#888] mb-8">Deploy your fine-tuned model and earn USDC per query.</p>

        {!wallet ? (
          <div className="p-8 rounded-xl bg-[#111] border border-white/10 text-center">
            <button onClick={connectWallet} className="px-6 py-3 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-colors">
              Connect Wallet
            </button>
          </div>
        ) : chainId !== 84532 ? (
          <div className="p-8 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
            <p className="text-yellow-400 mb-4">Please switch to Base Sepolia Network</p>
            <button onClick={switchNetwork} className="px-6 py-2 bg-yellow-500 text-black font-bold rounded-md hover:bg-yellow-400 transition-colors">
              Switch Network
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 rounded-xl bg-[#111] border border-white/10 space-y-6">
            <div className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/10 text-sm">
              <span className="text-[#888]">Connected Wallet</span>
              <span className="font-mono text-emerald-400">{wallet.slice(0,6)}...{wallet.slice(-4)}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#888] mb-2">Model Name</label>
              <input required maxLength={50} type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-[#09090b] border border-white/10 rounded-md p-3 text-white focus:outline-none focus:border-white/30" placeholder="e.g. Alice_SQL_v2" />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#888] mb-2">Niche</label>
              <select value={formData.niche} onChange={(e) => setFormData({...formData, niche: e.target.value})} className="w-full bg-[#09090b] border border-white/10 rounded-md p-3 text-white focus:outline-none focus:border-white/30">
                <option value="SQL">SQL</option>
                <option value="PYTHON">PYTHON</option>
                <option value="FRONTEND">FRONTEND</option>
                <option value="DESIGN">DESIGN</option>
                <option value="BACKEND">BACKEND</option>
                <option value="DATA">DATA</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#888] mb-2">Price Per Query (USDC)</label>
              <input required type="number" step="0.01" min="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full bg-[#09090b] border border-white/10 rounded-md p-3 text-white focus:outline-none focus:border-white/30" placeholder="0.05" />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#888] mb-2">Endpoint URL</label>
              <input required type="url" value={formData.endpoint} onChange={(e) => setFormData({...formData, endpoint: e.target.value})} className="w-full bg-[#09090b] border border-white/10 rounded-md p-3 text-white focus:outline-none focus:border-white/30" placeholder="https://your-node-url.com" />
            </div>

            <button disabled={loading || step === "pending"} type="submit" className="w-full px-6 py-3 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {step === "pending" ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Waiting for confirmation...
                </>
              ) : (
                "Register Model"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
