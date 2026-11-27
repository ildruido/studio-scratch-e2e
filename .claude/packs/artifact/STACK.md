# Artifact pack: one page inside the Claude app

The app ships as ONE self-contained `dist-artifact/index.html` (`npm run build:artifact`), published as a private Claude artifact. An artifact is a single page with no server behind it.

## Rules

- **Size and files.** One file, under 16 MB (it holds everything: code, styles, data, engines). Bundle everything. Only scripts from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm or unpkg.com and fonts from Google Fonts may load at runtime.
- **Both themes.** The viewer shows the page in its own theme. Define every colour as a token on `:root` (light) with dark values under `prefers-color-scheme: dark` (`:root:not([data-theme="light"])`) and `:root[data-theme="dark"]`, and give `body` an explicit `background` from a token. The seed `src/style.css` does this; keep new CSS on the tokens.
- **Capabilities** (`sample`, `db`, `user`, `downloads`, `permissions`, …) are reached with `await window.claude.use(name)` through `src/platform/artifact.ts`. It may resolve `null`: design for absence, and the page must render and explain itself outside the Claude app.
- **Declare exactly what the code uses.** The published artifact declares the capability set in the App profile. Adding or removing one is a release-note item, because the App Creator gets a new consent prompt.
- **`sample` (asking Claude)** happens only on a user action, never in a loop or timer. Branch on `error.code`; never retry automatically. Runs on the viewer's plan: default `modelTier: "quick"`, `"default"` only for long one-off work.
- **Tests** fake `window.claude` with `page.addInitScript` (`e2e/artifact/fake-claude.ts`); never call a real model.
- **Storage** is the `db` capability (documents per user). The page keeps nothing it cannot lose; browser storage is a convenience only.

## Preview target

A second private artifact holds branch builds for checks the Tester must do inside the Claude app. It is never the release target. Publish the same `dist-artifact/index.html` to it with `label: "Preview <branch or version>"`. The App profile's Preview target holds its link.

## App profile

- **Capabilities:** the exact JSON passed at publish, e.g. `{"sample": {}, "db": {}, "user": {}}`.
- **Release target:** the app's single artifact URL; the App Creator's link never changes.
- **Stack notes:** point at this pack; add only app-specific lines (extra build limits, an extra preview build).
