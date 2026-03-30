'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { primaryContact, ENGAGEMENT_FLAGS, EngagementFlag, POST_EVENT_FLAGS, PostEventFlag, ContactStatus } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, Mail, Phone, Eye, EyeOff, ArrowRight, AlertTriangle, CheckCircle2, Circle, Building2 } from 'lucide-react'
import Link from 'next/link'

const STATUS_LABELS: Record<ContactStatus, string> = {
  prospect_active: 'Prospect — Active',
  prospect_expired: 'Prospect — Expired',
  client: 'Client',
}

const STATUS_COLORS: Record<ContactStatus, string> = {
  prospect_active: 'text-sage bg-sage/10 border-sage/20',
  prospect_expired: 'text-ink-400 bg-parchment border-ink-200',
  client: 'text-gold bg-gold/10 border-gold/20',
}

export default function ContactProfilePage() {
  const { id } = useParams()

  // Find the contact across all engagements
  const allContacts = MOCK_ENGAGEMENTS.flatMap(e =>
    e.contacts.map(c => ({ ...c, engagement: e }))
  )
  const match = allContacts.find(c => c.id === id)

  if (!match) return <div className="p-8 text-ink-400">Contact not found.</div>

  // Get all engagements this contact appears in
  const contactEngagements = MOCK_ENGAGEMENTS.filter(e =>
    e.contacts.some(c => c.id === id)
  )

  const [watching, setWatching] = useState(match.watching ?? false)

  const SECTION_LABELS: Record<string, string> = {
    prospects: 'Prospect',
    engagements: 'Engagement',
    'post-event': 'Completed',
  }
  const SECTION_COLORS: Record<string, string> = {
    prospects: '#7A9E87',
    engagements: '#C9A84C',
    'post-event': '#4A4740',
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <Link href="/contacts" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Contacts
      </Link>

      {/* Header card */}
      <div className="bg-white border border-ink-100 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ink-800 flex items-center justify-center text-lg font-bold text-gold flex-shrink-0">
              {getInitials(match.first_name, match.last_name)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-semibold text-ink">
                  {match.first_name} {match.last_name}
                </h1>
                {match.status && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[match.status]}`}>
                    {STATUS_LABELS[match.status]}
                  </span>
                )}
                {watching && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                    <Eye size={8} />Watching
                  </span>
                )}
              </div>
              {match.title && <p className="text-sm text-ink-400 mt-0.5">{match.title}</p>}
              <div className="flex items-center gap-4 mt-2">
                {match.email && (
                  <a href={`mailto:${match.email}`} className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink transition-all">
                    <Mail size={12} />{match.email}
                  </a>
                )}
                {match.phone && (
                  <a href={`tel:${match.phone}`} className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink transition-all">
                    <Phone size={12} />{match.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setWatching(!watching)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              watching
                ? 'bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100'
                : 'bg-parchment text-ink-400 border-ink-100 hover:border-ink-300 hover:text-ink'
            }`}
          >
            {watching ? <Eye size={12} /> : <EyeOff size={12} />}
            {watching ? 'Watching' : 'Watch'}
          </button>
        </div>

        {match.notes && (
          <p className="text-sm text-ink-500 mt-4 pt-4 border-t border-ink-50">{match.notes}</p>
        )}
      </div>

      {/* Engagement history */}
      <h2 className="font-display text-lg font-semibold text-ink mb-3">
        Engagement History
        <span className="text-sm text-ink-400 font-normal ml-2">{contactEngagements.length}</span>
      </h2>

      {contactEngagements.length === 0 ? (
        <p className="text-sm text-ink-400">No engagements yet.</p>
      ) : (
        <div className="space-y-3">
          {contactEngagements.map(e => {
            const sectionColor = SECTION_COLORS[e.section] ?? '#4A4740'
            const sectionLabel = SECTION_LABELS[e.section] ?? e.section
            const flags = e.section === 'post-event' ? POST_EVENT_FLAGS : ENGAGEMENT_FLAGS
            const activeFlags = e.section === 'post-event'
              ? e.post_event_flags
              : e.engagement_flags

            return (
              <Link
                key={e.id}
                href={`/${e.section}/${e.id}`}
                className="block bg-white border border-ink-100 rounded-xl px-5 py-4 hover:border-gold/30 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-ink">{e.event_name || e.topic || e.organization}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: sectionColor + '18', color: sectionColor }}>
                        {sectionLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Building2 size={11} className="text-ink-300" />
                      <p className="text-xs text-ink-400">{e.organization}</p>
                      {e.event_date && (
                        <span className="text-xs text-ink-300">· {formatDate(e.event_date, 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0 mt-1" />
                </div>

                {/* Flags */}
                {(e.section === 'engagements' || e.section === 'post-event') && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {flags.map(flag => {
                      const done = (activeFlags as string[]).includes(flag.id)
                      return (
                        <div key={flag.id} className={`flex items-center gap-1 text-[11px] ${done ? 'text-sage' : 'text-ink-200'}`}>
                          {done ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                          {flag.label}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Alerts */}
                {e.alerts.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-red-500">
                    <AlertTriangle size={9} />{e.alerts[0].label}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}