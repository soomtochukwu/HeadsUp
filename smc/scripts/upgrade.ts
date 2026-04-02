import { ethers, upgrades, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import fs from "fs";
import path from "path";

// Import existing addresses dynamically based on current network
let contractAddresses: any = null;
try {
  const addressesPath = path.join(
    __dirname,
    `../addresses/${network.name}-addresses.ts`
  );
  if (fs.existsSync(addressesPath)) {
    contractAddresses = require(addressesPath).contractAddresses;
    console.log(`Loaded addresses for network: ${network.name}`);
  } else {
    console.log(`No addresses file found for network: ${network.name}`);
    console.log(`Expected file: ${addressesPath}`);
  }
} catch (error) {
  console.log(
    `Warning: Could not load existing addresses for ${network.name}, will check for deployment`
  );
  contractAddresses = null;
}

async function upgradeContract() {
  const [deployer]: HardhatEthersSigner[] = await ethers.getSigners();
  console.log("Upgrading contracts with the account:", deployer.address);
  console.log("Network:", network.name);
  console.log(
    "Account balance:",
    (await deployer.provider!.getBalance(deployer.address)).toString()
  );
  console.log("");

  // Check if we have existing addresses
  if (!contractAddresses) {
    console.error(
      `❌ No existing contract addresses found for network: ${network.name}!`
    );
    console.error("Please deploy the contract first using the deploy script.");
    console.error(
      `Expected file: ${network.name}-addresses.ts in the addresses directory`
    );
    process.exit(1);
  }

  // Get the existing proxy address
  const proxyAddress = contractAddresses.proxyAddress;
  console.log("Existing Proxy Address:", proxyAddress);
  console.log(
    "Previous Implementation:",
    contractAddresses.implementationAddress
  );
  console.log("");

  // Get the new contract factory
  const FlipenV2 = await ethers.getContractFactory("Flipen");

  console.log("Upgrading Flipen proxy to new implementation...");

  // Upgrade the proxy to the new implementation
  const upgraded = await upgrades.upgradeProxy(proxyAddress, FlipenV2);
  await upgraded.waitForDeployment();

  console.log("Flipen Proxy upgraded successfully!");
  console.log("Proxy Address (unchanged):", proxyAddress);
  console.log("");

  // Get the new implementation address
  const newImplementationAddress =
    await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("New Implementation Address:", newImplementationAddress);
  console.log("");

  // Update contract addresses
  const updatedContractAddresses = {
    proxyAddress: proxyAddress,
    implementationAddress: newImplementationAddress,
    network: network.name,
    deployedAt: contractAddresses.deployedAt,
    deployer: deployer.address,
    previousImplementation: contractAddresses.implementationAddress,
    upgradedAt: new Date().toISOString(),
  };

  // Create the addresses directory if it doesn't exist
  const addressesDir = path.join(__dirname, "../addresses");
  if (!fs.existsSync(addressesDir)) {
    fs.mkdirSync(addressesDir, { recursive: true });
  }

  // Generate updated TypeScript file content
  const tsContent = `// Auto-generated file - Do not edit manually
// Generated on: ${new Date().toISOString()}
// Network: ${network.name}
// Upgraded from: ${contractAddresses.implementationAddress}

export interface ContractAddresses {
  proxyAddress: string;
  implementationAddress: string;
  network: string;
  deployedAt: string;
  deployer: string;
  previousImplementation?: string;
  upgradedAt?: string;
}

export const contractAddresses: ContractAddresses = {
  proxyAddress: "${proxyAddress}",
  implementationAddress: "${newImplementationAddress}",
  network: "${network.name}",
  deployedAt: "${contractAddresses.deployedAt}",
  deployer: "${deployer.address}",
  previousImplementation: "${contractAddresses.implementationAddress}",
  upgradedAt: "${new Date().toISOString()}"
};

// Export individual addresses for convenience
export const FLIPEN_PROXY_ADDRESS = "${proxyAddress}";
export const FLIPEN_IMPLEMENTATION_ADDRESS = "${newImplementationAddress}";

export default contractAddresses;
`;

  // Write to TypeScript file
  const tsFilePath = path.join(addressesDir, `${network.name}-addresses.ts`);
  fs.writeFileSync(tsFilePath, tsContent);
  console.log(`Updated contract addresses saved to: ${tsFilePath}`);

  // Also save as JSON for backup
  const jsonFilePath = path.join(
    addressesDir,
    `${network.name}-addresses.json`
  );
  fs.writeFileSync(
    jsonFilePath,
    JSON.stringify(updatedContractAddresses, null, 2)
  );
  console.log(
    `Updated contract addresses also saved as JSON to: ${jsonFilePath}`
  );

  // Extract and save updated contract ABI
  const contractABI = FlipenV2.interface.formatJson();
  const abiFilePath = path.join(
    addressesDir,
    `${network.name}-abi.json`
  );
  fs.writeFileSync(abiFilePath, contractABI);
  console.log(`Updated contract ABI saved to: ${abiFilePath}`);

  // Copy the TypeScript file to frontend contracts directory
  const frontendContractsDir = path.join(__dirname, "../../FE/contracts");
  
  // Create the frontend contracts directory if it doesn't exist
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
    console.log(`Created frontend contracts directory: ${frontendContractsDir}`);
  }
  
  const frontendTsPath = path.join(frontendContractsDir, "addresses.ts");
  fs.copyFileSync(tsFilePath, frontendTsPath);
  console.log(
    `Updated contract addresses copied to frontend: ${frontendTsPath}`
  );

  // Copy the updated ABI file to frontend contracts directory
  const frontendAbiPath = path.join(frontendContractsDir, `${network.name}-abi.json`);
  fs.copyFileSync(abiFilePath, frontendAbiPath);
  console.log(`Updated contract ABI copied to frontend: ${frontendAbiPath}`);

  console.log("");
  console.log("✅ Upgrade completed successfully!");
  console.log("📝 The proxy contract now uses the new implementation");
  console.log("🔗 Proxy Address (unchanged):", proxyAddress);
  console.log("🆕 New Implementation:", newImplementationAddress);
}

upgradeContract().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});