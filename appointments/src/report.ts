// Numbers for the dashboard and the weekly PDF: sessions by status, by day, by therapist and by patient.
// Weeks run Monday to Sunday, in India time.
import type { Env } from "./env.ts";
import { APPT_SELECT, type ApptRow } from "./notify.ts";
import { addDays, weekday } from "./schedule.ts";
import { istDay, istDayRange } from "./time.ts";

export type Status = "completed" | "no_show" | "upcoming" | "unmarked" | "cancelled";
/** Fixed order: it is also the stacking order and the colour order of every chart. */
export const STATUSES: { key: Status; label: string }[] = [
  { key: "completed", label: "Completed" },
  { key: "no_show", label: "No-show" },
  { key: "upcoming", label: "Upcoming" },
  { key: "unmarked", label: "Not marked" },
  { key: "cancelled", label: "Cancelled" },
];

export type Counts = Record<Status, number>;
const zero = (): Counts => ({ completed: 0, no_show: 0, upcoming: 0, unmarked: 0, cancelled: 0 });
/** Sessions that were (or are) meant to happen: everything except cancelled. */
export const scheduled = (c: Counts) => c.completed + c.no_show + c.upcoming + c.unmarked;

/** A booked session whose time has passed and nobody marked it is "not marked", not "upcoming". */
export function statusOf(a: { status: string; start_utc: string }, now: Date): Status {
  if (a.status === "completed") return "completed";
  if (a.status === "no_show") return "no_show";
  if (a.status === "cancelled") return "cancelled";
  return Date.parse(a.start_utc) > now.getTime() ? "upcoming" : "unmarked";
}

// --- Periods ------------------------------------------------------------------------------------
export type PeriodKey = "last_week" | "this_week" | "next_week" | "last_month" | "this_month" | "custom";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "last_week", label: "Last week" },
  { key: "this_week", label: "This week" },
  { key: "next_week", label: "Upcoming week" },
  { key: "last_month", label: "Last month" },
  { key: "this_month", label: "This month" },
  { key: "custom", label: "Custom dates" },
];
export interface Period { key: PeriodKey; label: string; from: string; to: string } // IST days, both included

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const isDay = (s: string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
export const mondayOf = (day: string) => addDays(day, -((weekday(day) + 6) % 7));
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const monthEnd = (day: string) => addDays(monthStart(addDays(monthStart(day), 32)), -1);
export const shortDate = (day: string) => { const d = new Date(`${day}T00:00:00Z`); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
export const rangeLabel = (from: string, to: string) =>
  from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)} ${to.slice(0, 4)}`;

/** Turns a preset (or custom dates) into a date range, relative to today. Custom ranges are capped at 1 year. */
export function periodFor(key: string | undefined, today: string, from?: string, to?: string): Period {
  const k = (PERIODS.some((p) => p.key === key) ? key : "last_week") as PeriodKey;
  const mon = mondayOf(today);
  const lastMonthDay = addDays(monthStart(today), -1);
  let f: string, t: string, label: string;
  switch (k) {
    case "this_week": f = mon; t = addDays(mon, 6); label = "This week"; break;
    case "next_week": f = addDays(mon, 7); t = addDays(mon, 13); label = "Upcoming week"; break;
    case "this_month": f = monthStart(today); t = monthEnd(today); label = MONTH[Number(today.slice(5, 7)) - 1] + " " + today.slice(0, 4); break;
    case "last_month": f = monthStart(lastMonthDay); t = lastMonthDay; label = MONTH[Number(lastMonthDay.slice(5, 7)) - 1] + " " + lastMonthDay.slice(0, 4); break;
    case "custom":
      if (isDay(from) && isDay(to)) {
        f = from! <= to! ? from! : to!; t = from! <= to! ? to! : from!;
        if (t > addDays(f, 366)) t = addDays(f, 366);
        label = "Custom dates"; break;
      }
      return periodFor("last_week", today);
    default: f = addDays(mon, -7); t = addDays(mon, -1); label = "Last week";
  }
  return { key: k, label, from: f, to: t };
}

export function daysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

// --- Aggregation (pure, so it can be tested) -------------------------------------------------------
export interface PatientLine { id: number; name: string; therapists: string[]; counts: Counts }
export interface TherapistLine { id: number; name: string; counts: Counts }
export interface Report {
  period: Period;
  /** Set when the report is for one therapist only. */
  therapistName?: string;
  generatedAt: string;
  totals: Counts;
  byDay: { day: string; counts: Counts }[];
  byTherapist: TherapistLine[];
  byPatient: PatientLine[];
  newConsultations: number;
}

type Row = Pick<ApptRow, "patient_id" | "patient_name" | "therapist_id" | "therapist_name" | "status" | "start_utc" | "service">;

export function aggregate(period: Period, rows: Row[], now: Date): Report {
  const totals = zero();
  const days = daysBetween(period.from, period.to);
  const byDay = new Map(days.map((d) => [d, zero()]));
  const byTherapist = new Map<number, TherapistLine>();
  const byPatient = new Map<number, PatientLine & { tset: Set<string> }>();
  let newConsultations = 0;
  for (const r of rows) {
    const s = statusOf(r, now);
    totals[s]++;
    const dayCounts = byDay.get(istDay(new Date(r.start_utc)));
    if (dayCounts) dayCounts[s]++;
    const t = byTherapist.get(r.therapist_id) ?? { id: r.therapist_id, name: r.therapist_name, counts: zero() };
    t.counts[s]++; byTherapist.set(r.therapist_id, t);
    const p = byPatient.get(r.patient_id) ?? { id: r.patient_id, name: r.patient_name, therapists: [], counts: zero(), tset: new Set<string>() };
    p.counts[s]++; if (s !== "cancelled") p.tset.add(r.therapist_name); byPatient.set(r.patient_id, p);
    if (r.service === "Consultation" && s !== "cancelled") newConsultations++;
  }
  const busiest = (a: { counts: Counts; name: string }, b: { counts: Counts; name: string }) =>
    scheduled(b.counts) - scheduled(a.counts) || b.counts.cancelled - a.counts.cancelled || a.name.localeCompare(b.name);
  return {
    period,
    generatedAt: now.toISOString(),
    totals,
    byDay: days.map((d) => ({ day: d, counts: byDay.get(d)! })),
    byTherapist: [...byTherapist.values()].sort(busiest),
    byPatient: [...byPatient.values()].map(({ tset, ...p }) => ({ ...p, therapists: [...tset].sort() })).sort(busiest),
    newConsultations,
  };
}

/** Loads one period's sessions (optionally for one therapist) and counts them. One database round trip. */
export async function buildReport(env: Env, period: Period, therapistId?: number, now = new Date()): Promise<Report> {
  const from = istDayRange(period.from)!.start.toISOString();
  const to = istDayRange(period.to)!.end.toISOString();
  const q = `${APPT_SELECT} WHERE a.start_utc >= ? AND a.start_utc < ?${therapistId ? " AND a.therapist_id = ?" : ""} ORDER BY a.start_utc`;
  const stmt = therapistId ? env.DB.prepare(q).bind(from, to, therapistId) : env.DB.prepare(q).bind(from, to);
  const { results } = await stmt.all<ApptRow>();
  return aggregate(period, results, now);
}

/** Attendance: completed out of the sessions that have been marked (completed + no-show). */
export const attendance = (c: Counts) => (c.completed + c.no_show ? Math.round((100 * c.completed) / (c.completed + c.no_show)) : null);
