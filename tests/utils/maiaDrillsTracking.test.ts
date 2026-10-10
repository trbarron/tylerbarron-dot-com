/**
 * Maia Drills GA events: what reaches gtag, and that usernames don't.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  trackAnalysisError,
  trackAnalysisStart,
  trackDeckBuilt,
  trackDrillAnswer,
  trackDrillStart,
} from '~/utils/maiaDrills/tracking';

function stubGtag() {
  const gtag = vi.fn();
  vi.stubGlobal('window', { gtag });
  return gtag;
}

afterEach(() => vi.unstubAllGlobals());

describe('Maia Drills tracking', () => {
  it('sends a built deck with its counts', () => {
    const gtag = stubGtag();
    trackDeckBuilt({ source: 'lichess', games: 50, cards: 12, backend: 'wasm', seconds: 300, stopped: false });
    expect(gtag).toHaveBeenCalledWith('event', 'maia_deck_built', {
      source: 'lichess',
      games: 50,
      cards: 12,
      backend: 'wasm',
      seconds: 300,
      stopped: false,
    });
  });

  it('keeps counts that mean different things in differently named params', () => {
    const gtag = stubGtag();
    trackAnalysisStart({ mode: 'build', source: 'lichess', gamesRequested: 200, handheld: true });
    trackDrillStart({ deckCards: 62 });
    expect(gtag.mock.calls[0][2]).toEqual({ mode: 'build', source: 'lichess', games_requested: 200, handheld: true });
    expect(gtag.mock.calls[1][2]).toEqual({ deck_cards: 62 });
  });

  it('reports a drill answer by verdict and whether it was the first try', () => {
    const gtag = stubGtag();
    trackDrillAnswer({ verdict: 'correct', firstTry: false, guesses: [{ uci: 'a2a3', san: 'a3' }, { uci: 'g7g6', san: 'g6' }] });
    expect(gtag).toHaveBeenCalledWith('event', 'maia_drill_answer', { verdict: 'correct', first_try: false, tries: 2 });
  });

  it('blanks quoted usernames out of error messages', () => {
    const gtag = stubGtag();
    trackAnalysisError({ mode: 'build', stage: 'fetching', error: 'No Lichess player named "someone".' });
    expect(gtag.mock.calls[0][2].error).toBe('No Lichess player named "…".');
  });

  it('does nothing without gtag (SSR, ad blockers)', () => {
    vi.stubGlobal('window', {});
    expect(() => trackDeckBuilt({ source: 'chesscom', games: 1, cards: 1, seconds: 1, stopped: false })).not.toThrow();
  });
});
