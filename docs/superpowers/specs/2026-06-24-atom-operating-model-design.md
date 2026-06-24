# ATOM — Agent-Team Operating Model — Design

> Date: 2026-06-24
> Status: Approved (design); pending implementation plan
> Home: `lx-wnk/skills` repo. This is Plane A (local/interactive operating model). Plane B (a native dashboard PM feature) is a separate spec.

## 1. Goal & Non-Goals

**Goal.** Make "a coordinating PM + a team of isolated, communicating worker agents, parallel work in git worktrees" the **default operating model** for non-trivial work in interactive Claude Code sessions. Provide a discoverable global skill (`atom-operating-model`) that encodes how the main thread (PM) decides worktree topology, fans out workers, governs inter-agent communication, and integrates results.

**Non-Goals.**
- Not the dashboard product feature (a native PM-agent + agent-to-agent channel) — that is Plane B, separate spec. ATOM only governs interactive sessions; the dashboard reuses ATOM's *synchronous subset* (see §7).
- Not a replacement for OFD. OFD remains the single-stream execution procedure; ATOM is the layer above that distributes streams.
- Not a new execution engine — ATOM orchestrates existing primitives (`Agent`, `SendMessage`, git worktrees, superpowers skills).

## 2. The Operating Model (default)

For any non-trivial task (the global rule "delegate when >1 tool call; main agent stays a lean coordinator" is the trigger):

- The **main thread is the PM** — it coordinates, never does the bulk work itself.
- Work is performed by **worker agents**, each isolated in its own git worktree.
- Workers **may communicate directly** with each other and with the PM.
- The PM owns all decisions: topology, scope, merge, conflict resolution, abort.

Trivial work (≤1 tool call) stays with the PM directly.

## 3. Topology Decision (PM chooses BEFORE dispatch)

| Situation | Topology |
|---|---|
| Multiple **independent** features/tasks (no file overlap, no dependency) | one worktree+branch each, parallel → **one PR each** |
| **One** feature split into **file-disjoint** subtasks | one worktree each, parallel → PM merges branches → **one PR** |
| One feature, shared files / tight coupling | **sequential, single worktree** (this is OFD) |
| Trivial (≤1 tool call) | PM solo |

Worktrees are always created manually off `main` — never via the `Agent` `isolation:'worktree'` flag (it forks from origin/main; see the worktree-baseref lesson).

## 4. Mesh Mechanics

1. The PM creates one worktree per parallel stream (off `main`, `pnpm i`/deps as needed).
2. The PM spawns one worker per stream as a **background** `Agent`, passing: the worktree path, the task, and the **peer roster** (other active workers + their agentIds, for comms).
3. Workers run concurrently; the PM receives completion notifications and integrates per the §3 rule as streams land.
4. **Depth limit (stall avoidance):** only the **main-thread PM** uses background dispatch + completion notifications. If a worker itself needs a sub-team, it dispatches its children **synchronously (foreground)**. No spawned agent ever waits on background children — that is the failure mode that stalls (a spawned agent is not reliably re-woken). This keeps the tree reliably broad but bounded in depth.

A single worker stream is itself an OFD run (implementer → reviewer → verifier in its worktree).

## 5. Communication Protocol (peer-direct, PM-supervised)

- **Peer→peer is allowed and encouraged** via `SendMessage`: info requests, handoffs, interface/contract alignment, mutual clarification.
- **The PM owns all decisions** (scope, merge, conflicts, abort). Workers report task outcomes to the PM.
- **Contracts first:** for file-disjoint decomposition the PM fixes shared contracts (types/API signatures) BEFORE workers start, so mid-run coordination is the exception, not the norm.
- **Anti-loop guards:** a peer-comms budget (max N round-trips, then escalate to PM); the PM can freeze comms; "progress before talk" — a worker may not only communicate without delivering.

## 6. Guardrails & Failure Handling

| Risk | Guard |
|---|---|
| Worker dies/stalls | PM detects via notification + verifies via `git`/CI; respawns or reassigns |
| Merge conflict | PM owns merge; non-disjoint streams fall back to sequential |
| Worker report lies / truncates | PM verifies via `git log` + CI, never via prose (generalized OFD rule) |
| PM context fills up | PM stays lean: delegates, does not do work; worker context is isolated |
| Endless comms | comms budget + PM freeze |

## 7. Execution Context (critical)

ATOM's full mesh requires a **reliably re-woken main loop**. That exists only in an **interactive Claude Code session**.

- **Interactive session (PM = main thread):** full mesh — background workers + completion notifications + peer comms.
- **Headless / spawned agent (e.g. a dashboard stage agent via the standard Claude spawner):** a spawned `claude` process is NOT reliably re-woken, so it MUST NOT run the background-mesh — it would stall like the OFD orchestrator did. It uses only the **synchronous subset**: spawn a sub-team in its own worktree, foreground, dispatch children synchronously.

Consequence for the dashboard (Plane B): the reliable loop there is the **pipeline/orchestrator engine**, so the PM role belongs to the engine (a native PM-agent task type), not to a spawned stage agent. The dashboard skill discovery still applies — a standard-spawner agent loads the global ATOM skill from its config dir (`~/.claude-personal` marketplace) and uses the synchronous subset.

## 8. Relationship to Existing Pieces

- **Global `CLAUDE.md`** ("delegate when >1 tool call", lean coordinator) = the **trigger**. ATOM = the **structure**.
- **OFD** = single-stream execution (one worker = one OFD run). ATOM references the OFD *pattern* generically and does not hard-depend on it; ATOM works in repos without OFD.
- **superpowers** `dispatching-parallel-agents`, `subagent-driven-development`, `using-git-worktrees` = the building blocks ATOM orchestrates.

## 9. Deliverable (in `lx-wnk/skills`)

Per the repo STYLEGUIDE (kebab-case folder, pushy description, `skills.json` manifest entry):

- `skills/atom-operating-model/SKILL.md` — frontmatter (name, pushy description with trigger phrases, `user-invocable`, `argument-hint`, `allowed-tools`) + the PM operating model (the default-mode contract, when it triggers, the PM checklist).
- `skills/atom-operating-model/runbook.md` — topology rules (§3), mesh mechanics (§4), depth limit, integration steps, the per-stream OFD link.
- `skills/atom-operating-model/comms-protocol.md` — peer rules, PM authority, contracts-first, anti-loop guards (§5).
- `skills.json` — new manifest entry for `atom-operating-model`.
- Spec + plan live in this repo on the same branch (`feat/atom-operating-model`).

No duplicate skill file in agent-dashboard — the global skill is auto-discovered. The dashboard's own realization is the separate Plane B feature.

## 10. Validation

A parallel 2-stream throwaway (like the OFD smoke test): two **independent** doc tasks, each in its own worktree, dispatched concurrently by the PM (main thread), with one forced peer `SendMessage` between the two workers, ending in two separate throwaway PRs. Proves: background fan-out + completion notifications + the independent-features topology rule + peer comms + PM integration. Torn down after.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Someone runs the background mesh headless → stall | §7 Execution-Context clause makes the boundary explicit; headless uses synchronous subset only |
| Parallel chaos / races | contracts-first + file-disjoint rule + PM-owned merge |
| Skill not discovered by dashboard agents | install ATOM in the config dir the spawner uses (`~/.claude-personal` marketplace) |
| Over-coordination (comms loops) | comms budget + "progress before talk" + PM freeze |
