const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
const registryAddress = "0x79581710a4d9bBBD462e5853854cd30C7F8EA57c";
const abi = [
  "function providers(uint256) view returns (uint256 id, uint256 modelId, address wallet, string endpoint, uint256 pricePerToken, uint256 stakedAmount, uint256 totalTasksCompleted, uint256 totalTasksFailed, uint256 slashCount, bool isActive)",
  "function usdcToken() view returns (address)"
];
const registry = new ethers.Contract(registryAddress, abi, provider);
registry.providers(0).then(console.log).catch(console.error);
