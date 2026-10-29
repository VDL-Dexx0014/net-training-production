// src/lib/utils/name-formatter.ts
// Utility functions for formatting user names based on role

/**
 * Format a user's name based on the viewer's role
 * - Management sees full names: "John Smith"
 * - Clients and Trainers see first name + last initial: "John S"
 *
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @param viewerRole - Role of the person viewing the name
 * @returns Formatted name string
 */
export function formatName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  viewerRole: string | string[] | null | undefined
): string {
  if (!firstName) return 'User'

  // Check if viewer is management (handles both string and array)
  const isManagement = Array.isArray(viewerRole)
    ? viewerRole.includes('management')
    : viewerRole === 'management'

  if (isManagement) {
    // Management sees full name
    return `${firstName}${lastName ? ' ' + lastName : ''}`
  }

  // Clients and trainers see first name + last initial (no period)
  const lastInitial = lastName ? ` ${lastName.charAt(0).toUpperCase()}` : ''
  return `${firstName}${lastInitial}`
}

/**
 * Get a greeting with the user's formatted name
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @param viewerRole - Role of the person viewing
 * @returns Greeting string like "Welcome, John S!" or "Welcome, John Smith!"
 */
export function getGreeting(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  viewerRole: string | string[] | null | undefined
): string {
  const name = formatName(firstName, lastName, viewerRole)
  return `Welcome, ${name}!`
}
