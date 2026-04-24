'use client'
import { useState } from 'react'
import { OrderBook } from './OrderBook'
import { PlaceOrder } from './PlaceOrder'
import { MyOrders } from './MyOrders'
import { TakeOrderModal } from './TakeOrderModal'
import { TokenSelector } from '@/components/swap/TokenSelector'
import { TokenLogo } from '@/components/ui/TokenLogo'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useOrderBook } from '@/hooks/useOrderBook'
import type { Token } from '@/types'

interface DexInterfaceProps {
  initialTokens: Token[]
}

type ActiveTab = 'orderbook' | 'place' | 'myorders'

export function DexInterface({ initialTokens }: DexInterfaceProps) {
  const [fromToken, setFromToken] = useState<Token | null>(
    initialTokens.find((t) => t.type === 'RUNE') ?? null
  )
  const [toToken, setToToken] = useState<Token | null>(
    initialTokens.find((t) => t.type === 'BTC') ?? null
  )
  const [activeTab, setActiveTab] = useState<ActiveTab>('orderbook')
  const [showFromSelector, setShowFromSelector] = useState(false)
  const [showToSelector, setShowToSelector] = useState(false)
  const [takingOrderId, setTakingOrderId] = useState<string | null>(null)

  const { orders, refresh } = useOrderBook(fromToken?.id ?? null, toToken?.id ?? null)
  const takingOrder = orders.find((o) => o.id === takingOrderId)

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: 'orderbook', label: 'Order Book' },
    { id: 'place', label: 'Place Order' },
    { id: 'myorders', label: 'My Orders' },
  ]

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left: pair selector + order book / place order / my orders */}
      <div className="w-full lg:w-[600px] space-y-4">
        {/* Pair selector */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-text-muted text-sm">Pair:</span>
          <button
            onClick={() => setShowFromSelector(true)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-all text-sm font-medium',
              fromToken
                ? 'bg-surface border-border hover:border-border-light text-text-primary'
                : 'bg-primary text-black border-transparent'
            )}
          >
            {fromToken ? (
              <>
                <TokenLogo token={fromToken} size={18} />
                {fromToken.symbol}
                <Badge variant={fromToken.type === 'RUNE' ? 'rune' : fromToken.type === 'BRC20' ? 'brc20' : 'btc'} className="text-xs">
                  {fromToken.type}
                </Badge>
              </>
            ) : 'Select'}
          </button>
          <span className="text-text-muted">/</span>
          <button
            onClick={() => setShowToSelector(true)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-all text-sm font-medium',
              toToken
                ? 'bg-surface border-border hover:border-border-light text-text-primary'
                : 'bg-primary text-black border-transparent'
            )}
          >
            {toToken ? (
              <>
                <TokenLogo token={toToken} size={18} />
                {toToken.symbol}
              </>
            ) : 'Select'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-card text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'orderbook' && (
          <OrderBook
            fromToken={fromToken}
            toToken={toToken}
            onTakeOrder={(id) => setTakingOrderId(id)}
          />
        )}
        {activeTab === 'place' && (
          <PlaceOrder
            fromToken={fromToken}
            toToken={toToken}
            onOrderPlaced={() => { setActiveTab('orderbook'); refresh() }}
          />
        )}
        {activeTab === 'myorders' && <MyOrders />}
      </div>

      {/* Right: info panel */}
      <div className="w-full lg:flex-1 space-y-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-text-primary font-semibold text-sm">How it works</h3>
          <div className="space-y-3 text-sm text-text-secondary">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <p><strong className="text-text-primary">Sellers</strong> place maker orders by signing a PSBT with SIGHASH_SINGLE|ANYONECANPAY. Their token is listed without being transferred.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <p><strong className="text-text-primary">Buyers</strong> complete the PSBT by adding their BTC input and signing. One broadcast = both sides settle atomically.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              <p><strong className="text-text-primary">No custody.</strong> SatsSwap never holds your assets. If a trade doesn&apos;t execute, nothing happened on-chain.</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-text-primary font-semibold text-sm mb-3">Supported Assets</h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <Badge variant="rune">RUNE</Badge>
              <span>Bitcoin Runes — UTXO-native fungible tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="brc20">BRC-20</Badge>
              <span>BRC-20 tokens — requires pre-inscribed transfer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showFromSelector && (
        <TokenSelector
          onSelect={(t) => { setFromToken(t); setShowFromSelector(false) }}
          onClose={() => setShowFromSelector(false)}
          excludeId={toToken?.id}
        />
      )}
      {showToSelector && (
        <TokenSelector
          onSelect={(t) => { setToToken(t); setShowToSelector(false) }}
          onClose={() => setShowToSelector(false)}
          excludeId={fromToken?.id}
        />
      )}
      {takingOrder && fromToken && toToken && (
        <TakeOrderModal
          order={takingOrder}
          fromTokenSymbol={fromToken.symbol}
          toTokenSymbol={toToken.symbol}
          onClose={() => { setTakingOrderId(null); refresh() }}
        />
      )}
    </div>
  )
}
