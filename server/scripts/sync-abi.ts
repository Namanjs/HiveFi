import * as fs from 'fs';
import * as path from 'path';

const hardhatArtifactPath = path.join(__dirname, '../../contracts/artifacts/contracts/HiveRegistry.sol/HiveRegistry.json');
const serverConfigPath = path.join(__dirname, '../config/HiveRegistry.json');
const clientConfigPath = path.join(__dirname, '../../client/src/config/HiveRegistry.json');

try {
  const artifactData = fs.readFileSync(hardhatArtifactPath, 'utf8');
  const artifactJSON = JSON.parse(artifactData);
  const abi = artifactJSON.abi;
  
  const formattedABI = JSON.stringify(abi, null, 2);
  
  fs.writeFileSync(serverConfigPath, formattedABI, 'utf8');
  console.log(`[+] Synced ABI to ${serverConfigPath}`);
  
  fs.writeFileSync(clientConfigPath, formattedABI, 'utf8');
  console.log(`[+] Synced ABI to ${clientConfigPath}`);
  
} catch (error) {
  console.error('Error syncing ABI:', error);
  process.exit(1);
}
