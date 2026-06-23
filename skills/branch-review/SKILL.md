---
name: branch-review
license: MIT
description: 'Multi-agent code review EXCLUSIVELY of the diff between the current branch and a base branch (default main, fallback master/develop) — not a whole-repo audit, only diff-touched areas. Spawns parallel subagents for code quality, architecture, security (OWASP/CWE/CVSS), SEO, privacy/legal, UI/UX (WCAG), and performance, consolidated into a Findings.md with P0–P4 prioritization. Optional `--apply-fixes` applies clear fixes and escalates design decisions. Use for "review this branch", "PR review", "diff review", "branch review", "review my PR", "code review for branch", "review what changed", "review and fix", "fix PR issues", or German "review meinen branch", "review die änderungen", "schau dir den branch an", "PR-Review" — whenever a PR link, branch range, or diff is posted, even without the word "review" if context is clear. DO NOT trigger for a whole-project audit without branch context — use full-project-review.'
user-invocable: true
argument-hint: "[base-branch] [--apply-fixes]"
---

# Branch Review (Multi-Agent)

## DIFF DISCIPLINE (top-level rule)

**The diff is the only anchor.** This review does NOT inspect the whole project — it inspects the changes between `<base>` and `HEAD`. If this skill triggers without a diff: abort and point to `full-project-review`.

Allowed reads:

1. All files touched by the diff — completely (context around the change).
2. Direct imports/callers/call sites of changed symbols — targeted, not broad.
3. Config/manifest files for tech-stack detection.
4. System-wide locations ONLY when a diff change demonstrably affects them (e.g. new auth middleware → check other routes). Mark in the finding: `Diff trigger: <file:line>`.

Forbidden:

- Repo-wide scans without diff context ("let me check all controllers").
- Findings about unchanged legacy code not touched by the diff.
- Existing tech-debt lists with no connection to the current diff.

### Anti-Rationalization Table

These thoughts mean STOP — you are rationalizing scope drift. Each maps to the rule that overrides it.

| Rationalization | Reality |
| --- | --- |
| "While I'm here, let me also check the rest of this file." | Only diff-touched lines + their direct context. Untouched code in the same file is out of scope. |
| "This whole module is poorly designed, I'll note it." | No finding without a `Diff trigger: <file:line>`. Untouched tech debt belongs in `full-project-review`. |
| "The diff is tiny, so I'll broaden to add value." | A small diff yields a small report. Padding with off-diff findings is noise, not value. |
| "I'm fairly sure this is exploitable, I'll state it as fact." | Unverified → mark `Status: hypothesis — verification needed`. Never assert without evidence. |
| "Most findings are minor, I'll just list the top ones." | No omission. Filtering happens only via the P0–P4 column, never by dropping findings. |
| "HTTPS/CSP/etc. is standard, no need to mention it's fine." | Confirmed-good standards → one P4 "confirmed: …" line. Don't inflate, don't silently skip. |
| "I couldn't access this file, I'll infer what it probably does." | Inaccessible → escalation block ("Access missing: …"). Inference is hallucination. |

## Role

You are the orchestrator of a multi-agent review. You yourself write NO review content — you plan, delegate to subagents (Task tool), wait for their reports, and consolidate them. Subagents may in turn spawn further subagents when their topic is too large — all sub-subagents inherit the diff discipline above.

## Scope

**Code-review depth:** only the changes between the current branch and the base branch (`git diff <base>...<HEAD>`).

**Determine the base branch** (in this order):

1. If the user names a base branch → use it.
2. If a PR exists → its target branch.
3. Default: `main`, fallback `master`, fallback `develop`.
4. If unclear: ask the user, do not guess.

**If the diff is empty:** STOP. Report back to the user that the branch is identical to base, and suggest `full-project-review` instead. Do not silently expand scope.

**Context scope for security/legal/performance:** primarily the diff. If a change has system-wide implications (e.g. new auth middleware, modified CSP), the corresponding subagent MAY and SHOULD also inspect affected places outside the diff — and mark them in the finding ("Diff trigger: …, also affects …").

**Live site (for SEO/legal/UX):** only when the diff touches user-facing content AND a live URL is known or obtainable. Otherwise skip and note in the coverage report.

**Findings language:** the language of the user request (default). Code examples in their original language.

**Jurisdiction (for privacy/legal):** derive from user context / project README (server location, target market). If unclear, ask the user — default GDPR/EU.

