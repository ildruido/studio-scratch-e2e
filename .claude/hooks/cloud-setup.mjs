// SessionStart hook: makes a fresh cloud session ready to run the app's checks.
//   node .claude/hooks/cloud-setup.mjs
// Does nothing outside a cloud session (CLAUDE_CODE_REMOTE), so a local checkout is untouched.
// 1. Installs the app's dependencies when node_modules is missing or older than the lockfile
//    (a fresh container's global tools, Prettier included, are older than the repo's pinned ones).
// 2. Points Playwright at the container's Chromium (PW_CHROMIUM, via CLAUDE_ENV_FILE).
// 3. Runs the app's own `scripts/cloud-setup.sh` if it has one (databases, extra installs).
// Never blocks a session: failures print one line and exit 0. Output goes to /tmp/cloud-setup.log.
// Shared studio harness file: change it in app-studio, not in an app.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CLAUDE_CODE_REMOTE !== "true") process.exit(0);

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOG = "/tmp/cloud-setup.log";
const notes = [];
writeFileSync(LOG, "");

function run(label, cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  appendFileSync(LOG, `$ ${label}\n${res.stdout ?? ""}${res.stderr ?? ""}\n`);
  return res.status === 0;
}

const mtime = (p) => (existsSync(p) ? statSync(p).mtimeMs : 0);

// 1. Dependencies.
const lock = join(root, "package-lock.json");
if (existsSync(lock) && mtime(join(root, "node_modules", ".package-lock.json")) < mtime(lock)) {
  if (!run("npm ci", "npm", ["ci", "--no-audit", "--no-fund"])) notes.push("npm ci failed");
}

// 2. Playwright's browser: the container's Chromium may not match the pinned Playwright.
const browsers = "/opt/pw-browsers";
if (process.env.CLAUDE_ENV_FILE && existsSync(browsers)) {
  const dir = readdirSync(browsers).find((n) => /^chromium-\d+$/.test(n));
  const exe = dir && ["chrome-linux64", "chrome-linux"].map((o) => join(browsers, dir, o, "chrome")).find(existsSync);
  if (exe) appendFileSync(process.env.CLAUDE_ENV_FILE, `export PW_CHROMIUM=${exe}\n`);
}

// 3. The app's own setup.
const appSetup = join(root, "scripts", "cloud-setup.sh");
if (existsSync(appSetup) && !run("scripts/cloud-setup.sh", "bash", [appSetup])) {
  notes.push("scripts/cloud-setup.sh failed");
}

console.log(
  notes.length ? `Cloud setup: ${notes.join("; ")} (see ${LOG}).` : "Cloud setup done.",
);
