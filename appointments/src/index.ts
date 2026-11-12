import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "./env.ts";
import {
  SESSION_COOKIE, SESSION_MAX_AGE, createSession, deleteSession, hashPassword, userForSession,
  verifyPassword, type User,
} from "./auth.ts";
import { checkClinicHours, findClashes, normalisePhone, type Slot } from "./schedule.ts";
import { istDay, istDayRange, istLocalToDate, formatTime } from "./time.ts";
import {
  APPT_SELECT, loadAppointment, notifyBooked, notifyCancelled, notifyRescheduled, runReminders,
  type ApptRow,
} from "./notify.ts";
import {
  appointmentPage, loginPage, messagesPage, newAppointmentPage, patientsPage, schedulePage,
  setupPage, therapistsPage, SERVICES, type ApptForm, type MessageRow, type PatientRow, type TherapistRow,
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
  const dayParam = c.req.query("day") ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : istDay(new Date());
  const range = istDayRange(day)!;
  const { results } = await c.env.DB.prepare(`${APPT_SELECT} WHERE a.start_utc >= ? AND a.start_utc < ? ORDER BY a.start_utc`)
    .bind(range.start.toISOString(), range.end.toISOString()).all<ApptRow>();
  const therapists = (await therapistList(c.env)).filter((t) => t.active || results.some((a) => a.therapist_id === t.id));
  return c.html(schedulePage(user, day, results, therapists, takeFlash(c)));
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
  if (!start) return { error: "Choose a date and time." };
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
  start: str(f.start), duration: str(f.duration), extra: str(f.extra) || "0", notes: str(f.notes),
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
  c.executionCtx.waitUntil(notifyBooked(c.env, appt));
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Booked. WhatsApp messages are being sent to the patient and therapist." });
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
  c.executionCtx.waitUntil(notifyCancelled(c.env, appt));
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Cancelled. The patient and therapist are being told on WhatsApp." });
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
    c.executionCtx.waitUntil(notifyRescheduled(c.env, updated, new Date(appt.start_utc), changedTherapist ? appt.therapist_phone : null));
    return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Saved. The patient and therapist are being told on WhatsApp." });
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
app.get("/messages", adminOnly, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM messages ORDER BY id DESC LIMIT 200").all<MessageRow>();
  return c.html(messagesPage(c.get("user"), results));
});

export default {
  fetch: app.fetch,
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(runReminders(env));
  },
};
