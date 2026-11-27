# Release: stops and fallbacks

_Branch file of the `release` skill. Read it only when `release-cut` stops on a gate, or the app has no `Release tag` workflow._

## Release gate stops

`release-cut` stops, changing nothing, while the release gate does: the Access model is blank (ask the App Creator who can get in, record it), a web app's `SIGN_IN_MODE` in `render.yaml` or `.github/workflows/ci.yml` disagrees with it (fix the file), or an app with AI that anyone can get into (open sign-up or no login) has no AI public use decision (say that a usage quota or spend cap is strongly recommended, ask the App Creator to decide, record it). It also stops when the working tree isn't clean, when you aren't on what `origin/main` holds (it pulls `main` first), or when `CHANGELOG.md` has no entries under `## [Unreleased]`. Fix the cause, or tell the App Creator why, and run it again.

## No tag workflow

**Only if the app has no such workflow** (older apps) the same command prints the by-hand steps instead (tag `main`, push the tag; in a cloud session that push is refused, so record the tag in `docs/RELEASES.md` with the commit, carry on, and suggest adding the workflow with `harness-sync`).
