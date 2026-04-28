# Distribution Strategy: Dual Channel (skills.sh + Claude Code Plugin)

**Date:** 2026-04-28
**Status:** Approved

## Summary

Distribute this skills repo through two complementary channels without duplicating content:

- **skills.sh** — agent-agnostic, for Cursor, Copilot, Windsurf, Gemini, and others
- **Claude Code Plugin Marketplace** — native Claude Code experience via `/plugin install`

Both channels share the same `skills/<name>/SKILL.md` files as single source of truth. No content duplication.

## Audience

- Personal use (Alexander Wink)
- dasistweb-internal (colleagues)
- Broader developer community

## Repo Structure Changes

```
skills/                          ← unchanged
├── agent-context-init/SKILL.md
├── agent-context-update/SKILL.md
├── architecture-design/SKILL.md
├── architecture-review/SKILL.md
├── component-design/SKILL.md
├── component-review/SKILL.md
├── obsidian/SKILL.md
├── review-and-fix/SKILL.md
└── tech-gazette/SKILL.md
.claude-plugin/
└── plugin.json                  ← NEW: Claude Code plugin manifest
marketplace.json                 ← NEW: Plugin marketplace catalog
README.md                        ← UPDATE: add 5 missing skills to table
```

## Distribution Channels

### Channel 1: skills.sh (already working)

GitHub-based distribution via the skills.sh CLI. No npm publish required.

```bash
# Install all skills
npx skills add lx-wnk/skills

# Install a single skill
npx skills add lx-wnk/skills@review-and-fix
```

**What's missing today:** README only lists 4 of 9 skills. Missing: `architecture-design`, `architecture-review`, `component-design`, `component-review`, `obsidian`.

### Channel 2: Claude Code Plugin Marketplace (new)

Users add the marketplace once, then install the plugin:

```bash
/plugin marketplace add https://raw.githubusercontent.com/lx-wnk/skills/main/marketplace.json
/plugin install lx-wnk-skills
```

Skills become available as `/lx-wnk-skills:<skill-name>` in Claude Code (e.g. `/lx-wnk-skills:review-and-fix`). This namespacing is mandatory for plugins and differs from skills.sh installs, where the same skill is invoked as `/review-and-fix` without a prefix.

Optional next step: submit to the official Anthropic marketplace via `claude.ai/settings/plugins/submit` for discoverability through Claude Code's built-in plugin browser.

## New Files

### `.claude-plugin/plugin.json`

```json
{
  "name": "lx-wnk-skills",
  "description": "Curated skills for AI coding agents — architecture design/review, component design/review, PR review-and-fix, tech-gazette, obsidian, and agent-context lifecycle.",
  "version": "1.0.0",
  "author": { "name": "Alexander Wink" },
  "homepage": "https://github.com/lx-wnk/skills",
  "repository": "https://github.com/lx-wnk/skills"
}
```

Version is bumped manually on releases. Claude Code uses the git commit SHA if `version` is omitted, making every commit a "new version" — explicit versioning is intentional here.

### `marketplace.json`

```json
{
  "name": "lx-wnk Skills",
  "description": "Curated skills for AI coding agents",
  "plugins": [
    {
      "name": "lx-wnk-skills",
      "description": "Architecture, review, tech-gazette, obsidian, and agent-context skills",
      "source": {
        "type": "git",
        "url": "https://github.com/lx-wnk/skills"
      }
    }
  ]
}
```

## README Update

Add the 5 missing skills to the existing table in `README.md`:

| Skill | Description | Invoke |
|---|---|---|
| `architecture-design` | Design system-level architecture, bounded contexts, modules, ADRs | `/architecture-design [topic]` |
| `architecture-review` | Review architecture of PR, branch, namespace, or whole project | `/architecture-review [pr N \| branch X \| namespace path]` |
| `component-design` | Design low-level component/class structure and patterns | `/component-design [component name]` |
| `component-review` | Review class design, SOLID, cohesion, pattern correctness | `/component-review [pr N \| branch X \| namespace path]` |
| `obsidian` | Obsidian vault access via Local REST API | `/obsidian [query or note path]` |

## Future: Dynamic Skills (out of scope for this iteration)

When individual skills need dynamic runtime capabilities (e.g. `tech-gazette` fetching live feeds, `obsidian` querying the vault directly), add an `.mcp.json` file at the plugin root pointing to a local or hosted MCP server. This does not require any changes to the existing SKILL.md files or distribution setup — it is additive.

## Out of Scope

- Publishing to npm (not required for either channel)
- Building an MCP server (deferred to future iteration)
- Changing the SKILL.md format or content

## Success Criteria

- [ ] `npx skills add lx-wnk/skills` installs all 9 skills (README reflects all 9)
- [ ] `/plugin marketplace add <url>` + `/plugin install lx-wnk-skills` works in Claude Code
- [ ] All 9 skills appear under `/lx-wnk-skills:<name>` after plugin install
- [ ] Plugin tested locally with `claude --plugin-dir ./`
