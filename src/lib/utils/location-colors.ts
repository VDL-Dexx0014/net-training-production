// src/lib/utils/location-colors.ts
// Utility for consistent location color coding across the app

/**
 * Get a consistent color for a location based on its name
 * Returns Tailwind CSS classes for background and text colors
 */
export function getLocationColor(locationName: string | null | undefined): {
  bg: string
  text: string
  border: string
} {
  if (!locationName) {
    return {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200'
    }
  }

  const name = locationName.toLowerCase()

  // Specific location mappings
  if (name.includes('bloor') || name.includes('bloor west')) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-200'
    }
  }

  if (name.includes('annex')) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-200'
    }
  }

  if (name.includes('downtown')) {
    return {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-200'
    }
  }

  // Additional locations with distinct colors
  if (name.includes('north') || name.includes('yorkville')) {
    return {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200'
    }
  }

  if (name.includes('east') || name.includes('beaches')) {
    return {
      bg: 'bg-cyan-100',
      text: 'text-cyan-700',
      border: 'border-cyan-200'
    }
  }

  if (name.includes('west') && !name.includes('bloor')) {
    return {
      bg: 'bg-pink-100',
      text: 'text-pink-700',
      border: 'border-pink-200'
    }
  }

  // Default fallback for other locations
  return {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-200'
  }
}

/**
 * Get inline styles for location color (for cases where Tailwind classes can't be used)
 */
export function getLocationColorStyles(locationName: string | null | undefined): {
  backgroundColor: string
  color: string
  borderColor: string
} {
  if (!locationName) {
    return {
      backgroundColor: '#f1f5f9', // slate-100
      color: '#334155', // slate-700
      borderColor: '#e2e8f0' // slate-200
    }
  }

  const name = locationName.toLowerCase()

  if (name.includes('bloor') || name.includes('bloor west')) {
    return {
      backgroundColor: '#fef9c3', // yellow-100
      color: '#a16207', // yellow-700
      borderColor: '#fef08a' // yellow-200
    }
  }

  if (name.includes('annex')) {
    return {
      backgroundColor: '#dcfce7', // green-100
      color: '#15803d', // green-700
      borderColor: '#bbf7d0' // green-200
    }
  }

  if (name.includes('downtown')) {
    return {
      backgroundColor: '#ffedd5', // orange-100
      color: '#c2410c', // orange-700
      borderColor: '#fed7aa' // orange-200
    }
  }

  if (name.includes('north') || name.includes('yorkville')) {
    return {
      backgroundColor: '#f3e8ff', // purple-100
      color: '#7e22ce', // purple-700
      borderColor: '#e9d5ff' // purple-200
    }
  }

  if (name.includes('east') || name.includes('beaches')) {
    return {
      backgroundColor: '#cffafe', // cyan-100
      color: '#0e7490', // cyan-700
      borderColor: '#a5f3fc' // cyan-200
    }
  }

  if (name.includes('west') && !name.includes('bloor')) {
    return {
      backgroundColor: '#fce7f3', // pink-100
      color: '#be185d', // pink-700
      borderColor: '#fbcfe8' // pink-200
    }
  }

  return {
    backgroundColor: '#dbeafe', // blue-100
    color: '#1d4ed8', // blue-700
    borderColor: '#bfdbfe' // blue-200
  }
}
