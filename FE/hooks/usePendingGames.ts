"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAccount, usePublicClient, useWriteContract } from "wagmi"
import { FLIPEN_ADDRESSES } from "@/contracts/addresses"
import MAINNET_ABI from "@/contracts/celo-abi.json"
import SEPOLIA_ABI from "@/contracts/sepolia-abi.json"
import { useFlipenData } from "@/components/data-provider"
import { toast } from "sonner"

export function usePendingGames() {
  const { address, chainId } = useAccount()
  const { activities, refresh } = useFlipenData()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  
  const [checking, setChecking] = useState(false)

  const activeChainId = chainId || 42220
  const proxyAddress = FLIPEN_ADDRESSES[activeChainId]
  const contractABI = activeChainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI

  // Filter user's pending games
  const userPendingGames = useMemo(() => {
    if (!address) return []
    return activities.filter(a => 
      a.player.toLowerCase() === address.toLowerCase() && 
      a.status === 'PENDING'
    )
  }, [activities, address])

  const checkAndFix = useCallback(async () => {
    if (userPendingGames.length === 0 || checking) return
    setChecking(true)

    for (const game of userPendingGames) {
      try {
        const res = await fetch('/api/check-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: game.requestId, chainId: activeChainId })
        })
        const data = await res.json()

        if (data.success) {
          // If contract status is already resolved but FE didn't know
          if (data.status !== 0) {
            refresh()
            continue
          }

          // If ready to resolve, try silent background resolution
          if (data.canResolve && !data.isExpired) {
             // We won't silent call writeContract (it requires signature)
             // but we will notify the user
          }
        }
      } catch (e) {
        console.error("Failed to check game", game.requestId)
      }
    }
    setChecking(false)
  }, [userPendingGames, activeChainId, checking, refresh])

  useEffect(() => {
    const timer = setInterval(checkAndFix, 15000) // Check every 15s
    return () => clearInterval(timer)
  }, [checkAndFix])

  return {
    pendingCount: userPendingGames.length,
    pendingGames: userPendingGames
  }
}
