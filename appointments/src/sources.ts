// "How did you hear about us?": where each patient came from, for monthly reporting.
import type { Env } from "./env.ts";

export const SOURCES: { key: string; label: string }[] = [
  { key: "google_ads", label: "Google ad" },
  { key: "google_listing", label: "Google Maps / Google listing" },
  { key: "website", label: "Website (found on Google search)" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "patient_referral", label: "Referred by a patient / family / friend" },
  { key: "professional_referral", label: "Referred by a doctor / school / therapist" },
  { key: "directory", label: "Justdial / Practo / other directory" },
  { key: "walk_in", label: "Walk-in / saw the clinic" },
  { key: "existing", label: "Existing patient (before Nov 2026)" },
  { key: "other", label: "Other" },
];

/** How they first reached out to the clinic. */
export const CHANNELS: { key: string; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp message" },
  { key: "call", label: "Phone call" },
  { key: "walk_in", label: "Walked in to the clinic" },
  { key: "instagram_dm", label: "Instagram message" },
  { key: "facebook_msg", label: "Facebook message" },
  { key: "email", label: "Email" },
  { key: "directory_enquiry", label: "Justdial / Practo enquiry" },
  { key: "other", label: "Other" },
];

const KEYS = new Set(SOURCES.map((s) => s.key));
const CHANNEL_KEYS = new Set(CHANNELS.map((c) => c.key));
export const channelLabel = (key: string | null | undefined) => CHANNELS.find((c) => c.key === key)?.label ?? "Not recorded";
export const cleanChannel = (v: string | undefined) => (v && CHANNEL_KEYS.has(v) ? v : null);

export const sourceLabel = (key: string | null | undefined) => SOURCES.find((s) => s.key === key)?.label ?? "Not recorded";

/** A known source key, or null for empty / unknown input. */
export const cleanSource = (v: string | undefined) => (v && KEYS.has(v) ? v : null);

/** A YYYY-MM-DD date that really exists, or null. */
export function cleanDate(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

export interface SourceLine { key: string | null; label: string; patients: number; started: number }
export interface SourceReport { sources: SourceLine[]; channels: SourceLine[] }

/** Counts per source, in the order of SOURCES, then "Not recorded" last. Rows with no patients are left out. */
export function tallySources(rows: { source: string | null; stage: string | null }[]): SourceLine[] {
  return tally(rows.map((r) => ({ key: r.source, stage: r.stage })), SOURCES, cleanSource, sourceLabel);
}

/** Same as tallySources, for the contact channel. */
export function tallyChannels(rows: { contact_channel: string | null; stage: string | null }[]): SourceLine[] {
  return tally(rows.map((r) => ({ key: r.contact_channel, stage: r.stage })), CHANNELS, cleanChannel, channelLabel);
}

function tally(rows: { key: string | null; stage: string | null }[], list: { key: string }[],
  clean: (v: string | undefined) => string | null, label: (k: string | null) => string): SourceLine[] {
  const map = new Map<string | null, SourceLine>();
  for (const r of rows) {
    const key = clean(r.key ?? undefined);
    const line = map.get(key) ?? { key, label: label(key), patients: 0, started: 0 };
    line.patients++;
    if (r.stage === "active") line.started++;
    map.set(key, line);
  }
  const order = (k: string | null) => (k === null ? list.length : list.findIndex((s) => s.key === k));
  return [...map.values()].sort((a, b) => order(a.key) - order(b.key));
}

/**
 * New patients whose first contact falls in [from, to] (IST days, both included).
 * The first-contact date is enquiry_date, or the day the record was created when no date was entered.
 */
export async function sourceReport(env: Env, from: string, to: string): Promise<SourceReport> {
  const { results } = await env.DB.prepare(
    `SELECT source, contact_channel, stage FROM patients
     WHERE COALESCE(enquiry_date, date(created_at, '+330 minutes')) BETWEEN ? AND ?`,
  ).bind(from, to).all<{ source: string | null; contact_channel: string | null; stage: string | null }>();
  return { sources: tallySources(results), channels: tallyChannels(results) };
}
