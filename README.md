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

| Skill                                                        | Description                                                                                             | Invoke                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [agent-context-init](skills/agent-context-init/SKILL.md)     | Initialize Agent-Context in a project — sets up layered context architecture, memory, and skills        | `/agent-context-init [version]`                 |
| [agent-context-update](skills/agent-context-update/SKILL.md) | Update Agent-Context to the latest version — refreshes shared files, preserves project config           | `/agent-context-update [version]`               |
| [architecture-design](skills/architecture-design/SKILL.md)   | Design system-level architecture — bounded contexts, modules, domains, ADRs                             | `/architecture-design [topic]`                  |
| [architecture-review](skills/architecture-review/SKILL.md)   | Review architecture of PR, branch, namespace, or whole project for structural issues                    | `/architecture-review [pr N \| branch X \| namespace path]` |
| [component-design](skills/component-design/SKILL.md)         | Design low-level component and class structure — patterns, interfaces, aggregates                       | `/component-design [component name]`            |
| [component-review](skills/component-review/SKILL.md)         | Review class design, SOLID, cohesion, and pattern correctness                                           | `/component-review [pr N \| branch X \| namespace path]` |
| [branch-review](skills/branch-review/SKILL.md)               | Multi-agent review of branch diff — code/security/SEO/legal/UX/perf; optional `--apply-fixes` mode      | `/branch-review [base-branch] [--apply-fixes]`  |
| [full-project-review](skills/full-project-review/SKILL.md)   | Multi-agent audit of the whole project (HEAD state, all repos)                                          | `/full-project-review`                          |
| [obsidian](skills/obsidian/SKILL.md)                         | Obsidian vault access via Local REST API — read, search, create, update notes                           | `/obsidian [search query or note path]`         |
| [tech-gazette](skills/tech-gazette/SKILL.md)                 | Generate a daily or weekly tech news briefing as a self-contained HTML newspaper                        | `/tech-gazette [--daily\|--weekly] [customers]` |

## Contributing

Each skill lives in its own folder under `skills/<skill-name>/SKILL.md`. See [CLAUDE.md](CLAUDE.md) for conventions.
