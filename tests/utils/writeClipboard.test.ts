import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeClipboard } from '~/hooks/useCopy';

describe('writeClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the text and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await writeClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('reports failure when the write is refused', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await writeClipboard('hello')).toBe(false);
  });

  it('reports failure when there is no Clipboard API (an insecure context)', async () => {
    vi.stubGlobal('navigator', {});
    expect(await writeClipboard('hello')).toBe(false);
  });
});
