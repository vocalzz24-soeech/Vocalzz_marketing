# 6-month paid-ads forecast for Vocalzz (Dec 2026 - May 2027). Run: python3 marketing/ads-forecast/forecast.py
# Replace the case assumptions with real numbers after the first month of ads.
# 6-month paid-ads forecast for Vocalzz (Dec 2026 - May 2027). All inputs are assumptions, flagged in the report.
months = ["Dec 26", "Jan 27", "Feb 27", "Mar 27", "Apr 27", "May 27"]
budget = [6000, 10000, 10000, 12000, 15000, 15000]          # total monthly ad spend (Rs)
google_share = [0.6, 0.6, 0.6, 0.6, 0.6, 0.6]
season = [0.85, 1.0, 1.1, 1.15, 1.05, 1.1]                   # Dec holidays dip; Feb-Mar school-readiness; May summer intensives
learn = [1.0, 1.08, 1.15, 1.2, 1.22, 1.25]                    # better keywords/negatives/creatives over time
cases = {
  #           google CPC, click->lead, meta cost/conv, conv->genuine lead, lead->assessment, assessment->enrolled
  "low":  dict(cpc=32, g_cr=0.05, meta_cpc=110, meta_q=0.30, l2a=0.30, a2e=0.40),
  "base": dict(cpc=26, g_cr=0.06, meta_cpc=90,  meta_q=0.35, l2a=0.35, a2e=0.45),
  "high": dict(cpc=20, g_cr=0.09, meta_cpc=60,  meta_q=0.45, l2a=0.45, a2e=0.55),
}
for name, c in cases.items():
    print(f"\n== {name} ==")
    print("month   spend  G-clicks G-leads M-chats M-leads leads assess enrol  CPL  CPEnrol")
    tl = te = ts = 0
    for i, m in enumerate(months):
        g = budget[i] * google_share[i]; mt = budget[i] - g
        cpc = c["cpc"] * (1 + 0.04 * min(i, 3)) / 1        # CPC drifts up a little as we add autism/OT terms
        clicks = g / cpc
        gl = clicks * c["g_cr"] * season[i] * learn[i]
        chats = mt / c["meta_cpc"] / learn[i] ** 0.5 * (learn[i])  # cost per chat improves with learning
        ml = chats * c["meta_q"] * season[i]
        leads = gl + ml
        a = leads * c["l2a"]; e = a * c["a2e"]
        tl += leads; te += e; ts += budget[i]
        print(f"{m:7} {budget[i]:6} {clicks:7.0f} {gl:7.1f} {chats:7.0f} {ml:7.1f} {leads:5.0f} {a:6.1f} {e:5.1f} {budget[i]/leads:5.0f} {budget[i]/max(e,0.1):7.0f}")
    print(f"TOTAL  spend {ts}  leads {tl:.0f}  enrolments {te:.1f}  CPL {ts/tl:.0f}  cost/enrol {ts/te:.0f}")
