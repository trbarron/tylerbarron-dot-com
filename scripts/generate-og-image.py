#!/usr/bin/env python3
"""Generate Open Graph share cards.

- public/images/og-default.png — the site-wide default card
- public/images/og/<slug>.png  — one card per posts/*.mdx (title + date)

All 1200x630 brutalist black/white cards matching the site's nav brand.
Run and commit the PNGs; re-run when branding changes or posts are added:

    python3 scripts/generate-og-image.py
"""

import json
import re
from datetime import date as date_cls
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1200, 630
BORDER = 16          # thick brutalist frame
MARGIN = 64
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

TITLE = "BARRON WASTELAND"
TAGLINE = "a series of flat circles"
URL = "tylerbarron.com"

# Bold sans to match the extrabold uppercase nav wordmark. Fall back across a
# few macOS paths so this isn't pinned to one machine.
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit("No bold system font found; edit FONT_CANDIDATES.")


def fit_font(draw, text, max_width, start, candidates_path_size=128):
    """Largest font size (<= start) at which text fits within max_width."""
    size = start
    while size > 24:
        font = load_font(size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 2
    return load_font(24)


def new_card():
    """Black card with the brutalist white frame; returns (img, draw)."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(img)
    draw.rectangle(
        [BORDER // 2, BORDER // 2, WIDTH - BORDER // 2 - 1, HEIGHT - BORDER // 2 - 1],
        outline=WHITE,
        width=BORDER,
    )
    return img, draw


def wrap_to_width(draw, text, font, max_width):
    """Greedy word-wrap; returns a list of lines that each fit max_width."""
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if line and draw.textlength(trial, font=font) > max_width:
            lines.append(line)
            line = word
        else:
            line = trial
    if line:
        lines.append(line)
    return lines


def read_frontmatter(mdx_path: Path) -> dict:
    """Minimal frontmatter reader: bare `key: value` pairs between --- fences."""
    text = mdx_path.read_text(encoding="utf-8")
    match = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        return {}
    fields = {}
    for line in match.group(1).splitlines():
        kv = re.match(r"^(\w+):\s*(.+?)\s*$", line)
        if kv:
            key, value = kv.groups()
            fields[key] = value.strip("\"'")
    return fields


def format_date(raw: str) -> str:
    try:
        return date_cls.fromisoformat(raw[:10]).strftime("%B %-d, %Y").upper()
    except ValueError:
        return raw


def render_post_card(title: str, date_label: str, out: Path) -> None:
    img, draw = new_card()
    usable = WIDTH - 2 * MARGIN

    # Small brand mark top-left, then the post title as the hero text.
    brand_font = load_font(30)
    draw.text((MARGIN, MARGIN - 8), "BARRON WASTELAND", font=brand_font, fill=WHITE)

    text = title.upper()
    size = 96
    while size > 40:
        font = load_font(size)
        lines = wrap_to_width(draw, text, font, usable)
        ascent, descent = font.getmetrics()
        line_h = ascent + descent
        if len(lines) <= 3 and len(lines) * line_h <= 330:
            break
        size -= 4
    block_h = len(lines) * line_h
    y = (HEIGHT - block_h) // 2
    for line in lines:
        draw.text((MARGIN, y), line, font=font, fill=WHITE)
        y += line_h

    # Date bottom-left, URL bottom-right.
    small_font = load_font(30)
    draw.text((MARGIN, HEIGHT - MARGIN - 30), date_label, font=small_font, fill=WHITE)
    url_w = draw.textlength(URL, font=small_font)
    draw.text((WIDTH - MARGIN - url_w, HEIGHT - MARGIN - 30), URL,
              font=small_font, fill=WHITE)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")


def main() -> None:
    img, draw = new_card()

    usable = WIDTH - 2 * MARGIN
    title_font = fit_font(draw, TITLE, usable, start=150)
    tagline_font = load_font(34)
    url_font = load_font(30)

    # Vertically center the title; hang the tagline beneath it.
    t_w = draw.textlength(TITLE, font=title_font)
    t_ascent, t_descent = title_font.getmetrics()
    t_h = t_ascent + t_descent
    title_y = (HEIGHT - t_h) // 2 - 30
    draw.text(((WIDTH - t_w) / 2, title_y), TITLE, font=title_font, fill=WHITE)

    tag_w = draw.textlength(TAGLINE, font=tagline_font)
    draw.text(((WIDTH - tag_w) / 2, title_y + t_h + 24), TAGLINE,
              font=tagline_font, fill=WHITE)

    # URL pinned to the bottom-left inside the frame.
    draw.text((MARGIN, HEIGHT - MARGIN - 30), URL, font=url_font, fill=WHITE)

    root = Path(__file__).resolve().parent.parent
    out = root / "public" / "images" / "og-default.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")

    # Per-post cards: /images/og/<slug>.png, picked up by the MDX compile step.
    # The manifest records the frontmatter each card was rendered from so CI
    # (scripts/check-og-images.mjs) can detect missing or stale cards without
    # re-rendering (font availability differs across machines).
    og_dir = root / "public" / "images" / "og"
    manifest = {}
    for mdx in sorted((root / "posts").glob("*.mdx")):
        fm = read_frontmatter(mdx)
        title = fm.get("title")
        if not title:
            print(f"Skipping {mdx.name}: no title frontmatter")
            continue
        render_post_card(title, format_date(fm.get("date", "")), og_dir / f"{mdx.stem}.png")
        manifest[mdx.stem] = {"title": title, "date": fm.get("date", "")}

    manifest_path = og_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
