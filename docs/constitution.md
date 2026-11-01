# Constitution

The enduring principles that govern how nicolasluraschi.dev is built. Plans must respect these;
when one needs to break a principle, that is a conversation, not a silent exception. Technical
decisions live in `docs/architecture.md`.

## Prime directive

**Every claim must survive an interview.** The site exists to get a remote senior backend or
technical lead role. A sentence that sounds better but can't be backed up costs more than it
gains. When accuracy and polish conflict, accuracy wins.

## Product ownership

The owner (Nicolás) decides copy, positioning, look and what gets published. When something depends
on one of those decisions, stop and flag it; do not guess. Anything published becomes public and
may be cached or indexed, so publication is never assumed.

## Scope discipline

v1: the home page, `/how-i-work`, and the public CV PDF.

**Deferred, not cancelled**: the RunHub and Marginalia case studies, `/writing`, a Spanish version,
analytics, any JavaScript. If a task seems to need one of these, stop and ask.

## Collaboration model

Claude Code writes the HTML, CSS and checks. The owner keeps visibility and control through
approval gates, and owns every word of copy.

- **Approval is at the plan, not the diff.** Once the plan is approved, Claude Code implements it
  fully, without pausing to show each edit. The owner reviews the result as a PR.
- **Tests first, never skipped.** Behaviour the site promises (structure, links, accessibility,
  no private data) is checked by `scripts/check.py`: failing check first, then the change.
- **Planning is human-first.** The owner decides what to work on and in what order.
- **No silent scope creep.** A task that needs changes beyond what was asked stops and asks.

## Delivery

- Small, frequent PRs: green on its own, leaves `main` working, one reviewable concern.
- Feature branches only, never `main`. Open PRs with `gh pr create`. Never push to `main`, never
  merge a PR: the owner reviews and merges.
- Never weaken a security or CI check to make a build pass.

## Language

English for code, comments, commits, docs and site copy.
