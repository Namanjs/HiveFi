import { ethers } from "ethers";

async function main() {
  const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const mockUsdcAddress = "0x0EcFE4e070d884587A7Fc37524544Bb5dB0Cf3Cc";
  const walletAddress = "0x35fc477C33197080Afa61CbAF9F7822fc05A5185";

  const abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  const contract = new ethers.Contract(mockUsdcAddress, abi, provider);

  const balance = await contract.balanceOf(walletAddress);
  const decimals = await contract.decimals();

  console.log(`Balance of ${walletAddress}: ${ethers.formatUnits(balance, decimals)} USDC`);
}

main().catch(console.error);
