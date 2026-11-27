---
name: discovery-interview
description: Fill or refine one discovery document by interviewing the App Creator one question at a time - the product foundation, the personas, the success metrics, the constraints and non-goals, or the MVP and roadmap. Use in discovery, before anything is built, whenever the App Creator asks to work on, write, refine or revisit one of these ("let's pin down the vision", "who exactly are our users", "what should we measure", "define the MVP"). Not for backlog items or the PRD (prd-intake).
model: inherit
---

# Discovery interview

One document per run. Product facts come from the **Discovery profile** in `CLAUDE.md` and the documents already written; this skill assumes none. `<docs>` is the profile's Docs folder.

First run `node .claude/studio/studio-sync.mjs phase --discovery-only`. If it fails, stop and tell the App Creator what it printed.

## Pick the branch

Read **only** the branch for the document you are working on, at step 1. It holds the outline and the rules that document adds; it never removes a step below.

| Document | File | Branch (in this folder) |
| --- | --- | --- |
| Product foundation | `<docs>/product-foundation.md` | [foundation.md](foundation.md) |
| Target users and personas | `<docs>/personas.md` | [personas.md](personas.md) |
| Success metrics | `<docs>/success-metrics.md` | [success-metrics.md](success-metrics.md) |
| Constraints and non-goals | `<docs>/constraints.md` | [constraints.md](constraints.md) |
| MVP definition, then the roadmap | `<docs>/mvp.md`, `<docs>/roadmap.md` | [mvp-roadmap.md](mvp-roadmap.md) |

If the App Creator did not name a document, propose the first one in the order of `.claude/packs/discovery/WORKFLOW.md` that `<docs>/status.md` does not show as `done`.

## Steps

1. **Read first:** `.claude/packs/discovery/WORKFLOW.md`, the Discovery profile, the decision log (`node .claude/hooks/decisions.mjs list`), the branch, the document if it exists, and the documents the branch says it builds on. If one of those is missing, say so and recommend doing it first; go on only if the App Creator prefers to, and mark what rests on it as an assumption.
2. **List the gaps** for yourself: what the document needs that is missing, vague, or contradicted by another document or a study. Rank them by how much the answer changes the product.
3. **Ask one question at a time.** Each question has one line of context, two to four options, and your recommended answer with one line on why. Never two questions in one message. Wait for the answer before the next one.
4. **Challenge, don't transcribe.** Say so when a value claim is weak, two personas overlap, a metric can't be measured, the scope grows, or an answer contradicts the evidence in a study. When a gap needs ideas rather than an answer, offer two or three options yourself (a brainstorming skill may help when the session has one).
5. **Stop asking when the remaining gaps are minor.** Fill those with your recommendation and mark each `(Assumption)`. Do not ask about wording, layout or method.
6. **Record decisions as they are made:** every answer that settles a product question, in the same turn, with `node .claude/hooks/decisions.mjs add "<title>" --decision ".." --why ".." --by ".." --fetch`. Never type an entry by hand.
7. **Write the document** from the branch's outline. Keep it short and lead with the conclusions. Give **Assumptions** and **Open questions** their own sections. A claim about users or the market carries its evidence id from a study, or `(Assumption)`. If an answer changed a Discovery profile row (principles, domain risks, target users), update it: `node .claude/hooks/app-setup.mjs discovery-profile set "Row=value"`.
8. **Update `<docs>/status.md`:** your document's row only.
9. **Open one PR** for the document, titled `docs(discovery): <document>`, through the app's normal git rules. Then follow the profile's Sign-off mode (`WORKFLOW.md`, "Sign-off"): `per artifact` waits for the App Creator's approval before merging; `autonomous with record` merges on green and adds the line to `status.md`.
10. **Tell the App Creator** in a few lines: what the document now says, the decisions recorded, the assumptions you made for them, and the open questions left.

## Rules

- Never invent a fact about users, the market or costs. What no document or study supports is an assumption and is labelled as one.
- An existing document is refined, not rewritten: keep what was approved unless an answer or new evidence changes it, and say what changed.
- One document, one thread. When it is done, hand back; do not start the next document.
