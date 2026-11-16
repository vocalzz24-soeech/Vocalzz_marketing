// Dashboard page: filters, headline numbers and charts, drawn as plain HTML/SVG on the server (no chart library).
import { html, raw } from "hono/html";
import type { User } from "./auth.ts";
import { attendance, PERIODS, rangeLabel, scheduled, shortDate, STATUSES, type Counts, type Report, type Status } from "./report.ts";
import { formatDateTime } from "./time.ts";
import { layout, type TherapistRow } from "./views.ts";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Categorical slots 1-5 in fixed order (validated for colour-blind separation in light and dark).
const CSS = `
.viz{--s-completed:#2a78d6;--s-no_show:#eb6834;--s-upcoming:#1baf7a;--s-unmarked:#eda100;--s-cancelled:#e87ba4;--grid:#e1e0d9;--axis:#c3c2b7;--surface:var(--card)}
@media (prefers-color-scheme:dark){.viz{--s-completed:#3987e5;--s-no_show:#d95926;--s-upcoming:#199e70;--s-unmarked:#c98500;--s-cancelled:#d55181;--grid:#2c2c2a;--axis:#383835}}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-bottom:12px}
.filters .seg a{white-space:nowrap}.filters .seg{flex-wrap:wrap}
.filters select,.filters input{width:auto;padding:6px 10px}
.filters .custom{display:flex;gap:6px;align-items:end;flex-wrap:wrap}
.filters .custom label{margin:0 0 2px;font-size:12px}
.report-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 16px;margin:6px 0 10px}
.report-head h2{margin:0}
.report-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.report-actions .btn,.report-actions button{margin:0;white-space:nowrap}.report-actions form{margin:0}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin-bottom:12px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.tile b{display:block;font-size:26px;line-height:1.15;font-variant-numeric:tabular-nums}
.tile span{font-size:13px;color:var(--muted)}
.tile i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:baseline}
.legend-row{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;font-size:13px;color:var(--muted)}
.legend-row span{display:inline-flex;align-items:center;gap:6px}.legend-row i{width:10px;height:10px;border-radius:3px;display:inline-block}
.segbar{display:flex;gap:2px;height:44px;border-radius:6px;overflow:hidden;background:var(--bg)}
.segbar div{display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;min-width:0}
.segbar div.dark-ink{color:#0b0b0b}
.hbar-list{display:flex;flex-direction:column;gap:10px}
.hbar{display:grid;grid-template-columns:minmax(90px,160px) minmax(0,1fr);gap:4px 12px;align-items:center}
.hbar .nm{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hbar .track{display:flex;align-items:center;gap:8px;min-width:0}
.hbar .bar{display:flex;gap:2px;height:20px;min-width:2px}
.hbar .bar div{height:100%}.hbar .bar div:last-child{border-radius:0 4px 4px 0}
.hbar .val{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:520px){.hbar{grid-template-columns:minmax(0,1fr)}}
.chart-svg{width:100%;height:auto;display:block}
.chart-svg text{fill:var(--muted);font-size:11px}
.tbl-wrap{overflow-x:auto}.tbl-wrap td.num,.tbl-wrap th.num{text-align:right;font-variant-numeric:tabular-nums}
.mini{display:flex;gap:1px;height:10px;width:120px;border-radius:3px;overflow:hidden;background:var(--bg)}
.empty-note{padding:18px;text-align:center;color:var(--muted)}
`;

const colour = (s: Status) => `var(--s-${s})`;
const darkInk = (s: Status) => s === "unmarked"; // black text on yellow, white elsewhere
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const statusText = (c: Counts) => STATUSES.filter((s) => c[s.key]).map((s) => `${s.label}: ${c[s.key]}`).join(" · ") || "No sessions";
const total = (c: Counts) => scheduled(c) + c.cancelled;

function legend(counts?: Counts) {
  return html`<div class="legend-row">${STATUSES.map((s) => html`<span><i style="background:${colour(s.key)}"></i>${s.label}${counts ? ` ${counts[s.key]}` : ""}</span>`)}</div>`;
}

/** Tall segmented bar: one whole (all sessions) split by status. Labels sit inside only where they fit. */
function statusSplit(c: Counts) {
  const all = total(c);
  if (!all) return html`<div class="empty-note">No sessions in this period.</div>`;
  return html`<div class="segbar" role="img" aria-label="${statusText(c)}">
${STATUSES.filter((s) => c[s.key]).map((s) => {
    const pct = (100 * c[s.key]) / all;
    return html`<div class="${darkInk(s.key) ? "dark-ink" : ""}" style="flex:${c[s.key]} 1 0;background:${colour(s.key)}" title="${s.label}: ${c[s.key]} (${Math.round(pct)}%)">${pct >= 9 ? c[s.key] : ""}</div>`;
  })}</div>${legend(c)}`;
}

