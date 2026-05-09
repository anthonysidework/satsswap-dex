import { NextRequest, NextResponse } from 'next/server'
import { getOrderById, updateOrderStatus } from '@/lib/db/orders'
import { completeTakerPsbt } from '@/lib/psbt/builder'
import { getUtxos, getTxOutput } from '@/lib/psbt/utxo'
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
 * POST /api/orders/[id] — taker fetches the completed PSBT to sign and broadcast.
 * Does NOT mark the order as filled — the client must call PATCH after a successful broadcast.
 */
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

    const [buyerUtxos, fees] = await Promise.all([
      getUtxos(buyerAddress),
      getNetworkFees(),
    ])

    const confirmedUtxos = buyerUtxos.filter((u) => u.status.confirmed)
    const totalBuyerSats = confirmedUtxos.reduce((s, u) => s + u.value, 0)

    if (totalBuyerSats < order.to_amount) {
      return NextResponse.json({ error: 'Insufficient BTC balance' }, { status: 422 })
    }

    // Select enough UTXOs to cover ask + estimated fees
    const needed = order.to_amount + Math.ceil(160 * fees.mediumSatPerVb) + 546
    let running = 0
    const selectedRaw = confirmedUtxos.filter((u) => {
      if (running >= needed) return false
      running += u.value
      return true
    })

    if (selectedRaw.length === 0) {
      return NextResponse.json({ error: 'No confirmed UTXOs' }, { status: 422 })
    }

    // Fetch scriptPubKey for each selected UTXO from mempool.space
    const selected = await Promise.all(
      selectedRaw.map(async (u) => {
        const output = await getTxOutput(u.txid, u.vout)
        return { txid: u.txid, vout: u.vout, value: u.value, scriptPubKey: output.scriptpubkey }
      })
    )

    // Use the first UTXO's scriptPubKey as the buyer's receive address script.
    // All UTXOs come from the same address, so any one works.
    const buyerScriptPubKeyHex = selected[0].scriptPubKey

    const { psbtHex, fees: takerFees } = completeTakerPsbt({
      makerPsbtHex: order.psbt_hex,
      buyerAddress,
      buyerPubkey: buyerPubkey ?? '',
      buyerUtxos: selected,
      buyerScriptPubKeyHex,
      feeRateSatPerVb: fees.mediumSatPerVb,
      runeId: order.rune_id ?? undefined,
      runeAmount: order.rune_amount ?? undefined,
    })

    return NextResponse.json({ psbtHex, fees: takerFees })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/orders/[id] — mark order as filled after a successful broadcast.
 * Called by the taker client after broadcastTx() succeeds.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    if (body.status !== 'filled') {
      return NextResponse.json({ error: 'Only "filled" is accepted via PATCH' }, { status: 400 })
    }

    const order = await getOrderById(params.id)
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Idempotent — already filled is fine
    if (order.status === 'open') {
      await updateOrderStatus(params.id, 'filled')
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
