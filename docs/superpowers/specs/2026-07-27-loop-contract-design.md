# loop-contract skill — design

**Status:** approved (2026-07-27) **Build via:** `/skill-builder` **Reference implementations:** [`branch-review`](../../../skills/branch-review/SKILL.md) (flags, git guards, report), [`atom-operating-model`](../../../skills/atom-operating-model/SKILL.md) (subagent orchestration)

## Purpose

Turn an ordinary prompt — or a whole concept/spec document — into an explicit, machine-checkable **loop contract**, then execute it autonomously until the contract is satisfied or a budget is exhausted.

The gap this fills: "loop engineering" tooling exists (Claude Code ships `/loop`, `/schedule`), but nothing writes the contract. A loop without a machine-checkable definition of done either runs forever or stops early. This skill makes the contract the artifact, and a deterministic controller — not the model — decides continue/stop.

## Scope

**In**

- Compiling a prompt or concept document into a loop contract (goal state, verify command, scope fences, stop conditions).
- Refusing to loop when no machine-checkable done-state exists.
- Running the loop: fresh worker subagent per iteration/item, deterministic controller, anti-gaming audit.
- A run report with iteration history, blocked items, and stop reason.

**Out**

- Time-based or recurring execution — that is the built-in `/loop <interval>` and `/schedule`.
- Multiple parallel work streams / worktree topology — that is [`atom-operating-model`](../../../skills/atom-operating-model/SKILL.md).
- Quality judgement of the resulting diff — that is [`branch-review`](../../../skills/branch-review/SKILL.md).
- Writing the plan itself — `superpowers:writing-plans` produces plans; this skill executes one.

### Delineation from existing plan executors

| Executor | Human in the loop | Streams | Termination |
| --- | --- | --- | --- |
| `superpowers:executing-plans` | review checkpoints per phase | one | human confirms |
| `superpowers:subagent-driven-development` | checkpoints per task | one, subagent-executed | human confirms |
| `atom-operating-model` | PM coordination | many, worktrees | per-stream |
| **`loop-contract` (Plan-Mode)** | **none after start** | **one** | **deterministic contract/budget** |

The distinguishing property is autonomy-to-completion with a deterministic stop, not another checkpointed executor.

## Invocation

```
/loop-contract <prompt | path-to-concept> [--max-iterations N] [--dry-run]
```

- `<prompt | path>` — free-text goal, or a path to a concept/spec/plan document.
- `--max-iterations N` — overrides the mode default (Goal-Mode global cap, Plan-Mode global cap).
- `--dry-run` — Gate + contract only, no execution. The escape hatch for inspecting a contract.

### Two entry paths, two confirmation behaviours

| Entry                                | Behaviour                                               |
| ------------------------------------ | ------------------------------------------------------- |
| Explicit (`/loop-contract …`)        | Gate → contract printed → **starts immediately**        |
| Auto-triggered (matched from prompt) | Gate → contract printed → **one confirmation** → starts |

Rationale: an explicit invocation is itself the consent. An auto-trigger is not — the user did not ask for a loop, so the printed contract plus a single confirmation replaces the review window.

## Auto-triggering

Dispatch is `description`-based; there is no always-on mechanism inside a skill. The description therefore matches **loop semantics**, not topics — matching on topics ("tests", "refactoring") would fire on most prompts.

Fires when a checkable target is recognizable **and** any of:

1. **Repetition wording** — "bis", "so lange bis", "wiederhole", "until", "keep going", "iterate".
2. **Exhaustive quantifier** — "alle", "jede", "überall", "im ganzen Repo", "every", "all".
3. **Plan execution signal** — "setz das Konzept um", "arbeite den Plan ab", "implement this spec/plan", a referenced `*-design.md` / `plan.md` / spec path, or a prompt containing a numbered or checkboxed item list.

Stays quiet for: single-instance fixes ("fix this one test"), read-only requests ("erklär mir den Plan"), and anything without a checkable target — the Gate would reject those anyway.

The description must also delineate against the built-in `/loop`: **one goal, no time control**. Otherwise dispatch alternates between the two.

**Optional deterministic reinforcement** (documented, not shipped — hooks live in `settings.json`, outside the skill folder): a `UserPromptSubmit` hook that injects a reminder when loop wording is present. Documented in the skill body as a snippet for users who want reliability over dispatch heuristics.

## Modes

The Gate selects the mode from the input.

