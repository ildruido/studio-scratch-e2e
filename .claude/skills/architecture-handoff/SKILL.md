---
name: architecture-handoff
description: Write the handoff from discovery to building - what the product needs from its architecture, a stack recommendation, an App profile draft and the next steps - then have it independently reviewed. Use near the end of discovery, once the MVP and the constraints are settled, or when the App Creator asks what building will need, how the product should be built, or for the architecture handoff. It recommends; it never chooses the stack or starts the build (new-app does, at "start building").
model: inherit
---

# Architecture handoff

The last document of discovery: everything the people who build the product need from the people who shaped it. Product facts come from the **Discovery profile** in `CLAUDE.md` and the discovery documents; this skill assumes none. `<docs>` is the profile's Docs folder.

First run `node .claude/studio/studio-sync.mjs phase --discovery-only`. If it fails, stop and tell the App Creator what it printed.

## Steps

1. **Read** `.claude/packs/discovery/WORKFLOW.md`, the Discovery profile, every document in `<docs>`, the decision log, and the reports of the studies the documents rely on. Then read what the harness offers: `../app-studio/README.md`, `../app-studio/packs/README.md` and the App profile in this app's `CLAUDE.md` (read only: `app-studio` is never changed from an app). If the MVP or the constraints are missing or exist only in an open PR, say so and recommend finishing them first; go on only if the App Creator prefers to, and list what then rests on assumptions.
2. **Product input for the architecture:**
   - the main capabilities and the things the product keeps track of (its domain objects);
   - the core flows, from the MVP;
   - AI needs, if any: what is generated or judged, what context it needs, what drives its cost;
   - data and files: what is stored, for whom (per person or shared), how large, how sensitive;
   - people and roles: who can get in, and who can do what;
   - integrations with outside services;
   - quality needs: speed, availability, privacy, and the cost ceiling from the constraints;
   - the open technical questions the feasibility hypotheses raise, each with a **spike**: a small, time-boxed trial that would answer it, and what it must show.
3. **Fit with the harness:**
   - which stack pack fits (from `packs/README.md`) and why, with the hosting and running cost it implies; which optional modules the product would use;
   - the gaps: what the product needs that no pack or module provides, and for each whether the app builds it itself or it is worth a `harness-idea`;
   - one alternative you considered and why you do not recommend it.
   This is a recommendation. Say so in the document: the stack question is still asked at "start building".
4. **App profile draft.** Write the rows you can support as `Field=value` pairs, in one code block, exactly as `node .claude/hooks/app-setup.mjs profile set` accepts them (for example `"Stack=.."`, `"User=.."`, `"Capabilities=.."`, `"AI=on"` or `"AI=off"`, `"AI plan=.."`, `"Access model=.."`, `"Storage shape=.."`). Use only the row names of the App profile table in `CLAUDE.md` (the script refuses an unknown field), and word each value the way `packs/README.md` and that table's own hints do. Leave out any row discovery has not decided: an undecided row stays `TBD`, never a guess. Add the proposed Domain rules as a list, drawn from the principles, the domain risks and the constraints. **Do not run `profile set`:** the draft is applied when building starts.
5. **Next steps,** the minimum after "start building": the stack question with your recommended answer, `prd-intake` from `<docs>/mvp.md` and `<docs>/roadmap.md` (the decision log is already the app's log: its entries are not recorded again), the spikes in order, and anything the Admin must set up outside the repo.
6. **Write `<docs>/architecture-handoff.md`** with those four parts, **Assumptions** and **Open questions**. Record the decisions it rests on (the recommended direction, anything the App Creator settled on the way) with `node .claude/hooks/decisions.mjs add .. --fetch`, then commit, so the review has a fixed text.
7. **Independent review.** Start one fresh general agent on the strongest model the session offers, at high effort. Give it only the path of the handoff and the paths of its sources (the files from step 1). Do not give it the conversation, your reasoning, or what the App Creator hopes for. Brief it with exactly this, with the paths filled in:

   > You are reviewing a handoff document cold. You did not write it and have no stake in it. Read only the document at `<path>` and its sources: `<paths>`. Change no file; return your review as text.
   > Check that every claim in the document is supported by a source, that the recommendation follows from the MVP, the constraints and the risks, that the App profile draft and the next steps are consistent with the rest, that costs and limits are stated with their source, and that nothing the sources call open or unproven is presented as settled. Look for what is missing: a capability, a risk, a cost, a spike.
   > Return: (1) findings, each graded critical, important or minor, with the place in the document and the source that supports your point; (2) what you could not verify (for example current prices, terms of service, anything outside the files); (3) one line: sound, sound with fixes, or not sound.

   If the session cannot start a separate agent, do not review your own document and call it independent: write "Independent review: not run" in the section below, with the reason, and tell the App Creator.
8. **Answer the review in the document.** Add a section **Independent review**: the model that reviewed, the date, its one-line verdict, every finding with its grade and either the fix you made or the reason you did not, and the list of what stayed unverified. Each unverified point that matters gets a spike in the next steps. Do not delete a finding you disagree with; answer it.
9. **After the review:** if a finding changed a recorded decision, replace it with `decisions.mjs supersede`. Ask the App Creator about anything still open, one question at a time, with your recommended answer.
10. **Update `<docs>/status.md`** (your row only), **open one PR** titled `docs(discovery): architecture handoff`, and follow the profile's Sign-off mode (`WORKFLOW.md`, "Sign-off").
11. **Tell the App Creator** in a few lines: the recommended direction and its running cost, the review's verdict and what stayed unverified, and the open questions.

## Rules

- The review writes no verdict file and is not the code review: it gates nothing. Its value is the findings, recorded in the document.
- A review cannot check prices, terms or anything outside the files. Never present those as verified; a spike or a study does that.
- Never change the App profile, add a pack or switch the Phase from here.
- Propose a harness gap as a `harness-idea` only in the document; filing it is the App Creator's choice.
