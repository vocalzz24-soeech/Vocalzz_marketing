import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, attendance, periodFor, rangeLabel, scheduled, statusOf } from "../src/report.ts";
import { istLocalToDate } from "../src/time.ts";

const today = "2026-11-18"; // Wednesday

test("report periods (weeks run Monday to Sunday)", () => {
  assert.deepEqual([periodFor("last_week", today).from, periodFor("last_week", today).to], ["2026-11-09", "2026-11-15"]);
  assert.deepEqual([periodFor("this_week", today).from, periodFor("this_week", today).to], ["2026-11-16", "2026-11-22"]);
  assert.deepEqual([periodFor("next_week", today).from, periodFor("next_week", today).to], ["2026-11-23", "2026-11-29"]);
  const lm = periodFor("last_month", today);
  assert.deepEqual([lm.from, lm.to, lm.label], ["2026-10-01", "2026-10-31", "October 2026"]);
  assert.deepEqual([periodFor("this_month", today).from, periodFor("this_month", today).to], ["2026-11-01", "2026-11-30"]);
  assert.deepEqual([periodFor("last_month", "2027-01-05").from, periodFor("last_month", "2027-01-05").to], ["2026-12-01", "2026-12-31"]);
  assert.equal(periodFor("this_week", "2026-11-22").from, "2026-11-16", "Sunday belongs to the week that started on Monday");
  assert.equal(periodFor("this_week", "2026-11-16").to, "2026-11-22");
  const c = periodFor("custom", today, "2026-11-30", "2026-11-01");
  assert.deepEqual([c.from, c.to], ["2026-11-01", "2026-11-30"], "dates the wrong way round are swapped");
  assert.equal(periodFor("custom", today, "2026-02-30", "2026-03-01").key, "last_week", "impossible date falls back");
  assert.equal(periodFor("custom", today, "2020-01-01", "2026-01-01").to, "2021-01-01", "capped at a year");
  assert.equal(periodFor("nonsense", today).key, "last_week");
  assert.equal(rangeLabel("2026-11-09", "2026-11-15"), "9 Nov – 15 Nov 2026");
});

test("session status for reports", () => {
  const now = istLocalToDate("2026-11-18T12:00")!;
  assert.equal(statusOf({ status: "booked", start_utc: istLocalToDate("2026-11-18T15:00")!.toISOString() }, now), "upcoming");
  assert.equal(statusOf({ status: "booked", start_utc: istLocalToDate("2026-11-18T10:00")!.toISOString() }, now), "unmarked");
  assert.equal(statusOf({ status: "completed", start_utc: "x" }, now), "completed");
  assert.equal(statusOf({ status: "no_show", start_utc: "x" }, now), "no_show");
  assert.equal(statusOf({ status: "cancelled", start_utc: "x" }, now), "cancelled");
});

test("report counts by status, day, therapist and patient", () => {
  const now = istLocalToDate("2026-11-18T12:00")!;
  const at = (s: string) => istLocalToDate(s)!.toISOString();
  const row = (patient_id: number, patient_name: string, therapist_id: number, therapist_name: string, status: string, start: string, service = "Speech therapy") =>
    ({ patient_id, patient_name, therapist_id, therapist_name, status, start_utc: at(start), service });
  const rows = [
    row(1, "Aarav", 1, "Tanu", "completed", "2026-11-16T10:00"),
    row(1, "Aarav", 2, "Samriddhi", "no_show", "2026-11-17T11:00"),
    row(1, "Aarav", 1, "Tanu", "booked", "2026-11-19T10:00"),
    row(2, "Diya", 1, "Tanu", "booked", "2026-11-18T09:00"),
    row(2, "Diya", 1, "Tanu", "cancelled", "2026-11-20T10:00"),
    row(3, "Kabir", 2, "Samriddhi", "completed", "2026-11-16T00:10", "Consultation"), // just after midnight IST
  ];
  const r = aggregate(periodFor("this_week", "2026-11-18"), rows, now);
  assert.deepEqual(r.totals, { completed: 2, no_show: 1, upcoming: 1, unmarked: 1, cancelled: 1 });
  assert.equal(scheduled(r.totals), 5);
  assert.equal(attendance(r.totals), 67);
  assert.equal(r.byDay.length, 7);
  assert.deepEqual(r.byDay[0], { day: "2026-11-16", counts: { completed: 2, no_show: 0, upcoming: 0, unmarked: 0, cancelled: 0 } });
  assert.deepEqual(r.byTherapist.map((t) => [t.name, scheduled(t.counts)]), [["Tanu", 3], ["Samriddhi", 2]]);
  assert.deepEqual(r.byPatient.map((p) => [p.name, scheduled(p.counts), p.therapists.join("+")]), [["Aarav", 3, "Samriddhi+Tanu"], ["Diya", 1, "Tanu"], ["Kabir", 1, "Samriddhi"]]);
  assert.equal(r.newConsultations, 1);
  assert.equal(attendance({ completed: 0, no_show: 0, upcoming: 3, unmarked: 0, cancelled: 0 }), null);
});

test("messages say 'you' for adult patients with no parent", async () => {
  const { forWhom } = await import("../src/notify.ts");
  assert.equal(forWhom({ guardian_name: "Priya", patient_name: "Aarav" }), "Aarav");
  assert.equal(forWhom({ guardian_name: null, patient_name: "Rahul" }), "you");
});