## Tech-Stack Detection

Before spawning subagents: detect the tech stack from the repo (`package.json`, `composer.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`, etc.). Pass this info to each subagent so it applies the right conventions and tool checks (linter configs, framework best practices, language-specific security patterns). When project-specific convention skills are available in the plugin set (e.g. Vue, Nuxt, Shopware skills), mention them to the relevant subagent.

## Completeness Mandate

- Nothing is omitted. Every issue found belongs in the report, including P3/P4 (low/info).
- No "top 10" filtering. Subagents may not drop findings, only prioritize them.
- If a subagent cannot inspect a file/module: list it explicitly as "not covered" — no silent gaps.
- Every finding MUST be justified. Unjustified entries are not allowed — mark as hypothesis instead of citing without evidence.

## Subagent Team (at minimum these roles, spawn in parallel)

1. **Code-Quality Agent** — readability, naming, complexity, dead paths, tests, coverage gaps, conventions of the detected tech stack. Reviews every diff-touched file.
2. **Architecture Agent** — layers, coupling, cohesion, separation of concerns, scalability, anti-patterns, tech debt created or enlarged by the diff. Provides ADR proposals for larger topics.
3. **Security Agent** (OWASP Top 10 + ASVS) — injection, AuthN/AuthZ, crypto, SSRF, deserialization, secrets, dependency CVEs (`npm audit`, `composer audit`, `pip-audit`, `gh dependabot`, etc.), headers (CSP/HSTS/COOP/COEP), rate limiting, logging. Per finding: CWE reference, OWASP category, CVSS estimate, PoC sketch.
4. **SEO Agent** — titles/meta, canonicals, hreflang, robots.txt, sitemap.xml, structured data (JSON-LD), OpenGraph, Core Web Vitals, SSR correctness. Active only when the diff touches user-facing routes/templates/meta tags.
5. **Privacy/Legal Agent** — cookie consent, tracking before consent, data processors, mandatory pages (imprint/privacy policy/terms depending on jurisdiction), third-country transfers, server location. Accessibility law (BFSG for DE, EAA for EU, ADA for US, etc.) per detected jurisdiction. Active only when the diff touches data-processing paths, tracking, forms, or mandatory pages.
6. **UI/UX Agent** — heuristics (Nielsen), hierarchy, consistency, mobile, touch targets, error messages, empty/loading states, microcopy, accessibility (WCAG 2.1 AA — contrast, keyboard, screen reader, ARIA). Active only when the diff touches UI.
7. **Performance Agent** — bundle size, LCP/INP/CLS, images (format/size/lazy), caching, CDN, N+1 queries, DB indexes, critical render paths. Focus on diff-induced regressions.

If a subagent sees no relevance in the diff for its scope, it still delivers a report (may be short) with the reason it found nothing — no silence.

## How Each Subagent Works

- **No hallucinations.** If a repo/tool/file is inaccessible: write an escalation block ("Access missing: …") instead of guessing.
- **Back every finding** with: file + line(s) OR URL + DOM selector / screenshot hint. No vague statements.
- **When uncertain:** mark as "Hypothesis — verification needed", but still list it.
- **Completeness > brevity.** Filtering happens exclusively via the priority column, not by omission.

## Deliverable: Findings.md

Path: store in the outputs/workspace folder (`outputs/Findings.md` or equivalent).

### Structure

1. **Frontmatter** — date, branch, base branch, commit SHAs (HEAD and merge base), PR status (present/none), tech stack (detected), list of reviewer agents, paths inspected.
2. **Original prompt** — verbatim, in a code block.
3. **Executive Summary** (max. 15 lines) — security traffic light (red/yellow/green + 1-sentence justification), top 3 risks, top 3 quick wins, finding counts per priority (e.g. "P0: 2, P1: 7, P2: 23, …").
4. **Coverage Report** — what was checked (paths, tools), what was NOT checked + reason (access, time, out-of-scope, diff irrelevant).
5. **Findings Index Table** — all findings sorted by priority (columns: ID, Prio, Category, Title, Location, Effort).
6. **Findings in detail** — COMPLETE, one per section (schema below).
7. **Appendix** — tool/method list, versions, references.

### Prioritization

