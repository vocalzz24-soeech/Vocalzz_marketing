import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "./env.ts";
import {
  SESSION_COOKIE, SESSION_MAX_AGE, createSession, deleteSession, hashPassword, userForSession,
  verifyPassword, type User,
} from "./auth.ts";
import { addDays, checkClinicHours, findClashes, FOLLOW_UP_AFTER, MAX_SERIES, missedStreak, monthLabel, nextMonthDays, normalisePhone, seriesDays, seriesEnd, shortDay, weekday, weekWindow, type RepeatUntil, type Slot } from "./schedule.ts";
import { dateToIstLocal, istDay, istDayRange, istLocalToDate, formatTime } from "./time.ts";
import {
  APPT_SELECT, loadAppointment, notifyBooked, notifyCancelled, notifyRescheduled, notifySeriesBooked, notifySeriesCancelled, notifySeriesMoved, runReminders,
  type ApptRow,
} from "./notify.ts";
import {
  appointmentPage, loginPage, messagesPage, newAppointmentPage, patientsPage, schedulePage,
  setupPage, therapistsPage, patientEditPage, therapistEditPage, holidaysPage, patientSummaryPage, SERVICES, type ApptForm, type CommentRow, type MessageRow, type PatientRow, type TherapistRow,
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
  const mineOnly = user.role === "therapist" && c.req.query("mine") === "1";
  const mine = mineOnly ? results.filter((a) => a.therapist_id === user.therapist_id) : results;
  const { results: hols } = await c.env.DB.prepare("SELECT day, name FROM holidays WHERE day >= ? AND day <= ?").bind(win.days[0], win.days[6]).all<{ day: string; name: string }>();
  const holidayOf = new Map(hols.map((h) => [h.day, h.name]));
  const chips = win.days.map((d) => ({ day: d, booked: mine.filter((a) => a.status === "booked" && istDay(new Date(a.start_utc)) === d).length, holiday: holidayOf.get(d) }));
  const dayAppts = results.filter((a) => istDay(new Date(a.start_utc)) === win.selected);
  const therapists = (await therapistList(c.env)).filter((t) => t.active || dayAppts.some((a) => a.therapist_id === t.id));
  return c.html(schedulePage(user, win, chips, today, dayAppts, therapists, takeFlash(c), user.role === "admin" ? await pendingCount(c.env) : 0, mineOnly, user.role === "admin" ? await followUps(c.env) : []));
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
  const holiday = await env.DB.prepare("SELECT name FROM holidays WHERE day = ?").bind(istDay(start)).first<{ name: string }>();
  if (holiday) return { error: `The clinic is closed on ${shortDay(istDay(start))} (${holiday.name}).` };

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
  repeat: str(f.repeat), repeat_until: str(f.repeat_until), repeat_until_date: str(f.repeat_until_date),
  repeat_days: (Array.isArray(f.repeat_days) ? f.repeat_days : f.repeat_days ? [f.repeat_days] : []).map((v) => String(v)).filter((v) => /^[0-6]$/.test(v)),
});

app.get("/appointments/new", async (c) => {
  const form: ApptForm = { patient_id: c.req.query("patient_id") };
  return c.html(newAppointmentPage(c.get("user"), await patientList(c.env), await therapistList(c.env), Number(c.env.DEFAULT_DURATION_MIN), form));
});

