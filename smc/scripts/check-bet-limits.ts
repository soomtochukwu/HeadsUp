import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PROXY = "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb";

async function main() {
  const [admin] = await ethers.getSigners();
  // Load full ABI from the FE
  const abiPath = path.join(__dirname, "../../FE/contracts/celo-abi.json");
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const contract = new ethers.Contract(PROXY, abi, admin);

  const [min, max] = await contract.getBetLimits();
  console.log(`min=${ethers.formatEther(min)} max=${ethers.formatEther(max)}`);
  console.log(`owner=${await contract.owner()}`);
  console.log(`admin=${admin.address}`);
  console.log(`isOwner=${(await contract.owner()).toLowerCase() === admin.address.toLowerCase()}`);
}
main().catch(console.error);
