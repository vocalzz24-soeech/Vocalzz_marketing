# WhatsApp automatic messages: step-by-step setup

**Goal:** booking confirmations, reminders and consultation messages go out automatically from **+91 99106 71188**.
Parents keep chatting with the clinic on **+91 88002 30240** (nothing changes there).

**Time:** about 1–1.5 hours, plus Meta's approval wait (minutes to a day).
**You need:** a laptop with Chrome, the phone with the **99106 71188** SIM (to receive an SMS code), the Facebook login
that owns the Vocalzz business, a debit/credit card, and the template file `appointments/docs/whatsapp-templates.md`.

Send a screenshot to Claude at any ✅ checkpoint, or if a screen looks different from this guide (Meta changes its
screens often; the names may be slightly different).

---

## Phase 0: Prepare the number (5 min)
1. Take the phone with the 99106 71188 SIM.
2. If **WhatsApp or WhatsApp Business** is installed with this number: open it → **Settings → Account → Delete my
   account** → enter the number → **Delete**. (Meta refuses numbers that are still on the WhatsApp app.)
3. Keep this phone next to you; it will get an SMS code.

✅ Checkpoint: 99106 71188 is not on any WhatsApp app.

## Phase 1: Check your Business portfolio (5 min)
1. On the laptop go to **business.facebook.com** and log in with your own Facebook account.
2. Top-left, check the portfolio name. It should be **Vocalzz Speech & Audio** (or similar) and owned by you, **not**
   the old marketer's portfolio. If you have none, click **Create a business portfolio** → name *Vocalzz Speech &
   Audio* → your name → **contactus@vocalzz.com** → Create.
3. Click **⚙ Settings → Business info** and fill: legal name, address (Tower E-004, Logix Blossom County, Sector 137,
   Noida 201304), phone **+91 88002 30240**, website **https://vocalzz.com**.

✅ Checkpoint: screenshot of Business info.

## Phase 2: Create the Meta app (10 min)
1. Go to **developers.facebook.com** → log in with the same Facebook account → if asked, click **Get started** and
   verify your developer account (phone/email).
2. Click **My Apps → Create app**.
3. App name: **Vocalzz Appointments**. Contact email: **contactus@vocalzz.com**. → Next.
4. Use case: choose **"Connect with customers through WhatsApp"** (it may be under "Other" or called "WhatsApp").
   → Next.
5. Business portfolio: choose **Vocalzz Speech & Audio**. → Next → **Create app** (re-enter your password if asked).
6. On the app page, left menu → **WhatsApp → API Setup** (or **Quickstart**). Meta creates a free *test* number; you
   can ignore it.
7. Left menu → **App settings → Basic**: **Privacy policy URL** = `https://vocalzz.com/privacy.html`, **Category** =
   *Health and fitness* (or *Business*), **App icon** = the Vocalzz logo. → **Save changes**.
8. Top of the page, switch **App mode** from *Development* to **Live** (it needs the privacy URL from step 7).

✅ Checkpoint: screenshot of API Setup page.

## Phase 3: Add the sending number 99106 71188 (10 min)
1. **WhatsApp → API Setup** → under "Step 5" / "Send messages with the API" click **Add phone number** (or open
   **WhatsApp Manager → Phone numbers → Add phone number**).
2. **Display name:** `Vocalzz Speech & Audio` (must match your business name and website).
3. **Category:** *Medical and health*. **Description:** "Speech, occupational and behavioural therapy clinic in Sector
   137, Noida. Appointment confirmations and reminders."
4. **Phone number:** country **India (+91)**, number **9910671188**. Method: **Text message** → Next.
5. Type the 6-digit code from the SMS → **Verify**.
6. Back on **API Setup**, in the **From** drop-down choose **+91 99106 71188**. Underneath you'll see:
   - **Phone number ID** (15 digits): copy it into a note. **This is what the app needs.**
   - WhatsApp Business Account ID (16 digits): not needed now.

