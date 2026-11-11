#!/usr/bin/env python3
"""Print Meta Ad Library and Google Ads Transparency Center links for the
keywords and competitors listed in business-profile.md.

Usage: python3 build_ad_library_urls.py [path/to/business-profile.md]
"""
import re
import sys
from pathlib import Path
from urllib.parse import quote_plus

DEFAULT_PROFILE = Path(__file__).resolve().parent.parent / "business-profile.md"

META = ("https://www.facebook.com/ads/library/?active_status=active&ad_type=all"
        "&country=IN&media_type=all&search_type=keyword_unordered&q={q}")
GOOGLE_DOMAIN = "https://adstransparency.google.com/?region=IN&domain={d}"
GOOGLE_SEARCH = "https://www.google.com/search?q={q}&gl=in"
LINKEDIN = "https://www.linkedin.com/ad-library/search?keyword={q}&countries=IN"


def sections(text):
    """Map '## Heading' -> list of bullet lines under it."""
    out, current = {}, None
    for line in text.splitlines():
        if line.startswith("## "):
            current = line[3:].strip().lower()
            out[current] = []
        elif current and line.strip().startswith("- "):
            out[current].append(line.strip()[2:].strip())
    return out


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PROFILE
    sec = sections(path.read_text(encoding="utf-8"))

    keywords = [k for k in sec.get("keywords", []) if not k.upper().startswith("TODO")]
    competitors = []
    for row in sec.get("known competitors", []):
        if row.upper().startswith("TODO"):
            continue
        parts = [p.strip() for p in row.split("|")]
        competitors.append((parts[0], parts[1] if len(parts) > 1 else ""))

    print("# Keyword searches\n")
    for k in keywords:
        print(f"## {k}")
        print(f"- Meta Ad Library: {META.format(q=quote_plus(k))}")
        print(f"- Google search:   {GOOGLE_SEARCH.format(q=quote_plus(k))}")
        print()

    print("# Competitors\n")
    if not competitors:
        print("(none listed in business-profile.md: add them under '## Known competitors')\n")
    for name, domain in competitors:
        print(f"## {name}")
        print(f"- Meta Ad Library: {META.format(q=quote_plus(name))}")
        print(f"- LinkedIn Ad Library: {LINKEDIN.format(q=quote_plus(name))}")
        if domain:
            d = re.sub(r"^https?://", "", domain).strip("/")
            print(f"- Google Ads Transparency: {GOOGLE_DOMAIN.format(d=quote_plus(d))}")
        print()


if __name__ == "__main__":
    main()
