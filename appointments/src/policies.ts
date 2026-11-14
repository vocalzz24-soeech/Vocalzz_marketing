// Staff policies: upload PDFs (admin), read and acknowledge (staff). Kept behind the app login.
import { html } from "hono/html";
import type { User } from "./auth.ts";
import { layout } from "./views.ts";

type Flash = { type: "ok" | "error"; text: string } | undefined;

export const MAX_POLICY_BYTES = 1_400_000; // stays well under the database's 2 MB row limit once base64-encoded

export interface PolicyDoc { id: number; title: string; version: number; filename: string; size: number; uploaded_at: string; archived_at: string | null }
export interface AckRow { doc_id: number; user_id: number; acked_at: string }
export interface StaffRow { id: number; name: string }

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
/** True when the bytes start like a PDF file ("%PDF-"). */
export const looksLikePdf = (b: Uint8Array) => b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = (iso: string) => { const d = new Date(new Date(iso).getTime() + 19_800_000); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);

export function policiesPage(user: User, docs: PolicyDoc[], acks: AckRow[], staff: StaffRow[], archived: PolicyDoc[], flash: Flash) {
  const isAdmin = user.role === "admin";
  const mine = (d: PolicyDoc) => acks.find((a) => a.doc_id === d.id && a.user_id === user.id);
  return layout("Policies", user, html`
<h1>Policies</h1>
<p class="muted">Clinic policies for the Vocalzz team. Please read each one and confirm. These documents are for staff only: don't share them outside the clinic.</p>
${docs.length === 0 ? html`<div class="card muted">No policies uploaded yet.</div>` : ""}
${docs.map((d) => {
    const ack = mine(d);
    const done = acks.filter((a) => a.doc_id === d.id);
    return html`<div class="card">
<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
<div><strong style="font-size:17px">${d.title}</strong> <span class="badge">v${d.version}</span><div class="muted">Updated ${when(d.uploaded_at)} · PDF ${kb(d.size)}</div></div>
<a class="btn secondary small" style="margin:0" href="/policies/${d.id}/file" target="_blank" rel="noopener">Open PDF</a></div>
${!isAdmin ? (ack
      ? html`<p style="margin:10px 0 0;color:var(--ok);font-weight:700">✓ You confirmed you read this on ${when(ack.acked_at)}</p>`
      : html`<form method="post" action="/policies/${d.id}/ack" style="margin-top:10px">
<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="read" value="1" required> I have read and understood the ${d.title} and agree to follow it.</label>
<button style="margin-top:8px">I have read and agree</button></form>`) : ""}
${isAdmin ? html`<details style="margin-top:10px"><summary><strong>${done.length} of ${staff.length} staff confirmed</strong></summary>
<table style="margin-top:6px"><tr><th>Staff</th><th>Confirmed</th></tr>
${staff.map((s) => { const a = done.find((x) => x.user_id === s.id); return html`<tr><td>${s.name}</td><td>${a ? html`<span style="color:var(--ok)">✓ ${when(a.acked_at)}</span>` : html`<span style="color:var(--warn)">Not yet</span>`}</td></tr>`; })}
</table></details>
<form method="post" action="/policies/${d.id}/archive" style="margin-top:8px" onsubmit="return confirm('Remove ${d.title} from the Policies page? It stays in the archive below.')">
<button class="secondary small" style="margin:0">Remove from Policies</button></form>` : ""}
</div>`;
  })}
${isAdmin ? html`
<form class="card" method="post" action="/policies" enctype="multipart/form-data">
<h2 style="margin-top:0">Upload a policy (PDF)</h2>
<label for="title">Title</label>
<input id="title" name="title" list="policy-titles" maxlength="100" required placeholder="e.g. HR Policy 2027">
<datalist id="policy-titles">${docs.map((d) => html`<option value="${d.title}"></option>`)}</datalist>
<p class="muted" style="margin:4px 0 0">Use the <strong>same title</strong> to upload a new version: it replaces the old one and everyone is asked to confirm again.</p>
<label for="file">PDF file (max 1.4 MB)</label><input id="file" name="file" type="file" accept="application/pdf,.pdf" required>
<button>Upload</button></form>
${archived.length ? html`<details class="card"><summary><strong>Archive: older versions (${archived.length})</strong></summary>
<ul style="margin:8px 0 0;padding-left:18px">${archived.map((d) => html`<li><a href="/policies/${d.id}/file" target="_blank" rel="noopener">${d.title} v${d.version}</a> · uploaded ${when(d.uploaded_at)}${d.archived_at ? ` · retired ${when(d.archived_at)}` : ""}</li>`)}</ul></details>` : ""}` : ""}
`, flash);
}

export function unreadPoliciesBanner(titles: string[]) {
  if (!titles.length) return "";
  return html`<a class="card send-banner" style="border-color:var(--brand)" href="/policies"><strong>Please read and confirm: ${titles.join(", ")}</strong><span>Open →</span></a>`;
}
