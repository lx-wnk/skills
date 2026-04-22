---
name: obsidian
description: >-
  Obsidian vault access via Local REST API using curl. Use this skill to read, search, create,
  or update notes in the Obsidian knowledge base.

  Trigger on ANY of these:
  - User mentions "obsidian", "vault", "knowledge base", "my notes", or "note" in a save/lookup context
  - User asks to "save", "persist", "document", "note down", or "look up" information
  - User says things like "save this for later", "note this down", "add this to my knowledge base",
    "search my notes", "check if I have notes on X", "create a note", "update the note for X"
  - CLAUDE.md says to search or store in Obsidian before/after tasks — do it proactively
  - Starting a task where prior context might exist → search Obsidian first
  - Mid-task discovery of a non-obvious insight, gotcha, root cause, or workaround → save it
  - Finishing a task with decisions or learnings worth remembering → persist to Obsidian
  - Something is written to CLAUDE.md or project docs → also save it to Obsidian for cross-project search
user-invocable: true
argument-hint: "[search query or note path]"
allowed-tools: "Bash(curl *)"
---

# Obsidian Knowledge Base – curl API Reference

## When to use this skill

There are three natural moments to reach for Obsidian:

1. **Before a task** — search for existing context so you don't repeat research or contradict prior decisions
2. **Mid-task** — when you discover something non-obvious (a hidden bug cause, a framework gotcha, an architecture constraint, a deliberate tradeoff) that would cost future-you to rediscover
3. **After a task** — persist new learnings, updated project status, or decisions made during the session

If something gets written to CLAUDE.md or project documentation, consider whether it also belongs in Obsidian — CLAUDE.md is project-scoped, Obsidian is cross-project and searchable.

---

## Base Config

- **URL:** `$OBSIDIAN_BASE_URL`
- **Auth:** `$OBSIDIAN_API_KEY`
- **Root folder:** `$OBSIDIAN_ROOT` (default: `claude-memory`, set in `.env`)
- **SSL:** self-signed cert → always use `curl -sk`
- **Default subfolders:** `private/`, `work/`, `misc/`

## Helper alias (reduces repetition)

```bash
obs() { curl -sk -H "Authorization: Bearer $OBSIDIAN_API_KEY" "$@"; }
ROOT="${OBSIDIAN_ROOT:-claude-memory}"
```

> **Note:** Each Bash tool call runs in a fresh shell — `obs()` and `ROOT` do not persist between
> invocations. Redefine both at the top of each command, or inline the full `curl -sk -H "Authorization: Bearer $OBSIDIAN_API_KEY"` directly.

---

## Search

Uses Obsidian's built-in index — fast even on large vaults.

```bash
obs -X POST "$OBSIDIAN_BASE_URL/search/simple/?query=KEYWORD" \
  | python3 -c "import sys,json; [print(r['filename']) for r in json.load(sys.stdin)]"
```

Use specific keywords that likely appear in note filenames (e.g. `auth`, `docker`, `deployment`).

---

## Read a note

```bash
obs "$OBSIDIAN_BASE_URL/vault/${ROOT}/work/My-Note.md"
```

URL-encode spaces as `%20`. For complex paths:

```bash
python3 -c "import urllib.parse; print(urllib.parse.quote('PATH/WITH SPACES'))"
```

---

## Create or update a note (PUT = upsert)

```bash
obs -X PUT \
  -H "Content-Type: text/markdown" \
  --data-binary "# Title

Content here." \
  "$OBSIDIAN_BASE_URL/vault/${ROOT}/work/My-Note.md"
```

---

## Append to an existing note

```bash
obs -X POST \
  -H "Content-Type: text/markdown" \
  --data-binary "

## New Section
Content." \
  "$OBSIDIAN_BASE_URL/vault/${ROOT}/work/My-Note.md"
```

---

## Delete a note

```bash
obs -X DELETE "$OBSIDIAN_BASE_URL/vault/${ROOT}/work/My-Note.md"
```

---

## List folder contents

```bash
obs "$OBSIDIAN_BASE_URL/vault/${ROOT}/work/"
```

---

## Note naming conventions

- One topic per note — no catch-all files
- Filename = searchable keyword (`Docker-Port-Conflicts.md`, `Auth-JWT-Setup.md`)
- Path: `$OBSIDIAN_ROOT/{private|work|misc}/{Topic}.md`
  - `work/` — project notes, architecture decisions, tickets, bug findings
  - `private/` — personal projects and private insights
  - `misc/` — tools, plugins, general knowledge that doesn't fit elsewhere

---

## Error codes

| Code        | Meaning                                 |
| ----------- | --------------------------------------- |
| 200/204     | OK                                      |
| 401         | Wrong or missing API key                |
| 404         | Note/path doesn't exist                 |
| 0 / refused | Obsidian not running or plugin disabled |
