import { Suspense } from 'react'
import { DexInterface } from '@/components/dex/DexInterface'
import { getLiveTokenList } from '@/lib/prices'

export default async function DexPage() {
  const tokens = await getLiveTokenList()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-text-primary text-2xl font-bold">Order Book</h1>
        <p className="text-text-muted text-sm mt-1">
          Place limit orders or fill existing ones — trustless PSBT settlement on Bitcoin L1
        </p>
      </div>
      <Suspense fallback={<div className="h-96 bg-card border border-border rounded-2xl animate-pulse" />}>
        <DexInterface initialTokens={tokens} />
      </Suspense>
    </div>
  )
}
