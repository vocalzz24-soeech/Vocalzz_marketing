// Server-rendered HTML pages. `html` escapes every interpolated value.
import { html, raw } from "hono/html";
import type { User } from "./auth.ts";
import type { ApptRow } from "./notify.ts";
import { dateToIstLocal, formatDateTime, formatTime, istDay } from "./time.ts";
import { endOf, MAX_SERIES, timeSlots } from "./schedule.ts";

// Clinic hours 10:00–21:00 (matches OPEN_HOUR / CLOSE_HOUR in wrangler.toml).
const TIME_SLOTS = timeSlots(10, 21);

type H = ReturnType<typeof html>;

const CSS = `
:root{--bg:#f4f7fb;--card:#fff;--ink:#0b1220;--muted:#5b6474;--line:#dfe6ef;--brand:#1f6fd1;--brand-ink:#fff;--bar:#0b1220;--bar-ink:#fff;--wk-bg:#fff1e6;--wk-line:#f5b27a;--wk-ink:#c2410c;--warn:#b45309;--bad:#b91c1c;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#070b14;--card:#111827;--ink:#e8eef7;--muted:#9aa6b8;--line:#243044;--brand:#5aa2f0;--brand-ink:#04101f;--bar:#000;--bar-ink:#fff;--wk-bg:#2a1608;--wk-line:#9a4d18;--wk-ink:#fdba74;--warn:#f59e0b;--bad:#f87171;--ok:#4ade80}}
*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{background:var(--bar);color:var(--bar-ink);padding:10px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;border-bottom:3px solid var(--brand)}
header strong{margin-right:auto;letter-spacing:.02em}header a{color:var(--bar-ink);text-decoration:none;font-size:15px;opacity:.9}header a:hover{opacity:1}
header button.secondary{color:var(--bar-ink);border-color:rgba(255,255,255,.5)}
a{color:var(--brand)}.btn.small{margin:0;padding:4px 12px;font-size:14px}
main{max-width:860px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:4px 0 14px}h2{font-size:18px;margin:22px 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px}
label{display:block;font-weight:600;font-size:14px;margin:12px 0 4px}
input,select,textarea{width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
input[type=checkbox],input[type=radio]{width:auto}
.btn.wa-send{background:#25d366;border-color:#25d366;color:#fff;white-space:nowrap}.btn.wa-send.secondary{background:transparent;color:var(--ok);border-color:var(--ok)}
.send-panel{border:2px solid #25d366}.send-row{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line)}.send-row .btn{margin:0}
.send-banner{display:flex;justify-content:space-between;gap:12px;text-decoration:none;color:inherit;border:2px solid #25d366}
.msg-list{display:flex;flex-direction:column;gap:8px}
.msg-day{font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:14px 0 2px}
.msg{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.msg.pending{border-left:4px solid #25d366}
.msg-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.msg-who{min-width:0}
.msg-meta{font-size:13px;margin-top:2px}
.msg-body{margin-top:6px}.msg-body summary{display:flex;gap:10px;align-items:baseline;cursor:pointer;list-style:none;font-size:14px}
.msg-body summary::-webkit-details-marker{display:none}
.msg-preview{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.msg-more{flex:none;font-size:13px;color:var(--brand);font-weight:600}.msg-body[open] .msg-more{display:none}.msg-body[open] .msg-preview{display:none}
.msg-full{white-space:pre-wrap;font-size:14px;background:var(--bg);border-radius:8px;padding:10px 12px}
.msg-action .btn{margin:0}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;white-space:nowrap;border:1px solid}
.pill.ok{color:var(--ok);border-color:var(--ok)}.pill.bad{color:var(--bad);border-color:var(--bad)}.pill.wait{color:#fff;background:#d97706;border-color:#d97706}.pill.muted-pill{color:var(--muted);border-color:var(--line)}
.msg-main{min-width:0}
.repeat-box{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--bg)}.repeat-toggle{display:flex!important;gap:8px;align-items:center;margin:0!important;font-size:16px}.chips label.wk{background:var(--wk-bg);border-color:var(--wk-line)}
.day-chip.holiday{background:repeating-linear-gradient(45deg,var(--card),var(--card) 6px,var(--line) 6px,var(--line) 8px);border-style:dashed}.day-chip.holiday .dn{text-decoration:line-through;color:var(--muted)}
.sw.holiday{background:repeating-linear-gradient(45deg,var(--card),var(--card) 3px,var(--line) 3px,var(--line) 5px);border:1px dashed var(--muted)}
.holiday-badge{color:var(--bad);border-color:var(--bad)}
.followup-banner{border:2px solid var(--warn)}.followup-banner a{font-weight:700}
.continue-card{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;border:2px dashed var(--brand)}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}.stat{background:var(--bg);border-radius:10px;padding:10px;text-align:center}.stat b{display:block;font-size:26px}
.danger-zone{margin-top:28px;border:1px solid var(--bad)}.danger-zone summary{cursor:pointer;color:var(--bad);font-weight:700;font-size:14px}.danger-zone button[disabled]{opacity:.45;cursor:not-allowed}
.locked{padding:10px;border:1px dashed var(--line);border-radius:8px;background:var(--bg);font-weight:600}
.comment{padding:10px 0;border-bottom:1px solid var(--line)}.comment-body{white-space:pre-wrap;margin-top:2px}
textarea{width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
.seg{display:inline-flex;border:1px solid var(--brand);border-radius:8px;overflow:hidden}.seg a{padding:4px 12px;font-size:14px;text-decoration:none;color:var(--brand)}.seg a.on{background:var(--brand);color:var(--brand-ink)}
.ev{background:var(--card);border:1px solid var(--line);border-radius:12px}
.ev.pending{border-left:4px solid #25d366}
.ev-row{display:grid;grid-template-columns:1.1fr 1.3fr 1.1fr auto;gap:6px 16px;align-items:center;padding:12px 14px;cursor:pointer;list-style:none}
.ev-row::-webkit-details-marker{display:none}
.ev-when{display:flex;flex-direction:column;line-height:1.3}.ev-when .muted{font-size:13px}
.ev-who{min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px}
.lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.ev-kind{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.ev-toggle{font-size:13px;font-weight:700;color:var(--brand);white-space:nowrap}.ev-toggle::after{content:" ▾"}.ev[open] .ev-toggle::after{content:" ▴"}
.ev[open] .ev-toggle{color:var(--muted)}
.ev-body{border-top:1px solid var(--line);padding:12px 14px;display:flex;flex-direction:column;gap:12px}
.ev-msg{display:flex;flex-direction:column;gap:6px}
@media (max-width:760px){.ev-row{grid-template-columns:minmax(0,1fr)}.ev-kind{flex-direction:row;justify-content:space-between;align-items:center}}
@media (max-width:640px){.msg{grid-template-columns:minmax(0,1fr)}.msg-action .btn{display:block;text-align:center;white-space:normal}.msg-who .muted{display:block}}
.weeknav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.weeknav input{width:auto;padding:6px 10px}
.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.day-chip{display:flex;flex-direction:column;align-items:center;gap:1px;padding:8px 2px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);text-decoration:none;text-align:center;min-width:0}
.day-chip .wd{font-size:12px;font-weight:700;color:var(--muted)}.day-chip .dn{font-size:22px;font-weight:800;line-height:1.1}.day-chip .mo{font-size:12px;color:var(--muted)}
.day-chip .cnt{font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.day-chip.weekend{background:var(--wk-bg);border-color:var(--wk-line)}.day-chip.weekend .wd,.day-chip.weekend .dn{color:var(--wk-ink)}
.day-chip.today{border-width:2px;border-color:var(--brand)}
.day-chip.selected{background:var(--brand);border-color:var(--brand)}.day-chip.selected *{color:var(--brand-ink)!important}
.day-chip .cnt b{font-weight:800;color:var(--ink)}.day-chip.weekend .cnt b{color:var(--wk-ink)}@media (max-width:560px){.cnt-word{display:none}}
.legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;margin:8px 0 0}.legend>span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.legend a{margin-left:auto}.sw{display:inline-block;width:14px;height:14px;border-radius:4px}.sw.weekend{background:var(--wk-bg);border:1px solid var(--wk-line)}
.weekend-badge{color:var(--wk-ink);border-color:var(--wk-line);background:var(--wk-bg);vertical-align:middle}
.daynav{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:end}.daynav .btn{margin:0}
.row{display:flex;gap:10px;flex-wrap:wrap}.row>*{flex:1 1 160px}
button,.btn{display:inline-block;font:inherit;font-weight:600;padding:10px 16px;border-radius:8px;border:1px solid var(--brand);background:var(--brand);color:var(--brand-ink);text-decoration:none;cursor:pointer;margin-top:14px}
.btn.secondary,button.secondary{background:transparent;color:var(--brand)}
button.danger{background:var(--bad);border-color:var(--bad);color:#fff}
.flash{padding:10px 14px;border-radius:8px;margin-bottom:12px;border:1px solid}
.flash.error{border-color:var(--bad);color:var(--bad)}.flash.ok{border-color:var(--ok);color:var(--ok)}
.muted{color:var(--muted);font-size:14px}
.appt{display:flex;gap:12px;align-items:flex-start;text-decoration:none;color:inherit}
.appt .time{min-width:84px;font-weight:700}
.badge{font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--line)}
.badge.cancelled{color:var(--bad);border-color:var(--bad)}.badge.completed{color:var(--ok);border-color:var(--ok)}.badge.no_show{color:var(--warn);border-color:var(--warn)}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chips label{font-weight:400;margin:0;display:flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:99px;padding:6px 12px}
`;

