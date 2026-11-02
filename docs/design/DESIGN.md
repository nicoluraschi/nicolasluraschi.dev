# nicolasluraschi.dev: design notes for editing

Hand-written HTML + one CSS file. No JavaScript, no build step. Direction "H3" (Fraunces), terracotta palette.

## Files
- `index.html`, `how-i-work/index.html`, `style.css`
- `fonts/fraunces-latin.woff2` (+ `OFL.txt`). Self-hosted, latin subset, variable (optical size 9-144, weight 400-700), ~62 KB.
- Still to add: `luraschi-cv.pdf`, `img/runhub.png`, `img/marginalia.png` (1280x800), LinkedIn URL (`YOUR-HANDLE`).

## Rules when editing copy
- Do not add JavaScript, extra fonts, extra accent colours, gradients, shadows or emoji.
- Colours come only from the custom properties in `:root` (light) and the `prefers-color-scheme: dark` block. Never hard-code a colour in markup or in a rule (`scripts/check.py` fails on one, and on gradients and shadows).
- Accent is for links, the pull-quote rule, the focus ring, the section labels (`.sec-h`, the pull-quote label), the stack and toolbox labels (`.stack dt`, `.toolbox dt`), the `.tag` (accent text and border on `--surface`) and the diagram numbers (`.flow .n`). Nothing else: dates, meta lines and notes stay `--muted` (`tests/browser/palette.spec.mjs`).
- `--surface` is tinted toward the accent; it fills image frames, diagram cards and tags.
- Links stay underlined. External links (`https:`) get the arrow automatically; do not add one by hand.
- Tap targets in header/contact links stay >= 44px (`min-height: 2.75rem`).
- Keep contrast at WCAG AA or better. If a colour changes, recompute: text 4.5:1, large text and UI 3:1.

## Structure (home)
header > main (hero, About, Selected work, Experience, Toolbox, Now, Contact) > footer.
- Hero: `.hero-head` (name, role, location) + `.hero-body` (lead + paragraph). Two columns from 45em.
- About: `.prose` paragraphs, the last one the languages line.
- Work item: `<article class="work">` with `.work-text` and an optional `<figure class="shot">`. An item with no figure is valid (Winnow, the "How I work with AI" entry). A project's stack is `dl.stack`, one `div` per layer (`dt` label + `dd` items): Backend, Frontend, Data & hosting, Quality, AI.
- Job: `<article class="job">`; `.job-head` holds the `h3` (title only) and `p.dates`; content is a `ul` or a `p`.
- Toolbox: `dl.toolbox`, one `div` per row (`dt` + `dd`). Add or remove rows freely.
- Contact: the CV link is `.cv` (largest, bold). It is a text link, not a button.

## Structure (essay)
`body.essay-page` > header > `main.essay` > `article`. Headings: one `h1`, section titles `h2`.
- `.pullquote` = the one-line takeaway (keep it to one short sentence).
- `ol.flow` is a visual summary of the numbered list under it. It is `aria-hidden`. If the six steps change, update BOTH the diagram and the list. Chips (`.chip`) mark who decides; keep them to 2-4 words.

## What depends on text length
- Nothing in the layout relies on exact line counts.
- Check by eye after editing: the `.tag` next to a project title (wraps on narrow screens), `.chip` labels in the diagram, and long role titles in `.job h3`.

## Tokens
Type: 14 / 17 / 20 / 24 / 32 / 44px on phone; base 18, lead 24, h3 30, pull quote 40, h1 72px from 45em.
Spacing: 4 / 8 / 12 / 16 / 24 / 40 / 56 / 80px. Measure: 37rem (~68 characters). Breakpoint: 45em.
Light: bg #F6F1EB, surface #ECE0D3, text #1E1915, muted #5C5047, hairline #DDD0C2, accent #A33D1A.
Dark: bg #15110E, surface #241B15, text #F0E8E0, muted #B9A898, hairline #3A2E25, accent #EE9466.
Lowest pair: light accent on surface, 4.99:1. Every rendered text pair is checked in both schemes by `tests/browser/contrast.spec.mjs`.

## Not done yet
- Open Graph image, favicon, `robots.txt`, print stylesheet.
- RunHub case study page.
- Font fallback metric tuning (`size-adjust`) to reduce layout shift while the font loads; the font is preloaded and uses `font-display: swap`.
