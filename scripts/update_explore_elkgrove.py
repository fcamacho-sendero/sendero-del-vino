#!/usr/bin/env python3
"""Conservative Explore Elk Grove winery-event collector.

Only publishes dated Event structured data from official event detail pages.
The calendar's featured editorial cards are not assumed to be dated events.
"""
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

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "explore_events.json"
CALENDAR = "https://www.exploreelkgrove.com/events/"
TZ = ZoneInfo("America/Los_Angeles")
HEADERS = {"User-Agent": "SenderoDelVino/1.0 (public event calendar reader)"}
VENUES = {
    "adkins family vineyards": "Adkins Family Vineyards",
    "christopher cellars": "Christopher Cellars",
    "ever after wine": "Ever After Wine",
    "flatland wine": "Flatland Wine Company",
    "mcconnell estates": "McConnell Estates",
    "south slope": "South Slope Wines & Bistro",
    "lamoure vineyards": "Lamoure Vineyards",
    "bogle": "Bogle Family Vineyards",
}
WINE_WORDS = re.compile(r"\b(wine|winery|wineries|vineyard|vineyards|tasting|vino)\b", re.I)


def clean(value):
    if not value:
        return ""
    soup = BeautifulSoup(str(value), "html.parser")
    for node in soup(["style", "script"]):
        node.decompose()
    return re.sub(r"\s+", " ", html.unescape(soup.get_text(" ", strip=True))).strip()


def get_soup(session, url):
    response = session.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def json_events(soup):
    """Read only schema.org Event nodes; ignore unrelated JSON-LD objects."""
    def walk(obj):
        if isinstance(obj, list):
            for item in obj:
                yield from walk(item)
        elif isinstance(obj, dict):
            types = obj.get("@type", [])
            types = [types] if isinstance(types, str) else types
            if any(str(t).lower().endswith("event") for t in types):
                yield obj
            for key in ("@graph", "itemListElement"):
                if key in obj:
                    yield from walk(obj[key])
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            yield from walk(json.loads(script.string or script.get_text()))
        except (ValueError, TypeError):
            continue


def parse_date(value):
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.replace(tzinfo=TZ) if dt.tzinfo is None else dt.astimezone(TZ)
    except ValueError:
        return None


def event_from_schema(item, page_url, today):
    title = clean(item.get("name"))
    start = parse_date(item.get("startDate"))
    end = parse_date(item.get("endDate"))
    if not title or start is None or not today <= start.date() <= today + timedelta(days=180):
        return None
    loc = item.get("location") or {}
    if isinstance(loc, list):
        loc = loc[0] if loc else {}
    venue_raw = loc.get("name", "") if isinstance(loc, dict) else str(loc)
    description = clean(item.get("description"))
    combined = " ".join((title, venue_raw, description)).lower()
    venue = next((name for key, name in VENUES.items() if key in combined), None)
    if not venue and not WINE_WORDS.search(title + " " + venue_raw):
        return None
    # Avoid unrelated events merely mentioning wine in passing.
    if not venue and not re.search(r"wine trail|wine tasting|winery|vineyard", title, re.I):
        return None
    venue = venue or "Participating Elk Grove Wineries"
    link = item.get("url") or page_url
    if not isinstance(link, str):
        link = page_url
    link = urljoin(page_url, link)
    if urlparse(link).scheme not in ("http", "https"):
        link = page_url
    # Empty time indicates date-only event; never invent a time.
    timed = "T" in item.get("startDate", "")
    end_timed = isinstance(item.get("endDate"), str) and "T" in item["endDate"]
    category = "music" if re.search(r"live music|concert|dj|dancing", title, re.I) else "festival" if re.search(r"festival|trail|fest", title, re.I) else "other"
    return {
        "id": hashlib.sha256(("explore:" + link + ":" + start.date().isoformat()).encode()).hexdigest()[:18],
        "title": title, "venue": venue, "region": "elk-grove",
        "category": category, "date": start.date().isoformat(),
        "endDate": (end or start).date().isoformat(),
        "start": start.strftime("%H:%M") if timed else "",
        "end": end.strftime("%H:%M") if end and end_timed else "",
        "location": "Elk Grove, CA", "description": description[:1200], "url": link
    }


def collect():
    session = requests.Session()
    soup = get_soup(session, CALENDAR)
    # Follow event details only on the same host; skip featured editorial links.
    candidates = []
    for a in soup.select('a[href]'):
        href = urljoin(CALENDAR, a.get("href", ""))
        path = urlparse(href).path
        if urlparse(href).netloc != "www.exploreelkgrove.com":
            continue
        if "/event/" in path or "/events/" in path and path.rstrip("/") != "/events":
            candidates.append(href.split("?")[0])
    candidates = list(dict.fromkeys(candidates))[:90]
    today = datetime.now(TZ).date()
    found = {}
    for url in candidates:
        try:
            detail = get_soup(session, url)
            for item in json_events(detail):
                event = event_from_schema(item, url, today)
                if event:
                    found[event["id"]] = event
        except requests.RequestException as exc:
            print(f"Skipped {url}: {exc}", file=sys.stderr)
    return sorted(found.values(), key=lambda e: (e["date"], e["title"]))


def main():
    events = collect()
    if not events:
        print("No verified Explore Elk Grove event records found; leaving previous feed unchanged.")
        return
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps({
        "updatedAt": datetime.now(TZ).isoformat(),
        "events": events,
        "sources": [CALENDAR]
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Collected {len(events)} Explore Elk Grove winery events")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        print(f"Explore Elk Grove collection failed: {exc}", file=sys.stderr)
        sys.exit(1)
