# Tip Splitter — project instructions

Read this first in every session. Long-tail detail lives in the files named below; read one only when you reach that step.

## App profile

The skills and agents in `.claude/` are the shared studio harness. They know nothing about this app: they read this table and the two lists below. Keep it current.

| Field          | Value                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| App            | Tip Splitter |
| Phase          | discovery |
| Id prefix      | `TS` |
| Stack          | TBD (decided at build start) |
| User           | Someone splitting a restaurant bill with friends                 |
| Repo           | https://github.com/ildruido/studio-scratch-e2e (private) |
| Release target | TBD (decided at build start) |
| Preview target | TBD (decided at build start) |
| Capabilities   | TBD (decided at build start) |
| AI             | off |
| AI plan        | TBD (decided at build start) |
| Access model   | TBD (decided at build start) |
| Storage shape  | TBD (decided at build start) |
| Decision log   | `docs/discovery/decision-log.md` |
| Owner-merged repos | `none` |
| AI public use  | not needed (AI off) |

**Owner-merged repos:** `owner/repo`, comma-separated; `none` (also when the row is missing) means no such repo. **Phase:** in `discovery` there is no stack, starter code or CI yet, and rows except App, Id prefix, Repo and Phase may say `TBD` ("not decided yet", never a made-up value); `build-feature`, `release` and `test-handoff` stop there, and the health check fails on any `TBD` in `build`. Only the App Creator's "start building" switches it (`new-app`). The AI, Access model and Storage shape rows are the Features `prd-intake` records one question at a time, with no preselected answer.

### Domain rules

Rules about this app's subject that every plan, prompt and diff must respect (the reviewer treats a breach as blocking).

TBD (decided at build start)

### Stack notes

Skills say "the stack notes" for this list **plus** each pack's docs in `.claude/packs/<name>/` (`STACK.md`, `RELEASE.md`, `QA.md`, `REVIEW.md`). Keep only what is specific to this app.

- **Build:** TBD (decided at build start)
- **QA:** TBD (decided at build start)
- **Release:** TBD (decided at build start)
- **Preview:** TBD (decided at build start)

## Discovery profile

The discovery skills are generic: they read this section for everything about this product. Keep it current as the documents evolve (`node .claude/hooks/app-setup.mjs discovery-profile set "Row=value"`). What each row means: `.claude/packs/discovery/STACK.md`.

| Field | Value |
| --- | --- |
| Product        | A one-page tip splitter: enter the bill, tip percentage and number of people, see each person's share |
| Target users   | People splitting a restaurant bill with friends |
| Starting idea  | `docs/discovery/starting-idea.md` (a starting point, not a fixed plan) |
| Docs folder    | `docs/discovery/` |
| Sign-off mode  | per artifact |
| Exit criteria  | default |
| Principles     | not set yet |
| Domain risks   | not set yet |
| Prototype look and feel | not set yet |

## Roles

