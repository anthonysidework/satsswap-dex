import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UNISAT = 'https://open-api.unisat.io'

export interface Brc20TransferUtxo {
  txid: string
  vout: number
  satoshi: number
  scriptPk: string       // scriptPubKey hex — ready to use in PSBT witnessUtxo
  inscriptionId: string
  amount: string         // BRC-20 token amount (display units, as string)
  ticker: string
}

/**
 * GET /api/utxos/brc20?address=bc1p...&ticker=ordi
 *
 * Fetches BRC-20 "transferable" inscription UTXOs for `address` from the Unisat
 * indexer. A transferable inscription is one the user has already inscribed as a
 * "transfer" inscription and has not yet spent — spending it completes the transfer.
 *
 * Returns { utxos: Brc20TransferUtxo[], keyMissing: boolean }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  const ticker = searchParams.get('ticker')

  if (!address || !ticker) {
    return NextResponse.json({ error: 'address and ticker are required' }, { status: 400 })
  }

  const key = process.env.UNISAT_API_KEY
  if (!key) {
    return NextResponse.json({ utxos: [], keyMissing: true })
  }

  try {
    const res = await fetch(
      `${UNISAT}/v1/indexer/address/${encodeURIComponent(address)}/brc20/${encodeURIComponent(ticker.toLowerCase())}/transferable-inscriptions`,
      { headers: { Authorization: `Bearer ${key}` } }
    )

    if (!res.ok) {
      return NextResponse.json({ utxos: [], error: `Unisat ${res.status}` })
    }

    const json = await res.json()
    if (json?.code !== 0 || !json?.data?.detail) {
      return NextResponse.json({ utxos: [] })
    }

    const utxos: Brc20TransferUtxo[] = (
      json.data.detail as Array<{
        ticker: string
        amount: string
        inscriptionId: string
        utxo: { txid: string; vout: number; satoshi: number; scriptPk: string }
      }>
    ).map((item) => ({
      txid: item.utxo.txid,
      vout: item.utxo.vout,
      satoshi: item.utxo.satoshi,
      scriptPk: item.utxo.scriptPk,
      inscriptionId: item.inscriptionId,
      amount: item.amount,
      ticker: item.ticker,
    }))

    return NextResponse.json({ utxos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ utxos: [], error: message })
  }
}
