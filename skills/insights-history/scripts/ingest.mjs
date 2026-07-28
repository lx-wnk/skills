#!/usr/bin/env node
import { appendFile, mkdir, readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { basename, join, sep } from "node:path";
import { homedir } from "node:os";
import { gzipSync } from "node:zlib";
import { paths, usageDataRoot, writeBufferAtomic, writeJsonAtomic, readJson } from "./lib/store.mjs";
import { extractMeta, extractSlim } from "./lib/transcript.mjs";

// 6.3 MB transcript measured at 0.13 s end to end; the largest real
// transcript is 29.6 MB, extrapolating to ~0.6 s. 5 s leaves ~8x headroom
// while still guaranteeing the hook never stalls a session exit.
const SELF_TIMEOUT_MS = 5000;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function readLines(filePath) {
  const lines = [];
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  for await (const raw of rl) {
    if (!raw) continue;
    try {
      lines.push(JSON.parse(raw));
    } catch {
      // A truncated final line is normal while a session is being written.
    }
  }
  return lines;
}

// Every transcript line carries the cwd the session ran in. That is the real
// project path; the directory name under ~/.claude/projects/ is a lossy
// encoding of it (both "/" and "-" become "-"), so "_agent-infrastructure"
// cannot be told apart from "_agent/infrastructure". Reading the cwd back out
// of the file is exact where un-mangling the directory name is guesswork.
function cwdOf(lines) {
  for (const line of lines) {
    if (typeof line?.cwd === "string" && line.cwd) return line.cwd;
  }
  return "";
}

// Last resort only, when neither the hook payload nor any line carries a cwd:
// the encoded directory name, returned verbatim. Decoding it would produce a
// confidently wrong path, which is worse than an obviously encoded one.
function encodedProjectDir(transcriptPath) {
  const parts = transcriptPath.split(sep);
  const index = parts.lastIndexOf("projects");
  if (index < 0 || !parts[index + 1]) return "";
  return parts[index + 1];
}

export async function ingestOne(transcriptPath, { sessionId, cwd, root }) {
  if (transcriptPath.includes(`${sep}subagents${sep}`)) return "skipped-subagent";

  const p = paths(root);
  const info = await stat(transcriptPath);
  const mtime = Math.round(info.mtimeMs);
  const id = sessionId || basename(transcriptPath, ".jsonl");

  const existing = await readJson(join(p.sessionMeta, `${id}.json`));
  if (existing && existing.transcript_mtime >= mtime) return "up-to-date";

  const lines = await readLines(transcriptPath);
  const meta = extractMeta(lines, {
    sessionId: id,
    projectPath: cwd || cwdOf(lines) || encodedProjectDir(transcriptPath),
    transcriptMtime: mtime,
  });
  // Merge, never replace. This cache is shared with Claude Code's own
  // /insights, which writes fields extractMeta does not derive (see
  // DERIVED_META_FIELDS). Our write stamps a fresh transcript_mtime — the
  // staleness key both programs use — so anything zeroed here would be
  // treated as current and never recomputed. Ours win for what we compute;
  // everything else is carried forward untouched.
  const merged = existing ? { ...existing, ...meta } : meta;
  const slim = extractSlim(lines)
    .map((entry) => JSON.stringify(entry))
    .join("\n");

  await mkdir(p.sessionMeta, { recursive: true });
  await mkdir(p.archive, { recursive: true });
  // Order matters. The metadata file is the idempotency marker: the
  // up-to-date check above reads only its transcript_mtime. Writing it last
  // means a crash — or the self-timeout firing — leaves no marker, so the
  // next run redoes the work. Writing it first would record success for an
  // archive that was never written, and every later run would skip it
  // forever.
  await writeBufferAtomic(join(p.archive, `${id}.slim.jsonl.gz`), gzipSync(Buffer.from(slim)));
  await writeJsonAtomic(join(p.sessionMeta, `${id}.json`), merged);
  return "written";
}

async function logFailure(root, error) {
  try {
    const p = paths(root);
    await mkdir(p.root, { recursive: true });
    await appendFile(p.ingestLog, `${new Date().toISOString()} ${error?.stack ?? error}\n`);
  } catch {
    // Logging must never be the reason the hook fails.
  }
}

async function topLevelTranscripts(projectsDir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectDir = join(projectsDir, entry.name);
    const files = await readdir(projectDir, { withFileTypes: true }).catch(() => []);
    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".jsonl")) found.push(join(projectDir, file.name));
    }
  }
  return found;
}

async function backfill(root, projectsDir) {
  const summary = { written: 0, upToDate: 0, skipped: 0, failed: 0 };
  for (const transcript of await topLevelTranscripts(projectsDir)) {
    try {
      const outcome = await ingestOne(transcript, { root });
      if (outcome === "written") summary.written += 1;
      else if (outcome === "up-to-date") summary.upToDate += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      await logFailure(root, error);
    }
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return summary;
}

async function main() {
  const root = usageDataRoot();
  const argv = process.argv.slice(2);
  try {
    if (argv.includes("--backfill")) {
      const flagIndex = argv.indexOf("--projects");
      const projectsDir = flagIndex >= 0 ? argv[flagIndex + 1] : join(homedir(), ".claude", "projects");
      const summary = await backfill(root, projectsDir);
      // A run where nothing succeeded must not look like a run where nothing
      // needed doing. The JSON summary still goes to stdout, so a caller sees
      // both the failure count and the non-zero status.
      return summary.failed > 0 ? 1 : 0;
    }
    const payload = JSON.parse(await readStdin());
    if (!payload.transcript_path) throw new Error("payload has no transcript_path");
    await ingestOne(payload.transcript_path, {
      sessionId: payload.session_id,
      cwd: payload.cwd,
      root,
    });
  } catch (error) {
    await logFailure(root, error);
  }
  return 0;
}

const isBackfill = process.argv.slice(2).includes("--backfill");
if (!isBackfill) {
  setTimeout(() => process.exit(0), SELF_TIMEOUT_MS).unref();
}
const code = await main();
if (isBackfill) {
  // Setting exitCode rather than calling process.exit lets Node flush the
  // JSON summary on stdout before the process ends.
  process.exitCode = code;
} else {
  // The hook path exits 0 unconditionally and deliberately: a SessionEnd hook
  // that fails loudly would interrupt the user's session over telemetry.
  process.exit(0);
}
