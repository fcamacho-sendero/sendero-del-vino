

#!/usr/bin/env python3
import hashlib
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "events.json"
API = "https://amadorwine.com/wp-json/tribe/events/v1/events"
TZ = ZoneInfo("America/Los_Angeles")

HEADERS = {
    "User-Agent": "SenderoDelVino/0.2 (event discovery)"
}

def clean(value):
    return re.sub(
        r"\s+", " ",
        re.sub(r"<[^>]+>", " ", str(value or ""))
    ).strip()

def category(title, description):
    text = (title + " " + description).lower()
    if any(w in text for w in [
        "music", "concert", "band", "acoustic", "jazz", "singer"
    ]):
        return "music"
    if any(w in text for w in [
        "food", "dinner", "brunch", "pizza", "truck",
        "chef", "cooking", "lunch"
    ]):
        return "food"
    if any(w in text for w in [
        "festival", "fair", "market", "harvest celebration"
    ]):
        return "festival"
    return "other"

def parse_item(item):
    title = clean(item.get("title"))
    link = str(item.get("url") or "")
    parsed = urlparse(link)

    if (
        not title
        or parsed.scheme != "https"
        or parsed.hostname not in (
            "amadorwine.com", "www.amadorwine.com"
        )
    ):
        return None

    try:
        start = datetime.fromisoformat(
            item["start_date"].replace(" ", "T")
        )
        end = datetime.fromisoformat(
            item["end_date"].replace(" ", "T")
        )
    except (KeyError, TypeError, ValueError):
        return None

    today = datetime.now(TZ).date()
    if (
        end.date() < today
        or start.date() > today + timedelta(days=120)
    ):
        return None

    venue = item.get("venue") or {}
    description = clean(item.get("description"))[:330]

    location = ", ".join(filter(None, [
        clean(venue.get("city")),
        clean(venue.get("state"))
    ])) or "Amador County, CA"

    return {
        "id": hashlib.sha256(
            link.encode()
        ).hexdigest()[:18],
        "title": title,
        "venue": clean(venue.get("venue"))
            or "Amador Wine Country",
        "region": "amador",
        "category": category(title, description),
        "date": start.strftime("%Y-%m-%d"),
        "endDate": end.strftime("%Y-%m-%d"),
        "start": start.strftime("%H:%M"),
        "end": end.strftime("%H:%M"),
        "location": location,
        "description": description,
        "url": link
    }

def main():
    all_events = []
    page = 1

    try:
        while page <= 12:
            response = requests.get(
                API,
                params={
                    "per_page": 50,
                    "page": page,
                    "start_date": datetime.now(TZ).strftime(
                        "%Y-%m-%d 00:00:00"
                    )
                },
                headers=HEADERS,
                timeout=25
            )
            response.raise_for_status()
            payload = response.json()

            if not isinstance(payload.get("events"), list):
                raise ValueError("Unexpected API response")

            all_events.extend(payload["events"])
            pages = int(payload.get("total_pages", 1))

            if page >= pages:
                break
            page += 1

        entries = [
            event
            for item in all_events
            if (event := parse_item(item))
        ]

        entries = list({
            event["id"]: event
            for event in entries
        }.values())

        entries.sort(
            key=lambda event: (
                event["date"], event["start"]
            )
        )

        DEST.parent.mkdir(
            parents=True, exist_ok=True
        )

        result = {
            "updatedAt": datetime.now(
                timezone.utc
            ).isoformat(),
            "events": entries,
            "sources": [API]
        }

        DEST.write_text(
            json.dumps(
                result, ensure_ascii=False, indent=2
            ) + "\n",
            encoding="utf-8"
        )

        print(f"Collected {len(entries)} events")

    except (
        requests.RequestException,
        ValueError,
        KeyError
    ) as exc:
        print(
            f"Collection failed: {exc}",
            file=sys.stderr
        )
        sys.exit(1)

if __name__ == "__main__":
    main()
