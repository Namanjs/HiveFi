import * as path from 'path';
import * as crypto from 'crypto';
import { readJSON, atomicWriteJSON } from './fileUtils';

const apiKeysPath = path.join(__dirname, '../config/api-keys.json');

async function readKeys(): Promise<any> {
  return await readJSON<any>(apiKeysPath, {});
}

async function writeKeys(keys: any) {
  await atomicWriteJSON(apiKeysPath, keys);
}

export async function generateKey(name: string): Promise<string> {
  const keys = await readKeys();
  const randomStr = crypto.randomBytes(32).toString('hex');
  const keyStr = `hivefi-${randomStr}`;
  
  keys[keyStr] = {
    name,
    createdAt: Date.now(),
    isActive: true
  };
  
  await writeKeys(keys);
  return keyStr;
}

export async function revokeKey(key: string): Promise<void> {
  const keys = await readKeys();
  if (keys[key]) {
    keys[key].isActive = false;
    await writeKeys(keys);
  }
}

export async function listKeys(): Promise<Record<string, any>> {
  const keys = await readKeys();
  const maskedKeys: Record<string, any> = {};
  for (const [keyStr, metadata] of Object.entries<any>(keys)) {
    const masked = keyStr.substring(0, 11) + '****-****';
    maskedKeys[masked] = metadata;
  }
  return maskedKeys;
}
