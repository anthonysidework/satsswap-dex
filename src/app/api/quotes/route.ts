import { NextRequest, NextResponse } from 'next/server'
import { getLiveTokenList } from '@/lib/prices'
import { getNetworkFees, estimateSwapFee } from '@/lib/fees'
import { getOpenOrders } from '@/lib/db/orders'
import type { MarketFill } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fromTokenId, toTokenId, fromAmount } = body

    if (!fromTokenId || !toTokenId || !fromAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedAmount = parseFloat(fromAmount)
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid fromAmount' }, { status: 400 })
    }

    const [tokens, fees] = await Promise.all([getLiveTokenList(), getNetworkFees()])

    const fromToken = tokens.find((t) => t.id === fromTokenId)
    const toToken = tokens.find((t) => t.id === toTokenId)

    if (!fromToken || !toToken) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    const networkFeeSats = estimateSwapFee(
      toToken.type !== 'BTC' ? toToken.type : fromToken.type,
      fees.mediumSatPerVb
    )

    const noLiquidity = (message?: string): MarketFill => ({
      fromToken,
      toToken,
      fromAmount: parsedAmount,
      hasLiquidity: false,
      bestOrder: null,
      rate: 0,
      estimatedOutput: 0,
      priceImpact: 0,
      networkFeeSats,
      expiresAt: Date.now() + 30_000,
      message,
    })

    // Only BTC → Token is supported as a market order (taker pays BTC).
    // Token → BTC requires placing a limit sell order on the Trade page.
    if (fromTokenId !== 'BTC') {
      return NextResponse.json(
        noLiquidity('To sell tokens for BTC, place a limit order on the Trade page.')
      )
    }

    // Find sell orders: makers selling toToken and asking for BTC
    let orders: Awaited<ReturnType<typeof getOpenOrders>> = []
    try {
      orders = await getOpenOrders(toTokenId, 'BTC')
    } catch {
      // Supabase not configured — no native liquidity
    }

    if (!orders.length) {
      return NextResponse.json(noLiquidity('No open sell orders for this pair.'))
    }

    // User is paying `parsedAmount` BTC. Convert to sats and subtract estimated fees.
    const fromSats = Math.round(parsedAmount * 1e8)
    const availableForFill = fromSats - networkFeeSats - 546

    if (availableForFill <= 0) {
      return NextResponse.json(noLiquidity('Amount too small to cover network fees.'))
    }

    // Orders are sorted best-price-first (lowest to_amount = cheapest BTC per token).
    // Pick the best order that can be fully or partially filled.
    const bestOrder = orders.find((o) => o.to_amount <= availableForFill) ?? orders[0]

    // Compute fill: how much of the order the user can fill with their BTC
    const fillSats = Math.min(availableForFill, bestOrder.to_amount)
    const fillProportion = fillSats / bestOrder.to_amount
    const estimatedOutput = bestOrder.from_amount * fillProportion

    // Rate: toToken units per 1 BTC
    const rate = bestOrder.to_amount > 0
      ? (bestOrder.from_amount / (bestOrder.to_amount / 1e8))
      : 0

    // Price impact: non-zero only when we can't fully fill the order
    const priceImpact = fillProportion < 1 ? (1 - fillProportion) * 100 * 0.1 : 0.05

    const fill: MarketFill = {
      fromToken,
      toToken,
      fromAmount: parsedAmount,
      hasLiquidity: true,
      bestOrder,
      rate,
      estimatedOutput,
      priceImpact,
      networkFeeSats,
      expiresAt: Date.now() + 30_000,
    }

    return NextResponse.json(fill)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
