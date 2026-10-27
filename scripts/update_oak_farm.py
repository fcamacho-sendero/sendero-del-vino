#!/usr/bin/env python3
"""Collect future Oak Farm Vineyards events from official schema.org Event data."""
import hashlib
import html
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

URL = "https://www.oakfarmvineyards.com/upcoming-events/"
DEST = Path(__file__).resolve().parents[1] / "data" / "oak_farm_events.json"
TZ = ZoneInfo("America/Los_Angeles")

def walk(obj):
    if isinstance(obj, list):
        for value in obj:
            yield from walk(value)
    elif isinstance(obj, dict):
        types = obj.get("@type", [])
        if isinstance(types, str):
            types = [types]
        if "Event" in types:
            yield obj
        for key in ("@graph", "itemListElement"):
            if key in obj:
                yield from walk(obj[key])

def collect():
    response = requests.get(URL, timeout=30, headers={"User-Agent": "SenderoDelVino/1.0"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    today = datetime.now(TZ).date()
    found = {}
    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(tag.string or tag.get_text())
        except (ValueError, TypeError):
            continue
        for item in walk(data):
            raw = item.get("startDate")
            title = html.unescape(BeautifulSoup(str(item.get("name", "")), "html.parser").get_text(" ", strip=True))
            if not isinstance(raw, str) or not title:
                continue
            try:
                start = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                start = start.replace(tzinfo=TZ) if start.tzinfo is None else start.astimezone(TZ)
            except ValueError:
                continue
            if not today <= start.date() <= today + timedelta(days=180):
                continue
            link = item.get("url", "")
            if not isinstance(link, str) or urlparse(link).netloc not in ("www.oakfarmvineyards.com", "oakfarmvineyards.com"):
                continue
            end_raw = item.get("endDate")
            try:
                end = datetime.fromisoformat(end_raw.replace("Z", "+00:00")) if isinstance(end_raw, str) else None
                if end:
                    end = end.replace(tzinfo=TZ) if end.tzinfo is None else end.astimezone(TZ)
            except ValueError:
                end = None
            description = html.unescape(BeautifulSoup(str(item.get("description", "")), "html.parser").get_text(" ", strip=True))
            category = "music" if re.search(r"music|concert|band|singer", title, re.I) else "food" if re.search(r"food|dinner|pairing", title, re.I) else "festival" if re.search(r"festival|stroll|open house", title, re.I) else "other"
            event = {
                "id": hashlib.sha256(("oakfarm:"+link+":"+start.date().isoformat()).encode()).hexdigest()[:18],
                "title": title, "venue": "Oak Farm Vineyards", "region": "lodi",
                "category": category, "date": start.date().isoformat(),
                "endDate": max(start.date(), (end or start).date()).isoformat(),
                "start": start.strftime("%H:%M") if "T" in raw else "",
                "end": end.strftime("%H:%M") if end and isinstance(end_raw, str) and "T" in end_raw else "",
                "location": "Lodi, CA", "description": description[:1200], "url": link,
            }
            found[event["id"]] = event
    return sorted(found.values(), key=lambda e: (e["date"], e["title"]))

def main():
    events = collect()
    if not events:
        print("No verified Oak Farm events; preserving existing feed.")
        return
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps({"updatedAt": datetime.now(TZ).isoformat(), "events": events, "sources": [URL]}, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print(f"Collected {len(events)} Oak Farm events")

if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        print(f"Oak Farm collection failed: {exc}", file=sys.stderr)
        sys.exit(1)
