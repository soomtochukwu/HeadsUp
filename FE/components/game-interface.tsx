"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Coins, Zap, TrendingUp, Sparkles, RotateCcw, Loader2, AlertCircle, ShieldCheck, XCircle, Info } from "lucide-react"
import { useAccount, useWriteContract, useBalance, useReadContract, usePublicClient, useEstimateGas } from "wagmi"
import { parseEther, parseUnits, formatUnits, decodeEventLog } from "viem"
import { FLIPEN_ADDRESSES, TOKEN_ADDRESSES } from "@/contracts/addresses"
import { toast } from "sonner"
import Image from "next/image"
import { isMiniPay } from "@/hooks/useAutoConnect"

// Import ABIs
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json"
import MAINNET_ABI from "@/contracts/celo-abi.json"

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
  const [_isMiniPay, setIsMiniPayEnv] = useState(false)

  useEffect(() => {
    setIsMiniPayEnv(isMiniPay())
  }, [])

  // Dynamic Resource Selection
  const activeChainId = chainId || 42220
  const proxyAddress = FLIPEN_ADDRESSES[activeChainId]
  const contractABI = activeChainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI
  const tokenAddress = TOKEN_ADDRESSES[activeChainId]?.[selectedAsset]

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
  const { data: tokenBalanceRaw } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress, refetchInterval: 10000 }
  })

  // CONTRACT BANKROLL
  const { data: contractCeloBalance } = useBalance({ 
    address: proxyAddress, 
    query: { enabled: !!proxyAddress, refetchInterval: 15000 } 
  })
  const { data: contractTokenBalanceRaw } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: proxyAddress ? [proxyAddress] : undefined,
    query: { enabled: !!tokenAddress && !!proxyAddress, refetchInterval: 15000 }
  })

  const { writeContractAsync } = useWriteContract()
  
  // GAS ESTIMATION
  const { data: estimatedGas } = useEstimateGas({
    account: address,
    to: proxyAddress,
    value: selectedAsset === "CELO" ? parseEther(betAmount[0].toString()) : undefined,
    query: { enabled: !!address && !!proxyAddress && !!selectedSide }
  })

  const networkFee = useMemo(() => {
    if (!estimatedGas) return "0.0001" // Fallback
    return parseFloat(formatUnits(estimatedGas, 18)).toFixed(5)
  }, [estimatedGas])

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && proxyAddress ? [address, proxyAddress] : undefined,
    query: { enabled: !!address && !!tokenAddress && !!proxyAddress && selectedAsset !== "CELO" }
  })

  const formatValue = (val: any, decimals = 18) => {
    if (val === undefined || val === null) return 0
    if (typeof val === 'object' && val.value !== undefined) return parseFloat(formatUnits(val.value, val.decimals))
    return parseFloat(formatUnits(val as bigint, decimals))
  }

  const bankroll = useMemo(() => {
    if (selectedAsset === "CELO") return formatValue(contractCeloBalance)
    return formatValue(contractTokenBalanceRaw)
  }, [selectedAsset, contractCeloBalance, contractTokenBalanceRaw])

  const canAffordPayout = useMemo(() => {
    const potentialPayout = betAmount[0] * 1.95
    return bankroll >= potentialPayout
  }, [bankroll, betAmount])

  const isWithinLimits = betAmount[0] >= formattedMin && betAmount[0] <= formattedMax

  const currentAssets = useMemo(() => {
    const formatStr = (val: any, dec = 18) => formatValue(val, dec).toFixed(4)
    const availableTokens = TOKEN_ADDRESSES[activeChainId] || {}
    
    const assets = [
      { symbol: "CELO", name: "Celo", icon: "◊", balance: formatStr(celoBalance), network: chain?.name || "Celo" }
    ]

    // Only add tokens that have addresses for the current chain
    if (availableTokens["USDm"]) assets.push({ symbol: "USDm", name: "USD Mento", icon: "$", balance: formatStr(tokenBalanceRaw), network: chain?.name || "Celo", address: availableTokens["USDm"] })
    if (availableTokens["USDC"]) assets.push({ symbol: "USDC", name: "USDC Native", icon: "Ⓒ", balance: formatStr(tokenBalanceRaw), network: chain?.name || "Celo", address: availableTokens["USDC"] })
    if (availableTokens["USDT"]) assets.push({ symbol: "USDT", name: "Tether", icon: "₮", balance: formatStr(tokenBalanceRaw), network: chain?.name || "Celo", address: availableTokens["USDT"] })

    return assets
  }, [celoBalance, tokenBalanceRaw, chain, activeChainId, selectedAsset])

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
    if (msg.includes("user rejected")) kindMsg = "Transaction cancelled."
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
      
      toast.info(_isMiniPay ? "Confirming network fee..." : "Revealing coin...", { closeButton: true })
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
      
      let referrerAddress = "0x0000000000000000000000000000000000000000";
      if (typeof window !== "undefined") {
        const storedReferrer = localStorage.getItem("headsup_referrer");
        if (storedReferrer && /^0x[a-fA-F0-9]{40}$/.test(storedReferrer) && storedReferrer.toLowerCase() !== address.toLowerCase()) {
          referrerAddress = storedReferrer;
        }
      }

      if (selectedAsset === "CELO") {
        hash = await writeContractAsync({
          address: proxyAddress,
          abi: contractABI as any,
          functionName: "flipCoin",
          args: [choice, referrerAddress],
          value: parseEther(betAmount[0].toString()),
        })
      } else {
        const amount = parseUnits(betAmount[0].toString(), 18)
        if (!allowance || (allowance as bigint) < amount) {
          toast.info(`Approving ${selectedAsset}...`, { closeButton: true })
          await writeContractAsync({
            address: tokenAddress!,
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
          args: [choice, amount, tokenAddress!, referrerAddress],
        })
      }

      toast.info(_isMiniPay ? "Confirming network fee..." : "Bet placed! Confirming...", { closeButton: true })
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
  }, [selectedSide, address, selectedAsset, betAmount, writeContractAsync, allowance, tokenAddress, refetchAllowance, publicClient, canAffordPayout, proxyAddress, contractABI, isWithinLimits, formattedMin, formattedMax])

  return (
    <div className="min-h-0 md:h-full flex flex-col">
      <div className="flex-1 md:overflow-y-auto flex flex-col">
        <div className="flex-1 flex flex-col space-y-6 md:space-y-4 lg:space-y-6 p-4 md:p-3 lg:p-6 lg:justify-evenly">
          
          {/* Main Display: Dynamic Asset Coin */}
          <div className="flex justify-center py-4 lg:py-0 lg:flex-1 lg:items-center">
            <div className={`relative w-40 h-40 lg:w-56 lg:h-56 xl:w-64 xl:h-64 rounded-full border-4 border-gold/40 flex items-center justify-center transition-all duration-500 shadow-[0_0_40px_rgba(218,165,32,0.3)] bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 ${gameState !== "IDLE" ? 'animate-pulse' : 'hover:scale-105'}`}>
              {/* Metallic Engraving Effect */}
              <div className="absolute inset-2 rounded-full border border-black/10 shadow-inner" />
              
              <div className={`absolute inset-0 rounded-full ${gameState === "COMMITTING" || gameState === "REVEALING" ? 'animate-spin border-t-white/40 border-4' : ''}`} />
              
              <div className="relative flex flex-col items-center justify-center text-black drop-shadow-md">
                {gameResult ? (
                  <>
                    <span className="text-5xl lg:text-7xl xl:text-8xl mb-1">{gameResult.result === "heads" ? "👑" : "💰"}</span>
                    <span className="text-[12px] lg:text-sm xl:text-base font-black uppercase tracking-widest opacity-80">{selectedAsset}</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl lg:text-4xl xl:text-5xl font-black tracking-tighter mb-0.5">{selectedAsset}</span>
                    <div className="w-12 lg:w-16 xl:w-20 h-0.5 lg:h-1 bg-black/20 rounded-full mb-1" />
                    <span className="text-[10px] lg:text-xs xl:text-sm font-bold uppercase tracking-widest opacity-70">FLIPEN</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {gameResult && (
            <div className="lg:flex-1 flex flex-col justify-center">
              <Card className="bg-card/80 backdrop-blur-sm border-gold/20 w-full max-w-sm lg:max-w-md xl:max-w-lg mx-auto text-center p-6 shadow-2xl relative">
                <button onClick={() => setGameResult(null)} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-white transition-colors">
                  <XCircle className="w-4 h-4" />
                </button>
                <div className={`text-3xl lg:text-4xl font-black mb-2 tracking-tighter ${gameResult.won ? 'text-green-400 animate-pulse' : 'text-red-400'}`}>
                  {gameResult.won ? 'YOU WON!' : 'YOU LOST'}
                </div>
                <div className="text-muted-foreground mb-4 text-sm lg:text-base font-medium">
                  The coin landed on <span className="text-foreground font-bold">{gameResult.result.toUpperCase()}</span>
                </div>
                {gameResult.won && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 lg:p-4 mb-4">
                    <div className="text-xs lg:text-sm text-green-400 uppercase font-bold">Total Payout</div>
                    <div className="text-2xl lg:text-3xl font-black text-green-400">+{gameResult.payout} {selectedAsset}</div>
                  </div>
                )}
                <Button onClick={() => { setGameResult(null); setSelectedSide(null); }} className="w-full lg:h-14 lg:text-lg bg-gold hover:bg-gold-dark text-black font-bold">
                  <RotateCcw className="w-4 h-4 lg:w-5 lg:h-5 mr-2" /> PLAY AGAIN
                </Button>
              </Card>
            </div>
          )}

          {gameState === "IDLE" && !gameResult && (
            <div className="lg:flex-1 flex flex-col justify-center space-y-6 lg:space-y-8">
              <div className="grid grid-cols-2 gap-4 lg:gap-8 w-full max-w-sm lg:max-w-3xl xl:max-w-4xl mx-auto lg:flex-1">
                <Button variant={selectedSide === "heads" ? "default" : "outline"} onClick={() => setSelectedSide("heads")} className={`h-20 lg:h-full ${selectedSide === "heads" ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(218,165,32,0.3)]' : 'border-gold/30 hover:border-gold/60'}`}><div className="flex flex-col items-center justify-center h-full"><span className="text-2xl lg:text-5xl xl:text-6xl mb-1 lg:mb-2">👑</span><span className="font-bold lg:text-xl xl:text-2xl">HEADS</span></div></Button>
                <Button variant={selectedSide === "tails" ? "default" : "outline"} onClick={() => setSelectedSide("tails")} className={`h-20 lg:h-full ${selectedSide === "tails" ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(218,165,32,0.3)]' : 'border-gold/30 hover:border-gold/60'}`}><div className="flex flex-col items-center justify-center h-full"><span className="text-2xl lg:text-5xl xl:text-6xl mb-1 lg:mb-2">💰</span><span className="font-bold lg:text-xl xl:text-2xl">TAILS</span></div></Button>
              </div>

              <Card className="bg-card/80 border-gold/20 w-full max-w-sm lg:max-w-3xl xl:max-w-4xl mx-auto p-4 lg:p-8 flex flex-col justify-center space-y-4 lg:space-y-8 shadow-xl lg:flex-1">
                <div className="flex justify-between items-center text-xs lg:text-base"><label className="text-cyan-400 font-bold uppercase flex items-center gap-1"><Coins className="w-3 h-3 lg:w-5 lg:h-5" /> Asset</label><Badge variant="outline" className="text-[10px] lg:text-sm bg-gold/5 border-gold/20">{currentAsset.network}</Badge></div>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}><SelectTrigger className="border-gold/30 h-10 lg:h-14 bg-muted/20 lg:text-lg"><SelectValue /></SelectTrigger><SelectContent>{currentAssets.map(a => <SelectItem key={a.symbol} value={a.symbol} className="lg:text-lg">{a.icon} {a.symbol} ({a.balance})</SelectItem>)}</SelectContent></Select>
                
                <div className="flex justify-between items-center text-xs lg:text-base">
                  <label className="text-cyan-400 font-bold uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3 lg:w-5 lg:h-5" /> Bet Amount</label>
                  <div className="text-right"><span className="font-bold text-gold block lg:text-xl">{betAmount[0].toFixed(2)} {selectedAsset}</span><span className="text-[9px] lg:text-xs text-muted-foreground uppercase font-black tracking-tighter">Min: {formattedMin} | Max: {formattedMax}</span></div>
                </div>
                <Slider value={betAmount} onValueChange={setBetAmount} max={formattedMax > 0 ? formattedMax : 10} min={formattedMin} step={0.01} className="py-2 lg:py-6" />
                
                <div className="pt-2 lg:pt-6 border-t border-gold/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 lg:gap-3">
                    {canAffordPayout ? <ShieldCheck className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-red-500" />}
                    <span className="text-[10px] lg:text-sm uppercase font-bold text-muted-foreground">House Bankroll</span>
                  </div>
                  <span className={`text-[10px] lg:text-sm font-mono font-bold ${canAffordPayout ? 'text-green-400' : 'text-red-400'}`}>{bankroll.toFixed(2)} {selectedAsset}</span>
                </div>

                <div className="pt-2 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-1.5 lg:gap-3">
                    <Zap className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-gold" />
                    <span className="text-[10px] lg:text-sm uppercase font-bold text-muted-foreground">Network Fee</span>
                  </div>
                  <span className="text-[10px] lg:text-sm font-mono font-bold text-gold">~{networkFee} CELO</span>
                </div>
              </Card>
            </div>
          )}

          {gameState === "WAITING_BLOCK" && (
            <div className="lg:flex-1 flex flex-col justify-center text-center space-y-4 lg:space-y-6 py-8">
              <div className="text-xl lg:text-3xl font-black text-gold animate-pulse uppercase tracking-tighter">{_isMiniPay ? "Network Fee Optimized" : "The Oracle is Deciding..."}</div>
              <p className="text-muted-foreground text-[10px] lg:text-sm font-bold uppercase tracking-widest px-4 opacity-60">{_isMiniPay ? "Transaction ready for signing" : "Wait for the block to confirm your destiny"}</p>
              
              <div className="w-full max-w-sm lg:max-w-md xl:max-w-lg mx-auto">
                <Button 
                  onClick={() => pendingGameId && resolveGame(pendingGameId)} 
                  disabled={catchTimer > 0}
                  className={`h-20 lg:h-24 w-full shadow-2xl text-xl lg:text-2xl font-black transition-all ${
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
        <div className="p-4 lg:p-6 border-t border-gold/20 sticky bottom-0 bg-background/80 backdrop-blur-sm z-10 shrink-0">
          {!isConnected ? (
            <Button disabled className="w-full h-16 lg:h-20 text-xl lg:text-2xl font-bold bg-muted text-muted-foreground">CONNECT WALLET</Button>
          ) : !isWithinLimits ? (
            <Button disabled className="w-full h-16 lg:h-20 text-base lg:text-xl font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              BET MUST BE {formattedMin}-{formattedMax} {selectedAsset}
            </Button>
          ) : !canAffordPayout ? (
            <Button disabled className="w-full h-16 lg:h-20 text-xl lg:text-2xl font-bold bg-muted text-muted-foreground">INSUFFICIENT HOUSE BANKROLL</Button>
          ) : !selectedSide ? (
            <Button disabled className="w-full h-16 lg:h-20 text-xl lg:text-2xl font-bold bg-muted/50 text-muted-foreground border border-gold/10">SELECT A SIDE</Button>
          ) : (
            <Button onClick={flipCoin} className="w-full h-16 lg:h-20 text-xl lg:text-2xl font-black bg-gradient-to-r from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 text-black shadow-2xl shadow-gold/20 border-t border-white/20 transition-all active:scale-95">
              <Coins className="mr-2 h-6 w-6 lg:h-8 lg:w-8" /> FLIP {betAmount[0].toFixed(2)} {selectedAsset}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
