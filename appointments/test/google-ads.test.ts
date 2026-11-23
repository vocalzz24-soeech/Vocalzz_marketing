import { test } from "node:test";
import assert from "node:assert/strict";
import { explain, fillAdsDays, metricsOf, resolveAdsRange, search, sumMetrics } from "../src/google-ads.ts";

test("ads ranges", () => {
  assert.deepEqual(resolveAdsRange("2026-11-24", {}), { start: "2026-11-18", end: "2026-11-24", days: 7, preset: "7" });
  assert.deepEqual(resolveAdsRange("2026-11-24", { p: "yesterday" }), { start: "2026-11-23", end: "2026-11-23", days: 1, preset: "yesterday" });
  const c = resolveAdsRange("2026-11-24", { from: "2026-11-23", to: "2026-11-30" });
  assert.equal(c.end, "2026-11-24"); assert.ok(c.note);
});

test("metrics parse micros and strings", () => {
  const m = metricsOf({ costMicros: "369350000", clicks: "20", impressions: "214", conversions: 1 });
  assert.deepEqual(m, { cost: 369.35, clicks: 20, impressions: 214, conversions: 1 });
  assert.equal(sumMetrics([m, m]).clicks, 40);
  assert.equal(fillAdsDays("2026-11-22", "2026-11-24", [{ date: "2026-11-23", ...m }]).map((d) => d.clicks).join(), "0,20,0");
});

test("errors are explained", () => {
  assert.match(explain(401, { error: { message: "x", details: [{ errors: [{ errorCode: { authenticationError: "DEVELOPER_TOKEN_PARAMETER_MISSING" } }] }] } }), /GADS_DEVELOPER_TOKEN/);
  assert.match(explain(403, { error: { message: "denied" } }), /No permission/);
});

test("search skips unknown API versions and follows pages", async () => {
  const calls: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    calls.push(url);
    const v = url.split("/")[3];
    if (v !== "v25") return new Response("{}", { status: 404 });
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify(body.pageToken ? { results: [{ n: 2 }] } : { results: [{ n: 1 }], nextPageToken: "p2" }), { status: 200 });
  }) as typeof fetch;
  try {
    const rows = await search({} as never, "t", "SELECT x FROM customer");
    assert.deepEqual(rows, [{ n: 1 }, { n: 2 }]);
    assert.ok(calls[0].includes("/v30/") && calls.at(-1)!.includes("/v25/"));
    assert.ok(calls.every((u) => u.includes("/customers/8983920631/")));
  } finally { globalThis.fetch = real; }
});
