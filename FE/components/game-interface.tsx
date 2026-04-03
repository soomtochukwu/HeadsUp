"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Coins, Zap, TrendingUp, Sparkles, RotateCcw, Loader2 } from "lucide-react"
import { useAccount, useWriteContract, useBalance, useReadContract, usePublicClient } from "wagmi"
import { parseEther, parseUnits, formatUnits } from "viem"
import { FLIPEN_PROXY_ADDRESS } from "@/contracts/addresses"
import { toast } from "sonner"

const CUSD_CONTRACTS: Record<number, `0x${string}`> = {
  42220: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  11142220: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
}

const FLIPEN_ABI = [
  { "type": "function", "name": "flipCoin", "stateMutability": "payable", "inputs": [{ "type": "uint8", "name": "choice" }], "outputs": [] },
  { "type": "function", "name": "flipCoinERC20", "stateMutability": "nonpayable", "inputs": [{ "type": "uint8", "name": "choice" }, { "type": "uint256", "name": "amount" }, { "type": "address", "name": "token" }], "outputs": [] },
  { "type": "function", "name": "resolveGame", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256", "name": "gameId" }], "outputs": [] },
  { "type": "function", "name": "getPlayerGames", "stateMutability": "view", "inputs": [{ "type": "address", "name": "player" }], "outputs": [{ "type": "uint256[]" }] },
  { "type": "function", "name": "getGameDetails", "stateMutability": "view", "inputs": [{ "type": "uint256", "name": "requestId" }], "outputs": [{ "type": "tuple", "components": [{ "type": "address", "name": "player" }, { "type": "uint256", "name": "amount" }, { "type": "uint8", "name": "playerChoice" }, { "type": "uint8", "name": "status" }, { "type": "bool", "name": "won" }, { "type": "uint256", "name": "timestamp" }, { "type": "uint256", "name": "commitBlock" }, { "type": "uint256", "name": "randomNumber" }, { "type": "uint8", "name": "coinResult" }, { "type": "address", "name": "token" }] }] }
] as const

const ERC20_ABI = [
  { "type": "function", "name": "approve", "stateMutability": "nonpayable", "inputs": [{ "type": "address", "name": "spender" }, { "type": "uint256", "name": "amount" }], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "allowance", "stateMutability": "view", "inputs": [{ "type": "address", "name": "owner" }, { "type": "address", "name": "spender" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "balanceOf", "stateMutability": "view", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }] }
] as const

export function GameInterface({ selectedAsset, setSelectedAsset }: { selectedAsset: string, setSelectedAsset: (asset: string) => void }) {
  const { address, chainId, chain, isConnected } = useAccount()
  const publicClient = usePublicClient()
  
  const [selectedSide, setSelectedSide] = useState<"heads" | "tails" | null>(null)
  const [betAmount, setBetAmount] = useState([0.1])
  const [gameState, setGameState] = useState<"IDLE" | "COMMITTING" | "WAITING_BLOCK" | "REVEALING">("IDLE")
  const [pendingGameId, setPendingGameId] = useState<bigint | null>(null)
  const [gameResult, setGameResult] = useState<{ result: "heads" | "tails", won: boolean, payout: string } | null>(null)

  const cUSDAddress = chainId ? CUSD_CONTRACTS[chainId] : undefined

  // Standard Hook usage for both CELO and cUSD
  const { data: celoBalance } = useBalance({ address, query: { enabled: !!address, refetchInterval: 10000 } })
  const { data: cusdBalanceRaw } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!cUSDAddress, refetchInterval: 10000 }
  })

  const { writeContractAsync } = useWriteContract()
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && FLIPEN_PROXY_ADDRESS ? [address, FLIPEN_PROXY_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: !!address && !!cUSDAddress && selectedAsset === "cUSD" }
  })

  const currentAssets = useMemo(() => {
    const formatNative = (data: any) => {
      if (!data || !data.formatted) return "0.0000"
      const num = parseFloat(data.formatted)
      return isNaN(num) ? "0.0000" : num.toFixed(4)
    }
    const formatERC20 = (val: any) => {
      if (val === undefined || val === null) return "0.0000"
      const num = parseFloat(formatUnits(val as bigint, 18))
      return isNaN(num) ? "0.0000" : num.toFixed(4)
    }
    
    return [
      { symbol: "CELO", name: "Celo", icon: "◊", balance: formatNative(celoBalance), network: chain?.name || "Celo" },
      { symbol: "cUSD", name: "Celo Dollar", icon: "$", balance: formatERC20(cusdBalanceRaw), network: chain?.name || "Celo", address: cUSDAddress },
    ]
  }, [celoBalance, cusdBalanceRaw, chain, cUSDAddress])

  const currentAsset = currentAssets.find(asset => asset.symbol === selectedAsset) || currentAssets[0]

  const resolveGame = useCallback(async (gameId: bigint) => {
    if (!publicClient) return
    try {
      setGameState("REVEALING")
      const hash = await writeContractAsync({ address: FLIPEN_PROXY_ADDRESS as `0x${string}`, abi: FLIPEN_ABI, functionName: "resolveGame", args: [gameId] })
      toast.info("Revealing coin...")
      await publicClient.waitForTransactionReceipt({ hash })
      const details = await publicClient.readContract({ address: FLIPEN_PROXY_ADDRESS as `0x${string}`, abi: FLIPEN_ABI, functionName: "getGameDetails", args: [gameId] }) as any
      setGameResult({
        result: details.coinResult === 1 ? "heads" : "tails",
        won: details.won,
        payout: (Number(details.amount) * 1.95 / 1e18).toFixed(4)
      })
      setGameState("IDLE")
      setPendingGameId(null)
      toast.success(details.won ? "🎉 YOU WON!" : "💔 Better luck next time!")
    } catch (error: any) {
      console.error(error)
      toast.error(error.shortMessage || "Resolution failed")
      setGameState("WAITING_BLOCK")
    }
  }, [writeContractAsync, publicClient])

  const flipCoin = useCallback(async () => {
    if (!selectedSide || !address || !publicClient) return
    try {
      setGameState("COMMITTING")
      setGameResult(null)
      const choice = selectedSide === "tails" ? 0 : 1
      let hash: `0x${string}`
      if (selectedAsset === "CELO") {
        hash = await writeContractAsync({ address: FLIPEN_PROXY_ADDRESS as `0x${string}`, abi: FLIPEN_ABI, functionName: "flipCoin", args: [choice], value: parseEther(betAmount[0].toString()) })
      } else {
        const amount = parseUnits(betAmount[0].toString(), 18)
        if (!allowance || (allowance as bigint) < amount) {
          toast.info("Approving cUSD...")
          await writeContractAsync({ address: cUSDAddress!, abi: ERC20_ABI, functionName: "approve", args: [FLIPEN_PROXY_ADDRESS as `0x${string}`, amount] })
          await new Promise(resolve => setTimeout(resolve, 4000))
          await refetchAllowance()
        }
        hash = await writeContractAsync({ address: FLIPEN_PROXY_ADDRESS as `0x${string}`, abi: FLIPEN_ABI, functionName: "flipCoinERC20", args: [choice, amount, cUSDAddress!] })
      }
      toast.info("Bet placed! Confirming...")
      await publicClient.waitForTransactionReceipt({ hash })
      const playerGames = await publicClient.readContract({ address: FLIPEN_PROXY_ADDRESS as `0x${string}`, abi: FLIPEN_ABI, functionName: "getPlayerGames", args: [address] }) as bigint[]
      setPendingGameId(playerGames[playerGames.length - 1])
      setGameState("WAITING_BLOCK")
      toast.success("Coin is flipping! Wait for the next block to reveal.")
    } catch (error: any) {
      console.error(error)
      toast.error(error.shortMessage || "Transaction failed")
      setGameState("IDLE")
    }
  }, [selectedSide, address, selectedAsset, betAmount, writeContractAsync, allowance, cUSDAddress, refetchAllowance, publicClient])

  return (
    <div className="min-h-0 md:h-full flex flex-col">
      <div className="flex-1 md:overflow-y-auto">
        <div className="space-y-6 md:space-y-4 lg:space-y-3 p-4 md:p-3 lg:p-2">
          <div className="flex justify-center">
            <div className={`w-40 h-40 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-4xl font-bold transition-all duration-500 shadow-lg ${gameState !== "IDLE" ? 'animate-bounce' : 'hover:scale-105'}`}>
              {gameState === "COMMITTING" || gameState === "REVEALING" ? <Loader2 className="w-12 h-12 text-white animate-spin" /> : 
               gameState === "WAITING_BLOCK" ? <Sparkles className="w-12 h-12 text-white animate-pulse" /> : 
               gameResult ? <span className="drop-shadow-lg">{gameResult.result === "heads" ? "👑" : "💰"}</span> : 
               <span className="drop-shadow-lg text-white">?</span>}
            </div>
          </div>
          {gameResult && (
            <Card className="bg-card/80 backdrop-blur-sm border-gold/20 mx-auto max-w-sm text-center p-6">
              <div className={`text-2xl font-bold mb-2 ${gameResult.won ? 'text-green-400' : 'text-red-400'}`}>{gameResult.won ? '🎉 WON!' : '💔 LOST'}</div>
              <div className="text-muted-foreground mb-4 text-sm">Result: <span className="font-semibold text-foreground">{gameResult.result.toUpperCase()}</span></div>
              {gameResult.won && <div className="text-2xl font-bold text-green-400 mb-4">+{gameResult.payout} {selectedAsset}</div>}
              <Button onClick={() => { setGameResult(null); setSelectedSide(null); }} variant="outline" className="border-gold/30 hover:bg-gold/10 text-xs h-8">Play Again</Button>
            </Card>
          )}
          {gameState === "IDLE" && !gameResult && (
            <>
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <Button variant={selectedSide === "heads" ? "default" : "outline"} onClick={() => setSelectedSide("heads")} className={`h-20 ${selectedSide === "heads" ? 'bg-gold text-black' : 'border-gold/30'}`}><div className="flex flex-col"><span className="text-2xl">👑</span><span className="font-bold">HEADS</span></div></Button>
                <Button variant={selectedSide === "tails" ? "default" : "outline"} onClick={() => setSelectedSide("tails")} className={`h-20 ${selectedSide === "tails" ? 'bg-gold text-black' : 'border-gold/30'}`}><div className="flex flex-col"><span className="text-2xl">💰</span><span className="font-bold">TAILS</span></div></Button>
              </div>
              <Card className="bg-card/80 border-gold/20 max-w-sm mx-auto p-4 space-y-4">
                <div className="flex justify-between items-center text-xs"><label className="text-cyan-400 font-bold uppercase">Asset</label><Badge variant="outline" className="text-[10px]">{currentAsset.network}</Badge></div>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}><SelectTrigger className="border-gold/30"><SelectValue /></SelectTrigger><SelectContent>{currentAssets.map(a => <SelectItem key={a.symbol} value={a.symbol}>{a.icon} {a.symbol} ({a.balance})</SelectItem>)}</SelectContent></Select>
                <div className="flex justify-between items-center text-xs">
                  <label className="text-cyan-400 font-bold uppercase">Bet Amount</label>
                  <div className="text-right"><span className="font-bold text-gold block">{betAmount[0].toFixed(2)} {selectedAsset}</span><span className="text-[10px] text-muted-foreground">Available: {currentAsset.balance}</span></div>
                </div>
                <Slider value={betAmount} onValueChange={setBetAmount} max={10} min={0.01} step={0.01} />
                <div className="grid grid-cols-4 gap-2">{[0.5, 2, 5, 10].map(m => <Button key={m} variant="outline" size="sm" onClick={() => setBetAmount([Math.max(0.01, betAmount[0] * m)])} className="text-[10px] h-7">{m < 1 ? `÷${1/m}` : `×${m}`}</Button>)}</div>
              </Card>
            </>
          )}
          {gameState === "WAITING_BLOCK" && (
            <div className="text-center space-y-4 py-8">
              <div className="text-xl font-bold text-gold animate-pulse uppercase">Coin is in the air!</div>
              <p className="text-muted-foreground text-xs italic px-4">Blockchain magic is happening. The next block will determine your fate.</p>
              <Button onClick={() => pendingGameId && resolveGame(pendingGameId)} className="bg-green-600 hover:bg-green-700 text-white font-bold h-16 w-full max-w-sm shadow-xl animate-bounce">CATCH THE COIN!</Button>
            </div>
          )}
        </div>
      </div>
      {gameState === "IDLE" && !gameResult && (
        <div className="p-4 border-t border-gold/20 sticky bottom-0 bg-background/80 backdrop-blur-sm">
          <Button onClick={flipCoin} disabled={!selectedSide || !isConnected} className="w-full h-16 bg-gradient-to-r from-cyan-500 to-blue-600 text-xl font-bold"><Coins className="mr-2 h-6 w-6" /> FLIP COIN</Button>
        </div>
      )}
    </div>
  )
}
