---
name: prototype
description: Build a quick, throwaway clickable mock-up of one product flow to show the concept and test hypotheses before anything real is built - sample data, no repo code, no tests, an index row per version. Use in discovery when the App Creator asks for a prototype, mock-up, concept screen or clickable demo, wants the next version after trying one, or rejected one and wants different design directions to choose from. Never for building or changing the app itself (build-feature).
model: inherit
---

# Prototype

A prototype exists to show the concept and to test hypotheses. It is not the product and never becomes it: no tests, no harness, no code in `src/`, nothing a later build starts from.

Product facts come from the **Discovery profile** in `CLAUDE.md` (principles, prototype look and feel) and the discovery documents; this skill assumes none. `<docs>` is the profile's Docs folder.

First run `node .claude/studio/studio-sync.mjs phase --discovery-only`. If it fails, stop and tell the App Creator what it printed.

**If a prototype was rejected, or the App Creator asks for different directions to choose from,** do not build another version yet: read [design-alternatives.md](design-alternatives.md) and follow it instead of the steps below. A look that is simply not set yet is not that case: step 3 asks one question about it.

## Steps

1. **Read** the Discovery profile, `<docs>/prototypes.md` (earlier versions and what they taught), `<docs>/hypotheses.md` and `<docs>/mvp.md` if they exist.
2. **Pick the flow and state its purpose** before building: the one user flow, the hypotheses (`H-NN`) it **can** test, and what it **cannot** test. A mock-up with canned content can test whether the flow is understood and wanted; it cannot test output quality, real performance, cost or demand. If the App Creator named no flow, recommend the one behind the riskiest hypothesis a prototype can test. If there is no hypothesis list yet, state in plain words what the prototype can show, and say in the index row that no hypothesis list existed.
3. **Design.** Follow the profile's Principles and Prototype look and feel; if that row is `not set yet`, ask the App Creator one question about the look (with a recommended answer) and record it in the profile (`node .claude/hooks/app-setup.mjs discovery-profile set "Prototype look and feel=.."`). Use sample data that feels real to the target users. A front-end design skill may help when the session has one.
4. **Build one self-contained page:** phone-first unless the profile says otherwise, clickable end to end for the one flow, with everything the real product would compute (AI output, sign-in, payments, saved data) faked with canned results. Screens beyond the MVP are visibly marked "later", so nobody reads them as scope.
   - Publish it as a private Artifact when the session can (the App Creator opens it by link, also on a phone). Otherwise save it as one HTML file in `<docs>/prototypes/`; the index link is then the file's path, and the hand-over says how to open it (download the file from the PR and open it in a browser) and that a phone needs the published route.
   - It is never the app's page: not in `src/`, not built by `npm run build`, not released.
5. **Check it yourself** as far as you can (open it, click through the flow at phone width) and note what you could not check.
6. **Index it.** Add a row to `<docs>/prototypes.md`: name and version, link, flow, can test, cannot test, date, outcome `awaiting review`, and "What we learned" empty.
7. **Update `<docs>/status.md`** (your row only), **open one PR** titled `docs(discovery): prototype <name> <version>`, and follow the profile's Sign-off mode (`.claude/packs/discovery/WORKFLOW.md`, "Sign-off").
8. **Hand over** the link with two or three things to try and one question about it. Say plainly what is faked and what was not checked (for example "not tried on a real phone", "no target user has seen it").
9. **Learn** (when the App Creator, or a target user through them, has tried it): fill in "What we learned" and set the outcome to `confirmed` (the direction holds), `extended` (the next version builds on it) or `closed` (rejected, with the reason). Update the status of the hypotheses it tested in `<docs>/hypotheses.md` and record any decision with `node .claude/hooks/decisions.mjs add .. --fetch`. The next version is a new row, never an edit of an old one. If it was rejected, go to [design-alternatives.md](design-alternatives.md) before building again.

## Rules

- One flow per prototype. A request for "the whole app" becomes the flow behind the riskiest hypothesis, with the rest marked "later".
- Canned content is never evidence of output quality, and a liked mock-up is never evidence of demand. The index row says so in "Cannot test".
- The App Creator's opinion of a prototype is one data point. If a hypothesis needs target users, say so and plan that test in `<docs>/hypotheses.md`.
- No personal data and no real names of people in sample data.
