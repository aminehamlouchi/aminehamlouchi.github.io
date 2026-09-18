#!/usr/bin/env node
/*
  check-copy.mjs

  Amine does not use em dashes. This fails the build if one appears in any
  tracked source file, so the rule holds without anyone policing it.
*/
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const SKIP = new Set(["alnur", ".git", "node_modules", "assets"]);
const EXT = /\.(html|css|js|mjs|json|md|xml|yml|yaml|svg|txt|webmanifest|vcf)$/;

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const abs = join(dir, e);
    if (statSync(abs).isDirectory()) walk(abs);
    else if (EXT.test(e)) files.push(abs);
  }
};
walk(ROOT);
// assets/ holds binaries plus the hand written css and js, so include those.
const assetsDir = join(ROOT, "assets");
for (const e of readdirSync(assetsDir)) {
  const abs = join(assetsDir, e);
  if (!statSync(abs).isDirectory() && EXT.test(e)) files.push(abs);
}

const EM = String.fromCharCode(0x2014);
let hits = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  text.split("\n").forEach((line, i) => {
    if (line.includes(EM)) {
      console.log(`  EM DASH  ${f.slice(ROOT.length + 1)}:${i + 1}  ${line.trim().slice(0, 90)}`);
      hits++;
    }
  });
}
console.log(`\nfiles scanned ${files.length}`);
console.log(hits ? `check-copy: ${hits} em dash(es) found` : "check-copy: OK, zero em dashes");
process.exit(hits ? 1 : 0);
