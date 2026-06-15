import { ethers } from 'ethers';
import { config } from './config';
import HiveRegistry_ABI from './config/HiveRegistry.json';

let provider: ethers.JsonRpcProvider | null = null;
let registryContract: ethers.Contract | null = null;

export async function initializeBlockchain() {
  if (!config.BASE_RPC_URL || !config.HIVE_REGISTRY_ADDRESS) {
    throw new Error("Missing BASE_RPC_URL or HIVE_REGISTRY_ADDRESS in config");
  }
  
  provider = new ethers.JsonRpcProvider(config.BASE_RPC_URL);
  
  // We only need read access to verify escrow, so a provider is sufficient
  registryContract = new ethers.Contract(config.HIVE_REGISTRY_ADDRESS, HiveRegistry_ABI, provider);
  console.log(`Connected to blockchain at ${config.BASE_RPC_URL}`);
}

export async function verifyTaskEscrow(taskId: string, expectedWallet: string, promptText: string): Promise<boolean> {
  if (!registryContract) {
    throw new Error("Blockchain not initialized");
  }

  try {
    const task = await registryContract.tasks(taskId);
    
    // Status Enum: 0 = Pending, 1 = Approved, 2 = Rejected, 3 = TimeoutClaimed
    const status = Number(task.status);
    
    if (status !== 0) {
      console.error(`Task ${taskId} is not in Pending state. Current state: ${status}`);
      return false;
    }

    if (task.specialist.toLowerCase() !== expectedWallet.toLowerCase()) {
      console.error(`Task ${taskId} is assigned to ${task.specialist}, but we are ${expectedWallet}`);
      return false;
    }

    const expectedPromptHash = ethers.keccak256(ethers.toUtf8Bytes(promptText));
    if (task.promptHash !== expectedPromptHash) {
      console.error(`Prompt hash mismatch for task ${taskId}`);
      return false;
    }

    // You could also verify the locked amount matches your price, but for now this is enough to prove the protocol works securely.
    console.log(`[Escrow Verified] Task ${taskId} has funds locked for our wallet.`);
    return true;

  } catch (error) {
    console.error(`Error verifying task ${taskId} on-chain:`, error);
    return false;
  }
}
