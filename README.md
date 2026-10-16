# aminehamlouchi.com

Hand written HTML, CSS and JavaScript. No framework, no bundler, no build step.
GitHub Pages serves `main` from the repository root, so a merge to `main` is a
deploy.

## Layout

- `index.html`: the home page, v3 "the stage". Seven scenes on one full screen
  WebGL canvas, written against the raw WebGL API with one fragment shader.
- `resume.html`: the full text resume, the same content as the PDF.
- `checkers.html`, `tic-tac-toe-3d.html`: playable cartridges.
- `assets/home.css`, `assets/home.js`: the entire v3 design system and behaviour.
- `assets/fonts.css`, `assets/fonts/`: self hosted subset fonts, no third party requests.
- `assets/vendor/gsap.min.js`: the only third party runtime dependency.
- `assets/previews/`: screenshots of live projects, WebP.
- `tools/`: the checks and the resume sync script. Not served.
- `alnur/`, `scripts/build_alnur_gallery.py`, `.github/workflows/alnur-gallery.yml`:
  a separate production site for Alnur Mosque Islamic Center with its own photo
  pipeline. Leave it alone for now. See "Alnur handoff" below.

## Alnur handoff, pending

Alnur has been handed off to the masjid's own agent. Once Amine has confirmed
that they are hosting it themselves and that the live site is serving from
their infrastructure, these can come out of this repository:

- `alnur/` (the whole directory)
- `scripts/build_alnur_gallery.py`
- `.github/workflows/alnur-gallery.yml`

Do not remove any of them before that confirmation. `aminehamlouchi.com/alnur/`
is a live site for a real community, and deleting the directory takes it down
immediately, since GitHub Pages publishes this repository on every push to
`main`. Removal should be its own pull request, and it should verify where the
mosque's live site resolves before merging.
- `CNAME`, `.nojekyll`: domain binding and Jekyll bypass. Do not remove.

## The resume

One file, two paths, byte identical:

- `/AmineHamlouchiResume.pdf` is the stable path that the job application
  automation uploads.
- `/assets/amine-hamlouchi-resume.pdf` is the path the site has linked since
  2026, kept alive so old links and old PDFs never 404.

The source of truth lives outside this repository, in `~/Claude/JobHunt`, where
the highest numbered `AmineHamlouchiResume<N>.pdf` is always current. To pull it
in:

```
node tools/sync-resume.mjs
```

That copies the newest PDF to both paths, regenerates
`assets/previews/resume-page.webp` and its 560px variant from page one, and
updates `tools/resume-manifest.json`. Commit the result on a branch.

## Checks

`.github/workflows/site-checks.yml` runs these on every pull request, so the
site cannot merge in a broken state:

```
node tools/check-links.mjs     # every internal link resolves
node tools/check-resume.mjs    # every PDF link is the current resume
node tools/check-copy.mjs      # no em dashes anywhere
```

## Local preview

GitHub Pages compresses its responses and `python3 -m http.server` does not, so
measure against something that compresses:

```
npx serve -l 4173 .
```
