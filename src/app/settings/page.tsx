'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { BookUser, Shield, Plug, Users, Receipt, Check } from 'lucide-react'
import Link from 'next/link'
import { fetchBusinessProfile, updateBusinessProfile } from '@/lib/business'
import type { BusinessProfile } from '@/types'

type Tab = 'users' | 'billing' | 'integrations'

function BillingField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
      />
    </div>
  )
}

function BillingTextArea({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all resize-none"
      />
    </div>
  )
}

function BillingTab() {
  const [profile, setProfile] = useState<BusinessProfile>({ name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchBusinessProfile().then(p => { setProfile(p); setLoading(false) })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await updateBusinessProfile(profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-400">Loading…</p>

  return (
    <div className="bg-white border border-ink-100 rounded-xl p-5 max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={14} className="text-ink-400" />
        <p className="text-sm font-semibold text-ink">Invoice Letterhead</p>
      </div>
      <p className="text-xs text-ink-400 mb-4">
        Shown on every generated invoice — the business name, address, and contact details next to the client's billing info.
      </p>
      <div className="space-y-3">
        <BillingField label="Business name" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} placeholder="MT Global Strategies" />
        <BillingTextArea label="Address" value={profile.address ?? ''} onChange={v => setProfile(p => ({ ...p, address: v }))} placeholder={'2425 L Street, NW, #409\nWashington, DC'} />
        <div className="grid grid-cols-2 gap-3">
          <BillingField label="Phone" value={profile.phone ?? ''} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="510-385-7917" />
          <BillingField label="Fax" value={profile.fax ?? ''} onChange={v => setProfile(p => ({ ...p, fax: v }))} placeholder="202-223-1655" />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-5 flex items-center gap-1.5 text-xs font-medium text-white bg-ink hover:bg-ink-700 px-4 py-2 rounded-lg transition-all disabled:opacity-40"
      >
        {saved ? <><Check size={12} /> Saved</> : saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users')

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
            { id: 'billing', label: 'Billing', icon: Receipt },
            { id: 'integrations', label: 'Integrations', icon: Plug },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
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

            {/* User list — placeholder until user management is built */}
            <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-100 bg-parchment flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Team Members</p>
              </div>
              <div className="px-5 py-8 text-center">
                <Users size={24} className="text-ink-200 mx-auto mb-2" />
                <p className="text-sm font-medium text-ink">Team management coming soon</p>
                <p className="text-xs text-ink-400 mt-1">User accounts will be managed here once auth is fully configured.</p>
              </div>
            </div>
          </div>
        )}

        {/* Billing tab */}
        {tab === 'billing' && <BillingTab />}

        {/* Integrations tab */}
        {tab === 'integrations' && (
          <div className="space-y-3">
            {[
              { label: 'Supabase', desc: 'Database — engagements, contacts, companies, calls, communications', status: 'Connected', connected: true },
              { label: 'Vercel', desc: 'Hosting and deployment', status: 'Connected', connected: true },
              { label: 'Anthropic / Claude', desc: 'AI via MCP server — briefing, contacts, pipeline management', status: 'Connected', connected: true },
              { label: 'Microsoft 365', desc: 'Email sync via Microsoft Graph API', status: 'Not connected', connected: false },
              { label: 'Supabase Storage', desc: 'Document storage for contracts, invoices, briefing docs', status: 'Not connected', connected: false },
              { label: 'Media Storage', desc: 'Post-event media and press assets', status: 'Not connected', connected: false },
            ].map(item => (
              <div key={item.label} className="bg-white border border-ink-100 rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{item.desc}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  item.connected
                    ? 'text-sage bg-sage/10'
                    : 'text-ink-400 bg-parchment'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
