'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatBTC, formatAmount } from '@/lib/utils'
import { useWallet } from '@/hooks/useWallet'
import { useWalletStore } from '@/store/wallet'
import { broadcastTx, pollTxStatus } from '@/lib/mempool'
import type { Order } from '@/lib/db/types'
import { ExternalLink, X } from 'lucide-react'

interface TakeOrderModalProps {
  order: Order
  fromTokenSymbol: string
  toTokenSymbol: string
  onClose: () => void
}

type Step = 'confirm' | 'signing' | 'broadcasting' | 'done' | 'error'

export function TakeOrderModal({ order, fromTokenSymbol, toTokenSymbol, onClose }: TakeOrderModalProps) {
  const { wallet, signPsbt } = useWallet()
  const { wallet: walletState } = useWalletStore()
  const [step, setStep] = useState<Step>('confirm')
  const [txid, setTxid] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pricePerUnit = (order.to_amount * 1e-8) / order.from_amount

  async function handleTake() {
    if (!walletState) return
    setStep('signing')
    setError(null)

    try {
      // 1. Get the completed (taker-side added) PSBT from the backend
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: walletState.taprootAddress ?? walletState.address,
          buyerPubkey: walletState.publicKey,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to build taker PSBT')
      }

      const { psbtHex } = await res.json()

      // 2. Ask the wallet to sign the taker inputs
      const signedPsbtHex = await signPsbt(psbtHex)

      // 3. Broadcast
      setStep('broadcasting')
      const broadcastedTxid = await broadcastTx(signedPsbtHex)

      setTxid(broadcastedTxid)
      setTxStatus('mempool')
      setStep('done')

      pollTxStatus(broadcastedTxid, (s) => setTxStatus(s.status))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed')
      setStep('error')
    }
  }

  const stepLabel: Record<Step, string> = {
    confirm: 'Confirm Swap',
    signing: 'Sign in Wallet…',
    broadcasting: 'Broadcasting…',
    done: 'Done',
    error: 'Retry',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-card border border-border rounded-2xl w-full max-w-sm shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-text-primary font-bold">
            {step === 'done' ? 'Swap Complete!' : 'Confirm Swap'}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'done' && txid ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">✓</div>
              <p className="text-text-primary font-semibold">Transaction broadcast!</p>
              <p className="text-text-muted text-sm">
                Status: <span className="text-success">{txStatus ?? 'mempool'}</span>
              </p>
              <a
                href={`https://mempool.space/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-primary hover:underline text-sm"
              >
                View on Mempool.space <ExternalLink size={13} />
              </a>
              <Button variant="secondary" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : (
            <>
              {/* Swap summary */}
              <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">You pay</span>
                  <span className="text-text-primary font-semibold">
                    {formatBTC(order.to_amount)} BTC
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">You receive</span>
                  <span className="text-text-primary font-semibold">
                    {formatAmount(order.from_amount, 4)} {fromTokenSymbol}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Price per {fromTokenSymbol}</span>
                  <span>{pricePerUnit.toFixed(8)} BTC</span>
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Settlement</span>
                  <span className="text-success">Trustless PSBT — on-chain atomic</span>
                </div>
              </div>

              {error && (
                <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                className="w-full"
                size="lg"
                loading={step === 'signing' || step === 'broadcasting'}
                disabled={!walletState}
                onClick={handleTake}
              >
                {!walletState ? 'Connect Wallet' : stepLabel[step]}
              </Button>

              <p className="text-text-muted text-xs text-center">
                This swap executes in a single Bitcoin transaction — no intermediaries.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
