import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "./env.ts";
import {
  SESSION_COOKIE, SESSION_MAX_AGE, createSession, deleteSession, hashPassword, userForSession,
  verifyPassword, type User,
} from "./auth.ts";
import { checkClinicHours, findClashes, normalisePhone, weekWindow, type Slot } from "./schedule.ts";
import { istDay, istDayRange, istLocalToDate, formatTime } from "./time.ts";
import {
  APPT_SELECT, loadAppointment, notifyBooked, notifyCancelled, notifyRescheduled, runReminders,
  type ApptRow,
} from "./notify.ts";
import {
  appointmentPage, loginPage, messagesPage, newAppointmentPage, patientsPage, schedulePage,
  setupPage, therapistsPage, patientEditPage, therapistEditPage, SERVICES, type ApptForm, type MessageRow, type PatientRow, type TherapistRow,
} from "./views.ts";

type AppEnv = { Bindings: Env; Variables: { user: User } };
type C = Context<AppEnv>;

const app = new Hono<AppEnv>();

// --- Security headers and same-origin check for form posts -----------------------------
app.use("*", async (c, next) => {
  if (c.req.method === "POST") {
    const origin = c.req.header("origin");
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.text("Forbidden", 403);
  }
  await next();
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "no-store");
});

// --- Flash messages via a short-lived cookie ---------------------------------------------
type Flash = { type: "ok" | "error"; text: string };
function setFlash(c: C, flash: Flash) {
  setCookie(c, "vz_flash", encodeURIComponent(JSON.stringify(flash)), { path: "/", httpOnly: true, sameSite: "Lax", maxAge: 60 });
}
function takeFlash(c: C): Flash | undefined {
  const raw = getCookie(c, "vz_flash");
  if (!raw) return undefined;
  deleteCookie(c, "vz_flash", { path: "/" });
  try { return JSON.parse(decodeURIComponent(raw)); } catch { return undefined; }
}
const redirectWith = (c: C, to: string, flash: Flash) => { setFlash(c, flash); return c.redirect(to, 303); };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isSecure = (c: C) => new URL(c.req.url).protocol === "https:";

// --- Public routes -------------------------------------------------------------------------
async function userCount(env: Env) {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())?.n ?? 0;
}

app.get("/setup", async (c) => ((await userCount(c.env)) > 0 ? c.redirect("/login") : c.html(setupPage())));
app.post("/setup", async (c) => {
  if ((await userCount(c.env)) > 0) return c.redirect("/login");
  const f = await c.req.parseBody();
  const login = normalisePhone(str(f.login));
  const password = str(f.password);
  if (!str(f.name) || !login) return c.html(setupPage("Enter your name and a valid 10-digit mobile number."), 400);
  if (password.length < 8) return c.html(setupPage("The password needs at least 8 characters."), 400);
  const { hash, salt } = await hashPassword(password);
  await c.env.DB.prepare("INSERT INTO users (name, login, role, password_hash, password_salt) VALUES (?, ?, 'admin', ?, ?)")
    .bind(str(f.name), login, hash, salt).run();
  return redirectWith(c, "/login", { type: "ok", text: "Admin created. Log in now." });
});

app.get("/login", async (c) => {
  if ((await userCount(c.env)) === 0) return c.redirect("/setup");
  const flash = takeFlash(c);
  return c.html(loginPage(flash?.type === "error" ? flash.text : undefined));
});
app.post("/login", async (c) => {
  const f = await c.req.parseBody();
  const login = normalisePhone(str(f.login));
  const row = login
    ? await c.env.DB.prepare("SELECT id, password_hash, password_salt FROM users WHERE login = ? AND active = 1")
        .bind(login).first<{ id: number; password_hash: string; password_salt: string }>()
    : null;
  if (!row || !(await verifyPassword(str(f.password), row.password_hash, row.password_salt))) {
    return c.html(loginPage("Wrong phone number or password."), 401);
  }
  const token = await createSession(c.env.DB, row.id);
  setCookie(c, SESSION_COOKIE, token, { path: "/", httpOnly: true, sameSite: "Lax", secure: isSecure(c), maxAge: SESSION_MAX_AGE });
  return c.redirect("/", 303);
});

