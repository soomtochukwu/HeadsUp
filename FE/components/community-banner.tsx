"use client"

import { useState, useEffect } from "react"
import { MessageCircle, X, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

export function CommunityBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const TELEGRAM_LINK = "https://t.me/+seqgZagp0CIwY2Y0"
  const STORAGE_KEY = "flipen_telegram_joined"

  useEffect(() => {
    // Check if user has already acted on the CTA
    const hasJoined = localStorage.getItem(STORAGE_KEY)
    if (!hasJoined) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleJoin = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    window.open(TELEGRAM_LINK, "_blank")
    setIsVisible(false)
  }

  const handleDismiss = () => {
    // Only hide for this session if they just dismiss without clicking
    setIsVisible(false)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 pointer-events-none"
        >
          <div className="container mx-auto flex justify-center md:justify-end">
            <div className="w-full max-w-md bg-card/95 backdrop-blur-xl border border-gold/30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-2xl p-4 md:p-5 pointer-events-auto relative overflow-hidden group">
              {/* Background Glow */}
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-gold/10 rounded-full blur-3xl group-hover:bg-gold/20 transition-colors duration-500" />
              
              <div className="flex items-start gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gold/20 flex items-center justify-center flex-shrink-0 border border-gold/20">
                  <MessageCircle className="w-6 h-6 text-gold" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-black text-gold tracking-tight mb-1">JOIN THE COMMUNITY</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Don't flip alone! Join 1,000+ players on Telegram for tips, big win alerts, and support.
                  </p>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleJoin}
                      size="sm"
                      className="bg-gold hover:bg-gold-dark text-black font-bold h-9 px-4 rounded-lg flex-1"
                    >
                      LET'S GO <ExternalLink className="w-3 h-3 ml-2" />
                    </Button>
                    <Button 
                      onClick={handleDismiss}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-9 px-3"
                    >
                      Later
                    </Button>
                  </div>
                </div>

                <button 
                  onClick={handleDismiss}
                  className="absolute -top-2 -right-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
