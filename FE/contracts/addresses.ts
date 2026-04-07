// Auto-generated file - Do not edit manually
// Generated on: 2026-04-07T13:09:10.486Z

export const contractAddresses: any = {
  "sepolia": {
    "proxyAddress": "0x5D193eA6E49cC73ae0F3914aD2315789190e5761",
    "implementationAddress": "0xFb43727Bf210ad7Cd6463A469Dfd3260d4e283F8",
    "deployedAt": "2026-04-03T05:47:08.117Z",
    "deployer": "0x8a371e00cd51E2BE005B86EF73C5Ee9Ef6d23FeB",
    "messengerAddress": "0x1824F5b2b32b059Ba600a0AaD38482Bd5b775CE9",
    "messengerImplementationAddress": "0x8ea76267c2eAD25223B2b2CefEdF5F34D081Dc1A",
    "lastUpgradedAt": "2026-04-07T13:08:37.210Z"
  },
  "celo": {
    "proxyAddress": "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb",
    "implementationAddress": "0x864F1f9B3945a6d6d375D8194E1D1F4ab2875E21",
    "deployedAt": "2026-04-03T05:47:21.729Z",
    "deployer": "0x8a371e00cd51E2BE005B86EF73C5Ee9Ef6d23FeB",
    "messengerAddress": "0x9a82055d6C4Ad4C33734A22DbCD43FD8aE4bE097",
    "messengerImplementationAddress": "0x664431647b4Bff1bB0626bF77961ca17e233e28A",
    "lastUpgradedAt": "2026-04-07T13:09:10.486Z"
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