// --- Everything below needs a login ----------------------------------------------------------
app.use("*", async (c, next) => {
  const user = await userForSession(c.env.DB, getCookie(c, SESSION_COOKIE));
  if (!user) return c.redirect("/login");
  c.set("user", user);
  await next();
});
const adminOnly = async (c: C, next: () => Promise<void>) => {
  if (c.get("user").role !== "admin") return c.text("Only the clinic admin can do this.", 403);
  await next();
};

app.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await deleteSession(c.env.DB, token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/login", 303);
});

// --- Schedule -----------------------------------------------------------------------------------
async function therapistList(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT t.*, EXISTS(SELECT 1 FROM users u WHERE u.therapist_id = t.id AND u.active = 1) AS has_login
       FROM therapists t ORDER BY t.active DESC, t.name`,
  ).all<TherapistRow>();
  return results;
}

app.get("/", async (c) => {
  const user = c.get("user");
  const today = istDay(new Date());
  const win = weekWindow(today, c.req.query("day"), c.req.query("start"));
  const from = istDayRange(win.days[0])!.start, to = istDayRange(win.days[6])!.end;
  const { results } = await c.env.DB.prepare(`${APPT_SELECT} WHERE a.start_utc >= ? AND a.start_utc < ? ORDER BY a.start_utc`)
    .bind(from.toISOString(), to.toISOString()).all<ApptRow>();
  const mine = user.role === "admin" ? results : results.filter((a) => a.therapist_id === user.therapist_id);
  const chips = win.days.map((d) => ({ day: d, booked: mine.filter((a) => a.status === "booked" && istDay(new Date(a.start_utc)) === d).length }));
  const dayAppts = results.filter((a) => istDay(new Date(a.start_utc)) === win.selected);
  const therapists = (await therapistList(c.env)).filter((t) => t.active || dayAppts.some((a) => a.therapist_id === t.id));
  return c.html(schedulePage(user, win, chips, today, dayAppts, therapists, takeFlash(c), user.role === "admin" ? await pendingCount(c.env) : 0));
});

// --- Appointments ------------------------------------------------------------------------------
async function patientList(env: Env, q = "") {
  const like = `%${q}%`;
  const { results } = await env.DB.prepare(
    `SELECT * FROM patients WHERE ? = '' OR name LIKE ? OR guardian_name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 500`,
  ).bind(q, like, like, like).all<PatientRow>();
  return results;
}

/** Validates the form and returns the slot, or an error message. */
async function validateSlot(env: Env, f: ApptForm, excludeId?: number) {
  const start = istLocalToDate(f.start ?? "");
  const durationMin = Number(f.duration);
  const extraMin = Number(f.extra ?? 0);
  const therapistId = Number(f.therapist_id);
  if (!start) return { error: "Choose a date and a time." };
  if (start.getUTCMinutes() % 5 !== 0) return { error: "Choose a time in 5-minute steps, like 11:00, 11:05 or 11:10." };
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 180) return { error: "Length must be 15 to 180 minutes." };
  if (![0, 10, 15].includes(extraMin)) return { error: "Extra time must be none, +10 or +15 minutes." };
  if (!SERVICES.includes(f.service ?? "")) return { error: "Choose a therapy." };
  const therapist = await env.DB.prepare("SELECT id, active FROM therapists WHERE id = ?").bind(therapistId).first<{ id: number; active: number }>();
  if (!therapist?.active) return { error: "Choose an active therapist." };
  if (start.getTime() < Date.now() - 5 * 60_000) return { error: "That time is in the past." };

  const slot: Slot = { id: excludeId, start, durationMin, extraMin };
  const hoursError = checkClinicHours(slot, Number(env.OPEN_HOUR), Number(env.CLOSE_HOUR));
  if (hoursError) return { error: hoursError };

  // Look at booked appointments for this therapist or patient within 4 hours either side.
  const from = new Date(start.getTime() - 4 * 3_600_000).toISOString();
  const to = new Date(start.getTime() + 4 * 3_600_000).toISOString();
  const { results } = await env.DB.prepare(
    `${APPT_SELECT} WHERE a.status = 'booked' AND a.start_utc > ? AND a.start_utc < ? AND (a.therapist_id = ? OR a.patient_id = ?)`,
  ).bind(from, to, therapistId, Number(f.patient_id)).all<ApptRow>();
  const clashes = findClashes(slot, results.map((a) => ({
    ...a, start: new Date(a.start_utc), durationMin: a.duration_min, extraMin: a.extra_min,
  })));
  if (clashes.length) {
    const x = clashes[0];
    const who = x.therapist_id === therapistId ? `${x.therapist_name} already has ${x.patient_name}` : `${x.patient_name} already has a session with ${x.therapist_name}`;
    return { error: `Time clash: ${who} at ${formatTime(x.start)}.` };
  }
  return { slot, therapistId, service: f.service!, notes: (f.notes ?? "").slice(0, 200) };
}

const formFrom = (f: Record<string, unknown>): ApptForm => ({
  patient_id: str(f.patient_id), therapist_id: str(f.therapist_id), service: str(f.service),
  start: str(f.start) || (str(f.date) && str(f.time) ? `${str(f.date)}T${str(f.time)}` : ""), duration: str(f.duration), extra: str(f.extra) || "0", notes: str(f.notes),
});

app.get("/appointments/new", adminOnly, async (c) => {
  const form: ApptForm = { patient_id: c.req.query("patient_id") };
  return c.html(newAppointmentPage(c.get("user"), await patientList(c.env), await therapistList(c.env), Number(c.env.DEFAULT_DURATION_MIN), form));
});

app.post("/appointments", adminOnly, async (c) => {
  const form = formFrom(await c.req.parseBody());
  const fail = async (msg: string) =>
    c.html(newAppointmentPage(c.get("user"), await patientList(c.env), await therapistList(c.env), Number(c.env.DEFAULT_DURATION_MIN), form, msg), 400);
  const patient = await c.env.DB.prepare("SELECT id FROM patients WHERE id = ?").bind(Number(form.patient_id)).first();
  if (!patient) return fail("Choose a patient.");
  const v = await validateSlot(c.env, form);
  if ("error" in v) return fail(v.error!);
  const res = await c.env.DB.prepare(
    `INSERT INTO appointments (patient_id, therapist_id, service, start_utc, duration_min, extra_min, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(Number(form.patient_id), v.therapistId, v.service, v.slot.start.toISOString(), v.slot.durationMin, v.slot.extraMin, v.notes || null, c.get("user").id).run();
  const appt = (await loadAppointment(c.env, Number(res.meta.last_row_id)))!;
  await notifyBooked(c.env, appt);
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Booked. WhatsApp messages are ready for the patient and therapist." });
});

