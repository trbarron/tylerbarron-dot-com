// "Check your town": look up a US city, town or ZIP code's Pizza Score.
//
// Every place and ZIP is scored ahead of time by scripts/generate-pizza-data.py,
// with the same smoothing the map's grid uses, so a town's score is what the
// map would draw there. The two indexes are static files on the CDN, fetched
// only when someone searches (each is ~400 KB compressed), so there's no
// geocoding service and nothing to pay for per lookup.

const PLACES_URL = '/images/pizza/pizza-places.json';
const ZIPS_URL = '/images/pizza/pizza-zips.json';

/** [name, state, lat, lng, score | null, stores], biggest place first. */
type PlaceRow = [string, string, number, number, number | null, number];
/** zip → [label | null, lat, lng, score | null, stores]. */
type ZipRows = Record<string, [string | null, number, number, number | null, number]>;

export interface Town {
  /** "New Haven, CT", or "06511 · New Haven, CT" for a ZIP. */
  label: string;
  /** The URL value that reopens it: `new-haven-ct` or `06511`. */
  slug: string;
  latitude: number;
  longitude: number;
  /** Null when fewer than 3 Domino's are within the smoothing radius. */
  score: number | null;
  /** Domino's within the smoothing radius: what the score rests on. */
  stores: number;
}

/** Smoothing radius the scores use (RADIUS_KM in the generator). */
export const RADIUS_KM = 110;
/** Fewest stores a score is drawn from (MIN_STORES in the generator). */
export const MIN_STORES = 3;

export const isZip = (query: string) => /^\d{5}$/.test(query.trim());

/** `New Haven`, `CT` → `new-haven-ct`. */
export function placeSlug(name: string, state: string): string {
  return `${name}-${state}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function placeTown([name, state, lat, lng, score, stores]: PlaceRow): Town {
  return { label: `${name}, ${state}`, slug: placeSlug(name, state), latitude: lat, longitude: lng, score, stores };
}

function zipTown(zip: string, [label, lat, lng, score, stores]: ZipRows[string]): Town {
  return { label: label ? `${zip} · ${label}` : `ZIP ${zip}`, slug: zip, latitude: lat, longitude: lng, score, stores };
}

const cache: { places?: Promise<PlaceRow[]>; zips?: Promise<ZipRows> } = {};

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Couldn't load ${url}`);
    return res.json() as Promise<T>;
  });
}

/** The places index, fetched once. A failed fetch isn't cached, so a retry can work. */
export function loadPlaces(): Promise<PlaceRow[]> {
  cache.places ??= fetchJson<PlaceRow[]>(PLACES_URL).catch((error) => {
    delete cache.places;
    throw error;
  });
  return cache.places;
}

export function loadZips(): Promise<ZipRows> {
  cache.zips ??= fetchJson<ZipRows>(ZIPS_URL).catch((error) => {
    delete cache.zips;
    throw error;
  });
  return cache.zips;
}

/** Lowercase, accents and punctuation off: "St. Louis" and "st louis" match. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const STATES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(
    ' ',
  ),
);

/** Names that start with `q`, then names with a word that does, in index order (biggest first). */
function matching(places: PlaceRow[], q: string, state: string | null, limit: number): PlaceRow[] {
  const starts: PlaceRow[] = [];
  const words: PlaceRow[] = [];
  for (const row of places) {
    if (state && row[1] !== state) continue;
    const name = normalize(row[0]);
    if (name.startsWith(q)) {
      starts.push(row);
      if (starts.length >= limit) break;
    } else if (words.length < limit && name.includes(` ${q}`)) words.push(row);
  }
  return [...starts, ...words].slice(0, limit);
}

/**
 * Places matching what's typed, best first: names that start with it, then
 * names with a word that does ("ventura" finds "San Buenaventura (Ventura)").
 * A trailing state narrows it: "Springfield, IL" or "springfield il". Without
 * a comma the two letters might still be the start of a word ("new ca" is New
 * Canaan as much as a California town), so both readings are listed.
 */
export function searchPlaces(places: PlaceRow[], query: string, limit = 8): Town[] {
  const q = normalize(query);
  const withState = /^(.*\S)\s+([a-z]{2})$/.exec(q);
  const state = withState && STATES.has(withState[2].toUpperCase()) ? withState[2].toUpperCase() : null;

  const results: PlaceRow[] = [];
  if (state && withState) results.push(...matching(places, withState[1], state, limit));
  if (!(state && query.includes(',')) && q.length >= 2) {
    for (const row of matching(places, q, null, limit)) if (!results.includes(row)) results.push(row);
  }
  return results.slice(0, limit).map(placeTown);
}

export function findZip(zips: ZipRows, zip: string): Town | null {
  const row = zips[zip.trim()];
  return row ? zipTown(zip.trim(), row) : null;
}

/** The town a shared link names: a ZIP, or a place slug. */
export async function findBySlug(slug: string): Promise<Town | null> {
  if (isZip(slug)) return findZip(await loadZips(), slug);
  const row = (await loadPlaces()).find((p) => placeSlug(p[0], p[1]) === slug);
  return row ? placeTown(row) : null;
}

/**
 * The score as a percentile. The score is 5 × (1 − Φ(z)) over the grid's
 * cells, so score × 20 is the share of the country where Domino's rates
 * better than here.
 */
export const percentile = (score: number) => Math.round(score * 20);
