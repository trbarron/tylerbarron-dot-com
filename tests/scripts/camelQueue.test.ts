import { describe, it, expect } from 'vitest';
import { fileNameFor, parsePending } from '../../scripts/camel-queue.mjs';

const bot = (id: string, botName: string, submitted: string) => ({ id, botName, author: 'a', code: 'x', submitted });

describe('camel queue', () => {
  it('lists the oldest submission first', () => {
    const hash = {
      b: JSON.stringify(bot('sub-b', 'Later', '2026-11-12T10:00:00.000Z')),
      a: JSON.stringify(bot('sub-a', 'Earlier', '2026-11-11T10:00:00.000Z')),
    };
    expect(parsePending(hash).map((b: { botName: string }) => b.botName)).toEqual(['Earlier', 'Later']);
  });

  it('names files after the bot, telling apart two bots with one name', () => {
    const a = bot('sub-1111-aaaaaa', 'Dice', 't');
    const b = bot('sub-2222-bbbbbb', 'Dice', 't');
    const c = bot('sub-3333-cccccc', 'Solo', 't');
    expect(fileNameFor(c, [a, b, c])).toBe('Solo.py');
    expect(fileNameFor(a, [a, b, c])).toBe('Dice-aaaaaa.py');
    expect(fileNameFor(b, [a, b, c])).toBe('Dice-bbbbbb.py');
  });

  it('refuses a stored name that could escape the folder', () => {
    const evil = bot('sub-x', '../../.bashrc', 't');
    expect(() => fileNameFor(evil, [evil])).toThrow(/unsafe/);
  });
});
