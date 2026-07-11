import type { Engagement, ProspectStep, Section } from '@/types'

export type BackwardTarget = {
  section: Section
  prospect_step: ProspectStep | null
  label: string
}

// Where a record should land if moved back one pipeline stage, or null if it's
// already at the earliest stage (prospects) and there's nowhere to go.
export function getBackwardTransition(
  e: Pick<Engagement, 'section' | 'prospect_step' | 'prospect_snapshot'>
): BackwardTarget | null {
  if (e.section === 'engagements') {
    const step = (e.prospect_snapshot?.prospect_step as ProspectStep | undefined) ?? 'confirmed'
    return { section: 'prospects', prospect_step: step, label: 'Move back to Prospects' }
  }
  if (e.section === 'wrap-up') {
    if (e.prospect_step === 'declined') {
      const step = (e.prospect_snapshot?.prospect_step as ProspectStep | undefined) ?? 'in_contact'
      return { section: 'prospects', prospect_step: step, label: 'Move back to Prospects' }
    }
    return { section: 'engagements', prospect_step: null, label: 'Move back to Engagements' }
  }
  return null
}
