---
paths:
  - "**/*.html"
  - "README.md"
---

# Copy rules (site pages)
The site is public and read by people deciding whether to hire the owner. Every factual sentence
must be backed by the owner's private, verified record, which lives **outside this repo** and is
never copied into it.

## Facts
- A fact not in the owner's verified record does not go on the site. Ask instead of inferring.
- Neocoast, the employer, may be named. Clients and colleagues are never named; describe clients by
  domain ("a US EdTech student-retention platform").
- No client metrics, no usage or traffic numbers for personal projects, no invented numbers.
- Roles are stated as held ("co-led an area of about 35 people"); a headcount never follows "led"
  or "managed".

## Authorship
- Personal projects are "designed and owned by me, built with AI agents". Never "implemented by me",
  "hand-coded" or "I wrote the code".
- Keep claims about review to what the workflow actually does: "I own the plan, the trade-offs and
  what gets merged".

## Checking
The banned-phrase and watch-word scan runs from outside the repo, because its list itself contains
names that must not be published. Run it before every PR that changes copy.

## Gates that apply here
`frontend-iteration` before any HTML or CSS; `ui-review` before calling a page done.