app.post("/appointments", async (c) => {
  const user = c.get("user");
  const form = formFrom(await c.req.parseBody({ all: true }));
  // Therapists can only book sessions for themselves.
  if (user.role === "therapist") form.therapist_id = String(user.therapist_id);
  const fail = async (msg: string) =>
    c.html(newAppointmentPage(c.get("user"), await patientList(c.env), await therapistList(c.env), Number(c.env.DEFAULT_DURATION_MIN), form, msg), 400);
  const patient = await c.env.DB.prepare("SELECT id FROM patients WHERE id = ?").bind(Number(form.patient_id)).first();
  if (!patient) return fail("Choose a patient.");
  const v = await validateSlot(c.env, form);
  if ("error" in v) return fail(v.error!);
  if (form.repeat === "1") return bookSeries(c, form, v, fail);
  const res = await c.env.DB.prepare(
    `INSERT INTO appointments (patient_id, therapist_id, service, start_utc, duration_min, extra_min, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(Number(form.patient_id), v.therapistId, v.service, v.slot.start.toISOString(), v.slot.durationMin, v.slot.extraMin, v.notes || null, c.get("user").id).run();
  const appt = (await loadAppointment(c.env, Number(res.meta.last_row_id)))!;
  // A therapist who books their own session does not need a WhatsApp message about it.
  await notifyBooked(c.env, appt, { skipTherapist: user.role === "therapist" });
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Booked. WhatsApp messages are ready for the patient and therapist." });
});

type SlotOk = { slot: Slot; therapistId: number; service: string; notes: string };

/** Books the first session plus weekly repeats; dates that fail validation are skipped and reported. */
/** Creates one session per day (same time and details), skipping days that fail validation. */
async function createSessions(c: C, form: ApptForm, days: string[], time: string, seriesId: string, first?: { day: string; v: SlotOk }) {
  const user = c.get("user");
  const ids: number[] = [];
  const skipped: string[] = [];
  for (const day of days) {
    const v = first && day === first.day ? first.v : await validateSlot(c.env, { ...form, start: `${day}T${time}` });
    if ("error" in v) { skipped.push(`${shortDay(day)} (${v.error!.replace(/\.$/, "")})`); continue; }
    const ok = v as SlotOk;
    const res = await c.env.DB.prepare(
      `INSERT INTO appointments (patient_id, therapist_id, service, start_utc, duration_min, extra_min, notes, created_by, series_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(Number(form.patient_id), ok.therapistId, ok.service, ok.slot.start.toISOString(), ok.slot.durationMin, ok.slot.extraMin, ok.notes || null, user.id, seriesId).run();
    ids.push(Number(res.meta.last_row_id));
  }
  const appts = (await Promise.all(ids.map((id) => loadAppointment(c.env, id)))).filter((a): a is ApptRow => !!a);
  return { appts, skipped };
}

const skippedNote = (skipped: string[]) =>
  skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? "; …" : ""}.` : "";

/** Books the first session plus weekly repeats; dates that fail validation are skipped and reported. */
async function bookSeries(c: C, form: ApptForm, first: SlotOk, fail: (msg: string) => Promise<Response>) {
  const user = c.get("user");
  const firstDay = (form.start ?? "").slice(0, 10), time = (form.start ?? "").slice(11, 16);
  const until = (["month_end", "4w", "8w", "date"].includes(form.repeat_until ?? "") ? form.repeat_until : "month_end") as RepeatUntil;
  const lastDay = seriesEnd(firstDay, until, form.repeat_until_date);
  if (!lastDay) return fail("Choose a last date between the first session and 6 months later.");
  const weekdays = (form.repeat_days ?? []).map(Number);
  if (weekdays.length === 0) return fail("Tick at least one day to repeat on.");
  const days = seriesDays(firstDay, weekdays, lastDay);

  const { appts, skipped } = await createSessions(c, form, days, time, crypto.randomUUID(), { day: firstDay, v: first });
  if (appts.length === 1) await c.env.DB.prepare("UPDATE appointments SET series_id = NULL WHERE id = ?").bind(appts[0].id).run();
  if (appts.length > 1) await notifySeriesBooked(c.env, appts, { skipTherapist: user.role === "therapist" });
  else await notifyBooked(c.env, appts[0], { skipTherapist: user.role === "therapist" });
  const capped = days.length >= MAX_SERIES ? ` (limit of ${MAX_SERIES} per series)` : "";
  return redirectWith(c, `/appointments/${appts[0].id}`, {
    type: skipped.length ? "error" : "ok",
    text: `Booked ${appts.length} weekly session${appts.length === 1 ? "" : "s"}${capped}. One WhatsApp message lists all dates.${skippedNote(skipped)}`.slice(0, 600),
  });
}

async function seriesSessions(env: Env, seriesId: string) {
  const { results } = await env.DB.prepare(`${APPT_SELECT} WHERE a.series_id = ? AND a.status != 'cancelled' ORDER BY a.start_utc`)
    .bind(seriesId).all<ApptRow>();
  return results;
}

async function seriesInfo(env: Env, appt: ApptRow) {
  if (!appt.series_id) return null;
  const all = await seriesSessions(env, appt.series_id);
  if (all.length < 2) return null;
  const later = all.filter((a) => a.status === "booked" && a.start_utc > appt.start_utc).length;
  const lastDay = istDay(new Date(all.at(-1)!.start_utc));
  return { total: all.length, later, nextMonth: monthLabel(lastDay, 1) };
}

async function loadForUser(c: C): Promise<ApptRow | null> {
  const appt = await loadAppointment(c.env, Number(c.req.param("id")));
  const user = c.get("user");
  return appt; // everyone logged in can view; changes are checked per action
}
const canMark = (user: User, appt: ApptRow) => user.role === "admin" || appt.therapist_id === user.therapist_id;

app.get("/appointments/:id", async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  const { results } = await c.env.DB.prepare(`${MSG_SELECT} WHERE m.appointment_id = ? ORDER BY m.id DESC`).bind(appt.id).all<MessageRow>();
  const { results: comments } = await c.env.DB.prepare(
    `SELECT k.id, k.body, k.created_at, u.name AS author, u.role FROM appointment_comments k JOIN users u ON u.id = k.user_id
      WHERE k.appointment_id = ? ORDER BY k.id`,
  ).bind(appt.id).all<CommentRow>();
  const booker = await c.env.DB.prepare("SELECT u.name FROM appointments a JOIN users u ON u.id = a.created_by WHERE a.id = ?").bind(appt.id).first<{ name: string }>();
  const user = c.get("user");
  return c.html(appointmentPage(user, appt, user.role === "admin" ? results : [], await therapistList(c.env), Number(c.env.DEFAULT_DURATION_MIN), comments, booker?.name ?? null, await seriesInfo(c.env, appt), takeFlash(c)));
});

app.post("/appointments/:id/comments", async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  const body = str((await c.req.parseBody()).body).slice(0, 500);
  if (!body) return redirectWith(c, `/appointments/${appt.id}`, { type: "error", text: "Write a comment first." });
  await c.env.DB.prepare("INSERT INTO appointment_comments (appointment_id, user_id, body) VALUES (?, ?, ?)").bind(appt.id, c.get("user").id, body).run();
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Comment added." });
});

app.post("/appointments/:id/status", async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  if (!canMark(c.get("user"), appt)) return c.text("Only the clinic admin or this session's therapist can do this.", 403);
  const status = str((await c.req.parseBody()).status);
  if (!["completed", "no_show"].includes(status) || appt.status !== "booked") return c.redirect(`/appointments/${appt.id}`, 303);
  await c.env.DB.prepare("UPDATE appointments SET status = ? WHERE id = ?").bind(status, appt.id).run();
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: status === "completed" ? "Marked completed." : "Marked as no-show." });
});

app.post("/appointments/:id/cancel", adminOnly, async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  if (appt.status !== "booked") return c.redirect(`/appointments/${appt.id}`, 303);
  const body = await c.req.parseBody();
  const reason = str(body.reason).slice(0, 200);
  const now = new Date().toISOString();
  if (str(body.scope) === "following" && appt.series_id) {
    const { results } = await c.env.DB.prepare(`${APPT_SELECT} WHERE a.series_id = ? AND a.status = 'booked' AND a.start_utc >= ? ORDER BY a.start_utc`)
      .bind(appt.series_id, appt.start_utc).all<ApptRow>();
    await c.env.DB.batch(results.map((a) => c.env.DB.prepare("UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancel_reason = ? WHERE id = ?").bind(now, reason || null, a.id)));
    if (results.length > 1) await notifySeriesCancelled(c.env, results); else await notifyCancelled(c.env, appt);
    return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: `Cancelled ${results.length} session${results.length === 1 ? "" : "s"}. One WhatsApp message lists all cancelled dates.` });
  }
  await c.env.DB.prepare("UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancel_reason = ? WHERE id = ?")
    .bind(now, reason || null, appt.id).run();
  await notifyCancelled(c.env, appt);
  return redirectWith(c, `/appointments/${appt.id}`, { type: "ok", text: "Cancelled. WhatsApp messages are ready for the patient and therapist." });
});

// Repeat a weekly series for the calendar month after its last session (same days, time and details).
app.post("/appointments/:id/continue", async (c) => {
  const appt = await loadForUser(c);
  if (!appt || !appt.series_id) return c.notFound();
  if (!canMark(c.get("user"), appt)) return c.text("Only the clinic admin or this session's therapist can do this.", 403);
  const all = await seriesSessions(c.env, appt.series_id);
  const last = all.at(-1)!;
  const lastStart = new Date(last.start_utc);
  const weekdays = [...new Set(all.map((a) => weekday(istDay(new Date(a.start_utc)))))];
  const days = nextMonthDays(istDay(lastStart), weekdays);
  const label = monthLabel(istDay(lastStart), 1);
  const time = dateToIstLocal(lastStart).slice(11, 16);
  const form: ApptForm = {
    patient_id: String(last.patient_id), therapist_id: String(last.therapist_id), service: last.service,
    duration: String(last.duration_min), extra: String(last.extra_min), notes: last.notes ?? "",
  };
  const { appts, skipped } = await createSessions(c, form, days, time, appt.series_id);
  if (appts.length === 0) return redirectWith(c, `/appointments/${appt.id}`, { type: "error", text: `No sessions could be booked in ${label}.${skippedNote(skipped)}`.slice(0, 600) });
  await notifySeriesBooked(c.env, appts, { skipTherapist: c.get("user").role === "therapist" });
  return redirectWith(c, `/appointments/${appts[0].id}`, {
    type: skipped.length ? "error" : "ok",
    text: `Continued for ${label}: ${appts.length} session${appts.length === 1 ? "" : "s"} booked. One WhatsApp message lists all dates.${skippedNote(skipped)}`.slice(0, 600),
  });
});

app.post("/appointments/:id/reschedule", adminOnly, async (c) => {
  const appt = await loadForUser(c);
  if (!appt) return c.notFound();
  if (appt.status !== "booked") return c.redirect(`/appointments/${appt.id}`, 303);
  const body = await c.req.parseBody();
  const form = { ...formFrom(body), patient_id: String(appt.patient_id) };
  const v = await validateSlot(c.env, form, appt.id);
  if ("error" in v) return redirectWith(c, `/appointments/${appt.id}`, { type: "error", text: v.error! });
  if (str(body.scope) === "following" && appt.series_id) return moveSeries(c, appt, form, v);
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

/** Moves this and all later booked sessions of a series by the same shift; new therapist/details apply to all. */
async function moveSeries(c: C, appt: ApptRow, form: ApptForm, first: SlotOk) {
  const shiftMs = first.slot.start.getTime() - new Date(appt.start_utc).getTime();
  const { results: sessions } = await c.env.DB.prepare(
    `${APPT_SELECT} WHERE a.series_id = ? AND a.status = 'booked' AND a.start_utc >= ? ORDER BY a.start_utc`,
  ).bind(appt.series_id, appt.start_utc).all<ApptRow>();
  const now = new Date().toISOString();
  const moved: number[] = [];
  const before: ApptRow[] = [];
  const skipped: string[] = [];
  for (const s of sessions) {
    const newStart = new Date(new Date(s.start_utc).getTime() + shiftMs);
    const v = s.id === appt.id ? first : await validateSlot(c.env, { ...form, start: dateToIstLocal(newStart) }, s.id);
    if ("error" in v) { skipped.push(`${shortDay(istDay(new Date(s.start_utc)))} (${v.error!.replace(/\.$/, "")})`); continue; }
    const ok = v as SlotOk;
    await c.env.DB.prepare(
      `UPDATE appointments SET therapist_id = ?, service = ?, start_utc = ?, duration_min = ?, extra_min = ?, notes = ?,
         created_at = ?, reminder_24h_sent_at = NULL, reminder_2h_sent_at = NULL WHERE id = ?`,
    ).bind(ok.therapistId, ok.service, ok.slot.start.toISOString(), ok.slot.durationMin, ok.slot.extraMin, ok.notes || null, now, s.id).run();
    moved.push(s.id);
    before.push(s);
  }
  const updated = (await Promise.all(moved.map((id) => loadAppointment(c.env, id)))).filter((a): a is ApptRow => !!a);
  const changedTherapist = first.therapistId !== appt.therapist_id;
  if (updated.length) await notifySeriesMoved(c.env, updated, before, changedTherapist ? appt.therapist_phone : null);
  return redirectWith(c, `/appointments/${appt.id}`, {
    type: skipped.length ? "error" : "ok",
    text: `Moved ${updated.length} session${updated.length === 1 ? "" : "s"}. One WhatsApp message lists the new times.${skipped.length ? ` Not moved (kept at the old time): ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? "; …" : ""}.` : ""}`.slice(0, 600),
  });
}

// --- Holidays ------------------------------------------------------------------------------------
app.get("/holidays", adminOnly, async (c) => {
  const today = istDay(new Date());
  const { results } = await c.env.DB.prepare("SELECT day, name FROM holidays WHERE day >= ? ORDER BY day").bind(today).all<{ day: string; name: string }>();
  const rows = await Promise.all(results.map(async (h) => {
    const r = istDayRange(h.day)!;
    const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM appointments WHERE status = 'booked' AND start_utc >= ? AND start_utc < ?")
      .bind(r.start.toISOString(), r.end.toISOString()).first<{ n: number }>();
    return { ...h, booked: n?.n ?? 0 };
  }));
  return c.html(holidaysPage(c.get("user"), rows, today, takeFlash(c)));
});

app.post("/holidays", adminOnly, async (c) => {
  const f = await c.req.parseBody();
  const day = str(f.day), name = str(f.name).slice(0, 60) || "Clinic holiday";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < istDay(new Date())) return redirectWith(c, "/holidays", { type: "error", text: "Choose today or a future date." });
  await c.env.DB.prepare("INSERT INTO holidays (day, name) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET name = excluded.name").bind(day, name).run();
  const r = istDayRange(day)!;
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM appointments WHERE status = 'booked' AND start_utc >= ? AND start_utc < ?")
    .bind(r.start.toISOString(), r.end.toISOString()).first<{ n: number }>();
  const warn = n?.n ? ` ${n.n} session${n.n === 1 ? " is" : "s are"} already booked that day: open the day to cancel or move ${n.n === 1 ? "it" : "them"}.` : "";
  return redirectWith(c, "/holidays", { type: warn ? "error" : "ok", text: `${shortDay(day)} marked as closed (${name}). New bookings and repeats will skip it.${warn}` });
});

app.post("/holidays/:day/delete", adminOnly, async (c) => {
  await c.env.DB.prepare("DELETE FROM holidays WHERE day = ?").bind(c.req.param("day")).run();
  return redirectWith(c, "/holidays", { type: "ok", text: "Holiday removed. That day is open for bookings again." });
});

// --- Follow-ups for missed sessions -----------------------------------------------------------------
async function followUps(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT a.patient_id, a.status, a.start_utc, p.name, p.guardian_name, p.followed_up_at
       FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE a.status IN ('completed', 'no_show') AND a.start_utc < ?
      ORDER BY a.patient_id, a.start_utc DESC`,
  ).bind(new Date().toISOString()).all<{ patient_id: number; status: string; start_utc: string; name: string; guardian_name: string | null; followed_up_at: string | null }>();
  const byPatient = new Map<number, typeof results>();
  for (const r of results) byPatient.set(r.patient_id, [...(byPatient.get(r.patient_id) ?? []), r]);
  const out: { id: number; name: string; missed: number; lastMissed: string }[] = [];
  for (const [id, rows] of byPatient) {
    const missed = missedStreak(rows.map((r) => r.status));
    if (missed < FOLLOW_UP_AFTER) continue;
    if (rows[0].followed_up_at && rows[0].followed_up_at > rows[0].start_utc) continue; // already followed up after the latest miss
    out.push({ id, name: rows[0].name, missed, lastMissed: rows[0].start_utc });
  }
  return out;
}