✅ Checkpoint: screenshot showing the Phone number ID (it's not secret).
Meta now reviews the display name (minutes to 2 days). Messages can still be tested meanwhile.

## Phase 4: Payment method (5 min)
1. Go to **business.facebook.com → ⚙ Settings → Billing and payments** (or **WhatsApp Manager → Overview → Add
   payment method**).
2. Choose the WhatsApp Business Account **Vocalzz Speech & Audio** → **Add payment method** → card → currency **INR**.
3. Appointment messages are "utility" messages: about **₹0.12 each** (more for marketing). ~20 a day ≈ ₹70–100/month.

✅ Checkpoint: payment method shows as active.

## Phase 5: Create the 15 message templates (30–40 min)
1. **business.facebook.com → WhatsApp Manager → Message templates → Create template.**
2. For **each** template in `appointments/docs/whatsapp-templates.md`:
   - Category: **Utility**
   - Name: copy exactly (e.g. `vocalzz_appt_confirmed`); only small letters and underscores.
   - Language: **English** (choose plain "English", **not** "English (US)" or "English (UK)").
   - Body: paste the text exactly, with `{{1}}`, `{{2}}`… left as they are.
   - Click **Add sample** and fill each `{{n}}` with the sample value from the file.
   - Header, footer, buttons: none. → **Submit**.
3. Start with `vocalzz_appt_confirmed` (the setup page uses it for the test), then the rest.
4. Status turns **Active – Quality pending** or **Approved** when ready (usually minutes). If one is **Rejected**,
   send Claude a screenshot of the reason.

✅ Checkpoint: screenshot of the template list.

## Phase 6: Permanent key (system user token) (10 min)
1. **business.facebook.com → ⚙ Settings → Users → System users → Add.**
2. Name **vocalzz-app**, role **Admin** → Create.
3. Select it → **Assign assets**:
   - **Apps** → *Vocalzz Appointments* → **Full control** (Manage app) → Assign.
   - **WhatsApp accounts** → *Vocalzz Speech & Audio* → **Full control** → Assign.
4. Click **Generate new token** → App: *Vocalzz Appointments* → Expiration: **Never** → tick
   **whatsapp_business_messaging** and **whatsapp_business_management** → **Generate token**.
5. **Copy the token now** (it is shown only once). It is like a password: **do not send it in chat, email or WhatsApp.**
   Paste it straight into Cloudflare in the next phase.

## Phase 7: Give the keys to the app (5 min)
1. **dash.cloudflare.com → Workers & Pages → vocalzz-marketing → Settings → Variables and Secrets → + Add.**
2. Type **Secret**, Variable name `WHATSAPP_TOKEN`, Value: paste the token → **Save** (or **Deploy**).
3. **+ Add** again: type **Secret**, name `WHATSAPP_PHONE_NUMBER_ID`, value: the 15-digit Phone number ID → Save/Deploy.

## Phase 8: Register and test, in the app (5 min)
1. Open **book.vocalzz.com → ☰ menu → ⚙️ WhatsApp setup**.
2. Section 1 should show both keys as **Added**; section 2 shows the number and its status.
3. Section 3 **Register the number**: choose a 6-digit PIN, **write it down somewhere safe**, tap **Register number**.
   "Connected to Cloud API" should show **CLOUD_API**.
4. Section 4 **Send a test**: enter your own WhatsApp number → **Send test**. You should receive the sample booking
   confirmation from 99106 71188 within seconds.
5. Real test: add yourself as a patient on the Patients page, book an appointment, and check that the confirmation
   arrives. On the **Messages** page it should say **"Sent automatically"**.

✅ Done. From now on confirmations, reminders, consultation and cancellation messages send themselves. If one fails,
the Messages page shows it as **Failed** with a one-tap button to send it from your own WhatsApp instead.

---

## If something goes wrong
| What you see | What it means | Fix |
|---|---|---|
| "Phone number is already registered with WhatsApp" | The number is still on the WhatsApp app | Phase 0: delete the WhatsApp account on that phone, wait 3 minutes, retry |
| Display name "Rejected" | Name doesn't match the business/website | Use exactly *Vocalzz Speech & Audio*; make sure the website shows the same name |
| Template "Rejected" | Wording or sample issue | Screenshot the reason to Claude; we adjust and resubmit |
| Setup page: "Meta did not accept the keys" | Token or Phone number ID is wrong, or the token lacks permissions | Re-check Phase 3 step 6 and Phase 6 step 4 |
| Test: "Template name does not exist in the translation" | Template not approved yet, or created as "English (US)" | Wait for approval, or recreate it with language **English** |
| Test: "Account not registered" | Phase 8 step 3 not done | Register with your PIN |
| Messages limited to 250 people a day | New, unverified business | Plenty for now; later do Business verification (Settings → Security centre → Start verification, with GST/registration document) |
