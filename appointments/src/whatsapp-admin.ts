// Admin page to finish the WhatsApp Cloud API setup without typing any code:
// shows the sending number's status, registers it (Meta allows this only through the API), and sends a test.
import { html } from "hono/html";
import type { User } from "./auth.ts";
import type { Env } from "./env.ts";
import { formatDateTime } from "./time.ts";
import { layout } from "./views.ts";
import { GRAPH_URL, renderTemplate, TEMPLATES, type TemplateName } from "./whatsapp.ts";

type Graph = { ok: boolean; data: Record<string, unknown>; error?: string };

async function graph(env: Env, path: string, init?: { method?: string; body?: unknown }): Promise<Graph> {
  try {
    const res = await fetch(`${GRAPH_URL}/${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string; error_user_msg?: string } };
    return res.ok ? { ok: true, data } : { ok: false, data, error: data.error?.error_user_msg || data.error?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, data: {}, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface NumberStatus { configured: { token: boolean; phoneId: boolean }; info?: Record<string, unknown>; error?: string }

export async function numberStatus(env: Env): Promise<NumberStatus> {
  const configured = { token: !!env.WHATSAPP_TOKEN, phoneId: !!env.WHATSAPP_PHONE_NUMBER_ID };
  if (!configured.token || !configured.phoneId) return { configured };
  const full = await graph(env, `${env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,name_status,code_verification_status,quality_rating,platform_type,status`);
  if (full.ok) return { configured, info: full.data };
  const basic = await graph(env, `${env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`);
  return basic.ok ? { configured, info: basic.data } : { configured, error: full.error };
}

/** Registers the number for the Cloud API with a 6-digit two-step verification PIN chosen by the clinic. */
export async function registerNumber(env: Env, pin: string) {
  if (!/^\d{6}$/.test(pin)) return { ok: false, message: "The PIN must be exactly 6 digits." };
  const r = await graph(env, `${env.WHATSAPP_PHONE_NUMBER_ID}/register`, { method: "POST", body: { messaging_product: "whatsapp", pin } });
  return r.ok ? { ok: true, message: "Number registered. It can now send messages once your templates are approved." } : { ok: false, message: `Meta said: ${r.error}` };
}

export const TEST_TEMPLATE: TemplateName = "vocalzz_appt_confirmed";
export const testParams = () => ["Test parent", "Speech therapy", "Test child", "Dr. Tanu Garg", formatDateTime(new Date(Date.now() + 86_400_000))];

/** Sends one real template message to a phone number, and returns Meta's exact answer. */
export async function sendTest(env: Env, to: string) {
  const r = await graph(env, `${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp", to, type: "template",
      template: { name: TEST_TEMPLATE, language: { code: env.WHATSAPP_TEMPLATE_LANG || "en" }, components: [{ type: "body", parameters: testParams().map((text) => ({ type: "text", text })) }] },
    },
  });
  return r.ok ? { ok: true, message: `Test message sent to +${to}. Check that phone's WhatsApp.` } : { ok: false, message: `Not sent. Meta said: ${r.error}` };
}

const row = (label: string, value: unknown, good?: boolean) =>
  html`<tr><td>${label}</td><td>${value === undefined || value === null || value === "" ? html`<span class="muted">–</span>` : html`<strong style="color:${good === undefined ? "inherit" : good ? "var(--ok)" : "var(--warn)"}">${String(value)}</strong>`}</td></tr>`;

export function whatsappSetupPage(user: User, s: NumberStatus, flash?: { type: "ok" | "error"; text: string }) {
  const i = s.info ?? {};
  const connected = s.configured.token && s.configured.phoneId && !s.error;
  const isCloud = i.platform_type === "CLOUD_API";
  return layout("WhatsApp setup", user, html`
<h1>WhatsApp setup</h1>
<p class="muted">For connecting the automatic sending number to Meta's WhatsApp Cloud API. Follow the guide step by step; this page does the parts that need the API.</p>
<div class="card"><h2 style="margin-top:0">1 · Keys in Cloudflare</h2><table>
${row("WHATSAPP_TOKEN (secret)", s.configured.token ? "Added" : "Not added yet", s.configured.token)}
${row("WHATSAPP_PHONE_NUMBER_ID (secret)", s.configured.phoneId ? "Added" : "Not added yet", s.configured.phoneId)}
</table>${!(s.configured.token && s.configured.phoneId) ? html`<p class="muted" style="margin-bottom:0">Add both in Cloudflare → Workers &amp; Pages → vocalzz-marketing → Settings → Variables and Secrets, then reload this page.</p>` : ""}
${s.error ? html`<div class="flash error" style="margin:10px 0 0">Meta did not accept the keys: ${s.error}</div>` : ""}</div>

${connected ? html`<div class="card"><h2 style="margin-top:0">2 · Sending number</h2><table>
${row("Number", i.display_phone_number, true)}
${row("Display name", i.verified_name)}
${row("Display name approval", i.name_status, i.name_status === "APPROVED")}
${row("Number verified by SMS", i.code_verification_status, i.code_verification_status === "VERIFIED")}
${row("Connected to Cloud API", i.platform_type, isCloud)}
${row("Status", i.status, i.status === "CONNECTED")}
${row("Quality", i.quality_rating, i.quality_rating === "GREEN")}
</table></div>

<form class="card" method="post" action="/admin/whatsapp/register">
<h2 style="margin-top:0">3 · Register the number ${isCloud ? html`<span class="badge completed">done</span>` : ""}</h2>
<p class="muted" style="margin-top:0">Choose any 6-digit PIN and <strong>write it down</strong>: it protects the number (two-step verification). Use the same PIN if you ever register again.</p>
<label for="pin">6-digit PIN</label><input id="pin" name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="off" style="max-width:200px">
<button>Register number</button></form>

<form class="card" method="post" action="/admin/whatsapp/test">
<h2 style="margin-top:0">4 · Send a test message</h2>
<p class="muted" style="margin-top:0">Sends the booking-confirmation template (it must be <strong>approved</strong> in WhatsApp Manager first) with sample details:</p>
<div class="msg-full" style="margin-bottom:8px">${renderTemplate(TEST_TEMPLATE, testParams())}</div>
<label for="to">Send to (your own WhatsApp number)</label><input id="to" name="to" inputmode="tel" required placeholder="99106 71188" style="max-width:240px">
<button>Send test</button></form>` : ""}

<div class="card"><h2 style="margin-top:0">Templates to create (${Object.keys(TEMPLATES).length})</h2>
<p class="muted" style="margin-top:0">In WhatsApp Manager → Message templates: category <strong>Utility</strong>, language <strong>English</strong> (not "English (US)"), names exactly as below.</p>
<ul style="margin:0;padding-left:18px">${Object.keys(TEMPLATES).map((n) => html`<li><code>${n}</code></li>`)}</ul></div>
`, flash);
}
