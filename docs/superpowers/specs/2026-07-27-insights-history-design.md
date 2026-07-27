# insights-history skill — design

**Status:** approved (2026-07-27) **Build via:** `/skill-builder` **Reference implementations:** [`oss-readiness`](../../../skills/oss-readiness/SKILL.md) (skill-local `references/`), [`tech-gazette`](../../../skills/tech-gazette/SKILL.md) (self-contained HTML report)

> **Branch note.** A skill-local `scripts/` directory does not yet exist on `main`. The unmerged `feat/loop-contract-skill` branch introduces the same pattern (`skills/loop-contract/scripts/loop-state.sh`) together with the opt-in hook-snippet convention in `references/auto-trigger-hook.md`. Whichever branch merges second should align with the first rather than introducing a second variant.

## Purpose

Claude Code's built-in `/insights` analyses whatever session transcripts happen to exist on disk. It takes no arguments, offers no time range, and no period comparison. Transcripts are deleted by the retention policy (`cleanupPeriodDays`, default 30), so the analysable window silently shrinks to roughly the last month — permanently.

This skill makes usage history **durable** and **comparable**: nothing is lost to retention again, and any time range can be reported on, with week-over-week or month-over-month trend and explicit period deltas.

### The gap, concretely

Measured on the author's machine on 2026-07-27, immediately after the first-ever `/insights` run:

| Observation                                    | Value                                               |
| ---------------------------------------------- | --------------------------------------------------- |
| Session transcripts on disk                    | 23.06.–27.07. (34 days)                             |
| `usage-data/` cache age                        | created that same day                               |
| Meta entries whose transcript was already gone | 0                                                   |
| Sessions with facets vs. total                 | 50 of 74 (built-in caps facet extraction at 50/run) |

Everything before 23.06. had been deleted by retention before any cache entry existed. It is unrecoverable. Day zero for the archive is the day the ingest hook is installed.

## Scope

**In**

- Durable capture of every session at `SessionEnd`, independent of transcript retention.
- Reporting over an arbitrary time range, with trend buckets and period-over-period deltas.
- Filling in missing per-session facets so quality data (outcome, friction, satisfaction) is complete rather than capped.
- A self-contained HTML report, global (not per-repo), because usage data spans all projects.

**Out**

- Recovering sessions deleted before the hook was installed — impossible, state it plainly.
- Replacing `/insights`. The built-in stays the single-shot "how am I doing lately" view; this skill is the historical one. Both share the same cache directories.
- Per-repo or per-project scoped reports. Project mix is reported as a dimension, not as a filter.
- Team or multi-machine aggregation.

## How the built-in works

Reverse-engineered from the Claude Code 2.1.220 binary. This determines what the skill must replicate and where it may not drift.

| Step                                                        | Implementation                               | LLM     |
| ----------------------------------------------------------- | -------------------------------------------- | ------- |
| `PLy()` enumerate transcripts, sort by mtime desc           | native                                       | no      |
| `Gjs()` derive per-session metadata                         | native                                       | no      |
| `vLy()` per-session facet extraction                        | prompt `pLy`, 4096 max tokens, 50 concurrent | **yes** |
| `_Ly` chunk-summarise oversized transcripts before faceting | prompt                                       | **yes** |
| `Pep()` aggregate sessions + facets                         | native                                       | no      |
| `Oep()` multi-clauding overlap detection (30-min window)    | native                                       | no      |
| `CLy()` six narrative sections (`wLy`)                      | 6 prompts, 8192 max tokens each              | **yes** |
| `DLy()` render HTML                                         | native template                              | no      |

LLM calls go through `Fft()` as direct non-interactive API queries returning a single JSON object — not tool loops, not agents.

**The design rule this establishes: code counts, the model interprets.** The skill keeps that line in the same place.

### Constraints derived from the binary

