# Artifact pack: release steps

The `release` skill's step 9 (build and ship) follows this. Run it from the tagged commit.

1. `npm ci && npm run build:artifact`. `dist-artifact/` must hold only `index.html`, under 16 MB.
2. Publish `dist-artifact/index.html` with the Artifact tool:
   - `url`: the Release target from the App profile, so the link stays the same. First release only: omit `url`, pass a short generic `icon` word, then record the new URL in the App profile.
   - `label`: `vX.Y.Z`.
   - First release: `capabilities` is the set the App profile lists (the seed adapter mentions `db` and `downloads`, plus `user` with the `user` module and `sample` and `permissions` with the `ai` module, so the publish warns about each one the app doesn't declare; that is expected until the app uses them or drops that adapter code).
   - `capabilities`: omit to keep the stored set. Pass the full set only when this release adds or removes one; it must match the App profile's Capabilities line. Say so in the handoff: the App Creator gets a new consent prompt.
3. Preview target too, when the test script needs a check inside the Claude app: publish the same file to the Preview URL with `label: "Preview vX.Y.Z"`. Give both links in the handoff, and never send a script for the preview before it is refreshed.
4. In the handoff, name the version shown on the page and any new consent prompt.
