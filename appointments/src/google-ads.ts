// Google Ads report for the admin "Google Ads" page. Read-only, through the same Google Cloud service account as the
// SEO report (key in the GSC_PRIVATE_KEY secret). The service account is added as a Read-only user on the Ads account.
//   GADS_CUSTOMER_ID        account to read, digits only (wrangler.toml var), e.g. 8983920631
//   GADS_LOGIN_CUSTOMER_ID  optional manager account id, only if access comes through the manager
//   GADS_DEVELOPER_TOKEN    optional secret; sent only if set (Google says it is no longer required)
//   GADS_API_VERSION        optional, e.g. "v23"; otherwise the newest working version is found automatically
import type { Env } from "./env.ts";
import { addDays } from "./schedule.ts";
import { googleToken } from "./search-console.ts";

const SCOPE = "https://www.googleapis.com/auth/adwords";
const HOST = "https://googleads.googleapis.com";
/** Versions to try, newest first, when GADS_API_VERSION is not set. Unknown versions answer 404 and are skipped. */
const VERSIONS = Array.from({ length: 14 }, (_, i) => `v${30 - i}`);
let workingVersion: string | null = null;

const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
export const customerId = (env: Env) => digits(env.GADS_CUSTOMER_ID) || "8983920631";

// --- Dates: Ads data is close to live, so the range can end today. ---

const validDay = (d: string | undefined) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(`${d}T00:00:00Z`));
const spanDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
export const adsEarliest = (today: string) => addDays(today, -730);

export interface AdsRange { start: string; end: string; days: number; preset: string | null; note?: string }

/** Presets: today, yesterday, last 7 / 28 days (ending today), or a custom from/to. Default: last 7 days. */
export function resolveAdsRange(today: string, q: { p?: string; from?: string; to?: string }): AdsRange {
  const first = adsEarliest(today);
  if (validDay(q.from) || validDay(q.to)) {
    let start = validDay(q.from) ? q.from! : q.to!;
    let end = validDay(q.to) ? q.to! : today;
    if (start > end) [start, end] = [end, start];
    let note: string | undefined;
    if (end > today) { end = today; note = "The range can't go past today, so it ends today."; }
    if (start < first) { start = first; note = "The range starts at the earliest day available."; }
    if (start > end) start = end;
    return { start, end, days: spanDays(start, end), preset: null, note };
  }
  if (q.p === "today") return { start: today, end: today, days: 1, preset: "today" };
  if (q.p === "yesterday") { const y = addDays(today, -1); return { start: y, end: y, days: 1, preset: "yesterday" }; }
  const n = q.p === "28" ? 28 : 7;
  return { start: addDays(today, -(n - 1)), end: today, days: n, preset: String(n) };
}
export const previousAds = (r: { start: string; days: number }) => ({ start: addDays(r.start, -r.days), end: addDays(r.start, -1) });

// --- API calls ---

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(env: Env, token: string, version: string, body: Json): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (env.GADS_DEVELOPER_TOKEN) headers["developer-token"] = env.GADS_DEVELOPER_TOKEN.trim();
  if (digits(env.GADS_LOGIN_CUSTOMER_ID)) headers["login-customer-id"] = digits(env.GADS_LOGIN_CUSTOMER_ID);
  return fetch(`${HOST}/${version}/customers/${customerId(env)}/googleAds:search`, { method: "POST", headers, body: JSON.stringify(body) });
}

/** Explains a Google Ads API error in plain words where we can, with Google's own message. */
export function explain(status: number, body: Json): string {
  const err = body?.error ?? (Array.isArray(body) ? body[0]?.error : undefined) ?? {};
  const details = JSON.stringify(err.details ?? "");
  const msg: string = err.message || `HTTP ${status}`;
  if (/DEVELOPER_TOKEN_PARAMETER_MISSING|developer.token/i.test(details + msg)) return `Google asks for the developer token: add it in Cloudflare as the secret GADS_DEVELOPER_TOKEN. (${msg})`;
  if (/USER_PERMISSION_DENIED|PERMISSION_DENIED/.test(details + msg) || status === 403) return `No permission for this Ads account. Check the service account is a user on the account (Admin → Access and security → Users). (${msg})`;
  if (/NOT_ADS_USER|CUSTOMER_NOT_FOUND/.test(details)) return `Google doesn't see this account for the service account. (${msg})`;
  return msg;
}

