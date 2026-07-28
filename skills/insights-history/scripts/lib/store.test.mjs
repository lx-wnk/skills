import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { usageDataRoot, paths, writeJsonAtomic, readJson } from "./store.mjs";

test("usageDataRoot honours CLAUDE_USAGE_DATA_DIR", () => {
  assert.equal(usageDataRoot({ CLAUDE_USAGE_DATA_DIR: "/tmp/x" }), "/tmp/x");
});

test("usageDataRoot falls back to the home directory", () => {
  const root = usageDataRoot({ HOME: "/home/me" });
  assert.ok(root.endsWith("/.claude/usage-data"), `unexpected root: ${root}`);
});

test("paths exposes every directory the skill writes to", () => {
  const p = paths("/data");
  assert.equal(p.sessionMeta, "/data/session-meta");
  assert.equal(p.facets, "/data/facets");
  assert.equal(p.archive, "/data/archive");
  assert.equal(p.narratives, "/data/narratives");
  assert.equal(p.reports, "/data/reports");
  assert.equal(p.ingestLog, "/data/ingest.log");
});

test("writeJsonAtomic leaves no temp file behind", async () => {
  const dir = await mkdtemp(join(tmpdir(), "store-"));
  const target = join(dir, "a.json");
  await writeJsonAtomic(target, { a: 1 });
  assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { a: 1 });
  assert.deepEqual(await readdir(dir), ["a.json"]);
});

test("readJson returns null instead of throwing on a missing file", async () => {
  assert.equal(await readJson("/nope/nothing.json"), null);
});

test("readJson returns null instead of throwing on malformed JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "store-"));
  const target = join(dir, "bad.json");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(target, "{not json");
  assert.equal(await readJson(target), null);
});

test("readJson rethrows an unreadable file instead of reporting it as absent", async (t) => {
  if (process.getuid?.() === 0) {
    t.skip("running as root — filesystem permissions are not enforced");
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), "store-"));
  const target = join(dir, "locked.json");
  const { writeFile, chmod } = await import("node:fs/promises");
  await writeFile(target, JSON.stringify({ lines_added: 1377 }));
  await chmod(target, 0o000);
  try {
    // "null" here would mean "no entry", and a caller merging into an existing
    // entry would overwrite fields it never managed to read.
    await assert.rejects(() => readJson(target), { code: "EACCES" });
  } finally {
    await chmod(target, 0o644);
  }
});
