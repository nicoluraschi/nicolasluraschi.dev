# Claude Design brief: nicolasluraschi.dev v1

Paste everything below the line into Claude Design.

---

## What I need

A visual direction for my personal developer site, nicolasluraschi.dev: two pages, home and an
essay. Explore 2–3 distinct directions, then refine one. The final output must translate directly
into **hand-written semantic HTML and a single CSS file, with no JavaScript**. Give me the
stylesheet as CSS custom properties (colours, font stack, type scale, spacing), plus the markup
structure for both pages.

## Who reads it

Recruiters and hiring managers filling remote senior backend or technical lead roles, mostly at US
companies. They skim, often on a phone, often for under a minute. They should see within seconds
who I am and what I've shipped, and be one tap away from my CV.

## Personality

Quiet, precise, confident without selling. An engineer's notebook, not a landing page. Text first:
the typography is the design. No hero illustration, no photo, no gradients, no cards with shadows
competing for attention, no "Hi, I'm…" waving emoji.

## Hard constraints

- No JavaScript of any kind: no toggles, menus, animations driven by script, carousels or tabs.
- One font stack only. A system stack is preferred; one self-hosted web font is acceptable if you
  make the case.
- One accent colour, used sparingly (links, one or two markers).
- Light and dark from `prefers-color-scheme`, both designed, not dark as an afterthought. WCAG AA
  contrast in both, including link and muted text.
- Mobile-first: designed at 360px, readable at 320px with no horizontal scroll, comfortable line
  length on desktop (about 65–75 characters).
- Visible keyboard focus; any motion respects `prefers-reduced-motion`.
- Links must look like links without hover (touch screens have no hover).
- **The copy below is final.** Don't shorten, rewrite or add text. If a layout needs different
  words, show it with a note and I'll decide.

## Page 1: `/` (home)

Sections in this order. The selected-work items are "cards" in content terms, but they can be a
plain list if that reads better.

### Header
**Nicolás Luraschi**
Senior backend engineer and technical lead. Ruby on Rails and PostgreSQL, nine years building
software for US clients.

I build with AI coding agents under explicit verification: plan first, tests first, independent
review. AI writes most of the code; I own the plan, the trade-offs and what gets merged.

Montevideo, Uruguay (UTC-3) · Open to remote senior backend or tech lead roles.

### Selected work
1. **RunHub** · runhub.uy (external link)
   Lists running races in Uruguay. In production since August 2026, with a non-technical product
   owner. Before automating data entry, I ran a blind test of LLM extraction against 29 races
   checked by hand, with the bar set in advance at 80% fully correct records. It missed (25–55%),
   so the design changed to AI discovery with human approval, which is what runs today.
   Rails 8.1 API, PostgreSQL, Gemini, Sentry. *Case study coming.*
2. **How I work with AI** → /how-i-work (internal link)
   Claude writes, Codex reviews, I decide. Risk-sized process, tests first, hooks that enforce the
   rules, and a second model as reviewer.
3. **Marginalia** · readmarginalia.app (external link, labelled invite-only)
   A private reading journal: library, highlights captured from a photo with in-browser OCR, and
   reflections. Rails 8.1 API with Solid Queue, PostgreSQL on Supabase, nightly verified backups
   with a restore runbook, data export and account deletion.

Below the list: Both apps were designed and are owned by me, and built with AI agents. The code is
private; I'm happy to walk you through it.

### Experience: Neocoast, Jul 2017 – Apr 2026
A Montevideo software consultancy serving mainly US clients.
- **Head of Technology (2024–2026).** Co-led the engineering area, about 35 people across roughly
  10 client projects, while staying hands-on as technical and project lead.
- **Software Engineer, junior to senior (2017–2024).** Five years on a US EdTech
  student-retention platform: led the backend side of its move from a Rails monolith to a Rails
  API with a React SPA, and its Ruby and Rails upgrades.
