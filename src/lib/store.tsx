'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { Engagement, EngagementContact, EngagementCall, CommEntry, PostEventFlag, EngagementFlag, MediaFlag, ProspectStep, WrapUpFlagStages, PostEventMediaItem, PostEventMediaType } from '@/types'
import { fetchAllEngagements, fetchCompanies, updateEngagementRow, deleteEngagementRow, updateCompanyRow, upsertCall, insertComm, upsertContact, insertContact } from '@/lib/db'
import type { ReviewItem, Company } from '@/types'

// ─── Store shape ──────────────────────────────────────────────────────────────

interface StoreState {
  engagements: Engagement[]
  reviewItems: ReviewItem[]
  companies: Company[]
  loading: boolean
  error: string | null
}

interface StoreActions {
  // Engagement field updates
  updateEngagement: (id: string, patch: Partial<Engagement>) => void

  // Prospect step
  setProspectStep: (id: string, step: ProspectStep) => void

  // Pipeline transitions (confirmed/declined → review sections)
  confirmProspect: (id: string) => void
  declineProspect: (id: string) => void
  confirmBookingReview: (id: string) => void
  confirmWrapUpReview: (id: string) => void

  // Archive / delete
  archiveEngagement: (id: string) => void
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

  // Review
  confirmReviewItem: (id: string, confirmedBy: string) => void
  dismissReviewItem: (id: string) => void

  // Companies
  updateCompany: (id: string, patch: Partial<Company>) => void

  // Contacts (global — updates all engagements sharing the same email)
  updateContact: (email: string, patch: Partial<EngagementContact>) => void
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

  // ── Load from Supabase on mount ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchAllEngagements(), fetchCompanies()])
      .then(([engData, coData]) => {
        setEngagements(engData)
        setCompanies(coData)
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
    if (Object.keys(dbPatch).length > 0) updateCompanyRow(id, dbPatch as Record<string, unknown>).catch(console.error)
  }, [])

