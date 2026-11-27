# Harness, CI and cloud sessions (reference)

Read when you reach a harness, CI or cloud-session question. Moved out of CLAUDE.md so every session doesn't pay for it. Harness-owned: don't edit it in an app.

## Harness

- Shared harness, copied from `app-studio` (the master copy) and pinned in `.claude/studio/lock.json`: skills `prd-intake`, `build-feature`, `test-handoff`, `release`, `new-app`, `harness-sync`, `harness-idea`, `migrate-app`; agents `planner`, `reviewer`, `qa`; hook scripts `.claude/hooks/check.mjs`, `.claude/hooks/cloud-setup.mjs` and the git hook `.claude/hooks/pre-commit`; and the stack packs' docs in `.claude/packs/`. Anything app-specific goes in the App profile above.
- **The harness changes only in `app-studio`'s own Project or session, never from this app's work.** Don't edit these files here and don't change `app-studio` from here: send ideas with the `harness-idea` skill (it opens an issue on app-studio), and pull released changes with the `harness-sync` skill when the App Creator asks.
- A stack pack's starter files (CI workflow, configs, server, platform adapters) were copied in once and are this app's own code. When `app-studio` improves one, the session-start check says so; merge it by hand and run `node .claude/studio/studio-sync.mjs ack`.
- Hooks in `.claude/settings.json`: ESLint on every edited TS/JS file, and again when a turn ends on every TS/JS file changed since the last push (so files written by shell commands are linted too), unit tests when a turn ends, a harness sync warning when a session starts, a harness health check before every `git commit` (`node .claude/studio/studio-sync.mjs health`: shared files unedited, this App profile filled in, hooks wired, the app's own skills and agents well formed, doc links working, the `Harness` workflow present), a merge gate on the GitHub merge tool (blocks until the PR's checks were read and are all green), and a block on writing files to this repo through the GitHub API (use the local clone, so the health check runs). The health check is also a real git pre-commit hook (`core.hooksPath` = `.claude/hooks`), which `studio-sync.mjs hooks` (and the SessionStart hook, `pull` and `install`) turns on, so it holds for any commit; `check` and `health` only report whether it is on. A lint, test, health or merge hook failure is a blocker: fix it, don't bypass it (no `--no-verify`).
- The `Harness` workflow (`.github/workflows/harness.yml`) runs the same health check on PRs that touch `.claude/`, Markdown or workflows, so a harness- or docs-only change is still checked.

## Stack, commands and CI

Every app defines these npm scripts; the harness relies on them.

| Command            | What it does                                                   |
| ------------------ | -------------------------------------------------------------- |
| `npm run dev`      | Local dev server                                               |
| `npm run check`    | Format check, lint, unit tests, build. Run before every push   |
| `npm test`         | Unit tests                                                     |
| `npm run test:e2e` | Build, then the browser tests (`-- e2e/<name>.spec.ts` for one area) |
| `npm run build`    | Production build                                               |

