import * as fs from 'fs';
import * as path from 'path';

export async function atomicWriteJSON(filePath: string, data: any): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpFile = path.join(dir, `.tmp-${path.basename(filePath)}-${Date.now()}`);
  await fs.promises.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmpFile, filePath);
}

export async function readJSON<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}