1. `/insights` sets `disableModelInvocation: true`. The model cannot trigger it; only the user can type it. The skill therefore needs its own ingest and cannot delegate to the built-in.
2. `getPromptForCommand(e)` never reads `e`. Arguments passed to `/insights` are silently ignored.
3. Per-run caps: 200 uncached sessions parsed, 50 new facet extractions. A custom ingest has no such caps.
4. The report-time session filter is `user_message_count >= 2 && duration_minutes >= 1`, plus dropping sessions whose only goal category is `warmup_minimal`.
5. `~/.claude/usage-data/` is never pruned. Only `~/.claude/projects/` is subject to retention.
6. The facet validator `Mep()` checks three strings and three objects — no enum validation. Observed consequence in real data: `permission_block` and `permission_blocks`, `environment_issue` and `environment_issues` coexist as separate buckets.

## Architecture

Two decoupled halves. The hook secures data (cheap, deterministic, no LLM). The skill interprets it (expensive, LLM, deferrable indefinitely).

```
SessionEnd ──► scripts/ingest.mjs ──► session-meta/<id>.json       [built-in schema]
   (~50ms)        (Node, no LLM)   └► archive/<id>.slim.jsonl.gz   [~0.7% of raw]

/insights-history ──► backfill ──► enrich missing facets ──► facets/<id>.json  [built-in schema]
   (on demand)                  └► aggregate ──► narratives/<period>.json      [frozen]
                                             └► reports/*.html
```

### Why the split

Facets require the transcript, not just the metadata. Capturing metadata alone and deferring facet extraction loses the facets as soon as retention deletes the source. The slim archive is what makes deferral safe.

### Data directories

All under `~/.claude/usage-data/` — global, because usage data spans all projects.

| Path            | Written by             | Purpose                             |
| --------------- | ---------------------- | ----------------------------------- |
| `session-meta/` | hook **and built-in**  | per-session metrics                 |
| `facets/`       | skill **and built-in** | per-session LLM assessment          |
| `archive/`      | hook                   | slim transcript, outlives retention |
| `narratives/`   | skill                  | frozen prose per period             |
| `reports/`      | skill                  | HTML output                         |
| `ingest.log`    | hook                   | errors, never stderr                |

Sharing the first two directories with the built-in is deliberate and bidirectional: `/insights` reads what the hook wrote (so it stops re-parsing and never hits its 200-session cap), and the skill reuses facets the built-in already paid for. This requires exact schema fidelity — a malformed `transcript_mtime` causes the built-in to discard the entry and re-parse. No data loss, but the synergy is lost.

### Slim archive

Retained: user messages, assistant text, timestamps, tool **names** and error status. Dropped: tool result payloads (file contents, command output).

Measured on a 2.35 MB session: 0.10 MB slim (4.5%), 0.02 MB gzipped (0.7%). Extrapolated: ~13 MB per year, against ~1.9 GB per year for keeping raw transcripts.

## Component: `scripts/ingest.mjs`

### Hook mode

Reads the `SessionEnd` payload from stdin:

```json
{
  "session_id": "...",
  "transcript_path": "...",
  "cwd": "...",
  "agent_id": "...",
  "agent_type": "...",
  "hook_event_name": "SessionEnd",
  "reason": "clear|logout|..."
}
```

1. Skip if `transcript_path` is under `subagents/` — subagent transcripts are not sessions.
2. Stream the transcript line by line, accumulating metrics.
3. Write `session-meta/<id>.json` via temp file + `rename` (atomic).
4. Write `archive/<id>.slim.jsonl.gz` via temp file + `rename`.
5. `process.exit(0)` — always.

### Fail-safety

The hook fires at every session end, so failure must be inert:

- Entire body in `try/catch`; exit code always 0. A failure must never block session end or print to the terminal.
- Errors append to `usage-data/ingest.log`, never stderr.
- Self-imposed 5 s timeout. Anything unfinished is recorded in a `pending` list for the backfill to pick up.
- Streaming parse, never whole-file `JSON.parse`. The largest observed transcript is 29.6 MB.

No LLM in the hook. This also makes it recursion-proof: a headless `claude -p` run triggers `SessionEnd` too, but the hook only writes a file and calls nothing.

### Idempotency

Keyed by `session_id`. Sessions can be resumed, so `SessionEnd` fires repeatedly for the same id; the later, more complete run overwrites the earlier one. `transcript_mtime` decides whether a rewrite is needed at all.

### No filtering at ingest

