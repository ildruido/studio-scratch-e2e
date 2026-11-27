#!/usr/bin/env node
// The mechanical part of a code review, before the reviewer agent starts: process rules and greppable
// rules over the diff. Prints findings; the reviewer decides which are real and how severe (a hit is a
// lead, not a verdict). Always exits 0. Node built-ins only. Shared studio harness file: change it in app-studio.
//
//   node .claude/hooks/review-precheck.mjs [--base main] [--json]
//   node .claude/hooks/review-precheck.mjs risk [--base main] [--json]   which reviewer agent to run (below)
//
// Rules come from the installed packs: `.claude/packs/<name>/review-rules.json`
//   { "rules": [ { "id", "severity": "blocking"|"check", "message",
//                  "paths": ["<regex on the file path>"], "except": ["<regex>"], "added": "<regex on an added line>",
//                  "unlessPack": ["<pack>"]            skip the rule when any of these packs is installed
//                  "hostsExcept": ["<host suffix>"]    "added" is ignored; flags http(s) hosts not on this list
//                  "newTopLevelNotIn": "<file>"        a file added at a top level name that file doesn't mention
//                  "modifiedFiles": true } ] }          flags changed (not added or deleted) files matching "paths"
// A pack file may also carry "risky": ["<regex on the file path>"]: the areas whose changes need the deeper
// reviewer (`risk`). A diff is high risk when it touches such a path or changes more than RISK_LINES lines.
// The core knows no pack and no app feature: everything pack-specific lives in those files.
//
// A harness sync or `pack add` changes many harness files at once. Those were reviewed in app-studio, so a changed file
// that is exactly what `.claude/studio/lock.json` records (`harnessFiles`) is no lead, counts for no risk, and needs no
// review or QA result at the push and merge gates. A harness file edited by hand no longer matches the lock and still does.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: \S/;
const SECRETS = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/, "an Anthropic key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS key id"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "a GitHub token"],
  [/(api[_-]?key|secret|token|passw(or)?d)["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i, "a hard-coded credential"],
];
const RISK_LINES = 400;
const isTest = (p) => /(^|\/)(tests?|e2e|__tests__)\//.test(p) || /\.(test|spec)\.[jt]sx?$|\.test\.mjs$/.test(p);

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

const LOCK = ".claude/studio/lock.json";
// The same hash the sync tool writes into the lock: sha256 of the text, line endings aside.
const hashText = (text) => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
const readJson = (text) => { try { return JSON.parse(text ?? ""); } catch { return null; } };

/**
 * The changed files that are the harness's own, exactly as the lock at HEAD records them: a managed file or an untouched pack
 * starter file whose committed text has the lock's hash, a managed file the sync removed (in the base lock, gone from this one),
 * and the lock itself. Read from the commit, not the folder, because the gates judge the commit. Empty where there is no lock
 * (app-studio itself) or the diff does not change the lock (no sync, no pack change: nothing moved a harness file on purpose).
 */
export function harnessFiles(root, ref, names) {
  const out = new Set();
  if (!names.includes(LOCK)) return out;
  const lock = readJson(git(["show", `HEAD:${LOCK}`], root));
  if (!lock) return out;
  const files = lock.files ?? {};
  const starters = lock.starters ?? {};
  const before = readJson(git(["show", `${ref}:${LOCK}`], root))?.files ?? {};
  out.add(LOCK);
  for (const p of names) {
    const want = typeof files[p] === "string" ? files[p] : typeof starters[p]?.installed === "string" ? starters[p].installed : null;
    const text = want || p in before ? git(["show", `HEAD:${p}`], root) : null;
    if (want ? text !== null && hashText(text) === want : p in before && !(p in files) && text === null) out.add(p);
  }
  return out;
}

/** [{ path, line, text }] for every added line of a unified diff with no context. */
export function addedLines(diff) {
  const out = [];
  let path = null;
  let line = 0;
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) path = l === "+++ /dev/null" ? null : l.slice(6);
    else if (l.startsWith("@@")) line = Number(/\+(\d+)/.exec(l)?.[1] ?? 0);
    else if (path && l.startsWith("+")) out.push({ path, line: line++, text: l.slice(1) });
  }
  return out;
}

/** Agents whose file this change itself adds (`.claude/agents/<name>.md`, absent on the base), e.g. through a harness sync or
 *  `pack add`. A session lists its agents when it starts, so the one that made the change may not be offered them. */
