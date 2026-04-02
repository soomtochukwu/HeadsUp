"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Wallet, Coins, TrendingUp, Trophy, Info, MessageCircle, Sun, Moon, Menu, X } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { setBalance } from "@/utils/setBalance"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useChainId } from 'wagmi'
import { Chain, celo, celoAlfajores } from 'wagmi/chains'

const chainMap: Record<number, Chain> = {
  [celo.id]: celo,
  [celoAlfajores.id]: celoAlfajores,
}

interface HeaderProps {
  isWalletConnected: boolean
  setIsWalletConnected: (connected: boolean) => void
  selectedNetwork: string
  setSelectedNetwork: (network: string) => void
  setChainID: (chainID: number) => void
  balance: string
  walletAddress: string
  setWalletAddress: (address: string) => void
  setIsCommentsSidebarOpen: (open: boolean) => void
  selectedAsset: string
}

const networks = [
  { id: "celo", name: "CELO", color: "text-yellow-600", symbol: "CELO", chainId: 42220 },
  { id: "alfajores", name: "ALFAJORES", color: "text-green-500", symbol: "CELO", chainId: 44787 },
]

export function Header({
  isWalletConnected,
  setIsWalletConnected,
  selectedNetwork,
  setSelectedNetwork,
  setChainID,
  balance,
  walletAddress,
  setWalletAddress,
  setIsCommentsSidebarOpen,
  selectedAsset,
}: HeaderProps) {
  const [showWalletOptions, setShowWalletOptions] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  
  const tabs = [
    { id: "game", label: "Game", icon: Coins, href: "/" },
    { id: "history", label: "History", icon: TrendingUp, href: "/history" },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy, href: "/leaderboard" },
    { id: "about", label: "About", icon: Info, href: "/about" },
  ]
  
  const selectedNetworkData = networks.find((n) => n.id === selectedNetwork)
  const chainId = useChainId()
  const chain = chainMap[chainId]
  
  const getCurrentTab = () => {
    const currentTab = tabs.find(tab => tab.href === pathname)
    return currentTab?.id || "game"
  }
  
  const handleNavigation = (href: string) => {
    router.push(href)
    setIsMobileSidebarOpen(false)
  }
  
  const handleCommunityClick = () => {
    setIsCommentsSidebarOpen(true)
    setIsMobileSidebarOpen(false)
  }

  useEffect(() => {
    setChainID(chainId)
    setSelectedNetwork(chain?.name)
  }, [chainId])
  
  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileSidebarOpen) {
        const sidebar = document.getElementById('mobile-sidebar')
        const hamburger = document.getElementById('hamburger-menu')
        if (sidebar && !sidebar.contains(event.target as Node) && 
            hamburger && !hamburger.contains(event.target as Node)) {
          setIsMobileSidebarOpen(false)
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobileSidebarOpen])
  
  return (
    <>
      <header className="border-b border-gold bg-card/50 backdrop-blur-sm relative z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
              <div className="w-8 h-8 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gold">
                <img src="/favicon.ico" alt="Flipen Logo" className="w-6 h-6 object-contain" />
              </div>
              <div className="flex flex-row items-end gap-1">
                <span className="text-xl sm:text-2xl font-bold text-gold-gradient font-mono">Flipen</span>
                <span className="opacity-75 text-xs text-gray-300 p-1 bg-gold-dark/30 rounded-sm">MVP</span>
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8 flex-1 justify-center">
              <Button
                onClick={() => setIsCommentsSidebarOpen(true)}
                variant="outline"
                size="sm"
                className="border-gold text-gold hover:bg-gold/10 items-center space-x-2 px-3 py-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">Community</span>
              </Button>
              
              <nav className="flex space-x-4 xl:space-x-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = getCurrentTab() === tab.id
                  return (
                    <Link key={tab.id} href={tab.href}>
                      <button
                        className={`flex items-center space-x-2 px-3 xl:px-4 py-2 rounded-lg transition-all text-sm ${
                          isActive
                            ? "bg-gold/20 text-gold border border-gold shadow-lg shadow-gold/20"
                            : "text-muted-foreground hover:text-gold hover:bg-muted/50"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Desktop Right Side */}
            <div className="hidden lg:flex items-center space-x-3">
              {/* Theme Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="border-gold text-gold hover:bg-gold/10 p-2 min-w-[40px] h-10"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>

              {/* Wallet Connection */}
              {isWalletConnected ? (
                <div className="flex items-center space-x-3 bg-card/50 border border-gold rounded-lg px-4 py-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-gold font-semibold text-sm">
                    {balance} {selectedAsset}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{walletAddress}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsWalletConnected(false)
                      setWalletAddress("")
                    }}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="bg-gold-gradient text-white font-semibold rounded-lg p-2 flex items-center min-h-[40px]">
                  <Wallet className="w-4 h-4 mr-2" />
                  <div className="[&>button]:!text-white [&>button]:!font-semibold [&>button]:!text-sm">
                    <ConnectButton />
                  </div>
                </div>
              )}
            </div>
            
            {/* Mobile Hamburger Menu */}
            <Button
              id="hamburger-menu"
              variant="outline"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="lg:hidden border-gold text-gold hover:bg-gold/10 p-2 min-w-[40px] h-10"
            >
              {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>
      
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
      )}
      
      {/* Mobile Sidebar */}
      <div
        id="mobile-sidebar"
        className={`lg:hidden fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-card border-l border-gold shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gold/20">
            <Link href="/" className="flex items-center space-x-2" onClick={() => setIsMobileSidebarOpen(false)}>
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gold">
                <img src="/favicon.ico" alt="Flipen Logo" className="w-6 h-6 object-contain" />
              </div>
              <span className="text-lg font-bold text-gold-gradient font-mono">Flipen</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Navigation Items */}
          <div className="flex-1 p-4 space-y-2">
            {/* Community Button */}
            <Button
              onClick={handleCommunityClick}
              variant="outline"
              className="w-full justify-start border-gold text-gold hover:bg-gold/10 h-12"
            >
              <MessageCircle className="w-5 h-5 mr-3" />
              <span className="text-base">Community</span>
            </Button>
            
            {/* Navigation Tabs */}
            <div className="space-y-2 mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">Navigation</h3>
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = getCurrentTab() === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleNavigation(tab.href)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-left ${
                      isActive
                        ? "bg-gold/20 text-gold border border-gold"
                        : "text-muted-foreground hover:text-gold hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-base">{tab.label}</span>
                  </button>
                )
              })}
            </div>
            
            {/* Theme Toggle */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Settings</h3>
              <Button
                variant="outline"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="w-full justify-start border-gold text-gold hover:bg-gold/10 h-12"
              >
                {theme === "light" ? <Moon className="w-5 h-5 mr-3" /> : <Sun className="w-5 h-5 mr-3" />}
                <span className="text-base">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
              </Button>
            </div>
          </div>
          
          {/* Wallet Section at Bottom */}
          <div className="p-4 border-t border-gold/20 mt-auto">
            {isWalletConnected ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3 bg-card/50 border border-gold rounded-lg p-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gold font-semibold text-sm">
                      {balance} {selectedAsset}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {walletAddress}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsWalletConnected(false)
                    setWalletAddress("")
                    setIsMobileSidebarOpen(false)
                  }}
                  className="w-full border-red-500 text-red-500 hover:bg-red-500/10 h-12"
                >
                  Disconnect Wallet
                </Button>
              </div>
            ) : (
              <div className="bg-gold-gradient text-white font-semibold rounded-lg p-3 flex items-center justify-center min-h-[48px]">
                <Wallet className="w-5 h-5 mr-2" />
                <div className="[&>button]:!text-white [&>button]:!font-semibold [&>button]:!text-base">
                  <ConnectButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
