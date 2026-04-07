"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Coins, TrendingUp, Trophy, Info, MessageCircle, Sun, Moon, Menu, X, Users } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from 'wagmi'

interface HeaderProps {
  balance: string
  setIsCommentsSidebarOpen: (open: boolean) => void
  selectedAsset: string
}

export function Header({
  balance,
  setIsCommentsSidebarOpen,
  selectedAsset,
}: HeaderProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const { isConnected } = useAccount()

  const tabs = [
    { id: "game", label: "Game", icon: Coins, href: "/" },
    { id: "history", label: "History", icon: TrendingUp, href: "/history" },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy, href: "/leaderboard" },
    { id: "referrals", label: "Referrals", icon: Users, href: "/referrals" },
    { id: "about", label: "About", icon: Info, href: "/about" },
  ]

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
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-50 w-16 hover:w-64 flex-col bg-card border-r border-gold/20 transition-all duration-300 group shadow-2xl overflow-hidden">
        {/* Logo Area */}
        <div className="h-[73px] flex items-center px-4 border-b border-gold/20 flex-shrink-0 w-full">
          <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-gold flex-shrink-0 overflow-hidden">
              <img src="/favicon.ico" alt="Flipen Logo" className="w-6 h-6 object-contain" />
            </div>
            <div className="flex flex-row items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              <span className="text-xl font-bold text-gold-gradient font-mono">Flipen</span>
              <span className="opacity-75 text-[10px] text-gray-300 p-0.5 bg-gold-dark/30 rounded-sm">MVP</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 flex flex-col py-6 space-y-4 px-3 w-full">
          <Button
            onClick={() => setIsCommentsSidebarOpen(true)}
            variant="outline"
            className="border-gold text-gold hover:bg-gold/10 flex items-center justify-start h-10 px-2.5 w-full flex-shrink-0"
          >
            <MessageCircle className="w-5 h-5 flex-shrink-0" />
            <span className="ml-4 text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Live Chat</span>
          </Button>

          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = getCurrentTab() === tab.id
            return (
              <Link key={tab.id} href={tab.href} className="w-full block flex-shrink-0">
                <button
                  className={`w-full flex items-center h-10 px-2.5 rounded-lg transition-all text-sm ${isActive
                      ? "bg-gold/20 text-gold border border-gold shadow-lg shadow-gold/20"
                      : "text-muted-foreground hover:text-gold hover:bg-muted/50 border border-transparent"
                    }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="ml-4 font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{tab.label}</span>
                </button>
              </Link>
            )
          })}
        </nav>

        {/* Bottom Settings (Theme Toggle) */}
        <div className="p-3 border-t border-gold/20 w-full">
            <Button
              variant="outline"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="w-full flex items-center justify-start border-gold text-gold hover:bg-gold/10 h-10 px-2.5 flex-shrink-0"
            >
              {theme === "light" ? <Moon className="w-5 h-5 flex-shrink-0" /> : <Sun className="w-5 h-5 flex-shrink-0" />}
              <span className="ml-4 text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
            </Button>
        </div>
      </aside>

      <header className="border-b border-gold bg-card/50 backdrop-blur-sm relative z-40">
        <div className="w-full px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Title / Logo Area (Left Aligned for all screens) */}
            <div className="flex flex-col justify-center text-left flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Link href="/" className="lg:hidden w-7 h-7 sm:w-8 sm:h-8 bg-white rounded-full flex items-center justify-center overflow-hidden border border-gold shrink-0">
                  <img src="/favicon.ico" alt="Flipen Logo" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                </Link>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent leading-none m-0 p-0">FLIPEN</h1>
              </div>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-bold tracking-tight leading-tight mb-0.5">Where Fortune Favors the Bold</p>
              <p className="text-[9px] sm:text-[10px] lg:text-xs text-gold font-semibold italic tracking-tighter leading-none">Optimized for Celo & MiniPay</p>
            </div>

            {/* Desktop Right Side */}
            <div className="hidden lg:flex items-center space-x-3">
              {/* Custom Balance Display (Only when connected) */}
              {isConnected && (
                <div className="hidden xl:flex items-center space-x-2 bg-gold/10 border border-gold/30 rounded-full px-3 py-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-gold font-bold text-xs">
                    {balance} {selectedAsset}
                  </span>
                </div>
              )}

              {/* RainbowKit Connect Button - THE SOURCE OF TRUTH */}
              <div className="flex items-center">
                <ConnectButton
                  showBalance={false}
                  accountStatus={{
                    smallScreen: 'avatar',
                    largeScreen: 'full',
                  }}
                  chainStatus={{
                    smallScreen: 'icon',
                    largeScreen: 'name',
                  }}
                />
              </div>
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
        className={`lg:hidden fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-card border-l border-gold shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
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
            {/* Balance Card Mobile */}
            {isConnected && (
              <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-4 text-center">
                <div className="text-xs text-muted-foreground uppercase font-bold mb-1 tracking-wider">Available Balance</div>
                <div className="text-2xl font-black text-gold">
                  {balance} <span className="text-sm">{selectedAsset}</span>
                </div>
              </div>
            )}

            {/* RainbowKit Mobile */}
            <div className="mb-6 flex justify-center">
              <ConnectButton />
            </div>

            {/* Community Button */}
            <Button
              onClick={handleCommunityClick}
              variant="outline"
              className="w-full justify-start border-gold text-gold hover:bg-gold/10 h-12"
            >
              <MessageCircle className="w-5 h-5 mr-3" />
              <span className="text-base">Live Chat</span>
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
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all text-left ${isActive
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
        </div>
      </div>
    </>
  )
}
