import { NextRequest, NextResponse } from 'next/server'
import { getOrderById, updateOrderStatus } from '@/lib/db/orders'
import { completeTakerPsbt } from '@/lib/psbt/builder'
import { getUtxos } from '@/lib/psbt/utxo'
import { getNetworkFees } from '@/lib/fees'

export const dynamic = 'force-dynamic'

/** GET /api/orders/[id] — fetch a single order */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await getOrderById(params.id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ order })
}

/** DELETE /api/orders/[id] — cancel an order (maker only) */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { makerAddress } = body

    const order = await getOrderById(params.id)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.maker_address !== makerAddress) {
      return NextResponse.json({ error: 'Not your order' }, { status: 403 })
    }
    if (order.status !== 'open') {
      return NextResponse.json({ error: `Order is already ${order.status}` }, { status: 409 })
    }

    await updateOrderStatus(params.id, 'cancelled')
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/orders/[id]/take is handled in the nested route file.
 * This file handles the order resource itself (GET, DELETE).
 */

/** POST /api/orders/[id] — taker fills the order */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { buyerAddress, buyerPubkey } = body

    if (!buyerAddress) {
      return NextResponse.json({ error: 'buyerAddress required' }, { status: 400 })
    }

    const order = await getOrderById(params.id)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== 'open') {
      return NextResponse.json({ error: `Order is ${order.status}` }, { status: 409 })
    }
    if (new Date(order.expires_at) < new Date()) {
      await updateOrderStatus(params.id, 'expired')
      return NextResponse.json({ error: 'Order has expired' }, { status: 410 })
    }

    // Fetch buyer UTXOs and network fees in parallel
    const [buyerUtxos, fees] = await Promise.all([
      getUtxos(buyerAddress),
      getNetworkFees(),
    ])

    const confirmedUtxos = buyerUtxos
      .filter((u) => u.status.confirmed)
      .map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        // scriptPubKey is not in the UTXO endpoint — taker's client must provide it
        // or we'd fetch each TX. For now we expect the client to pass it.
        scriptPubKey: body.buyerScriptPubKey ?? '',
      }))

    const totalBuyerSats = confirmedUtxos.reduce((s, u) => s + u.value, 0)
    if (totalBuyerSats < order.to_amount) {
      return NextResponse.json({ error: 'Insufficient BTC balance' }, { status: 422 })
    }

    // Select just enough UTXOs to cover the ask
    const needed = order.to_amount + Math.ceil(160 * fees.mediumSatPerVb) + 546
    let running = 0
    const selected = confirmedUtxos.filter((u) => {
      if (running >= needed) return false
      running += u.value
      return true
    })

    const { psbtHex, fees: takerFees } = completeTakerPsbt({
      makerPsbtHex: order.psbt_hex,
      buyerAddress,
      buyerPubkey: buyerPubkey ?? '',
      buyerUtxos: selected,
      feeRateSatPerVb: fees.mediumSatPerVb,
    })

    // Mark as filled optimistically — if broadcast fails, maker can re-list
    await updateOrderStatus(params.id, 'filled')

    return NextResponse.json({ psbtHex, fees: takerFees })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
