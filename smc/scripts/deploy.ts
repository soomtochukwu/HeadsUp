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
  console.log(">>>DEPLOYER:", deployer.address);
  console.log("");

  // Wait a bit for the proxy to be fully initialized
  console.log("Waiting for proxy initialization...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get implementation address with retry logic
  const implementationAddress = await getImplementationAddressWithRetry(proxyAddress);

  // Save contract addresses to TypeScript file
  const contractAddresses = {
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress,
    network: network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  // Create the addresses directory if it doesn't exist
  const addressesDir = path.join(__dirname, "../addresses");
  if (!fs.existsSync(addressesDir)) {
    fs.mkdirSync(addressesDir, { recursive: true });
  }

  // Generate TypeScript file content
  const tsContent = `// Auto-generated file - Do not edit manually
// Generated on: ${new Date().toISOString()}
// Network: ${network.name}

export interface ContractAddresses {
  proxyAddress: string;
  implementationAddress: string;
  network: string;
  deployedAt: string;
  deployer: string;
}

export const contractAddresses: ContractAddresses = {
  proxyAddress: "${proxyAddress}",
  implementationAddress: "${implementationAddress}",
  network: "${network.name}",
  deployedAt: "${new Date().toISOString()}",
  deployer: "${deployer.address}"
};

// Export individual addresses for convenience
export const FLIPEN_PROXY_ADDRESS = "${proxyAddress}";
export const FLIPEN_IMPLEMENTATION_ADDRESS = "${implementationAddress}";

export default contractAddresses;
`;

  // Write to TypeScript file
  const tsFilePath = path.join(
    addressesDir,
    `${network.name}-addresses.ts`
  );
  fs.writeFileSync(tsFilePath, tsContent);
  console.log(`Contract addresses saved to: ${tsFilePath}`);

  // Also save as JSON for backup
  const jsonFilePath = path.join(
    addressesDir,
    `${network.name}-addresses.json`
  );
  fs.writeFileSync(jsonFilePath, JSON.stringify(contractAddresses, null, 2));
  console.log(`Contract addresses also saved as JSON to: ${jsonFilePath}`);

  // Extract and save contract ABI
  const contractABI = Flipen.interface.formatJson();
  const abiFilePath = path.join(
    addressesDir,
    `${network.name}-abi.json`
  );
  fs.writeFileSync(abiFilePath, contractABI);
  console.log(`Contract ABI saved to: ${abiFilePath}`);

  // Copy the TypeScript file to frontend contracts directory
  const frontendContractsDir = path.join(__dirname, "../../FE/contracts");
  
  // Create the frontend contracts directory if it doesn't exist
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
    console.log(`Created frontend contracts directory: ${frontendContractsDir}`);
  }
  
  const frontendTsPath = path.join(frontendContractsDir, "addresses.ts");
  fs.copyFileSync(tsFilePath, frontendTsPath);
  console.log(`Contract addresses copied to frontend: ${frontendTsPath}`);

  // Copy the ABI file to frontend contracts directory
  const frontendAbiPath = path.join(frontendContractsDir, `${network.name}-abi.json`);
  fs.copyFileSync(abiFilePath, frontendAbiPath);
  console.log(`Contract ABI copied to frontend: ${frontendAbiPath}`);

  console.log("");

  // Test the deployed contract
  console.log("Testing deployed contract...");
  try {
    const flipenInstance = await ethers.getContractAt(
      "Flipen",
      proxyAddress,
      deployer
    );
    
    const version = await flipenInstance.version();
    console.log("Contract version:", version);
    
    const owner = await flipenInstance.owner();
    console.log("Contract owner:", owner);
    
    console.log("✅ Contract deployment and testing successful!");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("⚠️  Contract testing failed:", errorMessage);
    console.log("But deployment was successful. Proxy address:", proxyAddress);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });