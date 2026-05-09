'use client'
import { useState } from 'react'
import { useTokens } from '@/hooks/useTokens'
import { PriceChart } from '@/components/ui/PriceChart'
import { TokenLogo } from '@/components/ui/TokenLogo'
import { formatUSD } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { Token } from '@/types'

interface SwapSidebarProps {
  initialTokens: Token[]
}

export function SwapSidebar({ initialTokens }: SwapSidebarProps) {
  const { tokens: liveTokens } = useTokens()
  const tokens = liveTokens.length > 0 ? liveTokens : initialTokens

  // Default chart token: first token with a known CoinGecko chart (ORDI is safest)
  const defaultToken = tokens.find((t) => t.symbol === 'ORDI') ?? tokens.find((t) => t.type !== 'BTC') ?? tokens[0]
  const [chartToken, setChartToken] = useState<Token>(defaultToken)

  // Sync chartToken if live tokens update and the token obj changes reference
  const liveChartToken = tokens.find((t) => t.id === chartToken.id) ?? chartToken

  const trending = tokens.filter((t) => t.type !== 'BTC').slice(0, 5)

  return (
    <div className="flex-1 space-y-4">
      {/* Chart card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <PriceChart
          tokenId={liveChartToken.id}
          symbol={liveChartToken.symbol}
          color={liveChartToken.logoColor}
          height={220}
          seedPrice={liveChartToken.priceUSD}
          seedChange24h={liveChartToken.change24h}
          seedVolume={liveChartToken.volume24h}
          seedMarketCap={liveChartToken.marketCap}
        />
      </div>

      {/* Trending — click any row to chart it */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-bold">Markets</h3>
          <span className="text-text-muted text-xs">Click to chart</span>
        </div>
        <div className="space-y-1">
          {trending.map((token) => {
            const isSelected = token.id === liveChartToken.id
            return (
              <button
                key={token.id}
                onClick={() => setChartToken(token)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isSelected
                    ? 'bg-primary/8 border border-primary/20'
                    : 'hover:bg-surface border border-transparent'
                }`}
              >
                <TokenLogo token={token} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                      {token.symbol}
                    </span>
                    {isSelected && (
                      <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
                        charting
                      </span>
                    )}
                  </div>
                  <div className="text-text-muted text-xs truncate">{token.name}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-text-primary text-sm font-mono">{formatUSD(token.priceUSD)}</div>
                  <div
                    className={`flex items-center justify-end gap-0.5 text-xs ${
                      token.change24h >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {token.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(token.change24h).toFixed(2)}%
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Guide */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <h4 className="text-primary font-semibold text-xs uppercase tracking-wide mb-2">Market Order</h4>
        <ol className="text-text-secondary text-xs space-y-1 list-decimal list-inside leading-relaxed">
          <li>Connect your Bitcoin wallet (top-right)</li>
          <li>Select tokens and enter a BTC amount</li>
          <li>We find the best open order in the book</li>
          <li>Sign in your wallet — settles on Bitcoin L1</li>
        </ol>
        <p className="text-text-muted text-xs mt-3">
          Want to set your own price?{' '}
          <a href="/dex" className="text-primary hover:underline">Place a limit order →</a>
        </p>
      </div>
    </div>
  )
}
