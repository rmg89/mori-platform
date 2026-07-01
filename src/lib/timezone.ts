export interface TimezoneOption {
  id: string         // IANA timezone id
  label: string      // Display label in dropdown
  short: string      // Short abbreviation shown in time strings
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: 'America/New_York',    label: 'Eastern (ET)',      short: 'ET'  },
  { id: 'America/Chicago',     label: 'Central (CT)',      short: 'CT'  },
  { id: 'America/Denver',      label: 'Mountain (MT)',     short: 'MT'  },
  { id: 'America/Los_Angeles', label: 'Pacific (PT)',      short: 'PT'  },
  { id: 'America/Anchorage',   label: 'Alaska (AKT)',      short: 'AKT' },
  { id: 'Pacific/Honolulu',    label: 'Hawaii (HT)',       short: 'HT'  },
  { id: 'UTC',                 label: 'UTC / GMT',         short: 'UTC' },
  { id: 'Europe/London',       label: 'London (GMT/BST)',  short: 'GMT' },
  { id: 'Europe/Paris',        label: 'Central Europe (CET)', short: 'CET' },
  { id: 'Asia/Dubai',          label: 'Dubai (GST)',       short: 'GST' },
  { id: 'Asia/Kolkata',        label: 'India (IST)',       short: 'IST' },
  { id: 'Asia/Singapore',      label: 'Singapore (SGT)',   short: 'SGT' },
  { id: 'Asia/Tokyo',          label: 'Tokyo (JST)',       short: 'JST' },
  { id: 'Australia/Sydney',    label: 'Sydney (AET)',      short: 'AET' },
]

const ET = 'America/New_York'
const PT = 'America/Los_Angeles'

function formatInTz(date: Date, tzId: string, short: string): string {
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: tzId,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
  return `${time} ${short}`
}

/**
 * Given a UTC ISO string and the timezone the user entered it in,
 * returns a display string like:
 *   "3:00 PM ET / 12:00 PM PT"                (when entered in ET or PT)
 *   "3:00 PM ET / 12:00 PM PT (9:00 PM CET)"  (when entered in another tz)
 */
export function formatDualTimezone(isoString: string, enteredTzId?: string): string {
  const date = new Date(isoString)
  const et = formatInTz(date, ET, 'ET')
  const pt = formatInTz(date, PT, 'PT')
  let result = `${et} / ${pt}`

  if (enteredTzId && enteredTzId !== ET && enteredTzId !== PT) {
    const opt = TIMEZONE_OPTIONS.find(t => t.id === enteredTzId)
    const short = opt?.short ?? enteredTzId
    result += ` (${formatInTz(date, enteredTzId, short)})`
  }

  return result
}

/**
 * Full call datetime display: "Jan 5 · 3:00 PM ET / 12:00 PM PT"
 */
export function formatCallDateTime(isoString: string, enteredTzId?: string): string {
  const date = new Date(isoString)
  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
  }).format(date)
  return `${datePart} · ${formatDualTimezone(isoString, enteredTzId)}`
}

/**
 * Convert a date + time entered in a specific timezone to a UTC ISO string.
 * e.g. localInputToISO("2026-01-05", "15:00", "America/New_York") → "2026-01-05T20:00:00.000Z"
 */
export function localInputToISO(dateStr: string, timeStr: string, tzId: string): string {
  const paddedTime = timeStr || '00:00'
  // Treat input as UTC first to get an epoch
  const naiveUTC = new Date(`${dateStr}T${paddedTime}:00Z`)

  // Find what that UTC time looks like in the target timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tzId,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(naiveUTC)

  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value)
  const tzDisplayMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))

  // offset = tzDisplayMs - naiveUTC (how many ms ahead the tz is vs UTC)
  const offsetMs = tzDisplayMs - naiveUTC.getTime()

  // Actual UTC = naiveUTC - offsetMs
  return new Date(naiveUTC.getTime() - offsetMs).toISOString()
}

/** Returns the IANA id of the browser's local timezone, defaulting to ET. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return ET
  }
}

/** Returns the TIMEZONE_OPTIONS entry for a given IANA id, or undefined. */
export function findTimezone(tzId: string): TimezoneOption | undefined {
  return TIMEZONE_OPTIONS.find(t => t.id === tzId)
}
