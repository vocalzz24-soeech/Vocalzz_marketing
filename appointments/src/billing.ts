// Pure billing helpers (no database), unit-tested in test/billing.test.ts.

/** Indian financial year label for a "YYYY-MM-DD" day: April 2026 - March 2027 -> "26-27". */
export function financialYear(day: string): string {
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** Next bill number in the financial year, given the latest existing number of that year (or null). */
export function nextBillNumber(day: string, latest: string | null, prefix = "VZ"): string {
  const fy = financialYear(day);
  const n = latest && latest.startsWith(`${prefix}/${fy}/`) ? Number(latest.split("/")[2]) + 1 : 1;
  return `${prefix}/${fy}/${String(n).padStart(4, "0")}`;
}

/** "₹12,500.00" in Indian grouping. */
export function rupees(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const last3 = int.slice(-3), rest = int.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `${n < 0 ? "-" : ""}₹${grouped}.${dec}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function below100(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`; }
function below1000(n: number) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? below100(r) : ""].filter(Boolean).join(" ");
}

/** "Rupees Twelve Thousand Five Hundred Only" (Indian system: thousand, lakh, crore). */
export function amountInWords(amount: number): string {
  const rupeesPart = Math.floor(Math.round(amount * 100) / 100);
  const paise = Math.round((amount - rupeesPart) * 100);
  const parts: string[] = [];
  let n = rupeesPart;
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  const words = parts.length ? parts.join(" ") : "Zero";
  return `Rupees ${words}${paise ? ` and ${below100(paise)} Paise` : ""} Only`;
}

export interface BillLine { description: string; service?: string | null; quantity: number; rate: number }

/** Totals for a bill; rounds to 2 decimals. Lines with zero quantity or rate are ignored. */
export function billTotals(lines: BillLine[], discount: number, paid: number) {
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const items = lines.filter((l) => l.description.trim() && l.quantity > 0 && l.rate >= 0)
    .map((l) => ({ ...l, amount: r2(l.quantity * l.rate) }));
  const subtotal = r2(items.reduce((s, l) => s + l.amount, 0));
  const disc = r2(Math.min(Math.max(discount, 0), subtotal));
  const total = r2(subtotal - disc);
  const paidAmt = r2(Math.min(Math.max(paid, 0), total));
  return { items, subtotal, discount: disc, total, paid: paidAmt, balance: r2(total - paidAmt) };
}

export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank transfer", "Other"];