export function layout(title: string, user: User | null, body: H | string, flash?: { type: "ok" | "error"; text: string }) {
  return html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Vocalzz Appointments</title><link rel="icon" href="/logo-mark.png" type="image/png"><style>${raw(CSS)}</style></head>
<body>
<header><strong style="display:flex;align-items:center;gap:8px"><img src="/logo-mark.png" width="28" height="28" alt="" aria-hidden="true" style="background:#fff;border-radius:6px;padding:1px">VOCALZZ <span style="color:var(--brand);font-weight:600">Appointments</span></strong>
<a class="site-link" href="https://vocalzz.com/">← Website</a>
${user
  ? html`<a href="/">Schedule</a><a href="/appointments/new">+ Book</a><a href="/leave">Leave</a>${user.role === "admin"
      ? html`<a href="/patients">Patients</a><a href="/therapists">Therapists</a><a href="/bills">Bills</a><a href="/messages">Messages</a>`
      : ""}
    <form method="post" action="/logout" style="margin:0"><button class="secondary" style="margin:0;padding:6px 12px">Log out</button></form>`
  : ""}
</header>
<main>
${flash ? html`<div class="flash ${flash.type}">${flash.text}</div>` : ""}
${body}
</main>
<script>
// "Website" link: same Cloudflare account on workers.dev, vocalzz.com on the real domain.
(function () {
  var h = location.hostname, site = null;
  var m = /^vocalzz-(appointments|marketing)\\./.exec(h);
  if (m) site = h.replace(m[0], "vocalzz-website.");
  else if (/(^|\\.)vocalzz\\.com$/.test(h)) site = "vocalzz.com";
  if (site) document.querySelectorAll("a.site-link").forEach(function (a) { a.href = "https://" + site + "/"; });
})();
</script>
</body></html>`;
}

export function loginPage(error?: string) {
  return layout("Log in", null, html`
<div class="card"><h1>Log in</h1>
<form method="post" action="/login">
<label for="login">Phone number</label><input id="login" name="login" inputmode="tel" autocomplete="username" required>
<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
<button>Log in</button></form></div>`, error ? { type: "error", text: error } : undefined);
}

export function setupPage(error?: string) {
  return layout("First-time setup", null, html`
<div class="card"><h1>Create the admin login</h1>
<p class="muted">This page works only once, before any login exists.</p>
<form method="post" action="/setup">
<label for="name">Your name</label><input id="name" name="name" required>
<label for="login">Phone number (used to log in)</label><input id="login" name="login" inputmode="tel" required>
<label for="password">Password (at least 8 characters)</label><input id="password" name="password" type="password" minlength="8" required>
<button>Create admin</button></form></div>`, error ? { type: "error", text: error } : undefined);
}

export interface TherapistRow { id: number; name: string; phone: string; specialty: string | null; active: number; has_login: number; deleted_at?: string | null }
export interface PatientRow { id: number; name: string; guardian_name: string | null; phone: string; whatsapp_consent: number; notes: string | null }

export interface DayChip { day: string; booked: number; holiday?: string }
export interface FollowUp { id: number; name: string; missed: number; lastMissed: string }

export function schedulePage(user: User, win: { selected: string; start: string; prevStart: string; nextStart: string }, chips: DayChip[], today: string, appts: ApptRow[], therapists: TherapistRow[], flash?: { type: "ok" | "error"; text: string }, pendingCount = 0, mineOnly = false, followUps: FollowUp[] = [], onLeave: Set<number> = new Set(), leaveBanner: unknown = "") {
  const day = win.selected;
  const groups = therapists
    .map((t) => ({ t, list: appts.filter((a) => a.therapist_id === t.id) }))
    .filter((g) => !mineOnly || g.t.id === user.therapist_id)
    .sort((x, y) => Number(y.t.id === user.therapist_id) - Number(x.t.id === user.therapist_id));
  const q = (extra: string) => `/?${extra}${mineOnly ? "&mine=1" : ""}`;
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chip = (c: DayChip) => {
    const d = new Date(`${c.day}T00:00:00Z`);
    const wd = d.getUTCDay();
    const cls = ["day-chip", wd === 0 || wd === 6 ? "weekend" : "", c.holiday ? "holiday" : "", c.day === day ? "selected" : "", c.day === today ? "today" : ""].join(" ");
    return html`<a class="${cls}" href="${q(`day=${c.day}&start=${win.start}`)}" aria-current="${c.day === day ? "date" : "false"}">
<span class="wd">${c.day === today ? "Today" : WD[wd]}</span><span class="dn">${d.getUTCDate()}</span><span class="mo">${MON[d.getUTCMonth()]}</span>
<span class="cnt">${c.holiday ? html`<b>Closed</b>` : c.booked ? html`<b>${c.booked}</b><span class="cnt-word"> booked</span>` : "free"}</span></a>`;
  };
  const sel = new Date(`${day}T00:00:00Z`);
  const selHoliday = chips.find((c) => c.day === day)?.holiday;
  return layout("Schedule", user, html`
<h1>Schedule</h1>
${user.role === "admin" ? pendingBanner(pendingCount) : ""}
${leaveBanner}
${followUps.length ? html`<div class="card followup-banner"><strong>⚠ Follow up: ${followUps.length} patient${followUps.length === 1 ? "" : "s"} missed ${FOLLOW_UP}+ sessions in a row</strong>
<div>${followUps.slice(0, 5).map((f) => html`<a href="/patients/${f.id}/summary">${f.name}</a> <span class="muted">(${f.missed} missed)</span> `)}</div></div>` : ""}
<div class="weeknav">
<a class="btn secondary small" href="${q(`day=${win.prevStart}&start=${win.prevStart}`)}">‹ Prev week</a>
<a class="btn secondary small" href="${q(`day=${win.nextStart}&start=${win.nextStart}`)}">Next week ›</a>
<a class="btn secondary small" href="${q("")}">Today</a>
<form method="get" action="/" style="margin:0"><input type="date" name="day" value="${day}" onchange="this.form.submit()" aria-label="Jump to a date">${mineOnly ? html`<input type="hidden" name="mine" value="1">` : ""}</form>
${user.role === "therapist" ? html`<span class="seg"><a class="${mineOnly ? "" : "on"}" href="/?day=${day}&start=${win.start}">Everyone</a><a class="${mineOnly ? "on" : ""}" href="/?day=${day}&start=${win.start}&mine=1">Only my sessions</a></span>` : ""}
</div>
<div class="week">${chips.map(chip)}</div>
<p class="muted legend"><span><span class="sw weekend"></span> Sat &amp; Sun</span><span><span class="sw holiday"></span> Closed</span>${user.role === "admin" ? html`<a href="/holidays">Clinic holidays →</a>` : ""}</p>
<h2 style="margin-top:8px">${WD[sel.getUTCDay()]}, ${sel.getUTCDate()} ${MON[sel.getUTCMonth()]} ${sel.getUTCFullYear()}${
  sel.getUTCDay() === 0 || sel.getUTCDay() === 6 ? html` <span class="badge weekend-badge">Weekend</span>` : ""}${selHoliday ? html` <span class="badge holiday-badge">Closed: ${selHoliday}</span>` : ""}</h2>
${groups.length === 0 ? html`<div class="card muted">No therapists yet. ${user.role === "admin" ? html`<a href="/therapists">Add one</a>.` : ""}</div>` : ""}
${groups.map((g) => html`
<h2>${g.t.name} <span class="muted">${g.list.filter((a) => a.status === "booked").length} booked</span>${onLeave.has(g.t.id) ? html` <span class="badge holiday-badge">On leave</span>` : ""}</h2>
${g.list.length === 0 ? html`<div class="card muted">No appointments.</div>` : ""}
${g.list.map((a) => apptCard(a))}`)}
`, flash);
}

function apptCard(a: ApptRow) {
  const start = new Date(a.start_utc);
  const end = endOf({ start, durationMin: a.duration_min, extraMin: a.extra_min });
  return html`<a class="card appt" href="/appointments/${a.id}">
<div class="time">${formatTime(start)}<div class="muted">to ${formatTime(end)}</div></div>
<div><div><strong>${a.patient_name}</strong> · ${a.service}</div>
${a.status !== "booked" ? html`<span class="badge ${a.status}">${statusLabel(a.status)}</span>` : ""}
${a.extra_min ? html`<span class="badge">+${a.extra_min} min</span>` : ""}</div></a>`;
}

export const SERVICES = [
  "Speech therapy", "Occupational therapy", "Behavioural therapy", "Special education",
  "Audiology / hearing test", "Physiotherapy", "Assessment", "Online therapy",
];

const statusLabel = (s: string) => ({ booked: "Booked", cancelled: "Cancelled", completed: "Completed", no_show: "No-show" })[s] ?? s;

export interface ApptForm { patient_id?: string; therapist_id?: string; service?: string; start?: string; duration?: string; extra?: string; notes?: string;
  repeat?: string; repeat_days?: string[]; repeat_until?: string; repeat_until_date?: string }

export function newAppointmentPage(user: User, patients: PatientRow[], therapists: TherapistRow[], defaultDuration: number, form: ApptForm = {}, error?: string) {
  return layout("Book appointment", user, html`
<h1>Book an appointment</h1>
${patients.length === 0 ? html`<div class="card">${user.role === "admin" ? html`Add a patient first on the <a href="/patients">Patients</a> page.` : "No patients yet. Ask the clinic admin to add the patient first."}</div>` : ""}
<form class="card" method="post" action="/appointments">
<label for="patient_id">Patient</label>
<select id="patient_id" name="patient_id" required><option value="">Choose…</option>
${patients.map((p) => html`<option value="${p.id}" ${String(p.id) === form.patient_id ? "selected" : ""}>${p.name}${p.guardian_name ? ` (parent: ${p.guardian_name})` : ""} · ${p.phone.slice(2)}</option>`)}
</select>
<p class="muted">${user.role === "admin" ? html`New patient? <a href="/patients">Add them first</a>.` : "New patient? Ask the clinic admin to add them first."}</p>
${apptFields(therapists, defaultDuration, form, user.role === "therapist" ? therapists.find((t) => t.id === user.therapist_id) : undefined)}
${repeatFields(form)}
<button>Book and send WhatsApp messages</button>
</form>`, error ? { type: "error", text: error } : undefined);
}

function repeatFields(form: ApptForm) {
  const on = form.repeat === "1";
  const days = new Set(form.repeat_days ?? []);
  const until = form.repeat_until ?? "month_end";
  const WD = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];
  return html`<div class="repeat-box">
<label class="repeat-toggle"><input type="checkbox" id="repeat" name="repeat" value="1" ${on ? "checked" : ""}> <span>Repeat every week</span></label>
<div id="repeat-opts" ${on ? "" : "hidden"}>
<label>On these days</label>
<div class="chips">${WD.map(([v, l]) => html`<label class="${v === "0" || v === "6" ? "wk" : ""}"><input type="checkbox" name="repeat_days" value="${v}" ${days.has(v) ? "checked" : ""}> ${l}</label>`)}</div>
<label for="repeat_until">Until</label>
<div class="row">
<div><select id="repeat_until" name="repeat_until">
${[["month_end", "End of this month"], ["4w", "4 weeks"], ["8w", "8 weeks"], ["date", "A date I choose…"]].map(([v, l]) => html`<option value="${v}" ${v === until ? "selected" : ""}>${l}</option>`)}
</select></div>
<div id="until-date-wrap" ${until === "date" ? "" : "hidden"}><input type="date" name="repeat_until_date" value="${form.repeat_until_date ?? ""}" aria-label="Last date"></div>
</div>
<p class="muted" id="repeat-preview" style="margin:6px 0 0"></p>
<p class="muted" style="margin:4px 0 0">Same time, therapist and length each week. Dates that clash are skipped and listed after booking. The patient gets one WhatsApp message listing all dates, plus the usual reminders before each session.</p>
</div></div>
<script>
(function () {
  var cb = document.getElementById("repeat"), opts = document.getElementById("repeat-opts");
  var date = document.getElementById("date"), until = document.getElementById("repeat_until"), wrap = document.getElementById("until-date-wrap");
  var prev = document.getElementById("repeat-preview");
  var boxes = Array.prototype.slice.call(document.querySelectorAll('input[name="repeat_days"]'));
  var WD = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function ensureDay() {
    if (!date.value) return;
    var wd = String(new Date(date.value + "T00:00:00Z").getUTCDay());
    if (!boxes.some(function (b) { return b.checked; })) boxes.forEach(function (b) { if (b.value === wd) b.checked = true; });
  }
  function preview() {
    if (!cb.checked || !date.value) { prev.textContent = ""; return; }
    var first = date.value, last;
    if (until.value === "4w") last = addDays(first, 27);
    else if (until.value === "8w") last = addDays(first, 55);
    else if (until.value === "date") last = document.querySelector('input[name="repeat_until_date"]').value;
    else { var d = new Date(first + "T00:00:00Z"); last = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))); }
    if (!last || last < first) { prev.textContent = "Choose a last date after the first session."; return; }
    var set = boxes.filter(function (b) { return b.checked; }).map(function (b) { return Number(b.value); });
    var out = [first];
    for (var x = addDays(first, 1); x <= last && out.length < ${MAX_SERIES}; x = addDays(x, 1)) {
      if (set.indexOf(new Date(x + "T00:00:00Z").getUTCDay()) >= 0) out.push(x);
    }
    prev.textContent = out.length + " sessions: " + out.map(function (s) { var d = new Date(s + "T00:00:00Z"); return WD[d.getUTCDay()] + " " + d.getUTCDate() + " " + MO[d.getUTCMonth()]; }).join(", ");
  }
  cb.addEventListener("change", function () { opts.hidden = !cb.checked; ensureDay(); preview(); });
  date.addEventListener("change", function () { ensureDay(); preview(); });
  until.addEventListener("change", function () { wrap.hidden = until.value !== "date"; preview(); });
  document.addEventListener("change", function (e) { if (e.target.name === "repeat_days" || e.target.name === "repeat_until_date") preview(); });
  preview();
})();
</script>`;
}

function apptFields(therapists: TherapistRow[], defaultDuration: number, form: ApptForm, lockedTo?: TherapistRow) {
  const extra = form.extra ?? "0";
  return html`
