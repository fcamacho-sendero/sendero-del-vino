#!/usr/bin/env python3
"""Collect upcoming Christopher Cellars events."""

import hashlib
import html
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "local_events.json"
URL = "https://www.christophercellars.com/upcoming-events?format=json"
TZ = ZoneInfo("America/Los_Angeles")


def clean(value):
    text = str(value or "")

    # Remove embedded CSS and JavaScript blocks.
    text = re.sub(
        r"<(style|script)\b[^>]*>.*?</\1>",
        " ",
        text,
        flags=re.IGNORECASE | re.DOTALL
    )

    # Remove remaining HTML tags.
    text = re.sub(r"<[^>]*>", " ", text)

    # Decode HTML entities and normalize whitespace.
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def date_value(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if value > 100000000000:
            value /= 1000
        return datetime.fromtimestamp(value, TZ)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(
                value.replace("Z", "+00:00")
            ).astimezone(TZ)
        except ValueError:
            return None
    return None


def collect():
    response = requests.get(
        URL,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30
    )
    response.raise_for_status()
    payload = response.json()

    items = payload.get("upcoming", [])
    if isinstance(items, dict):
        items = items.get("items", [])

    if not isinstance(items, list):
        raise ValueError("Unexpected Squarespace event format")

    today = datetime.now(TZ).date()
    events = []

    for item in items:
        if not isinstance(item, dict):
            continue

        title = clean(item.get("title"))
        start = date_value(
            item.get("startDate") or item.get("start")
        )
        end = date_value(
            item.get("endDate") or item.get("end")
        ) or start

        if not title or not start:
            continue
        if not today <= start.date() <= today + timedelta(days=180):
            continue

        path = item.get("fullUrl") or item.get("urlId")
        if not path:
            continue

        if str(path).startswith("https://www.christophercellars.com/"):
            link = str(path)
        elif str(path).startswith("/"):
            link = "https://www.christophercellars.com" + str(path)
        else:
            link = (
                "https://www.christophercellars.com/upcoming-events/"
                + str(path).lstrip("/")
            )

        description = clean(
            item.get("excerpt") or item.get("body")
        )

        events.append({
            "id": hashlib.sha256(link.encode()).hexdigest()[:18],
            "title": title,
            "venue": "Christopher Cellars",
            "region": "elk-grove",
            "category": "other",
            "date": start.strftime("%Y-%m-%d"),
            "endDate": end.strftime("%Y-%m-%d"),
            "start": start.strftime("%H:%M"),
            "end": end.strftime("%H:%M"),
            "location": "Elk Grove, CA",
            "description": description,
            "url": link
        })

    return events


def main():
    events = collect()
    if not events:
        print("No valid upcoming events; keeping previous data.")
        return

    result = {
        "updatedAt": datetime.now(TZ).isoformat(),
        "events": events,
        "sources": [URL]
    }

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )
    print(f"Collected {len(events)} Christopher Cellars events")


if __name__ == "__main__":
    try:
        main()
    except (requests.RequestException, ValueError, KeyError) as exc:
        print(f"Local collection failed: {exc}", file=sys.stderr)
        sys.exit(1)
