# Branch-Review: `/simplify` Pass + Test/Lint Gate + Soft-Dependency Convention

**Date:** 2026-07-24
**Status:** Approved (design), pending spec review
**Scope:** `skills/branch-review/SKILL.md`, `STYLEGUIDE.md`
**Explicitly out of scope:** `full-project-review` (read-only by contract), `oss-readiness`

## Problem

`branch-review --apply-fixes` applies functional fixes (bug/security/design) but has no
dedicated reuse/simplification pass and only a weak post-fix verification
("if the fix needs a test/lint: run it"). We want to:

1. Run Claude Code's built-in `/simplify` (reuse, simplification, efficiency, altitude
   cleanups — quality only, no bug hunting) as a final quality pass over the changed code.
2. Add a deterministic Test/Lint gate around the fix phases with clear blame attribution.
3. Establish a reusable convention for depending on non-vendored built-in commands.

## Why here and not elsewhere

- `/simplify` **mutates code** → belongs only in a skill with an explicit, opt-in mutation
  phase. `branch-review --apply-fixes` is the only such skill. `full-project-review` is
  strictly read-only (no `--apply-fixes` phase) — adding a mutating pass would silently
  break its "I touch nothing" contract. `oss-readiness --apply-fixes` drafts community
  files, not code simplification.
- `/simplify` operates on "changed code" = exactly the branch diff → shares
  `branch-review`'s diff anchor, no scope drift.
- `/simplify` is a Claude Code **built-in**, not vendored in this repo. The repo ships via
  skills.sh to arbitrary harnesses → a hard dependency breaks where the built-in is absent
  → feature-detect + graceful skip required.

## Design

### A. `/simplify` in `branch-review --apply-fixes`

Restructure the Auto-Fix phase (`## Optional Phase: Auto-Fix (--apply-fixes)`):

```
1. Preconditions (clean tree, not on default branch, Findings.md exists)
   + detect test command and lint command from the tech-stack detection result
2. BASELINE GATE — run tests + lint once; record pass/fail as the baseline
3. Fix Classification              (unchanged)
4. Confident-Fix Workflow          (unchanged — verify, minimal patch, commit per fix)
5. Design-Decision Escalation      (unchanged — user picks, implement, commit)
   NOTE: push is moved to the end (step 8), not here
6. SIMPLIFY PASS (new):
     if /simplify is available AND --no-simplify is NOT set:
         invoke /simplify on the changed files
         commit "refactor(simplify): reuse/simplification pass [automated]"
     else:
         skip; record reason ("not available" | "disabled via --no-simplify")
7. FINAL GATE (see section B)
8. Push — only if final gate is green OR user explicitly approves pushing with
   known failures; never push to main/master/develop
9. Auto-Fix Summary — extended (see below)
```

**Trigger model:** automatic inside `--apply-fixes`; opt-out via `--no-simplify`.
`argument-hint` becomes `"[base-branch] [--apply-fixes] [--no-simplify]"`.
`--no-simplify` without `--apply-fixes` is a silent no-op.

**Feature-detect:** the orchestrator checks whether `/simplify` is available in the current
environment (its own skill/command list). If absent → skip silently, log one line in the
Auto-Fix Summary. No hard failure.

**Commit granularity:** the simplify pass is its own concern → its own commit(s), marked
`[automated]`, separate from functional-fix commits.

**OPEN ASSUMPTION (verify at implementation time):** it is unknown whether the `/simplify`
built-in commits its own changes or leaves them in the working tree. This determines:
- whether step 6's "commit the simplify pass" is a real commit or a no-op, and
- whether the auto-revert in section B is a working-tree reset or `git revert <sha>`.
The implementation must first establish `/simplify`'s actual commit behavior and branch the
commit/revert logic accordingly. Document the observed behavior in the SKILL.md.

### B. Test/Lint Gate

Replaces the weak "if the fix needs a test/lint: run it" line with two checkpoints and
deterministic blame attribution via the baseline:

```
baseline green + final red:
    if simplify ran:
        revert the simplify commit → re-run gate
            green now  → simplify was the culprit; logged; done
            still red  → functional fixes are the culprit → ESCALATE to user
    if simplify did not run:
        functional fixes are the culprit → ESCALATE to user
baseline already red:
    not our fault → report; revert nothing
no test/lint command detected:
    skip the gate → log "no gate available" (same soft-dependency logic)
```

**Core invariant:** `/simplify` must be behavior-preserving. Therefore a red gate caused by
the simplify pass triggers an **automatic revert** of the simplify commit. Functional fixes
(bug/security/design) are **never** auto-reverted — the failing test may itself need
updating — those escalate to the user instead. This asymmetry is intentional: simplify has a
hard behavior-preserving contract; functional fixes change behavior on purpose.

**Cost note:** the gate may run the test suite up to 3× (baseline, final, post-revert). This
lives only in the opt-in `--apply-fixes` path → acceptable. Detection of test/lint commands
reuses the existing tech-stack detection step (npm/yarn test, composer test, pytest, go
test, cargo test; eslint, phpstan, ruff, etc.).

**Push gate:** push (step 8) only when the final gate is green, or the user explicitly
approves pushing with known failures.

### C. Auto-Fix Summary extension

Append to the existing `## Auto-Fix Summary` section in `Findings.md`:

- Gate result: `baseline <green|red> → final <green|red>` + test/lint command used
  (or "no gate available").
- Simplify status: `applied (N edits)` | `skipped: not available` |
  `skipped: --no-simplify` | `reverted: broke tests`.

### D. Soft-Dependency Convention in STYLEGUIDE

New section `## Soft Dependencies on Non-Vendored Commands`:

- **Feature-detect before invoke.** A skill must not assume a non-vendored built-in
  (e.g. `/simplify`, `/code-review`) exists. Check availability first.
- **Graceful skip, never hard-fail.** Missing built-in → skip the step, continue the rest.
- **Report transparency.** Always log the skip and its reason where the skill reports
  (e.g. one line in Findings.md), so a skipped step is never mistaken for "done".
- **Reference example:** `/simplify` in `branch-review --apply-fixes`.

Length target: ~15 lines.

## Non-Goals

- No `--apply-fixes` / mutation phase added to `full-project-review`.
- No offloading of the Code-Quality Agent's simplification findings to `/simplify` (they
  coexist; `/simplify` is the deeper, autonomous pass in the fix phase, the agent still
  reports read-only findings).
- No new `allowed-tools` churn beyond what invoking `/simplify` requires.

## Acceptance Criteria

- [ ] `branch-review --apply-fixes` runs `/simplify` as the last mutating step when
      available and not disabled; skips gracefully with a logged reason otherwise.
- [ ] `--no-simplify` disables the pass; is a no-op without `--apply-fixes`.
- [ ] Two-checkpoint gate with baseline-based blame attribution is documented in SKILL.md.
- [ ] Simplify-caused red gate auto-reverts the simplify commit; functional-fix-caused red
      gate escalates and does not auto-revert.
- [ ] Push is gated on a green final gate or explicit user approval; never to default branch.
- [ ] Auto-Fix Summary reports gate result + simplify status.
- [ ] `argument-hint` updated to include `--no-simplify`.
- [ ] STYLEGUIDE has the soft-dependency section referencing `/simplify`.
- [ ] `/simplify` commit-vs-working-tree behavior verified and encoded in the revert logic.
- [ ] `full-project-review` unchanged.
