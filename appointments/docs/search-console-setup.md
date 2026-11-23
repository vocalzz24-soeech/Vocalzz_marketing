# Connect Search Console to the booking app (SEO report page)

**What this gives you:** a free **🔎 SEO report** page in book.vocalzz.com (menu → Admin), showing how vocalzz.com
does in normal Google search: clicks, searches, positions and pages, for the last 7 days, 28 days or 3 months.
It is **read-only**: it can't change anything in Search Console.

**Time:** about 15 minutes, on a laptop or the tablet in Chrome. **Cost:** ₹0 (Google Cloud does not charge for this).
**You need:** the Google account that owns Search Console (vocalzz24@gmail.com or tanugarg.india@gmail.com).

Send Claude a screenshot at any ✅ checkpoint, or if a screen looks different.
**Never paste the key file or its contents into chat, email or WhatsApp.** It goes only into Cloudflare.

---

## Step 1: Create a Google Cloud project (3 min)
1. Open **console.cloud.google.com** and sign in as **vocalzz24@gmail.com**. Accept the terms if asked.
   No billing / card is needed for this.
2. Top bar → project picker → **New project** → name **Vocalzz Reports** → **Create**. Make sure it is selected.

## Step 2: Turn on the Search Console API (1 min)
1. In the search bar at the top type **Google Search Console API** → open it → **Enable**.

## Step 3: Create the robot login (service account) (3 min)
1. Search bar → **Service accounts** → **+ Create service account**.
2. Name: **vocalzz-seo-report** → **Create and continue** → skip the role (**Continue**) → **Done**.
3. Copy its email; it looks like `vocalzz-seo-report@vocalzz-reports-xxxx.iam.gserviceaccount.com`.

✅ Checkpoint: screenshot of the service account list (the email is not secret).

## Step 4: Download its key (2 min)
1. Click the service account → **Keys** tab → **Add key → Create new key → JSON → Create**.
2. A small `.json` file downloads. Keep it private; you'll open it once in step 6.
   (If Google says key creation is blocked by an organisation policy, send Claude a screenshot.)

## Step 5: Let the robot read Search Console (1 min)
1. Open **search.google.com/search-console** → property **vocalzz.com**.
2. **Settings → Users and permissions → Add user**.
3. Paste the service account email from step 3 → Permission **Restricted** → **Add**.

## Step 6: Give the keys to the app in Cloudflare (4 min)
1. **dash.cloudflare.com → Workers & Pages → vocalzz-marketing → Settings → Variables and Secrets → + Add.**
2. Type **Secret**, name `GSC_CLIENT_EMAIL`, value: the service account email → **Save / Deploy**.
3. Open the downloaded `.json` file (any text app). Find `"private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`.
   Copy **everything between the quotes** after `"private_key":`, starting at `-----BEGIN` and ending at
   `-----END PRIVATE KEY-----\n` (the `\n` bits are fine; the app understands them).
4. **+ Add** again: type **Secret**, name `GSC_PRIVATE_KEY`, paste the value → **Save / Deploy**.
5. Delete the downloaded `.json` file from the device (it's no longer needed; Google can make a new one any time).

## Step 7: Check
Open **book.vocalzz.com → ☰ → 🔎 SEO report**. You should see clicks, searches and pages.

| What you see | Fix |
|---|---|
| "Not connected yet" | One of the two secrets is missing or misspelt (step 6) |
| "Google sign-in failed: invalid_grant" | The private key was copied incompletely; repeat step 6.3–6.4 |
| "User does not have sufficient permission" | Step 5 not done, or the email has a typo |
| "Search Console API has not been used in project…" | Step 2 not done; enable the API and wait 2 minutes |
