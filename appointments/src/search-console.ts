// Google Search Console report for the admin "SEO report" page.
// Read-only access through a Google Cloud service account that the clinic owns:
//   GSC_CLIENT_EMAIL  service account email (secret)
//   GSC_PRIVATE_KEY   its private key, the "-----BEGIN PRIVATE KEY-----..." text from the JSON key file (secret)
//   GSC_SITE          Search Console property, e.g. "sc-domain:vocalzz.com" (wrangler.toml var)
// The service account must be added as a user (Restricted is enough) on the property in Search Console.
import type { Env } from "./env.ts";
import { addDays } from "./schedule.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
/** Searches containing these words are the clinic's own name ("brand"), counted separately. */
export const BRAND_WORDS = ["vocalzz", "vocalz", "vocals speech"];

/**
 * The service account email and PEM key. GSC_PRIVATE_KEY may hold either the PEM key on its own, or the whole
 * downloaded JSON key file (easier to paste on a phone); in that case the email is read from the file too.
 */
export function credentials(env: Env): { email: string; key: string } | null {
  const raw = (env.GSC_PRIVATE_KEY ?? "").trim();
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
      const email = env.GSC_CLIENT_EMAIL || j.client_email;
      return email && j.private_key ? { email, key: j.private_key } : null;
    } catch { return null; }
  }
  return env.GSC_CLIENT_EMAIL && raw ? { email: env.GSC_CLIENT_EMAIL, key: raw } : null;
}

export const gscConfigured = (env: Env) => credentials(env) !== null;
const site = (env: Env) => env.GSC_SITE || "sc-domain:vocalzz.com";

// --- Auth: a signed JWT exchanged for a 1-hour access token, cached per worker instance. ---

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = (s: string) => b64url(new TextEncoder().encode(s));

/** The DER bytes inside a PEM private key. Accepts keys pasted with literal "\n" sequences too. */
export function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) [A-Z ]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cached: { token: string; exp: number; email: string } | null = null;

