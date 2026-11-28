// "Google Ads" admin page: results of the clinic's own Google Ads account (read-only).
import { html } from "hono/html";
import type { User } from "./auth.ts";
import { clickTypeLabel, type AdsRange, type AdsReport, type Metrics } from "./google-ads.ts";
import { shortDate } from "./report.ts";
import { barChart, CSS, dayLabel } from "./seo-views.ts";
import { layout } from "./views.ts";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
const cnt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const ctr = (m: Metrics) => (m.impressions ? `${((100 * m.clicks) / m.impressions).toFixed(1)}%` : "–");
const cpc = (m: Metrics) => (m.clicks ? inr(m.cost / m.clicks) : "–");
const cpa = (m: Metrics) => (m.conversions ? inr(m.cost / m.conversions) : "–");
const dayLink = (d: string) => `/ads?from=${d}&to=${d}`;
const MATCH: Record<string, string> = { EXACT: "exact", PHRASE: "phrase", BROAD: "broad" };
const STATUS: Record<string, string> = { ENABLED: "", PAUSED: "paused", REMOVED: "removed" };

/** Change vs previous period; for cost, "more" is neutral, so it is shown without good/bad colour. */
function change(cur: number, prev: number, neutral = false) {
  if (!prev && !cur) return "";
  if (!prev) return html`<span class="chg muted">new</span>`;
  const d = cur - prev;
  if (Math.abs(d) < 0.005 * Math.max(1, prev)) return html`<span class="chg muted">same</span>`;
  const t = `${d > 0 ? "+" : ""}${Math.round((100 * d) / prev)}%`;
  return html`<span class="chg ${neutral ? "muted" : d > 0 ? "up" : "down"}">${t}</span>`;
}

function rowCells(m: Metrics) {
  return html`<td class="n">${m.impressions}</td><td class="n">${m.clicks}</td><td class="n">${ctr(m)}</td><td class="n">${inr(m.cost)}</td><td class="n">${m.conversions ? html`<strong>${cnt(m.conversions)}</strong>` : "0"}</td><td class="n">${cpa(m)}</td>`;
}
const HEAD = html`<th class="n">Shown</th><th class="n">Clicks</th><th class="n">Click rate</th><th class="n">Cost</th><th class="n">Conv.</th><th class="n">Cost/conv.</th>`;

/** A patient recorded as coming from a Google ad (booking app data, not Google's). */
export interface AdLead { id: number; name: string; enquiry_date: string | null; enquiry_time: string | null; ad_group: string | null; ad_click_type: string | null; ad_match: string | null; stage: string; hold_status: string | null }

function leadsCard(leads: AdLead[]) {
  const by = new Map<string, number>();
  for (const l of leads) by.set(l.ad_group ?? "Not matched yet", (by.get(l.ad_group ?? "Not matched yet") ?? 0) + 1);
  const status = (l: AdLead) => (l.stage === "closed" ? "Not going ahead" : l.hold_status === "hold" ? "On hold" : l.hold_status === "talking" ? "In talks" : l.stage === "consultation" ? "New" : "Active");
  return html`<div class="card"><h2 style="margin-top:0">Patients from ads (your records)</h2>
${leads.length ? html`<p style="margin:0 0 8px"><strong>${leads.length}</strong> patient${leads.length === 1 ? "" : "s"} marked "Google ad" in this period: ${[...by].map(([g, n], i) => html`${i ? " · " : ""}${g} <strong>${n}</strong>`)}</p>
<div class="tbl-wrap"><table><tr><th>Patient</th><th>Contacted</th><th>Ad group</th><th>Type of click</th><th>Status</th></tr>
${leads.map((l) => html`<tr><td><a href="/patients/${l.id}/summary">${l.name}</a></td><td>${l.enquiry_date ? shortDate(l.enquiry_date) : "–"}${l.enquiry_time ? ` ${l.enquiry_time}` : ""}</td>
<td>${l.ad_group ? html`${l.ad_group}${l.ad_match === "confirmed" ? "" : html` <span class="brand">likely</span>`}` : html`<a href="/patients/${l.id}/ad-match">Match ad click</a>`}</td><td>${clickTypeLabel(l.ad_click_type)}</td><td>${status(l)}</td></tr>`)}</table></div>`
    : html`<p class="muted" style="margin:0">No patients marked "How did they hear about us: Google ad" in this period.</p>`}
<p class="muted" style="margin:8px 0 0">These are real enquiries from the Patients page. Google's "Conversions" misses most calls, so this is the truer count.</p></div>`;
}

