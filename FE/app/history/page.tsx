"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { GameHistory } from "@/components/game-history"
import { CommentsSidebar } from "@/components/comments-sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { useAccount, useBalance } from "wagmi"
import { formatUnits } from "viem"

export default function HistoryPage() {
  const [selectedNetwork, setSelectedNetwork] = useState("celo")
  const [chainID, setChainID] = useState<number>()
  const { address, isConnected } = useAccount()
  const balanceResult = useBalance({
    address: address,
    chainId: chainID,
  })
  const _balance = balanceResult.data ? formatUnits(balanceResult.data.value, balanceResult.data.decimals) : "0"
  const [balance, setBalance] = useState(String(Number(_balance).toFixed(5)))
  const [isCommentsSidebarOpen, setIsCommentsSidebarOpen] = useState(false)

  return (
    <ThemeProvider defaultTheme="dark" storageKey="golden-flip-theme">
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
                Game History
              </h1>
              <GameHistory />
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}