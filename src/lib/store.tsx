'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react'
import { Engagement, EngagementContact, EngagementCall, CommEntry, BriefingNote, PostEventFlag, EngagementFlag, MediaFlag, ProspectStep, WrapUpFlagStages, PostEventMediaItem, PostEventMediaType } from '@/types'
import { fetchAllEngagements, fetchCompanies, updateEngagementRow, deleteEngagementRow, insertEngagementRow, updateCompanyRow, insertCompanyRow, deleteCompanyRow, upsertCall, insertComm, updateCommRow, upsertContact, insertContact, deleteContactRow, insertBriefingNoteRow, updateBriefingNoteRow, deleteBriefingNoteRow } from '@/lib/db'
import { getBackwardTransition } from '@/lib/pipeline'
import type { ReviewItem, Company } from '@/types'

// ─── Store shape ──────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface StoreState {
  engagements: Engagement[]
  reviewItems: ReviewItem[]
  companies: Company[]
  loading: boolean
  error: string | null
  saveStatus: SaveStatus
  saveError: string | null
}

interface StoreActions {
  // Engagement field updates
  updateEngagement: (id: string, patch: Partial<Engagement>) => void

  // Prospect step
  setProspectStep: (id: string, step: ProspectStep) => void

  // Pipeline transitions (confirmed/declined → review sections)
  confirmProspect: (id: string) => void
  declineProspect: (id: string) => void
  moveToWrapUp: (id: string) => void
  moveEngagementBack: (id: string) => void
  confirmBookingReview: (id: string) => void
  confirmWrapUpReview: (id: string) => void

  // Create
  addProspect: (input: {
    organization: string
    company_id?: string
    prospect_step?: ProspectStep
    source?: string
    topic?: string
    event_city?: string
    fee?: number
    notes?: string
    contacts?: {
      first_name: string; last_name?: string; email?: string; phone?: string; title?: string
      company_id?: string; is_current_point_of_contact?: boolean
    }[]
  }) => Promise<Engagement>

  // Archive / delete
  archiveEngagement: (id: string, reason?: string) => void
  unarchiveEngagement: (id: string) => void
  deleteEngagement: (id: string) => void

  // Engagement flags
  toggleEngagementFlag: (id: string, flag: EngagementFlag) => void
  toggleMediaFlag: (id: string, flag: MediaFlag) => void
  setPostEventFlagNeeded: (id: string, flag: PostEventFlag) => void
  setPostEventFlagDone: (id: string, flag: PostEventFlag) => void
  setPostEventFlagNotNeeded: (id: string, flag: PostEventFlag) => void
  resetPostEventFlag: (id: string, flag: PostEventFlag) => void
  updatePostEventFollowUpDetails: (id: string, details: string) => void
  updatePostEventFollowUpDate: (id: string, date: string) => void
  updatePostEventTestimonialLink: (id: string, link: string) => void
  updatePostEventTestimonialText: (id: string, text: string) => void
  updatePostEventNotes: (id: string, notes: string) => void
  updatePostEventItemNote: (id: string, flag: PostEventFlag, note: string) => void
  addPostEventMedia: (id: string, item: { type: PostEventMediaType; name: string; url: string; description?: string }) => void
  removePostEventMedia: (id: string, mediaId: string) => void
  updatePostEventMediaDescription: (id: string, mediaId: string, description: string) => void
  updatePostEventStage: (id: string, stages: Partial<WrapUpFlagStages>) => void

  // Proposed dates
  addProposedDate: (id: string, date: string) => void
  removeProposedDate: (id: string, date: string) => void
  confirmProposedDate: (id: string, date: string, time?: string) => void
  addProposedTime: (id: string, date: string, time: string) => void
  removeProposedTime: (id: string, date: string, time: string) => void

  // Calls
  addCall: (engagementId: string, call: EngagementCall) => void
  updateCall: (engagementId: string, callId: string, patch: Partial<EngagementCall>) => void

  // Comms
  addComm: (engagementId: string, comm: CommEntry) => void
  updateComm: (engagementId: string, commId: string, patch: Partial<CommEntry>) => void

