# Parity harness

`scripts/parity.mjs` is a diagnostic, not a unit test. It compares our reimplementation of session-metadata extraction (`lib/transcript.mjs` `extractMeta`) against Claude Code's built-in `/insights` cache (`~/.claude/usage-data/session-meta/*.json`), on whatever real sessions happen to be present on the machine it runs on. It is skipped entirely (exit 0) when no built-in cache exists, and reports `INCONCLUSIVE` (exit 0) when fewer than `MIN_POPULATION` (20) sessions are comparable.

## What it compares

For every cached session-meta file, the harness locates the matching transcript under `~/.claude/projects/*/`, re-runs `extractMeta` over it, and diffs three metrics against the cached values by strict JSON equality:

- `user_message_count`
- `assistant_message_count`
- `tool_counts` (the whole per-tool-name object, not just a total)

These three were picked because they're the metrics most exposed to line-classification disagreements (what counts as a user message vs a tool-result echo, what counts as a distinct assistant turn, which lines carry `tool_use` blocks) — the parts of `extractMeta` most likely to drift from the built-in's undocumented behavior.

## Why stale-cache sessions are excluded

`session-meta/*.json` is a point-in-time snapshot written when `/insights` last ran. If the transcript file has been modified since (an mtime newer than the cached `transcript_mtime`), the session has been resumed or otherwise appended to, and the cache no longer describes the file on disk. A comparison against it would be comparing our count of the _current_ file against the built-in's count of an _earlier_ version of the same file — a guaranteed, meaningless mismatch. The harness filters these out with:

```js
if (Math.round(info.mtimeMs) > (cached.transcript_mtime ?? 0)) continue;
```

Sessions whose transcript has been deleted by retention (no matching `.jsonl` under any project directory) are excluded the same way, by simply finding no candidate file.

## Measured rates

| Date | Population (n) | `user_message_count` | `assistant_message_count` | `tool_counts` | `message_hours` |
| --- | --- | --- | --- | --- | --- |
| 2026-07-27 (prototype, Python) | 70 | 0.87 | 1.00 | 1.00 | — |
| 2026-07-28 (this task, real `extractMeta`) | 34 | 0.91 (31/34) | 0.91 (31/34) | 0.94 (32/34) | 0.91 |

The population dropped from 70 to 34 between the two measurements — retention deleting transcripts and sessions going stale against their cached snapshot both shrink the comparable set over time. This is expected and is exactly why the baseline is a **rate**, not an absolute count: an absolute floor of 70 would fail the moment the population dropped for reasons unrelated to `extractMeta`'s correctness.

`BASELINE` in `parity.mjs` is set from the 2026-07-28 run: `{ user_message_count: 0.91, assistant_message_count: 0.91, tool_counts: 0.94 }`. This is a real, currently-measured number, not a target backed into passing — see "Residual" below for what it costs.

Separately, a full ingest of one real 6.3 MB session (`1b96d548`, run outside this harness as part of the overall calibration effort) produced metadata **identical** to the built-in's cache on `user_message_count`, `assistant_message_count`, `git_commits`, `input_tokens`, `output_tokens`, and `tool_counts`. The pipeline is capable of exact parity; the residual here is session-specific, not systemic.

## Hypotheses tested

### 1. Transcript branching (leaf-to-root chain walk) — CONFIRMED as root cause

All four sessions that mismatched on 2026-07-28 (`a34e6d3b`, `e312b49e`, `a272ed75`, `cee02856`) have the same structural property: their transcript is not a single linear conversation. Alongside the usual `user` / `assistant` lines, these files contain repeated top-level `last-prompt` entries — one per resume/steer/queue event — each carrying a `leafUuid` that points at the `uuid` of the message that was the tip of the conversation at that moment. Every line also carries `uuid` and `parentUuid`, forming a tree, not a list: old branches (abandoned edits, superseded queued prompts, pre-compaction history) remain in the file as extra, unreachable-from-the-current-tip sibling chains.

