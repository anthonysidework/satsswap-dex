'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TokenLogo } from '@/components/ui/TokenLogo'
import { formatBTC, cn } from '@/lib/utils'
import { useWallet } from '@/hooks/useWallet'
import type { Token } from '@/types'

interface PlaceOrderProps {
  fromToken: Token | null
  toToken: Token | null
  onOrderPlaced: () => void
}

export function PlaceOrder({ fromToken, toToken, onOrderPlaced }: PlaceOrderProps) {
  const { wallet, signPsbt } = useWallet()
  const [fromAmount, setFromAmount] = useState('')
  const [askBtc, setAskBtc] = useState('')
  const [utxoTxid, setUtxoTxid] = useState('')
  const [utxoVout, setUtxoVout] = useState('0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'form' | 'signing' | 'done' | 'error'>('form')
  const [error, setError] = useState<string | null>(null)

  const pricePerUnit =
    askBtc && fromAmount && parseFloat(fromAmount) > 0
      ? parseFloat(askBtc) / parseFloat(fromAmount)
      : null

  async function handleSubmit() {
    if (!wallet || !fromToken || !toToken || !fromAmount || !askBtc || !utxoTxid) return
    setIsSubmitting(true)
    setError(null)

    try {
      // 1. Ask backend to build the maker PSBT template
      const buildRes = await fetch('/api/orders/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerAddress: wallet.taprootAddress ?? wallet.address,
          sellerPubkey: wallet.publicKey,
          utxoTxid,
          utxoVout: parseInt(utxoVout),
          askSats: Math.round(parseFloat(askBtc) * 1e8),
        }),
      })

      if (!buildRes.ok) {
        const e = await buildRes.json()
        throw new Error(e.error ?? 'Failed to build PSBT')
      }

      const { psbtHex } = await buildRes.json()

      // 2. Ask the wallet to sign (SIGHASH_SINGLE|ANYONECANPAY)
      setStep('signing')
      const signedPsbtHex = await signPsbt(psbtHex)

      // 3. Submit the signed maker PSBT to the order book
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          makerAddress: wallet.taprootAddress ?? wallet.address,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          fromAmount: parseFloat(fromAmount),
          toAmount: Math.round(parseFloat(askBtc) * 1e8),
          psbtHex: signedPsbtHex,
          utxoTxid,
          utxoVout: parseInt(utxoVout),
        }),
      })

      if (!orderRes.ok) {
        const e = await orderRes.json()
        throw new Error(e.error ?? 'Failed to place order')
      }

      setStep('done')
      onOrderPlaced()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
      setStep('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!fromToken || !toToken) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center text-text-muted text-sm">
        Select tokens to place an order
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
        <div className="text-success text-3xl">✓</div>
        <div className="text-text-primary font-semibold">Order placed!</div>
        <p className="text-text-muted text-sm">
          Your {fromAmount} {fromToken.symbol} is listed at {askBtc} BTC.
          You&apos;ll receive BTC when a buyer fills it.
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setStep('form')
            setFromAmount('')
            setAskBtc('')
            setUtxoTxid('')
            setUtxoVout('0')
          }}
        >
          Place Another Order
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-text-primary text-sm font-semibold">Place Sell Order</h3>
        <p className="text-text-muted text-xs mt-0.5">
          List your {fromToken.symbol} for sale — buyers fill your order on-chain
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Amount to sell */}
        <div>
          <label className="text-text-muted text-xs mb-1.5 block">
            Amount to sell
          </label>
          <div className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
            <input
              type="text"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="flex-1 bg-transparent text-xl font-bold text-text-primary placeholder:text-border focus:outline-none"
            />
            <div className="flex items-center gap-2 text-text-primary text-sm font-semibold">
              <TokenLogo token={fromToken} size={20} />
              {fromToken.symbol}
            </div>
          </div>
        </div>

        {/* Ask price */}
        <div>
          <label className="text-text-muted text-xs mb-1.5 block">
            Ask price (total BTC you want)
          </label>
          <div className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
            <input
              type="text"
              placeholder="0.0"
              value={askBtc}
              onChange={(e) => setAskBtc(e.target.value.replace(/[^0-9.]/g, ''))}
              className="flex-1 bg-transparent text-xl font-bold text-text-primary placeholder:text-border focus:outline-none"
            />
            <span className="text-text-primary text-sm font-semibold">BTC</span>
          </div>
          {pricePerUnit !== null && (
            <p className="text-text-muted text-xs mt-1">
              ≈ {pricePerUnit.toFixed(8)} BTC per {fromToken.symbol}
            </p>
          )}
        </div>

        {/* UTXO info */}
        <div className="space-y-2">
          <label className="text-text-muted text-xs block">
            UTXO containing your {fromToken.symbol}
            <span className="ml-1 text-primary">(txid:vout)</span>
          </label>
          <input
            type="text"
            placeholder="Transaction ID (64 hex chars)"
            value={utxoTxid}
            onChange={(e) => setUtxoTxid(e.target.value.trim())}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 font-mono"
          />
          <input
            type="number"
            placeholder="Output index (vout)"
            min="0"
            value={utxoVout}
            onChange={(e) => setUtxoVout(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>

        {error && (
          <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button
          className="w-full"
          size="lg"
          loading={isSubmitting}
          disabled={!wallet || !fromAmount || !askBtc || !utxoTxid}
          onClick={!wallet ? undefined : handleSubmit}
          variant="primary"
        >
          {!wallet
            ? 'Connect Wallet First'
            : step === 'signing'
            ? 'Sign in Wallet…'
            : 'Place Order'}
        </Button>

        <p className="text-text-muted text-xs text-center">
          Your PSBT is signed with SIGHASH_SINGLE|ANYONECANPAY — no custody, fully trustless.
        </p>
      </div>
    </div>
  )
}