// --- Patients ------------------------------------------------------------------------------------
app.get("/patients", adminOnly, async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  return c.html(patientsPage(c.get("user"), await patientList(c.env, q), q, takeFlash(c), new Set((await followUps(c.env)).map((f) => f.id))));
});

app.post("/patients", adminOnly, async (c) => {
  const f = await c.req.parseBody();
  const phone = normalisePhone(str(f.phone));
  if (!str(f.name) || !phone) return redirectWith(c, "/patients", { type: "error", text: "Enter the patient's name and a valid 10-digit mobile number." });
  const res = await c.env.DB.prepare("INSERT INTO patients (name, guardian_name, phone, whatsapp_consent, notes) VALUES (?, ?, ?, ?, ?)")
    .bind(str(f.name).slice(0, 80), str(f.guardian_name).slice(0, 80) || null, phone, f.whatsapp_consent ? 1 : 0, str(f.notes).slice(0, 200) || null).run();
  return redirectWith(c, `/appointments/new?patient_id=${res.meta.last_row_id}`, { type: "ok", text: `${str(f.name)} added. Book their appointment below.` });
});

app.get("/patients/:id/summary", adminOnly, async (c) => {
  const p = await c.env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(Number(c.req.param("id"))).first<PatientRow>();
  if (!p) return c.notFound();
  const mParam = c.req.query("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(mParam) ? mParam : istDay(new Date()).slice(0, 7);
  const from = istDayRange(`${month}-01`)!.start;
  const to = istDayRange(`${addDays(`${month}-01`, 31).slice(0, 7)}-01`)!.start;
  const { results } = await c.env.DB.prepare(`${APPT_SELECT} WHERE a.patient_id = ? AND a.start_utc >= ? AND a.start_utc < ? ORDER BY a.start_utc`)
    .bind(p.id, from.toISOString(), to.toISOString()).all<ApptRow>();
  const flag = (await followUps(c.env)).find((f) => f.id === p.id) ?? null;
  return c.html(patientSummaryPage(c.get("user"), p, month, results, flag, takeFlash(c)));
});

app.post("/patients/:id/followed-up", adminOnly, async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE patients SET followed_up_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  return redirectWith(c, `/patients/${id}/summary`, { type: "ok", text: "Marked as followed up. The reminder is cleared until they miss again." });
});

