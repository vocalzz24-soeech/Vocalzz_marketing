import { html, raw } from "hono/html";
import type { User } from "./auth.ts";
import { amountInWords, PAYMENT_MODES, rupees } from "./billing.ts";
import { layout, type PatientRow } from "./views.ts";

type Flash = { type: "ok" | "error"; text: string } | undefined;

export interface BillRow {
  id: number; number: string; patient_id: number | null; bill_date: string; bill_to_name: string; bill_to_guardian: string | null;
  bill_to_phone: string | null; subtotal: number; discount: number; total: number; paid: number; payment_mode: string | null;
  payment_ref: string | null; notes: string | null; created_at: string; cancelled_at: string | null; cancel_reason: string | null;
}
export interface BillItemRow { description: string; service: string | null; quantity: number; rate: number; amount: number }
export interface DraftLine { description: string; service: string; quantity: string; rate: string }
export interface Clinic { name: string; address: string; phone: string; email: string; website: string }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const niceDay = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const phoneFmt = (p: string) => (p.length === 12 && p.startsWith("91") ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : `+${p}`);
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const statusOf = (b: BillRow) => (b.cancelled_at ? "Cancelled" : b.paid >= b.total ? "Paid" : b.paid > 0 ? "Part paid" : "Unpaid");

const CSS = `
.bill-actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.bill-actions .btn{margin:0}
.bill{background:#fff;color:#111;max-width:800px;margin:0 auto;padding:28px 30px;border:1px solid #dfe6ef;border-radius:10px;font-size:14px;line-height:1.45;position:relative}
.bill-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:3px solid #1e6fd9;padding-bottom:14px}
.bill-brand{display:flex;gap:14px;align-items:center}.bill-brand img.full{width:118px;height:auto}
.bill-brand .nm{font-weight:800;font-size:22px;letter-spacing:.06em;color:#0b1220}.bill-brand .tg{color:#1e6fd9;font-size:12px;font-weight:700}
.bill-clinic{text-align:right;font-size:12px;color:#444}
.bill-title{display:flex;justify-content:space-between;align-items:flex-end;margin:16px 0 10px}.bill-title h2{margin:0;font-size:20px;letter-spacing:.08em;color:#0b1220}
.bill-meta{font-size:13px;text-align:right}
.bill-to{background:#f4f7fb;border-radius:8px;padding:10px 12px;margin-bottom:14px}
.bill table{width:100%;border-collapse:collapse;font-size:13px}.bill th{background:#0b1220;color:#fff;text-align:left;padding:8px}.bill td{padding:8px;border-bottom:1px solid #e5e9f0;vertical-align:top}
.bill .num{text-align:right;white-space:nowrap}
.bill-sum{margin-left:auto;width:min(320px,100%);margin-top:10px}.bill-sum div{display:flex;justify-content:space-between;padding:4px 0}
.bill-sum .grand{border-top:2px solid #0b1220;font-weight:800;font-size:16px;margin-top:4px;padding-top:6px}
.bill-words{margin-top:10px;font-style:italic}
.bill-pay{margin-top:12px;font-size:13px}
.bill-foot{margin-top:24px;border-top:1px solid #dfe6ef;padding-top:10px;font-size:11px;color:#555;text-align:center}
.bill-stamp{position:absolute;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);border:4px solid #b91c1c;color:#b91c1c;font-size:46px;font-weight:900;padding:6px 18px;opacity:.35;letter-spacing:.1em}
.lines input{padding:8px}.lines td{padding:4px}.lines .q{width:70px}.lines .r{width:110px}
.bill-totals{display:grid;gap:4px;justify-items:end;margin-top:8px;font-size:15px}
.pill-paid{color:var(--ok);border-color:var(--ok)}.pill-unpaid{color:var(--warn);border-color:var(--warn)}
@media print{header,.bill-actions,.no-print,.flash{display:none!important}body{background:#fff}main{padding:0;max-width:none}.bill{border:0;border-radius:0;padding:0}}
`;

export function billsListPage(user: User, bills: BillRow[], q: string, month: string, flash: Flash) {
  return layout("Bills", user, html`<style>${raw(CSS)}</style>
<h1>Bills</h1>
<div class="row" style="flex:0 0 auto;gap:8px;margin-bottom:8px"><a class="btn" style="flex:0 0 auto" href="/bills/new">+ New bill</a></div>
<form method="get" action="/bills" class="row" style="align-items:end">
<div><label for="q">Search name or bill number</label><input id="q" name="q" value="${q}"></div>
<div><label for="month">Month</label><input id="month" type="month" name="month" value="${month}"></div>
<button class="secondary" style="flex:0 0 auto">Show</button></form>
<div class="card" style="overflow-x:auto">
${bills.length === 0 ? html`<p class="muted" style="margin:0">No bills found.</p>` : html`<table>
<tr><th>Bill no.</th><th>Date</th><th>Patient</th><th>Total</th><th>Status</th></tr>
${bills.map((b) => html`<tr><td><a href="/bills/${b.id}">${b.number}</a></td><td>${niceDay(b.bill_date)}</td><td>${b.bill_to_name}</td>
<td>${rupees(b.total)}</td><td><span class="badge ${b.cancelled_at ? "cancelled" : b.paid >= b.total ? "completed" : "no_show"}">${statusOf(b)}</span></td></tr>`)}
</table>`}</div>`, flash);
}