<label for="therapist_id">Therapist</label>
${lockedTo
  ? html`<input type="hidden" name="therapist_id" value="${lockedTo.id}"><div class="locked">${lockedTo.name} (you)</div>`
  : html`<select id="therapist_id" name="therapist_id" required><option value="">Choose…</option>
${therapists.filter((t) => t.active).map((t) => html`<option value="${t.id}" ${String(t.id) === form.therapist_id ? "selected" : ""}>${t.name}${t.specialty ? ` · ${t.specialty}` : ""}</option>`)}
</select>`}
<label for="service">Therapy</label>
<select id="service" name="service" required>
${SERVICES.map((s) => html`<option ${s === form.service ? "selected" : ""}>${s}</option>`)}
</select>
<div class="row">
<div><label for="date">Date</label><input id="date" name="date" type="date" value="${(form.start ?? "").slice(0, 10)}" required></div>
<div><label for="time">Time</label><select id="time" name="time" required><option value="">Choose time…</option>
${TIME_SLOTS.map((t) => html`<option value="${t.value}" ${t.value === (form.start ?? "").slice(11, 16) ? "selected" : ""}>${t.label}</option>`)}
</select></div>
<div><label for="duration">Length (minutes)</label><input id="duration" name="duration" type="number" min="15" max="180" step="5" value="${form.duration ?? String(defaultDuration)}" required></div>
</div>
<label>Extra time</label>
<div class="chips">
${["0", "10", "15"].map((v) => html`<label><input type="radio" name="extra" value="${v}" ${v === extra ? "checked" : ""}> ${v === "0" ? "None" : `+${v} min`}</label>`)}
</div>
<label for="notes">Note for the clinic (optional, no medical details)</label>
<input id="notes" name="notes" value="${form.notes ?? ""}" maxlength="200">`;
}

export interface MessageRow { id: number; appointment_id: number | null; recipient: string; to_phone: string; kind: string; body_preview: string; status: string; error: string | null; created_at: string; manual_sent_at: string | null; to_name?: string | null;
  patient_name?: string | null; guardian_name?: string | null; therapist_name?: string | null; appt_start?: string | null; appt_service?: string | null; appt_status?: string | null }

/** Not delivered automatically (WhatsApp not connected yet, or a send failed) and not yet sent by hand. */
export const needsManualSend = (m: MessageRow) => (m.status === "dry_run" || m.status === "failed") && !m.manual_sent_at;

const KIND_LABEL: Record<string, string> = {
  confirmation: "booking confirmation", reminder_24h: "day-before reminder", reminder_2h: "2-hour reminder",
  rescheduled: "new time", cancelled: "cancellation",
  series_confirmation: "weekly sessions booked", series_cancelled: "weekly sessions cancelled", series_moved: "weekly sessions moved",
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? k;

function statusLabel2(m: MessageRow) {
  if (m.manual_sent_at) return html`<strong style="color:var(--ok)">Sent by you</strong><br><span class="muted">${formatDateTime(new Date(m.manual_sent_at))}</span>`;
  if (m.status === "sent") return html`<strong style="color:var(--ok)">Sent automatically</strong>`;
  if (m.status === "skipped") return html`Not sent<br><span class="muted">${m.error ?? ""}</span>`;
  if (m.status === "failed") return html`<strong style="color:var(--bad)">Failed</strong>, send it yourself<br><span class="muted">${m.error ?? ""}</span>`;
  return html`<strong style="color:var(--warn)">Waiting for you to send</strong>`;
}

/** One-tap button: opens WhatsApp in the chat with this exact number, message already typed. */
export function sendButton(m: MessageRow, who: string) {
  return html`<a class="btn wa-send" href="/messages/${m.id}/send" target="_blank" rel="noopener"
    onclick="this.textContent='Opened in WhatsApp ✓';this.classList.add('secondary')">Send to ${who} on WhatsApp</a>`;
}

export interface CommentRow { id: number; body: string; created_at: string; author: string; role: string }

export function appointmentPage(user: User, a: ApptRow, messages: MessageRow[], therapists: TherapistRow[], defaultDuration: number, comments: CommentRow[], bookedBy: string | null, series: { total: number; later: number; nextMonth: string } | null, flash?: { type: "ok" | "error"; text: string }) {
  const start = new Date(a.start_utc);
  const end = endOf({ start, durationMin: a.duration_min, extraMin: a.extra_min });
  const isAdmin = user.role === "admin";
  const isOwn = user.role === "therapist" && user.therapist_id === a.therapist_id;
  return layout("Appointment", user, html`
