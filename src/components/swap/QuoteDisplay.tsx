'use client'
import { useState, useEffect } from 'react'
import type { MarketFill } from '@/types'
import { formatAmount, formatUSD, formatSats, formatBTC } from '@/lib/utils'
import { BookOpen, Zap, AlertTriangle } from 'lucide-react'
import { PROTOCOL_FEE_BPS } from '@/lib/constants'

interface FillDisplayProps {
  fill: MarketFill
  onExpired?: () => void
}

export function FillDisplay({ fill, onExpired }: FillDisplayProps) {
  const [expiresIn, setExpiresIn] = useState(() =>
    Math.max(0, Math.round((fill.expiresAt - Date.now()) / 1000))
  )

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((fill.expiresAt - Date.now()) / 1000))
      setExpiresIn(remaining)
      if (remaining === 0) {
        clearInterval(id)
        onExpired?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [fill.expiresAt, onExpired])

  if (!fill.hasLiquidity) {
    return (
      <div className="flex items-start gap-2.5 px-4 py-3 bg-surface border border-border rounded-xl text-xs text-text-muted">
        <AlertTriangle size={13} className="text-warning mt-0.5 flex-shrink-0" />
        <span>{fill.message ?? 'No open orders for this pair.'}</span>
      </div>
    )
  }

  const { fromToken, toToken, fill: _fill, bestOrder } = {
    fromToken: fill.fromToken,
    toToken: fill.toToken,
    fill: null,
    bestOrder: fill.bestOrder,
  }

  const protocolFeeUSD =
    (fill.fromAmount * fill.fromToken.priceUSD * PROTOCOL_FEE_BPS) / 10_000

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <BookOpen size={13} className="text-primary" />
          <span>Order Book Fill</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-success font-medium">live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-text-muted text-xs mb-1">Rate</div>
          <div className="text-text-primary font-mono">
            1 {fill.fromToken.symbol} = {formatAmount(fill.rate, 4)} {fill.toToken.symbol}
          </div>
        </div>
        <div>
          <div className="text-text-muted text-xs mb-1">Price Impact</div>
          <div
            className={
              fill.priceImpact > 2
                ? 'text-danger font-semibold'
                : fill.priceImpact > 1
                ? 'text-warning font-semibold'
                : 'text-success font-semibold'
            }
          >
            {fill.priceImpact.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-text-muted text-xs mb-1">Network Fee</div>
          <div className="text-text-secondary font-mono">{formatSats(fill.networkFeeSats)}</div>
        </div>
        <div>
          <div className="text-text-muted text-xs mb-1">Protocol Fee</div>
          <div className="text-text-secondary font-mono">
            {formatUSD(protocolFeeUSD)} (0.15%)
          </div>
        </div>
      </div>

      {bestOrder && (
        <div className="pt-2 border-t border-border text-xs text-text-muted flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-primary" />
            <span>
              Order size: {formatAmount(bestOrder.from_amount, 4)} {fill.toToken.symbol} @{' '}
              {formatBTC(bestOrder.to_amount)} BTC
            </span>
          </div>
          <span>
            Expires in{' '}
            <span
              className={`font-mono ${expiresIn < 10 ? 'text-danger font-semibold' : 'text-text-secondary'}`}
            >
              {expiresIn}s
            </span>
          </span>
        </div>
      )}

      <p className="text-text-muted text-xs">
        Settles in a single Bitcoin transaction — no intermediaries, no custody.
      </p>
    </div>
  )
}
