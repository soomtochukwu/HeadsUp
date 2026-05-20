import { ethers } from "hardhat";

const PROXY = "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb";
const ABI = [
  "function updateBetLimits(uint256 newMinBet, uint256 newMaxBet) external",
  "function getBetLimits() view returns (uint256 min, uint256 max)",
];

async function main() {
  const [admin] = await ethers.getSigners();
  const contract = new ethers.Contract(PROXY, ABI, admin);

  const [oldMin, oldMax] = await contract.getBetLimits();
  console.log(`Current limits: min=${ethers.formatEther(oldMin)} max=${ethers.formatEther(oldMax)}`);

  // 0.05 normalized (18 decimals) — allows stablecoins to bet 0.05 USDC/USDT/cUSD
  const newMin = ethers.parseEther("0.05");
  const newMax = ethers.parseEther("12.0");

  console.log(`Setting: min=0.05 max=12.0 ...`);
  const tx = await contract.updateBetLimits(newMin, newMax, { gasLimit: 200000 });
  console.log(`Tx sent: ${tx.hash}`);
  await tx.wait(1);
  console.log(`✓ Confirmed!`);

  const [newMinCheck, newMaxCheck] = await contract.getBetLimits();
  console.log(`New limits: min=${ethers.formatEther(newMinCheck)} max=${ethers.formatEther(newMaxCheck)}`);
}

main().catch(console.error);