/** Horizontal stacked bars, one per row, all on the same scale; total at the tip. */
function hbars(rows: { name: string; counts: Counts }[], max: number) {
  if (!rows.length) return html`<div class="empty-note">No sessions in this period.</div>`;
  return html`<div class="hbar-list">${rows.map((r) => {
    const t = total(r.counts);
    return html`<div class="hbar"><div class="nm" title="${r.name}">${r.name}</div>
<div class="track"><div class="bar" style="width:${max ? Math.max(1, (88 * t) / max) : 0}%" role="img" aria-label="${r.name}: ${statusText(r.counts)}">
${STATUSES.filter((s) => r.counts[s.key]).map((s) => html`<div style="flex:${r.counts[s.key]} 1 0;background:${colour(s.key)}" title="${r.name} · ${s.label}: ${r.counts[s.key]}"></div>`)}
</div><span class="val">${scheduled(r.counts)}${r.counts.cancelled ? html` <span class="muted" style="font-weight:400">+${r.counts.cancelled} cancelled</span>` : ""}</span></div></div>`;
  })}</div>${legend()}`;
}

const niceMax = (v: number) => { if (v <= 4) return 4; const step = v <= 10 ? 2 : v <= 25 ? 5 : v <= 50 ? 10 : v <= 100 ? 20 : 50; return Math.ceil(v / step) * step; };
const topRounded = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
};

/** Stacked columns, one per day. Status stacks from the baseline in the fixed order; only the top gets the rounded end. */
function dayColumns(byDay: { day: string; counts: Counts }[]) {
  const W = 680, H = 220, L = 30, R = 8, T = 12, B = 34;
  const max = niceMax(Math.max(0, ...byDay.map((d) => total(d.counts))));
  const plotW = W - L - R, plotH = H - T - B;
  const slot = plotW / byDay.length, bw = Math.min(24, slot * 0.62);
  const y = (v: number) => T + plotH - (plotH * v) / max;
  const ticks = [0, max / 2, max].filter((v, i, a) => a.indexOf(v) === i && Number.isInteger(v));
  const every = byDay.length > 14 ? Math.ceil(byDay.length / 10) : 1;
  let svg = "";
  for (const t of ticks) svg += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? "var(--axis)" : "var(--grid)"}" stroke-width="1"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
  byDay.forEach((d, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    let base = 0;
    const present = STATUSES.filter((s) => d.counts[s.key]);
    present.forEach((s, j) => {
      const v = d.counts[s.key];
      const y0 = y(base + v), h = y(base) - y(base + v) - (j > 0 ? 2 : 0); // 2px surface gap between segments
      const tip = `${shortDate(d.day)} · ${s.label}: ${v}`;
      svg += j === present.length - 1
        ? `<path d="${topRounded(x, y0, bw, Math.max(h, 1), 4)}" fill="${colour(s.key)}"><title>${tip}</title></path>`
        : `<rect x="${x}" y="${y0}" width="${bw}" height="${Math.max(h, 1)}" fill="${colour(s.key)}"><title>${tip}</title></rect>`;
      base += v;
    });
    if (total(d.counts)) svg += `<text x="${x + bw / 2}" y="${y(total(d.counts)) - 4}" text-anchor="middle" style="fill:var(--ink);font-weight:700">${total(d.counts)}</text>`;
    if (i % every === 0) {
      const dt = new Date(`${d.day}T00:00:00Z`);
      svg += `<text x="${x + bw / 2}" y="${H - B + 14}" text-anchor="middle">${byDay.length <= 14 ? WD[dt.getUTCDay()] : dt.getUTCDate()}</text>`;
      if (byDay.length <= 14) svg += `<text x="${x + bw / 2}" y="${H - B + 27}" text-anchor="middle">${dt.getUTCDate()}</text>`;
    }
  });
  return html`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sessions per day">${raw(svg)}</svg>${legend()}`;
}

function countsCells(c: Counts) {
  return html`${STATUSES.map((s) => html`<td class="num">${c[s.key] || ""}</td>`)}<td class="num"><strong>${scheduled(c)}</strong></td>`;
}
const statusHeads = html`${STATUSES.map((s) => html`<th class="num">${s.label}</th>`)}<th class="num">Sessions*</th>`;

