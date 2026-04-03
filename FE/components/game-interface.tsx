"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Coins, Zap, TrendingUp, Sparkles, RotateCcw, Loader2, AlertCircle, ShieldCheck } from "lucide-react"
import { useAccount, useWriteContract, useBalance, useReadContract, usePublicClient } from "wagmi"
import { parseEther, parseUnits, formatUnits, decodeEventLog } from "viem"
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
  { "type": "function", "name": "getGameDetails", "stateMutability": "view", "inputs": [{ "type": "uint256", "name": "requestId" }], "outputs": [{ "type": "tuple", "components": [{ "type": "address", "name": "player" }, { "type": "uint256", "name": "amount" }, { "type": "uint8", "name": "playerChoice" }, { "type": "uint8", "name": "status" }, { "type": "bool", "name": "won" }, { "type": "uint256", "name": "timestamp" }, { "type": "uint256", "name": "commitBlock" }, { "type": "uint256", "name": "randomNumber" }, { "type": "uint8", "name": "coinResult" }, { "type": "address", "name": "token" }] }] },
  { "type": "event", "name": "GameResult", "inputs": [{ "type": "uint256", "name": "requestId", "indexed": true }, { "type": "address", "name": "player", "indexed": true }, { "type": "uint256", "name": "amount", "indexed": false }, { "type": "uint8", "name": "playerChoice", "indexed": false }, { "type": "uint8", "name": "result", "indexed": false }, { "type": "bool", "name": "won", "indexed": false }, { "type": "uint256", "name": "payout", "indexed": false }, { "type": "uint256", "name": "randomNumber", "indexed": false }, { "type": "uint256", "name": "timestamp", "indexed": false }, { "type": "address", "name": "token", "indexed": false }] }
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
  const { data: contractCeloBalance } = useBalance({ address: FLIPEN_PROXY_ADDRESS as `0x${string}`, query: { refetchInterval: 15000 } })
  const { data: contractCusdBalanceRaw } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [FLIPEN_PROXY_ADDRESS as `0x${string}`],
    query: { enabled: !!cUSDAddress, refetchInterval: 15000 }
  })

  const { writeContractAsync } = useWriteContract()
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: cUSDAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && FLIPEN_PROXY_ADDRESS ? [address, FLIPEN_PROXY_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: !!address && !!cUSDAddress && selectedAsset === "cUSD" }
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

  const currentAssets = useMemo(() => {
    const formatStr = (val: any, dec = 18) => formatValue(val, dec).toFixed(4)
    return [
      { symbol: "CELO", name: "Celo", icon: "◊", balance: formatStr(celoBalance), network: chain?.name || "Celo" },
      { symbol: "cUSD", name: "Celo Dollar", icon: "$", balance: formatStr(cusdBalanceRaw), network: chain?.name || "Celo", address: cUSDAddress },
    ]
  }, [celoBalance, cusdBalanceRaw, chain, cUSDAddress])

  const currentAsset = currentAssets.find(asset => asset.symbol === selectedAsset) || currentAssets[0]

  const resolveGame = useCallback(async (gameId: bigint) => {
    if (!publicClient) return
    try {
      setGameState("REVEALING")
      const hash = await writeContractAsync({
        address: FLIPEN_PROXY_ADDRESS as `0x${string}`,
        abi: FLIPEN_ABI,
        functionName: "resolveGame",
        args: [gameId],
      })
      
      toast.info("Revealing coin...")
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      // PARSE THE EVENT LOG FOR RELIABLE RESULT
      let won = false
      let coinResult = 0
      let payout = "0.0000"

      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: FLIPEN_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (event.eventName === 'GameResult') {
            const args = event.args as any
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
        toast.success(`🎉 YOU WON! Received ${payout} ${selectedAsset}`)
      } else {
        toast.error("💔 Hard luck! Try again?")
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.shortMessage || "Resolution failed")
      setGameState("WAITING_BLOCK")
    }
  }, [writeContractAsync, publicClient, selectedAsset])

  const flipCoin = useCallback(async () => {
    if (!selectedSide || !address || !publicClient) return
    if (!canAffordPayout) {
      toast.error("Contract bankroll is too low for this bet. Please lower your amount.")
      return
    }

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
      
      // Get the gameId from the logs
      const playerGames = await publicClient.readContract({ address: FLIPEN_PROXY_ADDRESS as `0x${string}`, abi: FLIPEN_ABI, functionName: "getPlayerGames", args: [address] }) as bigint[]
      setPendingGameId(playerGames[playerGames.length - 1])
      setGameState("WAITING_BLOCK")
      toast.success("Coin is flipping! Wait for the next block to reveal.")
    } catch (error: any) {
      console.error(error)
      toast.error(error.shortMessage || "Transaction failed")
      setGameState("IDLE")
    }
  }, [selectedSide, address, selectedAsset, betAmount, writeContractAsync, allowance, cUSDAddress, refetchAllowance, publicClient, canAffordPayout])

  return (
    <div className="min-h-0 md:h-full flex flex-col">
      <div className="flex-1 md:overflow-y-auto">
        <div className="space-y-6 md:space-y-4 lg:space-y-3 p-4 md:p-3 lg:p-2">
          {/* Animation View */}
          <div className="flex justify-center">
            <div className={`w-40 h-40 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-4xl font-bold transition-all duration-500 shadow-lg ${gameState !== "IDLE" ? 'animate-bounce' : 'hover:scale-105'}`}>
              {gameState === "COMMITTING" || gameState === "REVEALING" ? <Loader2 className="w-12 h-12 text-white animate-spin" /> : 
               gameState === "WAITING_BLOCK" ? <Sparkles className="w-12 h-12 text-white animate-pulse" /> : 
               gameResult ? <span className="drop-shadow-lg">{gameResult.result === "heads" ? "👑" : "💰"}</span> : 
               <span className="drop-shadow-lg text-white">?</span>}
            </div>
          </div>

          {gameResult && (
            <Card className="bg-card/80 backdrop-blur-sm border-gold/20 mx-auto max-w-sm text-center p-6 shadow-2xl">
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
                <Button variant={selectedSide === "heads" ? "default" : "outline"} onClick={() => setSelectedSide("heads")} className={`h-20 ${selectedSide === "heads" ? 'bg-gold text-black border-gold' : 'border-gold/30'}`}><div className="flex flex-col"><span className="text-2xl">👑</span><span className="font-bold">HEADS</span></div></Button>
                <Button variant={selectedSide === "tails" ? "default" : "outline"} onClick={() => setSelectedSide("tails")} className={`h-20 ${selectedSide === "tails" ? 'bg-gold text-black border-gold' : 'border-gold/30'}`}><div className="flex flex-col"><span className="text-2xl">💰</span><span className="font-bold">TAILS</span></div></Button>
              </div>

              <Card className="bg-card/80 border-gold/20 max-w-sm mx-auto p-4 space-y-4">
                <div className="flex justify-between items-center text-xs"><label className="text-cyan-400 font-bold uppercase">Asset</label><Badge variant="outline" className="text-[10px]">{currentAsset.network}</Badge></div>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}><SelectTrigger className="border-gold/30 h-10"><SelectValue /></SelectTrigger><SelectContent>{currentAssets.map(a => <SelectItem key={a.symbol} value={a.symbol}>{a.icon} {a.symbol} ({a.balance})</SelectItem>)}</SelectContent></Select>
                
                <div className="flex justify-between items-center text-xs">
                  <label className="text-cyan-400 font-bold uppercase">Bet Amount</label>
                  <div className="text-right"><span className="font-bold text-gold block">{betAmount[0].toFixed(2)} {selectedAsset}</span><span className="text-[10px] text-muted-foreground">Available: {currentAsset.balance}</span></div>
                </div>
                <Slider value={betAmount} onValueChange={setBetAmount} max={10} min={0.01} step={0.01} />
                
                <div className="pt-2 border-t border-gold/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {canAffordPayout ? <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">House Bankroll</span>
                  </div>
                  <span className={`text-[10px] font-mono ${canAffordPayout ? 'text-green-400' : 'text-red-400'}`}>{bankroll.toFixed(2)} {selectedAsset}</span>
                </div>
              </Card>
            </>
          )}

          {gameState === "WAITING_BLOCK" && (
            <div className="text-center space-y-4 py-8">
              <div className="text-xl font-bold text-gold animate-pulse uppercase">Coin is in the air!</div>
              <p className="text-muted-foreground text-xs italic px-4">Blockchain magic is happening. The next block will determine your fate.</p>
              <Button onClick={() => pendingGameId && resolveGame(pendingGameId)} className="bg-green-600 hover:bg-green-700 text-white font-black h-20 w-full max-w-sm shadow-xl animate-bounce text-xl">CATCH THE COIN!</Button>
            </div>
          )}
        </div>
      </div>

      {gameState === "IDLE" && !gameResult && (
        <div className="p-4 border-t border-gold/20 sticky bottom-0 bg-background/80 backdrop-blur-sm">
          <Button onClick={flipCoin} disabled={!selectedSide || !isConnected || !canAffordPayout} className={`w-full h-16 text-xl font-bold ${!canAffordPayout ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg'}`}>
            <Coins className="mr-2 h-6 w-6" /> {canAffordPayout ? 'FLIP COIN' : 'INSUFFICIENT BANKROLL'}
          </Button>
        </div>
      )}
    </div>
  )
}
