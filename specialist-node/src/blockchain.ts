import { ethers } from 'ethers';
import { config } from './config';
import HiveRegistry_ABI from './config/HiveRegistry.json';

let provider: ethers.JsonRpcProvider | null = null;
let registryContract: ethers.Contract | null = null;
let specialistWallet: ethers.Wallet | null = null;

export async function initializeBlockchain() {
  if (!config.BASE_RPC_URL || !config.HIVE_REGISTRY_ADDRESS) {
    throw new Error("Missing BASE_RPC_URL or HIVE_REGISTRY_ADDRESS in config");
  }
  
  if (!config.SPECIALIST_PRIVATE_KEY) {
    throw new Error("Missing SPECIALIST_PRIVATE_KEY in config");
  }

  provider = new ethers.JsonRpcProvider(config.BASE_RPC_URL);
  specialistWallet = new ethers.Wallet(config.SPECIALIST_PRIVATE_KEY, provider);
  
  registryContract = new ethers.Contract(config.HIVE_REGISTRY_ADDRESS, (HiveRegistry_ABI as any).abi || HiveRegistry_ABI, provider);
  console.log(`Connected to blockchain at ${config.BASE_RPC_URL}`);
  console.log(`Specialist Wallet Address: ${specialistWallet.address}`);
}

export function getWalletAddress(): string {
  if (!specialistWallet) throw new Error("Wallet not initialized");
  return specialistWallet.address;
}

export async function verifyTaskEscrow(taskId: string, expectedProviderId: string, promptText: string): Promise<boolean> {
  if (!registryContract || !specialistWallet) {
    throw new Error("Blockchain not initialized");
  }

  try {
    const task = await registryContract.tasks(taskId);
    
    // Status Enum: 0 = Pending, 1 = Settled, 2 = Rejected, 3 = Expired, 4 = ForceClaimed
    const status = Number(task.status);
    
    if (status === 0 && task.providerId.toString() === "0") {
      console.warn(`[Optimistic Execution] Task ${taskId} not found on-chain yet (likely in mempool). Approving optimistically.`);
      return true;
    }

    if (status !== 0) {
      console.error(`Task ${taskId} is not in Pending state. Current state: ${status}`);
      return false;
    }

    if (task.providerId.toString() !== expectedProviderId.toString()) {
      console.error(`Task ${taskId} is assigned to Provider ${task.providerId}, but we expect ${expectedProviderId}`);
      return false;
    }

    const expectedPromptHash = ethers.keccak256(ethers.toUtf8Bytes(promptText));
    if (task.promptHash !== expectedPromptHash) {
      console.error(`Prompt hash mismatch for task ${taskId}`);
      return false;
    }

    console.log(`[Escrow Verified] Task ${taskId} has funds locked for Provider ${expectedProviderId}.`);
    return true;

  } catch (error) {
    console.error(`Error verifying task ${taskId} on-chain:`, error);
    return false;
  }
}

/**
 * Generates the cryptographic receipt for a completed task
 * EIP-191 payload: (taskId, finalAmount, resultHash)
 */
export async function signPaymentClaim(taskId: string, finalAmountBase: string, resultHash: string): Promise<string> {
  if (!specialistWallet) throw new Error("Blockchain not initialized");

  const hash = ethers.keccak256(
    ethers.solidityPacked(
      ["uint256", "uint256", "bytes32"],
      [taskId, finalAmountBase, resultHash]
    )
  );

  // Ethers automatically adds the EIP-191 \x19Ethereum Signed Message prefix when using signMessage with bytes
  const signature = await specialistWallet.signMessage(ethers.getBytes(hash));
  
  console.log(`[Receipt Signed] Task ${taskId}: finalAmount=${finalAmountBase}, signature=${signature}`);
  
  return signature;
}
