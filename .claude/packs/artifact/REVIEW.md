# Artifact pack: review checklist

Greppable items below are run by `node .claude/hooks/review-precheck.mjs` from `review-rules.json` in this folder; the reviewer judges its leads and the items that need reading.

For the `reviewer` agent. A breach is blocking unless noted.

- Every `window.claude` use goes through `src/platform/`; none in features.
- A new `use("...")` name is added to the App profile's Capabilities and the release notes (consent prompt).
- `sample` is called only from a user action; no loops, timers or automatic retries; errors branch on `error.code`.
- The model tier is the cheapest that does the job (`quick` by default).
- Anything loaded from outside the bundle is on the allowed list (cdnjs, jsdelivr, unpkg, Google Fonts).
- No key, token or private data in the bundle or in the test fakes.
- The bundle stays well under 16 MB (a new dependency or data file is checked).
