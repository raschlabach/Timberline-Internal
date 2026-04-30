// Small date helpers used by the payroll page. Kept separate so the page
// component does not have to define them inline (one of the brittleness
// patterns in the legacy code).

export interface PayWeek {
  start: Date
  end: Date
}

export function getThisWeek(today: Date = new Date()): PayWeek {
  const dayOfWeek = today.getDay()
  const start = new Date(today)
  start.setDate(today.getDate() - dayOfWeek)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

export function getLastWeek(today: Date = new Date()): PayWeek {
  const thisWeek = getThisWeek(today)
  const start = new Date(thisWeek.start)
  start.setDate(start.getDate() - 7)
  const end = new Date(thisWeek.end)
  end.setDate(end.getDate() - 7)
  return { start, end }
}

// YYYY-MM-DD -> local Date (avoids timezone drift)
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
