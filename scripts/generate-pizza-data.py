#!/usr/bin/env python3
"""Generate the pizza-map data files from the Google Places scrape.

Reads the SQLite database produced by the January 2025 Places scrape and writes
the two files PizzaScoringMap.tsx fetches:

- public/images/pizza/dominos-locations.json — one row per US Domino's
- public/images/pizza/pizza-network.json     — the smoothed Pizza Score grid

The database lives outside the repo (it is 3.3 MB of raw scrape output and is
not a web asset). Pass its path explicitly:

    python3 scripts/generate-pizza-data.py --db ~/Desktop/assets/backup-tylerbarron-com/dominos_locations.db

Then commit the two JSON files. They are served from /images/pizza/* through
CloudFront, so they are gzip/brotli compressed at the edge and same-origin with
the site (the bucket sends no CORS headers, and the map uses fetch()).

Stdlib only, like generate-og-image.py's siblings — run it, commit the output.

## What the Pizza Score means

The thesis: Domino's is standardized nationwide, so regional variation in its
Google rating reflects the local competition rather than the pizza. Where
Domino's rates poorly, local pizzerias are assumed to be good.

The score inverts a *locally smoothed* Domino's rating and expresses it as a
percentile: score = 5 * (1 - Phi(z)), where z standardizes a cell's smoothed
rating against the distribution of all cell ratings. So 4.0 does not mean "4
stars of pizza" — it means "this area's Domino's rate lower than ~80% of the
country's". The spread it is stretched across is small (sigma is well under
half a star), which is why the rendered map should not be read as a claim about
absolute quality.
"""

import argparse
import json
import math
import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "public" / "images" / "pizza"

# Grid covering the continental US, matching the original 0.55-degree spacing.
LAT_MIN, LAT_MAX = 25.0, 49.75
LNG_MIN, LNG_MAX = -125.0, -65.05
STEP = 0.55

# Smoothing. A radius in kilometres rather than degrees: a degree of longitude
# is 101 km in south Texas but only 73 km at the Canadian border, so a radius in
# raw degrees silently narrows the window as you go north.
RADIUS_KM = 110.0     # hard cutoff
TAU_KM = 55.0         # Gaussian bandwidth
MIN_STORES = 3        # cells backed by fewer are dropped rather than drawn

# Bayesian shrinkage toward the national mean, in units of reviews. A store with
# 12 reviews should not move a cell as much as one with 2,000; this pulls
# low-volume ratings toward the global mean in proportion to their thinness.
PRIOR_REVIEWS = 50.0

EARTH_RADIUS_KM = 6371.0

# The 50 states plus DC. The original data set filtered "continental US" with a
# lat/lng box, which contains southern Ontario, Quebec and New Brunswick —
# Canadian Domino's average about half a star higher, and because the score
# inverts, that rendered the Buffalo/Niagara/Detroit corridor as the worst pizza
# region in the country. Filter on the state field instead.
US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
    "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY", "DC",
}

# Places returns more than storefronts for a "Domino's" search: ATMs inside
# them, the parking lot, bus stops named after one, corporate offices, supply
# chain depots. None of these have a pizza rating worth mapping.
JUNK_POI = re.compile(
    r"atm|parking|office|supply\s*chain|distribution|c-store|club|franchise"
    r"|future|machine|\bat\b.*domino|domino.*\b(?:center|centre)\b",
    re.IGNORECASE,
)


def is_dominos(name: str) -> bool:
    """True for a Domino's storefront.

    The original export matched name == "Domino's Pizza" exactly, which dropped
    roughly 120 US stores over punctuation and casing alone: "Domino's",
    "Dominos Pizza", "Domino's pizza", the curly-apostrophe "Domino's Pizza",
    and per-store names like "Domino's Pizza - Rainsville, AL".
    """
    normalized = re.sub(r"[^a-z]", "", name.lower().replace("’", "'"))
    if not normalized.startswith("domino"):
        return False
    return not JUNK_POI.search(name)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, a)))