async function loadForUser(c: C): Promise<ApptRow | null> {
  const appt = await loadAppointment(c.env, Number(c.req.param("id")));
  const user = c.get("user");
  if (!appt || (user.role !== "admin" && appt.therapist_id !== user.therapist_id)) return null;
  return appt;
}

app.get("/appointments/:id", async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  const { results } = await c.env.DB.prepare("SELECT * FROM messages WHERE appointment_id = ? ORDER BY id DESC").bind(appt.id).all<MessageRow>();
  return c.html(appointmentPage(c.get("user"), appt, results, await therapistList(c.env), Number(c.env.DEFAULT_DURATION_MIN), takeFlash(c)));
});

app.post("/appointments/:id/status", async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  const status = str((await c.req.parseBody()).status);
  if (!["completed", "no_show"].includes(status) || appt.status !== "booked") return c.redirect(`/appointments/${appt.id}`, 303);
  await c.env.DB.prepare("UPDATE appointments SET status = ? WHERE id = ?").bind(status, appt.id).run();
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: status === "completed" ? "Marked completed." : "Marked as no-show." });
});

app.post("/appointments/:id/cancel", adminOnly, async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  if (appt.status !== "booked") return c.redirect(`/appointments/${appt.id}`, 303);
  const reason = str((await c.req.parseBody()).reason).slice(0, 200);
  await c.env.DB.prepare("UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancel_reason = ? WHERE id = ?")
    .bind(new Date().toISOString(), reason || null, appt.id).run();
  await notifyCancelled(c.env, appt);
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Cancelled. WhatsApp messages are ready for the patient and therapist." });
});