- Sole backend developer and project lead on a B2B ticket-resale pricing and analytics platform, a
  Rails 7 API built from scratch.
- Also a fintech internal-operations platform (Rails, Hotwire) and an industrial data-collection
  system.

### Now (November 2026)
Looking for a remote senior backend or technical lead role. Running RunHub and Marginalia in
production. Learning TypeScript and Node.js by building Winnow, an agent that picks what deserves
your time.

### Contact
CV (PDF) · LinkedIn · GitHub · n.d.luraschi@gmail.com
The CV link is the primary action on the page; make it easy to find without turning it into a
marketing button.

## Page 2: `/how-i-work` (essay)

A long-form reading page. Needs a clear way back to home. Section headings below are `h2`.

**How I work with AI** (page title, `h1`)
AI writes most of my code. I own the plan, the trade-offs and what gets merged. This is the setup
that makes that hold.

**The idea in one line.** Claude writes, Codex reviews, I decide.

**The tools**
- **Claude Code** (Anthropic) is the main agent: it plans, writes code and tests, and runs the
  checks. Smaller, cheaper models handle searching and routine sub-tasks.
- **Codex CLI** (OpenAI) gives a second opinion from a different provider. On high-risk work it
  critiques the spec, the plan and the final diff, read-only.
- **Zed** is where I read and review code. I rarely type code in it.
- **GitHub** holds every change as a small pull request.

All of it lives in one versioned repository. The files *are* the live setup: change one and the
next session behaves differently.

**How a piece of work flows** (ordered list)
1. **Classify it out loud.** A one-line fix, a routine feature and a change touching login, money
   or personal data each get a different amount of process.
2. **Plan, then wait for my "go".** The plan states what's in, what's out, how we'll know it
   works, and every assumption as a question. No code before I approve it.
3. **Tests first.** A failing test, then the code that makes it pass.
4. **Review in proportion to risk.** Routine work gets an automated code review. Risky work also
   gets a security threat model, a written spec and Codex's critique.
5. **Prove it.** "Done" means I've seen the real test output, not a claim that it passed.
6. **One small PR per concern**, each in its own isolated copy of the repository, so parallel
   sessions never collide.

**What's automatic and what's mine**
Much of the know-how is packaged as *skills*: instructions the agent loads for a specific job,
like a security audit, a UI review or test-driven development.

The AI follows written instructions most of the time, not always. So the rules that matter are
enforced by *hooks*, small scripts that can block an action: no edits on the main branch, no
commit while tests are red, no ending a session while a security audit is owed.

What stays mine: approving plans, product and taste calls, anything touching security or privacy,
and the final merge. When in doubt, the agent stops and asks.

**Principles**
- **Plan before code.** Most of my alignment with the AI happens at the plan, not the diff.
- **Small diffs.** A change I can't review properly is a change I shouldn't merge.
- **Security is never skipped** for looking small.
- **Two providers, not one.** The model that wrote the code doesn't get the last word on it.
- **Measure the setup itself.** I audit token cost and time from real sessions and drop the
  process that doesn't pay for itself.
- **Each project keeps its own facts.** The workflow says *how* I work; each repository says what
  it is.

**Checking myself**
- Am I merging diffs I haven't actually read?
- Did the plan get a real "go", or did I wave it through?
- Is any piece of process here something I'd drop if I measured it?
- Would this page still describe what the setup does today?

## Shared elements

- A minimal site header or name link back to home on the essay page. No navigation bar is needed
  for two pages; if you add one, it must work without JavaScript.
- A short footer: © 2026 Nicolás Luraschi, plus the contact links again if it helps.

## What to deliver

1. 2–3 directions at phone and desktop width, light and dark, for the home page.
2. The chosen direction refined for both pages.
3. The CSS custom properties (light and dark values), font stack, type scale and spacing scale.
4. Notes on anything you'd want to use JavaScript for, and how you'd do it without.
