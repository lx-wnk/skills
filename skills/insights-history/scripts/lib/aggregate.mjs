import { bucketKey } from "./range.mjs";

const FRICTION_ALIASES = {
  permission_blocks: "permission_block",
  environment_issues: "environment_issue",
  tool_failures: "tool_failed",
  tool_failure: "tool_failed",
};

export function canonicalFriction(key) {
  return FRICTION_ALIASES[key] ?? key;
}

export function isReportable(meta, facet) {
  if ((meta.user_message_count ?? 0) < 2) return false;
  if ((meta.duration_minutes ?? 0) < 1) return false;
  const goals = facet?.goal_categories;
  if (goals) {
    const active = Object.keys(goals).filter((key) => (goals[key] ?? 0) > 0);
    if (active.length === 1 && active[0] === "warmup_minimal") return false;
  }
  return true;
}

function emptyBucket(key) {
  return {
    key,
    sessions: 0,
    activeDays: new Set(),
    userMessages: 0,
    commits: 0,
    pushes: 0,
    inputTokens: 0,
    outputTokens: 0,
    toolCounts: {},
    toolErrors: 0,
    interruptions: 0,
    linesAdded: 0,
    linesRemoved: 0,
    projects: {},
    outcomes: {},
    helpfulness: {},
    friction: {},
  };
}

function tally(target, key, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10) / 10;
}

export function aggregate(sessions, facets, { granularity }) {
  const byKey = new Map();

  for (const meta of sessions) {
    const at = new Date(meta.start_time);
    if (Number.isNaN(at.getTime())) continue;
    const key = bucketKey(at, granularity);
    if (!byKey.has(key)) byKey.set(key, emptyBucket(key));
    const bucket = byKey.get(key);

    bucket.sessions += 1;
    bucket.activeDays.add(meta.start_time.slice(0, 10));
    bucket.userMessages += meta.user_message_count ?? 0;
    bucket.commits += meta.git_commits ?? 0;
    bucket.pushes += meta.git_pushes ?? 0;
    bucket.inputTokens += meta.input_tokens ?? 0;
    bucket.outputTokens += meta.output_tokens ?? 0;
    bucket.toolErrors += meta.tool_errors ?? 0;
    bucket.interruptions += meta.user_interruptions ?? 0;
    bucket.linesAdded += meta.lines_added ?? 0;
    bucket.linesRemoved += meta.lines_removed ?? 0;

    for (const [name, count] of Object.entries(meta.tool_counts ?? {})) tally(bucket.toolCounts, name, count);
    if (meta.project_path) tally(bucket.projects, meta.project_path);

    const facet = facets.get(meta.session_id);
    if (!facet) continue;
    if (facet.outcome) tally(bucket.outcomes, facet.outcome);
    if (facet.claude_helpfulness) tally(bucket.helpfulness, facet.claude_helpfulness);
    for (const [name, count] of Object.entries(facet.friction_counts ?? {})) {
      if (count > 0) tally(bucket.friction, canonicalFriction(name), count);
    }
  }

  const buckets = [...byKey.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({
      ...bucket,
      activeDays: bucket.activeDays.size,
      perSession: {
        userMessages: ratio(bucket.userMessages, bucket.sessions),
        commits: ratio(bucket.commits, bucket.sessions),
        outputTokens: ratio(bucket.outputTokens, bucket.sessions),
        toolErrors: ratio(bucket.toolErrors, bucket.sessions),
      },
      perCommit: {
        outputTokens: ratio(bucket.outputTokens, bucket.commits),
        userMessages: ratio(bucket.userMessages, bucket.commits),
      },
    }));

  const totals = buckets.reduce(
    (acc, bucket) => ({
      sessions: acc.sessions + bucket.sessions,
      commits: acc.commits + bucket.commits,
      userMessages: acc.userMessages + bucket.userMessages,
      outputTokens: acc.outputTokens + bucket.outputTokens,
    }),
    { sessions: 0, commits: 0, userMessages: 0, outputTokens: 0 },
  );

  return { buckets, totals };
}

export function delta(before, after) {
  const result = {};
  for (const key of Object.keys(before)) {
    if (typeof before[key] !== "number" || typeof after[key] !== "number") continue;
    const absolute = after[key] - before[key];
    result[key] = {
      absolute,
      percent: before[key] === 0 ? null : Math.round((absolute / before[key]) * 100),
    };
  }
  return result;
}
