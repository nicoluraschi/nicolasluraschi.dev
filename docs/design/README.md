# Design references
Visual references for the site. **Documentation, not source.** The authority map for frontend work:
the `frontend-iteration` skill reads it before writing HTML or CSS.

## Files
| File | What it is | Authority | Do not take |
|---|---|---|---|
| `DESIGN.md` | The final design handoff (direction "H3"): editing rules, page structure, tokens, open items | The look: layout, structure, type scale, spacing, colour values, the self-hosted Fraunces font | Its "Not done yet" list is status, not scope: each item is the owner's pick |

## Fixed before any reference
These were decided with the owner and no design output overrides them:
- Plain semantic HTML and one `style.css`; no JavaScript, no framework, no web-font service
  unless the owner approves it. The owner approved one self-hosted font, Fraunces (`fonts/`).
- Text first. One font, one accent colour. (Two stacks, `--font` and `--font-display`, differ only
  in the metric-adjusted fallback shown while Fraunces loads.)
- Light and dark via `prefers-color-scheme`; both must meet WCAG AA contrast.
- Mobile-first; readable at 320px wide with no horizontal scroll.

## Copy is not a design decision
The copy comes from the approved drafts, not from a mockup. A design that shortens, rewrites or
invents text is a layout proposal; the words stay as approved unless the owner changes them.

## Where styling comes from
`style.css` is the only source of styles. Surface visual gaps instead of inventing defaults.

## Where product assets go
Anything the site serves belongs at the repo root (or its page directory), not here. This folder
holds only what documents a decision.
