# Decision log

Product decisions, newest first. Entries are added, numbered, dated and superseded by `node .claude/hooks/decisions.mjs` (`add`, `supersede`, `list`, `show`), never typed by hand. An entry is never rewritten: a changed decision is a new entry that supersedes the old one.

### D-003 Save the last tip and group size per person (2026-11-27)
- Status: Active
- Decision: Each person's last tip and group size are saved as their own documents; access is whoever the owner shares the artifact with.
- Why: The App Creator chose to remember the last choices; an artifact app with per-person documents adds the user module.
- Decided by: Ale (App Creator)

### D-002 Build starts as an artifact prototype (2026-11-27)
- Status: Active
- Decision: Tip Splitter is built as a private Claude artifact page, with AI off.
- Why: Fastest route to a first release for a one-page tool, as the App Creator chose at start building.
- Decided by: Ale (App Creator)

### D-001 Tip is chosen with preset buttons plus a custom percentage (2026-11-27)
- Status: Active
- Decision: Tap 15%, 18% or 20%, or type your own percentage.
- Why: Presets cover most bills and a custom field covers the rest, at little extra build cost.
- Decided by: Ale (App Creator)
