"use client"

import { useEffect, useCallback } from "react"
import { useConnect, useConnectors } from "wagmi"

/**
 * Detects if the application is running inside the MiniPay environment.
 */
export function isMiniPay(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.ethereum as any)?.isMiniPay === true
  )
}

/**
 * Hook to handle MiniPay auto-connection and environment detection.
 */
export function useMiniPay() {
  const { connect } = useConnect()
  const connectors = useConnectors()

  const autoConnect = useCallback(() => {
    if (isMiniPay()) {
      const injectedConnector = connectors.find((c) => c.id === "injected")
      if (injectedConnector) {
        connect({ connector: injectedConnector })
      }
    }
  }, [connectors, connect])

  useEffect(() => {
    autoConnect()
  }, [autoConnect])

  return { isMiniPay: isMiniPay() }
}
