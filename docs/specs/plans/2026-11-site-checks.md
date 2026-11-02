# Site checks and CI — plan

Spec: `docs/specs/2026-11-site-checks.md` (criteria AC1–AC11, SC1–SC7). Tier B. One PR, branch
`ci/site-checks`, worktree `~/worktrees/nicolasluraschi.dev/ci/site-checks`.

QA: skip — the deliverable is the checks themselves; each is proven by a failing-fixture self-test
and nothing is browser-observable for a user.

## Decisions from conversation
- Exact versions, each published ≥7 days before 2026-11-01 (dates from `npm view <pkg> time` and
  PyPI): `html-validate@11.17.0` (2026-10-20), `@playwright/test@1.64.1` (10-14),
  `@axe-core/playwright@4.14.0` (10-15), `coverage==7.17.0` (10-22, no dependencies). Resolve the
  npm tree with `npm install --ignore-scripts --before=2026-10-25` so transitive packages are aged
  too; every pin predates that cutoff. Record the date in the PR.
- Node 24 (LTS) in CI via `.nvmrc`; Python 3.12 in CI (runner default), ≥3.11 locally.
- Python dev deps live in `.venv/` (PEP 668 blocks system pip on the runner); npm scripts call
  `.venv/bin/python` explicitly so a missing venv fails loudly.
- html-validate preset `html-validate:standard` (conformance rules); accessibility is axe's job.
- No test fixture may be linked from a site page. Fixtures are served only by the loopback test
  server.
- Action SHAs are resolved with `gh api repos/<owner>/<action>/git/ref/tags/<tag>` (dereference
  annotated tags) — never typed from memory.
- AC9–AC11 were added by the owner from Codex 1b-F01.
- Out of scope but flagged: AGENTS.md "Run locally" (`python3 -m http.server 8000`) binds all
  interfaces; fixing it is a one-word change for a later PR.

## Files
| Path | Change |
|---|---|
| `package.json`, `package-lock.json` | new — `private: true`, exact devDependencies, scripts |
| `.npmrc` | new — `ignore-scripts=true`, `save-exact=true` |
| `.nvmrc` | new — `24` |
| `requirements-dev.txt` | new — `coverage==7.17.0` with every PyPI file's sha256 |
| `.coveragerc` | new — `source = scripts`, `fail_under = 85`, `show_missing` |
| `.gitignore` | add `node_modules/ test-results/ playwright-report/ .coverage htmlcov/ .venv/` |
| `.htmlvalidate.json` | new — `extends: ["html-validate:standard"]` |
| `scripts/check.py` | new — static checks + `--external` |
| `tests/test_check.py` | new — unittest self-tests for `check.py` |
| `tests/fixtures/*` | new — one defect per fixture |
| `playwright.config.mjs` | new — Chromium only, loopback `webServer` |
| `tests/browser/*.spec.mjs` | new — html-validate API, axe, overflow, focus, tap targets, motion |
| `lefthook.yml` | add the static checks |
| `.github/workflows/ci.yml` | extend the single job |
| `.github/dependabot.yml` | add `npm` and `pip` entries |
| `AGENTS.md`, `docs/architecture.md` | Commands, layout, CI section |

## Approach
`scripts/check.py` exposes pure functions returning `Problem(file, rule, message)` lists;
`main()` prints `file: rule: message` and exits 1 if any. Default run: forbidden markup,
links/assets, contrast, on `index.html` and `how-i-work/index.html` with `style.css`.
`--external` runs only the link fetcher. Paths and the stylesheet are function arguments, so tests
point them at fixtures. Rule ids: `forbidden-script`, `forbidden-style-attr`,
`forbidden-style-element`, `forbidden-handler`, `missing-target`, `outside-root`,
`missing-fragment`, `contrast-text`, `contrast-ui`, `missing-token`, `missing-dark-block`,
`external-link`.

