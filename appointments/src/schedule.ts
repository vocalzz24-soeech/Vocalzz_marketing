// Pure scheduling rules, kept free of database code so they can be unit-tested.
import { istParts } from "./time.ts";

export interface Slot {
  id?: number;
  start: Date;
  durationMin: number;
  extraMin: number;
}

export function endOf(slot: Slot): Date {
  return new Date(slot.start.getTime() + (slot.durationMin + slot.extraMin) * 60_000);
}

/** True when two slots overlap. Back-to-back slots (one ends as the next starts) do not. */
export function overlaps(a: Slot, b: Slot): boolean {
  return a.start < endOf(b) && b.start < endOf(a);
}

/** Existing slots that clash with `slot`, ignoring the slot itself (when rescheduling). */
export function findClashes<T extends Slot>(slot: Slot, existing: T[]): T[] {
  return existing.filter((e) => e.id !== slot.id && overlaps(slot, e));
}

/** Returns an error message when the slot is outside clinic hours, else null. */
export function checkClinicHours(slot: Slot, openHour: number, closeHour: number): string | null {
  const s = istParts(slot.start);
  const e = istParts(endOf(slot));
  const startMin = s.hour * 60 + s.minute;
  const endMin = e.hour * 60 + e.minute;
  const sameDay = s.day === e.day && s.month === e.month && s.year === e.year;
  if (startMin < openHour * 60 || !sameDay || endMin > closeHour * 60) {
    return `The clinic is open ${openHour}:00 to ${closeHour}:00. This session would run outside those hours.`;
  }
  return null;
}

export type ReminderKind = "reminder_24h" | "reminder_2h";

export interface ReminderState {
  start: Date;
  createdAt: Date;
  status: string;
  reminder24hSentAt: string | null;
  reminder2hSentAt: string | null;
}

const HOUR = 3_600_000;

/**
 * Which reminders are due right now.
 * - Day-before reminder: from 24h before the start, only if the booking was made at least
 *   24h ahead (otherwise the confirmation just sent is enough), and not once the 2-hour
 *   window has begun.
 * - 2-hour reminder: from 2h before the start until the start, only if the booking was made
 *   at least 2h ahead.
 */
export function dueReminders(a: ReminderState, now: Date): ReminderKind[] {
  if (a.status !== "booked" || now >= a.start) return [];
  const t = a.start.getTime();
  const due: ReminderKind[] = [];
  const in2hWindow = now.getTime() >= t - 2 * HOUR;
  if (
    !a.reminder24hSentAt &&
    !in2hWindow &&
    now.getTime() >= t - 24 * HOUR &&
    a.createdAt.getTime() <= t - 24 * HOUR
  ) {
    due.push("reminder_24h");
  }
  if (!a.reminder2hSentAt && in2hWindow && a.createdAt.getTime() <= t - 2 * HOUR) {
    due.push("reminder_2h");
  }
  return due;
}

/** Normalise an Indian mobile number to 91XXXXXXXXXX, or null if it is not valid. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let n = digits;
  if (n.length === 12 && n.startsWith("91")) n = n.slice(2);
  else if (n.length === 11 && n.startsWith("0")) n = n.slice(1);
  if (!/^[6-9]\d{9}$/.test(n)) return null;
  return `91${n}`;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v?: string): v is string => {
  if (!v || !DAY_RE.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(v); // rejects 2026-02-30 etc.
};
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * The 7-day strip on the schedule page. By default it starts today; if the chosen day is
 * outside today..today+6 it starts at the chosen day; Prev/Next pass an explicit start.
 * The selected day is always inside the returned window.
 */
export function weekWindow(today: string, dayParam?: string, startParam?: string) {
  const selected = isDay(dayParam) ? dayParam : today;
  let start: string;
  if (isDay(startParam) && selected >= startParam && selected <= addDays(startParam, 6)) start = startParam;
  else if (selected >= today && selected <= addDays(today, 6)) start = today;
  else start = selected;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { selected, start, days, prevStart: addDays(start, -7), nextStart: addDays(start, 7) };
}

/** 0 = Sunday … 6 = Saturday for a "YYYY-MM-DD" calendar day. */
export const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
export const isWeekend = (day: string) => weekday(day) === 0 || weekday(day) === 6;

/** Start times offered in the booking form: every 5 minutes from opening until 5 minutes before closing. */
export function timeSlots(openHour: number, closeHour: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let m = openHour * 60; m < closeHour * 60; m += 5) {
    const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
    out.push({ value: `${String(h).padStart(2, "0")}:${mm}`, label: `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "AM" : "PM"}` });
  }
  return out;
}
