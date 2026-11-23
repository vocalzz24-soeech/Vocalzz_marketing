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
