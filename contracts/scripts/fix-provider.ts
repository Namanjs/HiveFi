import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("Fixing HiveFi Network Provider Registration...");
  
  const registryAddress = process.env.HIVE_REGISTRY_ADDRESS;
  const usdcAddress = process.env.MOCK_USDC_ADDRESS;
  
  if (!registryAddress || !usdcAddress) {
    throw new Error("Missing HIVE_REGISTRY_ADDRESS or MOCK_USDC_ADDRESS in .env");
  }

  // Orchestrator wallet (deployer)
  const [orchestrator] = await ethers.getSigners();
  
  // Specialist wallet
  const specialistKey = process.env.SPECIALIST_PK;
  if (!specialistKey) throw new Error("Missing SPECIALIST_PK in .env");
  const specialist = new ethers.Wallet(specialistKey, ethers.provider);

  const HiveRegistryAsOrchestrator = await ethers.getContractAt("HiveRegistry", registryAddress, orchestrator);
  const HiveRegistryAsSpecialist = await ethers.getContractAt("HiveRegistry", registryAddress, specialist);
  const MockUSDCAsSpecialist = await ethers.getContractAt("MockUSDC", usdcAddress, specialist);

  // 1. Deactivate Provider 0
  console.log("Deactivating broken Provider 0...");
  try {
    const tx0 = await HiveRegistryAsOrchestrator.deactivateProvider(0);
    await tx0.wait();
    console.log("Provider 0 deactivated.");
  } catch (err: any) {
    console.log("Provider 0 might already be deactivated or doesn't exist:", err.message);
  }

  // 2. Fund Specialist with USDC and ETH (if needed)
  console.log(`Funding Specialist (${specialist.address}) with ETH and USDC...`);
  
  // Send some ETH for gas if it has none
  const balance = await ethers.provider.getBalance(specialist.address);
  if (balance < ethers.parseEther("0.01")) {
    const txEth = await orchestrator.sendTransaction({
      to: specialist.address,
      value: ethers.parseEther("0.05")
    });
    await txEth.wait();
    console.log("Funded Specialist with ETH for gas.");
  }

  const MockUSDCAsOrchestrator = await ethers.getContractAt("MockUSDC", usdcAddress, orchestrator);
  const stakeAmount = ethers.parseUnits("10", 6);
  
  const txMint = await MockUSDCAsOrchestrator.mint(specialist.address, stakeAmount);
  await txMint.wait();
  console.log("Minted 10 USDC to Specialist.");

  const txApprove = await MockUSDCAsSpecialist.approve(registryAddress, stakeAmount);
  await txApprove.wait();
  console.log("Approved USDC for staking.");

  // 3. Register the new Provider using the Specialist wallet
  console.log("Registering new Provider with the correct Specialist wallet...");
  const price = ethers.parseUnits("0.0001", 6); // same price
  const txReg = await HiveRegistryAsSpecialist.registerProvider(
    0, // modelId = 0 (Qwen Frontend)
    "https://specialist-models-production.up.railway.app",
    price,
    stakeAmount
  );
  const receipt = await txReg.wait();
  console.log("New Provider Registered Successfully!");
  
  console.log("Network Fix Complete! The orchestrator will now route to the new provider.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