  // Briefing notes
  addBriefingNote: (engagementId: string, note: BriefingNote) => void
  resolveBriefingNote: (engagementId: string, noteId: string) => void
  deleteBriefingNote: (engagementId: string, noteId: string) => void

  // Field statuses
  setFieldStatus: (id: string, field: string, status: 'needed' | 'not_needed' | null) => void

  // Review
  confirmReviewItem: (id: string, confirmedBy: string) => void
  dismissReviewItem: (id: string) => void

  // Companies
  updateCompany: (id: string, patch: Partial<Company>) => void
  createCompany: (input: { name: string; website?: string; industry?: string }) => Promise<Company>
  deleteCompany: (id: string) => void

  // Contacts (global — updates all engagements sharing the same email)
  updateContact: (email: string, patch: Partial<EngagementContact>) => void
  deleteContact: (id: string) => void
}

type Store = StoreState & StoreActions

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trackSave = useCallback((promise: Promise<unknown>) => {
    setSaveStatus('saving')
    setSaveError(null)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    promise.then(() => {
      setSaveStatus('saved')
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
    }).catch((err: unknown) => {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    })
  }, [])

  // Lightweight error-only handler for fire-and-forget writes where we don't
  // need the full saving/saved lifecycle — just surfaces failures to the user.
  const onWriteError = useCallback((err: unknown) => {
    console.error(err)
    setSaveStatus('error')
    setSaveError(err instanceof Error ? err.message : 'Save failed')
  }, [])

  // ── Load from Supabase on mount ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchAllEngagements(), fetchCompanies()])
      .then(([engData, coData]) => {
        // Preserve any records created locally (e.g. via the New Inquiry modal)
        // while this initial fetch was still in flight — don't let a stale
        // snapshot wipe out state that already moved on.
        setEngagements(prev => {
          const fetchedIds = new Set(engData.map(e => e.id))
          return [...engData, ...prev.filter(e => !fetchedIds.has(e.id))]
        })
        setCompanies(prev => {
          const fetchedIds = new Set(coData.map(c => c.id))
          return [...coData, ...prev.filter(c => !fetchedIds.has(c.id))]
        })
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load data:', err)
        setError('Failed to load data. Please refresh.')
        setLoading(false)
      })
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Map EngagementFlag toggle to the correct Supabase column
  const flagToColumn = (flag: EngagementFlag): Record<string, unknown> => {
    const now = new Date().toISOString()
    switch (flag) {
      case 'contract_sent':            return { contract_sent_at: now }
      case 'contract_signed':          return { contract_signed_at: now }
      case 'client_deliverables_sent': return { client_deliverables_sent: true }
      case 'advance_sheet_complete':   return { advance_sheet_complete: true }
      case 'materials_requested':      return { materials_requested: true }
    }
  }

  const flagOffColumn = (flag: EngagementFlag): Record<string, unknown> => {
    switch (flag) {
      case 'contract_sent':            return { contract_sent_at: null }
      case 'contract_signed':          return { contract_signed_at: null }
      case 'client_deliverables_sent': return { client_deliverables_sent: false }
      case 'advance_sheet_complete':   return { advance_sheet_complete: false }
      case 'materials_requested':      return { materials_requested: false }
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const updateCompany = useCallback((id: string, patch: Partial<Company>) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    const { teams, engagement_ids, contact_ids, ...dbPatch } = patch
    if (Object.keys(dbPatch).length > 0) updateCompanyRow(id, dbPatch as Record<string, unknown>).catch(onWriteError)
  }, [])

  const createCompany = useCallback(async (input: { name: string; website?: string; industry?: string }) => {
    const company = await insertCompanyRow(input)
    setCompanies(prev => [...prev, company].sort((a, b) => a.name.localeCompare(b.name)))
    return company
  }, [])

  const deleteCompany = useCallback((id: string) => {
    setCompanies(prev => prev.filter(c => c.id !== id))
    // The company link is optional on both engagements and contacts — deleting the
    // company unlinks it from either rather than deleting the records that used it.
    setEngagements(prev => prev.map(e => ({
      ...e,
      company_id: e.company_id === id ? undefined : e.company_id,
      contacts: e.contacts.map(c => c.company_id === id ? { ...c, company_id: undefined } : c),
    })))
    deleteCompanyRow(id).catch(onWriteError)
  }, [])

  const updateContact = useCallback((email: string, patch: Partial<EngagementContact>) => {
    setEngagements((prev: Engagement[]) => {
      prev.forEach((e: Engagement) => {
        e.contacts.forEach((c: EngagementContact) => {
          if (c.email.toLowerCase() === email.toLowerCase()) {
            upsertContact({ id: c.id, engagement_id: e.id, ...patch } as never).catch(onWriteError)
          }
        })
      })
      return prev.map((e: Engagement) => ({
        ...e,
        contacts: e.contacts.map((c: EngagementContact) =>
          c.email.toLowerCase() === email.toLowerCase() ? { ...c, ...patch } : c
        ),
      }))
    })
  }, [])

  const deleteContact = useCallback((id: string) => {
    setEngagements(prev => prev.map(e => ({ ...e, contacts: e.contacts.filter(c => c.id !== id) })))
    deleteContactRow(id).catch(onWriteError)
  }, [])

  const updateEngagement = useCallback((id: string, patch: Partial<Engagement>) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e
    ))
    // Write to Supabase — strip relational arrays (own tables) but keep JSONB material columns
    const { contacts, comms, calls, briefing_notes, alerts, engagement_flags, media_flags, post_event_flags, post_event_needed, post_event_not_needed, ...scalarPatch } = patch as Engagement
    if (Object.keys(scalarPatch).length > 0) {
      trackSave(updateEngagementRow(id, scalarPatch as Record<string, unknown>))
    }
    // Persist any new contacts (temp IDs = new or linked from UI)
    if (contacts) {
      contacts.forEach(c => {
        if (/^(new_|lnk_)/.test(c.id)) {
          insertContact(id, {
            engagement_id: id,
            first_name: c.first_name,
            last_name: c.last_name ?? '',
            email: c.email ?? null,
            phone: c.phone ?? null,
            title: c.title ?? null,
            role: c.role ?? 'primary',
            is_current_point_of_contact: c.is_current_point_of_contact,
            status: (c.status as string) ?? 'prospect_active',
            watching: c.watching ?? false,
            notes: c.notes ?? null,
            company_id: c.company_id ?? null,
            team_id: c.team_id ?? null,
          }).catch(onWriteError)
        }
      })
    }
  }, [])

  const setProspectStep = useCallback((id: string, step: ProspectStep) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, prospect_step: step, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { prospect_step: step }).catch(onWriteError)
  }, [])

  const runScan = useCallback((id: string, scanType: 'booking' | 'declined' | 'wrapup') => {
    fetch('/api/ai/scan-engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engagement_id: id, scan_type: scanType }),
    })
      .then(res => res.json())
      .then((result: { patch?: Record<string, unknown>; summary?: string }) => {
        const { patch, summary } = result
        setEngagements(prev => prev.map(e => {
          if (e.id !== id) return e
          const next: Engagement = { ...e, ...(patch ?? {}), updated_at: new Date().toISOString() }
          if (summary) {
            next.briefing_notes = [...(e.briefing_notes ?? []), {
              id: `tmp_${Date.now()}`,
              body: summary,
              resolved: false,
              created_at: new Date().toISOString(),
            }]
          }
          return next
        }))
      })
      .catch(onWriteError)
  }, [])

  const confirmProspect = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      // Snapshot the prospect-stage fields before moving to engagement
      const prospect_snapshot: Record<string, unknown> = {
        prospect_step: e.prospect_step,
        source: e.source,
        notes: e.notes,
        proposed_dates: e.proposed_dates,
        calls: e.calls,
        comms: e.comms,
        contacts: e.contacts,
        event_date: e.event_date,
        event_city: e.event_city,
        fee: e.fee,
        topic: e.topic,
        audience_size: e.audience_size,
        event_format: e.event_format,
      }
      updateEngagementRow(id, { section: 'engagements', prospect_step: null, booking_review_needed: true, confirmed_at: now, prospect_snapshot }).catch(onWriteError)
      return { ...e, section: 'engagements' as const, prospect_step: undefined, booking_review_needed: true, confirmed_at: now, prospect_snapshot, updated_at: now }
    }))
    runScan(id, 'booking')
  }, [runScan])

  const declineProspect = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const prospect_snapshot: Record<string, unknown> = {
        prospect_step: e.prospect_step,
        source: e.source,
        notes: e.notes,
        proposed_dates: e.proposed_dates,
        calls: e.calls,
        comms: e.comms,
        contacts: e.contacts,
      }
      updateEngagementRow(id, { section: 'wrap-up', prospect_step: 'declined', wrap_up_review_needed: true, declined_at: now, prospect_snapshot }).catch(onWriteError)
      return { ...e, section: 'wrap-up' as const, prospect_step: 'declined' as const, wrap_up_review_needed: true, declined_at: now, prospect_snapshot, updated_at: now }
    }))
    runScan(id, 'declined')
  }, [runScan])

  const moveToWrapUp = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      // Snapshot the engagement-stage fields before moving to wrap-up
      const engagement_snapshot: Record<string, unknown> = {
        engagement_flags: e.engagement_flags,
        media_flags: e.media_flags,
        contract_required: e.contract_required,
        contract_sent_at: e.contract_sent_at,
        contract_signed_at: e.contract_signed_at,
        outgoing_materials: e.outgoing_materials,
        incoming_materials: e.incoming_materials,
        briefing_complete: e.briefing_complete,
        briefing_notes: e.briefing_notes,
        deposit_amount: e.deposit_amount,
        deposit_invoice_sent_at: e.deposit_invoice_sent_at,
        deposit_received_at: e.deposit_received_at,
        run_of_show: (e as any).run_of_show,
        purpose: (e as any).purpose,
        audience_description: (e as any).audience_description,
        join_link: e.join_link,
        arrival_time: e.arrival_time,
        venue_maps_link: e.venue_maps_link,
        flight_details: e.flight_details,
        hotel_name: e.hotel_name,
      }
      updateEngagementRow(id, { section: 'wrap-up', wrap_up_review_needed: true, engagement_snapshot }).catch(onWriteError)
      return { ...e, section: 'wrap-up' as const, wrap_up_review_needed: true, engagement_snapshot, updated_at: now }
    }))
  }, [])

  const moveEngagementBack = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const target = getBackwardTransition(e)
      if (!target) return e
      const patch: Record<string, unknown> = {
        section: target.section, prospect_step: target.prospect_step, updated_at: now,
      }
      if (e.section === 'wrap-up') patch.wrap_up_review_needed = false
      if (e.section === 'engagements') patch.booking_review_needed = false
      updateEngagementRow(id, patch).catch(onWriteError)
      return { ...e, ...patch, prospect_step: target.prospect_step ?? undefined } as Engagement
    }))
  }, [])

  const confirmBookingReview = useCallback((id: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, booking_review_needed: false, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { booking_review_needed: false }).catch(onWriteError)
  }, [])

  const confirmWrapUpReview = useCallback((id: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, wrap_up_review_needed: false, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { wrap_up_review_needed: false }).catch(onWriteError)
  }, [])

  const archiveEngagement = useCallback((id: string, reason?: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, archived: true, archived_at: now, archived_reason: reason, updated_at: now } : e
    ))
    updateEngagementRow(id, { archived: true, archived_at: now, ...(reason ? { archived_reason: reason } : {}) }).catch(onWriteError)
  }, [])

  const unarchiveEngagement = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, archived: false, archived_at: undefined, updated_at: now } : e
    ))
    updateEngagementRow(id, { archived: false, archived_at: null }).catch(onWriteError)
  }, [])

  const deleteEngagement = useCallback((id: string) => {
    setEngagements(prev => prev.filter(e => e.id !== id))
    deleteEngagementRow(id).catch(onWriteError)
  }, [])

  const addProspect = useCallback(async (input: {
    organization: string
    company_id?: string
    prospect_step?: ProspectStep
    source?: string
    topic?: string
    event_city?: string
    fee?: number
    notes?: string
    contacts?: {
      first_name: string; last_name?: string; email?: string; phone?: string; title?: string
      company_id?: string; is_current_point_of_contact?: boolean
    }[]
  }) => {
    const engagement = await insertEngagementRow(input)
    setEngagements(prev => [engagement, ...prev])
    return engagement
  }, [])

  const toggleEngagementFlag = useCallback((id: string, flag: EngagementFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const isOn = e.engagement_flags.includes(flag)
      const flags = isOn
        ? e.engagement_flags.filter(f => f !== flag)
        : [...e.engagement_flags, flag]
      updateEngagementRow(id, isOn ? flagOffColumn(flag) : flagToColumn(flag)).catch(onWriteError)
      return { ...e, engagement_flags: flags, updated_at: new Date().toISOString() }
    }))
  }, [])

  const toggleMediaFlag = useCallback((id: string, flag: MediaFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const flags = (e.media_flags ?? [])
      const next = flags.includes(flag) ? flags.filter(f => f !== flag) : [...flags, flag]
      const colMap: Record<MediaFlag, string> = {
        confirmed: 'media_confirmed', bio_sent: 'media_bio_sent',
        prep_sent: 'media_prep_sent', day_of_ready: 'media_day_of_ready',
      }
      updateEngagementRow(id, { [colMap[flag]]: !flags.includes(flag) }).catch(onWriteError)
      return { ...e, media_flags: next, updated_at: new Date().toISOString() }
    }))
  }, [])

  const setPostEventFlagNeeded = useCallback((id: string, flag: PostEventFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_needed = [...(e.post_event_needed ?? []).filter(f => f !== flag), flag]
      const post_event_not_needed = (e.post_event_not_needed ?? []).filter(f => f !== flag)
      updateEngagementRow(id, { post_event_needed, post_event_not_needed }).catch(onWriteError)
      return {
        ...e,
        post_event_needed,
        post_event_not_needed,
        post_event_flags: (e.post_event_flags ?? []).filter(f => f !== flag),
        updated_at: new Date().toISOString(),
      }
    }))
  }, [])

  const setPostEventFlagDone = useCallback((id: string, flag: PostEventFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      // Map flag to Supabase column
      const colMap: Partial<Record<PostEventFlag, Record<string, unknown>>> = {
        invoice:      { invoice_sent_at: new Date().toISOString() },
        thank_you:    { thank_you_sent: true },
        testimonial:  { testimonial_requested: true },
        media:        { media_received: true },
        social_media: { social_media_complete: true },
        follow_up:    { follow_up_required: true },
      }
      const post_event_needed = (e.post_event_needed ?? []).filter(f => f !== flag)
      const post_event_not_needed = (e.post_event_not_needed ?? []).filter(f => f !== flag)
      const dbPatch = { post_event_needed, post_event_not_needed, ...(colMap[flag] ?? {}) }
      updateEngagementRow(id, dbPatch).catch(onWriteError)
      return {
        ...e,
        post_event_flags: [...(e.post_event_flags ?? []).filter(f => f !== flag), flag],
        post_event_needed,
        post_event_not_needed,
        updated_at: new Date().toISOString(),
      }
    }))
  }, [])

  const setPostEventFlagNotNeeded = useCallback((id: string, flag: PostEventFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_not_needed = [...(e.post_event_not_needed ?? []).filter(f => f !== flag), flag]
      const post_event_needed = (e.post_event_needed ?? []).filter(f => f !== flag)
      updateEngagementRow(id, { post_event_needed, post_event_not_needed }).catch(onWriteError)
      return {
        ...e,
        post_event_not_needed,
        post_event_needed,
        post_event_flags: (e.post_event_flags ?? []).filter(f => f !== flag),
        updated_at: new Date().toISOString(),
      }
    }))
  }, [])

  const resetPostEventFlag = useCallback((id: string, flag: PostEventFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_needed = (e.post_event_needed ?? []).filter(f => f !== flag)
      const post_event_not_needed = (e.post_event_not_needed ?? []).filter(f => f !== flag)
      updateEngagementRow(id, { post_event_needed, post_event_not_needed }).catch(onWriteError)
      return {
        ...e,
        post_event_flags: (e.post_event_flags ?? []).filter(f => f !== flag),
        post_event_needed,
        post_event_not_needed,
        updated_at: new Date().toISOString(),
      }
    }))
  }, [])

  const updatePostEventFollowUpDetails = useCallback((id: string, details: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_follow_up_details: details, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { follow_up_details: details }).catch(onWriteError)
  }, [])

  const updatePostEventFollowUpDate = useCallback((id: string, date: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_follow_up_date: date || undefined, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { post_event_follow_up_date: date || null }).catch(onWriteError)
  }, [])

  const updatePostEventTestimonialLink = useCallback((id: string, link: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_testimonial_link: link, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { post_event_testimonial_link: link }).catch(onWriteError)
  }, [])

  const updatePostEventTestimonialText = useCallback((id: string, text: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_testimonial_text: text, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { post_event_testimonial_text: text }).catch(onWriteError)
  }, [])

  const updatePostEventItemNote = useCallback((id: string, flag: PostEventFlag, note: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_item_notes = { ...(e.post_event_item_notes ?? {}), [flag]: note }
      updateEngagementRow(id, { post_event_item_notes }).catch(onWriteError)
      return { ...e, post_event_item_notes, updated_at: new Date().toISOString() }
    }))
  }, [])

  const addPostEventMedia = useCallback((id: string, file: { type: PostEventMediaType; name: string; url: string; description?: string }) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const item: PostEventMediaItem = { id: `media_${Date.now()}`, type: file.type, name: file.name, url: file.url, description: file.description, uploaded_at: new Date().toISOString() }
      const post_event_media = [...(e.post_event_media ?? []), item]
      updateEngagementRow(id, { post_event_media }).catch(onWriteError)
      return { ...e, post_event_media, updated_at: new Date().toISOString() }
    }))
  }, [])

  const removePostEventMedia = useCallback((id: string, mediaId: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_media = (e.post_event_media ?? []).filter(m => m.id !== mediaId)
      updateEngagementRow(id, { post_event_media }).catch(onWriteError)
      return { ...e, post_event_media, updated_at: new Date().toISOString() }
    }))
  }, [])

  const updatePostEventMediaDescription = useCallback((id: string, mediaId: string, description: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_media = (e.post_event_media ?? []).map(m => m.id === mediaId ? { ...m, description } : m)
      updateEngagementRow(id, { post_event_media }).catch(onWriteError)
      return { ...e, post_event_media, updated_at: new Date().toISOString() }
    }))
  }, [])

  const updatePostEventNotes = useCallback((id: string, notes: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_notes: notes, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { notes }).catch(onWriteError)
  }, [])

  const updatePostEventStage = useCallback((id: string, stages: Partial<WrapUpFlagStages>) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_stages: { ...e.post_event_stages, ...stages }, updated_at: new Date().toISOString() } : e
    ))
  }, [])

  const addProposedDate = useCallback((id: string, date: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const existing = e.proposed_dates ?? []
      if (existing.some(d => d.date === date)) return e
      const newDates = [...existing, { date }].sort((a, b) => a.date > b.date ? 1 : -1)
      return { ...e, proposed_dates: newDates, updated_at: new Date().toISOString() }
    }))
  }, [])

  const removeProposedDate = useCallback((id: string, date: string) => {
    setEngagements(prev => prev.map(e =>
      e.id !== id ? e : {
        ...e,
        proposed_dates: (e.proposed_dates ?? []).filter(d => d.date !== date),
        updated_at: new Date().toISOString(),
      }
    ))
  }, [])

  const addProposedTime = useCallback((id: string, date: string, time: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      return {
        ...e,
        proposed_dates: (e.proposed_dates ?? []).map(d =>
          d.date === date ? { ...d, times: [...(d.times ?? []), time] } : d
        ),
        updated_at: new Date().toISOString(),
      }
    }))
  }, [])

  const removeProposedTime = useCallback((id: string, date: string, time: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      return {
        ...e,
        proposed_dates: (e.proposed_dates ?? []).map(d =>
          d.date === date ? { ...d, times: (d.times ?? []).filter(t => t !== time) } : d
        ),
        updated_at: new Date().toISOString(),
      }
    }))
  }, [])

  const confirmProposedDate = useCallback((id: string, date: string, time?: string) => {
    setEngagements(prev => prev.map(e =>
      e.id !== id ? e : {
        ...e,
        event_date: date,
        event_time: time,
        proposed_dates: [],
        updated_at: new Date().toISOString(),
      }
    ))
    updateEngagementRow(id, { event_date: date, event_time: time ?? null }).catch(onWriteError)
  }, [])

  const addCall = useCallback((engagementId: string, call: EngagementCall) => {
    setEngagements(prev => prev.map(e =>
      e.id === engagementId
        ? { ...e, calls: [...(e.calls ?? []), call], updated_at: new Date().toISOString() }
        : e
    ))
    upsertCall({ ...call, engagement_id: engagementId }).catch(onWriteError)
  }, [])

  const updateCall = useCallback((engagementId: string, callId: string, patch: Partial<EngagementCall>) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== engagementId) return e
      return {
        ...e,
        calls: (e.calls ?? []).map(c => c.id === callId ? { ...c, ...patch } : c),
        updated_at: new Date().toISOString(),
      }
    }))
    upsertCall({ id: callId, engagement_id: engagementId, ...patch } as never).catch(onWriteError)
  }, [])

  const addComm = useCallback((engagementId: string, comm: CommEntry) => {
    setEngagements(prev => prev.map(e =>
      e.id === engagementId
        ? {
            ...e,
            comms: [...e.comms, comm],
            last_activity_at: comm.date,
            updated_at: new Date().toISOString(),
          }
        : e
    ))
    insertComm({
      engagement_id: engagementId,
      type: comm.type,
      date: comm.date,
      channel: comm.channel ?? null,
      subject: comm.subject ?? null,
      body: comm.body ?? null,
      from_name: comm.from_name ?? null,
      to_name: comm.to_name ?? null,
      contact_id: comm.contact_id ?? null,
      staff_name: comm.staff_name ?? null,
      needs_response: comm.needs_response ?? false,
      response_due_by: comm.response_due_by ?? null,
      next_step: comm.next_step ?? null,
      next_step_due_at: comm.next_step_due_at ?? null,
      next_step_snoozed_until: comm.next_step_snoozed_until ?? null,
      next_step_cleared: comm.next_step_cleared ?? null,
    }).catch(onWriteError)
  }, [])

  const updateComm = useCallback((engagementId: string, commId: string, patch: Partial<CommEntry>) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== engagementId) return e
      return {
        ...e,
        comms: e.comms.map(c => c.id === commId ? { ...c, ...patch } : c),
        updated_at: new Date().toISOString(),
      }
    }))
    updateCommRow(commId, {
      next_step: patch.next_step ?? undefined,
      next_step_due_at: patch.next_step_due_at ?? undefined,
      next_step_snoozed_until: patch.next_step_snoozed_until ?? undefined,
      next_step_cleared: patch.next_step_cleared ?? undefined,
    } as Parameters<typeof updateCommRow>[1]).catch(onWriteError)
  }, [])

  const addBriefingNote = useCallback((engagementId: string, note: BriefingNote) => {
    setEngagements(prev => prev.map(e =>
      e.id === engagementId
        ? { ...e, briefing_notes: [...(e.briefing_notes ?? []), note], updated_at: new Date().toISOString() }
        : e
    ))
    insertBriefingNoteRow({
      engagement_id: engagementId,
      body: note.body,
      resolved: note.resolved ?? false,
      created_at: note.created_at,
    }).catch(onWriteError)
  }, [])

  const resolveBriefingNote = useCallback((engagementId: string, noteId: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== engagementId) return e
      return {
        ...e,
        briefing_notes: (e.briefing_notes ?? []).map(n => n.id === noteId ? { ...n, resolved: true } : n),
        updated_at: new Date().toISOString(),
      }
    }))
    updateBriefingNoteRow(noteId, { resolved: true }).catch(onWriteError)
  }, [])

  const deleteBriefingNote = useCallback((engagementId: string, noteId: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== engagementId) return e
      return {
        ...e,
        briefing_notes: (e.briefing_notes ?? []).filter(n => n.id !== noteId),
        updated_at: new Date().toISOString(),
      }
    }))
    deleteBriefingNoteRow(noteId).catch(onWriteError)
  }, [])

  const setFieldStatus = useCallback((id: string, field: string, status: 'needed' | 'not_needed' | null) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const field_statuses = { ...(e.field_statuses ?? {}) }
      if (status === null) { delete field_statuses[field] } else { field_statuses[field] = status }
      updateEngagementRow(id, { field_statuses }).catch(onWriteError)
      return { ...e, field_statuses, updated_at: new Date().toISOString() }
    }))
  }, [])

  const confirmReviewItem = useCallback((id: string, confirmedBy: string) => {
    setReviewItems(prev => prev.map(r =>
      r.id === id ? { ...r, confirmed_by: confirmedBy, confirmed_at: new Date().toISOString() } : r
    ))
  }, [])

  const dismissReviewItem = useCallback((id: string) => {
    setReviewItems(prev => prev.filter(r => r.id !== id))
  }, [])

  // Derive each company's linked engagements/contacts fresh from the current
  // engagements list, rather than trusting stored engagement_ids/contact_ids
  // (which the DB layer never populates and would otherwise always read as
  // empty, silently breaking every company-engagement association in the UI).
  const companiesWithLinks = useMemo(() => {
    return companies.map(c => {
      const linkedEngagements = engagements.filter(e => e.company_id === c.id)
      const contactIds = new Set<string>()
      for (const e of linkedEngagements) {
        for (const contact of e.contacts) {
          if (contact.company_id === c.id) contactIds.add(contact.id)
        }
      }
      return {
        ...c,
        engagement_ids: linkedEngagements.map(e => e.id),
        contact_ids: Array.from(contactIds),
      }
    })
  }, [companies, engagements])

  return (
    <StoreContext.Provider value={{
      engagements, reviewItems, companies: companiesWithLinks, loading, error, saveStatus, saveError,
      updateEngagement, setProspectStep,
      confirmProspect, declineProspect, moveToWrapUp, moveEngagementBack, confirmBookingReview, confirmWrapUpReview,
      addProspect,
      archiveEngagement, unarchiveEngagement, deleteEngagement,
      toggleEngagementFlag, toggleMediaFlag,
      setPostEventFlagNeeded, setPostEventFlagDone, setPostEventFlagNotNeeded, resetPostEventFlag,
      updatePostEventFollowUpDetails, updatePostEventFollowUpDate, updatePostEventTestimonialLink, updatePostEventTestimonialText, updatePostEventNotes, updatePostEventStage,
      updatePostEventItemNote, addPostEventMedia, removePostEventMedia, updatePostEventMediaDescription,
      addProposedDate, removeProposedDate, confirmProposedDate, addProposedTime, removeProposedTime,
      addCall, updateCall, addComm, updateComm,
      addBriefingNote, resolveBriefingNote, deleteBriefingNote,
      setFieldStatus,
      confirmReviewItem, dismissReviewItem,
      updateCompany, createCompany, deleteCompany, updateContact, deleteContact,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// Convenience selectors
export function useEngagement(id: string): Engagement | undefined {
  const { engagements } = useStore()
  return engagements.find(e => e.id === id)
}