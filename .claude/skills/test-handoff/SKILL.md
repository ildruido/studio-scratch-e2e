---
name: test-handoff
description: Write the manual test script for the Tester after a release, and turn the Tester's results ("I tested v0.3.0 - step 5 failed") into done items or bug items. Use also when asked what to check on a build before sign-off. Not for cutting the release itself.
model: inherit
effort: low
---

# Test handoff

App-specific facts come from the **App profile** in `CLAUDE.md`; `<XX>` below is its id prefix.

## Part A: write the script

0. **Phase check (before either part).** Run `node .claude/studio/studio-sync.mjs phase --build-only`. If it stops (the App profile's Phase is `discovery`: no stack yet), tell the Tester why in one line and stop; nothing here applies until the app starts building.
1. Collect the items in **To test** in `docs/BACKLOG.md` and their acceptance criteria. If the Tester tests in batches, cover every item still waiting in one combined script.
2. Write at most 7 numbered steps per item, and at most 15 for a combined script, that cover every criterion, in the order a user would do them. Each step has:
   - **Do:** one concrete action in the app, with the exact text to type or button to press.
   - **Expect:** what the Tester should see. Concrete and visible, never "it works".
3. Start with how to reach the build under test: the release target (or preview target) link from the App profile, the version the Tester should see, and any step the stack notes say must come first (for example a manual deploy).
   Name only the targets where the change can be seen. When an app ships to several targets (for example an artifact and a web app) and the change shows in only one, test only that one, and say in one line that the others got the same release with nothing new to check. Don't list their links as things to test.
4. Mention any one-time consent prompt the Tester will see, and say whether to allow it.
5. End with: "Reply with the step numbers that failed and what you saw. A screenshot helps."
6. Run `node .claude/hooks/handoff.mjs lint <script.md>` (or `-` for stdin) before posting: it checks the 7-per-item and 15-in-all limits, a Do and an Expect in every step and the closing line, and lists what to fix. Write the script in plain English, no technical terms, and put it in full in your own thread message (the App Creator reads it there; the coordinator only points to the thread) and in the PR description. If the Tester is not in the Project, the App Creator asks for a pasteable copy and the coordinator posts it in full. Also commit it as a file when it is longer than about 15 lines, but never hand back only a pointer to a file or `docs/BACKLOG.md`. Outside a Project, post it in chat.

## Part B: process the results

1. For each step the Tester reports as passing, tick its criteria in `docs/BACKLOG.md`. When all criteria of an item pass, run `node .claude/hooks/backlog.mjs done <id> <version>`: it moves the full item to the top of `docs/BACKLOG-DONE.md`, leaves only its title line under **Done** and removes its id from the **Roadmap** list (with the `roadmap` module). It refuses an item with an unticked criterion.
2. For each failure, create a bug item at the top of **Ready** with `node .claude/hooks/backlog.mjs add <XX> "Bug: what the user sees" --bug --found-in "vX.Y.Z, step N" --steps "…" --expected "…" --actual "…"` (with the `roadmap` module add `--lane`). It writes this template with the next free id:

   ```md
   ### <XX>-0NN Bug: what the user sees
   - Found in: vX.Y.Z, step N of the test script
   - Steps to reproduce: …
   - Expected: … / Actual: …
   - Acceptance criteria:
     - [ ] The failing step now shows the expected result
     - [ ] A regression test covers it
   ```

   Each bug is built in a new thread that reads the original item and its PR.
3. If a report is unclear, ask the Tester one specific question instead of guessing.
4. Commit with `docs(backlog): record test results for vX.Y.Z`, merge it via a PR (CLAUDE.md "Git workflow"), and tell the Tester what moved to Done and which bugs are next.
