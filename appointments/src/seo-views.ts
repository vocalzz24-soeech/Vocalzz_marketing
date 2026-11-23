// "SEO report" admin page: how the website does in Google search (Search Console data, read-only).
import { html } from "hono/html";
import type { User } from "./auth.ts";
import { isBrand, pathOf, type Row, type SeoReport, type Totals } from "./search-console.ts";
import { shortDate } from "./report.ts";
import { layout } from "./views.ts";

const CSS = `.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.tile span{display:block;font-size:13px;color:var(--muted)}.tile b{font-size:24px}
.up{color:var(--ok)}.down{color:var(--bad)}.chg{font-size:12px;margin-left:4px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.seg a{padding:8px 12px;text-decoration:none;color:var(--ink)}.seg a.on{background:var(--brand);color:var(--brand-ink)}
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

export function seoPage(user: User, r: SeoReport | null, opts: { days: number; configured: boolean; error?: string; serviceEmail?: string }) {
  const link = (d: number) => html`<a class="${d === opts.days ? "on" : ""}" href="/seo?days=${d}">${d === 7 ? "Last 7 days" : d === 28 ? "Last 28 days" : "Last 3 months"}</a>`;
  return layout("SEO report", user, html`<style>${CSS}</style>
<h1>SEO report</h1>
<p class="muted" style="margin-top:-6px">How vocalzz.com does in normal (unpaid) Google search. Data from Google Search Console, about 2 days behind.</p>
<span class="seg">${link(7)}${link(28)}${link(90)}</span>
${!opts.configured ? html`<div class="card" style="margin-top:12px"><strong>Not connected yet.</strong>
<p>Add the Search Console key in Cloudflare as the secret <strong>GSC_PRIVATE_KEY</strong> (paste the whole downloaded .json file). Steps: appointments/docs/search-console-setup.md.</p>
<p class="muted">Just added it? Cloudflare can take a minute or two to apply a new secret. Reload this page.</p></div>` : ""}
${opts.error ? html`<div class="flash error" style="margin-top:12px">Google said: ${opts.error}
${/permission|forbidden|not have/i.test(opts.error) && opts.serviceEmail ? html`<br>Check that <strong>${opts.serviceEmail}</strong> is added as a user in Search Console → Settings → Users and permissions.` : ""}</div>` : ""}
${r ? html`
<p class="muted">${shortDate(r.cur.start)} – ${shortDate(r.cur.end)}, compared with ${shortDate(r.prev.start)} – ${shortDate(r.prev.end)}.</p>
${tiles("All searches", r.total, r.totalPrev)}
${tiles("New people (searches without the name “Vocalzz”)", r.nonBrand, r.nonBrandPrev)}
<p class="muted">The second row is what SEO work grows: people who didn't know the clinic's name yet.</p>
<div class="card"><h2 style="margin-top:0">What people searched</h2>
${table(r.queries, "Search", (x) => html`${x.keys[0]}${isBrand(x.keys[0]) ? html`<span class="brand">name</span>` : ""}`, "No searches in this period yet.")}
<p class="muted" style="margin:8px 0 0">Position 1–3 = top of page 1; 10+ = page 2 or lower. Google hides very rare searches for privacy, so totals can be higher than the list.</p></div>
<div class="card"><h2 style="margin-top:0">Pages people landed on</h2>
${table(r.pages, "Page", (x) => html`<a href="${x.keys[0]}" target="_blank" rel="noopener">${pathOf(x.keys[0])}</a>`, "No pages shown in search in this period yet.")}</div>` : ""}
`);
}