/** Runs one GAQL query and returns all result rows (follows pages). Finds a working API version on first use. */
export async function search(env: Env, token: string, gaql: string): Promise<Json[]> {
  const versions = env.GADS_API_VERSION ? [env.GADS_API_VERSION] : workingVersion ? [workingVersion] : VERSIONS;
  for (const v of versions) {
    const rows: Json[] = [];
    let pageToken: string | undefined;
    let res = await call(env, token, v, { query: gaql });
    if (res.status === 404 && versions.length > 1) continue; // version doesn't exist (yet / any more)
    for (;;) {
      const body = (await res.json().catch(() => ({}))) as Json;
      if (!res.ok) throw new Error(explain(res.status, body));
      workingVersion = v;
      rows.push(...((body.results as Json[]) ?? []));
      pageToken = body.nextPageToken;
      if (!pageToken) return rows;
      res = await call(env, token, v, { query: gaql, pageToken });
    }
  }
  throw new Error("Couldn't find a working Google Ads API version. Set GADS_API_VERSION in Cloudflare (e.g. v23).");
}

// --- Report ---

export interface Metrics { cost: number; clicks: number; impressions: number; conversions: number }
const num = (x: unknown) => Number(x ?? 0) || 0;
export const metricsOf = (m: Json | undefined): Metrics => ({ cost: num(m?.costMicros) / 1e6, clicks: num(m?.clicks), impressions: num(m?.impressions), conversions: num(m?.conversions) });
export const sumMetrics = (rows: Metrics[]): Metrics => rows.reduce((a, b) => ({ cost: a.cost + b.cost, clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions, conversions: a.conversions + b.conversions }), { cost: 0, clicks: 0, impressions: 0, conversions: 0 });

export interface AdsDay extends Metrics { date: string }
export interface AdGroupLine extends Metrics { name: string; status: string }
export interface KeywordLine extends Metrics { group: string; text: string; match: string; status: string }
export interface TermLine extends Metrics { group: string; term: string }
export interface ConvLine { action: string; conversions: number }
export interface AdsReport {
  range: AdsRange; prev: { start: string; end: string };
  total: Metrics; totalPrev: Metrics;
  daily: AdsDay[]; groups: AdGroupLine[]; keywords: KeywordLine[]; terms: TermLine[]; conv: ConvLine[];
}

const M = "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions";
const between = (a: string, b: string) => `segments.date BETWEEN '${a}' AND '${b}'`;
const byActivity = (a: Metrics, b: Metrics) => b.conversions - a.conversions || b.clicks - a.clicks || b.impressions - a.impressions;

export function fillAdsDays(start: string, end: string, rows: AdsDay[]): AdsDay[] {
  const by = new Map(rows.map((r) => [r.date, r]));
  const out: AdsDay[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(by.get(d) ?? { date: d, cost: 0, clicks: 0, impressions: 0, conversions: 0 });
  return out;
}

export async function adsReport(env: Env, range: AdsRange): Promise<AdsReport> {
  const prev = previousAds(range);
  const token = await googleToken(env, SCOPE);
  const cur = between(range.start, range.end);
  // First call alone, so the API version is found once before the parallel calls.
  const daily = await search(env, token, `SELECT segments.date, ${M} FROM customer WHERE ${cur}`);
  const [prevRows, groups, keywords, terms, conv] = await Promise.all([
    search(env, token, `SELECT ${M} FROM customer WHERE ${between(prev.start, prev.end)}`),
    search(env, token, `SELECT ad_group.name, ad_group.status, ${M} FROM ad_group WHERE ${cur} AND campaign.advertising_channel_type = 'SEARCH'`),
    search(env, token, `SELECT ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ${M} FROM keyword_view WHERE ${cur} AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'`),
    search(env, token, `SELECT ad_group.name, search_term_view.search_term, ${M} FROM search_term_view WHERE ${cur} ORDER BY metrics.impressions DESC LIMIT 200`),
    search(env, token, `SELECT segments.conversion_action_name, metrics.conversions FROM customer WHERE ${cur}`),
  ]);
  const days = daily.map((r) => ({ date: String(r.segments?.date), ...metricsOf(r.metrics) }));
  return {
    range, prev,
    total: sumMetrics(days), totalPrev: sumMetrics(prevRows.map((r) => metricsOf(r.metrics))),
    daily: fillAdsDays(range.start, range.end, days),
    groups: groups.map((r) => ({ name: String(r.adGroup?.name ?? ""), status: String(r.adGroup?.status ?? ""), ...metricsOf(r.metrics) })).sort(byActivity),
    keywords: keywords.map((r) => ({ group: String(r.adGroup?.name ?? ""), text: String(r.adGroupCriterion?.keyword?.text ?? ""), match: String(r.adGroupCriterion?.keyword?.matchType ?? ""), status: String(r.adGroupCriterion?.status ?? ""), ...metricsOf(r.metrics) })).sort(byActivity),
    terms: terms.map((r) => ({ group: String(r.adGroup?.name ?? ""), term: String(r.searchTermView?.searchTerm ?? ""), ...metricsOf(r.metrics) })).sort(byActivity),
    conv: conv.map((r) => ({ action: String(r.segments?.conversionActionName ?? ""), conversions: num(r.metrics?.conversions) })).filter((c) => c.conversions > 0).sort((a, b) => b.conversions - a.conversions),
  };
}
