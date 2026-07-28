# Built-in schema reference

**Claude Code version: 2.1.220.** Every field, pattern, and cap below was read out of the compiled, minified `cli.js` in that build (function names `PLy`, `Gjs`, `vLy`, `_Ly`, `Pep`, `Oep`, `CLy`, `DLy`, `Mep` per `docs/superpowers/specs/2026-07-27-insights-history-design.md`) and cross-checked against this machine's real `~/.claude/usage-data/session-meta/` (74 entries) and `~/.claude/usage-data/facets/` (50 entries), written by the built-in `/insights` command itself.

**This is reverse-engineered, not documented.** Minified identifiers and internal shapes are not a public API and carry no compatibility guarantee. Re-verify every table here against the new binary before trusting it after any Claude Code upgrade — a field rename, a changed cap, or a new enum value will silently desync `report.mjs`'s aggregation from what `/insights` itself does, and nothing will raise an error when it happens.

## session-meta field list

Written by `Gjs()` in the built-in, and by `lib/transcript.mjs` `extractMeta` in this skill — field-for-field, confirmed identical on real data (see `references/parity-harness.md`).

| Field | Type | Meaning |
| --- | --- | --- |
| `session_id` | string | matches the transcript filename |
| `project_path` | string | cwd at session start, `-`-encoded directory becomes `/`-joined |
| `start_time` | ISO 8601 string | timestamp of the first parsed line |
| `duration_minutes` | integer | last timestamp minus first, in minutes |
| `user_message_count` | integer | count of user-authored (non-tool-result) messages |
| `assistant_message_count` | integer | count of assistant turns |
| `tool_counts` | object<string,int> | per-tool-name invocation counts |
| `languages` | object<string,int> | file-extension-derived language counts for edited/written files |
| `git_commits` | integer | count of Bash invocations matching `git commit` |
| `git_pushes` | integer | count of Bash invocations matching `git push` |
| `input_tokens` | integer | summed `usage.input_tokens` across assistant turns |
| `output_tokens` | integer | summed `usage.output_tokens` across assistant turns |
| `first_prompt` | string | first 200 chars of the first user message |
| `user_interruptions` | integer | user messages sent while Claude was mid-response |
| `user_response_times` | number[] | seconds between an assistant turn and the next user message |
| `tool_errors` | integer | count of `tool_result` blocks with `is_error: true` |
| `tool_error_categories` | object<string,int> | `tool_errors`, classified — see below |
| `uses_task_agent` | boolean | any `Agent`/`Task` tool call present |
| `uses_mcp` | boolean | any tool name starting `mcp__` |
| `uses_web_search` | boolean | any `WebSearch` call |
| `uses_web_fetch` | boolean | any `WebFetch` call |
| `lines_added` / `lines_removed` | integer | reserved counters, populated by native diff accounting |
| `files_modified` | integer | count of edit/write tool calls whose input carries a recognised extension |
| `message_hours` | int[] | local hour-of-day of each user message, for time-of-day analysis |
| `user_message_timestamps` | ISO 8601 string[] | one per user message |
| `transcript_mtime` | integer (ms epoch) | source transcript's mtime at write time — the idempotency/staleness key |

No `session_type` field lives on session-meta — that only appears on the facet object, described next.

## Facet object shape

Written by `vLy()` (per-session LLM extraction, prompt `pLy`, 4096 max tokens) in the built-in; written by the skill's enrichment step under the same schema so `/insights` can reuse what this skill pays for and vice versa. Real sample, unmodified:

```json
{
  "underlying_goal": "The user wanted a comparative research overview of AI agent memory engines ...",
  "goal_categories": { "research_and_comparison": 1 },
  "outcome": "fully_achieved",
  "user_satisfaction_counts": {},
  "claude_helpfulness": "very_helpful",
  "session_type": "single_task",
  "friction_counts": {},
  "friction_detail": "",
  "primary_success": "fast_accurate_search",
  "brief_summary": "User asked for a comparison of nine-plus memory engines; Claude ran parallel research agents, delivered a structured comparison table with recommendations, and persisted the results to Obsidian.",
  "session_id": "cd4bc50a-70f5-4560-84c2-0c93af5c62d4"
}
```

Fields: `underlying_goal` (string), `goal_categories` (object<string,int>), `outcome` (string), `user_satisfaction_counts` (object<string,int>), `claude_helpfulness` (string), `session_type` (string), `friction_counts` (object<string,int>), `friction_detail` (string), `primary_success` (string), `brief_summary` (string), `session_id` (string).

`claude_helpfulness` and `session_type` are absent on 2 of the 50 real facets sampled — the extraction prompt does not guarantee every field is populated.

## The validator does not check values

The built-in's facet validator `Mep()` checks three strings and three objects — **types only, no enum membership check.** Concretely, none of `goal_categories`, `friction_counts`, `outcome`, `claude_helpfulness`, or `session_type` is validated against a fixed vocabulary. This is the direct cause of the open-ended key sprawl documented below and in `references/parity-harness.md`: the model invents a label, the validator accepts anything of the right JSON type, and the label ships.

## Observed vocabulary — outcome, helpfulness, session type

These are **empirically observed values on real local data (n=50 facets)**, not a confirmed enum from the binary — since `Mep()` performs no enum check, there is no closed list to extract. Treat the tables below as "what has been seen so far," not "the complete set."

`outcome` (50/50 populated):

| Value                | Count |
| -------------------- | ----- |
| `mostly_achieved`    | 22    |
| `fully_achieved`     | 20    |
| `partially_achieved` | 5     |
| `not_achieved`       | 3     |

