# 0001. Plain static HTML and one CSS file

## Context
The site is two pages of text and a PDF, maintained by one person a few hours a week. Its readers
are recruiters and hiring managers, often on a phone. It must load fast, read well, stay
accessible and survive months without attention.

## Decision
Hand-written semantic HTML, one stylesheet, no JavaScript, no build step, served by GitHub Pages.
Light and dark come from `prefers-color-scheme`; nothing needs a toggle.

## Alternatives considered
- **A JavaScript framework**: a build, dependencies and their update churn for two pages of
  text. Nothing on the site needs client-side code.
- **A static site generator (Jekyll, Hugo, Eleventy)**: templates would remove some duplication
  between pages (head, footer), but add a toolchain to learn and keep current. Two pages don't
  repay that.
- **A hosted builder**: less control over markup and accessibility, and the site's source would not
  itself show how the owner works.

## Consequences
- Nothing to update, nothing to break; the repo is the deployment.
- The shared `<head>` and footer are duplicated across pages and must be kept in step by hand;
  `scripts/check.py` guards the parts that matter.
- No JavaScript means no analytics and no interactive elements, by design.

## Revisit triggers
- More than about five pages, or a page type that repeats (a `/writing` section with several
  posts): the duplication starts to cost more than a generator would.
- A real need for client-side behaviour.
