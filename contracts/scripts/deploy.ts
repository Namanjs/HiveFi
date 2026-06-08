import { ethers } from "hardhat";

async function main() {
  console.log("==================================================");
  console.log("HIVEFI DEPLOYMENT SCRIPT");
  console.log("Deploying MockUSDC and HiveRegistry to Base Sepolia");
  console.log("==================================================");

  // Deploy MockUSDC first
  console.log("Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`MockUSDC deployed to: ${usdcAddress}`);

  // Deploy HiveRegistry passing the USDC address and deployer as treasury
  console.log("Deploying HiveRegistry...");
  const [deployer] = await ethers.getSigners();
  const HiveRegistry = await ethers.getContractFactory("HiveRegistry");
  const registry = await HiveRegistry.deploy(usdcAddress, deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`HiveRegistry deployed to: ${registryAddress}`);

  console.log("\nUpdate your server/.env with these contract addresses:");
  console.log(`MOCK_USDC_ADDRESS=${usdcAddress}`);
  console.log(`HIVE_REGISTRY_ADDRESS=${registryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
