# Design System: Barron Wasteland

## Visual Theme & Atmosphere

**Neo-Brutalist Utilitarian with a Digital Edge.**

The aesthetic is confrontational clarity: stark white fields sliced by heavy black borders, uppercase letterforms carved into the layout with surgical precision. There is no softness here — no rounded corners, no drop shadows, no gentle gradients. Instead, depth is provided by a single dramatic exception: a WebGL-driven dichroic glass background that bleeds iridescent color beneath the flat monochrome UI, like oil on asphalt. The result feels like an engineer's personal zine — rigorous, opinionated, alive.

Design density is moderate-to-high. Information is packed but never crowded. Every border earns its weight.

---

## Color Palette & Roles

**Absolute Black** (`#000000`) — Primary text, all borders, button fill on hover, table headers. The non-negotiable anchor of the system.

**Pure White** (`#FFFFFF`) — Primary background, button resting state, card surfaces. Maximum contrast partner to Absolute Black.

**Obsidian Accent** (`#171717`) — Text selections, active states, social icon hover fills, prose link hover backgrounds. Softer than pure black but still reads as dark.

**Ash Gray** (`#F5F5F5`) — Skeleton loader backgrounds, blockquote fill, code block surfaces, focused input background. A breath of space without leaving the monochrome world.

**Concrete Gray** (`#E5E5E5`) — Disabled button and input backgrounds. Communicates inactivity without color.

**Graphite** (`#404040`) — Disabled button text. Legible but clearly muted.

> **Color rule:** The entire UI is monochrome. Color only appears in the WebGL dichroic background layer, which is always behind everything. Never introduce a new hue into the UI layer.

---

## Typography Rules

**Neo Font — Inter** (`font-neo`): `"Inter", system-ui, -apple-system, Helvetica, Arial, sans-serif`
- Body weight: 500 (medium) — purposeful, not thin
- Heading weight: 700–800 (bold/extrabold) — heavy, imposing
- Button/label weight: 700, uppercase, letter-spacing `0.05em`
- Base size: 16px, line-height 1.3 (tight)
- Headings use `letter-spacing: -0.02em` (tighter tracking)
- All headings are uppercase — no exceptions

**Mono Font — JetBrains Mono** (`font-mono`): `"JetBrains Mono", "SF Mono", "Monaco", "Consolas", monospace`
- Weight: 400 — code is data, not emphasis
- Used for: inline code, code blocks, any data that benefits from fixed-width
- Never use for UI labels or prose

**Type scale (prose context):**
- `h1`: 4xl–6xl, weight 800, uppercase, tracked tight, 4px bottom border
- `h2`: 3xl–5xl, weight 800, uppercase
- `h3`: 2xl–4xl, weight 700, uppercase
- `h4`: xl–3xl, weight 700, uppercase
- Body: 17–18px, weight 500, line-height 1.5
- Blockquote: 20px, weight 600, line-height 1.4

---

## Component Stylings

### Buttons
- Border: 4px solid black
- Padding: `px-6 py-3`
- Font: Inter 700, uppercase, `letter-spacing: 0.05em`, 16px
- Resting: black text on white background
- Hover: white text on black background (`transition: all 0.1s ease`)
- Disabled: `#E5E5E5` background, `#404040` text, 3px border (visually recessed)
- No border-radius — sharp corners always

### Inputs, Selects, Textareas
- Border: 2px solid black
- Padding: `px-3 py-2`
- Font: Inter 500, 16px
- Resting: white background, black text
- Focus: `#F5F5F5` background, black border preserved, no ring/outline
- Range sliders: black track, 24px square thumb (no border-radius), white inner border
- Checkboxes: 20px square, black fill on checked with white checkmark `✓`
- Radios: 20px circle, black fill on checked with white dot center

### Cards & Containers
- Border: 4px solid black, no border-radius
- Interactive cards: subtle background shift or lift on hover (`transition: 0.1s ease`)
- Inner content padding: typically `p-4` or `p-6`

### Tables
- Outer border: 4px solid black
- Inner borders (th, td): 2px solid black
- `th`: black background, white text, uppercase, `font-weight: 700`, `letter-spacing: 0.05em`
- `td`: white background, black text, `font-weight: 500`
- Full width by default

### Navigation (Navbar)
- Sticky-ready, `backdrop-blur-sm`, `bg-white/90` — lets WebGL background bleed through
- Bottom border: 4px solid black
- Branding: "BARRON WASTELAND" in `font-neo` extrabold, `tracking-tighter`
- Nav links: standard hover inversion (white-on-black)

### Footer
- Top border: 4px solid black
- Centered layout
- Social buttons: 48×48px square, 2px solid black border, 24px icons centered, inverts to black on hover

### Skeleton / Loading States
- Background: `#F5F5F5` with 2px `black/10` border
- Animation: `shimmer` at 1.5s — a fast horizontal sweep, not a slow pulse
- Shapes: sharp rectangles for text/rect variants, full circle only for avatar variant

### Links (in Prose)
- Default: `font-weight: 600`, black text, no underline
- Underline replacement: 3px solid black `border-bottom`, `padding-bottom: 2px`
- Hover: background shifts to Obsidian (`#171717`), text becomes white, border-color matches background