app.post("/appointments/:id/reschedule", adminOnly, async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  if (appt.status !== "booked") return c.redirect(`/appointments/${appt.id}`, 303);
  const form = { ...formFrom(await c.req.parseBody()), patient_id: String(appt.patient_id) };
  const v = await validateSlot(c.env, form, appt.id);
  if ("error" in v) return redirectWith(c, `/appointments/${appt.id}`, { type: "error", text: v.error! });
  const changedTime = v.slot.start.toISOString() !== new Date(appt.start_utc).toISOString();
  const changedTherapist = v.therapistId !== appt.therapist_id;
  // A new time means the reminders have to be sent again.
  await c.env.DB.prepare(
    `UPDATE appointments SET therapist_id = ?, service = ?, start_utc = ?, duration_min = ?, extra_min = ?, notes = ?,
       created_at = CASE WHEN ? THEN ? ELSE created_at END,
       reminder_24h_sent_at = CASE WHEN ? THEN NULL ELSE reminder_24h_sent_at END,
       reminder_2h_sent_at = CASE WHEN ? THEN NULL ELSE reminder_2h_sent_at END
     WHERE id = ?`,
  ).bind(v.therapistId, v.service, v.slot.start.toISOString(), v.slot.durationMin, v.slot.extraMin, v.notes || null,
    changedTime ? 1 : 0, new Date().toISOString(), changedTime ? 1 : 0, changedTime ? 1 : 0, appt.id).run();
  const updated = (await loadAppointment(c.env, appt.id))!;
  if (changedTime || changedTherapist) {
    await notifyRescheduled(c.env, updated, new Date(appt.start_utc), changedTherapist ? appt.therapist_phone : null);
    return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Saved. WhatsApp messages are ready for the patient and therapist." });
  }
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Saved. Time and therapist did not change, so no messages were sent." });
});

// --- Patients ------------------------------------------------------------------------------------
app.get("/patients", adminOnly, async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  return c.html(patientsPage(c.get("user"), await patientList(c.env, q), q, takeFlash(c)));
});

app.post("/patients", adminOnly, async (c) => {
  const f = await c.req.parseBody();
  const phone = normalisePhone(str(f.phone));
  if (!str(f.name) || !phone) return redirectWith(c, "/patients", { type: "error", text: "Enter the patient's name and a valid 10-digit mobile number." });
  const res = await c.env.DB.prepare("INSERT INTO patients (name, guardian_name, phone, whatsapp_consent, notes) VALUES (?, ?, ?, ?, ?)")
    .bind(str(f.name).slice(0, 80), str(f.guardian_name).slice(0, 80) || null, phone, f.whatsapp_consent ? 1 : 0, str(f.notes).slice(0, 200) || null).run();
  return redirectWith(c, `/appointments/new?patient_id=${res.meta.last_row_id}`, { type: "ok", text: `${str(f.name)} added. Book their appointment below.` });
});

app.get("/patients/:id/edit", adminOnly, async (c) => {
  const p = await c.env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(Number(c.req.param("id"))).first<PatientRow>();
  if (!p) return c.notFound();
  return c.html(patientEditPage(c.get("user"), p, takeFlash(c)));
});

