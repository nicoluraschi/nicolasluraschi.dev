# Real assets and the deferred checks — spec
**Status:** approved
**Date:** 2026-11-02

## 1. Outcome
The site ships its real CV and project screenshots, and the checks deferred from
`docs/specs/2026-11-site-checks.md` close the gaps they left: a missing asset fails again, leftover
placeholder text fails, and every `srcset` candidate is held to the rules `src` already meets. For
the recruiters who download the CV and the owner who reviews PRs.

## 2. Scope
**In**
- `luraschi-cv.pdf`, `img/runhub.png`, `img/marginalia.png` (assets prepared in §4).
- `index.html`: the LinkedIn href gets the real handle; the Marginalia `alt` matches the new shot.
- `scripts/check.py`: the exclusion list goes; a placeholder check; `srcset` checking.
- One fixture per new rule and self-tests, coverage ≥85% on `scripts/check.py`.
- Docs: `docs/specs/2026-11-site-checks.md` status done; AGENTS.md and `docs/architecture.md`.

**Out**
- `CNAME` and how Pages serves only the site (launch PR).
- The pre-commit staged-snapshot issue; the "Run locally" bind address.
- The 720–760px hero `h1` overhang.
- Any other copy or design change, including `srcset` variants of the screenshots.
- Checking image dimensions against `width`/`height`, or the PDF's content, in `scripts/check.py`.
- The tools used to prepare and verify the assets: they stay outside the repo.

## 3. Constraints
- The repo becomes public at launch with its full history: an asset is final before its first
  commit, and nothing private enters any commit, ever.
- `scripts/check.py` stays Python ≥3.11 stdlib only. No new dependency.
- Today's pages must pass every check once this PR's changes are in.

## 4. Decisions
**Made**
- CV: the October Drive export (WeasyPrint), with both references' emails, their `mailto:` links,
  the REFERENCES heading and both names removed — owner. Nothing else in it changes.
- Screenshots: Playwright, 1280x800 viewport, device pixel ratio 1, light scheme — owner.
  - RunHub: `https://runhub.uy/?dist=21`, top of page, with the runner-of-the-week card (a third
    person's name, photo and quote) hidden by `visibility: hidden` — owner.
  - Marginalia: `/library` of a test account holding public-domain books only — owner.
- The three assets were approved by the owner on 2026-11-02, before any commit (SC1).
- Placeholder definition — owner: marker tokens, filler text, dummy URLs (AC2).
- The exclusion mechanism is removed, not left empty: with no deferred asset it has no use.
- 1s: no Critical — 3 High, 3 Medium; R1–R8 folded into §8; R6 and R8 to the owner.
- 1b: RESOLVED — 2 accepted, 0 rejected, 0 human.
- 2s: clear to implement — 0 gaps; 2 recommendations folded into plan task 7.
- 2b: CONCERNS — 2 accepted, 0 rejected, 1 human.
- 2b-F01 (human): round 2 found the removed-name search missing from task 1; added after round 2
  and run on the approved CV, zero hits — owner confirmed at plan approval.
- Review: `/code-review high` instead of `ultra` — owner. 6b not run: `docs/ai-profile.md` enables
  only 1b and 2b.
- `srcset` and `imagesrcset` are read on any element, not only `img`, `source` and `link`: wider
  than AC3, never narrower.
- One set of URL-bearing attributes (`href`, `src`, `action`, `formaction`, `xlink:href`, and
  `srcset`/`imagesrcset` candidates) serves the link and placeholder checks: wider than AC2 and
  AC3, from code review.
- A URL that cannot be parsed fails as `malformed-url` (pages and stylesheet) instead of crashing
  the run, with its own fixture — from code review.

- R6: the CV text meets AGENTS.md's guardrails (no phone or address, Neocoast the only employer
  named, clients described by domain, no client metrics) — owner, 2026-11-02.
- R8: the LinkedIn href, opened logged out, is the owner's profile — owner, 2026-11-02.

**Open**
- None.

## 5. Task breakdown
In the plan: `docs/specs/plans/2026-11-real-assets.md`.

## 6. Acceptance criteria
**AC1 — Assets present, exclusions gone**
- Given both pages, then every internal `href`, `src` and `srcset` URL resolves, the CV and both
  screenshots included, with no exclusion list in `scripts/check.py`.
