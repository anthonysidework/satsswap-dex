'use client'
import { useOrderBook } from '@/hooks/useOrderBook'
import { TokenLogo } from '@/components/ui/TokenLogo'
import { formatBTC, formatAmount } from '@/lib/utils'
import type { Token } from '@/types'
import { RefreshCw } from 'lucide-react'

interface OrderBookProps {
  fromToken: Token | null
  toToken: Token | null
  onTakeOrder: (orderId: string) => void
}

export function OrderBook({ fromToken, toToken, onTakeOrder }: OrderBookProps) {
  const { orders, isLoading, error, refresh } = useOrderBook(
    fromToken?.id ?? null,
    toToken?.id ?? null
  )

  if (!fromToken || !toToken) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center text-text-muted text-sm">
        Select tokens to view the order book
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TokenLogo token={fromToken} size={18} />
          <span className="text-text-primary text-sm font-semibold">
            {fromToken.symbol} / {toToken.symbol}
          </span>
          <span className="text-text-muted text-xs">Order Book</span>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-4 px-4 py-2 text-xs text-text-muted border-b border-border">
        <span>Price ({toToken.symbol})</span>
        <span className="text-right">Amount ({fromToken.symbol})</span>
        <span className="text-right">Total (BTC)</span>
        <span className="text-right">Action</span>
      </div>

      {/* Orders */}
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {isLoading && orders.length === 0 && (
          <div className="px-4 py-8 text-center text-text-muted text-sm animate-pulse">
            Loading orders…
          </div>
        )}

        {!isLoading && !error && orders.length === 0 && (
          <div className="px-4 py-8 text-center text-text-muted text-sm">
            No open orders for this pair.
            <br />
            <span className="text-xs">Be the first to place one!</span>
          </div>
        )}

        {error && (
          <div className="px-4 py-4 text-center text-danger text-xs">{error}</div>
        )}

        {orders.map((order) => {
          const pricePerUnit = (order.to_amount * 1e-8) / order.from_amount
          const totalBtc = order.to_amount * 1e-8
          return (
            <div
              key={order.id}
              className="grid grid-cols-4 px-4 py-2.5 items-center hover:bg-surface/50 transition-colors group"
            >
              <span className="text-danger text-sm font-mono">
                {formatBTC(order.to_amount)} BTC
              </span>
              <span className="text-right text-text-primary text-sm font-mono">
                {formatAmount(order.from_amount, 4)}
              </span>
              <span className="text-right text-text-secondary text-sm font-mono">
                {formatBTC(order.to_amount)}
              </span>
              <div className="flex justify-end">
                <button
                  onClick={() => onTakeOrder(order.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-black text-xs font-semibold px-3 py-1 rounded-lg hover:bg-primary-dark"
                >
                  Buy
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer stats */}
      {orders.length > 0 && (
        <div className="px-4 py-2 border-t border-border flex justify-between text-xs text-text-muted">
          <span>{orders.length} open order{orders.length !== 1 ? 's' : ''}</span>
          <span>
            Best ask: {formatBTC(orders[0].to_amount)} BTC / {formatAmount(orders[0].from_amount, 4)} {fromToken.symbol}
          </span>
        </div>
      )}
    </div>
  )
}
