"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { AnimatedBackground } from "@/components/animated-background"
import { CommentsSidebar } from "@/components/comments-sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { useAccount, useBalance } from "wagmi"

export default function AboutPage() {
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState("celo")
  const [chainID, setChainID] = useState<number>()
  const { address } = useAccount()
  const _balance = useBalance({
    address: address,
    chainId: chainID,
    token: undefined,
  }).data?.formatted
  const [balance, setBalance] = useState(String(Number(_balance).toFixed(5)))
  const [walletAddress, setWalletAddress] = useState("")
  const [isCommentsSidebarOpen, setIsCommentsSidebarOpen] = useState(false)

  return (
    <ThemeProvider defaultTheme="dark" storageKey="golden-flip-theme">
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background text-foreground relative transition-colors duration-300 flex flex-col">
        <AnimatedBackground />

        <CommentsSidebar
          isOpen={isCommentsSidebarOpen}
          setIsOpen={setIsCommentsSidebarOpen}
          isWalletConnected={isWalletConnected}
          walletAddress={walletAddress}
        />
        
        <div className="relative z-10 flex flex-col min-h-screen">
          <div className="flex-shrink-0">
            <Header
              isWalletConnected={isWalletConnected}
              setIsWalletConnected={setIsWalletConnected}
              selectedNetwork={selectedNetwork}
              setSelectedNetwork={setSelectedNetwork}
              setChainID={setChainID}
              balance={balance}
              walletAddress={walletAddress}
              setWalletAddress={setWalletAddress}
              setIsCommentsSidebarOpen={setIsCommentsSidebarOpen}
            />
          </div>

          <main className="flex-1 container mx-auto px-3 sm:px-4 py-4">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                About Flipen
              </h1>
              <div className="bg-card/50 backdrop-blur-sm border border-gold rounded-2xl p-6">
                <div className="space-y-4 text-muted-foreground">
                  <p className="text-lg">
                    Flipen is the most trusted Web3 coin flip platform, offering provably fair 50/50 games across
                    multiple EVM networks with golden opportunities for every player.
                  </p>
                  <h3 className="text-xl font-semibold text-foreground">Key Features:</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Provably fair gaming with blockchain transparency</li>
                    <li>Support for CELO, cUSD and other Celo ecosystem tokens</li>
                    <li>Multi-chain support: Celo Mainnet and Alfajores Testnet</li>
                    <li>Instant payouts with 1.95x multiplier</li>
                    <li>Professional security and anti-bot protection</li>
                    <li>Community-driven with integrated chat system</li>
                  </ul>
                  <h3 className="text-xl font-semibold text-foreground mt-6">How It Works:</h3>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>Connect your wallet to the Celo network</li>
                    <li>Choose your bet amount and select Heads or Tails</li>
                    <li>Click \"FLIP COIN\" to start the game</li>
                    <li>Watch the coin flip animation</li>
                    <li>Win 1.95x your bet if you guess correctly!</li>
                  </ol>
                  <div className="mt-8 p-4 bg-gold/10 border border-gold rounded-lg">
                    <h4 className="font-semibold text-gold mb-2">🎯 Fair Play Guarantee</h4>
                    <p className="text-sm">
                      All games are provably fair using blockchain technology. Every flip result is verifiable and cannot be manipulated.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}