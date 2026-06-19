const { ethers } = require("ethers");
async function main() {
  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
  const txHash = "0xf63c06e5a347f21e1384d4ec6310dc86b7f66eb591b08218d949f0ac49071ef2";
  const tx = await provider.getTransaction(txHash);
  if (!tx) { console.log("Tx not found"); return; }
  console.log("Input data:", tx.data);
  try {
    await provider.call(tx, tx.blockNumber);
    console.log("Call succeeded?");
  } catch(err) {
    console.log("Revert reason:", err.reason || err.data || err.message);
  }
}
main();
