#!/usr/bin/env python3
"""Generate the pizza-map data files from the Google Places scrape.

Reads the SQLite database produced by the January 2025 Places scrape and writes
the two files PizzaScoringMap.tsx fetches:

- public/images/pizza/dominos-locations.json — one row per US Domino's
- public/images/pizza/pizza-network.json     — the smoothed Pizza Score grid
- public/images/pizza/pizza-places.json      — every US city, town and CDP, scored
- public/images/pizza/pizza-zips.json        — every US ZIP code, scored

The last two power "Check your town". Their locations come from the Census
Gazetteer (public domain), downloaded once into --census-dir.

The database lives outside the repo (it is 3.3 MB of raw scrape output and is
not a web asset). Pass its path explicitly:

    python3 scripts/generate-pizza-data.py --db ~/Desktop/assets/backup-tylerbarron-com/dominos_locations.db

Then commit the four JSON files. They are served from /images/pizza/* through
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


def smooth_stores(stores: list[dict]) -> dict[tuple[int, int], list[tuple]]:
    """Shrink each store's rating toward the national mean, binned by 1-degree buckets."""
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
    #
    # Binned into 1-degree buckets so each point only scans its neighbours.
    # RADIUS_KM is at most ~1.1 degrees of longitude at this latitude range, so
    # a +/-2 bucket window always covers the cutoff.
    buckets: dict[tuple[int, int], list[tuple]] = defaultdict(list)
    for s in stores:
        rating = (s["total_ratings"] * s["rating"] + PRIOR_REVIEWS * global_mean) / (
            s["total_ratings"] + PRIOR_REVIEWS
        )
        rec = (s["latitude"], s["longitude"], s["total_ratings"], rating)
        buckets[(int(math.floor(rec[0])), int(math.floor(rec[1])))].append(rec)
    return buckets


def local_mean(lat: float, lng: float, buckets) -> tuple[float | None, int, int]:
    """The smoothed Domino's rating at a point, and the stores and reviews it rests on.

    The one place the smoothing happens: grid cells and looked-up towns both
    come through here, so a town's score is exactly what the map would draw
    there. The mean is None below MIN_STORES.
    """
    blat, blng = int(math.floor(lat)), int(math.floor(lng))
    weighted_sum = weight_sum = 0.0
    count = reviews = 0
    for dlat in range(-2, 3):
        for dlng in range(-2, 3):
            for s_lat, s_lng, s_reviews, s_rating in buckets.get((blat + dlat, blng + dlng), ()):
                dist = haversine_km(lat, lng, s_lat, s_lng)
                if dist > RADIUS_KM:
                    continue
                count += 1
                reviews += s_reviews
                # Distance decay x review volume.
                w = math.exp(-((dist / TAU_KM) ** 2)) * s_reviews
                weighted_sum += w * s_rating
                weight_sum += w
    # Points with almost nothing nearby were once filled in from the single
    # nearest store and drawn at full confidence. They get no score instead.
    if count < MIN_STORES or weight_sum <= 0:
        return None, count, reviews
    return weighted_sum / weight_sum, count, reviews


def pizza_score(mean: float, scale: tuple[float, float]) -> float:
    """Standardize against the grid's cell means, then invert: a low local
    Domino's rating becomes a high Pizza Score. Also a percentile / 20."""
    centre, sd = scale
    return 5.0 * (1.0 - normal_cdf((mean - centre) / sd))


def build_grid(buckets) -> tuple[list[dict], tuple[float, float]]:
    """Smooth store ratings onto the grid and convert them to Pizza Scores.

    Also returns the (mean, sd) of the cell means: the national scale every
    score is read against, towns included.
    """
    cells = []
    for lat in frange(LAT_MIN, LAT_MAX, STEP):
        for lng in frange(LNG_MIN, LNG_MAX, STEP):
            mean, count, reviews = local_mean(lat, lng, buckets)
            if mean is None:
                continue
            cells.append({"latitude": lat, "longitude": lng, "_mean": mean, "stores": count, "reviews": reviews})

    if not cells:
        sys.exit(
            f"error: every grid cell was dropped (needs {MIN_STORES}+ stores within "
            f"{RADIUS_KM:.0f} km). Loosen MIN_STORES/RADIUS_KM or check the store filter."
        )

    centre = sum(c["_mean"] for c in cells) / len(cells)
    sd = math.sqrt(sum((c["_mean"] - centre) ** 2 for c in cells) / len(cells))
    scale = (centre, sd)

    grid = [
        {
            "latitude": round(c["latitude"], 2),
            "longitude": round(c["longitude"], 2),
            "pizza_score": round(pizza_score(c["_mean"], scale), 3),
            "stores": c["stores"],
            "reviews": c["reviews"],
        }
        for c in cells
    ]

    print(f"  cell rating mean {centre:.4f}, sd {sd:.4f}")
    return grid, scale


