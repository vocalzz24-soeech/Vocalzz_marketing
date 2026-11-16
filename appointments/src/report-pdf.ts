// The dashboard as a static PDF (A4), built in the Worker with pdf-lib: used by "Download PDF" and the Sunday email.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { attendance, rangeLabel, scheduled, STATUSES, type Counts, type Report, type Status } from "./report.ts";
import { formatDateTime } from "./time.ts";

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
// Same fixed categorical order as the dashboard (light-mode steps, for paper).
const FILL: Record<Status, ReturnType<typeof rgb>> = {
  completed: hex("#2a78d6"), no_show: hex("#eb6834"), upcoming: hex("#1baf7a"), unmarked: hex("#eda100"), cancelled: hex("#e87ba4"),
};
const INK = hex("#0b0b0b"), INK2 = hex("#52514e"), MUTED = hex("#898781"), GRID = hex("#e1e0d9"), AXIS = hex("#c3c2b7"), BRAND = hex("#1f6fd1"), TILE = hex("#f4f7fb");
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const A4 = { w: 595.28, h: 841.89 }, M = 40;

/** Standard PDF fonts only know Western characters; anything else becomes "?" instead of breaking the PDF. */
const safe = (s: string) => s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
const total = (c: Counts) => scheduled(c) + c.cancelled;

interface Ctx { doc: PDFDocument; page: PDFPage; y: number; font: PDFFont; bold: PDFFont; footer: string }

function text(ctx: Ctx, s: string, x: number, y: number, size = 10, f: PDFFont = ctx.font, color = INK) {
  ctx.page.drawText(safe(s), { x, y, size, font: f, color });
}
function width(f: PDFFont, s: string, size: number) { return f.widthOfTextAtSize(safe(s), size); }
function fit(f: PDFFont, s: string, size: number, max: number) {
  const t = safe(s);
  if (f.widthOfTextAtSize(t, size) <= max) return t;
  let cut = t;
  while (cut.length > 1 && f.widthOfTextAtSize(cut + "...", size) > max) cut = cut.slice(0, -1);
  return cut + "...";
}
function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.y = A4.h - M;
  text(ctx, ctx.footer, M, 22, 8, ctx.font, MUTED);
}
function need(ctx: Ctx, h: number) { if (ctx.y - h < 46) newPage(ctx); }
function heading(ctx: Ctx, s: string) { need(ctx, 40); ctx.y -= 22; text(ctx, s, M, ctx.y, 13, ctx.bold); ctx.y -= 10; }

function legend(ctx: Ctx, counts?: Counts) {
  let x = M;
  for (const s of STATUSES) {
    const label = counts ? `${s.label} ${counts[s.key]}` : s.label;
    ctx.page.drawRectangle({ x, y: ctx.y - 8, width: 8, height: 8, color: FILL[s.key] });
    text(ctx, label, x + 12, ctx.y - 7.5, 9, ctx.font, INK2);
    x += 12 + width(ctx.font, label, 9) + 16;
  }
  ctx.y -= 18;
}

function tiles(ctx: Ctx, r: Report) {
  const c = r.totals, att = attendance(c);
  const items: [string, string][] = [
    ["Sessions*", String(scheduled(c))], ...STATUSES.map((s) => [s.label, String(c[s.key])] as [string, string]),
    ["Attendance", att === null ? "-" : `${att}%`], ["Patients", String(r.byPatient.filter((p) => scheduled(p.counts)).length)], ["New consultations", String(r.newConsultations)],
  ];
  const cols = 5, gap = 6, w = (A4.w - 2 * M - gap * (cols - 1)) / cols, h = 40;
  items.forEach(([label, value], i) => {
    if (i % cols === 0) { need(ctx, h + gap); ctx.y -= h + (i ? gap : 0); }
    const x = M + (i % cols) * (w + gap);
    ctx.page.drawRectangle({ x, y: ctx.y, width: w, height: h, color: TILE });
    text(ctx, label, x + 8, ctx.y + h - 13, 8, ctx.font, INK2);
    text(ctx, value, x + 8, ctx.y + 8, 16, ctx.bold);
  });
  ctx.y -= 14;
  text(ctx, "*Sessions = completed + no-show + upcoming + not marked. Attendance = completed / (completed + no-show).", M, ctx.y, 8, ctx.font, MUTED);
  ctx.y -= 4;
}

