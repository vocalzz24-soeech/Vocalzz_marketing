# Ad intelligence sources

## 1. Meta Ad Library: facebook.com/ads/library
- Covers Facebook, Instagram, Messenger, Audience Network.
- URL pattern (keyword search, active ads, India):
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IN&q=<keyword>&search_type=keyword_unordered&media_type=all`
- For a specific page: search the page name, open the advertiser, and note its page ID.
- Visible per ad: start date, platforms, ad text, creative, CTA, landing URL,
  number of ad versions. Spend/reach is shown only for political/social-issue ads.
- No city filter. Confirm the ad targets Noida from the copy, landing page, page address,
  or "About" location.
- Meta Ad Library API (`graph.facebook.com/<ver>/ads_archive`) needs an
  identity-verified access token. If the user provides one, `ad_reached_countries=['IN']`
  plus `search_terms` returns structured JSON. Otherwise use the web UI links.

## 2. Google Ads Transparency Center: adstransparency.google.com
- Covers Search, YouTube, Display, Shopping, Maps, Play.
- URL pattern by domain: `https://adstransparency.google.com/?region=IN&domain=<domain>`
- Search by advertiser name in the UI. Filter region = India, date = last 30 days.
- Shows ad format, first/last shown dates, creative preview. No spend or targeting.
- It works per advertiser, not per keyword, so build the competitor list first.

## 3. Live Google search ads
- Search "<service> in Noida" / "<service> near Noida". Note results labelled
  "Sponsored": advertiser, headline, description, display URL, extensions (call,
  location, sitelinks).
- Results vary with the searcher's location and are not complete. Mark them indicative only.

## 4. LinkedIn Ad Library: linkedin.com/ad-library
- Search by advertiser/company name or keyword, country India.
- Relevant only for B2B or corporate-training offers.

## 5. Local listing platforms
- Justdial, Sulekha, UrbanPro, Google Maps: "Sponsored" / "Featured" / "Top"
  placements for the category in Noida. These are also paid placements.

## What to record per ad
| Field | Notes |
|---|---|
| Advertiser | Page/advertiser name + domain |
| Platform | FB / IG / Google Search / YouTube / Display / LinkedIn / Justdial… |
| Ad ID / link | Library URL so it can be checked again |
| Started running | Date shown in library |
| Format | Image / video / carousel / text |
| Hook / offer | e.g. "Free demo class", "50% off", "Certified trainer" |
| CTA | Learn more / Send WhatsApp message / Call now / Book now |
| Landing page | URL and type (website, WhatsApp, lead form, Instagram DM) |
| Language | English / Hindi / Hinglish |
| Noida evidence | Why we think it targets Noida |
