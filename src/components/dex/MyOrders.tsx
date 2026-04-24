'use client'
import { useMyOrders } from '@/hooks/useOrderBook'
import { Button } from '@/components/ui/Button'
import { formatBTC, formatAmount } from '@/lib/utils'
import { useWalletStore } from '@/store/wallet'
import { useState } from 'react'
import type { Order } from '@/lib/db/types'

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-success/15 text-success',
  filled: 'bg-primary/15 text-primary',
  cancelled: 'bg-surface text-text-muted',
  expired: 'bg-surface text-text-muted',
}

export function MyOrders() {
  const { wallet } = useWalletStore()
  const { orders, isLoading, refresh, cancelOrder } = useMyOrders(wallet?.address ?? null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  async function handleCancel(order: Order) {
    if (!wallet) return
    setCancellingId(order.id)
    setCancelError(null)
    try {
      await cancelOrder(order.id, wallet.address)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCancellingId(null)
    }
  }

  if (!wallet) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center text-text-muted text-sm">
        Connect your wallet to view your orders
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-text-primary text-sm font-semibold">My Orders</h3>
        <button
          onClick={refresh}
          className="text-text-muted hover:text-text-primary text-xs transition-colors"
        >
          Refresh
        </button>
      </div>

      {isLoading && orders.length === 0 && (
        <div className="px-4 py-6 text-center text-text-muted text-sm animate-pulse">
          Loading…
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="px-4 py-6 text-center text-text-muted text-sm">
          No orders yet
        </div>
      )}

      <div className="divide-y divide-border">
        {orders.map((order) => (
          <div key={order.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-text-primary text-sm font-medium">
                Sell {formatAmount(order.from_amount, 4)} {order.from_token_id.toUpperCase()}
                <span className="text-text-muted mx-1.5">→</span>
                {formatBTC(order.to_amount)} BTC
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[order.status] ?? ''}`}>
                {order.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Expires {new Date(order.expires_at).toLocaleDateString()}</span>
              {order.status === 'open' && (
                <button
                  onClick={() => handleCancel(order)}
                  disabled={cancellingId === order.id}
                  className="text-danger hover:underline disabled:opacity-50"
                >
                  {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {cancelError && (
        <div className="px-4 py-2 text-danger text-xs border-t border-border">{cancelError}</div>
      )}
    </div>
  )
}
