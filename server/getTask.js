const { ethers } = require("ethers");
const HiveRegistry_ABI = require("/home/naman-agarwal/Desktop/HiveFi/contracts/artifacts/contracts/HiveRegistry.sol/HiveRegistry.json").abi;
async function main() {
  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
  const contract = new ethers.Contract("0x79581710a4d9bBBD462e5853854cd30C7F8EA57c", HiveRegistry_ABI, provider);
  const task = await contract.tasks(3);
  console.log(task);
}
main();
