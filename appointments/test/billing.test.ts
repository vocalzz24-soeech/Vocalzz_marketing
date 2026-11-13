import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords, billTotals, financialYear, nextBillNumber, rupees } from "../src/billing.ts";

test("financial year and bill numbers", () => {
  assert.equal(financialYear("2026-11-14"), "26-27");
  assert.equal(financialYear("2027-03-31"), "26-27");
  assert.equal(financialYear("2027-04-01"), "27-28");
  assert.equal(nextBillNumber("2026-11-14", null), "VZ/26-27/0001");
  assert.equal(nextBillNumber("2026-11-14", "VZ/26-27/0041"), "VZ/26-27/0042");
  assert.equal(nextBillNumber("2027-04-02", "VZ/26-27/0310"), "VZ/27-28/0001", "restarts each financial year");
});

test("rupee formatting (Indian grouping)", () => {
  assert.equal(rupees(500), "₹500.00");
  assert.equal(rupees(12500), "₹12,500.00");
  assert.equal(rupees(1234567.5), "₹12,34,567.50");
});

test("amount in words", () => {
  assert.equal(amountInWords(12500), "Rupees Twelve Thousand Five Hundred Only");
  assert.equal(amountInWords(800), "Rupees Eight Hundred Only");
  assert.equal(amountInWords(115000), "Rupees One Lakh Fifteen Thousand Only");
  assert.equal(amountInWords(1050.5), "Rupees One Thousand Fifty and Fifty Paise Only");
  assert.equal(amountInWords(0), "Rupees Zero Only");
});

test("bill totals", () => {
  const t = billTotals([
    { description: "Speech therapy sessions", quantity: 8, rate: 1000 },
    { description: "Assessment", quantity: 1, rate: 1500 },
    { description: "", quantity: 2, rate: 100 },
    { description: "Empty", quantity: 0, rate: 500 },
  ], 500, 5000);
  assert.equal(t.items.length, 2);
  assert.equal(t.subtotal, 9500);
  assert.equal(t.total, 9000);
  assert.equal(t.balance, 4000);
  assert.equal(billTotals([{ description: "X", quantity: 1, rate: 100 }], 500, 999).total, 0, "discount capped at subtotal");
});
