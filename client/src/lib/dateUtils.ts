/**
 * Date formatting utilities — all timestamps displayed in GMT+2 (Africa/Cairo).
 * Egypt does not observe DST, so this is a consistent UTC+2 offset year-round.
 */

const TZ = 'Africa/Cairo'; // UTC+2, no DST

/**
 * "Jun 1, 10:30 AM" — used in transaction/event lists where the year is implied.
 */
export function formatDateTimeShort(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "Jun 1, 2026, 10:30 AM" — used when the full date + time matters.
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "Jun 1, 2026" — date only, no time.
 */
export function formatDateOnly(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * "10:30 AM" — time only.
 */
export function formatTimeOnly(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "2026-06-01 10:30:00" — ISO-like string for CSV exports (GMT+2).
 */
export function formatDateTimeForExport(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
