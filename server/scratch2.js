const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
const registryAddress = "0x79581710a4d9bBBD462e5853854cd30C7F8EA57c";
const abi = ["function usdcToken() view returns (address)"];
const registry = new ethers.Contract(registryAddress, abi, provider);
registry.usdcToken().then(console.log).catch(console.error);
