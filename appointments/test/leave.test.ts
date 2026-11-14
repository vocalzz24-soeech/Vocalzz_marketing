import { test } from "node:test";
import assert from "node:assert/strict";
import { leaveBalance, leaveDays, noticeCheck } from "../src/leave.ts";

test("leave days skip Sundays and clinic holidays", () => {
  const hol = new Set(["2027-01-26"]);
  assert.equal(leaveDays("2027-01-25", "2027-01-30", hol), 5, "Mon-Sat minus Republic Day");
  assert.equal(leaveDays("2027-01-30", "2027-02-01", hol), 2, "Sat + Mon, Sunday skipped");
  assert.equal(leaveDays("2027-01-31", "2027-01-31", hol), 0);
});

test("notice rules", () => {
  assert.deepEqual(noticeCheck("2027-02-10", 2, "2027-02-07", "planned"), { required: 3, given: 3, ok: true });
  assert.equal(noticeCheck("2027-02-10", 2, "2027-02-08", "planned").ok, false);
  assert.equal(noticeCheck("2027-02-20", 5, "2027-02-08", "planned").ok, false, "needs 15 days");
  assert.equal(noticeCheck("2027-02-23", 5, "2027-02-08", "planned").ok, true);
  assert.equal(noticeCheck("2027-02-08", 1, "2027-02-08", "emergency").ok, true, "emergency exempt");
});

test("balance builds 1 per month and follows the policy example", () => {
  assert.equal(leaveBalance({ asOf: "2027-03-15", taken: [] }).balance, 3);
  assert.equal(leaveBalance({ asOf: "2027-04-02", taken: [{ start: "2027-04-05", days: 3 }] }).balance, 1, "Jan-Apr credits, 3 taken");
  assert.equal(leaveBalance({ asOf: "2026-11-14", taken: [] }).balance, 0, "nothing before the policy starts");
  assert.equal(leaveBalance({ asOf: "2026-11-14", opening: 4, taken: [] }).balance, 4, "opening balance");
});

test("new joiners start the month after joining", () => {
  assert.equal(leaveBalance({ asOf: "2027-06-30", joinedOn: "2027-03-15", taken: [] }).balance, 3, "Apr, May, Jun");
});

test("year end: up to 6 carry forward, the rest lapse", () => {
  const r = leaveBalance({ asOf: "2028-01-05", taken: [{ start: "2027-06-01", days: 2 }] });
  assert.equal(r.carriedIn, 6, "10 unused, only 6 carried");
  assert.equal(r.balance, 7, "6 carried + January credit");
  assert.equal(leaveBalance({ asOf: "2028-01-05", taken: [{ start: "2027-06-01", days: 9 }] }).balance, 4, "3 carried + 1");
});

test("going over the balance shows unpaid days as negative", () => {
  assert.equal(leaveBalance({ asOf: "2027-02-10", taken: [{ start: "2027-02-01", days: 5 }] }).balance, -3);
});
