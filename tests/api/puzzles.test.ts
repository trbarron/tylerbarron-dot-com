/**
 * Tests for /api/chesserGuesser/puzzles route
 * Tests daily puzzle generation, caching, and rotation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DailyPuzzleSet } from '~/utils/chesserGuesser/types';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

// Mock fetch for puzzle fetching
global.fetch = vi.fn();

describe('Daily Puzzles API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/chesserGuesser/puzzles', () => {
    it('should return cached puzzles if available', async () => {
      const cachedPuzzles: DailyPuzzleSet = {
        date: '2024-01-15',
        puzzles: [
          { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', eval: 100 },
          { fen: 'r1bqkbnr/pppppppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 1 2', eval: -50 },
          { fen: '8/8/8/4k3/8/8/4K3/8 w - - 0 1', eval: 0 },
          { fen: '8/8/8/8/8/4k3/8/4K3 w - - 0 1', eval: 300 },
        ],
        seed: 20240115,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPuzzles));

      const response = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');

      expect(mockRedis.get).toHaveBeenCalledWith('chesserGuesser:dailyPuzzles:2024-01-15');
      expect(response.status).toBe(200);
    });

    it('should generate and cache new puzzles if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);

      // Mock 4 puzzle fetches
      const mockPuzzleResponse = {
        ok: true,
        json: async () => ({
          body: JSON.stringify({
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            eval: '100',
          }),
        }),
      };

      (global.fetch as any).mockResolvedValue(mockPuzzleResponse);

      const response = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chesserGuesser:dailyPuzzles:2024-01-15',
        7 * 24 * 60 * 60,
        expect.any(String)
      );
    });

    it('should reject invalid date format', async () => {
      const response = await fetch('/api/chesserGuesser/puzzles?date=2024/01/15');

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Invalid date format');
    });

    it('should use today\'s date if no date parameter provided', async () => {
      const today = new Date();
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      mockRedis.get.mockResolvedValue(null);

      await fetch('/api/chesserGuesser/puzzles');

      expect(mockRedis.get).toHaveBeenCalledWith(`chesserGuesser:dailyPuzzles:${expectedDate}`);
    });

    it('should return exactly 4 puzzles', async () => {
      const cachedPuzzles: DailyPuzzleSet = {
        date: '2024-01-15',
        puzzles: [
          { fen: 'fen1', eval: 100 },
          { fen: 'fen2', eval: -50 },
          { fen: 'fen3', eval: 0 },
          { fen: 'fen4', eval: 300 },
        ],
        seed: 20240115,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPuzzles));

      const response = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');
      const data = await response.json();

      expect(data.puzzles).toHaveLength(4);
    });

    it('should set proper cache headers', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        date: '2024-01-15',
        puzzles: [],
        seed: 12345,
      }));

      const response = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    });

    it('should handle fetch errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const response = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain('Failed to fetch daily puzzles');
    });

    it('should generate same puzzles for same date (determinism)', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockPuzzles = [
        { fen: 'fen1', eval: '100' },
        { fen: 'fen2', eval: '-50' },
        { fen: 'fen3', eval: '0' },
        { fen: 'fen4', eval: '300' },
      ];

      let callIndex = 0;
      (global.fetch as any).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            body: JSON.stringify(mockPuzzles[callIndex++ % 4]),
          }),
        })
      );

      // First call
      const response1 = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');
      const data1 = await response1.json();

      // Reset and call again
      callIndex = 0;
      mockRedis.get.mockResolvedValue(null);

      const response2 = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');
      const data2 = await response2.json();

      expect(data1.seed).toBe(data2.seed);
    });
  });

  describe('Puzzle Caching with TTL', () => {
    it('should cache puzzles with 7-day TTL', async () => {
      mockRedis.get.mockResolvedValue(null);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          body: JSON.stringify({ fen: 'test', eval: '0' }),
        }),
      });

      await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');

      const TTL_7_DAYS = 7 * 24 * 60 * 60;
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        TTL_7_DAYS,
        expect.any(String)
      );
    });

    it('should return different puzzles for different dates', async () => {
      mockRedis.get.mockResolvedValue(null);

      const response1 = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');
      const response2 = await fetch('/api/chesserGuesser/puzzles?date=2024-01-16');

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.date).toBe('2024-01-15');
      expect(data2.date).toBe('2024-01-16');
      expect(data1.seed).not.toBe(data2.seed);
    });
  });

  describe('Puzzle Fetching from Lambda', () => {
    it('should fetch puzzles from the correct Lambda endpoint', async () => {
      mockRedis.get.mockResolvedValue(null);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          body: JSON.stringify({ fen: 'test', eval: '100' }),
        }),
      });

      await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://f73vgbj1jk.execute-api.us-west-2.amazonaws.com/prod/chesserGuesser'
      );
      expect(global.fetch).toHaveBeenCalledTimes(4); // 4 puzzles
    });

    it('should handle partial fetch failures', async () => {
      mockRedis.get.mockResolvedValue(null);

      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            body: JSON.stringify({ fen: 'test', eval: '100' }),
          }),
        });
      });

      const response = await fetch('/api/chesserGuesser/puzzles?date=2024-01-15');
      const data = await response.json();

      // Should still attempt to return puzzles, even if some fail
      expect(data.puzzles.length).toBeLessThan(4);
    });
  });
});
