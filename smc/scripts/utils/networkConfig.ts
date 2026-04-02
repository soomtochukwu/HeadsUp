export interface NetworkConfig {
  vrfCoordinator: string;
  keyHash: string;
  name: string;
  vrfFee: string; // Fee for direct funding (legacy)
}

export const networkConfigs: Record<string, NetworkConfig> = {
  localhost: {
    vrfCoordinator: "0x5CE8D5A2BC84beb22a398CCA51996F7930313D61", // Sepolia mock
    keyHash: "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be",
    vrfFee: "0.01",
    name: "Localhost"
  },
  hardhat: {
    vrfCoordinator: "0x5CE8D5A2BC84beb22a398CCA51996F7930313D61", // Sepolia mock
    keyHash: "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be",
    vrfFee: "0.01",
    name: "Hardhat"
  },
  sepolia: {
    vrfCoordinator: process.env.VRF_COORDINATOR_SEPOLIA || "0x5CE8D5A2BC84beb22a398CCA51996F7930313D61",
    keyHash: process.env.VRF_KEY_HASH_SEPOLIA || "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be",
    vrfFee: process.env.VRF_FEE_SEPOLIA || "0.1",
    name: "Celo Sepolia Testnet"
  },
  celo: {
    vrfCoordinator: process.env.VRF_COORDINATOR_CELO || "0x56449d011824C867D7028401349982f465823677",
    keyHash: process.env.VRF_KEY_HASH_CELO || "0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4",
    vrfFee: process.env.VRF_FEE_CELO || "0.1",
    name: "Celo Mainnet"
  }
};

export function getNetworkConfig(networkName: string): NetworkConfig {
  const config = networkConfigs[networkName];
  if (!config) {
    throw new Error(`Network configuration not found for: ${networkName}`);
  }
  return config;
}
