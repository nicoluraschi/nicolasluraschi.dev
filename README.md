# nicolasluraschi.dev

Source of [nicolasluraschi.dev](https://nicolasluraschi.dev): plain HTML and one CSS file, served by
GitHub Pages.

Run it locally with `python3 -m http.server 8000` and open http://localhost:8000.

Check it with `npm run check` (static checks, HTML validation, self-tests and browser checks
including accessibility); setup is in `AGENTS.md`. CI also runs gitleaks and an external-link check.

Built with AI coding agents under the workflow described on the site's
[How I work](https://nicolasluraschi.dev/how-i-work) page; `AGENTS.md` and `docs/` are that
workflow's project layer.
