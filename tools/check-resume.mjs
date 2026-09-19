#!/usr/bin/env node
/*
  check-resume.mjs

  Fails when any PDF link on the site points at anything other than the
  current resume. Run in CI on every pull request.
*/
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve, normalize } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "tools", "resume-manifest.json"), "utf8"));
const sha1 = (p) => createHash("sha1").update(readFileSync(p)).digest("hex");

let fails = 0;
const ok = (m) => console.log("  PASS  " + m);
const bad = (m) => { console.log("  FAIL  " + m); fails++; };

// 1. Every declared path exists and is byte identical to the manifest sha1.
console.log("resume paths");
for (const p of manifest.paths) {
  const abs = join(ROOT, p);
  if (!existsSync(abs)) bad(`${p} is missing`);
  else if (sha1(abs) !== manifest.sha1) bad(`${p} sha1 ${sha1(abs)} != manifest ${manifest.sha1}`);
  else ok(`${p}  sha1 ${manifest.sha1}`);
}

// 2. Every PDF reference in the source resolves to that same file.
const SKIP = new Set(["alnur", ".git", "node_modules", "tools"]);
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const abs = join(dir, e);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(html|js|md|json|xml|webmanifest)$/.test(e)) out.push(abs);
  }
  return out;
};

console.log("references in the source");
const refRe = /["'(]([^"'()\s]*?\.pdf)(?:#[^"'()\s]*)?["')]/g;
let refCount = 0;
for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  const rel = file.slice(ROOT.length + 1);
  for (const m of text.matchAll(refRe)) {
    const href = m[1];
    if (/^(https?:)?\/\//.test(href)) continue;
    // A bare filename with no slash is a link label or shell-style listing text,
    // not a path. Only count it if a file of that name really sits at the root.
    if (!href.includes("/") && !existsSync(join(ROOT, href))) continue;
    refCount++;
    // An href in an HTML file resolves against that file. The same string in
    // a script resolves against whichever page loaded the script, so try the
    // repository root too and accept either.
    const candidates = href.startsWith("/")
      ? [normalize(join(ROOT, href.slice(1)))]
      : [normalize(join(dirname(file), href)), normalize(join(ROOT, href))];
    const hit = candidates.find((c) => existsSync(c));
    if (!hit) bad(`${rel} -> ${href} does not resolve`);
    else if (sha1(hit) !== manifest.sha1) bad(`${rel} -> ${href} is a stale resume (${sha1(hit).slice(0, 12)})`);
  }
}
ok(`${refCount} PDF references, all resolving to the current resume`);

// 3. The preview images exist.
for (const p of [manifest.preview, "assets/previews/resume-page-560.webp"]) {
  existsSync(join(ROOT, p)) ? ok(`${p} present`) : bad(`${p} is missing`);
}

// 4. The PDF is the one page cut; resume.html is the long version. So the
//    page must contain everything the PDF says, and may say more. A recruiter
//    who reads one and downloads the other must never meet a contradiction.
console.log("the PDF is a subset of the page");
import("node:child_process").then(({ spawnSync }) => {
  const py = spawnSync("python3", [join(ROOT, "tools/pdf-text.py"), join(ROOT, manifest.paths[0])], { encoding: "utf8" });
  if (py.status !== 0) {
    bad(`could not read the PDF text (${(py.stderr || "").trim().split("\n").pop()}). Install pypdf: python3 -m pip install pypdf`);
  } else {
    // pypdf sometimes splits a word ("T echnical", "W eb"), so compare with
    // every non alphanumeric character removed, spaces included.
    const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const page = norm(readFileSync(join(ROOT, "resume.html"), "utf8").replace(/<[^>]+>/g, " "));
    const pdfLines = py.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    // The things a reader compares: section names, employers, titles, projects,
    // the degree, the award. Not the free prose, whose line breaks differ.
    const anchors = [
      "University of Louisville", "Bachelor of Arts in Computer Science", "Minor in Arabic", "Expected May 2028",
      "HackKentucky 2026", "Prologue",
      "Product Engineering Intern", "Kamel Ride", "IT Analyst Intern", "Parker Hannifin",
      "Technical Lead, Digital Operations", "Alnur Mosque Islamic Center",
      "InterLogue", "Argument Knowledge Base", "School Operations Platform", "Rumi",
    ];
    let missing = 0;
    for (const a of anchors) {
      const inPdf = pdfLines.some((l) => norm(l).includes(norm(a)));
      const inPage = page.includes(norm(a));
      if (!inPdf) bad(`anchor "${a}" is no longer in the PDF; update the anchor list or the PDF`);
      else if (!inPage) { bad(`"${a}" is in the PDF but not on resume.html`); missing++; }
    }
    if (!missing) ok(`${anchors.length} PDF anchors all present on resume.html (the page may say more, the PDF may not)`);
  }
  console.log(fails ? `\ncheck-resume: ${fails} FAILURE(S)` : `\ncheck-resume: OK, resume v${manifest.version} is the only resume on the site`);
  process.exit(fails ? 1 : 0);
});
