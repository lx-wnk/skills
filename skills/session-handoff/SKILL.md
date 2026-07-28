---
name: session-handoff
license: MIT
description: >-
  Generate a structured handoff document at the end of a work session — what was implemented, which decisions were made and why, open questions, and recommended next steps. The document is written to `outputs/handoffs/latest.md`, and the previous handoff is rotated to a dated, topic-named archive (repo convention, cf. `branch-review`). Use this skill whenever the user wants to end a session, create a handoff, or says: "session-handoff", "wrap up", "end of session", "session summary", "hand over to next session", "Handoff erstellen", "Session abschließen", "was haben wir heute gemacht", "Zusammenfassung der Session", "nächste Schritte dokumentieren", "übergib an nächste Session".


user-invocable: true
argument-hint: "[focus topics or time hint, e.g. 'Focus: Auth refactoring' or 'since Monday']"
allowed-tools: "Bash(git *) Bash(date *) Bash(basename *) Bash(mkdir *) Bash(mv *) Bash(test *) Bash(ls *) Read Write Edit"
---

# Session Handoff

Generate a structured handoff document at `outputs/handoffs/latest.md` at the end of a work session. Goal: the next session (or another developer) can pick up exactly where this one left off without reconstructing context from scratch.

**Language:** the handoff content follows the language of the user's request (English request → English handoff, German request → German handoff). Commit messages and code stay in their original language.

**Output path:** the current handoff is always `outputs/handoffs/latest.md`; on each run the previous `latest.md` is rotated to a dated, topic-named archive under `outputs/handoffs/` (see Step 3). `outputs/` should be `.gitignore`-d at repo level; that is the repo's responsibility, not this skill's.

## Examples

```bash
# Simple handoff without arguments
/session-handoff

# With an optional focus hint
/session-handoff Focus: Auth refactoring and new API endpoints

# With a time hint (overrides the default heuristic)
/session-handoff since Monday
```

## Step 1: Determine the session boundary

The session boundary decides which commits land in the handoff. Resolution order:

1. **Conversation context first.** You know from this conversation when the session started — use that knowledge primarily. Example: "we started with the auth refactor today" → only commits from the first refactor commit onward.
2. **`$ARGUMENTS` time hint** (if present): "since Monday", "last 2 days", "today" → translate into `--since="..."`.
3. **Fallback heuristic** (only if 1 and 2 yield nothing): take the last 20 commits and mark in the handoff explicitly that the session boundary is uncertain.

Do not rely on `@{N hours ago}` — that reflog syntax is empty on fresh clones and silently produces empty diffs.

## Step 2: Collect data

```bash
# Date/time with timezone → fills {DATE_UTC} (display header)
date -u '+%Y-%m-%d %H:%M UTC'
# Date only, no time → fills {DATE} (handoff-date frontmatter + archive filenames)
date -u '+%Y-%m-%d'

# Repo name → fills {REPO-NAME}
basename "$(git rev-parse --show-toplevel)"

# Current branch → fills {BRANCH}
git branch --show-current
```

For the commit range, use the boundary determined in Step 1. Examples:

```bash
# Variant A: conversation context says "since commit <SHA>"
git log --oneline <SHA>..HEAD

# Variant B: $ARGUMENTS has a time hint (translated to --since)
git log --oneline --since="<translated time hint>"

# Variant C: fallback (session boundary uncertain)
git log --oneline -20
```

Changed files for the same range: `git log --name-only --pretty=format: <range> | sort -u`.

```bash
# Currently uncommitted changes
git status --short

# Open TODOs in code (common patterns, includes untracked files)
git grep --untracked -n "TODO\|FIXME\|HACK\|XXX\|NOCOMMIT" -- ':!*.lock' ':!node_modules' 2>/dev/null | head -40
```

Optionally read files the git data identifies as central (e.g. files with the largest churn in the range, `CLAUDE.md` if present).

## Step 3: Rotate and write the handoff

**Prepare the handoffs directory:**

```bash
mkdir -p outputs/handoffs
```

**One-time legacy migration:** if a legacy `outputs/HANDOFF.md` exists and there is no `outputs/handoffs/latest.md` yet, move it once so nothing is lost. Use the leading `YYYY-MM-DD` date from the legacy file's top `# Session Handoff — {DATE_UTC}` header if present (drop the time), else today's UTC date. If the target already exists, suffix `-2`, `-3`, … — never overwrite:

```bash
target="outputs/handoffs/${LEGACY_DATE}-legacy.md"
n=2
while [ -e "$target" ]; do
  target="outputs/handoffs/${LEGACY_DATE}-legacy-${n}.md"
  n=$((n + 1))
done
mv outputs/HANDOFF.md "$target"
```

