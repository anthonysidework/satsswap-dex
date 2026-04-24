import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// One CoinGecko call returns 7d sparkline for all tracked tokens
const ALL_CG_IDS = [
  'bitcoin',
  'ordinals',
  'sats-ordinals',
  'dog-go-to-the-moon-runes',
  'satoshi-nakamoto-rune',
  'runecoin',
  'uncommon-goods',
  'magic-internet-money-runes',
].join(',')

// Map CoinGecko coin ID → our token ID
const CG_TO_TOKEN: Record<string, string> = {
  bitcoin: 'BTC',
  ordinals: 'ORDI',
  'sats-ordinals': 'SATS',
  'dog-go-to-the-moon-runes': 'DOG•GO•TO•THE•MOON',
  'satoshi-nakamoto-rune': 'SATOSHI•NAKAMOTO',
  runecoin: 'RSIC•GENESIS•RUNE',
  'uncommon-goods': 'UNCOMMON•GOODS',
  'magic-internet-money-runes': 'MAGIC•INTERNET•MONEY',
}

export async function GET() {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ALL_CG_IDS}&sparkline=true&price_change_percentage=24h`

  const res = await fetch(url, {
    next: { revalidate: 600 },
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    return NextResponse.json({})
  }

  const coins: Array<{
    id: string
    sparkline_in_7d?: { price: number[] }
  }> = await res.json()

  const result: Record<string, number[]> = {}
  for (const coin of coins) {
    const tokenId = CG_TO_TOKEN[coin.id]
    const prices = coin.sparkline_in_7d?.price ?? []
    if (tokenId && prices.length > 0) {
      result[tokenId] = prices
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
  })
}
