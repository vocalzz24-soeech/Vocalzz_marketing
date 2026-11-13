// Builds and sends the WhatsApp messages for appointment events and reminders.
import type { Env } from "./env.ts";
import { dueReminders, shortDay, type ReminderKind } from "./schedule.ts";
import { formatDateTime, formatTime, istDay } from "./time.ts";
import { sendWhatsApp } from "./whatsapp.ts";

export interface ApptRow {
  id: number;
  patient_id: number;
  therapist_id: number;
  notes: string | null;
  cancel_reason: string | null;
  series_id?: string | null;
  service: string;
  start_utc: string;
  duration_min: number;
  extra_min: number;
  status: string;
  created_at: string;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  patient_name: string;
  guardian_name: string | null;
  patient_phone: string;
  whatsapp_consent: number;
  therapist_name: string;
  therapist_phone: string;
}

export const APPT_SELECT = `
  SELECT a.*, p.name AS patient_name, p.guardian_name, p.phone AS patient_phone, p.whatsapp_consent,
         t.name AS therapist_name, t.phone AS therapist_phone
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN therapists t ON t.id = a.therapist_id`;

export async function loadAppointment(env: Env, id: number): Promise<ApptRow | null> {
  return env.DB.prepare(`${APPT_SELECT} WHERE a.id = ?`).bind(id).first<ApptRow>();
}

const greet = (a: ApptRow) => a.guardian_name || a.patient_name;
const minutes = (a: ApptRow) => String(a.duration_min + a.extra_min);

export async function notifyBooked(env: Env, a: ApptRow, opts: { skipTherapist?: boolean } = {}) {
  const when = formatDateTime(new Date(a.start_utc));
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "patient", to: a.patient_phone, kind: "confirmation",
    template: "vocalzz_appt_confirmed", allowed: !!a.whatsapp_consent,
    params: [greet(a), a.service, a.patient_name, a.therapist_name, when],
  });
  if (opts.skipTherapist) return;
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "therapist", to: a.therapist_phone, kind: "confirmation",
    template: "vocalzz_therapist_new",
    params: [a.patient_name, a.service, when, minutes(a)],
  });
}

export async function notifyRescheduled(env: Env, a: ApptRow, previousStart: Date, previousTherapistPhone: string | null) {
  const when = formatDateTime(new Date(a.start_utc));
  const before = formatDateTime(previousStart);
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "patient", to: a.patient_phone, kind: "rescheduled",
    template: "vocalzz_appt_rescheduled", allowed: !!a.whatsapp_consent,
    params: [greet(a), a.service, a.patient_name, a.therapist_name, when],
  });
  if (previousTherapistPhone && previousTherapistPhone !== a.therapist_phone) {
    // Moved to a different therapist: the old one gets a cancellation, the new one a new booking.
    await sendWhatsApp(env, {
      appointmentId: a.id, recipient: "therapist", to: previousTherapistPhone, kind: "cancelled",
      template: "vocalzz_therapist_cancelled", params: [a.patient_name, a.service, before],
    });
    await sendWhatsApp(env, {
      appointmentId: a.id, recipient: "therapist", to: a.therapist_phone, kind: "confirmation",
      template: "vocalzz_therapist_new", params: [a.patient_name, a.service, when, minutes(a)],
    });
  } else {
    await sendWhatsApp(env, {
      appointmentId: a.id, recipient: "therapist", to: a.therapist_phone, kind: "rescheduled",
      template: "vocalzz_therapist_moved", params: [a.patient_name, a.service, when, minutes(a), before],
    });
  }
}

export async function notifyCancelled(env: Env, a: ApptRow) {
  const when = formatDateTime(new Date(a.start_utc));
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "patient", to: a.patient_phone, kind: "cancelled",
    template: "vocalzz_appt_cancelled", allowed: !!a.whatsapp_consent,
    params: [greet(a), a.service, a.patient_name, when],
  });
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "therapist", to: a.therapist_phone, kind: "cancelled",
    template: "vocalzz_therapist_cancelled", params: [a.patient_name, a.service, when],
  });
}

