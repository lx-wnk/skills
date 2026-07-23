# Contributing

Thanks for improving this skill collection. Skills follow the open [agentskills.io](https://agentskills.io) standard so they stay portable across Claude Code, Codex, Cursor, Gemini, and other agents.

This file is the **workflow**. The detailed authoring rules — frontmatter fields, body structure, language, read-only vs. write skills — live in **[STYLEGUIDE.md](STYLEGUIDE.md)**.

## Add or change a skill

Each skill is one folder: `skills/<skill-name>/SKILL.md`. The essentials:

1. The frontmatter `name` **must equal the folder name** (lowercase, hyphens, ≤64 chars).
2. Write a _pushy_ `description` (≤1024 chars) with explicit trigger phrases in English **and** German — Claude under-triggers skills.
3. Keep the `SKILL.md` body under ~500 lines / ~5000 tokens; move detail into `references/`, `assets/`, or `scripts/` loaded on demand (progressive disclosure).
4. Prefer a **process** — checkpoints, exit criteria, an anti-rationalization table — over a reference essay. [`branch-review`](skills/branch-review/SKILL.md) is the reference implementation.

Full rules and examples: **[STYLEGUIDE.md](STYLEGUIDE.md)**.

## Registry & versioning

The set is versioned together at the repo level (one git tag), not per skill. Downstream repos resolve against a tag.

| Artifact | Role |
| --- | --- |
| `skills.json` | Authoritative, machine-readable manifest (name, description, path, license per skill + repo version). **Committed.** |
| Git tags `vX.Y.Z` | The version source. Consumers pin a release, e.g. `npx skills add lx-wnk/skills@v0.2.0`. |
| `outputs/index.md` | Agent-Context `skills/index.md` format. Generated on demand. |
| `outputs/skills-lock.json` | Agent-Dashboard lock. Generated on demand. |

`outputs/` is gitignored — it does not exist in a fresh clone. Run `npm run sync` to generate it, or consume the copies written into the sibling repos via `--index-out` / `--lock-out`. Only `skills.json` is committed.

### Sync script

`scripts/sync-registry.mjs` is the single source of truth for registry consistency. It validates every `SKILL.md` against the standard, then regenerates the artifacts above.

```bash
npm run sync          # validate + write skills.json, outputs/index.md, outputs/skills-lock.json
npm run sync:check    # validate + fail if skills.json is stale (CI gate)

# write generated files straight into the sibling repos (opt-in):
node scripts/sync-registry.mjs \
  --index-out ../Agent-Context/templates/.agent-context/skills/index.md \
  --lock-out  ../Agent-Dashboard/skills-lock.json
```

Validation is hard-failing: a bad `name`, a `name` that does not match its directory, a missing field, or a `description` over 1024 characters exits non-zero.

## Before you open a PR

Requires Node ≥ 20 (matches CI).

```bash
npm run sync          # validate frontmatter + regenerate skills.json
npm run prettier:fix  # format
```

Commit the regenerated `skills.json`. `npm run sync:check` is the CI gate — it fails on the same validation errors above.

When you add or rename a skill, also update the `## Available Skills` tables in [README.md](README.md) — add the row to the matching category group, alphabetical within the group (see [STYLEGUIDE §12](STYLEGUIDE.md#12-readme)); the `Invoke` column must match the `argument-hint`.

## Conventions

- Skill instructions and PR/commit messages: **English** (trigger phrases in the `description` are bilingual EN + DE).
- No secrets or tokens in skills. No destructive defaults (no `--force`, `reset --hard`, unconditional deletes).
- The repo uses **squash merges** — keep PRs focused.

## Releases

Versioning is by git tag. `version()` resolves from `SKILLS_VERSION`, else `git describe --tags`, else `0.0.0-dev`. The committed `skills.json` must always carry a **clean release tag** — regenerate it at release time, then tag and push:

```bash
SKILLS_VERSION=vX.Y.Z npm run sync
git commit -am "chore: release vX.Y.Z"
git tag vX.Y.Z && git push --tags
```

`sync:check` enforces this: it compares `skills.json` version-agnostically (HEAD may be ahead of the tag) but fails if the committed version is not a clean release tag, or if an explicitly passed `--index-out` / `--lock-out` target is stale.
