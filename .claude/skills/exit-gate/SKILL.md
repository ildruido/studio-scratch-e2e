---
name: exit-gate
description: Score the discovery exit criteria against what the repo really holds and report what is done, partial or missing, with the next one or two steps. Use in discovery when the App Creator asks where discovery stands, what is left before building, or whether the app is ready to start building. It only reports - it never ends discovery; the App Creator's "start building" does that (new-app).
model: inherit
---

# Exit gate

A report, not a switch. It scores, writes the report and says what is left. It never changes the App profile's Phase, never adds or removes a pack, and never starts the build setup: when the App Creator then says "start building", that is the `new-app` skill.

Product facts come from the **Discovery profile** in `CLAUDE.md`; this skill assumes none. `<docs>` is the profile's Docs folder.

First run `node .claude/studio/studio-sync.mjs phase --discovery-only`. If it fails, stop and tell the App Creator what it printed.

## Steps

1. **Build the list of criteria:** the default list in `.claude/packs/discovery/exit-criteria.md`, changed by the Discovery profile's Exit criteria row (criteria dropped, criteria added). A dropped criterion is listed as `dropped` with the reason the row or the decision log gives; an added one is scored like the others.
2. **Read the evidence, not the tracker:** every file in `<docs>`, the index of studies and the reports the documents rely on, the decision log (`node .claude/hooks/decisions.mjs list`), and the open pull requests. `<docs>/status.md` is a claim to check, never the proof.
3. **Score each criterion** `done`, `partial` or `missing` against its "Done when" column, with the file (or PR) that proves it and what is left:
   - A document that exists only in an open PR is `partial`.
   - A document whose own Open questions or Assumptions leave its "Done when" unmet is `partial`: name the question.
   - Approval needs no separate proof: a document on `main` counts as approved. Under Sign-off mode `per artifact` it was merged only after the App Creator approved it; under `autonomous with record` merging it, with its line in "Steps taken without sign-off", is the approval.
   - Criterion 8 is `done` only if the handoff has its Independent review section, with every finding fixed or answered.
   - Criterion 9: every product decision the documents mention is in the decision log. Name any that is not.
4. **Check consistency across the documents** and list every mismatch:
   - the MVP serves the primary persona and respects every constraint and principle;
   - the success metrics can be read from what the MVP includes;
   - each riskiest hypothesis has a test, or a prototype that covers it, and none is called supported beyond what its study or test showed;
   - the handoff's App profile draft and stack recommendation match the MVP and the constraints;
   - no document relies on a study verdict that was later changed or superseded.
5. **Write `<docs>/exit-gate.md`:** the date; one line of result ("ready", or "not ready: N of M criteria done", where M leaves out the dropped ones); the table (criterion, score, proof, what is left); the mismatches; what you could not check; and the next one or two steps, most valuable first. Bring `<docs>/status.md` in line with the scores: this skill is the one that may correct any row (`done` stays `done`, `partial` is `in progress`, `missing` is `not started`), and say in your message which rows you corrected.
6. **Open one PR** titled `docs(discovery): exit gate report`, through the app's normal git rules, and merge it when the checks are green (a report needs no sign-off).
7. **Tell the App Creator** the result in a few lines: what is done, what is missing, the next one or two steps. If every criterion is `done` or `dropped`, say discovery is ready and that building begins when they say "start building". Do nothing more.

## Rules

- Score what is there, not what was intended. When in doubt between two scores, take the lower and say why.
- Never mark a criterion `done` because the App Creator seems keen to move on. They may go on with gaps: that is their decision, taken when they say "start building", and this report is what they decide on.
- Do not fix the gaps in this run. Report them; each gap is its own document or study in its own thread.
