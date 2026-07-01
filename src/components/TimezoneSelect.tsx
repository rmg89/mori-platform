'use client'
import { TIMEZONE_OPTIONS } from '@/lib/timezone'

interface TimezoneSelectProps {
  value: string
  onChange: (tzId: string) => void
  className?: string
}

export default function TimezoneSelect({ value, onChange, className = '' }: TimezoneSelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-sm border border-ink-100 rounded-lg px-2 py-1.5 outline-none focus:border-gold bg-white text-ink appearance-none cursor-pointer ${className}`}
    >
      {TIMEZONE_OPTIONS.map(tz => (
        <option key={tz.id} value={tz.id}>{tz.short} — {tz.label}</option>
      ))}
    </select>
  )
}
