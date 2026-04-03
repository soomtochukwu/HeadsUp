"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trophy, Medal, User, Loader2, RefreshCcw, TrendingUp } from "lucide-react"
import { useAccount, usePublicClient } from "wagmi"
import { formatUnits, decodeEventLog } from "viem"
import { FLIPEN_ADDRESSES } from "@/contracts/addresses"
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json"
import MAINNET_ABI from "@/contracts/celo-abi.json"

export function Leaderboard() {
  const { chainId } = useAccount()
  const publicClient = usePublicClient()
  const [leaders, setLeaders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const proxyAddress = useMemo(() => chainId ? FLIPEN_ADDRESSES[chainId] : undefined, [chainId])
  const contractABI = useMemo(() => chainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI, [chainId])

  const buildLeaderboard = async () => {
    if (!publicClient || !proxyAddress) return
    setIsLoading(true)
    try {
      const currentBlock = await publicClient.getBlockNumber()
      
      // Fetch a larger range for the leaderboard (last 50,000 blocks)
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
        fromBlock: currentBlock - BigInt(50000), 
        toBlock: 'latest'
      })

      // Aggregate stats by player
      const playerMap = new Map<string, { address: string, volume: bigint, wins: number, games: number }>()

      eventLogs.forEach(log => {
        const decoded = decodeEventLog({
          abi: contractABI as any,
          data: log.data,
          topics: log.topics,
        }) as any
        const args = decoded.args
        const player = args.player
        
        const current = playerMap.get(player) || { address: player, volume: BigInt(0), wins: 0, games: 0 }
        
        playerMap.set(player, {
          address: player,
          volume: current.volume + BigInt(args.amount),
          wins: current.wins + (args.won ? 1 : 0),
          games: current.games + 1
        })
      })

      // Sort by volume and convert to array
      const sortedLeaders = Array.from(playerMap.values())
        .sort((a, b) => Number(b.volume - a.volume))
        .slice(0, 10) // Top 10 only

      setLeaders(sortedLeaders)
    } catch (error) {
      console.error("Failed to build leaderboard:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    buildLeaderboard()
  }, [chainId, proxyAddress])

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-gold/10 shadow-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gold/5 bg-gold/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center border border-gold/20 shadow-lg shadow-gold/10">
            <Trophy className="w-6 h-6 text-gold" />
          </div>
          <div>
            <CardTitle className="text-xl font-black tracking-tight">TOP FLIPPERS</CardTitle>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Protocol Legends</p>
          </div>
        </div>
        <button 
          onClick={buildLeaderboard} 
          disabled={isLoading}
          className={`p-2 rounded-lg hover:bg-gold/10 transition-colors ${isLoading ? 'animate-spin' : ''}`}
        >
          <RefreshCcw className="w-4 h-4 text-gold" />
        </button>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
            <p className="text-xs font-black text-gold/50 tracking-widest uppercase">Analyzing Rankings...</p>
          </div>
        ) : leaders.length === 0 ? (
          <div className="py-20 text-center">
            <TrendingUp className="w-12 h-12 text-gold/10 mx-auto mb-4" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No Legends Yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30 border-b border-gold/5">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[60px] text-[10px] font-black uppercase text-gold/50 text-center italic">Rank</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-gold/50">Player</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-gold/50 text-center">Games</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-gold/50 text-right pr-6">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaders.map((leader, i) => (
                  <TableRow key={leader.address} className="border-gold/5 hover:bg-gold/5 transition-all group">
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {i === 0 ? (
                          <div className="w-7 h-7 rounded-full bg-gold text-black flex items-center justify-center text-xs font-black shadow-lg shadow-gold/20">1</div>
                        ) : i === 1 ? (
                          <div className="w-7 h-7 rounded-full bg-slate-300 text-black flex items-center justify-center text-xs font-black shadow-lg shadow-slate-300/20">2</div>
                        ) : i === 2 ? (
                          <div className="w-7 h-7 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-amber-700/20">3</div>
                        ) : (
                          <span className="text-xs font-mono font-bold text-muted-foreground">#{i + 1}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-gold/10">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="text-xs font-mono font-black tracking-tighter">
                          {leader.address.substring(0, 6)}...{leader.address.substring(38)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-gold/5 border-gold/20 text-[10px] font-black">
                        {leader.games}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gold">
                          {parseFloat(formatUnits(leader.volume, 18)).toFixed(2)}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">CELO/cUSD</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
