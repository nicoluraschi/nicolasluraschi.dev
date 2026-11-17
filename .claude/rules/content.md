---
paths:
  - "**/*.html"
  - "README.md"
---

# Copy rules (site pages)
The site is public and read by people deciding whether to hire the owner. Every factual sentence
must be backed by the owner's private, verified record at `~/.claude/cv-dossier/dossier.md`. Read
it before writing copy; never copy it, or anything private from it, into this repo.

## Facts
- A fact not in the owner's verified record does not go on the site. Ask instead of inferring.
- Neocoast, the employer, may be named. Clients and colleagues are never named; describe clients by
  domain ("a US EdTech student-retention platform").
- No client metrics, no usage or traffic numbers for personal projects, no invented numbers.
- Roles are stated as held ("co-led an area of about 35 people"); a headcount never follows "led"
  or "managed".
- A project's stack line may list the technologies it runs on. Claims about the owner's depth in a
  skill follow the record's skill levels, not the stack line.

## Authorship
- Personal projects are "designed and owned by me, built with AI agents". Never "implemented by me",
  "hand-coded" or "I wrote the code".
- Keep claims about review to what the workflow actually does: "I own the plan, the trade-offs and
  what gets merged".

## Checking
Before every PR that changes copy, run the banned-phrase and watch-word scan, which lives outside
the repo because its lists name clients. It scans a copy of the public copy (the pages, the
README and the link-preview card's source), not the repo, whose docs, tests and binaries carry
known hits:
`d=$(mktemp -d) && cp -R index.html README.md how-i-work scripts/_og-card.html "$d" && python3 -I ~/.claude/cv-dossier/scan.py "$d"`
It exits non-zero on any unexpected hit; approved exceptions are listed in the script. It takes a
directory: given a file path, it scans nothing and reports 0 hits. A new page joins the list.
Docs, `AGENTS.md`, `.claude/` and commit and PR text are public but not scanned: name no client
or colleague in them.

## Gates that apply here
`frontend-iteration` before any HTML or CSS; `ui-review` before calling a page done.
