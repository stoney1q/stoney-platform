import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const DEFAULT_TIMEZONE = 'America/New_York';

export function getBusinessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
}

/**
 * Returns the exact UTC Date bounds for "Today" in the business timezone.
 */
export function getTodayUTCBounds(): { start: Date; end: Date } {
  const timeZone = getBusinessTimezone();
  const now = new Date();

  // Convert current UTC time to local business time
  const zonedNow = toZonedTime(now, timeZone);

  // Find the start and end of that day in the local business time
  const localStart = startOfDay(zonedNow);
  const localEnd = endOfDay(zonedNow);

  // Convert those local boundaries back to UTC Date objects for Prisma
  return {
    start: fromZonedTime(localStart, timeZone),
    end: fromZonedTime(localEnd, timeZone),
  };
}

/**
 * Returns the exact UTC Date bounds for "This Week" in the business timezone.
 * Week starts on Monday by default (weekStartsOn: 1).
 */
export function getThisWeekUTCBounds(): { start: Date; end: Date } {
  const timeZone = getBusinessTimezone();
  const now = new Date();

  const zonedNow = toZonedTime(now, timeZone);

  const localStart = startOfWeek(zonedNow, { weekStartsOn: 1 });
  const localEnd = endOfWeek(zonedNow, { weekStartsOn: 1 });

  return {
    start: fromZonedTime(localStart, timeZone),
    end: fromZonedTime(localEnd, timeZone),
  };
}
