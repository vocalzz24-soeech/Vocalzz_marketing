// WhatsApp messages via the Meta WhatsApp Business Platform (Cloud API).
// Every message is a pre-approved "utility" template. The wording below must match
// what is submitted in WhatsApp Manager (see docs/whatsapp-templates.md).
import type { Env } from "./env.ts";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

export const TEMPLATES = {
  vocalzz_appt_confirmed:
    "Hello {{1}}, the {{2}} session for {{3}} with {{4}} at Vocalzz Speech & Audio is confirmed for {{5}}.\n\n" +
    "Address: Tower E-004, Logix Blossom County, Sector 137, Noida 201304.\n" +
    "To cancel or change the time, just reply to this message.",
  vocalzz_appt_reminder:
    "Hello {{1}}, a reminder that the {{2}} session for {{3}} with {{4}} at Vocalzz Speech & Audio is {{5}}.\n\n" +
    "To cancel or change the time, just reply to this message.",
  vocalzz_appt_rescheduled:
    "Hello {{1}}, the {{2}} session for {{3}} with {{4}} at Vocalzz Speech & Audio has been moved to {{5}}.\n\n" +
    "To cancel or change the time, just reply to this message.",
  vocalzz_appt_cancelled:
    "Hello {{1}}, the {{2}} session for {{3}} on {{4}} at Vocalzz Speech & Audio has been cancelled.\n\n" +
    "To book a new time, just reply to this message.",
  vocalzz_therapist_new:
    "New appointment for you: {{1}} ({{2}}) on {{3}}, for {{4}} minutes. Please check the schedule for details.",
  vocalzz_therapist_moved:
    "Appointment moved: {{1}} ({{2}}) is now on {{3}}, for {{4}} minutes. It was on {{5}} before. Please check the schedule.",
  vocalzz_therapist_cancelled:
    "Appointment cancelled: {{1}} ({{2}}) on {{3}} will not take place. Please check the schedule.",
  vocalzz_series_confirmed:
    "Hello {{1}}, the weekly {{2}} sessions for {{3}} with {{4}} at Vocalzz Speech & Audio are booked for {{5}} on these dates: {{6}}.\n\n" +
    "Address: Tower E-004, Logix Blossom County, Sector 137, Noida 201304.\n" +
    "To cancel or change a session, just reply to this message.",
  vocalzz_therapist_series:
    "New weekly sessions for you: {{1}} ({{2}}) at {{3}} on {{4}}. Please check the schedule for details.",
  vocalzz_series_cancelled:
    "Hello {{1}}, these {{2}} sessions for {{3}} at Vocalzz Speech & Audio have been cancelled: {{4}}.\n\n" +
    "To book new times, just reply to this message.",
  vocalzz_therapist_series_cancelled:
    "Sessions cancelled: {{1}} ({{2}}) on {{3}}. Please check the schedule.",
  vocalzz_series_moved:
    "Hello {{1}}, the weekly {{2}} sessions for {{3}} at Vocalzz Speech & Audio have new times. They are now with {{4}} on: {{5}}.\n\n" +
    "To cancel or change a session, just reply to this message.",
  vocalzz_therapist_series_moved:
    "Weekly sessions updated: {{1}} ({{2}}) is now with you on {{3}}. Please check the schedule.",
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function renderTemplate(name: TemplateName, params: string[]): string {
  return TEMPLATES[name].replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? "");
}

export interface OutgoingMessage {
  appointmentId: number | null;
  recipient: "patient" | "therapist";
  to: string;
  kind: string;
  template: TemplateName;
  params: string[];
  /** false when the patient has not agreed to WhatsApp messages */
  allowed?: boolean;
}

export type SendStatus = "sent" | "failed" | "dry_run" | "skipped";

/** Sends one template message (or records a dry run) and logs it in the messages table. */
export async function sendWhatsApp(env: Env, msg: OutgoingMessage): Promise<SendStatus> {
  const preview = renderTemplate(msg.template, msg.params);
  let status: SendStatus;
  let providerId: string | null = null;
  let error: string | null = null;

  if (msg.allowed === false) {
    status = "skipped";
    error = "No WhatsApp consent recorded for this patient";
  } else if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    status = "dry_run";
  } else {
    try {
      const res = await fetch(`${GRAPH_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: msg.to,
          type: "template",
          template: {
            name: msg.template,
            language: { code: env.WHATSAPP_TEMPLATE_LANG || "en" },
            components: [
              { type: "body", parameters: msg.params.map((text) => ({ type: "text", text })) },
            ],
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        messages?: { id: string }[];
        error?: { message?: string };
      };
      if (res.ok && data.messages?.[0]?.id) {
        status = "sent";
        providerId = data.messages[0].id;
      } else {
        status = "failed";
        error = data.error?.message ?? `HTTP ${res.status}`;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await env.DB.prepare(
    `INSERT INTO messages (appointment_id, recipient, to_phone, kind, template, body_preview, status, provider_id, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(msg.appointmentId, msg.recipient, msg.to, msg.kind, msg.template, preview, status, providerId, error)
    .run();
  return status;
}
