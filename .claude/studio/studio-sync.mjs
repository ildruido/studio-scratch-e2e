#!/usr/bin/env node
// studio-sync: keeps an app's copy of the studio harness in step with app-studio, the master copy.
//
//   node studio-sync.mjs install [--app <dir>] [--studio <dir>]   first copy into an app, plus templates
//   node studio-sync.mjs check   [--app <dir>] [--studio <dir>] [--warn]
//   node studio-sync.mjs inventory [--app <dir>] [--studio <dir>]   read-only look at an existing app before it migrates (migrate-app skill)
//   node studio-sync.mjs health  [--app <dir>] [--studio <dir>]   is the harness sound? (pre-commit hook, CI)
//   node studio-sync.mjs release-gate [--app <dir>]   exit 1 while the access model, or an AI public use decision it needs, is blank (release skill)
//   node studio-sync.mjs phase   [--app <dir>] [--build-only | --discovery-only]   print the App profile's Phase (discovery | build); --build-only exits 1 in discovery (build-feature, release, test-handoff), --discovery-only exits 1 once the app is building (discovery-bound skills)
//   node studio-sync.mjs status [--studio <dir>] [--scaffold]   read-only: version, next free patch/minor, live-check state (app-studio threads)
//   node studio-sync.mjs release-prepare [--app <dir>] [--version X.Y.Z] [--apply]   propose the version and move Unreleased into a dated section; dry run unless --apply (release skill)
//   node studio-sync.mjs release-cut --version X.Y.Z [--app <dir>]   release gate, clean current main, release branch, package.json bump, changelog; never commits (release skill)
//   node studio-sync.mjs release-tag-check X.Y.Z [--app <dir>]   exit 0 once tag vX.Y.Z is on origin; without a Release tag workflow prints the by-hand steps (release skill)
//   node studio-sync.mjs live-check-pass   moved: node scripts/release.mjs pass-main <version>
//   node studio-sync.mjs pull    [--app <dir>] [--studio <dir>] [--force] [--dry-run]   --dry-run changes nothing and prints what the pull would do
//   node studio-sync.mjs sync    [--app <dir>] [--studio <dir>] [--force] [--dry-run]   fast-forward app-studio to origin main, then its own pull and health, then the commit line (harness-sync skill)
//   node studio-sync.mjs pack add <name...> [--slug <kebab>] [--title <Name>]   add stack packs or feature modules (packs/ in app-studio)
//   node studio-sync.mjs pack remove <name...> [--force]   drop stack packs the app no longer uses
//   node studio-sync.mjs ack [<path...>]    mark pack starter files as reviewed against app-studio
//   node studio-sync.mjs hooks   [--app <dir>]   turn on the harness hooks that don't depend on where a session
//                                                 starts (every command but install does this too)
//
// Runs from app-studio (scripts/studio-sync.mjs, app defaults to the current folder) or from an
// app's copy (.claude/studio/studio-sync.mjs, app-studio defaults to $STUDIO_DIR, then ../app-studio).
// The app's .claude/studio/lock.json pins the studio version and a hash of every managed file.
// A stack pack (packs/<name>/) adds two kinds of file: `managed/` files (checklists and release
// notes, kept in step like the skills, under .claude/packs/<name>/) and `starter/` files (CI, configs,
// server, adapters: copied once, with {{slug}} and {{title}} filled in, and the app's own afterwards;
// check only notes when app-studio's version changed, and pull refreshes the ones left unedited).
// A module may also ship skills (`skills/<skill>/`) and agents (`agents/<agent>.md`): they land in
// .claude/skills/ and .claude/agents/, tracked like the core's, and go with `pack remove`. A name the
// core, another pack or the app itself already uses is a clash: `pack add`, `pull` and health fail on it.
// health fails (exit 1) on what would mislead a session: shared files edited or missing here, an
// unfilled App profile, harness hooks missing from settings.json, malformed app skills or agents,
// broken links in the docs (and in the app's own .claude/ Markdown), a missing Harness workflow.
// Being behind app-studio is only a note: it never blocks a commit or PR.
// Hooks that work wherever a session starts (the git pre-commit hook via core.hooksPath, and in a cloud
// session the app's Claude Code hooks forwarded to the user settings) are turned on only by `hooks` and
// by the SessionStart hook (`check --warn`). A plain `check` or `health` only reports: if they are off, it
// says so and names `hooks`, so looking at an app never changes a session's settings.
// Exit codes: 0 in step, 1 drift or skipped files, 2 usage error. --warn always exits 0 and prints
// only when something needs attention (for a SessionStart hook).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const LOCK = ".claude/studio/lock.json";
const SELF = ".claude/studio/studio-sync.mjs";

// Master folders in app-studio and where their files land in an app.
const TREES = [
  ["plugins/studio/skills", ".claude/skills"],
  ["plugins/studio/agents", ".claude/agents"],
  ["plugins/studio/hooks", ".claude/hooks"],
];
// Copied once by install when the app doesn't have them yet; never managed afterwards.
const TEMPLATES = [
  ["plugins/studio/templates/CLAUDE.md", "CLAUDE.md"],
  ["plugins/studio/templates/settings.json", ".claude/settings.json"],
];

const toPosix = (p) => p.split(sep).join("/");

// Line endings don't count as a change (Windows checkouts).
export function hashText(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}
export function hashFile(file) {
  return hashText(readFileSync(file, "utf8"));
}

const INSTRUCTIONS_TEMPLATE = "plugins/studio/templates/project-instructions.md";

/** Hash of the Project instructions template text (below its first `---` line), or null if absent. */
export function instructionsHash(studio) {
  const p = join(studio, INSTRUCTIONS_TEMPLATE);
  if (!existsSync(p)) return null;
  const text = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const i = text.indexOf("\n---\n");
  return hashText((i < 0 ? text : text.slice(i + 5)).trim());
}

/** Lines telling an app its Project instructions may be behind the template, with a ready prompt. */
export function instructionsNote() {
  return [
    "Project instructions template changed in app-studio (or this app never recorded a review). Project instructions live in Project settings, so a sync can't update them: ask your coordinator to compare and update. Ready prompt:",
    `  "Compare this Project's instructions with app-studio's ${INSTRUCTIONS_TEMPLATE} (the text below its --- line). Add the rules that are missing or changed, keep everything specific to this app, never replace the whole text. Update the instructions yourself, tell the App Creator in one line what changed, then have a thread run: node .claude/studio/studio-sync.mjs ack instructions (and commit the lock)."`,
  ];
}

function listFiles(dir, { dotfiles = false } = {}) {
  if (!existsSync(dir)) return [];
  // Dotfiles (.DS_Store, editor swap files) are never part of the harness; pack starters keep
  // theirs (.github, .gitignore) apart from OS and editor litter.
  const keep = (name) =>
    dotfiles
      ? name !== ".DS_Store" && name !== "node_modules" && !name.endsWith(".swp")
      : !name.startsWith(".");
  return readdirSync(dir)
    .filter(keep)
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? listFiles(p, { dotfiles }) : [p];
    });
}

export function isStudio(dir) {
  return !!dir && existsSync(join(dir, "plugins", "studio", ".claude-plugin", "plugin.json"));
}

export function studioVersion(studio) {
  return JSON.parse(readFileSync(join(studio, "plugins/studio/.claude-plugin/plugin.json"), "utf8"))
    .version;
}

// release.mjs sits next to the master script only. An app's own copy of this file runs without it
// (its `health` and `check` never need release data), so the import is optional.
let release = null;
try {
  release = await import("./release.mjs");
} catch {
  release = null;
}

/**
 * Releases between the app's version (`since`) and the master copy's version whose check on main is
 * still pending, as version numbers, oldest first. Released but not yet confirmed in studio-scratch:
 * apps must not move past any of them until `release.mjs pass-main` ran. Every release in range
 * counts, not only the newest. No release data means no gate.
 */
export function pendingInRange(studio, since) {
  if (!release || !studio || !existsSync(join(studio, "plugins/studio/.claude-plugin/plugin.json"))) return [];
  const g = release.gate(release.loadAll(studio), studioVersion(studio), since);
  return g.data.blocking.map((b) => b.version).reverse();
}

// ---------- released view ----------
// app-studio releases in batches: a merged change waits in releases/unreleased/ until a release is cut, and the plugin version moves
// only then. Apps get releases, so while a change that reaches apps is waiting, every app-side command reads app-studio as it was at
// the newest commit that holds exactly the current release (same version, no such entry), not as the checkout is now.

const UNRELEASED = "releases/unreleased";

/** Unreleased entries that change what apps get, in the checkout (ref null) or at a commit. An unreadable entry counts. */
export function unreleasedForApps(studio, ref = null) {
  let names, read;
  if (ref) {
    names = (gitOut(studio, "ls-tree", "--name-only", ref, `${UNRELEASED}/`) ?? "").split("\n").filter((f) => f.endsWith(".json"));
    read = (f) => gitOut(studio, "show", `${ref}:${f}`);
  } else {
    const dir = join(studio, UNRELEASED);
    names = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => `${UNRELEASED}/${f}`) : [];
    read = (f) => readFileSync(join(studio, f), "utf8");
  }
  return names.filter((f) => { try { return JSON.parse(read(f)).kind !== "internal"; } catch { return true; } });
}

/** The newest commit that holds exactly release `version`, or null when this clone's history does not reach it. */
function releaseCommit(studio, version) {
  // First parents only: on a checkout of main these are main's own commits (squash merges). A checkout moved to a build branch is the
  // live check's case, which reads the checkout as it is (--live-check), so its work-in-progress commits are not judged here.
  for (const sha of (gitOut(studio, "rev-list", "--first-parent", "-n", "500", "HEAD") ?? "").split("\n").filter(Boolean)) {
    let v = null;
    try { v = JSON.parse(gitOut(studio, "show", `${sha}:plugins/studio/.claude-plugin/plugin.json`)).version; } catch {}
    if (v !== version) return null; // an older release: the one asked for was never on its own in this history
    if (!unreleasedForApps(studio, sha).length) return sha;
  }
  return null;
}

/**
 * Where to read app-studio from: { dir } is the checkout itself when nothing app-facing is waiting for a release, else a copy of the
 * release's commit (kept in the temp folder, one per commit). { error } when that commit cannot be found: nothing is copied then.
 */
export function releasedView(studio, { deepen = true } = {}) {
  if (!unreleasedForApps(studio).length) return { dir: studio };
  const version = studioVersion(studio);
  const stop = (why) => ({ error: `app-studio holds changes that are not released yet, and release v${version} ${why}, so nothing was changed. Fix the app-studio checkout (a full clone of its main branch), then run this again.` });
  if (!existsSync(join(studio, ".git"))) return stop("cannot be read back (the folder is not a git checkout)");
  let sha = releaseCommit(studio, version);
  // A shallow clone may end before the release: fetch more history, except for the quiet start-up check (no network there).
  if (!sha && deepen && (gitOut(studio, "rev-parse", "--is-shallow-repository") ?? "").trim() === "true") {
    spawnSync("git", ["-C", studio, "fetch", "-q", "--deepen=500", "origin"], { encoding: "utf8" });
    sha = releaseCommit(studio, version);
  }
  if (!sha) return stop("was not found in the checkout's history");
  // The copy lives in the user's own cache folder (never a shared temp folder another user could fill) and counts only once
  // its marker, written last, names the commit.
  let cache = join(homedir(), ".cache", "app-studio-releases");
  try { mkdirSync(cache, { recursive: true }); } catch { cache = mkdtempSync(join(tmpdir(), "app-studio-releases-")); }
  const dir = join(cache, `${version}-${sha.slice(0, 12)}`);
  const marker = (d) => join(d, ".release-commit");
  const whole = (d) => isStudio(d) && existsSync(marker(d)) && readFileSync(marker(d), "utf8").trim() === sha;
  if (whole(dir)) return { dir, sha };
  const tmp = `${dir}.${process.pid}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const tar = join(tmp, ".release.tar");
  const ok = spawnSync("git", ["-C", studio, "archive", "--format=tar", "-o", tar, sha], { encoding: "utf8" }).status === 0 && spawnSync("tar", ["-xf", tar, "-C", tmp], { encoding: "utf8" }).status === 0;
  rmSync(tar, { force: true });
  if (!ok || !isStudio(tmp)) { rmSync(tmp, { recursive: true, force: true }); return stop("could not be copied out of git"); }
  writeFileSync(marker(tmp), `${sha}\n`);
  // A whole copy is never removed (another run may be reading it); a half-written one from a stopped run is replaced.
  if (existsSync(dir) && !whole(dir)) rmSync(dir, { recursive: true, force: true });
  try { renameSync(tmp, dir); } catch { rmSync(tmp, { recursive: true, force: true }); /* another run copied it first */ }
  return whole(dir) ? { dir, sha } : stop("could not be copied out of git");
}

// ---------- sync report ----------

/**
 * The minimal report after a sync, from the release records: one line per release newer than
 * `since` (not past the master copy's version), then what needs the App Creator. Plain code, no tokens.
 * Details of one release: `node scripts/release.mjs details <version>`.
 */
export function syncReport(studio, since) {
  if (!release) return "No release data next to this script; nothing to report.";
  const all = release.loadAll(studio);
  const current = studioVersion(studio);
  const valid = /^\d+\.\d+\.\d+$/.test(since ?? "");
  const range = release.summary(all, current, since);
  if (!range.data.length) return `No releases newer than ${since}${valid ? "" : " (unknown app version)"}: nothing to report.`;
  const steps = (who) =>
    release.actions(all, current, since, who).data
      .map((d) => ({ version: d.version, steps: d.steps.map((s) => actionStep(s, who, release.cmp(d.version, release.LEGACY_LAST) <= 0)).filter(Boolean) }))
      .filter((d) => d.steps.length);
  const show = (data) => data.flatMap((d) => [`    ${d.version}:`, ...d.steps.map((s, i) => `      ${i + 1}. ${s}`)]);
  const [app, admin] = [steps("app"), steps("admin")];
  const large = range.data.length >= LARGE_JUMP;
  const lines = [`Releases ${valid ? `${since} -> ${current}` : `up to ${current}`}:`, ...(large ? largeJumpLines(all, range) : range.text.split("\n")).map((l) => `  ${l}`), "", "Needs you:"];
  if (!app.length && !admin.length) lines.push("  nothing");
  if (app.length) lines.push("  App actions (do these in this app):", ...show(app));
  if (admin.length) lines.push("  Admin actions (relay to the App Creator, exact steps):", ...show(admin));
  if (large) lines.push("", `Large jump: ${range.data.length} releases in one sync. Before you commit, read part 9 of the harness-sync skill's sync-notes.md (${join(studio, "plugins/studio/skills/harness-sync/sync-notes.md")}).`);
  lines.push("", `Details of one release, only if asked: node ${join(studio, "scripts/release.mjs")} details <version>`);
  return lines.join("\n");
}

// From this many releases in one sync the report is the large-jump one: only what apps received is listed, the rest is counted.
export const LARGE_JUMP = 20;

/** The release lines of a large jump: releases apps received one per line (as in the short report), internal and pre-record ones counted. */
function largeJumpLines(all, range) {
  const versions = new Set(range.data.map((d) => d.version));
  const inRange = all.filter((r) => versions.has(r.version));
  const old = inRange.filter((r) => r.legacy);
  const internal = inRange.filter((r) => !r.legacy && r.kind === "internal");
  const shown = new Set(inRange.filter((r) => !r.legacy && r.kind !== "internal").map((r) => r.version));
  // A release's line and the lines of its batched changes stay together.
  const out = [];
  let keep = false;
  for (const line of range.text.split("\n")) {
    const v = /^(\d+\.\d+\.\d+)\s/.exec(line)?.[1];
    if (v) keep = shown.has(v);
    if (keep) out.push(line);
  }
  if (internal.length) out.push(`and ${internal.length} internal release${internal.length === 1 ? "" : "s"} (app-studio's own tooling: nothing in them reaches an app)`);
  if (old.length) out.push(`and ${old.length} older release${old.length === 1 ? "" : "s"}, ${old[old.length - 1].version} to ${old[0].version} (from before release records; their steps, if any, are under "Needs you")`);
  return out;
}

/**
 * One recorded step as an app should read it, or null when it asks for nothing. A record's step is a plain sentence ("none" asks
 * for nothing). A step of a release from before the records (`legacy`) is a whole changelog paragraph that only mentions an
 * **App action** or **Admin action** somewhere: what is kept is the sentence that starts at that marker, up to the next marker,
 * and nothing when it says "none". A paragraph with no such marker is kept whole unless it says there is no action.
 */
