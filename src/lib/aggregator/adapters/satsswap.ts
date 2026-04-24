/**
 * SatsSwap Native DEX Adapter
 *
 * Queries SatsSwap's own PSBT order book for live maker orders.
 * When liquidity exists, this adapter provides real on-chain quotes
 * backed by actual maker PSBTs stored in the order book.
 *
 * Prioritized above external DEXes in the aggregator — when SatsSwap
 * has competitive pricing, it routes there first (0% routing fee).
 */

import type { DexAdapter, QuoteParams } from '../types'
import type { DexQuote } from '@/types'
import type { Order } from '@/lib/db/types'

const SATSSWAP_FEE_BPS = parseInt(process.env.NEXT_PUBLIC_PROTOCOL_FEE_BPS ?? '15')

function findBestFill(
  orders: Order[],
  fromAmount: number,
  fromPriceUsd: number,
  toPriceUsd: number,
): { estimatedOutput: number; effectiveRate: number; priceImpact: number; orderId: string } | null {
  if (!orders.length) return null

  // Try to fill fromAmount across open orders (sorted by best price = lowest ask per unit)
  // to_amount is BTC sats; from_amount is token units
  let remaining = fromAmount
  let totalToReceived = 0
  let filledOrderId = orders[0].id

  for (const order of orders) {
    if (remaining <= 0) break
    const fillable = Math.min(remaining, order.from_amount)
    const proportion = fillable / order.from_amount
    totalToReceived += order.to_amount * proportion * 1e-8 // convert sats to BTC
    remaining -= fillable
    filledOrderId = order.id
  }

  if (totalToReceived === 0) return null

  const filledAmount = fromAmount - remaining
  const effectiveRate = totalToReceived / filledAmount

  // Price impact: compare effective rate to the best maker's rate
  const bestOrderRate = (orders[0].to_amount * 1e-8) / orders[0].from_amount
  const priceImpact = Math.abs((effectiveRate - bestOrderRate) / bestOrderRate) * 100

  return {
    estimatedOutput: totalToReceived,
    effectiveRate,
    priceImpact: Math.max(0, priceImpact),
    orderId: filledOrderId,
  }
}

export const SatsSwapAdapter: DexAdapter = {
  name: 'SatsSwap',
  logoText: 'S',
  logoColor: '#F7931A',

  async getQuote(params: QuoteParams): Promise<DexQuote> {
    const { fromToken, toToken, fromAmount, networkFeeSats } = params

    // Fetch open orders for this pair from our own order book
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const url = `${baseUrl}/api/orders?fromToken=${encodeURIComponent(fromToken.id)}&toToken=${encodeURIComponent(toToken.id)}`

    let orders: Order[] = []
    try {
      const res = await fetch(url, { next: { revalidate: 5 } })
      if (res.ok) {
        const data = await res.json()
        orders = data.orders ?? []
      }
    } catch {
      // Order book unavailable — no native liquidity
    }

    if (!orders.length) {
      // No native liquidity — throw so aggregator falls through to other adapters
      throw new Error('No SatsSwap native liquidity for this pair')
    }

    const fill = findBestFill(orders, fromAmount, fromToken.priceUSD, toToken.priceUSD)
    if (!fill) throw new Error('Could not compute fill from order book')

    const dexFee = (fromAmount * fromToken.priceBTC * SATSSWAP_FEE_BPS) / 10_000
    const protocolFeeUsd = (fromAmount * fromToken.priceUSD * SATSSWAP_FEE_BPS) / 10_000

    return {
      dex: 'SatsSwap',
      dexLogo: 'S',
      rate: fill.effectiveRate,
      estimatedOutput: fill.estimatedOutput,
      priceImpact: fill.priceImpact,
      dexFee,
      networkFeeSats: networkFeeSats ?? 2000,
      isBest: false,
      isLive: true,
      liquidityUSD: orders.reduce((s, o) => s + o.from_amount * fromToken.priceUSD, 0),
    }
  },
}
