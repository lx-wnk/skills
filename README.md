# skills

Curated skills for AI coding agents, distributed via [skills.sh](https://skills.sh).

Skills are **agent-agnostic** — they work with Claude Code, Cursor, Copilot, Windsurf, Gemini, and other AI agents.

## Installation

Install all skills:

```bash
npx skills add lx-wnk/skills
```

Install a single skill:

```bash
npx skills add lx-wnk/skills@branch-review
```

## Available Skills

| Skill | Description | Invoke |
| --- | --- | --- |
| [agent-context-init](skills/agent-context-init/SKILL.md) | Initialize Agent-Context in a project — sets up layered context architecture, memory, and skills | `/agent-context-init [version]` |
| [agent-context-update](skills/agent-context-update/SKILL.md) | Update Agent-Context to the latest version — refreshes shared files, preserves project config | `/agent-context-update [version]` |
| [architecture-design](skills/architecture-design/SKILL.md) | Design system-level architecture — bounded contexts, modules, domains, ADRs | `/architecture-design [topic]` |
| [architecture-review](skills/architecture-review/SKILL.md) | Review architecture of PR, branch, namespace, or whole project for structural issues | `/architecture-review [pr N \| branch X \| namespace path]` |
| [component-design](skills/component-design/SKILL.md) | Design low-level component and class structure — patterns, interfaces, aggregates | `/component-design [component name]` |
| [component-review](skills/component-review/SKILL.md) | Review class design, SOLID, cohesion, and pattern correctness | `/component-review [pr N \| branch X \| namespace path]` |
| [branch-review](skills/branch-review/SKILL.md) | Multi-agent review of branch diff — code/security/SEO/legal/UX/perf; optional `--apply-fixes` mode | `/branch-review [base-branch] [--apply-fixes]` |
| [full-project-review](skills/full-project-review/SKILL.md) | Multi-agent audit of the whole project (HEAD state, all repos) | `/full-project-review` |
| [obsidian](skills/obsidian/SKILL.md) | Obsidian vault access via Local REST API — read, search, create, update notes | `/obsidian [search query or note path]` |
| [session-handoff](skills/session-handoff/SKILL.md) | Generate a structured `outputs/HANDOFF.md` at the end of a session — changes, decisions, next steps | `/session-handoff [focus topics or time hint]` |
| [tech-gazette](skills/tech-gazette/SKILL.md) | Generate a daily or weekly tech news briefing as a self-contained HTML newspaper | `/tech-gazette [--daily\|--weekly] [customers]` |

## Standard & Portability

These skills follow the open [agentskills.io](https://agentskills.io) standard — a skill is a folder with a `SKILL.md` (YAML frontmatter + Markdown). The same skills run in Claude Code, Codex, Cursor, Gemini, and every other skills-compatible agent. Claude-Code-only conveniences (`user-invocable`, `argument-hint`) are additive: other agents ignore them.

## Registry & Versioning

| Artifact | Role |
| --- | --- |
| `skills.json` | Authoritative, machine-readable manifest (name, description, path, license per skill + repo version). Committed. |
| Git tags `vX.Y.Z` | The version source. Consumers pin a release, e.g. `npx skills add lx-wnk/skills@v0.1.0`. |
| `outputs/index.md` | Agent-Context `skills/index.md` format, generated on demand. |
| `outputs/skills-lock.json` | Agent-Dashboard lock, generated on demand. |

The whole set is versioned together at the repo level (one tag), not per skill. Downstream repos (`Agent-Context` `plugins.json`, `Agent-Dashboard` `skills-lock.json`) resolve against a tag.

> `outputs/` does not exist in a fresh clone (it is gitignored) — run `npm run sync` first, or consume the copies written into the sibling repos via `--index-out` / `--lock-out`. Only `skills.json` is committed.

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

## Authoring a Skill

Each skill lives in its own folder: `skills/<skill-name>/SKILL.md`. See [CLAUDE.md](CLAUDE.md) and [STYLEGUIDE.md](STYLEGUIDE.md) for the full conventions; the essentials:

### Frontmatter contract

```yaml
---
name: my-skill # required: lowercase a-z0-9 + single hyphens, ≤64 chars, MUST equal the folder name
license: MIT
description: > # required: ≤1024 chars; what it does AND when to fire, with explicit trigger phrases (EN + DE)
  ...


user-invocable: true # Claude Code: callable as /my-skill
argument-hint: "[arg]" # required when user-invocable (use "" if none)
allowed-tools: "Bash(git *) Read Edit" # pre-approved tools
---
```

### Progressive disclosure (keep the budget)

1. **`name` + `description`** (~100 tokens) — loaded for every skill at startup. Make the description _pushy_: list the literal phrases a user might say. Claude under-triggers skills.
2. **`SKILL.md` body** (< ~5000 tokens, < 500 lines) — loaded only on activation.
3. **Reference files** (`references/`, `assets/`, `scripts/`) — loaded only when the body points to them. Split anything over ~300–500 lines out.

### Write skills as a PROCESS, not prose

The strongest skills are workflows with teeth, not reference essays. Use [`branch-review`](skills/branch-review/SKILL.md) as the reference implementation. It demonstrates the pattern:

- **Checkpoints** — a numbered execution order, not a wall of advice.
- **Exit criteria** — an explicit checklist; the task is not "done" until every box holds.
- **Anti-rationalization table** — maps each tempting excuse ("while I'm here…") to the rule that overrides it, so the agent cannot rationalize its way out of discipline.

### Before you commit

```bash
npm run sync          # validate + regenerate the manifest
npm run prettier:fix  # format
```
