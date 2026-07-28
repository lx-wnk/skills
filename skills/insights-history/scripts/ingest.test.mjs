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

test("a failed archive write leaves no metadata marker behind", async (t) => {
  if (process.getuid?.() === 0) {
    t.skip("running as root — filesystem permissions are not enforced");
    return;
  }
  const { data, transcript } = await scenario();
  const { mkdir, chmod, readdir } = await import("node:fs/promises");

  // Archive directory exists but is not writable, so writeBufferAtomic throws.
  await mkdir(join(data, "archive"), { recursive: true });
  await chmod(join(data, "archive"), 0o555);
  try {
    const { stdout, stderr } = await ingest(data, payload(transcript));
    assert.equal(stdout, "");
    assert.equal(stderr, "");
    // ingestOne creates session-meta/ unconditionally (mkdir before either
    // write), so the directory itself always exists — readdir on it never
    // rejects. The property under test is that the marker *file* was never
    // written, not that the directory is missing.
    const entries = await readdir(join(data, "session-meta")).catch(() => []);
    assert.ok(!entries.includes("s1.json"), "metadata marker must not exist after a failed archive write");
    const log = await readFile(join(data, "ingest.log"), "utf8");
    assert.ok(log.length > 0, "archive write failure was not logged");
  } finally {
    await chmod(join(data, "archive"), 0o755);
  }
});

test("ingest preserves fields it does not compute in an existing entry", async () => {
  const { data, transcript } = await scenario();
  const { writeJsonAtomic } = await import("./lib/store.mjs");
  await writeJsonAtomic(join(data, "session-meta", "s1.json"), {
    session_id: "s1",
    transcript_mtime: 1,
    lines_added: 1377,
    lines_removed: 28,
    user_interruptions: 2,
  });
  await ingest(data, payload(transcript));
  const meta = JSON.parse(await readFile(join(data, "session-meta", "s1.json"), "utf8"));
  assert.equal(meta.lines_added, 1377, "a field we do not compute was destroyed");
  assert.equal(meta.lines_removed, 28);
  assert.equal(meta.user_interruptions, 2);
  assert.equal(meta.user_message_count, 2, "a field we do compute was not updated");
});

test("backfill takes the project path from the transcript, never from the encoded directory", async () => {
  const { dir, data, transcript } = await scenario();
  // A directory name whose decoding is wrong: "-agent-infrastructure" would
  // become "/agent/infrastructure", because the encoding maps both "/" and "-"
  // onto "-" and is therefore not invertible. The transcript's own cwd
  // ("/repo", from the fixture) is the only exact source. Backfill passes no
  // cwd of its own, so this is the path every backfilled session takes.
  const projectDir = join(dir, "projects", "-agent-infrastructure");
  await mkdir(projectDir, { recursive: true });
  await copyFile(transcript, join(projectDir, "s9.jsonl"));

  const { stdout } = await run("node", [INGEST, "--backfill", "--projects", join(dir, "projects")], {
    env: { ...process.env, CLAUDE_USAGE_DATA_DIR: data },
  });
  assert.equal(JSON.parse(stdout.trim()).written, 2);
  const meta = JSON.parse(await readFile(join(data, "session-meta", "s9.json"), "utf8"));
  assert.equal(meta.project_path, "/repo");
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

test("backfill walks every top-level transcript", async () => {
  const { dir, data, transcript } = await scenario();
  const second = join(dirname(transcript), "s2.jsonl");
  await copyFile(transcript, second);
  const sub = join(dirname(transcript), "subagents", "agent-y.jsonl");
  await mkdir(dirname(sub), { recursive: true });
  await copyFile(transcript, sub);

  const { stdout } = await run("node", [INGEST, "--backfill", "--projects", join(dir, "projects")], {
    env: { ...process.env, CLAUDE_USAGE_DATA_DIR: data },
  });

  const summary = JSON.parse(stdout.trim());
  assert.equal(summary.written, 2);
  assert.equal(summary.failed, 0);
  assert.deepEqual((await readdir(join(data, "session-meta"))).sort(), ["s1.json", "s2.json"]);
});

test("backfill exits 1 when a transcript failed, still printing the summary", async (t) => {
  if (process.getuid?.() === 0) {
    t.skip("running as root — filesystem permissions are not enforced");
    return;
  }
  const { dir, data } = await scenario();
  const { chmod } = await import("node:fs/promises");
  await mkdir(join(data, "archive"), { recursive: true });
  await chmod(join(data, "archive"), 0o555);
  try {
    await assert.rejects(
      () =>
        run("node", [INGEST, "--backfill", "--projects", join(dir, "projects")], {
          env: { ...process.env, CLAUDE_USAGE_DATA_DIR: data },
        }),
      (error) => {
        assert.equal(error.code, 1, "a backfill in which everything failed must not exit 0");
        const summary = JSON.parse(error.stdout.trim());
        assert.equal(summary.failed, 1);
        assert.equal(summary.written, 0);
        return true;
      },
    );
  } finally {
    await chmod(join(data, "archive"), 0o755);
  }
});

test("backfill reports up-to-date sessions instead of rewriting them", async () => {
  const { dir, data } = await scenario();
  const args = [INGEST, "--backfill", "--projects", join(dir, "projects")];
  const env = { ...process.env, CLAUDE_USAGE_DATA_DIR: data };
  await run("node", args, { env });
  const { stdout } = await run("node", args, { env });
  const summary = JSON.parse(stdout.trim());
  assert.equal(summary.written, 0);
  assert.equal(summary.upToDate, 1);
});
