// Auto-generated file - Do not edit manually
// Generated on: 2026-04-03T05:47:21.729Z

export const contractAddresses: any = {
  sepolia: {
    proxyAddress: "0x5D193eA6E49cC73ae0F3914aD2315789190e5761",
    implementationAddress: "0x3e913D754d03686786229b4b662231762B804218",
    deployedAt: "2026-04-03T05:47:08.117Z",
    deployer: "0x8a371e00cd51E2BE005B86EF73C5Ee9Ef6d23FeB",
  },
  celo: {
    proxyAddress: "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb",
    implementationAddress: "0xaC0B80c952A4BDe99Ce9c917A75A2f074f8Dd52f",
    deployedAt: "2026-04-03T05:47:21.729Z",
    deployer: "0x8a371e00cd51E2BE005B86EF73C5Ee9Ef6d23FeB",
  },
};

// Helpers for specific network access
export const getContractAddress = (networkName: string) => {
  return (
    contractAddresses[networkName]?.proxyAddress ||
    contractAddresses["sepolia"]?.proxyAddress
  );
};

// Map chain IDs to contract addresses
export const FLIPEN_ADDRESSES: Record<number, `0x${string}`> = {
  42220: "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb" as `0x${string}`,
  11142220: "0x5D193eA6E49cC73ae0F3914aD2315789190e5761" as `0x${string}`,
};
