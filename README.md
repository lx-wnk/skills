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
npx skills add lx-wnk/skills@review-and-fix
```

## Available Skills

| Skill                                                        | Description                                                                                             | Invoke                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [agent-context-init](skills/agent-context-init/SKILL.md)     | Initialize Agent-Context in a project — sets up layered context architecture, memory, and skills        | `/agent-context-init [version]`   |
| [agent-context-update](skills/agent-context-update/SKILL.md) | Update Agent-Context to the latest version — refreshes shared files, preserves project config           | `/agent-context-update [version]` |
| [review-and-fix](skills/review-and-fix/SKILL.md)             | Review open PRs for bugs, compliance violations, and design issues — fix clear ones, escalate decisions | `/review-and-fix [PR-number]`     |

## Contributing

Each skill lives in its own folder under `skills/<skill-name>/SKILL.md`. See [CLAUDE.md](CLAUDE.md) for conventions.