- **P0 — Critical:** actively exploitable, data leak, legal violation with fine risk.
- **P1 — High:** exploitable with preconditions, clear compliance risk.
- **P2 — Medium:** bad practice, no direct exploit, UX pain point.
- **P3 — Low:** nice to have, cosmetic, tech debt.
- **P4 — Info:** observation or confirmed standard, no action needed — list anyway.

### Per-Finding Schema (all fields required)

```
### [P{0-4}] [Category] Short title
- **Location:** path:line / URL
- **Diff reference:** which file/line from the diff triggered it
- **Description:** what is the problem?
- **Justification / why critical:** impact + exploitation/occurrence scenario. Even for P3/P4 a justification is mandatory ("why mentioned at all").
- **Reference:** CWE/OWASP/WCAG/GDPR article/best-practice source
- **Recommendation:** concrete fix (code snippet when useful)
- **Why better:** technical/legal justification of the recommendation
- **Effort:** S / M / L (rough estimate)
- **Status:** verified | hypothesis — verification needed
```

## Subagent Prompt Template (binding)

Every spawned subagent receives EXACTLY this structure. The orchestrator fills the placeholders — omit nothing, paraphrase nothing.

```
ROLE: <Code-Quality | Architecture | Security | SEO | Legal | UI/UX | Performance> Agent

DIFF DISCIPLINE (NON-NEGOTIABLE):
- The anchor is the diff embedded below. Findings ONLY on code touched by the diff OR demonstrably affected by it.
- Forbidden: repo-wide scans, findings on unchanged code, generic best-practice lists without diff reference.
- Allowed system-wide for your role: <fill in per role — see list below>. Mark every system-wide extension in the finding: "Diff trigger: <file:line>".

ALLOWED-FILES (whitelist — these you may read in full):
<output of git diff --name-only, one file per line>

TECH STACK: <detection result>
BASE BRANCH: <base>     HEAD SHA: <sha>     MERGE BASE: <sha>

DIFF (unified):
<full output of `git diff <base>...<HEAD>` OR a note "see file <path>" if too large>

OBLIGATIONS:
- Completeness within the diff (no omissions, including P3/P4).
- Every finding with required fields per schema (see main skill).
- No hallucinations: inaccessible locations → escalation block, do not guess.
- If your scope is not touched by the diff: short report with reason, no silence.

OUTPUT: Markdown report with findings per schema + coverage note (what was checked, what was not + reason).
```

**System-wide extensions per role** (what may be read outside the diff when a diff trigger is demonstrable):

- Security: global auth/crypto/header config, dependency manifest.
- Architecture: direct callers/callees of changed symbols.
- Performance: query paths used by changed models/repositories.
- Legal/SEO/UX: mandatory pages/routes only when the diff touches them or introduces new user-facing flows.
- Code-Quality: only allowed files.

## Execution Order (Orchestrator)

