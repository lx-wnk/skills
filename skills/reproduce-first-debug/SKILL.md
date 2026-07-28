---
name: reproduce-first-debug
license: MIT
description: >-
  Debug a defect under a hard reproduce-first gate — no hypothesis, code reading, or fix before a reproduction artifact fails. The reproduction is promoted to a permanent regression test, committed RED before the fix, then logged to a bug ledger. Uses local fixtures, never real ticket or production data. Use this skill when a defect lacks a confirmed root cause, or the user says "debug this", "fix this bug", "why is X broken", "this is failing", "the test is red", "investigate this error", "find the root cause", "debugge das", "warum geht das nicht", "das funktioniert nicht", "finde den Fehler", "such den Bug", "der Test ist rot", "Fehler analysieren". Also trigger when a stack trace, failing test output, or error log is pasted without a question. DO NOT trigger for a known cause where only the fix is wanted, for adding tests to working code, or for reviewing a diff — use `branch-review` for that. NOT for general debugging without the RED-repro-and-ledger gate — see `superpowers:systematic-debugging`.


user-invocable: true
argument-hint: "[bug description, ticket key, or pasted error]"
allowed-tools: "Bash(git *) Bash(npm *) Bash(pnpm *) Bash(make *) Bash(curl *) Bash(docker *) Bash(php *) Bash(python3 *) Read Write Edit Grep Glob"
---

# Reproduce-First Debugging

Force a failing reproduction before any hypothesis, then keep that reproduction forever as a regression test.

## Scope

Covers defect investigation from report to logged root cause: gathering trigger data, building a reproduction artifact, bisecting the broken layer boundary, and promoting the reproduction to a permanent test.

Does **not** cover: implementing features, reviewing diffs, performance profiling without a functional defect, or fixing a defect whose root cause is already confirmed and evidenced — in that case go straight to the fix.

## Examples

```bash
/reproduce-first-debug Promotion code is ignored on the cart page for bundled products
```

```bash
/reproduce-first-debug ABC-1234
```

```bash
# Also triggers on a bare paste, with no question attached:
/reproduce-first-debug TypeError: Cannot read properties of undefined (reading 'total') at CartSummary.vue:42
```

## Workflow

```mermaid
flowchart TD
    A[1. Collect trigger data] -->|complete| B[2. Build reproduction artifact]
    A -->|input missing| A1[Ask for the specific input. STOP.]
    B -->|artifact fails reproducibly| C[3. Bisect the layer boundary]
    B -->|cannot reproduce, input missing| A1
    B -->|cannot reproduce, inputs present, attempts < 3| B
    B -->|cannot reproduce after 3 attempts, inputs present| B1[Not reproducible locally. Record attempted vectors, hand back: instrumentation or prod trace. STOP.]
    C --> D[4. Promote to regression test, commit RED]
    D --> E[5. Minimal fix, show red to green]
    E --> F[6. Log to bug ledger]
```

Strict order. No step may be skipped, reordered, or run speculatively in parallel.

### Preconditions

Checked once, before step 1 — the reproduction artifact built in step 2 makes the tree dirty by design, so these cannot be deferred to the commit in step 4:

- Working tree must be clean (`git status --porcelain` empty). Otherwise abort with the note "Please commit or stash first."
- The current branch is not `main`/`master`/`develop` (no commit on the default branch).

### 1. No hypothesis without data

Collect before considering any cause:

- The symptom, stated as observed behaviour, not as a suspected cause.
- The exact trigger inputs: URL, product ID, promo code, order number, command, payload.
- Observed vs. expected, both concrete.

Anything missing: ask for it specifically and stop. Do not guess, and do not start reading code to compensate for a missing input — naming the wrong root cause early costs more than one clarifying question.

### 2. Build the reproduction artifact

The cheapest form that genuinely hits the defect:

- Unit or jsdom test
- `curl` sequence (against local/dev hosts only — never a production endpoint)
- SQL against local fixtures
- Dev-only mock
- DOM-faithful HTML mockup

Use local fixtures. Never real ticket or production data.

**Gate: continue only once the artifact reproducibly FAILS and the failing output is pasted.** A reproduction that cannot be made to fail on demand is not a reproduction.

If the defect cannot be reproduced and an input is missing: stop and state precisely which input is needed. Do not propose fixes.

If all requested inputs are present and the defect still won't reproduce after **3 attempts**: stop retrying. Declare "not reproducible locally", list every vector attempted (exact commands, fixtures, branch, environment), and hand back to the user with concrete options — add instrumentation/logging at the suspected boundary, or request a production trace for the specific window. This is a valid terminal state, not a failure to resolve before continuing; do not loop on asking for more input once inputs are confirmed present.

### 3. Bisect the layer boundary

For each layer boundary, prove which side is broken:

> "Client sends the correct PUT; the backend handler is a no-op."

Declare nothing healthy without evidence. `VERIFIED` requires pasted output; anything else is `HYPOTHESIS` and must name the cheapest command that would settle it.

### 4. Reproduction becomes a regression test

**Commit rules** (the entry Preconditions above already established a clean tree and a non-default branch):

- Stage only the reproduction test. Unrelated files that appeared meanwhile are not swept in.
- Commit message follows the repo's conventional style (e.g. `test(auth): add RED repro for ABC-1234`).
- Never push. The user pushes when ready.

Promote the artifact to a permanent test in the suite:

- Named after the ticket
- Committed **separately** and **RED**, before the fix

A reproduction deleted after the fix guarantees the defect can return unnoticed.

### 5. Fix and verify

- Minimal fix — scope stays on the located cause, no neighbouring cleanup.
- New test plus all gates green; show the red-to-green transition with real output.
- Where a target system exists (dev shop, preview URL, live product page), verify the visible behaviour there too, not only in the test suite.

### 6. Log it

Append one row to `docs/bug-ledger.md`, creating the file with this header if absent — write only the header shown, no rows:

```markdown
# Bug Ledger

| Date | Symptom | Root cause | Layer | Guarding test |
| ---- | ------- | ---------- | ----- | ------------- |
```

Example row, illustrating the schema only — this is a sample and **must not** be written into the created file:

```markdown
| 2026-07-28 | Promo ignored on bundles | Bundle line items skip the discount collector | Backend service | `PromoBundleTest::testBundleGetsDiscount` |
```

## Principles

- A reproduction is the entry ticket to debugging, not an optional first step.
- Evidence or silence: every claim is `VERIFIED` with pasted output, or explicitly labelled `HYPOTHESIS`.
- Never call a mitigation (masking, gate, retry, cooldown) a fix — state what it prevents and what it does not.
- Local fixtures over real data, always.

## Related skills

- `branch-review` — reviewing a diff for defects, rather than investigating a reported one.
- `session-handoff` — capturing the investigation state when a defect outlives the session.
