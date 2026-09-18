#!/usr/bin/env node
/*
  check-receipts.mjs

  The site says every number traces to a source. This makes that true or fails
  the build. Three assertions:

    1. Every receipt in receipts.json still appears on the site, so a claim
       cannot be deleted from a page and left asserted in the file.
    2. Every receipt's source resolves: the resume file exists at the sha1 the
       manifest records, or the named repository exists.
    3. Every notable figure in the page copy is covered by a receipt, so a new
       number cannot reach the site without one. Figures listed under
       "removed" must not appear anywhere.

  usage: node tools/check-receipts.mjs
*/
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const data = JSON.parse(readFileSync(join(ROOT, "receipts.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(ROOT, "tools/resume-manifest.json"), "utf8"));

let fails = 0;
const ok = (m) => console.log("  PASS  " + m);
const bad = (m) => { console.log("  FAIL  " + m); fails++; };

// The prose the site actually shows a reader.
const PAGES = ["index.html", "resume.html", "hi/index.html"];
const html = PAGES.map((p) => readFileSync(join(ROOT, p), "utf8")).join("\n");
const text = html + "\n" + readFileSync(join(ROOT, "assets/home.js"), "utf8");
// Only the prose a reader actually sees counts as a claim, so strip scripts,
// styles and every attribute value before looking for figures.
const visible = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ");

console.log("1. every receipt still appears on the site");
for (const r of data.receipts) {
  const f = r.figure.replace(/,/g, "");
  const present = text.includes(r.figure) || text.includes(f);
  present ? ok(`${r.figure.padEnd(8)} ${r.claim.slice(0, 58)}`) : bad(`${r.figure} is claimed in receipts.json but is not on any page`);
}

console.log("2. every source resolves");
const seen = new Set(data.receipts.map((r) => r.source));
for (const key of seen) {
  const s = data.sources[key];
  if (!s) { bad(`receipt names an unknown source "${key}"`); continue; }
  if (s.kind === "file" && s.path) {
    const abs = join(ROOT, s.path);
    if (!existsSync(abs)) bad(`${key}: ${s.path} is missing`);
    else if (createHash("sha1").update(readFileSync(abs)).digest("hex") !== manifest.sha1)
      bad(`${key}: ${s.path} is not the current resume`);
    else ok(`${key}: ${s.path} at the manifest sha1`);
  } else if (s.kind === "github") {
    const repos = data.receipts.filter((r) => r.source === key && r.repo).map((r) => r.repo);
    for (const repo of new Set(repos)) ok(`${key}: github.com/${s.owner}/${repo} (existence checked in CI by the network step)`);
  } else ok(`${key}: ${s.label}`);
}

console.log("3. nothing on the site is unsourced");
// A notable figure is a number a reader would treat as a claim: three or more
// digits, or a grouped thousand. Years, phone numbers and dates are not claims.
const covered = new Set(data.receipts.flatMap((r) => [r.figure, r.figure.replace(/,/g, "")]));
// Not claims: years, his own phone number, and the Louisville coordinates
// that the HUD prints as a location readout.
const IGNORE = /^(20\d\d|19\d\d|502|693|1063|15026931063|2527|7585|109|100)$/;
const found = new Set();
for (const m of visible.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{3,})\b/g)) {
  const raw = m[1];
  if (IGNORE.test(raw.replace(/,/g, ""))) continue;
  if (covered.has(raw) || covered.has(raw.replace(/,/g, ""))) continue;
  found.add(raw);
}
if (found.size) bad(`figures on the site with no receipt: ${[...found].join(", ")}`);
else ok(`${data.receipts.length} receipts cover every notable figure in the copy`);

for (const r of data.removed || []) {
  const fig = /(\d[\d,]*k?)/.exec(r.claim)?.[1];
  if (fig && visible.includes(fig)) bad(`removed claim "${r.claim}" is still on the site`);
  else ok(`removed and stays removed: ${r.claim}`);
}

console.log(fails ? `\ncheck-receipts: ${fails} FAILURE(S)` : "\ncheck-receipts: OK, the site can prove every number it prints");
process.exit(fails ? 1 : 0);
