import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function usageDataRoot(env = process.env) {
  if (env.CLAUDE_USAGE_DATA_DIR) return env.CLAUDE_USAGE_DATA_DIR;
  const home = env.HOME || homedir();
  return join(home, ".claude", "usage-data");
}

export function paths(root) {
  return {
    root,
    sessionMeta: join(root, "session-meta"),
    facets: join(root, "facets"),
    archive: join(root, "archive"),
    narratives: join(root, "narratives"),
    reports: join(root, "reports"),
    ingestLog: join(root, "ingest.log"),
  };
}

async function atomic(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  await writeFile(tmp, data);
  await rename(tmp, filePath);
}

export async function writeJsonAtomic(filePath, value) {
  await atomic(filePath, JSON.stringify(value));
}

export async function writeBufferAtomic(filePath, buffer) {
  await atomic(filePath, buffer);
}

export async function readJson(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    // Only a genuinely absent file means "nothing cached here". A permission
    // or IO error must not be reported as absence: a caller that merges into
    // an existing entry would then overwrite fields it never managed to read.
    if (error.code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // A half-written or corrupt entry carries no fields worth preserving.
    return null;
  }
}
