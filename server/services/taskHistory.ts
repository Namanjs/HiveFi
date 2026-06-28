import { logger } from "./logger";
import * as path from 'path';
import { Mutex } from 'async-mutex';
import { readJSON, atomicWriteJSON } from './fileUtils';

export interface TaskRecord {
  taskId: string;
  modelId: string;
  specialistWallet: string;
  clientWallet?: string;
  niche: string;
  amount: string;
  status: 'approved' | 'rejected';
  timestamp: number;
  prompt?: string;
  txHash?: string;
}

const historyPath = path.join(__dirname, '../config/task-history.json');
const MAX_RECORDS = 1000;
const historyMutex = new Mutex();

export async function appendTask(record: TaskRecord): Promise<void> {
  try {
    await historyMutex.runExclusive(async () => {
      let history: TaskRecord[] = await readJSON<TaskRecord[]>(historyPath, []);
      history.push(record);
      
      if (history.length > MAX_RECORDS) {
        history = history.slice(history.length - MAX_RECORDS);
      }
      
      await atomicWriteJSON(historyPath, history);
    });
  } catch (error) {
    logger.error('Failed to append task history:', error);
  }
}

export async function getTasksByWallet(wallet: string, limit: number = 20): Promise<TaskRecord[]> {
  try {
    const history: TaskRecord[] = await readJSON<TaskRecord[]>(historyPath, []);
    
    const walletLower = wallet.toLowerCase();
    const filtered = history.filter(t => 
      t.specialistWallet.toLowerCase() === walletLower ||
      (t.clientWallet && t.clientWallet.toLowerCase() === walletLower)
    );
    
    // Sort descending by timestamp
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    return filtered.slice(0, limit);
  } catch (error) {
    logger.error('Failed to get tasks by wallet:', error);
    return [];
  }
}

export async function getTasksByModelId(modelId: string, limit: number = 20): Promise<TaskRecord[]> {
  try {
    const history: TaskRecord[] = await readJSON<TaskRecord[]>(historyPath, []);
    
    const filtered = history.filter(t => t.modelId === modelId);
    
    // Sort descending by timestamp
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    return filtered.slice(0, limit);
  } catch (error) {
    logger.error('Failed to get tasks by model ID:', error);
    return [];
  }
}
