// Sends report PDFs by email through Resend (https://resend.com), and logs every attempt.
import type { Env } from "./env.ts";
import { toBase64 } from "./policies.ts";
import { buildReport, periodFor, rangeLabel, scheduled, type Report } from "./report.ts";
import { reportPdf } from "./report-pdf.ts";
import { istDay } from "./time.ts";

export const emailReady = (env: Env) => !!(env.RESEND_API_KEY && env.REPORT_EMAIL_TO);

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const line = (r: Report) =>
  `<li><strong>${esc(r.period.label)}</strong> (${esc(rangeLabel(r.period.from, r.period.to))}): ${scheduled(r.totals)} sessions, ` +
  `${r.totals.completed} completed, ${r.totals.no_show} no-show, ${r.totals.upcoming} upcoming, ${r.totals.cancelled} cancelled` +
  `${r.totals.unmarked ? `, <strong>${r.totals.unmarked} not marked yet</strong>` : ""}.</li>`;

export async function emailReport(env: Env, kind: "weekly" | "on_demand", reports: Report[], title: string): Promise<{ ok: boolean; message: string }> {
  const clinic = env.CLINIC_NAME || "Vocalzz Speech & Audio";
  const subject = `${clinic}: ${title}`;
  const log = (status: string, error: string | null) =>
    env.DB.prepare("INSERT INTO report_emails (kind, subject, status, error) VALUES (?, ?, ?, ?)").bind(kind, subject, status, error).run();
  if (!emailReady(env)) {
    await log("not_configured", "RESEND_API_KEY or REPORT_EMAIL_TO is not set");
    return { ok: false, message: "Email is not set up yet (the Resend key and your email address need adding in Cloudflare)." };
  }
  const pdf = await reportPdf(reports, title, clinic);
  const filename = `${title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  const body = `<p>Hello,</p><p>Here is the ${esc(title)} for ${esc(clinic)}. The full report is attached as a PDF.</p><ul>${reports.map(line).join("")}</ul>` +
    `<p>Live dashboard: <a href="https://book.vocalzz.com/dashboard">book.vocalzz.com/dashboard</a></p><p style="color:#666;font-size:12px">Sent automatically by Vocalzz Appointments. Confidential: for clinic use only.</p>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.REPORT_EMAIL_FROM || "Vocalzz Reports <reports@vocalzz.com>",
        to: env.REPORT_EMAIL_TO!.split(",").map((s) => s.trim()).filter(Boolean),
        subject, html: body,
        attachments: [{ filename, content: toBase64(pdf) }],
      }),
    });
    if (res.ok) { await log("sent", null); return { ok: true, message: `Report emailed to ${env.REPORT_EMAIL_TO}.` }; }
    const err = ((await res.json().catch(() => ({}))) as { message?: string }).message ?? `HTTP ${res.status}`;
    await log("failed", err.slice(0, 300));
    return { ok: false, message: `The email did not go out: ${err}` };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await log("failed", err.slice(0, 300));
    return { ok: false, message: `The email did not go out: ${err}` };
  }
}

/** Sunday 9:30 PM IST: the week that is just ending, plus the coming week's bookings. */
export async function sendWeeklyReport(env: Env, now = new Date()) {
  const today = istDay(now);
  const reports = [
    await buildReport(env, { ...periodFor("this_week", today), label: "This week" }, undefined, now),
    await buildReport(env, periodFor("next_week", today), undefined, now),
  ];
  return emailReport(env, "weekly", reports, `Weekly report, week of ${rangeLabel(reports[0].period.from, reports[0].period.to)}`);
}

export const WEEKLY_CRON = "0 16 * * SUN"; // 16:00 UTC = 9:30 PM IST, on Sundays (must match wrangler.toml exactly)
