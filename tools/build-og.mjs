#!/usr/bin/env node
/*
  build-og.mjs

  Renders the social cards with headless Chrome so they use the site's own
  self hosted type instead of an approximation. 1200 by 630, PNG, which is
  what every scraper understands.

  usage: node tools/build-og.mjs
*/
import { readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const template = readFileSync(join(ROOT, "tools/og/card.template.html"), "utf8");

const CARDS = [
  {
    out: "assets/og/home.jpg",
    kicker: "Louisville, Kentucky",
    title: 'Amine<br><span class="thin">Hamlouchi</span>',
    size: 138,
    arabic: "أمين حملوشي",
    line: "Computer science at the University of Louisville, minor in Arabic. Product engineering intern at Kamel Ride.",
    foot: "seven scenes, one stage",
  },
  {
    out: "assets/og/resume.jpg",
    kicker: "Résumé",
    title: 'One page,<br><span class="thin">every receipt.</span>',
    size: 116,
    arabic: "السيرة الذاتية",
    line: "Every number on this site traces to the résumé or to a repository that exists. A check in CI proves it.",
    foot: "amine hamlouchi",
  },
  {
    out: "assets/og/hi.jpg",
    kicker: "Twenty seconds, bad signal",
    title: 'Amine<br><span class="thin">Hamlouchi</span>',
    size: 138,
    arabic: "أمين حملوشي",
    line: "Résumé, email, and a contact card. Nothing else to load.",
    foot: "aminehamlouchi.com/hi",
  },
];

const tmp = join(ROOT, ".og-render.html");
for (const c of CARDS) {
  const html = template
    .replace("__KICKER__", c.kicker)
    .replace("__TITLE__", c.title)
    .replace("__SIZE__", String(c.size))
    .replace("__ARABIC__", c.arabic)
    .replace("__LINE__", c.line)
    .replace("__FOOT__", c.foot);
  writeFileSync(tmp, html);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--window-size=1200,630",
    "--default-background-color=05070aff",
    "--virtual-time-budget=4000",
    `--screenshot=${join(ROOT, ".og-raw.png")}`,
    "file://" + tmp,
  ], { stdio: "ignore" });
  // These cards are dark gradients behind type, so JPEG holds them at a fifth
  // of PNG's weight with no visible loss at card size.
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "84",
    join(ROOT, ".og-raw.png"), "--out", join(ROOT, c.out)], { stdio: "ignore" });
  console.log(`wrote  ${c.out}  ${(statSync(join(ROOT, c.out)).size / 1024).toFixed(0)} KB`);
}
unlinkSync(tmp);
unlinkSync(join(ROOT, ".og-raw.png"));
console.log("PASS   social cards rebuilt");
