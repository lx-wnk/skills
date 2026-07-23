---
name: agent-context-update
license: MIT
description: 'Update Agent-Context to the latest version — refreshes shared infrastructure files while preserving all project-specific configuration, memory, and skills. Use this skill whenever the user asks to update Agent-Context, upgrade Agent-Context, sync Agent-Context, or says things like "update agent-context", "get latest agent-context", "refresh context files", "sync agent infrastructure". Also use when the user wants to check if a newer Agent-Context version is available.'
user-invocable: true
argument-hint: "[version tag, e.g. 0.8.1 (no v prefix), or leave empty for latest]"
allowed-tools: "Bash(gh *) Bash(curl *) Read Write WebFetch Agent"
---

# Update Agent-Context

Update shared Agent-Context files to the latest version without touching project-owned content.

## Examples

```bash
# Update to latest version
/agent-context-update

# Update to a specific version
/agent-context-update v0.3.0
```

## Prerequisites Check

Before starting, verify Agent-Context is installed:

```bash
cat .agent-context/.agent-context-version 2>/dev/null
```

- If the file **does not exist**: STOP. Tell the user Agent-Context is not initialized and suggest using the `init` skill instead.
- If the file **exists**: note the current version and proceed.

## Update

Resolve the target release tag first, then fetch the setup prompt pinned to that tag and follow its instructions. Fetching a specific release tag (never the mutable `main` branch) is deliberate: the tag is pinned for the whole run, so the fetched prompt is fixed between resolution and execution, and it changes only when a new release is published — unlike `main`, which every push mutates. (Full tamper-resistance additionally requires tag/release protection on the source repo.)

```bash
# Resolve target version: explicit $ARGUMENTS, else latest release (never mutable `main`)
TAG="${ARGUMENTS:-$(gh api repos/lx-wnk/Agent-Context/releases/latest --jq .tag_name)}"
curl -fsSL "https://raw.githubusercontent.com/lx-wnk/Agent-Context/${TAG}/.prompts/setup-prompt.md"
```

The setup prompt auto-detects UPDATE mode (because `.agent-context-version` exists) and handles:

1. **Version check** — fetch latest release, compare with current version
2. **Shared file refresh** — overwrite only shared files (`agent-startup.md`, `layer0-agent-workflow.md`, `base-principles.md`, `plugins.json`)
3. **New templates** — create any new template files introduced in the new version (without overwriting existing ones)
4. **Agent sync** — update shared agents where they already exist
5. **Plugin sync** — merge new plugins into `.claude/settings.json`
6. **Compatibility check** — scan for deprecated patterns and suggest fixes

If `$ARGUMENTS` contains a version tag, use that version instead of latest.

## What is NEVER touched

- `AGENTS.md`, `layer1-bootstrap.md`, `layer2-project-core.md`, `layer3-guidebook.md`
- All files in `memory/` and `skills/`
- `decisions.json`
- `.claude/settings.json` (only additive merges)

## After Update

Report:

- Previous version → new version
- Files updated
- Any new templates created
- Compatibility warnings (if any)
