# Vocalzz Appointments

Book therapy appointments and automatically send WhatsApp messages to the patient and therapist.

## What it does

- **Booking:** the admin chooses the patient, therapist, therapy, date and time, a standard length (45 min by default)
  and optional **+10 / +15 min** extra time.
- **Clash check:** blocks a booking if the therapist or the patient is already booked then, or if the session
  falls outside clinic hours (10:00–21:00).
- **WhatsApp messages** (from the clinic number, through Meta's WhatsApp Business Platform):

  | Event | Patient gets | Therapist gets |
  |---|---|---|
  | Booked | Confirmation | New appointment |
  | Day before (if booked at least a day ahead) | Reminder | – |
  | 2 hours before (if booked at least 2 hours ahead) | Reminder | – |
  | Moved to a new time or therapist | New time | Moved (or cancelled + new for a therapist change) |
  | Cancelled | Cancellation | Cancellation |

  Patients without recorded WhatsApp consent get no messages. Until WhatsApp is connected, every message is
  saved as **"test (not sent)"** on the Messages page, so the whole system can be tried safely.
- **Logins:** the admin manages everything. Therapists log in with their phone number and see only their own
  schedule, and can mark sessions completed or no-show.
- **Message log** for every appointment.

- **Weekly repeats:** tick "Repeat every week", pick the days and an end (end of month, 4 or 8 weeks, or a date). Clashing dates are skipped; one WhatsApp message lists all dates; a series can be cancelled from any session onwards.
- **Continue next month:** on any session of a series, one tap books the same days and time for the following month.
- **Move a whole series:** when changing time, day or therapist, choose "this and all later sessions"; one message lists the new times.
- **Clinic holidays** (Schedule → Clinic holidays): block bookings on closed days; repeats skip them; the schedule shows them as Closed.
- **Patient history:** monthly attended / missed / cancelled / upcoming counts per patient, with a one-tap WhatsApp share for parents.
- **Missed-session follow-ups:** patients who miss 2 sessions in a row are flagged on the Schedule and Patients pages until marked as followed up.

- **Deleting:** admin only, from the bottom of a patient's or therapist's Edit page ("Danger zone"): type the exact name and tick a box. Patients are deleted with all their appointments, messages and comments. Therapists are anonymised ("Former therapist") so patients' past sessions stay intact, and cannot be deleted while they have upcoming sessions.
- **Billing** (admin, menu "Bills"): create a bill from a patient's completed sessions in a month (grouped by therapy,
  last-used rate pre-filled) or by typing lines; numbers per financial year (VZ/26-27/0001); discount, paid and balance,
  amount in words; Download PDF or Print. Bills can't be edited; a wrong bill is cancelled (kept, stamped CANCELLED).
  Bills keep their own copy of the patient's name and phone, so they survive if the patient record is deleted.
  The logo on bills is `public/logo.png`: replace it with the original logo file when available.
  Sessions not in the schedule: "Add a therapy line" fills the therapy and last rate; type the count and dates.
  "Also include sessions that weren't marked completed" adds booked sessions in the month (including upcoming ones).
  Test or mistaken bills can be deleted permanently (type the bill number and tick to confirm); real bills issued
  wrongly should be cancelled instead, which keeps a record.
- **Leave (HR Policy 2027):** therapists request leave from "Leave"; the admin approves or rejects (or adds approved leave
  directly). Balances follow the policy: 1 leave on the 1st of each month from Jan 2027 (or the month after joining),
  approved leave deducted straight away, up to 6 days carried into the next year, negative balance = unpaid days.
  Sundays and clinic holidays aren't counted. Requests with less notice than the policy (3 days for 1-2 days,
  15 days for longer; emergencies exempt) are flagged "short notice". Approved leave blocks bookings for that
  therapist and shows "On leave" on the schedule; sessions already booked in the leave are listed to move.
  Set each therapist's joining date and any opening balance on the Leave page.
- **2027 clinic holidays** (Holiday Calendar 2027) are loaded by migration 0008; edit them on the Holidays page.
- **Policies** (staff only): the admin uploads PDFs (max 1.4 MB) on the Policies page; staff open them and tap
  "I have read and agree"; the admin sees who has confirmed. Uploading with the same title creates a new version,
  archives the old one and asks everyone to confirm again. Files are stored in the database and only served to
  logged-in users. Therapists see a reminder banner on the Schedule until they confirm.

Not built yet: cancelling by replying on WhatsApp, payments (Razorpay), daily schedule summary for therapists,
reports.

## Technology and cost

Runs on **Cloudflare Workers** with a **Cloudflare D1** database. Cloudflare's free plan covers a clinic of this
size: it includes the 5-minute reminder check and the database, and allows business use. Code is in `src/`:

| File | What it holds |
|---|---|
| `src/index.ts` | Pages and actions (routes) |
| `src/views.ts` | Screen layouts |
| `src/schedule.ts` | Clash, clinic-hours and reminder-timing rules |
| `src/notify.ts` | Which messages go out for each event; the reminder job |
| `src/whatsapp.ts` | Message wording and sending through Meta |
| `src/auth.ts` | Passwords and login sessions |
| `migrations/` | Database tables |

## Run it on a computer (for development)

```bash
cd appointments
npm install
npm test                    # rule checks
npm run db:migrate:local    # create the local database
npx wrangler dev --test-scheduled
```

Open http://localhost:8787. The first visit asks you to create the admin login.
To run the reminder check by hand: open http://localhost:8787/__scheduled.

## Put it online (one time)

Easiest (no computer needed): in the Cloudflare dashboard, go to **Compute → Workers & Pages → Create →
Import a repository**, pick this GitHub repository and set:

- **Root directory:** `appointments`
- **Deploy command:** `npm run deploy`

`npm run deploy` publishes the app, creates the `vocalzz-appointments` database on the first run, and sets up
its tables. Cloudflare redeploys automatically on every push to the chosen branch.

From a computer instead: `npx wrangler login`, then `npm run deploy`.

Then open the site and **create the admin login straight away**: the first person to open it becomes the
admin. Optional: add the custom domain `book.vocalzz.com` in the dashboard.

## Connect WhatsApp

1. Finish Meta's setup (business verification, connecting +91 88002 30240 in WhatsApp Manager).
2. Submit the message templates in `docs/whatsapp-templates.md` in WhatsApp Manager and wait for approval.
3. Save the two secrets (they are never put in the code):

   ```bash
   npx wrangler secret put WHATSAPP_TOKEN
   npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
   ```

From then on, messages are really sent and show as "sent" or "failed" on the Messages page.

## Patient data

Only names, phone numbers, appointment times and the therapy type are stored. There are no diagnoses or medical
notes. Logins use hashed passwords and expire after 14 days. Every patient record has a WhatsApp consent flag,
which ties in with India's data protection law (DPDP Act, 2023).