**Determine the topic slug** (precedence, first match wins):

1. `$ARGUMENTS` focus (strip a leading `focus:` / `Focus:` prefix)
2. the current git branch name
3. auto-derived from the handoff content (the session's main feature/area)

Slugify: lowercase, kebab-case, ASCII only, collapse spaces/underscores to `-`, max ~40 chars.

**Rotate the existing latest** — if `outputs/handoffs/latest.md` exists:

1. Read its YAML frontmatter → `handoff-date` and `handoff-slug`.
   - Fallback when the frontmatter is missing or corrupt: parse the leading `YYYY-MM-DD` date out of the first H1 line (`# ... — {DATE_UTC}`, regardless of wording/language) and drop the time. Use the slug `session`. Else, if no date can be parsed, use today's UTC date.
2. Compute the archive target `outputs/handoffs/{handoff-date}-{handoff-slug}.md`. If that file already exists, append `-2`, `-3`, … until the name is free. **Never overwrite** — a lost handoff is expensive.
3. Compute `$target` with the same escalation as above (`while [ -e "$target" ]`, appending `-2`, `-3`, …), then:
   ```bash
   mv outputs/handoffs/latest.md "$target"
   ```

If no `latest.md` exists yet, skip rotation (this is the first handoff).

**Write the new `outputs/handoffs/latest.md`** using the schema below, stamped with fresh frontmatter (`handoff-date` = today's UTC date, `handoff-slug` = the slug determined above).

**Generate the file contents** using the schema below. **Important:** the HTML comments (`<!-- ... -->`) are instructions for you — they **must not** appear in the final file. Replace each comment with the actual content, or leave the section as `_(none)_`.

Section headers in the template are shown in English; translate them to the user's request language when emitting the file.

```markdown
---
handoff-date: "{DATE}"
handoff-slug: "{TOPIC_SLUG}"
---

# Session Handoff — {DATE_UTC}

> Generated by `/session-handoff` · Repo: {REPO-NAME} · Branch: {BRANCH}

---

## What was implemented

<!-- List of concrete changes in this session, grouped by feature/area.
     Each point should make clear: what? where (file/module)? -->

- ...

## Commits in this session

<!-- The relevant git commits as a compact list -->

| Hash | Message |
| ---- | ------- |
| ...  | ...     |

## Uncommitted changes (WIP)

<!-- Auto-filled from `git status --short` — shows what is not yet committed.
     If nothing is uncommitted: write `_(none)_`. -->

- ...

## Key decisions

<!-- Architecture or design decisions that were made — and WHY.
     Important: also briefly name rejected alternatives so the next
     session does not retrace the same dead ends. -->

- **Decision:** ... **Rationale:** ...

## Open questions

<!-- What is unresolved? What still needs discussion, research, or a decision?
     Phrase concretely and actionably. -->

- [ ] ...

## Open TODOs in code

<!-- Auto-filled from `git grep TODO/FIXME` — only relevant ones, no stale entries -->

- [ ] `file.ts:42` — ...

## Recommended next steps

<!-- Prioritized tasks for the next session. Top priority first.
     Each step should be immediately actionable (no vague "continue"). -->

- [ ] ...
- [ ] ...
- [ ] ...

---

_Last updated: {DATE_UTC}_
```

### Notes on filling the schema

**What was implemented:** derive from the git commits and changed files. Summarize what logically belongs together — do not list every commit individually, group by feature/area.

**Decisions:** also write down what was _not_ implemented and why. That information is often more valuable than the description of what was done.

**Uncommitted changes:** fill the section with `git status --short`. If nothing is uncommitted, write `_(none)_`.

**Open TODOs:** filter the `git grep` output — keep only TODOs that arose in this session or that matter for the next steps. Drop old TODOs in untouched files.

**Next steps:** be concrete. Instead of "write tests", write "add unit tests for `AuthService.login()` in `tests/auth.test.ts`".

**Optional arguments (`$ARGUMENTS`):** if the user passed focus topics, notes, or a time hint, factor them into Step 1 (session boundary) and into prioritizing the next steps.

## Step 4: Confirmation

Tell the user:

- Path of the current handoff (`outputs/handoffs/latest.md`)
- Which archive the previous handoff was rotated into, or that this is the first handoff (nothing rotated)
- If a legacy `outputs/HANDOFF.md` was migrated: the legacy archive path
- Short summary: how many commits, how many open questions, how many next steps

## Related skills

- `agent-context-update` — when project-spanning knowledge from this session should flow into the Agent-Context alongside the handoff.
- `branch-review` — when a code review of the session changes is wanted before the handoff.
