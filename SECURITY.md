# Security Policy

## Scope

These skills are Markdown instructions and a small zero-dependency Node script (`scripts/sync-registry.mjs`). They contain no secrets and prescribe no destructive defaults. If you find a skill that leaks credentials, embeds a secret, or instructs an agent toward an unsafe default (e.g. `--force`, `reset --hard`, unconditional deletion), please report it.

## Reporting

Open a [GitHub security advisory](https://github.com/lx-wnk/skills/security/advisories/new) or a private report rather than a public issue for anything exploitable. For non-sensitive concerns, a regular issue is fine.

## Supported versions

The latest release (`vX.Y.Z`) is supported. Pin a release when installing: `npx skills add lx-wnk/skills@vX.Y.Z`.
