/**
 * Maia Drills: the pure pieces of the pipeline. The Maia encoding was also
 * checked against the real ONNX model (see docs/maia-drills.md); these tests
 * pin the parts that model check relied on.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Chess } from 'chess.js';
import {
  MAIA_MOVE_VOCAB,
  decodePolicy,
  mirrorUci,
  vocabIndex,
  vocabMove,
  writeTokens,
} from '~/utils/maiaDrills/maiaEncoding';
import { parseCandidateScores } from '~/utils/maiaDrills/stockfishPool';
import { speedFromTimeControl } from '~/utils/maiaDrills/gameSources';
import { clampElo, userMoves } from '~/utils/maiaDrills/analyze';
import { validateDeck } from '~/utils/maiaDrills/decks.server';
import { isHandheld } from '~/utils/maiaDrills/device';
import type { DrillCard, SourceGame } from '~/utils/maiaDrills/types';

vi.mock('~/utils/redis.server', () => ({ getRedisClient: vi.fn() }));
// stockfishPool imports the worker factory; nothing here constructs a worker.
vi.mock('~/utils/multipleChoiceChess/stockfishEngine', () => ({ createStockfishWorker: vi.fn() }));

describe('maiaEncoding', () => {
  it('round-trips every vocabulary index', () => {
    for (let i = 0; i < MAIA_MOVE_VOCAB; i++) {
      expect(vocabIndex(vocabMove(i))).toBe(i);
    }
  });

  it('orders plain moves from-major and promotions q,r,b,n', () => {
    expect(vocabIndex('a1b1')).toBe(1);
    expect(vocabIndex('e2e4')).toBe(12 * 64 + 28);
    expect(vocabMove(4096)).toBe('a7a8q');
    expect(vocabMove(4099)).toBe('a7a8n');
    expect(vocabMove(4351)).toBe('h7h8n');
  });

  it('places white pieces from white’s side', () => {
    const tokens = new Float32Array(64 * 12);
    writeTokens('4k3/8/8/8/8/8/8/4K3 w - - 0 1', tokens);
    expect(tokens[4 * 12 + 5]).toBe(1); // e1, white king
    expect(tokens[60 * 12 + 11]).toBe(1); // e8, black king
    expect(tokens.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('mirrors and swaps colors when black is to move', () => {
    const tokens = new Float32Array(64 * 12);
    // Black king e8 becomes the mover's king on e1.
    writeTokens('4k3/8/8/8/8/8/8/4K3 b - - 0 1', tokens);
    expect(tokens[4 * 12 + 5]).toBe(1);
    expect(tokens[60 * 12 + 11]).toBe(1);
  });

  it('decodes black moves back into real coordinates', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const logits = new Float32Array(MAIA_MOVE_VOCAB).fill(-10);
    // In the mirrored frame, …e5 is e2e4.
    logits[vocabIndex(mirrorUci('e7e5'))] = 5;
    const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to);
    const policy = decodePolicy(logits, 0, fen, legal);
    expect(policy[0].uci).toBe('e7e5');
    expect(policy.reduce((a, m) => a + m.prob, 0)).toBeCloseTo(1, 5);
  });
});

describe('parseCandidateScores', () => {
  it('keeps the deepest score per root move and clamps mates', () => {
    const scores = parseCandidateScores([
      'info depth 1 seldepth 1 multipv 1 score cp 20 nodes 20 pv e2e4',
      'info depth 1 seldepth 1 multipv 2 score cp 5 nodes 20 pv a2a3',
      'info depth 9 seldepth 12 multipv 1 score cp 35 nodes 900 pv e2e4 e7e5',
      'info depth 9 seldepth 12 multipv 2 score mate -3 nodes 900 pv a2a3 d8h4',
      'info depth 10 currmove e2e4 currmovenumber 1',
      'info depth 10 seldepth 14 multipv 1 score cp 60 upperbound nodes 1200 pv e2e4',
    ]);
    expect(scores.get('e2e4')).toBe(35);
    expect(scores.get('a2a3')).toBe(-1000);
  });

  it('clamps large centipawn scores', () => {
    const scores = parseCandidateScores(['info depth 5 multipv 1 score cp 2400 pv d1h5']);
    expect(scores.get('d1h5')).toBe(1000);
  });
});

describe('gameSources', () => {
  it('buckets time controls like Lichess', () => {
    expect(speedFromTimeControl('60+0')).toBe('bullet');
    expect(speedFromTimeControl('180+2')).toBe('blitz');
    expect(speedFromTimeControl('600+0')).toBe('rapid');
    expect(speedFromTimeControl('1800+0')).toBe('classical');
    expect(speedFromTimeControl('1/86400')).toBe('correspondence');
    expect(speedFromTimeControl(undefined)).toBe('unknown');
  });
});

describe('analyze helpers', () => {
  const game: SourceGame = {
    id: 'g1',
    white: 'me',
    black: 'them',
    whiteElo: 1500,
    blackElo: 1500,
    userColor: 'b',
    speed: 'blitz',
    san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'],
  };

  it('collects only the user’s moves, with the position before each', () => {
    const moves = userMoves(game, 0);
    expect(moves.map((m) => m.played.san)).toEqual(['e5', 'Nc6', 'a6']);
    expect(moves[0].fen.split(' ')[1]).toBe('b');
    expect(moves[0].played.uci).toBe('e7e5');
  });

  it('skips moves before the given move number', () => {
    expect(userMoves(game, 2).map((m) => m.played.san)).toEqual(['a6']);
  });

  it('stops cleanly at a corrupt move', () => {
    expect(userMoves({ ...game, san: ['e4', 'e5', 'Qxf7??', 'Nc6'] }, 0)).toHaveLength(1);
  });

  it('clamps ratings to Maia’s range', () => {
    expect(clampElo(400)).toBe(600);
    expect(clampElo(3000)).toBe(2600);
    expect(clampElo(1712.4)).toBe(1712);
  });
});

describe('validateDeck', () => {
  const card: DrillCard = {
    id: 'abc123-14',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    ply: 4,
    color: 'w',
    played: { uci: 'a2a3', san: 'a3' },
    target: { uci: 'f1b5', san: 'Bb5', prob: 0.41 },
    evalPlayed: 10,
    evalTarget: 45,
    userElo: 1500,
    targetElo: 1700,
    oppElo: 1480,
    opponent: 'them',
    gameUrl: 'https://lichess.org/abc123',
    speed: 'blitz',
  };
  const deck = {
    source: 'lichess',
    username: 'Tyler',
    settings: { delta: 200, thresholdCp: 150, depth: 12, skipMoves: 0 },
    stats: { games: 1, positions: 30, disagreements: 12 },
    cards: [card],
  };

  it('accepts a well-formed deck and lower-cases the username', () => {
    const result = validateDeck(deck);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.username).toBe('tyler');
      expect(result.value.cards[0]).toEqual(card);
    }
  });

  it('drops unknown keys on cards', () => {
    const result = validateDeck({ ...deck, cards: [{ ...card, extra: 'x' }] });
    expect(result.ok && 'extra' in result.value.cards[0]).toBe(false);
  });

  it.each([
    ['an unsupported source', { ...deck, source: 'pgn' }],
    ['no cards', { ...deck, cards: [] }],
    ['settings out of range', { ...deck, settings: { ...deck.settings, depth: 40 } }],
    ['bad fen', { ...deck, cards: [{ ...card, fen: 'not a fen' }] }],
    ['bad uci', { ...deck, cards: [{ ...card, played: { uci: 'z9z9', san: 'a3' } }] }],
    ['non-https link', { ...deck, cards: [{ ...card, gameUrl: 'javascript:alert(1)' }] }],
    ['duplicate ids', { ...deck, cards: [card, card] }],
    ['too many cards', { ...deck, cards: Array.from({ length: 401 }, (_, i) => ({ ...card, id: `g-${i}` })) }],
  ])('rejects %s', (_label, body) => {
    expect(validateDeck(body).ok).toBe(false);
  });
});

describe('isHandheld', () => {
  afterEach(() => vi.unstubAllGlobals());

  function device(userAgent: string, { touchPoints = 0, coarse = false } = {}) {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints: touchPoints });
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: coarse && q === '(pointer: coarse)' }));
  }

  it('catches phones and tablets, whatever the browser', () => {
    device('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 CriOS/141.0 Mobile/15E148');
    expect(isHandheld()).toBe(true);
    device('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36');
    expect(isHandheld()).toBe(true);
    // iPadOS Safari calls itself a Mac; the touch screen gives it away.
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', { touchPoints: 5 });
    expect(isHandheld()).toBe(true);
    device('Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/143.0', { coarse: true });
    expect(isHandheld()).toBe(true);
  });

  it('leaves computers alone', () => {
    device('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36');
    expect(isHandheld()).toBe(false);
    device('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0', { touchPoints: 10 });
    expect(isHandheld()).toBe(false);
  });
});
