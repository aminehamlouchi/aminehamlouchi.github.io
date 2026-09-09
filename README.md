# aminehamlouchi.github.io

Personal portfolio — hand-built with plain HTML, CSS, and JavaScript. No framework, no build step; it deploys straight from GitHub Pages.

Design: "amber terminal" — warm black / parchment / amber phosphor, bilingual (English + Arabic) identity, and a particle hero that morphs between **أمين** and **AMINE**. Press `/` anywhere on the home page for the interactive terminal.

## Files

- `index.html` — home: featured work, repos, arcade, experience, skills, about, contact
- `resume.html` — resume page (`assets/amine-hamlouchi-resume.pdf` is the source of truth)
- `checkers.html`, `tic-tac-toe-3d.html` — playable game cartridges
- `assets/styles.css` — the whole design system
- `assets/script.js` — particle field, reveals, cursor, magnetic buttons, terminal
- `assets/fonts.css` + `assets/fonts/` — self-hosted Clash Display, JetBrains Mono, Reem Kufi
- `assets/vendor/` — self-hosted GSAP (ScrollTrigger, SplitText) and Lenis, both free/MIT for this use
- `alnur/` — separate mini-site for Alnur Mosque Islamic Center (own styling, untouched by the portfolio design)
- `.nojekyll` — keeps GitHub Pages from running Jekyll transforms

## Local preview

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deployment

GitHub Pages serves this repository from the `main` branch at `https://aminehamlouchi.com/`.
