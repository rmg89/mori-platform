'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Inbox, Sparkles, Settings,
  ChevronRight, Bell, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/pipeline',   label: 'Pipeline',   icon: Users },
  { href: '/inbox',      label: 'Inbox',      icon: Inbox, badge: 2 },
  { href: '/ai-tools',   label: 'AI Tools',   icon: Sparkles },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-ink-900 border-r border-ink-800">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-ink-800">
          <div className="font-display text-gold text-xl font-semibold tracking-wide leading-tight">
            Mori<br />
            <span className="text-ink-300 text-sm font-normal tracking-widest uppercase">Platform</span>
          </div>
          <div className="accent-line mt-3" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                  active
                    ? 'bg-gold/10 text-gold border border-gold/20'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-cream'
                )}
              >
                <Icon size={16} className={active ? 'text-gold' : 'text-ink-400 group-hover:text-cream'} />
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span className="text-xs bg-gold text-ink-900 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {badge}
                  </span>
                ) : active ? (
                  <ChevronRight size={12} className="text-gold/60" />
                ) : null}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-ink-800">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-400 hover:bg-ink-800 hover:text-cream transition-all"
          >
            <Settings size={16} />
            <span>Settings</span>
          </Link>
          <div className="mt-3 px-3">
            <div className="text-xs text-ink-500">Signed in as</div>
            <div className="text-xs text-ink-300 font-medium mt-0.5 truncate">team@moritaheripour.com</div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center px-6 border-b border-ink-100 bg-cream/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-parchment border border-ink-100 rounded-lg px-3 py-1.5 w-64">
              <Search size={14} className="text-ink-300" />
              <input
                placeholder="Search clients, events..."
                className="bg-transparent text-sm text-ink-600 placeholder:text-ink-300 outline-none flex-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-parchment transition-all">
              <Bell size={16} className="text-ink-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-gold rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold">
              MT
            </div>
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
