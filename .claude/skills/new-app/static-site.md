# New app: static-site path

_Branch file of the `new-app` skill. Read it only for a static content site (the `static-site` pack alone). The numbered steps are in `SKILL.md`._

## Static-site path (the `static-site` pack alone, no `base`)

A static site has no platform layer, seed page, sign-in, AI or database, so these steps differ; the rest stay as written.

- **Step 4:** `pack add static-site --slug <repo> --title "<App name>"`, then `npm install` (no server install, no `base`). Never add `base`, `web` or `artifact` to it.
- **Step 5, App profile:** Stack `static-site`; Release target `Cloudflare Pages (address set after the first deploy; a pages.dev name can be taken and gets a suffix, so never guess it)` (never `TBD`: `health` fails on it in build), replaced by the real address once the first Deploy run shows it (or the domain, once set); Preview target "a public preview link per PR (`docs/PREVIEW.md`)"; **AI `off`** and AI plan `none`; **Access model `anyone, no login (public website)`**; **Storage shape `none (no data is stored)`**. These follow from the pack, so don't ask the App Creator; do tell them previews are public unless Cloudflare Access protects them. Ask the one site question that has no default: who may merge into a separate content repo, if one is used (profile row Owner-merged repos).
- **Step 7:** the pack's sample pages, posts and styles are the seed: no seed page, no `SIGN_IN_MODE`, no `ai`, `ai-web` or `user` (they need `base`, and `pack add` refuses them). The Roadmap list module is optional on a site as on any app (`pack add roadmap`).
- **Step 9:** `npm run check` and `npm run test:e2e` need no database. Browser tests need the pack's Playwright browser, which CI installs.
- **Step 11:** the first release deploys through the pack's `deploy.yml`, which needs the Cloudflare account and secrets (`docs/PREVIEW.md`). After it, set the Release target to the address in the Deploy run's summary, not `<project>.pages.dev` (the name may carry a suffix). If they aren't set up, do not stall the bootstrap: release when they are, and put the setup on the Admin's checklist.
- **Step 12 report:** add the Cloudflare setup (account, API token and account id as GitHub secrets, `docs/PREVIEW.md` for Access protection of previews and the content repo) to the Admin's checklist, with a pointer to `docs/PREVIEW.md` in the app.
