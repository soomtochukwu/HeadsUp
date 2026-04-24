// Auto-generated file - Do not edit manually
// Generated on: 2026-04-24T12:10:27.094Z

export const contractAddresses: any = {
  "sepolia": {
    "proxyAddress": "0x5D193eA6E49cC73ae0F3914aD2315789190e5761",
    "implementationAddress": "0x07B7f38644e44cB1BddAd633C424993347d9f023",
    "deployedAt": "2026-04-03T05:47:08.117Z",
    "deployer": "0x8a371e00cd51E2BE005B86EF73C5Ee9Ef6d23FeB",
    "messengerAddress": "0x1824F5b2b32b059Ba600a0AaD38482Bd5b775CE9",
    "messengerImplementationAddress": "0x8ea76267c2eAD25223B2b2CefEdF5F34D081Dc1A",
    "lastUpgradedAt": "2026-04-24T12:09:59.039Z"
  },
  "celo": {
    "proxyAddress": "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb",
    "implementationAddress": "0x50D8fF07334495ba09b4Ac14995Dd2D50a4bB8f1",
    "deployedAt": "2026-04-03T05:47:21.729Z",
    "deployer": "0x8a371e00cd51E2BE005B86EF73C5Ee9Ef6d23FeB",
    "messengerAddress": "0x9a82055d6C4Ad4C33734A22DbCD43FD8aE4bE097",
    "messengerImplementationAddress": "0x664431647b4Bff1bB0626bF77961ca17e233e28A",
    "lastUpgradedAt": "2026-04-24T12:10:27.094Z"
  }
};

export const getContractAddress = (networkName: string) => {
  return contractAddresses[networkName]?.proxyAddress || contractAddresses['sepolia']?.proxyAddress;
};

export const FLIPEN_ADDRESSES: Record<number, `0x${string}`> = {
  42220: "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb" as `0x${string}`,
  11142220: "0x5D193eA6E49cC73ae0F3914aD2315789190e5761" as `0x${string}`,
};

export const MESSENGER_ADDRESSES: Record<number, `0x${string}`> = {
  42220: "0x9a82055d6C4Ad4C33734A22DbCD43FD8aE4bE097" as `0x${string}`,
  11142220: "0x1824F5b2b32b059Ba600a0AaD38482Bd5b775CE9" as `0x${string}`,
};

export const TOKEN_ADDRESSES: Record<number, Record<string, `0x${string}`>> = {
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
