#!/usr/bin/env node
import { mkdir, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { paths, usageDataRoot, readJson, writeBufferAtomic } from "./lib/store.mjs";
import { parsePeriod, autoGranularity } from "./lib/range.mjs";
import { aggregate, isReportable, delta } from "./lib/aggregate.mjs";
import { renderReport } from "./lib/render.mjs";

function flag(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function compareTokens(argv) {
  const index = argv.indexOf("--compare");
  if (index < 0) return null;
  const [before, vs, after] = argv.slice(index + 1, index + 4);
  if (!before || vs !== "vs" || !after) {
    throw new RangeError('malformed comparison — expected "--compare A vs B"');
  }
  return { before, after };
}

async function loadAll(dir) {
  const out = new Map();
  const files = await readdir(dir).catch(() => []);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const value = await readJson(join(dir, file));
    if (value) out.set(basename(file, ".json"), value);
  }
  return out;
}

const argv = process.argv.slice(2);
const root = usageDataRoot();
const p = paths(root);

const metas = [...(await loadAll(p.sessionMeta)).values()];
const facets = await loadAll(p.facets);

if (metas.length === 0) {
  process.stderr.write("no session metadata found — run ingest.mjs --backfill first\n");
  process.exit(1);
}

const stamps = metas.map((m) => new Date(m.start_time)).filter((d) => !Number.isNaN(d.getTime()));
stamps.sort((a, b) => a - b);

let start = stamps[0];
let end = stamps.at(-1);
let comparison = null;
try {
  const last = flag(argv, "--last");
  if (last) ({ start, end } = parsePeriod(last, new Date()));
  const since = flag(argv, "--since");
  if (since) start = parsePeriod(since, new Date()).start;
  const until = flag(argv, "--until");
  if (until) end = parsePeriod(until, new Date()).end;

  const tokens = compareTokens(argv);
  if (tokens) {
    comparison = {
      before: parsePeriod(tokens.before, new Date()),
      after: parsePeriod(tokens.after, new Date()),
    };
    start = comparison.before.start;
    end = comparison.after.end;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(2);
}

if (start > end) {
  process.stderr.write(
    `empty range: start ${start.toISOString().slice(0, 10)} is after end ${end.toISOString().slice(0, 10)}\n`,
  );
  process.exit(2);
}

// An unrecognised --by must not fall through to the automatic granularity:
// "--by day" would then silently produce weekly buckets and the report would
// answer a question the user did not ask.
const GRANULARITIES = ["week", "month"];
const byFlag = flag(argv, "--by");
if (argv.includes("--by") && !GRANULARITIES.includes(byFlag)) {
  process.stderr.write(`unknown --by value "${byFlag ?? ""}" — valid values are ${GRANULARITIES.join(" and ")}\n`);
  process.exit(2);
}
const granularity = byFlag ?? autoGranularity(start, end);
// parsePeriod returns an inclusive end (last millisecond of the final day),
// so no day-padding is needed here.
const inRange = metas.filter((meta) => {
  const at = new Date(meta.start_time);
  return at >= start && at <= end;
});
const reportable = inRange.filter((meta) => isReportable(meta, facets.get(meta.session_id)));
const missingFacets = reportable
  .filter((meta) => !facets.has(meta.session_id))
  .map((m) => m.session_id)
  .sort();

const { buckets, totals } = aggregate(reportable, facets, { granularity });

function totalsFor(period) {
  const slice = reportable.filter((meta) => {
    const at = new Date(meta.start_time);
    return at >= period.start && at <= period.end;
  });
  return aggregate(slice, facets, { granularity }).totals;
}

let comparisonSummary = null;
if (comparison) {
  const before = totalsFor(comparison.before);
  const after = totalsFor(comparison.after);
  comparisonSummary = { before, after, change: delta(before, after) };
}

// A narrative that cannot be read is a failure, not empty prose: the caller
// asked for specific text and a report without it looks complete but isn't.
// Omitting the flag entirely stays fine — that is the deterministic path.
const narrativePath = flag(argv, "--narrative");
let narrative = { summary: "", delta: "" };
if (argv.includes("--narrative")) {
  let loaded = null;
  try {
    loaded = narrativePath ? await readJson(narrativePath) : null;
  } catch (error) {
    process.stderr.write(`cannot read --narrative ${narrativePath}: ${error.message}\n`);
    process.exit(2);
  }
  if (!loaded) {
    process.stderr.write(
      `cannot read --narrative ${narrativePath ?? "(no path given)"} — expected a readable JSON file\n`,
    );
    process.exit(2);
  }
  narrative = loaded;
}

const range = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
const html = renderReport({ buckets, totals, range, granularity, narrative, comparison: comparisonSummary });

await mkdir(p.reports, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const target = join(p.reports, `history-${range.start}_${range.end}-${stamp}.html`);
// Atomic, so a concurrent run or a mid-write failure can never leave a torn
// latest.html behind. The timestamped file is written first: latest.html is
// the pointer, and a pointer must never be newer than what it points at.
await writeBufferAtomic(target, html);
await writeBufferAtomic(join(p.reports, "latest.html"), html);

process.stdout.write(`${target}\n`);
process.stdout.write(
  `${JSON.stringify({ sessions: reportable.length, missingFacets, comparison: comparisonSummary })}\n`,
);
