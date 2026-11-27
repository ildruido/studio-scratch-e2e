---
name: release
description: Ship a new version of the app to testers - cut a SemVer release from a green main (bump version, CHANGELOG, tag, build) and publish or deploy it to the release target, e.g. "publish the new version to the artifact link", "push it to the preview". Use when work under Unreleased should reach the App Creator or Tester.
model: inherit
effort: low
---

# Release

Never release from a branch or a red `main`. The build and ship steps depend on the stack: they come from the **stack notes** in `CLAUDE.md`'s App profile and from `RELEASE.md` in each installed pack (`.claude/packs/<name>/`).

## Steps

0. **Phase check.** Run `node .claude/studio/studio-sync.mjs phase --build-only`. If it stops (the App profile's Phase is `discovery`: no stack yet), tell the App Creator why in one line and stop (`release-cut` below says the same); nothing here applies until the app starts building.
1. **Preconditions.** Latest CI run on `main` is green. CI on `main` runs only the quick checks after a merge (the PR ran the full suite), so start the full suite on `main` before releasing: run `CI` with `workflow_dispatch` (Actions > CI > Run workflow, or the `actions_run_trigger` tool) and wait for it to pass. Skip this if the last code change on `main` already had a manual full run. The rest of the preconditions are checked by `release-cut` in step 3.
2. **Pick the version.** Run `node .claude/studio/studio-sync.mjs release-prepare` (a dry run: it changes nothing). It reads the commits since the last tag and proposes the bump (below 1.0.0: `feat` or breaking → MINOR, only `fix`/`perf` → PATCH; from 1.0.0: breaking → MAJOR, `feat` → MINOR, else PATCH), refuses a tag that already exists, and says when nothing user-facing changed (`docs`/`chore`/`ci`/`test` only: no release; tell the App Creator). The version is still your call: agree it, or pick another.
3. **Cut the release.** Run `node .claude/studio/studio-sync.mjs release-cut --version X.Y.Z`. It stops, changing nothing, and says why when the release gate does, the tree isn't clean, or `CHANGELOG.md` has no `Unreleased` entries: for a gate stop read `${CLAUDE_SKILL_DIR}/gates.md`; fix the cause, or tell the App Creator why, and run it again. Otherwise it does steps 3 to 5: the branch `chore/release-vX.Y.Z` (the session branch is kept in a cloud session),
4. the version in `package.json` and the lockfile (`npm version X.Y.Z --no-git-tag-version`),
5. and the changelog: the `Unreleased` entries move under `## [X.Y.Z] - YYYY-MM-DD`, an empty `## [Unreleased]` stays, and the compare links are fixed. It never commits. Read the new section and tidy only the wording.
6. **Verify.** `npm run check` passes. No local e2e: only the version and notes changed, and `main` passed the full suite in step 1. CI sees a version-only change and skips the browser tests too.
7. **Commit and merge.** `git commit -am "chore(release): vX.Y.Z"`, push, and merge it (CLAUDE.md "Git workflow"). Step 8 starts once it has merged.
8. **Tag main.** The `Release tag` workflow (`.github/workflows/release-tag.yml`, from the base or static-site pack) tags the merged release commit `vX.Y.Z` and creates the GitHub release from the changelog section. Wait for its run on `main` to pass, then run `node .claude/studio/studio-sync.mjs release-tag-check X.Y.Z`: it exits 0 once the tag is on `origin`. Never move or delete an existing tag. **Only if the app has no such workflow** (older apps): the same command prints the by-hand steps; read `${CLAUDE_SKILL_DIR}/gates.md`, "No tag workflow".
9. **Build and ship** from the tagged commit, following the stack notes' **Release** steps and each pack's `RELEASE.md` exactly (build command, size limits, where it is published, which link must stay the same). If the release adds or removes a capability, ship the new set and say so in step 11.
10. **Preview target too,** if the App profile has one and the stack notes say to refresh it on release. Never send the App Creator a script for the preview before it is refreshed, and give both links.
11. **Release notes.** The `Release tag` workflow already made the GitHub release. Without the workflow: `gh release create vX.Y.Z --notes-file …` once the tag exists; in a cloud session note it next to the pending tag.
12. **Tell the App Creator** in plain words what changed for the user, where it shows, the link, the version shown in the app, and any new consent prompt or manual step. Every target is published on every release, but give only the links where the change can be seen; say in one line which targets have nothing new. Then run `test-handoff` (or hold the script if the App Creator tests in batches); in a Project the script reaches the App Creator through the coordinator in the Project chat.
