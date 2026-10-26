import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/** Group nearby changed rows, with context, and bound each crop's height. */
export function differenceRegions(before, after, { threshold = 24, padding = 24, gap = 48, maxHeight = 800 } = {}) {
  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);
  const rows = [];
  for (let y = 0; y < height; y++) {
    let left = width;
    let right = -1;
    for (let x = 0; x < width; x++) {
      const inBefore = x < before.width && y < before.height;
      const inAfter = x < after.width && y < after.height;
      let changed = inBefore !== inAfter;
      if (inBefore && inAfter) {
        const a = (y * before.width + x) * 4;
        const b = (y * after.width + x) * 4;
        for (let c = 0; c < 4; c++) if (Math.abs(before.data[a + c] - after.data[b + c]) > threshold) changed = true;
      }
      if (changed) {
        left = Math.min(left, x);
        right = x;
      }
    }
    if (right >= 0) rows.push({ y, left, right });
  }
  const groups = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (!last || row.y - last.bottom > gap)
      groups.push({ top: row.y, bottom: row.y, left: row.left, right: row.right });
    else {
      last.bottom = row.y;
      last.left = Math.min(last.left, row.left);
      last.right = Math.max(last.right, row.right);
    }
  }
  return groups.flatMap((group) => {
    const left = Math.max(0, group.left - padding);
    const top = Math.max(0, group.top - padding);
    const right = Math.min(width, group.right + padding + 1);
    const bottom = Math.min(height, group.bottom + padding + 1);
    const regions = [];
    for (let y = top; y < bottom; y += maxHeight)
      regions.push({ left, top: y, width: right - left, height: Math.min(maxHeight, bottom - y) });
    return regions;
  });
}

/** Both sides use identical coordinates; white space represents an absent/deleted area. */
export async function writeDifferenceCrops(out, label) {
  const read = async (name) => {
    const { data, info } = await sharp(path.join(out, `${name}-${label}.png`))
      .flatten({ background: '#fff' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  };
  const before = await read('before');
  const after = await read('after');
  const regions = differenceRegions(before, after);
  const files = [];
  for (const [index, region] of regions.entries()) {
    for (const [name, image] of [
      ['before', before],
      ['after', after],
    ]) {
      const width = Math.max(0, Math.min(region.width, image.width - region.left));
      const height = Math.max(0, Math.min(region.height, image.height - region.top));
      const composite = [];
      if (width && height) {
        const input = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
          .extract({ left: region.left, top: region.top, width, height })
          .png()
          .toBuffer();
        composite.push({ input, left: 0, top: 0 });
      }
      const file = `${name}-${label}-change-${index + 1}.png`;
      await sharp({ create: { width: region.width, height: region.height, channels: 4, background: '#fff' } })
        .composite(composite)
        .png()
        .toFile(path.join(out, file));
      files.push(file);
    }
  }
  fs.writeFileSync(path.join(out, `changes-${label}.json`), JSON.stringify(regions, null, 2));
  return files;
}