async function deleteCounts(env: Env, column: "patient_id" | "therapist_id", id: number) {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'booked' AND start_utc > ? THEN 1 ELSE 0 END) AS upcoming
       FROM appointments WHERE ${column} = ?`,
  ).bind(new Date().toISOString(), id).first<{ total: number; upcoming: number | null }>();
  return { total: r?.total ?? 0, upcoming: r?.upcoming ?? 0 };
}
const confirmed = (body: Record<string, unknown>, name: string) =>
  str(body.understand) === "1" && str(body.confirm_name).toLowerCase() === name.trim().toLowerCase();

app.get("/patients/:id/edit", adminOnly, async (c) => {
  const p = await c.env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(Number(c.req.param("id"))).first<PatientRow>();
  if (!p) return c.notFound();
  return c.html(patientEditPage(c.get("user"), p, takeFlash(c), await deleteCounts(c.env, "patient_id", p.id)));
});

app.post("/patients/:id/delete", adminOnly, async (c) => {
  const p = await c.env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(Number(c.req.param("id"))).first<PatientRow>();
  if (!p) return c.notFound();
  if (!confirmed(await c.req.parseBody(), p.name)) {
    return redirectWith(c, `/patients/${p.id}/edit`, { type: "error", text: "Not deleted: type the patient's name exactly and tick the box to confirm." });
  }
  const sub = "SELECT id FROM appointments WHERE patient_id = ?";
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM appointment_comments WHERE appointment_id IN (${sub})`).bind(p.id),
    c.env.DB.prepare(`DELETE FROM messages WHERE appointment_id IN (${sub})`).bind(p.id),
    c.env.DB.prepare("DELETE FROM appointments WHERE patient_id = ?").bind(p.id),
    c.env.DB.prepare("DELETE FROM patients WHERE id = ?").bind(p.id),
  ]);
  return redirectWith(c, "/patients", { type: "ok", text: `${p.name} and all their records have been permanently deleted.` });
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
app.get("/therapists", adminOnly, async (c) => c.html(therapistsPage(c.get("user"), (await therapistList(c.env)).filter((t) => !t.deleted_at), takeFlash(c))));

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
  if (!t || t.deleted_at) return c.notFound();
  return c.html(therapistEditPage(c.get("user"), t, takeFlash(c), await deleteCounts(c.env, "therapist_id", t.id)));
});

