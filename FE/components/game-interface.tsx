"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Coins, Zap, TrendingUp, Sparkles, RotateCcw, Loader2, AlertCircle, ShieldCheck, XCircle, Info } from "lucide-react"
import { useAccount, useWriteContract, useBalance, useReadContract, usePublicClient } from "wagmi"
import { parseEther, parseUnits, formatUnits, decodeEventLog } from "viem"
import { FLIPEN_ADDRESSES } from "@/contracts/addresses"
import { toast } from "sonner"
import Image from "next/image"

// Import ABIs
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json"
import MAINNET_ABI from "@/contracts/celo-abi.json"

const CUSD_CONTRACTS: Record<number, `0x${string}`> = {
  42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  11142220: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
}

const ERC20_ABI = [
  { "type": "function", "name": "approve", "stateMutability": "nonpayable", "inputs": [{ "type": "address", "name": "spender" }, { "type": "uint256", "name": "amount" }], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "allowance", "stateMutability": "view", "inputs": [{ "type": "address", "name": "owner" }, { "type": "address", "name": "spender" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "balanceOf", "stateMutability": "view", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }] },
] as const

export function GameInterface({ selectedAsset, setSelectedAsset }: { selectedAsset: string, setSelectedAsset: (asset: string) => void }) {
  const { address, chainId, chain, isConnected } = useAccount()
  const publicClient = usePublicClient()
  
  const [selectedSide, setSelectedSide] = useState<"heads" | "tails" | null>(null)
  const [betAmount, setBetAmount] = useState([0.1])
  const [gameState, setGameState] = useState<"IDLE" | "COMMITTING" | "WAITING_BLOCK" | "REVEALING">("IDLE")
  const [pendingGameId, setPendingGameId] = useState<bigint | null>(null)
  const [gameResult, setGameResult] = useState<{ result: "heads" | "tails", won: boolean, payout: string } | null>(null)
  const [catchTimer, setCatchTimer] = useState(0)

  // Dynamic Resource Selection
  const activeChainId = chainId || 42220
  const proxyAddress = FLIPEN_ADDRESSES[activeChainId]
  const contractABI = activeChainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI
  const cUSDAddress = CUSD_CONTRACTS[activeChainId]

  // READ LIMITS FROM CONTRACT
  const { data: contractLimits } = useReadContract({
    address: proxyAddress,
    abi: contractABI as any,
    functionName: 'getBetLimits',
    query: { enabled: !!proxyAddress }
  })

  const { minBet, maxBet } = useMemo(() => {
    if (!contractLimits) return { minBet: BigInt(0), maxBet: parseEther("10") }
    const limits = contractLimits as readonly bigint[]
    return { minBet: limits[0], maxBet: limits[1] }
  }, [contractLimits])

  const formattedMin = parseFloat(formatUnits(minBet, 18))
  const formattedMax = parseFloat(formatUnits(maxBet, 18))

  // User Balances
  const { data: celoBalance } = useBalance({ address, query: { enabled: !!address, refetchInterval: 10000 } })
  const { data: cusdBalanceRaw } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!cUSDAddress, refetchInterval: 10000 }
  })

  // CONTRACT BANKROLL
  const { data: contractCeloBalance } = useBalance({ 
    address: proxyAddress, 
    query: { enabled: !!proxyAddress, refetchInterval: 15000 } 
  })
  const { data: contractCusdBalanceRaw } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: proxyAddress ? [proxyAddress] : undefined,
    query: { enabled: !!cUSDAddress && !!proxyAddress, refetchInterval: 15000 }
  })

  const { writeContractAsync } = useWriteContract()
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && proxyAddress ? [address, proxyAddress] : undefined,
    query: { enabled: !!address && !!cUSDAddress && !!proxyAddress && selectedAsset === "cUSD" }
  })

  const formatValue = (val: any, decimals = 18) => {
    if (val === undefined || val === null) return 0
    if (typeof val === 'object' && val.value !== undefined) return parseFloat(formatUnits(val.value, val.decimals))
    return parseFloat(formatUnits(val as bigint, decimals))
  }

  const bankroll = useMemo(() => {
    if (selectedAsset === "CELO") return formatValue(contractCeloBalance)
    return formatValue(contractCusdBalanceRaw)
  }, [selectedAsset, contractCeloBalance, contractCusdBalanceRaw])

  const canAffordPayout = useMemo(() => {
    const potentialPayout = betAmount[0] * 1.95
    return bankroll >= potentialPayout
  }, [bankroll, betAmount])

  const isWithinLimits = betAmount[0] >= formattedMin && betAmount[0] <= formattedMax

  const currentAssets = useMemo(() => {
    const formatStr = (val: any, dec = 18) => formatValue(val, dec).toFixed(4)
    return [
      { symbol: "CELO", name: "Celo", icon: "◊", balance: formatStr(celoBalance), network: chain?.name || "Celo" },
      { symbol: "cUSD", name: "Celo Dollar", icon: "$", balance: formatStr(cusdBalanceRaw), network: chain?.name || "Celo", address: cUSDAddress },
    ]
  }, [celoBalance, cusdBalanceRaw, chain, cUSDAddress])

  const currentAsset = currentAssets.find(asset => asset.symbol === selectedAsset) || currentAssets[0]

  // Cooldown timer for "Catch" button
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (gameState === "WAITING_BLOCK" && catchTimer > 0) {
      timer = setInterval(() => setCatchTimer(t => t - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [gameState, catchTimer])

  const handleError = (error: any, context: string) => {
    console.error(`[${context}]`, error)
    const msg = error.shortMessage || error.message || "An unexpected error occurred."
    
    // Kind formatting
    let kindMsg = msg
    if (msg.includes("user rejected")) kindMsg = "Transaction cancelled by user."
    else if (msg.includes("insufficient funds")) kindMsg = "Oops! You don't have enough balance for this bet."
    else if (msg.includes("House bankroll")) kindMsg = "The house bankroll is temporarily too low for this bet."

    toast.error(kindMsg, {
      duration: 5000,
      icon: <XCircle className="w-4 h-4 text-red-500" />,
      closeButton: true,
    })
  }

  const resolveGame = useCallback(async (gameId: bigint) => {
    if (!publicClient || !proxyAddress) return
    try {
      setGameState("REVEALING")
      const hash = await writeContractAsync({
        address: proxyAddress,
        abi: contractABI as any,
        functionName: "resolveGame",
        args: [gameId],
      })
      
      toast.info("Revealing coin...", { closeButton: true })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      let won = false
      let coinResult = 0
      let payout = "0.0000"

      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: contractABI as any,
            data: log.data,
            topics: log.topics,
          }) as any
          if (event.eventName === 'GameResult') {
            const args = event.args
            won = args.won
            coinResult = args.result
            payout = (Number(args.payout) / 1e18).toFixed(4)
            break
          }
        } catch (e) { continue }
      }

      setGameResult({
        result: coinResult === 1 ? "heads" : "tails",
        won: won,
        payout: payout
      })
      
      setGameState("IDLE")
      setPendingGameId(null)
      if (won) {
        toast.success(`🎉 YOU WON! Received ${payout} ${selectedAsset}`, { closeButton: true })
      } else {
        toast.info("💔 Hard luck! Try again?", { closeButton: true })
      }
    } catch (error: any) {
      handleError(error, "Resolve")
      setGameState("WAITING_BLOCK")
    }
  }, [writeContractAsync, publicClient, selectedAsset, proxyAddress, contractABI])

  const flipCoin = useCallback(async () => {
    if (!selectedSide || !address || !publicClient || !proxyAddress) return
    if (!canAffordPayout) {
      handleError({ shortMessage: "House bankroll is too low." }, "Flip")
      return
    }
    if (!isWithinLimits) {
      handleError({ shortMessage: `Bet must be between ${formattedMin} and ${formattedMax}` }, "Flip")
      return
    }

    try {
      setGameState("COMMITTING")
      setGameResult(null)
      const choice = selectedSide === "tails" ? 0 : 1
      let hash: `0x${string}`

      if (selectedAsset === "CELO") {
        hash = await writeContractAsync({
          address: proxyAddress,
          abi: contractABI as any,
          functionName: "flipCoin",
          args: [choice],
          value: parseEther(betAmount[0].toString()),
        })
      } else {
        const amount = parseUnits(betAmount[0].toString(), 18)
        if (!allowance || (allowance as bigint) < amount) {
          toast.info("Approving cUSD...", { closeButton: true })
          await writeContractAsync({
            address: cUSDAddress!,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [proxyAddress, amount],
          })
          await new Promise(resolve => setTimeout(resolve, 4000))
          await refetchAllowance()
        }
        hash = await writeContractAsync({
          address: proxyAddress,
          abi: contractABI as any,
          functionName: "flipCoinERC20",
          args: [choice, amount, cUSDAddress!],
        })
      }

      toast.info("Bet placed! Confirming...", { closeButton: true })
      await publicClient.waitForTransactionReceipt({ hash })
      
      const playerGames = await publicClient.readContract({
        address: proxyAddress,
        abi: contractABI as any,
        functionName: "getPlayerGames",
        args: [address],
      }) as bigint[]
      
      setPendingGameId(playerGames[playerGames.length - 1])
      setCatchTimer(5) // 5 Second cooldown
      setGameState("WAITING_BLOCK")
      toast.success("Coin is flipping! Wait 5s to reveal.", { closeButton: true })
    } catch (error: any) {
      handleError(error, "Flip")
      setGameState("IDLE")
    }
  }, [selectedSide, address, selectedAsset, betAmount, writeContractAsync, allowance, cUSDAddress, refetchAllowance, publicClient, canAffordPayout, proxyAddress, contractABI, isWithinLimits, formattedMin, formattedMax])

  return (
    <div className="min-h-0 md:h-full flex flex-col">
      <div className="flex-1 md:overflow-y-auto">
        <div className="space-y-6 md:space-y-4 lg:space-y-3 p-4 md:p-3 lg:p-2">
          
          {/* Main Display: Dynamic Asset Coin */}
          <div className="flex justify-center py-4">
            <div className={`relative w-40 h-40 rounded-full border-4 border-gold/40 flex items-center justify-center transition-all duration-500 shadow-[0_0_40px_rgba(218,165,32,0.3)] bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 ${gameState !== "IDLE" ? 'animate-pulse' : 'hover:scale-105'}`}>
              {/* Metallic Engraving Effect */}
              <div className="absolute inset-2 rounded-full border border-black/10 shadow-inner" />
              
              <div className={`absolute inset-0 rounded-full ${gameState === "COMMITTING" || gameState === "REVEALING" ? 'animate-spin border-t-white/40 border-4' : ''}`} />
              
              <div className="relative flex flex-col items-center justify-center text-black drop-shadow-md">
                {gameResult ? (
                  <>
                    <span className="text-5xl mb-1">{gameResult.result === "heads" ? "👑" : "💰"}</span>
                    <span className="text-[12px] font-black uppercase tracking-widest opacity-80">{selectedAsset}</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black tracking-tighter mb-0.5">{selectedAsset}</span>
                    <div className="w-12 h-0.5 bg-black/20 rounded-full mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">FLIPEN</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {gameResult && (
            <Card className="bg-card/80 backdrop-blur-sm border-gold/20 mx-auto max-w-sm text-center p-6 shadow-2xl relative">
              <button onClick={() => setGameResult(null)} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-white transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
              <div className={`text-3xl font-black mb-2 tracking-tighter ${gameResult.won ? 'text-green-400 animate-pulse' : 'text-red-400'}`}>
                {gameResult.won ? 'YOU WON!' : 'YOU LOST'}
              </div>
              <div className="text-muted-foreground mb-4 text-sm font-medium">
                The coin landed on <span className="text-foreground font-bold">{gameResult.result.toUpperCase()}</span>
              </div>
              {gameResult.won && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
                  <div className="text-xs text-green-400 uppercase font-bold">Total Payout</div>
                  <div className="text-2xl font-black text-green-400">+{gameResult.payout} {selectedAsset}</div>
                </div>
              )}
              <Button onClick={() => { setGameResult(null); setSelectedSide(null); }} className="w-full bg-gold hover:bg-gold-dark text-black font-bold">
                <RotateCcw className="w-4 h-4 mr-2" /> PLAY AGAIN
              </Button>
            </Card>
          )}

          {gameState === "IDLE" && !gameResult && (
            <>
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <Button variant={selectedSide === "heads" ? "default" : "outline"} onClick={() => setSelectedSide("heads")} className={`h-20 ${selectedSide === "heads" ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(218,165,32,0.3)]' : 'border-gold/30 hover:border-gold/60'}`}><div className="flex flex-col"><span className="text-2xl">👑</span><span className="font-bold">HEADS</span></div></Button>
                <Button variant={selectedSide === "tails" ? "default" : "outline"} onClick={() => setSelectedSide("tails")} className={`h-20 ${selectedSide === "tails" ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(218,165,32,0.3)]' : 'border-gold/30 hover:border-gold/60'}`}><div className="flex flex-col"><span className="text-2xl">💰</span><span className="font-bold">TAILS</span></div></Button>
              </div>

              <Card className="bg-card/80 border-gold/20 max-w-sm mx-auto p-4 space-y-4 shadow-xl">
                <div className="flex justify-between items-center text-xs"><label className="text-cyan-400 font-bold uppercase flex items-center gap-1"><Coins className="w-3 h-3" /> Asset</label><Badge variant="outline" className="text-[10px] bg-gold/5 border-gold/20">{currentAsset.network}</Badge></div>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}><SelectTrigger className="border-gold/30 h-10 bg-muted/20"><SelectValue /></SelectTrigger><SelectContent>{currentAssets.map(a => <SelectItem key={a.symbol} value={a.symbol}>{a.icon} {a.symbol} ({a.balance})</SelectItem>)}</SelectContent></Select>
                
                <div className="flex justify-between items-center text-xs">
                  <label className="text-cyan-400 font-bold uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Bet Amount</label>
                  <div className="text-right"><span className="font-bold text-gold block">{betAmount[0].toFixed(2)} {selectedAsset}</span><span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Min: {formattedMin} | Max: {formattedMax}</span></div>
                </div>
                <Slider value={betAmount} onValueChange={setBetAmount} max={formattedMax > 0 ? formattedMax : 10} min={formattedMin} step={0.01} className="py-2" />
                
                <div className="pt-2 border-t border-gold/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {canAffordPayout ? <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">House Bankroll</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${canAffordPayout ? 'text-green-400' : 'text-red-400'}`}>{bankroll.toFixed(2)} {selectedAsset}</span>
                </div>
              </Card>
            </>
          )}

          {gameState === "WAITING_BLOCK" && (
            <div className="text-center space-y-4 py-8">
              <div className="text-xl font-black text-gold animate-pulse uppercase tracking-tighter">The Oracle is Deciding...</div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-4 opacity-60">Wait for the block to confirm your destiny</p>
              
              <div className="max-w-sm mx-auto">
                <Button 
                  onClick={() => pendingGameId && resolveGame(pendingGameId)} 
                  disabled={catchTimer > 0}
                  className={`h-20 w-full shadow-2xl text-xl font-black transition-all ${
                    catchTimer > 0 
                    ? 'bg-muted text-muted-foreground cursor-wait grayscale' 
                    : 'bg-green-600 hover:bg-green-500 text-white hover:scale-[1.02] shadow-green-500/20'
                  }`}
                >
                  {catchTimer > 0 ? `READY IN ${catchTimer}S` : 'CATCH THE COIN!'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {gameState === "IDLE" && !gameResult && (
        <div className="p-4 border-t border-gold/20 sticky bottom-0 bg-background/80 backdrop-blur-sm">
          {!isConnected ? (
            <Button disabled className="w-full h-16 text-xl font-bold bg-muted text-muted-foreground">CONNECT WALLET</Button>
          ) : !isWithinLimits ? (
            <Button disabled className="w-full h-16 text-base font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              BET MUST BE {formattedMin}-{formattedMax} {selectedAsset}
            </Button>
          ) : !canAffordPayout ? (
            <Button disabled className="w-full h-16 text-xl font-bold bg-muted text-muted-foreground">INSUFFICIENT HOUSE BANKROLL</Button>
          ) : !selectedSide ? (
            <Button disabled className="w-full h-16 text-xl font-bold bg-muted/50 text-muted-foreground border border-gold/10">SELECT A SIDE</Button>
          ) : (
            <Button onClick={flipCoin} className="w-full h-16 text-xl font-black bg-gradient-to-r from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 text-black shadow-2xl shadow-gold/20 border-t border-white/20 transition-all active:scale-95">
              <Coins className="mr-2 h-6 w-6" /> FLIP {betAmount[0].toFixed(2)} {selectedAsset}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
