"""Read-only diagnostics for potential Delta winery event sources.

This intentionally does not publish events. Only confirmed, future, structured
Event records can be considered for a later importer.
"""
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

SOURCES = {
    "old_sugar_mill": "https://oldsugarmill.com/events-calendar/",
    "grand_island_vineyards": "https://www.grandislandvineyards.com/collection/events",
    "oak_farm_vineyards": "https://www.oakfarmvineyards.com/upcoming-events/",
}

def event_objects(value):
    if isinstance(value, list):
        for item in value:
            yield from event_objects(item)
    elif isinstance(value, dict):
        types = value.get("@type", [])
        if isinstance(types, str):
            types = [types]
        if "Event" in types and value.get("startDate") and value.get("name"):
            yield value
        for key in ("@graph", "itemListElement"):
            if key in value:
                yield from event_objects(value[key])

def probe(name, url):
    result = {"source": name, "url": url, "status": "unavailable", "candidate_events": []}
    try:
        response = requests.get(url, timeout=25, headers={"User-Agent": "SenderoDelVinoSourceAudit/1.0"})
        result["http_status"] = response.status_code
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        result["page_title"] = soup.title.get_text(" ", strip=True) if soup.title else ""
        result["status"] = "accessible"
        result["event_jsonld_blocks"] = 0
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                parsed = json.loads(tag.string or tag.get_text())
            except (ValueError, TypeError):
                continue
            events = list(event_objects(parsed))
            result["event_jsonld_blocks"] += bool(events)
            for e in events:
                result["candidate_events"].append({
                    "title": e["name"],
                    "startDate": e["startDate"],
                    "endDate": e.get("endDate"),
                    "url": e.get("url"),
                })
        result["candidate_count"] = len(result["candidate_events"])
        result["notes"] = "Discovery only; events are not imported or published."
    except requests.RequestException as exc:
        result["error"] = type(exc).__name__
    return result

if __name__ == "__main__":
    print(json.dumps([probe(name, url) for name, url in SOURCES.items()], ensure_ascii=False, indent=2))
