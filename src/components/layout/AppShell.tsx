'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, UserSearch, Handshake, Archive,
  ClipboardCheck, Sparkles, Settings, Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_REVIEW_ITEMS } from '@/lib/mock-data'

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/prospects',   label: 'Prospects',   icon: UserSearch },
  { href: '/engagements', label: 'Engagements', icon: Handshake },
  { href: '/post-event',  label: 'Post-Event',  icon: Archive },
  { href: '/review',      label: 'Review',      icon: ClipboardCheck },
  { href: '/companies',   label: 'Companies',   icon: Building2 },
  { href: '/ai-tools',    label: 'AI Tools',    icon: Sparkles },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reviewCount = MOCK_REVIEW_ITEMS.filter(i => !i.confirmed_at).length

  return (
    <div className="flex h-screen overflow-hidden bg-parchment">

      {/* ── Sidebar ── */}
      <aside className="w-52 flex-shrink-0 flex flex-col bg-parchment border-r border-ink-200/40">

        {/* Wordmark */}
        <div className="px-4 pt-4 pb-4 border-b border-ink-200/40">
          <div className="font-display">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-400 block">Team</span>
            <span className="text-xl font-semibold text-gold-dark tracking-wide block leading-tight">Taheripour</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-px overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const badge = href === '/review' ? (reviewCount > 0 ? reviewCount : undefined) : undefined
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-white text-ink shadow-sm border border-ink-100'
                    : 'text-ink-400 hover:text-ink hover:bg-white/60'
                )}
              >
                <Icon size={15} className={cn('flex-shrink-0', active ? 'text-gold' : 'text-ink-300')} />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="text-[10px] bg-gold text-ink-900 rounded-full w-4 h-4 flex items-center justify-center font-bold flex-shrink-0">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-ink-200/40">
          <Link href="/settings"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-400 hover:text-ink hover:bg-white/60 transition-all">
            <Settings size={15} className="flex-shrink-0 text-ink-300" />
            <span>Settings</span>
          </Link>
          <div className="px-3 pt-2 pb-1">
            <div className="text-[10px] uppercase tracking-widest text-ink-300 mb-0.5">Signed in as</div>
            <div className="text-[11px] font-medium truncate text-ink-400">team@moritaheripour.com</div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{
        background: 'linear-gradient(160deg, #FAF8F3 0%, #F5F1E8 60%, #FAF8F3 100%)',
      }}>

        {/* Top bar */}
        <header className="h-10 flex items-center justify-between px-5 flex-shrink-0 border-b border-ink-100/60 bg-cream/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1 w-48 bg-ink-50/60 border border-ink-100/60">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              placeholder="Search clients, events..."
              className="bg-transparent text-xs text-ink-600 placeholder:text-ink-300 outline-none flex-1"
            />
          </div>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-gold bg-ink-800">
            MT
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}