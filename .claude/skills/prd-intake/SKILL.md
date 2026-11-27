---
name: prd-intake
description: Capture what the App Creator describes as PRD changes and backlog items with acceptance criteria. Use for new feature ideas, complaints, spec documents they share, and open product questions ("should the app use AI?", "how should X work?"). Writes no code; a ready backlog item or a bug to fix goes to build-feature.
model: inherit
---

# PRD intake

The App Creator describes outcomes in plain words, or hands over a document that already describes them: a spec or PRD (for example from `product-management:write-spec`), a Google Doc or Claude Doc link, or discovery docs in the repo (an MVP definition, a roadmap, a decision log). Your job is to turn either into precise, testable work without making the App Creator write a spec. App-specific facts come from the **App profile** in `CLAUDE.md`; `<XX>` below is its id prefix.

**From a document:** read all of it first (a Google Doc through the Drive connector, a Claude Doc with the docs tools, a repo file directly). Treat it as the App Creator's request: map its sections to the PRD's, its requirements to backlog items, its decisions to the app's decision log with `node .claude/hooks/decisions.mjs add` (App profile, Decision log row; PRD "Decisions" by default), citing the source, and its priorities to the Roadmap list. Don't copy it wholesale; the PRD stays short and links the source. Questions it leaves open, and places where it contradicts the PRD or the rules, go through step 3 like any other question.

**From the discovery module's documents** (its `mvp.md` and `roadmap.md`, usually at "start building"): read `${CLAUDE_SKILL_DIR}/from-discovery.md` and follow it with the steps below. While the app is still in discovery with that module (`.claude/packs/discovery/` exists), those documents are the plan: write no PRD or backlog yet, and take a new idea to the discovery document it changes (`.claude/packs/discovery/WORKFLOW.md`).

## Features (only when needed)

If the App profile's **AI**, **Access model** or **Storage shape** row is blank, `TBD` or a placeholder, or AI is on, anyone can get in and **AI public use** is undecided, read `${CLAUDE_SKILL_DIR}/features.md` and answer those questions with the App Creator before any backlog item. If all three are filled, skip it. A static site has them filled already.

## Steps

1. **Read the current state.** Open `docs/PRD.md` and `docs/BACKLOG.md`. Ids follow the rule in `CLAUDE.md` ("Backlog ids"): use the ids the coordinator gave you; if none, `add` below takes the next free one after `git fetch`, looking at this checkout and every remote branch (`node .claude/hooks/backlog.mjs next <XX> --fetch` shows it). Check again right before you open the PR.
2. **Restate the request** to yourself as: who (the App profile's User), what they want to do, why it matters. Find the PRD section it belongs to, or decide it needs a new one.
3. **Check for ambiguity.** List the open product questions (behavior, scope, priority), not technical ones. Technical choices are yours.
   - If a question would change what gets built, ask the App Creator. Ask one question at a time, each with a recommended default and one line on why (the Features questions above are the exception: they get a recommendation only as described there, never a preselected answer).
   - Otherwise pick the sensible default and record it with `node .claude/hooks/decisions.mjs add "<title>" --decision ".." --why ".." --by ".." --fetch` (it takes the next free `D-NNN` across every branch; to replace an earlier one use `supersede <id> ..`). The log is the App profile's Decision log row, PRD "Decisions" by default.
4. **Check against the rules.** Check the request against the App profile's domain rules and the runtime rules in `CLAUDE.md` (capabilities, and the AI plan and its costs when the App profile says AI is on). If the request breaks one, say so and propose an alternative.
5. **Update `docs/PRD.md`.** Edit the relevant section, keep it short, add the request to "Change log" with today's date.
6. **Write backlog items** in `docs/BACKLOG.md`, one per independently testable slice. Add each with `node .claude/hooks/backlog.mjs add <XX> "<title>" --why "<one sentence>"` (add `--lane now|next|later` when the app has the `roadmap` module; with ids from the coordinator, add by hand instead). It writes the template below with the next free id and puts it under **Backlog**; you then fill in the criteria and notes:

   ```md
   ### <XX>-0NN Title in plain words
   - Why: one sentence of user value
   - Acceptance criteria:
     - [ ] Given …, when …, then … (observable in the app)
   - Notes: technical hints, dependencies (<XX>-0xx), capability changes
   ```

   Keep each item small enough to build in one session. Every criterion must be something the App Creator can see and check.
7. **Place the items.** If the app has the `roadmap` module (`.claude/packs/roadmap/` exists), every new open item must be in the **Roadmap** list at the top of `docs/BACKLOG.md` (`add --lane` does it; `node .claude/hooks/backlog.mjs roadmap-add <id> now|next|later` for an item already there; Now / Next / Later, the script creates the section if missing: `## Roadmap` with `- **Now:**`, `- **Next:**`, `- **Later:**` lines); `npm run roadmap:check` fails otherwise. Without the module there is no Roadmap list and nothing to place; on a new app, offer the module as a process choice (a prioritised Now / Next / Later list kept honest by a check; recommended when the backlog will grow beyond a handful of items) and add it with `pack add roadmap` only if the App Creator says yes. New work goes into **Backlog**. Move it to **Ready** only when it has no open questions. Keep the App Creator's existing order; put urgent bugs at the top of Ready and say so.
8. **Commit** on a `docs/<slug>` branch (the session branch in a cloud session) with `docs(prd): …`, and merge it via a PR (CLAUDE.md "Git workflow"): a Markdown-only change still gets `CI gate` and `health`, which must pass.
9. **Reply to the App Creator** with: the items created (id + title), any decision you made on their behalf, and any question that still needs an answer.