- HTML parsing with `html.parser.HTMLParser` (tags, attributes, ids).
- Links: every `href`/`src` that is not `http(s):`, `mailto:`, `tel:` or protocol-relative
  (`//…`, external), plus `url()` in the CSS. Join with `urllib.parse.urljoin` against the page's
  URL path (`/`, `/how-i-work/`; the stylesheet's is `/style.css`), take the path, then
  `urllib.parse.unquote` it. Map to `root / path.lstrip('/')`, `resolve()` it and the root, and
  require `is_relative_to(root)` before any other filesystem call; otherwise `outside-root`.
  `/x/` and `/x` → `x/index.html` when `x` is a directory. Fragments are checked against the ids of
  the destination page (parsed once, cached). `EXCLUDED = frozenset({...})` with a comment naming
  PR 3.
- Contrast: parse the first top-level `:root{}` and the `:root{}` inside
  `@media (prefers-color-scheme: dark)`; dark = light overridden by dark. WCAG relative luminance.
  `contrast_report(css)` returns every pair as `(scheme, fg, bg, ratio, threshold)`;
  `check_contrast` turns failing rows into problems; `main()` prints the report on every run.
  Text pairs ≥4.5, UI pairs ≥3.0, per spec §4. Missing token or block → its own rule.
- External: `urllib.request` with an opener that has **no** `HTTPRedirectHandler` (the stdlib one
  reads redirect bodies). Redirects are followed by hand, at most 5 hops: read `Location`, close the
  response unread, refuse any non-`http(s)` target. HEAD, then GET when HEAD is not 2xx/3xx; 10s
  timeout; 3 attempts with 2s backoff (the sleep is injectable so tests don't wait); no cookie jar;
  default TLS context; every response closed right after its status. 999 passes only when the
  host is `linkedin.com` or ends in `.linkedin.com`.
- Browser tests share a helper `tests/browser/helpers.mjs`: the page list, the scheme→literal `--bg`
  map (`rgb(244, 245, 245)` / `rgb(12, 18, 21)`), and `assertScheme(page, scheme)`.
  `webServer` runs `python3 -m http.server 8765 --bind 127.0.0.1` from the repo root,
  `reuseExistingServer: !process.env.CI`. Schemes through `page.emulateMedia({ colorScheme })`.
  - Axe: `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`.
  - Overflow: `await page.evaluate(() => document.fonts.ready)`, then `scrollWidth <= innerWidth`.
  - Focus: count focusable elements (`a[href], button, input, select, textarea, [tabindex]` not
    `-1`), press Tab that many times, and on each step read `document.activeElement`'s computed
    outline; the first must be `.skip`, with a bounding box inside the viewport.
  - Tap targets: 320px viewport, `getBoundingClientRect().height >= 44` for
    `.site-header a, .links a`.
  - Motion: `emulateMedia({ reducedMotion })`; all `a` have `transitionDuration` `0s` under
    `reduce`, and at least one doesn't under `no-preference`.
  - Each browser check is a function in the helper, so its fixture test calls the same code and
    asserts it reports the failure.

npm scripts:
```
"check": "npm run check:static && npm run check:html && npm run test:py && npm run test:browser",
"check:static": "python3 scripts/check.py",
"check:html": "html-validate index.html how-i-work/index.html",
"check:external": "python3 scripts/check.py --external",
"test:py": ".venv/bin/python -m coverage run -m unittest discover -s tests -p 'test_*.py' && .venv/bin/python -m coverage report",
"test:browser": "playwright test"
```

CI job, after gitleaks: `setup-node` (SHA, `node-version-file: .nvmrc`, `cache: npm`) →
`npm ci --ignore-scripts` → venv + `pip install --require-hashes -r requirements-dev.txt` →
`actions/cache` on `~/.cache/ms-playwright`, key `pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`,
no `restore-keys` → cache miss: `node_modules/.bin/playwright install --with-deps chromium`; hit:
`node_modules/.bin/playwright install-deps chromium` → `npm run check` → `npm run check:external`
(own step, so its failure is visible as such). Triggers, permissions and checkout unchanged.

## Tasks
1. **Toolchain** — `package.json`, lockfile, `.npmrc`, `.nvmrc`, `requirements-dev.txt`,
   `.coveragerc`, `.gitignore`. Carries SC1, SC3, SC4, SC7.
2. **Forbidden markup** (`check.py`) — a failing test per rule first, then code. AC6.
3. **Internal links, CSS assets, fragments, containment, exclusions** — AC2.
4. **Contrast from tokens, with the full report** — AC5.
5. **External links** — a loopback stub HTTP server in tests. AC3, SC6.
6. **HTML validity** — `.htmlvalidate.json`, `check:html`, a spec using the `HtmlValidate` API:
   passes on both pages, fails with its rule on each of the two fixtures. AC1.
7. **Browser harness + axe in both schemes** — `playwright.config.mjs`, `helpers.mjs`,
   `a11y.spec.mjs`, the two axe fixtures. AC4, SC2.
8. **No horizontal scroll** — `overflow.spec.mjs`, wide fixture. AC7.
9. **Keyboard focus** — `focus.spec.mjs`, `outline: none` fixture. AC9.
10. **Tap targets** — `tap-targets.spec.mjs`, short-link fixture. AC10.
11. **Reduced motion** — `motion.spec.mjs`, unconditional-transition fixture. AC11.
12. **Entry point and hook** — npm scripts, `lefthook.yml` (`python3 scripts/check.py`,
    `node_modules/.bin/html-validate index.html how-i-work/index.html`). AC8.
13. **CI and Dependabot** — `ci.yml`, `dependabot.yml` (`npm` at `/`, `pip` at `/`, monthly,
    `cooldown.default-days: 7`, minor/patch grouped). AC8, SC5.
14. **Docs** — AGENTS.md (layout rows for `scripts/`, `tests/`, `package.json`; Commands: setup,
    site checks, external links; remove the TODO), `docs/architecture.md` CI section. AC8.

## Tests (each traces to a criterion)
- `tests/test_check.py`:
  - AC6: one test per forbidden rule.
  - AC2: missing root-relative target; missing relative `src`; missing CSS `url()` asset;
    `%2e%2e/%2e%2e/outside.css` → `outside-root`; missing same-page fragment; missing cross-page
    fragment; directory resolution; protocol-relative link not treated as internal; exclusions
    list exact.
  - AC5: report on `style.css` lists all pairs, lowest light `--muted`/`--surface` 5.85; low-contrast
    fixture; missing token; missing dark block.
  - AC3, SC6 (stub server on 127.0.0.1): 404/404 fails; 405→200 passes; 302→200 passes; 999
    non-LinkedIn fails; LinkedIn 999 classifier passes; redirect to `ftp:` fails; GET with a large
    body and 302 with a large body both closed unread (the stub records bytes sent before reset);
    3 attempts on failure.
  - `main()` exits 0 on the site and 1 on a fixture.
- `tests/browser/`: `html.spec.mjs` (AC1), `a11y.spec.mjs` (AC4), `overflow.spec.mjs` (AC7),
  `focus.spec.mjs` (AC9), `tap-targets.spec.mjs` (AC10), `motion.spec.mjs` (AC11) — each with the
  site passing and its fixture failing on its own rule.
- Verification: `npm run check` green on today's site; `npm run check:external`; coverage
  ≥85% on `scripts/check.py`; `lefthook run pre-commit`.
