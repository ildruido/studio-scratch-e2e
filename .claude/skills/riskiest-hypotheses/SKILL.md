---
name: riskiest-hypotheses
description: Rank the hypotheses a product idea rests on by how much damage a wrong one does and how unsure we are, and plan a cheap test for each of the riskiest, building on the app's research studies. Use in discovery, before anything is built, when the App Creator asks what the biggest risks or assumptions are, what to validate first, or for the riskiest hypotheses. Not for running a study itself (research).
model: inherit
---

# Riskiest hypotheses

Product facts come from the **Discovery profile** in `CLAUDE.md` and the discovery documents; this skill assumes none. `<docs>` is the profile's Docs folder.

First run `node .claude/studio/studio-sync.mjs phase --discovery-only`. If it fails, stop and tell the App Creator what it printed.

## Steps

1. **Read** `.claude/packs/discovery/WORKFLOW.md`, the Discovery profile, `<docs>/product-foundation.md`, `<docs>/personas.md`, the decision log, the index of studies (`docs/research/studies.md`) and the report of every finished study. Build on them; never redo a study.
2. **Check the evidence base.** The ranking needs a view of the market and of what users do today. If no finished study covers the competitors (a competitor scan) or the market's size where money matters, say which study is missing and recommend running it first with the `research` skill, each as its own study in its own thread (you do not start it: say which study, and hand back if the App Creator agrees). Go on without one only if the App Creator prefers to; every hypothesis that would have rested on it is then marked "no study yet" and counts as highly uncertain.
3. **Extract hypotheses** across four kinds of risk. Write each as a claim that could turn out false:
   - **Value:** the target users want this enough to change what they do today.
   - **Usability:** they can use it without help.
   - **Feasibility:** it can be built and run within the constraints (running costs above all).
   - **Viability:** they will pay, or the product sustains itself some other way.
   Include the assumptions the personas' evidence audit listed and anything the Discovery profile's Domain risks row names.
4. **Rank** by impact if wrong (high, medium, low) and by uncertainty (high, medium, low), from the evidence: a study verdict of Supported lowers uncertainty; Insufficient evidence, Needs primary research or no study leaves it high. Your own confidence is not evidence. Mark the top three to five as riskiest.
5. **Plan a test for each riskiest one:** the cheapest method that could really fail (interviews, a fake-door test, a prototype session, a cost trial, a further study), the signal that counts as pass and the one that counts as fail, as numbers you propose now and whoever runs the test fixes before it starts, and which prototype covers it, if any. A hypothesis a prototype cannot test says so.
6. **Write `<docs>/hypotheses.md`:**
   - the riskiest hypotheses first, in three or four lines a newcomer can follow;
   - the strongest evidence against the product idea, taken from the studies;
   - the table: id (`H-NN`, numbered in this document; never reuse or renumber an id), statement, kind of risk, impact, uncertainty, the evidence it rests on (study id and verdict, or "no study yet"), test, pass and fail signal, status (`untested`, `test planned`, `supported`, `not supported`, `inconclusive`);
   - **Assumptions** and **Open questions.**
   When updating an existing document, change statuses and add rows; a hypothesis that no longer applies is marked `dropped` with the reason, not deleted.
7. **Ask the App Creator** only about the ranking where it turns on what they value, or about what the studies could not settle: one question at a time, with your recommended answer. Record each answer that settles something with `node .claude/hooks/decisions.mjs add .. --fetch`.
8. **Update `<docs>/status.md`** (your row only), **open one PR** titled `docs(discovery): riskiest hypotheses`, and follow the profile's Sign-off mode (`WORKFLOW.md`, "Sign-off").
9. **Tell the App Creator** the top three, the test for each, and which study is still missing, in a few lines.

## Rules

- A hypothesis is never marked `supported` by desk research alone when its study said Needs primary research: it stays `untested` or `test planned`.
- Never soften a hypothesis because the evidence against it is inconvenient. The strongest evidence against goes near the top of the document.
- This skill plans tests; it does not run them. A test that is a study goes through `research`; a prototype goes through `prototype`.
