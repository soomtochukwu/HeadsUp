import { ethers, upgrades, network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  if (!PROXY_ADDRESS) throw new Error("Please set PROXY_ADDRESS");

  console.log(`Upgrading Flipen at ${PROXY_ADDRESS} on ${network.name}...`);
  const Flipen = await ethers.getContractFactory("Flipen");
  
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, Flipen);
  await upgraded.waitForDeployment();

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New Implementation at:", implementationAddress);

  // SYNC TO FRONTEND
  const frontendContractsDir = path.join(__dirname, "../../FE/contracts");
  const frontendTsPath = path.join(frontendContractsDir, "addresses.ts");
  
  let currentAddresses: any = {};
  if (fs.existsSync(frontendTsPath)) {
    const content = fs.readFileSync(frontendTsPath, 'utf8');
    const match = content.match(/export const contractAddresses: any = ({[\s\S]*?});/);
    if (match) {
      try {
        currentAddresses = eval(`(${match[1]})`);
      } catch (e) {
        console.log("Error parsing existing addresses.");
      }
    }
  }

  // Update implementation address for current network
  if (!currentAddresses[network.name]) {
    currentAddresses[network.name] = { proxyAddress: PROXY_ADDRESS };
  }
  currentAddresses[network.name].implementationAddress = implementationAddress;
  currentAddresses[network.name].lastUpgradedAt = new Date().toISOString();

  // Generate updated TypeScript file content
  const tsContent = `// Auto-generated file - Do not edit manually
// Generated on: ${new Date().toISOString()}

export const contractAddresses: any = ${JSON.stringify(currentAddresses, null, 2)};

export const getContractAddress = (networkName: string) => {
  return contractAddresses[networkName]?.proxyAddress || contractAddresses['sepolia']?.proxyAddress;
};

export const FLIPEN_ADDRESSES: Record<number, \`0x\${string}\`> = {
  42220: "${currentAddresses['celo']?.proxyAddress || ''}" as \`0x\${string}\`,
  11142220: "${currentAddresses['sepolia']?.proxyAddress || ''}" as \`0x\${string}\`,
};

export const MESSENGER_ADDRESSES: Record<number, \`0x\${string}\`> = {
  42220: "${currentAddresses['celo']?.messengerAddress || ''}" as \`0x\${string}\`,
  11142220: "${currentAddresses['sepolia']?.messengerAddress || ''}" as \`0x\${string}\`,
};
`;

  fs.writeFileSync(frontendTsPath, tsContent);
  console.log(`Frontend addresses updated: ${frontendTsPath}`);

  // Update ABI
  const abiFilePath = path.join(frontendContractsDir, `${network.name}-abi.json`);
  fs.writeFileSync(abiFilePath, Flipen.interface.formatJson());
  console.log(`Contract ABI updated in frontend: ${abiFilePath}`);

  console.log("✅ Upgrade and Frontend Sync successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
