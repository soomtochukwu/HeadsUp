"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { Copy, Users, Coins, ArrowRightLeft, Loader2, Sparkles, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { FLIPEN_ADDRESSES } from "@/contracts/addresses";
import MAINNET_ABI from "@/contracts/celo-abi.json";
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json";

export default function ReferralsPage() {
  const { address, chainId } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const publicClient = usePublicClient();

  useEffect(() => setMounted(true), []);

  const activeChainId = chainId || 42220;
  const proxyAddress = FLIPEN_ADDRESSES[activeChainId];
  const contractABI = activeChainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI;

  const { data: celoEarningsRaw, refetch: refetchCelo } = useReadContract({
    address: proxyAddress,
    abi: contractABI as any,
    functionName: "referralEarningsCELO",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!proxyAddress }
  });

  const { data: cusdEarningsRaw, refetch: refetchCusd } = useReadContract({
    address: proxyAddress,
    abi: contractABI as any,
    functionName: "referralEarningsCUSD",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!proxyAddress }
  });

  const { data: totalRefereesRaw } = useReadContract({
    address: proxyAddress,
    abi: contractABI as any,
    functionName: "refereeCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!proxyAddress }
  });

  const { writeContractAsync } = useWriteContract();

  const celoEarnings = celoEarningsRaw ? Number(formatUnits(celoEarningsRaw as bigint, 18)) : 0;
  const cusdEarnings = cusdEarningsRaw ? Number(formatUnits(cusdEarningsRaw as bigint, 18)) : 0;
  const totalReferees = totalRefereesRaw ? Number(totalRefereesRaw as bigint) : 0;
  const totalEarnings = celoEarnings + cusdEarnings;

  const referralLink = mounted && address 
    ? `${window.location.origin}/?ref=${address}`
    : "";

  const copyToClipboard = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied to clipboard!");
  };

  const handleClaim = async () => {
    if (!address || !proxyAddress || !publicClient) return;
    if (totalEarnings === 0) {
      toast.error("No rewards available to claim.");
      return;
    }

    try {
      setIsClaiming(true);
      toast.info("Claiming referral rewards...");
      
      const hash = await writeContractAsync({
        address: proxyAddress,
        abi: contractABI as any,
        functionName: "claimReferralRewards",
      });

      await publicClient.waitForTransactionReceipt({ hash });
      
      toast.success("Rewards claimed successfully!");
      refetchCelo();
      refetchCusd();
    } catch (error: any) {
      console.error(error);
      const msg = error.shortMessage || "Failed to claim rewards.";
      toast.error(msg);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="container max-w-4xl mx-auto py-8 lg:py-12 px-4">
      <div className="flex flex-col items-center text-center space-y-4 mb-12">
        <div className="p-3 bg-gold/10 rounded-full border border-gold/30">
          <Gift className="w-8 h-8 text-gold" />
        </div>
        <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-gold to-yellow-700">
          Invite & Earn
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Share your referral link and earn a guaranteed **1% revenue share** on every single bet your friends make. Forever.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur border-gold/20 flex flex-col">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="w-5 h-5 text-gold" /> Your Link
            </CardTitle>
            <CardDescription>Share this link to bind players to your wallet.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center space-y-4">
            {!address ? (
              <div className="text-center p-6 bg-muted/30 rounded-lg border border-dashed border-muted">
                <p className="text-muted-foreground font-medium">Connect your wallet to generate a link.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-black/40 border border-gold/30 rounded-lg break-all font-mono text-sm text-gold/90 text-center">
                  {referralLink}
                </div>
                <Button 
                  onClick={copyToClipboard} 
                  className="w-full bg-gold hover:bg-gold-dark text-black font-bold h-12"
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-gold/20 flex flex-col">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coins className="w-5 h-5 text-gold" /> Your Earnings
            </CardTitle>
            <CardDescription>Available rewards from your active network.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-muted/20 rounded-lg border border-white/5">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">CELO</div>
                <div className="text-3xl font-black text-white">{celoEarnings.toFixed(4)}</div>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-white/5">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">cUSD</div>
                <div className="text-3xl font-black text-green-400">{cusdEarnings.toFixed(2)}</div>
              </div>
            </div>
            <div className="p-3 bg-gold/5 border border-gold/10 rounded-lg text-center">
              <div className="text-[10px] font-bold text-gold/60 uppercase tracking-[0.2em] mb-1">Total Friends Invited</div>
              <div className="text-2xl font-black text-gold">{totalReferees}</div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              disabled={!address || totalEarnings === 0 || isClaiming}
              onClick={handleClaim}
              className="w-full h-14 text-lg font-black bg-gradient-to-r from-green-500 to-emerald-700 hover:from-green-400 hover:to-emerald-600 text-white shadow-lg border border-green-400/30"
            >
              {isClaiming ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" /> CLAIM REWARDS
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground space-y-2">
        <p className="font-bold text-white/70 uppercase tracking-widest">How it Works</p>
        <p>1. A player clicks your link and places their first bet.</p>
        <p>2. They are permanently bound to your wallet address.</p>
        <p>3. You automatically accrue 1% of their bet volume in the token they use (CELO or cUSD).</p>
      </div>
    </div>
  );
}