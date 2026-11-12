// Server-rendered HTML pages. `html` escapes every interpolated value.
import { html, raw } from "hono/html";
import type { User } from "./auth.ts";
import type { ApptRow } from "./notify.ts";
import { dateToIstLocal, formatDateTime, formatTime } from "./time.ts";
import { endOf } from "./schedule.ts";

type H = ReturnType<typeof html>;

const CSS = `
:root{--bg:#f7f7f5;--card:#fff;--ink:#1d1d1b;--muted:#6b6b66;--line:#e3e2dc;--brand:#0f766e;--brand-ink:#fff;--warn:#b45309;--bad:#b91c1c;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1f1f1d;--ink:#ecebe6;--muted:#a3a29b;--line:#34332f;--brand:#2dd4bf;--brand-ink:#04201d;--warn:#f59e0b;--bad:#f87171;--ok:#4ade80}}
*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
header strong{margin-right:auto}header a{color:var(--ink);text-decoration:none;font-size:15px}
main{max-width:860px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:4px 0 14px}h2{font-size:18px;margin:22px 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px}
label{display:block;font-weight:600;font-size:14px;margin:12px 0 4px}
input,select,textarea{width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
input[type=checkbox],input[type=radio]{width:auto}
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
<title>${title} · Vocalzz Appointments</title><style>${raw(CSS)}</style></head>
<body>
<header><strong>Vocalzz Appointments</strong>
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
</main></body></html>`;
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

export function schedulePage(user: User, day: string, appts: ApptRow[], therapists: TherapistRow[], flash?: { type: "ok" | "error"; text: string }) {
  const prev = shiftDay(day, -1), next = shiftDay(day, 1);
  const groups = therapists
    .map((t) => ({ t, list: appts.filter((a) => a.therapist_id === t.id) }))
    .filter((g) => user.role === "admin" || g.t.id === user.therapist_id);
  return layout("Schedule", user, html`
<h1>Schedule</h1>
<form class="daynav" method="get" action="/">
<a class="btn secondary" href="/?day=${prev}">‹ Prev</a>
<div><label for="day" class="muted" style="margin-top:0">Day</label><input type="date" id="day" name="day" value="${day}" onchange="this.form.submit()"></div>
<a class="btn secondary" href="/?day=${next}">Next ›</a>
</form>
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
<div><label for="start">Date and time</label><input id="start" name="start" type="datetime-local" step="300" value="${form.start ?? ""}" required></div>
<div><label for="duration">Length (minutes)</label><input id="duration" name="duration" type="number" min="15" max="180" step="5" value="${form.duration ?? String(defaultDuration)}" required></div>
</div>
<label>Extra time</label>
<div class="chips">
${["0", "10", "15"].map((v) => html`<label><input type="radio" name="extra" value="${v}" ${v === extra ? "checked" : ""}> ${v === "0" ? "None" : `+${v} min`}</label>`)}
</div>
<label for="notes">Note for the clinic (optional, no medical details)</label>
<input id="notes" name="notes" value="${form.notes ?? ""}" maxlength="200">`;
}

export interface MessageRow { id: number; appointment_id: number | null; recipient: string; to_phone: string; kind: string; body_preview: string; status: string; error: string | null; created_at: string }

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

export function messageTable(messages: MessageRow[]) {
  if (messages.length === 0) return html`<div class="card muted">No messages yet.</div>`;
  return html`<div class="card" style="overflow-x:auto"><table>
<tr><th>When</th><th>To</th><th>Type</th><th>Status</th><th>Message</th></tr>
${messages.map((m) => html`<tr><td>${formatDateTime(new Date(m.created_at))}</td><td>${m.recipient}<br><span class="muted">+${m.to_phone}</span></td>
<td>${m.kind}${m.appointment_id ? html`<br><a href="/appointments/${m.appointment_id}">#${m.appointment_id}</a>` : ""}</td>
<td>${m.status === "dry_run" ? "test (not sent)" : m.status}${m.error ? html`<br><span class="muted">${m.error}</span>` : ""}</td>
<td style="white-space:pre-wrap">${m.body_preview}</td></tr>`)}
</table></div>`;
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
<td><a href="/appointments/new?patient_id=${p.id}">Book</a></td></tr>`)}
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
<div class="card" style="overflow-x:auto"><table><tr><th>Name</th><th>Specialty</th><th>WhatsApp</th><th>Login</th><th>Active</th></tr>
${therapists.map((t) => html`<tr><td>${t.name}</td><td>${t.specialty ?? ""}</td><td>+${t.phone}</td><td>${t.has_login ? "Yes" : "No"}</td>
<td><form method="post" action="/therapists/${t.id}/active" style="margin:0"><button class="secondary" style="margin:0;padding:4px 10px" name="value" value="${t.active ? "0" : "1"}">${t.active ? "Active" : "Inactive"}</button></form></td></tr>`)}
</table>${therapists.length === 0 ? html`<p class="muted">No therapists yet.</p>` : ""}</div>
`, flash);
}

export function messagesPage(user: User, messages: MessageRow[]) {
  return layout("Messages", user, html`<h1>WhatsApp messages</h1>
<p class="muted">The last 200 messages. "test (not sent)" means WhatsApp is not connected yet.</p>${messageTable(messages)}`);
}

export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