The built-in's length filter is applied at report time, and that is the correct place. Discarding at ingest is irreversible; the data is negligible in size and the filter rule may change. `ingest.mjs` archives everything and `report.mjs` filters.

### Backfill mode

`node ingest.mjs --backfill` walks all existing transcripts instead of reading a payload.

- **Once, now:** capture the 74 existing sessions before retention consumes 23.–27. June, which are 30–34 days old and immediately at risk.
- **Ongoing:** the skill runs it before every report, covering anything the hook missed — crash, hook disabled, Claude Code upgrade, another machine.

This makes the hook an optimisation rather than a single point of failure.

## Component: `scripts/report.mjs`

Deterministic. No LLM. Reads `session-meta/` and `facets/`, writes HTML.

- Replicates `Pep()` field for field, including `Oep()` multi-clauding overlap.
- Normalises friction and outcome keys onto the canonical enum list extracted from the binary's label map, collapsing the `permission_block` / `permission_blocks` class of duplicates.
- Applies the built-in's report-time filters so numbers stay comparable.
- Buckets by week or month; renders trend tables, deltas, and inline SVG sparklines.

### Report content

Header with headline figures, then per bucket:

- **Absolute** — sessions, active days, commits, tokens, tool counts, interruptions, errors.
- **Normalised** — per session and per commit. This is the more informative view: in the author's data, week W30 looked like a collapse in absolute terms (commits 85 → 46, tokens halved) while normalised figures and outcomes showed it as the best week of the range.
- **Quality** — outcomes, helpfulness, friction, on canonical enums.
- **Project mix** — shift over time.
- **Delta** — change against the previous period, with prose.

Output: self-contained HTML to `usage-data/reports/history-<range>-<timestamp>.html` plus `latest.html`. No external assets, light and dark theme.

## Component: `SKILL.md`

Orchestrates, and owns the two LLM steps.

```
1. ingest --backfill        (Node, no LLM)     close gaps
2. load sessions in range   (Node)             identify missing facets
3. enrichment               (LLM, subagents)   generate + cache facets
4. aggregate                (Node, no LLM)     buckets, deltas, normalisation
5. narrative                (LLM, cached)      prose about the change
6. render                   (Node)             HTML
```

Steps 1, 2, 4 and 6 are deterministic and repeatable. Only 3 and 5 cost tokens, and both cache.

### Invocation

```
/insights-history                                  # all time, bucket auto
/insights-history --last 90d
/insights-history --since 2026-06-01 --until 2026-06-30
/insights-history --by week|month
/insights-history --compare 2026-06 vs 2026-07
/insights-history --refresh                        # regenerate narratives
/insights-history --install-hook
```

No arguments: full range. Bucket default by span — weeks at or below 90 days, months above. The trend table is always present; `--compare` adds an explicit delta block for two named periods.

Accepted period tokens, used identically by `--since`, `--until` and both sides of `--compare`:

| Token                  | Example      | Resolves to                    |
| ---------------------- | ------------ | ------------------------------ |
| `YYYY-MM-DD`           | `2026-06-01` | that day, 00:00 local          |
| `YYYY-MM`              | `2026-06`    | that calendar month            |
| `YYYY-Www`             | `2026-W26`   | that ISO week                  |
| `<N>d`, `<N>w`, `<N>m` | `90d`        | relative to now, `--last` only |

`--compare A vs B` takes two period tokens separated by the literal word `vs`. Ranges are inclusive at both ends. An unparsable token is a hard error naming the accepted forms — never a silent fallback to the full range, which would produce a plausible but wrong report.

### Enrichment

Sessions lacking facets are assessed from the slim archive using the built-in's own prompt and enums.

- **Cost gate.** Count what is missing and report it before starting. Above a threshold of 20 sessions, ask rather than proceed. Currently 24 of 74 are missing.
- **Oversized sessions.** Chunk-summarise before extraction, mirroring the built-in, so long sessions do not exhaust the context window.
- **Parallelism.** One subagent per batch of sessions, returning structured JSON. Keeps the main context clean — 24 slim transcripts inline would flood it.

### Frozen narratives

Prose for a **closed** period is generated once into `narratives/<range>-<bucket>.json` and reused thereafter. Only the current, still-open bucket is regenerated each run. `--refresh` forces regeneration.

