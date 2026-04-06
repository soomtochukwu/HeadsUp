"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageCircle, Send, Clock, X, Loader2, KeyRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { encodePacked, keccak256 } from "viem"
import { toast } from "sonner"
import { MESSENGER_ADDRESSES } from "@/contracts/addresses"
import MESSENGER_ABI from "@/contracts/messenger-abi.json"

interface Comment {
  address: string
  message: string
  timestamp: number
}

interface CommentsSidebarProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  isWalletConnected: boolean
  walletAddress: string
}

export function CommentsSidebar({ isOpen, setIsOpen, isWalletConnected, walletAddress }: CommentsSidebarProps) {
  const { chainId } = useAccount()
  const publicClient = usePublicClient()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [sessionAccount, setSessionAccount] = useState<any>(null)

  const activeChainId = chainId || 42220 
  const messengerAddress = MESSENGER_ADDRESSES[activeChainId as keyof typeof MESSENGER_ADDRESSES]

  // Initialize Session Key (in volatile memory)
  useEffect(() => {
    let pKey = sessionStorage.getItem("flipen_session_key") as `0x${string}`
    if (!pKey) {
      pKey = generatePrivateKey()
      sessionStorage.setItem("flipen_session_key", pKey)
    }
    setSessionAccount(privateKeyToAccount(pKey))
  }, [])

  // Check Authorization
  const { data: authorizedKey, refetch: refetchAuthorizedKey } = useReadContract({
    address: messengerAddress,
    abi: MESSENGER_ABI,
    functionName: 'authorizedSessionKeys',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!messengerAddress }
  })

  // Fetch Nonce
  const { data: userNonce, refetch: refetchNonce } = useReadContract({
    address: messengerAddress,
    abi: MESSENGER_ABI,
    functionName: 'nonces',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!messengerAddress }
  })

  const isAuthorized = useMemo(() => {
    return authorizedKey && sessionAccount && 
           (authorizedKey as string).toLowerCase() === sessionAccount.address.toLowerCase()
  }, [authorizedKey, sessionAccount])

  const { writeContractAsync } = useWriteContract()

  // Bootstrap Load Messages
  const { data: initialMessages } = useReadContract({
    address: messengerAddress,
    abi: MESSENGER_ABI,
    functionName: 'getLatestMessages',
    args: [35n],
    query: { enabled: !!messengerAddress, refetchInterval: 10000 }
  })

  useEffect(() => {
    if (initialMessages && Array.isArray(initialMessages)) {
      const formatted = initialMessages.map((m: any) => ({
        address: m.sender,
        message: m.content,
        timestamp: Number(m.timestamp)
      })).reverse() // Show newest at bottom
      setComments(formatted)
    }
  }, [initialMessages])

  // Watch for Live Messages
  useEffect(() => {
    if (!publicClient || !messengerAddress) return
    const unwatch = publicClient.watchContractEvent({
      address: messengerAddress,
      abi: MESSENGER_ABI,
      eventName: 'NewMessage',
      onLogs: logs => {
        logs.forEach((log: any) => {
          const { sender, content, timestamp } = log.args
          setComments(prev => {
            const newComment = { address: sender, message: content, timestamp: Number(timestamp) }
            // Prevent duplicates if local echo beat the block
            if (prev.some(c => c.address === newComment.address && c.message === newComment.message && Math.abs(c.timestamp - newComment.timestamp) < 10)) {
              return prev
            }
            return [...prev, newComment].slice(-40) // Keep last 40
          })
        })
      }
    })
    return () => unwatch()
  }, [publicClient, messengerAddress])

  const authorizeChat = async () => {
    if (!sessionAccount || !messengerAddress) return
    setIsAuthorizing(true)
    try {
      toast.info("Authorizing your session key (Zero gas after this!)...", { closeButton: true })
      const hash = await writeContractAsync({
        address: messengerAddress,
        abi: MESSENGER_ABI,
        functionName: "authorizeSessionKey",
        args: [sessionAccount.address]
      })
      await publicClient?.waitForTransactionReceipt({ hash })
      toast.success("Chat enabled! You can now send messages instantly.", { closeButton: true })
      refetchAuthorizedKey()
    } catch (e: any) {
      toast.error(e.shortMessage || "Authorization failed", { closeButton: true })
    } finally {
      setIsAuthorizing(false)
    }
  }

  const sendMessage = async () => {
    if (!newComment.trim() || !isWalletConnected || !sessionAccount || userNonce === undefined) return
    setIsSending(true)

    try {
      const messageContent = newComment.trim()
      const currentNonce = userNonce as bigint

      // 1. Local Echo for instant UX
      const tempComment: Comment = {
        address: walletAddress,
        message: messageContent,
        timestamp: Math.floor(Date.now() / 1000)
      }
      setComments(prev => [...prev, tempComment].slice(-40))
      setNewComment("")

      // 2. Sign with Session Key (Silent, no popup)
      const messageHash = keccak256(
        encodePacked(
          ['address', 'string', 'uint256'],
          [walletAddress as `0x${string}`, messageContent, currentNonce]
        )
      )
      
      const signature = await sessionAccount.signMessage({
        message: { raw: messageHash }
      })

      // 3. Send to Gasless Relayer
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: walletAddress,
          content: messageContent,
          signature,
          chainId: activeChainId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Relay failed")
      
      refetchNonce() // Update nonce for next message
    } catch (error: any) {
      toast.error("Message failed: " + error.message, { closeButton: true })
    } finally {
      setIsSending(false)
    }
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const getTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - (timestamp * 1000)) / (1000 * 60))
    if (diff < 1) return "Just now"
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return `${Math.floor(diff / 1440)}d ago`
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsOpen(false)} />
      )}

      <div className={`fixed left-0 top-0 h-full w-full sm:w-96 md:w-80 bg-card/95 backdrop-blur-xl border-r border-gold/30 z-50 transform transition-transform duration-500 ease-in-out shadow-[10px_0_50px_rgba(0,0,0,0.5)] flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gold/20 bg-gold/5 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center border border-gold/30">
              <MessageCircle className="w-4 h-4 text-gold" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gold uppercase tracking-widest">Shoutbox</h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">On-Chain Global</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="hover:bg-gold/10 hover:text-gold rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gold/20 flex flex-col">
          {comments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 grayscale space-y-2">
              <MessageCircle className="w-12 h-12" />
              <p className="text-xs font-bold uppercase tracking-widest">No messages yet</p>
            </div>
          ) : (
            comments.map((comment, i) => (
              <div key={i} className="space-y-1.5 group">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black font-mono text-gold/80 tracking-tighter">
                    {formatAddress(comment.address)}
                  </span>
                  <span className="text-[8px] text-muted-foreground font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                    {getTimeAgo(comment.timestamp)}
                  </span>
                </div>
                <div className="bg-muted/40 rounded-2xl rounded-tl-none p-3 border border-gold/5 hover:border-gold/20 transition-all shadow-sm">
                  <p className="text-sm leading-relaxed break-words text-foreground/90 font-medium">
                    {comment.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 p-4 border-t border-gold/20 bg-background/80 backdrop-blur-md">
          <div className="space-y-3">
            <Textarea
              placeholder={isWalletConnected ? (isAuthorized ? "Shout something..." : "Enable chat to speak") : "Connect wallet to shout"}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={!isWalletConnected || isSending || !isAuthorized}
              className="bg-muted/50 border-gold/20 focus:border-gold/50 text-foreground placeholder:text-muted-foreground/50 resize-none text-sm rounded-xl h-20"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && isAuthorized) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
            
            {!isWalletConnected ? (
              <Button disabled className="w-full bg-muted text-muted-foreground h-10">CONNECT WALLET</Button>
            ) : !isAuthorized ? (
              <Button 
                onClick={authorizeChat} 
                disabled={isAuthorizing}
                className="w-full bg-gold hover:bg-gold-dark text-black font-black text-xs uppercase tracking-widest h-10"
              >
                {isAuthorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-3 h-3 mr-2" /> ENABLE CHAT (1-TIME)</>}
              </Button>
            ) : (
              <Button
                onClick={sendMessage}
                disabled={!newComment.trim() || isSending}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 text-black font-black text-xs uppercase tracking-widest shadow-lg shadow-gold/10 h-10"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3 h-3 mr-2" /> Broadcast</>}
              </Button>
            )}
            
            {isWalletConnected && isAuthorized && (
              <p className="text-[9px] text-center text-gold/60 font-bold uppercase tracking-tighter">
                Gasless transmission • Secured by Session Key
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
