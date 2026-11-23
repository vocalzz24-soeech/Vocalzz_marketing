// "SEO report" admin page: how the website does in Google search (Search Console data, read-only).
import { html } from "hono/html";
import type { User } from "./auth.ts";
import { isBrand, pathOf, type DayRow, type Range, type Row, type SeoReport, type Totals } from "./search-console.ts";
import { shortDate } from "./report.ts";
import { layout } from "./views.ts";

export const CSS = `.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.tile span{display:block;font-size:13px;color:var(--muted)}.tile b{font-size:24px}
.up{color:var(--ok)}.down{color:var(--bad)}.chg{font-size:12px;margin-left:4px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.seg a{padding:8px 12px;text-decoration:none;color:var(--ink)}.seg a.on{background:var(--brand);color:var(--brand-ink)}
.range-form{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:10px 0 0}.range-form label{font-size:12px;color:var(--muted);display:block;margin:0 0 2px}.range-form input{margin:0}.range-form button{margin:0}
.viz{--bar-fill:#1f6fd1;--grid:#e1e0d9}
@media (prefers-color-scheme:dark){.viz{--bar-fill:#3f8ee8;--grid:#243044}}
.daychart{width:100%;height:auto;display:block}.daychart rect.b{fill:var(--bar-fill)}.daychart rect.hit{fill:transparent;cursor:pointer}.daychart a:hover rect.b,.daychart a:focus rect.b{opacity:.75}
.daychart line{stroke:var(--grid);stroke-width:1}.daychart text{fill:var(--muted);font-size:13px}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
tr.sel td{background:var(--bg);font-weight:700}
.tbl-wrap{overflow-x:auto}td.n,th.n{text-align:right;white-space:nowrap}.brand{font-size:11px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 5px;margin-left:4px;color:var(--muted)}`;

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pos = (x: number) => (x ? x.toFixed(1) : "–");

/** Change vs previous period. For position, lower is better. */
function change(cur: number, prev: number, lowerIsBetter = false) {
  if (!prev && !cur) return "";
  if (!prev) return html`<span class="chg up">new</span>`;
  const d = cur - prev;
  if (Math.abs(d) < (lowerIsBetter ? 0.05 : 0.5)) return html`<span class="chg muted">same</span>`;
  const good = lowerIsBetter ? d < 0 : d > 0;
  const text = lowerIsBetter ? `${d > 0 ? "+" : ""}${d.toFixed(1)}` : `${d > 0 ? "+" : ""}${Math.round((100 * d) / prev)}%`;
  return html`<span class="chg ${good ? "up" : "down"}">${text}</span>`;
}

function tiles(label: string, t: Totals, p: Totals) {
  return html`<h2 style="margin:16px 0 0">${label}</h2><div class="tiles">
<div class="tile"><span>Clicks to the website</span><b>${t.clicks}</b>${change(t.clicks, p.clicks)}</div>
<div class="tile"><span>Times shown in Google</span><b>${t.impressions}</b>${change(t.impressions, p.impressions)}</div>
<div class="tile"><span>Click rate</span><b>${pct(t.ctr)}</b></div>
<div class="tile"><span>Average position</span><b>${pos(t.position)}</b>${change(t.position, p.position, true)}</div>
</div>`;
}

