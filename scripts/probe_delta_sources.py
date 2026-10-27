"""Read-only diagnostics for potential Delta winery event sources.

This intentionally does not publish events. Only confirmed, future, structured
Event records can be considered for a later importer.
"""
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

SOURCES = {
    "old_sugar_mill": "https://oldsugarmill.com/events-calendar/",
    "grand_island_vineyards": "https://www.grandislandvineyards.com/collection/events",
    "oak_farm_vineyards": "https://www.oakfarmvineyards.com/upcoming-events/",
    "sacramento365": "https://sacramento365.com/event/",
    "visit_lodi": "https://visitlodi.com/events/",
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
        # Discover likely event detail links and embedded calendar providers.
        # This is diagnostic only: no links are followed or published.
        links = []
        seen = set()
        for anchor in soup.select("a[href]"):
            href = urljoin(url, anchor.get("href", ""))
            parsed_link = urlparse(href)
            if parsed_link.scheme not in ("http", "https"):
                continue
            title = anchor.get_text(" ", strip=True)[:100]
            hint = (title + " " + parsed_link.path).lower()
            if not re.search(r"event|wine|winery|tasting|festival|calendar|music", hint):
                continue
            canonical = href.split("#")[0]
            if canonical not in seen:
                seen.add(canonical)
                links.append({"title": title, "url": canonical})
            if len(links) >= 35:
                break
        result["likely_event_links"] = links
        embeds = []
        for tag in soup.select("iframe[src], script[src]"):
            src = urljoin(url, tag.get("src", ""))
            if re.search(r"event|calendar|ticket|obtainwine|algolia|artsopolis", src, re.I):
                embeds.append(src.split("?")[0])
        result["calendar_embed_hints"] = list(dict.fromkeys(embeds))[:20]
        result["html_event_keyword_count"] = len(re.findall(r"\\b(?:wine tasting|wine event|winery event)\\b", soup.get_text(" ", strip=True), re.I))
        result["notes"] = "Discovery only; events are not imported or published."
    except requests.RequestException as exc:
        result["error"] = type(exc).__name__
    return result

if __name__ == "__main__":
    print(json.dumps([probe(name, url) for name, url in SOURCES.items()], ensure_ascii=False, indent=2))
