'use client'
import { useState, useEffect } from 'react'
import { useSwap } from '@/hooks/useSwap'
import { useWallet } from '@/hooks/useWallet'
import { useTokens } from '@/hooks/useTokens'
import { useSearchParams } from 'next/navigation'
import { TokenSelector } from './TokenSelector'
import { FillDisplay } from './QuoteDisplay'
import { TakeOrderModal } from '@/components/dex/TakeOrderModal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TokenLogo } from '@/components/ui/TokenLogo'
import { formatAmount, formatUSD, formatBTC, cn } from '@/lib/utils'
import { ArrowUpDown } from 'lucide-react'
import type { Token } from '@/types'
import Link from 'next/link'

export function SwapCard() {
  const swap = useSwap()
  const { wallet, openModal } = useWallet()
  const { tokens } = useTokens()
  const searchParams = useSearchParams()

  // Pre-populate tokens from URL params (?from=BTC&to=ORDI)
  useEffect(() => {
    const fromId = searchParams.get('from')
    const toId = searchParams.get('to')
    if (fromId && !swap.fromToken) {
      const t = tokens.find((tk) => tk.id === fromId || tk.symbol === fromId)
      if (t) swap.setFromToken(t)
    }
    if (toId && !swap.toToken) {
      const t = tokens.find((tk) => tk.id === toId || tk.symbol === toId)
      if (t) swap.setToToken(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens])

  const [showFromSelector, setShowFromSelector] = useState(false)
  const [showToSelector, setShowToSelector] = useState(false)

  const { fill } = swap
  const toAmount = fill?.hasLiquidity ? fill.estimatedOutput : 0

  // Selling token → BTC: not supported as market order, redirect to Trade
  const isSellDirection = swap.fromToken?.type !== 'BTC' && swap.toToken?.type === 'BTC'

  function handleFromAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    if ((val.match(/\./g) ?? []).length > 1) return
    swap.setFromAmount(val)
  }

  function getButtonLabel() {
    if (!wallet) return 'Connect Wallet'
    if (swap.balanceError) return swap.balanceError
    if (!swap.fromToken || !swap.toToken) return 'Select Tokens'
    if (!swap.fromAmount) return 'Enter an Amount'
    if (isSellDirection) return 'Place Limit Order on Trade →'
    if (swap.isQuoting) return 'Checking Order Book...'
    if (fill && !fill.hasLiquidity) return 'No Orders Available'
    if (fill?.hasLiquidity) return `Buy ${swap.toToken.symbol}`
    return 'Check Order Book'
  }

  function handleButton() {
    if (!wallet) { openModal(); return }
    if (isSellDirection) return // handled by link
    swap.executeSwap()
  }

  const canExecute =
    !!wallet &&
    !swap.balanceError &&
    !!swap.fromToken &&
    !!swap.toToken &&
    !!swap.fromAmount &&
    !swap.isQuoting &&
    !isSellDirection &&
    fill?.hasLiquidity === true

  return (
    <>
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-text-primary font-bold">Market Order</h2>
            <p className="text-text-muted text-xs mt-0.5">Fill the best open order instantly</p>
          </div>
          <Link
            href="/dex"
            className="text-xs text-primary hover:underline"
          >
            Limit orders →
          </Link>
        </div>

        {/* From token */}
        <div className="p-4">
          <TokenInputBox
            label="You pay"
            token={swap.fromToken}
            amount={swap.fromAmount}
            onAmountChange={handleFromAmountChange}
            onTokenClick={() => setShowFromSelector(true)}
            wallet={wallet}
          />

          {/* Flip */}
          <div className="flex justify-center my-2">
            <button
              onClick={swap.flipTokens}
              className="w-9 h-9 rounded-xl bg-surface border border-border hover:border-border-light hover:bg-card flex items-center justify-center text-text-muted hover:text-primary transition-all"
            >
              <ArrowUpDown size={16} />
            </button>
          </div>

          {/* To token */}
          <TokenInputBox
            label="You receive"
            token={swap.toToken}
            amount={toAmount > 0 ? formatAmount(toAmount, 8) : ''}
            onAmountChange={() => {}}
            onTokenClick={() => setShowToSelector(true)}
            readOnly
            loading={swap.isQuoting}
          />
        </div>

        {/* Rate preview */}
        {swap.fromToken && swap.toToken && fill?.hasLiquidity && (
          <div className="px-4 pb-1">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>
                1 {swap.fromToken.symbol} ≈ {formatAmount(fill.rate, 6)} {swap.toToken.symbol}
              </span>
              <span>{formatUSD(swap.fromToken.priceUSD)}</span>
            </div>
          </div>
        )}

        {/* Sell direction notice */}
        {isSellDirection && (
          <div className="mx-4 mb-3 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-muted">
            Market orders only support buying tokens with BTC.{' '}
            <Link href="/dex" className="text-primary hover:underline">
              Place a limit sell order on Trade →
            </Link>
          </div>
        )}

        {/* Action */}
        <div className="p-4 pt-2">
          {isSellDirection ? (
            <Link href="/dex">
              <Button className="w-full" size="lg" variant="secondary">
                Place Limit Order on Trade →
              </Button>
            </Link>
          ) : (
            <Button
              className="w-full"
              size="lg"
              loading={swap.isQuoting}
              disabled={!!wallet && !canExecute}
              variant={swap.balanceError ? 'danger' : 'primary'}
              onClick={handleButton}
            >
              {getButtonLabel()}
            </Button>
          )}
          {swap.error && (
            <p className="text-danger text-xs text-center mt-2">{swap.error}</p>
          )}
        </div>
      </div>

      {/* Fill details */}
      {fill && (
        <div className="mt-3">
          <FillDisplay fill={fill} onExpired={() => {
            if (swap.fromToken && swap.toToken && swap.fromAmount) {
              swap.setFromAmount(swap.fromAmount)
            }
          }} />
        </div>
      )}

      {/* Loading skeleton */}
      {swap.isQuoting && !fill && (
        <div className="mt-3 bg-surface border border-border rounded-xl p-4 animate-pulse space-y-3">
          <div className="h-4 bg-border rounded w-1/3" />
          <div className="h-4 bg-border rounded w-2/3" />
          <div className="h-4 bg-border rounded w-1/2" />
        </div>
      )}

      {/* Modals */}
      {showFromSelector && (
        <TokenSelector
          onSelect={swap.setFromToken}
          onClose={() => setShowFromSelector(false)}
          excludeId={swap.toToken?.id}
        />
      )}
      {showToSelector && (
        <TokenSelector
          onSelect={swap.setToToken}
          onClose={() => setShowToSelector(false)}
          excludeId={swap.fromToken?.id}
        />
      )}
      {swap.pendingOrder && swap.fromToken && swap.toToken && (
        <TakeOrderModal
          order={swap.pendingOrder}
          fromTokenSymbol={swap.toToken.symbol}
          toTokenSymbol={swap.fromToken.symbol}
          onClose={swap.clearPendingOrder}
        />
      )}
    </>
  )
}

interface TokenInputBoxProps {
  label: string
  token: Token | null
  amount: string
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onTokenClick: () => void
  readOnly?: boolean
  loading?: boolean
  wallet?: { balanceSats: number } | null
}

function TokenInputBox({
  label,
  token,
  amount,
  onAmountChange,
  onTokenClick,
  readOnly,
  loading,
  wallet,
}: TokenInputBoxProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-border-light transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted text-xs">{label}</span>
        {token && wallet && !readOnly && (
          <span className="text-text-muted text-xs">
            Bal: {token.type === 'BTC' ? formatBTC(wallet.balanceSats) + ' BTC' : '—'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={loading ? '' : amount}
          onChange={onAmountChange}
          readOnly={readOnly}
          className={cn(
            'flex-1 bg-transparent text-2xl font-bold text-text-primary placeholder:text-border focus:outline-none min-w-0',
            readOnly && 'cursor-default',
            loading && 'animate-pulse'
          )}
        />
        <button
          onClick={onTokenClick}
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2 flex-shrink-0 border transition-all text-sm font-semibold',
            token
              ? 'bg-card border-border hover:border-border-light text-text-primary'
              : 'bg-primary text-black border-transparent hover:bg-primary-dark shadow-orange'
          )}
        >
          {token ? (
            <>
              <TokenLogo token={token} size={24} />
              <span>{token.symbol}</span>
              <Badge
                variant={
                  token.type === 'RUNE' ? 'rune' : token.type === 'BRC20' ? 'brc20' : 'btc'
                }
                className="hidden sm:inline-flex"
              >
                {token.type === 'BRC20' ? 'BRC-20' : token.type}
              </Badge>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </>
          ) : (
            <>
              Select token
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </>
          )}
        </button>
      </div>
      {token && amount && !readOnly && (
        <div className="text-text-muted text-xs mt-2">
          ≈ {formatUSD(parseFloat(amount) * token.priceUSD)}
        </div>
      )}
      {token && amount && readOnly && !loading && (
        <div className="text-text-muted text-xs mt-2">
          ≈ {formatUSD(parseFloat(amount) * token.priceUSD)}
        </div>
      )}
    </div>
  )
}
