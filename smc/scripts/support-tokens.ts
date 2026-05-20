import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();

async function main() {
  const addressesPath = path.join(__dirname, "../addresses/celo-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const proxyAddress = addresses.proxyAddress;

  if (!proxyAddress) {
    throw new Error("Proxy address not found");
  }

  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);

  const flipen = await ethers.getContractAt("Flipen", proxyAddress, signer);

  const tokensToSupport = [
    { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6 },
    { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6 },
    { symbol: "USDm", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18 }
  ];

  for (const token of tokensToSupport) {
    try {
      const isSupported = await (flipen as any).isSupportedToken(token.address);
      if (!isSupported) {
        console.log(`Adding support for ${token.symbol} (${token.address}) with ${token.decimals} decimals...`);
        const tx = await (flipen as any).updateSupportedToken(token.address, true, token.decimals);
        console.log(`Tx Hash: ${tx.hash}`);
        await tx.wait();
        console.log(`${token.symbol} is now supported!`);
      } else {
        console.log(`${token.symbol} is already supported.`);
      }
    } catch (e: any) {
      console.error(`Failed to support ${token.symbol}:`, e.message || e);
    }
  }
}

main().catch(console.error);
