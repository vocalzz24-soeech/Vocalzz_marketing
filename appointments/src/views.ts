// Server-rendered HTML pages. `html` escapes every interpolated value.
import { html, raw } from "hono/html";
import type { User } from "./auth.ts";
import type { ApptRow } from "./notify.ts";
import { dateToIstLocal, formatDateTime, formatTime, istDay } from "./time.ts";
import { endOf, timeSlots } from "./schedule.ts";

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
.legend{display:flex;align-items:center;gap:6px;margin:8px 0 0}.sw{display:inline-block;width:14px;height:14px;border-radius:4px}.sw.weekend{background:var(--wk-bg);border:1px solid var(--wk-line)}
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
<title>${title} · Vocalzz Appointments</title><link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22s%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23E4EAF2%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%238C9BB0%22/%3E%3C/linearGradient%3E%3ClinearGradient%20id%3D%22b%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%235AA9FF%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%231E6FD9%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2214%22%20fill%3D%22%230B1220%22/%3E%3Cpath%20d%3D%22M8%2013h12l13%2033-6%209z%22%20fill%3D%22url%28%23s%29%22/%3E%3Cpath%20d%3D%22M27%2013h30l-4%209L37%2055h-9l15-33H31z%22%20fill%3D%22url%28%23b%29%22/%3E%3C/svg%3E"><style>${raw(CSS)}</style></head>
<body>
<header><strong style="display:flex;align-items:center;gap:8px"><svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4EAF2"/><stop offset="1" stop-color="#8C9BB0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5AA9FF"/><stop offset="1" stop-color="#1E6FD9"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#0B1220"/><path d="M8 13h12l13 33-6 9z" fill="url(#s)"/><path d="M27 13h30l-4 9L37 55h-9l15-33H31z" fill="url(#b)"/></svg>VOCALZZ <span style="color:var(--brand);font-weight:600">Appointments</span></strong>
<a class="site-link" href="https://vocalzz.com/">← Website</a>
${user
  ? html`<a href="/">Schedule</a>${user.role === "admin"
      ? html`<a href="/appointments/new">+ Book</a><a href="/patients">Patients</a><a href="/therapists">Therapists</a><a href="/messages">Messages</a>`
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

export interface TherapistRow { id: number; name: string; phone: string; specialty: string | null; active: number; has_login: number }
export interface PatientRow { id: number; name: string; guardian_name: string | null; phone: string; whatsapp_consent: number; notes: string | null }

export interface DayChip { day: string; booked: number }

export function schedulePage(user: User, win: { selected: string; start: string; prevStart: string; nextStart: string }, chips: DayChip[], today: string, appts: ApptRow[], therapists: TherapistRow[], flash?: { type: "ok" | "error"; text: string }, pendingCount = 0) {
  const day = win.selected;
  const groups = therapists
    .map((t) => ({ t, list: appts.filter((a) => a.therapist_id === t.id) }))
    .filter((g) => user.role === "admin" || g.t.id === user.therapist_id);
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chip = (c: DayChip) => {
    const d = new Date(`${c.day}T00:00:00Z`);
    const wd = d.getUTCDay();
    const cls = ["day-chip", wd === 0 || wd === 6 ? "weekend" : "", c.day === day ? "selected" : "", c.day === today ? "today" : ""].join(" ");
    return html`<a class="${cls}" href="/?day=${c.day}&start=${win.start}" aria-current="${c.day === day ? "date" : "false"}">
<span class="wd">${c.day === today ? "Today" : WD[wd]}</span><span class="dn">${d.getUTCDate()}</span><span class="mo">${MON[d.getUTCMonth()]}</span>
<span class="cnt">${c.booked ? html`<b>${c.booked}</b><span class="cnt-word"> booked</span>` : "free"}</span></a>`;
  };
  const sel = new Date(`${day}T00:00:00Z`);
  return layout("Schedule", user, html`
<h1>Schedule</h1>
${user.role === "admin" ? pendingBanner(pendingCount) : ""}
<div class="weeknav">
<a class="btn secondary small" href="/?day=${win.prevStart}&start=${win.prevStart}">‹ Prev week</a>
<a class="btn secondary small" href="/?day=${win.nextStart}&start=${win.nextStart}">Next week ›</a>
<a class="btn secondary small" href="/">Today</a>
<form method="get" action="/" style="margin:0"><input type="date" name="day" value="${day}" onchange="this.form.submit()" aria-label="Jump to a date"></form>
</div>
<div class="week">${chips.map(chip)}</div>
<p class="muted legend"><span class="sw weekend"></span> Saturday &amp; Sunday</p>
<h2 style="margin-top:8px">${WD[sel.getUTCDay()]}, ${sel.getUTCDate()} ${MON[sel.getUTCMonth()]} ${sel.getUTCFullYear()}${
  sel.getUTCDay() === 0 || sel.getUTCDay() === 6 ? html` <span class="badge weekend-badge">Weekend</span>` : ""}</h2>
${groups.length === 0 ? html`<div class="card muted">No therapists yet. ${user.role === "admin" ? html`<a href="/therapists">Add one</a>.` : ""}</div>` : ""}
${groups.map((g) => html`
<h2>${g.t.name} <span class="muted">${g.list.filter((a) => a.status === "booked").length} booked</span></h2>
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

export interface ApptForm { patient_id?: string; therapist_id?: string; service?: string; start?: string; duration?: string; extra?: string; notes?: string }

export function newAppointmentPage(user: User, patients: PatientRow[], therapists: TherapistRow[], defaultDuration: number, form: ApptForm = {}, error?: string) {
  return layout("Book appointment", user, html`
<h1>Book an appointment</h1>
${patients.length === 0 ? html`<div class="card">Add a patient first on the <a href="/patients">Patients</a> page.</div>` : ""}
<form class="card" method="post" action="/appointments">
<label for="patient_id">Patient</label>
<select id="patient_id" name="patient_id" required><option value="">Choose…</option>
${patients.map((p) => html`<option value="${p.id}" ${String(p.id) === form.patient_id ? "selected" : ""}>${p.name}${p.guardian_name ? ` (parent: ${p.guardian_name})` : ""} · ${p.phone.slice(2)}</option>`)}
</select>
<p class="muted">New patient? <a href="/patients">Add them first</a>.</p>
${apptFields(therapists, defaultDuration, form)}
<button>Book and send WhatsApp messages</button>
</form>`, error ? { type: "error", text: error } : undefined);
}

function apptFields(therapists: TherapistRow[], defaultDuration: number, form: ApptForm) {
  const extra = form.extra ?? "0";
  return html`
<label for="therapist_id">Therapist</label>
<select id="therapist_id" name="therapist_id" required><option value="">Choose…</option>
${therapists.filter((t) => t.active).map((t) => html`<option value="${t.id}" ${String(t.id) === form.therapist_id ? "selected" : ""}>${t.name}${t.specialty ? ` · ${t.specialty}` : ""}</option>`)}
</select>
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

export interface MessageRow { id: number; appointment_id: number | null; recipient: string; to_phone: string; kind: string; body_preview: string; status: string; error: string | null; created_at: string; manual_sent_at: string | null; to_name?: string | null }

/** Not delivered automatically (WhatsApp not connected yet, or a send failed) and not yet sent by hand. */
export const needsManualSend = (m: MessageRow) => (m.status === "dry_run" || m.status === "failed") && !m.manual_sent_at;

const KIND_LABEL: Record<string, string> = {
  confirmation: "booking confirmation", reminder_24h: "day-before reminder", reminder_2h: "2-hour reminder",
  rescheduled: "new time", cancelled: "cancellation",
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

export function appointmentPage(user: User, a: ApptRow, messages: MessageRow[], therapists: TherapistRow[], defaultDuration: number, flash?: { type: "ok" | "error"; text: string }) {
  const start = new Date(a.start_utc);
  const end = endOf({ start, durationMin: a.duration_min, extraMin: a.extra_min });
  const isAdmin = user.role === "admin";
  return layout("Appointment", user, html`
<h1>${a.patient_name} · ${a.service}</h1>
<div class="card">
<div><strong>${formatDateTime(start)}</strong> to ${formatTime(end)} (${a.duration_min + a.extra_min} min${a.extra_min ? `, incl. +${a.extra_min}` : ""})</div>
<div>Therapist: ${a.therapist_name}</div>
<div>Contact: ${a.guardian_name ? `${a.guardian_name} (parent) · ` : ""}+${a.patient_phone}</div>
<div>Status: <span class="badge ${a.status}">${statusLabel(a.status)}</span>${a.cancel_reason ? html` <span class="muted">${a.cancel_reason}</span>` : ""}</div>
${a.notes ? html`<div class="muted">Note: ${a.notes}</div>` : ""}
${!a.whatsapp_consent ? html`<div class="flash error" style="margin-top:10px">No WhatsApp consent recorded, so this patient gets no messages. Update it on the Patients page.</div>` : ""}
</div>
${isAdmin ? sendPanel(a, messages) : ""}
${a.status === "booked" ? html`
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
<button>Save and notify both</button></form></details>
<details class="card"><summary><strong>Cancel appointment</strong></summary>
<form method="post" action="/appointments/${a.id}/cancel">
<label for="reason">Reason (internal, optional)</label><input id="reason" name="reason" maxlength="200">
<button class="danger">Cancel and notify both</button></form></details>` : ""}
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

export function patientsPage(user: User, patients: PatientRow[], q: string, flash?: { type: "ok" | "error"; text: string }) {
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
${patients.map((p) => html`<tr><td>${p.name}</td><td>${p.guardian_name ?? ""}</td><td>+${p.phone}</td>
<td><form method="post" action="/patients/${p.id}/consent" style="margin:0"><button class="secondary" style="margin:0;padding:4px 10px" name="value" value="${p.whatsapp_consent ? "0" : "1"}">${p.whatsapp_consent ? "Yes" : "No"}</button></form></td>
<td style="white-space:nowrap"><a class="btn secondary small" href="/patients/${p.id}/edit">Edit</a> <a class="btn small" href="/appointments/new?patient_id=${p.id}">Book</a></td></tr>`)}
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

export function patientEditPage(user: User, p: PatientRow, flash?: { type: "ok" | "error"; text: string }) {
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
</form>`, flash);
}

export function therapistEditPage(user: User, t: TherapistRow, flash?: { type: "ok" | "error"; text: string }) {
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
</form>`, flash);
}

export function messagesPage(user: User, messages: MessageRow[], pendingOnly: boolean) {
  return layout("Messages", user, html`<h1>WhatsApp messages</h1>
<div class="row" style="flex:0 0 auto;gap:8px;margin-bottom:8px">
<a class="btn ${pendingOnly ? "" : "secondary"} small" style="flex:0 0 auto" href="/messages?pending=1">Waiting for you to send</a>
<a class="btn ${pendingOnly ? "secondary" : ""} small" style="flex:0 0 auto" href="/messages">All messages</a></div>
<p class="muted">${pendingOnly ? "Messages for upcoming appointments that still need sending from your WhatsApp." : "The last 200 messages."}</p>
${messageTable(messages)}`);
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
