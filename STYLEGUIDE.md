# Skills Styleguide

Conventions for authoring skills in this repository. The bar is consistency
across skills, low surprise for users, and resilience to format changes
elsewhere in the AI agent ecosystem.

This guide complements [CLAUDE.md](CLAUDE.md) with concrete rules and
examples. When something here conflicts with CLAUDE.md, CLAUDE.md wins.

---

## 1. File Layout

- One skill per folder: `skills/<skill-name>/SKILL.md`.
- Skill folder name is **kebab-case**, lowercase, no prefixes (no `ac-`, no `lx-`).
- Static assets the skill references (templates, sample data) live next to `SKILL.md` in the same folder (e.g. `skills/tech-gazette/template.html`).
- Generated artifacts go to `outputs/` at repo root, not into the skill folder.

## 2. Frontmatter

Required fields (already mandated by CLAUDE.md):

```yaml
---
name: skill-name
description: >-
  One paragraph that is "pushy" — explicit trigger phrases the user might say,
  what this skill does, and (optionally) what it does NOT do.
user-invocable: true
argument-hint: "[arg1] [arg2 (default: foo)]"
allowed-tools: "Bash(git *) Read Edit"
---
```

### `description`

- **Pushy with triggers.** List the literal phrases a user might use ("review my branch", "check the PR", "schau dir den branch an"). The dispatcher matches on these.
- **Negative triggers when needed.** If two skills have overlapping scope, say "NICHT triggern für X — dafür gibt es <other-skill>". See `branch-review` vs. `full-project-review` for the pattern.
- **One paragraph, no internal headings.** YAML scalar, not Markdown.
- **Mention scope limits early** ("only the diff, not the whole project").

### `user-invocable` and `argument-hint`

- If `user-invocable: true`, `argument-hint` is required — even if the skill takes no arguments (then write `""`).
- The hint is a *hint*, not a contract: it must accept reasonable variations (e.g. a numeric PR ID and a branch name in the same slot if both are valid). Document any positional/flag mix in the body.

### `allowed-tools`

Granularity rule: prefer **wildcards within a tool family** over per-subcommand entries.

- ✅ `"Bash(git *) Bash(gh *) Read Edit Write"`
- ❌ `"Bash(git status) Bash(git diff) Bash(git log) Bash(git show)"` — too granular, adds maintenance churn

Exceptions: when a single subcommand is dangerous and the skill should be allowed only that one, list it explicitly.

## 3. Body Structure

A skill body is read in order by an agent. Optimize for that.

Recommended top-level sections, in this order:

1. **Title** — `# <Human Title>` matching the skill name in spirit.
2. **One-line purpose** — under the title, before any heading.
3. **Scope** — what this skill does and explicitly does *not* cover.
4. **Examples** — at least two `bash` blocks showing invocation forms.
5. **Workflow / Phases** — numbered. Use a Mermaid `flowchart TD` for skills with more than three phases.
6. **Output format** — if the skill produces a file, document the exact schema.
7. **Principles / Rules** — short, imperative bullets.
8. **Related skills** — cross-link to skills with adjacent scope.

Skip sections that don't apply rather than leaving empty placeholders.

## 4. Language

CLAUDE.md is the source of truth: **skill instructions are English, output to users may be German** where the skill is German-leaning by intent (e.g. `branch-review`, `full-project-review`, `session-handoff`).

This means:

- The instructions in the SKILL.md body **may** be German if the skill is explicitly designed to produce German output and the entire skill is monolingual. Don't switch languages mid-file.
- The frontmatter `description` follows the same language as the body.
- Trigger phrases in the description **should include both English and German variants** if both are common — that maximizes routing accuracy.
- Code, command examples, and tool names stay in their original language.

When in doubt: write English. It is the lowest-friction default.

## 5. Read-only vs. Write Skills

A skill must clearly signal whether it modifies the codebase.

- **Read-only review skills** (e.g. `architecture-review`, `component-review`, `branch-review` without `--apply-fixes`): explicitly state "Findings are reports, never modify code" in the rules.
- **Write skills** (e.g. `agent-context-init`, `session-handoff`): list every file/path the skill creates or edits.
- **Hybrid skills** with optional write phase (e.g. `branch-review --apply-fixes`): keep read-only behavior as the default, gate writes behind an explicit flag, and document preconditions (clean working tree, branch is not the default branch, etc.).

Never have a skill silently switch from read-only to write based on inference — the user must opt in.

## 6. Output Files

Skills that emit a deliverable file:

