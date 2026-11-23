# Windsor.ai dependency tracker (updated 23 Nov 2026)

Windsor trial ends **9 Dec 2026**. After that the Forever Free plan allows **1 data source**; Basic is ₹1,799/month (3 sources).
Goal: run reporting from tools Vocalzz owns. Update 23 Nov: Meta ads (Facebook/Instagram/WhatsApp) start in ~2 weeks, so Meta + Instagram connections are needed. Plan: Windsor Basic (₹1,799/mo: Google Ads + Meta Ads + Instagram) for Dec–Jan while Claude builds free own connections for Meta (Marketing API) and Google Ads (developer token); drop Windsor around Feb 2027.

| # | Connected in Windsor | What we use it for | Own replacement | Status | Action / timeline |
|---|---|---|---|---|---|
| 1 | Search Console (sc-domain:vocalzz.com) | SEO data: searches, clicks, positions | **SEO report** in book.vocalzz.com (service account, 16 months history) | ✅ Replaced 23 Nov | Disconnect from Windsor any time |
| 2 | Google Ads (898-392-0631) | Reading results + making ad changes (budgets, keywords, ad groups) | Own Google Ads API connection in the booking app (needs a free Google Ads developer token) | ⏳ Still on Windsor | Keep on Windsor Free after 9 Dec. Apply for developer token: this week (approval takes a few days to 2 weeks). Build read-only report: mid-Dec. Decide on full switch: Jan 2027 |
| 3 | Facebook Ads (account "Ayush Goyal", 65837242) | Meta ads (Facebook, Instagram, Click-to-WhatsApp) planned to start ~early Dec | Own Meta Marketing API connection in the booking app (free; same Meta app/system-user token as WhatsApp) | ⚠️ Wrong account | Create the clinic's OWN ad account inside the Vocalzz business portfolio and connect that instead (ads must run in accounts Vocalzz owns). Then Windsor or own build |
| 4 | Facebook page "Vocalzz" (organic) | Page posts / cross-posting (page inactive) | Meta Graph API via the same Meta app | ⚪ Optional | Keep only if needed for organic reporting; not needed for ads |
| 5 | Google Business Profile ("Vocalzz -Rehabilitation clinic") | Nothing (wrong listing; main listing managed directly) | Manage in Business Profile; Google's API needs approval, not worth it | ❌ Not used | Disconnect now; find who owns this listing (merge plan) |
| 6 | Instagram (vocalzz_4u) | Reel performance + ads | Meta Graph API via the same Meta app (instagram_manage_insights) | ⏳ Needed | Keep while Meta ads launch; own report built with the Meta ads report |

After the clean-up: **1 source on Windsor (Google Ads) = ₹0/month** on the Free plan, if write actions work there
(check before 9 Dec). If not: Basic ₹1,799/month until the own Google Ads connection is ready.
