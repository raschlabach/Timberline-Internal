import { format } from 'date-fns'

/**
 * Safely parse a date value from Postgres (could be ISO string, YYYY-MM-DD, or Date object)
 * and format it. Always treats date-only values as local calendar dates to avoid timezone shift.
 */
export function safeFormatDate(value: string | null | undefined, fmt: string): string {
  if (!value) return ''
  try {
    const raw = String(value)
    const dateOnly = raw.substring(0, 10)
    const d = new Date(dateOnly + 'T12:00:00')
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
    const dateOnly = raw.substring(0, 10)
    const d = new Date(dateOnly + 'T12:00:00')
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}
