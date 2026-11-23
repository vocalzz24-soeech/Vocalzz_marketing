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

export const gscConfigured = (env: Env) => !!(env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY);
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
  if (cached && cached.email === env.GSC_CLIENT_EMAIL && cached.exp - 60 > now) return cached.token;
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlText(JSON.stringify({ iss: env.GSC_CLIENT_EMAIL, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(env.GSC_PRIVATE_KEY!), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed: ${data.error_description || data.error || `HTTP ${res.status}`}`);
  cached = { token: data.access_token, exp: now + (data.expires_in ?? 3600), email: env.GSC_CLIENT_EMAIL! };
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

export interface SeoReport {
  days: number;
  cur: { start: string; end: string };
  prev: { start: string; end: string };
  total: Totals; totalPrev: Totals;
  nonBrand: Totals; nonBrandPrev: Totals;
  queries: Row[];
  pages: Row[];
}

export async function seoReport(env: Env, today: string, days: number): Promise<SeoReport> {
  const p = periods(today, days);
  const token = await accessToken(env);
  const c = { startDate: p.cur.start, endDate: p.cur.end }, v = { startDate: p.prev.start, endDate: p.prev.end };
  const [total, totalPrev, nonBrand, nonBrandPrev, queries, pages] = await Promise.all([
    query(env, token, c), query(env, token, v),
    query(env, token, { ...c, nonBrand: true }), query(env, token, { ...v, nonBrand: true }),
    query(env, token, { ...c, dimensions: ["query"], rowLimit: 100 }),
    query(env, token, { ...c, dimensions: ["page"], rowLimit: 50 }),
  ]);
  return {
    days, cur: p.cur, prev: p.prev,
    total: totalsOf(total), totalPrev: totalsOf(totalPrev), nonBrand: totalsOf(nonBrand), nonBrandPrev: totalsOf(nonBrandPrev),
    queries: queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions),
    pages: pages.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions),
  };
}
