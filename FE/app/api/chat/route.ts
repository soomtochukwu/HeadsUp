import { NextResponse } from "next/server";
import { createWalletClient, http, defineChain, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MESSENGER_ADDRESSES } from "@/contracts/addresses";
import MESSENGER_ABI from "@/contracts/messenger-abi.json";

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
    const { userAddress, content, signature, chainId } = await req.json();

    if (!userAddress || !content || !signature || !chainId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    let privateKey = process.env.ONLINE_PRIVATE_KEY as string;
    if (!privateKey) {
      return NextResponse.json({ error: "Relayer private key not configured" }, { status: 500 });
    }
    
    if (!privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }

    // Initialize the Admin/Deployer Wallet
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const chain = CHAINS[chainId];
    if (!chain) {
      return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
    }

    const client = createWalletClient({
      account,
      chain,
      transport: http(),
    }).extend(publicActions);

    const proxyAddress = MESSENGER_ADDRESSES[chainId as 42220 | 11142220];

    // Submit the transaction on behalf of the user, paying the gas fee
    const hash = await client.writeContract({
      address: proxyAddress,
      abi: MESSENGER_ABI as any,
      functionName: "postMessageFor",
      args: [userAddress, content, signature],
      chain,
      account,
    });

    return NextResponse.json({ success: true, hash });
  } catch (error: any) {
    console.error("[RELAYER ERROR]:", error);
    return NextResponse.json({ error: error.shortMessage || error.message || "Relay failed" }, { status: 500 });
  }
}
