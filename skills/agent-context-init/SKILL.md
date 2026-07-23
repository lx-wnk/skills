---
name: agent-context-init
license: MIT
description: 'Initialize Agent-Context in the current project — sets up the layered context architecture with shared infrastructure, project-specific layers, memory stubs, and skill registry. Use this skill whenever the user asks to initialize Agent-Context, set up Agent-Context, bootstrap Agent-Context, or says things like "init agent-context", "set up context layers", "add agent-context to this project". Also use when the user wants to start using Agent-Context in a new or existing project.'
user-invocable: true
argument-hint: "[version tag, e.g. 0.8.1 (no v prefix), or leave empty for latest]"
allowed-tools: "Bash(gh *) Bash(curl *) Read Write WebFetch Agent"
---

# Initialize Agent-Context

Set up the Agent-Context layered architecture in the current project.

## Examples

```bash
# Initialize with latest version
/agent-context-init

# Initialize with a specific version
/agent-context-init v0.2.1
```

## Prerequisites Check

Before starting, verify this is a valid target:

```bash
ls .agent-context/.agent-context-version 2>/dev/null
```

- If the file **exists**: STOP. Tell the user Agent-Context is already initialized and suggest using the `update` skill instead.
- If the file **does not exist**: proceed with setup.

## Setup

Resolve the target release tag first, then fetch the setup prompt pinned to that tag and follow its instructions. Fetching a specific release tag (never the mutable `main` branch) is deliberate: the tag is pinned for the whole run, so the fetched prompt is fixed between resolution and execution, and it changes only when a new release is published — unlike `main`, which every push mutates. (Full tamper-resistance additionally requires tag/release protection on the source repo.)

```bash
# Resolve target version: explicit $ARGUMENTS, else latest release (never mutable `main`)
TAG="${ARGUMENTS:-$(gh api repos/lx-wnk/Agent-Context/releases/latest --jq .tag_name)}"
curl -fsSL "https://raw.githubusercontent.com/lx-wnk/Agent-Context/${TAG}/.prompts/setup-prompt.md"
```

Follow the fetched instructions exactly. The setup prompt handles:

1. **Version selection** — fetch available releases, let user choose (or use `$ARGUMENTS` if a version was specified)
2. **Shared files** — download tarball, extract framework files into `.agent-context/`
3. **Project templates** — create project-owned files (AGENTS.md, layers, memory stubs, skills index)
4. **Agent sync** — optionally install shared agents
5. **Plugin sync** — merge plugins into `.claude/settings.json`
6. **Discovery scans** — launch parallel subagents to detect tech stack and fill TODO placeholders

## Trust Boundary & Consent

This skill fetches a remote setup prompt (pinned to a release tag, see above) and follows it. That prompt performs **trust-expanding operations**: it can install transitive agents, merge plugins, and modify `.claude/settings.json`. Treat these as privileged.

Before any step that installs agents (4), merges plugins (5), or writes to `.claude/settings.json`, **stop and get explicit user confirmation** — list exactly what will be installed or changed, then wait for a yes. Never install transitive agents or plugins silently. If the user declines a step, skip it and continue with the rest of setup.

## After Setup

Report what was created:

- Number of files created
- Tech stack discovered
- Any TODO placeholders that still need manual input
- Remind user that project-owned files are theirs to customize
