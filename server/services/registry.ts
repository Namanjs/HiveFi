import * as path from 'path';
import { getRegistryContract } from './blockchain';
import { ethers } from 'ethers';
import * as ratings from './ratings';
import { readJSON, atomicWriteJSON } from './fileUtils';

const endpointsPath = path.join(__dirname, '../config/endpoints.json');

let cachedSpecialistList: any[] | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

export interface SpecialistInfo {
  id: string; // providerId
  modelId: string;
  wallet: string;
  price: string;
  endpoint: string;
  modelName: string;
  stakedAmount: string;
  slashCount: number;
}

import { logger } from './logger';

export async function getSpecialistByNiche(niche: string, maxFee?: number): Promise<SpecialistInfo | null> {
  const allSpecialists = await getAllSpecialists();
  
  const availableProviders = allSpecialists
    .filter(s => s.niche.toUpperCase() === niche.toUpperCase() && s.isActive && s.endpoint)
    .map(s => ({
      model: { id: s.modelId, name: s.name, niche: s.niche },
      provider: { id: s.id, wallet: s.wallet, pricePerToken: ethers.parseUnits(s.pricePerQuery, 6), stakedAmount: ethers.parseUnits(s.stakedAmount, 6), slashCount: s.slashCount },
      priceNum: parseFloat(s.pricePerQuery)
    }));

  if (maxFee !== undefined) {
    const withinBudget = availableProviders.filter(p => p.priceNum <= maxFee);
    if (withinBudget.length === 0) return null;
    availableProviders.splice(0, availableProviders.length, ...withinBudget);
  }

  if (availableProviders.length === 0) return null;

  availableProviders.sort((a, b) => {
    const stakeA = BigInt(a.provider.stakedAmount.toString());
    const stakeB = BigInt(b.provider.stakedAmount.toString());
    if (stakeA > stakeB) return -1;
    if (stakeA < stakeB) return 1;
    if (a.priceNum < b.priceNum) return -1;
    if (a.priceNum > b.priceNum) return 1;
    return 0;
  });

  const top3 = availableProviders.slice(0, 3);
  const prices = top3.map(p => p.priceNum).sort((a, b) => a - b);
  const medianPriceNum = prices[Math.floor(prices.length / 2)];
  const best = top3.find(p => p.priceNum <= medianPriceNum) || top3[0];

  const specDetail = allSpecialists.find(s => s.id === best.provider.id);

  return {
    id: best.provider.id,
    modelId: best.model.id,
    wallet: best.provider.wallet,
    price: best.priceNum.toString(),
    endpoint: specDetail?.endpoint || "",
    modelName: best.model.name,
    stakedAmount: ethers.formatUnits(best.provider.stakedAmount, 6),
    slashCount: best.provider.slashCount
  };
}

export async function getSpecialistById(providerId: string): Promise<SpecialistInfo | null> {
  const allSpecialists = await getAllSpecialists();
  const spec = allSpecialists.find(s => s.id === providerId);
  if (!spec) return null;
  return {
    id: spec.id,
    modelId: spec.modelId,
    wallet: spec.wallet,
    price: spec.pricePerQuery,
    endpoint: spec.endpoint || "",
    modelName: spec.name,
    stakedAmount: spec.stakedAmount,
    slashCount: spec.slashCount
  };
}

export interface SpecialistListItem {
  id: string; // providerId
  modelId: string;
  name: string;
  niche: string;
  pricePerQuery: string;
  wallet: string;
  isActive: boolean;
  endpoint: string | null;
  isOnline: boolean;
  averageScore: number | null;
  totalRatings: number;
  stakedAmount: string;
  slashCount: number;
}

export async function getAllSpecialists(healthStatus?: Record<string, boolean>): Promise<SpecialistListItem[]> {
  const now = Date.now();
  if (!cachedSpecialistList || now - lastCacheUpdate > CACHE_TTL_MS) {
    const allRatings = await ratings.getAllRatings();
    const contract = getRegistryContract();
    if (!contract) throw new Error("Blockchain not initialized");

    const allSpecialists = [];
    const endpoints = await readJSON<any>(endpointsPath, {});

    const modelCount = await contract.nextModelId();
    for (let i = 0; i < Number(modelCount); i++) {
      try {
        const modelId = await contract.modelIds(i);
        const model = await contract.models(modelId);
        if (!model.isActive) continue;

        const providers = await contract.getActiveProviders(modelId);
        for (const provider of providers) {
          const idStr = provider.id.toString();
          
          allSpecialists.push({
            id: idStr,
            modelId: model.id.toString(),
            name: model.name,
            niche: model.niche,
            pricePerQuery: ethers.formatUnits(provider.pricePerToken, 6),
            wallet: provider.wallet,
            isActive: provider.isActive,
            endpoint: endpoints[idStr] || null,
            averageScore: allRatings[idStr]?.averageScore || null,
            totalRatings: allRatings[idStr]?.totalRatings || 0,
            stakedAmount: ethers.formatUnits(provider.stakedAmount, 6),
            slashCount: Number(provider.slashCount)
          });
        }
      } catch (loopErr: any) {
        logger.error(`Error querying model info at index ${i} on-chain:`, loopErr);
      }
    }
    cachedSpecialistList = allSpecialists;
    lastCacheUpdate = now;
  }

  return cachedSpecialistList.map(spec => {
    const hasEndpoint = !!spec.endpoint;
    return {
      ...spec,
      isOnline: healthStatus ? (hasEndpoint && !!healthStatus[spec.id]) : false
    };
  });
}

export async function storeEndpoint(providerId: string, endpointUrl: string) {
  const endpoints = await readJSON<any>(endpointsPath, {});
  endpoints[providerId] = endpointUrl;
  await atomicWriteJSON(endpointsPath, endpoints);
}
