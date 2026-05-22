"use client"

import { useMemo, useState } from "react"
import { Header } from "@/components/header"
import { Leaderboard } from "@/components/leaderboard"
import { CommentsSidebar } from "@/components/comments-sidebar"

import { useAccount, useBalance } from "wagmi"
import { formatUnits } from "viem"

export default function LeaderboardPage() {
  const { address, isConnected, chainId } = useAccount()
  const balanceResult = useBalance({
    address: address,
    chainId: chainId,
  })
  
  const balance = useMemo(() => {
    if (!balanceResult.data) return "0.0000"
    return Number(formatUnits(balanceResult.data.value, balanceResult.data.decimals)).toFixed(4)
  }, [balanceResult.data])
  const [isCommentsSidebarOpen, setIsCommentsSidebarOpen] = useState(false)

  return (
    
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background text-foreground relative transition-colors duration-300 flex flex-col">

        <CommentsSidebar
          isOpen={isCommentsSidebarOpen}
          setIsOpen={setIsCommentsSidebarOpen}
          isWalletConnected={isConnected}
          walletAddress={address || ""}
        />

        <div className="relative z-10 flex flex-col min-h-screen">
          <div className="flex-shrink-0">
            <Header
              balance={balance}
              setIsCommentsSidebarOpen={setIsCommentsSidebarOpen}
              selectedAsset="CELO"
            />
          </div>

          <main className="flex-1 container mx-auto px-3 sm:px-4 py-4">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                Leaderboard
              </h1>
              <Leaderboard />
            </div>
          </main>
        </div>
      </div>
    
  )
}