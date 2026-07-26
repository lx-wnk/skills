# Session-Handoff: Rotating `latest.md` + Archived Handoffs

**Date:** 2026-07-26
**Status:** Approved (design), pending spec review
**Scope:** `skills/session-handoff/SKILL.md`, `STYLEGUIDE.md`
**Out of scope:** tracking handoffs in git (they stay under gitignored `outputs/`)

## Problem

`session-handoff` writes a single `outputs/HANDOFF.md` and, on re-run, **prepends** a new dated section so the file accumulates every session forever. The user wants **rotation** instead: always a current `latest.md`, with the previous handoff moved to its own archived file named by date + topic.

Context: `outputs/` is gitignored (STYLEGUIDE §6), so all handoffs are **local-only**. Rotation is a personal local archive, not a git-history substitute.

## Design

### A. Layout & naming

```
outputs/handoffs/
  latest.md                     ← always the current handoff
  2026-07-26-auth-refactor.md   ← archived (date + topic from frontmatter)
  2026-07-24-simplify-gate.md
  2026-07-24-simplify-gate-2.md ← same-day/topic collision → -2, -3, …
```

- Output path moves from `outputs/HANDOFF.md` → `outputs/handoffs/latest.md`.
- The old "prepend a new dated section" behavior is **removed entirely** — replaced by rotation.

### B. Frontmatter stamp (every `latest.md`)

```yaml
---
handoff-date: 2026-07-26
handoff-slug: auth-refactor
---
# Session Handoff — 2026-07-26
...
```

- The stamp is the single source of truth for the archive filename. It travels with the file on rotation, so archived files stay self-describing.
- Decoupling display (the `# Session Handoff — {DATE}` header, which may be localized) from machine state (the frontmatter) means the header can change freely without breaking rotation.

### C. Rotation flow (Step 3, runs on every invocation)

```
1. mkdir -p outputs/handoffs
2. Determine the topic slug (precedence):
     $ARGUMENTS focus  →  branch name  →  auto-derived from the handoff content
     slugify: lowercase, kebab-case, ASCII only, max ~40 chars,
              strip a leading "focus:" prefix
3. IF outputs/handoffs/latest.md exists:
     - read its frontmatter → {old-date}-{old-slug}
     - target = outputs/handoffs/{old-date}-{old-slug}.md
       (if it already exists → append -2, -3, … until free)
     - mv latest.md → target
   Fallback when frontmatter is missing/corrupt:
     - parse the date from the "# Session Handoff — {DATE}" header line
     - slug = "session"
     - NEVER overwrite or lose it — always archive
4. Write the new latest.md with a fresh frontmatter stamp
```

**Core invariant — never overwrite:** a handoff encodes a whole session's context; losing one is expensive. An ugly `…-session.md` archive always beats a silent overwrite. Rotation must never clobber an existing file.

### D. Legacy migration (one-time, safe)

If a legacy `outputs/HANDOFF.md` exists AND `outputs/handoffs/` does not yet:
- move it once to `outputs/handoffs/{date}-legacy.md` (date parsed from its top section, else today's date).
- Nothing is lost; the new scheme starts clean. This runs before the normal rotation flow on the first invocation after upgrade.

### E. Step 4 confirmation

Report to the user:
- path of the new `outputs/handoffs/latest.md`
- which archive file the previous handoff was rotated into (or "first handoff, nothing rotated")
- count summary: commits, open questions, next steps
- if legacy migration ran: the legacy archive path

### F. Doc sync

- `description` frontmatter + body text: replace `outputs/HANDOFF.md` references with `outputs/handoffs/latest.md`.
- `STYLEGUIDE.md` §6 example (`outputs/HANDOFF.md`) → align to the new path/scheme.
- README: no `argument-hint` change (arguments unchanged); update the description cell only if it names the path.

## Non-Goals

- No git tracking of handoffs (they remain under gitignored `outputs/`).
- No pruning/retention policy for old archives (keep all; revisit later if needed).
- No change to the handoff content schema beyond adding the frontmatter stamp.

## Acceptance Criteria

- [ ] Handoffs write to `outputs/handoffs/latest.md`; the prepend-section behavior is gone.
- [ ] Every `latest.md` carries `handoff-date` + `handoff-slug` frontmatter.
- [ ] On each run with an existing `latest.md`, the old file is rotated to `{date}-{slug}.md` (collision → `-2`, `-3`) and a fresh `latest.md` is written.
- [ ] Topic slug precedence is `$ARGUMENTS focus → branch → auto from content`, slugified per the rules in C.2.
- [ ] Missing/corrupt frontmatter falls back to header-date + `session` slug and still archives — never overwrites.
- [ ] Legacy `outputs/HANDOFF.md` is migrated once to `outputs/handoffs/{date}-legacy.md`.
- [ ] Step 4 confirmation names the latest path and the rotated archive.
- [ ] `description`, body, and STYLEGUIDE §6 reference the new path; README description synced if it names the path.