# ── Town lookup ─────────────────────────────────────────────────────────────
#
# "Check your town": every US city/town/CDP and ZIP code, scored at its
# location by local_mean(), so the page can look a town up without a geocoding
# service. Locations come from the Census Gazetteer (public domain), downloaded
# once into --census-dir.

GAZETTEER_YEAR = 2024
GAZETTEER_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/{year}_Gazetteer/{name}.zip"
# How much land each ZIP (ZCTA) shares with each place. Gazetteer "internal
# points" can land far from where people are: San Francisco's is out at the
# Farallon Islands, 50 km offshore. So a place is located by its ZIPs instead,
# and a ZIP is labelled with the place it overlaps most.
OVERLAP_NAME = "tab20_zcta520_place20_natl.txt"
OVERLAP_URL = f"https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/{OVERLAP_NAME}"

# The legal-status words the Census appends to place names: "Abbeville city",
# "Abanda CDP", "Nashville-Davidson metropolitan government (balance)".
PLACE_SUFFIX = re.compile(
    r"\s+(?:\(balance\)|city and borough|consolidated government|unified government"
    r"|metropolitan government|metro government|urban county|corporation|municipality"
    r"|township|borough|village|town|city|CDP|County|county)$"
)

# ZIPs outside the states the map covers: Puerto Rico, the Virgin Islands, Guam
# and the other Pacific territories.
TERRITORY_ZIP = re.compile(r"^(?:00[6-9]|96[6-9])")

# A ZIP is labelled with the nearest named place within this distance.
ZIP_LABEL_KM = 25.0


def gazetteer(census_dir: Path, kind: str) -> list[dict]:
    """Rows of the Census Gazetteer file `kind` ("zcta" or "place"), downloading it once."""
    import io
    import urllib.request
    import zipfile

    name = f"{GAZETTEER_YEAR}_Gaz_{kind}_national"
    txt = census_dir / f"{name}.txt"
    if not txt.exists():
        census_dir.mkdir(parents=True, exist_ok=True)
        url = GAZETTEER_URL.format(year=GAZETTEER_YEAR, name=name)
        print(f"  downloading {url}")
        with urllib.request.urlopen(url, timeout=60) as res:
            data = res.read()
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            txt.write_bytes(zf.read(f"{name}.txt"))
    lines = txt.read_text(encoding="utf-8").splitlines()
    header = [h.strip() for h in lines[0].split("\t")]
    return [dict(zip(header, (v.strip() for v in line.split("\t")))) for line in lines[1:] if line.strip()]


def zip_place_overlaps(census_dir: Path) -> list[tuple[str, str, float]]:
    """(zcta, place GEOID, shared land in m²) for every ZIP/place overlap, downloading once."""
    import urllib.request

    path = census_dir / OVERLAP_NAME
    if not path.exists():
        census_dir.mkdir(parents=True, exist_ok=True)
        print(f"  downloading {OVERLAP_URL}")
        with urllib.request.urlopen(OVERLAP_URL, timeout=120) as res:
            path.write_bytes(res.read())
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    header = lines[0].split("|")
    zi, pi, li = header.index("GEOID_ZCTA5_20"), header.index("GEOID_PLACE_20"), header.index("AREALAND_PART")
    out = []
    for line in lines[1:]:
        cols = line.split("|")
        if cols[zi] and cols[pi] and cols[li] and float(cols[li]) > 0:
            out.append((cols[zi], cols[pi], float(cols[li])))
    return out


def clean_place_name(name: str, state: str) -> str:
    while True:
        stripped = PLACE_SUFFIX.sub("", name)
        if stripped == name:
            break
        name = stripped
    # Massachusetts "town-cities" are named "Agawam Town city": the city's name is Agawam.
    if state == "MA" and name.endswith(" Town"):
        name = name[: -len(" Town")]
    return name


def scored(lat: float, lng: float, buckets, scale) -> tuple[float | None, int]:
    mean, count, _ = local_mean(lat, lng, buckets)
    return (None if mean is None else round(pizza_score(mean, scale), 2)), count


