export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'expired'

export interface Order {
  id: string
  maker_address: string
  from_token_id: string
  to_token_id: string
  from_amount: number        // in token's native unit (e.g. rune divisibility units)
  to_amount: number          // BTC in satoshis (ask price)
  psbt_hex: string           // maker's partially signed PSBT
  utxo_txid: string          // the UTXO the maker is spending
  utxo_vout: number
  status: OrderStatus
  created_at: string
  expires_at: string
}

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at'>
        Update: Partial<Omit<Order, 'id'>>
      }
    }
  }
}
