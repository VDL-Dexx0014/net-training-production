// src/lib/utils/date-formatter.ts
// Centralised date formatting — always renders as yyyy-mm-dd

/**
 * Format a date string or Date object as yyyy-mm-dd.
 * Returns 'Never' for null/undefined/invalid input.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return 'Never'
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return 'Never'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