export function adsPage(user: User, r: AdsReport | null, opts: { range: AdsRange; today: string; earliest: string; configured: boolean; error?: string; leads?: AdLead[] }) {
  const g = opts.range;
  const preset = (key: string, label: string) => html`<a class="${key === g.preset ? "on" : ""}" href="/ads?p=${key}">${label}</a>`;
  return layout("Google Ads", user, html`<style>${CSS}</style>
<h1>Google Ads</h1>
<p class="muted" style="margin-top:-6px">Paid search ads (account 898-392-0631). Numbers are close to live (refreshed every 5 minutes for today, hourly for past days); conversions can take a few hours to appear. <a href="?${g.preset !== null ? `p=${g.preset}` : `from=${g.start}&to=${g.end}`}&fresh=1">Refresh now</a></p>
<span class="seg">${preset("today", "Today")}${preset("yesterday", "Yesterday")}${preset("7", "Last 7 days")}${preset("28", "Last 28 days")}</span>
<form class="range-form" method="get" action="/ads">
<div><label for="from">From</label><input id="from" type="date" name="from" value="${g.start}" min="${opts.earliest}" max="${opts.today}"></div>
<div><label for="to">To</label><input id="to" type="date" name="to" value="${g.end}" min="${opts.earliest}" max="${opts.today}"></div>
<button class="secondary">Show</button>
${g.preset === null ? html`<a class="btn secondary small" href="/ads" style="align-self:center">Reset</a>` : ""}
</form>
${g.note ? html`<p class="muted" style="margin:6px 0 0">${g.note}</p>` : ""}
${!opts.configured ? html`<div class="card" style="margin-top:12px"><strong>Not connected yet.</strong>
<p>This page uses the same Google key as the SEO report (GSC_PRIVATE_KEY in Cloudflare), and the service account must be a user on the Ads account.</p></div>` : ""}
${opts.error ? html`<div class="flash error" style="margin-top:12px">Google said: ${opts.error}</div>` : ""}
${r ? html`
<p class="muted">${r.range.start === r.range.end ? html`<strong>${dayLabel(r.range.start)}</strong>, compared with ${dayLabel(r.prev.start)}.` : html`${shortDate(r.range.start)} – ${shortDate(r.range.end)} (${r.range.days} days), compared with ${shortDate(r.prev.start)} – ${shortDate(r.prev.end)}.`}</p>
<div class="tiles">
<div class="tile"><span>Spend</span><b>${inr(r.total.cost)}</b>${change(r.total.cost, r.totalPrev.cost, true)}</div>
<div class="tile"><span>Clicks</span><b>${r.total.clicks}</b>${change(r.total.clicks, r.totalPrev.clicks)}</div>
<div class="tile"><span>Times shown</span><b>${r.total.impressions}</b>${change(r.total.impressions, r.totalPrev.impressions)}</div>
<div class="tile"><span>Click rate</span><b>${ctr(r.total)}</b></div>
<div class="tile"><span>Avg. cost per click</span><b>${cpc(r.total)}</b></div>
<div class="tile"><span>Conversions</span><b>${cnt(r.total.conversions)}</b>${change(r.total.conversions, r.totalPrev.conversions)}</div>
<div class="tile"><span>Cost per conversion</span><b>${cpa(r.total)}</b></div>
</div>
${leadsCard(opts.leads ?? [])}
${r.conv.length ? html`<p class="muted" style="margin:-4px 0 12px">Conversions by type: ${r.conv.map((c, i) => html`${i ? " · " : ""}${c.action} <strong>${cnt(c.conversions)}</strong>`)}</p>` : ""}
${r.daily.length > 1 ? html`<h2 style="margin:18px 0 6px">Day by day</h2>
<p class="muted" style="margin:0 0 8px">Tap a bar or a date to see that single day.</p>
<div class="viz"><div class="charts">
${barChart("Spend", r.daily, (d) => d.cost, "spent", dayLink, (n) => inr(n))}
${barChart("Clicks", r.daily, (d) => d.clicks, "clicks", dayLink)}
</div></div>
<details class="card"><summary><strong>Show as a table</strong></summary><div class="tbl-wrap"><table><tr><th>Date</th>${HEAD}</tr>
${[...r.daily].reverse().map((d) => html`<tr><td><a href="${dayLink(d.date)}">${dayLabel(d.date)}</a></td>${rowCells(d)}</tr>`)}
</table></div></details>` : ""}
<div class="card"><h2 style="margin-top:0">Ad groups</h2>
${r.groups.length ? html`<div class="tbl-wrap"><table><tr><th>Ad group</th>${HEAD}</tr>
${r.groups.map((x) => html`<tr><td>${x.name}${STATUS[x.status] ? html` <span class="brand">${STATUS[x.status]}</span>` : ""}</td>${rowCells(x)}</tr>`)}</table></div>` : html`<p class="muted">No ad group activity in this period.</p>`}</div>
<div class="card"><h2 style="margin-top:0">Keywords</h2>
${r.keywords.length ? html`<div class="tbl-wrap"><table><tr><th>Keyword</th><th>Ad group</th>${HEAD}</tr>
${r.keywords.map((x) => html`<tr><td>${x.text} <span class="brand">${MATCH[x.match] ?? x.match.toLowerCase()}</span>${STATUS[x.status] ? html` <span class="brand">${STATUS[x.status]}</span>` : ""}</td><td class="muted">${x.group}</td>${rowCells(x)}</tr>`)}</table></div>` : html`<p class="muted">No keyword activity in this period.</p>`}
<p class="muted" style="margin:8px 0 0">Keywords you bid on (blocked "negative" words are not listed). Most active first.</p></div>
<div class="card"><h2 style="margin-top:0">What people searched</h2>
${r.terms.length ? html`<div class="tbl-wrap"><table><tr><th>Search</th><th>Ad group</th>${HEAD}</tr>
${r.terms.map((x) => html`<tr><td>${x.term}</td><td class="muted">${x.group}</td>${rowCells(x)}</tr>`)}</table></div>` : html`<p class="muted">No searches in this period yet.</p>`}
<p class="muted" style="margin:8px 0 0">The real words people typed before seeing an ad. Google hides very rare searches for privacy.</p></div>` : ""}
`);
}