export function actionStep(step, who, legacy = false) {
  const text = String(step).trim();
  if (/^(none|nothing|n\/a|not needed)\.?$/i.test(text)) return null;
  if (!legacy) return text;
  const kind = who === "admin" ? "Admin" : "App";
  // "**App action:**", "**App action**:", "**App action** (only ...)"; at the start of the line the opening ** was already stripped.
  const marker = new RegExp(`(?:\\*\\*|^)${kind} action(?::\\*\\*|\\*\\*:|\\*\\*(?=\\s*\\())`, "gi");
  const stop = /\*\*(?:App|Admin|Ale) action|\sNo \*\*|\sNot verified/g;
  const found = [...text.matchAll(marker)];
  if (!found.length) return new RegExp(`\\bno \\*\\*${kind} action\\*\\*`, "i").test(text) ? null : text;
  const parts = [];
  for (const m of found) {
    const from = m.index + m[0].length;
    stop.lastIndex = from;
    const end = stop.exec(text)?.index ?? text.length;
    const body = text.slice(from, end).trim();
    if (body && !/^:?\s*(none|not needed|nothing)\b/i.test(body)) parts.push(body.replace(/^:\s*/, ""));
  }
  return parts.length ? parts.join(" ") : null;
}

const semver = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0);
const cmpVersion = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

function changelogFor(studio, since) {
  return syncReport(studio, since);
}

// ---------- release helpers (status, release-prepare) ----------

const gitOut = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
};
const bump = (v, kind) => {
  const [a, b, c] = semver(v);
  return kind === "minor" ? `${a}.${b + 1}.0` : kind === "major" ? `${a + 1}.0.0` : `${a}.${b}.${c + 1}`;
};
const isoDate = () => new Date().toISOString().slice(0, 10);

/**
 * Highest plugin version found on `main` and on every remote branch (open PRs), so a release PR
 * can take the next number that nobody else holds. Plain git reads; offline refs only.
 */
function claimedVersions(studio) {
  const out = [];
  const refs = (gitOut(studio, "for-each-ref", "--format=%(refname:short)", "refs/remotes/origin") ?? "").split("\n").filter((r) => r && !r.endsWith("/HEAD"));
  for (const ref of refs) {
    const t = gitOut(studio, "show", `${ref}:plugins/studio/.claude-plugin/plugin.json`);
    try {
      const v = t && JSON.parse(t).version;
      if (v) out.push({ ref, version: v });
    } catch {}
  }
  return out;
}

/** Read-only: where the harness version stands and what the next release may be called. */
export function studioStatus(studio) {
  const current = studioVersion(studio);
  const claimed = claimedVersions(studio);
  const top = [current, ...claimed.map((c) => c.version)].filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort(cmpVersion).pop();
  const held = claimed.filter((c) => cmpVersion(c.version, current) > 0);
  const rec = release ? release.loadAll(studio).find((r) => r.version === current) : null;
  const st = rec ? String(rec.status?.main ?? "pending") : null;
  const live = !rec ? "no release record for this version" : /^pending/i.test(st) ? "pending" : st;
  return {
    current,
    nextPatch: bump(top, "patch"),
    nextMinor: bump(top, "minor"),
    held: held.map((h) => `${h.version} (${h.ref})`),
    live,
    text: [
      `app-studio version on this checkout: ${current}`,
      `Versions already held by other branches: ${held.length ? held.map((h) => `${h.version} (${h.ref})`).join(", ") : "none"}`,
      `Next free: patch ${bump(top, "patch")}, minor ${bump(top, "minor")} (you choose: patch for wording and fixes, minor for a new skill, agent, hook, profile field or workflow change)`,
      `Newest release check on main: ${live}${live === "pending" ? ` (once it passed in studio-scratch: node scripts/release.mjs pass-main ${current}, plus any older pending versions)` : ""}`,
    ].join("\n"),
  };
}

/** The bump a list of conventional-commit subjects calls for, or null when none is user-facing. */
export function proposeBump(subjects, current) {
  const major1 = semver(current)[0] >= 1;
  const breaking = subjects.some((s) => /^\w+(\([^)]*\))?!:/.test(s) || /BREAKING CHANGE/.test(s));
  const feat = subjects.some((s) => /^feat(\([^)]*\))?:/.test(s));
  const fix = subjects.some((s) => /^(fix|perf)(\([^)]*\))?:/.test(s));
  if (breaking) return major1 ? "major" : "minor";
  if (feat) return "minor";
  if (fix) return "patch";
  return null;
}

/**
 * Pure: move `## [Unreleased]` into `## [version] - date`, leave an empty Unreleased, and fix the
 * compare links at the bottom. Returns { text } or { error }.
 */
export function applyRelease(text, version, date, { prevTag, repoUrl } = {}) {
  const src = text.replace(/\r\n/g, "\n");
  const start = src.search(/^## \[Unreleased\][^\n]*$/m);
  if (start < 0) return { error: "CHANGELOG.md has no `## [Unreleased]` heading." };
  const afterHead = src.indexOf("\n", start) + 1;
  const m = /^(## \[\d|\[[^\]]+\]: )/m.exec(src.slice(afterHead));
  const endRel = m ? m.index : src.length - afterHead;
  const body = src.slice(afterHead, afterHead + endRel).trim();
  if (!body) return { error: "`## [Unreleased]` has no entries to release." };
  if (new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m").test(src)) return { error: `CHANGELOG.md already has an entry for ${version}.` };
  let rest = src.slice(afterHead + endRel);
  const linkLines = [];
  const repo = repoUrl?.replace(/\.git$/, "");
  if (repo) {
    linkLines.push(`[Unreleased]: ${repo}/compare/v${version}...HEAD`);
    linkLines.push(prevTag ? `[${version}]: ${repo}/compare/${prevTag}...v${version}` : `[${version}]: ${repo}/releases/tag/v${version}`);
  }
  // Drop the old Unreleased link; the new ones go in front of the other links.
  rest = rest.replace(/^\[Unreleased\]: .*\n?/m, "");
  if (linkLines.length) rest = /^\[[^\]]+\]: /m.test(rest) ? rest.replace(/^(?=\[[^\]]+\]: )/m, `${linkLines.join("\n")}\n`) : `${rest.replace(/\s*$/, "\n")}\n${linkLines.join("\n")}\n`;
  const head = src.slice(0, start);
  return { text: `${head}## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n\n${rest.replace(/^\n+/, "")}`.replace(/\n{3,}/g, "\n\n") };
}

/**
 * Latest release tag (vX.Y.Z). Cloud checkouts are often shallow or made without tags, so a plain
 * `git describe` reports "none" although the tag exists on origin. Fetch the tags first (best effort),
 * take the highest version among the local tags, and fall back to asking origin directly.
 */
export function lastReleaseTag(app) {
  spawnSync("git", ["fetch", "--tags", "--quiet", "origin"], { cwd: app, encoding: "utf8", timeout: 20000 });
  const byVersion = (list) => list.filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).sort((a, b) => semver(b.slice(1)).reduce((d, n, i) => d || n - semver(a.slice(1))[i], 0))[0] ?? null;
  const local = byVersion((gitOut(app, "tag", "--list", "v*") ?? "").split("\n").map((t) => t.trim()));
  if (local) return local;
  const remote = (gitOut(app, "ls-remote", "--tags", "origin", "refs/tags/v*") ?? "").split("\n").map((l) => /refs\/tags\/(v[^\s^]+)$/.exec(l)?.[1]).filter(Boolean);
  return byVersion(remote);
}

/** `release-prepare`: dry run by default; `apply` edits CHANGELOG.md. Version choice stays with the caller. */
export function releasePrepare(app, { version, apply = false, date = isoDate() } = {}) {
  const file = join(app, "CHANGELOG.md");
  if (!existsSync(file)) return { ok: false, text: "No CHANGELOG.md in the app." };
  let current = "0.0.0";
  try { current = JSON.parse(readFileSync(join(app, "package.json"), "utf8")).version ?? current; } catch {}
  const tag = lastReleaseTag(app);
  const subjects = (gitOut(app, "log", tag ? `${tag}..HEAD` : "HEAD", "--format=%s%n%b") ?? (tag ? gitOut(app, "log", "HEAD", "--format=%s%n%b") : null) ?? "").split("\n").filter(Boolean);
  const kind = proposeBump(subjects, tag ? tag.slice(1) : current);
  const proposed = kind ? bump(tag ? tag.slice(1) : current, kind) : null;
  const chosen = version ?? proposed;
  const lines = [
    `Last tag: ${tag ?? "none"}; package.json version: ${current}; commits since the tag: ${subjects.length ? "see log" : "none"}.`,
    `Proposed bump: ${kind ?? "none (no feat/fix/perf commits: nothing user-facing)"}${proposed ? ` -> ${proposed}` : ""}${version ? `; you chose ${version}` : ""}.`,
  ];
  if (!chosen) return { ok: false, text: [...lines, "No release proposed. Pass --version X.Y.Z to force one."].join("\n") };
  if (!/^\d+\.\d+\.\d+$/.test(chosen)) return { ok: false, text: `Not a version: ${chosen}` };
  if (gitOut(app, "rev-parse", "-q", "--verify", `refs/tags/v${chosen}`)) return { ok: false, text: [...lines, `Tag v${chosen} already exists: never move it; pick another version.`].join("\n") };
  const repoUrl = (gitOut(app, "remote", "get-url", "origin") ?? "").trim().replace(/^git@github\.com:/, "https://github.com/") || null;
  const r = applyRelease(readFileSync(file, "utf8"), chosen, date, { prevTag: tag, repoUrl });
  if (r.error) return { ok: false, text: [...lines, r.error].join("\n") };
  if (apply) writeFileSync(file, r.text);
  lines.push(apply ? `CHANGELOG.md updated: Unreleased moved under ## [${chosen}] - ${date}, compare links fixed.` : `Dry run: CHANGELOG.md not changed. Would move Unreleased under ## [${chosen}] - ${date} and fix the compare links.`, apply ? `Still yours: the wording, and \`npm version ${chosen} --no-git-tag-version\`.` : `To cut it (branch, package.json, this changelog move): release-cut --version ${chosen}.`);
  return { ok: true, version: chosen, text: lines.join("\n") };
}

/**
 * `release-cut`: the mechanical part of an app release (release skill steps 1-5). Stops, changing
 * nothing, unless the release gate passes, the tree is clean and HEAD is origin/main (main is pulled
 * first). Then: release branch (a session branch already on origin/main is kept), package.json via
 * `npm version`, and the changelog. It never commits, pushes or merges; the version is the caller's.
 */
export function releaseCut(app, { version, date = isoDate() } = {}) {
  const stop = (...why) => ({ ok: false, text: ["Release cut stopped, nothing changed:", ...why.map((w) => `  - ${w}`)].join("\n") });
  if (!version) return stop("pass --version X.Y.Z (run release-prepare first for the proposed one; the choice is yours)");
  if (!/^\d+\.\d+\.\d+$/.test(version)) return stop(`not a version: ${version}`);
  const blockers = releaseBlockers(app);
  if (blockers.length) return stop(...blockers);
  if ((gitOut(app, "status", "--porcelain") ?? "x").trim()) return stop("the working tree is not clean: commit or drop the changes first");
  if (gitOut(app, "fetch", "-q", "origin", "main") === null) return stop("could not fetch origin main");
  const branch = (gitOut(app, "rev-parse", "--abbrev-ref", "HEAD") ?? "").trim();
  if (branch === "main" && gitOut(app, "merge", "--ff-only", "-q", "origin/main") === null) return stop("main can't fast-forward to origin/main: sort that out first");
  const head = (gitOut(app, "rev-parse", "HEAD") ?? "").trim();
  if (!head || head !== (gitOut(app, "rev-parse", "origin/main") ?? "").trim())
    return stop(`HEAD (${branch}) is not origin/main: release only what is on main (git switch main && git pull, or start the session branch from origin/main)`);
  const dry = releasePrepare(app, { version, date });
  if (!dry.ok) return stop(dry.text.split("\n").pop());
  const done = [];
  if (branch === "main") {
    if (gitOut(app, "switch", "-q", "-c", `chore/release-v${version}`) === null) return stop(`could not create branch chore/release-v${version}`);
    done.push(`on new branch chore/release-v${version}`);
  } else done.push(`kept branch ${branch} (it is origin/main)`);
  if (existsSync(join(app, "package.json"))) {
    const npm = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["version", version, "--no-git-tag-version", "--allow-same-version"], { cwd: app, encoding: "utf8" });
    if (npm.status !== 0) return { ok: false, text: [...done.map((d) => `  ${d}`), `npm version ${version} failed: ${(npm.stderr || npm.stdout).trim()}`].join("\n") };
    done.push(`package.json${existsSync(join(app, "package-lock.json")) ? " and package-lock.json" : ""} set to ${version}`);
  }
  releasePrepare(app, { version, date, apply: true });
  done.push(`CHANGELOG.md: Unreleased moved under ## [${version}] - ${date}, compare links fixed`);
  return {
    ok: true,
    text: [
      `Release ${version} cut:`,
      ...done.map((d) => `  ${d}`),
      "Still yours: tidy the wording of the new changelog section, run `npm run check`, then",
      `  git commit -am "chore(release): v${version}", push and merge it (CLAUDE.md "Git workflow"). CI green on main and the full run are checked by you, not by this command.`,
    ].join("\n"),
  };
}

/** `release-tag-check`: is tag vX.Y.Z on origin? Without the Release tag workflow, the by-hand steps. */
export function tagCheck(app, version) {
  const v = String(version ?? "").replace(/^v/, "");
  const tag = `v${v}`;
  const found = (gitOut(app, "ls-remote", "--tags", "origin", `refs/tags/${tag}`) ?? "").trim();
  if (found) return { ok: true, text: `Tag ${tag} is on origin. Never move or delete it.` };
  const workflow = existsSync(join(app, ".github/workflows/release-tag.yml"));
  return {
    ok: false,
    text: workflow
      ? `Tag ${tag} is not on origin yet. The Release tag workflow makes it once the release commit is on main: wait for its run on main, then run this again.`
      : [
          `Tag ${tag} is not on origin, and this app has no Release tag workflow (.github/workflows/release-tag.yml), so tag by hand:`,
          `  git switch main && git pull && git tag -a ${tag} -m "${tag}" && git push origin ${tag}`,
          "  In a cloud session that push is refused: record the tag in docs/RELEASES.md with the commit, carry on, and suggest adding the workflow (harness-sync).",
        ].join("\n"),
  };
}

const SYNC_FORWARD = { "--force": "force", "--live-check": "liveCheck", "--dry-run": "dry" };

/**
 * `sync`: harness-sync's mechanical steps in one go. Fast-forward app-studio to origin main, then
 * app-studio's own (just pulled) script runs `pull` and, only if that changed everything cleanly,
 * `health`. The live-check gate and the edited-file refusal stay inside `pull`.
 */
function syncApp(app, studio, opts) {
  const out = [];
  if (existsSync(join(studio, ".git"))) {
    // fetch + fast-forward from origin main, not `git pull`: a cloud session's app-studio clone can sit on a
    // session branch with no upstream.
    let g = spawnSync("git", ["-C", studio, "fetch", "-q", "origin", "main"], { encoding: "utf8" });
    if (g.status === 0) g = spawnSync("git", ["-C", studio, "merge", "--ff-only", "-q", "FETCH_HEAD"], { encoding: "utf8" });
    if (g.status !== 0) {
      console.log(`Could not pull app-studio (${studio}): ${(g.stderr || g.stdout).trim()}\nNothing in the app was changed. Fix the app-studio checkout, then run sync again.`);
      return 1;
    }
    out.push(`app-studio pulled (v${studioVersion(studio)}).`);
  } else out.push(`app-studio at ${studio} is not a git checkout, so it was not pulled.`);
  // Apps get releases, code included: the pull and the health check run the sync script of the current release, not what merged
  // since (the live check alone runs the checkout as it is).
  let from = studio;
  if (!opts.liveCheck) {
    const view = releasedView(studio);
    if (view.error) {
      console.log(view.error);
      return 1;
    }
    from = view.dir;
  }
  const master = join(from, "scripts/studio-sync.mjs");
  const step = (...a) => spawnSync(process.execPath, [master, ...a, "--app", app, "--studio", from], { encoding: "utf8" });
  // The version this sync started on survives a stop: a --force rerun finds the lock already moved, and would
  // otherwise print no changelog excerpt (so an App action could be missed).
  const marker = join(app, ".git", "studio-sync-from");
  const lockNow = readLock(app)?.studio;
  let start = lockNow;
  if (existsSync(marker)) start = readFileSync(marker, "utf8").trim() || lockNow;
  const fingerprint = () => [LOCK, "CLAUDE.md"].map((f) => (existsSync(join(app, f)) ? readFileSync(join(app, f), "utf8") : "")).join("\0");
  const fpBefore = fingerprint();
  const p = step("pull", ...Object.keys(SYNC_FORWARD).filter((f) => opts[SYNC_FORWARD[f]]));
  if (opts.dry) {
    // A preview: the pull printed what it would do and its report; nothing in the app changed, so no health run and no commit line.
    console.log([...out, p.stdout.trim(), p.stderr.trim()].filter(Boolean).join("\n"));
    return p.status;
  }
  const now = studioVersion(studio);
  const pullOut = p.stdout.trim();
  // The pull prints the report itself when it moved the app; a gate refusal changed nothing, so it shows none.
  const refused = /not live-checked yet/.test(p.stderr);
  const excerpt = start && start !== now && !refused && !pullOut.includes(`Releases ${start} ->`) ? changelogFor(studio, start) : "";
  out.push(pullOut, ...(excerpt ? ["", excerpt] : []));
  if (p.status !== 0) {
    if (existsSync(join(app, ".git")) && start && start !== now) writeFileSync(marker, start);
    if (p.stderr.trim()) out.push(p.stderr.trim());
    if (/skipped/.test(p.stdout))
      out.push("", "Sync stopped: the files above were edited here. For each, send the change as a harness-idea (if it helps every app) or move it to the App profile (if app-specific), then run sync again with --force.");
    console.log(out.filter(Boolean).join("\n"));
    return 1;
  }
  const h = step("health", ...(opts.liveCheck ? ["--live-check"] : []));
  out.push("", h.stdout.trim());
  if (h.status !== 0) {
    out.push("Sync stopped: fix what health reports (the commit hook blocks the commit otherwise), then run health again.");
    console.log(out.join("\n"));
    return 1;
  }
  rmSync(marker, { force: true });
  const changed = start !== now || fingerprint() !== fpBefore;
  if (!changed) {
    out.push("", "Sync done: already in step, nothing to commit.");
  } else {
    out.push(
      "",
      "Still yours: apply any App action in the report above, relay any Admin action, list this app's fixed and declined ideas, and pass on any Project instructions prompt.",
      `Then commit "chore(harness): sync studio v${now}" and merge it via a PR (CLAUDE.md "Git workflow").`,
    );
  }
  console.log(out.join("\n"));
  return 0;
}

