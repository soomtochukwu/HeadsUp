"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Activity, Wallet, RefreshCw } from "lucide-react"
import { useAccount, useBalance } from "wagmi"
import { formatUnits } from "viem"
import { FLIPEN_ADDRESSES } from "@/contracts/addresses"
import { useFlipenData } from "./data-provider"

export function StatsPanel() {
  const { chainId, isConnected } = useAccount()
  const { totalGames, totalVolume, isSyncing } = useFlipenData()
  const proxyAddress = useMemo(() => chainId ? FLIPEN_ADDRESSES[chainId] : undefined, [chainId])

  // Fetch Live Bankroll (CELO)
  const { data: bankroll, isLoading: bankrollLoading } = useBalance({
    address: proxyAddress,
    query: {
      enabled: !!proxyAddress,
      refetchInterval: 10000
    }
  })

  const bankrollValue = useMemo(() => {
    if (!bankroll) return "0.00"
    return parseFloat(formatUnits(bankroll.value, bankroll.decimals)).toFixed(2)
  }, [bankroll])

  const statItems = [
    {
      title: "Total Games",
      value: isSyncing ? "..." : totalGames.toString(),
      description: "Community Flips",
      icon: Activity,
      color: "text-blue-400",
    },
    {
      title: "Total Volume",
      value: isSyncing ? "..." : `${parseFloat(totalVolume).toFixed(2)} CELO`,
      description: "Wagered on-chain",
      icon: TrendingUp,
      color: "text-green-400",
    },
    {
      title: "House Bankroll",
      value: bankrollLoading ? "..." : `${bankrollValue} CELO`,
      description: "Available Payouts",
      icon: Wallet,
      color: "text-gold",
    },
  ]

  return (
    <div className="grid gap-4 h-full">
      {statItems.map((stat, i) => (
        <Card key={i} className="bg-card/80 backdrop-blur-sm border-gold/10 hover:border-gold/30 transition-all duration-300 group shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color} group-hover:scale-110 transition-transform`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight mb-1">{stat.value}</div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
      
      {/* Live Sync Indicator */}
      <Card className="bg-gold/5 border-gold/20 shadow-xl overflow-hidden relative group">
        <div className="absolute top-0 left-0 w-1 h-full bg-gold" />
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center ${isSyncing ? 'animate-spin' : ''}`}>
            {isSyncing ? <RefreshCw className="w-4 h-4 text-gold" /> : <Activity className="w-4 h-4 text-gold" />}
          </div>
          <div>
            <div className="text-[10px] font-bold text-gold uppercase tracking-tighter">
              {isSyncing ? "Syncing History" : "On-Chain Sync"}
            </div>
            <div className="text-xs font-medium text-foreground">
              {isConnected ? (isSyncing ? "Indexing events..." : "Real-time Ready") : "Connect wallet"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
