# Discovery exit criteria (default list)

Discovery is ready to hand over to building when each criterion is `done`, or the App Creator has decided to go on without it (a recorded decision). The `exit-gate` skill scores them; `status.md` in the docs folder tracks them between runs. An app may drop or add criteria in its Discovery profile (Exit criteria row); the numbers below never change, so a dropped number stays unused.

| # | Criterion | Done when | Usually proven by |
| --- | --- | --- | --- |
| 1 | Product foundation | The problem, target market, vision, value proposition, key concepts and principles are written and approved (see below) | `product-foundation.md` |
| 2 | Target users and personas | A user reality check has a verdict in the index of studies (a Reshape or Stop verdict also has the App Creator's recorded decision), and the personas pass the evidence audit | the study's report, `personas.md` |
| 3 | Riskiest hypotheses | Hypotheses are ranked on evidence, and each of the riskiest has a test with a pass and fail signal | `hypotheses.md` and the studies it links |
| 4 | Success metrics | One main metric, supporting metrics and early signals for the MVP, each with a definition, a target and how it is measured | `success-metrics.md` |
| 5 | Constraints and non-goals | Budget, people, time, legal, platform and running-cost limits are stated, and the non-goals are listed | `constraints.md` |
| 6 | MVP and roadmap | The MVP's scope (in and out), its core flows and the assumptions it tests are approved, and the roadmap follows from it | `mvp.md`, `roadmap.md` |
| 7 | Prototype | At least one prototype shows the concept, and its index row says what it proved, what it did not, and what was learned | `prototypes.md` |
| 8 | Architecture handoff | The handoff is written and independently reviewed, with every finding fixed or answered and the unverified points listed | `architecture-handoff.md` |
| 9 | Decision log | Every product decision made on the way is in the decision log | the decision log |

"Approved" means the document is on `main`: under Sign-off mode `per artifact` it was merged only after the App Creator's approval, and under `autonomous with record` merging it with its line in `status.md` is the approval.

There is no sign-off criterion: the App Creator's "start building" is the sign-off.
