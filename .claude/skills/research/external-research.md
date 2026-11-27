# Branch: outside research tool

Use it when a study needs a source you cannot open, or when a second, independent route is wanted: a research tool the App Creator runs themselves and whose output they hand back. It is an addendum to an existing study (its protocol is already on `main`), not a study of its own. It adds to the research skill's steps and removes none.

The risk it guards against: sources nobody on the study opened quietly counting as evidence. The label below must survive into every summary.

## Steps

1. **Write a neutral prompt** and save it as `external-prompt.md` in the study folder. It states the questions, the scope and the pre-registered kill criteria. It does **not** state the hoped-for answer, the product pitch or the study's current verdict. It asks the tool to list, for each claim, the source, its date and a quoted passage, and to search for evidence against as well as for.
2. **Hand it over.** Give the App Creator the prompt as copy-ready text and one line on where to run it (a research tool of their choice). Ask for the result **pasted back as text or as an exported file, never as a share link**: a link to someone's session usually cannot be opened from here. If only a link arrives, say so and ask for the text; don't guess what it says.
3. **Save the raw output** unchanged as `external-output.md` in the study folder (or the exported file beside it), with the date and how it was produced, as the App Creator describes it. Never edit it afterwards.
4. **Log every source the output names** in the report's evidence log, marked "from the outside tool":
   - Try to open each one. Opened and it says what was claimed: grade it by the framework like any source, Opened `yes`, with your own quote.
   - Opened and it does not say it: unverified, no weight, and note the mismatch.
   - Cannot be opened: Opened `no (unverified)`, graded as the tool describes it, **no weight**.
   - The tool's own summary sentences are grade D leads, never evidence.
5. **If the App Creator wants unopened sources to count,** that is their decision, not a method choice: ask once, with your recommendation, and record the answer in the app's decision log (`node .claude/hooks/decisions.mjs add` where the app has that script). Sources they accept are marked Opened `no (accepted, not opened)`. From then on the words **"accepted, not opened"** stay with those sources and with any verdict that rests on them: in the evidence log, the verdict table, the report's first paragraph, the index row and every message or document that summarizes the study. An accepted source never raises confidence above medium on its own.
6. **Re-evaluate and show what changes.** Add an **Outside research addendum** section to the report: the prompt and output files, a table of every source with its status (opened, unverified, accepted and not opened), each hypothesis's verdict and confidence **before**, **after with opened sources only**, and **after including accepted ones**, and one explicit sentence: the study verdict changed, or it did not. Log the addendum as a Deviation in the protocol (date, what, why, effect).
7. **Skeptic pass.** Run the review again at the study's tier on the addendum (the `research-skeptic` agent for standard and deep), asking only whether any verdict should move. Record its answer in the report's Skeptic review section.
8. **Commit and deliver.** Commit the prompt, the raw output and the changed report and protocol together. They go in the study's PR when it is not merged yet; otherwise in one new PR titled `docs(research): R-NNN outside research addendum`, merged by the app's normal git rules. Then deliver as in the research skill's last step, with the label in the summary when it applies, and update the index verdict if it changed.

## Done when

The addendum lists every source the output named with its status, says in one sentence whether the verdict changed, and no summary anywhere states a verdict that rests on unopened sources without the words "accepted, not opened".
