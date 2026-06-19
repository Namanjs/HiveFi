import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("Setting up HiveFi Network...");
  const [deployer] = await ethers.getSigners();
  
  const registryAddress = process.env.HIVE_REGISTRY_ADDRESS;
  const usdcAddress = process.env.MOCK_USDC_ADDRESS;
  
  if (!registryAddress || !usdcAddress) {
    throw new Error("Missing HIVE_REGISTRY_ADDRESS or MOCK_USDC_ADDRESS in .env");
  }

  const HiveRegistry = await ethers.getContractAt("HiveRegistry", registryAddress);
  const MockUSDC = await ethers.getContractAt("MockUSDC", usdcAddress);

  // 1. Register the FRONTEND Model
  console.log("Registering FRONTEND Model...");
  // name, niche, maxPricePerToken
  const maxPrice = ethers.parseUnits("0.1", 6); // 0.1 USDC max price per token
  const tx1 = await HiveRegistry.registerModel("Qwen Frontend", "FRONTEND", maxPrice);
  await tx1.wait();
  console.log("FRONTEND Model Registered (Model ID: 0)");

  // 2. Mint USDC and Approve
  console.log("Minting and Approving USDC for Stake...");
  const stakeAmount = ethers.parseUnits("10", 6); // 10 USDC stake
  const txMint = await MockUSDC.mint(deployer.address, stakeAmount);
  await txMint.wait();
  const txApprove = await MockUSDC.approve(registryAddress, stakeAmount);
  await txApprove.wait();

  // 3. Register the Provider
  console.log("Registering Railway Node as Provider...");
  const price = ethers.parseUnits("0.0001", 6);
  // modelId, endpoint, pricePerToken, initialStake
  const tx2 = await HiveRegistry.registerProvider(0, "https://specialist-models-production.up.railway.app", price, stakeAmount);
  await tx2.wait();
  console.log("Provider Registered Successfully! (Provider ID: 0)");
  
  console.log("Network Setup Complete! Your Orchestrator is ready to route requests to Railway.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