export function addedAgents(root, range) {
  return (git(["diff", "--name-only", "--diff-filter=A", range, "--", ".claude/agents"], root) ?? "")
    .split("\n")
    .map((n) => /^\.claude\/agents\/([^/]+)\.md$/.exec(n)?.[1])
    .filter(Boolean);
}
/** What to do when the session doesn't offer an agent this change added: the same instructions and model, run through a general-purpose agent. */
export const standIn = (agent) =>
  `\`${agent}\` is new in this change and a session lists its agents when it starts: if the Agent tool doesn't offer it, run a general-purpose agent told to read and follow \`.claude/agents/${agent}.md\`, on the model that file names`;

/** Which reviewer agent a diff needs, decided by code from the packs' "risky" path patterns and the size of the diff. */
export function risk(root, base = "main") {
  const ref = git(["rev-parse", "--verify", "-q", `origin/${base}`], root) ? `origin/${base}` : git(["rev-parse", "--verify", "-q", base], root) ? base : null;
  if (!ref) return { error: `no base branch "${base}" to compare with` };
  // In a shallow clone `...` has no merge base: fall back to comparing with the base tip.
  const range = git(["diff", "--name-only", `${ref}...HEAD`], root) !== null ? `${ref}...HEAD` : `${ref}..HEAD`;
  const all = (git(["diff", "--name-only", range], root) ?? "").split("\n").filter(Boolean);
  // Harness files as the lock records them were reviewed in app-studio: the risk is rated on the rest.
  const harness = harnessFiles(root, ref, all);
  const names = all.filter((n) => !harness.has(n));
  const lines = (git(["diff", "--numstat", "--no-renames", range], root) ?? "").split("\n").reduce((n, l) => {
    const [plus, minus, path] = l.split("\t");
    return harness.has(path) ? n : n + (Number(plus) || 0) + (Number(minus) || 0);
  }, 0);
  const dir = join(root, ".claude", "packs");
  const patterns = [];
  for (const pack of existsSync(dir) ? readdirSync(dir) : []) {
    try { for (const re of JSON.parse(readFileSync(join(dir, pack, "review-rules.json"), "utf8")).risky ?? []) patterns.push({ pack, re: new RegExp(re) }); } catch { /* no rule file */ }
  }
  const paths = names.filter((n) => patterns.some((p) => p.re.test(n)));
  const big = lines > RISK_LINES;
  const high = paths.length > 0 || big;
  const reviewer = high ? "reviewer-deep" : "reviewer";
  return { risk: high ? "high" : "routine", reviewer, newAgents: addedAgents(root, range), paths, lines, harness: harness.size, because: [...(paths.length ? ["risky paths"] : []), ...(big ? [`more than ${RISK_LINES} lines changed`] : [])] };
}

export function renderRisk(r) {
  if (r.error) return `review-precheck: ${r.error}`;
  const out = [`risk: ${r.risk}`, `Run the \`${r.reviewer}\` agent (${r.lines} lines changed${r.because.length ? `; ${r.because.join(", ")}` : ""}).`];
  if (r.newAgents?.includes(r.reviewer)) out.push(`${standIn(r.reviewer)}.`);
  for (const p of r.paths) out.push(`- ${p}`);
  if (r.harness) out.push(`Not counted: ${r.harness} harness file(s) exactly as ${LOCK} records them (a sync or a pack change; reviewed in app-studio).`);
  return out.join("\n");
}

function packRules(root) {
  const dir = join(root, ".claude", "packs");
  const packs = existsSync(dir) ? readdirSync(dir).filter((n) => existsSync(join(dir, n))) : [];
  const rules = [];
  for (const pack of packs) {
    const f = join(dir, pack, "review-rules.json");
    if (!existsSync(f)) continue;
    try {
      for (const r of JSON.parse(readFileSync(f, "utf8")).rules ?? []) rules.push({ ...r, pack });
    } catch (e) {
      rules.push({ id: "bad-rules-file", severity: "check", message: `${pack}/review-rules.json is not valid JSON`, pack, broken: true });
    }
  }
  return { packs, rules };
}