const dayList = (appts: ApptRow[]) => appts.map((a) => shortDay(istDay(new Date(a.start_utc)))).join(", ");

/** One summary message per person for a newly booked weekly series (instead of one per session). */
export async function notifySeriesBooked(env: Env, appts: ApptRow[], opts: { skipTherapist?: boolean } = {}) {
  const a = appts[0];
  const time = formatTime(new Date(a.start_utc));
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "patient", to: a.patient_phone, kind: "series_confirmation",
    template: "vocalzz_series_confirmed", allowed: !!a.whatsapp_consent,
    params: [greet(a), a.service, a.patient_name, a.therapist_name, time, dayList(appts)],
  });
  if (opts.skipTherapist) return;
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "therapist", to: a.therapist_phone, kind: "series_confirmation",
    template: "vocalzz_therapist_series", params: [a.patient_name, a.service, time, dayList(appts)],
  });
}

/** One message per person when several sessions of a series are cancelled together. */
export async function notifySeriesCancelled(env: Env, appts: ApptRow[]) {
  const a = appts[0];
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "patient", to: a.patient_phone, kind: "series_cancelled",
    template: "vocalzz_series_cancelled", allowed: !!a.whatsapp_consent,
    params: [greet(a), a.service, a.patient_name, dayList(appts)],
  });
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "therapist", to: a.therapist_phone, kind: "series_cancelled",
    template: "vocalzz_therapist_series_cancelled", params: [a.patient_name, a.service, dayList(appts)],
  });
}

/** "today at 5:00 PM" / "tomorrow, Fri, 20 Nov 2026, 5:00 PM" */
export function reminderWhen(start: Date, now: Date): string {
  if (istDay(start) === istDay(now)) return `today at ${formatTime(start)}`;
  return `tomorrow, ${formatDateTime(start)}`;
}

/** Called by the cron trigger: sends any reminders that are due. */
export async function runReminders(env: Env, now = new Date()) {
  const horizon = new Date(now.getTime() + 25 * 3_600_000).toISOString();
  const { results } = await env.DB.prepare(
    `${APPT_SELECT} WHERE a.status = 'booked' AND a.start_utc > ? AND a.start_utc <= ?
       AND (a.reminder_24h_sent_at IS NULL OR a.reminder_2h_sent_at IS NULL)`,
  )
    .bind(now.toISOString(), horizon)
    .all<ApptRow>();

  let sent = 0;
  for (const a of results) {
    const start = new Date(a.start_utc);
    const due = dueReminders(
      {
        start,
        createdAt: new Date(a.created_at),
        status: a.status,
        reminder24hSentAt: a.reminder_24h_sent_at,
        reminder2hSentAt: a.reminder_2h_sent_at,
      },
      now,
    );
    for (const kind of due) {
      // Mark first so an overlapping cron run cannot send the same reminder twice.
      const column = kind === "reminder_24h" ? "reminder_24h_sent_at" : "reminder_2h_sent_at";
      const claimed = await env.DB.prepare(
        `UPDATE appointments SET ${column} = ? WHERE id = ? AND ${column} IS NULL`,
      )
        .bind(now.toISOString(), a.id)
        .run();
      if (!claimed.meta.changes) continue;
      await sendReminder(env, a, kind, start, now);
      sent++;
    }
  }
  return sent;
}

async function sendReminder(env: Env, a: ApptRow, kind: ReminderKind, start: Date, now: Date) {
  await sendWhatsApp(env, {
    appointmentId: a.id, recipient: "patient", to: a.patient_phone, kind,
    template: "vocalzz_appt_reminder", allowed: !!a.whatsapp_consent,
    params: [greet(a), a.service, a.patient_name, a.therapist_name, reminderWhen(start, now)],
  });
}
