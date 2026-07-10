'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, UserSearch, Handshake, Archive, FolderArchive,
  ClipboardCheck, Sparkles, Settings, Building2, Receipt,
  CheckCircle2, Loader2, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore, SaveStatus } from '@/lib/store'

function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'idle') return null
  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full transition-all ${
      status === 'saving' ? 'text-ink-400 bg-ink-50' :
      status === 'saved'  ? 'text-sage-dark bg-sage/10' :
      'text-red-600 bg-red-50'
    }`} title={status === 'error' ? (error ?? 'Save failed') : undefined}>
      {status === 'saving' && <Loader2 size={10} className="animate-spin" />}
      {status === 'saved'  && <CheckCircle2 size={10} />}
      {status === 'error'  && <AlertCircle size={10} />}
      {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed'}
    </div>
  )
}

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/prospects',   label: 'Prospects',   icon: UserSearch },
  { href: '/engagements', label: 'Engagements', icon: Handshake },
  { href: '/wrap-up',  label: 'Wrap-Up',  icon: Archive },
  { href: '/invoices',    label: 'Invoices',    icon: Receipt },
  { href: '/review',      label: 'Review',      icon: ClipboardCheck },
  { href: '/companies',   label: 'Companies',   icon: Building2 },
  { href: '/ai-tools',    label: 'AI Tools',    icon: Sparkles },
  { href: '/archive',     label: 'Archive',     icon: FolderArchive },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { reviewItems, saveStatus, saveError } = useStore()
  const reviewCount = reviewItems.filter(i => !i.confirmed_by).length

  return (
    <div className="flex h-screen overflow-hidden bg-parchment">

      {/* ── Sidebar ── */}
      <aside className="w-52 flex-shrink-0 flex flex-col bg-parchment border-r border-ink-200/40">

        {/* Wordmark */}
        <div className="px-5 pt-6 pb-5">
          <span className="text-[8px] font-medium tracking-[0.45em] uppercase text-ink-300 block mb-1.5">Team</span>
          <span className="font-display text-[40px] font-light text-gold-dark leading-none block tracking-wide">Mori</span>
          <div className="mt-4 w-10 h-px" style={{ background: 'linear-gradient(90deg, #C9A84C, transparent)' }} />
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
            <div className="text-[11px] font-medium truncate text-ink-400">admin@moritaheripour.com</div>
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
          <SaveIndicator status={saveStatus} error={saveError} />
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