### Blockquotes
- Left border: 8px solid black
- Background: `#F5F5F5`
- Font: 20px, weight 600, line-height 1.4
- No quotation mark pseudo-elements

### Inline Code
- Background: `#F0F0F0`, `px-1.5 py-0.5`, slight rounding (`rounded-sm`)
- Font: JetBrains Mono, 0.85em, weight 400

### Code Blocks (`pre`)
- Background: `#F5F5F5`
- Left border: 4px solid black
- Font: JetBrains Mono, 0.9em, line-height 1.6
- Horizontally scrollable

---

## Layout Principles

**Container max-width:** `49rem` (`--spacing-xl`) — a deliberately narrow reading width that forces intentional whitespace on wide screens.

**Base unit:** 4px (standard Tailwind scale).

**Spacing philosophy:** Generous vertical rhythm within content; tight horizontal containment. Sections are separated by borders, not by whitespace alone.

**Grid:** No multi-column grid system. Content flows single-column. Side-by-side layouts (e.g., game UIs) are handled with flexbox, not a grid framework.

**Navigation:** Sticky top, full-width, 4px bottom border — always visible.

**Page structure:**
1. Navbar (sticky)
2. Hero / page header (full-width, heavy typography)
3. Content area (max-width `49rem`, centered)
4. Footer (full-width, 4px top border)

---

## Depth & Elevation

This system has **no box shadows**. Elevation is communicated entirely through:

- **Border weight**: 4px = primary UI surface, 2px = secondary/interior, 8px = emphasis accent (blockquote)
- **Background contrast**: `#FFFFFF` (surface) vs `#F5F5F5` (recessed) vs `#000000` (elevated/inverted)
- **The WebGL layer**: the only source of visual depth — an iridescent dichroic glass animation rendered in a `<canvas>` behind all UI content at `z-index: 0`. The navbar and content sit above it with `z-index: 10+`.

No drop shadows. No blurs on content (only `backdrop-blur-sm` on the navbar to maintain legibility over the canvas).

---

## Do's and Don'ts

**Do:**
- Use 4px borders for all primary UI containers and buttons
- Use uppercase for all headings, buttons, and table headers
- Keep the palette strictly monochrome in the UI layer
- Use Inter at 700–800 weight for anything that needs to command attention
- Invert colors (white-on-black) for all hover/active states
- Use the `shimmer` animation for loading states, never `pulse`
- Use JetBrains Mono exclusively for code and data

**Don't:**
- Add border-radius to any UI element — the design language is sharp
- Introduce color into the UI layer (gradients, colored text, colored borders)
- Use font weights below 500 for body text — thin text breaks the utilitarian feel
- Add box shadows — depth comes from borders and the WebGL layer
- Use `transition` durations longer than `0.2s` — feedback should feel instant
- Use italic text — the system is declarative, not conversational
- Soften or round anything — if it feels too harsh, that's correct

---

## Responsive Behavior

**Breakpoints** (Tailwind defaults):
- `sm`: 640px — not heavily used; single-column holds well
- `md`: 768px — nav may collapse
- `lg`: 1024px — typography scales up (prose body 17→18px, headings grow 1 step)
- `xl`: 1280px+ — max-width container (`49rem`) stays fixed; outer margins grow

**Touch targets:** Minimum 48×48px for all interactive elements. Social footer buttons are explicitly sized to 48px.

**Typography scaling:** Headings scale between mobile (`text-4xl`) and desktop (`text-6xl`) using responsive Tailwind prefixes. Body text scales from 17px to 18px at `lg`.

**Layout collapsing:** Single-column always. No hidden nav hamburger menus specified — if added, follow the inversion pattern (white icon on black drawer).

**WebGL background:** Renders at full viewport size on all screen sizes. Performance degrades gracefully if WebGL is unavailable (falls back to white background).

---

## Agent Prompt Guide

Use these phrases when prompting AI agents to generate UI for this design system:

**Color references:**
- "Absolute Black (`#000000`) border"
- "Pure White (`#FFFFFF`) background"
- "Obsidian Accent (`#171717`) hover state"
- "Ash Gray (`#F5F5F5`) surface"

**Tone cues:**
- "Neo-brutalist, sharp edges, no border-radius"
- "Monochrome UI with heavy 4px borders"
- "Uppercase, bold Inter headings"
- "Inverts to white-on-black on hover"

**Ready-to-use component prompts:**
- *Button:* "A button with 4px solid black border, white background, black uppercase text in Inter 700, that inverts to black background white text on hover, transition 0.1s ease, no border-radius."
- *Card:* "A card container with 4px solid black border, white background, no border-radius, and sharp corners."
- *Input:* "A text input with 2px solid black border, white background, that shifts to `#F5F5F5` on focus with no outline ring."
- *Table:* "A table with 4px outer border, 2px inner borders, black header cells with white uppercase text, white body cells."

**Iteration strategy:** When refining generated output, reference the specific hex token and border weight. E.g., "Change the border to 4px solid `#000000`" rather than "make the border thicker."
