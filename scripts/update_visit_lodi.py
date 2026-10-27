#!/usr/bin/env python3
"""Import verified wine-related Visit Lodi events from official event detail pages."""
import hashlib
import html
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

BASE = "https://visitlodi.com/events/"
DEST = Path(__file__).resolve().parents[1] / "data" / "visit_lodi_events.json"
TZ = ZoneInfo("America/Los_Angeles")
WINE = re.compile(r"wine|winery|vineyard|tasting|vintner|grape|cellar|chocolate", re.I)
HEADERS = {"User-Agent": "SenderoDelVino/1.0"}

def walk(value):
    if isinstance(value, list):
        for item in value:
            yield from walk(item)
    elif isinstance(value, dict):
        types = value.get("@type", [])
        if isinstance(types, str):
            types = [types]
        if "Event" in types:
            yield value
        for key in ("@graph", "itemListElement"):
            if key in value:
                yield from walk(value[key])

def parse_date(raw):
    if not isinstance(raw, str) or not raw:
        return None
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return value.replace(tzinfo=TZ) if value.tzinfo is None else value.astimezone(TZ)
    except ValueError:
        return None

def collect():
    session = requests.Session()
    response = session.get(BASE, timeout=30, headers=HEADERS)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    urls = set()
    for anchor in soup.select("a[href]"):
        url = urljoin(BASE, anchor["href"]).split("#")[0]
        parsed = urlparse(url)
        path = parsed.path.rstrip("/")
        if parsed.netloc not in ("visitlodi.com", "www.visitlodi.com"):
            continue
        if not path.startswith("/events/") or path in ("/events", "/events/submit-an-event", "/events/annual-event-festivals"):
            continue
        if WINE.search(anchor.get_text(" ", strip=True) + " " + path):
            urls.add(url)
    today = datetime.now(TZ).date()
    found = {}
    for url in sorted(urls)[:30]:
        try:
            detail_response = session.get(url, timeout=20, headers=HEADERS)
            detail_response.raise_for_status()
        except requests.RequestException as exc:
            print(f"Skipping inaccessible detail page {url}: {type(exc).__name__}", file=sys.stderr)
            continue
        detail = BeautifulSoup(detail_response.text, "html.parser")
        for tag in detail.select('script[type="application/ld+json"]'):
            try:
                items = list(walk(json.loads(tag.string or tag.get_text())))
            except (ValueError, TypeError):
                continue
            for item in items:
                title = html.unescape(BeautifulSoup(str(item.get("name", "")), "html.parser").get_text(" ", strip=True))
                start = parse_date(item.get("startDate"))
                end = parse_date(item.get("endDate"))
                if not title or not start or not today <= start.date() <= today + timedelta(days=180):
                    continue
                if not WINE.search(title + " " + url):
                    continue
                # Require a plausible real event window; reject suspicious update timestamps.
                if end and (end < start or end - start > timedelta(days=7)):
                    continue
                event_url = item.get("url")
                if not isinstance(event_url, str) or urlparse(event_url).netloc not in ("visitlodi.com", "www.visitlodi.com"):
                    event_url = url
                description = html.unescape(BeautifulSoup(str(item.get("description", "")), "html.parser").get_text(" ", strip=True))
                venue = "Visit Lodi"
                location = item.get("location")
                if isinstance(location, dict):
                    venue = str(location.get("name") or venue)
                event = {
                    "id": hashlib.sha256(("visitlodi:" + event_url + ":" + start.date().isoformat()).encode()).hexdigest()[:18],
                    "title": title, "venue": venue, "region": "lodi", "category": "festival" if re.search(r"festival|weekend|fair", title, re.I) else "other",
                    "date": start.date().isoformat(), "endDate": (end or start).date().isoformat(),
                    "start": start.strftime("%H:%M") if "T" in str(item.get("startDate")) else "",
                    "end": end.strftime("%H:%M") if end and "T" in str(item.get("endDate")) else "",
                    "location": "Lodi, CA", "description": description[:1200], "url": event_url
                }
                found[event["id"]] = event
    return sorted(found.values(), key=lambda e: (e["date"], e["title"]))

def main():
    events = collect()
    if not events:
        print("No verified future Visit Lodi wine events; preserving existing feed.")
        return
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps({"updatedAt": datetime.now(TZ).isoformat(), "events": events, "sources": [BASE]}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Collected {len(events)} Visit Lodi wine events")

if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        print(f"Visit Lodi collection failed: {exc}", file=sys.stderr)
        sys.exit(1)