`extractMeta` — by design, per the brief, and correctly per its contract — processes every line in the file. The built-in evidently does not: it appears to walk only the chain from the _final_ leaf (the `leafUuid` of the chronologically last `last-prompt` entry) back to the root via `parentUuid`, counting only lines on that ancestry path.

Verification: for each of the four mismatching sessions, a chain was built by taking the last `last-prompt` line's `leafUuid`, following `parentUuid` back to the root, reversing to chronological order, and feeding _that_ subset (instead of the full line array) into the unmodified `extractMeta`. Result — exact match against the cached values in every case:

| Session    | Metric                      | Full-file (mismatch) | Leaf-chain walk | Cached |
| ---------- | --------------------------- | -------------------- | --------------- | ------ |
| `a34e6d3b` | `user_message_count`        | 16                   | **15**          | 15     |
| `a34e6d3b` | `assistant_message_count`   | 741                  | **643**         | 643    |
| `a34e6d3b` | `tool_counts.Bash`          | 73                   | **70**          | 70     |
| `a34e6d3b` | `tool_counts.Read`          | 31                   | **30**          | 30     |
| `a34e6d3b` | `tool_counts.browser_batch` | 118                  | **90**          | 90     |
| `e312b49e` | `assistant_message_count`   | 462                  | **459**         | 459    |
| `e312b49e` | `tool_counts.Bash`          | 31                   | **30**          | 30     |
| `a272ed75` | `user_message_count`        | 19                   | **18**          | 18     |
| `a272ed75` | `assistant_message_count`   | 127                  | **125**         | 125    |
| `cee02856` | `user_message_count`        | 40                   | **38**          | 38     |

Every single one of the ten first-mismatches printed by the harness on 2026-07-28 is explained — and resolved — by this one mechanism. No second or third hypothesis was needed; the brief's timebox ("if that fails, form two more") does not apply because the first hypothesis succeeded outright.

**This was not implemented in `extractMeta` or `parity.mjs`.** Per this task's constraints, `lib/transcript.mjs` must not be modified to chase parity, and `parity.mjs` is transcribed from the brief as given — it feeds `extractMeta` the full line array, matching what the skill's ingest path actually does today (`ingest.mjs` has no chain-walking logic either, so changing only the harness would make the harness lie about production behavior). The finding is recorded here as a scoped, well-understood future improvement, not applied silently.

### 2 and 3 — not attempted

The task brief specifies testing the branching hypothesis first and forming two more only if it fails. It did not fail — it fully accounted for every observed mismatch in the 2026-07-28 population — so hypotheses 2 and 3 were not run. (The brief separately lists three _other_ candidate hypotheses for the older, now-superseded `user_message_count` tail — excluding `<local-command-`/`[Image: source:` lines, filtering on `userType`, and deduping same-second identical text — but since branching alone closes the entire current residual, those were not needed either.)

## Residual

As shipped, `BASELINE = { user_message_count: 0.91, assistant_message_count: 0.91, tool_counts: 0.94 }`, measured against n=34 real sessions on 2026-07-28. Every mismatch in that run traces to transcript branching (sessions with resume/compaction history), and is exactly reproducible — not a mystery, not noise — by walking the leaf-to-root chain instead of the full file. Closing it for real means either:

- teaching `extractMeta` to walk from the last `last-prompt`'s `leafUuid` when such lines are present, falling back to full-file scanning for linear transcripts, or
- confirming with the built-in's actual source/behavior that this is precisely its algorithm (this task inferred it empirically; it was not cross-checked against Claude Code's own implementation).

Either is out of scope here: the task brief is explicit that `extractMeta` must not be edited to chase this number without separate instruction. The 0.91 / 0.91 / 0.94 baseline is therefore a true floor, not a target dressed up to pass — a future task can raise it once the chain-walk behavior is implemented and re-measured.
