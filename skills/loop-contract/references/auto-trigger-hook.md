# Optional: deterministic auto-triggering

Read this only when the user asks why the skill did not fire, or wants triggering to be reliable rather than heuristic.

## What the skill can and cannot do by itself

Skill dispatch is `description`-based: the model matches the prompt against the description text. That is a heuristic. It fires reliably on clear loop wording ("bis grün", "until tests pass", "setz das Konzept um") and unreliably on paraphrases.

A skill cannot make itself always-on. Hooks can, but hooks live in `settings.json`, outside the skill folder — so this is a snippet to install, not something the skill ships.

## The hook

Add to `.claude/settings.json` (project) or `~/.claude/settings.json` (personal):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/loop-contract-hint.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/loop-contract-hint.sh`, executable:

```bash
#!/usr/bin/env bash
set -euo pipefail

prompt="$(jq -r '.prompt // ""')"

# Loop wording, exhaustive quantifiers, or a handed-over plan document.
pattern='(bis grün|so lange bis|wiederhole|until|keep going|iterate)'
pattern+='|(alle |jede |überall|im ganzen repo|every |all )'
pattern+='|(setz das konzept um|arbeite den plan ab|implement this (spec|plan))'
pattern+='|(docs/.*(plan|design|spec).*\.md)'

if printf '%s' "$prompt" | grep -qiE "$pattern"; then
  echo "This prompt may describe a loop. Consider the loop-contract skill: it gates for a machine-checkable done-state, writes a contract, and runs it under a deterministic budget. If no checkable done-state exists, it will say so instead of looping."
fi
```

Stdout from a `UserPromptSubmit` hook is injected as additional context for that turn. The hook only nudges — it does not invoke the skill, and the Gate still decides whether a loop is appropriate.

## Tuning

- **Fires too often:** drop the quantifier alternative (`alle|jede|every|all`). It is the broadest of the four and the one that matches ordinary questions like "erklär mir alle Optionen".
- **Misses your phrasing:** add it to the first alternative rather than broadening the others.
- **Only for certain projects:** install it in the project's `.claude/settings.json`, not the personal one.

Verify the hook fires with `claude --debug` and a test prompt before relying on it. Hook schema fields have changed between Claude Code versions; if the hook never runs, check the current [hooks reference](https://code.claude.com/docs/en/hooks) before debugging the script.