export function dashboardPage(user: User, r: Report, opts: { therapists: TherapistRow[]; therapistId?: number; query: string; emailReady: boolean; flash?: { type: "ok" | "error"; text: string } }) {
  const c = r.totals, att = attendance(c);
  const maxT = Math.max(0, ...r.byTherapist.map((t) => total(t.counts)));
  const maxP = Math.max(0, ...r.byPatient.map((p) => total(p.counts)));
  const p = r.period;
  const link = (key: string) => `/dashboard?period=${key}${opts.therapistId ? `&therapist=${opts.therapistId}` : ""}`;
  return layout("Dashboard", user, html`<style>${raw(CSS)}</style>
<h1>Dashboard</h1>
<form class="filters" method="get" action="/dashboard">
<span class="seg">${PERIODS.filter((x) => x.key !== "custom").map((x) => html`<a class="${x.key === p.key ? "on" : ""}" href="${link(x.key)}">${x.label}</a>`)}</span>
<div class="custom"><input type="hidden" name="period" value="custom">
<div><label for="from">From</label><input id="from" type="date" name="from" value="${p.from}"></div>
<div><label for="to">To</label><input id="to" type="date" name="to" value="${p.to}"></div></div>
<div><label for="therapist" style="margin:0 0 2px;font-size:12px">Therapist</label>
<select id="therapist" name="therapist"><option value="">All therapists</option>
${opts.therapists.filter((t) => !t.deleted_at).map((t) => html`<option value="${t.id}" ${t.id === opts.therapistId ? "selected" : ""}>${t.name}</option>`)}</select></div>
<button class="secondary" style="margin:0">Show</button>
</form>
<script>
// Changing the therapist keeps the chosen preset period; changing a date switches to custom dates.
(function () {
  var f = document.querySelector("form.filters"), sel = document.getElementById("therapist"), period = f.querySelector('input[name="period"]');
  period.value = "${p.key}";
  ["from", "to"].forEach(function (id) { document.getElementById(id).addEventListener("change", function () { period.value = "custom"; }); });
  sel.addEventListener("change", function () { f.submit(); });
})();
</script>

<div class="viz">
<div class="report-head"><h2>${p.label}${opts.therapistId ? ` · ${opts.therapists.find((t) => t.id === opts.therapistId)?.name ?? ""}` : ""} <span class="muted" style="font-weight:400">${rangeLabel(p.from, p.to)}</span></h2>
<div class="report-actions">
<a class="btn secondary small" href="/dashboard/report.pdf?${opts.query}">⬇ Download PDF</a>
<form method="post" action="/dashboard/email"><input type="hidden" name="q" value="${opts.query}"><button class="btn secondary small" ${opts.emailReady ? "" : html`title="Email is not set up yet"`}>✉ Email me this report</button></form>
</div></div>

<div class="tiles">
<div class="tile"><span>Sessions*</span><b>${scheduled(c)}</b></div>
${STATUSES.map((s) => html`<div class="tile"><span><i style="background:${colour(s.key)}"></i>${s.label}</span><b>${c[s.key]}</b></div>`)}
<div class="tile"><span>Attendance</span><b>${att === null ? "–" : `${att}%`}</b></div>
<div class="tile"><span>Patients</span><b>${r.byPatient.filter((x) => scheduled(x.counts)).length}</b></div>
<div class="tile"><span>New consultations</span><b>${r.newConsultations}</b></div>
</div>
<p class="muted" style="margin:-4px 0 12px">*Sessions = completed + no-show + upcoming + not marked (cancelled ones are counted separately). Attendance = completed ÷ (completed + no-show).${c.unmarked ? html` <strong>${plural(c.unmarked, "past session")} still need marking as completed or no-show.</strong>` : ""}</p>

<div class="card"><h2 style="margin-top:0">1 · Status of all sessions</h2>${statusSplit(c)}</div>

<div class="card"><h2 style="margin-top:0">2 · Sessions per day</h2>${dayColumns(r.byDay)}
<details style="margin-top:8px"><summary class="muted">Show as table</summary><div class="tbl-wrap"><table><tr><th>Day</th>${statusHeads}</tr>
${r.byDay.map((d) => html`<tr><td>${WD[new Date(`${d.day}T00:00:00Z`).getUTCDay()]} ${shortDate(d.day)}</td>${countsCells(d.counts)}</tr>`)}</table></div></details></div>

<div class="card"><h2 style="margin-top:0">3 · Sessions by therapist</h2>${hbars(r.byTherapist, maxT)}
<details style="margin-top:8px"><summary class="muted">Show as table</summary><div class="tbl-wrap"><table><tr><th>Therapist</th>${statusHeads}</tr>
${r.byTherapist.map((t) => html`<tr><td>${t.name}</td>${countsCells(t.counts)}</tr>`)}</table></div></details></div>

<div class="card"><h2 style="margin-top:0">4 · Sessions by patient <span class="muted" style="font-weight:400">${plural(r.byPatient.length, "patient")}</span></h2>
${r.byPatient.length ? html`<div class="tbl-wrap"><table><tr><th>Patient</th><th>Therapist</th><th></th>${statusHeads}</tr>
${r.byPatient.map((x) => html`<tr><td><a href="/patients/${x.id}/summary">${x.name}</a></td><td class="muted">${x.therapists.join(", ")}</td>
<td><div class="mini" style="width:${Math.max(8, (120 * total(x.counts)) / (maxP || 1))}px" role="img" aria-label="${statusText(x.counts)}">${STATUSES.filter((s) => x.counts[s.key]).map((s) => html`<div style="flex:${x.counts[s.key]} 1 0;background:${colour(s.key)}" title="${s.label}: ${x.counts[s.key]}"></div>`)}</div></td>
${countsCells(x.counts)}</tr>`)}</table></div>${legend()}` : html`<div class="empty-note">No sessions in this period.</div>`}
</div>
<p class="muted">Report made ${formatDateTime(new Date(r.generatedAt))}. Every Sunday at 9:30 PM a PDF of that week (Monday to Sunday) and the coming week's bookings is emailed automatically.</p>
</div>`, opts.flash);
}
