#!/usr/bin/env python3
"""Generate the default Open Graph share card (public/images/og-default.png).

A static 1200x630 brutalist black/white card matching the site's nav brand.
Run once and commit the PNG; re-run only when the branding changes:

    python3 scripts/generate-og-image.py
"""

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


def main() -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(img)

    # Brutalist white frame.
    draw.rectangle(
        [BORDER // 2, BORDER // 2, WIDTH - BORDER // 2 - 1, HEIGHT - BORDER // 2 - 1],
        outline=WHITE,
        width=BORDER,
    )

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

    out = Path(__file__).resolve().parent.parent / "public" / "images" / "og-default.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG")
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
