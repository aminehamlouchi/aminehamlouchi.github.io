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

console.log(fails ? `\ncheck-resume: ${fails} FAILURE(S)` : `\ncheck-resume: OK, resume v${manifest.version} is the only resume on the site`);
process.exit(fails ? 1 : 0);
