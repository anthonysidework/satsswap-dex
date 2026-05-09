import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { TokenLogo } from '@/components/ui/TokenLogo'
import { getLiveTokenList } from '@/lib/prices'
import { formatUSD } from '@/lib/utils'
import { ArrowRight, Shield, Zap, BookOpen, Lock } from 'lucide-react'

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Lock,
    title: 'Place a Limit Order',
    desc: 'Sign a PSBT with your token UTXO. Your Rune or BRC-20 is listed at your price — never transferred until a buyer fills it.',
  },
  {
    step: '02',
    icon: BookOpen,
    title: 'Browse the Order Book',
    desc: 'See all open sell orders for any Rune or BRC-20 pair. Pick your price and click Take.',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Atomic On-Chain Settlement',
    desc: 'Buyer adds BTC, signs, and broadcasts. One Bitcoin transaction — seller gets BTC, buyer gets tokens. No escrow, ever.',
  },
]

const FEATURES = [
  {
    icon: Shield,
    title: 'Trustless PSBT Settlement',
    desc: 'Every trade uses SIGHASH_SINGLE|ANYONECANPAY. Maker and taker sign independently. One broadcast settles both sides atomically.',
  },
  {
    icon: Lock,
    title: 'Non-Custodial Limit Orders',
    desc: 'Your tokens never leave your wallet until a fill broadcasts. Cancel any time — if no buyer, nothing happened on-chain.',
  },
  {
    icon: BookOpen,
    title: 'Runes & BRC-20 Native',
    desc: 'Built for Bitcoin native assets. Rune transfers use on-chain Runestone edicts. BRC-20 uses transferable inscription UTXOs.',
  },
  {
    icon: Zap,
    title: 'Market Orders Too',
    desc: 'In a hurry? Use the Swap page to instantly fill the best available order at the current market price.',
  },
]

export default async function Home() {
  const liveTokens = await getLiveTokenList()
  const topTokens = liveTokens.slice(0, 5)

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative pt-20 pb-24 px-4 sm:px-6">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Trustless order book · Bitcoin L1 · No escrow
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-text-primary leading-[1.05] mb-6">
            Trade Bitcoin Assets
            <br />
            <span className="text-gradient-orange">On Your Terms</span>
          </h1>

          <p className="text-text-secondary text-xl sm:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed">
            SatsSwap is a trustless order book exchange for Runes and BRC-20 tokens.
            Place limit orders. Fill instantly. Settle on Bitcoin L1.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dex">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Open Order Book <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Explore Markets
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Key stats */}
      <section className="py-8 border-y border-border/50 bg-surface/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-black text-text-primary">0%</div>
              <div className="text-text-muted text-sm mt-1">Custody</div>
            </div>
            <div>
              <div className="text-3xl font-black text-text-primary">L1</div>
              <div className="text-text-muted text-sm mt-1">On-Chain Settlement</div>
            </div>
            <div>
              <div className="text-3xl font-black text-primary">PSBT</div>
              <div className="text-text-muted text-sm mt-1">Atomic Swaps</div>
            </div>
            <div>
              <div className="text-3xl font-black text-text-primary">0.15%</div>
              <div className="text-text-muted text-sm mt-1">Protocol Fee</div>
            </div>
          </div>
        </div>
      </section>

      {/* Token ticker */}
      <section className="py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-6 overflow-x-auto pb-2 scrollbar-hide">
            {topTokens.map((t) => (
              <Link
                key={t.id}
                href={`/dex?from=${encodeURIComponent(t.id)}&to=BTC`}
                className="flex items-center gap-2.5 bg-card border border-border hover:border-border-light rounded-xl px-4 py-3 flex-shrink-0 transition-all hover:shadow-card"
              >
                <TokenLogo token={t} size={32} />
                <div>
                  <div className="text-text-primary text-sm font-semibold">{t.symbol}</div>
                  <div className="text-text-muted text-xs">{formatUSD(t.priceUSD)}</div>
                </div>
                <div className={`text-xs font-semibold ${t.change24h >= 0 ? 'text-success' : 'text-danger'}`}>
                  {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-text-primary mb-4">How It Works</h2>
            <p className="text-text-secondary text-lg">Maker places an order. Taker fills it. Bitcoin settles both sides in one transaction.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="bg-card border border-border rounded-2xl p-6 h-full">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <step.icon size={22} className="text-primary" />
                  </div>
                  <span className="text-5xl font-black text-border">{step.step}</span>
                </div>
                <h3 className="text-text-primary font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-surface/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-text-primary mb-4">Built for Bitcoin</h2>
            <p className="text-text-secondary text-lg">No wrapped tokens. No bridges. No L2. Just Bitcoin.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card border border-border hover:border-border-light rounded-2xl p-6 transition-all hover:shadow-card group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon size={22} className="text-primary" />
                </div>
                <h3 className="text-text-primary font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PSBT explainer */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card border border-primary/20 rounded-2xl p-8 glow-orange">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Shield size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="text-text-primary font-bold text-xl mb-3">Why PSBTs?</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-4">
                  Partially Signed Bitcoin Transactions let the seller commit to a price without
                  transferring their tokens. Their signature is locked to their specific input and output
                  using <span className="text-primary font-mono text-xs">SIGHASH_SINGLE|ANYONECANPAY</span> —
                  so they can&apos;t be tricked into selling at a different price, and the buyer can&apos;t
                  steal the tokens without sending the BTC.
                </p>
                <p className="text-text-secondary text-sm leading-relaxed">
                  When a buyer fills the order, they add their BTC inputs and sign. The complete transaction
                  settles atomically on Bitcoin — if anything fails, nothing moves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-black text-text-primary mb-4">
            Your keys, your orders,<br />your Bitcoin.
          </h2>
          <p className="text-text-secondary mb-8 text-lg">
            Connect a wallet and start trading Runes and BRC-20 tokens trustlessly on Bitcoin L1.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dex">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Open Order Book <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/swap">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Market Order
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
