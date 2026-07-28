import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, canonicalFriction, isReportable, delta } from "./aggregate.mjs";

function session(overrides) {
  return {
    session_id: "s",
    start_time: "2026-06-23T09:00:00.000Z",
    duration_minutes: 60,
    user_message_count: 10,
    assistant_message_count: 50,
    tool_counts: { Bash: 5 },
    git_commits: 2,
    git_pushes: 1,
    input_tokens: 100,
    output_tokens: 1000,
    tool_errors: 1,
    user_interruptions: 0,
    lines_added: 10,
    lines_removed: 2,
    files_modified: 3,
    ...overrides,
  };
}

test("canonicalFriction collapses the built-in's duplicate spellings", () => {
  assert.equal(canonicalFriction("permission_blocks"), "permission_block");
  assert.equal(canonicalFriction("permission_block"), "permission_block");
  assert.equal(canonicalFriction("environment_issues"), "environment_issue");
  assert.equal(canonicalFriction("buggy_code"), "buggy_code");
});

test("isReportable applies the built-in's report-time filter", () => {
  assert.equal(isReportable(session({ user_message_count: 1 }), null), false);
  assert.equal(isReportable(session({ duration_minutes: 0 }), null), false);
  assert.equal(isReportable(session({}), { goal_categories: { warmup_minimal: 1 } }), false);
  assert.equal(isReportable(session({}), { goal_categories: { fix_bug: 1 } }), true);
});

test("aggregate groups sessions into buckets", () => {
  const sessions = [
    session({ session_id: "a", start_time: "2026-06-23T09:00:00.000Z" }),
    session({ session_id: "b", start_time: "2026-06-24T09:00:00.000Z" }),
    session({ session_id: "c", start_time: "2026-07-01T09:00:00.000Z" }),
  ];
  const { buckets } = aggregate(sessions, new Map(), { granularity: "week" });
  assert.deepEqual(
    buckets.map((b) => b.key),
    ["2026-W26", "2026-W27"],
  );
  assert.equal(buckets[0].sessions, 2);
  assert.equal(buckets[0].commits, 4);
  assert.equal(buckets[1].sessions, 1);
});

test("aggregate computes normalised per-session and per-commit figures", () => {
  const sessions = [session({ session_id: "a" }), session({ session_id: "b" })];
  const { buckets } = aggregate(sessions, new Map(), { granularity: "week" });
  assert.equal(buckets[0].perSession.userMessages, 10);
  assert.equal(buckets[0].perSession.commits, 2);
  assert.equal(buckets[0].perCommit.outputTokens, 500);
});

test("aggregate normalises friction keys across sessions", () => {
  const facets = new Map([
    ["a", { outcome: "fully_achieved", friction_counts: { permission_block: 1 }, goal_categories: { fix_bug: 1 } }],
    ["b", { outcome: "mostly_achieved", friction_counts: { permission_blocks: 2 }, goal_categories: { fix_bug: 1 } }],
  ]);
  const sessions = [session({ session_id: "a" }), session({ session_id: "b" })];
  const { buckets } = aggregate(sessions, facets, { granularity: "week" });
  assert.deepEqual(buckets[0].friction, { permission_block: 3 });
  assert.deepEqual(buckets[0].outcomes, { fully_achieved: 1, mostly_achieved: 1 });
});

test("delta reports signed absolute and percentage change", () => {
  const a = { sessions: 10, commits: 100 };
  const b = { sessions: 5, commits: 150 };
  const d = delta(a, b);
  assert.equal(d.sessions.absolute, -5);
  assert.equal(d.sessions.percent, -50);
  assert.equal(d.commits.absolute, 50);
  assert.equal(d.commits.percent, 50);
});
