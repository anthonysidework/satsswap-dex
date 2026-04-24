'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { formatBTC, truncateAddress } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { LogOut, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/dex', label: 'DEX' },
  { href: '/swap', label: 'Aggregator' },
  { href: '/explore', label: 'Explore' },
  { href: '/portfolio', label: 'Portfolio' },
]

export function Header() {
  const pathname = usePathname()
  const { wallet, openModal, disconnect } = useWallet()
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-orange">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="black"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-bold text-text-primary text-lg tracking-tight">
            Sats<span className="text-primary">Swap</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          {wallet ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2.5 bg-card border border-border hover:border-border-light rounded-xl px-3.5 py-2 transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <div className="text-left hidden sm:block">
                  <div className="text-text-primary text-sm font-semibold font-mono">
                    {truncateAddress(wallet.address)}
                  </div>
                  <div className="text-text-muted text-xs">
                    {formatBTC(wallet.balanceSats)} BTC
                  </div>
                </div>
                <ChevronDown size={14} className="text-text-muted" />
              </button>

              {showDropdown && (
                <>
                  <div className="fixed inset-0" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-card overflow-hidden z-50">
                    <div className="p-3 border-b border-border">
                      <div className="text-text-muted text-xs mb-1">Connected via {wallet.provider}</div>
                      <div className="text-text-primary font-mono text-sm font-medium break-all">
                        {truncateAddress(wallet.address, 8)}
                      </div>
                    </div>
                    <button
                      onClick={() => { disconnect(); setShowDropdown(false) }}
                      className="w-full flex items-center gap-2 px-3 py-3 text-sm text-danger hover:bg-danger/5 transition-colors"
                    >
                      <LogOut size={14} />
                      Disconnect
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button onClick={openModal} size="md">
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
