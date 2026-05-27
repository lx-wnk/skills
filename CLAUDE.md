# skills

Curated skills for AI coding agents, distributed via [skills.sh](https://skills.sh).

## Conventions

- Every skill lives in `skills/<skill-name>/SKILL.md`
- Skills follow the SKILL.md format: YAML frontmatter + Markdown instructions
- Formatting: Prettier (`npm run prettier:fix`)

## SKILL.md Format

Required frontmatter fields:

- `name` — skill identifier
- `description` — when and why to use this skill; must be "pushy" with explicit trigger phrases (e.g. "Use when the user asks to...", "Make sure to use this skill whenever...")
- `user-invocable` — set `true` if callable via `/skill-name`
- `argument-hint` — hint for arguments when user-invocable
- `allowed-tools` — pre-approved tools the skill needs (e.g. `"Bash(gh *) Read Edit"`)

## Language

- Skill instructions: English
- Trigger phrases in `description`: English + German equivalents so skills fire on either language
- Skill output to users: language of the user's request (English or German)

## See Also

- [STYLEGUIDE.md](STYLEGUIDE.md) — concrete authoring rules with examples
