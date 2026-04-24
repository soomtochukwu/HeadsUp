import { NextResponse } from "next/server";
import { createPublicClient, http, defineChain } from "viem";
import { FLIPEN_ADDRESSES } from "@/contracts/addresses";
import MAINNET_ABI from "@/contracts/celo-abi.json";
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json";

const celo = defineChain({
  id: 42220,
  name: "Celo",
  network: "celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
});

const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  network: "celo-sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] } },
});

const CHAINS: Record<number, any> = {
  42220: celo,
  11142220: celoSepolia,
};

export async function POST(req: Request) {
  try {
    const { gameId, chainId } = await req.json();

    if (!gameId || !chainId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const chain = CHAINS[chainId];
    if (!chain) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
    }

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const proxyAddress = FLIPEN_ADDRESSES[chainId as keyof typeof FLIPEN_ADDRESSES];
    const abi = chainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI;

    const gameDetails = await client.readContract({
      address: proxyAddress,
      abi: abi as any,
      functionName: "getGameDetails",
      args: [BigInt(gameId)],
    }) as any;

    // Determine if action is required
    const currentBlock = await client.getBlockNumber();
    const canResolve = currentBlock > BigInt(gameDetails.commitBlock) && gameDetails.status === 0; // 0 = PENDING
    const isExpired = currentBlock > BigInt(gameDetails.commitBlock) + BigInt(250) && gameDetails.status === 0;

    return NextResponse.json({
      success: true,
      status: gameDetails.status, // 0: PENDING, 1: FULFILLED, 2: CANCELLED, 3: EXPIRED
      canResolve,
      isExpired,
      player: gameDetails.player
    });

  } catch (error: any) {
    console.error("[CHECK-GAME ERROR]:", error);
    return NextResponse.json({ error: error.message || "Failed to check game status" }, { status: 500 });
  }
}
