"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/header"
import { GameInterface } from "@/components/game-interface"
import { StatsPanel } from "@/components/stats-panel"
import { AnimatedBackground } from "@/components/animated-background"
import { CommentsSidebar } from "@/components/comments-sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { useAccount, useBalance, useReadContract } from "wagmi"
import { formatUnits } from "viem"
import { TOKEN_ADDRESSES } from "@/contracts/addresses"

const MINIMAL_ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

export default function GamePage() {
  const [selectedAsset, setSelectedAsset] = useState("CELO")
  const [isCommentsSidebarOpen, setIsCommentsSidebarOpen] = useState(false)
  const { address, isConnected, chainId } = useAccount()

  // Native CELO Balance
  const { data: celoBalance } = useBalance({
    address: address,
    query: { enabled: !!address, refetchInterval: 5000 }
  })

  // Selected Token Address
  const activeChainId = chainId || 42220
  const tokenAddress = TOKEN_ADDRESSES[activeChainId]?.[selectedAsset]

  // ERC20 Balance
  const { data: tokenBalanceRaw } = useReadContract({
    address: tokenAddress,
    abi: MINIMAL_ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress, refetchInterval: 5000 }
  })

  // Log for debugging
  useEffect(() => {
    if (isConnected) {
      console.log("Flipen Debug - Connected Address:", address);
      console.log("Flipen Debug - Chain ID:", chainId);
      console.log("Flipen Debug - CELO Balance Object:", celoBalance);
      console.log("Flipen Debug - Selected Asset:", selectedAsset);
      console.log("Flipen Debug - Token Balance Raw:", tokenBalanceRaw);
    }
  }, [isConnected, address, chainId, celoBalance, selectedAsset, tokenBalanceRaw]);

  const balance = useMemo(() => {
    try {
      if (selectedAsset === "CELO") {
        if (!celoBalance) return "0.0000"
        const num = parseFloat(formatUnits(celoBalance.value, celoBalance.decimals))
        return isNaN(num) ? "0.0000" : num.toFixed(4)
      } else {
        if (tokenBalanceRaw === undefined || tokenBalanceRaw === null) return "0.0000"
        const num = parseFloat(formatUnits(tokenBalanceRaw as bigint, 18))
        return isNaN(num) ? "0.0000" : num.toFixed(4)
      }
    } catch (error) {
      console.error("Balance Format Error:", error)
      return "0.0000"
    }
  }, [selectedAsset, celoBalance, tokenBalanceRaw])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="golden-flip-theme">
      <div className="min-h-screen md:h-screen bg-gradient-to-br from-background via-muted/20 to-background text-foreground relative md:overflow-hidden transition-colors duration-300 flex flex-col h-[100dvh]">
        <AnimatedBackground />
        <CommentsSidebar isOpen={isCommentsSidebarOpen} setIsOpen={setIsCommentsSidebarOpen} isWalletConnected={isConnected} walletAddress={address || ""} />
        <div className="relative z-10 flex flex-col min-h-screen md:h-full">
          <div className="flex-shrink-0">
            <Header balance={balance} setIsCommentsSidebarOpen={setIsCommentsSidebarOpen} selectedAsset={selectedAsset} />
          </div>
          <main className="flex-1 container mx-auto px-3 sm:px-2 sm:px-4 py-2 sm:py-1 sm:py-2 md:overflow-hidden">
            <div className="min-h-0 md:h-full flex flex-col">
              <div className="flex-1 flex flex-col lg:grid lg:grid-cols-4 gap-3 sm:gap-2 sm:gap-3 md:gap-4 md:min-h-0">
                <div className="flex-1 lg:col-span-3 md:min-h-0 order-1">
                  <GameInterface selectedAsset={selectedAsset} setSelectedAsset={setSelectedAsset} />
                </div>
                <div className="flex-shrink-0 lg:col-span-1 md:min-h-0 order-2 lg:order-2">
                  <StatsPanel selectedAsset={selectedAsset} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}
