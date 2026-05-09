/**
 * PSBT Order Book DEX — maker/taker PSBT construction
 *
 * Rune swap flow:
 *   Maker: seller signs their Rune UTXO input + declares BTC output (ask).
 *          Produces a partial PSBT stored in the order book.
 *   Taker: buyer adds their BTC input(s) + a Rune output to themselves,
 *          signs, and broadcasts the completed transaction.
 *
 * BRC-20 note: seller must have already created a "transfer" inscription UTXO
 *   before calling buildMakerPsbt. The inscription UTXO IS the from_utxo.
 *
 * We use raw PSBT bytes (base64 / hex) and pass them to wallet extensions for
 * signing via the existing useWallet.signPsbt() infrastructure.
 */

import { Transaction } from '@scure/btc-signer'
import { hex, bech32, bech32m } from '@scure/base'
import { getTxOutput } from './utxo'
import { buildRunestoneScript, parseRuneId } from './runestone'

/**
 * Decode a native-segwit Bitcoin address into its scriptPubKey bytes.
 * Supports P2WPKH (bc1q / tb1q) and P2TR (bc1p / tb1p).
 * Returns null for any other format — use mempool.space as fallback.
 */
function addressToScript(address: string): Uint8Array | null {
  try {
    if (address.startsWith('bc1q') || address.startsWith('tb1q')) {
      // P2WPKH: OP_0 <20-byte-pubkey-hash>
      const { words } = bech32.decode(address as `${string}1${string}`)
      const hash = bech32.fromWords(words.slice(1)) // strip witness version byte
      return new Uint8Array([0x00, 0x14, ...hash])
    }
    if (address.startsWith('bc1p') || address.startsWith('tb1p')) {
      // P2TR: OP_1 <32-byte-x-only-key>
      const { words } = bech32m.decode(address as `${string}1${string}`)
      const key = bech32m.fromWords(words.slice(1))
      return new Uint8Array([0x51, 0x20, ...key])
    }
  } catch {
    // malformed address
  }
  return null
}

// Dust limit: 546 sats for P2WPKH, 294 for P2TR
const DUST_SATS = 546
// Protocol fee bps (0.15%)
const PROTOCOL_FEE_BPS = parseInt(process.env.NEXT_PUBLIC_PROTOCOL_FEE_BPS ?? '15')

export interface MakerPsbtParams {
  /** Address that owns the token UTXO (taproot bc1p… for Runes) */
  sellerAddress: string
  /** Compressed public key of the seller (33 bytes hex) */
  sellerPubkey: string
  /** The UTXO containing the Rune or BRC-20 transfer inscription */
  utxoTxid: string
  utxoVout: number
  /** How much BTC (satoshis) the seller wants in return */
  askSats: number
  /** Current fee rate to estimate total tx cost */
  feeRateSatPerVb: number
}

export interface TakerPsbtParams {
  /** Partially signed PSBT from the maker (hex) */
  makerPsbtHex: string
  /** Buyer's address to receive the token */
  buyerAddress: string
  /** Buyer's public key (33 bytes hex) */
  buyerPubkey: string
  /** UTXOs the buyer will spend to cover askSats + fees */
  buyerUtxos: Array<{ txid: string; vout: number; value: number; scriptPubKey: string }>
  /** scriptPubKey hex for buyer's receive address — fetched from mempool.space, not derived locally */
  buyerScriptPubKeyHex: string
  /** Network fee rate */
  feeRateSatPerVb: number
  /**
   * Rune ID string (e.g. "840000:3") — only set for RUNE type orders.
   * When present, a Runestone OP_RETURN is appended to transfer the Runes
   * to the buyer's output (index 1). BRC-20 orders leave this undefined.
   */
  runeId?: string
  /** Exact base-unit amount of the Rune being transferred (as BigInt string) */
  runeAmount?: string
}

