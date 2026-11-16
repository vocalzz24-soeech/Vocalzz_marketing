// One-time tool: copy every row from the old database (DB, in the USA) to the new one (DB_NEW, in Asia).
// Works in small steps so each request stays well inside Cloudflare's limits, and is safe to run again:
// rows are "upserted" by their primary key, so a second run only brings over what changed.
import { html, raw } from "hono/html";
import type { User } from "./auth.ts";
import type { Env } from "./env.ts";
import { layout } from "./views.ts";

/** Parents before children, so references always point at rows that are already there. */
export const MOVE_TABLES: { name: string; pk: string; pageSize: number }[] = [
  { name: "therapists", pk: "id", pageSize: 50 },
  { name: "users", pk: "id", pageSize: 50 },
  { name: "sessions", pk: "token", pageSize: 50 },
  { name: "patients", pk: "id", pageSize: 50 },
  { name: "appointments", pk: "id", pageSize: 50 },
  { name: "messages", pk: "id", pageSize: 50 },
  { name: "appointment_comments", pk: "id", pageSize: 50 },
  { name: "holidays", pk: "day", pageSize: 50 },
  { name: "bills", pk: "id", pageSize: 50 },
  { name: "bill_items", pk: "id", pageSize: 50 },
  { name: "leave_requests", pk: "id", pageSize: 50 },
  { name: "policy_docs", pk: "id", pageSize: 1 }, // PDFs are large: one per step
  { name: "policy_acks", pk: "id", pageSize: 50 },
];

/** Builds the upsert for one row: insert it, or update it if that key is already there. */
export function upsertSql(table: string, pk: string, cols: string[]) {
  const q = (c: string) => `"${c.replace(/"/g, "")}"`;
  const set = cols.filter((c) => c !== pk).map((c) => `${q(c)} = excluded.${q(c)}`).join(", ");
  return `INSERT INTO ${q(table)} (${cols.map(q).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})` +
    (set ? ` ON CONFLICT(${q(pk)}) DO UPDATE SET ${set}` : ` ON CONFLICT(${q(pk)}) DO NOTHING`);
}

/** Copies the next page of one table. `after` is the last rowid already copied. */
export async function moveStep(env: Env, tableName: string, after: number) {
  const t = MOVE_TABLES.find((x) => x.name === tableName);
  if (!t || !env.DB_NEW) throw new Error("Unknown table or new database not connected");
  const { results } = await env.DB.prepare(`SELECT rowid AS _rid, * FROM "${t.name}" WHERE rowid > ? ORDER BY rowid LIMIT ${t.pageSize}`)
    .bind(after).all<Record<string, unknown>>();
  if (results.length) {
    const stmts = results.map((row) => {
      const cols = Object.keys(row).filter((k) => k !== "_rid");
      return env.DB_NEW!.prepare(upsertSql(t.name, t.pk, cols)).bind(...cols.map((c) => row[c] ?? null));
    });
    await env.DB_NEW.batch(stmts);
  }
  const last = results.length ? Number(results[results.length - 1]._rid) : after;
  return { table: t.name, copied: results.length, after: last, done: results.length < t.pageSize };
}

async function counts(db: Env["DB"]) {
  const out = await db.batch(MOVE_TABLES.map((t) => db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`)));
  return MOVE_TABLES.map((t, i) => ({ table: t.name, n: Number((out[i].results?.[0] as { n: number } | undefined)?.n ?? 0) }));
}

export async function moveStatus(env: Env) {
  const oldCounts = await counts(env.DB);
  const newCounts = env.DB_NEW ? await counts(env.DB_NEW) : null;
  return oldCounts.map((o, i) => ({ table: o.table, old: o.n, new: newCounts ? newCounts[i].n : null }));
}

export function movePage(user: User, rows: { table: string; old: number; new: number | null }[], connected: boolean, usingNew: boolean) {
  const allMatch = connected && rows.every((r) => r.old === r.new);
  return layout("Move database", user, html`
<h1>Move the database to Asia</h1>
${usingNew ? html`<div class="card" style="border-color:var(--ok)"><strong style="color:var(--ok)">✓ The app now runs on the Asia database.</strong> The table below compares it with the old one, which is kept as a backup.</div>` : ""}
${!connected ? html`<div class="card">The new Asia database is not connected yet. Once it is, this page lets you copy everything across in one tap.</div>` : html`
<div class="card">
<p style="margin-top:0">This copies every patient, appointment, message, bill, leave record and policy from the old database (USA) to the new one (Asia). Nothing is deleted from the old one, and you can run it again safely: it only updates what changed.</p>
<p class="muted">Best done when nobody is booking, e.g. at night. It takes about a minute.</p>
<button id="go">${allMatch ? "Copy again (sync latest changes)" : "Copy everything to the Asia database"}</button>
<p id="progress" class="muted" style="margin:8px 0 0"></p>
</div>`}
<div class="card" style="overflow-x:auto"><table><tr><th>Table</th><th>Old (USA)</th><th>New (Asia)</th><th></th></tr>
${rows.map((r) => html`<tr><td>${r.table}</td><td>${r.old}</td><td>${r.new ?? "–"}</td><td>${r.new === null ? "" : r.old === r.new ? html`<span style="color:var(--ok)">✓</span>` : html`<span style="color:var(--warn)">differs</span>`}</td></tr>`)}
</table>
${connected ? html`<p style="margin:10px 0 0;font-weight:700;color:${allMatch ? "var(--ok)" : "var(--warn)"}">${allMatch ? "✓ Everything matches. Tell Claude: the copy is done." : "Not copied yet, or some tables differ."}</p>` : ""}
</div>
<script>
(function () {
  var btn = document.getElementById("go"); if (!btn) return;
  var tables = ${raw(JSON.stringify(MOVE_TABLES.map((t) => t.name)))};
  var out = document.getElementById("progress");
  btn.addEventListener("click", async function () {
    btn.disabled = true;
    try {
      for (var i = 0; i < tables.length; i++) {
        var after = 0, total = 0, done = false;
        while (!done) {
          var res = await fetch("/admin/move-database/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: tables[i], after: after }) });
          if (!res.ok) throw new Error(await res.text());
          var r = await res.json();
          after = r.after; total += r.copied; done = r.done;
          out.textContent = "Copying " + tables[i] + "… " + total + " rows (" + (i + 1) + " of " + tables.length + " tables)";
        }
      }
      out.textContent = "Done. Checking…"; location.reload();
    } catch (e) { out.textContent = "Stopped: " + e.message + ". Tap the button to try again; it continues safely."; btn.disabled = false; }
  });
})();
</script>`);
}
