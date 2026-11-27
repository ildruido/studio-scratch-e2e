---
name: research
description: Run a research study that answers a product question with evidence - a plan fixed before searching, a two-sided search, graded sources, a skeptic review. Always use it, before looking at any file, when asked to research, check, validate, size or compare something outside the app - do these users have this problem, how big is the market, who are the competitors, compare the app with competitors, a competitive or market analysis, pricing - and to bring in an outside research tool's output.
model: inherit
---

# Research

One procedure for every study. The method, its rules and its reasons are in `.claude/packs/research/FRAMEWORK.md`; this skill is the steps. Product facts (the product, its target users, its principles, its market) come from the app's own documents: the App profile, the PRD and whatever product documents the app keeps. This skill assumes none.

## Pick the branch

A branch adds the standard hypotheses, the source mix, the default tier and the extra outputs for one kind of study. Read **only** the branch that fits, when you reach step 3. A branch never skips a step below.

| The question is about | Branch (in this folder) |
| --- | --- |
| Whether the target group exists, has the problem and how it copes today | [user-reality-check.md](user-reality-check.md) |
| How big the market is (total, reachable, obtainable) | [market-size.md](market-size.md) |
| Who or what the customer uses today: finding and profiling competitors | [competitor-scan.md](competitor-scan.md) |
| How the product compares with competitors, positioning, where it loses | [competitive-analysis.md](competitive-analysis.md) (needs a finished scan; run that first) |
| A source you cannot open, or a second route through a research tool the App Creator runs | [external-research.md](external-research.md) (an addendum to a study) |
| Anything else (pricing, a feature bet, a legal or technical fact, …) | none: the steps below are the whole method |

A request for "market analysis" or "competitive analysis" is a study here, with the branch above. A plugin skill with a similar name, when the session has one, may help present a finished study (a brief, a deck, a spreadsheet); it never replaces the protocol, the evidence log or the skeptic. Without one, the report is the deliverable.

## Steps

1. **Read first:** `.claude/packs/research/FRAMEWORK.md`, the app's decision log, earlier studies on the topic (`docs/research/studies.md`) and the documents the question touches.
2. **Frame.** Write down the decision the study informs and what changes on a yes and on a no. If nothing would change, tell the App Creator and don't run it.
3. **Pick the tier** from the framework's table, by the cost of being wrong. When unsure, take the higher one. A branch's default tier is the starting point: going lower needs a reason recorded in the protocol.
4. **Pre-register.**
   - Take the id and the index row from the script, never by hand: `node .claude/packs/research/studies.mjs add "<study title>" --type "<type>" --tier <light|standard|deep> --fetch`. It prints the id and the study folder.
   - Create `docs/research/R-NNN-<slug>/protocol.md` from `.claude/packs/research/protocol-template.md`:
     - Declared priors: what you already believe and have already seen, and where it comes from.
     - Hypotheses as falsifiable claims, each with its null or strongest alternative and a kill criterion that could really trigger. Ask yourself, "What result would make me say this is false?" If the answer is "nothing realistic", rewrite it. A kill criterion is triggered by evidence, never by finding nothing: "no source found" is Insufficient evidence.
     - Scope, the search plan with neutral and disconfirming queries (at least the tier minimum, and at least as many as the supportive ones), the branch's type-specific checks, and the time box.
   - Deep tier: before that commit, ask the App Creator to approve the kill criteria (one question, with your recommended answer), wait for the answer, and write the approval date and any change they asked for into the protocol.
   - Put the protocol on `main` in its own small PR, **before the first search**: commit `protocol.md` and the index row together and nothing else, open one PR titled `docs(research): R-NNN protocol`, and merge it by the app's normal git rules (where those ask for a backlog id in a `Refs:` line, leave the line out: a study has none). It needs no approval from the App Creator beyond the deep tier's above. Where only the App Creator merges, send the link and wait.
   - Don't search until that PR is merged: its commit on `main`, earlier than the report's, is the proof that the rules came first. A protocol that travels in the report's PR loses that proof when the PR is squashed. Then start the study's branch from the updated `main`.