export function newBillPage(user: User, patients: PatientRow[], form: {
  patient_id: string; month: string; bill_date: string; lines: DraftLine[]; discount: string; paid: string;
  payment_mode: string; payment_ref: string; notes: string; sessionsFound: number | null;
  includeUnmarked: boolean; services: string[]; lastRates: Record<string, number>;
}, flash: Flash) {
  const lines = [...form.lines];
  while (lines.length < Math.max(4, form.lines.length + 2)) lines.push({ description: "", service: "", quantity: "", rate: "" });
  return layout("New bill", user, html`<style>${raw(CSS)}</style>
<p><a href="/bills">← Bills</a></p>
<h1>New bill</h1>
<form method="get" action="/bills/new" class="card">
<div class="row" style="align-items:end">
<div><label for="patient_id">Patient</label><select id="patient_id" name="patient_id" required onchange="this.form.submit()"><option value="">Choose…</option>
${patients.map((p) => html`<option value="${p.id}" ${String(p.id) === form.patient_id ? "selected" : ""}>${p.name}${p.guardian_name ? ` (parent: ${p.guardian_name})` : ""}</option>`)}</select></div>
<div><label for="month">Fill sessions from</label><input id="month" type="month" name="month" value="${form.month}"></div>
<button class="secondary" style="flex:0 0 auto">Fill from sessions</button></div>
<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="incl" value="all" ${form.includeUnmarked ? "checked" : ""}> Also include sessions in the schedule that weren't marked completed</label>
<p class="muted" style="margin:6px 0 0">Adds the patient's sessions in that month, grouped by therapy, with the last rate you used. Sessions that were never put in the schedule? Use <strong>Add a therapy line</strong> below and type the number of sessions and dates.</p>
${form.sessionsFound === 0 ? html`<p class="flash error" style="margin:8px 0 0">No completed sessions found for that month. Mark sessions as completed, or type the lines yourself.</p>` : ""}
</form>
<form method="post" action="/bills" class="card" id="bill-form">
<input type="hidden" name="patient_id" value="${form.patient_id}">
${form.patient_id ? html`<p class="muted" style="margin:0 0 8px">Bill for: <strong>${patients.find((p) => String(p.id) === form.patient_id)?.name ?? ""}</strong></p>` : html`<p class="flash error" style="margin:0 0 8px">Choose a patient in the box above first.</p>`}
<div class="row"><div><label for="bill_date">Bill date</label><input id="bill_date" type="date" name="bill_date" value="${form.bill_date}" required></div></div>
<div class="row" style="align-items:end">
<div><label for="add-line">Add a therapy line</label><select id="add-line"><option value="">Choose a therapy…</option>
${form.services.map((sv) => html`<option value="${sv}">${sv}${form.lastRates[sv] ? ` (last rate ₹${form.lastRates[sv]})` : ""}</option>`)}</select></div>
</div>
<p class="muted" style="margin:4px 0 0">For sessions not in the schedule: pick the therapy, then set the number of sessions and add the dates to the description, e.g. "(2, 5, 9 Nov)".</p>
<label>Items</label>
<div style="overflow-x:auto"><table class="lines"><tr><th>Description</th><th>Sessions / qty</th><th>Rate (₹)</th><th class="num">Amount</th></tr>
${lines.map((l) => html`<tr><td><input name="desc" value="${l.description}" maxlength="160" placeholder="e.g. Speech therapy sessions (Nov)"><input type="hidden" name="service" value="${l.service}"></td>
<td><input class="q" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${l.quantity}"></td>
<td><input class="r" name="rate" type="number" inputmode="decimal" min="0" step="any" value="${l.rate}"></td><td class="num amt">–</td></tr>`)}
</table></div>
<div class="row" style="margin-top:6px">
<div><label for="discount">Discount (₹)</label><input id="discount" name="discount" type="number" inputmode="decimal" min="0" step="any" value="${form.discount}"></div>
<div><label for="paid">Amount paid (₹)</label><input id="paid" name="paid" type="number" inputmode="decimal" min="0" step="any" value="${form.paid}"></div>
</div>
<div class="row">
<div><label for="payment_mode">Payment mode</label><select id="payment_mode" name="payment_mode"><option value="">–</option>
${PAYMENT_MODES.map((m) => html`<option ${m === form.payment_mode ? "selected" : ""}>${m}</option>`)}</select></div>
<div><label for="payment_ref">Transaction / UPI reference (optional)</label><input id="payment_ref" name="payment_ref" value="${form.payment_ref}" maxlength="60"></div>
</div>
<label for="notes">Note on the bill (optional, no medical details)</label><input id="notes" name="notes" value="${form.notes}" maxlength="200">
<div class="bill-totals"><div>Subtotal: <strong id="t-sub">₹0</strong></div><div>Total: <strong id="t-total">₹0</strong></div><div>Balance: <strong id="t-bal">₹0</strong></div></div>
<p class="muted">Once issued, a bill can't be edited. If something is wrong, cancel it and create a new one.</p>
<button>Create bill</button>
</form>
<script>
(function () {
  var f = document.getElementById("bill-form");
  function n(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
  function fmt(v) { return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function calc() {
    var sub = 0;
    f.querySelectorAll(".lines tr").forEach(function (tr, i) {
      if (!i) return;
      var a = n(tr.querySelector("[name=qty]").value) * n(tr.querySelector("[name=rate]").value);
      tr.querySelector(".amt").textContent = a ? fmt(a) : "–"; sub += a;
    });
    var total = Math.max(sub - n(f.discount.value), 0);
    document.getElementById("t-sub").textContent = fmt(sub);
    document.getElementById("t-total").textContent = fmt(total);
    document.getElementById("t-bal").textContent = fmt(Math.max(total - n(f.paid.value), 0));
  }
  f.addEventListener("input", calc); calc();
  var rates = ${raw(JSON.stringify(form.lastRates))};
  var add = document.getElementById("add-line");
  add.addEventListener("change", function () {
    var sv = add.value; if (!sv) return;
    var rows = Array.prototype.slice.call(f.querySelectorAll(".lines tr")).slice(1);
    var row = rows.find(function (tr) { return !tr.querySelector("[name=desc]").value; });
    if (!row) { alert("All lines are used. Create the bill, or clear a line first."); add.value = ""; return; }
    row.querySelector("[name=desc]").value = sv + " sessions (dates: )";
    row.querySelector("[name=service]").value = sv;
    row.querySelector("[name=qty]").value = 1;
    row.querySelector("[name=rate]").value = rates[sv] || "";
    add.value = ""; calc();
    var d = row.querySelector("[name=desc]"); d.focus(); d.setSelectionRange(d.value.length - 1, d.value.length - 1);
  });
})();
</script>`, flash);
}

