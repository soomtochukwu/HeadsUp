"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExternalLink, History, Loader2, User, RefreshCcw, ShieldAlert, CheckCircle2 } from "lucide-react"
import { formatUnits } from "viem"
import { useFlipenData } from "./data-provider"

export function GameHistory() {
  const { activities, isSyncing, refresh } = useFlipenData()

  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => b.blockNumber - a.blockNumber)
  }, [activities])

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-gold/10 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-gold/5">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gold" />
          <CardTitle className="text-lg font-black tracking-tighter uppercase">Chronicles</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refresh()} disabled={isSyncing} className={isSyncing ? "animate-spin" : ""}>
          <RefreshCcw className="w-4 h-4 text-gold" />
        </Button>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="min-h-[400px] overflow-x-auto">
          {isSyncing && activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-gold animate-spin" />
              <p className="text-xs font-bold text-muted-foreground animate-pulse uppercase">Auditing Blockchain...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <p className="text-sm font-bold text-muted-foreground">NO RECORDS FOUND</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-gold/5 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase font-black text-gold/50">Player</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-gold/50 text-center">Action</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-gold/50 text-center">Bet</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-gold/50 text-center">Status</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-gold/50 text-right pr-6">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedActivities.map((act) => (
                  <TableRow key={act.txHash} className={`border-gold/5 transition-colors group ${act.status === 'FAILED' ? 'opacity-60 grayscale' : ''}`}>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold tracking-tighter">
                          {act.player.substring(0, 6)}...{act.player.substring(38)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(act.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-bold uppercase ${act.status === 'FAILED' ? 'text-red-400' : 'text-foreground'}`}>
                          {act.method === 'flipCoin' || act.method === 'flipCoinERC20' ? 'Flip' : act.method}
                        </span>
                        {act.status !== 'FAILED' && act.method.includes('flip') && (
                          <Badge variant="outline" className="text-[8px] h-4 px-1 border-gold/20 leading-none">
                            {act.playerChoice === 1 ? '👑 HEADS' : '💰 TAILS'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-black">{parseFloat(formatUnits(BigInt(act.amount), 18)).toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {act.status === 'FAILED' ? (
                          <div className="flex items-center gap-1 text-red-400">
                            <ShieldAlert className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase">Reverted</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase">Success</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex flex-col items-end">
                        {act.status === 'FAILED' ? (
                          <span className="text-[10px] text-red-400 font-bold uppercase">Gas Wasted</span>
                        ) : act.won ? (
                          <span className="text-xs font-black text-green-400">+{parseFloat(formatUnits(BigInt(act.payout), 18)).toFixed(2)}</span>
                        ) : (
                          <span className="text-xs font-black text-muted-foreground opacity-50">0.00</span>
                        )}
                        <a 
                          href={`https://celoscan.io/tx/${act.txHash}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[8px] text-muted-foreground hover:text-gold flex items-center gap-0.5"
                        >
                          EXPLORER <ExternalLink className="w-2 h-2" />
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
