# Branch: MVP definition and roadmap

Builds on: the product foundation, the personas, the riskiest hypotheses (`<docs>/hypotheses.md`), the success metrics and the constraints. Two documents, two PRs: the MVP first; the roadmap only after the MVP is approved (or merged, in `autonomous with record` mode), because it is derived from it.

Both are written so that the `prd-intake` skill can later turn them into the PRD and the backlog without another interview. A spec-writing skill may help with wording when the session has one; this outline still decides the shape.

## MVP outline (`<docs>/mvp.md`)

- **The problem the MVP solves, for whom:** the primary persona and the one job it does for them.
- **In scope:** the capabilities, each as one independently testable slice in plain words (who does what, and what they see), with its reason. These become backlog items.
- **Out of scope:** what is deliberately left out, each with the reason and where it went (roadmap, or a non-goal).
- **Core user flows:** the few flows that make up the MVP, step by step in plain words.
- **Hypotheses it tests:** the riskiest hypotheses (`H-NN`) the MVP can test, and how each success metric will be read from it.
- **Product choices still open for building:** whether it uses AI, who can get in, and what it stores. Record what discovery already decided; leave the rest open. Do not force an answer: these are asked when building starts.
- **Assumptions** and **Open questions.**

## Roadmap outline (`<docs>/roadmap.md`)

- **Now:** the MVP, by reference to `mvp.md`.
- **Next:** what follows if the MVP's hypotheses hold, each with the signal that would trigger it.
- **Later:** ideas worth keeping, clearly marked as ideas, not commitments.

## Rules these documents add

- Cut scope before asking for more time: for every in-scope capability ask, "which riskiest hypothesis or success metric needs this?" What needs none moves to Next or Later.
- The MVP must respect every constraint and principle; name the constraint when it removes something.
- Scope in and out is a product decision: ask about the items that are genuinely open, one at a time, and record each decision.
- The roadmap is a discovery document. Once the app is building, the backlog (and the Roadmap list, where the app has that module) replaces it; do not keep both in step.
