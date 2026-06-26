import * as path from 'path';
import { getRegistryContract } from './blockchain';
import { ethers } from 'ethers';
import * as ratings from './ratings';
import { readJSON, atomicWriteJSON } from './fileUtils';

const endpointsPath = path.join(__dirname, '../config/endpoints.json');

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

export async function getSpecialistByNiche(niche: string, maxFee?: number): Promise<SpecialistInfo | null> {
  const contract = getRegistryContract();
  if (!contract) throw new Error("Blockchain not initialized");

  const endpoints = await readJSON<any>(endpointsPath, {});

  let availableProviders = [];

  const modelCount = await contract.modelIds.length;
  for (let i = 0; i < Number(modelCount); i++) {
    const modelId = await contract.modelIds(i);
    const model = await contract.models(modelId);
    if (!model.isActive || model.niche.toUpperCase() !== niche.toUpperCase()) continue;

    const providers = await contract.getActiveProviders(modelId);
    
    for (const provider of providers) {
      const idStr = provider.id.toString();
      const priceNum = parseFloat(ethers.formatUnits(provider.pricePerToken, 6));
      
      if (endpoints[idStr]) {
        if (maxFee !== undefined && priceNum > maxFee) {
          continue;
        }
        availableProviders.push({ model, provider, priceNum });
      }
    }
  }

  if (availableProviders.length === 0) return null;

  // Find the top 3 highest-staked providers
  availableProviders.sort((a, b) => {
    const stakeA = a.provider.stakedAmount;
    const stakeB = b.provider.stakedAmount;
    if (stakeA > stakeB) return -1;
    if (stakeA < stakeB) return 1;
    // Tie break on price
    if (a.priceNum < b.priceNum) return -1;
    if (a.priceNum > b.priceNum) return 1;
    return 0;
  });

  const top3 = availableProviders.slice(0, 3);
  
  // Calculate Median Price of top 3
  const prices = top3.map(p => p.priceNum).sort((a, b) => a - b);
  const medianPriceNum = prices[Math.floor(prices.length / 2)];
  
  // Find a provider from top 3 that matches or is below median price
  const best = top3.find(p => p.priceNum <= medianPriceNum) || top3[0];
  
  const idStr = best.provider.id.toString();
  
  return {
    id: idStr,
    modelId: best.model.id.toString(),
    wallet: best.provider.wallet,
    price: ethers.formatUnits(best.provider.pricePerToken, 6), // In production, we'd set maxBudget = medianPrice. But here price acts as maxBudget.
    endpoint: endpoints[idStr],
    modelName: best.model.name,
    stakedAmount: ethers.formatUnits(best.provider.stakedAmount, 6),
    slashCount: Number(best.provider.slashCount)
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
  const allRatings = await ratings.getAllRatings();

  const contract = getRegistryContract();
  if (!contract) throw new Error("Blockchain not initialized");

  const allSpecialists = [];
  const endpoints = await readJSON<any>(endpointsPath, {});

  const modelCount = await contract.modelIds.length;
  for (let i = 0; i < Number(modelCount); i++) {
    const modelId = await contract.modelIds(i);
    const model = await contract.models(modelId);
    if (!model.isActive) continue;

    const providers = await contract.getActiveProviders(modelId);
    for (const provider of providers) {
      const idStr = provider.id.toString();
      const hasEndpoint = !!endpoints[idStr];
      
      allSpecialists.push({
        id: idStr,
        modelId: model.id.toString(),
        name: model.name, // Display model name
        niche: model.niche,
        pricePerQuery: ethers.formatUnits(provider.pricePerToken, 6),
        wallet: provider.wallet,
        isActive: provider.isActive,
        endpoint: endpoints[idStr] || null,
        isOnline: healthStatus ? (hasEndpoint && !!healthStatus[idStr]) : false,
        averageScore: allRatings[idStr]?.averageScore || null,
        totalRatings: allRatings[idStr]?.totalRatings || 0,
        stakedAmount: ethers.formatUnits(provider.stakedAmount, 6),
        slashCount: Number(provider.slashCount)
      });
    }
  }
  
  return allSpecialists;
}

export async function storeEndpoint(providerId: string, endpointUrl: string) {
  const endpoints = await readJSON<any>(endpointsPath, {});
  endpoints[providerId] = endpointUrl;
  await atomicWriteJSON(endpointsPath, endpoints);
}
