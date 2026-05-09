import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WalletModal } from '@/components/wallet/WalletModal'

export const metadata: Metadata = {
  title: 'SatsSwap — Trustless Order Book for Bitcoin Runes & BRC-20',
  description:
    'Place and fill limit orders for Runes and BRC-20 tokens. Trustless PSBT settlement on Bitcoin L1. No escrow, no custody — your keys, your orders.',
  keywords: ['Bitcoin', 'Runes', 'BRC-20', 'Order Book', 'DEX', 'PSBT', 'Non-custodial', 'Trustless'],
  openGraph: {
    title: 'SatsSwap — Trustless Order Book for Bitcoin Runes & BRC-20',
    description: 'Trustless PSBT order book. Place limit orders, fill instantly, settle on Bitcoin L1.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <Header />
        <WalletModal />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
