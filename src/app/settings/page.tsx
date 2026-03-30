'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { MOCK_USERS } from '@/lib/mock-data'
import { TeamUser } from '@/types'
import { BookUser, Shield, Plug, Users } from 'lucide-react'
import Link from 'next/link'

type Tab = 'users' | 'integrations'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState(MOCK_USERS)

  function toggleRole(id: string) {
    setUsers(prev => prev.map(u => u.id === id
      ? { ...u, role: u.role === 'admin' ? 'regular' : 'admin' }
      : u
    ))
  }

  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
          <div className="accent-line mt-3 w-24" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-ink-100">
          {([
            { id: 'users', label: 'Users & Permissions', icon: Users },
            { id: 'integrations', label: 'Integrations', icon: Plug },
          ] as { id: Tab; label: string; icon: any }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t.id ? 'border-gold text-ink' : 'border-transparent text-ink-400 hover:text-ink'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === 'users' && (
          <div className="space-y-6">
            {/* Contacts quick link */}
            <Link
              href="/contacts"
              className="flex items-center gap-3 bg-parchment border border-ink-100 rounded-xl px-5 py-4 hover:border-ink-300 transition-all group"
            >
              <BookUser size={16} className="text-ink-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">Contacts Directory</p>
                <p className="text-xs text-ink-400">View and search all contacts across engagements</p>
              </div>
              <span className="text-xs text-gold group-hover:text-gold-dark">View →</span>
            </Link>

            {/* Permissions info */}
            <div className="bg-white border border-ink-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={14} className="text-ink-400" />
                <p className="text-sm font-semibold text-ink">Permission Levels</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-gold bg-gold/10 border-gold/20 flex-shrink-0 mt-0.5">Admin</span>
                  <p className="text-xs text-ink-500">Full access — sees all Review queues across all accounts, can manage users, can archive records</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-ink-400 bg-parchment border-ink-200 flex-shrink-0 mt-0.5">Regular</span>
                  <p className="text-xs text-ink-500">Sees only their own Review queue items, can edit and move records but cannot delete or archive</p>
                </div>
              </div>
            </div>

            {/* User list */}
            <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-100 bg-parchment flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Team Members</p>
                <button className="text-xs text-gold hover:text-gold-dark font-medium transition-all">+ Add user</button>
              </div>
              <div className="divide-y divide-ink-50">
                {users.map(user => (
                  <UserRow key={user.id} user={user} onToggleRole={toggleRole} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Integrations tab */}
        {tab === 'integrations' && (
          <div className="space-y-3">
            {[
              { label: 'Supabase', desc: 'Database connection', status: 'Not connected' },
              { label: 'Microsoft 365', desc: 'Email sync via Microsoft Graph API', status: 'Not connected' },
              { label: 'Anthropic API', desc: 'Claude AI for email drafts and IG captions', status: 'Configure in .env.local' },
              { label: 'Document Storage', desc: 'Supabase Storage for contracts, invoices, advance sheets', status: 'Not connected' },
              { label: 'Media Storage', desc: 'Post-event media and press assets', status: 'TBD' },
            ].map(item => (
              <div key={item.label} className="bg-white border border-ink-100 rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{item.desc}</p>
                </div>
                <span className="text-xs text-ink-400 bg-parchment px-3 py-1 rounded-full">{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function UserRow({ user, onToggleRole }: { user: TeamUser, onToggleRole: (id: string) => void }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
        {user.avatar_initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{user.name}</p>
        <p className="text-xs text-ink-400">{user.email} · {user.account}</p>
      </div>
      <button
        onClick={() => onToggleRole(user.id)}
        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all hover:opacity-80 ${
          user.role === 'admin'
            ? 'text-gold bg-gold/10 border-gold/20'
            : 'text-ink-400 bg-parchment border-ink-200'
        }`}
      >
        {user.role === 'admin' ? 'Admin' : 'Regular'}
      </button>
    </div>
  )
}