5. **Search both ways.** Run the plan. Keep queries neutral; never phrase a query so that it assumes the answer. Run the disconfirming queries as a separate contrarian pass, aiming to build the strongest case against each hypothesis. Search for the missing voices the plan names (the quiet, those who quit, tools people abandoned). Stop at the time box and report what was left.
   - A deep-research skill or tool, when the session has one, may help with the search at standard or deep tier. Its output is a list of leads (grade D): every claim you use goes into the evidence log with its original source opened by you. Without one, run the queries yourself.
   - A source you cannot open (a login wall, a blocked site, a closed community) is logged as unverified and named in "What we could not find". If it matters, use [external-research.md](external-research.md).
6. **Log as you go.** Every relevant source goes into the evidence log of `report.md` (from `.claude/packs/research/report-template.md`), against as carefully as for. Exclude only by the protocol's rules, and list what you excluded. If the plan has to change, write a Deviation (date, what, why, effect) in the protocol; never edit the rest of it.
7. **Verify.** Open each source you cite and copy a short quote that supports the claim. Trace statistics to their origin and count shared origins once. Mark anything you can't open as unverified; it carries no weight.
8. **Conclude.** Apply the framework's confidence and verdict rules mechanically, kill criteria first. Write the report: verdict, then the strongest evidence against, then the findings. Use calibrated words; desk research never "validates".
9. **Skeptic review.**
   - **Light:** do it yourself as a separate pass. Re-read only the protocol and the evidence log, follow the steps in `.claude/agents/research-skeptic.md`, and note in the report that it was a self-review.
   - **Standard:** run the `research-skeptic` agent with only the study folder path and the tier. Don't pass it the conversation, the App Creator's hopes or your conclusions.
   - **Deep:** first run an independent replication: a fresh agent gets only `protocol.md` and the framework, is told to open nothing else in the study folder (not `report.md`, not a working file) and to see none of your evidence, and writes its own evidence log and verdicts to `replication.md`. Compare the two runs in the report. Then run `research-skeptic`, which also writes a pre-mortem.
   - Fix or rebut every must-fix item in the report's Skeptic review section. Leave disagreements visible; don't resolve them by deleting them.
10. **Deliver.** Record the verdict in the index: `node .claude/packs/research/studies.mjs verdict R-NNN "<verdict, with the main reason>"`. Open one PR for the study, titled `docs(research): R-NNN <study title>` (the report, its working files, the index verdict and any Deviations in the protocol), and merge it by the app's normal git rules: a study is finished when it is on `main`, and merging it approves nothing, because the decision below is separate. Send the App Creator the verdict, the strongest evidence against and the link, in a few lines. When a verdict rests on sources labelled "accepted, not opened", those words go in the index verdict and in that message too. The App Creator decides; record the decision in the app's decision log with a link to the report, the way the app records decisions (`node .claude/hooks/decisions.mjs add` where the app has that script; never an entry typed by hand there).

## Rules

- Never search before the protocol's own PR is merged. Never edit the protocol after the first search, except its Deviations section.
- Never drop or soften evidence because it is inconvenient.
- A triggered kill criterion forces Reshape or Stop. Only the App Creator can overrule it, and the override is recorded as a decision.
- Don't ask the App Creator about method; decide it and record it in the protocol. Ask only about the decision the study informs, product facts the app's documents don't settle (for example the launch markets, the sizing definition or a minimum threshold), and the kill criteria at deep tier, one question at a time with your recommended answer.
- An unopened source never gains weight silently. The label "accepted, not opened" stays on it in the evidence log, the verdict table and every summary ([external-research.md](external-research.md)).
- Follow the framework's ethics: short quotes with links, no personal details beyond what a claim needs.