<h1>${a.patient_name} · ${a.service}</h1>
<div class="card">
<div><strong>${formatDateTime(start)}</strong> to ${formatTime(end)} (${a.duration_min + a.extra_min} min${a.extra_min ? `, incl. +${a.extra_min}` : ""})</div>
<div>Therapist: ${a.therapist_name}</div>
<div>Contact: ${a.guardian_name ? `${a.guardian_name} (parent) · ` : ""}+${a.patient_phone}</div>
<div>Status: <span class="badge ${a.status}">${statusLabel(a.status)}</span>${a.cancel_reason ? html` <span class="muted">${a.cancel_reason}</span>` : ""}</div>
${a.notes ? html`<div class="muted">Note: ${a.notes}</div>` : ""}
${bookedBy ? html`<div class="muted">Booked by ${bookedBy}</div>` : ""}
${series ? html`<div class="muted">🔁 Part of a weekly series: ${series.total} sessions${series.later ? `, ${series.later} more after this one` : ""}</div>` : ""}
${!isAdmin ? html`<div class="muted" style="margin-top:6px">Only the clinic admin can change or cancel appointments. Add a comment below if something needs changing.</div>` : ""}
${!a.whatsapp_consent ? html`<div class="flash error" style="margin-top:10px">No WhatsApp consent recorded, so this patient gets no messages. Update it on the Patients page.</div>` : ""}
</div>
${isAdmin ? sendPanel(a, messages) : ""}
${series && (isAdmin || isOwn) ? html`
<form class="card continue-card" method="post" action="/appointments/${a.id}/continue">
<div><strong>🔁 Continue this weekly series</strong><div class="muted">Books the same days and time for ${series.nextMonth}. Clashes and clinic holidays are skipped.</div></div>
<button class="secondary" style="margin:0">Continue for ${series.nextMonth}</button></form>` : ""}
${a.status === "booked" && (isAdmin || isOwn) ? html`
<div class="card"><h2 style="margin-top:0">After the session</h2>
<form method="post" action="/appointments/${a.id}/status" class="row">
<button name="status" value="completed" class="secondary">Mark completed</button>
<button name="status" value="no_show" class="secondary">Mark no-show</button>
</form></div>` : ""}
${isAdmin && a.status === "booked" ? html`
<details class="card"><summary><strong>Change time or therapist</strong></summary>
<form method="post" action="/appointments/${a.id}/reschedule">
${apptFields(therapists, defaultDuration, {
  therapist_id: String(a.therapist_id), service: a.service, start: dateToIstLocal(start),
  duration: String(a.duration_min), extra: String(a.extra_min), notes: a.notes ?? "",
})}
${series && series.later ? html`<label>Apply to</label>
<div class="chips"><label><input type="radio" name="scope" value="one" checked> Only this session</label>
<label><input type="radio" name="scope" value="following"> This and the ${series.later} later session${series.later === 1 ? "" : "s"}</label></div>
<p class="muted" style="margin:4px 0 0">For the whole series, later sessions move by the same amount (e.g. 1 hour later, or Monday → Tuesday) and take the new therapist and length.</p>` : ""}
<button>Save and notify both</button></form></details>
<details class="card"><summary><strong>Cancel appointment</strong></summary>
<form method="post" action="/appointments/${a.id}/cancel">
${series && series.later ? html`<label>Which sessions?</label>
<div class="chips"><label><input type="radio" name="scope" value="one" checked> Only this session</label>
<label><input type="radio" name="scope" value="following"> This and the ${series.later} later session${series.later === 1 ? "" : "s"}</label></div>` : ""}
<label for="reason">Reason (internal, optional)</label><input id="reason" name="reason" maxlength="200">
<button class="danger">Cancel and notify both</button></form></details>` : ""}
<h2>Comments</h2>
<div class="card">
${comments.length === 0 ? html`<p class="muted" style="margin-top:0">No comments yet.</p>` : ""}
${comments.map((k) => html`<div class="comment"><div><strong>${k.author}</strong> <span class="muted">${k.role === "admin" ? "admin" : "therapist"} · ${formatDateTime(new Date(k.created_at))}</span></div><div class="comment-body">${k.body}</div></div>`)}
<form method="post" action="/appointments/${a.id}/comments">
<label for="comment">Add a comment</label>
<textarea id="comment" name="body" rows="2" maxlength="500" required placeholder="e.g. Parent asked to move next week's session to the evening"></textarea>
<p class="muted" style="margin:4px 0 0">Visible to the clinic team. Keep it short and avoid sensitive medical details.</p>
<button>Add comment</button></form>
</div>
${isAdmin ? html`<h2>WhatsApp messages</h2>${messageTable(messages)}` : ""}
`, flash);
}

function sendPanel(a: ApptRow, messages: MessageRow[]) {
  const pending = messages.filter(needsManualSend);
  if (pending.length === 0) return "";
  const who = (m: MessageRow) =>
    m.to_phone === a.patient_phone ? `${a.guardian_name || a.patient_name} (patient)`
    : m.to_phone === a.therapist_phone ? `${a.therapist_name} (therapist)`
    : `+${m.to_phone}`;
  return html`<div class="card send-panel">