function statusSplit(ctx: Ctx, c: Counts) {
  const all = total(c), W = A4.w - 2 * M, h = 26;
  need(ctx, h + 30); ctx.y -= h + 6;
  if (!all) { text(ctx, "No sessions in this period.", M, ctx.y + 8, 10, ctx.font, MUTED); ctx.y -= 6; return; }
  const parts = STATUSES.filter((s) => c[s.key]);
  const usable = W - 2 * (parts.length - 1);
  let x = M;
  for (const s of parts) {
    const w = (usable * c[s.key]) / all;
    ctx.page.drawRectangle({ x, y: ctx.y, width: w, height: h, color: FILL[s.key] });
    const label = String(c[s.key]);
    if (w > width(ctx.bold, label, 10) + 10) text(ctx, label, x + w / 2 - width(ctx.bold, label, 10) / 2, ctx.y + 9, 10, ctx.bold, s.key === "unmarked" ? INK : rgb(1, 1, 1));
    x += w + 2;
  }
  ctx.y -= 6; legend(ctx, c);
}

function dayColumns(ctx: Ctx, byDay: { day: string; counts: Counts }[]) {
  const H = 150, L = 24, W = A4.w - 2 * M - L;
  need(ctx, H + 50); ctx.y -= H + 26;
  const base = ctx.y, max = Math.max(4, ...byDay.map((d) => total(d.counts)));
  const step = max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : 20, top = Math.ceil(max / step) * step;
  const yOf = (v: number) => base + (H * v) / top;
  for (const t of [0, top / 2, top]) {
    if (!Number.isInteger(t)) continue;
    ctx.page.drawLine({ start: { x: M + L, y: yOf(t) }, end: { x: M + L + W, y: yOf(t) }, thickness: t ? 0.5 : 0.8, color: t ? GRID : AXIS });
    text(ctx, String(t), M + L - 6 - width(ctx.font, String(t), 8), yOf(t) - 3, 8, ctx.font, MUTED);
  }
  const slot = W / byDay.length, bw = Math.min(18, slot * 0.62), every = byDay.length > 14 ? Math.ceil(byDay.length / 10) : 1;
  byDay.forEach((d, i) => {
    const x = M + L + slot * i + (slot - bw) / 2;
    let acc = 0;
    STATUSES.filter((s) => d.counts[s.key]).forEach((s, j) => {
      const v = d.counts[s.key], y0 = yOf(acc) + (j ? 1.5 : 0), h = yOf(acc + v) - yOf(acc) - (j ? 1.5 : 0);
      ctx.page.drawRectangle({ x, y: y0, width: bw, height: Math.max(h, 0.8), color: FILL[s.key] });
      acc += v;
    });
    if (acc) text(ctx, String(acc), x + bw / 2 - width(ctx.bold, String(acc), 8) / 2, yOf(acc) + 3, 8, ctx.bold);
    if (i % every === 0) {
      const dt = new Date(`${d.day}T00:00:00Z`);
      const l1 = byDay.length <= 14 ? WD[dt.getUTCDay()] : String(dt.getUTCDate());
      text(ctx, l1, x + bw / 2 - width(ctx.font, l1, 8) / 2, base - 11, 8, ctx.font, MUTED);
      if (byDay.length <= 14) { const l2 = String(dt.getUTCDate()); text(ctx, l2, x + bw / 2 - width(ctx.font, l2, 8) / 2, base - 21, 8, ctx.font, MUTED); }
    }
  });
  ctx.y -= 26; legend(ctx);
}

function hbars(ctx: Ctx, rows: { name: string; counts: Counts }[]) {
  if (!rows.length) { need(ctx, 20); ctx.y -= 16; text(ctx, "No sessions in this period.", M, ctx.y, 10, ctx.font, MUTED); ctx.y -= 4; return; }
  const nameW = 130, W = A4.w - 2 * M - nameW - 70, max = Math.max(...rows.map((r) => total(r.counts)));
  for (const r of rows) {
    need(ctx, 22); ctx.y -= 20;
    text(ctx, fit(ctx.font, r.name, 10, nameW - 8), M, ctx.y + 4, 10);
    const parts = STATUSES.filter((s) => r.counts[s.key]);
    const full = max ? (W * total(r.counts)) / max : 0, usable = full - 1.5 * (parts.length - 1);
    let x = M + nameW;
    for (const s of parts) { const w = (usable * r.counts[s.key]) / total(r.counts); ctx.page.drawRectangle({ x, y: ctx.y, width: Math.max(w, 0.8), height: 14, color: FILL[s.key] }); x += w + 1.5; }
    const v = `${scheduled(r.counts)}${r.counts.cancelled ? ` (+${r.counts.cancelled} cancelled)` : ""}`;
    text(ctx, v, x + 6, ctx.y + 4, 9, ctx.bold);
  }
  ctx.y -= 6; legend(ctx);
}

