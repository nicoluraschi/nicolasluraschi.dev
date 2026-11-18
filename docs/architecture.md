# Architecture
When a decision changes, update this file (and the relevant ADR) in the same PR.

## Overview
Static files served by GitHub Pages from the root of `main`. No build step of our own: Pages runs
its default Jekyll build, which copies the site files as they are; `_config.yml` excludes every
dev path (`docs/`, `scripts/`, `tests/`, the toolchain files), and `scripts/check.py` fails when a
top-level path is neither part of the site (`SITE_PATHS`) nor excluded. Each page is a directory with an `index.html`, so URLs have no `.html` suffix
(`/how-i-work`). Every page links the single `style.css`.

## Decisions
- Plain HTML and one CSS file, no framework, no JavaScript: `docs/adr/0001-plain-static-html.md`.
- One self-hosted font, Fraunces (`fonts/`, SIL OFL 1.1), preloaded, `font-display: swap`; no
  third-party font service, so no request leaves the domain. While it loads, a metric-adjusted
  `local()` fallback (tuned for Linux's Liberation Serif) keeps the swap from moving the page.
- Visibility: the repo is **public** and Pages serves `main` (launched 2026-11-17, after a privacy
  pass over the full history, PR refs, PR text, Actions logs and binaries). GitHub Pages on the
  free plan needs a public repo. A ruleset on `main` (`protect-main`) requires the CI `checks` job
  and blocks force-pushes and deletion; secret scanning and push protection are on.
- Because the full history is public, nothing private enters any commit, ever.

## DNS (Cloudflare, all records DNS only)
Apex `nicolasluraschi.dev`: A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
`185.199.111.153`; AAAA records `2606:50c0:8000::153`, `2606:50c0:8001::153`,
`2606:50c0:8002::153`, `2606:50c0:8003::153`. `www`: CNAME `nicoluraschi.github.io.` The domain is
verified on the GitHub account (TXT `_github-pages-challenge-nicoluraschi`, keep it: it blocks
takeover). Records must stay DNS only, or GitHub cannot renew its certificate. `.dev` is
HSTS-preloaded, so the site loads only over HTTPS; Enforce HTTPS is on.

## Quality tooling & CI
- Local hooks (`lefthook.yml`, run `lefthook install` once per clone): gitleaks on staged changes,
  plus, on commits touching HTML or CSS, the fast static subset: `scripts/check.py` and
  html-validate. No network, no browser.
- CI (`.github/workflows/ci.yml`): one job on every PR and push to `main`. Steps: checkout,
  gitleaks over the full history, `npm ci --ignore-scripts`, a Python venv with hash-checked
  `coverage`, a cached Chromium, `npm run check` (all checks and the self-tests, coverage gate
  ≥85% on `scripts/check.py`), then `npm run check:external` as its own step so a third-party
  outage reads as that step failing.
- Site checks, by what proves them. `scripts/check.py` (Python stdlib): forbidden markup, internal
  links and assets (`srcset` candidates included), malformed URLs, leftover placeholders, contrast
  from the CSS tokens, published paths against `_config.yml`, and with `--external` the outside
  links.
  html-validate: HTML validity. Playwright with axe (Chromium, loopback server, light and dark):
  WCAG A/AA, no horizontal scroll at 320 and 360px, visible keyboard focus, 44px tap targets,
  reduced motion. Each check has a failing fixture under `tests/fixtures/` that must keep failing.
- Toolchain: dev-only, never served (excluded in `_config.yml`). Exact versions, installed with
  `--ignore-scripts`, each published at least 7 days before it was adopted; Chromium is pinned by
  the Playwright version.
- Dependabot (`.github/dependabot.yml`): GitHub Actions, npm and pip, monthly, 7-day cooldown.

## Reference
- Principles: `docs/constitution.md` · Copy rules: `.claude/rules/content.md` · Design references:
  `docs/design/README.md`
