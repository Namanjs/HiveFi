import { logger } from "./logger";
import { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import { readJSON } from './fileUtils';

const apiKeysPath = path.join(__dirname, '../config/api-keys.json');

let cachedKeys: Record<string, any> | null = null;
let lastCacheUpdate = 0;

export async function isValidApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  const now = Date.now();
  if (!cachedKeys || now - lastCacheUpdate > 60000) {
    try {
      cachedKeys = await readJSON<any>(apiKeysPath, {});
      lastCacheUpdate = now;
    } catch (err) {
      logger.error('Error reading api-keys.json:', err);
      cachedKeys = {};
    }
  }
  const keyData = cachedKeys![apiKey];
  return !!(keyData && keyData.isActive);
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<any> {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
  }

  const valid = await isValidApiKey(apiKey);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
  }

  next();
}