export interface BuiltPsbt {
  /** Hex-encoded PSBT — pass to wallet extension for signing */
  psbtHex: string
  /** Human-readable fee breakdown */
  fees: { networkSats: number; protocolSats: number; totalSats: number }
}

/**
 * Build the maker (seller) side of the PSBT.
 * Returns a partially signed PSBT ready to be stored in the order book.
 * The seller's wallet extension signs input[0].
 */
export async function buildMakerPsbtTemplate(params: MakerPsbtParams): Promise<BuiltPsbt> {
  const { utxoTxid, utxoVout, askSats, feeRateSatPerVb } = params

  // Fetch the scriptPubKey for the seller's UTXO from mempool.space
  const utxoOutput = await getTxOutput(utxoTxid, utxoVout)
  const inputScript = hex.decode(utxoOutput.scriptpubkey)

  // Estimate network fee: ~300 vB for a Rune 2-input 3-output tx
  const estimatedVbytes = 300
  const networkFeeSats = Math.ceil(estimatedVbytes * feeRateSatPerVb)

  // Protocol fee — only charged when a valid fee address is configured.
  // If the address is missing or can't be decoded, no fee is deducted so no sats leak.
  const feeAddress = process.env.NEXT_PUBLIC_PROTOCOL_FEE_ADDRESS ?? ''
  const feeScript = feeAddress ? addressToScript(feeAddress) : null
  const protocolFeeSats = feeScript ? Math.ceil((askSats * PROTOCOL_FEE_BPS) / 10_000) : 0

  // PSBT template:
  //   Input 0:  seller's token UTXO (signed SIGHASH_SINGLE|ANYONECANPAY)
  //   Output 0: BTC to seller
  //   Output 1: protocol fee (only when fee address is configured)
  //   Taker adds: Input 1 (BTC UTXOs), Output 2 (token to buyer), Output 3 (BTC change)

  const tx = new Transaction()

  tx.addInput({
    txid: utxoTxid,
    index: utxoVout,
    witnessUtxo: { script: inputScript, amount: BigInt(utxoOutput.value) },
    sighashType: 0x83, // SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
  })

  // Output 0: BTC to seller
  const sellerReceiveSats = askSats - protocolFeeSats - networkFeeSats
  if (sellerReceiveSats < DUST_SATS) {
    throw new Error('Ask price too low to cover fees')
  }
  tx.addOutput({ script: inputScript, amount: BigInt(sellerReceiveSats) })

  // Output 1: protocol fee (only present when address is configured and decodable)
  if (feeScript && protocolFeeSats >= DUST_SATS) {
    tx.addOutput({ script: feeScript, amount: BigInt(protocolFeeSats) })
  }

  const psbtBytes = tx.toPSBT()
  const psbtHex = hex.encode(psbtBytes)

  return {
    psbtHex,
    fees: {
      networkSats: networkFeeSats,
      protocolSats: protocolFeeSats,
      totalSats: networkFeeSats + protocolFeeSats,
    },
  }
}

/**
 * Complete the taker side of an order book PSBT.
 * Takes the maker's stored PSBT, adds the buyer's BTC input(s) and token output.
 * Returns the completed (unsigned taker side) PSBT for the buyer's wallet to sign.
 */
