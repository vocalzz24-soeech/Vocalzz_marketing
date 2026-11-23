import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDate, cleanSource, sourceLabel, tallySources } from "../src/sources.ts";

test("cleanSource accepts known keys only", () => {
  assert.equal(cleanSource("google_ads"), "google_ads");
  assert.equal(cleanSource(""), null);
  assert.equal(cleanSource("hacker'; DROP"), null);
  assert.equal(cleanSource(undefined), null);
});

test("cleanDate accepts real YYYY-MM-DD dates only", () => {
  assert.equal(cleanDate("2026-11-23"), "2026-11-23");
  assert.equal(cleanDate("2026-02-30"), null);
  assert.equal(cleanDate("23-11-2026"), null);
  assert.equal(cleanDate(""), null);
});

test("tallySources counts patients and confirmed ones, in list order, unrecorded last", () => {
  const lines = tallySources([
    { source: null, stage: "consultation" },
    { source: "instagram", stage: "active" },
    { source: "google_ads", stage: "consultation" },
    { source: "google_ads", stage: "active" },
    { source: "bogus", stage: "active" },
  ]);
  assert.deepEqual(lines.map((l) => [l.key, l.patients, l.started]), [
    ["google_ads", 2, 1],
    ["instagram", 1, 1],
    [null, 2, 1],
  ]);
  assert.equal(sourceLabel("google_ads"), "Google ad");
  assert.equal(sourceLabel(null), "Not recorded");
});