def normal_cdf(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def frange(start: float, stop: float, step: float) -> list[float]:
    out, i = [], 0
    while True:
        v = start + i * step
        if v > stop + 1e-9:
            return out
        out.append(round(v, 10))
        i += 1


def load_stores(db_path: Path) -> tuple[list[dict], dict[str, int]]:
    """Read the scrape and return the mappable US Domino's, plus a reject tally."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT name, latitude, longitude, rating, total_ratings, state, is_operational "
        "FROM locations"
    ).fetchall()
    conn.close()

    stores: list[dict] = []
    rejected = defaultdict(int)

    for row in rows:
        if not is_dominos(row["name"]):
            rejected["not a Domino's storefront"] += 1
            continue
        if row["state"] not in US_STATES:
            rejected["outside the US"] += 1
            continue
        if not row["rating"] or row["rating"] <= 0 or not row["total_ratings"]:
            rejected["unrated"] += 1
            continue
        if not row["is_operational"]:
            rejected["permanently closed"] += 1
            continue
        if row["latitude"] is None or row["longitude"] is None:
            rejected["no coordinates"] += 1
            continue

        stores.append(
            {
                "latitude": round(row["latitude"], 5),
                "longitude": round(row["longitude"], 5),
                "rating": row["rating"],
                "total_ratings": row["total_ratings"],
                "state": row["state"],
            }
        )

    return stores, dict(rejected)


def build_grid(stores: list[dict]) -> list[dict]:
    """Smooth store ratings onto the grid and convert them to Pizza Scores."""
    total_reviews = sum(s["total_ratings"] for s in stores)
    if not total_reviews:
        sys.exit(
            "error: no rated stores survived filtering — nothing to build a grid from.\n"
            "Check that --db points at the Places scrape and that its `name`/`state` "
            "columns still match the filters in load_stores()."
        )
    global_mean = sum(s["rating"] * s["total_ratings"] for s in stores) / total_reviews

    # Shrink each store's rating toward the national mean by its review count.
    # Kept alongside the store rather than on it, so the published rows stay
    # exactly what was scraped.
    smoothed = [
        (
            s["latitude"],
            s["longitude"],
            s["total_ratings"],
            (s["total_ratings"] * s["rating"] + PRIOR_REVIEWS * global_mean)
            / (s["total_ratings"] + PRIOR_REVIEWS),
        )
        for s in stores
    ]

    # Bin stores into 1-degree buckets so each cell only scans its neighbours.
    # RADIUS_KM is at most ~1.1 degrees of longitude at this latitude range, so
    # a +/-2 bucket window always covers the cutoff.
    buckets: dict[tuple[int, int], list[tuple]] = defaultdict(list)
    for rec in smoothed:
        buckets[(int(math.floor(rec[0])), int(math.floor(rec[1])))].append(rec)

    cells = []
    for lat in frange(LAT_MIN, LAT_MAX, STEP):
        for lng in frange(LNG_MIN, LNG_MAX, STEP):
            blat, blng = int(math.floor(lat)), int(math.floor(lng))
            weighted_sum = weight_sum = 0.0
            count = reviews = 0

            for dlat in range(-2, 3):
                for dlng in range(-2, 3):
                    for s_lat, s_lng, s_reviews, s_rating in buckets.get(
                        (blat + dlat, blng + dlng), ()
                    ):
                        dist = haversine_km(lat, lng, s_lat, s_lng)
                        if dist > RADIUS_KM:
                            continue
                        count += 1
                        reviews += s_reviews
                        # Distance decay x review volume.
                        w = math.exp(-((dist / TAU_KM) ** 2)) * s_reviews
                        weighted_sum += w * s_rating
                        weight_sum += w

            # Cells with almost nothing nearby were previously filled in from the
            # single nearest store and drawn at full confidence. Drop them.
            if count < MIN_STORES or weight_sum <= 0:
                continue

            cells.append(
                {
                    "latitude": lat,
                    "longitude": lng,
                    "_mean": weighted_sum / weight_sum,
                    "stores": count,
                    "reviews": reviews,
                }
            )

    if not cells:
        sys.exit(
            f"error: every grid cell was dropped (needs {MIN_STORES}+ stores within "
            f"{RADIUS_KM:.0f} km). Loosen MIN_STORES/RADIUS_KM or check the store filter."
        )

    # Standardize against the distribution of cell means, then invert: a low
    # local Domino's rating becomes a high Pizza Score.
    mean = sum(c["_mean"] for c in cells) / len(cells)
    variance = sum((c["_mean"] - mean) ** 2 for c in cells) / len(cells)
    sd = math.sqrt(variance)

    grid = []
    for c in cells:
        score = 5.0 * (1.0 - normal_cdf((c["_mean"] - mean) / sd))
        grid.append(
            {
                "latitude": round(c["latitude"], 2),
                "longitude": round(c["longitude"], 2),
                "pizza_score": round(score, 3),
                "stores": c["stores"],
                "reviews": c["reviews"],
            }
        )

    print(f"  cell rating mean {mean:.4f}, sd {sd:.4f}")
    return grid


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"  wrote {path.relative_to(REPO_ROOT)} ({path.stat().st_size:,} bytes)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db",
        required=True,
        type=Path,
        help="path to dominos_locations.db (the raw Places scrape, kept outside the repo)",
    )
    args = parser.parse_args()

    if not args.db.exists():
        sys.exit(f"error: no database at {args.db}")

    print(f"reading {args.db}")
    stores, rejected = load_stores(args.db)
    for reason, n in sorted(rejected.items(), key=lambda kv: -kv[1]):
        print(f"  skipped {n:>5}  {reason}")
    print(f"  kept    {len(stores):>5}  US Domino's storefronts")

    print("building grid")
    grid = build_grid(stores)
    print(f"  {len(grid)} cells")

    write_json(OUT_DIR / "dominos-locations.json", stores)
    write_json(OUT_DIR / "pizza-network.json", grid)


if __name__ == "__main__":
    main()