|  | **Goal-Mode** | **Plan-Mode** |
| --- | --- | --- |
| Input | prompt with a single goal | concept/spec/plan document, or prompt with an item list |
| Progress signal | failure count, else verify-output hash | **items green / N** — monotone and exact |
| Worker unit | one fresh subagent per iteration | one fresh subagent per item (up to `per-item` retries) |
| Budget | `max-iterations: 8`, `no-progress-rounds: 2` | `per-item: 3`, `global: 40` |
| Audit | each time verify turns green | per completed item + one final audit over the whole diff |
| Stop | goal met / budget / stuck | all items green or blocked / global budget |

Plan-Mode is the stronger form of the pattern: a plan supplies its own progress metric, so the Gate has to infer far less.

## Phase 0 — Gate (may abort)

Three checks; all must pass.

1. **Done-state expressible** — can a shell command be written whose exit code decides the goal? (Plan-Mode: applied per item — see below.)
2. **Progress signal exists** — does something observable change between rounds (failure count, grep hits, items done)?
3. **Scope boundable** — can allowed paths be named?

On failure: **no contract, no loop**. Emit a verdict, the failed check(s), and a concrete narrowing suggestion ("mach die UI schöner" → "lighthouse a11y score ≥ 95").

**Plan-Mode, partially verifiable plans.** Real concepts mix verifiable items ("all controllers use DI") with unverifiable ones ("document the decision"). Check 1 is applied per item, not to the plan as a whole:

- Item has a verify command → normal item.
- Item has no command but a structural check exists (file exists, file contains a heading, symbol present) → the structural check becomes its verify.
- Neither → item is marked `MANUAL`, is **not executed**, and appears in the report as a human todo.

The plan enters Plan-Mode if at least one item is verifiable. A plan whose items are all `MANUAL` is rejected as a whole — there is nothing to loop on.

The Gate is the primary runaway defence, because execution starts without a review pause. It must stay strict; producing a weak proxy contract instead of rejecting was considered and deliberately rejected.

## Contract

Written to `outputs/loop-contracts/<slug>.md` (repo convention: generated artifacts go to `outputs/`). Printed in full before the first worker spawns, so it is in the transcript and interruptible.

**Goal-Mode:**

```yaml
mode: goal
goal: "no fetch( in src/, npm test green"
verify: "npm test && ! grep -rq 'fetch(' src/"
progress: "npm test --silent 2>&1 | grep -c 'failing'" # optional, numeric, lower is better
scope-allow: ["src/**", "tests/**"]
scope-deny: ["config/**", ".github/**", "package.json"]
stop: { max-iterations: 8, no-progress-rounds: 2 }
escalate: ["schema change", "dependency bump", "scope escape"]
```

**Plan-Mode** adds an item list; each item carries its own verify and scope:

```yaml
mode: plan
source: docs/superpowers/plans/2026-07-26-example.md
global-verify: "npm test && npm run lint"
stop: { per-item: 3, global: 40 }
items:
  - id: 1
    goal: "UserRepository resolved via DI"
    verify: "npm test -- user-repository"
    scope-allow: ["src/user/**", "tests/user/**"]
  - id: 2
    goal: "…"
```

When `progress` is absent, the controller falls back to hashing the verify output. That fallback is weaker than it looks and is **not** equivalent to metric-based detection: any verify output carrying timings, PIDs, or absolute paths hashes differently on every run, so the fallback detects "the output changed at all", not "the worker made progress" — and a circling run then burns its full budget without ever tripping `stuck`. Declare a `progress` command whenever a real number exists (failing-test count, lint-error count); reserve the fallback for verify commands with genuinely stable output.

## Controller

A state machine that makes **no LLM judgements** — only exit codes, numeric comparison, and counters.

```
Goal-Mode:
  i=0 · nprog=0 · last=""
  loop:
    i++ ; i > max-iterations              → STOP budget
    worker = spawn(contract, last)         ; fresh context, scope-allow only
    git status                             ; file outside scope → STOP scope-escape
    run verify → code, out
    code == 0                              → AUDIT
    metric = run(progress) || hash(out)
    metric better than BEST SO FAR → best=metric, nprog=0 else nprog++
      ; compared against the best, not the previous round — otherwise an
      ; oscillating worker (5,9,8,9,8,…) resets the counter every other
      ; round and never trips stuck
    nprog >= no-progress-rounds            → STOP stuck
    last = tail(out)

Plan-Mode:
  for item in items:                       ; sequential, one stream
    attempts=0
    while attempts < per-item:
      attempts++ ; global++ ; global > stop.global → STOP budget
      worker = spawn(item, contract, last_failure)
      git status                           ; outside item scope → mark item BLOCKED, break
      run item.verify → code, out
      code == 0 → AUDIT(item) → mark DONE, break
      last_failure = tail(out)
    if not DONE: mark BLOCKED, continue    ; never abort the run
  run global-verify → FINAL AUDIT
```

