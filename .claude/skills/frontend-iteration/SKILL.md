---
name: frontend-iteration
description: Use before any HTML or CSS work on nicolasluraschi.dev — a page, the stylesheet, layout, colour or typography. Loads the design references and their authority rules before writing markup or styles.
---

# Frontend iteration

Before writing any HTML or CSS, read `docs/design/README.md`. It lists each design reference, what
it is authoritative for and what not to take from it, plus the decisions fixed before any
reference existed.

## Authority

- The Claude Design handoff (in `docs/design/`, once it lands) governs the look: layout, spacing,
  type scale, colour values.
- The approved copy governs the words. A mockup that changes text is not a copy decision; keep the
  approved wording and flag the difference.
- `docs/adr/0001-plain-static-html.md` governs the technology: no JavaScript, no framework, one
  stylesheet. A design that needs JavaScript to work is adapted to plain HTML/CSS, and the
  adaptation is named in the PR.

## Where styling actually comes from

`style.css` is the only stylesheet. Colours, font stack and spacing live there as custom
properties, defined once and swapped for dark mode inside `prefers-color-scheme: dark`. No inline
styles, no second stylesheet, no external CSS.

## Visual questions with no answer

If the references don't settle something (a hover state, a dark-mode colour, a breakpoint), ask the
owner. Don't invent a default and don't copy one from another project.

## Before done

`ui-review` review mode on both pages, light and dark, at phone and desktop widths.
