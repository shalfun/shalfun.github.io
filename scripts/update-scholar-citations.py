#!/usr/bin/env python3
"""Read the Google Scholar citation total and write a Shields endpoint file.

Scheduled runs fetch once per UTC day, after a time chosen from the date.
GitHub-hosted runners are usually blocked by Scholar, so a SerpAPI key in
SERPAPI_API_KEY is the reliable path. One author lookup per day fits the
free quota.
"""

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER = "pjZdkO4AAAAJ"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "gs-citations.json"
CHECKED = ROOT / ".scholar-checked"
CELL = re.compile(r'<td class="gsc_rsb_std">([0-9,]+)</td>')
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def parse_count(html):
    cells = CELL.findall(html or "")
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


def scholar_url(host):
    return f"https://{host}/citations?user={USER}&hl=en"


def html_sources():
    for host in ("scholar.google.com", "scholar.google.com.hk", "scholar.google.co.uk"):
        yield host, lambda host=host: fetch(scholar_url(host), timeout=20)
    yield "allorigins", fetch_allorigins


def fetch_allorigins():
    api = "https://api.allorigins.win/get?url=" + urllib.parse.quote(
        scholar_url("scholar.google.com"), safe=""
    )
    data = json.loads(fetch(api, timeout=25))
    status = data.get("status") or {}
    code = status.get("http_code") if isinstance(status, dict) else None
    if code is not None and int(code) >= 400:
        raise RuntimeError(f"http {code}")
    html = data.get("contents") or ""
    if "gsc_rsb_std" not in html:
        raise RuntimeError("profile missing")
    return html


def serpapi_count():
    key = os.environ.get("SERPAPI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("SERPAPI_API_KEY is not set")
    query = urllib.parse.urlencode(
        {
            "engine": "google_scholar_author",
            "author_id": USER,
            "hl": "en",
            "api_key": key,
        }
    )
    try:
        payload = json.loads(fetch("https://serpapi.com/search.json?" + query, timeout=30))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"http {exc.code}") from None
    if payload.get("error"):
        raise RuntimeError(str(payload["error"])[:180])
    for row in (payload.get("cited_by") or {}).get("table") or []:
        citations = row.get("citations") or {}
        if "all" in citations:
            return str(int(citations["all"]))
    raise RuntimeError("response had no citation total")


def read_count():
    errors = []
    if os.environ.get("SERPAPI_API_KEY", "").strip():
        try:
            return "serpapi", serpapi_count()
        except Exception as exc:
            errors.append(f"serpapi: {exc}")
    for name, getter in html_sources():
        try:
            count = parse_count(getter())
        except Exception as exc:
            errors.append(f"{name}: {exc.__class__.__name__}")
            continue
        if count:
            return name, count
        errors.append(f"{name}: no count")
    return None, errors


def target_minute(day):
    # Stay before the 22:11 UTC catch-up run.
    digest = hashlib.sha256(day.encode()).hexdigest()
    return int(digest[:8], 16) % (22 * 60)


def finish_if_not_due(now):
    if os.environ.get("SCHOLAR_EVENT") != "schedule":
        return now.strftime("%Y-%m-%d")
    day = now.strftime("%Y-%m-%d")
    try:
        if CHECKED.read_text().strip() == day:
            print(f"already checked {day}")
            sys.exit(0)
    except OSError:
        pass
    target = target_minute(day)
    current = now.hour * 60 + now.minute
    label = f"{target // 60:02d}:{target % 60:02d} UTC"
    if current + 90 < target:
        print(f"not due yet; today's read is after {label}")
        sys.exit(0)
    extra = int(hashlib.sha256(f"{day}:delay".encode()).hexdigest()[:4], 16) % 30
    wait_min = target + extra - current
    if os.environ.get("GITHUB_ACTIONS") == "true" and 0 < wait_min <= 90:
        print(f"waiting {wait_min} minutes until around {label}")
        time.sleep(wait_min * 60)
    else:
        print(f"checking citations; today's slot was {label}")
    return day


def mark_checked(day):
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return
    CHECKED.write_text(day + "\n")


def write_count(count):
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


def main():
    day = finish_if_not_due(datetime.now(timezone.utc))
    source, count = read_count()
    if not isinstance(count, str):
        errors = count
        print("could not read Google Scholar:", "; ".join(errors), file=sys.stderr)
        if os.environ.get("SERPAPI_API_KEY", "").strip():
            sys.exit(1)
        print(
            "::notice::GitHub could not read Google Scholar. "
            "Add a SERPAPI_API_KEY Actions secret for the daily update."
        )
        return

    previous = read_previous()
    if previous and int(count) < int(previous) and source != "serpapi":
        print(f"ignored {count} from {source}; keeping {previous}")
        return
    print(f"read {count} from {source}")
    write_count(count)
    mark_checked(day)


if __name__ == "__main__":
    main()
