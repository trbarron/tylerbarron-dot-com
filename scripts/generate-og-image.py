#!/usr/bin/env python3
"""Generate Open Graph share cards.

- public/images/og-default.png — the site-wide default card
- public/images/og/<slug>.png  — one card per posts/*.mdx (title + date)
- public/images/og/projects/<slug>.png — one card per app/utils/projectCards.json
  entry, drawn with the entry's theme (chess projects get a board)

All 1200x630 brutalist black/white cards matching the site's nav brand.
Run and commit the PNGs; re-run when branding changes or posts are added:

    python3 scripts/generate-og-image.py
"""

import json
import math
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


# --- Project cards -----------------------------------------------------------
# One card per entry in app/utils/projectCards.json, which buildMeta (seo.ts)
# also reads to point each project page at its card. `theme` picks the
# template: "chess" or "rascals".

ROOT = Path(__file__).resolve().parent.parent
# cburnett pieces (Colin M.L. Burnett, GPLv2+), the same set the site's boards use,
# rasterized from chessground.cburnett.css.
PIECES_DIR = ROOT / "scripts" / "og-assets" / "pieces"

# The site's brown board (chessground.brown.css): dark squares are the light
# colour under 20% black.
LIGHT_SQ = (240, 217, 181)
DARK_SQ = (192, 174, 145)
# chessground's arrow brushes, so the cards match the boards on the site.
BRUSHES = {"green": (21, 120, 27), "red": (136, 32, 32), "blue": (0, 48, 136), "yellow": (230, 143, 0)}
ARROW_ALPHA = 205

BOARD = 456  # 8 x 57px squares
BOARD_FRAME = 6


def parse_fen_board(fen: str) -> dict:
    """Map squares like 'e4' to piece codes like 'wP'."""
    board = {}
    for rank_idx, row in enumerate(fen.split()[0].split("/")):
        file_idx = 0
        for ch in row:
            if ch.isdigit():
                file_idx += int(ch)
                continue
            color = "w" if ch.isupper() else "b"
            board[f"{'abcdefgh'[file_idx]}{8 - rank_idx}"] = color + ch.upper()
            file_idx += 1
    return board


def square_origin(sq: str, x0: int, y0: int, size: int, flipped: bool):
    f, r = "abcdefgh".index(sq[0]), int(sq[1]) - 1
    col, row = (7 - f, r) if flipped else (f, 7 - r)
    return x0 + col * size, y0 + row * size


def draw_arrow(overlay, start, end, color, sq):
    """A chessground-style arrow from square centre to square centre."""
    draw = ImageDraw.Draw(overlay)
    (x1, y1), (x2, y2) = start, end
    angle = math.atan2(y2 - y1, x2 - x1)
    head_len, head_w, shaft = sq * 0.42, sq * 0.27, sq * 0.17
    # Stop the shaft where the head begins so the alpha doesn't double up.
    bx, by = x2 - head_len * math.cos(angle), y2 - head_len * math.sin(angle)
    nx, ny = -math.sin(angle), math.cos(angle)
    draw.polygon([
        (x1 + nx * shaft / 2, y1 + ny * shaft / 2), (bx + nx * shaft / 2, by + ny * shaft / 2),
        (bx - nx * shaft / 2, by - ny * shaft / 2), (x1 - nx * shaft / 2, y1 - ny * shaft / 2),
    ], fill=color + (ARROW_ALPHA,))
    draw.polygon([
        (x2, y2), (bx + nx * head_w, by + ny * head_w), (bx - nx * head_w, by - ny * head_w),
    ], fill=color + (ARROW_ALPHA,))


