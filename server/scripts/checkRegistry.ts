import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import { getRegistryContract, initializeBlockchain } from '../services/blockchain';

async function main() {
  await initializeBlockchain();
  const contract = getRegistryContract();
  if (!contract) return console.log("No contract");

  const nextModelId = await contract.nextModelId();
  console.log(`Total models registered: ${nextModelId}`);

  for (let m = 0; m < Number(nextModelId); m++) {
    const model = await contract.models(m);
    console.log(`\nModel ${m}: ${model.name} [${model.niche}]`);
    console.log(`  Active: ${model.isActive}`);

    const providers = await contract.getActiveProviders(m);
    console.log(`  Active Providers: ${providers.length}`);
    for (const p of providers) {
      console.log(`    Provider ${p.id}: wallet=${p.wallet}, price=${ethers.formatUnits(p.pricePerToken, 6)} USDC/token, stake=${ethers.formatUnits(p.stakedAmount, 6)} USDC, slashes=${p.slashCount}`);
    }
  }
}

main().catch(console.error);
