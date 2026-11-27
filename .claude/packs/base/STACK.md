# Base pack: build scaffold and platform layer

Every app starts from this. It gives the app the npm scripts the harness relies on (`dev`, `check`, `test`, `test:e2e`, `build`), TypeScript strict mode, ESLint, Prettier, Vitest and Playwright, and the platform layer.

## The platform layer

Everything the page needs from its host is reached through `getPlatform()` in `src/platform/`. The page never calls `window.claude` or `/api/*` directly. Each build picks its adapter from `src/platform/adapters/` by `__TARGET__` (`artifact` or `web`); `startPlatform()` runs once in `src/main.ts`.

- Every app's `Platform` has `hasRuntime()`, `db()` (documents) and `downloads()`. Nothing else: a feature's capabilities come with its module (the `user` module adds `user()`, who is signed in; the `ai` module adds `sample()` and `permissionState()`), and code that calls one without its module doesn't compile.
- A module adds a capability with one file in `src/platform/capabilities/` (declares the methods on `Platform`, says how the artifact runtime serves them, gives a fake); `src/platform/registry.ts` collects them for `nullPlatform`, `fakePlatform()` and the adapters. On the web a provider in `src/platform/web-providers/` serves them. See `packs/README.md` in app-studio, "Platform capabilities".
- Every getter resolves `null` when the host cannot do that thing (a capability no adapter serves resolves `null` too). Features must render and explain themselves without it.
- A change to the four base members goes to `Platform` first, then to every adapter in the same change, so the artifact and web builds stay interchangeable.
- Unit tests use `fakePlatform()` from `src/platform/fake.ts` (in-memory documents plus each module's fake; pass members to replace, e.g. `fakePlatform({ downloads })`); no test calls a real model or a real host.

## Files

| File | What |
| --- | --- |
| `vite.config.ts` | Two modes: `--mode artifact` (one file) and `--mode web` (multi-file site). Defines `__TARGET__` and `__APP_VERSION__` |
| `src/env.d.ts` | The shapes of the host runtime the page uses (documents, user, downloads); a module brings its own (`src/ai.d.ts`) |
| `src/platform/` | `types.ts`, `index.ts` (selection), `registry.ts` (module capabilities), `fake.ts` (tests), `adapters/` (from the artifact and web packs), `capabilities/` (from modules) |
| `src/main.ts` | The seed page: starts the platform, then mounts every feature module in `src/modules/` (none until the app adds one, e.g. `pack add ai`) |
| `playwright.config.ts` | One project per target the app has: `e2e/artifact/` and `e2e/web/` |

## Conventions

- Scripts: `build` builds the app's primary target, `build:artifact` and `build:web` build one target each (added by their packs). `npm run check` = format, lint, unit tests, `build`.
- Browser tests live in `e2e/<target>/`. A web-first app keeps its artifact prototype to smoke tests only.
- The packs' starter files (CI, configs, server, adapters) belong to the app after they are copied. Pack changes reach the app only through the sync check's notes; merge them by hand.
