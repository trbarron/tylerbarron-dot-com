#!/usr/bin/env python3
"""Build the /runescape-rascals title font from the game's own bold 12 glyph sheet.

The 2004 client ships its fonts as 320x320 sprite sheets (16x16 cells of 20px, white on
magenta). Each lit pixel becomes a square, so the result is a real scalable pixel font that
is crisp at multiples of 12px.

    python3 scripts/build-runescape-font.py <path-to>/b12_full.png public/fonts/runescape-bold-12.woff

Needs Pillow and fontTools. The sheet lives in the rs-sdk checkout at
server/content/fonts/b12_full.png.
"""
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image

CELL = 20  # one glyph cell in the sheet, in pixels
UNIT = 100  # font units per pixel, so the em is 12 px
SPACE = 4  # advance of a space, in pixels


def main(src: str, out: str) -> None:
    px = Image.open(src).convert('RGBA').load()

    def lit(code: int) -> set[tuple[int, int]]:
        cx, cy = (code % 16) * CELL, (code // 16) * CELL
        return {
            (x, y)
            for y in range(CELL)
            for x in range(CELL)
            if px[cx + x, cy + y][:3] == (255, 255, 255) and px[cx + x, cy + y][3] > 0
        }

    glyphs = {c: lit(c) for c in range(33, 127)}
    # The baseline is the bottom of a flat-footed lowercase letter.
    base = max(y for _, y in glyphs[ord('x')]) + 1

    def outline(pixels: set[tuple[int, int]], left: int):
        pen = TTGlyphPen(None)
        rows: dict[int, list[int]] = {}
        for x, y in pixels:
            rows.setdefault(y, []).append(x)
        for y, xs in rows.items():
            xs.sort()
            start = prev = xs[0]
            for x in xs[1:] + [None]:
                if x is not None and x == prev + 1:  # merge a horizontal run into one rectangle
                    prev = x
                    continue
                x0, x1 = (start - left) * UNIT, (prev + 1 - left) * UNIT
                y0, y1 = (base - y - 1) * UNIT, (base - y) * UNIT
                pen.moveTo((x0, y0))
                pen.lineTo((x0, y1))
                pen.lineTo((x1, y1))
                pen.lineTo((x1, y0))
                pen.closePath()
                if x is not None:
                    start = prev = x
        return pen.glyph()

    empty = TTGlyphPen(None).glyph()
    shapes = {'.notdef': empty, 'space': empty}
    advance = {'.notdef': 6 * UNIT, 'space': SPACE * UNIT}
    for code, pixels in glyphs.items():
        name = f'g{code}'
        if not pixels:
            shapes[name], advance[name] = empty, SPACE * UNIT
            continue
        left, right = min(x for x, _ in pixels), max(x for x, _ in pixels) + 1
        shapes[name] = outline(pixels, left)
        advance[name] = (right - left + 1) * UNIT  # one pixel of space after each letter

    fb = FontBuilder(12 * UNIT, isTTF=True)
    fb.setupGlyphOrder(list(shapes))
    fb.setupCharacterMap({32: 'space', **{c: f'g{c}' for c in glyphs}})
    fb.setupGlyf(shapes)
    fb.setupHorizontalMetrics({n: (w, 0) for n, w in advance.items()})
    fb.setupHorizontalHeader(ascent=10 * UNIT, descent=-3 * UNIT)
    fb.setupNameTable({'familyName': 'RuneScape Bold 12', 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=10 * UNIT, sTypoDescender=-3 * UNIT, usWinAscent=10 * UNIT, usWinDescent=3 * UNIT)
    fb.setupPost()
    fb.font.flavor = 'woff'
    fb.save(out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
