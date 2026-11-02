# nicolasluraschi.dev: design notes for editing

Hand-written HTML + one CSS file. No JavaScript, no build step. Direction "H3" (Fraunces, petrol-blue accent).

## Files
- `index.html`, `how-i-work/index.html`, `style.css`
- `fonts/fraunces-latin.woff2` (+ `OFL.txt`). Self-hosted, latin subset, variable (optical size 9-144, weight 400-700), ~62 KB.
- Still to add: `luraschi-cv.pdf`, `img/runhub.png`, `img/marginalia.png` (1280x800), LinkedIn URL (`YOUR-HANDLE`).

## Rules when editing copy
- Do not add JavaScript, extra fonts, extra accent colours, gradients, shadows or emoji.
- Colours come only from the custom properties in `:root` (light) and the `prefers-color-scheme: dark` block. Never hard-code a colour in markup.
- Accent is for links, the pull-quote rule and the focus ring. Nothing else.
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
Light: bg #F4F5F5, surface #E6EAEB, text #12161A, muted #4F5A60, hairline #D0D6D8, accent #0F5C73.
Dark: bg #0C1215, surface #151E22, text #E6EDEF, muted #9FB0B6, hairline #28363B, accent #6CC4DC.

## Not done yet
- Open Graph image, favicon, `robots.txt`, print stylesheet.
- RunHub case study page.
- Font fallback metric tuning (`size-adjust`) to reduce layout shift while the font loads; the font is preloaded and uses `font-display: swap`.