def draw_board(img, card, x0, y0):
    flipped = card.get("orientation", "white") == "black"
    sq = BOARD // 8
    draw = ImageDraw.Draw(img)
    draw.rectangle([x0 - BOARD_FRAME, y0 - BOARD_FRAME, x0 + BOARD + BOARD_FRAME - 1,
                    y0 + BOARD + BOARD_FRAME - 1], fill=WHITE)
    for f in "abcdefgh":
        for r in range(1, 9):
            x, y = square_origin(f"{f}{r}", x0, y0, sq, flipped)
            dark = ("abcdefgh".index(f) + r) % 2 == 1
            draw.rectangle([x, y, x + sq - 1, y + sq - 1], fill=DARK_SQ if dark else LIGHT_SQ)
    for square, code in parse_fen_board(card["fen"]).items():
        piece = Image.open(PIECES_DIR / f"{code}.png").resize((sq, sq), Image.LANCZOS)
        img.paste(piece, square_origin(square, x0, y0, sq, flipped), piece)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    centre = lambda s: tuple(v + sq / 2 for v in square_origin(s, x0, y0, sq, flipped))
    for frm, to, brush in card.get("arrows", []):
        draw_arrow(overlay, centre(frm), centre(to), BRUSHES[brush], sq)
    img.alpha_composite(overlay)


def render_chess_card(card: dict, out: Path) -> None:
    img, _ = new_card()
    img = img.convert("RGBA")
    draw = ImageDraw.Draw(img)
    board_x = WIDTH - MARGIN - BOARD
    board_y = (HEIGHT - BOARD) // 2
    draw_board(img, card, board_x, board_y)

    text_w = board_x - MARGIN - 48
    draw.text((MARGIN, MARGIN - 8), "BARRON WASTELAND · CHESS", font=load_font(26), fill=WHITE)

    # Title as large as fits in three lines, tagline beneath, both left-aligned
    # and centred as a block in the space between the brand mark and the URL.
    text = card["title"].upper()
    size = 84
    while size > 40:
        title_font = load_font(size)
        title_lines = wrap_to_width(draw, text, title_font, text_w)
        # A word longer than the column can't wrap, so it has to fit by size.
        widest = max(draw.textlength(line, font=title_font) for line in title_lines)
        if len(title_lines) <= 3 and widest <= text_w:
            break
        size -= 4
    tag_font = load_font(30)
    tag_lines = wrap_to_width(draw, card["tagline"], tag_font, text_w)
    t_line = sum(title_font.getmetrics())
    g_line = sum(tag_font.getmetrics()) + 6
    block_h = len(title_lines) * t_line + 28 + len(tag_lines) * g_line
    y = (HEIGHT - block_h) // 2
    for line in title_lines:
        draw.text((MARGIN, y), line, font=title_font, fill=WHITE)
        y += t_line
    y += 28
    for line in tag_lines:
        draw.text((MARGIN, y), line, font=tag_font, fill=WHITE)
        y += g_line

    url = f"{URL}{card['path']}"
    url_font = fit_font(draw, url, text_w, start=26)
    draw.text((MARGIN, HEIGHT - MARGIN - 26), url, font=url_font, fill=WHITE)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")


# The Runescape Rascals card: the grey world map from the page with every route the
# party has walked, from its travel log (app/utils/runescapeRascals/walked-routes.json, the
# same paths the page draws; exported by runscape-local's agents/map/export-routes.ts),
# thicker the more it has been walked.
RASCALS_MAP = ROOT / "public" / "images" / "runescape-rascals" / "f2p-map.webp"
RASCALS_ROUTES = ROOT / "app" / "utils" / "runescapeRascals" / "walked-routes.json"
# The map image covers world x 2880-3360, z 3120-3520 at 4 px per tile, north up.
MAP_X0, MAP_Z1, MAP_PX = 2880, 3520, 4
MAP_W, MAP_H = 500, 470
CROP_X0, CROP_X1, CROP_Z1 = 2985, 3305, 3445


