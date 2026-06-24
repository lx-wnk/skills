# ATOM Runbook — PM Operational Checklist

Operational checklist for the main-thread PM. Covers topology decision, worktree setup, worker dispatch, integration, and failure handling.

---

## 0. Pre-flight

- [ ] Confirm this is a **non-trivial task** (>1 tool call). Trivial tasks stay with the PM directly.
- [ ] Confirm you are running in an **interactive Claude Code session** (not a headless/spawned agent). Background mesh requires a reliably re-woken main loop; spawned agents must use the synchronous subset only.
- [ ] Read the task scope and identify all files that will be touched.

---

## 1. Topology Decision

Choose the topology before any worktree is created.

| Situation | Topology |
| --- | --- |
| Multiple independent features/tasks — no file overlap, no dependency | One worktree + branch each, parallel → one PR per stream |
| One feature split into file-disjoint subtasks | One worktree per subtask, parallel → PM merges branches → one PR |
| One feature with shared files / tight coupling | Sequential, single worktree (OFD) |
| Trivial (≤1 tool call) | PM solo, no worktree |

**Integration follows the topology rule:** independent streams each get their own PR; a disjoint-split ends with the PM merging branches into one PR; shared-file streams run sequentially in a single worktree.

---

## 2. Contracts First (disjoint-split only)

Before creating worktrees for a file-disjoint split:

- [ ] Define and commit all shared interfaces, types, and API signatures to `main`.
- [ ] Confirm each stream's file boundary is truly disjoint (no file appears in two streams).
- [ ] Document the contract in a short note or inline comment that workers can reference.

---

## 3. Worktree Setup

**Invariant:** Worktrees are created manually off `main`, never via the `Agent` `isolation:'worktree'` flag. The `isolation:'worktree'` flag forks from `origin/main` and is not under the PM's control; manual creation ensures the correct base ref and dependency state.

For each parallel stream:

- [ ] `git worktree add <path> -b <branch-name>` from the repo root (base = `main`).
- [ ] Install dependencies in the worktree if needed (e.g. `pnpm i`).
- [ ] Confirm the worktree path is accessible and the branch is clean.

---

## 4. Worker Dispatch

**Invariant:** The PM spawns one background worker per parallel stream, passing the worktree path + the peer roster (other workers' agentIds). This gives workers the information they need for direct peer communication without routing through the PM.

For each stream:

- [ ] Prepare the worker prompt: include the worktree path, the stream's task scope, and the full peer roster (agentIds of all sibling workers).
- [ ] Spawn the worker with `Agent(run_in_background: true)`.
- [ ] Note the returned `agentId` and add it to the peer roster for subsequent spawns.

**Depth limit:** Only the main-thread PM background-dispatches workers and waits on completion notifications. A worker that needs a sub-team dispatches its children synchronously (foreground). No spawned agent waits on background children — that is the stall pattern.

---

## 5. Per-Stream Execution

Each worker stream is an OFD run (implementer → reviewer → verifier in its worktree). The worker owns the full OFD cycle internally; the PM does not intervene in intra-stream execution.

Workers may communicate peer-to-peer via `SendMessage` for:

- Interface/contract clarification
- Handoffs and coordination
- Mutual unblocking

Workers escalate to the PM for: scope changes, merge conflicts, abort decisions.

---

## 6. Integration

When a worker completes, the PM receives a completion notification. Before integrating:

- [ ] **Verify via `git log`**: confirm the expected commits landed in the worker's branch. Do not trust the worker's prose summary alone.
- [ ] **Run CI / local checks** (lint, typecheck, tests) against the branch.

Then integrate per the topology rule:

- **Independent streams:** open one PR per stream. No cross-stream merge by the PM.
- **Disjoint-split streams:** PM merges all worker branches into a single integration branch, resolves any conflicts, then opens one PR.
- **Sequential (OFD):** the single worker delivers; the PM reviews and opens the PR.

**Failure handling: PM verifies worker outcomes via `git log`/CI, respawns dead workers, owns merges; non-disjoint streams fall back to sequential.** If a merge conflict reveals that streams were not truly disjoint, abort the parallel approach and re-run as sequential.

---

## 7. Post-Integration

- [ ] Remove all worktrees that are no longer needed: `git worktree remove <path>`.
- [ ] Delete feature branches after PR merge (if repo policy allows).
- [ ] Update any relevant docs or memory files with decisions made during this run.

---

## Quick-Reference: Invariants

1. Worktrees are created manually off `main`, never via the `Agent` `isolation:'worktree'` flag.
2. The PM spawns one background worker per parallel stream, passing the worktree path + the peer roster (other workers' agentIds).
3. Depth limit: only the main-thread PM background-dispatches; a worker that needs a sub-team dispatches its children synchronously (foreground). No spawned agent waits on background children.
4. Each worker stream is an OFD run (implementer → reviewer → verifier in its worktree).
5. Integration follows the topology rule (independent → PR each; disjoint-split → PM merges branches → one PR; shared files → sequential).
6. Failure handling: PM verifies worker outcomes via `git log`/CI, respawns dead workers, owns merges; non-disjoint streams fall back to sequential.