app.post("/patients/:id", adminOnly, async (c) => {
  const id = Number(c.req.param("id"));
  const exists = await c.env.DB.prepare("SELECT id FROM patients WHERE id = ?").bind(id).first();
  if (!exists) return c.notFound();
  const f = await c.req.parseBody();
  const phone = normalisePhone(str(f.phone));
  if (!str(f.name) || !phone) return redirectWith(c, `/patients/${id}/edit`, { type: "error", text: "Enter the patient's name and a valid 10-digit mobile number." });
  await c.env.DB.prepare("UPDATE patients SET name = ?, guardian_name = ?, phone = ?, whatsapp_consent = ?, notes = ? WHERE id = ?")
    .bind(str(f.name).slice(0, 80), str(f.guardian_name).slice(0, 80) || null, phone, f.whatsapp_consent ? 1 : 0, str(f.notes).slice(0, 200) || null, id).run();
  return redirectWith(c, "/patients", { type: "ok", text: `${str(f.name)} updated.` });
});

app.post("/patients/:id/consent", adminOnly, async (c) => {
  const value = str((await c.req.parseBody()).value) === "1" ? 1 : 0;
  await c.env.DB.prepare("UPDATE patients SET whatsapp_consent = ? WHERE id = ?").bind(value, Number(c.req.param("id"))).run();
  return redirectWith(c, "/patients", { type: "ok", text: "WhatsApp consent updated." });
});

// --- Therapists ----------------------------------------------------------------------------------
app.get("/therapists", adminOnly, async (c) => c.html(therapistsPage(c.get("user"), await therapistList(c.env), takeFlash(c))));

app.post("/therapists", adminOnly, async (c) => {
  const f = await c.req.parseBody();
  const phone = normalisePhone(str(f.phone));
  const password = str(f.password);
  if (!str(f.name) || !phone) return redirectWith(c, "/therapists", { type: "error", text: "Enter a name and a valid 10-digit mobile number." });
  if (password && password.length < 8) return redirectWith(c, "/therapists", { type: "error", text: "The password needs at least 8 characters." });
  if (password && (await c.env.DB.prepare("SELECT 1 FROM users WHERE login = ?").bind(phone).first())) {
    return redirectWith(c, "/therapists", { type: "error", text: "A login with that phone number already exists." });
  }
  const res = await c.env.DB.prepare("INSERT INTO therapists (name, phone, specialty) VALUES (?, ?, ?)")
    .bind(str(f.name).slice(0, 80), phone, str(f.specialty).slice(0, 80) || null).run();
  if (password) {
    const { hash, salt } = await hashPassword(password);
    await c.env.DB.prepare("INSERT INTO users (name, login, role, therapist_id, password_hash, password_salt) VALUES (?, ?, 'therapist', ?, ?, ?)")
      .bind(str(f.name).slice(0, 80), phone, res.meta.last_row_id, hash, salt).run();
  }
  return redirectWith(c, "/therapists", { type: "ok", text: `${str(f.name)} added.` });
});

async function loadTherapist(env: Env, id: number) {
  return env.DB.prepare(
    `SELECT t.*, EXISTS(SELECT 1 FROM users u WHERE u.therapist_id = t.id) AS has_login FROM therapists t WHERE t.id = ?`,
  ).bind(id).first<TherapistRow>();
}

app.get("/therapists/:id/edit", adminOnly, async (c) => {
  const t = await loadTherapist(c.env, Number(c.req.param("id")));
  if (!t) return c.notFound();
  return c.html(therapistEditPage(c.get("user"), t, takeFlash(c)));
});