function table(ctx: Ctx, first: string, rows: { name: string; sub?: string; counts: Counts }[]) {
  const cols = [first, ...STATUSES.map((s) => s.label), "Sessions*"];
  const nameW = 165, cw = (A4.w - 2 * M - nameW) / (cols.length - 1);
  const head = () => {
    need(ctx, 30); ctx.y -= 16;
    cols.forEach((c, i) => {
      const x = i === 0 ? M : M + nameW + cw * i - 4;
      text(ctx, c, i === 0 ? x : x - width(ctx.bold, c, 8), ctx.y, 8, ctx.bold, INK2);
    });
    ctx.y -= 4; ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: A4.w - M, y: ctx.y }, thickness: 0.6, color: AXIS });
  };
  head();
  for (const r of rows) {
    if (ctx.y - 16 < 46) { newPage(ctx); head(); }
    ctx.y -= 14;
    text(ctx, fit(ctx.font, r.name + (r.sub ? ` (${r.sub})` : ""), 9, nameW - 8), M, ctx.y, 9);
    [...STATUSES.map((s) => r.counts[s.key]), scheduled(r.counts)].forEach((v, i) => {
      const s = v ? String(v) : "", f = i === STATUSES.length ? ctx.bold : ctx.font;
      text(ctx, s, M + nameW + cw * (i + 1) - 4 - width(f, s, 9), ctx.y, 9, f);
    });
    ctx.y -= 3; ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: A4.w - M, y: ctx.y }, thickness: 0.3, color: GRID });
  }
}

/** One or more reports in one PDF (the weekly email puts the week just ending and the coming week together). */
export async function reportPdf(reports: Report[], title: string, clinic: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(`${clinic} - ${title}`)); doc.setAuthor(safe(clinic)); doc.setCreator("Vocalzz Appointments");
  const ctx = { doc, y: 0, font: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold),
    footer: `${clinic} · ${title} · made ${formatDateTime(new Date(reports[0]?.generatedAt ?? Date.now()))} · confidential: for clinic use only` } as Ctx;
  reports.forEach((r, i) => {
    newPage(ctx);
    if (i === 0) { text(ctx, clinic.toUpperCase(), M, ctx.y - 4, 9, ctx.bold, BRAND); ctx.y -= 8; }
    ctx.y -= 22; text(ctx, `${r.period.label}`, M, ctx.y, 20, ctx.bold);
    ctx.y -= 16; text(ctx, rangeLabel(r.period.from, r.period.to) + (r.therapistName ? ` · ${r.therapistName}` : ""), M, ctx.y, 11, ctx.font, INK2);
    ctx.y -= 8;
    tiles(ctx, r);
    if (r.totals.unmarked) { ctx.y -= 12; text(ctx, `${r.totals.unmarked} past session(s) still need marking as completed or no-show.`, M, ctx.y, 9, ctx.bold, hex("#b45309")); }
    heading(ctx, "1 · Status of all sessions"); statusSplit(ctx, r.totals);
    heading(ctx, "2 · Sessions per day"); dayColumns(ctx, r.byDay);
    heading(ctx, "3 · Sessions by therapist"); hbars(ctx, r.byTherapist);
    if (r.byTherapist.length) table(ctx, "Therapist", r.byTherapist);
    heading(ctx, `4 · Sessions by patient (${r.byPatient.length})`);
    if (r.byPatient.length) table(ctx, "Patient", r.byPatient.map((p) => ({ name: p.name, sub: p.therapists.join(", "), counts: p.counts })));
    else { ctx.y -= 14; text(ctx, "No sessions in this period.", M, ctx.y, 10, ctx.font, MUTED); }
  });
  return doc.save();
}
