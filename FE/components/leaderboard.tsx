"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trophy, User, Loader2, RefreshCcw, TrendingUp, Sparkles } from "lucide-react"
import { useAccount } from "wagmi"
import { formatUnits } from "viem"
import { useFlipenData } from "./data-provider"

export function Leaderboard() {
  const { address: userAddress } = useAccount()
  const { activities, isSyncing, refresh } = useFlipenData()

  const leaders = useMemo(() => {
    const playerMap = new Map<string, { address: string, volume: bigint, wins: number, games: number }>()

    activities.forEach(act => {
      if (act.status !== 'RESOLVED') return
      // Only count actual flips
      if (!act.method.includes('flip')) return

      const player = act.player
      const current = playerMap.get(player) || { address: player, volume: BigInt(0), wins: 0, games: 0 }

      playerMap.set(player, {
        address: player,
        volume: current.volume + BigInt(act.amount),
        wins: current.wins + (act.won ? 1 : 0),
        games: current.games + 1
      })
    })

    return Array.from(playerMap.values())
      .sort((a, b) => (b.volume > a.volume ? 1 : -1))
  }, [activities])

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-gold/10 shadow-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-gold/5 bg-gold/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center border border-gold/20 shadow-lg shadow-gold/10">
            <Trophy className="w-6 h-6 text-gold" />
          </div>
          <div>
            <CardTitle className="text-xl font-black tracking-tight">HALL OF FAME</CardTitle>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Every Participant Ranked</p>
          </div>
        </div>
        <button
          onClick={() => refresh()}
          disabled={isSyncing}
          className={`p-2 rounded-lg hover:bg-gold/10 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
        >
          <RefreshCcw className="w-4 h-4 text-gold" />
        </button>
      </CardHeader>

      <CardContent className="p-0">
        {isSyncing && activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
            <p className="text-xs font-black text-gold/50 tracking-widest uppercase">Auditing All Transactions...</p>
          </div>
        ) : leaders.length === 0 ? (
          <div className="py-20 text-center px-6">
            <TrendingUp className="w-12 h-12 text-gold/10 mx-auto mb-4" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No Legendaries Found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30 border-b border-gold/5">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[80px] text-[10px] font-black uppercase text-gold/50 text-center">Rank</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-gold/50">Player</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-gold/50 text-center">Total Flips</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-gold/50 text-right pr-6">Volume (CELO/cUSD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaders.map((leader, i) => {
                  const isMVP = i === 0;
                  const isCurrentUser = leader.address.toLowerCase() === userAddress?.toLowerCase();

                  return (
                    <TableRow
                      key={leader.address}
                      className={`border-gold/5 transition-all group ${isMVP ? 'bg-gold/10 hover:bg-gold/15' : 'hover:bg-gold/5'
                        } ${isCurrentUser ? 'border-l-2 border-l-gold' : ''}`}
                    >
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1">
                          {isMVP ? (
                            <div className="flex flex-col items-center">
                              <Sparkles className="w-3 h-3 text-gold animate-pulse mb-0.5" />
                              <div className="w-8 h-8 rounded-full bg-gold text-black flex items-center justify-center text-xs font-black shadow-[0_0_15px_rgba(218,165,32,0.5)]">MVP</div>
                            </div>
                          ) : (
                            <span className={`text-xs font-mono font-bold ${i < 3 ? 'text-gold' : 'text-muted-foreground'}`}>
                              #{i + 1}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isMVP ? 'bg-gold/20 border-gold' : 'bg-muted border-gold/10'}`}>
                            <User className={`w-4 h-4 ${isMVP ? 'text-gold' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs font-mono font-black tracking-tighter ${isMVP ? 'text-gold' : ''}`}>
                              {leader.address.substring(0, 6)}...{leader.address.substring(38)}
                            </span>
                            {isCurrentUser && <span className="text-[8px] text-gold font-bold uppercase tracking-widest">You</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${isMVP ? 'border-gold text-gold bg-gold/10' : 'border-gold/20'} text-[10px] font-black`}>
                          {leader.games}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex flex-col">
                          <span className={`text-sm font-black ${isMVP ? 'text-gold text-base' : ''}`}>
                            {parseFloat(formatUnits(leader.volume, 18)).toFixed(2)}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-bold tracking-tighter uppercase opacity-60">Volume (Mixed)</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// 