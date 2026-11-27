import { existsSync } from "node:fs";
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

// Browser tests run against the BUILT pages, once per target the app has (a target exists when its
// adapter does): e2e/artifact/*.spec.ts against the single-file page, e2e/web/*.spec.ts against the
// real server with a scripted AI. A web-first app keeps the artifact prototype to smoke tests only.
const hasArtifact = existsSync("src/platform/adapters/artifact.ts");
const hasWeb = existsSync("src/platform/adapters/web.ts");
const ARTIFACT = "http://localhost:4173";
const WEB = "http://localhost:4175";
/** Specs that need a phone-sized screen too (layout, touch). Keep this list short: it doubles the runs. */
const PHONE = /(^|[\\/])layout\.spec\.ts$/;

const projects: PlaywrightTestConfig["projects"] = [];
const webServer: PlaywrightTestConfig["webServer"] = [];

if (hasArtifact) {
  projects.push(
    {
      name: "artifact",
      testDir: "e2e/artifact",
      use: { ...devices["Desktop Chrome"], baseURL: ARTIFACT },
    },
    {
      name: "artifact-phone",
      testDir: "e2e/artifact",
      testMatch: PHONE,
      use: { ...devices["Pixel 7"], baseURL: ARTIFACT },
    },
  );
  webServer.push({
    command:
      "npm run build:artifact && npx vite preview --outDir dist-artifact --port 4173 --strictPort",
    url: ARTIFACT,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  });
}
if (hasWeb) {
  projects.push({
    name: "web",
    testDir: "e2e/web",
    // One database and one server: the specs share them and run one after another.
    fullyParallel: false,
    use: { ...devices["Desktop Chrome"], baseURL: WEB },
  });
  webServer.push({
    // The real server and database with a scripted AI (server/e2e/server.ts); needs Postgres at
    // DATABASE_URL (default postgres://postgres:test@localhost:5432/postgres) and `npm ci --prefix server`.
    command: "npm run build:web && cd server && npx tsx e2e/server.ts",
    url: `${WEB}/api/health`,
    timeout: 120_000,
    env: { PORT: "4175", WEB_DIR: "../dist-web" },
    reuseExistingServer: false,
  });
}

export default defineConfig({
  forbidOnly: !!process.env.CI,
  // Each test fails after 30 s (the default) and names itself. In CI a shard stops after 6 minutes
  // and lists what didn't run, well inside the job limit.
  ...(process.env.CI && { globalTimeout: 6 * 60_000 }),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "on-first-retry",
    // Cloud sessions ship a Chromium that may not match this Playwright version.
    ...(process.env.PW_CHROMIUM && { launchOptions: { executablePath: process.env.PW_CHROMIUM } }),
  },
  projects,
  webServer,
});
