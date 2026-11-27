# Harness sync: add a stack pack

_Branch file of the `harness-sync` skill. Read it only when the App Creator asks to add a stack pack or module to an existing app._

`node .claude/studio/studio-sync.mjs pack add <name>` (for example when an artifact prototype gets a web version: `pack add web`). Files the app already has are kept and listed; merge those by hand from `app-studio/packs/<name>/starter/`. Then `npm install` (and `npm install --prefix server` for `web`) and commit the lockfiles. Adding `web` to an artifact app: replace `.github/workflows/ci.yml` with the web starter by hand and set `build` to `build:web`. `static-site` is a whole stack of its own: it can't be added to an existing artifact or web app, or the other way round (`pack add` refuses it). A site that needs a stack the pack lacks (sign-in, a database) starts a different app or goes through a `harness-idea`; there is no pack clean-up routine.
