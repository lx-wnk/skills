import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const INGEST = join(HERE, "ingest.mjs");

async function scenario() {
  const dir = await mkdtemp(join(tmpdir(), "ingest-"));
  const data = join(dir, "usage-data");
  const project = join(dir, "projects", "-repo");
  await mkdir(project, { recursive: true });
  const transcript = join(project, "s1.jsonl");
  await copyFile(join(HERE, "lib", "fixtures", "sample.jsonl"), transcript);
  return { dir, data, transcript };
}

function payload(transcript) {
  return JSON.stringify({
    session_id: "s1",
    transcript_path: transcript,
    cwd: "/repo",
    hook_event_name: "SessionEnd",
    reason: "clear",
  });
}

async function ingest(data, stdin) {
  const child = run("node", [INGEST], { env: { ...process.env, CLAUDE_USAGE_DATA_DIR: data } });
  child.child.stdin.end(stdin);
  return child;
}

test("hook mode writes meta and slim archive", async () => {
  const { data, transcript } = await scenario();
  await ingest(data, payload(transcript));

  const meta = JSON.parse(await readFile(join(data, "session-meta", "s1.json"), "utf8"));
  assert.equal(meta.session_id, "s1");
  assert.equal(meta.user_message_count, 2);

  const gz = await readFile(join(data, "archive", "s1.slim.jsonl.gz"));
  const text = gunzipSync(gz).toString("utf8");
  assert.ok(text.includes("first prompt"));
  assert.ok(!text.includes("subagent chatter"));
});

test("hook mode is idempotent", async () => {
  const { data, transcript } = await scenario();
  await ingest(data, payload(transcript));
  const first = await readFile(join(data, "session-meta", "s1.json"), "utf8");
  await ingest(data, payload(transcript));
  const second = await readFile(join(data, "session-meta", "s1.json"), "utf8");
  assert.equal(first, second);
  assert.deepEqual(await readdir(join(data, "session-meta")), ["s1.json"]);
});

test("archive is written before the metadata marker", async () => {
  const { data, transcript } = await scenario();
  await ingest(data, payload(transcript));
  const { stat } = await import("node:fs/promises");
  const archive = await stat(join(data, "archive", "s1.slim.jsonl.gz"));
  const meta = await stat(join(data, "session-meta", "s1.json"));
  assert.ok(archive.mtimeMs <= meta.mtimeMs, "metadata marker must not predate the archive it attests to");
});

test("hook mode skips subagent transcripts", async () => {
  const { dir, data } = await scenario();
  const sub = join(dir, "projects", "-repo", "subagents", "agent-x.jsonl");
  await mkdir(dirname(sub), { recursive: true });
  await writeFile(sub, "");
  await ingest(data, JSON.stringify({ session_id: "x", transcript_path: sub, hook_event_name: "SessionEnd" }));
  await assert.rejects(() => readdir(join(data, "session-meta")));
});

test("hook mode exits 0 and stays silent on a malformed payload", async () => {
  const { data } = await scenario();
  const { stdout, stderr } = await ingest(data, "{ not json");
  assert.equal(stdout, "");
  assert.equal(stderr, "");
  const log = await readFile(join(data, "ingest.log"), "utf8");
  assert.ok(log.length > 0, "failure was not logged");
});

test("hook mode exits 0 when the transcript is missing", async () => {
  const { data } = await scenario();
  const { stderr } = await ingest(data, payload("/nowhere/missing.jsonl"));
  assert.equal(stderr, "");
});