- Write to `outputs/<filename>` (e.g. `outputs/Findings.md`, `outputs/HANDOFF.md`).
- Create the directory with `mkdir -p outputs` rather than failing if it doesn't exist.
- The repository's `.gitignore` is responsible for ignoring `outputs/` — a skill must not modify `.gitignore` itself.
- If the file already exists: default to **appending a new dated section** above the existing content. Only ask the user before overwriting.

For schema-driven outputs (e.g. `Findings.md`):

- Show the schema as a fenced code block in the SKILL.md.
- Make explicit that placeholders/comments inside the schema (`<!-- ... -->`, `{PLACEHOLDER}`) are author-instructions and **must not appear in the final emitted file**.

## 7. Discovery and Cross-Skill References

Skills routinely call each other. Conventions:

- Cross-reference related skills under a `## Related skills` section at the bottom of the body.
- When recommending another skill in user-facing output, write its slash invocation: `/branch-review`, not just "branch-review".
- Do **not** hardcode lists of "all available skills". The set changes per repo / per user installation. Either:
  - delegate routing to the agent's dispatcher (preferred), or
  - read `skills/*/SKILL.md` at runtime to discover what is installed in *this* repo.

Avoid making a skill depend on inspecting opaque agent metadata (e.g. system-reminder contents) — those formats change.

## 8. External Tool Probes

If a skill optionally invokes external CLIs (linters, scanners):

- Probe with `command -v <tool>` to detect availability.
- For tools that need configuration (eslint, phpstan, semgrep, etc.) also check for the relevant config file (`.eslintrc*`, `phpstan.neon`, `.semgrep.yml`) before running. Running an unconfigured linter produces noise.
- Treat the probe list as **examples, not exhaustive**. Document that users can extend it.
- Cap parallel agent fan-out: if more than 5 tools/skills are discovered, ask the user before spawning all of them in parallel.

## 9. Commit and Push Behavior

For skills that commit on the user's behalf:

- Commit messages follow the repo's conventional style (`fix:`, `feat:`, `docs:`, `refactor:` etc.) and reference the originating finding/issue when applicable (`fix(auth): guard null token [F-014]`).
- One concern per commit. Group only when the same logical fix touches multiple sites.
- Refuse to commit on default branches (`main`, `master`, `develop`).
- Refuse to operate on a dirty working tree (`git status --porcelain` non-empty) — ask the user to commit or stash first.
- Push only to the current branch's upstream. Never force-push, never push to a different branch.

## 10. Prettier and Formatting

- Run `npm run prettier:fix` before committing skill changes. CI may enforce this.
- Markdown wrapping: 1 sentence per line is acceptable; long-line wrapping is also acceptable. Be consistent within a single SKILL.md.
- Keep tables narrow enough that they render in GitHub's UI without horizontal scroll on a 1280px viewport.

## 11. Don'ts

- ❌ Don't write code comments explaining what well-named identifiers already say.
- ❌ Don't add bullet points that just repeat each other.
- ❌ Don't introduce new top-level folders for a single file.
- ❌ Don't depend on `gh` for read operations the skill could also accomplish via `git` (slower iteration on offline machines).
- ❌ Don't add backwards-compatibility shims for renames in this repo — it's a curated set, breaking changes are fine if the README is updated.
- ❌ Don't ship a skill that overlaps an existing skill's scope without an explicit, documented differentiation.

## 12. README

When adding or renaming a skill:

- Update the `## Available Skills` table in `README.md`.
- Keep rows alphabetically sorted by skill name.
- The `Invoke` column should match the `argument-hint` from the frontmatter.
- Single-skill `npx skills add` install example should reference an actually existing skill.

---

## Appendix: Reference Skills

When in doubt about a pattern, mirror these:

| Pattern | Reference skill |
|---|---|
| Multi-agent review with output file | [`branch-review`](skills/branch-review/SKILL.md), [`full-project-review`](skills/full-project-review/SKILL.md) |
| Read-only structural review | [`architecture-review`](skills/architecture-review/SKILL.md) |
| Hybrid review + opt-in fix phase | [`branch-review`](skills/branch-review/SKILL.md) (with `--apply-fixes`) |
| File-emitting workflow skill | [`session-handoff`](skills/session-handoff/SKILL.md), [`tech-gazette`](skills/tech-gazette/SKILL.md) |
| External API integration | [`obsidian`](skills/obsidian/SKILL.md) |
| Lifecycle / setup skill | [`agent-context-init`](skills/agent-context-init/SKILL.md), [`agent-context-update`](skills/agent-context-update/SKILL.md) |
