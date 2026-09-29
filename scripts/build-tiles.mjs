// Downloads the source images listed in tile-sources.json and writes static
// IIIF Image API (level 0) tile pyramids to public/iiif/<id>/.
//
//   npm run tiles            # only missing works
//   npm run tiles -- --force # regenerate everything
//   npm run tiles -- gogh-bedroom

import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ORIGINALS_DIR = path.join(ROOT, ".cache", "originals");
const IIIF_DIR = path.join(ROOT, "public", "iiif");
const TILE_SIZE = 512;
const THUMBNAIL_WIDTH = 843;
const USER_AGENT = "ArtInActualSize/0.1 (tile builder; personal study project)";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const sources = JSON.parse(await readFile(path.join(ROOT, "scripts", "tile-sources.json"), "utf8"));

sharp.cache(false);

for (const [id, url] of Object.entries(sources)) {
  if (only.length > 0 && !only.includes(id)) continue;

  const outDir = path.join(IIIF_DIR, id);
  if (!force && existsSync(path.join(outDir, "info.json"))) {
    console.log(`skip   ${id} (already built)`);
    continue;
  }

  const original = await download(id, url);

  console.log(`tile   ${id}`);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(IIIF_DIR, { recursive: true });
  const info = await sharp(original, { limitInputPixels: false })
    .jpeg({ quality: 85, mozjpeg: true })
    .tile({ layout: "iiif", size: TILE_SIZE, id: "/iiif" })
    .toFile(outDir);

  const thumbDir = path.join(outDir, "full", `${THUMBNAIL_WIDTH},`, "0");
  await mkdir(thumbDir, { recursive: true });
  await sharp(original, { limitInputPixels: false })
    .resize({ width: THUMBNAIL_WIDTH })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(path.join(thumbDir, "default.jpg"));

  console.log(`done   ${id} ${info.width}x${info.height}`);
}

async function download(id, url) {
  const file = path.join(ORIGINALS_DIR, `${id}${path.extname(new URL(url).pathname) || ".jpg"}`);
  if (existsSync(file)) return file;

  console.log(`fetch  ${id} ${url}`);
  await mkdir(ORIGINALS_DIR, { recursive: true });
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`);

  const partial = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(partial));
  await rename(partial, file);
  return file;
}
