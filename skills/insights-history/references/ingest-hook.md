# Ingest hook — opt-in installation

Read this when installing the `SessionEnd` hook via `/insights-history --install-hook`, or when checking why it did or didn't fire.

## Why this isn't shipped as a plugin `hooks.json`

A plugin can ship `hooks.json` and have it load automatically on install — no user action, no confirmation. This skill deliberately does not do that, for two reasons:

1. **The repository is public.** A plugin that silently starts writing every user's prompts to disk the moment it's installed is a privacy problem regardless of the data staying local — the archive is a durable copy of conversation content, and turning that on has to be a decision the user makes, not a side effect of `npx skills add` or a marketplace install.
2. **The plugin cache path is version-pinned and breaks on update.** A hook entry pointing at a path inside the plugin's install directory (`~/.claude/plugins/cache/<name>@<version>/...`) stops resolving the moment the plugin updates to a new version — the old path is gone. `${CLAUDE_PLUGIN_ROOT}` exists to solve exactly this, but it only resolves inside hooks a plugin declares in its own `hooks.json`; it does **not** resolve when the same string is written into the user's global `settings.json`, which is where a `SessionEnd` hook has to live to survive plugin updates and uninstalls.

The fix for both is the same: install the hook script itself to a stable, plugin-independent path, and treat writing it as an explicit, confirmed action rather than an install-time default.

## `ingest.mjs` is not a single file

`scripts/ingest.mjs` imports two sibling modules by relative path — `./lib/store.mjs` and `./lib/transcript.mjs`. Copying only `ingest.mjs` to a standalone location leaves those imports pointing at a `lib/` directory that does not exist there, and Node fails at module resolution before the script's own `try/catch` (or its inertness guarantee) ever runs:

```
$ echo '{"session_id":"probe","transcript_path":"/nonexistent.jsonl","hook_event_name":"SessionEnd"}' \
  | node /tmp/hook-repro/ingest.mjs
node:internal/modules/esm/resolve:272
    throw new ERR_MODULE_NOT_FOUND(...)
exit=1
```

That failure happens on every session end: a stack trace on stderr, nothing archived — precisely what this skill exists to prevent. The install therefore copies the whole relative layout `ingest.mjs` depends on, not just the one file. `ingest.mjs` needs only two of `lib/`'s five modules (`store.mjs`, `transcript.mjs` — `aggregate.mjs`, `range.mjs`, and `render.mjs` are `report.mjs`'s dependencies, not the hook's), so only those two are copied.

## What `--install-hook` does

A **single confirmation** covers both writes into the user's environment — nothing is written before the user has seen and approved everything that will be written:

1. Lists the files that will be copied and their destination:
   - `scripts/ingest.mjs` → `~/.claude/scripts/insights-history/ingest.mjs`
   - `scripts/lib/store.mjs` → `~/.claude/scripts/insights-history/lib/store.mjs`
   - `scripts/lib/transcript.mjs` → `~/.claude/scripts/insights-history/lib/transcript.mjs`
2. Shows the exact `settings.json` diff it intends to make (below).
3. Asks for one explicit confirmation covering both the copy and the settings patch.
4. **Only after confirmation:**
   1. Performs the copy, preserving the `lib/` layout.
   2. Runs the verification probe (below) against the copied tree. A non-zero exit or any output stops here — the settings patch is **not** applied, and the user is told the copy is broken rather than being left with a registered hook that can't run.
   3. Patches `~/.claude/settings.json` to add the hook entry.

An interrupted or declined `--install-hook` invocation leaves nothing behind — no partial copy, no registered hook — because both writes are gated by the same single "yes."

## Verify the copy works, before touching settings

Run immediately after the copy, before the `settings.json` patch:

```bash
echo '{"session_id":"probe","transcript_path":"/nonexistent.jsonl","hook_event_name":"SessionEnd"}' \
  | node ~/.claude/scripts/insights-history/ingest.mjs; echo "exit=$?"
```

Expected: `exit=0` and no output — the same inertness the hook guarantees for a real malformed payload. A non-zero exit or any stack trace means the copy is incomplete (a missing `lib/` module is the most likely cause) — stop and do not patch `settings.json`.

## The settings.json snippet

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/scripts/insights-history/ingest.mjs"
          }
        ]
      }
    ]
  }
}
```

If `~/.claude/settings.json` already has a `hooks.SessionEnd` array (from another tool), the entry is appended to it, not replacing the array — merge, never overwrite, and the diff shown before confirmation must make that merge visible.

## Copy target

`~/.claude/scripts/insights-history/` — chosen because it is:

- Outside `~/.claude/plugins/`, so a plugin update or removal never touches it.
- Inside `~/.claude/`, so it travels with the rest of the user's Claude Code configuration (backups, dotfile syncing) without needing repo access.
- A stable, predictable path a user can `cat`, edit, or `rm -rf` without going through the skill again.
- A directory, not a single file, because the hook script has real internal dependencies (see above) — the install target has to preserve that shape or the hook cannot run.

Re-running `--install-hook` overwrites the copy with the current `scripts/ingest.mjs` and its two `lib/` dependencies, so upgrading this skill and re-running `--install-hook` is how the installed hook picks up ingest fixes.

## Verifying it fires

Trigger a session end (exit or `/clear` a session) and check:

```bash
claude --debug
```

`--debug` logs hook invocations, including `SessionEnd`, to stderr as they fire — look for a line naming the `SessionEnd` hook and the command it ran. Absence of that line means the hook isn't registered (check `~/.claude/settings.json` for the entry) or fired but errored before logging (check `~/.claude/usage-data/ingest.log`, where all ingest failures land — never on stderr, by design, since a `SessionEnd` hook must never interfere with session teardown).

A second, functional check: after a session ends, confirm the corresponding files exist —

```bash
ls ~/.claude/usage-data/session-meta/ | tail -1
ls ~/.claude/usage-data/archive/ | tail -1
```

A new `<session-id>.json` and `<session-id>.slim.jsonl.gz`, both with a fresh mtime, means the hook ran end-to-end.

## Without the hook

The skill still works without it — `/insights-history` runs `ingest.mjs --backfill` before every report, which walks `~/.claude/projects/` and catches anything the hook would have caught. The gap the hook closes is retention risk between reports: without it, a session's window between `SessionEnd` and the next `/insights-history` invocation is exposed to the transcript retention policy (`cleanupPeriodDays`, default 30) the same way `/insights` itself is. Installing the hook is what makes the archive durable continuously rather than only at report time.

## Hook schema changes across Claude Code versions

Hook payload fields and the settings.json hook schema are not guaranteed stable across Claude Code releases. If the hook stops firing after an upgrade, check the current [hooks reference](https://code.claude.com/docs/en/hooks) before assuming the installed entry is wrong — the schema itself may have moved.
