// Uploads the static IIIF tile pyramids in public/iiif/<id>/ to a public
// Supabase Storage bucket, rewriting each info.json "@id" to the bucket URL.
//
//   npm run upload-tiles                  # every work under public/iiif
//   npm run upload-tiles -- gogh-bedroom  # selected works only
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const IIIF_DIR = path.join(ROOT, "public", "iiif");
const BUCKET = "iiif";
const CONCURRENCY = 12;
const MAX_ATTEMPTS = 4;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const publicBase = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}`;

await ensurePublicBucket();

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ids = (await readdir(IIIF_DIR, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && (only.length === 0 || only.includes(d.name)))
  .map((d) => d.name);

for (const id of ids) {
  const dir = path.join(IIIF_DIR, id);
  const files = await listFiles(dir);
  console.log(`upload ${id} (${files.length} files)`);

  let done = 0;
  await runPool(files, CONCURRENCY, async (file) => {
    const key = `${id}/${path.relative(dir, file).split(path.sep).join("/")}`;
    const body = await readBody(id, file);
    await uploadWithRetry(key, body, file.endsWith(".json") ? "application/json" : "image/jpeg");
    done += 1;
    if (done % 200 === 0 || done === files.length) console.log(`  ${done}/${files.length}`);
  });

  console.log(`done   ${id} -> ${publicBase}/${id}/info.json`);
}

async function ensurePublicBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) {
    if (!data.public) await supabase.storage.updateBucket(BUCKET, { public: true });
    return;
  }
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
}

async function readBody(id, file) {
  if (path.basename(file) !== "info.json") return readFile(file);
  const info = JSON.parse(await readFile(file, "utf8"));
  info["@id"] = `${publicBase}/${id}`;
  return Buffer.from(JSON.stringify(info, null, 2));
}

async function uploadWithRetry(key, body, contentType) {
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase.storage.from(BUCKET).upload(key, body, {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (!error) return;
    if (attempt >= MAX_ATTEMPTS) throw new Error(`${key}: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
}

async function runPool(items, size, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}
