import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport, escapeHtml, sparkline } from "./render.mjs";

const BUCKETS = [
  {
    key: "2026-W26",
    sessions: 7,
    activeDays: 4,
    userMessages: 268,
    commits: 94,
    outputTokens: 6824000,
    toolCounts: { Bash: 764, Agent: 242 },
    toolErrors: 74,
    interruptions: 6,
    projects: { "/repo/a": 3 },
    outcomes: { fully_achieved: 5 },
    helpfulness: { very_helpful: 5 },
    friction: { buggy_code: 2 },
    perSession: { userMessages: 38.3, commits: 13.4, outputTokens: 974857, toolErrors: 10.6 },
    perCommit: { outputTokens: 72596, userMessages: 2.9 },
  },
  {
    key: "2026-W27",
    sessions: 11,
    activeDays: 3,
    userMessages: 328,
    commits: 74,
    outputTokens: 5394000,
    toolCounts: { Bash: 690, Agent: 158 },
    toolErrors: 50,
    interruptions: 6,
    projects: { "/repo/b": 5 },
    outcomes: { mostly_achieved: 3 },
    helpfulness: { very_helpful: 3 },
    friction: { buggy_code: 2 },
    perSession: { userMessages: 29.8, commits: 6.7, outputTokens: 490363, toolErrors: 4.5 },
    perCommit: { outputTokens: 72891, userMessages: 4.4 },
  },
];

const TOTALS = { sessions: 18, commits: 168, userMessages: 596, outputTokens: 12218000 };

function render() {
  return renderReport({
    buckets: BUCKETS,
    totals: TOTALS,
    range: { start: "2026-06-23", end: "2026-07-05" },
    granularity: "week",
    narrative: { summary: "Sessions got shorter.", delta: "Commits per session halved." },
  });
}

test("escapeHtml neutralises markup", () => {
  assert.equal(escapeHtml('<script>"x"&</script>'), "&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;");
});

test("sparkline emits inline SVG with one point per value", () => {
  const svg = sparkline([1, 5, 3], { width: 60, height: 20 });
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.equal((svg.match(/,/g) ?? []).length >= 2, true);
});

test("renderReport produces a complete standalone document", () => {
  const html = render();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/);
});

test("renderReport references no external assets", () => {
  const html = render();
  assert.ok(!/\bsrc\s*=\s*["']http/i.test(html), "external src found");
  assert.ok(!/<link[^>]+href\s*=\s*["']http/i.test(html), "external stylesheet found");
});

test("renderReport includes every bucket and its normalised figures", () => {
  const html = render();
  assert.ok(html.includes("2026-W26"));
  assert.ok(html.includes("2026-W27"));
  assert.ok(html.includes("38.3"));
  assert.ok(html.includes("13.4"));
});

test("renderReport supports both colour schemes", () => {
  const html = render();
  assert.match(html, /prefers-color-scheme:\s*dark/);
});

test("renderReport omits the comparison section when none is given", () => {
  assert.ok(!render().includes("<h2>Comparison</h2>"));
});

test("renderReport renders a comparison when one is given", () => {
  const html = renderReport({
    buckets: BUCKETS,
    totals: TOTALS,
    range: { start: "2026-06-23", end: "2026-07-05" },
    granularity: "week",
    narrative: { summary: "", delta: "" },
    comparison: {
      before: { sessions: 7, commits: 94 },
      after: { sessions: 11, commits: 74 },
      change: { sessions: { absolute: 4, percent: 57 }, commits: { absolute: -20, percent: -21 } },
    },
  });
  assert.ok(html.includes("<h2>Comparison</h2>"));
  assert.ok(html.includes("delta-down"));
  assert.ok(html.includes("+57%"));
});

test("renderReport escapes project paths", () => {
  const html = renderReport({
    buckets: [{ ...BUCKETS[0], projects: { "<img onerror=x>": 1 } }],
    totals: TOTALS,
    range: { start: "2026-06-23", end: "2026-07-05" },
    granularity: "week",
    narrative: { summary: "", delta: "" },
  });
  assert.ok(!html.includes("<img onerror=x>"));
  assert.ok(html.includes("&lt;img onerror=x&gt;"));
});
