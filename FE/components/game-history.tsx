"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink, History, Loader2, User, Globe, RefreshCcw } from "lucide-react"
import { useAccount, usePublicClient } from "wagmi"
import { formatUnits, decodeEventLog } from "viem"
import { FLIPEN_ADDRESSES } from "@/contracts/addresses"
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json"
import MAINNET_ABI from "@/contracts/celo-abi.json"

export function GameHistory() {
  const { address, chainId, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [activeTab, setActiveTab] = useState("global")
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const proxyAddress = useMemo(() => chainId ? FLIPEN_ADDRESSES[chainId] : undefined, [chainId])
  const contractABI = useMemo(() => chainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI, [chainId])

  const fetchHistory = async () => {
    if (!publicClient || !proxyAddress) return
    setIsLoading(true)
    try {
      // Get the current block
      const currentBlock = await publicClient.getBlockNumber()

      // Fetch the last 10,000 blocks worth of events (lean chunk)
      const eventLogs = await publicClient.getLogs({
        address: proxyAddress,
        event: {
          "type": "event",
          "name": "GameResult",
          "inputs": [
            { "type": "uint256", "name": "requestId", "indexed": true },
            { "type": "address", "name": "player", "indexed": true },
            { "type": "uint256", "name": "amount", "indexed": false },
            { "type": "uint8", "name": "playerChoice", "indexed": false },
            { "type": "uint8", "name": "result", "indexed": false },
            { "type": "bool", "name": "won", "indexed": false },
            { "type": "uint256", "name": "payout", "indexed": false },
            { "type": "uint256", "name": "randomNumber", "indexed": false },
            { "type": "uint256", "name": "timestamp", "indexed": false },
            { "type": "address", "name": "token", "indexed": false }
          ]
        },
        args: activeTab === "personal" ? { player: address } : {},
        fromBlock: currentBlock - BigInt(10000), // Fetch from recent history only for speed
        toBlock: 'latest'
      })

      const parsedLogs = eventLogs.map(log => {
        const decoded = decodeEventLog({
          abi: contractABI as any,
          data: log.data,
          topics: log.topics,
        }) as any
        return {
          ...decoded.args,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        }
      }).reverse() // Most recent first

      setLogs(parsedLogs)
    } catch (error) {
      console.error("Failed to fetch history:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [activeTab, chainId, address, proxyAddress])

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-gold/10 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-gold/5">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gold" />
          <CardTitle className="text-lg font-black tracking-tighter">GAME HISTORY</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchHistory} disabled={isLoading} className={isLoading ? "animate-spin" : ""}>
          <RefreshCcw className="w-4 h-4 text-gold" />
        </Button>
      </CardHeader>

      <Tabs defaultValue="global" className="w-full" onValueChange={setActiveTab}>
        <div className="px-6 pt-4">
          <div className="flex bg-muted/20 p-1 rounded-xl border border-gold/10">
            <button
              onClick={() => setActiveTab("global")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "global" ? 'bg-gold text-black shadow-lg' : 'text-muted-foreground hover:text-gold'}`}
            >
              <Globe className="w-3.5 h-3.5" /> GLOBAL
            </button>
            <button
              onClick={() => setActiveTab("personal")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "personal" ? 'bg-gold text-black shadow-lg' : 'text-muted-foreground hover:text-gold'}`}
            >
              <User className="w-3.5 h-3.5" /> MY BETS
            </button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="min-h-[400px] overflow-x-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
                <p className="text-xs font-bold text-muted-foreground animate-pulse">SCANNING BLOCKCHAIN...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-gold/5 flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-gold/20" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">NO GAMES FOUND</p>
                <p className="text-[10px] text-muted-foreground max-w-[200px] mt-1">Be the first to flip on this network!</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-gold/5 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase font-black text-gold/50">Player</TableHead>
                    <TableHead className="text-[10px] uppercase font-black text-gold/50">Bet</TableHead>
                    <TableHead className="text-[10px] uppercase font-black text-gold/50">Side</TableHead>
                    <TableHead className="text-[10px] uppercase font-black text-gold/50">Result</TableHead>
                    <TableHead className="text-[10px] uppercase font-black text-gold/50 text-right">Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((game, i) => (
                    <TableRow key={i} className="border-gold/5 hover:bg-gold/5 transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold tracking-tighter">
                            {game.player.substring(0, 6)}...{game.player.substring(38)}
                          </span>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1 group-hover:text-gold transition-colors">
                            VIEW TX <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-black">{parseFloat(formatUnits(game.amount, 18)).toFixed(2)}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{game.token === "0x0000000000000000000000000000000000000000" ? 'CELO' : 'cUSD'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] border-gold/20 bg-gold/5 font-bold">
                          {game.playerChoice === 1 ? '👑 HEADS' : '💰 TAILS'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] font-black ${game.won ? 'bg-green-500 text-black' : 'bg-red-500/20 text-red-400 border-red-500/20'}`}>
                          {game.won ? 'WIN' : 'LOSS'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-black ${game.won ? 'text-green-400' : 'text-muted-foreground opacity-50'}`}>
                          {game.won ? `+${parseFloat(formatUnits(game.payout, 18)).toFixed(2)}` : '0.00'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Tabs>
    </Card>
  )
}
