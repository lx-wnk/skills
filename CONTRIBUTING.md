# Contributing

Thanks for improving this skill collection. Skills follow the open [agentskills.io](https://agentskills.io) standard so they stay portable across Claude Code, Codex, Cursor, Gemini, and other agents.

## Add or change a skill

1. One skill per folder: `skills/<skill-name>/SKILL.md`. The frontmatter `name` **must equal the folder name** (lowercase, hyphens, ≤64 chars).
2. Write a _pushy_ `description` (≤1024 chars) with explicit trigger phrases in English **and** German — Claude under-triggers skills.
3. Keep the `SKILL.md` body under ~500 lines / ~5000 tokens; move detail into `references/`, `assets/`, or `scripts/` loaded on demand (progressive disclosure).
4. Prefer a **process** (checkpoints, exit criteria, anti-rationalization table) over a reference essay. See [`branch-review`](skills/branch-review/SKILL.md) as the reference implementation.

Full authoring rules: [README](README.md#authoring-a-skill) and [STYLEGUIDE.md](STYLEGUIDE.md).

## Before you open a PR

```bash
npm run sync          # validate frontmatter + regenerate skills.json
npm run prettier:fix  # format
```

`npm run sync:check` is the gate: a bad `name`, a `name` that does not match its directory, a missing field, or a `description` over 1024 characters fails the build. Commit the regenerated `skills.json`.

## Conventions

- Skill instructions and PR/commit messages: English.
- No secrets or tokens in skills. No destructive defaults (no `--force`, `reset --hard`, unconditional deletes).
- The repo uses **squash merges**; keep PRs focused.

## Releases

Versioning is by git tag (`vX.Y.Z`). The committed `skills.json` carries the release version — regenerate it at release time with `SKILLS_VERSION=vX.Y.Z npm run sync`, then tag and push.
