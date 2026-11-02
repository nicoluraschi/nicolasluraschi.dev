# Site checks and CI — spec
**Status:** done
**Date:** 2026-11-01

## 1. Outcome
Every promise the design makes (valid HTML, working links, WCAG AA in both colour schemes, visible
keyboard focus, 44px tap targets, reduced motion honoured, no JavaScript or inline styles, no
horizontal scroll on small phones) is checked by a machine: the fast static subset on every
commit, the full set on every PR and push to `main`. For the owner, who reviews PRs, and for the
recruiters who read the result.

## 2. Scope
**In:** `scripts/check.py` (stdlib static checks, `--external` for outside links); a dev-only Node
toolchain (html-validate, Playwright, axe) for validity and browser checks; `coverage` for the ≥85%
rule; permanent failing-fixture self-tests; one entry point; pre-commit and CI wiring; Dependabot
`npm` and `pip` entries; AGENTS.md and `docs/architecture.md` updates. Detail in §6 and §8.

**Out**
- Any change to `index.html`, `how-i-work/index.html`, `style.css` or `fonts/`.
- The placeholder check (`YOUR-HANDLE`, missing PDF and images): PR 3, test-first.
- `srcset` checking: PR 3, when the screenshots arrive.
- The 720–760px hero `h1` overhang: known, accepted, not checked.
- Visual regression, Lighthouse, performance budgets.
- How GitHub Pages excludes non-site files at launch (see §4 Open).

## 3. Constraints
- Nothing in the toolchain is served or shipped: no JavaScript reaches a page.
- Private repo until launch: one CI job, Chromium only, cached.
- No content changes: today's site must pass every check as it stands.
- `scripts/check.py` is Python ≥3.11 stdlib only; `coverage` is a test-time tool, never imported.

## 4. Decisions
**Made**
- Dev-only Node toolchain: html-validate, @playwright/test, @axe-core/playwright — owner.
- Static checks in Python stdlib — `docs/architecture.md` names `scripts/check.py`.
- External link failures block CI, after up to 3 attempts per URL — owner.
- LinkedIn's HTTP 999 counts as a pass — owner; it answers every bot with 999.
- `coverage` added as a dev-only Python dependency, fail under 85% — owner.
- The CV PDF and both screenshots are excluded from the asset check by an explicit list that PR 3
  empties — owner.
- Self-tests are permanent — a check that can no longer fail is caught.
- axe runs the WCAG 2.0/2.1/2.2 A and AA tags and fails on any violation — the bar is WCAG AA.
- Dark mode via Playwright's `colorScheme: 'dark'`, never injected CSS — owner.
- Contrast pairs: `--text`, `--muted`, `--accent` on `--bg` and `--surface`, each scheme, ≥4.5:1;
  UI pairs (focus ring `--accent`, tag border `--muted`, chip border `--text`, on `--bg` and
  `--surface`) ≥3:1. `--hair` is decorative, not checked. Lowest today: light `--muted` on
  `--surface`, 5.85:1.
- Focus, tap-target and reduced-motion checks added (AC9–AC11) — owner, from 1b-F01.
- Protocol-relative URLs (`//host/x`) are external — they leave the origin.
- Pre-commit checks the working tree, not the staged snapshot — deferred; CI runs the full set.
- 1b: CONCERNS — 4 accepted, 0 rejected, 1 human (F01, answered: add all three).
- 2b: RESOLVED — 3 accepted, 1 rejected (conceded), 0 human.

**Open**
- [OPEN — owner] Pages publishes the repo root, so `docs/`, `scripts/`, `package.json` and the test
  fixtures (one holds a `<script>`) would be served at launch. Proposed: decide at the launch PR
  (deploy only an allowlist); nothing is served now, Pages is off.

## 5. Task breakdown
In the plan: `docs/specs/plans/2026-11-site-checks.md`.

