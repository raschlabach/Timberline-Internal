import { format } from 'date-fns'

/**
 * Safely parse a date value from Postgres (could be ISO string, YYYY-MM-DD, or Date object)
 * and format it. Returns empty string if the date is invalid.
 */
export function safeFormatDate(value: string | null | undefined, fmt: string): string {
  if (!value) return ''
  try {
    const raw = String(value)
    const d = raw.length === 10 ? new Date(raw + 'T00:00:00') : new Date(raw)
    if (isNaN(d.getTime())) return ''
    return format(d, fmt)
  } catch {
    return ''
  }
}

export function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null
  try {
    const raw = String(value)
    const d = raw.length === 10 ? new Date(raw + 'T00:00:00') : new Date(raw)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}