def build_towns(buckets, scale, census_dir: Path) -> tuple[list, dict]:
    """Places as [name, state, lat, lng, score|null, stores], biggest first;
    ZIPs as {zip: [label, lat, lng, score|null, stores]}."""
    zctas = {
        row["GEOID"]: (float(row["INTPTLAT"]), float(row["INTPTLONG"]))
        for row in gazetteer(census_dir, "zcta")
        if not TERRITORY_ZIP.match(row["GEOID"])
    }
    overlaps = zip_place_overlaps(census_dir)

    # A place's location: its ZIPs' points, weighted by the land each shares
    # with it. Falls back to the Gazetteer's internal point.
    sums: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    for zcta, geoid, land in overlaps:
        if zcta in zctas:
            acc = sums[geoid]
            acc[0] += zctas[zcta][0] * land
            acc[1] += zctas[zcta][1] * land
            acc[2] += land

    places: dict[tuple[str, str], tuple[float, float, float]] = {}
    labels: dict[str, str] = {}
    for row in gazetteer(census_dir, "place"):
        if row["USPS"] not in US_STATES:
            continue
        name = clean_place_name(row["NAME"], row["USPS"])
        key = (name, row["USPS"])
        labels[row["GEOID"]] = f"{name}, {row['USPS']}"
        land = float(row["ALAND"])
        acc = sums.get(row["GEOID"])
        lat, lng = (acc[0] / acc[2], acc[1] / acc[2]) if acc and acc[2] else (float(row["INTPTLAT"]), float(row["INTPTLONG"]))
        # A city and a CDP can share a name in one state: keep the bigger.
        if key not in places or land > places[key][2]:
            places[key] = (lat, lng, land)

    # A ZIP's label: the place it shares the most land with.
    zip_label: dict[str, tuple[str, float]] = {}
    for zcta, geoid, land in overlaps:
        if geoid in labels and land > zip_label.get(zcta, ("", 0.0))[1]:
            zip_label[zcta] = (labels[geoid], land)

    # Biggest first, so a prefix search lists Springfield, IL before Springfield, VT.
    ordered = sorted(places.items(), key=lambda kv: -kv[1][2])
    place_rows = []
    label_buckets: dict[tuple[int, int], list[tuple]] = defaultdict(list)
    for (name, state), (lat, lng, land) in ordered:
        score, count = scored(lat, lng, buckets, scale)
        place_rows.append([name, state, round(lat, 3), round(lng, 3), score, count])
        # Its rough radius, from its land area as if it were a circle.
        radius_km = math.sqrt(land / math.pi) / 1000
        label_buckets[(int(math.floor(lat)), int(math.floor(lng)))].append((lat, lng, radius_km, f"{name}, {state}"))

    def nearest_label(lat: float, lng: float) -> str | None:
        """The nearest place, measured to its rough edge rather than its centre."""
        best, best_km = None, ZIP_LABEL_KM
        for dlat in (-1, 0, 1):
            for dlng in (-1, 0, 1):
                key = (int(math.floor(lat)) + dlat, int(math.floor(lng)) + dlng)
                for p_lat, p_lng, radius_km, label in label_buckets.get(key, ()):
                    d = haversine_km(lat, lng, p_lat, p_lng) - radius_km
                    if d < best_km:
                        best, best_km = label, d
        return best

    zips = {}
    for zcta, (lat, lng) in zctas.items():
        score, count = scored(lat, lng, buckets, scale)
        # Rural ZIPs overlap no place: name them for the nearest one instead.
        label = zip_label[zcta][0] if zcta in zip_label else nearest_label(lat, lng)
        zips[zcta] = [label, round(lat, 3), round(lng, 3), score, count]

    return place_rows, zips


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
    parser.add_argument(
        "--census-dir",
        type=Path,
        default=Path.home() / ".cache" / "tylerbarron-pizza",
        help="where the Census Gazetteer files are cached (downloaded on first run)",
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
    buckets = smooth_stores(stores)
    grid, scale = build_grid(buckets)
    print(f"  {len(grid)} cells")

    print("scoring towns")
    places, zips = build_towns(buckets, scale, args.census_dir)
    print(f"  {len(places)} places ({sum(p[4] is not None for p in places)} scored)")
    print(f"  {len(zips)} ZIP codes ({sum(z[3] is not None for z in zips.values())} scored)")

    write_json(OUT_DIR / "dominos-locations.json", stores)
    write_json(OUT_DIR / "pizza-network.json", grid)
    write_json(OUT_DIR / "pizza-places.json", places)
    write_json(OUT_DIR / "pizza-zips.json", zips)


if __name__ == "__main__":
    main()
