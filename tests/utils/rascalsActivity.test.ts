import { describe, expect, it } from 'vitest';
import { activitySummary } from '../../app/utils/runescapeRascals/activity';

describe('character activity summaries', () => {
  it('keeps the combat target while removing routine counters and elapsed time', () => {
    expect(activitySummary({ action: 'safe cows: step 1/1, fight (Cow) until Attack 50 (4 min)' })).toBe(
      'Training Attack 50 · Cow',
    );
  });
  it('uses the current structured step rather than the routine name', () => {
    expect(
      activitySummary({
        action: 'bank coal reserves',
        routine: {
          name: 'bank coal reserves',
          step: 0,
          repeat: false,
          steps: ['mine (Coal) until 24 Coal', 'bank_resources (Coal)'],
        },
      }),
    ).toBe('Mining Coal · 24 Coal');
  });
  it('preserves unfamiliar actions instead of guessing their meaning', () => {
    expect(activitySummary({ action: 'recover: step 1/3, rest until 5 min (loop 7) (4 min)' })).toBe(
      'Rest until 5 min',
    );
    expect(activitySummary({ action: 'bank_resources (Coal)' })).toBe('Bank resources (Coal)');
  });
});
