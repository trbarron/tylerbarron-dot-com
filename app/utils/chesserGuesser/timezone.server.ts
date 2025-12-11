// Timezone utilities for consistent daily resets
// Server-side only (uses Node.js Intl API)

/**
 * Configuration for ChesserGuesser timezone handling
 */
export const TIMEZONE_CONFIG = {
  // Default timezone for daily resets
  // Options: 'UTC', 'America/New_York', 'America/Los_Angeles', etc.
  default: (process.env.CHESSER_GUESSER_TIMEZONE || 'UTC') as string,

  // Enable timezone in response headers for client coordination
  includeInHeaders: true,
};

/**
 * Get current date string in specified timezone
 *
 * @param timezone - IANA timezone identifier (e.g., 'UTC', 'America/New_York')
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * getTodayDateString('UTC') // '2024-01-15'
 * getTodayDateString('America/New_York') // '2024-01-15'
 */
export function getTodayDateString(timezone: string = TIMEZONE_CONFIG.default): string {
  const now = new Date();

  // Use Intl.DateTimeFormat for accurate timezone conversion
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // en-CA locale returns YYYY-MM-DD format
  return formatter.format(now);
}

/**
 * Get date string for a specific Date object in specified timezone
 *
 * @param date - Date object to convert
 * @param timezone - IANA timezone identifier
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateString(date: Date, timezone: string = TIMEZONE_CONFIG.default): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

/**
 * Calculate milliseconds until next midnight in specified timezone
 * Useful for cache invalidation and countdown timers
 *
 * @param timezone - IANA timezone identifier
 * @returns Milliseconds until next midnight
 *
 * @example
 * const msUntilReset = getMillisecondsUntilMidnight('UTC');
 * setTimeout(refreshPuzzles, msUntilReset);
 */
export function getMillisecondsUntilMidnight(timezone: string = TIMEZONE_CONFIG.default): number {
  const now = new Date();

  // Get current date components in target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const tzDate: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      tzDate[part.type] = parseInt(part.value, 10);
    }
  }

  // Create midnight date in UTC
  const midnight = new Date(Date.UTC(
    tzDate.year!,
    (tzDate.month! - 1),
    tzDate.day! + 1, // Next day
    0, 0, 0, 0
  ));

  // Adjust for timezone offset
  const nowInTz = new Date(Date.UTC(
    tzDate.year!,
    (tzDate.month! - 1),
    tzDate.day!,
    tzDate.hour!,
    tzDate.minute!,
    tzDate.second!,
    0
  ));

  const offsetMs = now.getTime() - nowInTz.getTime();
  const nextMidnightMs = midnight.getTime() - offsetMs;

  return Math.max(0, nextMidnightMs - now.getTime());
}

/**
 * Check if a date string is today in specified timezone
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param timezone - IANA timezone identifier
 * @returns True if date is today
 */
export function isToday(dateString: string, timezone: string = TIMEZONE_CONFIG.default): boolean {
  return dateString === getTodayDateString(timezone);
}

/**
 * Check if a date string is valid and not in the future
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param timezone - IANA timezone identifier
 * @returns True if date is valid and not future
 */
export function isValidDate(dateString: string, timezone: string = TIMEZONE_CONFIG.default): boolean {
  // Check format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  // Parse date
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  // Check if date is valid
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }

  // Check if not in the future
  const today = getTodayDateString(timezone);
  return dateString <= today;
}

/**
 * Get date N days ago in specified timezone
 *
 * @param daysAgo - Number of days in the past
 * @param timezone - IANA timezone identifier
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateNDaysAgo(
  daysAgo: number,
  timezone: string = TIMEZONE_CONFIG.default
): string {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return getDateString(past, timezone);
}

/**
 * Generate timezone header for HTTP responses
 * Allows client to know server's reference timezone
 *
 * @returns Object with timezone header
 */
export function getTimezoneHeaders(): Record<string, string> {
  if (!TIMEZONE_CONFIG.includeInHeaders) {
    return {};
  }

  return {
    'X-ChesserGuesser-Timezone': TIMEZONE_CONFIG.default,
    'X-ChesserGuesser-Date': getTodayDateString(),
  };
}

/**
 * Validate and normalize date parameter from query string
 *
 * @param dateParam - Date parameter from URL query
 * @param timezone - IANA timezone identifier
 * @returns Validated date string or today's date
 */
export function normalizeDateParam(
  dateParam: string | null,
  timezone: string = TIMEZONE_CONFIG.default
): string {
  // If no date provided, use today
  if (!dateParam) {
    return getTodayDateString(timezone);
  }

  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return getTodayDateString(timezone);
  }

  // Ensure date is not in the future
  const today = getTodayDateString(timezone);
  if (dateParam > today) {
    return today;
  }

  // Ensure date is within reasonable past (e.g., 7 days for TTL)
  const sevenDaysAgo = getDateNDaysAgo(7, timezone);
  if (dateParam < sevenDaysAgo) {
    return sevenDaysAgo;
  }

  return dateParam;
}

/**
 * Calculate time until daily reset for client display
 *
 * @param timezone - IANA timezone identifier
 * @returns Object with hours, minutes, seconds until reset
 */
export function getTimeUntilReset(timezone: string = TIMEZONE_CONFIG.default): {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
} {
  const totalMs = getMillisecondsUntilMidnight(timezone);
  const totalSeconds = Math.floor(totalMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalMs };
}

/**
 * Get all available IANA timezones (common ones)
 * For admin configuration UI
 */
export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export type CommonTimezone = typeof COMMON_TIMEZONES[number];

/**
 * Validate timezone string
 *
 * @param timezone - Timezone to validate
 * @returns True if valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
