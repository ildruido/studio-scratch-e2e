# Branch: from the discovery documents

_Branch file of the `prd-intake` skill. Read it only when the input is what the discovery module produced, usually at "start building". `<docs>` is the folder that holds the documents: the one `new-app` names, the Discovery profile's Docs folder while `CLAUDE.md` still has that section, else `docs/discovery/`. The numbered steps are in `SKILL.md`._

The documents were written for this step and the App Creator has already approved them (a document on `main` is approved). Do not interview again: ask only what they leave open.

## What to read

`<docs>/mvp.md` and `<docs>/roadmap.md` in full; then `product-foundation.md`, `personas.md`, `success-metrics.md` and `constraints.md` for the PRD; and, where they exist, `architecture-handoff.md` (its next steps and spikes) and `exit-gate.md` (the gaps discovery left). If the MVP is missing or exists only in an open PR, say so and ask the App Creator whether to go on from what there is.

## What becomes what

| In the documents | Becomes |
| --- | --- |
| The problem, the primary persona, the value proposition | The PRD's goal and users, in a few lines, linking the documents. The App profile's User row is the primary persona |
| MVP "In scope", one slice each | One backlog item each (split a slice that is too big for one session). Why: the slice's reason. Acceptance criteria: from the core user flows. Notes: the `H-NN` it tests |
| MVP "Out of scope" | The PRD's out-of-scope list, with the reasons. No backlog items |
| Success metrics | The PRD's success section: the main metric and its target; an item that makes a metric readable says so in its Notes |
| Constraints and non-goals | What the PRD must respect; anything that binds every diff is a Domain rule in the App profile (`new-app` has set those from the handoff) |
| The handoff's spikes | One backlog item each, ordered before the items that depend on it |
| Roadmap "Now" | The MVP items. With the `roadmap` module: lane `now` |
| Roadmap "Next" and "Later" | Backlog items that stay in **Backlog** (never Ready), with the signal that would trigger each in its Notes; "Later" entries are marked as ideas. With the `roadmap` module: lanes `next` and `later` |
| "Product choices still open for building" | The Features questions (`SKILL.md`, "Features"), unless the App profile already has the answers |
| Open questions, and gaps in `exit-gate.md` | Step 3: ask the ones that would change what gets built; the rest go in the Notes of the item they touch |
| Decisions | Nothing to do: they are already in the app's decision log (App profile, Decision log row). Never record one again, and never copy the log into the PRD: the PRD's "Decisions" section points at the log |

## Rules

- Ids come from the scripts as always (`backlog.mjs add`, `decisions.mjs add`), never from the documents' own numbering.
- The PRD stays short and links the documents; it does not restate them.
- After this run the backlog is the only plan. `roadmap.md` and `status.md` are history: do not edit the discovery documents here, and do not keep them in step with the backlog later.
