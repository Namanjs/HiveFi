import * as dotenv from "dotenv";
import { ethers } from "ethers";
import { getRegistryContract } from "./server/services/blockchain";

dotenv.config({ path: "./server/.env" });

async function main() {
  const contract = getRegistryContract();
  if (!contract) {
    console.log("No contract");
    return;
  }
  const niches = await contract.getRegisteredNiches();
  console.log("NICHES:", niches);
}
main().catch(console.error);