**A blocked item never terminates the run.** One unreachable item must not kill nineteen reachable ones; it is recorded as `BLOCKED` with its last failure and reported at the end. This is the difference between "runs to completion" and "dies in the middle".

Workers are spawned fresh so that failed attempts do not accumulate in context across a long run. The controller passes forward only the contract and the last failure output.

## Anti-gaming audit

Fires once per green signal (Goal-Mode: at the end; Plan-Mode: per completed item, plus once over the whole diff). A fresh subagent sees only the contract and the loop's `git diff`, and answers one question: **satisfied or circumvented?**

Targets: `.skip` / `.only`, deleted test cases, weakened assertions, exclusions added to lint/test config, mocked-away logic, scope escapes.

- `CLEAN` → STOP goal met / item DONE
- `GAMED` → the finding becomes the next failure input, counts as an iteration, and the specific trick is appended to `scope-deny`
- `GAMED` twice → STOP and escalate; do not fight the worker indefinitely

Appending to `scope-deny` is load-bearing: the next worker starts fresh and would otherwise retry the same trick, having no memory of round 3.

Structural separation of the auditor from the worker is deliberate — the model that produced a diff evaluates it favourably ("self-serving evaluation bias"), so the auditor gets its own context and sees the diff, not the reasoning that produced it.

## Safety guards

Execution starts without a pause, so the guards are non-negotiable:

- Full contract printed **before** the first worker spawns.
- Refuse to run on the default branch (`main`/`master`/`develop`).
- **Never commit, never push, never auto-revert.** Out-of-scope changes stop the run and are reported, not silently undone.
- `--dry-run` produces the contract only.
- Auto-triggered entry additionally requires one confirmation (see Invocation).

## Output

The contract file receives an appended run log: iterations used, verify history, audit verdicts, files touched, stop reason, and — in Plan-Mode — the DONE/BLOCKED table per item.

Final response summarizes: stop reason, items done vs blocked, budget consumed, audit verdict, and what needs a human.

## Frontmatter (draft)

```yaml
name: loop-contract
description: >-
  Compiles a prompt or a concept/spec/plan document into an explicit loop contract — machine-checkable goal, verify command, scope fences, stop conditions — and then runs it autonomously until the contract is satisfied or the budget is spent. Use for "setz das Konzept um", "arbeite den Plan ab", "implement this spec", "fix X bis grün", "until tests pass", "entferne alle Y", "migrate every Z" — and whenever a design or plan document is handed over for execution. NOT for time-based or recurring runs (use /loop <interval> or /schedule), NOT for parallel work streams (use atom-operating-model), NOT for diff review (use branch-review).


user-invocable: true
argument-hint: "<prompt | path-to-concept> [--max-iterations N] [--dry-run]"
allowed-tools: "Bash Read Write Edit Glob Grep Agent"
```

`Bash` stays broad rather than granular: the verify command is project-defined, so any narrowing would be fiction (STYLEGUIDE §2 permits family-level wildcards; here the family is the whole tool).

## Structure (progressive disclosure)

```
skills/loop-contract/
  SKILL.md                       # gate, modes, contract schema, controller, guards
  references/
    contract-schema.md           # full YAML schema, both modes, worked examples
    anti-gaming.md               # auditor prompt + circumvention catalogue
    auto-trigger-hook.md         # optional UserPromptSubmit snippet
```

## Validation

No test harness exists for skills in this repo. Manual fixtures instead:

1. **Loopable goal** — "entferne alle fetch() calls" in a repo with tests → contract, green, CLEAN.
2. **Non-loopable** — "mach die UI schöner" → Gate rejects, no contract written.
3. **Gaming** — a repo where the fastest path to green is `it.skip` → auditor must return GAMED and the rule must land in `scope-deny`.
4. **Plan-Mode with a blocked item** — one item unachievable → run completes, item reported BLOCKED, remaining items DONE.
5. **Auto-trigger precision** — the FIRES/QUIET prompt set above; no fires on the QUIET set.
