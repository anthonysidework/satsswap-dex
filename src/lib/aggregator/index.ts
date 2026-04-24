import type { QuoteParams, AggregatedQuote, DexQuote, DexAdapter } from './types'
import { MOCK_ADAPTERS } from './mock'
import { OKXAdapter } from './adapters/okx'
import { SatsSwapAdapter } from './adapters/satsswap'

/**
 * Returns all active adapters.
 * SatsSwap native order book is first — preferred when it has liquidity.
 * OKX uses the public exchange market API (no key needed) — always included.
 * Mock adapters are always included as fallback/comparison options.
 */
function getAdapters(): DexAdapter[] {
  return [SatsSwapAdapter, OKXAdapter, ...MOCK_ADAPTERS]
}

export async function getAggregatedQuote(params: QuoteParams): Promise<AggregatedQuote> {
  const adapters = getAdapters()

  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.getQuote(params))
  )

  const quotes: DexQuote[] = results
    .filter((r): r is PromiseFulfilledResult<DexQuote> => r.status === 'fulfilled')
    .map((r) => r.value)
    // Sort: live quotes first, then by estimated output
    .sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
      return b.estimatedOutput - a.estimatedOutput
    })

  if (quotes.length === 0) throw new Error('No liquidity available for this pair')

  quotes[0].isBest = true

  return {
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    quotes,
    bestQuote: quotes[0],
    expiresAt: Date.now() + 30_000,
  }
}