## 6. Acceptance criteria
Fixtures live under `tests/fixtures/`, one defect per fixture. "Fails" means a non-zero exit and a
message naming the file and the rule; every self-test asserts its own rule id, not just a failure.

**AC1 — HTML validity**
- Given both site pages, when html-validate runs, then it reports no errors.
- Given a fixture with an unclosed element, then it fails with that rule; given a separate fixture
  with a duplicate `id`, then it fails with `no-dup-id`.

**AC2 — Internal links and assets**
- Given both pages, every internal URL — root-relative, document-relative (`../style.css`) and
  same-origin with a fragment (`/#contact`) — in `href` and `src`, and every `url()` in
  `style.css`, resolves against the repo root (a directory resolves to its `index.html`), except
  the three excluded paths. Paths are percent-decoded after joining.
- Given a fixture linking `/missing/`, then it fails; a fixture with `src="nope.png"` (relative),
  then it fails; a fixture stylesheet with `url("/fonts/missing.woff2")`, then it fails.
- Given a URL that decodes to a path outside the repo root (`%2e%2e/%2e%2e/outside.css`), then it
  fails with `outside-root`, without reading the outside path; one that decodes to a null byte
  fails with `missing-target`.
- Given a fragment, the target `id` must exist on the destination page: `href="#nowhere"` and
  `href="/how-i-work#nowhere"` each fail in their own fixture.
- The excluded-paths list holds exactly `/luraschi-cv.pdf`, `/img/runhub.png`,
  `/img/marginalia.png`; a test asserts it, so widening it is a visible diff.

**AC3 — External links (`--external`)**
- Given every `http(s)` and protocol-relative link in both pages, when checked with a HEAD
  request, falling back to GET when HEAD answers anything but 2xx/3xx or drops the connection,
  then 2xx and redirects that resolve pass, LinkedIn's 999 passes, anything else fails after 3
  attempts. A HEAD timeout or a refused redirect is not retried with GET.
- `mailto:` links are not fetched.
- Given a stubbed server answering 404 to both, then it fails; 405 to HEAD and 200 to GET, then it
  passes; 302 to a 200, then it passes; 999 from a non-LinkedIn host, then it fails.
- Not part of the default entry point or pre-commit.

**AC4 — Accessibility (axe)**
- Given each page at 1280px, when axe runs under `colorScheme: 'light'` and `'dark'`, then there
  are zero violations in both.
- Each run first asserts the body's computed background is the literal colour for that scheme
  (light `rgb(244, 245, 245)`, dark `rgb(12, 18, 21)`), so a failed emulation fails the test.
- Given a fixture with an `<img>` without `alt`, then axe reports `image-alt`; given a separate
  low-contrast fixture, then it reports `color-contrast`.

**AC5 — Contrast from tokens**
- Given `style.css`, when the light `:root` and the `prefers-color-scheme: dark` block are parsed,
  then every pair in §4 meets its threshold, and the report lists each ratio, passing or not; a
  test asserts the lowest is light `--muted` on `--surface` at 5.85.
- Given a fixture stylesheet with `--muted: #9AA3A8` on `--bg: #F4F5F5`, then it fails naming the
  pair and ratio.
- Given a stylesheet missing a token, or missing the dark block, or a token in either block whose
  value is not 3- or 6-digit hex, then each fails in its own test rather than skipping or
  inheriting the light value. A last declaration without `;` is read.

**AC6 — Forbidden markup**
- Given both pages, then there is no `<script>` element, no `style` attribute, no `<style>`
  element, no `on*` event-handler attribute, and no `javascript:` URL in `href`, `src`, `action`,
  `formaction` or `xlink:href` (after removing tab/LF/CR and trimming control characters, as
  browsers do).
- Given one fixture per rule, then each fails naming the rule.

**AC7 — No horizontal scroll**
- Given each page at 320 and 360px wide, light and dark, after the font has loaded, then
  `document.documentElement.scrollWidth` ≤ the viewport width.