app.post("/therapists/:id/delete", adminOnly, async (c) => {
  const t = await loadTherapist(c.env, Number(c.req.param("id")));
  if (!t || t.deleted_at) return c.notFound();
  const back = `/therapists/${t.id}/edit`;
  if (!confirmed(await c.req.parseBody(), t.name)) return redirectWith(c, back, { type: "error", text: "Not deleted: type the therapist's name exactly and tick the box to confirm." });
  const counts = await deleteCounts(c.env, "therapist_id", t.id);
  if (counts.upcoming) return redirectWith(c, back, { type: "error", text: `Not deleted: ${t.name} still has ${counts.upcoming} upcoming session(s). Move or cancel them first.` });
  const now = new Date().toISOString();
  const scrambled = crypto.randomUUID();
  await c.env.DB.batch([
    // Keep the row so past sessions stay intact, but erase personal details and switch everything off.
    c.env.DB.prepare("UPDATE therapists SET name = 'Former therapist', phone = '', specialty = NULL, active = 0, deleted_at = ? WHERE id = ?").bind(now, t.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE therapist_id = ?)").bind(t.id),
    c.env.DB.prepare("UPDATE users SET name = 'Former therapist', login = 'deleted-' || id, password_hash = ?, password_salt = ?, active = 0 WHERE therapist_id = ?")
      .bind(scrambled, scrambled, t.id),
  ]);
  return redirectWith(c, "/therapists", { type: "ok", text: `${t.name} has been deleted. Their past sessions now show as "Former therapist".` });
});

