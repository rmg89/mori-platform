'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Engagement, EngagementCall, CommEntry, PostEventFlag, EngagementFlag, MediaFlag, ProspectStep } from '@/types'
import { MOCK_ENGAGEMENTS, MOCK_REVIEW_ITEMS, MOCK_COMPANIES, MOCK_USERS } from '@/lib/mock-data'
import type { ReviewItem, Company } from '@/types'

// ─── Store shape ──────────────────────────────────────────────────────────────

interface StoreState {
  engagements: Engagement[]
  reviewItems: ReviewItem[]
  companies: Company[]
}

interface StoreActions {
  // Engagement field updates
  updateEngagement: (id: string, patch: Partial<Engagement>) => void

  // Prospect step
  setProspectStep: (id: string, step: ProspectStep) => void

  // Engagement flags
  toggleEngagementFlag: (id: string, flag: EngagementFlag) => void
  toggleMediaFlag: (id: string, flag: MediaFlag) => void
  togglePostEventFlag: (id: string, flag: PostEventFlag) => void

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
}

type Store = StoreState & StoreActions

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [engagements, setEngagements] = useState<Engagement[]>(() =>
    JSON.parse(JSON.stringify(MOCK_ENGAGEMENTS)) // deep clone so mock data stays clean
  )
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(() =>
    JSON.parse(JSON.stringify(MOCK_REVIEW_ITEMS))
  )
  const [companies] = useState<Company[]>(() =>
    JSON.parse(JSON.stringify(MOCK_COMPANIES))
  )

  const updateEngagement = useCallback((id: string, patch: Partial<Engagement>) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e
    ))
  }, [])

  const setProspectStep = useCallback((id: string, step: ProspectStep) => {
    setEngagements(prev => prev.map(e =>
      e.id === id ? { ...e, prospect_step: step, updated_at: new Date().toISOString() } : e
    ))
  }, [])

  const toggleEngagementFlag = useCallback((id: string, flag: EngagementFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const flags = e.engagement_flags.includes(flag)
        ? e.engagement_flags.filter(f => f !== flag)
        : [...e.engagement_flags, flag]
      return { ...e, engagement_flags: flags, updated_at: new Date().toISOString() }
    }))
  }, [])

  const toggleMediaFlag = useCallback((id: string, flag: MediaFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const flags = (e.media_flags ?? [])
      const next = flags.includes(flag) ? flags.filter(f => f !== flag) : [...flags, flag]
      return { ...e, media_flags: next, updated_at: new Date().toISOString() }
    }))
  }, [])

  const togglePostEventFlag = useCallback((id: string, flag: PostEventFlag) => {
    setEngagements(prev => prev.map(e => {
      if (e.id !== id) return e
      const flags = e.post_event_flags.includes(flag)
        ? e.post_event_flags.filter(f => f !== flag)
        : [...e.post_event_flags, flag]
      return { ...e, post_event_flags: flags, updated_at: new Date().toISOString() }
    }))
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
  }, [])

  const addCall = useCallback((engagementId: string, call: EngagementCall) => {
    setEngagements(prev => prev.map(e =>
      e.id === engagementId
        ? { ...e, calls: [...(e.calls ?? []), call], updated_at: new Date().toISOString() }
        : e
    ))
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
      engagements, reviewItems, companies,
      updateEngagement, setProspectStep,
      toggleEngagementFlag, toggleMediaFlag, togglePostEventFlag,
      addProposedDate, removeProposedDate, confirmProposedDate, addProposedTime, removeProposedTime,
      addCall, updateCall, addComm,
      confirmReviewItem, dismissReviewItem,
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