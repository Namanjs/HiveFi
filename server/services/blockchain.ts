import { logger } from "./logger";
import { ethers } from "ethers";
import { Mutex } from "async-mutex";
import * as dotenv from "dotenv";

dotenv.config();

const MockUSDC_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function mint(address to, uint256 amount) public",
  "function decimals() public view returns (uint8)"
];

import HiveRegistry_ABI from '../config/HiveRegistry.json';

const txMutex = new Mutex();

let provider: ethers.JsonRpcProvider | null = null;
let walletA: ethers.Wallet | null = null;
let walletB: ethers.Wallet | null = null;
let usdcContract: ethers.Contract | null = null;
let registryContract: ethers.Contract | null = null;
let initialized = false;

export interface Balances {
  orchestrator: string;
  specialists: Record<string, string>;
}

export interface Addresses {
  walletA: string;
  walletB: string;
}

export interface TaskRequestResult {
  taskId: string;
  txHash: string;
}

export interface TaskActionResult {
  txHash: string;
}

export async function initializeBlockchain(): Promise<void> {

  const rpcUrl = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const usdcAddr = process.env.MOCK_USDC_ADDRESS;
  const registryAddr = process.env.HIVE_REGISTRY_ADDRESS;

  if (!usdcAddr || !registryAddr) {
    throw new Error("MOCK_USDC_ADDRESS and HIVE_REGISTRY_ADDRESS must be set in .env");
  }

  provider = new ethers.JsonRpcProvider(rpcUrl);

  const pkA = process.env.ORCHESTRATOR_PK;
  const pkB = process.env.SPECIALIST_PK;

  if (!pkA || !pkB) {
    throw new Error("ORCHESTRATOR_PK and SPECIALIST_PK must be set in .env");
  }

  walletA = new ethers.Wallet(pkA, provider);
  walletB = new ethers.Wallet(pkB, provider);

  usdcContract = new ethers.Contract(usdcAddr, MockUSDC_ABI, walletA);
  registryContract = new ethers.Contract(registryAddr, HiveRegistry_ABI, walletA);

  logger.info("Connecting to blockchain...");
  logger.info(`Wallet A (Orchestrator): ${walletA.address}`);
  logger.info(`Wallet B (Specialist): ${walletB.address}`);

  const currentAllowance = await usdcContract.allowance(walletA.address, registryAddr);
  if (currentAllowance < ethers.MaxUint256 / 2n) {
    logger.info("Allowance low. Performing bulk approval for HiveRegistry...");
    const tx = await usdcContract.approve(registryAddr, ethers.MaxUint256, { gasLimit: 100000n });
    logger.info(`Approval pending... Tx Hash: ${tx.hash}`);
    await tx.wait();
    logger.info("Bulk approval completed successfully.");
  } else {
    logger.info("HiveRegistry already has sufficient USDC allowance from Wallet A.");
  }

  initialized = true;
  logger.info("Blockchain service successfully initialized.");
}

async function sendTxWithMutex(txFn: () => Promise<ethers.ContractTransactionResponse>): Promise<ethers.ContractTransactionReceipt> {
  return await txMutex.runExclusive(async () => {
    const tx = await txFn();
    logger.info(`Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction failed or was dropped");
    logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
    return receipt;
  });
}

export async function requestTaskOnChain(
  specialistWallet: string,
  modelId: string,
  amountInUSDC: string | number,
  promptText: string
): Promise<TaskRequestResult> {
  if (!initialized || !registryContract) throw new Error("Blockchain not initialized");

  const amountBase = ethers.parseUnits(amountInUSDC.toString(), 6);
  const promptHash = ethers.keccak256(ethers.toUtf8Bytes(promptText));

  logger.info(`Locking ${amountInUSDC} USDC in escrow for specialist ${specialistWallet} (Model ID ${modelId})...`);

  let taskId: bigint = 0n;
  const receipt = await txMutex.runExclusive(async () => {
    taskId = await registryContract!.nextTaskId();
    const tx = await registryContract!.requestTask(specialistWallet, BigInt(modelId), amountBase, promptHash, {
      gasLimit: 300000n,
    });
    logger.info(`Transaction submitted: ${tx.hash}`);
    const r = await tx.wait();
    if (!r) throw new Error("Transaction failed or was dropped");
    logger.info(`Transaction confirmed in block ${r.blockNumber}`);
    return r;
  });

  return {
    taskId: taskId.toString(),
    txHash: receipt.hash,
  };
}

export async function approveTaskOnChain(taskId: string | number, resultText: string): Promise<TaskActionResult> {
  if (!initialized || !registryContract) throw new Error("Blockchain not initialized");

  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(resultText));
  logger.info(`Approving task ${taskId} with result hash...`);

  const receipt = await sendTxWithMutex(() =>
    registryContract!.approveTask(taskId, resultHash, {
      gasLimit: 300000n,
    })
  );

  return {
    txHash: receipt.hash,
  };
}

export async function rejectTaskOnChain(taskId: string | number): Promise<TaskActionResult> {
  if (!initialized || !registryContract) throw new Error("Blockchain not initialized");

  logger.info(`Rejecting task ${taskId} (requesting refund)...`);

  const receipt = await sendTxWithMutex(() =>
    registryContract!.rejectTask(taskId, {
      gasLimit: 300000n,
    })
  );

  return {
    txHash: receipt.hash,
  };
}

export async function getBalances(): Promise<Balances> {
  if (!initialized || !usdcContract || !walletA) {
    return { orchestrator: "0.00", specialists: {} };
  }

  try {
    const registry = await import("./registry");
    const balA = await usdcContract.balanceOf(walletA.address);
    const specialists: Record<string, string> = {};

    const allSpecialists = await registry.getAllSpecialists();
    for (const spec of allSpecialists) {
      const walletAddr = spec.wallet;
      const bal = await usdcContract.balanceOf(walletAddr);
      specialists[spec.niche] = ethers.formatUnits(bal, 6);
    }

    return {
      orchestrator: ethers.formatUnits(balA, 6),
      specialists
    };
  } catch (error) {
    logger.error("Error fetching balances:", error);
    return { orchestrator: "0.00", specialists: {} };
  }
}

export function getRegistryContract(): ethers.Contract | null {
  return registryContract;
}

export function getAddresses(): Addresses {
  if (!walletA || !walletB) {
    return {
      walletA: "",
      walletB: "",
    };
  }
  return {
    walletA: walletA.address,
    walletB: walletB.address,
  };
}
