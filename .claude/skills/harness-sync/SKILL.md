---
name: harness-sync
description: Pull released app-studio updates into this app - update the harness, add or remove a stack pack or module ("add the web pack"), or act on a start-up warning that the harness is behind. Not for old hand-built apps (migrate-app). Never changes app-studio itself.
model: inherit
effort: low
---

# Harness sync

`app-studio` holds the master copy of the shared skills, agents, hook script and stack packs. Each app carries a copy pinned in `.claude/studio/lock.json` (studio version plus a hash per file). `.claude/studio/studio-sync.mjs` compares the two; it looks for `app-studio` in `--studio <dir>`, then `$STUDIO_DIR`, then a sibling `../app-studio` checkout, then any sibling folder that is an app-studio checkout (cloud sessions clone attached repos side by side).

## Pull updates into an app (part A)

1. `node ../app-studio/scripts/studio-sync.mjs sync --app .` (the master script, so a newer copy rule applies on the first pull). It brings the app-studio checkout up to date with its `main`, updates the managed files and the lock, adds missing template wording to `CLAUDE.md` (the Decision log row, the "say plainly what you did not check" line; app text is never replaced), runs `health` and prints the short release report and the commit line. To see first what a sync would do, changing nothing in the app: the same command with `--dry-run`.
2. If it stops with "not live-checked yet", a release between this app's version and the newest one still has `status.main: pending` in `app-studio`'s `releases/` (`node ../app-studio/scripts/release.mjs pending` lists them): nothing was changed; tell the App Creator and stop. Never work around it, never pass `--live-check` (only the studio-scratch check does).
3. If it stops on **skipped** files, each is a local change that never reached `app-studio`. Send it as an idea (`harness-idea` skill) if it would help every app, or move it to the App profile if it was app-specific; then run `sync` again with `--force` to restore the shared version.
4. If it stops on `health`, fix what it reports (the commit hook blocks the commit otherwise) and run `node .claude/studio/studio-sync.mjs health` again.
5. **Pack starter files** held back or "edited here": read `${CLAUDE_SKILL_DIR}/sync-notes.md`, part 5, and follow it.
6. `sync` prints a short report from the release records: one line per release (version, summary, linked issues and PR) and a "Needs you" part. Do not read the changelog or any release file yourself. Apply each **App action** it lists (for example a new App profile field or a settings change). An **Admin action** is not yours to do: relay it to the App Creator (or, in a Project, the coordinator) as exact, copy-ready steps, and say in the sync summary that it is pending. Give the App Creator the release lines as they are, no retelling. Only if asked for more about one release: `node ../app-studio/scripts/release.mjs details X.Y.Z`. To print the report again: `node ../app-studio/scripts/studio-sync.mjs changelog --app .` (add `--since X.Y.Z` for another starting version). If the report ends with "Large jump" (the app skipped many releases): read `${CLAUDE_SKILL_DIR}/sync-notes.md`, part 9, before you commit.
   Then look for this app's own ideas that got fixed: closed issues on `app-studio` whose body names this app, with the label `harness-idea` or `studio-backlog`. Their closing comment names the release. Say in the sync summary which of this app's ideas were fixed and in which release, and which were declined (and why).
7. **Project instructions.** If the output says "Project instructions template changed": read `${CLAUDE_SKILL_DIR}/sync-notes.md`, part 7, and follow it.
8. Commit `chore(harness): sync studio vX.Y.Z` (the line `sync` printed) and merge it via a PR (CLAUDE.md "Git workflow"). Only `.claude/` changed, so `CI gate` passes quickly and `health` checks the harness.

An app set up before the harness had modules or a lock is not a plain sync: use the `migrate-app` skill, which starts with `studio-sync.mjs inventory` and the App Creator's OK on a plan.

## Add a stack pack to an existing app

Read `${CLAUDE_SKILL_DIR}/add-pack.md` and follow it.

## Changing the harness itself

Never from an app. If the harness needs to change, send a `harness-idea` (the `harness-idea` skill). Changing app-studio happens only in the app-studio Project, as `docs/GOVERNANCE.md` in the app-studio repo says.
