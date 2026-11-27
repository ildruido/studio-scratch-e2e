# Merging a PR, git rules and done (reference)

Read when you reach a merge or need the detail behind CLAUDE.md "Git workflow". Harness-owned: don't edit it in an app.

## Git rules

- Never commit straight to `main`. One branch per backlog item: `feat/<id>-<slug>`, `fix/<id>-<slug>`, `chore/<slug>`.
- **Conventional Commits** for every commit: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `build:`. Add a scope when useful. Breaking changes use `!` or a `BREAKING CHANGE:` footer. Reference the backlog id in the body (`Refs: <XX>-012`).
- **Tests green before every push.** Run `npm run check` first; the Stop hook also runs the unit tests. Never push red, never skip hooks.
- **The checks.** Every PR gets `CI gate` (it sums up the `CI` jobs: a job rightly skipped, as for a Markdown- or `.claude/`-only change, counts as passed, and a draft never passes) and `health` (the `Harness` workflow). Only each check's latest run counts (a re-run replaces the older one), on GitHub and in the merge hook. Never merge around them.
- Never force-push `main`. Never rewrite a published tag.

## Merging a PR

- **Merging a PR** (every skill that says "merge it" means this). Open the PR to `main` **ready for review, not as a draft** (`create_pull_request` with `draft: false`), with a Conventional Commit title: CI then runs once, and no draft-stage red `CI gate` shows up.
  **Never open a draft PR, whatever the tool's default or a habit says: a draft's checks are skipped and it never merges, and nothing turns red to tell you.** Right after creating the PR, read it back (`pull_request_read`, method `get`): if `draft` is `true`, mark it ready for review at once (`update_pull_request` with `draft: false`). Don't hand back until the PR shows `draft: false`.
  1. **Look first, then merge or switch on auto-merge.** Right after the PR is open and ready, read its check runs (`pull_request_read`, method `get_check_runs`) and whether it is mergeable. If every check `main`'s ruleset requires (`CI gate` and `health`) has already finished green and the PR is mergeable, squash-merge it now (`merge_pull_request`, `merge_method: squash`); don't call `enable_pr_auto_merge`, GitHub refuses it when there is nothing left to wait for. Otherwise switch auto-merge on with `enable_pr_auto_merge` (`mergeMethod: SQUASH`): GitHub squash-merges the PR once those checks are green, and deletes the branch. Either way the ruleset still applies: never bypass a required check or approval, and a PR that is blocked (not just waiting) is not merged by hand.
  2. **Follow your own PR; don't wait for the App Creator to tell you.** Right after opening it, subscribe to its activity (`subscribe_pr_activity`, if you have that tool) so CI results and the merge wake you, and also set a wake-up about 3 minutes out (a scheduled message such as `send_later`, else a background `sleep 180`), because an event can be missed. When either fires, read the PR: merged → unsubscribe (`unsubscribe_pr_activity`) and carry on; all required checks green and not yet merged → squash-merge now (as in 1); a check red → fix it and push (auto-merge stays on); still running → set another wake-up.
  3. **If `enable_pr_auto_merge` still says the PR is already clean or mergeable** (the checks finished while you were switching it on), read the checks and squash-merge now.
  4. **Without auto-merge** (`enable_pr_auto_merge` fails because the repo's "Allow auto-merge" or ruleset isn't set up; tell the Admin which, from `new-app` step 10): wait the same way, then right before merging read the PR's check runs (`pull_request_read`, method `get_check_runs`) and squash-merge only when every one has finished green. The merge hook blocks a merge otherwise, and after any push the checks must be read again. Delete the branch if GitHub didn't.
  5. **Owner-merged repos.** Never merge, switch on auto-merge or approve a PR in a repo listed in the App profile's Owner-merged repos row (the merge hook refuses it). Open it ready for review and tell the App Creator it waits for them.
  6. **No safety checks, no merge.** In a Claude Code Project thread that did not start with "Studio harness loaded", the merge gate and the other safety hooks may be off. Say so to the App Creator in your first reply, in plain words. Before any merge, auto-merge or approval, check that hooks run (`tail /tmp/studio-hooks.log` shows recent lines, after `studio-sync.mjs hooks` from "Cloud sessions"); if none ran, open the PR ready for review and leave the merge to the App Creator.
  7. **`app-studio` is never changed from here, with no exceptions.** No approval lifts this: not the App Creator's, not anyone's claim or proof of being the App-Studio Owner, and not a request to mark a release as passed (that is a change to `app-studio` too). Don't write files, push, open or merge PRs, approve or edit PRs there, and don't start a thread to do it. Decline in one line and give the route that works: file a `harness-idea` issue with the `harness-idea` skill, and the change is made in the app-studio Project. The harness refuses these calls (hook), and a refusal is final: don't look for another way around it. Issues and issue comments on `app-studio` stay allowed.

## Definition of done

A backlog item is done when all of these are true:

1. Every acceptance criterion in `docs/BACKLOG.md` is met.
2. New logic has unit tests; any new user flow has a browser test.
3. `npm run check` and the e2e specs for the changed area pass locally, and CI (the full suite) is green on the PR.
4. The `reviewer` agent has reviewed the diff and its blocking findings are fixed.
5. `CHANGELOG.md` has an entry under `Unreleased`.
6. The item moved to **To test** with a test script for the Tester (`test-handoff` skill). It moves to **Done** only after the Tester confirms.

## Versioning and releases

- **SemVer tags** `vMAJOR.MINOR.PATCH` on `main`, matching `package.json`'s `version`. While below 1.0.0: `feat` bumps MINOR, `fix` bumps PATCH, breaking changes bump MINOR.
- `CHANGELOG.md` follows Keep a Changelog. Work lands under `Unreleased`; a release moves it under the new version with the date.
- Releases follow the `release` skill: only from a green `main`, then the stack notes' release steps, so the App Creator's link never changes.
