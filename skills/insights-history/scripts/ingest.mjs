#!/usr/bin/env node
import { appendFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { basename, join, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { paths, usageDataRoot, writeBufferAtomic, writeJsonAtomic, readJson } from "./lib/store.mjs";
import { extractMeta, extractSlim } from "./lib/transcript.mjs";

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

function projectPathOf(transcriptPath, fallback) {
  const parts = transcriptPath.split(sep);
  const index = parts.lastIndexOf("projects");
  if (index < 0 || !parts[index + 1]) return fallback ?? "";
  return parts[index + 1].replace(/-/g, "/").replace(/^\//, "/");
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
    projectPath: cwd || projectPathOf(transcriptPath),
    transcriptMtime: mtime,
  });
  const slim = extractSlim(lines)
    .map((entry) => JSON.stringify(entry))
    .join("\n");

  await mkdir(p.sessionMeta, { recursive: true });
  await mkdir(p.archive, { recursive: true });
  await writeJsonAtomic(join(p.sessionMeta, `${id}.json`), meta);
  await writeBufferAtomic(join(p.archive, `${id}.slim.jsonl.gz`), gzipSync(Buffer.from(slim)));
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

async function main() {
  const root = usageDataRoot();
  try {
    const raw = await readStdin();
    const payload = JSON.parse(raw);
    if (!payload.transcript_path) throw new Error("payload has no transcript_path");
    await ingestOne(payload.transcript_path, {
      sessionId: payload.session_id,
      cwd: payload.cwd,
      root,
    });
  } catch (error) {
    await logFailure(root, error);
  }
}

const guard = setTimeout(() => process.exit(0), SELF_TIMEOUT_MS);
guard.unref();

await main();
process.exit(0);
