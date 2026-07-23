# README Patterns & Community-Health Matrix

Reference material for the `oss-readiness` skill's README front-door and community-health-files dimensions. Loaded on demand — not part of the always-resident `SKILL.md` body.

## Awesome-README Checklist (inverted-pyramid order)

A great front-door README puts proof of value first and mechanism last. Score a README against this order, not just against presence/absence of sections.

1. **Title + badges row** — build/CI status, release/version, license, ecosystem/standard. The CI badge MUST reference a workflow that actually exists in `.github/workflows/` — a badge pointing at a non-existent workflow is worse than no badge.
2. **One-sentence value proposition** directly under the title — what the project does and who it is for. No preamble before it.
3. **"Works with" / compatibility line** pulled out visually (a line, a row of logos, a short list) rather than buried mid-paragraph.
4. **Why section** — benefit bullets framed around the problem solved, not a generic feature dump. "Saves you from X" beats "Has feature Y".
5. **Install** — a copy-paste block, escalating in specificity: install everything, install one thing, install a pinned version. State the runtime requirement (Node/Python/PHP version, etc.) if install depends on it.
6. **Quick example / usage** — placed BEFORE the reference/feature list. This is the highest-converting section: it proves value in ~5 seconds. Plain text or a code block is sufficient; reserve a GIF/screenshot for genuinely visual output (a CLI or config-only tool rarely needs one).
7. **Feature / catalog list** — once it exceeds roughly 10 rows, group it into categories. A flat table beyond that size stops being scannable.
8. **"How it works" / mechanism** — kept brief, placed AFTER install and the catalog (below the fold). Curious readers get here after they're already convinced; casual readers never need to.
9. **Contributing + License** — short pointers that link out to `CONTRIBUTING.md` / `LICENSE` rather than inlining their content.

### Anti-patterns to flag

- **Duplication across README / CONTRIBUTING / other docs** — each fact should have exactly one home; every other mention links to it instead of repeating it. This is the docs-consistency dimension's primary check, but the README dimension flags it too when the duplication sits in the README itself.
- **Dead links** — internal doc links, badge targets, and install commands that 404 or reference renamed files.
- **Missing CI badge when CI exists** — a `.github/workflows/*.yml` is present but the README carries no corresponding badge.
- **Premature ornamentation** — a logo, GIF, table of contents, or social-proof section (stars/sponsors row) added to a small, text-only repo before the content volume or adoption actually warrants it. Flag as P3 — cosmetic, not blocking.

## Community-Health File Matrix

| File | Why it matters | Where it lives |
| --- | --- | --- |
| `LICENSE` | Without it the code is "all rights reserved" by default — forks, reuse, and even some CI/package registries refuse it | repo root |
| `README.md` | The front door; first (often only) thing a visitor reads before deciding to adopt | repo root |
| `CONTRIBUTING.md` | Lowers the bar for first-time contributors, sets expectations (branch model, test command, PR process) | repo root or `.github/` |
| `CODE_OF_CONDUCT.md` | Signals a maintained, safe community; a hard requirement for some foundations (CNCF, Apache) and some corporate contributor policies | repo root or `.github/` |
| `SECURITY.md` | Gives researchers a private disclosure channel instead of forcing a public issue for an exploitable bug | repo root or `.github/` |
| `.github/ISSUE_TEMPLATE/*` | Structures bug reports and feature requests, reduces maintainer back-and-forth | `.github/ISSUE_TEMPLATE/` |
| `.github/PULL_REQUEST_TEMPLATE.md` | Reminds contributors of the pre-submission checklist (tests, docs, changelog) | `.github/` |
| `CHANGELOG.md` | Lets consumers assess upgrade risk without reading every commit | repo root |
| CI workflow + badge | Signals the project is actively tested, not abandoned | `.github/workflows/`, badge referenced from README |
| `.gitignore` | Prevents committing build artifacts, local config, or secrets by accident | repo root |

A file existing but containing only placeholder/boilerplate text (e.g. a `CONTRIBUTING.md` that still says "TODO: write me") counts as **present but non-compliant** — report it as a finding, not as "missing".
