# Community-Health File Generation

Reference material for the `--apply-fixes` phase of `oss-readiness`. Loaded on demand — not part of the always-resident `SKILL.md` body.

**Principle: generate, don't copy.** This skill ships no static template files. A checked-in `assets/SECURITY.md` or `assets/CONTRIBUTING.md` would itself become stale content that needs separate maintenance, and would tempt a mechanical placeholder-substitution instead of a file actually tailored to the target repo. Instead, for every missing file, probe the repo for the facts below and compose fresh content that fits it.

## Facts to probe before generating anything

| Fact | Source (first match wins) |
| --- | --- |
| Project name | `package.json` `name`, `composer.json` `name`, `pyproject.toml` `[project].name`, `go.mod` module path, else the repo directory name |
| Repo URL | `git remote get-url origin` (normalize `git@host:org/repo.git` → `https://host/org/repo`), else `gh repo view --json url -q .url` if `gh` is available |
| Default branch | `git remote show origin` / `gh repo view --json defaultBranchRef`, else the branch this skill refused to run fixes on |
| License type | `LICENSE` / `LICENSE.md` file content (first line), else `package.json` `license` field |
| Security contact | an email already present in an existing `SECURITY.md`/`CODE_OF_CONDUCT.md`/`package.json` `author`/`FUNDING.yml`, else escalate as a manual TODO — never invent a contact address |
| Test/lint command | `package.json` `scripts.test`, `Makefile` targets, CI workflow steps (`.github/workflows/*.yml`) |
| Install command | detected stack: `npm install` / `composer install` / `pip install -e .` / `go mod download`, matching the manifest found |

If a fact cannot be determined from the repo, leave it as an explicit TODO in the generated file and list it in the report — never guess a contact address, a license choice, or a tagline.

## Per-file generation guide

### `SECURITY.md` (repo root or `.github/`)

Sections: Scope (what "vulnerable" means for this project, drawn from its README description), Reporting (repo URL + `/security/advisories/new`, or the probed security contact), Supported versions (derived from the repo's tag/release scheme if one exists, else "latest release only").

### `CONTRIBUTING.md` (repo root)

Sections: Getting started (fork + branch from the probed default branch, the probed install command), Submitting a change (one concern per PR, reference the detected test command), Reporting bugs/features (point at the issue templates), Code of Conduct pointer (only if `CODE_OF_CONDUCT.md` exists or is being created in the same pass).

### `CODE_OF_CONDUCT.md` (repo root or `.github/`)

Do not draft this one from memory. At apply-time, fetch the current Contributor Covenant v2.1 text directly from `https://raw.githubusercontent.com/EthicalSource/contributor_covenant/release/content/version/2/1/code_of_conduct.md` and use it verbatim except for the reporting contact, which is filled in from the probed security contact — the same address used in `SECURITY.md`. If the fetch is unavailable (offline, blocked), escalate this file as a manual TODO rather than reconstructing the standard from memory, since an incorrect Code of Conduct is a legal/community-trust document, not a cosmetic one.

### Issue templates (`.github/ISSUE_TEMPLATE/`)

Generate a bug-report and a feature-request template. Sections: bug report = what happened / steps to reproduce / environment; feature request = problem / proposed solution / alternatives considered. Match the detected issue-template format already in use elsewhere in the repo (YAML forms `.yml` vs. classic Markdown front matter `.md`) — if neither exists yet, default to Markdown front matter (portable, no GitHub-specific forms schema).

### `PULL_REQUEST_TEMPLATE.md` (`.github/`)

Sections: What & why, Type (bug fix / feature / docs-tooling), Checklist — seed the checklist with the probed test command and any repo-specific gate found in CI (e.g. a registry-sync or formatting check), not a generic list.

## Never

- Never ship or read from a static `assets/` template file for these six files — the facts above must come from the live repo, every run.
- Never invent a security contact, a license, or a tagline when the probe finds nothing — escalate as a manual TODO instead.
- Never overwrite a file that already exists (see the probe-don't-assume rule in `SKILL.md`) — this guide applies only to genuinely missing files.
