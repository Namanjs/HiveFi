import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  // Hardhat default account #0
  const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

  const orchestrator = "0x35fc477C33197080Afa61CbAF9F7822fc05A5185";
  const specialist = "0x51E15D430E93bc3a60384C1498E5ef09F8FcE546";

  const tx1 = await signer.sendTransaction({
    to: orchestrator,
    value: ethers.parseEther("1.0")
  });
  await tx1.wait();
  console.log("Funded Orchestrator");

  const tx2 = await signer.sendTransaction({
    to: specialist,
    value: ethers.parseEther("1.0")
  });
  await tx2.wait();
  console.log("Funded Specialist");
}

main().catch(console.error);
