#!/usr/bin/env python3
"""Read the Google Scholar citation total and write a Shields endpoint file."""

import json
import re
import sys
import urllib.request
from pathlib import Path

USER = "pjZdkO4AAAAJ"
URL = f"https://scholar.google.com/citations?user={USER}&hl=en"
OUT = Path(__file__).resolve().parents[1] / "assets" / "gs-citations.json"

req = urllib.request.Request(
    URL,
    headers={
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    },
)
with urllib.request.urlopen(req, timeout=30) as resp:
    html = resp.read().decode("utf-8", "replace")

cells = re.findall(r'<td class="gsc_rsb_std">([0-9,]+)</td>', html)
if not cells:
    sys.exit("Could not read the citation count from Google Scholar")
count = cells[0].replace(",", "")
if not count.isdigit():
    sys.exit(f"Unexpected citation count: {count}")

payload = {"schemaVersion": 1, "label": "citations", "message": count}
text = json.dumps(payload, indent=2) + "\n"
if OUT.exists() and OUT.read_text() == text:
    print(f"unchanged {count}")
else:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    print(f"updated {count}")