Rationale: two runs over identical data otherwise produce different prose, making it impossible to tell whether the user's working style changed or only the sampling did. Facets are unaffected — they are per-session and permanent once written.

The cost: a frozen narrative cannot know about later periods. A June paragraph cannot say "this settled down in July". The delta section is therefore separate, always spans the full range, and is rewritten on every comparison.

## Hook installation — opt-in

Plugins can ship a `hooks.json` that loads automatically. This skill deliberately does not.

1. The repository is public. A plugin that silently begins writing every user's prompts to disk after installation is a privacy problem regardless of the data staying local. It must be a deliberate choice, not a side effect of `npx skills add`.
2. The plugin cache path is version-pinned. A hook pointing into it breaks silently on the next plugin update, and `${CLAUDE_PLUGIN_ROOT}` only resolves for plugin-provided hooks, not for an entry in the user's global `settings.json`.

`--install-hook` therefore copies `ingest.mjs` to `~/.claude/scripts/insights-ingest.mjs` (a stable path), shows the intended `settings.json` diff, and patches only after explicit confirmation:

```json
{
  "hooks": {
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/scripts/insights-ingest.mjs" }] }]
  }
}
```

Without the hook the skill still works; only the gap risk returns, since the backfill then runs solely at report time.

## Layout

```
skills/insights-history/
├── SKILL.md
├── scripts/
│   ├── ingest.mjs          # hook entry + --backfill
│   └── report.mjs          # aggregation + HTML render
└── references/
    ├── ingest-hook.md      # hook snippet + install instructions
    └── builtin-schema.md   # meta/facet schema, enum map, aggregation fields
```

`builtin-schema.md` is load-bearing, not documentation garnish: it records the schema extracted from the binary. Without it, the reason the fields are named exactly so is unrecoverable at the next Claude Code release.

## Verification

The acceptance test writes itself: aggregation must reproduce the built-in's numbers for the same window.

| Check | Method | Pass condition |
| --- | --- | --- |
| Aggregation fidelity | run `report.mjs` over the window of an existing `/insights` run | session count, message count, commit count identical |
| Idempotency | run ingest twice on the same transcript | byte-identical output files |
| Hook inertness | feed malformed payload | exit 0, entry in `ingest.log`, nothing on stderr |
| Large transcript | ingest the 29.6 MB session | completes under the 5 s budget, memory stays bounded |
| Enum normalisation | aggregate data containing both `permission_block` and `permission_blocks` | collapsed into one canonical bucket |
| Schema compatibility | run `/insights` after the hook has written meta | built-in reuses the entries rather than re-parsing |

The first row is a hard gate. The reference run of 2026-07-27 reports 62 sessions, 1,543 messages and 388 commits; a deviation means the reimplementation is wrong.

## Privacy

Scripts contain no personal data. Reports and archive live under `~/.claude/`, never in the repository. Slim transcripts contain user prompts in clear text — local only, never committed, never synchronised. The hook is opt-in and its effect is stated before installation.

## Open decisions

None. All forks resolved during design:

| Decision            | Choice                                               |
| ------------------- | ---------------------------------------------------- |
| Purpose             | archive **and** reporting                            |
| Report depth        | full analysis, facets and narrative, as the built-in |
| Ingest trigger      | `SessionEnd` hook, automatic                         |
| Output              | self-contained HTML, global path                     |
| Durability strategy | slim archive rather than disabling retention         |
| Script placement    | skill-local `scripts/`, not repository level         |
| Hook distribution   | opt-in snippet, not plugin-shipped                   |
| Enrichment          | parallel subagents                                   |

## Related skills

- [`session-handoff`](../../../skills/session-handoff/SKILL.md) — the other reporting skill; writes to `outputs/`, whereas this one writes globally because its data is global.
- [`oss-readiness`](../../../skills/oss-readiness/SKILL.md) — precedent for skill-local `references/` and for a flag that mutates state only after explicit confirmation.
- `loop-contract` (unmerged, `feat/loop-contract-skill`) — same skill-local `scripts/` plus opt-in hook-snippet pattern; see the branch note at the top.