- Given the existing missing-asset fixtures, then each still fails.
- `img/runhub.png` and `img/marginalia.png` are PNGs of exactly 1280x800 pixels.

**AC2 — Placeholder check** (rule `placeholder`, both pages)
- Scanned: text nodes, HTML comments, and every attribute value.
- Given `YOUR-` followed by an uppercase letter (`YOUR-HANDLE`), then it fails naming the token
  and line.
- Given `TODO`, `TBD`, `FIXME` or `XXX` as whole, uppercase words, then it fails.
- Given `lorem ipsum` in any letter case, then it fails.
- Given a URL attribute (`href`, `src`, `srcset`, `action`) whose host is `example.com`,
  `example.org`, `example.net` or a subdomain of one, then it fails.
- Given `href="#"`, or an `href` that is empty or only whitespace, then it fails.
- Fixtures: the marker token once each in a text node, a comment and an attribute value, each its
  own fixture; one fixture per remaining bullet. Each fails with `placeholder` only.
- Given a fixture holding `todo`, `Todos`, `XXXL`, `example.company.com` and `href="#main"`,
  then it passes.

**AC3 — `srcset` candidates** (`<img>` and `<source>` `srcset`, `<link>` `imagesrcset`)
- Given a candidate list, then each candidate's URL (the text up to its whitespace, a trailing
  comma removed) is checked as `src` is: internal URLs resolve, `outside-root` and
  `missing-fragment` and null-byte rules apply; external ones join the `--external` set.
- Given a fixture whose second candidate is missing (`a.png 1x, missing.png 2x`, with `a.png`
  present), then it fails naming `missing.png` only.
- Given a URL containing a comma (`/img/a,b.png 2x`), then it is read as one URL.
- Given an empty `srcset`, then it passes the srcset rule (html-validate judges validity).

**AC4 — Copy edits**
- `index.html`'s LinkedIn link is exactly `https://www.linkedin.com/in/nicolas-luraschi-pereira`.
- The Marginalia `img` `alt` is exactly "Marginalia: a reading library with the book in progress
  and shelves by status".
- `python3 -I ~/.claude/cv-dossier/scan.py <dir>` over a copy of the two served pages reports 0
  unexpected hits (run over `.`, it also walks `.venv/` and `node_modules/`).

**AC5 — Self-tests**
- Every new fixture fails on its own rule only, asserted by rule name.
- `npm run check` passes; coverage on `scripts/check.py` ≥85%.

**AC6 — Docs**
- `docs/specs/2026-11-site-checks.md` reads **Status:** done.
- AGENTS.md's "Still to add" line names only `CNAME`; the repo layout matches the tree.
- `docs/architecture.md`'s site-checks line names the placeholder and `srcset` checks.

## 7. Security requirements
From 1s (STRIDE, no Critical) and 1b-F01. Deferred: HTTPS and Pages serving only the site (launch
PR); spam to the owner's public email (accepted, owner).

## 8. Acceptance criteria (security)
**SC1 — Approved before first commit.** Each asset's first commit is the owner-approved file; no
earlier revision of any asset exists in any commit or pushed ref. If a private byte is ever
pushed, work stops: the remedy is recreating the repo, not rewriting history.
**SC2 — Explicit staging.** Assets are staged by explicit path. The unpatched CV, drafts and the
preparation tools never sit inside a worktree or the main checkout. Before every push,
`git diff --stat main...HEAD` lists only in-scope files.
**SC3 — Clean PDF.** The committed PDF has one xref section and one `%%EOF`, no unreferenced
objects; every stream is decompressed and scanned; its outline, named destinations and link
annotations hold no email or `mailto:` other than the owner's and no removed name. The PR states
the results without the searched-for strings.
**SC4 — Clean screenshots.** The owner reviewed both PNGs at full size: no person other than the
owner (name, face, handle, quote), no account identifier. Each PNG holds only critical and colour
chunks: no `tEXt`, `iTXt`, `zTXt`, `eXIf` or `tIME`.
**SC5 — No private strings in text.** The spec, plan, PR body, commits, fixtures and tests never
hold the references' names or emails, the RunHub person's name, or any other private value. Any
scan for removed strings stays outside the repo.
**SC6 — Reviewed bytes are committed bytes.** The PR body records each asset's sha256 as approved;
each matches `git cat-file -p HEAD:<path> | shasum -a 256`.
**SC7 — Owner rulings.** R6 and R8 (§4 Open) are answered before the first commit.
