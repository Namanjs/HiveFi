import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  MODEL_ID: string;
  NICHE: string;
  WALLET: string;
  PRICE_PER_QUERY: string;
  BACKEND: 'ollama' | 'huggingface';
  OLLAMA_BASE_URL: string;
  HUGGINGFACE_API_KEY: string;
  PORT: number;
  OLLAMA_TIMEOUT_MS: number;
  HF_TIMEOUT_MS: number;
  SYSTEM_PROMPT?: string;
  AUTH_SECRET: string;
  BASE_RPC_URL: string;
  HIVE_REGISTRY_ADDRESS: string;
}

const requiredEnvVars = ['MODEL_ID', 'NICHE', 'WALLET', 'PRICE_PER_QUERY', 'BACKEND', 'AUTH_SECRET'];

export function loadConfig(): Config {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error(`\n[CRITICAL ERROR] Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please copy .env.example to .env and configure all required values before starting the node.\n');
    process.exit(1);
  }

  const backend = (process.env.BACKEND || '').toLowerCase();
  
  if (backend !== 'ollama' && backend !== 'huggingface') {
    console.error(`\n[CRITICAL ERROR] Invalid BACKEND value: '${process.env.BACKEND}'. Must be either 'ollama' or 'huggingface'.\n`);
    process.exit(1);
  }

  if (backend === 'huggingface' && !process.env.HUGGINGFACE_API_KEY) {
    console.error(`\n[CRITICAL ERROR] HUGGINGFACE_API_KEY is required when BACKEND is 'huggingface'.\n`);
    process.exit(1);
  }

  return {
    MODEL_ID: process.env.MODEL_ID!,
    NICHE: process.env.NICHE!,
    WALLET: process.env.WALLET!,
    PRICE_PER_QUERY: process.env.PRICE_PER_QUERY!,
    BACKEND: backend as 'ollama' | 'huggingface',
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || '',
    PORT: parseInt(process.env.PORT || '4000', 10),
    OLLAMA_TIMEOUT_MS: parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10),
    HF_TIMEOUT_MS: parseInt(process.env.HF_TIMEOUT_MS || '60000', 10),
    SYSTEM_PROMPT: process.env.SYSTEM_PROMPT,
    AUTH_SECRET: process.env.AUTH_SECRET!,
    BASE_RPC_URL: process.env.BASE_RPC_URL || 'http://127.0.0.1:8545',
    HIVE_REGISTRY_ADDRESS: process.env.HIVE_REGISTRY_ADDRESS || '',
  };
}

export const config = loadConfig();
