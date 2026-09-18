#!/usr/bin/env node
/*
  sync-resume.mjs

  One resume, everywhere. Reads the newest AmineHamlouchiResume<N>.pdf from
  ~/Claude/JobHunt (highest N wins), copies it to both public paths, and
  regenerates the two preview images from page one.

  usage: node tools/sync-resume.mjs [--source DIR] [--check]
         --check exits non-zero instead of writing, for CI.
*/
import { readdirSync, copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const MANIFEST = join(ROOT, "tools", "resume-manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const srcIdx = args.indexOf("--source");
const SOURCE_DIR = srcIdx > -1 ? args[srcIdx + 1] : join(homedir(), "Claude", "JobHunt");

const sha1 = (p) => createHash("sha1").update(readFileSync(p)).digest("hex");
const die = (m) => { console.error("FAIL " + m); process.exit(1); };

if (!existsSync(SOURCE_DIR)) die(`source directory not found: ${SOURCE_DIR}`);

const candidates = readdirSync(SOURCE_DIR)
  .map((f) => /^AmineHamlouchiResume(\d+)\.pdf$/.exec(f))
  .filter(Boolean)
  .map((m) => ({ file: m[0], n: Number(m[1]) }))
  .sort((a, b) => b.n - a.n);

if (!candidates.length) die(`no AmineHamlouchiResume<N>.pdf in ${SOURCE_DIR}`);
const newest = candidates[0];
const srcPath = join(SOURCE_DIR, newest.file);
const srcSha = sha1(srcPath);
console.log(`source  v${newest.n}  ${newest.file}  sha1 ${srcSha}`);

const drift = manifest.paths.filter((p) => !existsSync(join(ROOT, p)) || sha1(join(ROOT, p)) !== srcSha);
if (!drift.length && manifest.sha1 === srcSha) {
  console.log("PASS    repo matches the newest resume, nothing to do");
  process.exit(0);
}
if (checkOnly) {
  console.error("FAIL    resume drift: " + (drift.join(", ") || "manifest sha1 stale"));
  console.error("        run: node tools/sync-resume.mjs");
  process.exit(1);
}

for (const p of manifest.paths) {
  copyFileSync(srcPath, join(ROOT, p));
  console.log(`wrote   ${p}`);
}

// Preview images. macOS only: qlmanage renders page one, cwebp encodes it.
const have = (bin) => { try { execFileSync("which", [bin], { stdio: "ignore" }); return true; } catch { return false; } };
if (have("qlmanage") && have("cwebp")) {
  const stage = join(tmpdir(), "resume-preview-" + Date.now());
  mkdirSync(stage, { recursive: true });
  execFileSync("qlmanage", ["-t", "-s", "2000", "-o", stage, srcPath], { stdio: "ignore" });
  const png = readdirSync(stage).find((f) => f.endsWith(".png"));
  if (png) {
    for (const [w, q, out] of [[1000, 60, "assets/previews/resume-page.webp"], [560, 58, "assets/previews/resume-page-560.webp"]]) {
      const scaled = join(stage, `s${w}.png`);
      execFileSync("sips", ["--resampleWidth", String(w), join(stage, png), "--out", scaled], { stdio: "ignore" });
      execFileSync("cwebp", ["-preset", "text", "-q", String(q), "-m", "6", "-quiet", scaled, "-o", join(ROOT, out)], { stdio: "ignore" });
      console.log(`wrote   ${out}`);
    }
  }
} else {
  console.log("skip    preview regeneration needs qlmanage and cwebp (brew install webp)");
}

manifest.version = newest.n;
manifest.sha1 = srcSha;
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote   tools/resume-manifest.json  v${newest.n}`);
console.log("PASS    resume synced. commit the changed files on a branch.");
