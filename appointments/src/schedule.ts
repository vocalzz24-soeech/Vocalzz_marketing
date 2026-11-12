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
