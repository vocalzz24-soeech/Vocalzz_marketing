import { test } from "node:test";
import assert from "node:assert/strict";
import { isBrand, pathOf, pemToDer, periods } from "../src/search-console.ts";

test("periods end 2 days ago and compare with the same length before", () => {
  assert.deepEqual(periods("2026-11-23", 28), { cur: { start: "2026-10-25", end: "2026-11-21" }, prev: { start: "2026-09-27", end: "2026-10-24" } });
  assert.deepEqual(periods("2026-11-23", 7).cur, { start: "2026-11-15", end: "2026-11-21" });
});

test("brand searches are recognised", () => {
  assert.equal(isBrand("Vocalzz reviews"), true);
  assert.equal(isBrand("speech therapy noida"), false);
});

test("pathOf and pemToDer", () => {
  assert.equal(pathOf("https://vocalzz.com/blog/x/"), "/blog/x/");
  const pem = "-----BEGIN PRIVATE KEY-----\\nAAEC\\n-----END PRIVATE KEY-----\\n";
  assert.deepEqual([...pemToDer(pem)], [0, 1, 2]);
});

test("credentials accept the whole JSON key file or the PEM key on its own", async () => {
  const { credentials } = await import("../src/search-console.ts");
  const file = JSON.stringify({ type: "service_account", client_email: "a@b.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nAAEC\n-----END PRIVATE KEY-----\n" });
  assert.deepEqual(credentials({ GSC_PRIVATE_KEY: file } as never), { email: "a@b.iam.gserviceaccount.com", key: "-----BEGIN PRIVATE KEY-----\nAAEC\n-----END PRIVATE KEY-----\n" });
  assert.deepEqual(credentials({ GSC_PRIVATE_KEY: "PEM", GSC_CLIENT_EMAIL: "x@y" } as never), { email: "x@y", key: "PEM" });
  assert.equal(credentials({ GSC_PRIVATE_KEY: "PEM" } as never), null);
  assert.equal(credentials({ GSC_PRIVATE_KEY: "{bad json" } as never), null);
});

test("resolveRange: presets, custom dates, clamping and swapping", async () => {
  const { resolveRange, previousOf, fillDays } = await import("../src/search-console.ts");
  assert.deepEqual(resolveRange("2026-11-24", {}), { start: "2026-10-26", end: "2026-11-22", days: 28, preset: 28 });
  assert.deepEqual(resolveRange("2026-11-24", { days: "7" }), { start: "2026-11-16", end: "2026-11-22", days: 7, preset: 7 });
  const c = resolveRange("2026-11-24", { from: "2026-11-20", to: "2026-11-10" });
  assert.deepEqual([c.start, c.end, c.days, c.preset], ["2026-11-10", "2026-11-20", 11, null]);
  const late = resolveRange("2026-11-24", { from: "2026-11-20", to: "2026-11-30" });
  assert.equal(late.end, "2026-11-22"); assert.ok(late.note);
  assert.deepEqual(resolveRange("2026-11-24", { from: "2026-11-18", to: "2026-11-18" }).days, 1);
  assert.deepEqual(previousOf({ start: "2026-11-18", days: 1 }), { start: "2026-11-17", end: "2026-11-17" });
  assert.deepEqual(fillDays("2026-11-01", "2026-11-03", [{ keys: ["2026-11-02"], clicks: 3, impressions: 9, ctr: 0, position: 0 }]).map((d) => d.clicks), [0, 3, 0]);
});
