import { NextRequest, NextResponse } from 'next/server'
import { createOrder, getOpenOrders, getOrdersByMaker } from '@/lib/db/orders'
import { validateMakerPsbt } from '@/lib/psbt/builder'

export const dynamic = 'force-dynamic'

/** GET /api/orders?fromToken=&toToken= — open order book for a pair */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fromToken = searchParams.get('fromToken')
    const toToken = searchParams.get('toToken')
    const makerAddress = searchParams.get('maker')

    if (makerAddress) {
      const orders = await getOrdersByMaker(makerAddress)
      return NextResponse.json({ orders })
    }

    if (!fromToken || !toToken) {
      return NextResponse.json({ error: 'fromToken and toToken required' }, { status: 400 })
    }

    const orders = await getOpenOrders(fromToken, toToken)
    return NextResponse.json({ orders })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/orders — place a new maker order */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      makerAddress,
      fromTokenId,
      toTokenId,
      fromAmount,
      toAmount,      // asking price in satoshis
      psbtHex,
      utxoTxid,
      utxoVout,
      expiresInHours = 24,
    } = body

    if (!makerAddress || !fromTokenId || !toTokenId || !fromAmount || !toAmount || !psbtHex || !utxoTxid) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate PSBT structure before storing
    const validation = validateMakerPsbt(psbtHex)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 422 })
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

    const order = await createOrder({
      maker_address: makerAddress,
      from_token_id: fromTokenId,
      to_token_id: toTokenId,
      from_amount: fromAmount,
      to_amount: toAmount,
      psbt_hex: psbtHex,
      utxo_txid: utxoTxid,
      utxo_vout: utxoVout ?? 0,
      expires_at: expiresAt,
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
