import { ethers, upgrades, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import fs from "fs";
import path from "path";

// Helper function to get implementation address with retry logic
async function getImplementationAddressWithRetry(
  proxyAddress: string, 
  maxRetries: number = 5, 
  delay: number = 2000
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Attempting to get implementation address (attempt ${i + 1}/${maxRetries})...`);
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      console.log("Implementation address:", implementationAddress);
      return implementationAddress;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Attempt ${i + 1} failed:`, errorMessage);
      if (i === maxRetries - 1) {
        console.log("All attempts failed. Using fallback...");
        return "IMPLEMENTATION_ADDRESS_NOT_AVAILABLE";
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return "IMPLEMENTATION_ADDRESS_NOT_AVAILABLE";
}

async function main(): Promise<void> {
  const [deployer]: HardhatEthersSigner[] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Flipen as upgradeable proxy
  const Flipen = await ethers.getContractFactory("Flipen");

  console.log("Deploying Flipen proxy...");
  const flipen = await upgrades.deployProxy(
    Flipen,
    [deployer.address],
    {
      initializer: "initialize",
    }
  );

  await flipen.waitForDeployment();
  const proxyAddress: string = await flipen.getAddress();

  console.log("Flipen Proxy Contract Deployed at:", proxyAddress);
  console.log("");

  // Wait a bit for the proxy to be fully initialized
  console.log("Waiting for proxy initialization...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get implementation address with retry logic
  const implementationAddress = await getImplementationAddressWithRetry(proxyAddress);

  // PREPARE FE ADDRESSES FILE
  const frontendContractsDir = path.join(__dirname, "../../FE/contracts");
  const frontendTsPath = path.join(frontendContractsDir, "addresses.ts");
  
  let currentAddresses: any = {};
  if (fs.existsSync(frontendTsPath)) {
    // Very simple parsing of the existing TS file to maintain data across deployments
    const content = fs.readFileSync(frontendTsPath, 'utf8');
    const match = content.match(/export const contractAddresses: any = ({[\s\S]*?});/);
    if (match) {
      try {
        // Evaluate the object safely
        currentAddresses = eval(`(${match[1]})`);
      } catch (e) {
        console.log("Error parsing existing addresses, starting fresh.");
      }
    }
  }

  // Update only the current network
  currentAddresses[network.name] = {
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  // Generate multi-network TypeScript file content
  const tsContent = `// Auto-generated file - Do not edit manually
// Generated on: ${new Date().toISOString()}

export const contractAddresses: any = ${JSON.stringify(currentAddresses, null, 2)};

// Helpers for specific network access
export const getContractAddress = (networkName: string) => {
  return contractAddresses[networkName]?.proxyAddress || contractAddresses['sepolia']?.proxyAddress;
};

// Map chain IDs to contract addresses
export const FLIPEN_ADDRESSES: Record<number, \`0x\${string}\`> = {
  42220: "${currentAddresses['celo']?.proxyAddress || ''}" as \`0x\${string}\`,
  11142220: "${currentAddresses['sepolia']?.proxyAddress || ''}" as \`0x\${string}\`,
};
`;

  // Write to TypeScript file
  fs.writeFileSync(frontendTsPath, tsContent);
  console.log(`Contract addresses updated in frontend: ${frontendTsPath}`);

  // Extract and save contract ABI
  const contractABI = Flipen.interface.formatJson();
  const abiFilePath = path.join(frontendContractsDir, `${network.name}-abi.json`);
  fs.writeFileSync(abiFilePath, contractABI);
  console.log(`Contract ABI saved to frontend: ${abiFilePath}`);

  console.log("");
  console.log("✅ Deployment successful!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
