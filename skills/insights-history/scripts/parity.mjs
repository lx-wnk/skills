#!/usr/bin/env node
import { readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { paths, usageDataRoot, readJson } from "./lib/store.mjs";
import { extractMeta } from "./lib/transcript.mjs";

const METRICS = ["user_message_count", "assistant_message_count", "tool_counts"];
// Rates, not counts: the comparable population shrinks as retention deletes
// transcripts and as resumed sessions go stale against the cached snapshot.
//
// Measured 2026-07-28 against n=34 comparable sessions (see
// references/parity-harness.md for the full write-up): 31/34, 31/34, 32/34.
// The residual is understood — see parity-harness.md "Root cause" — but not
// fixed here, since extractMeta must not be changed to chase this number.
const BASELINE = { user_message_count: 0.91, assistant_message_count: 0.91, tool_counts: 0.94 };
const MIN_POPULATION = 20;

async function readLines(filePath) {
  const lines = [];
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  for await (const raw of rl) {
    if (!raw) continue;
    try {
      lines.push(JSON.parse(raw));
    } catch {}
  }
  return lines;
}

async function transcriptFor(projectsDir, sessionId) {
  for (const entry of await readdir(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(projectsDir, entry.name, `${sessionId}.jsonl`);
    try {
      await stat(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

const root = usageDataRoot();
const projectsDir = join(homedir(), ".claude", "projects");
const metaDir = paths(root).sessionMeta;

let metaFiles;
try {
  metaFiles = await readdir(metaDir);
} catch {
  console.log("no built-in cache present — parity check skipped");
  process.exit(0);
}

const hits = Object.fromEntries(METRICS.map((m) => [m, 0]));
const misses = [];
let compared = 0;

for (const file of metaFiles.filter((f) => f.endsWith(".json"))) {
  const cached = await readJson(join(metaDir, file));
  if (!cached) continue;
  const sessionId = basename(file, ".json");
  const transcript = await transcriptFor(projectsDir, sessionId);
  if (!transcript) continue;

  const info = await stat(transcript);
  if (Math.round(info.mtimeMs) > (cached.transcript_mtime ?? 0)) continue; // stale cache, not comparable

  compared += 1;
  const mine = extractMeta(await readLines(transcript), {
    sessionId,
    projectPath: cached.project_path,
    transcriptMtime: cached.transcript_mtime,
  });

  for (const metric of METRICS) {
    const a = JSON.stringify(mine[metric] ?? null);
    const b = JSON.stringify(cached[metric] ?? null);
    if (a === b) hits[metric] += 1;
    else if (misses.length < 10)
      misses.push({ sessionId: sessionId.slice(0, 8), metric, mine: mine[metric], cached: cached[metric] });
  }
}

console.log(`compared ${compared} fresh sessions\n`);

if (compared < MIN_POPULATION) {
  console.log(`INCONCLUSIVE — only ${compared} comparable sessions, need ${MIN_POPULATION}`);
  process.exit(0);
}

let failed = false;
for (const metric of METRICS) {
  const floor = BASELINE[metric];
  const rate = hits[metric] / compared;
  const ok = rate >= floor - 0.005;
  if (!ok) failed = true;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${metric.padEnd(24)} ${hits[metric]}/${compared} = ${rate.toFixed(2)}  (baseline ${floor.toFixed(2)})`,
  );
}
if (misses.length > 0) {
  console.log("\nfirst mismatches:");
  for (const m of misses)
    console.log(`  ${m.sessionId} ${m.metric}: mine=${JSON.stringify(m.mine)} cached=${JSON.stringify(m.cached)}`);
}
process.exit(failed ? 1 : 0);
