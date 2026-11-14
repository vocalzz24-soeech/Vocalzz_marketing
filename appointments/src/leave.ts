// Leave rules from the Vocalzz HR Policy 2027. Pure functions, tested in test/leave.test.ts.
import { addDays, weekday } from "./schedule.ts";

export const POLICY_START = "2027-01-01";
export const CARRY_FORWARD_MAX = 6;

/** Working days (Monday to Saturday) between two days inclusive, skipping clinic holidays. */
export function leaveDays(start: string, end: string, holidays: Set<string>): number {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (weekday(d) !== 0 && !holidays.has(d)) n++;
  return n;
}

/** Notice the policy asks for, and whether a request made on `today` meets it. Emergencies are exempt. */
export function noticeCheck(start: string, days: number, today: string, kind: "planned" | "emergency") {
  const required = days <= 2 ? 3 : 15;
  const given = Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { required, given, ok: kind === "emergency" || given >= required };
}

const nextMonthFirst = (day: string) => {
  const d = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};

/**
 * Leave balance on `asOf`. 1 leave is credited on the 1st of each month from POLICY_START (or from the 1st of the
 * month after joining). Approved leave in the current year is deducted straight away. At each year end, at most 6 unused days carry forward; the rest lapse. `opening` is the
 * balance at the policy start. Approved leave counts in the year it starts. A negative balance means unpaid days.
 */
export function leaveBalance(opts: { asOf: string; joinedOn?: string | null; opening?: number; taken: { start: string; days: number }[] }) {
  const { asOf, joinedOn, opening = 0, taken } = opts;
  // "Leave starts from the 1st of the month after you join."
  const firstCredit = joinedOn && joinedOn >= POLICY_START ? nextMonthFirst(joinedOn) : POLICY_START;
  let balance = opening;
  let year = Number(POLICY_START.slice(0, 4));
  const lastYear = Number(asOf.slice(0, 4));
  let credited = 0, used = 0, carriedIn = opening;
  for (; year <= lastYear; year++) {
    if (year > Number(POLICY_START.slice(0, 4))) {
      carriedIn = Math.min(Math.max(balance, 0), CARRY_FORWARD_MAX) + Math.min(balance, 0); // debt carries in full
      balance = carriedIn;
    }
    credited = 0;
    for (let m = 1; m <= 12; m++) {
      const d = `${year}-${String(m).padStart(2, "0")}-01`;
      if (d >= firstCredit && d <= asOf) credited++;
    }
    // Approved leave counts as soon as it is approved, even if it is later in the year, so the same days
    // cannot be approved twice.
    used = taken.filter((t) => t.start.startsWith(`${year}-`)).reduce((s, t) => s + t.days, 0);
    balance += credited - used;
  }
  if (lastYear < Number(POLICY_START.slice(0, 4))) {
    used = taken.reduce((s, t) => s + t.days, 0);
    balance = opening - used; credited = 0; carriedIn = opening;
  }
  return { balance, creditedThisYear: credited, takenThisYear: used, carriedIn };
}
