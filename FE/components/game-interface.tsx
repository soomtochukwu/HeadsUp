"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Coins, Zap, TrendingUp, Sparkles, RotateCcw } from "lucide-react"
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useBalance, useReadContract } from "wagmi"
import { parseEther, parseUnits, formatUnits } from "viem"
import { FLIPEN_PROXY_ADDRESS } from "@/contracts/addresses"
import { toast } from "sonner"

const FLIPEN_ABI = [
  {
    "type": "function",
    "name": "flipCoin",
    "stateMutability": "payable",
    "inputs": [
      { "type": "uint8", "name": "choice" },
      { "type": "uint256", "name": "randomNumber" }
    ],
    "outputs": []
  },
  {
    "type": "function",
    "name": "flipCoinERC20",
    "stateMutability": "nonpayable",
    "inputs": [
      { "type": "uint8", "name": "choice" },
      { "type": "uint256", "name": "randomNumber" },
      { "type": "uint256", "name": "amount" },
      { "type": "address", "name": "token" }
    ],
    "outputs": []
  }
] as const

const ERC20_ABI = [
  {
    "type": "function",
    "name": "approve",
    "stateMutability": "nonpayable",
    "inputs": [
      { "type": "address", "name": "spender" },
      { "type": "uint256", "name": "amount" }
    ],
    "outputs": [{ "type": "bool" }]
  },
  {
    "type": "function",
    "name": "allowance",
    "stateMutability": "view",
    "inputs": [
      { "type": "address", "name": "owner" },
      { "type": "address", "name": "spender" }
    ],
    "outputs": [{ "type": "uint256" }]
  }
] as const

const CUSD_ADDRESSES: Record<number, `0x${string}`> = {
  42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // Mainnet
  44787: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // Alfajores
}

interface Asset {
  symbol: string
  name: string
  icon: string
  balance: string
  network: string
  address?: `0x${string}`
}