1. **Determine the diff** — pick the base branch (see Scope), run `git diff <base>...<HEAD>` and `git diff --name-only <base>...<HEAD>`, record diff statistics. On empty diff, abort and point to `full-project-review`.
2. **Tech-stack detection** — read manifest files, record stack info.
3. **Create TodoList** with the 7 subagent tasks.
4. **Spawn subagents in parallel** (in one message block). Brief each subagent with the **subagent prompt template** above — insert diff, allowed-files whitelist, tech stack, and system-wide extension rules.
5. **Consolidate reports** — merge duplicates (but don't delete them — merged findings reference their sources), prioritize uniformly.
6. **Write Findings.md.**
7. **Verification pass:**
   - Does EVERY finding have all required fields?
   - Is EVERY finding justified?
   - **Does EVERY finding have a diff reference?** Findings without a diff trigger → remove or prove a diff trigger.
   - Does the count in the index match the detail sections?
   - Is the coverage report complete (including what was NOT checked)?
8. **Return the link** to the finished file.

## Exit Criteria (the review is NOT complete until ALL are true)

Do not report the review as done, and do not enter the auto-fix phase, until every box holds. If any fails, loop back to the named step.

- [ ] A non-empty diff was the anchor; an empty diff aborted to `full-project-review` (step 1).
- [ ] All 7 subagent roles ran and returned a report — including short "nothing found, here's why" reports (step 4).
- [ ] Every finding carries all required schema fields (step 7).
- [ ] Every finding has a `Diff trigger` reference; any without one was removed or proven (step 7).
- [ ] Finding counts in the index table match the number of detail sections (step 7).
- [ ] The coverage report lists what was NOT checked and why — no silent gaps (step 7).
- [ ] Every finding is justified, including P3/P4; unverified ones are marked `hypothesis`.
- [ ] `Findings.md` is written to the outputs folder and its link is returned.

## Important

- **Completeness is non-negotiable.** If the report would be shorter than the actual findings allow → error.
- **Justification is non-negotiable.** Every entry explains WHY it is there and WHY the recommendation is better. That is the value of the report — a list without justification is noise.
- **No security theater.** No generic "use HTTPS" hints when HTTPS is already active. When a standard is met → note once as P4 "confirmed: …", do not ignore, but also do not inflate.
- **Diff discipline.** Branch review means: the diff is the anchor. System-wide implications are allowed but must be marked as such ("Diff trigger: …").

---

## Optional Phase: Auto-Fix (`--apply-fixes`)

**Default is read-only.** The following phase runs after step 8 (verification pass) ONLY if `$ARGUMENTS` contains the flag `--apply-fixes`.

This phase applies clear fixes directly to the branch and escalates design decisions to the user. It replaces the former `review-and-fix` skill.

### Preconditions

- Working tree must be clean (`git status --porcelain` empty). Otherwise abort with the note "Please commit or stash first."
- The current branch is not `main`/`master`/`develop` (no commit on the default branch).
- `Findings.md` from the previous phases exists.

### Fix Classification

For **every** finding in `Findings.md`, assign one of three categories:

| Category | Criteria | Action |
| --- | --- | --- |
| **Confident Fix** | Unambiguous bug, obvious correction (e.g. typo in API path, missing guard following an established pattern, stale doc contradicts code, undefined function, DRY violation with a clear extraction target) | patch directly |
| **Design Decision** | Multiple valid approaches, architectural impact, scope question, depth of security hardening | do not patch, escalate |
| **Out of Auto-Fix Scope** | Test coverage, linter style, refactoring nice-to-have, performance tuning without a clear target | list only, neither patch nor escalate |

No multi-classification. When uncertain → Design Decision (escalating is always cheaper than silently fixing wrong).

### Confident-Fix Workflow

Per confident fix:

1. **Verify** — read `git show <branch>:<file>`, make sure the location and the problem exist as the finding claims. On mismatch: return the finding to `Findings.md` as hypothesis and do not patch.
2. **Minimal patch** — fix only the found location, no surrounding refactoring, no reformatting.
3. **Commit** — `git add <file> && git commit -m "fix(<area>): <one-line>"` with a reference to the finding ID (e.g. `[F-014]`).
4. **Check idempotence** — if the fix needs a test/lint: run it. If not possible: note in the commit message.

Related confident fixes can be combined in one commit when they logically belong together (e.g. the same stale doc in three places).

### Design-Decision Escalation

For each design-decision entry, send a table to the user in this format:

```
### N. <Title>

<One-sentence problem description>
Source: <subagent / finding ID>

| Option | Pro | Con |
|--------|-----|-----|
| A. <Variant 1> | … | … |
| B. <Variant 2> | … | … |
| C. <Variant 3> | … | … |

Recommendation: <A | B | C> — <one-sentence justification>
```

At the end: "Which options should I implement? (e.g. 1.B, 2.A, 3.C)"

After the user's reply: implement the options, one commit per affected concern, then `git push`.

### Push Strategy

- **If the branch is part of an open PR:** `git push` to the PR branch.
- **No PR present:** branch exists only locally / on the remote → `git push -u origin <branch>`.
- **Never** push to `main`/`master`/`develop`.

### Coverage in Findings.md

After the auto-fix phase, append a new section `## Auto-Fix Summary` to `Findings.md`:

- Confident fixes applied: N (with finding IDs and commit SHAs)
- Design decisions for escalation: N (with finding IDs)
- Out-of-scope findings: N (with finding IDs and reason)
- Discarded hypotheses (not reproducible on branch): N (with finding IDs)

This keeps it traceable what the skill changed in the code — and what the user still needs to decide.

### Auto-Fix Principles

- **Verify before fix.** Every fix follows a verification against the real branch code.
- **Minimal change.** No refactoring, no reformat, no "while-I'm-here".
- **One concern per commit.** Three small commits beat one with three different fixes.
- **Honest uncertainty.** When in doubt, do not fix — escalate.
- **Read-only is the default.** Auto-fix runs ONLY with explicit `--apply-fixes`.
