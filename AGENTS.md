# AGENTS.md

Shared, cross-agent context for nicolasluraschi.dev. Any AI agent working here reads this file
(Claude Code imports it from CLAUDE.md; other agents read it directly). Project facts live here;
personal working preferences live in the developer's global config.

## What this is
Nicolás Luraschi's personal developer site: who he is, selected work, how he works with AI, and a
CV. It is read by recruiters and hiring managers, so every sentence on it must be true and
defensible in an interview. Text first; the design serves the reading.

## Stack
- Plain static HTML and one CSS file. No framework, no build step, no JavaScript.
- Hosted on GitHub Pages from `main`, custom domain `nicolasluraschi.dev` (apex; `www` redirects).
- Why: `docs/adr/0001-plain-static-html.md`.

## Repo layout
| Path | What |
|---|---|
| `index.html` | Home (`/`) |
| `how-i-work/index.html` | The essay (`/how-i-work`) |
| `style.css` | The only stylesheet |
| `fonts/` | Self-hosted Fraunces (latin subset, variable) and its SIL OFL licence |
| `img/` | Project screenshots, 1280x800; `og.png`, the 1200x630 link-preview card |
| `favicon.svg`, `favicon.png` | "NL" monogram favicon and its 32px PNG fallback |
| `robots.txt`, `sitemap.xml` | Crawl rules (allow all) and the two page URLs |
| `scripts/check.py` | Static site checks (Python stdlib only) |
| `scripts/render-assets.mjs` | Dev-only: renders `img/og.png` (from `scripts/_og-card.html`) and `favicon.png` with Playwright |
| `tests/` | Self-tests for the checks: `test_check.py`, `browser/*.spec.mjs`, `fixtures/` (one defect each) |
| `package.json`, `requirements-dev.txt` | Dev-only toolchain, never served (html-validate, Playwright, axe, coverage) |
| `luraschi-cv.pdf` | Public CV (no references' contact details) |
| `CNAME` | Custom domain for GitHub Pages |
| `_config.yml` | Pages (Jekyll) `exclude` list: every top-level path above except the site's own is never served; `npm run check:static` fails when one is missing |
| `docs/` | Constitution, architecture, ADRs, design references (`docs/design/DESIGN.md`) |

## Commands
| Task | Command |
|---|---|
| Run locally | `python3 -m http.server 8000` → http://localhost:8000 |
| Setup (once) | `npm ci --ignore-scripts && python3 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements-dev.txt && node_modules/.bin/playwright install chromium` |
| Site checks | `npm run check` (static, HTML validity, self-tests with ≥85% coverage, browser checks) |
| External links | `npm run check:external` (network; not in the hook) |
| Secrets | `gitleaks detect --redact` |

The pre-commit hook (`lefthook.yml`) runs gitleaks and, on commits touching HTML or CSS, the fast
static checks (`npm run check:static` and `check:html`: no network, no browser). CI (`.github/workflows/ci.yml`) runs gitleaks over the full
history, then `npm run check` (adds the self-tests and browser checks) and `npm run check:external`.

## Conventions
- Semantic HTML, mobile-first CSS, light and dark through `prefers-color-scheme`. One font stack,
  one accent colour.
- The design is final (`docs/design/DESIGN.md`). Don't redesign; flag anything that looks wrong
  before changing it. Key rules:
  - No JavaScript, extra fonts, gradients, shadows or emoji.
  - Colours only from the CSS custom properties; none hard-coded, no inline styles.
  - Accent only on links, the pull-quote rule, the focus ring, section and stack/toolbox labels,
    tags and diagram numbers (the list in `DESIGN.md`).
  - WCAG AA in both schemes (text 4.5:1, large text and UI 3:1); visible keyboard focus; header
    and contact links keep 44px tap targets.
  - A copy change that affects layout (a longer title, tag or chip, more diagram steps) is named,
    with the smallest CSS change proposed. The diagram and the numbered list under it change
    together.
- Accessibility is a requirement, not a polish step: headings in order, visible focus, sufficient
  contrast in both schemes, `prefers-reduced-motion` honoured.
- Code review scope: gitleaks and the site checks run in hooks and CI. Don't re-report what they
  catch. Review is for copy accuracy against the claims rules, accessibility, and structure.
- Commits & branching: Conventional Commits; branch `<type>/<short-task-name>`, never `main`.
- PRs are small and frequent: green on its own, leaves `main` working, one reviewable concern.
- English everywhere: code, comments, commits, docs and site copy.

## Architecture notes
Key decisions are in `docs/architecture.md`; the weightiest get an ADR in `docs/adr/`.

## Guardrails
- **This repo is public (or will be).** Never commit private data: no dossier content, no client or
  colleague names, no client metrics, no references' details, no phone number. Copy rules:
  `.claude/rules/content.md`.
- No JavaScript and no new dependencies without flagging them first.
- Product, copy and taste decisions belong to the owner: flag, don't guess.
- Don't weaken a security or CI check to make a build pass.
- Collaboration model: `docs/constitution.md`.
