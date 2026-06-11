import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { getRegistryContract, initializeBlockchain } from '../services/blockchain';

async function main() {
  await initializeBlockchain();
  const contract = getRegistryContract();
  if (!contract) return console.log("No contract");
  const niches = await contract.getRegisteredNiches();
  console.log("NICHES:", niches);
  for (const n of niches) {
    const models = await contract.getModelsByNiche(n);
    console.log(`Models for ${n}:`, models.map((m: any) => m.name));
  }
}

main().catch(console.error);
