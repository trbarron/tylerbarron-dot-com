/**
 * "Check your town": searching the scored places, ZIPs and share links.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { findBySlug, findZip, isZip, percentile, placeSlug, searchPlaces } from '~/utils/pizza/towns';

// Biggest first, as the generator writes them: [name, state, lat, lng, score, stores].
type Row = [string, string, number, number, number | null, number];
const places: Row[] = [
  ['Springfield', 'IL', 39.8, -89.6, 1.9, 40],
  ['New Haven', 'CT', 41.3, -72.9, 4.19, 128],
  ['Newark', 'CA', 37.5, -122.0, 4.4, 80],
  ['New Canaan', 'CT', 41.1, -73.5, 4.5, 120],
  ['San Buenaventura (Ventura)', 'CA', 34.3, -119.3, 3.09, 100],
  ['Springfield', 'VT', 43.3, -72.5, null, 2],
  ['St. Louis', 'MO', 38.6, -90.2, 3.8, 90],
  ['Española', 'NM', 36.0, -106.1, 1.0, 12],
];
const labels = (q: string) => searchPlaces(places, q).map((t) => t.label);

describe('searchPlaces', () => {
  it('lists names that start with the query, biggest first', () => {
    expect(labels('spring')).toEqual(['Springfield, IL', 'Springfield, VT']);
  });

  it('finds a word inside a name', () => {
    expect(labels('ventura')).toEqual(['San Buenaventura (Ventura), CA']);
  });

  it('narrows to a state with a comma', () => {
    expect(labels('Springfield, VT')).toEqual(['Springfield, VT']);
  });

  it('reads two trailing letters as a state and as the start of a word', () => {
    // "new ca": California towns starting "new", and New Canaan.
    expect(labels('new ca')).toEqual(['Newark, CA', 'New Canaan, CT']);
  });

  it('ignores case, punctuation and accents', () => {
    expect(labels('st louis')).toEqual(['St. Louis, MO']);
    expect(labels('espanola')).toEqual(['Española, NM']);
  });

  it('waits for two characters', () => {
    expect(labels('n')).toEqual([]);
  });
});

describe('ZIPs and links', () => {
  const zips = {
    '06511': ['New Haven, CT', 41.3, -72.9, 4.19, 127] as [string, number, number, number, number],
    '99999': [null, 60, -150, null, 0] as [null, number, number, null, number],
  };

  it('labels a ZIP with its town, or just the ZIP when it has none', () => {
    expect(findZip(zips, '06511')).toMatchObject({ label: '06511 · New Haven, CT', slug: '06511', score: 4.19 });
    expect(findZip(zips, '99999')).toMatchObject({ label: 'ZIP 99999', score: null });
    expect(findZip(zips, '12345')).toBeNull();
  });

  it('makes stable, readable slugs', () => {
    expect(placeSlug('New Haven', 'CT')).toBe('new-haven-ct');
    expect(placeSlug('St. Louis', 'MO')).toBe('st-louis-mo');
    expect(placeSlug('Española', 'NM')).toBe('espanola-nm');
    expect(isZip('06511')).toBe(true);
    expect(isZip('6511')).toBe(false);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reopens a shared link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({ ok: true, json: async () => (url.includes('zips') ? zips : places) })),
    );
    expect((await findBySlug('new-haven-ct'))?.label).toBe('New Haven, CT');
    expect((await findBySlug('06511'))?.label).toBe('06511 · New Haven, CT');
    expect(await findBySlug('nowhere-zz')).toBeNull();
  });
});

describe('percentile', () => {
  it('is the score as a share of the country', () => {
    expect(percentile(4.19)).toBe(84);
    expect(percentile(2.5)).toBe(50);
    expect(percentile(0.05)).toBe(1);
  });
});
