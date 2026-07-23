# oss-readiness skill — design

**Status:** approved (2026-07-23) **Build via:** `/skill-builder` (not writing-plans) **Reference implementation:** [`branch-review`](../../../skills/branch-review/SKILL.md)

## Purpose

A skill that audits any repository for public-release ("OSS") readiness and, on opt-in, applies safe fixes. It generalizes work done by hand in this repo: turning the README into a front door (Why/How/Benefits) and deduplicating the docs to a single source of truth.

## Scope

**In**

- README front-door quality (Why/How/Benefits, section order, badges, quick example).
- Docs single-source / deduplication across all Markdown docs.
- OSS community-health files (LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue/PR templates).
- Repo discoverability signals (description, topics, CI + badge, releases, `.gitignore`, secret hygiene).

**Out**

- Marketing, social, or website copy.
- Code quality / security of the source itself — delegate to `branch-review` / `full-project-review`.
- Release execution (tagging, publishing) — stays manual / `gh`.

## Invocation

```
/oss-readiness [path] [--apply-fixes]
```

- `path` — repo root to audit (default: cwd).
- `--apply-fixes` — opt-in write mode. Default is read-only.
- Stack-agnostic and user-invocable.

## Execution: multi-agent fan-out

Parallel subagents, one per dimension, consolidated into a single report. Each dimension **probes existing state before judging** — detect stack (`package.json`, `composer.json`, `pyproject.toml`, `go.mod`), CI provider, and which files already exist. Never assume a file is missing; never clobber an existing one.

| # | Dimension agent | Checks |
| --- | --- | --- |
| 1 | README front-door | Why/How/Benefits present; inverted-pyramid order; badges valid + CI badge; quick-example block; scannable feature list; awesome-readme patterns; no dead links |
| 2 | Docs consistency | Duplication across README/CONTRIBUTING/STYLEGUIDE/CLAUDE.md and peers — each fact one home, others link; stale/contradictory rules |
| 3 | Community-health files | LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue + PR templates present and non-placeholder |
| 4 | Repo signals | description + topics set; CI present; releases/tags; `.gitignore` sanity; no committed secrets |

## Output

`outputs/OSS-Readiness.md`, prioritized P0–P3. Per finding:

- dimension
- severity (P0–P3)
- what (the gap)
- why (why it matters for public release)
- fix (concrete)
- `auto-fixable: yes | no | manual`

Placeholders/comments in the schema are author-instructions and must not appear in the emitted file (per STYLEGUIDE §6).

## Apply model (mirrors branch-review)

- **Default:** read-only. Writes only the report.
- **`--apply-fixes`:**
  - Scaffolds missing community-health files from `assets/` templates.
  - Adds a CI badge, reorders README sections, deduplicates docs (move content to one home + link).
  - **Escalates** subjective calls — tagline wording, license choice, prose voice — as TODOs in the report. Never guesses these.
- **Git guards:** refuse on the default branch (`main`/`master`/`develop`) and on a dirty working tree. **Never commit, never push.**
- **GitHub metadata** (description, topics): only when `gh` is available (`command -v gh`); **confirm each change** because it is outward-facing and public. If `gh` is absent, report as a manual todo.

## Structure (progressive disclosure)

- `SKILL.md` — the process: phases, checklists, exit criteria, anti-rationalization table.
- `assets/` — file templates (SECURITY, CODE_OF_CONDUCT, issue/PR templates).
- `references/` — README-pattern checklist (awesome-readme distilled) and a community-health matrix.

## Exit criteria

- Every dimension agent has run and reported.
- `outputs/OSS-Readiness.md` exists with all findings prioritized.
- In `--apply-fixes`: every `auto-fixable: yes` finding is applied or explicitly skipped with a reason; every `manual` finding remains a TODO in the report; git guards held; nothing committed or pushed.

## Related skills

`branch-review`, `full-project-review`, `session-handoff`.
