import * as path from 'path';
import { getRegistryContract } from './blockchain';
import { ethers } from 'ethers';
import * as ratings from './ratings';
import { readJSON, atomicWriteJSON } from './fileUtils';

const endpointsPath = path.join(__dirname, '../config/endpoints.json');

export interface SpecialistInfo {
  id: string;
  wallet: string;
  price: string;
  endpoint: string;
  modelName: string;
  stakedAmount: string;
  slashCount: number;
}

export async function getSpecialistByNiche(niche: string): Promise<SpecialistInfo | null> {

  const contract = getRegistryContract();
  if (!contract) throw new Error("Blockchain not initialized");

  const models = await contract.getModelsByNiche(niche.toUpperCase());
  if (!models || models.length === 0) return null;

  const endpoints = await readJSON<any>(endpointsPath, {});

  // Prefer models that have an endpoint registered and sort by stakedAmount
  let availableModels = [];
  for (const model of models) {
    const idStr = model.id.toString();
    if (endpoints[idStr]) {
      availableModels.push(model);
    }
  }

  if (availableModels.length === 0) return null; // No model with endpoint

  availableModels.sort((a, b) => {
    const stakeA = a.stakedAmount;
    const stakeB = b.stakedAmount;
    if (stakeA > stakeB) return -1;
    if (stakeA < stakeB) return 1;
    return 0;
  });

  const bestModel = availableModels[0];
  const idStr = bestModel.id.toString();
  return {
    id: idStr,
    wallet: bestModel.wallet,
    price: ethers.formatUnits(bestModel.pricePerQuery, 6),
    endpoint: endpoints[idStr],
    modelName: bestModel.name,
    stakedAmount: ethers.formatUnits(bestModel.stakedAmount, 6),
    slashCount: Number(bestModel.slashCount)
  };
}



export interface SpecialistListItem {
  id: string;
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

  const niches = await contract.getRegisteredNiches();
  const allSpecialists = [];
  const endpoints = await readJSON<any>(endpointsPath, {});

  for (const niche of niches) {
    const models = await contract.getModelsByNiche(niche);
    for (const model of models) {
      const idStr = model.id.toString();
      const hasEndpoint = !!endpoints[idStr];
      allSpecialists.push({
        id: idStr,
        name: model.name,
        niche: model.niche,
        pricePerQuery: ethers.formatUnits(model.pricePerQuery, 6),
        wallet: model.wallet,
        isActive: model.isActive,
        endpoint: endpoints[idStr] || null,
        isOnline: healthStatus ? (hasEndpoint && !!healthStatus[idStr]) : false,
        averageScore: allRatings[idStr]?.averageScore || null,
        totalRatings: allRatings[idStr]?.totalRatings || 0,
        stakedAmount: ethers.formatUnits(model.stakedAmount, 6),
        slashCount: Number(model.slashCount)
      });
    }
  }
  return allSpecialists;
}

export async function storeEndpoint(modelId: string, endpointUrl: string) {
  const endpoints = await readJSON<any>(endpointsPath, {});
  endpoints[modelId] = endpointUrl;
  await atomicWriteJSON(endpointsPath, endpoints);
}
