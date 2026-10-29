// src/lib/utils/phone-formatter.ts
// Format phone numbers as (xxx) xxx-xxxx

/**
 * Formats a phone number string to (xxx) xxx-xxxx format
 * Handles various input formats and returns formatted string or original if invalid
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return 'Not provided'

  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '')

  // Handle 10-digit numbers (standard North American)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Handle 11-digit numbers (with country code 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  // Return original if can't parse (international numbers, etc.)
  return phone
}

/**
 * Formats a phone number for input fields (as user types)
 * Returns the formatted value and cursor position
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-numeric characters
  const digits = value.replace(/\D/g, '')

  // Limit to 10 digits
  const limitedDigits = digits.slice(0, 10)

  // Format progressively as user types
  if (limitedDigits.length === 0) return ''
  if (limitedDigits.length <= 3) return `(${limitedDigits}`
  if (limitedDigits.length <= 6) return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`
  return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`
}

/**
 * Extracts raw digits from a formatted phone number
 */
export function unformatPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}