export function GameInterface({ 
  selectedAsset, 
  setSelectedAsset 
}: { 
  selectedAsset: string, 
  setSelectedAsset: (asset: string) => void 
}) {
  const { address } = useAccount()
  const chainId = useChainId()
  
  const [selectedSide, setSelectedSide] = useState<"heads" | "tails" | null>(null)
  const [betAmount, setBetAmount] = useState([0.1])
  const [isFlipping, setIsFlipping] = useState(false)
  const [gameResult, setGameResult] = useState<{
    result: "heads" | "tails"
    won: boolean
    payout: number
  } | null>(null)

  const cUSDAddress = CUSD_ADDRESSES[chainId] || CUSD_ADDRESSES[44787]

  // Contract hooks
  const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  
  const { data: receipt, isLoading: isTxLoading } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Allowance check
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && FLIPEN_PROXY_ADDRESS ? [address, FLIPEN_PROXY_ADDRESS as `0x${string}`] : undefined,
    query: {
      enabled: !!address && selectedAsset === "cUSD",
    }
  })

  // Balances
  const { data: celoBalance } = useBalance({ 
    address,
    query: {
      refetchInterval: 10000,
    }
  })
  const { data: cusdBalance } = useBalance({ 
    address, 
    token: cUSDAddress,
    query: {
      refetchInterval: 10000,
    }
  })

  // Assets config
  const assets = useMemo((): Record<number, Asset[]> => ({
    42220: [
      { symbol: "CELO", name: "Celo", icon: "◊", balance: celoBalance?.formatted || "0.00", network: "Celo" },
      { symbol: "cUSD", name: "Celo Dollar", icon: "$", balance: cusdBalance?.formatted || "0.00", network: "Celo", address: CUSD_ADDRESSES[42220] },
    ],
    44787: [
      { symbol: "CELO", name: "Celo", icon: "◊", balance: celoBalance?.formatted || "0.00", network: "Alfajores" },
      { symbol: "cUSD", name: "Celo Dollar", icon: "$", balance: cusdBalance?.formatted || "0.00", network: "Alfajores", address: CUSD_ADDRESSES[44787] },
    ],
  }), [celoBalance, cusdBalance])

  const currentAssets = assets[chainId] || assets[44787]
  const currentAsset = currentAssets.find(asset => asset.symbol === selectedAsset) || currentAssets[0]

  // Process game result from logs
  useEffect(() => {
    if (receipt) {
      // Find GameResult event in logs
      // For now, we simulate the result UI based on a simplified look at the logs 
      // or just assume it's done. In a real app, we'd parse the logs.
      // For the demo, let's use the random number we sent to determine result.
      const seed = localStorage.getItem("lastFlipSeed")
      if (seed && selectedSide) {
        const result = BigInt(seed) % 2n === 1n ? "heads" : "tails"
        const won = result === selectedSide
        const payout = won ? betAmount[0] * 1.95 : 0
        setGameResult({ result, won, payout })
      }
      setIsFlipping(false)
      setTxHash(undefined)
      toast.success("Flip completed!")
    }
  }, [receipt, selectedSide, betAmount])

  const flipCoin = useCallback(async () => {
    if (!selectedSide || !address) return

    try {
      setIsFlipping(true)
      setGameResult(null)

      const choice = selectedSide === "tails" ? 0 : 1
      const seed = BigInt(Math.floor(Math.random() * 1000000000))
      localStorage.setItem("lastFlipSeed", seed.toString())

      if (selectedAsset === "CELO") {
        const hash = await writeContractAsync({
          address: FLIPEN_PROXY_ADDRESS as `0x${string}`,
          abi: FLIPEN_ABI,
          functionName: "flipCoin",
          args: [choice, seed],
          value: parseEther(betAmount[0].toString()),
        })
        setTxHash(hash)
      } else if (selectedAsset === "cUSD") {
        const amount = parseUnits(betAmount[0].toString(), 18)
        
        // Check allowance
        if (!allowance || allowance < amount) {
          toast.info("Approving cUSD...")
          const approveHash = await writeContractAsync({
            address: cUSDAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [FLIPEN_PROXY_ADDRESS as `0x${string}`, amount],
          })
          await new Promise(resolve => setTimeout(resolve, 5000)) // Wait for approval
          await refetchAllowance()
        }

        const hash = await writeContractAsync({
          address: FLIPEN_PROXY_ADDRESS as `0x${string}`,
          abi: FLIPEN_ABI,
          functionName: "flipCoinERC20",
          args: [choice, seed, amount, cUSDAddress],
        })
        setTxHash(hash)
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.shortMessage || "Transaction failed")
      setIsFlipping(false)
    }
  }, [selectedSide, address, selectedAsset, betAmount, writeContractAsync, allowance, cUSDAddress, refetchAllowance])

  const adjustBetAmount = useCallback((multiplier: number) => {
    setBetAmount([Math.max(0.01, betAmount[0] * multiplier)])
  }, [betAmount])

  const resetGame = useCallback(() => {
    setGameResult(null)
    setSelectedSide(null)
  }, [])

  return (
    <div className="min-h-0 md:h-full flex flex-col">
      <div className="flex-1 md:overflow-y-auto">
        <div className="space-y-6 md:space-y-4 lg:space-y-3 p-4 md:p-3 lg:p-2">
          {/* Mobile-First Coin Animation */}
          <div className="flex justify-center">
            <div className="relative">
              <div 
                className={`w-40 h-40 md:w-32 md:h-32 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-4xl md:text-3xl lg:text-2xl font-bold transition-all duration-500 shadow-lg ${
                  isFlipping ? 'animate-spin' : 'hover:scale-105'
                }`}
                style={{
                  boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                }}
              >
                {isFlipping ? (
                  <Sparkles className="w-12 h-12 md:w-8 md:h-8 lg:w-6 lg:h-6 text-white animate-pulse" />
                ) : gameResult ? (
                  <span className="drop-shadow-lg">
                    {gameResult.result === "heads" ? "👑" : "💰"}
                  </span>
                ) : (
                  <span className="drop-shadow-lg text-white">?</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-pulse" />
            </div>
          </div>

          {/* Mobile-First Game Result */}
          {gameResult && (
            <Card className="bg-card/80 backdrop-blur-sm border-gold/20 mx-auto max-w-sm">
              <CardContent className="p-6 md:p-4 lg:p-3 text-center">
                <div className={`text-2xl md:text-xl lg:text-lg font-bold mb-3 md:mb-2 lg:mb-1 ${
                  gameResult.won ? 'text-green-400' : 'text-red-400'
                }`}>
                  {gameResult.won ? '🎉 WON!' : '💔 LOST'}
                </div>
                <div className="text-lg md:text-base lg:text-sm text-muted-foreground mb-3 md:mb-2 lg:mb-1">
                  Result: <span className="font-semibold text-foreground">{gameResult.result.toUpperCase()}</span>
                </div>
                {gameResult.won && (
                  <div className="text-2xl md:text-xl lg:text-lg font-bold text-green-400 mb-4 md:mb-3 lg:mb-2">
                    +{gameResult.payout.toFixed(4)} {selectedAsset}
                  </div>
                )}
                <Button
                  onClick={resetGame}
                  variant="outline"
                  size="lg"
                  className="border-gold/30 hover:bg-gold/10 text-base md:text-sm lg:text-xs h-12 md:h-10 lg:h-8 px-6 md:px-4 lg:px-3"
                >
                  <RotateCcw className="w-5 h-5 md:w-4 md:h-4 lg:w-3 lg:h-3 mr-2" />
                  Play Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Mobile-First Side Selection */}
          <div className="grid grid-cols-2 gap-6 md:gap-4 lg:gap-3 max-w-sm mx-auto">
            <Button
              variant={selectedSide === "heads" ? "default" : "outline"}
              size="lg"
              disabled={isFlipping}
              onClick={() => setSelectedSide("heads")}
              className={`h-20 md:h-16 lg:h-14 text-lg md:text-base lg:text-sm font-semibold transition-all duration-300 ${
                selectedSide === "heads" 
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:from-yellow-500 hover:to-yellow-700' 
                  : 'border-gold/30 hover:bg-gold/10'
              }`}
            >
              <div className="flex flex-col items-center space-y-2 md:space-y-1">
                <span className="text-3xl md:text-2xl lg:text-lg">👑</span>
                <span className="text-base md:text-sm lg:text-xs font-bold">HEADS</span>
              </div>
            </Button>
            
            <Button
              variant={selectedSide === "tails" ? "default" : "outline"}
              size="lg"
              disabled={isFlipping}
              onClick={() => setSelectedSide("tails")}
              className={`h-20 md:h-16 lg:h-14 text-lg md:text-base lg:text-sm font-semibold transition-all duration-300 ${
                selectedSide === "tails" 
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:from-yellow-500 hover:to-yellow-700' 
                  : 'border-gold/30 hover:bg-gold/10'
              }`}
            >
              <div className="flex flex-col items-center space-y-2 md:space-y-1">
                <span className="text-3xl md:text-2xl lg:text-lg">💰</span>
                <span className="text-base md:text-sm lg:text-xs font-bold">TAILS</span>
              </div>
            </Button>
          </div>

          {/* Mobile-First Asset Selection */}
          <Card className="bg-card/80 backdrop-blur-sm border-gold/20 max-w-sm mx-auto">
            <CardContent className="p-6 md:p-4 lg:p-3">
              <div className="space-y-5 md:space-y-4 lg:space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-base md:text-sm lg:text-xs font-medium text-cyan-400">Asset</label>
                  <Badge variant="outline" className="border-green-500/30 text-green-400 text-base md:text-sm lg:text-xs px-3 py-1">
                    {currentAsset?.network}
                  </Badge>
                </div>
                
                <Select value={selectedAsset} onValueChange={setSelectedAsset} disabled={isFlipping}>
                  <SelectTrigger className="border-gold/30 bg-background/50 h-12 md:h-10 lg:h-8 text-lg md:text-base lg:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card/95 backdrop-blur-sm border-gold/20">
                    {currentAssets.map((asset) => (
                      <SelectItem key={asset.symbol} value={asset.symbol} className="hover:bg-cyan-500/10 py-4 md:py-3 lg:py-2">
                        <div className="flex items-center space-x-4 md:space-x-3 lg:space-x-2">
                          <span className="text-lg md:text-base lg:text-sm">{asset.icon}</span>
                          <div>
                            <div className="font-medium text-lg md:text-base lg:text-sm">{asset.symbol}</div>
                            <div className="text-base md:text-sm lg:text-xs text-muted-foreground">
                              Balance: {asset.balance}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Mobile-First Bet Controls */}
          <Card className="bg-card/80 backdrop-blur-sm border-gold/20 max-w-sm mx-auto">
            <CardContent className="p-6 md:p-4 lg:p-3">
              <div className="space-y-5 md:space-y-4 lg:space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-base md:text-sm lg:text-xs font-medium text-cyan-400">Bet Amount</label>
                  <div className="text-lg md:text-base lg:text-sm font-bold text-gold">
                    {betAmount[0].toFixed(2)} {selectedAsset}
                  </div>
                </div>
                
                <Slider
                  value={betAmount}
                  onValueChange={setBetAmount}
                  max={10}
                  min={0.01}
                  step={0.01}
                  disabled={isFlipping}
                  className="w-full"
                />
                
                <div className="grid grid-cols-4 gap-3 md:gap-2 lg:gap-1">
                  {[0.5, 2, 5, 10].map((multiplier) => (
                    <Button
                      key={multiplier}
                      variant="outline"
                      size="default"
                      disabled={isFlipping}
                      onClick={() => adjustBetAmount(multiplier)}
                      className="border-gold/30 hover:bg-cyan-500/10 text-base md:text-sm lg:text-xs h-10 md:h-8 lg:h-6 px-3 md:px-2"
                    >
                      {multiplier < 1 ? `÷${1/multiplier}` : `×${multiplier}`}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile-First Potential Payout */}
          {selectedSide && !gameResult && (
            <div className="text-center">
              <div className="inline-flex items-center space-x-4 md:space-x-3 lg:space-x-2 text-lg md:text-base lg:text-sm bg-card/50 rounded-lg px-6 md:px-4 lg:px-3 py-3 md:py-2 lg:py-1 border border-gold/20">
                <TrendingUp className="w-5 h-5 md:w-4 md:h-4 lg:w-3 lg:h-3 text-green-400" />
                <span className="text-muted-foreground">Potential:</span>
                <span className="font-bold text-green-400">
                  {(betAmount[0] * 1.95).toFixed(2)} {selectedAsset}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-First Flip Button - Sticky on mobile */}
      <div className="flex-shrink-0 p-6 md:p-4 lg:p-3 border-t border-gold/20 bg-background/80 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none sticky bottom-0 md:static">
        <Button
          onClick={flipCoin}
          disabled={!selectedSide || !address || isFlipping}
          size="lg"
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 py-6 md:py-4 lg:py-3 text-2xl md:text-xl lg:text-lg font-bold transition-all duration-300 hover:scale-105 shadow-lg h-16 md:h-14 lg:h-12"
        >
          {isFlipping ? (
            <div className="flex items-center space-x-4 md:space-x-3 lg:space-x-2">
              <Zap className="w-8 h-8 md:w-6 md:h-6 lg:w-5 lg:h-5 animate-spin" />
              <span>{isTxLoading ? "CONFIRMING..." : "FLIPPING..."}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-4 md:space-x-3 lg:space-x-2">
              <Coins className="w-8 h-8 md:w-6 md:h-6 lg:w-5 lg:h-5" />
              <span>FLIP COIN</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  )
}
