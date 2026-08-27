import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getBusinessTimezone } from '@/lib/dashboard/utils';
import { ReportDateRange } from './types';

const DEFAULT_DAYS_BACK = 30;
const MAX_DAYS_BACK = 365;

export function resolveDateRangeUTCBounds(range?: ReportDateRange): {
  start: Date;
  end: Date;
} {
  const timeZone = getBusinessTimezone();
  const now = new Date();
  const zonedNow = toZonedTime(now, timeZone);

  let localStart: Date;
  let localEnd: Date;

  if (range && range.from && range.to) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(range.from) || !dateRegex.test(range.to)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    const fromParts = range.from.split('-');
    const toParts = range.to.split('-');

    localStart = new Date(
      parseInt(fromParts[0], 10),
      parseInt(fromParts[1], 10) - 1,
      parseInt(fromParts[2], 10)
    );
    localEnd = new Date(
      parseInt(toParts[0], 10),
      parseInt(toParts[1], 10) - 1,
      parseInt(toParts[2], 10)
    );

    // Validate impossible calendar dates (e.g. Feb 30)
    if (
      localStart.getFullYear() !== parseInt(fromParts[0], 10) ||
      localStart.getMonth() !== parseInt(fromParts[1], 10) - 1 ||
      localStart.getDate() !== parseInt(fromParts[2], 10) ||
      localEnd.getFullYear() !== parseInt(toParts[0], 10) ||
      localEnd.getMonth() !== parseInt(toParts[1], 10) - 1 ||
      localEnd.getDate() !== parseInt(toParts[2], 10)
    ) {
      throw new Error('Invalid calendar date');
    }

    // Validate from <= to
    const msDiff = localEnd.getTime() - localStart.getTime();
    if (msDiff < 0) {
      throw new Error(
        'Invalid date range: from date must be before or equal to to date'
      );
    }

    // Enforce max date range (do not truncate, reject explicitly)
    if (msDiff > MAX_DAYS_BACK * 24 * 60 * 60 * 1000) {
      throw new Error(
        `Date range exceeds maximum allowed of ${MAX_DAYS_BACK} days`
      );
    }
  } else if (range?.from || range?.to) {
    // If one is provided but not the other, reject (or we could fallback, but strict validation is safer)
    throw new Error('Both from and to dates must be provided');
  } else {
    // Default to last N days
    localEnd = zonedNow;
    localStart = subDays(localEnd, DEFAULT_DAYS_BACK);
  }

  return {
    start: fromZonedTime(startOfDay(localStart), timeZone),
    end: fromZonedTime(endOfDay(localEnd), timeZone),
  };
}

/**
 * Utility to format a UTC Date back to the local business date string YYYY-MM-DD
 */
export function formatToBusinessDate(date: Date): string {
  const timeZone = getBusinessTimezone();
  const zonedDate = toZonedTime(date, timeZone);
  return format(zonedDate, 'yyyy-MM-dd');
}
