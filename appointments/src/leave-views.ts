import { html } from "hono/html";
import type { User } from "./auth.ts";
import { layout, type TherapistRow } from "./views.ts";

type Flash = { type: "ok" | "error"; text: string } | undefined;

export interface LeaveRow {
  id: number; therapist_id: number; therapist_name: string; start_day: string; end_day: string; days: number;
  kind: "planned" | "emergency"; reason: string | null; status: string; short_notice: number; created_at: string;
  decision_note: string | null; affected?: { id: number; start_utc: string; patient_name: string }[];
}
export interface BalanceRow { therapist: TherapistRow & { joined_on: string | null; leave_opening: number }; balance: number; taken: number; credited: number; carriedIn: number; pending: number }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const day = (d: string) => { const x = new Date(`${d}T00:00:00Z`); return `${WD[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const range = (l: LeaveRow) => (l.start_day === l.end_day ? day(l.start_day) : `${day(l.start_day)} – ${day(l.end_day)}`);
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const badge = (st: string) => ({ pending: "no_show", approved: "completed", rejected: "cancelled", cancelled: "cancelled" } as Record<string, string>)[st] ?? "";

function requestForm(user: User, therapists: TherapistRow[], today: string) {
  const isAdmin = user.role === "admin";
  return html`<form class="card" method="post" action="/leave">
<h2 style="margin-top:0">${isAdmin ? "Add leave for a therapist" : "Request leave"}</h2>
${isAdmin ? html`<label for="therapist_id">Therapist</label><select id="therapist_id" name="therapist_id" required><option value="">Choose…</option>
${therapists.filter((t) => t.active).map((t) => html`<option value="${t.id}">${t.name}</option>`)}</select>` : ""}
<div class="row">
<div><label for="start_day">From</label><input id="start_day" type="date" name="start_day" min="${today}" required></div>
<div><label for="end_day">To (last day of leave)</label><input id="end_day" type="date" name="end_day" min="${today}" required></div>
</div>
<label>Type</label>
<div class="chips"><label><input type="radio" name="kind" value="planned" checked> Planned</label><label><input type="radio" name="kind" value="emergency"> Emergency / sick</label></div>
<label for="reason">Reason (optional)</label><input id="reason" name="reason" maxlength="200">
${isAdmin ? html`<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="approve_now" value="1" checked> Approve straight away</label>` : ""}
<p class="muted" style="margin:6px 0 0">Policy: 1–2 days need 3 days' notice; more than 2 days need 15 days' notice; emergencies as early as possible. Sundays and clinic holidays aren't counted.</p>
<button>${isAdmin ? "Add leave" : "Send request"}</button></form>`;
}

function leaveCard(l: LeaveRow, user: User, today: string) {
  const isAdmin = user.role === "admin";
  return html`<div class="card leave-card">
<div class="leave-head"><strong>${isAdmin ? html`${l.therapist_name} · ` : ""}${range(l)}</strong>
<span class="badge ${badge(l.status)}">${l.status}</span></div>
<div class="muted">${num(l.days)} working day${l.days === 1 ? "" : "s"} · ${l.kind === "emergency" ? "Emergency / sick" : "Planned"}${l.short_notice ? " · ⚠ short notice" : ""}${l.reason ? ` · ${l.reason}` : ""}</div>
${l.decision_note ? html`<div class="muted">Note: ${l.decision_note}</div>` : ""}
${l.affected && l.affected.length ? html`<details style="margin-top:6px"><summary><strong style="color:var(--warn)">${l.affected.length} session${l.affected.length === 1 ? "" : "s"} booked during this leave</strong> (move or cancel)</summary>
<ul style="margin:6px 0 0;padding-left:18px">${l.affected.map((a) => html`<li><a href="/appointments/${a.id}">${day(new Date(new Date(a.start_utc).getTime() + 19_800_000).toISOString().slice(0, 10))} · ${a.patient_name}</a></li>`)}</ul></details>` : ""}
${isAdmin && l.status === "pending" ? html`<form method="post" action="/leave/${l.id}/decide" class="row" style="align-items:end;margin-top:6px">
<div><label for="note-${l.id}">Note (optional)</label><input id="note-${l.id}" name="note" maxlength="200"></div>
<button name="decision" value="approved" style="flex:0 0 auto">Approve</button>
<button name="decision" value="rejected" class="secondary" style="flex:0 0 auto">Reject</button></form>` : ""}
${(l.status === "pending" || (l.status === "approved" && l.start_day > today)) && (isAdmin || l.therapist_id === user.therapist_id) ? html`
<form method="post" action="/leave/${l.id}/cancel" style="margin:6px 0 0"><button class="secondary small">${l.status === "pending" ? "Withdraw request" : "Cancel this leave"}</button></form>` : ""}
</div>`;
}

export function leavePage(user: User, data: {
  today: string; therapists: TherapistRow[]; balances: BalanceRow[]; pending: LeaveRow[]; upcoming: LeaveRow[]; past: LeaveRow[];
}, flash: Flash) {
  const isAdmin = user.role === "admin";
  const mine = !isAdmin ? data.balances[0] : undefined;
  return layout("Leave", user, html`<style>
.leave-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.leave-card .badge{text-transform:capitalize}
.bal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.bal{background:var(--bg);border-radius:10px;padding:10px;text-align:center}.bal b{display:block;font-size:26px}
</style>
<h1>Leave</h1>
${mine ? html`<div class="card"><h2 style="margin-top:0">My leave balance</h2><div class="bal-grid">
<div class="bal"><b style="color:${mine.balance < 0 ? "var(--bad)" : "var(--ok)"}">${num(mine.balance)}</b>available</div>
<div class="bal"><b>${num(mine.credited)}</b>earned this year</div><div class="bal"><b>${num(mine.taken)}</b>approved this year</div>
${mine.pending ? html`<div class="bal"><b>${num(mine.pending)}</b>waiting for approval</div>` : ""}</div>
<p class="muted" style="margin:8px 0 0">1 leave is added on the 1st of each month. Up to 6 unused days carry into the next year. ${mine.balance < 0 ? "A negative balance means those days are unpaid." : ""}</p></div>` : ""}
${isAdmin && data.pending.length ? html`<h2>Waiting for your decision (${data.pending.length})</h2>${data.pending.map((l) => leaveCard(l, user, data.today))}` : ""}
${requestForm(user, data.therapists, data.today)}
${!isAdmin && data.pending.length ? html`<h2>Waiting for approval</h2>${data.pending.map((l) => leaveCard(l, user, data.today))}` : ""}
<h2>Upcoming approved leave</h2>
${data.upcoming.length ? data.upcoming.map((l) => leaveCard(l, user, data.today)) : html`<div class="card muted">None.</div>`}
${isAdmin ? html`<h2>Balances</h2><div class="card" style="overflow-x:auto"><table>
<tr><th>Therapist</th><th>Available</th><th>Earned this year</th><th>Approved this year</th><th>Joined</th><th>Opening balance</th><th></th></tr>
${data.balances.map((b) => html`<tr><td>${b.therapist.name}</td><td><strong style="color:${b.balance < 0 ? "var(--bad)" : "inherit"}">${num(b.balance)}</strong>${b.pending ? html`<br><span class="muted">${num(b.pending)} pending</span>` : ""}</td>
<td>${num(b.credited)}</td><td>${num(b.taken)}</td>
<td colspan="3"><form method="post" action="/leave/settings/${b.therapist.id}" class="row" style="align-items:center;gap:6px;margin:0;flex-wrap:nowrap">
<input type="date" name="joined_on" value="${b.therapist.joined_on ?? ""}" aria-label="Joining date" style="min-width:140px">
<input type="number" name="leave_opening" value="${b.therapist.leave_opening}" step="0.5" aria-label="Opening balance" style="width:80px">
<button class="secondary small" style="flex:0 0 auto">Save</button></form></td></tr>`)}
</table><p class="muted" style="margin:8px 0 0"><strong>Joined:</strong> leave starts the month after joining (leave empty for staff who joined before 2027). <strong>Opening balance:</strong> any leave carried into 2027.</p></div>` : ""}
<h2>Past and closed requests</h2>
${data.past.length ? data.past.map((l) => leaveCard(l, user, data.today)) : html`<div class="card muted">None yet.</div>`}
`, flash);
}

export function pendingLeaveBanner(count: number) {
  if (!count) return "";
  return html`<a class="card send-banner" style="border-color:var(--warn)" href="/leave"><strong>${count} leave request${count === 1 ? "" : "s"} waiting for your decision</strong><span>Open →</span></a>`;
}
