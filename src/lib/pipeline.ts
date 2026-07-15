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
    // Fall back to 'in_contact', not 'confirmed' — the Prospects list only shows
    // active steps (inquiry/outreach/in_contact), so 'confirmed' silently vanishes
    // from every list. Missing prospect_snapshot happens for engagements confirmed
    // via the move_to_confirmed MCP tool, which doesn't write one.
    const step = (e.prospect_snapshot?.prospect_step as ProspectStep | undefined) ?? 'in_contact'
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
