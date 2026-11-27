# User module: the page knows who is using it

A feature module (`"kind": "module"` in `pack.json`): added when the App profile's access model has people with their own identity (only invited people, anyone who signs up, or an artifact app that keeps per-person documents), with `pack add user`. It needs `base`. An app with **no login** leaves it out: nobody is signed in, so the page can't depend on who it is.

## What it adds

| File | What |
| --- | --- |
| `src/platform/capabilities/user.ts` | Adds `user()` to `getPlatform()`, how the Claude artifact runtime serves it (the viewer), and the test fake `fakeUser(id)` |
| `tests/unit/user.test.ts` | Its unit tests |

## Rules

- `getPlatform().user()` resolves `null` where nobody is identified, and `id()` resolves `null` when nobody is signed in; the page must cope.
- Per-person documents live under `data/users/<id>/...`, with the id from `user()`. Without this module, use `shared/...` only.
- Unit tests: `fakePlatform()` has the person `"test-user"` once this module is there; `fakePlatform({ user: fakeUser("u1") })` picks another.
- On the web, the web pack serves `user()` from the sign-in (`/api/auth/me`) when this module is there; no other module is needed. With `SIGN_IN_MODE=none` the server has no sign-in, so leave this module out.
