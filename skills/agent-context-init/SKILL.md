---
name: agent-context-init
description: >-
  Initialize Agent-Context in the current project — sets up the layered context architecture with shared infrastructure,
  project-specific layers, memory stubs, and skill registry.
  Use this skill whenever the user asks to initialize Agent-Context, set up Agent-Context, bootstrap Agent-Context,
  or says things like "init agent-context", "set up context layers", "add agent-context to this project".
  Also use when the user wants to start using Agent-Context in a new or existing project.
user-invocable: true
argument-hint: "[version tag, e.g. v0.2.1, or leave empty for latest]"
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

Fetch the setup prompt from the Agent-Context repo and follow its instructions:

```bash
curl -fsSL https://raw.githubusercontent.com/lx-wnk/Agent-Context/main/.prompts/setup-prompt.md
```

Follow the fetched instructions exactly. The setup prompt handles:

1. **Version selection** — fetch available releases, let user choose (or use `$ARGUMENTS` if a version was specified)
2. **Shared files** — download tarball, extract framework files into `.agent-context/`
3. **Project templates** — create project-owned files (AGENTS.md, layers, memory stubs, skills index)
4. **Agent sync** — optionally install shared agents
5. **Plugin sync** — merge plugins into `.claude/settings.json`
6. **Discovery scans** — launch parallel subagents to detect tech stack and fill TODO placeholders

## After Setup

Report what was created:

- Number of files created
- Tech stack discovered
- Any TODO placeholders that still need manual input
- Remind user that project-owned files are theirs to customize
