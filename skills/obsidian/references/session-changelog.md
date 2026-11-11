# Session Changelog

After every session with real work (feature, bugfix, refactor, architecture decision), append an entry to the scope-specific session file.

Path: `${OBSIDIAN_ROOT:-claude-memory}/{category}/{project-name}/sessions/{scope}.md`

- `{category}` = `work` for client or employer projects, `private` for personal projects.
- `{scope}` = Jira ticket (`ABC-123`), feature name (`checkout-tracking`) or module name. Use the same scope file across sessions on the same topic.

Add the new entry at the top of the file (newest first):

```markdown
## YYYY-MM-DD – {Short description of this session's work}

**What changed:** {1–3 bullet points — what was implemented, fixed, or decided} **Where:** {Key files or modules touched}
```

- Skip trivial sessions (config tweaks, single-line fixes, exploration only).
- One entry per session, not per commit.
- Bullets are factual and terse; rationale belongs in a topic note.
- If a topic note exists, link it once in the file header: `> Reference: [[{category}/{project}/{note}]]`.
- After creating or updating a scope file, make sure `…/sessions/_index.md` lists it: one line per scope file with a one-sentence description.

Routing: work project notes, tickets, status → `work/`; tools, plugins, MCP servers → `misc/`; personal projects → `private/`; conventions, architecture decisions, bugs → topic note in `work/`.
