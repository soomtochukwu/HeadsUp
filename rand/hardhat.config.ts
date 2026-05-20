import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../smc/.env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const PRIVATE_KEYS = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(',').map(k => k.trim()) : [];

// Combine legacy PRIVATE_KEY with new array of PRIVATE_KEYS
const allKeys = [...new Set([...PRIVATE_KEYS, ...(PRIVATE_KEY ? [PRIVATE_KEY] : [])])];

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    celo: {
      url: "https://forno.celo.org",
      accounts: allKeys.length > 0 ? allKeys : [],
    },
  },
  paths: {
    artifacts: "../smc/artifacts",
  }
};

export default config;
