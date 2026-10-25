
#!/usr/bin/env python3
"""Local event collection for Sendero del Vino."""

import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "local_events.json"

SOURCES = [
    {
        "name": "Elk Grove",
        "region": "elk-grove",
        "status": "pending"
    },
    {
        "name": "Clarksburg",
        "region": "clarksburg",
        "status": "pending"
    },
    {
        "name": "Walnut Grove",
        "region": "walnut-grove",
        "status": "pending"
    }
]

def main():
    result = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "events": [],
        "sources": SOURCES
    }

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(
        json.dumps(result, indent=2),
        encoding="utf-8"
    )

    print("Local event collector initialized.")

if __name__ == "__main__":
    main()
