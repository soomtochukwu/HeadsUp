"use client"

import { useMemo } from "react"
import { useAccount, useReadContract, useBalance } from "wagmi"
import { FLIPEN_ADDRESSES, TOKEN_ADDRESSES } from "@/contracts/addresses"

const ERC20_ABI = [
  { "type": "function", "name": "allowance", "stateMutability": "view", "inputs": [{ "type": "address", "name": "owner" }, { "type": "address", "name": "spender" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "balanceOf", "stateMutability": "view", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "decimals", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint8" }] }
] as const

export function useTokenData(selectedAsset: string) {
  const { address, chainId } = useAccount()
  const activeChainId = chainId || 42220
  const proxyAddress = FLIPEN_ADDRESSES[activeChainId]
  
  const tokenAddress = selectedAsset === "CELO" ? "0x0000000000000000000000000000000000000000" : TOKEN_ADDRESSES[activeChainId]?.[selectedAsset]

  // READ TOKEN DECIMALS
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!tokenAddress && selectedAsset !== "CELO", staleTime: Infinity }
  })

  const decimals = useMemo(() => {
    if (selectedAsset === "CELO") return 18
    return (tokenDecimals as number) || (selectedAsset === "USDC" || selectedAsset === "USDT" ? 6 : 18)
  }, [selectedAsset, tokenDecimals])

  // USER BALANCES
  const { data: celoWalletBalance, refetch: refetchCeloBalance } = useBalance({ 
    address, 
    query: { enabled: !!address && selectedAsset === "CELO", refetchInterval: 10000 } 
  })
  
  const { data: erc20WalletBalance, refetch: refetchErc20Balance } = useReadContract({ 
    address: tokenAddress as `0x${string}`, 
    abi: ERC20_ABI, 
    functionName: 'balanceOf', 
    args: address ? [address] : undefined, 
    query: { enabled: !!address && !!tokenAddress && selectedAsset !== "CELO", refetchInterval: 10000 } 
  })

  const userWalletBalance = useMemo(() => {
    if (selectedAsset === "CELO") {
      return celoWalletBalance ? { value: celoWalletBalance.value, decimals: celoWalletBalance.decimals } : undefined
    } else {
      return erc20WalletBalance !== undefined ? { value: erc20WalletBalance as bigint, decimals: Number(decimals) } : undefined
    }
  }, [selectedAsset, celoWalletBalance, erc20WalletBalance, decimals])

  const refetchUserBalance = () => {
    if (selectedAsset === "CELO") refetchCeloBalance()
    else refetchErc20Balance()
  }

  // CONTRACT BANKROLL
  const { data: contractCeloBalance } = useBalance({ 
    address: proxyAddress, 
    query: { enabled: !!proxyAddress && selectedAsset === "CELO", refetchInterval: 15000 } 
  })
  
  const { data: contractTokenBalanceRaw } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: proxyAddress ? [proxyAddress as `0x${string}`] : undefined,
    query: { enabled: !!tokenAddress && !!proxyAddress && selectedAsset !== "CELO", refetchInterval: 15000 }
  })

  const contractBankroll = useMemo(() => {
    if (selectedAsset === "CELO") {
      return contractCeloBalance ? { value: contractCeloBalance.value, decimals: contractCeloBalance.decimals } : undefined
    } else {
      return contractTokenBalanceRaw !== undefined ? { value: contractTokenBalanceRaw as bigint, decimals: Number(decimals) } : undefined
    }
  }, [selectedAsset, contractCeloBalance, contractTokenBalanceRaw, decimals])

  // ALLOWANCE
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ 
    address: tokenAddress as `0x${string}`, 
    abi: ERC20_ABI, 
    functionName: 'allowance', 
    args: address && proxyAddress ? [address, proxyAddress as `0x${string}`] : undefined, 
    query: { enabled: !!address && !!proxyAddress && selectedAsset !== "CELO" } 
  })

  return {
    proxyAddress,
    tokenAddress: tokenAddress as `0x${string}`,
    decimals,
    userWalletBalance,
    refetchUserBalance,
    contractBankroll,
    allowance,
    refetchAllowance
  }
}