async function accessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cred = credentials(env);
  if (!cred) throw new Error("Search Console keys are missing or not readable. Check GSC_PRIVATE_KEY in Cloudflare.");
  if (cached && cached.email === cred.email && cached.exp - 60 > now) return cached.token;
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlText(JSON.stringify({ iss: cred.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(cred.key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed: ${data.error_description || data.error || `HTTP ${res.status}`}`);
  cached = { token: data.access_token, exp: now + (data.expires_in ?? 3600), email: cred.email };
  return data.access_token;
}

// --- Search Analytics queries ---

export interface Row { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
interface Query { startDate: string; endDate: string; dimensions?: string[]; rowLimit?: number; nonBrand?: boolean }

async function query(env: Env, token: string, q: Query): Promise<Row[]> {
  const body: Record<string, unknown> = { startDate: q.startDate, endDate: q.endDate, dimensions: q.dimensions ?? [], rowLimit: q.rowLimit ?? 1000, dataState: "final" };
  if (q.nonBrand) body.dimensionFilterGroups = [{ groupType: "and", filters: BRAND_WORDS.map((w) => ({ dimension: "query", operator: "notContains", expression: w })) }];
  const res = await fetch(`${API}/${encodeURIComponent(site(env))}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { rows?: Row[]; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Search Console error (HTTP ${res.status})`);
  return data.rows ?? [];
}

export interface Totals { clicks: number; impressions: number; ctr: number; position: number }
const zero: Totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
const totalsOf = (rows: Row[]): Totals => (rows[0] ? { clicks: rows[0].clicks, impressions: rows[0].impressions, ctr: rows[0].ctr, position: rows[0].position } : zero);

/** Current and previous periods of `days` days, ending 2 days ago (Search Console data lags about 2 days). */
export function periods(today: string, days: number) {
  const end = addDays(today, -2);
  const start = addDays(end, -(days - 1));
  return { cur: { start, end }, prev: { start: addDays(start, -days), end: addDays(start, -1) } };
}

export const isBrand = (q: string) => BRAND_WORDS.some((w) => q.toLowerCase().includes(w));

/** Page path for display, e.g. "https://vocalzz.com/blog/x/" -> "/blog/x/". */
export const pathOf = (url: string) => { try { return new URL(url).pathname; } catch { return url; } };

/** The latest day Search Console has final data for (about 2 days ago), and the earliest it keeps (16 months). */
export const latestDay = (today: string) => addDays(today, -2);
export const earliestDay = (today: string) => addDays(today, -480);

const validDay = (d: string | undefined) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(`${d}T00:00:00Z`));
const spanDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

export interface Range { start: string; end: string; days: number; preset: number | null; note?: string }

/**
 * The period to show: a custom from/to (clamped to what Search Console keeps), or a preset of 7/28/90 days
 * ending at the latest available day. Bad or missing dates fall back to the last 28 days.
 */
export function resolveRange(today: string, q: { days?: string; from?: string; to?: string }): Range {
  const last = latestDay(today), first = earliestDay(today);
  if (validDay(q.from) || validDay(q.to)) {
    let start = validDay(q.from) ? q.from! : (validDay(q.to) ? q.to! : last);
    let end = validDay(q.to) ? q.to! : last;
    if (start > end) [start, end] = [end, start];
    let note: string | undefined;
    if (end > last) { end = last; note = `Search Console has data up to ${last} so far, so the range ends there.`; }
    if (start < first) { start = first; note = "Search Console keeps about 16 months, so the range starts at the earliest available day."; }
    if (start > end) start = end;
    return { start, end, days: spanDays(start, end), preset: null, note };
  }
  const d = Number(q.days);
  const days = [7, 28, 90].includes(d) ? d : 28;
  return { start: addDays(last, -(days - 1)), end: last, days, preset: days };
}

/** The period of the same length just before. */
export const previousOf = (r: { start: string; days: number }) => ({ start: addDays(r.start, -r.days), end: addDays(r.start, -1) });

export interface DayRow { date: string; clicks: number; impressions: number }
export interface SeoReport {
  range: Range;
  cur: { start: string; end: string };
  prev: { start: string; end: string };
  total: Totals; totalPrev: Totals;
  nonBrand: Totals; nonBrandPrev: Totals;
  daily: DayRow[];
  queries: Row[];
  pages: Row[];
}

/** One row per day from start to end, filling days with no data with zeros. */
export function fillDays(start: string, end: string, rows: Row[]): DayRow[] {
  const by = new Map(rows.map((r) => [r.keys[0], r]));
  const out: DayRow[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const r = by.get(d);
    out.push({ date: d, clicks: r?.clicks ?? 0, impressions: r?.impressions ?? 0 });
  }
  return out;
}

export async function seoReport(env: Env, range: Range): Promise<SeoReport> {
  const cur = { start: range.start, end: range.end }, prev = previousOf(range);
  const token = await accessToken(env);
  const c = { startDate: cur.start, endDate: cur.end }, v = { startDate: prev.start, endDate: prev.end };
  const [total, totalPrev, nonBrand, nonBrandPrev, daily, queries, pages] = await Promise.all([
    query(env, token, c), query(env, token, v),
    query(env, token, { ...c, nonBrand: true }), query(env, token, { ...v, nonBrand: true }),
    query(env, token, { ...c, dimensions: ["date"], rowLimit: 500 }),
    query(env, token, { ...c, dimensions: ["query"], rowLimit: 100 }),
    query(env, token, { ...c, dimensions: ["page"], rowLimit: 50 }),
  ]);
  return {
    range, cur, prev,
    total: totalsOf(total), totalPrev: totalsOf(totalPrev), nonBrand: totalsOf(nonBrand), nonBrandPrev: totalsOf(nonBrandPrev),
    daily: fillDays(cur.start, cur.end, daily),
    queries: queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions),
    pages: pages.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions),
  };
}
