'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { TokenLogo } from '@/components/ui/TokenLogo'
import { formatBTC, truncateAddress } from '@/lib/utils'
import { useWallet } from '@/hooks/useWallet'
import { TOKEN_RUNE_IDS } from '@/lib/constants'
import type { Token } from '@/types'
import type { RuneUtxo } from '@/app/api/utxos/runes/route'
import type { Brc20TransferUtxo } from '@/app/api/utxos/brc20/route'
import { ExternalLink, RefreshCw, ChevronDown } from 'lucide-react'

interface PlaceOrderProps {
  fromToken: Token | null
  toToken: Token | null
  onOrderPlaced: () => void
}

type Step = 'form' | 'signing' | 'done' | 'error'

export function PlaceOrder({ fromToken, toToken, onOrderPlaced }: PlaceOrderProps) {
  const { wallet, signPsbt } = useWallet()

  // Form state
  const [askBtc, setAskBtc] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // UTXO picker state
  const [runeUtxos, setRuneUtxos] = useState<RuneUtxo[]>([])
  const [brc20Utxos, setBrc20Utxos] = useState<Brc20TransferUtxo[]>([])
  const [selectedRuneUtxo, setSelectedRuneUtxo] = useState<RuneUtxo | null>(null)
  const [selectedBrc20Utxo, setSelectedBrc20Utxo] = useState<Brc20TransferUtxo | null>(null)
  const [fetchingUtxos, setFetchingUtxos] = useState(false)
  const [utxoError, setUtxoError] = useState<string | null>(null)
  const [keyMissing, setKeyMissing] = useState(false)

  const tokenType = fromToken?.type ?? null
  const runeId = fromToken ? TOKEN_RUNE_IDS[fromToken.id] : null

  // Auto-fetch UTXOs when wallet + token changes
  useEffect(() => {
    if (!wallet || !fromToken) {
      setRuneUtxos([])
      setBrc20Utxos([])
      setSelectedRuneUtxo(null)
      setSelectedBrc20Utxo(null)
      return
    }

    const address = wallet.taprootAddress ?? wallet.address

    if (tokenType === 'RUNE') {
      if (!runeId) {
        setUtxoError(`No on-chain Rune ID configured for ${fromToken.symbol}`)
        return
      }
      setFetchingUtxos(true)
      setUtxoError(null)
      setSelectedRuneUtxo(null)
      fetch(`/api/utxos/runes?address=${encodeURIComponent(address)}&runeId=${encodeURIComponent(runeId)}`)
        .then((r) => r.json())
        .then((data) => {
          setRuneUtxos(data.utxos ?? [])
          setKeyMissing(data.keyMissing === true)
          if (data.utxos?.length) setSelectedRuneUtxo(data.utxos[0])
        })
        .catch(() => setUtxoError('Failed to fetch Rune UTXOs'))
        .finally(() => setFetchingUtxos(false))
    } else if (tokenType === 'BRC20') {
      setFetchingUtxos(true)
      setUtxoError(null)
      setSelectedBrc20Utxo(null)
      fetch(`/api/utxos/brc20?address=${encodeURIComponent(address)}&ticker=${encodeURIComponent(fromToken.symbol.toLowerCase())}`)
        .then((r) => r.json())
        .then((data) => {
          setBrc20Utxos(data.utxos ?? [])
          setKeyMissing(data.keyMissing === true)
          if (data.utxos?.length) setSelectedBrc20Utxo(data.utxos[0])
        })
        .catch(() => setUtxoError('Failed to fetch transfer inscriptions'))
        .finally(() => setFetchingUtxos(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address, fromToken?.id])

  function refetchUtxos() {
    setRuneUtxos([])
    setBrc20Utxos([])
    setSelectedRuneUtxo(null)
    setSelectedBrc20Utxo(null)
    // Trigger re-fetch by resetting (useEffect watches wallet.address + fromToken.id)
    // We use a small workaround: just call the fetch directly
    const address = wallet?.taprootAddress ?? wallet?.address
    if (!address || !fromToken) return

    setFetchingUtxos(true)
    setUtxoError(null)

    if (tokenType === 'RUNE' && runeId) {
      fetch(`/api/utxos/runes?address=${encodeURIComponent(address)}&runeId=${encodeURIComponent(runeId)}`)
        .then((r) => r.json())
        .then((data) => {
          setRuneUtxos(data.utxos ?? [])
          setKeyMissing(data.keyMissing === true)
          if (data.utxos?.length) setSelectedRuneUtxo(data.utxos[0])
        })
        .catch(() => setUtxoError('Failed to fetch Rune UTXOs'))
        .finally(() => setFetchingUtxos(false))
    } else if (tokenType === 'BRC20') {
      fetch(`/api/utxos/brc20?address=${encodeURIComponent(address)}&ticker=${encodeURIComponent(fromToken.symbol.toLowerCase())}`)
        .then((r) => r.json())
        .then((data) => {
          setBrc20Utxos(data.utxos ?? [])
          setKeyMissing(data.keyMissing === true)
          if (data.utxos?.length) setSelectedBrc20Utxo(data.utxos[0])
        })
        .catch(() => setUtxoError('Failed to fetch transfer inscriptions'))
        .finally(() => setFetchingUtxos(false))
    }
  }

  // Derived values from selected UTXO
  const selectedUtxoTxid = selectedRuneUtxo?.txid ?? selectedBrc20Utxo?.txid ?? null
  const selectedUtxoVout = selectedRuneUtxo?.vout ?? selectedBrc20Utxo?.vout ?? null

  const displayAmount = selectedRuneUtxo
    ? (Number(selectedRuneUtxo.amount) / Math.pow(10, selectedRuneUtxo.divisibility)).toFixed(selectedRuneUtxo.divisibility)
    : selectedBrc20Utxo?.amount ?? null

  const pricePerUnit =
    askBtc && displayAmount && parseFloat(displayAmount) > 0
      ? (parseFloat(askBtc) / parseFloat(displayAmount)).toFixed(8)
      : null

  async function handleSubmit() {
    if (!wallet || !fromToken || !toToken || !askBtc || !selectedUtxoTxid || selectedUtxoVout === null) return
    setIsSubmitting(true)
    setError(null)

    try {
      // 1. Build maker PSBT template
      const buildRes = await fetch('/api/orders/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerAddress: wallet.taprootAddress ?? wallet.address,
          sellerPubkey: wallet.publicKey,
          utxoTxid: selectedUtxoTxid,
          utxoVout: selectedUtxoVout,
          askSats: Math.round(parseFloat(askBtc) * 1e8),
        }),
      })
      if (!buildRes.ok) {
        const e = await buildRes.json()
        throw new Error(e.error ?? 'Failed to build PSBT')
      }
      const { psbtHex } = await buildRes.json()

      // 2. Wallet signs
      setStep('signing')
      const signedPsbtHex = await signPsbt(psbtHex)

      // 3. Store the signed order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          makerAddress: wallet.taprootAddress ?? wallet.address,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          fromAmount: displayAmount ? parseFloat(displayAmount) : 0,
          toAmount: Math.round(parseFloat(askBtc) * 1e8),
          psbtHex: signedPsbtHex,
          utxoTxid: selectedUtxoTxid,
          utxoVout: selectedUtxoVout,
          // Rune-specific: required for Runestone encoding when the order is filled
          runeId: selectedRuneUtxo ? selectedRuneUtxo.runeId : null,
          runeAmount: selectedRuneUtxo ? selectedRuneUtxo.amount : null,
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

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!fromToken || !toToken) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center text-text-muted text-sm">
        Select a token pair to place an order.
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
        <div className="text-success text-3xl">✓</div>
        <div className="text-text-primary font-semibold">Order placed!</div>
        <p className="text-text-muted text-sm">
          {displayAmount} {fromToken.symbol} listed at {askBtc} BTC.
          You&apos;ll receive BTC when a buyer fills it.
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setStep('form')
            setAskBtc('')
            setSelectedRuneUtxo(runeUtxos[0] ?? null)
            setSelectedBrc20Utxo(brc20Utxos[0] ?? null)
          }}
        >
          Place Another Order
        </Button>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  const canSubmit =
    !!wallet &&
    !!askBtc &&
    !!selectedUtxoTxid &&
    selectedUtxoVout !== null &&
    !isSubmitting

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-text-primary text-sm font-semibold">Place Sell Order</h3>
        <p className="text-text-muted text-xs mt-0.5">
          Sign with SIGHASH_SINGLE|ANYONECANPAY — trustless, no custody
        </p>
      </div>

      <div className="p-4 space-y-4">

        {/* Token being sold */}
        <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-3 py-2.5">
          <TokenLogo token={fromToken} size={28} />
          <div className="flex-1">
            <div className="text-text-primary font-semibold text-sm">{fromToken.name}</div>
            <div className="text-text-muted text-xs">{fromToken.symbol}</div>
          </div>
          <span className="text-xs text-text-muted bg-surface border border-border rounded px-1.5 py-0.5">
            {fromToken.type}
          </span>
        </div>

        {/* ── UTXO Picker ─────────────────────────────────────────── */}
        {!wallet ? (
          <div className="text-center py-4 text-text-muted text-sm">Connect your wallet to see your UTXOs</div>
        ) : tokenType === 'RUNE' ? (
          <RuneUtxoPicker
            token={fromToken}
            utxos={runeUtxos}
            selected={selectedRuneUtxo}
            onSelect={setSelectedRuneUtxo}
            loading={fetchingUtxos}
            error={utxoError}
            keyMissing={keyMissing}
            onRefresh={refetchUtxos}
          />
        ) : tokenType === 'BRC20' ? (
          <Brc20UtxoPicker
            token={fromToken}
            utxos={brc20Utxos}
            selected={selectedBrc20Utxo}
            onSelect={setSelectedBrc20Utxo}
            loading={fetchingUtxos}
            error={utxoError}
            keyMissing={keyMissing}
            onRefresh={refetchUtxos}
          />
        ) : null}

        {/* Amount summary */}
        {displayAmount && (
          <div className="bg-surface border border-border rounded-xl px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Amount to sell</span>
              <span className="text-text-primary font-semibold">
                {displayAmount} {fromToken.symbol}
              </span>
            </div>
            <p className="text-text-muted text-xs mt-1">
              Full UTXO — partial sells require splitting the UTXO first.
            </p>
          </div>
        )}

        {/* Ask price */}
        <div>
          <label className="text-text-muted text-xs mb-1.5 block">Ask price (total BTC you want)</label>
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
          {pricePerUnit && (
            <p className="text-text-muted text-xs mt-1">
              ≈ {pricePerUnit} BTC per {fromToken.symbol}
            </p>
          )}
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
          disabled={!canSubmit}
          onClick={!wallet ? undefined : handleSubmit}
          variant="primary"
        >
          {!wallet
            ? 'Connect Wallet First'
            : step === 'signing'
            ? 'Sign in Wallet…'
            : 'Place Sell Order'}
        </Button>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface RuneUtxoPickerProps {
  token: Token
  utxos: RuneUtxo[]
  selected: RuneUtxo | null
  onSelect: (u: RuneUtxo) => void
  loading: boolean
  error: string | null
  keyMissing: boolean
  onRefresh: () => void
}

