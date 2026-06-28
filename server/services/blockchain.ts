import { logger } from "./logger";
import { ethers } from "ethers";
import { Mutex } from "async-mutex";

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

  const rpcUrl = process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
  const usdcAddr = process.env.MOCK_USDC_ADDRESS;
  const registryAddr = process.env.HIVE_REGISTRY_ADDRESS;

  if (!usdcAddr || !registryAddr) {
    throw new Error("MOCK_USDC_ADDRESS and HIVE_REGISTRY_ADDRESS must be set in .env");
  }

  provider = new ethers.JsonRpcProvider(rpcUrl);

  const pkA = process.env.ORCHESTRATOR_PK;
  const pkB = process.env.SPECIALIST_PK; // Only used for balances

  if (!pkA) {
    throw new Error("ORCHESTRATOR_PK must be set in .env");
  }

  walletA = new ethers.Wallet(pkA, provider);
  if (pkB) walletB = new ethers.Wallet(pkB, provider);

  usdcContract = new ethers.Contract(usdcAddr, MockUSDC_ABI, walletA);
  registryContract = new ethers.Contract(registryAddr, HiveRegistry_ABI.abi || HiveRegistry_ABI, walletA);

  logger.info("Connecting to blockchain...");
  logger.info(`Wallet A (Orchestrator): ${walletA.address}`);
  if (walletB) logger.info(`Wallet B (Specialist config): ${walletB.address}`);

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

async function sendTxWithMutexAsync(txFn: () => Promise<ethers.ContractTransactionResponse>): Promise<{ hash: string; receipt: ethers.ContractTransactionReceipt | null }> {
  return await txMutex.runExclusive(async () => {
    const tx = await txFn();
    logger.info(`Transaction submitted: ${tx.hash}`);
    try {
      const receipt = await tx.wait();
      if (receipt) {
        logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
      }
      return { hash: tx.hash, receipt };
    } catch (err: any) {
      logger.error(`Transaction ${tx.hash} failed to confirm:`, err);
      throw new Error(`Transaction ${tx.hash} reverted on-chain: ${err.reason || err.message}`);
    }
  });
}

export async function requestTaskOnChain(
  clientWallet: string,
  providerId: string | number,
  amountInUSDC: string | number, // This is now maxBudget
  promptText: string,
  mode: number = 0 // 0 = CHAT, 1 = AUTOMATED
): Promise<TaskRequestResult> {
  if (!initialized || !registryContract) throw new Error("Blockchain not initialized");

  const amountBase = ethers.parseUnits(amountInUSDC.toString(), 6);
  const promptHash = ethers.keccak256(ethers.toUtf8Bytes(promptText));

  logger.info(`Locking ${amountInUSDC} USDC in escrow from ${clientWallet} for Provider ID ${providerId}...`);

  return await txMutex.runExclusive(async () => {
    try {
      await registryContract!.createTask.staticCall(
        clientWallet, 
        BigInt(providerId), 
        amountBase, 
        promptHash, 
        mode
      );
    } catch (err: any) {
      logger.error("Static call failed! Revert reason:", err);
      throw new Error("Pre-flight check failed: " + (err.reason || err.message));
    }

    const tx = await registryContract!.createTask(
      clientWallet, 
      BigInt(providerId), 
      amountBase, 
      promptHash, 
      mode, 
      { gasLimit: 300000n }
    );
    logger.info(`Transaction submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    if (receipt) {
      logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

      let taskId = "";
      for (const log of receipt.logs) {
        try {
          const parsed = registryContract!.interface.parseLog(log);
          if (parsed && parsed.name === "TaskRequested") {
            taskId = parsed.args[0].toString();
            break;
          }
        } catch {}
      }

      if (!taskId) {
        throw new Error("TaskRequested event not found in createTask receipt");
      }

      return { taskId, txHash: tx.hash };
    }

    throw new Error("Transaction receipt not available");
  });
}

export async function settleTaskOnChain(
  taskId: string | number, 
  finalAmountBase: string, 
  resultHash: string, 
  signature: string
): Promise<TaskActionResult> {
  if (!initialized || !registryContract) throw new Error("Blockchain not initialized");

  logger.info(`Settling task ${taskId} with signature...`);

  const { hash } = await sendTxWithMutexAsync(() =>
    registryContract!.settleTask(taskId, finalAmountBase, resultHash, signature, {
      gasLimit: 400000n,
    })
  );

  return {
    txHash: hash,
  };
}

export async function rejectTaskOnChain(
  taskId: string | number,
  finalAmountBase: string, 
  resultHash: string, 
  signature: string
): Promise<TaskActionResult> {
  if (!initialized || !registryContract) throw new Error("Blockchain not initialized");

  logger.info(`Rejecting task ${taskId} (initiating three-way split)...`);

  const { hash } = await sendTxWithMutexAsync(() =>
    registryContract!.rejectTask(taskId, finalAmountBase, resultHash, signature, {
      gasLimit: 400000n,
    })
  );

  return {
    txHash: hash,
  };
}



export function getRegistryContract(): ethers.Contract | null {
  return registryContract;
}

export function getAddresses(): Addresses {
  return {
    walletA: walletA ? walletA.address : "",
    walletB: walletB ? walletB.address : "",
  };
}
