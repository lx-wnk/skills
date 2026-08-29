# Contract Schema

Read this when writing the contract file in Phase 1.

- [File location](#file-location)
- [Goal-Mode schema](#goal-mode-schema)
- [Plan-Mode schema](#plan-mode-schema)
- [Field rules](#field-rules)
- [Worked example: Goal-Mode](#worked-example-goal-mode)
- [Worked example: Plan-Mode](#worked-example-plan-mode)
- [Run log](#run-log)

## File location

`outputs/loop-contracts/<slug>.md`, with the controller state beside it at `outputs/loop-contracts/<slug>.state`.

The slug is derived from the goal or the source document's basename: lowercase, kebab-case, no date prefix (the run log carries the timestamp). `remove-fetch-calls`, `di-migration`. If the file exists, append a new dated run-log section rather than overwriting — the previous contract stays readable.

## Goal-Mode schema

```markdown
---
mode: goal
goal: "<one sentence describing the target STATE, not the effort>"
verify: "<shell command; exit 0 means the goal is reached>"
progress: "<shell command printing a single number, lower is better>" # optional
scope-allow: ["<glob>", "<glob>"]
scope-deny: ["<glob>", "<glob>"]
stop: { max-iterations: 8, no-progress-rounds: 2 }
escalate: ["<condition>", "<condition>"]
---

## Intent

<the user's original request, verbatim>

## Notes

<why this verify command, what it does not cover>
```

## Plan-Mode schema

```markdown
---
mode: plan
source: "<path to the concept/plan document>"
global-verify: "<shell command run once after all items are resolved>"
stop: { per-item: 3, global: 40 }
scope-deny: ["<glob>"] # applies to every item
items:
  - id: 1
    goal: "<target state for this item>"
    verify: "<shell command>"
    scope-allow: ["<glob>"]
  - id: 2
    goal: "<…>"
    state: manual # no verify possible; never executed
---

## Intent

<the plan's objective in one paragraph>

## Manual items

<every item marked manual, with why it cannot be verified>
```

## Field rules

| Field | Rule |
| --- | --- |
| `goal` | A state, never an activity. "no `fetch(` remains in `src/`" not "remove fetch calls". |
| `verify` | Must run in this project. Execute it once before the loop starts; a command that errors on invocation is a broken contract, not a red goal. |
| `progress` | Numeric, monotone, lower is better. Declare one whenever a real number exists (failing-test count, lint-error count) — it is what makes `stuck` detection work. Omit only if no honest number exists, and expect weaker detection: the output-hash fallback flags "output changed at all", not progress. |
| `scope-allow` | Path globs the worker may edit. Keep it as narrow as the task allows; it is the blast radius. |
| `scope-deny` | Explicit exclusions inside allowed paths, plus anything the auditor adds after detecting gaming. Grows during a run. |
| `stop` | Budgets, not goals. Defaults: Goal-Mode `8` / `2`, Plan-Mode `3` per item / `40` global. |
| `escalate` | Advisory only — read by the human reviewing the contract, never by the controller. Conditions that should reach a person rather than be solved: schema changes, dependency bumps, credential or infra edits. No subcommand consumes this field and no stop reason corresponds to it; a run does not halt on its own when one of these conditions occurs. Treat it as documentation of intent, not as an enforced gate. |
| `items[].state` | Only ever `manual` at write time. `done` / `blocked` are runtime states owned by the controller, not the contract file. |

Lock files, CI configuration, and dependency manifests belong in `scope-deny` unless the goal is explicitly about them.

## Worked example: Goal-Mode

```markdown
---
mode: goal
goal: "no direct fetch( calls remain in src/; all HTTP goes through apiClient; test suite green"
verify: "npm test --silent && ! grep -rq 'fetch(' src/"
progress: "grep -rc 'fetch(' src/ | awk -F: '{s+=$2} END {print s}'"
scope-allow: ["src/**", "tests/**"]
scope-deny: ["src/vendor/**", "package.json", "package-lock.json", ".github/**"]
stop: { max-iterations: 8, no-progress-rounds: 2 }
escalate: ["new dependency needed", "apiClient lacks a required method"]
---

## Intent

entferne alle fetch() calls aus src/, tests müssen grün bleiben

## Notes

`progress` counts remaining call sites, so a partial migration still registers as progress even while the suite is red. The verify command deliberately checks both conditions: a green suite with remaining `fetch(` calls is not the goal.
```

## Worked example: Plan-Mode

```markdown
---
mode: plan
source: "docs/superpowers/plans/2026-07-26-di-migration.md"
global-verify: "npm test --silent && npm run lint --silent"
stop: { per-item: 3, global: 40 }
scope-deny: ["package.json", "package-lock.json", ".github/**"]
items:
  - id: 1
    goal: "UserRepository is resolved through the container, no direct instantiation"
    verify: "npm test --silent -- user-repository && ! grep -rq 'new UserRepository' src/"
    scope-allow: ["src/user/**", "tests/user/**"]
  - id: 2
    goal: "OrderService receives its dependencies via constructor"
    verify: "npm test --silent -- order-service"
    scope-allow: ["src/order/**", "tests/order/**"]
  - id: 3
    goal: "ADR documenting the container choice exists"
    verify: "test -f docs/architecture/adr-012-di-container.md"
    scope-allow: ["docs/architecture/**"]
  - id: 4
    goal: "team is briefed on the new pattern"
    state: manual
---

## Intent

Migrate the user and order modules to constructor injection, as specified in the source plan.

## Manual items

- Item 4 — a briefing is not observable from the repository. Reported as a human todo.
```

Item 3 shows the structural-check rule from Phase 0: no test covers "an ADR exists", but `test -f` does.

## Run log

Appended to the contract file when the run stops. Placeholders below are author instructions and must not appear in the emitted file.

```markdown
## Run <YYYY-MM-DD HH:MM>

**Stop reason:** <goal-met | all-items-resolved | budget | stuck | audit-blocked | scope-escape> **Budget:** <used>/<max>

| Item | State   | Attempts | Audit |
| ---- | ------- | -------- | ----- |
| 1    | done    | 1        | clean |
| 2    | blocked | 3        | —     |
| 4    | manual  | 0        | —     |

**Files touched:** <list>

**Needs a human:**

- <blocked item + its last failure>
- <manual item + why>
```

In Goal-Mode the item table is replaced by a single line: iterations used, no-progress rounds, gaming verdicts.
