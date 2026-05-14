"use client"

import { useState, useMemo, useEffect } from "react"
import { Header } from "@/components/header"
import { AnimatedBackground } from "@/components/animated-background"
import { ThemeProvider } from "@/components/theme-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAccount, useReadContract, useWriteContract, usePublicClient, useBalance } from "wagmi"
import { parseEther, formatUnits, parseUnits } from "viem"
import { FLIPEN_ADDRESSES, TOKEN_ADDRESSES } from "@/contracts/addresses"
import { toast } from "sonner"
import { Wallet, TrendingUp, ArrowDownCircle, ArrowUpCircle, Info, Loader2, Landmark, Percent } from "lucide-react"

const BANKROLL_ABI = [
  { "type": "function", "name": "totalSharesToken", "stateMutability": "view", "inputs": [{ "name": "token", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "userSharesToken", "stateMutability": "view", "inputs": [{ "name": "token", "type": "address" }, { "name": "user", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "depositBankroll", "stateMutability": "payable", "inputs": [{ "name": "token", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "withdrawBankroll", "stateMutability": "nonpayable", "inputs": [{ "name": "token", "type": "address" }, { "name": "shares", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "getContractStats", "stateMutability": "view", "inputs": [{ "name": "token", "type": "address" }], "outputs": [{ "name": "totalGames", "type": "uint256" }, { "name": "volume", "type": "uint256" }, { "name": "balance", "type": "uint256" }, { "name": "fees", "type": "uint256" }] },
  { "type": "function", "name": "tokenDecimals", "stateMutability": "view", "inputs": [{ "name": "token", "type": "address" }], "outputs": [{ "type": "uint8" }] }
] as const

const ERC20_ABI = [
  { "type": "function", "name": "approve", "stateMutability": "nonpayable", "inputs": [{ "type": "address", "name": "spender" }, { "type": "uint256", "name": "amount" }], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "allowance", "stateMutability": "view", "inputs": [{ "type": "address", "name": "owner" }, { "type": "address", "name": "spender" }], "outputs": [{ "type": "uint256" }] }
] as const

export default function BankrollPage() {
  const { address, isConnected, chainId } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const [selectedAsset, setSelectedAsset] = useState("CELO")
  const [amount, setAmount] = useState("")
  const [isProcessing, setIsActioning] = useState(false)

  const activeChainId = chainId || 42220
  const proxyAddress = FLIPEN_ADDRESSES[activeChainId]
  const tokenAddress = selectedAsset === "CELO" ? "0x0000000000000000000000000000000000000000" : TOKEN_ADDRESSES[activeChainId]?.[selectedAsset]

  // Contract Data
  const { data: stats, refetch: refetchStats } = useReadContract({ address: proxyAddress, abi: BANKROLL_ABI, functionName: 'getContractStats', args: [tokenAddress as `0x${string}`], query: { enabled: !!proxyAddress } })
  const { data: totalShares, refetch: refetchTotalShares } = useReadContract({ address: proxyAddress, abi: BANKROLL_ABI, functionName: 'totalSharesToken', args: [tokenAddress as `0x${string}`], query: { enabled: !!proxyAddress } })
  const { data: userShares, refetch: refetchUserShares } = useReadContract({ address: proxyAddress, abi: BANKROLL_ABI, functionName: 'userSharesToken', args: [tokenAddress as `0x${string}`, address as `0x${string}`], query: { enabled: !!proxyAddress && !!address } })
  const { data: tokenDecimals } = useReadContract({ address: proxyAddress, abi: BANKROLL_ABI, functionName: 'tokenDecimals', args: [tokenAddress as `0x${string}`], query: { enabled: !!proxyAddress && selectedAsset !== "CELO" } })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance', args: address && proxyAddress ? [address, proxyAddress] : undefined, query: { enabled: !!address && !!proxyAddress && selectedAsset !== "CELO" } })
  
  const { data: userWalletBalance } = useBalance({ address, token: selectedAsset === "CELO" ? undefined : tokenAddress as `0x${string}`, query: { enabled: !!address } })

  const decimals = useMemo(() => selectedAsset === "CELO" ? 18 : (tokenDecimals || 18), [selectedAsset, tokenDecimals])
  
  const poolBalance = useMemo(() => stats ? (stats as any)[2] : BigInt(0), [stats])
  const poolVolume = useMemo(() => stats ? (stats as any)[1] : BigInt(0), [stats])

  const myPositionValue = useMemo(() => {
    if (!userShares || !totalShares || BigInt(totalShares as bigint) === BigInt(0)) return "0.0000"
    const val = (BigInt(userShares as bigint) * BigInt(poolBalance)) / BigInt(totalShares as bigint)
    return parseFloat(formatUnits(val, decimals)).toFixed(4)
  }, [userShares, totalShares, poolBalance, decimals])

  const assets = useMemo(() => {
    const base = ["CELO"]
    const tokens = TOKEN_ADDRESSES[activeChainId] ? Object.keys(TOKEN_ADDRESSES[activeChainId]).filter(k => k !== "cUSD") : []
    return [...base, ...tokens]
  }, [activeChainId])

  const handleDeposit = async () => {
    if (!address || !proxyAddress || !amount) return
    setIsActioning(true)
    try {
      const parsedAmount = parseUnits(amount, decimals)
      
      if (selectedAsset !== "CELO") {
        if (!allowance || (allowance as bigint) < parsedAmount) {
          toast.info(`Approving ${selectedAsset}...`)
          const approveHash = await writeContractAsync({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [proxyAddress, parsedAmount]
          })
          await publicClient?.waitForTransactionReceipt({ hash: approveHash })
          await refetchAllowance()
        }
      }

      toast.info("Depositing to bankroll...")
      const hash = await writeContractAsync({
        address: proxyAddress,
        abi: BANKROLL_ABI,
        functionName: "depositBankroll",
        args: [tokenAddress as `0x${string}`, parsedAmount],
        value: selectedAsset === "CELO" ? parsedAmount : undefined
      })
      await publicClient?.waitForTransactionReceipt({ hash })
      toast.success("Deposit successful! You are now part of the House.")
      setAmount("")
      refetchStats(); refetchTotalShares(); refetchUserShares();
    } catch (e: any) {
      toast.error(e.shortMessage || "Deposit failed")
    } finally {
      setIsActioning(false)
    }
  }

  const handleWithdraw = async () => {
    if (!address || !proxyAddress || !userShares || BigInt(userShares as bigint) === BigInt(0)) return
    setIsActioning(true)
    try {
      toast.info("Withdrawing from bankroll...")
      const hash = await writeContractAsync({
        address: proxyAddress,
        abi: BANKROLL_ABI,
        functionName: "withdrawBankroll",
        args: [tokenAddress as `0x${string}`, userShares as bigint]
      })
      await publicClient?.waitForTransactionReceipt({ hash })
      toast.success("Withdrawal successful!")
      refetchStats(); refetchTotalShares(); refetchUserShares();
    } catch (e: any) {
      toast.error(e.shortMessage || "Withdrawal failed")
    } finally {
      setIsActioning(false)
    }
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="golden-flip-theme">
      <div className="min-h-screen bg-background text-foreground relative flex flex-col h-[100dvh] overflow-hidden lg:pl-16">
        <AnimatedBackground />
        
        <div className="relative z-10 flex flex-col h-full">
          <Header balance="---" setIsCommentsSidebarOpen={() => {}} selectedAsset={selectedAsset} />

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="container max-w-5xl mx-auto space-y-8 pb-20">
              
              <div className="text-center space-y-4">
                <Badge variant="outline" className="border-gold text-gold px-4 py-1 rounded-full uppercase tracking-widest text-[10px] font-bold">
                  Community Bankroll
                </Badge>
                <h1 className="text-4xl md:text-6xl font-black text-gold-gradient font-mono tracking-tighter">
                  BECOME THE HOUSE
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                  Provide liquidity to the Flipen bankroll and earn yields from every game played on the platform.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-card/50 border-gold/10 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-gold" /> Total Value Locked
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-white">{parseFloat(formatUnits(poolBalance, decimals)).toFixed(2)} <span className="text-sm text-gold">{selectedAsset}</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Protocol Capacity</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-gold/10 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-gold" /> Total Volume
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-white">{parseFloat(formatUnits(poolVolume, decimals)).toFixed(2)} <span className="text-sm text-gold">{selectedAsset}</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Historical Activity</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-gold/10 backdrop-blur-sm border-gold/30 shadow-lg shadow-gold/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <Percent className="w-4 h-4 text-gold" /> Estimated Yield
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-green-400">~2.5% <span className="text-sm">per flip</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">House Edge Distribution</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-card/80 border-gold/20 shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gold" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpCircle className="w-5 h-5 text-gold" /> PROVIDE LIQUIDITY
                    </CardTitle>
                    <CardDescription>Select asset and amount to contribute.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-4 gap-2">
                      {assets.map(asset => (
                        <Button 
                          key={asset} 
                          variant={selectedAsset === asset ? "default" : "outline"}
                          className={`h-12 font-black ${selectedAsset === asset ? 'bg-gold text-black border-gold' : 'border-gold/20'}`}
                          onClick={() => setSelectedAsset(asset)}
                        >
                          {asset}
                        </Button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black uppercase text-muted-foreground">Amount</label>
                        <span className="text-[10px] font-bold text-gold">Balance: {userWalletBalance ? parseFloat(userWalletBalance.formatted).toFixed(4) : "0.00"}</span>
                      </div>
                      <div className="relative">
                        <Input 
                          placeholder="0.00" 
                          value={amount} 
                          onChange={(e) => setAmount(e.target.value)}
                          className="h-14 bg-muted/20 border-gold/20 text-lg font-mono focus:border-gold/50" 
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute right-2 top-2 h-10 text-gold font-black hover:bg-gold/10"
                          onClick={() => setAmount(userWalletBalance?.formatted || "0")}
                        >
                          MAX
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 bg-gold/5 border border-gold/10 rounded-xl space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground uppercase font-bold">Projected Shares</span>
                        <span className="font-black text-white">~{amount || "0"} LP</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground uppercase font-bold">Yield Cut</span>
                        <span className="font-black text-green-400">100% of House Edge</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleDeposit} 
                      disabled={isProcessing || !amount || !isConnected}
                      className="w-full h-16 text-lg font-black bg-gold hover:bg-gold-dark text-black shadow-xl"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" /> : "CONFIRM DEPOSIT"}
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="bg-card/80 border-gold/20 shadow-2xl relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-muted" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-gold" /> MY POSITION
                    </CardTitle>
                    <CardDescription>View and manage your deposited capital.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="text-center py-6">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Your Total Equity ({selectedAsset})</p>
                      <div className="text-5xl font-black text-gold tracking-tighter">{myPositionValue}</div>
                      <p className="text-xs text-muted-foreground mt-2 font-bold uppercase">{userShares ? formatUnits(userShares as bigint, decimals) : "0.00"} Shares held</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl border border-white/5">
                        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                          <Info className="w-5 h-5 text-gold" />
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                          Your position grows automatically as the House wins games. Withdrawal returns your principal plus accrued yield instantly.
                        </div>
                      </div>

                      <Button 
                        variant="outline" 
                        className="w-full h-14 border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold"
                        onClick={handleWithdraw}
                        disabled={isProcessing || !userShares || BigInt(userShares as bigint) === BigInt(0)}
                      >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <><ArrowDownCircle className="w-4 h-4 mr-2" /> WITHDRAW ALL</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gold/5 border-gold/20">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <LANDMARK_ICON />
                    <div className="flex-1 text-center md:text-left">
                      <h4 className="font-black uppercase tracking-tight text-lg mb-1">Transparent & Non-Custodial</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The Flipen Bankroll is fully decentralized. Neither the admin nor anyone else can touch your capital while it's in the pool. It is only used to facilitate games, and you have 24/7 access to your funds.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}

function LANDMARK_ICON() {
  return (
    <div className="w-16 h-16 rounded-2xl bg-gold/20 flex items-center justify-center border border-gold/30 shadow-lg shrink-0">
      <Landmark className="w-8 h-8 text-gold" />
    </div>
  )
}
