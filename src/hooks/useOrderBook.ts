'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Order } from '@/lib/db/types'

interface OrderBookState {
  orders: Order[]
  isLoading: boolean
  error: string | null
}

export function useOrderBook(fromTokenId: string | null, toTokenId: string | null) {
  const [state, setState] = useState<OrderBookState>({ orders: [], isLoading: false, error: null })

  const refresh = useCallback(async () => {
    if (!fromTokenId || !toTokenId) {
      setState({ orders: [], isLoading: false, error: null })
      return
    }
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const res = await fetch(
        `/api/orders?fromToken=${encodeURIComponent(fromTokenId)}&toToken=${encodeURIComponent(toTokenId)}`
      )
      if (!res.ok) throw new Error(`Order book fetch failed: ${res.status}`)
      const data = await res.json()
      setState({ orders: data.orders ?? [], isLoading: false, error: null })
    } catch (err) {
      setState({ orders: [], isLoading: false, error: err instanceof Error ? err.message : 'Failed to load orders' })
    }
  }, [fromTokenId, toTokenId])

  useEffect(() => {
    refresh()
    // Poll order book every 10 seconds for freshness
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [refresh])

  return { ...state, refresh }
}

export function useMyOrders(makerAddress: string | null) {
  const [state, setState] = useState<OrderBookState>({ orders: [], isLoading: false, error: null })

  const refresh = useCallback(async () => {
    if (!makerAddress) {
      setState({ orders: [], isLoading: false, error: null })
      return
    }
    setState((s) => ({ ...s, isLoading: true }))
    try {
      const res = await fetch(`/api/orders?maker=${encodeURIComponent(makerAddress)}`)
      if (!res.ok) throw new Error(`Orders fetch failed: ${res.status}`)
      const data = await res.json()
      setState({ orders: data.orders ?? [], isLoading: false, error: null })
    } catch (err) {
      setState({ orders: [], isLoading: false, error: err instanceof Error ? err.message : 'Failed to load orders' })
    }
  }, [makerAddress])

  useEffect(() => { refresh() }, [refresh])

  async function cancelOrder(orderId: string, makerAddress: string): Promise<void> {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ makerAddress }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Cancel failed')
    }
    await refresh()
  }

  return { ...state, refresh, cancelOrder }
}