export function billPage(user: User, b: BillRow, items: BillItemRow[], clinic: Clinic, flash: Flash) {
  const balance = Math.max(b.total - b.paid, 0);
  const file = `Vocalzz-Bill-${b.number.replace(/\//g, "-")}.pdf`;
  return layout(`Bill ${b.number}`, user, html`<style>${raw(CSS)}</style>
<div class="bill-actions">
<a class="btn secondary" href="/bills">← Bills</a>
${b.patient_id ? html`<a class="btn secondary" href="/patients/${b.patient_id}/summary">Patient</a>` : ""}
<button type="button" id="dl">Download PDF</button>
<button type="button" class="secondary" onclick="window.print()">Print</button>
</div>
<div class="bill" id="bill">
${b.cancelled_at ? html`<div class="bill-stamp">CANCELLED</div>` : ""}
<div class="bill-head">
<div class="bill-brand"><img src="/logo-full.png" alt="Vocalzz Speech & Audio" class="full"><div class="tg">Better Communication,<br>Better Life</div></div>
<div class="bill-clinic">${clinic.address}<br>Phone / WhatsApp: +${clinic.phone.slice(0, 2)} ${clinic.phone.slice(2, 7)} ${clinic.phone.slice(7)}<br>${clinic.email} · ${clinic.website}</div>
</div>
<div class="bill-title"><h2>BILL / RECEIPT</h2><div class="bill-meta">Bill no.: <strong>${b.number}</strong><br>Date: <strong>${niceDay(b.bill_date)}</strong></div></div>
<div class="bill-to"><strong>Bill to:</strong> ${b.bill_to_name}${b.bill_to_guardian ? html` <span>(parent/guardian: ${b.bill_to_guardian})</span>` : ""}${b.bill_to_phone ? html`<br>Phone: ${phoneFmt(b.bill_to_phone)}` : ""}</div>
<table><tr><th style="width:36px">#</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
${items.map((it, i) => html`<tr><td>${i + 1}</td><td>${it.description}</td><td class="num">${qty(it.quantity)}</td><td class="num">${rupees(it.rate)}</td><td class="num">${rupees(it.amount)}</td></tr>`)}
</table>
<div class="bill-sum">
<div><span>Subtotal</span><span>${rupees(b.subtotal)}</span></div>
${b.discount ? html`<div><span>Discount</span><span>− ${rupees(b.discount)}</span></div>` : ""}
<div class="grand"><span>Total</span><span>${rupees(b.total)}</span></div>
<div><span>Paid${b.payment_mode ? ` (${b.payment_mode})` : ""}</span><span>${rupees(b.paid)}</span></div>
<div><span>Balance due</span><span>${rupees(balance)}</span></div>
</div>
<div class="bill-words">${amountInWords(b.total)}</div>
<div class="bill-pay">${b.payment_ref ? html`Payment reference: ${b.payment_ref}<br>` : ""}${b.notes ? html`Note: ${b.notes}` : ""}</div>
<div class="bill-foot">This is a computer-generated bill and does not require a signature.<br>
${clinic.name} · ${clinic.address} · ${clinic.email} · ${clinic.website}<br>Thank you for choosing ${clinic.name}.</div>
</div>
${b.cancelled_at ? html`<p class="muted no-print" style="text-align:center">Cancelled on ${niceDay(b.cancelled_at.slice(0, 10))}${b.cancel_reason ? `: ${b.cancel_reason}` : ""}</p>` : html`
<details class="card danger-zone no-print" style="max-width:800px;margin:20px auto 0"><summary>Cancel this bill</summary>
<p>The bill stays on record marked <strong>CANCELLED</strong>, and its number is not reused. Create a new bill if needed.</p>
<form method="post" action="/bills/${b.id}/cancel"><label for="reason">Reason</label><input id="reason" name="reason" maxlength="200" required>
<button class="danger">Cancel bill</button></form></details>`}
<details class="card danger-zone no-print" style="max-width:800px;margin:12px auto 0"><summary>Delete this bill permanently</summary>
<p>For <strong>test bills or bills made by mistake</strong>. The bill is removed completely and won't appear anywhere. For a real bill that was issued wrongly, use <strong>Cancel</strong> instead, which keeps a record.</p>
<p class="muted">If this is the most recent bill, its number (${b.number}) will be used again for the next bill. Otherwise that number is simply skipped.</p>
<form method="post" action="/bills/${b.id}/delete" class="delete-form">
<label for="confirm_number">To confirm, type the bill number: <strong>${b.number}</strong></label>
<input id="confirm_number" name="confirm_number" autocomplete="off" required>
<label style="font-weight:400;display:flex;gap:8px;align-items:center"><input type="checkbox" name="understand" value="1" required> I understand this cannot be undone</label>
<button class="danger" disabled data-num="${b.number}">Delete bill permanently</button></form>
<script>
(function () {
  var f = document.currentScript.previousElementSibling, btn = f.querySelector("button"), i = f.querySelector("[name=confirm_number]"), c = f.querySelector("[name=understand]");
  function chk() { btn.disabled = !(c.checked && i.value.trim().toUpperCase() === btn.dataset.num.toUpperCase()); }
  i.addEventListener("input", chk); c.addEventListener("change", chk);
  f.addEventListener("submit", function (e) { if (!confirm("Delete bill " + btn.dataset.num + " permanently?")) e.preventDefault(); });
})();
</script></details>
<script src="/vendor/html2pdf.bundle.min.js"></script>
<script>
document.getElementById("dl").addEventListener("click", function () {
  var btn = this; btn.disabled = true; btn.textContent = "Preparing PDF…";
  html2pdf().set({ margin: [8, 8, 8, 8], filename: ${raw(JSON.stringify(file))}, image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } })
    .from(document.getElementById("bill")).save()
    .then(function () { btn.disabled = false; btn.textContent = "Download PDF"; });
});
</script>`, flash);
}

export function patientBillsCard(patient: PatientRow, bills: BillRow[], month: string) {
  return html`<div class="card"><div class="row" style="justify-content:space-between;align-items:center;flex:0 0 auto">
<h2 style="margin:0">Bills</h2><a class="btn small" style="flex:0 0 auto" href="/bills/new?patient_id=${patient.id}&month=${month}">Create bill for this month</a></div>
${bills.length === 0 ? html`<p class="muted" style="margin:8px 0 0">No bills yet.</p>` : html`<ul style="margin:8px 0 0;padding-left:18px">
${bills.map((b) => html`<li><a href="/bills/${b.id}">${b.number}</a> · ${niceDay(b.bill_date)} · ${rupees(b.total)} · ${statusOf(b)}</li>`)}</ul>`}</div>`;
}