// ---------- stack packs ----------

const packDir = (studio, name) => join(studio, "packs", name);

// A pack's `kind`: "stack" (how the app is built and shipped; the default) or "module" (a feature
// the app opts into, e.g. `ai`). Both install the same way; the kind only tells them apart.
const KINDS = ["stack", "module"];

export function readPack(studio, name) {
  const file = join(packDir(studio, name), "pack.json");
  if (!existsSync(file)) throw new Error(`No pack named "${name}" in app-studio (packs/).`);
  const pack = JSON.parse(readFileSync(file, "utf8"));
  if (pack.kind !== undefined && !KINDS.includes(pack.kind))
    throw new Error(`Pack "${name}" has kind "${pack.kind}"; use ${KINDS.map((k) => `"${k}"`).join(" or ")}.`);
  return pack;
}

export const packKind = (studio, name) => readPack(studio, name).kind ?? "stack";

// Platform methods a module adds (its pack.json `platformMethods`, e.g. the ai module's `sample`).
// An app that calls one without that module has old platform files that still declare it; new
// starter files from app-studio would drop it and break the build, so pull holds them back.
const CODE_DIRS = ["src", "tests", "e2e"];
const CODE_FILE = /\.(ts|tsx|js|mjs)$/;
// The harness's own platform tests (tests/unit/platform.test.ts, artifact-platform.test.ts, ...) call every method.
const PLATFORM_TEST = /^tests\/(?:.*\/)?[^/]*platform[^/]*\.test\.[a-z]+$/;

/**
 * Modules the app calls into without having them: [{ pack, methods }]. Only the app's own code
 * counts: the platform layer (src/platform/), its platform tests and harness starter files the app never edited are
 * the harness's old copies (they may call the old built-in AI), not the app using AI.
 */
export function missingModules(app, studio, packs) {
  const wanted = listPacks(studio)
    .filter((n) => !packs.includes(n))
    .map((n) => ({ pack: n, methods: readPack(studio, n).platformMethods ?? [] }))
    .filter((m) => m.methods.length);
  if (!wanted.length) return [];
  const starters = readLock(app)?.starters ?? {};
  const code = CODE_DIRS.flatMap((d) => listFiles(join(app, d)))
    .filter((f) => CODE_FILE.test(f))
    .filter((f) => {
      const rel = toPosix(relative(app, f));
      return !rel.startsWith("src/platform/") && !PLATFORM_TEST.test(rel) && !(rel in starters && localHash(app, rel) === starters[rel].installed);
    })
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  return wanted
    .map(({ pack, methods }) => ({
      pack,
      methods: methods.filter((m) => new RegExp(`\\.\\s*${m}\\s*\\(`).test(code)),
    }))
    .filter((m) => m.methods.length);
}

/** Why pull holds back starter files, or null: "the app calls sample() (ai module): run pack add ai first". */
export function holdReason(missing) {
  if (!missing.length) return null;
  const calls = missing.map((m) => `${m.methods.map((x) => `${x}()`).join(", ")} (${m.pack} module)`).join("; ");
  return `the app calls ${calls} but doesn't have the module: run pack add ${missing.map((m) => m.pack).join(" ")} first`;
}

/** Modules whose stack partner is missing (pack.json `alsoWith`: { "web": "ai-web" }). */
export function partnerGaps(studio, packs) {
  const gaps = [];
  for (const n of packs) {
    const also = readPack(studio, n).alsoWith ?? {};
    for (const [stack, partner] of Object.entries(also))
      if (packs.includes(stack) && !packs.includes(partner)) gaps.push(`${n} on ${stack} needs ${partner} too: run pack add ${partner}`);
  }
  return gaps;
}

/** Names split by kind, for messages: "artifact, base, web; modules: ai". */
function byKind(studio, names) {
  const modules = names.filter((n) => packKind(studio, n) === "module");
  const stacks = names.filter((n) => !modules.includes(n));
  return [stacks.join(", "), modules.length && `modules: ${modules.join(", ")}`].filter(Boolean).join("; ");
}

export function listPacks(studio) {
  const dir = join(studio, "packs");
  return existsSync(dir)
    ? readdirSync(dir).filter((n) => existsSync(join(dir, n, "pack.json"))).sort()
    : [];
}

/** The names with everything they require, requirements first. */
export function packClosure(studio, names) {
  const out = [];
  const visit = (name, trail = []) => {
    if (trail.includes(name)) throw new Error(`Packs require each other in a loop: ${[...trail, name].join(" > ")}`);
    if (out.includes(name)) return;
    for (const dep of readPack(studio, name).requires ?? []) visit(dep, [...trail, name]);
    out.push(name);
  };
  names.forEach((n) => visit(n));
  return out;
}

// Function replacers: a "$" in a name is text, not a replacement pattern.
const fill = (text, vars) =>
  text.replaceAll("{{slug}}", () => vars.slug).replaceAll("{{title}}", () => vars.title);

// Filling in a long app name can push a starter line past Prettier's width, and `npm run check` would
// fail on a brand-new app. So a code file whose text changed is formatted with the base pack's own
// Prettier settings, here, before it is hashed and written. If Prettier isn't installed the file is
// left as filled in (`npm run format` fixes it).
const formatted = new Map();
function formatFilled(studio, path, text, original) {
  if (text === original || !/\.(ts|tsx|js|mjs)$/.test(path)) return text;
  const config = join(packDir(studio, "base"), "starter", ".prettierrc.json");
  if (!existsSync(config)) return text;
  const key = `${path}\0${text}`;
  if (!formatted.has(key)) {
    const res = spawnSync("prettier", ["--config", config, "--stdin-filepath", path], { input: text, encoding: "utf8" });
    formatted.set(key, res.status === 0 && res.stdout ? res.stdout : text);
  }
  return formatted.get(key);
}

