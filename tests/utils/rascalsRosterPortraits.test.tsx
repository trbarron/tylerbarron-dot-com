import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Roster from '../../app/components/RunescapeRascals/Roster';
import type { Bot } from '../../app/utils/runescapeRascals/types';

const bot = {
  name: 'bram',
  totalLevel: 387,
  action: 'mine (iron)',
  location: 'Varrock',
  shotAt: 0,
  portraitVersion: 'current-look',
  portraitAngles: 16,
} as Bot;
const portraits = (html: string) =>
  [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));

it('roster thumbnails use both current bucket portraits instead of unavailable Redis images', () => {
  const sources = portraits(renderToStaticMarkup(<Roster bots={[bot]} now={0} assetBase="/images/rascals-live" />));
  expect(sources).toEqual([
    '/images/rascals-live/portraits/bram/head-0-current-look.png',
    '/images/rascals-live/portraits/bram/body-0-current-look.png',
  ]);
});
it('older publishers still use Redis portrait endpoints', () => {
  expect(portraits(renderToStaticMarkup(<Roster bots={[bot]} now={0} />))).toEqual([
    '/api/runescapeRascals/portrait/bram/head?v=current-look',
    '/api/runescapeRascals/portrait/bram/body?v=current-look',
  ]);
});
it('an absent appearance version keeps bundled portraits available', () => {
  const noVersion = { ...bot, portraitVersion: undefined };
  expect(
    portraits(renderToStaticMarkup(<Roster bots={[noVersion]} now={0} assetBase="/images/rascals-live" />)),
  ).toEqual(['/images/runescape-rascals/portraits/bram-head.png', '/images/runescape-rascals/portraits/bram-body.png']);
});
