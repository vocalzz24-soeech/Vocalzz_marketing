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

1. Create a free Cloudflare account and log in: `npx wrangler login`.
2. Create the database: `npx wrangler d1 create vocalzz-appointments`, then copy the `database_id` it prints into
   `wrangler.toml`.
3. Create the tables: `npm run db:migrate:remote`.
4. Deploy: `npm run deploy`. Cloudflare prints the web address.
5. Optional: in the Cloudflare dashboard, add the custom domain `book.vocalzz.com`.
6. Open the site and create the admin login straight away. The first person to open it becomes the admin.

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