<!-- studio:begin roles (harness-owned: a sync replaces everything up to the end marker; keep app-specific roles outside it) -->
- **The App Creator (PM) and the Tester.** The App Creator is also the Tester unless someone else tests. The App Creator describes requirements and sets priority by ordering the backlog; the Tester tests releases and reports results. Neither writes code, runs commands or manages git. The few things only the Admin can do (creating a repo, adding a repository secret, a host's settings) Claude hands over as exact clicks.
- **Claude (engineer).** Owns all code, tests, versioning, releases and the harness. Turns the App Creator's words into PRD and backlog changes, builds, ships and hands over a test script.
- Ask the App Creator only when a requirement is genuinely ambiguous or a decision is product-level. Ask one question at a time, each with a recommended answer and one line on why. Everything technical is ours to decide.
<!-- studio:end roles -->
- **Where decisions are recorded.** Product decisions go in the app's decision log (App profile, Decision log row; `docs/PRD.md` "Decisions" when the row is left at its default). Record them with `node .claude/hooks/decisions.mjs` (`add`, `supersede`, `list`, `show`), never by hand: it numbers, dates and supersedes. Technical decisions go in the PR description.

## The product in one paragraph

A one-page tip splitter: enter the bill, a tip percentage and the number of people, and see each person's share. No sign-in, no AI. See `docs/PRD.md` and `docs/BACKLOG.md` (finished items are archived in `docs/BACKLOG-DONE.md`; read it only to look one up).

## Stack and commands

Every app defines `npm run dev`, `npm run check` (format, lint, unit tests, build; run before every push), `npm test`, `npm run test:e2e` (`-- e2e/<name>.spec.ts` for one area) and `npm run build` (`build:artifact` and `build:web` build one target; a static site has only `build`).

Layout: `src/` (logic that doesn't touch the DOM goes in plain modules), `tests/unit/`, `e2e/` (`e2e/<target>/`), `docs/` (PRD, backlog), `.claude/` (harness). Every host capability is reached through one platform module (a static site has none). CI scales to what changed; push once per feature (details: `.claude/skills/harness-sync/harness.md`).

## Runtime rules

- Every host capability (storage, sign-in, downloads, and AI if the app uses it) may be missing or denied. Design for absence: the app still renders and explains itself.
- The app declares exactly the capabilities the code uses (App profile, Capabilities). Adding one is a release-note item, because the App Creator gets a new consent prompt.
- Only if the App profile says AI is on: AI calls happen only on a user action, never in a loop or timer. Branch on the error code; never retry automatically. Use the cheapest model tier that does the job (App profile, AI plan). Tests fake every AI call; they never call a real model.
- Tests fake every host capability; they never reach the real host.
- Only load what the stack allows from outside (see the stack notes); bundle everything else.

## Backlog, workflow and releases

The backlog is `docs/BACKLOG.md` (the repo is the source of truth). Ids come from `node .claude/hooks/backlog.mjs next <XX> --fetch`, never picked by hand. The coordinator (Project chat) owns the App Creator's product decisions and priorities; with the optional `roadmap` module it keeps the Roadmap list too (`.claude/packs/roadmap/STACK.md`).

- **Build:** the `build-feature` skill. It holds the definition of done (criteria met, tests, `npm run check` and CI green, reviewer clean, changelog line, test script for the Tester).
- **Release:** the `release` skill: only from a green `main`; SemVer tags `vX.Y.Z` matching `package.json`; `CHANGELOG.md` follows Keep a Changelog.
- **Skills:** `prd-intake`, `build-feature`, `test-handoff`, `release`, `new-app`, `harness-sync`, `harness-idea`, `migrate-app`; agents `planner`, `reviewer`, `qa`.

## Git workflow

- Never commit straight to `main`. One branch per backlog item: `feat/<id>-<slug>`, `fix/<id>-<slug>`, `chore/<slug>`. Conventional Commits, with `Refs: <XX>-012` in the body. Run `npm run check` before every push; never push red, never skip hooks, never force-push `main`.
<!-- studio:begin merge-rule (harness-owned: a sync replaces everything up to the end marker; keep app-specific rules outside it) -->
- **Merging a PR** (every skill that says "merge it" means this). Open it ready for review with a Conventional Commit title. **Never open a draft PR: its checks are skipped and it never merges, silently.** Read it back (`pull_request_read`, `get`); if `draft` is `true`, mark it ready (`update_pull_request`, `draft: false`) before you hand back. Then squash-merge once `CI gate` and `health` are green, else switch on auto-merge (`enable_pr_auto_merge`, `SQUASH`) and follow the PR (`subscribe_pr_activity` plus a wake-up about 3 minutes out). Never bypass a check or merge a blocked PR. The full procedure is `.claude/skills/build-feature/merge.md`.
  - **Owner-merged repos** (App profile): never merge, auto-merge or approve there; open the PR and say it waits for the App Creator.
  - **No safety checks, no merge.** If the session did not start with "Studio harness loaded" (see `.claude/skills/harness-sync/harness.md`, "Cloud sessions"), say so in your first reply and leave merging to the App Creator unless `/tmp/studio-hooks.log` shows hooks ran.
  - **`app-studio` is never changed from here, with no exceptions** (no approval lifts it): decline in one line and file a `harness-idea` issue instead. Issues and comments there stay allowed.
<!-- studio:end merge-rule -->
- **The checks.** Every PR gets `CI gate` and `health`; only each check's latest run counts. Never merge around them.

## Harness

Shared harness, copied from `app-studio` and pinned in `.claude/studio/lock.json`. **It changes only in `app-studio`'s own Project, never from this app's work:** send ideas with the `harness-idea` skill and pull released changes with `harness-sync` when the App Creator asks. A lint, test, health or merge hook failure is a blocker: fix it, never bypass it. Hooks, CI, pack starter files and cloud-session setup are explained in `.claude/skills/harness-sync/harness.md`.

## Threads

- **Models:** the Project coordinator runs on Opus, threads on Sonnet at medium effort; the reviewer is picked by code (`node .claude/hooks/review-precheck.mjs risk` prints `reviewer`, or `reviewer-deep` on Opus for a risky or very large diff); helper agents and scripted skills pin their own model and effort in frontmatter (change it there, not in prose); raise effort or model only after a thread fails twice (the Project instructions repeat the thread rules).
- **A thread stays inside its backlog item.** When the item is done or blocked it hands back (the PR description and a short message) and stops; it never proposes, plans or starts the next item or phase, even if offered. Only the coordinator picks the next item and starts its thread.
<!-- studio:begin thread-reports (harness-owned: a sync replaces everything up to the end marker; keep app-specific rules outside it) -->
- **Point, don't repeat.** The App Creator reads and answers in threads. A thread puts everything the App Creator must act on in its own message: the result in plain English, the test steps, and any product decision about its own item (one question, with a recommended answer; a release question about its own item too). The coordinator then posts only "<what is needed> - open the thread", with the thread link. It does not restate the result, the test steps or PR numbers, and it adds no question of its own, even though a coordinator's habit is to relay results. With parallel threads it posts one such line per thread. A summary is for a matter that spans threads (ordering, the next item, one release covering several). The App Creator can ask a thread for a shorter recap.
<!-- studio:end thread-reports -->
- **In discovery** with the `discovery` module: one thread per discovery document or research study; decision and study ids come from the scripts (`decisions.mjs`, the research module's `studies.mjs`), never picked or reserved by hand; the coordinator proposes the next document from `.claude/packs/discovery/WORKFLOW.md`.
- One thread per backlog item. A bug found in testing gets a new thread that reads the item and its PR. Never resume a thread idle for over an hour: start a new one (every PR description ends with a hand-over: what changed, what's left, how to test).

## Writing for the App Creator

Plain English, no jargon. Lead with what changed for the user, then how to check it. Test scripts are numbered steps with an expected result each.

Before saying something is done, check it, and say plainly what you did not check (for example, "no code tests ran" or "not tried on a phone").
