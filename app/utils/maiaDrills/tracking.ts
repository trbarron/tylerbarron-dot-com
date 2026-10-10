// GA4 events for Maia Drills, all in one place so the names and params stay
// consistent. No usernames: error messages that quote one have it blanked.
//
// Counts per event work out of the box. To sum or split by a param in GA's
// reports, register it in the property (Admin → Custom definitions), all with
// event scope: metrics `cards`, `games`, `seconds` (and optionally
// `games_requested`, `deck_cards`, `tries`); dimensions `mode`, `source`,
// `backend`, `stage`, `verdict`, `first_try`, `handheld`, `favorite`,
// `stopped`, `error`. A param name means one thing everywhere, so a metric
// summed across events never mixes, say, cards found with deck sizes.

import { trackEvent } from '~/utils/analytics';
import type { Answer } from './drill';
import type { GameSource } from './types';

type Mode = 'build' | 'add';

export function trackAnalysisStart(p: { mode: Mode; source: GameSource; gamesRequested: number; handheld: boolean }) {
  trackEvent('maia_analysis_start', { mode: p.mode, source: p.source, games_requested: p.gamesRequested, handheld: p.handheld });
}

/** A run that ended in an error (including "no games" and "no errors found"). */
export function trackAnalysisError(p: { mode: Mode; stage: string; backend?: string; error: string }) {
  trackEvent('maia_analysis_error', { ...p, error: p.error.replace(/"[^"]*"/g, '"…"').slice(0, 100) });
}

/** Cancelled before anything was saved. A stopped run that saved cards reports as built or added. */
export function trackAnalysisCancel(p: { mode: Mode; stage: string }) {
  trackEvent('maia_analysis_cancel', p);
}

export function trackDeckBuilt(p: {
  source: GameSource;
  games: number;
  cards: number;
  backend?: string;
  seconds: number;
  stopped: boolean;
}) {
  trackEvent('maia_deck_built', p);
}

export function trackGamesAdded(p: { source: GameSource; games: number; cards: number; backend?: string; seconds: number }) {
  trackEvent('maia_games_added', p);
}

export function trackDrillStart(p: { deckCards: number }) {
  trackEvent('maia_drill_start', { deck_cards: p.deckCards });
}

export function trackDrillAnswer(answer: Answer) {
  trackEvent('maia_drill_answer', {
    verdict: answer.verdict,
    first_try: answer.firstTry,
    tries: answer.guesses.length,
  });
}

export function trackFavorite(favorite: boolean) {
  trackEvent('maia_deck_favorite', { favorite });
}