def render_rascals_card(card: dict, out: Path) -> None:
    img, _ = new_card()
    img = img.convert("RGBA")
    draw = ImageDraw.Draw(img)

    # Crop the map to the party's ground and scale it into the panel.
    scale = MAP_W / ((CROP_X1 - CROP_X0) * MAP_PX)
    crop_h = round(MAP_H / scale)
    left, top = (CROP_X0 - MAP_X0) * MAP_PX, (MAP_Z1 - CROP_Z1) * MAP_PX
    world = Image.open(RASCALS_MAP).convert("RGB").crop((left, top, left + (CROP_X1 - CROP_X0) * MAP_PX, top + crop_h))
    world = world.resize((MAP_W, MAP_H), Image.LANCZOS)
    map_x, map_y = WIDTH - MARGIN - MAP_W, (HEIGHT - MAP_H) // 2
    draw.rectangle([map_x - BOARD_FRAME, map_y - BOARD_FRAME, map_x + MAP_W + BOARD_FRAME - 1, map_y + MAP_H + BOARD_FRAME - 1], fill=WHITE)
    img.paste(world, (map_x, map_y))

    def at(x: float, z: float) -> tuple[float, float]:
        return (map_x + (x - CROP_X0) * MAP_PX * scale, map_y + (CROP_Z1 - z) * MAP_PX * scale)

    # Both directions of a route are one road; busier roads draw thicker and on top.
    roads: dict[tuple[str, str], dict] = {}
    for r in json.loads(RASCALS_ROUTES.read_text()):
        key = tuple(sorted((r["from"], r["to"])))
        road = roads.setdefault(key, {"trips": 0, "path": r["path"]})
        road["trips"] += r["trips"]
    lines = img.copy()
    line_draw = ImageDraw.Draw(lines)
    # Roads walked only once or twice are noise at this size.
    ordered = sorted((r for r in roads.values() if r["trips"] >= 3), key=lambda r: r["trips"])
    width = lambda trips: round(1 + 1.9 * math.log10(trips + 1))

    def smooth(path: list) -> list:
        """Resample the tile path every few tiles, then average neighbours, so the
        pathfinder's stair-steps read as a road."""
        pts = [path[0]]
        for p in path[1:]:
            (ax, az), (bx, bz) = pts[-1], p
            steps = int(math.hypot(bx - ax, bz - az) // 4)
            pts += [(ax + (bx - ax) * i / steps, az + (bz - az) * i / steps) for i in range(1, steps)] + [p]
        k = 3
        out = [pts[0]]
        for i in range(1, len(pts) - 1):
            win = pts[max(0, i - k) : i + k + 1]
            out.append((sum(p[0] for p in win) / len(win), sum(p[1] for p in win) / len(win)))
        return [at(x, z) for x, z in out + [pts[-1]]]

    for road in ordered:
        road["pts"] = smooth(road["path"])
    for road in ordered:
        pts = road["pts"]
        line_draw.line(pts, fill=WHITE, width=width(road["trips"]) + 3, joint="curve")
    for road in ordered:
        pts = road["pts"]
        line_draw.line(pts, fill=BLACK, width=width(road["trips"]), joint="curve")
    # Keep the lines inside the map panel.
    img.paste(lines.crop((map_x, map_y, map_x + MAP_W, map_y + MAP_H)), (map_x, map_y))

    text_w = map_x - MARGIN - 48
    draw.text((MARGIN, MARGIN - 8), "BARRON WASTELAND · AGENTS", font=load_font(26), fill=WHITE)
    title_font = fit_font(draw, max(card["title"].upper().split(), key=len), text_w, start=84)
    title_lines = wrap_to_width(draw, card["title"].upper(), title_font, text_w)
    tag_font = load_font(30)
    tag_lines = wrap_to_width(draw, card["tagline"], tag_font, text_w)
    t_line = sum(title_font.getmetrics())
    g_line = sum(tag_font.getmetrics()) + 6
    y = (HEIGHT - (len(title_lines) * t_line + 28 + len(tag_lines) * g_line)) // 2
    for line in title_lines:
        draw.text((MARGIN, y), line, font=title_font, fill=WHITE)
        y += t_line
    y += 28
    for line in tag_lines:
        draw.text((MARGIN, y), line, font=tag_font, fill=WHITE)
        y += g_line

    url = f"{URL}{card['path']}"
    draw.text((MARGIN, HEIGHT - MARGIN - 26), url, font=fit_font(draw, url, text_w, start=26), fill=WHITE)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")


THEMES = {"chess": render_chess_card, "rascals": render_rascals_card}


def render_project_cards() -> None:
    cards = json.loads((ROOT / "app" / "utils" / "projectCards.json").read_text())
    out_dir = ROOT / "public" / "images" / "og" / "projects"
    for slug, card in cards.items():
        THEMES[card["theme"]](card, out_dir / f"{slug}.png")
    # Same idea as the post manifest: CI compares it to projectCards.json.
    (out_dir / "manifest.json").write_text(json.dumps(cards, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {out_dir / 'manifest.json'}")


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

    render_project_cards()


if __name__ == "__main__":
    main()