/** Leads for the reviewer's "does the scenario test this change" judgement. Empty outside app-studio. */
export function scenarioLeads(root, ref, names) {
  if (!names.some((n) => n === "releases/scenarios.json" || /^releases\/\d[^/]*\.json$/.test(n))) return [];
  const read = (txt) => { try { return JSON.parse(txt ?? "{}"); } catch { return {}; } };
  const now = read(existsSync(join(root, "releases/scenarios.json")) ? readFileSync(join(root, "releases/scenarios.json"), "utf8") : null).scenarios ?? [];
  const before = new Map((read(git(["show", `${ref}:releases/scenarios.json`], root)).scenarios ?? []).map((s) => [s.id, JSON.stringify(s)]));
  const byId = new Map(now.map((s) => [s.id, s]));
  const out = [];
  const changed = now.filter((s) => before.get(s.id) !== JSON.stringify(s));
  for (const s of changed) out.push({ id: "scenario-added", where: `releases/scenarios.json (${s.id}, ${s.where})`, message: `${before.has(s.id) ? "changed" : "new"} scenario: "${s.title}". Prompt: ${String(s.prompt).slice(0, 300)}` });
  const named = new Set();
  for (const n of names.filter((x) => /^releases\/\d[^/]*\.json$/.test(x))) {
    const c = read(existsSync(join(root, n)) ? readFileSync(join(root, n), "utf8") : null).checks ?? {};
    for (const id of [...(Array.isArray(c.branch) ? c.branch : []), ...(Array.isArray(c.main) ? c.main : [])]) if (typeof id === "string") named.add(id);
  }
  for (const id of named) {
    if (!byId.has(id)) out.push({ id: "scenario-unknown", where: id, message: "the release record names a scenario that is not in releases/scenarios.json" });
    else if (!changed.some((s) => s.id === id)) out.push({ id: "scenario-reused", where: id, message: `the release record reuses existing scenario "${byId.get(id).title}": judge whether it exercises this change` });
  }
  if (out.length && !names.some(isTest)) out.push({ id: "no-test-file", where: "diff", message: "scenarios are involved but no test file changed: where does a unit test prove the change?" });
  return out;
}

