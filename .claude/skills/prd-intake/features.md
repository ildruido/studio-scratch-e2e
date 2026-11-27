# PRD intake: the Features questions

_Branch file of the `prd-intake` skill. Read it only when the App profile's AI, Access model or Storage shape row is blank (the first request for a new app). Then continue with the steps in `SKILL.md`._

## Features

Before any backlog item, make sure the App profile's **AI**, **Access model** and **Storage shape** rows are filled in. Ask them one at a time, in the App Creator's words, with the options below and **no preselected answer**: never assume it, and never record one the App Creator hasn't given. You may add a short recommendation after the options, only if the app's stated purpose points one way (say why); the App Creator still answers. Then record each answer in the App profile and name what it adds:

1. **AI:** does the app use AI: on or off? If on, also record the AI plan (whose plan or key pays, and the default model tier). Off means no AI code, no AI capability, and no AI runtime rules apply.
2. **Access model:** who can get in: only invited people, anyone who signs up, anyone with no login, or (for an artifact app) whoever the App Creator shares it with in the Claude app. A release stops while this is blank.
3. **Storage shape:** per-person documents, shared documents, or "needs something else". The `web` pack stores documents only; "needs something else" is a product decision to raise with the coordinator before building.

4. **AI public use** (only when AI is on and the access model is "anyone who signs up" or "anyone, no login"): say plainly that anyone on the internet can then spend the app's AI, and that a usage quota or spend cap is **strongly recommended before launch**. Ask the App Creator to decide (a cap, with its numbers, or no cap and why) and record the answer in the App profile's **AI public use** row. The `ai-web` module has an opt-in site-wide cap (`AI_SITE_CAP_TOKENS` per day or month, optionally `AI_PER_ADDRESS_TOKENS`): a no-login app can offer AI to visitors only with it set, and an open sign-up app should set it too, since one person can make many accounts. Offer it as the way to carry out a cap decision, with numbers the App Creator picks. Allowing AI is the App Creator's call; the harness doesn't pick, but a release stops until the decision is recorded.

**A static site** (App profile Stack `static-site`) has no sign-in, AI or stored data, so these questions are not asked: its rows are already `AI off`, `Access model anyone, no login (public website)` and `Storage shape none`, set by `new-app`. If the App Creator's request needs one of them (a members area, a form that stores answers, AI on a page), that is a product decision to raise with the coordinator before building: the pack can't do it, so it is a `harness-idea`, not a quiet change of the rows.

Name the modules the answers add. For a web app, the access model sets the server's sign-in mode (`SIGN_IN_MODE` in `render.yaml` and `.github/workflows/ci.yml`; `.claude/packs/web/STACK.md`, "Sign-in modes"): only invited people is `invite`, anyone who signs up is `open`, anyone with no login is `none`. Every access model with sign-in, and an artifact app with per-person documents, adds the `user` module (who is using the page); a no-login app leaves it out and keeps only shared documents. If a module is not available in the harness yet, say so plainly and record the choice anyway; don't pretend it exists.