Layout: `src/` app code (keep logic that doesn't touch the DOM in plain modules so it is unit-testable), `tests/unit/` unit tests, `e2e/` browser tests, `docs/` PRD and backlog, `.claude/` harness.

Scripts: `build` builds the app's primary target; `build:artifact` and `build:web` build one target each (added by the stack packs; a static site has only `build`). Browser tests live in `e2e/<target>/` (a static site: `e2e/`).

Platform layer: every host capability (storage, sign-in, downloads, and AI calls when the app uses AI) is reached through one platform module, so the artifact and web builds swap implementations without touching features. (A static site has no platform layer: it has no host capabilities to reach.)

CI (`.github/workflows/ci.yml`, a starter file from the stack pack that is now this app's own) runs once per PR and on `main`, scaled to what changed: Markdown-only and harness-only (`.claude/`) changes run only the quick `CI gate` job on a PR (the `Harness` workflow checks them) and nothing on `main`, a version bump skips the browser tests, draft PRs wait until marked ready, and `main` runs only the quick checks after a merge (start the full suite by hand before a release). Push once per feature.

## Cloud sessions (claude.ai/code)

- **One branch.** A cloud session is given one branch (e.g. `claude/…`) and may push only there. Use it for every PR in turn: after a squash-merge, reset it to `origin/main` (`git reset --hard origin/main`) before the next item, and push only together with that item's first commit. Never push the bare reset: GitHub deletes the branch on merge and that push would recreate it as a leftover. Don't push any other branch from a cloud session; open the PR from the session branch. The PR title and `Refs:` carry the item id.
- **Tags are made by CI.** A cloud session can't push tags (the git proxy refuses them), so the `Release tag` workflow tags each release when its PR merges (`release` skill, step 8). Only an app without that workflow lists pending tags in `docs/RELEASES.md` for a local session to push.
- **Several repos attached (always, in a Claude Code Project).** The session then starts in the folder above this repo, and Claude Code loads skills, agents and `.claude/settings.json` only from that start folder, so nothing of this app's harness loads by itself. The **"app-studio apps" cloud environment** fixes that before the session starts: its setup script (`app-studio/scripts/env-setup.sh`) installs a launcher in the start folder and wires it in the user settings (`~/.claude/settings.json`; cloud sessions run no hooks from a folder's `.claude/settings.json`). At every session start and hook the launcher links this app's skills and agents there, runs this app's hooks, installs dependencies (`cloud-setup`), sets `PW_CHROMIUM` and turns on the git pre-commit check, and the session opens with "Studio harness loaded for the app repo …". Hooks are silent when they pass; each run is logged in `/tmp/studio-hooks.log` (time, hook, exit code), so `tail /tmp/studio-hooks.log` shows they ran. **Without that message the safety hooks did not load:** tell the App Creator (see "Merging a PR", step 6; the Project may not be on that environment), then run `node <this repo>/.claude/studio/studio-sync.mjs hooks` before any other work: it turns on the git pre-commit check and forwards the lint, test, merge and write hooks to the user settings, which the session re-reads mid-session (best effort; the git pre-commit check holds either way, and the merge and write rules in "Git workflow" apply even if no hook stops you). Then run `npm ci` here if the app has dependencies.
- **One repo attached.** This repo's own `.claude/` loads, and the `SessionStart` hook `.claude/hooks/cloud-setup.mjs` (cloud sessions only) installs dependencies (the container's global Prettier is older than the repo's, so `npm run check` fails on untouched files until `npm ci` has run), sets `PW_CHROMIUM`, and runs the app's own `scripts/cloud-setup.sh` if it has one (e.g. a local database for server tests). Output: `/tmp/cloud-setup.log`. The environment's setup script runs that script too.
- **E2E:** the container's Chromium may not match Playwright's, so `PW_CHROMIUM` points at it (set by the environment or `cloud-setup`). If it's unset: `PW_CHROMIUM=/opt/pw-browsers/chromium-<n>/chrome-linux64/chrome npm run test:e2e` (`chrome-linux` on older images; check the folder names under `/opt/pw-browsers`). Never run `playwright install`.
- **Keep command output small.** Pipe test, build and CI output through `| tail -n 40` (or list only failing test names); read the failing CI job's log, not the whole run. Agents return short findings, not command transcripts.

## Models

- **Opus:** the Project coordinator, and reviews of risky diffs (AI prompts, storage, capabilities, auth).
- **Sonnet (medium effort):** feature, backlog, release and harness-sync threads.
- Raise effort or model only after a thread fails twice, never up front.

## Backlog ids

- **Backlog ids are never picked blindly.** Parallel threads each choosing "the next number" gave two items the same id. (1) The coordinator reserves ids: when it starts a thread that adds items, it names the ids (or a range) in the thread's brief, and a thread uses only those. (2) A thread without ids runs `node .claude/hooks/backlog.mjs next <XX> --fetch`, which reads `docs/BACKLOG.md` and `docs/BACKLOG-DONE.md` in this checkout and on every remote branch (so every open PR) and prints the next number above all of them (`backlog.mjs add` uses it), and checks again right before opening its PR and after any rebase; if the id was taken meanwhile it renumbers its own item (and every reference to it). (3) The harness health check (the pre-commit hook) fails when two items share an id, so a duplicate can't be committed.
