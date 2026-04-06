import { ethers, upgrades, network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const frontendTsPath = path.join(__dirname, "../../FE/contracts/addresses.ts");
  let currentAddresses: any = {};
  if (fs.existsSync(frontendTsPath)) {
    const content = fs.readFileSync(frontendTsPath, 'utf8');
    const match = content.match(/export const contractAddresses: any = ({[\s\S]*?});/);
    if (match) try { currentAddresses = eval(`(${match[1]})`); } catch (e) {}
  }

  const PROXY_ADDRESS = currentAddresses[network.name]?.messengerAddress;
  if (!PROXY_ADDRESS) throw new Error(`Please deploy messenger first or set messengerAddress for ${network.name}`);

  console.log(`Upgrading FlipenMessenger at ${PROXY_ADDRESS} on ${network.name}...`);
  const Messenger = await ethers.getContractFactory("FlipenMessenger");
  
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, Messenger);
  await upgraded.waitForDeployment();

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New Messenger Implementation at:", implementationAddress);

  // Update frontend variables
  currentAddresses[network.name].messengerImplementationAddress = implementationAddress;
  currentAddresses[network.name].messengerLastUpgradedAt = new Date().toISOString();

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

  const frontendContractsDir = path.join(__dirname, "../../FE/contracts");
  const abiFilePath = path.join(frontendContractsDir, "messenger-abi.json");
  fs.writeFileSync(abiFilePath, Messenger.interface.formatJson());
  console.log(`Contract ABI updated in frontend: ${abiFilePath}`);

  console.log("✅ Messenger Upgrade successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