export function checkVars({ slug, title }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug))
    throw new Error(`--slug must be lowercase letters, digits and hyphens (got "${slug}").`);
  if (!title.trim() || /["\\`$<>&]/.test(title))
    throw new Error('--title may not contain " \\ ` $ < > & (it is written into code, JSON and HTML).');
}

export function defaultVars(app) {
  const slug =
    basename(resolve(app)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  const title = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { slug, title };
}

// { "<app path>": { src: "<absolute master path>", hash } }
export function masterFiles(studio, packs = []) {
  const files = {};
  for (const [from, to] of TREES) {
    const base = join(studio, from);
    for (const src of listFiles(base)) {
      files[`${to}/${toPosix(relative(base, src))}`] = { src, hash: hashFile(src) };
    }
  }
  const self = join(studio, "scripts", "studio-sync.mjs");
  files[SELF] = { src: self, hash: hashFile(self) };
  // A pack's managed files: kept in step like the skills.
  for (const name of packs) {
    const base = join(packDir(studio, name), "managed");
    for (const src of listFiles(base, { dotfiles: true })) {
      files[`.claude/packs/${name}/${toPosix(relative(base, src))}`] = { src, hash: hashFile(src) };
    }
  }
  // A module may ship skills (`skills/<skill>/...`) and agents (`agents/<agent>.md`): they land in
  // .claude/skills/ and .claude/agents/ like the core's. A name the core or an earlier pack already
  // has stays theirs, whole (packClashes reports it; `pack add` and `health` fail on it).
  const owner = new Map(Object.keys(files).map((p) => [unitOf(p), "core"]));
  for (const name of packs) {
    for (const [path, src] of Object.entries(packShared(studio, name))) {
      const unit = unitOf(path);
      if (!owner.has(unit)) owner.set(unit, name);
      if (owner.get(unit) === name) files[path] = { src, hash: hashFile(src), pack: name };
    }
  }
  return files;
}

// Skills and agents a pack ships beside `managed/` and `starter/`, as [pack folder, app folder].
const PACK_SHARED = [
  ["skills", ".claude/skills"],
  ["agents", ".claude/agents"],
];

/** The skill and agent files a pack ships: { "<app path>": "<absolute master path>" }. */
function packShared(studio, name) {
  const out = {};
  for (const [from, to] of PACK_SHARED) {
    const base = join(packDir(studio, name), from);
    for (const src of listFiles(base)) {
      const rel = toPosix(relative(base, src));
      if (from === "agents" && (rel.includes("/") || !rel.endsWith(".md"))) continue; // an agent is one .md file
      if (from === "skills" && !rel.includes("/")) continue; // a skill is a folder
      out[`${to}/${rel}`] = src;
    }
  }
  return out;
}

/** The skill folder or agent file an app path belongs to (".claude/skills/x", ".claude/agents/x.md"), or null. */
function unitOf(path) {
  const m = /^(\.claude\/skills\/[^/]+)\/|^(\.claude\/agents\/[^/]+\.md)$/.exec(path);
  return m ? (m[1] ?? m[2]) : null;
}
const unitMain = (unit) => (unit.startsWith(".claude/skills/") ? `${unit}/SKILL.md` : unit);
const unitLabel = (unit) => `${unit.startsWith(".claude/skills/") ? "skill" : "agent"} "${basename(unit, ".md")}"`;

/** Skills and agents two sources ship under one name: a pack against the core, or against an earlier pack. [{ pack, text }]. */
export function packClashes(studio, packs) {
  const owner = new Map(Object.keys(masterFiles(studio)).filter(unitOf).map((p) => [unitOf(p), "the core"]));
  const clashes = [];
  for (const name of packs) {
    for (const unit of new Set(Object.keys(packShared(studio, name)).map(unitOf))) {
      if (!owner.has(unit)) owner.set(unit, `the ${name} pack`);
      else clashes.push({ pack: name, text: `the ${name} pack ships the ${unitLabel(unit)}, which ${owner.get(unit)} already ships: one name, one owner` });
    }
  }
  return clashes;
}

/**
 * A pack's skills and agents whose name the app already uses for one of its own: the folder or file is
 * there (an empty folder is nobody's), the lock doesn't know it, and it isn't the pack's text.
 * [{ unit, pack }]. (A core file in the way stays what it was: one skipped file.)
 */
const unitThere = (app, unit) => {
  const p = join(app, unit);
  return existsSync(p) && (!statSync(p).isDirectory() || readdirSync(p).length > 0);
};
function ownClashes(app, lockFiles, master) {
  const known = new Set(Object.keys(lockFiles).map(unitOf));
  const out = new Map();
  for (const [path, m] of Object.entries(master)) {
    const unit = unitOf(path);
    if (!unit || !m.pack || out.has(unit) || known.has(unit) || !unitThere(app, unit)) continue;
    const main = master[unitMain(unit)];
    if (main && localHash(app, unitMain(unit)) === main.hash) continue; // the pack's own text, just not recorded yet
    out.set(unit, { unit, pack: m.pack });
  }
  return [...out.values()];
}
const ownClashText = ({ unit, pack }, then = "run pull") =>
  `${unit}: the app's own ${unitLabel(unit)} has the name of one the ${pack} pack ships. Rename the app's own (folder or file, and its \`name:\`), then ${then}`;

// { "<app path>": { pack, src, text, hash } } with {{slug}} and {{title}} filled in.
// `all` is every pack the app has: a pack's `supersededBy` map ({ "<path>": ["<pack>"] }) drops its
// own starter at that path when one of those packs is present (the web pack's CI covers an
// artifact prototype too, so a hybrid app gets one workflow, not two).
export function starterFiles(studio, packs, vars, all = packs) {
  const files = {};
  for (const name of packs) {
    const base = join(packDir(studio, name), "starter");
    const superseded = readPack(studio, name).supersededBy ?? {};
    for (const src of listFiles(base, { dotfiles: true })) {
      const path = toPosix(relative(base, src));
      if ((superseded[path] ?? []).some((other) => all.includes(other))) continue;
      const raw = readFileSync(src, "utf8");
      const text = formatFilled(studio, path, fill(raw, vars), raw);
      if (path in files) throw new Error(`Packs ${files[path].pack} and ${name} both ship ${path}.`);
      files[path] = { pack: name, src, text, hash: hashText(text) };
    }
  }
  return files;
}

/** Adds the pack's scripts and dependencies to the app's package.json; never overwrites a key. */
export function mergePackageJson(app, studio, packs, vars) {
  const file = join(app, "package.json");
  const pkg = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { name: vars.slug, version: "0.0.0", private: true, type: "module", engines: { node: ">=22" } };
  const added = [];
  for (const name of packs) {
    const add = readPack(studio, name).packageJson ?? {};
    for (const [section, entries] of Object.entries(add)) {
      pkg[section] ??= {};
      for (const [key, value] of Object.entries(entries)) {
        if (key in pkg[section]) continue;
        pkg[section][key] = value;
        added.push(`${section}.${key}`);
      }
      if (section.endsWith("ependencies")) {
        pkg[section] = Object.fromEntries(Object.entries(pkg[section]).sort(([x], [y]) => x.localeCompare(y)));
      }
    }
  }
  if (added.length) writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  return added;
}

export function readLock(app) {
  const p = join(app, LOCK);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function writeLock(app, lock) {
  const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const out = { studio: lock.studio };
  if (lock.packs && Object.keys(lock.packs).length) out.packs = sortKeys(lock.packs);
  if (lock.app) out.app = lock.app;
  if (lock.instructions) out.instructions = lock.instructions;
  if (lock.unreleased === true) out.unreleased = true;
  if (lock.since) out.since = lock.since;
  if (Array.isArray(lock.ownStarters)) out.ownStarters = lock.ownStarters.filter((name) => name in (lock.packs ?? {})).sort();
  out.files = sortKeys(lock.files);
  if (lock.starters && Object.keys(lock.starters).length) out.starters = sortKeys(lock.starters);
  mkdirSync(dirname(join(app, LOCK)), { recursive: true });
  writeFileSync(join(app, LOCK), `${JSON.stringify(out, null, 2)}\n`);
}

/** Deletes a managed file, and the folders it leaves empty (an empty skill folder would read as a broken skill of the app's own). */
function removeManaged(app, path) {
  rmSync(join(app, path));
  for (let dir = dirname(path); dir.startsWith(".claude/") && !readdirSync(join(app, dir)).length; dir = dirname(dir)) rmdirSync(join(app, dir));
}

const localHash = (app, path) => (existsSync(join(app, path)) ? hashFile(join(app, path)) : null);

// Pure comparison; studio may be null (then only local edits are checked).
export function compare(app, studio) {
  const lock = readLock(app);
  const report = {
    installed: !!lock,
    edited: [],
    missing: [],
    behind: [],
    added: [],
    removed: [],
    starters: [],
  };
  if (!lock) return report;
  report.version = lock.studio;
  for (const [path, hash] of Object.entries(lock.files)) {
    const cur = localHash(app, path);
    if (cur === null) report.missing.push(path);
    else if (cur !== hash) report.edited.push(path);
  }
  if (studio) {
    report.studioVersion = studioVersion(studio);
    const master = masterFiles(studio, Object.keys(lock.packs ?? {}));
    for (const [path, { hash }] of Object.entries(master)) {
      if (!(path in lock.files)) report.added.push(path);
      else if (lock.files[path] !== hash) report.behind.push(path);
    }
    for (const path of Object.keys(lock.files)) if (!(path in master)) report.removed.push(path);
    // Starter files are the app's own; a changed one in app-studio is a note, never drift.
    const vars = lock.app ?? defaultVars(app);
    const packs = Object.keys(lock.packs ?? {});
    const starters = starterFiles(studio, packs, vars);
    const held = holdReason(missingModules(app, studio, packs));
    if (held) report.held = held;
    for (const [path, rec] of Object.entries(lock.starters ?? {})) {
      const m = starters[path];
      if (!m || m.hash === rec.seen) continue;
      const cur = localHash(app, path);
      if (cur === m.hash) continue; // already equals the current starter (e.g. only formatting differed from the last install): nothing to merge
      report.starters.push({ path, pack: rec.pack, refreshable: !held && cur === rec.installed });
    }
    // A pack whose starters the app never took (it keeps its own files) has nothing "new" for it.
    const own = ownFilesPacks(lock, starters);
    report.newStarters = Object.keys(starters).filter((p) => !own.has(starters[p].pack) && !(p in (lock.starters ?? {})) && localHash(app, p) === null);
    report.partners = partnerGaps(studio, packs);
    const ih = instructionsHash(studio);
    report.instructionsChanged = !!ih && lock.instructions !== ih;
  }
  return report;
}

/**
 * The app's packs whose starter files it never took: the app predates them (or was moved onto the harness by hand) and keeps its
 * own CI, configs and code there. A pull never adds such a pack's starter files. The lock records the answer (`ownStarters`), decided
 * once, at the first pull that finds no record: every pack that ships starter files (`starters`: what app-studio ships now) of which
 * the lock tracks none. Later a pack is never added to the list, so a pack that gains its first starter file still delivers it, and
 * a pack added with `pack add` brings its files and is tracked like any other.
 */
export function ownFilesPacks(lock, starters = {}) {
  const have = Object.keys(lock?.packs ?? {});
  if (Array.isArray(lock?.ownStarters)) return new Set(lock.ownStarters.filter((name) => have.includes(name)));
  const tracked = new Set(Object.values(lock?.starters ?? {}).map((rec) => rec.pack));
  const ships = new Set(Object.values(starters).map((m) => m.pack));
  return new Set(have.filter((name) => ships.has(name) && !tracked.has(name)));
}

export const drift = (r) =>
  !r.installed ||
  [r.edited, r.missing, r.behind, r.added, r.removed].some((list) => list.length > 0);

function readLockForPull(app, force) {
  try {
    return readLock(app) ?? { files: {} };
  } catch (e) {
    // A corrupt lock: --force rebuilds it from what is on disk.
    if (!force) throw new Error(`${LOCK} is unreadable (${e.message}). Pass --force to rebuild it.`);
    return { files: {} };
  }
}

/**
 * `dry`: nothing is written (no file, no lock, no CLAUDE.md); the result says what a real pull would do.
 * `fresh`: packs being added right now (`pack add`), whose starter files come in although the lock tracks none of them yet.
 */
export function pull(app, studio, { force = false, patch = true, dry = false, fresh = [] } = {}) {
  const lock = readLockForPull(app, force);
  const packs = Object.keys(lock.packs ?? {});
  for (const name of packs) readPack(studio, name); // a pack gone from app-studio fails before any file moves
  const files = { ...lock.files };
  const result = { written: [], deleted: [], skipped: [], refreshed: [], starterNotes: [], created: [], held: [], untaken: [], untakenPacks: [], newAgents: [] };
  const master = masterFiles(studio, packs);
  // A pack's skill or agent never lands in the app's own folder of the same name: it is left whole and reported.
  // --force is for edited shared files; it never overwrites something the app wrote itself.
  const clashes = ownClashes(app, files, master);
  result.clashes = [...packClashes(studio, packs).map((c) => c.text), ...clashes.map((c) => ownClashText(c))];
  const taken = new Set(clashes.map((c) => c.unit));

  for (const [path, { src, hash }] of Object.entries(master)) {
    if (taken.has(unitOf(path))) continue;
    const cur = localHash(app, path);
    if (cur === hash) {
      files[path] = hash;
      continue;
    }
    // Keep a local change (or an unmanaged file in the way) unless forced.
    const known = files[path];
    if (cur !== null && cur !== known && !force) {
      result.skipped.push(path);
      continue;
    }
    if (!dry) {
      mkdirSync(dirname(join(app, path)), { recursive: true });
      copyFileSync(src, join(app, path));
    }
    files[path] = hash;
    result.written.push(path);
    // An agent file the app did not have: the running session listed its agents before this file existed (#420).
    const agent = cur === null && /^\.claude\/agents\/([^/]+)\.md$/.exec(path);
    if (agent) result.newAgents.push(agent[1]);
  }
  for (const path of Object.keys(files)) {
    if (path in master) continue;
    const cur = localHash(app, path);
    if (cur !== null && cur !== files[path] && !force) {
      result.skipped.push(path);
      continue;
    }
    if (cur !== null && !dry) removeManaged(app, path);
    delete files[path];
    result.deleted.push(path);
  }

  // Pack versions follow what was pulled; starters the app has not touched are refreshed, ones a
  // pack gained are created where nothing is in the way, the others are noted for a manual merge
  // (then `ack`). All of that is held back while the app calls a module it doesn't have.
  const newLock = { ...lock, studio: studioVersion(studio), files };
  if (!Array.isArray(newLock.ownStarters)) newLock.ownStarters = []; // decided: no pack to leave out (replaced below when the app has packs)
  if (!newLock.since) newLock.since = new Date().toISOString().slice(0, 10); // the date of the app's first install or sync: where health's grace periods count from
  if (packs.length) {
    newLock.packs = Object.fromEntries(packs.map((n) => [n, readPack(studio, n).version]));
    const starters = starterFiles(studio, packs, lock.app ?? defaultVars(app));
    newLock.starters = { ...lock.starters };
    result.holdReason = holdReason(missingModules(app, studio, packs));
    const own = ownFilesPacks(lock, starters);
    for (const name of fresh) own.delete(name);
    newLock.ownStarters = [...own];
    for (const [path, m] of Object.entries(starters)) {
      if (path in (lock.starters ?? {}) || localHash(app, path) !== null) continue;
      if (own.has(m.pack)) {
        result.untaken.push(path); // the app keeps its own files where this pack has starters: none is "new" for it
        if (!result.untakenPacks.includes(m.pack)) result.untakenPacks.push(m.pack);
        continue;
      }
      if (result.holdReason) {
        result.held.push(path);
        continue;
      }
      if (!dry) {
        mkdirSync(dirname(join(app, path)), { recursive: true });
        writeFileSync(join(app, path), m.text);
      }
      newLock.starters[path] = { pack: m.pack, installed: m.hash, seen: m.hash };
      result.created.push(path);
    }
    for (const [path, rec] of Object.entries(lock.starters ?? {})) {
      const m = starters[path];
      if (!m || m.hash === rec.seen) continue;
      if (result.holdReason) result.held.push(path);
      else if (localHash(app, path) === m.hash) {
        newLock.starters[path] = { pack: rec.pack, installed: m.hash, seen: m.hash }; // already the current starter: record it, nothing to merge
      } else if (localHash(app, path) === rec.installed) {
        if (!dry) writeFileSync(join(app, path), m.text);
        newLock.starters[path] = { pack: rec.pack, installed: m.hash, seen: m.hash };
        result.refreshed.push(path);
      } else {
        result.starterNotes.push(path);
      }
    }
  }
  if (!dry) writeLock(app, newLock);
  result.patched = patch ? patchProfile(app, studio, { dry }) : [];
  return result;
}

// Harness-owned sections of the app's CLAUDE.md: the template wraps them in
// `<!-- studio:begin NAME ... -->` / `<!-- studio:end NAME -->`, and a pull replaces what is between the
// markers with the template's text. Everything outside the markers stays the app's. An app from before the
// markers existed gets them once, where the known first and last lines of the section are found (`from`
// to the line before `until`); if those lines aren't found it is left alone and reported.
const OWNED_BEGIN = /^<!--\s*studio:begin\s+([\w-]+)\b.*-->\s*$/;
// Exact wording the Roles bullets (first three) had in earlier templates, before they were harness-owned. Only an exact match is rewritten.
const ROLES_KNOWN = [
  // before 0.24.2, until e74cd26..78277da era (shorter "Ask Ale" line)
  ["- **Ale (PM and tester).** Describes requirements, sets priority by ordering the backlog, tests releases and reports results. Ale does not write code, run commands or manage git. The few things only Ale can do (creating a repo, adding a repository secret, a host's settings) Claude hands over as exact clicks.",
    "- **Claude (engineer).** Owns all code, tests, versioning, releases and the harness. Turns Ale's words into PRD and backlog changes, builds, ships and hands over a test script.",
    "- Ask Ale only when a requirement is genuinely ambiguous or a decision is product-level. Everything technical is ours to decide; record the decision in the PR description or `docs/PRD.md` \"Decisions\"."],
  // 0.23.x to 0.24.1
  ["- **Ale (PM and tester).** Describes requirements, sets priority by ordering the backlog, tests releases and reports results. Ale does not write code, run commands or manage git. The few things only Ale can do (creating a repo, adding a repository secret, a host's settings) Claude hands over as exact clicks.",
    "- **Claude (engineer).** Owns all code, tests, versioning, releases and the harness. Turns Ale's words into PRD and backlog changes, builds, ships and hands over a test script.",
    "- Ask Ale only when a requirement is genuinely ambiguous or a decision is product-level. Ask one question at a time, each with a recommended answer and one line on why. Everything technical is ours to decide."],
  // 0.24.2 (persona wording, not yet marked)
  ["- **The App Creator (PM) and the Tester.** The App Creator is also the Tester unless someone else tests. The App Creator describes requirements and sets priority by ordering the backlog; the Tester tests releases and reports results. Neither writes code, runs commands or manages git. The few things only the Admin can do (creating a repo, adding a repository secret, a host's settings) Claude hands over as exact clicks.",
    "- **Claude (engineer).** Owns all code, tests, versioning, releases and the harness. Turns the App Creator's words into PRD and backlog changes, builds, ships and hands over a test script.",
    "- Ask the App Creator only when a requirement is genuinely ambiguous or a decision is product-level. Ask one question at a time, each with a recommended answer and one line on why. Everything technical is ours to decide."],
];
const OWNED_LEGACY = { "merge-rule": { from: /^- \*\*Merging a PR\*\*/, until: /^- \*\*The checks\.\*\*/ }, roles: { known: ROLES_KNOWN }, "thread-reports": { insertBefore: /^- One thread per backlog item\./ } };

function ownedSection(lines, name) {
  const b = lines.findIndex((l) => OWNED_BEGIN.test(l) && l.match(OWNED_BEGIN)[1] === name);
  if (b < 0) return null;
  const e = lines.findIndex((l, i) => i > b && new RegExp(`^<!--\\s*studio:end\\s+${name}\\s*-->\\s*$`).test(l));
  return e < 0 ? null : { b, e };
}

/** Brings the template's harness-owned sections into `lines` (edited in place); returns what changed. */
export // The writing section is headed "Writing for Ale" (old) or "Writing for the App Creator" (new); both are accepted.
const WRITING_HEADING = /^##\s+Writing for (?:Ale|the App Creator)\b/;

function syncOwnedSections(lines, tplLines) {
  const done = [];
  for (const l of tplLines) {
    const m = l.match(OWNED_BEGIN);
    if (!m) continue;
    const name = m[1];
    const t = ownedSection(tplLines, name);
    if (!t) continue;
    const want = tplLines.slice(t.b, t.e + 1);
    const mine = ownedSection(lines, name);
    if (mine) {
      const have = lines.slice(mine.b, mine.e + 1);
      if (have.join("\n") !== want.join("\n")) {
        lines.splice(mine.b, have.length, ...want);
        done.push(`CLAUDE.md: harness-owned section '${name}' updated to the template's wording`);
      }
      continue;
    }
    const legacy = OWNED_LEGACY[name];
    if (legacy?.known) {
      // Exact-match migration: the block is wrapped and replaced only when it is word for word a past template default.
      const hit = legacy.known.map((k) => ({ k, at: lines.findIndex((x, i) => x === k[0] && k.every((y, n) => lines[i + n] === y)) })).find((h) => h.at >= 0);
      if (!hit) {
        done.push(`CLAUDE.md: section '${name}' has custom wording, so it was left alone; merge it by hand from the template (app-studio plugins/studio/templates/CLAUDE.md) or delete the Roles bullets and pull again`);
        continue;
      }
      lines.splice(hit.at, hit.k.length, ...want);
      done.push(`CLAUDE.md: harness-owned section '${name}' marked and updated to the template's wording`);
      continue;
    }
    if (legacy?.insertBefore) {
      // A section new to old CLAUDE.md files: added once, just before a line every older copy has.
      const at = lines.findIndex((x) => legacy.insertBefore.test(x));
      if (at < 0) {
        done.push(`CLAUDE.md: section '${name}' not found where expected; merge it by hand from the template (app-studio plugins/studio/templates/CLAUDE.md)`);
        continue;
      }
      lines.splice(at, 0, ...want);
      done.push(`CLAUDE.md: harness-owned section '${name}' added from the template`);
      continue;
    }
    const from = legacy ? lines.findIndex((x) => legacy.from.test(x)) : -1;
    const stop = from < 0 ? -1 : lines.findIndex((x, i) => i > from && (legacy.until.test(x) || /^##\s/.test(x)));
    const until = stop >= 0 && legacy.until.test(lines[stop]) ? stop : -1;
    if (until < 0) {
      done.push(`CLAUDE.md: section '${name}' not found where expected; merge it by hand from the template (app-studio plugins/studio/templates/CLAUDE.md)`);
      continue;
    }
    let end = until;
    while (end > from + 1 && lines[end - 1].trim() === "") end--;
    lines.splice(from, end - from, ...want);
    done.push(`CLAUDE.md: harness-owned section '${name}' marked and updated to the template's wording`);
  }
  return done;
}

/**
 * Template wording that apps must get through a routine pull, though CLAUDE.md is the app's own file:
 * the App profile's "Decision log" row and the "say plainly what you did not check" line. Each is
 * added only when missing, taken from the template, and never replaces or reorders app content.
 */
export function patchProfile(app, studio, { dry = false } = {}) {
  const file = join(app, "CLAUDE.md");
  const tpl = join(studio, "plugins/studio/templates/CLAUDE.md");
  if (!existsSync(file) || !existsSync(tpl)) return [];
  const crlf = readFileSync(file, "utf8").includes("\r\n");
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  const tplLines = readFileSync(tpl, "utf8").replace(/\r\n/g, "\n").split("\n");
  const done = [];

  const row = tplLines.find((l) => /^\|\s*Decision log\s*\|/.test(l));
  const start = lines.findIndex((l) => /^##\s+App profile\b/.test(l));
  if (row && start >= 0 && !lines.some((l) => /^\|\s*Decision log\s*\|/.test(l))) {
    let last = -1;
    let at = -1;
    for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
      if (!lines[i].startsWith("|")) continue;
      last = i;
      if (/^\|\s*Storage shape\s*\|/.test(lines[i])) at = i;
    }
    if (at < 0) at = last;
    if (at >= 0) {
      lines.splice(at + 1, 0, row);
      done.push("CLAUDE.md: App profile row 'Decision log' added (default: docs/PRD.md Decisions)");
    }
  }

  // Rename phase B: an app's old heading "Writing for Ale" becomes the template's heading; the text under it is untouched.
  const oldHead = lines.findIndex((l) => /^##\s+Writing for Ale\s*$/.test(l));
  const newHead = tplLines.find((l) => /^##\s+Writing for the App Creator\s*$/.test(l));
  if (oldHead >= 0 && newHead && !lines.some((l) => l.trim() === newHead)) {
    lines[oldHead] = newHead;
    done.push("CLAUDE.md: heading 'Writing for Ale' renamed to 'Writing for the App Creator' (text under it untouched)");
  }

  const sentence = tplLines.find((l) => /did not check/i.test(l));
  if (sentence && !lines.some((l) => /did not check/i.test(l))) {
    const h = lines.findIndex((l) => WRITING_HEADING.test(l));
    if (h >= 0) {
      let end = h + 1;
      while (end < lines.length && !/^##\s/.test(lines[end])) end++;
      while (end > h + 1 && lines[end - 1].trim() === "") end--;
      lines.splice(end, 0, "", sentence);
    } else {
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      lines.push("", tplLines.find((l) => WRITING_HEADING.test(l)) ?? "## Writing for the App Creator", "", sentence, "");
    }
    done.push("CLAUDE.md: line 'say plainly what you did not check' added to the writing section");
  }

  done.push(...syncOwnedSections(lines, tplLines));

  if (done.length && !dry) {
    let text = lines.join("\n");
    if (!text.endsWith("\n")) text += "\n";
    writeFileSync(file, crlf ? text.replace(/\n/g, "\r\n") : text);
  }
  return done;
}

export function install(app, studio, opts) {
  const result = pull(app, studio, { ...opts, patch: false }); // a first copy never edits an app's own CLAUDE.md
  result.templates = [];
  const lock = readLock(app);
  const ih = instructionsHash(studio);
  if (lock && ih && !lock.instructions && !existsSync(join(app, "CLAUDE.md"))) writeLock(app, { ...lock, instructions: ih }); // a new app gets the current template pasted by new-app
  for (const [from, to] of TEMPLATES) {
    if (existsSync(join(app, to))) continue;
    mkdirSync(dirname(join(app, to)), { recursive: true });
    copyFileSync(join(studio, from), join(app, to));
    result.templates.push(to);
  }
  return result;
}

const PROTOTYPE_IGNORE = ["# Hand-written prototypes saved by discovery are throwaway HTML, not source.", "docs/**/*.html"];
/** True when the app has a Prettier ignore file that does not yet skip HTML prototypes under `folder` (default docs/discovery/). */
function prototypeIgnoreMissing(app, folder = "docs/discovery/") {
  const file = join(app, ".prettierignore");
  if (!existsSync(file)) return false; // no stack yet: the stack pack's starter brings the line
  const lines = readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim());
  const dir = folder.replace(/\/*$/, "");
  return !lines.some((l) => l === "docs/**/*.html" || l === `${dir}/**/*.html` || l === "**/*.html" || l === "*.html");
}

/** Adds stack packs (and what they require): managed files, starter files, package.json entries. */
export function addPacks(app, studio, names, { slug, title, force = false } = {}) {
  if (!names.length) throw new Error("Name at least one pack. Available: " + byKind(studio, listPacks(studio)));
  const lock = readLockForPull(app, force);
  if (!lock.studio) throw new Error("Install the harness first (studio-sync.mjs install).");
  const defaults = defaultVars(app);
  // The name chosen first is kept: files already filled with it must not change under the app.
  const vars = lock.app ?? { ...defaults, ...(slug && { slug }), ...(title && { title }) };
  checkVars(vars);
  const packs = [...new Set([...Object.keys(lock.packs ?? {}), ...packClosure(studio, names)])];
  const order = packClosure(studio, packs);
  // A pack that is a whole stack of its own (static-site) can't share an app with the stacks it replaces.
  for (const n of order)
    for (const other of readPack(studio, n).conflictsWith ?? [])
      if (order.includes(other))
        throw new Error(`Pack "${n}" can't be in the same app as "${other}" (they ship the same build setup). Use one or the other.`);
  const fresh = order.filter((n) => !(n in (lock.packs ?? {})));
  // One name, one owner: nothing is copied when a new pack's skill or agent is already the core's, another pack's or the app's own.
  const clashes = [
    ...packClashes(studio, order).filter((c) => fresh.includes(c.pack)).map((c) => c.text),
    ...ownClashes(app, lock.files, masterFiles(studio, order)).filter((c) => fresh.includes(c.pack)).map((c) => ownClashText(c, "run pack add again")),
  ];
  if (clashes.length) throw new Error(`Name clash, nothing was added:\n${clashes.map((c) => `  ${c}`).join("\n")}`);

  // Register the packs, then reuse pull for the managed files.
  writeLock(app, {
    ...lock,
    app: vars,
    packs: { ...lock.packs, ...Object.fromEntries(fresh.map((n) => [n, readPack(studio, n).version])) },
  });
  const result = pull(app, studio, { force, fresh });
  result.added = fresh;
  result.kept = [];
  result.partners = partnerGaps(studio, order);
  result.packageJson = mergePackageJson(app, studio, fresh, vars);

  const after = readLock(app);
  const starters = starterFiles(studio, fresh, vars, order);
  for (const [path, m] of Object.entries(starters)) {
    const dest = join(app, path);
    if (existsSync(dest) && hashFile(dest) !== m.hash) {
      result.kept.push(path);
      continue;
    }
    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, m.text);
      result.created.push(path);
    }
    after.starters = { ...after.starters, [path]: { pack: m.pack, installed: m.hash, seen: m.hash } };
  }
  result.held = result.held.filter((path) => !(path in starters));
  writeLock(app, after);
  // An app that already has a stack gets the discovery prototype ignore line now: its stack starter came before discovery.
  if (fresh.includes("discovery") && prototypeIgnoreMissing(app)) {
    const file = join(app, ".prettierignore");
    const text = readFileSync(file, "utf8");
    writeFileSync(file, `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${PROTOTYPE_IGNORE.join("\n")}\n`);
    result.ignoreLine = ".prettierignore";
  }
  return result;
}

/**
 * Drops packs from an app: their managed files (checklists, release notes, a module's skills and
 * agents) are deleted and the lock forgets them. Starter files and package.json entries are the app's own and stay. Refuses a pack
 * another remaining pack requires, and a managed file edited here unless `force`.
 */
export function removePacks(app, studio, names, { force = false } = {}) {
  if (!names.length) throw new Error("Name at least one pack to remove.");
  const lock = readLock(app);
  if (!lock) throw new Error("Install the harness first (studio-sync.mjs install).");
  const have = Object.keys(lock.packs ?? {});
  for (const n of names) if (!have.includes(n)) throw new Error(`The app has no pack named "${n}" (it has: ${have.join(", ") || "none"}).`);
  const keep = have.filter((n) => !names.includes(n));
  for (const n of keep) {
    const need = (readPack(studio, n).requires ?? []).find((d) => names.includes(d));
    if (need) throw new Error(`Pack "${n}" requires "${need}". Remove "${n}" first.`);
  }
  const result = { removed: names, deleted: [], skipped: [], startersKept: [] };
  for (const n of names) {
    const prefix = `.claude/packs/${n}/`;
    // Its skills and agents, unless the core or another of the app's packs is the one that ships that name.
    const mine = masterFiles(studio, have);
    const skillPaths = new Set(Object.keys(packShared(studio, n)).filter((p) => mine[p]?.pack === n));
    for (const [path, hash] of Object.entries(lock.files)) {
      if (!path.startsWith(prefix) && !skillPaths.has(path)) continue;
      const cur = localHash(app, path);
      if (cur !== null && cur !== hash && !force) {
        result.skipped.push(path);
        continue;
      }
      if (cur !== null) removeManaged(app, path);
      delete lock.files[path];
      result.deleted.push(path);
    }
    for (const [path, rec] of Object.entries(lock.starters ?? {})) {
      if (rec.pack !== n) continue;
      delete lock.starters[path];
      result.startersKept.push(path);
    }
    if (!result.skipped.some((x) => x.startsWith(prefix) || skillPaths.has(x))) delete lock.packs[n];
  }
  writeLock(app, lock);
  return result;
}

/** Marks starter files as reviewed against app-studio: their notes stop until the next change. */
export function ack(app, studio, paths = []) {
  const lock = readLock(app);
  if (!lock) return [];
  const done = [];
  const ih = instructionsHash(studio);
  if (paths.includes("instructions") && ih && lock.instructions !== ih) {
    lock.instructions = ih;
    done.push("instructions");
  }
  paths = paths.filter((x) => x !== "instructions");
  if (!lock.starters || (done.length && !paths.length)) {
    if (done.length) writeLock(app, lock);
    return done;
  }
  const starters = starterFiles(studio, Object.keys(lock.packs ?? {}), lock.app ?? defaultVars(app));
  for (const [path, rec] of Object.entries(lock.starters)) {
    if (paths.length && !paths.map((x) => x.replaceAll("\\", "/")).includes(path)) continue;
    const m = starters[path];
    if (!m || m.hash === rec.seen) continue;
    lock.starters[path] = { ...rec, seen: m.hash };
    done.push(path);
  }
  writeLock(app, lock);
  return done;
}

function parseArgs(argv) {
  const opts = { cmd: argv[0], warn: false, force: false, rest: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--warn") opts.warn = true;
    else if (a === "--live-check") opts.liveCheck = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--dry-run") opts.dry = true;
    else if (a === "--build-only") opts.buildOnly = true;
    else if (a === "--discovery-only") opts.discoveryOnly = true;
    else if (a === "--apply") opts.apply = true;
    else if (a === "--scaffold") opts.scaffold = true;
    else if (["--app", "--studio", "--slug", "--title", "--since", "--version", "--date"].includes(a)) opts[a.slice(2)] = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Unknown argument: ${a}`);
    else opts.rest.push(a);
  }
  return opts;
}

function siblings(app) {
  try {
    const parent = dirname(app);
    return readdirSync(parent).sort().map((n) => join(parent, n)).filter((d) => d !== app);
  } catch {
    return [];
  }
}

function locate(opts) {
  const here = dirname(fileURLToPath(import.meta.url));
  const fromStudio = isStudio(join(here, ".."));
  const app = resolve(opts.app ?? (fromStudio ? process.cwd() : join(here, "..", "..")));
  const candidates = fromStudio
    ? [opts.studio, join(here, "..")]
    : [opts.studio, process.env.STUDIO_DIR, join(app, "..", "app-studio")];
  // A cloud session clones attached repos side by side, not always under the name app-studio.
  if (!fromStudio) candidates.push(...siblings(app));
  const studio = candidates.filter(Boolean).map((d) => resolve(d)).find(isStudio) ?? null;
  if (opts.studio && !isStudio(resolve(opts.studio)))
    throw new Error(`Not an app-studio checkout: ${opts.studio}`);
  return { app, studio };
}

/** The report line for agents a pull or `pack add` brought in: a session lists its agents when it starts, so the thread that
 *  ran the sync may not be offered them, while the push gate can already ask for one (#420). */
export const newAgentsNote = (names) =>
  names?.length
    ? [`  new agents: ${names.join(", ")} (a session lists its agents when it starts, so this session may not offer them yet. If the Agent tool doesn't, run a general-purpose agent told to read and follow .claude/agents/<name>.md, on the model that file names; a new thread has them)`]
    : [];

// Long lists (a pack's starter files) are cut short: the app's git status shows the rest. A dry run changes nothing, so git
// shows nothing: it prints every file (#422).
let fullLists = false;
const list = (label, paths) =>
  paths.length
    ? [`  ${label}: ${paths.length > 8 && !fullLists ? `${paths.slice(0, 6).join(", ")} and ${paths.length - 6} more` : paths.join(", ")}`]
    : [];

/** The App profile section of CLAUDE.md (or another `## heading` section), or null when the file or section is missing. */
function profileSection(app, heading = "## App profile") {
  const file = join(app, "CLAUDE.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const end = text.indexOf("\n## ", start + 5);
  return text.slice(start, end < 0 ? undefined : end);
}

const DISCOVERY_REQUIRED = ["Product", "Target users", "Starting idea", "Docs folder", "Sign-off mode"];
const SIGN_OFF_MODES = ["per artifact", "autonomous with record"];
/** Problems with the Discovery profile, for health: checked only while the discovery module is installed. */
export function discoveryProfileProblems(app, lock) {
  if (!lock?.packs?.discovery) return [];
  const section = profileSection(app, "## Discovery profile");
  const fix = "node .claude/hooks/app-setup.mjs discovery-profile";
  if (section === null) return [`the discovery module is installed but CLAUDE.md has no "## Discovery profile" section; write it with: ${fix} init --product "<one line>" --users "<one line>"`];
  const value = (f) => (profileField(section, f) ?? "").replace(/`/g, "").trim();
  const blank = DISCOVERY_REQUIRED.filter((f) => !value(f) || isPlaceholder(value(f)));
  if (blank.length) return [`the Discovery profile has no ${blank.join(", ")}; set it with: ${fix} set "Row=value"`];
  const problems = [];
  if (!SIGN_OFF_MODES.includes(value("Sign-off mode").toLowerCase())) problems.push(`the Discovery profile's Sign-off mode must be "${SIGN_OFF_MODES.join('" or "')}" (it says "${value("Sign-off mode").slice(0, 40)}")`);
  const folder = value("Docs folder").split(/\s/)[0];
  if (folder.startsWith("/") || folder.split("/").includes("..") || !existsSync(join(app, folder)))
    problems.push(`the Discovery profile's Docs folder "${folder.slice(0, 60)}" is not a folder in this repo (the module's starter documents are in docs/discovery/)`);
  else if (prototypeIgnoreMissing(app, folder))
    problems.push(`.prettierignore does not skip HTML prototypes in "${folder}", so a prototype saved as an HTML file fails npm run check; add the line ${folder.replace(/\/*$/, "")}/**/*.html to .prettierignore`);
  return problems;
}

/**
 * One start-up line for an app in discovery: the phase, exit criteria done of total and the next document
 * (read from the discovery module's status tracker). Null once the app is building.
 */
export function discoveryNote(app, lock = readLock(app)) {
  if (phaseOf(app) !== "discovery") return null;
  const ends = 'Discovery ends only when the App Creator says "start building" (new-app skill).';
  if (!lock?.packs?.discovery) return `Phase: discovery (no stack chosen yet). ${ends}`;
  const workflow = "the order of work and the skill for each document are in .claude/packs/discovery/WORKFLOW.md";
  const section = profileSection(app, "## Discovery profile");
  const folder = ((section && profileField(section, "Docs folder")) || "docs/discovery/").replace(/`/g, "").trim().split(/\s/)[0].replace(/\/*$/, "/");
  const file = join(app, folder, "status.md");
  const none = `Phase: discovery. No status tracker found at ${folder}status.md; ${workflow}. ${ends}`;
  if (folder.startsWith("/") || folder.split("/").includes("..") || !existsSync(file)) return none;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return none; // a start-up note must never break the session's start
  }
  const rows = [...text.matchAll(/^\|[ \t]*(\d+)[ \t]*\|([^|\n]*)\|([^|\n]*)\|/gm)]
    .map((m) => ({ n: m[1], name: m[2].trim(), status: m[3].replace(/`/g, "").trim().toLowerCase() }))
    .filter((r) => r.name && !r.status.startsWith("dropped"));
  if (!rows.length) return `Phase: discovery. ${folder}status.md lists no exit criteria; ${workflow}. ${ends}`;
  const open = rows.filter((r) => !/^done\b/.test(r.status));
  // The decision log is kept current all along and scored by the exit gate: it is never the next document.
  const doc = open.find((r) => !/^decision log\b/i.test(r.name));
  const next = doc ? `${doc.name} (criterion ${doc.n}, ${doc.status || "not started"})` : "the exit gate report (exit-gate skill)";
  return `Phase: discovery. Exit criteria: ${rows.length - open.length} of ${rows.length} done. Next: ${next}; ${workflow}. ${ends}`;
}

/** The value cell of a profile table row (`| Field | value |`), or null when the row is missing. */
function profileField(section, field) {
  for (const line of section.split("\n")) {
    const cells = line.replace(/\\\|/g, "\u0000").split("|").map((c) => c.replace(/\u0000/g, "|").trim());
    if (cells[0] === "" && cells[1] === field) return cells[2] ?? "";
  }
  return null;
}

/** The AI row, without the backticks the template shows its value in (`off` counts as off, like the Access model row). */
const aiValue = (section) => profileField(section, "AI")?.replace(/^`\s*/, "").replace(/\s*`(?=\s|$)/, "") ?? null;

const isPlaceholder = (v) => /^`?<[^<>\n]{2,}>/.test(v);
/** True when the profile row has no real answer: missing, empty or still the template placeholder. */
const blankField = (v) => v === null || v === "" || isPlaceholder(v);

/** "Not decided yet" (#69): `TBD`, optionally with where it gets decided, e.g. `TBD (decided at build start)`. */
const isTbd = (v) => /^`?TBD\b/i.test((v ?? "").trim());

/**
 * The App profile's Phase: `discovery` (no stack yet; fields may say TBD) or `build`. A missing or
 * empty Phase row means `build`, so an app that predates the row behaves as before. Anything else is
 * reported by phaseProblems; it counts as `build` here, the stricter reading.
 */
export function phaseOf(app) {
  const section = profileSection(app);
  const v = (section === null ? null : profileField(section, "Phase"))?.replace(/`/g, "").trim().toLowerCase();
  return v === "discovery" ? "discovery" : "build";
}

const DISCOVERY_STOP =
  "this app is in discovery (App profile, Phase): no stack is chosen, so there is nothing to build, test or release yet. Finish the requirements, then the App Creator says \"start building\" and the new-app skill's \"Start building\" section (discovery.md) switches Phase to build";

const BUILD_STOP =
  "this app is already building (App profile, Phase is build): discovery is over, so this discovery step no longer applies. Requirements now go through prd-intake and build-feature";

/** Repos from the App profile's "Owner-merged repos" row (`owner/repo`, comma-separated). `none` or a missing row: no repos. */
export function ownerMergedRepos(app) {
  const section = profileSection(app);
  const raw = section === null ? null : profileField(section, "Owner-merged repos");
  if (raw === null || isPlaceholder(raw)) return [];
  return raw.replace(/`/g, "").split(/[,\s]+/).filter((r) => r && !/^none$/i.test(r));
}

/** Problems with the Owner-merged repos row, for health: the format, and the merge hook covering auto-merge and approvals. */
export function ownerMergedProblems(app) {
  const bad = ownerMergedRepos(app).filter((r) => !/^[^/\s]+\/[^/\s]+$/.test(r));
  if (bad.length) return [`the App profile's Owner-merged repos must be "none" or owner/repo names separated by commas (it says "${bad.join(" ").slice(0, 40)}")`];
  if (!ownerMergedRepos(app).length) return [];
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(join(app, ".claude/settings.json"), "utf8"));
  } catch {
    return [];
  }
  const covered = (settings.hooks?.PreToolUse ?? []).some(
    (g) => String(g.matcher ?? "").includes("enable_pr_auto_merge") && (g.hooks ?? []).some((h) => String(h.command ?? "").includes("hooks/check.mjs merge")),
  );
  return covered ? [] : ['the App profile lists Owner-merged repos, but the merge hook in .claude/settings.json does not cover enable_pr_auto_merge and pull_request_review_write; use the matcher "mcp__.*github.*__(merge_pull_request|enable_pr_auto_merge|pull_request_review_write)" (see app-studio\'s templates/settings.json)'];
}

/** Fields that must be real even in discovery: they identify the app. */
const IDENTITY_FIELDS = ["App", "Id prefix", "Repo", "Phase"];

/** Problems with the Phase row and with TBD values, for health. */
export function phaseProblems(app) {
  const section = profileSection(app);
  if (section === null) return [];
  const raw = profileField(section, "Phase");
  const v = raw?.replace(/`/g, "").trim().toLowerCase() ?? "";
  if (raw !== null && raw !== "" && !isPlaceholder(raw) && !/^(discovery|build)$/.test(v))
    return [`the App profile's Phase must be "discovery" or "build" (it says "${raw.slice(0, 40)}")`];
  const tbds = [];
  for (const line of section.split("\n")) {
    const cells = line.replace(/\\\|/g, "\u0000").split("|").map((c) => c.replace(/\u0000/g, "|").trim());
    if (cells[0] === "" && cells.length > 2 && isTbd(cells[2])) tbds.push(cells[1]);
    else if (/^- (\*\*[^*]+:\*\*\s*)?TBD\b/i.test(line)) tbds.push(line.slice(0, 40));
  }
  if (phaseOf(app) === "build") return tbds.length ? [`the App profile still says TBD in build: ${tbds.join(", ")}. Decide each one and record it, or set Phase to discovery if the app really has no stack yet`] : [];
  const bad = IDENTITY_FIELDS.filter((f) => tbds.includes(f));
  return bad.length ? [`the App profile may not say TBD for ${bad.join(", ")}: they identify the app`] : [];
}

/**
 * True when the app uses AI and anyone can get in (open sign-up or no login), so anyone can spend
 * its AI: the owner must record an AI public use decision (#88). The harness never picks it.
 */
function aiPublic(section) {
  const ai = aiValue(section) ?? "";
  const access = profileField(section, "Access model") ?? "";
  return /^on\b/i.test(ai) && !isPlaceholder(access) && /signs? up|sign-up|no login|no-login/i.test(access);
}

const AI_PUBLIC_GAP =
  "AI is on and anyone can get in (open sign-up or no login), so anyone can spend the app's AI. A usage quota or spend cap is strongly recommended before launch. Ask the owner to decide and record it in the App profile's AI public use row (the cap, or why there is none)";

/** Lines of the App profile (CLAUDE.md) that still hold a template placeholder such as `<App name>`. */
export function profileGaps(app) {
  const section = profileSection(app);
  if (section === null) return [];
  // The AI plan matters only for an app that uses AI, the AI public use decision only for one anyone can get into.
  const aiOff = /^off\b/i.test(aiValue(section) ?? "");
  const needsPublic = aiPublic(section);
  return section
    .split("\n")
    .filter((l) => /(\|\s*|\*\*\s*|^- |^)`?<[^<>\n]{2,}>/.test(l) && !/^Build, QA/.test(l))
    .filter((l) => !(aiOff && /^\|\s*AI plan\s*\|/.test(l)))
    .filter((l) => needsPublic || !/^\|\s*AI public use\s*\|/.test(l))
    .map((l) => l.replace(/\s+/g, " ").trim().slice(0, 70));
}

/**
 * Feature choices the App profile must record (Features rows): the harness asks and refuses to go on
 * while they are blank, but never picks the answer. Placeholders are reported by profileGaps.
 */
export function featureGaps(app) {
  const section = profileSection(app);
  if (section === null) return [];
  const gaps = [];
  const ai = aiValue(section);
  // In discovery the choices may be "not decided yet"; build and release still need them (#69).
  if (phaseOf(app) === "discovery" && isTbd(ai)) {
    /* not decided yet */
  } else if (ai === null || ai === "") gaps.push("the App profile has no AI row (on or off); ask the owner and record it");
  else if (!isPlaceholder(ai) && !/^(on|off)\b/i.test(ai)) gaps.push(`the App profile's AI row must start with "on" or "off" (it says "${ai.slice(0, 40)}")`);
  else if (/^on\b/i.test(ai) && blankField(profileField(section, "AI plan")))
    gaps.push("AI is on, so the App profile needs an AI plan (whose plan or key pays, and the default model tier)");
  for (const f of ["Access model", "Storage shape"])
    if (blankField(profileField(section, f)) && !isPlaceholder(profileField(section, f) ?? ""))
      gaps.push(`the App profile has no ${f} (${f === "Access model" ? "who can get in" : "per-person documents, shared documents, or something else"}); ask the owner and record it`);
  const decision = profileField(section, "AI public use");
  if (aiPublic(section) && blankField(decision) && !isPlaceholder(decision ?? "")) gaps.push(AI_PUBLIC_GAP);
  return gaps;
}

/**
 * Why a release must stop: the access model is missing or blank, or the app has AI and anyone can
 * get in but no AI public use decision is recorded. Empty when nothing is missing.
 */
export function releaseBlockers(app) {
  const section = profileSection(app);
  if (section === null) return ["CLAUDE.md has no App profile, so the access model is not recorded"];
  if (phaseOf(app) === "discovery") return [DISCOVERY_STOP];
  if (blankField(profileField(section, "Access model")))
    return ["the App profile's Access model is blank. Ask the owner who can get in (only invited people, anyone who signs up, anyone with no login, or whoever the owner shares it with), record the answer, then release."];
  const blockers = signInModeMismatches(app, section);
  if (aiPublic(section) && blankField(profileField(section, "AI public use"))) blockers.push(`${AI_PUBLIC_GAP}, then release.`);
  return blockers;
}

/** The server sign-in mode an Access model answer calls for, or null (an artifact app has none). */
function expectedSignInMode(access) {
  if (/no[ -]login/i.test(access)) return "none";
  if (/signs? up|sign-up/i.test(access)) return "open";
  if (/invite/i.test(access)) return "invite";
  return null;
}

/**
 * A web app's host settings must match the recorded Access model: render.yaml (the live site) and
 * .github/workflows/ci.yml (the tests and container check) set SIGN_IN_MODE. A site that is more
 * open than the owner decided, or a render.yaml still saying "choose", must not be released.
 */
function signInModeMismatches(app, section) {
  const want = expectedSignInMode(profileField(section, "Access model") ?? "");
  if (want === null) return [];
  const out = [];
  const files = [
    ["render.yaml", /key:\s*SIGN_IN_MODE\s*\n\s*value:\s*["']?([^"'\n#]*?)["']?\s*(?:#.*)?$/m, "invite"],
    [".github/workflows/ci.yml", /^\s*SIGN_IN_MODE:\s*["']?([^"'\n#]*?)["']?\s*(?:#.*)?$/m, null],
  ];
  for (const [file, re, absent] of files) {
    const path = join(app, file);
    if (!existsSync(path)) continue;
    const found = readFileSync(path, "utf8").match(re)?.[1].trim() ?? absent;
    if (found !== null && found !== want)
      out.push(`${file} sets SIGN_IN_MODE to "${found}" but the App profile's Access model calls for "${want}" (invite = only invited people, open = anyone who signs up, none = no login). Make them agree, then release.`);
  }
  return out;
}

// Hooks every app's .claude/settings.json must wire, as [event, part of the command].
export const REQUIRED_HOOKS = [
  ["SessionStart", "hooks/cloud-setup.mjs"],
  ["SessionStart", "studio-sync.mjs check"],
  ["PreToolUse", "hooks/check.mjs commit"],
  ["PreToolUse", "hooks/check.mjs merge"],
  ["PreToolUse", "hooks/check.mjs write"],
  ["PostToolUse", "hooks/check.mjs lint"],
  ["Stop", "hooks/check.mjs test"],
];

// Starter files the app owns but must keep, as [pack, path]: without the Harness workflow, a PR
// that deletes it (or any docs-only PR) is never checked.
const REQUIRED_STARTERS = [["base", ".github/workflows/harness.yml"], ["static-site", ".github/workflows/harness.yml"]];

const GIT_HOOKS = ".claude/hooks";
// Claude Code hooks forwarded to the user settings in a cloud session, as [event, matcher, check.mjs mode].
// The git pre-commit hook covers commits, and SessionStart has already run by then.
export const FORWARDED_HOOKS = [
  ["PreToolUse", "mcp__.*github.*__(merge_pull_request|enable_pr_auto_merge|pull_request_review_write)", "merge"],
  ["PreToolUse", "mcp__.*github.*__(push_files|create_or_update_file|delete_file)", "write"],
  ["PostToolUse", "Edit|Write|MultiEdit", "lint"],
  ["Stop", undefined, "test"],
];

/**
 * Turns on what works wherever a session starts: the git pre-commit hook, and in a cloud session
 * (CLAUDE_CODE_REMOTE) the app's hooks forwarded to the user settings (~/.claude/settings.json): a cloud
 * session runs no hooks from a folder's .claude/settings.json, and re-reads the user settings mid-session.
 * Returns notes; does nothing in CI.
 */
export function activateHooks(app, env = process.env, { dry = false } = {}) {
  const notes = [];
  if (env.CI || !existsSync(join(app, LOCK))) return notes;
  const hook = join(app, GIT_HOOKS, "pre-commit");
  if (existsSync(join(app, ".git")) && existsSync(hook)) {
    const git = (...a) => spawnSync("git", ["-C", app, ...a], { encoding: "utf8" });
    const cur = (git("config", "--get", "core.hooksPath").stdout ?? "").trim();
    if (!cur || cur === GIT_HOOKS) {
      for (const h of dry ? [] : [hook, join(app, GIT_HOOKS, "pre-push")]) {
        try {
          chmodSync(h, 0o755);
        } catch {
          // Windows: Git runs hooks through sh, no mode needed. A missing pre-push (an old copy) is fine.
        }
      }
      if (!cur && dry) notes.push("the git pre-commit health check is off");
      else if (!cur && git("config", "core.hooksPath", GIT_HOOKS).status === 0) notes.push("turned on the git pre-commit health check");
    } else
      notes.push(`git core.hooksPath is "${cur}", so the harness pre-commit check is off: call .claude/hooks/pre-commit from that folder's pre-commit hook`);
  }
  // An app directly under a system temp folder or the filesystem root has no project folder above
  // it; forwarding there would leave a stray .claude/settings.json in /tmp.
  const parent = dirname(app);
  const sharedParent = parent === dirname(parent) || [tmpdir(), "/tmp", "/var/tmp"].some((t) => resolve(t) === resolve(parent));
  if (env.CLAUDE_CODE_REMOTE === "true" && !sharedParent) {
    // Cloud sessions don't run hooks from a folder's .claude/settings.json, only from the user settings
    // (which they also re-read mid-session), so the hooks go there (0.30.1). Old forwarded copies in the
    // parent folder are dropped. STUDIO_USER_SETTINGS: tests only.
    if (!dry) dropFrom(join(parent, ".claude", "settings.json"), `${toPosix(app)}/.claude/hooks/`);
    const file = env.STUDIO_USER_SETTINGS || process.env.STUDIO_USER_SETTINGS || join(homedir(), ".claude", "settings.json");
    const mine = `${toPosix(app)}/.claude/hooks/`;
    let settings = {};
    try {
      settings = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    } catch {
      settings = {};
    }
    const before = JSON.stringify(settings);
    settings.hooks ??= {};
    // The "app-studio apps" cloud environment already runs the app's hooks there (scripts/studio-env.mjs).
    const viaEnv = JSON.stringify(settings.hooks).includes("studio-env");
    for (const event of Object.keys(settings.hooks))
      settings.hooks[event] = settings.hooks[event]
        .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !String(h.command ?? "").includes(mine)) }))
        .filter((g) => g.hooks.length);
    for (const [event, matcher, mode] of viaEnv ? [] : FORWARDED_HOOKS)
      (settings.hooks[event] ??= []).push({
        ...(matcher ? { matcher } : {}),
        hooks: [{ type: "command", command: `node "${mine}check.mjs" ${mode}`, timeout: mode === "test" || mode === "lint" ? 300 : 30 }],
      });
    if (JSON.stringify(settings) !== before && dry) notes.push("the app's hooks are not forwarded to the user settings, so a cloud session does not run them");
    else if (JSON.stringify(settings) !== before) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
      notes.push(`forwarded the app's hooks to ${toPosix(file)} (the user settings, which cloud sessions run)`);
    }
  }
  return notes;
}

/** Removes the hooks whose command contains `mine` from a settings file, if it has any. */
function dropFrom(file, mine) {
  if (!existsSync(file)) return;
  let s;
  try {
    s = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return;
  }
  const before = JSON.stringify(s);
  for (const e of Object.keys(s.hooks ?? {}))
    s.hooks[e] = s.hooks[e]
      .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !String(h.command ?? "").includes(mine)) }))
      .filter((g) => g.hooks.length);
  if (JSON.stringify(s) !== before) writeFileSync(file, `${JSON.stringify(s, null, 2)}\n`);
}

function hookGaps(app) {
  const file = join(app, ".claude/settings.json");
  if (!existsSync(file)) return [".claude/settings.json is missing"];
  let settings;
  try {
    settings = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return [`.claude/settings.json is not valid JSON (${e.message})`];
  }
  const commands = (event) =>
    (settings.hooks?.[event] ?? []).flatMap((m) => (m.hooks ?? []).map((h) => String(h.command ?? "")));
  return REQUIRED_HOOKS.filter(([event, cmd]) => !commands(event).some((c) => c.includes(cmd))).map(
    ([event, cmd]) => `${event} hook "${cmd}" is not in .claude/settings.json (see app-studio's templates/settings.json)`,
  );
}

const frontmatter = (text) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  return Object.fromEntries(
    m[1].split(/\r?\n/).map((l) => /^([a-z-]+):\s*(.*)$/i.exec(l)).filter(Boolean).map((x) => [x[1], x[2].trim()]),
  );
};

/** The app's own skills and agents (not in the lock): front matter with a name and a description, no clash. */
function ownGaps(app, lock) {
  const gaps = [];
  const managed = Object.keys(lock.files);
  for (const [kind, dir, fileOf] of [
    ["skill", ".claude/skills", (n) => join(n, "SKILL.md")],
    ["agent", ".claude/agents", (n) => n],
  ]) {
    const base = join(app, dir);
    if (!existsSync(base)) continue;
    const shared = new Set(
      managed.filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1).split("/")[0].replace(/\.md$/, "")),
    );
    for (const entry of readdirSync(base).filter((n) => !n.startsWith(".")).sort()) {
      const name = entry.replace(/\.md$/, "");
      if (shared.has(name)) continue;
      if (kind === "agent" && !entry.endsWith(".md")) continue;
      const rel = `${dir}/${fileOf(entry)}`;
      if (!existsSync(join(app, rel))) {
        gaps.push(`${dir}/${entry}: a skill folder needs a SKILL.md`);
        continue;
      }
      const fm = frontmatter(readFileSync(join(app, rel), "utf8"));
      if (!fm?.name || !fm?.description) gaps.push(`${rel}: front matter needs a name and a description`);
      else if (shared.has(fm.name)) gaps.push(`${rel}: ${kind} name "${fm.name}" clashes with a harness ${kind}`);
    }
  }
  return gaps;
}

/** Relative links in CLAUDE.md, README.md, docs/ and the app's own .claude/ Markdown that point at a file that isn't there. */
function linkGaps(app, lock) {
  const files = ["CLAUDE.md", "README.md"].filter((f) => existsSync(join(app, f)));
  for (const f of listFiles(join(app, "docs"))) if (f.endsWith(".md")) files.push(toPosix(relative(app, f)));
  for (const f of listFiles(join(app, ".claude"))) {
    const rel = toPosix(relative(app, f));
    if (rel.endsWith(".md") && !(rel in (lock?.files ?? {}))) files.push(rel);
  }
  const gaps = [];
  for (const rel of files) {
    const text = readFileSync(join(app, rel), "utf8")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`\n]*`/g, "");
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (/^([a-z][a-z0-9+.-]*:|#|\/|<|\{\{)/i.test(target)) continue;
      let path = target.split(/[#?]/)[0];
      try {
        path = decodeURIComponent(path);
      } catch {
        // Keep it as written.
      }
      if (path && !existsSync(join(app, dirname(rel), path))) gaps.push(`${rel}: broken link to ${target}`);
    }
  }
  return gaps;
}

/** Backlog item ids used twice across docs/BACKLOG.md and docs/BACKLOG-DONE.md (issue #82). */
export function idGaps(app) {
  const seen = new Map();
  for (const name of ["BACKLOG.md", "BACKLOG-DONE.md"]) {
    const f = join(app, "docs", name);
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/^#{2,4}[ \t]+([A-Z][A-Z0-9]*-\d+)\b/gm)) seen.set(m[1], [...(seen.get(m[1]) ?? []), name]);
  }
  return [...seen].filter(([, w]) => w.length > 1).map(([id, w]) => `backlog id ${id} is used ${w.length} times (${[...new Set(w)].join(", ")}): two items must not share an id; renumber the newer one, and every reference to it, to the next free id`);
}

/** Days an app with decision ids used twice only gets a note, counted from its install or first sync (lock `since`). */
export const DECISION_GRACE_DAYS = 14;

/** Decision ids defined twice in the app's decision log (the file the App profile's Decision log row names). */
export function decisionDuplicates(app) {
  const section = profileSection(app);
  const row = section === null ? null : profileField(section, "Decision log");
  const file = row === null ? "docs/PRD.md" : (/`([^`\s]+\.md)`/.exec(row)?.[1] ?? /(?:^|\s)([\w./-]+\.md)\b/.exec(row)?.[1] ?? "docs/PRD.md");
  const path = join(app, file);
  if (!existsSync(path)) return { file, dups: [] };
  const count = new Map();
  for (const m of readFileSync(path, "utf8").matchAll(/^#{2,4}[ \t]+(D-\d+)\b/gm)) count.set(m[1], (count.get(m[1]) ?? 0) + 1);
  return { file, dups: [...count].filter(([, n]) => n > 1).map(([id]) => id) };
}

/** Entries (numbered or not) left in docs/PRD.md "Decisions" while the Decision log row points at another file. */
export function strandedDecisions(app) {
  const { file } = decisionDuplicates(app);
  const prd = join(app, "docs/PRD.md");
  if (file === "docs/PRD.md" || !existsSync(prd)) return [];
  // The same count as decisions.mjs decisionEntries: a ### heading, list item or table row inside "## Decisions".
  const md = readFileSync(prd, "utf8").replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "");
  const h = /^## Decisions[ \t]*$/m.exec(md);
  const rest = h ? md.slice(h.index + h[0].length) : "";
  const next = /^## /m.exec(rest);
  const lines = (next ? rest.slice(0, next.index) : rest).split("\n");
  const n = lines.filter((l, i) => /^(#{3,4}[ \t]+\S|\s*(?:[-*]|\d+[.)])[ \t]+\S)/.test(l) || (/^\s*\|/.test(l) && !/^\s*\|[\s:|-]+$/.test(l) && !/^\s*\|[\s:|-]+$/.test(lines[i + 1] ?? ""))).length;
  return n ? [`docs/PRD.md "Decisions" still has ${n} decision entr${n === 1 ? "y" : "ies"}, but the App profile's Decision log row points at ${file}: move them into ${file} (keep their dates and ids), or point the row back at docs/PRD.md`] : [];
}

/** A note while the app is inside its grace period (or has no `since` date yet), a problem after it. */
export function decisionIdFindings(app, lock, today = new Date()) {
  const { file, dups } = decisionDuplicates(app);
  if (!dups.length) return { problems: [], notes: [] };
  const msg = `decision id${dups.length > 1 ? "s" : ""} ${dups.join(", ")} used more than once in ${file}: two decisions must not share an id; renumber the newer one, and every reference to it, to the next free id (decisions.mjs next)`;
  const since = lock?.since ? Date.parse(lock.since) : NaN;
  const days = Number.isNaN(since) ? 0 : Math.floor((today.getTime() - since) / 86400000);
  return days > DECISION_GRACE_DAYS ? { problems: [msg], notes: [] } : { problems: [], notes: [`${msg} (a note for ${Math.max(0, DECISION_GRACE_DAYS - days)} more day(s), then it fails the health check)`] };
}

/** { problems, notes }: problems fail the check, notes don't. */
export function health(app, studio) {
  const problems = [];
  const notes = [];
  let r;
  try {
    r = compare(app, studio);
  } catch (e) {
    return { problems: [`the harness lock can't be read: ${e.message}`], notes };
  }
  if (!r.installed) return { problems: [`no studio harness lock (${LOCK}); install it with the new-app skill`], notes };
  const lock = readLock(app);
  if (r.edited.length) problems.push(`shared harness files edited here (never edit them here: send a harness-idea to app-studio, then harness-sync restores the shared version): ${r.edited.join(", ")}`);
  if (r.missing.length) problems.push(`shared harness files missing here (harness-sync pull restores them): ${r.missing.join(", ")}`);
  if (!existsSync(join(app, "CLAUDE.md"))) problems.push("CLAUDE.md is missing");
  else if (!readFileSync(join(app, "CLAUDE.md"), "utf8").includes("## App profile"))
    problems.push('CLAUDE.md has no "## App profile" section (merge it from app-studio\'s templates/CLAUDE.md)');
  const gaps = profileGaps(app);
  if (gaps.length) problems.push(`the App profile in CLAUDE.md still has ${gaps.length} placeholder(s), for example:\n${gaps.slice(0, 3).map((g) => `      ${g}`).join("\n")}`);
  problems.push(...phaseProblems(app), ...ownerMergedProblems(app), ...featureGaps(app), ...hookGaps(app), ...ownGaps(app, lock), ...linkGaps(app, lock), ...idGaps(app), ...discoveryProfileProblems(app, lock));
  const dec = decisionIdFindings(app, lock);
  problems.push(...dec.problems, ...strandedDecisions(app));
  notes.push(...dec.notes);
  if (studio) {
    const packs = Object.keys(lock.packs ?? {});
    problems.push(...packClashes(studio, packs).map((c) => `name clash: ${c.text}`), ...ownClashes(app, lock.files, masterFiles(studio, packs)).map((c) => `name clash: ${ownClashText(c)}`));
  }
  for (const [pack, file] of REQUIRED_STARTERS)
    if (lock.packs?.[pack] && !existsSync(join(app, file)))
      problems.push(`${file} is missing (the ${pack} pack's starter; copy it from app-studio's packs/${pack}/starter/)`);
  const behind = [...r.behind, ...r.added, ...r.removed];
  if (behind.length) notes.push(`behind app-studio v${r.studioVersion} in ${behind.length} file(s); the harness-sync skill brings it in step`);
  if (r.starters.length) notes.push(`pack starter files changed in app-studio: ${r.starters.map((n) => n.path).join(", ")}`);
  if (!studio) notes.push("app-studio not found, so the copy was checked against its lock only");
  return { problems, notes, version: r.version };
}

/** Signs that an app's AI is its own design, not the ai / ai-web modules (issue #114). */
export function customAi(app, serverCode = "", studio = null) {
  const found = [];
  const own = [...new Set([...serverCode.matchAll(/["'`]\/api\/(coach|ai|chat|assistant)[\w/-]*/g)].map((m) => m[0].slice(1)))];
  if (own.length) found.push(`own AI route(s) ${own.join(", ")}`);
  const files = ["src", "tests"].flatMap((d) => listFiles(join(app, d))).filter((f) => CODE_FILE.test(f));
  // Files that are exact copies of an ai / ai-web (any module) starter are the standard module, not a custom design.
  const standard = new Map();
  if (studio) {
    const vars = readLock(app)?.app ?? defaultVars(app);
    for (const name of listPacks(studio).filter((n) => packKind(studio, n) === "module"))
      for (const [path, m] of Object.entries(starterFiles(studio, [name], vars))) standard.set(path, m.hash);
  }
  const odd = files.filter((f) => {
    const rel = toPosix(relative(app, f));
    if (standard.get(rel) === hashFile(f)) return false;
    const t = readFileSync(f, "utf8");
    return rel.startsWith("src/platform/") ? /\bsample\s*\(\s*[^)\s]/.test(t) || /\bsample\s*[:=]\s*(?:async\s*)?\(\s*[^)\s]/.test(t) : /\.sample\(\s*[^)\s]/.test(t);
  });
  if (odd.length) found.push(`sample() takes an input of the app's own (the module's takes none): ${odd.slice(0, 3).map((f) => toPosix(relative(app, f))).join(", ")}`);
  const ledger = listFiles(join(app, "server/migrations")).some((f) => /CREATE TABLE(?: IF NOT EXISTS)?\s+(?!ai_usage\b)\w*usage\w*/i.test(readFileSync(f, "utf8")));
  if (ledger && found.length) found.push("its own usage ledger table");
  return found;
}

/** The CI workflows' job names, and workflows whose pull_request trigger can skip the whole run (issue #114). */
export function ciFindings(app) {
  const jobs = [], warnings = [];
  for (const f of listFiles(join(app, ".github/workflows")).filter((x) => /\.ya?ml$/.test(x))) {
    const t = readFileSync(f, "utf8");
    const file = basename(f);
    const jobsAt = t.search(/^jobs:\s*$/m);
    if (jobsAt >= 0)
      for (const m of t.slice(jobsAt).matchAll(/^  ([\w-]+):\s*\n((?:    .*\n|\s*\n)*)/gm)) {
        const nm = m[2].match(/^    name:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/m)?.[1];
        jobs.push(`${nm ?? m[1]} (${file})`);
      }
    const pr = t.match(/^  pull_request(?:_target)?:\s*\n((?:    .*\n|\s*\n)*)/m);
    if (pr && /^\s+paths(?:-ignore)?:/m.test(pr[1]))
      warnings.push(`${file} skips pull requests by file path (paths / paths-ignore on pull_request): on a notes-only PR the workflow never starts, so a required check from it stays "expected" and blocks auto-merge. Make it start on every PR (filter inside the jobs instead).`);
  }
  return { jobs, warnings };
}

/**
 * Read-only look at an existing app before it moves to the current harness (issue #36): what it
 * uses, which modules it needs, how far its own files differ from the starters, what its App
 * profile, CI and database already have. Changes nothing. Returns the report's lines.
 */
export function inventory(app, studio) {
  const out = [];
  let lock = null;
  try {
    lock = readLock(app);
  } catch {
    out.push(`${LOCK} is unreadable; fix or rebuild it (pull --force) before migrating.`);
  }
  const has = (p) => existsSync(join(app, p));
  const read = (p) => (has(p) ? readFileSync(join(app, p), "utf8") : "");
  const locked = Object.keys(lock?.packs ?? {});
  const web = locked.includes("web") || has("server");
  const packs = locked.length ? locked : web ? ["base", "web"] : ["base", "artifact"];
  out.push(
    `Inventory of ${app} (read-only; nothing was changed).`,
    "",
    "Harness",
    `  app copy: ${lock ? `v${lock.studio}` : "none (no lock: install it first)"}; app-studio: v${studioVersion(studio)}`,
    `  packs: ${locked.length ? locked.join(", ") : `none recorded; assuming ${packs.join(" + ")}`}`,
  );

  // Features the app's own code uses (the same test the sync guard applies).
  const missing = missingModules(app, studio, packs);
  const need = missing.map((m) => m.pack);
  if (need.includes("ai") && web && !packs.includes("ai-web")) need.push("ai-web");
  const serverCode = listFiles(join(app, "server/src")).filter((f) => CODE_FILE.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
  out.push("", "Features in use");
  out.push(missing.length ? missing.map((m) => `  calls ${m.methods.map((x) => `${x}()`).join(", ")} -> needs the ${m.pack} module`) : ["  no calls to a module's methods found in the app's own code"].flat());
  if (web) out.push(`  server AI code: ${/\/api\/(ai|coach)|ai_usage|coach_usage|monthly_allowance/.test(serverCode) ? "found (needs ai-web)" : "not found"}`);
  const mode = read("render.yaml").match(/key:\s*SIGN_IN_MODE\s*\n\s*value:\s*["']?([^"'\n#\s]*)/)?.[1] ?? read(".github/workflows/ci.yml").match(/^\s*SIGN_IN_MODE:\s*["']?([^"'\n#\s]*)/m)?.[1];
  if (web) out.push(`  sign-in mode setting: ${mode ? mode : "not set (the server then means invite-only, today's behaviour)"}`);
  out.push(`  roadmap tooling: ${has("scripts/roadmap") ? "present (the app's own; keep it as it is, do not add the roadmap module)" : "none"}`);
  const custom = customAi(app, serverCode, studio);
  if (custom.length) {
    out.push(
      `  CUSTOM AI DESIGN found: ${custom.join("; ")}`,
      "  -> NOT a drop-in for the ai / ai-web modules. Switching them on replaces the app's platform and server files and breaks its AI tests; it needs a redesign of the app's AI, decided separately.",
      "  -> Recommended path: HARNESS ONLY (pull the harness files, record the profile, leave the app's AI and platform code alone; the module swap is a later, separate decision).",
    );
  }
  const toSwitch = custom.length ? [] : need;
  out.push(`  modules to switch on: ${custom.length ? `none for now (harness only; a redesign would be needed before ${need.join(", ") || "ai, ai-web"})` : need.length ? need.join(", ") : "none"}`);
  const moduleOf = (n) => { try { return packKind(studio, n) === "module"; } catch { return false; } };
  const modulesOn = locked.filter(moduleOf);
  out.push("", "Modules", `  on now: ${modulesOn.length ? modulesOn.join(", ") : "none"}${modulesOn.includes("user") ? " (user = who is signed in)" : ""}`);
  out.push(`  the code needs, not on yet: ${need.length ? need.join(", ") : "none"}`);
  out.push(`  roadmap: ${modulesOn.includes("roadmap") ? "module on" : has("scripts/roadmap") ? "the app's own tooling (module off, on purpose)" : "off"}`);
  out.push(`  sign-in mode: ${web ? (mode ? mode : "not set (the server then means invite-only)") : "not applicable (no server)"}`);

  // Starter files of the packs the app will have, compared with what the app holds today.
  const target = packClosure(studio, [...new Set([...packs, ...toSwitch])]);
  const starters = starterFiles(studio, target, lock?.app ?? defaultVars(app));
  const absent = [], differs = [], same = [];
  for (const [path, m] of Object.entries(starters)) {
    const cur = localHash(app, path);
    (cur === null ? absent : cur === m.hash ? same : differs).push(path);
  }
  out.push("", "The app's own files vs the current starters", `  identical: ${same.length}; new for this app: ${absent.length}; differ: ${differs.length}`);
  out.push(...list("differ (merge by hand, then ack)", differs), ...list("new (added by pull / pack add)", absent));
  const flows = listFiles(join(app, ".github/workflows")).map((f) => basename(f));
  out.push("", "CI", `  workflows: ${flows.join(", ") || "none"}`);
  if (!has(".github/workflows/harness.yml")) out.push("  harness.yml is missing (pull adds it as a new starter)");
  const ci = ciFindings(app);
  out.push(`  job names (the required checks must use the app's own): ${ci.jobs.length ? ci.jobs.join(", ") : "none found"}`);
  out.push(...ci.warnings.map((w) => `  WARNING: ${w}`));

  // Database: an AI usage table under another name would not be reused by ai_001_usage.sql.
  const usage = new Set();
  for (const f of listFiles(join(app, "server/migrations")))
    for (const m of readFileSync(f, "utf8").matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w*usage\w*)/gi)) usage.add(m[1]);
  if (web) {
    out.push("", "Database");
    const odd = [...usage].filter((t) => t !== "ai_usage");
    if (usage.has("ai_usage") && odd.length) {
      out.push(`  ${odd.join(", ")} and ai_usage both exist (a rename or copy already under way): ai_usage is the module's table; check the allowance data is in it, then ${odd.join(", ")} can be retired later`);
    } else out.push(
      usage.size === 0 ? "  no usage table in the migrations (ai_001_usage.sql creates one)" : odd.length ? `  usage table(s) named ${odd.join(", ")}: NOT the module's ai_usage. Stop and ask the owner before migrating (the allowance data would not carry over)` : "  ai_usage and monthly_allowance exist: ai_001_usage.sql changes nothing",
    );
  }

  const gaps = [...featureGaps(app), ...profileGaps(app)];
  const prof = profileSection(app);
  const answer = (f) => { const v = prof === null ? null : profileField(prof, f); return v === null ? "no row" : blankField(v) ? "not filled in" : v.replace(/`/g, ""); };
  out.push("", "App profile (CLAUDE.md)");
  if (prof !== null)
    out.push(`  AI: ${answer("AI") === "no row" || answer("AI") === "not filled in" ? answer("AI") : aiValue(prof)}`, `  Access model (who can get in): ${answer("Access model")}`, `  Storage shape: ${answer("Storage shape")}`);
  out.push(...(profileSection(app) === null ? ["  CLAUDE.md has no App profile yet"] : gaps.length ? gaps.map((g) => `  missing: ${g}`) : ["  Features rows are filled in"]));
  out.push(
    "",
    "Suggested order (one branch, one PR; the way back is reverting it)",
    "  1. pull, and when it says starter files are held back, add the modules in the same branch" + (toSwitch.length ? `: pack add ${toSwitch.join(" ")}` : custom.length ? " (custom AI: harness only, add no AI module)" : ""),
    "  2. merge the files listed as differing, then ack; run npm run check (and the server checks on the web)",
    "  3. record AI on / AI plan / Access model / Storage shape in the App profile; health must pass",
    "  4. prove it: the tests pass and one small follow-up PR merges by itself",
  );
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const code = run(argv);
  if (code === 2 || argv[0] === "ack" || argv[0] === "inventory" || argv[0] === "changelog" || argv[0] === "status" || argv[0] === "release-prepare" || argv[0] === "live-check-pass" || argv[0] === "sync") return code;
  let app;
  try {
    ({ app } = locate(parseArgs(argv)));
  } catch {
    return code;
  }
  markPreview(argv, app, code);
  // Only `hooks`, the SessionStart hook (`check --warn`) and the copying commands change git config or settings; `check` and `health` report, other reads are silent.
  const wires = (["hooks", "pull", "install", "pack"].includes(argv[0]) && !argv.includes("--dry-run")) || argv.includes("--warn");
  const reportOnly = !wires;
  const notes = activateHooks(app, process.env, { dry: reportOnly });
  const quiet = argv.includes("--warn") ? notes.filter((n) => n.includes("is off")) : notes;
  if (reportOnly && (!quiet.length || !["check", "health"].includes(argv[0]))) return code; // other reads stay silent
  if (reportOnly)
    console.log(`${quiet.map((n) => `Harness hooks: ${n}.`).join("\n")}\nThis command only reports. To turn the hooks on, run: node ${toPosix(relative(process.cwd(), process.argv[1]) || process.argv[1])} hooks --app ${toPosix(app)}`);
  else if (quiet.length) console.log(quiet.map((n) => `Harness hooks: ${n}.`).join("\n"));
  else if (argv[0] === "hooks") console.log("Harness hooks are on.");
  return code;
}

const READS_STUDIO = ["check", "health", "changelog", "inventory", "pack"];
const COPIES = (opts) => ["pull", "install"].includes(opts.cmd) || (opts.cmd === "pack" && opts.rest[0] === "add");

/**
 * A copy taken with --live-check comes from the checkout as it is (the studio-scratch check and the packs smoke test try what is not
 * released yet). The lock says so (`unreleased: true`), so the app's later commands compare against that same checkout until its next
 * ordinary pull.
 */
const previewed = (app) => { try { return readLock(app)?.unreleased === true; } catch { return false; } };

function markPreview(argv, app, code) {
  try {
    const opts = parseArgs(argv);
    if (!COPIES(opts) || opts.dry) return;
    const { studio } = locate(opts);
    const lock = readLock(app);
    if (!lock || !studio) return;
    const want = !!opts.liveCheck && unreleasedForApps(studio).length > 0;
    if (!!lock.unreleased === want || (want && code !== 0)) return; // a copy that failed or was refused took nothing
    if (want) lock.unreleased = true;
    else delete lock.unreleased;
    writeLock(app, lock);
  } catch { /* no lock to mark */ }
}

function run(argv) {
  let opts, app, studio;
  try {
    opts = parseArgs(argv);
    ({ app, studio } = locate(opts));
  } catch (e) {
    console.error(e.message);
    return argv.includes("--warn") ? 0 : 2;
  }
  if (opts.dry && !["pull", "sync"].includes(opts.cmd)) {
    console.error("--dry-run works with pull and sync only. Nothing was run or changed.");
    return 2;
  }
  // Apps get releases: read app-studio as of its current release while a change that reaches apps waits for the next one.
  // `status` and `sync` work on the checkout itself (sync's own pull comes back through here).
  // Only the commands that read app-studio's content take part; a copy (pull, install, pack add) stops when the release cannot be
  // read back, and the comparing ones go on without app-studio (against the lock alone), as when it is not found.
  // `ack` writes what it saw of app-studio into the lock, so it stops like a copy.
  const strict = COPIES(opts) || opts.cmd === "ack";
  if (studio && !opts.liveCheck && (COPIES(opts) || ((READS_STUDIO.includes(opts.cmd) || opts.cmd === "ack") && !previewed(app)))) {
    const view = releasedView(studio, { deepen: !opts.warn });
    if (view.error && !opts.warn) console.error(strict ? view.error : `${view.error.replace(/, so nothing was changed\..*$/, ".")} Going on without app-studio.`);
    if (view.error && strict) return 1;
    studio = view.error ? null : view.dir;
  }

  if (opts.cmd === "check") {
    let r;
    try {
      r = compare(app, studio);
    } catch (e) {
      console.log(`Studio harness check failed: ${e.message}`);
      return opts.warn ? 0 : 1;
    }
    const gaps = profileGaps(app);
    // In discovery, every session starts knowing the phase and what comes next.
    const stage = r.installed ? discoveryNote(app) : null;
    if (stage) console.log(stage);
    const notes = r.starters.length
      ? [
          "Pack starter files changed in app-studio (the app owns them; use the harness-sync skill):",
          ...r.starters.map(
            (n) => `  ${n.path} (${n.pack} pack): ${n.refreshable ? "unedited here, pull refreshes it" : r.held ? "held back" : "edited here, merge by hand then run ack"}`,
          ),
        ]
      : [];
    if (r.newStarters?.length) notes.push(...list(`pack starter files new in app-studio (${r.held ? "held back" : "pull adds them"})`, r.newStarters));
    if (r.held && (r.starters.length || r.newStarters?.length)) notes.push(`Pack starter files are held back: ${r.held}.`);
    if (r.partners?.length) notes.push(...r.partners.map((g) => `Module: ${g}.`));
    if (r.instructionsChanged) notes.push(...instructionsNote());
    if (gaps.length)
      notes.push("The App profile in CLAUDE.md still has unfilled placeholders:", ...gaps.map((g) => `  ${g}`));
    if (!drift(r)) {
      if (notes.length) console.log(notes.join("\n"));
      if (!studio && opts.warn && process.env.CLAUDE_CODE_REMOTE === "true")
        notes.push("app-studio isn't attached to this session, so the harness copy wasn't compared with the master copy.");
      if (!notes.length && !opts.warn)
        console.log(
          `Studio harness v${r.version} is in step${studio ? "" : " with its lock (app-studio not found, so not compared with the master copy)"}.`,
        );
      return 0;
    }
    const lines = r.installed
      ? [
          `Studio harness v${r.version}${r.studioVersion ? ` (app-studio has v${r.studioVersion})` : ""} is out of step:`,
          ...list("behind app-studio", r.behind),
          ...list("new in app-studio", r.added),
          ...list("removed in app-studio", r.removed),
          ...list("edited here", r.edited),
          ...list("missing here", r.missing),
          "Use the harness-sync skill to bring it in step.",
          ...notes,
        ]
      : [`No studio harness lock in ${app} (${LOCK}). Install it with the new-app skill (harness-sync only updates an app that already has it).`];
    console.log(lines.join("\n"));
    return opts.warn ? 0 : 1;
  }

  if (opts.cmd === "release-gate") {
    const blockers = releaseBlockers(app);
    if (!blockers.length) {
      console.log("Release gate: the App profile records the access model (and any decision it calls for).");
      return 0;
    }
    console.log(["Release stopped:", ...blockers.map((b) => `  - ${b}`)].join("\n"));
    return 1;
  }

  if (opts.cmd === "phase") {
    const phase = phaseOf(app);
    if (opts.buildOnly && phase === "discovery") {
      console.log(`Stopped: ${DISCOVERY_STOP}.`);
      return 1;
    }
    if (opts.discoveryOnly && phase !== "discovery") {
      console.log(`Stopped: ${BUILD_STOP}.`);
      return 1;
    }
    console.log(phase);
    return 0;
  }

  if (opts.cmd === "health") {
    const h = health(app, studio);
    const notes = h.notes.map((n) => `  note: ${n}`);
    if (!h.problems.length) {
      console.log([`Studio harness v${h.version} is healthy.`, ...notes].join("\n"));
      return 0;
    }
    console.log(
      ["Studio harness health check failed:", ...h.problems.map((p) => `  - ${p}`), ...notes].join("\n"),
    );
    return 1;
  }

  // Pull, install and pack add copy what app-studio holds into the app: stop while any release between the
  // app's version and app-studio's is waiting on its check on main. `--live-check` is for the studio-scratch check only.
  const pending = ["pull", "install"].includes(opts.cmd) || (opts.cmd === "pack" && opts.rest[0] === "add") ? pendingInRange(studio, readLock(app)?.studio) : [];
  if (pending.length && !opts.liveCheck) {
    console.error(
      `app-studio ${pending.map((v) => `v${v}`).join(", ")} ${pending.length === 1 ? "is" : "are"} not live-checked yet (status.main is pending in releases/), so nothing was changed. ` +
        "Wait until `node scripts/release.mjs pending` lists nothing, or run it with --live-check only for the studio-scratch check.",
    );
    return 1;
  }

  if (opts.cmd === "status") {
    if (!studio) {
      console.error("app-studio not found. Pass --studio <dir> or set STUDIO_DIR.");
      return 2;
    }
    const st = studioStatus(studio);
    console.log(st.text + (opts.scaffold ? `\n\nEmpty entry (${st.nextMinor} shown; change it if it is a patch):\n${changelogScaffold(st.nextMinor)}` : ""));
    return 0;
  }

  if (opts.cmd === "release-prepare") {
    const r = releasePrepare(app, { version: opts.version, apply: opts.apply });
    (r.ok ? console.log : console.error)(r.text);
    return r.ok ? 0 : 1;
  }

  if (opts.cmd === "release-cut") {
    const r = releaseCut(app, { version: opts.version });
    (r.ok ? console.log : console.error)(r.text);
    return r.ok ? 0 : 1;
  }

  if (opts.cmd === "release-tag-check") {
    if (!opts.rest[0]) {
      console.error("Usage: studio-sync.mjs release-tag-check X.Y.Z");
      return 2;
    }
    const r = tagCheck(app, opts.rest[0]);
    console.log(r.text);
    return r.ok ? 0 : 1;
  }

  if (opts.cmd === "live-check-pass") {
    console.error("Moved: run `node scripts/release.mjs pass-main <version>` (it sets the record to passed and renders CHANGELOG.md). Nothing was changed.");
    return 1;
  }

  if (opts.cmd === "sync") {
    if (!studio) {
      console.error("app-studio not found. Pass --studio <dir> or set STUDIO_DIR.");
      return 2;
    }
    return syncApp(app, studio, opts);
  }

  if (opts.cmd === "changelog") {
    if (!studio) {
      console.error("app-studio not found. Pass --studio <dir> or set STUDIO_DIR.");
      return 2;
    }
    console.log(changelogFor(studio, opts.since ?? readLock(app)?.studio));
    return 0;
  }

  if (opts.cmd === "pull" || opts.cmd === "install") {
    if (!studio) {
      console.error("app-studio not found. Pass --studio <dir> or set STUDIO_DIR.");
      return 2;
    }
    let r;
    const before = readLock(app)?.studio;
    try {
      r = (opts.cmd === "install" ? install : pull)(app, studio, opts);
    } catch (e) {
      console.error(e.message);
      return 1;
    }
    const lock = readLock(app);
    const ih = instructionsHash(studio);
    // A section the pull could not place is the thread's to merge: it is listed apart from the wording the pull did add.
    const byHand = (r.patched ?? []).filter((x) => /by hand/.test(x));
    const patched = (r.patched ?? []).filter((x) => !byHand.includes(x));
    fullLists = !!opts.dry;
    const lines = [
      opts.dry
        ? `Dry run: nothing was changed. A pull would bring ${app} ${before ? `from v${before} ` : ""}to studio harness v${studioVersion(studio)}:`
        : `Studio harness v${studioVersion(studio)} ${opts.cmd === "install" ? "installed in" : "pulled into"} ${app}.`,
      ...list("updated", r.written),
      ...newAgentsNote(r.newAgents),
      ...list("deleted", r.deleted),
      ...list("added from templates", r.templates ?? []),
      ...list("CLAUDE.md wording added (app text untouched; commit it with the sync)", patched),
      ...list("CLAUDE.md sections left as they are (merge by hand)", byHand),
      ...list("pack starters refreshed", r.refreshed ?? []),
      ...list("pack starters added (new in their pack)", r.created ?? []),
      ...(r.untaken?.length ? [`  pack starters not added: ${r.untaken.length} (this app never took the starter files of ${r.untakenPacks.join(", ")}, so it keeps its own; copy one by hand from app-studio's packs/<name>/starter/ only if wanted)`] : []),
      ...(r.held?.length ? [`  pack starters held back (${r.holdReason}): ${r.held.join(", ")}`] : []),
      ...list("pack starters changed upstream but edited here (merge by hand, then ack)", r.starterNotes ?? []),
      ...list("skipped (changed here; move the change to app-studio, or pass --force)", r.skipped),
      ...(r.clashes ?? []).map((c) => `  name clash: ${c}`),
      ...(opts.cmd === "pull" && ih && lock?.instructions !== ih ? instructionsNote() : []),
    ];
    if (opts.cmd === "pull" && before !== studioVersion(studio)) lines.push("", changelogFor(studio, before));
    if (opts.dry) lines.push("", "Dry run: nothing was changed. Run it again without --dry-run to apply this.");
    console.log(lines.join("\n"));
    return r.skipped.length || r.clashes?.length ? 1 : 0;
  }

  if (opts.cmd === "pack") {
    const [sub, ...names] = opts.rest;
    if ((sub !== "add" && sub !== "remove") || !studio) {
      console.error(studio ? "Usage: studio-sync.mjs pack add <name...> [--slug <kebab>] [--title <Name>] | pack remove <name...> [--force]" : "app-studio not found. Pass --studio <dir> or set STUDIO_DIR.");
      return 2;
    }
    if (sub === "remove") {
      let r;
      try {
        r = removePacks(app, studio, names, opts);
      } catch (e) {
        console.error(e.message);
        return 1;
      }
      console.log(
        [
          `Packs removed from ${app}: ${r.removed.join(", ")}.`,
          ...list("managed files deleted", r.deleted),
          ...list("starter files kept (the app's own now)", r.startersKept),
          ...list("skipped (changed here; pass --force)", r.skipped),
          "  package.json entries and any files you built on the pack stay; remove those by hand if unused.",
        ].join("\n"),
      );
      return r.skipped.length ? 1 : 0;
    }
    let r;
    try {
      r = addPacks(app, studio, names, opts);
    } catch (e) {
      console.error(e.message);
      return 1;
    }
    console.log(
      [
        `Packs added to ${app}: ${byKind(studio, r.added) || "none new"}.`,
        ...list("managed files", r.written),
        ...newAgentsNote(r.newAgents),
        ...list("starter files created", r.created),
        ...list("starter files kept (already there, different)", r.kept),
        ...list("starter files of the packs it already had refreshed", r.refreshed ?? []),
        ...list("pack starters changed upstream but edited here (merge by hand, then ack)", r.starterNotes ?? []),
        ...(r.ignoreLine ? [`  added the line docs/**/*.html to ${r.ignoreLine} (a saved HTML prototype no longer fails npm run check)`] : []),
        ...list("package.json entries added", r.packageJson),
        ...(r.partners ?? []).map((g) => `  module: ${g}`),
        ...list("skipped (changed here; pass --force)", r.skipped),
        ...(r.clashes ?? []).map((c) => `  name clash: ${c}`),
      ].join("\n"),
    );
    return r.skipped.length || r.clashes?.length ? 1 : 0;
  }

  if (opts.cmd === "inventory") {
    if (!studio) {
      console.error("app-studio not found. Pass --studio <dir> or set STUDIO_DIR.");
      return 2;
    }
    console.log(inventory(app, studio).join("\n"));
    return 0;
  }

  if (opts.cmd === "hooks") return 0;

  if (opts.cmd === "ack") {
    if (!studio) {
      console.error("app-studio not found. Pass --studio <dir> or set STUDIO_DIR.");
      return 2;
    }
    const done = ack(app, studio, opts.rest);
    console.log(done.length ? `Marked as reviewed: ${done.join(", ")}` : "Nothing to mark.");
    return 0;
  }

  console.error("Usage: studio-sync.mjs <install|check|inventory|health|phase|pull|sync|changelog|status|release-prepare|pack add|pack remove|ack|hooks> [--app <dir>] [--studio <dir>] [--warn] [--force] [--dry-run] [--live-check]");
  return 2;
}

// Run main only when executed directly, not when imported by the tests.
const same = (a, b) => {
  const norm = (p) => realpathSync(p)[process.platform === "win32" ? "toLowerCase" : "toString"]();
  return norm(a) === norm(b);
};
if (process.argv[1] && existsSync(process.argv[1]) && same(process.argv[1], fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
