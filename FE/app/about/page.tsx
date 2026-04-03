"use client"

import { Header } from "@/components/header"
import { AnimatedBackground } from "@/components/animated-background"
import { ThemeProvider } from "@/components/theme-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  ShieldCheck, 
  Zap, 
  HelpCircle, 
  Info, 
  Lock, 
  RotateCcw, 
  Smartphone, 
  Coins, 
  ArrowRight,
  MessageCircle,
  ExternalLink
} from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="golden-flip-theme">
      <div className="min-h-screen bg-background text-foreground relative flex flex-col h-[100dvh] overflow-hidden">
        <AnimatedBackground />
        
        <div className="relative z-10 flex flex-col h-full">
          <Header balance="---" setIsCommentsSidebarOpen={() => {}} selectedAsset="CELO" />

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="container max-w-4xl mx-auto space-y-8 pb-20">
              
              {/* Hero Section */}
              <div className="text-center space-y-4">
                <Badge variant="outline" className="border-gold text-gold px-4 py-1 rounded-full uppercase tracking-widest text-[10px] font-bold">
                  About Flipen
                </Badge>
                <h1 className="text-4xl md:text-6xl font-black text-gold-gradient font-mono tracking-tighter">
                  WHERE FORTUNE FAVORS THE BOLD
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                  Flipen is a decentralized, provably fair coin flip game built on the Celo network. 
                  Simple, secure, and instant.
                </p>
              </div>

              {/* How to Play Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center border border-gold/30">
                    <HelpCircle className="text-gold w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">HOW TO PLAY</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-card/50 border-gold/10 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gold/30" />
                    <CardHeader className="pb-2">
                      <div className="text-3xl font-black text-gold/20 mb-2 font-mono">01</div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Coins className="w-4 h-4 text-gold" /> CHOOSE SIDE
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Select <strong>Heads</strong> 👑 or <strong>Tails</strong> 💰 and set your bet amount. 
                      You can play with native <strong>CELO</strong> or <strong>cUSD</strong>.
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 border-gold/10 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gold/30" />
                    <CardHeader className="pb-2">
                      <div className="text-3xl font-black text-gold/20 mb-2 font-mono">02</div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="w-4 h-4 text-gold" /> FLIP & COMMIT
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Sign the first transaction. This "commits" your bet to the blockchain. 
                      The result is determined by the hash of the *next* block.
                    </CardContent>
                  </Card>

                  <Card className="bg-card/50 border-gold/10 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gold/30" />
                    <CardHeader className="pb-2">
                      <div className="text-3xl font-black text-gold/20 mb-2 font-mono">03</div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-gold" /> CATCH & WIN
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      After ~5 seconds, click <strong>"CATCH THE COIN"</strong> to reveal the result. 
                      Winners receive <strong>1.95x</strong> their bet instantly!
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* Security Section */}
              <Card className="bg-gold/5 border-gold/20 backdrop-blur-md overflow-hidden relative group">
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-700">
                  <ShieldCheck className="w-64 h-64 text-gold" />
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gold">
                    <Lock className="w-5 h-5" /> PROVABLY FAIR
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Flipen uses a <strong>Two-Step Future Block Entropy</strong> model. Unlike centralized systems, 
                    we never use a hidden "server-side" seed. The winning number is calculated on-chain using:
                  </p>
                  <ul className="grid gap-2 md:grid-cols-2">
                    <li className="flex items-center gap-2 text-xs text-foreground/80 bg-background/50 p-2 rounded-lg border border-gold/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold" /> Future Block Hash (Unknown when betting)
                    </li>
                    <li className="flex items-center gap-2 text-xs text-foreground/80 bg-background/50 p-2 rounded-lg border border-gold/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold" /> Celo Protocol Randomness (Prevrandao)
                    </li>
                    <li className="flex items-center gap-2 text-xs text-foreground/80 bg-background/50 p-2 rounded-lg border border-gold/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold" /> Unique Player Transaction Hash
                    </li>
                    <li className="flex items-center gap-2 text-xs text-foreground/80 bg-background/50 p-2 rounded-lg border border-gold/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold" /> Millisecond Precision Timestamp
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* FAQ Section */}
              <section className="space-y-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Info className="w-6 h-6 text-gold" /> FREQUENTLY ASKED
                </h2>
                <div className="space-y-4">
                  {[
                    {
                      q: "What is the payout ratio?",
                      a: "Flipen pays out 1.95x your original bet. This means if you bet 1 CELO, you receive 1.95 CELO back on a win."
                    },
                    {
                      q: "Is it compatible with MiniPay?",
                      a: "Yes! Flipen is fully optimized for MiniPay inside Opera Mini. No extension downloads needed—just connect and flip."
                    },
                    {
                      q: "Why do I need to wait between the two transactions?",
                      a: "The delay ensures that the 'Betting Block' is finished and the 'Random Seed' is finalized. This prevents anyone from seeing the result before the bet is placed."
                    },
                    {
                      q: "What are the bet limits?",
                      a: "Limits vary based on the House Bankroll. Current limits are displayed in the game interface. Usually 0.01 CELO to 10 CELO."
                    }
                  ].map((faq, i) => (
                    <Card key={i} className="bg-background/40 border-gold/5 hover:border-gold/20 transition-all">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold text-foreground">Q: {faq.q}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground leading-relaxed">
                        {faq.a}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Community Call to Action */}
              <div className="text-center py-10 space-y-6">
                <h3 className="text-2xl font-bold tracking-tight">STILL HAVE QUESTIONS?</h3>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    asChild 
                    className="bg-gold hover:bg-gold-dark text-black font-black h-14 px-8 text-lg"
                  >
                    <a href="https://t.me/+seqgZagp0CIwY2Y0" target="_blank">
                      <MessageCircle className="w-6 h-6 mr-2" /> JOIN TELEGRAM
                    </a>
                  </Button>
                  <Button 
                    asChild 
                    variant="outline" 
                    className="border-gold text-gold hover:bg-gold/10 h-14 px-8 text-lg"
                  >
                    <Link href="/">
                      START FLIPPING <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}
