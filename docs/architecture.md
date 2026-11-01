# Architecture
When a decision changes, update this file (and the relevant ADR) in the same PR.

## Overview
Static files served by GitHub Pages from the root of `main`. No build step: what is in the repo is
what is served. Each page is a directory with an `index.html`, so URLs have no `.html` suffix
(`/how-i-work`). Every page links the single `style.css`.

## Decisions
- Plain HTML and one CSS file, no framework, no JavaScript: `docs/adr/0001-plain-static-html.md`.
- Visibility: the repo stays **private with Pages off** until the owner approves launch. GitHub
  Pages on the free plan needs a public repo, so launch is one sequence: make the repo public,
  enable Pages from `main` with the custom domain, add the DNS records below, enforce HTTPS, then
  turn on branch protection requiring CI (also a public-repo feature on the free plan).
- Because the history becomes public at launch, nothing private enters any commit, ever.

## DNS (added at launch)
Apex `nicolasluraschi.dev`: A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
`185.199.111.153`; AAAA records `2606:50c0:8000::153`, `2606:50c0:8001::153`,
`2606:50c0:8002::153`, `2606:50c0:8003::153`. `www`: CNAME `nicoluraschi.github.io.` The domain is
already verified on the GitHub account (TXT record), which blocks takeover while Pages is off.
`.dev` is HSTS-preloaded, so the site loads only once GitHub has issued its certificate.

## Quality tooling & CI
- Local hooks (`lefthook.yml`, run `lefthook install` once per clone): gitleaks on staged changes.
- CI (`.github/workflows/ci.yml`): gitleaks over the full history on every PR and push to `main`.
  While the repo is private these minutes count against the shared Actions quota; the job runs in
  well under a minute.
- Dependabot (`.github/dependabot.yml`): GitHub Actions versions, monthly, 7-day cooldown.
- The site checks (`scripts/check.py`) join hooks and CI with the first site PR.

## Reference
- Principles: `docs/constitution.md` · Copy rules: `.claude/rules/content.md` · Design references:
  `docs/design/README.md`
