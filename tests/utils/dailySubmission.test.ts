import { describe, expect, it } from 'vitest';
import { isRecentPuzzleDate } from '~/utils/dailySubmission';

describe('daily submission dates', () => {
  it.each([
    ['2024-01-01', '2023-12-31'],
    ['2024-03-01', '2024-02-29'],
    ['2025-03-01', '2025-02-28'],
  ])('allows the calendar day before %s', (today, yesterday) => {
    expect(isRecentPuzzleDate(today, today)).toBe(true);
    expect(isRecentPuzzleDate(yesterday, today)).toBe(true);
    expect(isRecentPuzzleDate('2020-01-01', today)).toBe(false);
    expect(isRecentPuzzleDate([today], today)).toBe(false);
  });
});
