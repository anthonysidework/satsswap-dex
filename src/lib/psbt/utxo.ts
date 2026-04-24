const MEMPOOL = 'https://mempool.space/api'

export interface Utxo {
  txid: string
  vout: number
  value: number      // satoshis
  status: { confirmed: boolean; block_height?: number }
}

export interface TxOutput {
  scriptpubkey: string
  scriptpubkey_type: string
  scriptpubkey_address?: string
  value: number
}

export async function getUtxos(address: string): Promise<Utxo[]> {
  const res = await fetch(`${MEMPOOL}/address/${address}/utxo`)
  if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`)
  return res.json()
}

export async function getTxOutput(txid: string, vout: number): Promise<TxOutput> {
  const res = await fetch(`${MEMPOOL}/tx/${txid}`)
  if (!res.ok) throw new Error(`TX fetch failed: ${res.status}`)
  const tx = await res.json()
  const output = tx.vout?.[vout]
  if (!output) throw new Error(`vout ${vout} not found in tx ${txid}`)
  return output
}

export async function getRawTx(txid: string): Promise<string> {
  const res = await fetch(`${MEMPOOL}/tx/${txid}/hex`)
  if (!res.ok) throw new Error(`Raw TX fetch failed: ${res.status}`)
  return res.text()
}

/** Pick UTXOs to cover targetSats, using largest-first coin selection. */
export function selectUtxos(utxos: Utxo[], targetSats: number): Utxo[] {
  const confirmed = utxos.filter((u) => u.status.confirmed).sort((a, b) => b.value - a.value)
  const selected: Utxo[] = []
  let total = 0
  for (const utxo of confirmed) {
    selected.push(utxo)
    total += utxo.value
    if (total >= targetSats) break
  }
  if (total < targetSats) throw new Error('Insufficient confirmed UTXOs')
  return selected
}