app.post("/therapists/:id", adminOnly, async (c) => {
  const id = Number(c.req.param("id"));
  const t = await loadTherapist(c.env, id);
  if (!t || t.deleted_at) return c.notFound();
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
    c.env.DB.prepare("UPDATE therapists SET active = ? WHERE id = ? AND deleted_at IS NULL").bind(value, id),
    c.env.DB.prepare("UPDATE users SET active = ? WHERE therapist_id = ? AND therapist_id IN (SELECT id FROM therapists WHERE deleted_at IS NULL)").bind(value, id),
  ]);
  return redirectWith(c, "/therapists", { type: "ok", text: value ? "Therapist activated." : "Therapist deactivated; their login is switched off." });
});

// --- Message log ---------------------------------------------------------------------------------
// Messages with the recipient's name (patient's parent/name or therapist), when it still matches.
const MSG_SELECT = `SELECT m.*, CASE WHEN m.to_phone = p.phone THEN COALESCE(p.guardian_name, p.name)
    WHEN m.to_phone = t.phone THEN t.name END AS to_name,
    p.name AS patient_name, p.guardian_name AS guardian_name, t.name AS therapist_name,
    a.start_utc AS appt_start, a.service AS appt_service, a.status AS appt_status
  FROM messages m LEFT JOIN appointments a ON a.id = m.appointment_id
  LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN therapists t ON t.id = a.therapist_id`;

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
    ? await c.env.DB.prepare(`${MSG_SELECT} WHERE ${PENDING_WHERE} ORDER BY m.id DESC`)
        .bind(...pendingArgs()).all<MessageRow>()
    : await c.env.DB.prepare(`${MSG_SELECT} ORDER BY m.id DESC LIMIT 200`).all<MessageRow>();
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
