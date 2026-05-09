'use client'
import { useState, useCallback } from 'react'
import type { Token, MarketFill, Order } from '@/types'
import { debounce } from '@/lib/utils'
import { useWalletStore } from '@/store/wallet'

interface SwapState {
  fromToken: Token | null
  toToken: Token | null
  fromAmount: string
  fill: MarketFill | null
  pendingOrder: Order | null
  isQuoting: boolean
  error: string | null
  balanceError: string | null
}

export function useSwap() {
  const { wallet } = useWalletStore()

  const [state, setState] = useState<SwapState>({
    fromToken: null,
    toToken: null,
    fromAmount: '',
    fill: null,
    pendingOrder: null,
    isQuoting: false,
    error: null,
    balanceError: null,
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchFill = useCallback(
    debounce(async (fromToken: Token, toToken: Token, amount: string) => {
      const parsed = parseFloat(amount)
      if (!parsed || parsed <= 0) {
        setState((s) => ({ ...s, fill: null, isQuoting: false }))
        return
      }
      setState((s) => ({ ...s, isQuoting: true, error: null }))
      try {
        const res = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromTokenId: fromToken.id,
            toTokenId: toToken.id,
            fromAmount: parsed,
          }),
        })
        if (!res.ok) throw new Error('Failed to fetch order book')
        const data: MarketFill = await res.json()
        setState((s) => ({ ...s, fill: data, isQuoting: false }))
      } catch {
        setState((s) => ({ ...s, error: 'Could not fetch order book price', isQuoting: false }))
      }
    }, 600),
    []
  )

  function setFromToken(token: Token) {
    setState((s) => {
      const next = { ...s, fromToken: token, fill: null, balanceError: null }
      if (next.toToken && next.fromAmount) fetchFill(token, next.toToken, next.fromAmount)
      return next
    })
  }

  function setToToken(token: Token) {
    setState((s) => {
      const next = { ...s, toToken: token, fill: null }
      if (next.fromToken && next.fromAmount) fetchFill(next.fromToken, token, next.fromAmount)
      return next
    })
  }

  function setFromAmount(amount: string) {
    setState((s) => {
      const balanceError = checkBalance(s.fromToken, amount, wallet?.balanceSats ?? 0)
      const next = { ...s, fromAmount: amount, fill: null, balanceError }
      if (next.fromToken && next.toToken) fetchFill(next.fromToken, next.toToken, amount)
      return next
    })
  }

  function flipTokens() {
    setState((s) => ({
      ...s,
      fromToken: s.toToken,
      toToken: s.fromToken,
      fromAmount: '',
      fill: null,
      balanceError: null,
    }))
  }

  function executeSwap() {
    const { fill } = state
    if (!fill?.hasLiquidity || !fill.bestOrder) {
      setState((s) => ({
        ...s,
        error: fill?.message ?? 'No open orders for this pair. Place a limit order on Trade.',
      }))
      return
    }
    setState((s) => ({ ...s, pendingOrder: fill.bestOrder, error: null }))
  }

  function clearPendingOrder() {
    setState((s) => ({ ...s, pendingOrder: null, fill: null, fromAmount: '' }))
  }

  return {
    ...state,
    setFromToken,
    setToToken,
    setFromAmount,
    flipTokens,
    executeSwap,
    clearPendingOrder,
  }
}

function checkBalance(
  fromToken: Token | null,
  amount: string,
  balanceSats: number
): string | null {
  if (!fromToken || !amount) return null
  const parsed = parseFloat(amount)
  if (!parsed || parsed <= 0) return null
  if (fromToken.type === 'BTC') {
    const requiredSats = Math.ceil(parsed * 1e8)
    if (requiredSats + 3000 > balanceSats) return 'Insufficient BTC balance'
  }
  return null
}
