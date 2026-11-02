---
# Workflow profile (L2). Calibration only; project facts live in AGENTS.md.
artifacts: docs/specs
codex_reviewer: yes
gates: 1b,2b
commands_ref: AGENTS.md
docs_technical_language: en
docs_product_language: en
---

# nicolasluraschi.dev — workflow profile

## Calibration

- One person: the owner writes every word of copy, approves every plan and merges every PR. AI
  agents write the HTML, CSS and checks.
- Scale: a two-page static personal site plus a CV PDF. No backend, no users, no data, no
  JavaScript, no build step. Traffic is a handful of recruiters and hiring managers.
- Deployment: GitHub Pages from `main`. A bad change is noticed in review or by CI; rollback is a
  revert. Until launch the repo is private and Pages is off, so nothing is served.
- What is high-stakes here: every factual sentence must be true and defensible in an interview;
  nothing private (client or colleague names, client metrics, references' details, phone number)
  may ever enter a commit, because the history becomes public at launch; WCAG AA in both colour
  schemes; supply-chain hygiene for the dev-only toolchain.
- Deliberately good enough: the design is final and not up for review; a single CI job to save
  minutes on the private repo; the 720–760px hero `h1` overhang is known and accepted; no
  analytics, no CSP headers (Pages can't set them), no performance budgets.