function table(rows: Row[], first: string, label: (r: Row) => unknown, empty: string) {
  return rows.length ? html`<div class="tbl-wrap"><table><tr><th>${first}</th><th class="n">Clicks</th><th class="n">Shown</th><th class="n">Position</th></tr>
${rows.map((r) => html`<tr><td>${label(r)}</td><td class="n">${r.clicks}</td><td class="n">${r.impressions}</td><td class="n">${pos(r.position)}</td></tr>`)}</table></div>`
    : html`<p class="muted">${empty}</p>`;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dayLabel = (d: string) => `${DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${shortDate(d)}`;
const dayLink = (d: string) => `/seo?from=${d}&to=${d}`;

/** One bar per day for one measure. Each bar links to that single day, with a tooltip. One axis, one series. */
export function barChart<T extends { date: string }>(title: string, days: T[], get: (d: T) => number, unit: string, link: (d: string) => string, fmt: (n: number) => string = String) {
  const W = 400, H = 150, top = 16, bottom = 24, left = 34;
  const max = Math.max(...days.map(get), 0) || 1;
  const step = (W - left) / days.length;
  const bw = Math.max(2, Math.min(28, step - 2));
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const every = Math.ceil(days.length / 5);
  return html`<div class="card"><h3 style="margin:0 0 6px">${title} per day</h3>
<svg class="daychart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} per day, ${days.length} days">
<line x1="${left}" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"></line>
<text x="${left - 4}" y="${top + 4}" text-anchor="end">${fmt(max)}</text><text x="${left - 4}" y="${H - bottom}" text-anchor="end">0</text>
${days.map((d, i) => {
    const v = get(d), x = left + i * step + (step - bw) / 2, h = (H - bottom) - y(v);
    return html`<a href="${link(d.date)}"><title>${dayLabel(d.date)}: ${fmt(v)} ${unit}</title>
<rect class="hit" x="${left + i * step}" y="${top}" width="${step}" height="${H - top - bottom}"></rect>
${v ? html`<rect class="b" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="${Math.min(4, bw / 2).toFixed(1)}"></rect>` : ""}</a>
${i % every === 0 ? html`<text x="${(left + i * step + step / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${shortDate(d.date)}</text>` : ""}`;
  })}
</svg></div>`;
}

const dayChart = (title: string, days: DayRow[], key: "clicks" | "impressions") =>
  barChart(title, days, (d) => d[key], key === "clicks" ? "clicks" : "times shown", dayLink);

function dailySection(r: SeoReport) {
  if (r.daily.length < 2) return "";
  return html`<h2 style="margin:18px 0 6px">Day by day</h2>
<p class="muted" style="margin:0 0 8px">Tap a bar or a date to see that single day's searches and pages.</p>
<div class="viz"><div class="charts">${dayChart("Clicks", r.daily, "clicks")}${dayChart("Times shown", r.daily, "impressions")}</div></div>
<details class="card"><summary><strong>Show as a table</strong></summary><div class="tbl-wrap"><table><tr><th>Date</th><th class="n">Clicks</th><th class="n">Shown</th></tr>
${[...r.daily].reverse().map((d) => html`<tr><td><a href="${dayLink(d.date)}">${dayLabel(d.date)}</a></td><td class="n">${d.clicks}</td><td class="n">${d.impressions}</td></tr>`)}
</table></div></details>`;
}

export function seoPage(user: User, r: SeoReport | null, opts: { range: Range; latest: string; earliest: string; configured: boolean; error?: string; serviceEmail?: string }) {
  const g = opts.range;
  const link = (d: number) => html`<a class="${d === g.preset ? "on" : ""}" href="/seo?days=${d}">${d === 7 ? "Last 7 days" : d === 28 ? "Last 28 days" : "Last 3 months"}</a>`;
  return layout("SEO report", user, html`<style>${CSS}</style>
<h1>SEO report</h1>
<p class="muted" style="margin-top:-6px">How vocalzz.com does in normal (unpaid) Google search. Data from Google Search Console, about 2 days behind.</p>
<span class="seg">${link(7)}${link(28)}${link(90)}</span>
<form class="range-form" method="get" action="/seo">
<div><label for="from">From</label><input id="from" type="date" name="from" value="${g.start}" min="${opts.earliest}" max="${opts.latest}"></div>
<div><label for="to">To</label><input id="to" type="date" name="to" value="${g.end}" min="${opts.earliest}" max="${opts.latest}"></div>
<button class="secondary">Show</button>
${g.preset === null ? html`<a class="btn secondary small" href="/seo" style="align-self:center">Reset</a>` : ""}
</form>
${g.note ? html`<p class="muted" style="margin:6px 0 0">${g.note}</p>` : ""}
${!opts.configured ? html`<div class="card" style="margin-top:12px"><strong>Not connected yet.</strong>
<p>Add the Search Console key in Cloudflare as the secret <strong>GSC_PRIVATE_KEY</strong> (paste the whole downloaded .json file). Steps: appointments/docs/search-console-setup.md.</p>
<p class="muted">Just added it? Cloudflare can take a minute or two to apply a new secret. Reload this page.</p></div>` : ""}
${opts.error ? html`<div class="flash error" style="margin-top:12px">Google said: ${opts.error}
${/permission|forbidden|not have/i.test(opts.error) && opts.serviceEmail ? html`<br>Check that <strong>${opts.serviceEmail}</strong> is added as a user in Search Console → Settings → Users and permissions.` : ""}</div>` : ""}
${r ? html`
<p class="muted">${r.cur.start === r.cur.end ? html`<strong>${dayLabel(r.cur.start)}</strong>, compared with ${dayLabel(r.prev.start)}.` : html`${shortDate(r.cur.start)} – ${shortDate(r.cur.end)} (${r.range.days} days), compared with ${shortDate(r.prev.start)} – ${shortDate(r.prev.end)}.`}</p>
${tiles("All searches", r.total, r.totalPrev)}
${tiles("New people (searches without the name “Vocalzz”)", r.nonBrand, r.nonBrandPrev)}
<p class="muted">The second row is what SEO work grows: people who didn't know the clinic's name yet.</p>
${dailySection(r)}
<div class="card"><h2 style="margin-top:0">What people searched</h2>
${table(r.queries, "Search", (x) => html`${x.keys[0]}${isBrand(x.keys[0]) ? html`<span class="brand">name</span>` : ""}`, "No searches in this period yet.")}
<p class="muted" style="margin:8px 0 0">Position 1–3 = top of page 1; 10+ = page 2 or lower. Google hides very rare searches for privacy, so totals can be higher than the list.</p></div>
<div class="card"><h2 style="margin-top:0">Pages people landed on</h2>
${table(r.pages, "Page", (x) => html`<a href="${x.keys[0]}" target="_blank" rel="noopener">${pathOf(x.keys[0])}</a>`, "No pages shown in search in this period yet.")}</div>` : ""}
`);
}
