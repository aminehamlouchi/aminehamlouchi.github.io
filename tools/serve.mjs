#!/usr/bin/env node
/*
  serve.mjs

  A local static server that compresses, because GitHub Pages compresses and
  python3 -m http.server does not. Measuring against an uncompressed server
  understates every text asset by roughly three times.

  usage: node tools/serve.mjs [port]
*/
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
import { join, extname, resolve, dirname, normalize } from "node:path";
import { createGzip, createBrotliCompress, constants } from "node:zlib";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PORT = Number(process.argv[2] || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".pdf": "application/pdf", ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".vcf": "text/vcard; charset=utf-8", ".webmanifest": "application/manifest+json",
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let path = normalize(join(ROOT, url));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");

  if (!existsSync(path)) {
    const four = join(ROOT, "404.html");
    if (existsSync(four)) {
      const body = readFileSync(four);
      res.writeHead(404, { "content-type": TYPES[".html"], "content-length": body.length });
      return res.end(body);
    }
    return res.writeHead(404).end("not found");
  }

  const ext = extname(path);
  const type = TYPES[ext] || "application/octet-stream";
  const immutable = /\.(woff2|webp|png|jpe?g|svg)$/.test(ext);
  const headers = {
    "content-type": type,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=600",
    "x-content-type-options": "nosniff",
  };

  const accept = String(req.headers["accept-encoding"] || "");
  if (COMPRESSIBLE.test(type)) {
    if (/\bbr\b/.test(accept)) {
      headers["content-encoding"] = "br";
      headers.vary = "accept-encoding";
      res.writeHead(200, headers);
      return createReadStream(path).pipe(
        createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      ).pipe(res);
    }
    if (/\bgzip\b/.test(accept)) {
      headers["content-encoding"] = "gzip";
      headers.vary = "accept-encoding";
      res.writeHead(200, headers);
      return createReadStream(path).pipe(createGzip({ level: 6 })).pipe(res);
    }
  }
  headers["content-length"] = statSync(path).size;
  res.writeHead(200, headers);
  createReadStream(path).pipe(res);
}).listen(PORT, () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT} with br and gzip`));
