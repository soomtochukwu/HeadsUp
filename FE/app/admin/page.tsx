"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { AnimatedBackground } from "@/components/animated-background"
import { ThemeProvider } from "@/components/theme-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAccount, useReadContract, useWriteContract, usePublicClient, useBalance, useSwitchChain } from "wagmi"
import { parseEther, formatUnits, parseUnits } from "viem"
import { FLIPEN_ADDRESSES, TOKEN_ADDRESSES } from "@/contracts/addresses"
import { toast } from "sonner"
import { ShieldAlert, ShieldCheck, Wallet, ArrowDownCircle, Settings, Play, Pause, AlertTriangle, RefreshCw, ArrowUpCircle } from "lucide-react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { isMiniPay } from "@/hooks/useAutoConnect"

const ADMIN_ABI = [
  { "type": "function", "name": "owner", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "address" }] },
  { "type": "function", "name": "paused", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "getBetLimits", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint256", "name": "min" }, { "type": "uint256", "name": "max" }] },
  { "type": "function", "name": "pause", "stateMutability": "nonpayable", "inputs": [], "outputs": [] },
  { "type": "function", "name": "unpause", "stateMutability": "nonpayable", "inputs": [], "outputs": [] },
  { "type": "function", "name": "withdrawCELO", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256", "name": "amount" }], "outputs": [] },
  { "type": "function", "name": "withdrawToken", "stateMutability": "nonpayable", "inputs": [{ "type": "address", "name": "token" }, { "type": "uint256", "name": "amount" }], "outputs": [] },
  { "type": "function", "name": "updateBetLimits", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256", "name": "newMinBet" }, { "type": "uint256", "name": "newMaxBet" }], "outputs": [] },
  { "type": "function", "name": "fundContract", "stateMutability": "payable", "inputs": [], "outputs": [] },
  { "type": "function", "name": "cUSD", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "address" }] },
  { "type": "function", "name": "currentHouseEdgeBP", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "currentReferralRewardBP", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "updateEconomics", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256", "name": "newHouseEdgeBP" }, { "type": "uint256", "name": "newReferralRewardBP" }], "outputs": [] },
  { "type": "function", "name": "onboardingBonusCELO", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "onboardingBonusCUSD", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "updateOnboardingBonus", "stateMutability": "nonpayable", "inputs": [{ "type": "uint256", "name": "_celoAmount" }, { "type": "uint256", "name": "_cusdAmount" }], "outputs": [] },
  { "type": "function", "name": "updateSupportedToken", "stateMutability": "nonpayable", "inputs": [{ "type": "address", "name": "token" }, { "type": "bool", "name": "supported" }], "outputs": [] },
  { "type": "function", "name": "isSupportedToken", "stateMutability": "view", "inputs": [{ "type": "address", "name": "" }], "outputs": [{ "type": "bool" }] }
] as const

const ERC20_ABI = [
  { "type": "function", "name": "transfer", "stateMutability": "nonpayable", "inputs": [{ "type": "address", "name": "to" }, { "type": "uint256", "name": "amount" }], "outputs": [{ "type": "bool" }] }
] as const

const SUPPORTED_CHAINS = [42220, 11142220]

export default function AdminPage() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [fundAmount, setFundAmount] = useState("")
  const [minBetInput, setMinBetInput] = useState("")
  const [maxBetInput, setMaxBetInput] = useState("")
  const [houseEdgeInput, setHouseEdgeInput] = useState("2.5")
  const [referralRewardInput, setReferralRewardInput] = useState("1.0")
  const [bonusCeloInput, setBonusCeloInput] = useState("0")
  const [bonusCusdInput, setBonusCusdInput] = useState("0")
  const [selectedTokenForAction, setSelectedTokenForAction] = useState("CELO")
  const [tokenAddressInput, setTokenAddressInput] = useState("")
  const [tokenDecimalsInput, setTokenDecimalsInput] = useState("18")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [_isMiniPay, setIsMiniPayEnv] = useState(false)

  useEffect(() => {
    setIsMiniPayEnv(isMiniPay())
  }, [])

  const isCorrectChain = useMemo(() => chainId && SUPPORTED_CHAINS.includes(chainId), [chainId])
  const proxyAddress = useMemo(() => chainId ? FLIPEN_ADDRESSES[chainId] : undefined, [chainId])

  // Contract Reads
  const { data: contractOwner, refetch: refetchOwner } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'owner', query: { enabled: !!isCorrectChain && !!proxyAddress } })
  const { data: isPaused, refetch: refetchPaused } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'paused', query: { enabled: !!isCorrectChain && !!proxyAddress } })
  const { data: betLimits, refetch: refetchLimits } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'getBetLimits', query: { enabled: !!isCorrectChain && !!proxyAddress } })
  const { data: currentCUSD, refetch: refetchCusdAddr } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'cUSD', query: { enabled: !!isCorrectChain && !!proxyAddress } })
  const { data: currentHouseEdge, refetch: refetchHouseEdge } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'currentHouseEdgeBP', query: { enabled: !!isCorrectChain && !!proxyAddress } })
  const { data: currentReferralReward, refetch: refetchReferralReward } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'currentReferralRewardBP', query: { enabled: !!isCorrectChain && !!proxyAddress } })
  const { data: currentBonusCELO, refetch: refetchBonusCELO } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'onboardingBonusCELO', query: { enabled: !!isCorrectChain && !!proxyAddress } })
  const { data: currentBonusCUSD, refetch: refetchBonusCUSD } = useReadContract({ address: proxyAddress, abi: ADMIN_ABI, functionName: 'onboardingBonusCUSD', query: { enabled: !!isCorrectChain && !!proxyAddress } })

  useEffect(() => {
    if (currentHouseEdge !== undefined) setHouseEdgeInput((Number(currentHouseEdge) / 100).toFixed(1))
    if (currentReferralReward !== undefined) setReferralRewardInput((Number(currentReferralReward) / 100).toFixed(1))
    if (currentBonusCELO !== undefined) setBonusCeloInput(formatUnits(currentBonusCELO as bigint, 18))
    if (currentBonusCUSD !== undefined) setBonusCusdInput(formatUnits(currentBonusCUSD as bigint, 18))
  }, [currentHouseEdge, currentReferralReward, currentBonusCELO, currentBonusCUSD])

  const handleHouseEdgeChange = (val: string) => {
    setHouseEdgeInput(val)
    const houseEdgeNum = parseFloat(val)
    const refRewardNum = parseFloat(referralRewardInput)
    // Tethering: Ensure referral is always less than house edge
    if (!isNaN(houseEdgeNum) && !isNaN(refRewardNum) && refRewardNum >= houseEdgeNum) {
      setReferralRewardInput(Math.max(0.1, houseEdgeNum - 0.5).toFixed(1))
    }
  }

  const handleReferralRewardChange = (val: string) => {
    const valNum = parseFloat(val)
    const houseEdgeNum = parseFloat(houseEdgeInput)
    if (!isNaN(valNum) && !isNaN(houseEdgeNum) && valNum >= houseEdgeNum) {
      toast.error(`Referral reward must be strictly less than House Edge (${houseEdgeInput}%)`)
      setReferralRewardInput(Math.max(0.1, houseEdgeNum - 0.5).toFixed(1))
    } else {
      setReferralRewardInput(val)
    }
  }

  const { data: celoBankroll, refetch: refetchCelo } = useBalance({ address: proxyAddress, chainId: chainId, query: { enabled: !!isCorrectChain && !!proxyAddress, refetchInterval: 5000 } })

  const BankrollRow = ({ symbol, address: tokenAddress }: { symbol: string, address?: string }) => {
    const { data: balance } = useBalance({ 
      address: proxyAddress, 
      token: tokenAddress as `0x${string}`,
      query: { enabled: !!proxyAddress && !!isCorrectChain, refetchInterval: 5000 } 
    })
    
    return (
      <div className="flex justify-between items-end">
        <span className="text-[10px] text-muted-foreground uppercase font-bold">{symbol}</span>
        <span className="text-2xl font-black text-gold">{balance ? parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4) : "---"}</span>
      </div>
    )
  }

  const tokens = useMemo(() => {
    if (!chainId || !TOKEN_ADDRESSES[chainId]) return []
    return Object.entries(TOKEN_ADDRESSES[chainId]).map(([symbol, address]) => ({ symbol, address }))
  }, [chainId])

  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([
      refetchOwner(),
      refetchPaused(),
      refetchLimits(),
      refetchCusdAddr(),
      refetchHouseEdge(),
      refetchReferralReward(),
      refetchBonusCELO(),
      refetchBonusCUSD(),
      refetchCelo()
    ])
    setTimeout(() => setIsRefreshing(false), 1000)
  }, [refetchOwner, refetchPaused, refetchLimits, refetchCusdAddr, refetchHouseEdge, refetchReferralReward, refetchBonusCELO, refetchBonusCUSD, refetchCelo])

  const handleAction = async (fn: string, args: any[], successMsg: string, value?: bigint, abiOverride?: any, targetAddress?: string) => {
    if (!proxyAddress) return
    try {
      const hash = await writeContractAsync({
        address: (targetAddress || proxyAddress) as `0x${string}`,
        abi: abiOverride || ADMIN_ABI,
        functionName: fn as any,
        args,
        value
      })
      toast.info(_isMiniPay ? "Confirming network fee..." : "Transaction submitted...")
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash })
      toast.success(successMsg)
      // Clear inputs
      if (fn === "updateBetLimits") { setMinBetInput(""); setMaxBetInput(""); }
      if (fn === "withdrawCELO" || fn === "withdrawToken") { setWithdrawAmount(""); }
      if (fn === "fundContract" || fn === "transfer") { setFundAmount(""); }
      if (fn === "updateSupportedToken") { setTokenAddressInput(""); }
      refreshAllData()
    } catch (error: any) {
      toast.error(error.shortMessage || "Transaction failed")
    }
  }

  const isOwner = useMemo(() => address && contractOwner && address.toLowerCase() === (contractOwner as string).toLowerCase(), [address, contractOwner])

  const formatLimit = (val: any) => {
    if (val === undefined || val === null) return "0.00"
    try {
      return formatUnits(val as bigint, 18)
    } catch (e) {
      return "0.00"
    }
  }

  if (!isConnected) return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen flex items-center justify-center p-4">
        <AnimatedBackground />
        <Card className="w-full max-w-md text-center z-10 border-gold/20 bg-card/80 backdrop-blur-md">
          <CardHeader><ShieldCheck className="w-12 h-12 text-gold mx-auto mb-2" /><CardTitle>Flipen Admin</CardTitle></CardHeader>
          <CardContent className="flex justify-center pb-8"><ConnectButton /></CardContent>
        </Card>
      </div>
    </ThemeProvider>
  )

  if (!isCorrectChain) return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen flex items-center justify-center p-4">
        <AnimatedBackground />
        <Card className="w-full max-w-md text-center z-10 border-red-500/20 bg-red-500/5 backdrop-blur-md">
          <CardHeader><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" /><CardTitle className="text-red-500">Wrong Network</CardTitle></CardHeader>
          <CardContent className="space-y-4 pb-8">
            <div className="flex flex-col gap-2">
              <Button onClick={() => switchChain({ chainId: 42220 })}>Switch to Celo Mainnet</Button>
              <Button variant="outline" onClick={() => switchChain({ chainId: 11142220 })}>Switch to Celo Sepolia</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ThemeProvider>
  )

  if (!isOwner && contractOwner) return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen flex items-center justify-center p-4">
        <AnimatedBackground />
        <Card className="w-full max-w-md text-center border-red-500/50 z-10 bg-red-500/5 backdrop-blur-md">
          <CardHeader><ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2" /><CardTitle className="text-red-500">Access Denied</CardTitle></CardHeader>
          <CardContent className="pb-8"><p className="text-xs font-mono break-all opacity-70 mb-4 text-center">Logged in as: {address}</p><div className="flex justify-center"><ConnectButton /></div></CardContent>
        </Card>
      </div>
    </ThemeProvider>
  )

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen bg-background text-foreground relative flex flex-col h-[100dvh] overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 flex flex-col h-full">
          <header className="border-b border-gold/20 bg-card/50 p-4">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2"><ShieldCheck className="text-gold w-6 h-6" /><h1 className="text-xl font-black text-gold-gradient font-mono tracking-tighter">FLIPEN ADMIN</h1></div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={refreshAllData} className={isRefreshing ? "animate-spin" : ""}><RefreshCw className="w-4 h-4 text-gold" /></Button>
                <Badge variant={isPaused ? "destructive" : "outline"} className={isPaused ? "" : "border-green-500 text-green-500"}>{isPaused ? "PAUSED" : "ACTIVE"}</Badge>
                <ConnectButton accountStatus="avatar" chainStatus="name" showBalance={false} />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="container mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-card/80 border-gold/20 shadow-xl">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Wallet className="w-3.5 h-3.5 text-gold" /> House Bankroll</CardTitle></CardHeader>
                <CardContent className="space-y-4 max-h-[300px] overflow-y-auto">
                  <div className="flex justify-between items-end"><span className="text-[10px] text-muted-foreground uppercase font-bold">CELO</span><span className="text-2xl font-black text-gold">{celoBankroll ? parseFloat(formatUnits(celoBankroll.value, celoBankroll.decimals)).toFixed(4) : "---"}</span></div>
                  {tokens.map(t => <BankrollRow key={t.symbol} symbol={t.symbol} address={t.address} />)}
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Settings className="w-3.5 h-3.5 text-gold" /> Bet Limits</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Minimum:</span><span className="font-bold text-gold">{betLimits && Array.isArray(betLimits) ? formatLimit(betLimits[0]) : "0.00"} CELO</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Maximum:</span><span className="font-bold text-gold">{betLimits && Array.isArray(betLimits) ? formatLimit(betLimits[1]) : "0.00"} CELO</span></div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Play className="w-3.5 h-3.5 text-gold" /> System State</CardTitle></CardHeader>
                <CardContent className="pt-2"><Button className="w-full font-black tracking-tighter" variant={isPaused ? "default" : "outline"} onClick={() => handleAction(isPaused ? "unpause" : "pause", [], "System updated")} >{isPaused ? <Play className="w-4 h-4 mr-2 fill-current" /> : <Pause className="w-4 h-4 mr-2 fill-current" />}{isPaused ? "RESUME GAMES" : "PAUSE PROTOCOL"}</Button></CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><ArrowUpCircle className="w-3.5 h-3.5 text-gold" /> Fund Bankroll</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Input placeholder="0.00" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} className="bg-background/50 h-10 font-mono" />
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30" variant="outline" onClick={() => handleAction("fundContract", [], "Contract funded with CELO", parseEther(fundAmount))}>Fund CELO</Button>
                      <Button className="flex-1 bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30" variant="outline" onClick={() => {
                        const token = tokens.find(t => t.symbol === "USDm") || tokens[0]
                        if (token) handleAction("transfer", [proxyAddress, parseUnits(fundAmount, 18)], `Contract funded with ${token.symbol}`, undefined, ERC20_ABI, token.address)
                      }}>Fund stable</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><ArrowDownCircle className="w-3.5 h-3.5 text-gold" /> Withdraw Profits</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input placeholder="0.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="bg-background/50 h-12 font-mono text-lg" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                      <Button variant="outline" className="h-12 font-bold border-gold/30 hover:bg-gold/10" onClick={() => handleAction("withdrawCELO", [parseEther(withdrawAmount)], "CELO withdrawn")}>CELO</Button>
                      {tokens.map(t => (
                        <Button key={t.symbol} variant="outline" className="h-12 font-bold border-gold/30 hover:bg-gold/10" onClick={() => handleAction("withdrawToken", [t.address, parseUnits(withdrawAmount, 18)], `${t.symbol} withdrawn`)}>{t.symbol}</Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Settings className="w-3.5 h-3.5 text-gold" /> Protocol Economics</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">House Edge (%)</label>
                      <Input type="number" step="0.1" value={houseEdgeInput} onChange={(e) => handleHouseEdgeChange(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Referral Reward (%)</label>
                      <Input type="number" step="0.1" value={referralRewardInput} onChange={(e) => handleReferralRewardChange(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <Button size="sm" className="w-full font-bold" onClick={() => handleAction("updateEconomics", [Math.round(parseFloat(houseEdgeInput) * 100), Math.round(parseFloat(referralRewardInput) * 100)], "Economics updated")}>UPDATE ECONOMICS</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Settings className="w-3.5 h-3.5 text-gold" /> Manage Tokens</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Token Address</label>
                      <Input placeholder="0x..." value={tokenAddressInput} onChange={(e) => setTokenAddressInput(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Decimals</label>
                      <Input type="number" value={tokenDecimalsInput} onChange={(e) => setTokenDecimalsInput(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 font-bold" onClick={() => handleAction("updateSupportedToken", [tokenAddressInput, true, parseInt(tokenDecimalsInput)], "Token supported")}>SUPPORT</Button>
                      <Button size="sm" variant="destructive" className="flex-1 font-bold" onClick={() => handleAction("updateSupportedToken", [tokenAddressInput, false, 0], "Token unsupported")}>REMOVE</Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tokens.map(t => (
                        <Badge key={t.symbol} variant="outline" className="cursor-pointer hover:bg-gold/10" onClick={() => setTokenAddressInput(t.address)}>{t.symbol}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Settings className="w-3.5 h-3.5 text-gold" /> Campaigns & Bonuses</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Onboarding Bonus (CELO)</label>
                      <Input type="number" step="0.01" value={bonusCeloInput} onChange={(e) => setBonusCeloInput(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Onboarding Bonus (cUSD)</label>
                      <Input type="number" step="0.01" value={bonusCusdInput} onChange={(e) => setBonusCusdInput(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <Button size="sm" className="w-full font-bold" onClick={() => handleAction("updateOnboardingBonus", [parseEther(bonusCeloInput || "0"), parseEther(bonusCusdInput || "0")], "Onboarding bonus updated")}>UPDATE BONUSES</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-gold/20 shadow-xl lg:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Settings className="w-3.5 h-3.5 text-gold" /> Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="Min" value={minBetInput} onChange={(e) => setMinBetInput(e.target.value)} className="h-9 text-xs" />
                      <Input placeholder="Max" value={maxBetInput} onChange={(e) => setMaxBetInput(e.target.value)} className="h-9 text-xs" />
                      <Button size="sm" className="font-bold px-4" onClick={() => handleAction("updateBetLimits", [parseEther(minBetInput), parseEther(maxBetInput)], "Limits updated")}>SET</Button>
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
