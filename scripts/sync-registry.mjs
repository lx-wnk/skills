#!/usr/bin/env node
// Registry sync + conformance validator for the skills repo.
//
// Reads every skills/<name>/SKILL.md, validates its frontmatter against the
// agentskills.io standard, and regenerates the machine-readable registry:
//   - skills.json            (repo root, committed — authoritative manifest)
//   - outputs/index.md       (Agent-Context skills/index.md format)
//   - outputs/skills-lock.json (Agent-Dashboard lock, skills.sh add model)
//
// Usage:
//   node scripts/sync-registry.mjs            write all artifacts
//   node scripts/sync-registry.mjs --check    validate + fail if skills.json is stale (CI), no writes
//   node scripts/sync-registry.mjs --index-out <path> --lock-out <path>
//                                             override output paths (e.g. sibling repos)

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO = "lx-wnk/skills";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");

// agentskills.io constraints
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/; // lowercase, hyphens, no leading/trailing/double hyphen
const NAME_MAX = 64;
const DESC_MAX = 1024;
const INDEX_DESC_MAX = 160; // max chars for a description cell in the generated index.md

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  const val = i !== -1 ? args[i + 1] : undefined;
  // reject a missing value or the next flag being mistaken for this flag's value
  return val && !val.startsWith("--") ? val : fallback;
};
const INDEX_OUT = resolve(ROOT, flag("--index-out", "outputs/index.md"));
const LOCK_OUT = resolve(ROOT, flag("--lock-out", "outputs/skills-lock.json"));
const MANIFEST_OUT = join(ROOT, "skills.json");

function version() {
  const raw = process.env.SKILLS_VERSION ?? gitDescribe();
  // Only a clean semver-ish tag is trusted. Anything else (incl. a hostile git
  // tag) falls back, so the value written into skills-lock.json's ref/install is
  // always safe for a downstream consumer to use as a git ref.
  return /^v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(raw) ? raw : "0.0.0-dev";
}

function gitDescribe() {
  try {
    // execFileSync (no shell) — fixed args, no injection surface
    return execFileSync("git", ["describe", "--tags", "--abbrev=0"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "0.0.0-dev";
  }
}

// Minimal YAML frontmatter parser — handles single-line scalars, single/double
// quotes, and block scalars (`>-`, `|`). Sufficient for SKILL.md frontmatter.
function parseFrontmatter(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`${file}: missing or malformed YAML frontmatter`);
  const lines = m[1].split("\n");
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2];
    if (val === ">-" || val === ">" || val === "|" || val === "|-") {
      const block = [];
      while (i + 1 < lines.length && (lines[i + 1].startsWith("  ") || lines[i + 1].trim() === "")) {
        block.push(lines[++i].trim());
      }
      val = block.join(" ").replace(/\s+/g, " ").trim();
    } else {
      val = stripQuotes(val.trim());
    }
    data[key] = val;
  }
  return data;
}

function stripQuotes(s) {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function firstSentence(desc) {
  const cut = desc.split(/(?<=[.!?])\s/)[0];
  return cut.length > INDEX_DESC_MAX ? cut.slice(0, INDEX_DESC_MAX - 1).trimEnd() + "…" : cut;
}

function loadSkills() {
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const errors = [];
  const skills = [];

  for (const dir of dirs) {
    const file = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(file)) {
      errors.push(`${dir}/: no SKILL.md`);
      continue;
    }
    let fm;
    try {
      fm = parseFrontmatter(readFileSync(file, "utf8"), `skills/${dir}/SKILL.md`);
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    const where = `skills/${dir}/SKILL.md`;

    if (!fm.name) errors.push(`${where}: missing required field 'name'`);
    else {
      if (!NAME_RE.test(fm.name))
        errors.push(
          `${where}: name '${fm.name}' violates naming rules (lowercase, hyphens, no leading/trailing/double hyphen)`,
        );
      if (fm.name.length > NAME_MAX) errors.push(`${where}: name exceeds ${NAME_MAX} chars`);
      if (fm.name !== dir) errors.push(`${where}: name '${fm.name}' must match directory '${dir}'`);
    }
    if (!fm.description) errors.push(`${where}: missing required field 'description'`);
    else if (fm.description.length > DESC_MAX)
      errors.push(`${where}: description ${fm.description.length} chars exceeds ${DESC_MAX}`);

    skills.push({
      name: fm.name || dir,
      description: fm.description || "",
      path: `skills/${dir}`,
      license: fm.license || "MIT",
      userInvocable: fm["user-invocable"] === "true", // parser emits strings only
    });
  }

  return { skills, errors };
}

function buildManifest(skills, ver) {
  return {
    name: REPO,
    version: ver,
    license: "MIT",
    standard: "agentskills.io",
    skills: skills.map((s) => ({
      name: s.name,
      description: s.description,
      path: s.path,
      license: s.license,
    })),
  };
}

function buildIndexMd(skills) {
  const header = [
    "# Skills Index",
    "",
    "<!-- Generated by scripts/sync-registry.mjs — do not edit by hand. -->",
    "<!-- Skills are loaded on-demand when task keywords match their triggers. -->",
    "",
    "| Skill | Triggers | Description |",
    "| ----- | -------- | ----------- |",
  ];
  const rows = skills.map((s) => {
    const trigger = s.userInvocable ? `\`/${s.name}\`` : "auto";
    return `| ${s.name} | ${trigger} | ${firstSentence(s.description).replace(/\|/g, "\\|")} |`;
  });
  return header.concat(rows).join("\n") + "\n";
}

function buildLock(skills, ver) {
  return {
    lockfileVersion: 1,
    source: { type: "git", repo: REPO, ref: ver },
    skills: skills.map((s) => ({
      name: s.name,
      path: s.path,
      install: `${REPO}@${s.name}`,
    })),
  };
}

function writeFileEnsured(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function main() {
  const { skills, errors } = loadSkills();

  if (errors.length) {
    console.error("✗ Conformance errors:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  const ver = version();
  const manifest = JSON.stringify(buildManifest(skills, ver), null, 2) + "\n";
  const indexMd = buildIndexMd(skills);
  const lock = JSON.stringify(buildLock(skills, ver), null, 2) + "\n";

  if (CHECK) {
    const current = existsSync(MANIFEST_OUT) ? readFileSync(MANIFEST_OUT, "utf8") : "";
    if (current !== manifest) {
      console.error("✗ skills.json is out of date — run `npm run sync` and commit the result.");
      process.exit(1);
    }
    console.log(`✓ ${skills.length} skills valid, skills.json in sync (version ${ver}).`);
    return;
  }

  writeFileEnsured(MANIFEST_OUT, manifest);
  writeFileEnsured(INDEX_OUT, indexMd);
  writeFileEnsured(LOCK_OUT, lock);

  console.log(`✓ ${skills.length} skills valid (version ${ver}).`);
  console.log(`  wrote ${MANIFEST_OUT.replace(ROOT + "/", "")}`);
  console.log(`  wrote ${INDEX_OUT.replace(ROOT + "/", "")}`);
  console.log(`  wrote ${LOCK_OUT.replace(ROOT + "/", "")}`);
}

main();
