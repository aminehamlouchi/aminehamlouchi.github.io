# aminehamlouchi.github.io

Personal site, served by GitHub Pages at [aminehamlouchi.com](https://aminehamlouchi.com). Hand-built with plain HTML, CSS, and JavaScript. No framework, no build step; pushing `main` publishes.

## Design (2026)

- **Identity**: bilingual English/Arabic, with Arabic as real content in the name and section labels and as a faint Kufi accent in section corners.
- **Hero**: a live ten-fold girih lattice drawn on a canvas (brightens under the pointer, breathes slowly) beside a paper-cutout portrait on a spotlit stage (Three.js, desktop only). A receipts ticker runs under it: every figure on the site traces to the résumé or a public repo.
- **Type**: Bricolage Grotesque (display), Hanken Grotesk (body), IBM Plex Sans Arabic, Reem Kufi (accents), JetBrains Mono (status, receipts, terminal). All self-hosted and subset in `assets/fonts/`.
- **Colour**: dark by default, with a light theme that follows the system and a toggle in the header. One accent, a zellige green-teal.
- **Motion**: GSAP + ScrollTrigger + SplitText and Lenis, all vendored in `assets/vendor/`. Everything is gated on `prefers-reduced-motion`; the page reads at rest with no JavaScript at all.
- **Terminal**: press `/` anywhere. Try `help`, `receipts`, `flip`, `girih`, `play checkers`, and the Konami code.

## Files

- `index.html` — home
- `resume.html` — résumé (the PDF at `assets/amine-hamlouchi-resume.pdf` is the source of truth)
- `checkers.html`, `tic-tac-toe-3d.html` — playable game cartridges (`assets/checkers.js`, `assets/tictactoe3d.js`)
- `assets/styles.css` — the whole design system, both themes
- `assets/script.js` — theme, lattice, reveals, hover list, terminal, easter eggs
- `assets/bust.js` — the paper cutout on its stage (Three.js module, loads only on wide screens with WebGL)
- `assets/fonts.css`, `assets/fonts/` — self-hosted fonts
- `assets/previews/` — screenshots of live projects for the work list
- `alnur/` — a separate production site for Alnur Mosque Islamic Center, with its own gallery pipeline in `.github/workflows/alnur-gallery.yml` and `scripts/`. Not part of the portfolio design.
- `CNAME`, `.nojekyll` — domain binding and Jekyll bypass. Do not remove.

## Local preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Accuracy

Every number and claim on the site traces to the résumé (`assets/amine-hamlouchi-resume.pdf`) or a repository under [github.com/aminehamlouchi](https://github.com/aminehamlouchi). The terminal's `receipts` command lists them with their sources.
