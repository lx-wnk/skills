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
npx skills add lx-wnk/skills@ac-review-and-fix
```

## Available Skills

| Skill                                                  | Description                                                                                             | Invoke                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [ac-review-and-fix](skills/ac-review-and-fix/SKILL.md) | Review open PRs for bugs, compliance violations, and design issues — fix clear ones, escalate decisions | `/ac-review-and-fix [PR-number]` |

## Contributing

Each skill lives in its own folder under `skills/<skill-name>/SKILL.md`. See [CLAUDE.md](CLAUDE.md) for conventions.
