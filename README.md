# Amine Hamlouchi Personal Website

A lightweight static personal website with an intro page and a resume page. It is designed to deploy directly from GitHub Pages without a build step.

## Files

- `index.html` - intro page
- `resume.html` - resume page
- `assets/styles.css` - shared responsive styling
- `assets/script.js` - motion canvas, icons, and header behavior
- `.nojekyll` - keeps GitHub Pages from running Jekyll transforms

## Preview Locally

Open `index.html` in a browser, or run a tiny local server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish With GitHub Pages

1. Create a new GitHub repository named `personal-website` or `aminehamlouchi.github.io`.
2. Push these files to the repository's `main` branch.
3. In GitHub, open `Settings` -> `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select `main` and `/root`, then save.

If the repository is named `aminehamlouchi.github.io`, the site should publish at `https://aminehamlouchi.github.io/`. Otherwise it will publish at `https://aminehamlouchi.github.io/<repo-name>/`.
