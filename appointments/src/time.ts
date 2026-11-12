// The clinic runs on India Standard Time (UTC+5:30, no daylight saving).
// Times are stored in UTC and converted at the edges.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-20T17:00" (IST, from <input type="datetime-local">) -> Date */
export function istLocalToDate(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parts of a Date as seen on a clock in IST. */
export function istParts(date: Date) {
  const s = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
    weekday: s.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> "2026-11-20T17:00" for datetime-local inputs. */
export function dateToIstLocal(date: Date): string {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Date -> "2026-11-20" (IST calendar day). */
export function istDay(date: Date): string {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** UTC range [start, end) covering one IST calendar day "YYYY-MM-DD". */
export function istDayRange(day: string): { start: Date; end: Date } | null {
  const start = istLocalToDate(`${day}T00:00`);
  if (!start) return null;
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}

/** "5:00 PM" */
export function formatTime(date: Date): string {
  const p = istParts(date);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h12}:${pad(p.minute)} ${p.hour < 12 ? "AM" : "PM"}`;
}

/** "Fri, 20 Nov 2026, 5:00 PM" */
export function formatDateTime(date: Date): string {
  const p = istParts(date);
  return `${DAYS[p.weekday]}, ${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${formatTime(date)}`;
}
