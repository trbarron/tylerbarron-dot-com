import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { differenceRegions, writeDifferenceCrops } from '../../scripts/lib/screenshot-diff.mjs';

const image = (width = 100, height = 2000) => ({ width, height, data: Buffer.alloc(width * height * 4, 255) });
const mark = (img: ReturnType<typeof image>, x: number, y: number, value = 0) => {
  img.data[(y * img.width + x) * 4] = value;
};

describe('automatic screenshot difference crops', () => {
  it('omits identical pages and tolerates small color noise', () => {
    const before = image();
    const after = image();
    mark(after, 30, 100, 240);
    expect(differenceRegions(before, after)).toEqual([]);
  });
  it('crops horizontally and separates distant changes with context', () => {
    const before = image();
    const after = image();
    mark(after, 50, 100);
    mark(after, 55, 110);
    mark(after, 50, 1500);
    expect(differenceRegions(before, after)).toEqual([
      { left: 26, top: 76, width: 54, height: 59 },
      { left: 26, top: 1476, width: 49, height: 49 },
    ]);
  });
  it('includes added/deleted content and splits long layout changes', () => {
    const regions = differenceRegions(image(100, 500), image(100, 2000));
    expect(regions.every((r) => r.height <= 800)).toBe(true);
    expect(regions[0].top).toBe(476);
    expect(regions.at(-1)!.top + regions.at(-1)!.height).toBe(2000);
  });
  it('writes equal-size PNG pairs, with blank space where one page ends', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-diff-test-'));
    try {
      for (const [name, height] of [
        ['before', 100],
        ['after', 150],
      ] as const)
        await sharp({ create: { width: 100, height, channels: 4, background: '#fff' } })
          .png()
          .toFile(path.join(out, `${name}-phone.png`));
      const files = await writeDifferenceCrops(out, 'phone');
      expect(files).toHaveLength(2);
      const sizes = await Promise.all(
        files.map(async (file: string) => {
          const m = await sharp(path.join(out, file)).metadata();
          return [m.width, m.height];
        }),
      );
      expect(sizes).toEqual([
        [100, 74],
        [100, 74],
      ]);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
