import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { writeJsonAtomic } from "./lib/store.mjs";

const run = promisify(execFile);
const REPORT = join(dirname(fileURLToPath(import.meta.url)), "report.mjs");

async function withData() {
  const data = await mkdtemp(join(tmpdir(), "report-"));
  await mkdir(join(data, "session-meta"), { recursive: true });
  await mkdir(join(data, "facets"), { recursive: true });
  const base = {
    duration_minutes: 60,
    user_message_count: 10,
    assistant_message_count: 20,
    tool_counts: { Bash: 5 },
    git_commits: 2,
    git_pushes: 0,
    input_tokens: 10,
    output_tokens: 100,
    tool_errors: 0,
    user_interruptions: 0,
    project_path: "/repo",
  };
  await writeJsonAtomic(join(data, "session-meta", "a.json"), {
    ...base,
    session_id: "a",
    start_time: "2026-06-23T09:00:00.000Z",
  });
  await writeJsonAtomic(join(data, "session-meta", "b.json"), {
    ...base,
    session_id: "b",
    start_time: "2026-07-01T09:00:00.000Z",
  });
  await writeJsonAtomic(join(data, "facets", "a.json"), {
    session_id: "a",
    outcome: "fully_achieved",
    goal_categories: { fix_bug: 1 },
    friction_counts: {},
    user_satisfaction_counts: {},
  });
  return data;
}

async function report(data, args) {
  return run("node", [REPORT, ...args], { env: { ...process.env, CLAUDE_USAGE_DATA_DIR: data } });
}

test("report writes HTML and latest.html", async () => {
  const data = await withData();
  const { stdout } = await report(data, []);
  const files = await readdir(join(data, "reports"));
  assert.ok(files.includes("latest.html"));
  assert.ok(files.some((f) => f.startsWith("history-")));
  assert.match(stdout, /"sessions":2/);
});

test("report lists sessions whose facets are missing", async () => {
  const data = await withData();
  const { stdout } = await report(data, []);
  const summary = JSON.parse(stdout.split("\n").filter(Boolean).at(-1));
  assert.deepEqual(summary.missingFacets, ["b"]);
});

test("report honours --since and --until", async () => {
  const data = await withData();
  const { stdout } = await report(data, ["--since", "2026-07-01", "--until", "2026-07-31"]);
  const summary = JSON.parse(stdout.split("\n").filter(Boolean).at(-1));
  assert.equal(summary.sessions, 1);
});

test("an unparsable period exits 2, writes nothing to stdout, and creates no report", async () => {
  const data = await withData();
  await assert.rejects(
    () => report(data, ["--since", "2026-13"]),
    (error) => {
      assert.equal(error.code, 2);
      assert.equal(error.stdout, "");
      assert.match(error.stderr, /month 13 is out of range/);
      return true;
    },
  );
  await assert.rejects(() => readdir(join(data, "reports")));
});

test("every shape-valid but calendar-invalid token is rejected", async () => {
  const data = await withData();
  for (const token of ["2026-13", "2026-06-31", "2026-W99", "0d"]) {
    await assert.rejects(
      () => report(data, ["--since", token]),
      (error) => {
        assert.equal(error.code, 2, `expected exit 2 for ${token}`);
        return true;
      },
    );
  }
});

test("an inverted range fails loudly instead of reporting on nothing", async () => {
  const data = await withData();
  await assert.rejects(
    () => report(data, ["--since", "2026-07-01", "--until", "2026-06-01"]),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(error.stderr, /empty range/);
      return true;
    },
  );
  await assert.rejects(() => readdir(join(data, "reports")));
});

test("an empty data root exits 1 rather than producing an empty report", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const empty = await mkdtemp(join(tmpdir(), "report-empty-"));
  await assert.rejects(
    () => report(empty, []),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /no session metadata found/);
      return true;
    },
  );
});

test("report writes a document that mentions both buckets", async () => {
  const data = await withData();
  await report(data, []);
  const html = await readFile(join(data, "reports", "latest.html"), "utf8");
  assert.ok(html.includes("2026-W26"));
  assert.ok(html.includes("2026-W27"));
});

test("report injects a frozen narrative from --narrative", async () => {
  const data = await withData();
  const narrativePath = join(data, "n.json");
  await writeJsonAtomic(narrativePath, { summary: "Frozen summary text.", delta: "Frozen delta text." });
  await report(data, ["--narrative", narrativePath]);
  const html = await readFile(join(data, "reports", "latest.html"), "utf8");
  assert.ok(html.includes("Frozen summary text."));
  assert.ok(html.includes("Frozen delta text."));
});

test("report emits a comparison block for --compare", async () => {
  const data = await withData();
  const { stdout } = await report(data, ["--compare", "2026-06", "vs", "2026-07"]);
  const summary = JSON.parse(stdout.split("\n").filter(Boolean).at(-1));
  assert.equal(summary.comparison.before.sessions, 1);
  assert.equal(summary.comparison.after.sessions, 1);
  assert.equal(summary.comparison.change.commits.absolute, 0);
});

test("report rejects a malformed --compare expression", async () => {
  const data = await withData();
  await assert.rejects(
    () => report(data, ["--compare", "2026-06", "2026-07"]),
    (error) => {
      assert.match(error.stderr, /--compare A vs B/);
      return true;
    },
  );
});