export function precheck(root, base = "main") {
  const findings = [];
  const add = (severity, id, where, message) => findings.push({ severity, id, where, message });
  const ref = git(["rev-parse", "--verify", "-q", base], root) ? base : git(["rev-parse", "--verify", "-q", `origin/${base}`], root) ? `origin/${base}` : null;
  if (!ref) return { error: `no base branch "${base}" to compare with`, findings };

  const range = `${ref}...HEAD`;
  const names = (git(["diff", "--name-only", range], root) ?? "").split("\n").filter(Boolean);
  const newFiles = (git(["diff", "--name-only", "--diff-filter=A", range], root) ?? "").split("\n").filter(Boolean);
  const modified = (git(["diff", "--name-only", "--diff-filter=M", range], root) ?? "").split("\n").filter(Boolean);
  const added = addedLines(git(["diff", "-U0", "--no-color", range], root) ?? "");
  const { packs, rules } = packRules(root);
  const harness = harnessFiles(root, ref, names);
  // A sync or pack change with nothing else but docs and harness notes beside it: not a change to the app's own behaviour.
  const syncOnly = harness.size > 0 && names.every((n) => harness.has(n) || /\.md$|^\.claude\//.test(n));

  // Process: commits.
  const log = git(["log", "--no-merges", "--format=%h%x1f%B%x1e", `${ref}..HEAD`], root) ?? "";
  for (const entry of log.split("\x1e").map((s) => s.trim()).filter(Boolean)) {
    const [hash, msg] = entry.split("\x1f");
    if (!CONVENTIONAL.test(msg.split("\n")[0])) add("check", "commit-format", hash, "commit subject is not a Conventional Commit");
    if (!/^Refs?:\s*\S/m.test(msg)) add("check", "commit-refs", hash, "commit has no `Refs:` line with the backlog item id");
  }
  // Process: CHANGELOG and harness-managed files.
  if (names.length && !names.includes("CHANGELOG.md") && !syncOnly) add("check", "changelog", "CHANGELOG.md", "the diff does not touch CHANGELOG.md (an entry under Unreleased is expected)");
  const lock = join(root, LOCK);
  if (existsSync(lock)) {
    let managed = [];
    try { managed = Object.keys(JSON.parse(readFileSync(lock, "utf8")).files ?? {}); } catch { /* unreadable lock: the health check says so */ }
    for (const p of names.filter((n) => managed.includes(n) && !harness.has(n))) add("blocking", "managed-file-edited", p, "edits a harness file managed by .claude/studio/lock.json (change it in app-studio, not here)");
  }

  // Security greps over added lines (docs and lockfiles are not code).
  const code = added.filter((a) => !/\.(md|lock)$|package-lock\.json$/.test(a.path));
  for (const a of code) {
    if (/\.innerHTML\s*[+]?=|insertAdjacentHTML\s*\(/.test(a.text) && !isTest(a.path)) add("check", "inner-html", `${a.path}:${a.line}`, "innerHTML / insertAdjacentHTML: textContent unless the text is a fixed literal");
    for (const [re, what] of SECRETS) {
      if (re.test(a.text)) { add(isTest(a.path) ? "check" : "blocking", "secret-like", `${a.path}:${a.line}`, `looks like ${what}`); break; }
    }
  }
  if (names.includes(".env") || newFiles.some((f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f))) add("blocking", "env-file", ".env", "an env file is part of the diff");

  // Scenario fit (app-studio only: apps have no releases/scenarios.json). Gather the inputs; the reviewer judges.
  const scen = scenarioLeads(root, ref, names);
  for (const l of scen) add("check", l.id, l.where, l.message);

  // Pack rules.
  for (const rule of rules) {
    if (rule.broken) { add(rule.severity, rule.id, `${rule.pack}`, rule.message); continue; }
    if ((rule.unlessPack ?? []).some((p) => packs.includes(p))) continue;
    const inPaths = (p) => (!rule.paths || rule.paths.some((re) => new RegExp(re).test(p))) && !(rule.except ?? []).some((re) => new RegExp(re).test(p));
    const tag = `[${rule.pack}] ${rule.message}`;
    if (rule.newTopLevelNotIn) {
      const f = join(root, rule.newTopLevelNotIn);
      const listed = existsSync(f) ? readFileSync(f, "utf8") : "";
      const seen = new Set();
      for (const p of newFiles.filter(inPaths)) {
        const top = p.split("/")[0];
        const key = p.includes("/") ? `${top}/` : top;
        if (seen.has(key) || listed.includes(key) || listed.includes(p)) continue;
        seen.add(key);
        add(rule.severity ?? "check", rule.id, p, tag);
      }
      continue;
    }
    if (rule.modifiedFiles) {
      for (const p of modified.filter(inPaths)) add(rule.severity ?? "check", rule.id, p, tag);
      continue;
    }
    if (rule.hostsExcept) {
      for (const a of added.filter((x) => inPaths(x.path))) {
        for (const m of a.text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
          const host = m[1].toLowerCase();
          if (host === "localhost" || host === "w3.org" || host.endsWith(".w3.org")) continue;
          if (!rule.hostsExcept.some((h) => host === h || host.endsWith(`.${h}`))) { add(rule.severity ?? "check", rule.id, `${a.path}:${a.line}`, `${tag} (${host})`); break; }
        }
      }
      continue;
    }
    if (!rule.added) continue;
    const re = new RegExp(rule.added);
    for (const a of added.filter((x) => inPaths(x.path) && re.test(x.text))) add(rule.severity ?? "check", rule.id, `${a.path}:${a.line}`, tag);
  }
  return { base: ref, files: names.length, harness: harness.size, findings };
}

export function render(result) {
  if (result.error) return `review-precheck: ${result.error}`;
  const f = result.findings;
  const lines = [`review-precheck: ${f.length} lead(s) in ${result.files} changed file(s) against ${result.base}. Leads, not verdicts: you judge each and its severity.`];
  for (const x of [...f].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "blocking" ? -1 : 1))) lines.push(`- ${x.severity.toUpperCase()} ${x.id} ${x.where}: ${x.message}`);
  if (!f.length) lines.push("- nothing mechanical found");
  if (result.harness) lines.push(`Not leads: ${result.harness} harness file(s) exactly as ${LOCK} records them (a sync or a pack change; reviewed in app-studio, nothing to review here).`);
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const a = process.argv.slice(2);
  const base = a.includes("--base") ? a[a.indexOf("--base") + 1] : "main";
  if (a[0] === "risk") {
    const r = risk(process.cwd(), base);
    console.log(a.includes("--json") ? JSON.stringify(r, null, 2) : renderRisk(r));
    process.exit(0);
  }
  const result = precheck(process.cwd(), base);
  console.log(a.includes("--json") ? JSON.stringify(result, null, 2) : render(result));
}
