# Research module: studies that inform a decision instead of confirming it

A process module (`"kind": "module"` in `pack.json`): added when the App Creator wants product questions answered with evidence (`pack add research`), at any point in the app's life: before a stack exists, or years into building. An app without it has no research skill and nothing asks for one. It needs no other pack.

## What it adds

| File | What |
| --- | --- |
| `.claude/skills/research/SKILL.md` | The skill `research`: one procedure for any study (frame, tier, pre-register, search both ways, log, verify, conclude, skeptic review, deliver) |
| `.claude/skills/research/user-reality-check.md`, `market-size.md`, `competitor-scan.md`, `competitive-analysis.md`, `external-research.md` | Its branches, read only for that kind of study |
| `.claude/agents/research-skeptic.md` | The agent `research-skeptic`: a cold, independent review that re-checks sources and forms its own verdict before reading the lead's |
| `.claude/packs/research/FRAMEWORK.md` | The method: biases guarded against, roles, tiers, evidence grades, confidence and verdict rules, ethics |
| `.claude/packs/research/protocol-template.md`, `report-template.md`, `sizing-sheet-template.md`, `competitor-entry-template.md` | Templates the skill fills in |
| `.claude/packs/research/studies.mjs` | Study ids and the index row, by code (below) |
| `docs/research/studies.md` | The index of studies (a starter file: the app owns it) |

## Study ids come from the script

```sh
node .claude/packs/research/studies.mjs next --fetch                      # the next free id (this tree and every remote branch)
node .claude/packs/research/studies.mjs add "<title>" --type "<type>" --tier <light|standard|deep> --fetch
node .claude/packs/research/studies.mjs verdict R-NNN "<verdict>"
```

`add` takes the next free `R-NNN`, writes the row in `docs/research/studies.md` and prints the study folder (`docs/research/R-NNN-<slug>/`). Ids are never picked by hand and index rows are never typed. With `--fetch` the script counts every id already pushed on any branch, so parallel threads collide only if both take an id before either has pushed: push the protocol commit and open its PR straight after `add`. Node built-ins only.

## Rules

- One study per thread, like one backlog item per thread. A study reaches `main` in two PRs through the app's normal git rules: `docs(research): R-NNN protocol` (the protocol and the index row, merged before the first search) and `docs(research): R-NNN <study title>` (the report and the rest). The app squashes each PR into one commit, so the protocol's own commit on `main` is what proves the rules came before the search.
- The skill takes product facts from the app's own documents and asks the App Creator only about the decision a study informs, product facts the documents don't settle, and the kill criteria at deep tier.
- A study ends with a verdict for the App Creator, who decides. The decision goes in the app's decision log (App profile, Decision log row) with a link to the report.
- Sources nobody on the study opened carry no weight unless the App Creator accepts them in a recorded decision; they then keep the label "accepted, not opened" in every summary.
- Plugin skills with similar names (market analysis, competitive analysis, deep research) are optional helpers for searching or presenting. Nothing here needs them.
- The skeptic runs on a strong model at high effort; a standard study costs one such agent run; a deep study adds an independent replication run.
