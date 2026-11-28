#!/usr/bin/env python3
"""Read the Google Scholar citation total and write a Shields endpoint file."""

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

USER = "pjZdkO4AAAAJ"
SCHOLAR_URL = f"https://scholar.google.com/citations?user={USER}&hl=en"
OUT = Path(__file__).resolve().parents[1] / "assets" / "gs-citations.json"
CELL = re.compile(r'<td class="gsc_rsb_std">([0-9,]+)</td>')


def fetch(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def fetch_direct():
    return fetch(SCHOLAR_URL)


def fetch_allorigins():
    api = "https://api.allorigins.win/get?url=" + urllib.parse.quote(SCHOLAR_URL, safe="")
    data = json.loads(fetch(api))
    status = data.get("status") or {}
    code = status.get("http_code") if isinstance(status, dict) else None
    if code is not None and int(code) >= 400:
        raise RuntimeError(f"allorigins http {code}")
    html = data.get("contents") or ""
    if "<td class=\"gsc_rsb_std\">" not in html:
        raise RuntimeError("allorigins did not return the Scholar profile")
    return html


def parse_count(html):
    cells = CELL.findall(html)
    if not cells:
        return None
    count = cells[0].replace(",", "")
    return count if count.isdigit() else None


def read_previous():
    try:
        message = json.loads(OUT.read_text()).get("message", "")
    except (OSError, json.JSONDecodeError):
        return None
    return message if str(message).isdigit() else None


def main():
    count = None
    last_error = "no citation count"
    for name, getter in (("scholar", fetch_direct), ("allorigins", fetch_allorigins)):
        for attempt in (1, 2):
            try:
                count = parse_count(getter())
            except Exception as exc:
                last_error = f"{name}: {exc}"
                print(f"{name} attempt {attempt} failed: {exc}", file=sys.stderr)
                time.sleep(2)
                continue
            if count:
                break
            last_error = f"{name}: page did not include a citation count"
            print(f"{name} attempt {attempt}: {last_error}", file=sys.stderr)
            time.sleep(2)
        if count:
            break

    if not count:
        sys.exit(f"Could not read the citation count from Google Scholar ({last_error})")

    previous = read_previous()
    if previous and int(count) < int(previous):
        print(f"ignored {count}; keeping {previous}")
        return

    text = json.dumps(
        {"schemaVersion": 1, "label": "citations", "message": count},
        indent=2,
    ) + "\n"
    if OUT.exists() and OUT.read_text() == text:
        print(f"unchanged {count}")
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(text)
    tmp.replace(OUT)
    print(f"updated {count}")


if __name__ == "__main__":
    main()