- Given a fixture with a 400px-wide fixed element, then it fails at 320px.

**AC8 — Entry points, hooks, CI**
- `npm run check` runs AC1, AC2, AC4–AC7, AC9–AC11 and the self-tests, and exits non-zero if any
  fails.
- Pre-commit runs `scripts/check.py` (static checks) and html-validate on commits touching HTML or
  CSS: no network, no browser.
- CI's single job, capped at 15 minutes: checkout, gitleaks, `npm ci`, Chromium install (cached by
  Playwright version, saved right after install), `npm run check`, coverage gate ≥85% on
  `scripts/check.py`, then `check.py --external` as its own step. Every action pinned by SHA.
  Today's `main` content passes all of it.
- Dependabot has `npm` and `pip` entries with `cooldown.default-days: 7`.
- AGENTS.md's "Site checks" row and `docs/architecture.md`'s CI section describe the above.

**AC9 — Visible keyboard focus**
- Given each page, light and dark, when Tab moves through every focusable element from the top,
  then each focused element has a computed `outline-style` other than `none`, an `outline-width`
  ≥2px and a fully opaque outline colour; the skip link is first and is inside the viewport while
  focused.
- Given fixtures whose links set `outline: none`, a transparent or a nearly transparent outline on
  focus, then each fails naming the element.

**AC10 — Tap targets**
- Given each page at 320px, then every link in `.site-header` and `.links` is ≥44px tall.
- Given a fixture with a header link under 44px, then it fails naming the link.

**AC11 — Reduced motion**
- Given each page, when `reducedMotion: 'reduce'` is emulated, then every link's computed
  `transition-duration` is `0s`; under `'no-preference'` at least one is not, proving the
  emulation applied.
- Given a fixture with an unconditional link transition, then it fails under `'reduce'`.

## 7. Security requirements
From 1s (STRIDE, no Critical), its delta and 2s. Deferred: Pages serving fixtures (launch PR, §4
Open); third-party outages failing CI (owner accepted, own step).

## 8. Acceptance criteria (security)
**SC1 — No install scripts.** `.npmrc` holds `ignore-scripts=true`; CI and the documented setup run
`npm ci --ignore-scripts`; Chromium comes from `node_modules/.bin/playwright install chromium`.
**SC2 — Loopback only.** Every test server binds `127.0.0.1`; the browser tests' port is `PW_PORT`
or derived from the repo path (so parallel worktrees don't collide), and Playwright never reuses
an existing server.
**SC3 — No run-time downloads.** Node tools run via `npm run` or `node_modules/.bin`; a missing
package fails, never fetches.
**SC4 — Pinned, aged dependencies.** Every pinned package, npm and Python, and the whole npm tree,
transitive packages included, resolved to versions published ≥7 days before this PR; exact
versions in `package.json`; lockfile committed with integrity hashes. `requirements-dev.txt`
installed with `--require-hashes`; `coverage` declares no dependencies, so it is the whole Python
tree. Chromium comes from Playwright's own download, pinned by the Playwright version: a stated
boundary, not aged.
**SC5 — CI scope unchanged.** `on: pull_request` (never `pull_request_target`),
`permissions: contents: read`, `persist-credentials: false`, no new secrets; every new action
pinned by SHA; caches keyed on the Playwright version with no `restore-keys`; failure artifacts,
if any, kept ≤7 days.
**SC6 — Safe link checker.** TLS verification on, no cookies or credentials, per-request timeout,
only `http(s)` redirects followed, no response body read — final or redirect. Tests: a redirect
to a non-http scheme fails; a GET with a large body and a 302 with a large body are each closed
after the status, the body unread.
**SC7 — Generated output ignored.** `.gitignore` covers `node_modules/`, `test-results/`,
`playwright-report/`, `.coverage`, `htmlcov/`, `.venv/`, `__pycache__/`.
