import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, formatDistanceToNow, isPast, startOfDay } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | undefined, fmt = 'MMM d, yyyy') {
  if (!dateStr) return '—'
  try { return format(parseISO(dateStr), fmt) } catch { return dateStr }
}

export function formatCurrency(amount: number | undefined) {
  if (!amount) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

export function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

export function formatRelativeDue(dateStr: string) {
  try {
    const date = parseISO(dateStr)
    const distance = formatDistanceToNow(date, { addSuffix: true })
    return isPast(date) && distance.endsWith('ago') ? `overdue · ${distance}` : distance
  } catch { return dateStr }
}

// An engagement counts as "current" when it has an event date today or in the future.
export function isEngagementCurrent(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  try { return startOfDay(parseISO(dateStr)).getTime() >= startOfDay(new Date()).getTime() } catch { return false }
}

export function relativeTime(dateStr: string) {
  const date = parseISO(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr, 'MMM d')
}