  const updateContact = useCallback((email: string, patch: Partial<EngagementContact>) => {
    setEngagements((prev: Engagement[]) => {
      prev.forEach((e: Engagement) => {
        e.contacts.forEach((c: EngagementContact) => {
          if (c.email.toLowerCase() === email.toLowerCase()) {
            upsertContact({ id: c.id, engagement_id: e.id, ...patch } as never).catch(console.error)
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

  const updateEngagement = useCallback((id: string, patch: Partial<Engagement>) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e
    ))
    // Write to Supabase — strip relational arrays (own tables) but keep JSONB material columns
    const { contacts, comms, calls, briefing_notes, alerts, engagement_flags, media_flags, post_event_flags, post_event_needed, post_event_not_needed, ...scalarPatch } = patch as Engagement
    if (Object.keys(scalarPatch).length > 0) {
      updateEngagementRow(id, scalarPatch as Record<string, unknown>).catch(console.error)
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
          }).catch(console.error)
        }
      })
    }
  }, [])

  const setProspectStep = useCallback((id: string, step: ProspectStep) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, prospect_step: step, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { prospect_step: step }).catch(console.error)
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
      .catch(console.error)
  }, [])

  const confirmProspect = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, section: 'engagements', prospect_step: undefined, booking_review_needed: true, confirmed_at: now, updated_at: now } : e
    ))
    updateEngagementRow(id, { section: 'engagements', prospect_step: null, booking_review_needed: true, confirmed_at: now }).catch(console.error)
    runScan(id, 'booking')
  }, [runScan])

  const declineProspect = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, section: 'wrap-up', prospect_step: 'declined', wrap_up_review_needed: true, declined_at: now, updated_at: now } : e
    ))
    updateEngagementRow(id, { section: 'wrap-up', prospect_step: 'declined', wrap_up_review_needed: true, declined_at: now }).catch(console.error)
    runScan(id, 'declined')
  }, [runScan])

  const confirmBookingReview = useCallback((id: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, booking_review_needed: false, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { booking_review_needed: false }).catch(console.error)
  }, [])

  const confirmWrapUpReview = useCallback((id: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, wrap_up_review_needed: false, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { wrap_up_review_needed: false }).catch(console.error)
  }, [])

  const archiveEngagement = useCallback((id: string) => {
    const now = new Date().toISOString()
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, archived: true, archived_at: now, updated_at: now } : e
    ))
    updateEngagementRow(id, { archived: true, archived_at: now }).catch(console.error)
  }, [])

  const deleteEngagement = useCallback((id: string) => {
    setEngagements(prev => prev.filter(e => e.id !== id))
    deleteEngagementRow(id).catch(console.error)
  }, [])

  const toggleEngagementFlag = useCallback((id: string, flag: EngagementFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const isOn = e.engagement_flags.includes(flag)
      const flags = isOn
        ? e.engagement_flags.filter(f => f !== flag)
        : [...e.engagement_flags, flag]
      updateEngagementRow(id, isOn ? flagOffColumn(flag) : flagToColumn(flag)).catch(console.error)
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
      updateEngagementRow(id, { [colMap[flag]]: !flags.includes(flag) }).catch(console.error)
      return { ...e, media_flags: next, updated_at: new Date().toISOString() }
    }))
  }, [])

  const setPostEventFlagNeeded = useCallback((id: string, flag: PostEventFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_needed = [...(e.post_event_needed ?? []).filter(f => f !== flag), flag]
      const post_event_not_needed = (e.post_event_not_needed ?? []).filter(f => f !== flag)
      updateEngagementRow(id, { post_event_needed, post_event_not_needed }).catch(console.error)
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
      updateEngagementRow(id, dbPatch).catch(console.error)
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
      updateEngagementRow(id, { post_event_needed, post_event_not_needed }).catch(console.error)
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
      updateEngagementRow(id, { post_event_needed, post_event_not_needed }).catch(console.error)
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
    updateEngagementRow(id, { follow_up_details: details }).catch(console.error)
  }, [])

  const updatePostEventFollowUpDate = useCallback((id: string, date: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_follow_up_date: date || undefined, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { post_event_follow_up_date: date || null }).catch(console.error)
  }, [])

  const updatePostEventTestimonialLink = useCallback((id: string, link: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_testimonial_link: link, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { post_event_testimonial_link: link }).catch(console.error)
  }, [])

  const updatePostEventTestimonialText = useCallback((id: string, text: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_testimonial_text: text, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { post_event_testimonial_text: text }).catch(console.error)
  }, [])

  const updatePostEventItemNote = useCallback((id: string, flag: PostEventFlag, note: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_item_notes = { ...(e.post_event_item_notes ?? {}), [flag]: note }
      updateEngagementRow(id, { post_event_item_notes }).catch(console.error)
      return { ...e, post_event_item_notes, updated_at: new Date().toISOString() }
    }))
  }, [])

  const addPostEventMedia = useCallback((id: string, file: { type: PostEventMediaType; name: string; url: string; description?: string }) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const item: PostEventMediaItem = { id: `media_${Date.now()}`, type: file.type, name: file.name, url: file.url, description: file.description, uploaded_at: new Date().toISOString() }
      const post_event_media = [...(e.post_event_media ?? []), item]
      updateEngagementRow(id, { post_event_media }).catch(console.error)
      return { ...e, post_event_media, updated_at: new Date().toISOString() }
    }))
  }, [])

  const removePostEventMedia = useCallback((id: string, mediaId: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_media = (e.post_event_media ?? []).filter(m => m.id !== mediaId)
      updateEngagementRow(id, { post_event_media }).catch(console.error)
      return { ...e, post_event_media, updated_at: new Date().toISOString() }
    }))
  }, [])

  const updatePostEventMediaDescription = useCallback((id: string, mediaId: string, description: string) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const post_event_media = (e.post_event_media ?? []).map(m => m.id === mediaId ? { ...m, description } : m)
      updateEngagementRow(id, { post_event_media }).catch(console.error)
      return { ...e, post_event_media, updated_at: new Date().toISOString() }
    }))
  }, [])

  const updatePostEventNotes = useCallback((id: string, notes: string) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, post_event_notes: notes, updated_at: new Date().toISOString() } : e
    ))
    updateEngagementRow(id, { notes }).catch(console.error)
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
    updateEngagementRow(id, { event_date: date, event_time: time ?? null }).catch(console.error)
  }, [])

  const addCall = useCallback((engagementId: string, call: EngagementCall) => {
    setEngagements(prev => prev.map(e =>
      e.id === engagementId
        ? { ...e, calls: [...(e.calls ?? []), call], updated_at: new Date().toISOString() }
        : e
    ))
    upsertCall({ ...call, engagement_id: engagementId }).catch(console.error)
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
    upsertCall({ id: callId, engagement_id: engagementId, ...patch } as never).catch(console.error)
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
    }).catch(console.error)
  }, [])

  const confirmReviewItem = useCallback((id: string, confirmedBy: string) => {
    setReviewItems(prev => prev.map(r =>
      r.id === id ? { ...r, confirmed_by: confirmedBy, confirmed_at: new Date().toISOString() } : r
    ))
  }, [])

  const dismissReviewItem = useCallback((id: string) => {
    setReviewItems(prev => prev.filter(r => r.id !== id))
  }, [])

  return (
    <StoreContext.Provider value={{
      engagements, reviewItems, companies, loading, error,
      updateEngagement, setProspectStep,
      confirmProspect, declineProspect, confirmBookingReview, confirmWrapUpReview,
      archiveEngagement, deleteEngagement,
      toggleEngagementFlag, toggleMediaFlag,
      setPostEventFlagNeeded, setPostEventFlagDone, setPostEventFlagNotNeeded, resetPostEventFlag,
      updatePostEventFollowUpDetails, updatePostEventFollowUpDate, updatePostEventTestimonialLink, updatePostEventTestimonialText, updatePostEventNotes, updatePostEventStage,
      updatePostEventItemNote, addPostEventMedia, removePostEventMedia, updatePostEventMediaDescription,
      addProposedDate, removeProposedDate, confirmProposedDate, addProposedTime, removeProposedTime,
      addCall, updateCall, addComm,
      confirmReviewItem, dismissReviewItem,
      updateCompany, updateContact,
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