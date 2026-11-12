import { test } from "node:test";
import assert from "node:assert/strict";
import { checkClinicHours, dueReminders, findClashes, normalisePhone, overlaps } from "../src/schedule.ts";
import { formatDateTime, istDay, istLocalToDate, dateToIstLocal } from "../src/time.ts";
import { reminderWhen } from "../src/notify.ts";
import { renderTemplate, TEMPLATES } from "../src/whatsapp.ts";

const at = (local: string) => istLocalToDate(local)!;
const slot = (local: string, durationMin = 45, extraMin = 0, id?: number) => ({ id, start: at(local), durationMin, extraMin });

test("IST conversion round-trips and formats", () => {
  const d = at("2026-11-20T17:00");
  assert.equal(d.toISOString(), "2026-11-20T11:30:00.000Z");
  assert.equal(dateToIstLocal(d), "2026-11-20T17:00");
  assert.equal(formatDateTime(d), "Fri, 20 Nov 2026, 5:00 PM");
  assert.equal(istDay(at("2026-11-21T00:10")), "2026-11-21");
  assert.equal(istLocalToDate("bad"), null);
});

test("overlap rules", () => {
  assert.ok(overlaps(slot("2026-11-20T10:00"), slot("2026-11-20T10:30")));
  assert.ok(!overlaps(slot("2026-11-20T10:00"), slot("2026-11-20T10:45")), "back-to-back is fine");
  assert.ok(overlaps(slot("2026-11-20T10:00", 45, 15), slot("2026-11-20T10:45")), "extra time counts");
  const existing = [slot("2026-11-20T10:00", 45, 0, 1)];
  assert.equal(findClashes(slot("2026-11-20T10:15", 45, 0, 1), existing).length, 0, "ignores itself when rescheduling");
  assert.equal(findClashes(slot("2026-11-20T10:15", 45, 0, 2), existing).length, 1);
});

test("clinic hours 10:00-21:00", () => {
  assert.equal(checkClinicHours(slot("2026-11-20T10:00"), 10, 21), null);
  assert.equal(checkClinicHours(slot("2026-11-20T20:15"), 10, 21), null);
  assert.ok(checkClinicHours(slot("2026-11-20T09:45"), 10, 21));
  assert.ok(checkClinicHours(slot("2026-11-20T20:30"), 10, 21));
  assert.ok(checkClinicHours(slot("2026-11-20T20:15", 45, 10), 10, 21));
});

test("reminder timing", () => {
  const start = at("2026-11-20T17:00");
  const base = { start, status: "booked", reminder24hSentAt: null, reminder2hSentAt: null };
  const early = { ...base, createdAt: at("2026-11-15T12:00") };
  assert.deepEqual(dueReminders(early, at("2026-11-19T16:00")), []);
  assert.deepEqual(dueReminders(early, at("2026-11-19T17:00")), ["reminder_24h"]);
  assert.deepEqual(dueReminders(early, at("2026-11-20T15:00")), ["reminder_2h"], "24h one is skipped once inside 2h");
  assert.deepEqual(dueReminders({ ...early, reminder24hSentAt: "x" }, at("2026-11-20T15:05")), ["reminder_2h"]);
  assert.deepEqual(dueReminders({ ...early, reminder2hSentAt: "x", reminder24hSentAt: "x" }, at("2026-11-20T16:00")), []);
  assert.deepEqual(dueReminders(early, at("2026-11-20T17:00")), [], "nothing after start");
  assert.deepEqual(dueReminders({ ...early, status: "cancelled" }, at("2026-11-20T15:30")), []);
  // Booked the same morning: no day-before reminder, but still the 2-hour one.
  const sameDay = { ...base, createdAt: at("2026-11-20T09:00") };
  assert.deepEqual(dueReminders(sameDay, at("2026-11-20T10:00")), []);
  assert.deepEqual(dueReminders(sameDay, at("2026-11-20T15:00")), ["reminder_2h"]);
  // Booked 1 hour before: no reminders at all.
  assert.deepEqual(dueReminders({ ...base, createdAt: at("2026-11-20T16:00") }, at("2026-11-20T16:05")), []);
});

test("reminder wording", () => {
  const start = at("2026-11-20T17:00");
  assert.equal(reminderWhen(start, at("2026-11-20T15:00")), "today at 5:00 PM");
  assert.equal(reminderWhen(start, at("2026-11-19T17:00")), "tomorrow, Fri, 20 Nov 2026, 5:00 PM");
});

test("phone numbers", () => {
  assert.equal(normalisePhone("98111 22333"), "919811122333");
  assert.equal(normalisePhone("+91 98111-22333"), "919811122333");
  assert.equal(normalisePhone("098111 22333"), "919811122333");
  assert.equal(normalisePhone("12345"), null);
  assert.equal(normalisePhone("5811122333"), null);
});

test("templates render and follow Meta's basic rules", () => {
  assert.equal(
    renderTemplate("vocalzz_appt_cancelled", ["Priya", "Speech therapy", "Aarav", "Fri, 20 Nov 2026, 5:00 PM"]).split("\n")[0],
    "Hello Priya, the Speech therapy session for Aarav on Fri, 20 Nov 2026, 5:00 PM at Vocalzz has been cancelled.",
  );
  for (const [name, body] of Object.entries(TEMPLATES)) {
    const t = body.trim();
    assert.ok(!/^\{\{/.test(t) && !/\}\}$/.test(t), `${name} must not start or end with a variable`);
    const nums = [...t.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(nums.sort((a, b) => a - b), nums.map((_, i) => i + 1), `${name} variables are 1..n`);
  }
});