app.post("/therapists/:id", adminOnly, async (c) => {
  const id = Number(c.req.param("id"));
  const t = await loadTherapist(c.env, id);
  if (!t) return c.notFound();
  const back = `/therapists/${id}/edit`;
  const f = await c.req.parseBody();
  const name = str(f.name).slice(0, 80);
  const phone = normalisePhone(str(f.phone));
  const password = str(f.password);
  if (!name || !phone) return redirectWith(c, back, { type: "error", text: "Enter a name and a valid 10-digit mobile number." });
  if (password && password.length < 8) return redirectWith(c, back, { type: "error", text: "The password needs at least 8 characters." });
  const login = await c.env.DB.prepare("SELECT id FROM users WHERE therapist_id = ?").bind(id).first<{ id: number }>();
  if (login || password) {
    const clash = await c.env.DB.prepare("SELECT id FROM users WHERE login = ? AND id != ?").bind(phone, login?.id ?? 0).first();
    if (clash) return redirectWith(c, back, { type: "error", text: "Another login already uses that phone number." });
  }
  const stmts = [
    c.env.DB.prepare("UPDATE therapists SET name = ?, phone = ?, specialty = ? WHERE id = ?").bind(name, phone, str(f.specialty).slice(0, 80) || null, id),
  ];
  if (login) {
    stmts.push(c.env.DB.prepare("UPDATE users SET name = ?, login = ? WHERE id = ?").bind(name, phone, login.id));
    if (password) {
      const { hash, salt } = await hashPassword(password);
      stmts.push(c.env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(hash, salt, login.id));
      stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(login.id));
    }
  } else if (password) {
    const { hash, salt } = await hashPassword(password);
    stmts.push(c.env.DB.prepare("INSERT INTO users (name, login, role, therapist_id, password_hash, password_salt, active) VALUES (?, ?, 'therapist', ?, ?, ?, ?)")
      .bind(name, phone, id, hash, salt, t.active));
  }
  await c.env.DB.batch(stmts);
  return redirectWith(c, "/therapists", { type: "ok", text: `${name} updated.${password ? " New password saved." : ""}` });
});

app.post("/therapists/:id/active", adminOnly, async (c) => {
  const value = str((await c.req.parseBody()).value) === "1" ? 1 : 0;
  const id = Number(c.req.param("id"));
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE therapists SET active = ? WHERE id = ?").bind(value, id),
    c.env.DB.prepare("UPDATE users SET active = ? WHERE therapist_id = ?").bind(value, id),
  ]);
  return redirectWith(c, "/therapists", { type: "ok", text: value ? "Therapist activated." : "Therapist deactivated; their login is switched off." });
});

// --- Message log ---------------------------------------------------------------------------------
// Messages still to be sent by hand: not delivered automatically, not yet sent, and about an
// appointment that is still upcoming (or a cancellation from the last 3 days).
const PENDING_WHERE = `m.status IN ('dry_run','failed') AND m.manual_sent_at IS NULL
  AND ((a.status = 'booked' AND a.start_utc > ?) OR (m.kind = 'cancelled' AND m.created_at > ?))`;
const pendingArgs = () => [new Date().toISOString(), new Date(Date.now() - 3 * 86_400_000).toISOString()];

async function pendingCount(env: Env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM messages m JOIN appointments a ON a.id = m.appointment_id WHERE ${PENDING_WHERE}`)
    .bind(...pendingArgs()).first<{ n: number }>();
  return row?.n ?? 0;
}

app.get("/messages", adminOnly, async (c) => {
  const pendingOnly = c.req.query("pending") === "1";
  const { results } = pendingOnly
    ? await c.env.DB.prepare(`SELECT m.* FROM messages m JOIN appointments a ON a.id = m.appointment_id WHERE ${PENDING_WHERE} ORDER BY m.id`)
        .bind(...pendingArgs()).all<MessageRow>()
    : await c.env.DB.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT 200").all<MessageRow>();
  return c.html(messagesPage(c.get("user"), results, pendingOnly));
});

// One-tap manual send: records the send, then opens WhatsApp in the chat with that exact number.
app.get("/messages/:id/send", adminOnly, async (c) => {
  const m = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(Number(c.req.param("id"))).first<MessageRow>();
  if (!m) return c.notFound();
  if (m.status === "skipped") return c.text("This patient has not agreed to WhatsApp messages.", 400);
  await c.env.DB.prepare("UPDATE messages SET manual_sent_at = ? WHERE id = ? AND manual_sent_at IS NULL").bind(new Date().toISOString(), m.id).run();
  return c.redirect(`https://wa.me/${m.to_phone}?text=${encodeURIComponent(m.body_preview)}`, 302);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(runReminders(env));
  },
};
