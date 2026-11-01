# Design references
Visual references for the site. **Documentation, not source.** The authority map for frontend work:
the `frontend-iteration` skill reads it before writing HTML or CSS.

## Files
| File | What it is | Authority | Do not take |
|---|---|---|---|
| _(none yet)_ | The Claude Design output lands here | — | — |

## Fixed before any reference
These were decided with the owner and no design output overrides them:
- Plain semantic HTML and one `style.css`; no JavaScript, no framework, no web-font service
  unless the owner approves it.
- Text first. One font stack, one accent colour.
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
