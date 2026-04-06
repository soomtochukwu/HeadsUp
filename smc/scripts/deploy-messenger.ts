import { ethers, upgrades, network } from "hardhat";
import fs from "fs";
import path from "path";

async function getImplementationAddressWithRetry(
  proxyAddress: string, 
  maxRetries: number = 5, 
  delay: number = 2000
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      return implementationAddress;
    } catch (error: unknown) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return "IMPLEMENTATION_ADDRESS_NOT_AVAILABLE";
}

async function main() {
  console.log(`Deploying Upgradeable FlipenMessenger to ${network.name}...`);

  const Messenger = await ethers.getContractFactory("FlipenMessenger");
  const messenger = await upgrades.deployProxy(Messenger, [], { initializer: "initialize" });

  await messenger.waitForDeployment();

  const proxyAddress = await messenger.getAddress();
  console.log(`FlipenMessenger Proxy deployed to: ${proxyAddress}`);

  const implementationAddress = await getImplementationAddressWithRetry(proxyAddress);
  console.log(`FlipenMessenger Implementation deployed to: ${implementationAddress}`);

  // PREPARE FE ADDRESSES FILE
  const frontendContractsDir = path.join(__dirname, "../../FE/contracts");
  const frontendTsPath = path.join(frontendContractsDir, "addresses.ts");
  
  let currentAddresses: any = {};
  if (fs.existsSync(frontendTsPath)) {
    const content = fs.readFileSync(frontendTsPath, 'utf8');
    const match = content.match(/export const contractAddresses: any = ({[\s\S]*?});/);
    if (match) try { currentAddresses = eval(`(${match[1]})`); } catch (e) {}
  }

  if (!currentAddresses[network.name]) currentAddresses[network.name] = {};
  
  // Update frontend variables
  currentAddresses[network.name].messengerAddress = proxyAddress;
  currentAddresses[network.name].messengerImplementationAddress = implementationAddress;

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
  const abi = Messenger.interface.formatJson();
  fs.writeFileSync(path.join(frontendContractsDir, "messenger-abi.json"), abi);

  console.log("✅ Upgradeable Messenger Deployment complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
