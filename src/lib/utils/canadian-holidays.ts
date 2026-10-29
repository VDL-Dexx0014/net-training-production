// src/lib/utils/canadian-holidays.ts
// Utility for calculating and identifying Canadian holidays

export interface Holiday {
  name: string
  date: Date
  isFederal: boolean
  provinces?: string[] // If not federal, which provinces observe it
}

/**
 * Calculate Easter Sunday for a given year (using Computus algorithm)
 */
function calculateEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/**
 * Get nth weekday of a month (e.g., first Monday, third Thursday)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  let dayOfMonth = 1 + ((weekday - firstWeekday + 7) % 7)
  dayOfMonth += (n - 1) * 7
  return new Date(year, month, dayOfMonth)
}

/**
 * Get last weekday before a specific date
 */
function getWeekdayBefore(year: number, month: number, day: number, weekday: number): Date {
  const targetDate = new Date(year, month, day)
  let checkDate = new Date(targetDate)
  checkDate.setDate(checkDate.getDate() - 1)

  while (checkDate.getDay() !== weekday) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return checkDate
}

/**
 * Get all Canadian holidays for a given year
 */
export function getCanadianHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = []

  // New Year's Day - January 1
  holidays.push({
    name: "New Year's Day",
    date: new Date(year, 0, 1),
    isFederal: true
  })

  // Family Day (3rd Monday in February) - Most provinces
  holidays.push({
    name: "Family Day",
    date: getNthWeekdayOfMonth(year, 1, 1, 3),
    isFederal: false,
    provinces: ['AB', 'BC', 'NB', 'ON', 'SK']
  })

  // Louis Riel Day (3rd Monday in February) - Manitoba
  holidays.push({
    name: "Louis Riel Day",
    date: getNthWeekdayOfMonth(year, 1, 1, 3),
    isFederal: false,
    provinces: ['MB']
  })

  // Islander Day (3rd Monday in February) - PEI
  holidays.push({
    name: "Islander Day",
    date: getNthWeekdayOfMonth(year, 1, 1, 3),
    isFederal: false,
    provinces: ['PE']
  })

  // St. Patrick's Day (nearest Monday to March 17) - Newfoundland
  const stPatricksDay = new Date(year, 2, 17)
  const stPatricksDayOfWeek = stPatricksDay.getDay()
  let stPatricksObserved = new Date(stPatricksDay)

  if (stPatricksDayOfWeek === 0) {
    stPatricksObserved.setDate(stPatricksObserved.getDate() + 1)
  } else if (stPatricksDayOfWeek === 6) {
    stPatricksObserved.setDate(stPatricksObserved.getDate() + 2)
  }

  holidays.push({
    name: "St. Patrick's Day",
    date: stPatricksObserved,
    isFederal: false,
    provinces: ['NL']
  })

  // Easter-based holidays
  const easter = calculateEaster(year)

  // Good Friday (Friday before Easter)
  const goodFriday = new Date(easter)
  goodFriday.setDate(goodFriday.getDate() - 2)
  holidays.push({
    name: "Good Friday",
    date: goodFriday,
    isFederal: true
  })

  // Easter Monday
  const easterMonday = new Date(easter)
  easterMonday.setDate(easterMonday.getDate() + 1)
  holidays.push({
    name: "Easter Monday",
    date: easterMonday,
    isFederal: false,
    provinces: ['QC']
  })

  // Victoria Day (Monday before May 25)
  holidays.push({
    name: "Victoria Day",
    date: getWeekdayBefore(year, 4, 25, 1),
    isFederal: true
  })

  // National Indigenous Peoples Day - June 21 (NWT, YT)
  holidays.push({
    name: "National Indigenous Peoples Day",
    date: new Date(year, 5, 21),
    isFederal: false,
    provinces: ['NT', 'YT']
  })

  // St. Jean Baptiste Day - June 24 (Quebec)
  holidays.push({
    name: "St. Jean Baptiste Day",
    date: new Date(year, 5, 24),
    isFederal: false,
    provinces: ['QC']
  })

  // Canada Day - July 1
  holidays.push({
    name: "Canada Day",
    date: new Date(year, 6, 1),
    isFederal: true
  })

  // Civic Holiday (1st Monday in August) - Most provinces
  holidays.push({
    name: "Civic Holiday",
    date: getNthWeekdayOfMonth(year, 7, 1, 1),
    isFederal: false,
    provinces: ['AB', 'BC', 'MB', 'NB', 'NT', 'NU', 'ON', 'SK']
  })

  // Labour Day (1st Monday in September)
  holidays.push({
    name: "Labour Day",
    date: getNthWeekdayOfMonth(year, 8, 1, 1),
    isFederal: true
  })

  // National Day for Truth and Reconciliation - September 30
  holidays.push({
    name: "National Day for Truth and Reconciliation",
    date: new Date(year, 8, 30),
    isFederal: true
  })

  // Thanksgiving (2nd Monday in October)
  holidays.push({
    name: "Thanksgiving",
    date: getNthWeekdayOfMonth(year, 9, 1, 2),
    isFederal: true
  })

  // Remembrance Day - November 11
  holidays.push({
    name: "Remembrance Day",
    date: new Date(year, 10, 11),
    isFederal: true
  })

  // Christmas Day - December 25
  holidays.push({
    name: "Christmas Day",
    date: new Date(year, 11, 25),
    isFederal: true
  })

  // Boxing Day - December 26
  holidays.push({
    name: "Boxing Day",
    date: new Date(year, 11, 26),
    isFederal: true
  })

  return holidays
}

/**
 * Check if a given date is a Canadian holiday
 */
export function getHolidayForDate(date: Date, province?: string): Holiday | null {
  const year = date.getFullYear()
  const holidays = getCanadianHolidays(year)

  const dateString = date.toISOString().split('T')[0]

  for (const holiday of holidays) {
    const holidayString = holiday.date.toISOString().split('T')[0]

    if (holidayString === dateString) {
      // If it's a federal holiday, return it
      if (holiday.isFederal) {
        return holiday
      }

      // If province is specified and this holiday applies to that province
      if (province && holiday.provinces?.includes(province)) {
        return holiday
      }

      // If no province specified, return non-federal holidays too
      if (!province) {
        return holiday
      }
    }
  }

  return null
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Get a display-friendly label for a date (weekend or holiday)
 */
export function getDateLabel(date: Date, province?: string): {
  isWeekend: boolean
  holiday: Holiday | null
  label: string | null
} {
  const weekend = isWeekend(date)
  const holiday = getHolidayForDate(date, province)

  let label = null
  if (holiday) {
    label = holiday.name
  } else if (weekend) {
    label = date.getDay() === 0 ? 'Sunday' : 'Saturday'
  }

  return {
    isWeekend: weekend,
    holiday,
    label
  }
}