export function completeTakerPsbt(params: TakerPsbtParams): BuiltPsbt {
  const { makerPsbtHex, buyerUtxos, feeRateSatPerVb } = params

  const makerTx = Transaction.fromPSBT(hex.decode(makerPsbtHex))

  // Estimate taker's additional fee contribution
  const additionalVbytes = 160 // ~1 P2WPKH input + 1 output
  const takerFeeSats = Math.ceil(additionalVbytes * feeRateSatPerVb)

  // Sum buyer's UTXOs
  const buyerTotal = buyerUtxos.reduce((sum, u) => sum + u.value, 0)

  // The maker's output[0] is the BTC ask amount; read it
  // We need to add taker's BTC input, and taker's token output (index 2)
  // Also add BTC change output for taker if needed

  for (const utxo of buyerUtxos) {
    makerTx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: hex.decode(utxo.scriptPubKey),
        amount: BigInt(utxo.value),
      },
      sighashType: 0x01, // SIGHASH_ALL for taker inputs
    })
  }

  // Output for taker: receives the token (Rune UTXO).
  // scriptPubKey is fetched from mempool.space (via getTxOutput) by the caller — never derived
  // locally, since bech32/bech32m decoding would require an additional dependency.
  if (!params.buyerScriptPubKeyHex) throw new Error('buyerScriptPubKeyHex is required')
  const buyerScript = hex.decode(params.buyerScriptPubKeyHex)

  // Record the buyer's output index BEFORE adding it — the maker PSBT may have 1 output
  // (seller BTC) or 2 outputs (seller BTC + protocol fee). The Runestone edict must point
  // to whichever index the buyer's dust output lands at.
  const buyerOutputIndex = makerTx.outputsLength

  makerTx.addOutput({
    script: buyerScript,
    amount: BigInt(DUST_SATS), // 546 sat minimum to hold Rune
  })

  // BTC change back to buyer
  const makerAsk = Number(makerTx.getOutput(0).amount ?? BigInt(0))
  const changeAmount = buyerTotal - makerAsk - takerFeeSats - DUST_SATS
  if (changeAmount > DUST_SATS) {
    makerTx.addOutput({ script: buyerScript, amount: BigInt(changeAmount) })
  }

  // For Rune orders: append a Runestone OP_RETURN directing the indexer to move
  // `runeAmount` base units from input 0 → buyerOutputIndex.
  // Without this the Runes are burned (cenotaph).
  if (params.runeId && params.runeAmount) {
    const parsed = parseRuneId(params.runeId)
    if (parsed) {
      const runestoneScript = buildRunestoneScript(parsed, BigInt(params.runeAmount), buyerOutputIndex)
      makerTx.addOutput({ script: runestoneScript, amount: BigInt(0) })
    }
  }

  const psbtBytes = makerTx.toPSBT()
  const psbtHex = hex.encode(psbtBytes)

  return {
    psbtHex,
    fees: { networkSats: takerFeeSats, protocolSats: 0, totalSats: takerFeeSats },
  }
}

/**
 * Validate that a submitted maker PSBT has the expected structure:
 * - exactly 1 input
 * - at least 1 output (BTC to seller)
 * - input uses SIGHASH_SINGLE | ANYONECANPAY (0x83)
 */
export function validateMakerPsbt(psbtHex: string): { valid: boolean; error?: string } {
  try {
    const tx = Transaction.fromPSBT(hex.decode(psbtHex))
    if (tx.inputsLength !== 1) {
      return { valid: false, error: 'Maker PSBT must have exactly 1 input' }
    }
    if (tx.outputsLength < 1) {
      return { valid: false, error: 'Maker PSBT must have at least 1 output' }
    }
    const input = tx.getInput(0)
    if (input.sighashType !== 0x83) {
      return { valid: false, error: 'Maker input must use SIGHASH_SINGLE|ANYONECANPAY (0x83)' }
    }
    return { valid: true }
  } catch (e) {
    return { valid: false, error: `Invalid PSBT: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * Decode a hex PSBT and return a summary suitable for displaying to the user.
 */
export function decodePsbtSummary(psbtHex: string): {
  inputs: number
  outputs: number
  outputValues: number[]
} {
  const tx = Transaction.fromPSBT(hex.decode(psbtHex))
  const outputValues: number[] = []
  for (let i = 0; i < tx.outputsLength; i++) {
    outputValues.push(Number(tx.getOutput(i).amount ?? BigInt(0)))
  }
  return { inputs: tx.inputsLength, outputs: tx.outputsLength, outputValues }
}