<h2 style="margin-top:0">Send on WhatsApp (${pending.length})</h2>
<p class="muted">WhatsApp isn't connected yet, so send these from your own WhatsApp. Each button opens the chat with that person's number and the message already typed: just tap Send.</p>
${pending.map((m) => html`<div class="send-row"><div><strong>${kindLabel(m.kind)}</strong> → ${who(m)} <span class="muted">+${m.to_phone}</span></div>${sendButton(m, who(m).replace(/ \(.*\)$/, ""))}</div>`)}
</div>`;
}

const fmtPhone = (p: string) => (p.length === 12 && p.startsWith("91") ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : `+${p}`);

function statusPill(m: MessageRow) {
  if (m.manual_sent_at) return html`<span class="pill ok" title="${formatDateTime(new Date(m.manual_sent_at))}">Sent by you · ${formatTime(new Date(m.manual_sent_at))}</span>`;
  if (m.status === "sent") return html`<span class="pill ok">Sent</span>`;
  if (m.status === "skipped") return html`<span class="pill muted-pill" title="${m.error ?? ""}">Not sent · no consent</span>`;
  if (m.status === "failed") return html`<span class="pill bad" title="${m.error ?? ""}">Failed</span>`;
  return html`<span class="pill wait">Waiting for you</span>`;
}

function dayHeading(iso: string) {
  const d = istDay(new Date(iso)), now = new Date();
  if (d === istDay(now)) return "Today";
  if (d === istDay(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return formatDateTime(new Date(iso)).replace(/, \d+:\d+ [AP]M$/, "");
}

/** Compact, mobile-friendly message list grouped by day. */
export function messageTable(messages: MessageRow[]) {
  if (messages.length === 0) return html`<div class="card muted">No messages here.</div>`;
  let lastDay = "";
  return html`<div class="msg-list">${messages.map((m) => {
    const heading = dayHeading(m.created_at);
    const showHeading = heading !== lastDay;
    lastDay = heading;
    const who = m.to_name || (m.recipient === "patient" ? "Patient" : "Therapist");
    const firstLine = m.body_preview.split("\n")[0];
    return html`${showHeading ? html`<div class="msg-day">${heading}</div>` : ""}
<div class="msg ${needsManualSend(m) ? "pending" : ""}">
  <div class="msg-main">
    <div class="msg-head">
      ${statusPill(m)}
      <span class="msg-who"><strong>${who}</strong> <span class="muted">${m.recipient} · ${fmtPhone(m.to_phone)}</span></span>
    </div>
    <div class="msg-meta muted">${kindLabel(m.kind)}${m.appointment_id ? html` · <a href="/appointments/${m.appointment_id}">appointment #${m.appointment_id}</a>` : ""} · ${formatTime(new Date(m.created_at))}</div>
    <details class="msg-body"><summary><span class="msg-preview">${firstLine}</span><span class="msg-more">Show message</span></summary><div class="msg-full">${m.body_preview}</div></details>
  </div>
  ${needsManualSend(m) ? html`<div class="msg-action">${sendButton(m, who === "Patient" || who === "Therapist" ? m.recipient : who)}</div>` : ""}
</div>`;
  })}</div>`;
}

export function patientsPage(user: User, patients: PatientRow[], q: string, flash?: { type: "ok" | "error"; text: string }, flagged: Set<number> = new Set()) {
  return layout("Patients", user, html`
<h1>Patients</h1>
<details class="card" ${flash?.type === "error" ? "open" : ""}><summary><strong>+ Add patient</strong></summary>
<form method="post" action="/patients">
<label for="name">Patient name</label><input id="name" name="name" required maxlength="80">
<label for="guardian_name">Parent / guardian name (for children)</label><input id="guardian_name" name="guardian_name" maxlength="80">
<label for="phone">WhatsApp number</label><input id="phone" name="phone" inputmode="tel" required placeholder="98XXXXXXXX">
<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="whatsapp_consent" value="1" checked>
They agreed to get appointment messages on WhatsApp</label>
<label for="notes">Admin note (optional, no medical details)</label><input id="notes" name="notes" maxlength="200">
<button>Add patient</button></form></details>
<form method="get" action="/patients" class="row" style="align-items:end"><div><label for="q">Search name or phone</label><input id="q" name="q" value="${q}"></div><button class="secondary">Search</button></form>
<div class="card" style="overflow-x:auto"><table><tr><th>Name</th><th>Parent</th><th>WhatsApp</th><th>Consent</th><th></th></tr>
${patients.map((p) => html`<tr><td><a href="/patients/${p.id}/summary">${p.name}</a>${flagged.has(p.id) ? html` <span class="badge no_show">Follow up</span>` : ""}</td><td>${p.guardian_name ?? ""}</td><td>+${p.phone}</td>
<td><form method="post" action="/patients/${p.id}/consent" style="margin:0"><button class="secondary" style="margin:0;padding:4px 10px" name="value" value="${p.whatsapp_consent ? "0" : "1"}">${p.whatsapp_consent ? "Yes" : "No"}</button></form></td>
<td style="white-space:nowrap"><a class="btn secondary small" href="/patients/${p.id}/summary">History</a> <a class="btn secondary small" href="/patients/${p.id}/edit">Edit</a> <a class="btn small" href="/appointments/new?patient_id=${p.id}">Book</a></td></tr>`)}
</table>${patients.length === 0 ? html`<p class="muted">No patients found.</p>` : ""}</div>
`, flash);
}

export function therapistsPage(user: User, therapists: TherapistRow[], flash?: { type: "ok" | "error"; text: string }) {
  return layout("Therapists", user, html`
<h1>Therapists</h1>
<details class="card" ${flash?.type === "error" ? "open" : ""}><summary><strong>+ Add therapist</strong></summary>
<form method="post" action="/therapists">
<label for="name">Name</label><input id="name" name="name" required maxlength="80">
<label for="phone">WhatsApp number</label><input id="phone" name="phone" inputmode="tel" required>
<label for="specialty">Specialty</label><input id="specialty" name="specialty" maxlength="80" placeholder="e.g. Occupational therapist">
<label for="password">Login password for the therapist (optional, at least 8 characters)</label>
<input id="password" name="password" type="password" minlength="8" autocomplete="new-password">
<p class="muted">With a password, the therapist logs in with their phone number and sees only their own schedule.</p>
<button>Add therapist</button></form></details>
<div class="card" style="overflow-x:auto"><table><tr><th>Name</th><th>Specialty</th><th>WhatsApp</th><th>Login</th><th>Active</th><th></th></tr>
${therapists.map((t) => html`<tr><td>${t.name}</td><td>${t.specialty ?? ""}</td><td>+${t.phone}</td><td>${t.has_login ? "Yes" : "No"}</td>
<td><form method="post" action="/therapists/${t.id}/active" style="margin:0"><button class="secondary" style="margin:0;padding:4px 10px" name="value" value="${t.active ? "0" : "1"}">${t.active ? "Active" : "Inactive"}</button></form></td>
<td><a class="btn secondary small" href="/therapists/${t.id}/edit">Edit</a></td></tr>`)}
</table>${therapists.length === 0 ? html`<p class="muted">No therapists yet.</p>` : ""}</div>
`, flash);
}

export function patientEditPage(user: User, p: PatientRow, flash?: { type: "ok" | "error"; text: string }, counts: DeleteCounts = { total: 0, upcoming: 0 }) {
  return layout("Edit patient", user, html`
<p><a href="/patients">← Patients</a></p>
<h1>Edit patient</h1>
<form class="card" method="post" action="/patients/${p.id}">
<label for="name">Patient name</label><input id="name" name="name" required maxlength="80" value="${p.name}">
<label for="guardian_name">Parent / guardian name (for children)</label><input id="guardian_name" name="guardian_name" maxlength="80" value="${p.guardian_name ?? ""}">
<label for="phone">WhatsApp number</label><input id="phone" name="phone" inputmode="tel" required value="${p.phone.slice(2)}">
<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="whatsapp_consent" value="1" ${p.whatsapp_consent ? "checked" : ""}>
They agreed to get appointment messages on WhatsApp</label>
<label for="notes">Admin note (optional, no medical details)</label><input id="notes" name="notes" maxlength="200" value="${p.notes ?? ""}">
<p class="muted">Changes apply to future messages. Messages already sent are not changed.</p>
<button>Save changes</button> <a class="btn secondary" href="/patients">Cancel</a>
</form>
${dangerZone("patient", p.name, `/patients/${p.id}/delete`, html`
<p>This <strong>permanently deletes</strong> ${p.name}'s record together with <strong>${counts.total} appointment${counts.total === 1 ? "" : "s"}</strong>${counts.upcoming ? html` (<strong>${counts.upcoming} upcoming</strong>)` : ""}, their WhatsApp message history and comments. It cannot be undone.</p>
${counts.upcoming ? html`<p class="flash error" style="margin:8px 0">Upcoming sessions will disappear without any message to the family or therapist. To let them know, cancel those sessions first.</p>` : ""}
<p class="muted">Use this when a family asks for their data to be deleted, or a record was added by mistake. To simply stop seeing a patient, there's no need to delete them.</p>`)}`, flash);
}

export function therapistEditPage(user: User, t: TherapistRow, flash?: { type: "ok" | "error"; text: string }, counts: DeleteCounts = { total: 0, upcoming: 0 }) {
  return layout("Edit therapist", user, html`
<p><a href="/therapists">← Therapists</a></p>
<h1>Edit therapist</h1>
<form class="card" method="post" action="/therapists/${t.id}">
<label for="name">Name</label><input id="name" name="name" required maxlength="80" value="${t.name}">
<label for="phone">WhatsApp number${t.has_login ? " (also their login)" : ""}</label><input id="phone" name="phone" inputmode="tel" required value="${t.phone.slice(2)}">
<label for="specialty">Specialty</label><input id="specialty" name="specialty" maxlength="80" value="${t.specialty ?? ""}">
<label for="password">${t.has_login ? "New login password (leave empty to keep the current one)" : "Create a login password (optional, at least 8 characters)"}</label>
<input id="password" name="password" type="password" minlength="8" autocomplete="new-password">
<p class="muted">${t.has_login ? "Setting a new password logs the therapist out of all devices." : "With a password, the therapist logs in with their phone number and sees only their own schedule."}</p>
<button>Save changes</button> <a class="btn secondary" href="/therapists">Cancel</a>
</form>
${dangerZone("therapist", t.name, `/therapists/${t.id}/delete`, html`
<p>This removes ${t.name} from the app: their name, phone number and login are erased and they can no longer log in. Their <strong>${counts.total} past session${counts.total === 1 ? "" : "s"}</strong> stay in patients' history as "Former therapist". It cannot be undone.</p>
<p class="muted">If they're only taking a break, use <strong>Inactive</strong> on the Therapists page instead.</p>`, counts.upcoming
  ? `${t.name} still has ${counts.upcoming} upcoming session${counts.upcoming === 1 ? "" : "s"}. Move them to another therapist or cancel them first.`
  : undefined)}`, flash);
}

/** Messages created together for one appointment event (e.g. the booking confirmation to patient + therapist). */
function groupMessages(messages: MessageRow[]) {
  const groups: { key: string; items: MessageRow[] }[] = [];
  for (const m of messages) {
    const g = groups.at(-1);
    const near = g && Math.abs(Date.parse(g.items[0].created_at) - Date.parse(m.created_at)) < 120_000;
    if (g && near && g.items[0].appointment_id === m.appointment_id && g.items[0].kind === m.kind) g.items.push(m);
    else groups.push({ key: `${m.appointment_id}-${m.kind}-${m.id}`, items: [m] });
  }
  return groups;
}

function shortStatus(m: MessageRow) {
  if (m.manual_sent_at || m.status === "sent") return html`<span class="pill ok">✓ Sent</span>`;
  if (m.status === "skipped") return html`<span class="pill muted-pill">No consent</span>`;
  if (m.status === "failed") return html`<span class="pill bad">Failed</span>`;
  return html`<span class="pill wait">To send</span>`;
}

/** One row per appointment event: session time, patient, therapist; messages expand on tap. */
export function messageGroups(messages: MessageRow[]) {
  if (messages.length === 0) return html`<div class="card muted">No messages here.</div>`;
  let lastDay = "";
  return html`<div class="msg-list">${groupMessages(messages).map(({ items }) => {
    const first = items[0];
    const heading = dayHeading(first.created_at);
    const showHeading = heading !== lastDay;
    lastDay = heading;
    const pending = items.filter(needsManualSend).length;
    const patientMsg = items.find((m) => m.recipient === "patient");
    const therapistMsg = items.find((m) => m.recipient === "therapist");
    const start = first.appt_start ? new Date(first.appt_start) : null;
    return html`${showHeading ? html`<div class="msg-day">${heading}</div>` : ""}
<details class="ev ${pending ? "pending" : ""}">
<summary class="ev-row">
  <div class="ev-when"><strong>${start ? formatDateTime(start).replace(/ \d{4},/, ",") : "—"}</strong>
    <span class="muted">${first.appt_service ?? ""}${first.appt_status === "cancelled" ? " · cancelled" : ""}</span></div>
  <div class="ev-who"><span class="lbl">Patient</span> <strong>${first.patient_name ?? "—"}</strong>${first.guardian_name ? html` <span class="muted">(${first.guardian_name})</span>` : ""}
    ${patientMsg ? shortStatus(patientMsg) : ""}</div>
  <div class="ev-who"><span class="lbl">Therapist</span> <strong>${first.therapist_name ?? "—"}</strong>
    ${therapistMsg ? shortStatus(therapistMsg) : ""}</div>
  <div class="ev-kind"><span class="pill muted-pill">${kindLabel(first.kind)}</span><span class="ev-toggle">View messages</span></div>
</summary>
<div class="ev-body">
${items.map((m) => html`<div class="ev-msg">
  <div class="msg-head">${statusPill(m)} <strong>To ${m.to_name || m.recipient}</strong> <span class="muted">${m.recipient} · ${fmtPhone(m.to_phone)}</span></div>
  <div class="msg-full">${m.body_preview}</div>
  ${needsManualSend(m) ? html`<div class="msg-action">${sendButton(m, m.to_name || m.recipient)}</div>` : ""}
</div>`)}
${first.appointment_id ? html`<a class="muted" href="/appointments/${first.appointment_id}">Open appointment →</a>` : ""}
</div>
</details>`;
  })}</div>`;
}

export interface DeleteCounts { total: number; upcoming: number }

/** A folded, deliberately awkward delete section: type the exact name and tick a box. */
function dangerZone(kind: string, name: string, action: string, explain: ReturnType<typeof html>, blocked?: string) {
  return html`<details class="card danger-zone">
<summary>Danger zone: delete this ${kind}</summary>
${explain}
${blocked
  ? html`<p class="flash error" style="margin:8px 0">${blocked}</p>`
  : html`<form method="post" action="${action}" class="delete-form">
<label for="confirm_name">To confirm, type the ${kind}'s name exactly: <strong>${name}</strong></label>
<input id="confirm_name" name="confirm_name" autocomplete="off" required>
<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="understand" value="1" required> I understand this cannot be undone</label>
<button class="danger" disabled data-name="${name}">Permanently delete ${kind}</button>
</form>
<script>
(function () {
  var f = document.currentScript.previousElementSibling, b = f.querySelector("button"), i = f.querySelector("input[name=confirm_name]"), c = f.querySelector("input[name=understand]");
  function check() { b.disabled = !(c.checked && i.value.trim().toLowerCase() === b.dataset.name.trim().toLowerCase()); }
  i.addEventListener("input", check); c.addEventListener("change", check);
  f.addEventListener("submit", function (e) { if (!confirm("Last check: permanently delete " + b.dataset.name + "?")) e.preventDefault(); });
})();
</script>`}
</details>`;
}

export function messagesPage(user: User, messages: MessageRow[], pendingOnly: boolean) {
  return layout("Messages", user, html`<h1>WhatsApp messages</h1>
<div class="row" style="flex:0 0 auto;gap:8px;margin-bottom:8px">
<a class="btn ${pendingOnly ? "" : "secondary"} small" style="flex:0 0 auto" href="/messages?pending=1">Waiting for you to send</a>
<a class="btn ${pendingOnly ? "secondary" : ""} small" style="flex:0 0 auto" href="/messages">All messages</a></div>
<p class="muted">${pendingOnly ? "Upcoming appointments with messages still to send from your WhatsApp." : "Recent appointment messages. Tap a row to see the messages."}</p>
${messageGroups(messages)}`);
}

export function pendingBanner(count: number) {
  if (!count) return "";
  return html`<a class="card send-banner" href="/messages?pending=1"><strong>${count} WhatsApp message${count === 1 ? "" : "s"} waiting for you to send</strong><span>Open →</span></a>`;
}

export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const FOLLOW_UP = 2;

export function holidaysPage(user: User, rows: { day: string; name: string; booked: number }[], today: string, flash?: { type: "ok" | "error"; text: string }) {
  return layout("Clinic holidays", user, html`
<p><a href="/">← Schedule</a></p>
<h1>Clinic holidays</h1>
<p class="muted">On these days new bookings are blocked and weekly repeats skip them. Existing sessions are not cancelled automatically.</p>
<form class="card" method="post" action="/holidays">
<div class="row"><div><label for="day">Date</label><input type="date" id="day" name="day" min="${today}" required></div>
<div><label for="name">Name</label><input id="name" name="name" maxlength="60" placeholder="e.g. Diwali"></div></div>
<button>Mark clinic closed</button></form>
<div class="card" style="overflow-x:auto">
${rows.length === 0 ? html`<p class="muted" style="margin:0">No upcoming holidays.</p>` : html`<table><tr><th>Date</th><th>Name</th><th>Booked that day</th><th></th></tr>
${rows.map((h) => html`<tr><td>${formatDateTime(new Date(`${h.day}T06:30:00Z`)).replace(/, \d+:\d+ [AP]M$/, "")}</td><td>${h.name}</td>
<td>${h.booked ? html`<a href="/?day=${h.day}" style="color:var(--bad);font-weight:700">${h.booked} session${h.booked === 1 ? "" : "s"} to move</a>` : html`<span class="muted">none</span>`}</td>
<td><form method="post" action="/holidays/${h.day}/delete" style="margin:0"><button class="secondary small" style="margin:0">Remove</button></form></td></tr>`)}</table>`}
</div>`, flash);
}

export function patientSummaryPage(user: User, p: PatientRow, month: string, appts: ApptRow[], flag: FollowUp | null, flash?: { type: "ok" | "error"; text: string }, billsCard: unknown = "") {
  const now = Date.now();
  const count = (st: string) => appts.filter((a) => a.status === st).length;
  const attended = count("completed"), missed = count("no_show"), cancelled = count("cancelled");
  const upcoming = appts.filter((a) => a.status === "booked" && Date.parse(a.start_utc) > now).length;
  const unmarked = appts.filter((a) => a.status === "booked" && Date.parse(a.start_utc) <= now).length;
  const [y, m] = month.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const shift = (d: number) => { const x = new Date(Date.UTC(y, m - 1 + d, 1)); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`; };
  const shortMonth = (d: number) => new Date(Date.UTC(y, m - 1 + d, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const greetName = p.guardian_name || p.name;
  const parts = [`${attended} attended`, `${missed} missed`, `${cancelled} cancelled`].concat(upcoming ? [`${upcoming} still to come`] : []);
  const share = `Hello ${greetName}, here is ${p.name}'s session summary at Vocalzz for ${label}: ${parts.join(", ")}. Thank you for being part of the therapy journey. For any questions, just reply to this message.`;
  return layout("Patient summary", user, html`
<p><a href="/patients">← Patients</a></p>
<h1>${p.name}${p.guardian_name ? html` <span class="muted" style="font-size:16px">parent: ${p.guardian_name}</span>` : ""}</h1>
${flag ? html`<div class="card followup-banner"><strong>⚠ Missed ${flag.missed} sessions in a row</strong> <span class="muted">(last on ${formatDateTime(new Date(flag.lastMissed))})</span>
<p style="margin:6px 0 0">A friendly check-in call or message can help. Every family's situation is different.</p>
<div class="row" style="flex:0 0 auto;gap:8px">
${p.whatsapp_consent ? html`<a class="btn wa-send" style="flex:0 0 auto" target="_blank" rel="noopener" href="https://wa.me/${p.phone}?text=${encodeURIComponent(`Hello ${greetName}, we missed ${p.name} at the last couple of sessions at Vocalzz. We hope everything is okay. Would you like us to find a time that suits you better? Just reply to this message.`)}">Message ${greetName} on WhatsApp</a>` : ""}
<a class="btn secondary" style="flex:0 0 auto" href="tel:+${p.phone}">Call ${greetName}</a>
<form method="post" action="/patients/${p.id}/followed-up" style="margin:0;flex:0 0 auto"><button class="secondary">Mark as followed up</button></form></div></div>` : ""}
<div class="weeknav"><a class="btn secondary small" href="/patients/${p.id}/summary?month=${shift(-1)}">‹ ${shortMonth(-1)}</a>
<strong style="padding:0 6px">${label}</strong>
<a class="btn secondary small" href="/patients/${p.id}/summary?month=${shift(1)}">${shortMonth(1)} ›</a></div>
<div class="stat-grid card">
<div class="stat"><b style="color:var(--ok)">${attended}</b>attended</div>
<div class="stat"><b style="color:var(--warn)">${missed}</b>missed</div>
<div class="stat"><b style="color:var(--bad)">${cancelled}</b>cancelled</div>
<div class="stat"><b>${upcoming}</b>upcoming</div>
${unmarked ? html`<div class="stat"><b class="muted">${unmarked}</b>not marked yet</div>` : ""}
</div>
${unmarked ? html`<p class="muted">${unmarked} past session${unmarked === 1 ? " is" : "s are"} still "booked". Open ${unmarked === 1 ? "it" : "them"} and mark completed or no-show so the summary is accurate.</p>` : ""}
${p.whatsapp_consent ? html`<a class="btn wa-send" target="_blank" rel="noopener" href="https://wa.me/${p.phone}?text=${encodeURIComponent(share)}">Share this summary with ${greetName} on WhatsApp</a>` : html`<p class="muted">No WhatsApp consent recorded, so sharing is off.</p>`}
${billsCard}
<h2>Sessions</h2>
${appts.length === 0 ? html`<div class="card muted">No sessions this month.</div>` : ""}
${appts.map((a) => html`<a class="card appt" href="/appointments/${a.id}">
<div class="time" style="min-width:110px">${formatDateTime(new Date(a.start_utc)).replace(/ \d{4},/, ",")}</div>
<div><div><strong>${a.service}</strong> · ${a.therapist_name}</div><span class="badge ${a.status}">${statusLabel(a.status)}</span></div></a>`)}
`, flash);
}
