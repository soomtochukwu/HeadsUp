import { ethers, upgrades, network } from "hardhat";
import { formatUnits } from "ethers";
import fs from "fs";
import path from "path";

const PROXY_ADDRESS = "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb";

const TOKEN_ADDRESSES = {
  "USDC": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  "USDT": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
};

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  console.log("=== STARTING UPGRADE, LOCK CLEARANCE & SWEEP ===");
  console.log(`Network: ${network.name}`);
  console.log(`Proxy Contract Address: ${PROXY_ADDRESS}`);

  const [admin] = await ethers.getSigners();
  console.log(`Admin/Owner Address: ${admin.address}`);

  // 1. Upgrade the Smart Contract to the new version with emergencyClearLockedFunds
  console.log("\n[1] Upgrading smart contract implementation...");
  const Flipen = await ethers.getContractFactory("Flipen");
  
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, Flipen);
  await upgraded.waitForDeployment();

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log(`Contract upgraded! New Implementation: ${implementationAddress}`);

  // 2. Synchronize frontend ABI and addresses
  console.log("\n[2] Syncing new implementation with frontend...");
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

  if (!currentAddresses[network.name]) {
    currentAddresses[network.name] = { proxyAddress: PROXY_ADDRESS };
  }
  currentAddresses[network.name].implementationAddress = implementationAddress;
  currentAddresses[network.name].lastUpgradedAt = new Date().toISOString();

  // Generate updated TypeScript addresses file
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

export const TOKEN_ADDRESSES: Record<number, Record<string, \`0x\${string}\`>> = {
  42220: {
    "USDm": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    "cUSD": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    "USDC": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    "USDT": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  },
  11142220: {
    "USDm": "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
    "cUSD": "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
    "USDC": "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    "USDT": "0xd077A400968890Eacc75cdc901F0356c943e4fDb",
  }
};

export const getTokenSymbol = (chainId: number, address: string): string => {
  if (!address || address === "0x0000000000000000000000000000000000000000") return "CELO";
  const chainTokens = TOKEN_ADDRESSES[chainId];
  if (!chainTokens) return "TOKEN";
  
  for (const [symbol, addr] of Object.entries(chainTokens)) {
    if (addr.toLowerCase() === address.toLowerCase()) {
      return symbol === "cUSD" ? "USDm" : symbol;
    }
  }
  return "ERC20";
};

/**
 * Fee currency adapters for MiniPay fee abstraction.
 * Tokens with adapters (e.g. USDC, USDT with 6 decimals) use the adapter address as feeCurrency.
 * Tokens without adapters (e.g. USDm with 18 decimals) use their own token address as feeCurrency.
 * See: https://docs.minipay.xyz/technical-references/send-transaction.html
 */
export const FEE_CURRENCY_ADAPTERS: Record<number, Record<string, \`0x\${string}\` | null>> = {
  42220: {
    "USDm": null,   // 18 decimals – use token address directly
    "cUSD": null,    // 18 decimals – use token address directly
    "USDC": "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",  // 6 decimals – needs adapter
    "USDT": "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72",  // 6 decimals – needs adapter
  },
  11142220: {
    "USDm": null,   // 18 decimals – use token address directly
    "cUSD": null,    // 18 decimals – use token address directly
    "USDC": "0x4822e58de6f5e485eF90df51C41CE01721331dC0",  // 6 decimals – needs adapter
    "USDT": null,    // testnet USDT is 18 decimals
  }
};

/**
 * Get the feeCurrency value to use for a given token on a given chain.
 * Returns the adapter address if one exists, otherwise the token address itself.
 */
export const getFeeCurrency = (chainId: number, symbol: string): \`0x\${string}\` | undefined => {
  const adapters = FEE_CURRENCY_ADAPTERS[chainId];
  const tokens = TOKEN_ADDRESSES[chainId];
  if (!adapters || !tokens) return undefined;

  const adapter = adapters[symbol];
  if (adapter) return adapter;             // Use adapter address
  const tokenAddr = tokens[symbol];
  if (tokenAddr) return tokenAddr;         // Use token address directly
  return undefined;
};
`;

  fs.writeFileSync(frontendTsPath, tsContent);
  console.log(`Frontend addresses synced to: ${frontendTsPath}`);

  // Update ABI
  const abiFilePath = path.join(frontendContractsDir, `${network.name}-abi.json`);
  fs.writeFileSync(abiFilePath, Flipen.interface.formatJson());
  console.log(`Contract ABI updated in frontend: ${abiFilePath}`);

  // 3. Clear locked mapping balances
  console.log("\n[3] Clearing locked funds mapping for USDC and USDT...");
  const contract = Flipen.attach(PROXY_ADDRESS) as any;

  for (const [symbol, tokenAddr] of Object.entries(TOKEN_ADDRESSES)) {
    console.log(`Clearing lock for ${symbol} (${tokenAddr})...`);
    const tx = await contract.emergencyClearLockedFunds(tokenAddr);
    await tx.wait();
    console.log(`Lock cleared for ${symbol}!`);

    // Verify lock is indeed 0 on-chain
    const lockedAmount = await contract.lockedFundsToken(tokenAddr);
    console.log(`On-chain locked amount for ${symbol} is now: ${lockedAmount.toString()}`);
  }

  // 4. Sweep remaining bankroll
  console.log("\n[4] Sweeping remaining balances to admin wallet...");
  for (const [symbol, tokenAddr] of Object.entries(TOKEN_ADDRESSES)) {
    const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, admin);
    const decimals = await tokenContract.decimals();
    const balance = await tokenContract.balanceOf(PROXY_ADDRESS);
    
    console.log(`Contract ${symbol} balance: ${formatUnits(balance, decimals)}`);

    if (balance > 0n) {
      console.log(`Withdrawing ${formatUnits(balance, decimals)} ${symbol} to admin...`);
      const tx = await contract.withdrawToken(tokenAddr, balance, false, 0);
      await tx.wait();
      console.log(`${symbol} swept successfully to ${admin.address}!`);
    } else {
      console.log(`No balance left for ${symbol} to sweep.`);
    }
  }

  console.log("\n=== ALL STABLECOINS LIBERATED AND SWEPT SUCCESSFULLY ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