`claude_helpfulness` (48/50 populated):

| Value                | Count |
| -------------------- | ----- |
| `very_helpful`       | 35    |
| `essential`          | 8     |
| `moderately_helpful` | 3     |
| `slightly_helpful`   | 2     |

A `not_helpful` (or equivalently worst-tier) value is plausible by naming symmetry but was not observed in this sample — do not assume it is the full set.

`session_type` (48/50 populated):

| Value                  | Count |
| ---------------------- | ----- |
| `multi_task`           | 35    |
| `single_task`          | 11    |
| `iterative_refinement` | 2     |

## Goal categories — open vocabulary in practice

`goal_categories` is nominally a small taxonomy (`warmup_minimal` is load-bearing — it is the one value the report-time filter checks by name) but in practice the real cache contains **over 90 distinct keys** across 50 facets, most appearing once: `feature_implementation`, `bug_fixing`, `documentation`, `refactoring`, `code_review` and its half-dozen near-duplicate spellings (`code_review_audit`, `code_review_analysis`, `code_review_and_verification`, `code_review_verification`, `code_review_quality`, `code_review_security`, `code_review_and_pr_management`, `code_review_pr_management`, `code_review_and_merge`), `testing`, `configuration_change` / `config_change`, `refactoring_cleanup` / `code_refactoring` / `cleanup_refactoring` / `code_maintenance_refactor`, and many one-off phrasings. This is the same open-vocabulary failure mode as `friction_counts`, just less consequential because `report.mjs` only ever inspects `goal_categories` for the single literal key `warmup_minimal`; it does not aggregate or display the rest.

## Friction vocabulary

See `references/parity-harness.md` and `lib/aggregate.mjs`'s `KNOWN_FRICTION` set for the full canonicalisation table. Real local data: 21 distinct friction keys observed across 50 facets, collapsing to fewer once known aliases are merged (`permission_block(s)`, `permission_interruption` → `claude_got_blocked`; `environment_issue(s)`, `tool_environment_issue` → `external_issue`; `tool_failure(s)` → `tool_failed`; `incomplete_task`, `incomplete_fix` → `incomplete_solution`; `user_interrupted` → `user_stopped_early`). Keys with no defined mapping and no match in the known 13-value set (`tool_limitation`, `tooling_agent_reporting_failure`, `ui_automation_difficulty`, `agent_stall`, `unsupported_claim`, `overconfident_claim` in the observed sample) are tallied separately as "ad-hoc vocabulary" rather than silently dropped or silently trusted.

## Tool-error classification patterns

`classifyToolError()` in `lib/transcript.mjs` matches the lower-cased `tool_result` body against ordered keyword patterns, first match wins:

| Pattern (any keyword matches)                   | Label            |
| ----------------------------------------------- | ---------------- |
| `"exit code"`                                   | `Command Failed` |
| `"rejected"`, `"doesn't want"`                  | `User Rejected`  |
| `"string to replace not found"`, `"no changes"` | `Edit Failed`    |
| `"modified since read"`                         | `File Changed`   |
| `"exceeds maximum"`, `"too large"`              | `File Too Large` |
| `"file not found"`, `"does not exist"`          | `File Not Found` |
| (no match)                                      | `Other`          |

Only `tool_result` blocks with `is_error: true` are counted — the built-in and this skill both moved away from sniffing the phrase "error" in ordinary output. Real local data (74 sessions): `Other` 189, `Command Failed` 78, `User Rejected` 20, `File Not Found` 12, `Edit Failed` 10, `File Changed` 4 — `File Too Large` did not occur in this sample. `Other` dominating (189 of 313, ~60%) means most tool failures do not match a defined keyword pattern; treat the labelled buckets as a partial breakdown, not a complete taxonomy.

## Report-time filter

A session is reportable only if:

```
user_message_count >= 2 && duration_minutes >= 1
```

and is additionally dropped if its facet's `goal_categories` has exactly one active key and that key is `warmup_minimal`. Implemented as `isReportable(meta, facet)` in `lib/aggregate.mjs`, applied identically by `report.mjs` before any aggregation — sessions failing this filter are excluded from every bucket, every total, and the `missingFacets` count.

## Per-run caps

The built-in caps a single `/insights` run at:

- **200** transcripts parsed per run (uncached; already-cached entries don't count against this).
- **50** new facet extractions per run.

Both caps are native, not model-imposed, and both are the reason a repository with more than ~50 unfacetted sessions needs more than one `/insights` invocation to catch up — which is also why the built-in cache can lag behind the transcript set on disk. This skill's own ingest (`ingest.mjs --backfill`) has no such cap; it processes every transcript it finds in one pass. The skill's facet enrichment step (`/insights-history`) does batch by design (see `SKILL.md` § Enrichment rules) but that batching is a context-window and cost-control choice, not a mirror of the built-in's 50-per-run limit.

## Re-verification checklist

When Claude Code updates past 2.1.220, before trusting this file again:

1. Re-run `/insights` once so `~/.claude/usage-data/{session-meta,facets}/` contains fresh entries from the new binary.
2. Diff a fresh `session-meta/*.json` and `facets/*.json` against the shapes above — a field add/rename/removal invalidates the corresponding table.
3. Re-run `references/parity-harness.md`'s harness (`scripts/parity.mjs`) and compare the baseline rates against `BASELINE` in that script.
4. If the minified function names are needed again (e.g. to locate the caps or the filter), they will very likely have changed — search by behavior (call sites near `/insights`' entry point), not by the old names listed at the top of this file.
