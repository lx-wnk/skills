# skills

[![CI](https://github.com/lx-wnk/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/lx-wnk/skills/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/lx-wnk/skills?sort=semver)](https://github.com/lx-wnk/skills/releases) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Standard: agentskills.io](https://img.shields.io/badge/standard-agentskills.io-7c3aed.svg)](https://agentskills.io) [![Install: skills.sh](https://img.shields.io/badge/install-skills.sh-000.svg)](https://skills.sh)

Curated, agent-agnostic skills for AI coding agents — reusable workflows your agent loads on demand.

**Works with** Claude Code · Cursor · Copilot · Windsurf · Gemini · any [agentskills.io](https://agentskills.io)-compatible agent.

## Why skills?

A capable coding agent still forgets _how you want work done_. Every session you re-explain the review process, the release steps, the house style. A skill captures that process once — as an executable workflow the agent picks up automatically when the moment matches.

- **Consistency** — the same review, the same release checklist, every time, regardless of who (or which agent) runs it.
- **No prompt babysitting** — a _pushy_ `description` with explicit trigger phrases means the agent invokes the skill on its own. You say "review my branch", the workflow fires.
- **Portable** — one open standard, many agents. Write once, run wherever your team works.
- **Cheap to load** — only a skill's name + description sit in context by default (~100 tokens each). The full instructions load _only_ when the skill activates, so a large library costs almost nothing until used.

## Install

```bash
# all skills
npx skills add lx-wnk/skills

# a single skill
npx skills add lx-wnk/skills@branch-review

# pin a release
npx skills add lx-wnk/skills@v0.2.0
```

## Quick example

Once installed, just talk to your agent in plain language:

> **You:** review my branch

`branch-review` fires on its own — no slash command, no setup. It spawns parallel agents for code quality, security, SEO, legal, UX, and performance, then consolidates everything into a prioritized `outputs/Findings.md`. The skill matched your intent from its trigger phrases.

Prefer to be explicit? Every skill is also a slash command: `/branch-review`.

## Available Skills

**Design & Architecture**

| Skill | Description | Invoke |
| --- | --- | --- |
| [architecture-design](skills/architecture-design/SKILL.md) | Design system-level architecture — bounded contexts, modules, domains, ADRs | `/architecture-design [topic]` |
| [architecture-review](skills/architecture-review/SKILL.md) | Review architecture of PR, branch, namespace, or whole project for structural issues | `/architecture-review [pr N \| branch X \| namespace path]` |
| [component-design](skills/component-design/SKILL.md) | Design low-level component and class structure — patterns, interfaces, aggregates | `/component-design [component name]` |
| [component-review](skills/component-review/SKILL.md) | Review class design, SOLID, cohesion, and pattern correctness | `/component-review [pr N \| branch X \| namespace path]` |

**Review & Audit**

| Skill | Description | Invoke |
| --- | --- | --- |
| [branch-review](skills/branch-review/SKILL.md) | Multi-agent review of branch diff — code/security/SEO/legal/UX/perf; optional `--apply-fixes` mode | `/branch-review [base-branch] [--apply-fixes]` |
| [full-project-review](skills/full-project-review/SKILL.md) | Multi-agent audit of the whole project (HEAD state, all repos) | `/full-project-review` |
| [oss-readiness](skills/oss-readiness/SKILL.md) | Audit a repo for public-release readiness — README, docs, community-health files, repo signals | `/oss-readiness [path] [--apply-fixes]` |

**Agent Context & Coordination**

| Skill | Description | Invoke |
| --- | --- | --- |
| [agent-context-init](skills/agent-context-init/SKILL.md) | Initialize Agent-Context in a project — sets up layered context architecture, memory, and skills | `/agent-context-init [version]` |
| [agent-context-update](skills/agent-context-update/SKILL.md) | Update Agent-Context to the latest version — refreshes shared files, preserves project config | `/agent-context-update [version]` |
| [atom-operating-model](skills/atom-operating-model/SKILL.md) | Agent-team operating model — coordinating PM fans out isolated worker agents across git worktrees | `/atom-operating-model [tasks to coordinate]` |

**Knowledge & Deliverables**

| Skill | Description | Invoke |
| --- | --- | --- |
| [obsidian](skills/obsidian/SKILL.md) | Obsidian vault access via Local REST API — read, search, create, update notes | `/obsidian [search query or note path]` |
| [session-handoff](skills/session-handoff/SKILL.md) | Generate a structured `outputs/handoffs/latest.md` at the end of a session — changes, decisions, next steps; rotates the previous handoff to a dated archive | `/session-handoff [focus topics or time hint]` |
| [tech-gazette](skills/tech-gazette/SKILL.md) | Generate a daily or weekly tech news briefing as a self-contained HTML newspaper | `/tech-gazette [--daily\|--weekly] [customers]` |

## How it works

A skill is just a folder with a `SKILL.md` — YAML frontmatter plus Markdown instructions. It loads in three stages (**progressive disclosure**), so the library scales without flooding the context window:

1. **`name` + `description`** — always in context. The `description` is the trigger: it lists the literal phrases that should fire the skill.
2. **`SKILL.md` body** — loaded only when the skill activates.
3. **`references/`, `assets/`, `scripts/`** — loaded only when the body points to them.

Claude-Code-only conveniences (`user-invocable`, `argument-hint`) are additive — other agents simply ignore them, so the same skill stays portable.

## Contributing

Adding or changing a skill? Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** for the workflow, and **[STYLEGUIDE.md](STYLEGUIDE.md)** for the detailed authoring rules.

## License

[MIT](LICENSE)
