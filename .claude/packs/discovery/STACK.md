# Discovery module: a method for the stage before building

A process module (`"kind": "module"` in `pack.json`): added when a new product idea deserves real discovery before a stack is chosen (`pack add discovery`), and removed when the App Creator says "start building" (`pack remove discovery`, then `app-setup.mjs discovery-profile close`; the `new-app` skill does both), so its skills leave every build session. The documents it produced are the app's own and stay. It requires the `research` module, which the app keeps. An app without it has none of these skills and nothing asks for them.

## What it adds

| File | What |
| --- | --- |
| `.claude/skills/discovery-interview/` | The skill `discovery-interview`: fill or refine one document by interviewing the App Creator one question at a time. Branches, read only for their document: `foundation.md`, `personas.md` (with the evidence audit), `success-metrics.md`, `constraints.md`, `mvp-roadmap.md` |
| `.claude/skills/riskiest-hypotheses/` | The skill `riskiest-hypotheses`: ranked hypotheses with a test each, built on the app's research studies |
| `.claude/skills/prototype/` | The skill `prototype`: a throwaway mock-up tied to the hypotheses it can and cannot test, with an index row per version. Branch `design-alternatives.md`: after a rejected prototype, three deliberately different whole-journey options on one board, then the App Creator picks |
| `.claude/skills/architecture-handoff/` | The skill `architecture-handoff`: product and architecture input, an App profile draft, next steps, then an independent review by a separate agent on a strong model |
| `.claude/skills/exit-gate/` | The skill `exit-gate`: scores the exit criteria and reports the gaps. It never switches the phase |
| `.claude/packs/discovery/WORKFLOW.md` | The order of work, the documents, the loops and the ways of working |
| `.claude/packs/discovery/exit-criteria.md` | The default exit criteria |
| `docs/discovery/status.md`, `starting-idea.md`, `prototypes.md`, `decision-log.md` | Starter documents (the app owns them) |

The module ships no agent: the handoff's reviewer is a fresh general agent the skill briefs.

## Set it up once

```sh
node .claude/studio/studio-sync.mjs pack add discovery        # also adds research
node .claude/hooks/app-setup.mjs discovery-profile init --product "<the product in one line>" --users "<the target users in one line>"
```

`discovery-profile init` writes a **Discovery profile** section into `CLAUDE.md`, under the App profile. The skills are generic and read every product fact from it:

| Row | Meaning |
| --- | --- |
| Product | The product in one line |
| Target users | Who it is for, in one line |
| Starting idea | Path of the original idea (default `docs/discovery/starting-idea.md`): a starting point, never a fixed plan |
| Docs folder | Where the discovery documents live (default `docs/discovery/`). Starter documents always land in `docs/discovery/`; with another folder, move them there once |
| Sign-off mode | `per artifact` (default: each document's PR waits for the App Creator's approval) or `autonomous with record` (merge when the checks are green, record each step in `status.md`, recap on request) |
| Exit criteria | `default`, or the changes to the default list, e.g. `default; drop 7 (no screens in this product); add: legal review done` |
| Principles, Domain risks, Prototype look and feel | Free rows, filled as discovery learns them (`not set yet` until then) |

More options: `--idea <path>`, `--docs <folder>`, `--sign-off "<mode>"`, and `"Row=value"` pairs for the other rows. Change a row later with `node .claude/hooks/app-setup.mjs discovery-profile set "Row=value"`.

`init` also points the App profile's **Decision log** row at `<docs folder>/decision-log.md` when that file exists and the app has recorded no decision yet; otherwise the row stays as it is. Either way decisions go through `node .claude/hooks/decisions.mjs`.

While the module is installed, `health` fails if the Discovery profile is missing, a required row (the first five) is empty, the sign-off mode is not one of the two, or the docs folder does not exist.

## Rules

- Every skill of this module starts with `node .claude/studio/studio-sync.mjs phase --discovery-only` and stops when it fails: discovery is over once the app is building.
- One thread per document or study. Decision ids come from `decisions.mjs`, study ids from the research module's script, never picked by hand.
- No production code in discovery. A prototype is a throwaway page: no tests, no repo code, never the start of the app.
- The app's git rules apply unchanged: every change goes through a PR, nothing is committed straight to `main`.
- The MVP is written so `prd-intake` can turn it into the PRD and the backlog. After "start building" the backlog (and the Roadmap list, where the app has that module) is the only roadmap; `status.md` and the discovery roadmap stay as history.
- The handoff recommends a stack; the stack question itself is still asked when the App Creator starts building.
- The exit gate reports readiness. Only the App Creator's "start building" ends discovery.
- Optional plugin skills (brainstorming, spec writing, front-end design) may help where a skill names them; nothing here needs them.