function RuneUtxoPicker({ token, utxos, selected, onSelect, loading, error, keyMissing, onRefresh }: RuneUtxoPickerProps) {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 animate-pulse flex items-center gap-2 text-text-muted text-xs">
        <RefreshCw size={12} className="animate-spin" />
        Fetching your {token.symbol} UTXOs…
      </div>
    )
  }

  if (keyMissing) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 space-y-2 text-xs text-text-muted">
        <p className="font-medium text-text-secondary">UNISAT_API_KEY not configured</p>
        <p>Add your Unisat API key to <code className="text-primary">.env.local</code> to auto-fetch your Rune UTXOs.</p>
        <a href="https://unisat.io/developer" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline">
          Get API key <ExternalLink size={10} />
        </a>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-danger/5 border border-danger/20 rounded-xl p-3 text-xs text-danger flex items-center justify-between">
        <span>{error}</span>
        <button onClick={onRefresh} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  if (!utxos.length) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 text-xs text-text-muted flex items-center justify-between">
        <span>No {token.symbol} UTXOs found in this wallet.</span>
        <button onClick={onRefresh} className="text-primary hover:underline flex items-center gap-1">
          <RefreshCw size={10} /> Refresh
        </button>
      </div>
    )
  }

  return (
    <div>
      <label className="text-text-muted text-xs mb-1.5 flex items-center justify-between">
        <span>Select UTXO to sell</span>
        <button onClick={onRefresh} className="text-primary hover:underline flex items-center gap-1">
          <RefreshCw size={10} /> Refresh
        </button>
      </label>
      <div className="relative">
        <select
          value={utxos.indexOf(selected ?? utxos[0])}
          onChange={(e) => onSelect(utxos[parseInt(e.target.value)])}
          className="w-full appearance-none bg-surface border border-border rounded-xl px-3 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary/50"
        >
          {utxos.map((u, i) => {
            const display = (Number(u.amount) / Math.pow(10, u.divisibility)).toFixed(u.divisibility)
            return (
              <option key={i} value={i}>
                {display} {token.symbol} — {truncateAddress(u.txid)}:{u.vout}
              </option>
            )
          })}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      </div>
    </div>
  )
}

