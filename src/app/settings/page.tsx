import AppShell from '@/components/layout/AppShell'

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="font-display text-3xl font-semibold mb-2">Settings</h1>
        <div className="accent-line w-24 mb-8" />
        <div className="space-y-4">
          {[
            { label: 'Supabase', desc: 'Database connection', status: 'Not connected' },
            { label: 'Microsoft 365', desc: 'Email sync via Microsoft Graph API', status: 'Not connected' },
            { label: 'Anthropic API', desc: 'Claude AI for email drafts and IG captions', status: 'Configure in .env.local' },
            { label: 'Document Storage', desc: 'Supabase Storage for contracts, invoices, advance sheets', status: 'Not connected' },
            { label: 'Media Storage', desc: 'Post-event media and press assets', status: 'TBD — Google Drive or Supabase Storage' },
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
      </div>
    </AppShell>
  )
}
