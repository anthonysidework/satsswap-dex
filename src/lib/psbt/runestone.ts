/**
 * Runestone encoder for Rune transfer transactions.
 *
 * A Runestone is an OP_RETURN output that instructs ord-compatible indexers
 * how to move Rune balances between outputs. Without it, any Runes on a spent
 * UTXO are treated as "burned" (cenotaph).
 *
 * Protocol reference: https://docs.ordinals.com/runes/specification.html
 *
 * Script format:
 *   OP_RETURN (0x6a)
 *   OP_13    (0x5d)  — Rune magic number
 *   <payload data push(es)>
 *
 * Payload: a sequence of u128 integers encoded as LEB128 varints.
 * Integers alternate tag/value except after the Body tag (0), which marks
 * the start of edicts encoded as groups of 4 integers:
 *   [block_delta, tx_delta, amount, output_index]
 */

/** LEB128-encode a u128 integer into a byte array. */
function encodeVarInt(n: bigint): number[] {
  const bytes: number[] = []
  while (n > 127n) {
    bytes.push(Number(n & 0x7fn) | 0x80)
    n >>= 7n
  }
  bytes.push(Number(n))
  return bytes
}

/**
 * Parse a Rune ID string like "840000:3" into {block, tx} bigints.
 * Returns null if the format is invalid.
 */
export function parseRuneId(runeIdStr: string): { block: bigint; tx: bigint } | null {
  const parts = runeIdStr.split(':')
  if (parts.length !== 2) return null
  try {
    return { block: BigInt(parts[0]), tx: BigInt(parts[1]) }
  } catch {
    return null
  }
}

/**
 * Build the full OP_RETURN script for a Runestone that transfers `amount`
 * base units of `runeId` from transaction input 0 to `outputIndex`.
 *
 * Use outputIndex = 1 in the standard taker PSBT layout:
 *   Output 0: BTC to seller
 *   Output 1: 546 sat dust to buyer  ← Runes land here
 *   Output 2: BTC change to buyer
 *   Output 3: this Runestone OP_RETURN
 */
export function buildRunestoneScript(
  runeId: { block: bigint; tx: bigint },
  amount: bigint,
  outputIndex: number
): Uint8Array {
  const payload: number[] = []

  // Body tag (0): marks the start of the edict section (no following value)
  payload.push(...encodeVarInt(0n))

  // Edict: [block_delta, tx_delta, amount, output]
  // For the first edict the deltas are absolute IDs (delta from RuneId{0,0})
  payload.push(...encodeVarInt(runeId.block))
  payload.push(...encodeVarInt(runeId.tx))
  payload.push(...encodeVarInt(amount))
  payload.push(...encodeVarInt(BigInt(outputIndex)))

  const payloadBytes = new Uint8Array(payload)

  // Build script: OP_RETURN OP_13 <push>
  const script: number[] = [0x6a, 0x5d]

  if (payloadBytes.length <= 75) {
    // Direct length byte (no opcode prefix needed)
    script.push(payloadBytes.length)
  } else if (payloadBytes.length <= 255) {
    script.push(0x4c, payloadBytes.length) // OP_PUSHDATA1
  } else {
    script.push(0x4d, payloadBytes.length & 0xff, (payloadBytes.length >> 8) & 0xff) // OP_PUSHDATA2
  }

  script.push(...payloadBytes)
  return new Uint8Array(script)
}
