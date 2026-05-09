import type { Order } from '@/lib/db/types'

export type { Order }

export type AssetType = 'BTC' | 'RUNE' | 'BRC20' | 'ORDINAL'

export interface Token {
  id: string
  symbol: string
  name: string
  type: AssetType
  decimals: number
  priceBTC: number
  priceUSD: number
  change24h: number
  volume24h: number
  marketCap: number
  logoColor: string
  logoUrl?: string
}


export interface WalletProvider {
  id: string
  name: string
  description: string
  iconBg: string
  iconText: string
  downloadUrl: string
}

export interface ConnectedWallet {
  address: string          // payment address (bc1q native segwit)
  taprootAddress?: string  // ordinals/Runes address (bc1p taproot) — Xverse/Leather only
  publicKey: string
  provider: string
  balanceSats: number
}

export interface SwapTransaction {
  psbtHex: string
  fee: number
  dex: string
}

/** Result from the /api/quotes order book fill endpoint */
export interface MarketFill {
  fromToken: Token
  toToken: Token
  fromAmount: number
  /** True when at least one matching order exists in the book */
  hasLiquidity: boolean
  /** The specific order the taker will fill (null when no liquidity) */
  bestOrder: Order | null
  /** toToken units per fromToken unit */
  rate: number
  estimatedOutput: number
  priceImpact: number
  networkFeeSats: number
  /** Unix ms — quote is valid until this time */
  expiresAt: number
  /** Human-readable reason when hasLiquidity is false */
  message?: string
}
