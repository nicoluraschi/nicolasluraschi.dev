@AGENTS.md

## Claude Code

- The default loop (classify → trivial or light: plan+TDD / Tier A/B: `feature-workflow`; plan-gate,
  then apply without stop-and-show) lives in `~/.claude/CLAUDE.md` and applies here — don't restate it.
- Project specifics: use plan mode for any change outside `docs/`; frontend work starts with the
  `frontend-iteration` skill (loads design refs + their authority rules); any copy, drafted
  in chat or written to a file, follows `.claude/rules/content.md` (read it first: it loads
  automatically only for HTML files).
- Who writes what, TDD, and review-at-PR: see the collaboration model in `docs/constitution.md`.
- Personal cross-project preferences load from `~/.claude/CLAUDE.md` — don't duplicate them here.
