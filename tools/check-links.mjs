#!/usr/bin/env node
/*
  check-links.mjs

  Walks every top level page, resolves every internal href, src and data-src,
  and fails on anything that does not exist. In-page anchors are checked
  against the ids and names actually present on the target page.

  alnur/ is a separate production site with its own pipeline, so it is out of
  scope here on purpose.
*/
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, normalize, posix } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const SKIP_DIRS = new Set(["alnur", ".git", "node_modules", "tools", ".github"]);

const pages = [];
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const abs = join(dir, e);
    if (statSync(abs).isDirectory()) walk(abs);
    else if (e.endsWith(".html")) pages.push(abs);
  }
};
walk(ROOT);

const idsOf = (html) => {
  const s = new Set();
  for (const m of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) s.add(m[1]);
  for (const m of html.matchAll(/\bname\s*=\s*["']([^"']+)["']/g)) s.add(m[1]);
  return s;
};
const cache = new Map();
const pageIds = (abs) => {
  if (!cache.has(abs)) cache.set(abs, existsSync(abs) ? idsOf(readFileSync(abs, "utf8")) : null);
  return cache.get(abs);
};

let checked = 0, broken = 0, external = 0;
const attrRe = /\b(?:href|src|srcset|data-src|data-img|data-link|poster)\s*=\s*["']([^"']+)["']/g;
// Sibling project Pages sites live under the same custom domain but in other
// repos, so they are not files here. Verified live with curl on 2026-09-18.
const SIBLING_ROUTES = new Set(["timeline/", "timeline", "/timeline/", "alnur/", "/alnur/"]);

for (const page of pages.sort()) {
  const html = readFileSync(page, "utf8");
  const rel = page.slice(ROOT.length + 1);
  for (const m of html.matchAll(attrRe)) {
    const raw = m[1].trim();
    if (!raw) continue;
    if (/^(https?:|mailto:|tel:|sms:|data:|javascript:|blob:|#$)/.test(raw)) { external++; continue; }
    if (SIBLING_ROUTES.has(raw)) { external++; continue; }

    if (raw.includes(",") && /\s\d+w/.test(raw)) {
      for (const cand of raw.split(",").map((c) => c.trim().split(/\s+/)[0])) {
        checked++;
        const abs = cand.startsWith("/") ? normalize(join(ROOT, cand)) : normalize(join(dirname(page), cand));
        if (!existsSync(abs)) { console.log(`  BROKEN  ${rel}  ->  ${cand}`); broken++; }
      }
      continue;
    }
    const [pathPart, hash] = raw.split("#");
    let targetAbs, targetLabel;
    if (!pathPart) {
      targetAbs = page; targetLabel = rel;
    } else {
      const clean = pathPart.split("?")[0];
      targetAbs = clean.startsWith("/")
        ? normalize(join(ROOT, clean))
        : normalize(join(dirname(page), clean));
      targetLabel = posix.normalize(clean);
    }
    checked++;

    let exists = existsSync(targetAbs);
    if (!exists && !/\.[a-z0-9]+$/i.test(targetAbs)) exists = existsSync(join(targetAbs, "index.html"));
    if (!exists) { console.log(`  BROKEN  ${rel}  ->  ${raw}`); broken++; continue; }

    if (hash) {
      const resolved = statSync(targetAbs).isDirectory() ? join(targetAbs, "index.html") : targetAbs;
      if (resolved.endsWith(".html")) {
        const ids = pageIds(resolved);
        // PDF viewer fragments such as #toolbar=0 are viewer options, not anchors.
        if (ids && !ids.has(hash) && !/=/.test(hash)) {
          console.log(`  BROKEN  ${rel}  ->  ${raw}  (no #${hash} on ${targetLabel})`);
          broken++;
        }
      }
    }
  }
}

// Social card images are links the crawlers follow, so verify them too.
for (const page of pages.sort()) {
  const html = readFileSync(page, "utf8");
  const rel = page.slice(ROOT.length + 1);
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](og:image|twitter:image)["'][^>]*>/g)) {
    const c = /content=["']([^"']+)["']/.exec(m[0]);
    if (!c) continue;
    const v = c[1];
    checked++;
    const relPath = v.replace(/^https:\/\/aminehamlouchi\.com\//, "").replace(/^\//, "");
    if (/^https?:\/\//.test(v) && !v.startsWith("https://aminehamlouchi.com/")) { external++; checked--; continue; }
    if (!existsSync(join(ROOT, relPath))) { console.log(`  BROKEN  ${rel}  ->  ${v} (social card image)`); broken++; }
  }
}

console.log(`\npages ${pages.length} · internal links checked ${checked} · external skipped ${external}`);
console.log(broken ? `check-links: ${broken} BROKEN internal link(s)` : "check-links: OK, 0 broken internal links");
process.exit(broken ? 1 : 0);
