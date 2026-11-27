# Artifact pack: QA checklist

Mechanical items below are run by `node .claude/hooks/qa-run.mjs` (build, baseline and changed specs, `qa-rules.json` in this folder); the qa agent does the rest.

For the `qa` agent, on top of its general checks. Browser tests are in `e2e/artifact/`; the page is served from `dist-artifact/` on :4173 (`npm run preview`).

- **No runtime.** Without `window.claude` the page renders and says why the AI features are off.
- **Fake runtime.** With `fakeClaude`: success, slow answer, Stop, `not_granted`, `rate_limited`, `upstream_error` with partial text. The page recovers and never retries by itself.
- **Persistence.** Reload mid-flow: saved state survives (documents via the fake `db`).
- **Build output.** `dist-artifact/` holds only `index.html`, under 16 MB, with no `sk-ant-` key and nothing loaded from a host other than cdnjs, jsdelivr, unpkg and Google Fonts.
- **Phone width.** No horizontal scroll at 375 px (`layout.spec.ts` runs on the phone project).
- **Capabilities.** The set the code uses equals the App profile's Capabilities line.
