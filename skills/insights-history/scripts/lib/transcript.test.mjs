import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isUserMessage, classifyToolError, extractMeta } from "./transcript.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

async function fixtureLines() {
  const raw = await readFile(join(HERE, "fixtures", "sample.jsonl"), "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

test("isUserMessage accepts a plain string prompt", () => {
  assert.equal(isUserMessage({ type: "user", message: { content: "hi" } }), true);
});

test("isUserMessage rejects a tool result carrier", () => {
  const line = { type: "user", message: { content: [{ type: "tool_result", content: "x" }] } };
  assert.equal(isUserMessage(line), false);
});

test("isUserMessage rejects subagent traffic", () => {
  assert.equal(isUserMessage({ type: "user", isSidechain: true, message: { content: "hi" } }), false);
});

test("isUserMessage rejects non-user line types", () => {
  assert.equal(isUserMessage({ type: "file-history-snapshot" }), false);
});

test("classifyToolError maps the built-in's patterns", () => {
  assert.equal(classifyToolError("Error: exit code 1"), "Command Failed");
  assert.equal(classifyToolError("String to replace not found"), "Edit Failed");
  assert.equal(classifyToolError("File has been modified since read"), "File Changed");
  assert.equal(classifyToolError("something else entirely"), "Other");
});

test("extractMeta counts turns, tools and tokens", async () => {
  const meta = extractMeta(await fixtureLines(), {
    sessionId: "s1",
    projectPath: "/repo",
    transcriptMtime: 1234,
  });
  assert.equal(meta.session_id, "s1");
  assert.equal(meta.transcript_mtime, 1234);
  assert.equal(meta.user_message_count, 2);
  assert.equal(meta.assistant_message_count, 3);
  assert.deepEqual(meta.tool_counts, { Bash: 1, Edit: 1 });
  assert.equal(meta.input_tokens, 15);
  assert.equal(meta.output_tokens, 150);
  assert.equal(meta.git_commits, 1);
  assert.equal(meta.first_prompt, "first prompt");
});

test("extractMeta derives duration and response times", async () => {
  const meta = extractMeta(await fixtureLines(), {
    sessionId: "s1",
    projectPath: "/repo",
    transcriptMtime: 1234,
  });
  assert.equal(meta.start_time, "2026-07-01T09:00:00.000Z");
  assert.equal(meta.duration_minutes, 5);
  assert.deepEqual(meta.user_message_timestamps, ["2026-07-01T09:00:00.000Z", "2026-07-01T09:05:00.000Z"]);
  assert.deepEqual(meta.message_hours, [9, 9]);
});

test("extractMeta records tool errors by category", async () => {
  const meta = extractMeta(await fixtureLines(), {
    sessionId: "s1",
    projectPath: "/repo",
    transcriptMtime: 1234,
  });
  assert.equal(meta.tool_errors, 1);
  assert.deepEqual(meta.tool_error_categories, { "Command Failed": 1 });
});

test("extractMeta detects languages from edited file paths", async () => {
  const meta = extractMeta(await fixtureLines(), {
    sessionId: "s1",
    projectPath: "/repo",
    transcriptMtime: 1234,
  });
  assert.deepEqual(meta.languages, { TypeScript: 1 });
});
