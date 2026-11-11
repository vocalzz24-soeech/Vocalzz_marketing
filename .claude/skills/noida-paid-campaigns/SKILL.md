---
name: noida-paid-campaigns
description: Find and analyse paid ad campaigns (Meta/Facebook/Instagram, Google Search/YouTube/Display, LinkedIn) that competitors are running in Noida / Greater Noida / Delhi NCR for the same type of business as Vocalzz, then produce a competitor ad-intelligence report. Use when the user asks to see, track, spy on, monitor or compare paid campaigns, ads, competitor ads or ad creatives in Noida or NCR, or asks "who is advertising near us".
---

# Noida Paid Campaign Tracker

Goal: show which businesses like ours are paying for ads that reach Noida, what
they say, where they run, and since when, then turn that into actions for Vocalzz.

## Step 0: Load the business profile

Read `business-profile.md` (next to this file). It defines the business type,
services, keywords (English + Hindi/Hinglish), known competitors and the
geography to cover. If the `Business type` field still says `TODO`, or the user
says the profile is wrong, ask the user once what the business is, update the
file, then continue.

Arguments the user may pass (all optional): a specific service, a competitor
name, a platform (`meta`, `google`, `linkedin`), or a time window. Default is all
platforms, ads active right now.

## Step 1: Build the search list

From the profile, put together:
- **Keyword queries**: each service keyword alone and combined with each
  location term (`Noida`, `Greater Noida`, `Sector 18 Noida`, `Noida Extension`,
  `Delhi NCR`). Include the Hindi/Hinglish variants.
- **Competitor list**: known competitors from the profile, plus new ones found in
  Step 2 (local Google Maps/Justdial/Sulekha listings and organic results for
  "<service> in Noida"). Record each one's name, website domain and Facebook
  page if you can find them.

`scripts/build_ad_library_urls.py` prints ready-made Meta Ad Library and Google
Ads Transparency Center links for every keyword and competitor:

```bash
python3 .claude/skills/noida-paid-campaigns/scripts/build_ad_library_urls.py
```

## Step 2: Collect the ads, per platform

Follow `references/sources.md` for each source and what to record. In short:

1. **Meta Ad Library** (Facebook, Instagram, Messenger, Audience Network):
   country = India, ad category = all, active ads only. Search every keyword and
   competitor. Meta does not filter by city, so keep only ads that mention Noida/NCR
   in the copy, landing page, address or page location, or that come from a known
   Noida business.
2. **Google Ads Transparency Center** (Search, YouTube, Display, Shopping, Maps):
   look up each competitor domain or advertiser name, region = India, last 30 days.
3. **Google Search results**: run the keyword+location queries with WebSearch and note
   any "Sponsored" results. These depend on where the search is run from, so mark them as
   indicative only.
4. **LinkedIn Ad Library** (only if the business sells to companies, e.g. corporate
   training): search the competitor company names.
5. **Local marketplaces**: Justdial, Sulekha and UrbanPro "sponsored"/"featured" listings
   for the category in Noida.

Use WebSearch/WebFetch (or the `web-fetch` agent) to read public pages. Some ad
libraries render with JavaScript and will not return results to a plain fetch.
If a source gives no results, write that in the report and include the
direct link from the script so the user can open it in a browser. Never make up
ads, spend numbers or dates.

## Step 3: Compare with our own campaigns (optional)

If the Windsor.ai MCP connectors are available and the user's own Meta Ads /
Google Ads accounts are connected (`get_connectors`), pull the last 30 days of
our campaigns (spend, impressions, clicks, CTR, CPC, leads/conversions) for
the Noida/NCR geography and put them next to the competitor findings. Only read
data here. Never pause, create or change campaigns from this skill unless the
user asks for that specific change and confirms it.

## Step 4: Analyse

For every advertiser found, record: platform(s), number of active ads, earliest
start date seen, formats (image/video/carousel/search text), the offer/hook
(free trial, discount, demo class, certification…), call to action, landing page,
language (English/Hindi/Hinglish), and locality targeting clues.

Then summarise:
- Who spends most visibly (most active ads, running longest; long-running ads
  usually mean they work).
- Common offers and price points, and gaps nobody covers.
- Keywords/localities with heavy vs. no competition.
- Creative patterns worth testing, and claims to avoid copying.
- 3–5 concrete recommendations for Vocalzz campaigns in Noida.

## Step 5: Report

Write the report using `references/report-template.md` to
`.claude/skills/noida-paid-campaigns/reports/YYYY-MM-DD-noida-paid-campaigns.md`
(today's date). Link every ad to its source (Ad Library URL / ad ID). If an
earlier report exists in `reports/`, add a "Changes since last report" section:
new advertisers, ads that stopped, new offers. Give the user a short summary in
chat and the report path.
