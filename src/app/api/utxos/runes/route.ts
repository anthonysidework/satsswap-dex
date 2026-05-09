import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UNISAT = 'https://open-api.unisat.io'

export interface RuneUtxo {
  txid: string
  vout: number
  satoshi: number
  scriptPk: string      // scriptPubKey hex — ready to use in PSBT witnessUtxo
  runeId: string        // e.g. "840000:3"
  runeName: string      // e.g. "DOG•GO•TO•THE•MOON"
  amount: string        // base-unit amount as string (bigint-safe)
  divisibility: number  // decimal places; displayAmount = amount / 10^divisibility
}

/**
 * GET /api/utxos/runes?address=bc1p...&runeId=840000:3
 *
 * Fetches Rune UTXOs for `address` from the Unisat indexer, optionally filtered
 * to a specific Rune by `runeId`. Requires UNISAT_API_KEY in env.
 *
 * Returns { utxos: RuneUtxo[], keyMissing: boolean }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  const runeIdFilter = searchParams.get('runeId') ?? ''

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  const key = process.env.UNISAT_API_KEY
  if (!key) {
    return NextResponse.json({ utxos: [], keyMissing: true })
  }

  try {
    const res = await fetch(
      `${UNISAT}/v1/indexer/address/${encodeURIComponent(address)}/runes/utxo-list`,
      { headers: { Authorization: `Bearer ${key}` } }
    )

    if (!res.ok) {
      return NextResponse.json({ utxos: [], error: `Unisat ${res.status}` })
    }

    const json = await res.json()
    if (json?.code !== 0 || !json?.data?.utxo) {
      return NextResponse.json({ utxos: [] })
    }

    const utxos: RuneUtxo[] = []

    for (const utxo of json.data.utxo as Array<{
      txid: string
      vout: number
      satoshi: number
      scriptPk: string
      runes: Array<{
        runeId: string
        rune: string
        amount: string
        divisibility: number
      }>
    }>) {
      for (const rune of utxo.runes ?? []) {
        if (runeIdFilter && rune.runeId !== runeIdFilter) continue
        utxos.push({
          txid: utxo.txid,
          vout: utxo.vout,
          satoshi: utxo.satoshi,
          scriptPk: utxo.scriptPk,
          runeId: rune.runeId,
          runeName: rune.rune,
          amount: rune.amount,
          divisibility: rune.divisibility,
        })
      }
    }

    return NextResponse.json({ utxos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ utxos: [], error: message })
  }
}