interface Brc20UtxoPickerProps {
  token: Token
  utxos: Brc20TransferUtxo[]
  selected: Brc20TransferUtxo | null
  onSelect: (u: Brc20TransferUtxo) => void
  loading: boolean
  error: string | null
  keyMissing: boolean
  onRefresh: () => void
}

function Brc20UtxoPicker({ token, utxos, selected, onSelect, loading, error, keyMissing, onRefresh }: Brc20UtxoPickerProps) {
  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 animate-pulse flex items-center gap-2 text-text-muted text-xs">
        <RefreshCw size={12} className="animate-spin" />
        Fetching your {token.symbol} transfer inscriptions…
      </div>
    )
  }

  if (keyMissing) {
    return (
      <div className="bg-surface border border-border rounded-xl p-3 space-y-2 text-xs text-text-muted">
        <p className="font-medium text-text-secondary">UNISAT_API_KEY not configured</p>
        <p>Add your Unisat API key to <code className="text-primary">.env.local</code> to auto-fetch your inscriptions.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-danger/5 border border-danger/20 rounded-xl p-3 text-xs text-danger flex items-center justify-between">
        <span>{error}</span>
        <button onClick={onRefresh} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  if (!utxos.length) {
    return (
      <div className="bg-surface border border-dashed border-border rounded-xl p-4 space-y-2 text-xs">
        <p className="text-text-secondary font-medium">No transfer inscriptions found</p>
        <p className="text-text-muted leading-relaxed">
          BRC-20 sales require a pre-inscribed &ldquo;transfer&rdquo; inscription. Open Unisat Wallet,
          go to your {token.symbol} balance, and tap <strong>Transfer</strong> to inscribe one.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <a href="https://unisat.io" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline">
            Open Unisat <ExternalLink size={10} />
          </a>
          <button onClick={onRefresh} className="text-primary hover:underline flex items-center gap-1">
            <RefreshCw size={10} /> Refresh
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="text-text-muted text-xs mb-1.5 flex items-center justify-between">
        <span>Select transfer inscription</span>
        <button onClick={onRefresh} className="text-primary hover:underline flex items-center gap-1">
          <RefreshCw size={10} /> Refresh
        </button>
      </label>
      <div className="relative">
        <select
          value={utxos.indexOf(selected ?? utxos[0])}
          onChange={(e) => onSelect(utxos[parseInt(e.target.value)])}
          className="w-full appearance-none bg-surface border border-border rounded-xl px-3 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:border-primary/50"
        >
          {utxos.map((u, i) => (
            <option key={i} value={i}>
              {u.amount} {token.symbol} — {truncateAddress(u.txid)}:{u.vout}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      </div>
    </div>
  )
}
