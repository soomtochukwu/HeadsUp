"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAccount, usePublicClient, useReadContract } from "wagmi"
import { decodeEventLog, formatUnits, getAddress } from "viem"
import { FLIPEN_ADDRESSES } from "@/contracts/addresses"
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json"
import MAINNET_ABI from "@/contracts/celo-abi.json"

export interface SavedGameEvent {
  requestId: string
  player: string
  amount: string
  playerChoice: number
  result: number | null
  won: boolean | null
  payout: string
  timestamp: number
  txHash: string
  blockNumber: number
  token: string
  status: 'PENDING' | 'RESOLVED'
  method: string
  chainId: number
}

interface FlipenData {
  activities: SavedGameEvent[]
  totalVolume: string
  totalGames: number
  isSyncing: boolean
  refresh: () => Promise<void>
}

const FlipenDataContext = createContext<FlipenData | undefined>(undefined)

const SYNC_CHUNK_SIZE = BigInt(100000) 
const BIRTH_BLOCKS: Record<number, bigint> = {
  11142220: BigInt(22080000), 
  42220: BigInt(63290000),
}

export function FlipenDataProvider({ children }: { children: React.ReactNode }) {
  const { chainId } = useAccount()
  const publicClient = usePublicClient()
  const [activities, setActivities] = useState<SavedGameEvent[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const syncTaskRef = useRef<number>(0)
  const activitiesRef = useRef<Map<string, SavedGameEvent>>(new Map())

  const activeChainId = chainId || 42220 
  const proxyAddress = FLIPEN_ADDRESSES[activeChainId]
  const contractABI = activeChainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI

  const { data: contractStats, refetch: refetchContractStats } = useReadContract({
    address: proxyAddress,
    abi: contractABI as any,
    functionName: 'getContractStats',
    query: { enabled: !!proxyAddress, refetchInterval: 30000 }
  })

  const targetGameCount = useMemo(() => {
    if (!contractStats) return 0
    const stats = contractStats as readonly bigint[]
    return Number(stats[0])
  }, [contractStats])

  const sync = useCallback(async (isNetworkChange = false) => {
    if (!proxyAddress || !activeChainId || !publicClient) return
    
    const currentTaskId = ++syncTaskRef.current
    setIsSyncing(true)
    
    if (isNetworkChange) {
      activitiesRef.current = new Map()
      setActivities([])
    }

    try {
      const currentBlock = await publicClient.getBlockNumber()
      const birth = BIRTH_BLOCKS[activeChainId] || BigInt(0)
      
      let toBlock = currentBlock
      let fromBlock = toBlock - SYNC_CHUNK_SIZE
      if (fromBlock < birth) fromBlock = birth

      while (toBlock >= birth && currentTaskId === syncTaskRef.current) {
        console.log(`[GLOBAL-SYNC] Fetching all players from block ${fromBlock}`)
        
        const [reqLogs, resLogs] = await Promise.all([
          publicClient.getLogs({
            address: proxyAddress,
            event: { type: 'event', name: 'GameRequested', inputs: [{type:'uint256', name:'requestId', indexed:true},{type:'address', name:'player', indexed:true},{type:'uint256', name:'amount', indexed:false},{type:'uint8', name:'playerChoice', indexed:false},{type:'uint256', name:'commitBlock', indexed:false},{type:'address', name:'token', indexed:false}] },
            fromBlock, toBlock
          }),
          publicClient.getLogs({
            address: proxyAddress,
            event: { type: 'event', name: 'GameResult', inputs: [{type:'uint256', name:'requestId', indexed:true},{type:'address', name:'player', indexed:true},{type:'uint256', name:'amount', indexed:false},{type:'uint8', name:'playerChoice', indexed:false},{type:'uint8', name:'result', indexed:false},{type:'bool', name:'won', indexed:false},{type:'uint256', name:'payout', indexed:false},{type:'uint256', name:'randomNumber', indexed:false},{type:'uint256', name:'timestamp', indexed:false},{type:'address', name:'token', indexed:false}] },
            fromBlock, toBlock
          })
        ])

        reqLogs.forEach(log => {
          try {
            const decoded = decodeEventLog({ abi: contractABI as any, data: log.data, topics: log.topics }) as any
            const requestId = decoded.args.requestId.toString()
            // Always prefer existing RESOLVED data
            if (activitiesRef.current.get(requestId)?.status === 'RESOLVED') return

            activitiesRef.current.set(requestId, {
              requestId,
              player: decoded.args.player || getAddress(`0x${log.topics[2]!.slice(26)}`), 
              amount: decoded.args.amount.toString(),
              playerChoice: Number(decoded.args.playerChoice),
              result: null,
              won: null,
              payout: "0",
              timestamp: Math.floor(Date.now() / 1000), 
              txHash: log.transactionHash,
              blockNumber: Number(log.blockNumber),
              token: decoded.args.token,
              status: 'PENDING',
              method: 'flipCoin',
              chainId: activeChainId
            })
          } catch (e) {}
        })

        resLogs.forEach(log => {
          try {
            const decoded = decodeEventLog({ abi: contractABI as any, data: log.data, topics: log.topics }) as any
            const requestId = decoded.args.requestId.toString()
            
            activitiesRef.current.set(requestId, {
              requestId,
              player: decoded.args.player || getAddress(`0x${log.topics[2]!.slice(26)}`), 
              amount: decoded.args.amount.toString(),
              playerChoice: Number(decoded.args.playerChoice),
              result: Number(decoded.args.result),
              won: decoded.args.won,
              payout: decoded.args.payout.toString(),
              timestamp: Number(decoded.args.timestamp),
              txHash: log.transactionHash,
              blockNumber: Number(log.blockNumber),
              token: decoded.args.token,
              status: 'RESOLVED',
              method: 'flipCoin',
              chainId: activeChainId
            })
          } catch (e) {}
        })

        // Sync local state with the global ref Map
        setActivities(Array.from(activitiesRef.current.values()).sort((a, b) => b.blockNumber - a.blockNumber))

        if (fromBlock === birth) break
        toBlock = fromBlock - BigInt(1)
        fromBlock = toBlock - SYNC_CHUNK_SIZE
        if (fromBlock < birth) fromBlock = birth
      }

    } catch (e) {
      console.error("[GLOBAL-SYNC] Critical Failure:", e)
    } finally {
      if (currentTaskId === syncTaskRef.current) setIsSyncing(false)
    }
  }, [proxyAddress, activeChainId, contractABI, publicClient])

  useEffect(() => {
    if (!publicClient || !proxyAddress) return
    const handler = () => { refetchContractStats(); sync(false) }
    const unwatch1 = publicClient.watchContractEvent({ address: proxyAddress, abi: contractABI as any, eventName: 'GameResult', onLogs: handler })
    const unwatch2 = publicClient.watchContractEvent({ address: proxyAddress, abi: contractABI as any, eventName: 'GameRequested', onLogs: handler })
    return () => { unwatch1(); unwatch2() }
  }, [publicClient, proxyAddress, contractABI, sync, refetchContractStats])

  useEffect(() => {
    sync(true)
  }, [activeChainId, proxyAddress])

  const totalVolume = useMemo(() => {
    if (contractStats) {
      const stats = contractStats as readonly bigint[]
      return formatUnits(stats[1], 18)
    }
    return "0"
  }, [contractStats])

  return (
    <FlipenDataContext.Provider value={{ 
      activities, 
      totalVolume, 
      totalGames: targetGameCount || activities.length,
      isSyncing, 
      refresh: async () => {
        await refetchContractStats()
        await sync(true)
      } 
    }}>
      {children}
    </FlipenDataContext.Provider>
  )
}

export function useFlipenData() {
  const context = useContext(FlipenDataContext)
  if (context === undefined) throw new Error("useFlipenData error")
  return context
}
