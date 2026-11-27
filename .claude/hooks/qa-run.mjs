#!/usr/bin/env node
// The mechanical part of QA, before the qa agent explores by hand: build, the browser specs for what changed
// plus the packs' baseline specs, and the build output against the packs' limits. One pass/fail table.
// Judgement stays with the qa agent (does a spec cover a criterion, what a failure means). Node built-ins only.
// Shared studio harness file: change it in app-studio, never in an app.
//
//   node .claude/hooks/qa-run.mjs [--base main] [--all] [--json]
//     --all   run the whole browser suite instead of changed + baseline specs
// Exit code 1 when a step failed. A failure prints its short summary (failure-summary.mjs), not the whole log.
// Limits come from the installed packs: `.claude/packs/<name>/qa-rules.json`
//   { "outputs": [ { "dir": "dist-artifact", "maxBytes": 16777216, "onlyFiles": ["index.html"], "forbid": ["sk-ant-"] } ] }
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const sh = process.platform === "win32";
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: "utf8", shell: sh, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, CI: "" } });

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** What the build left in `dir`, against one pack rule: [{ ok, what }]. */
export function checkOutput(root, rule) {
  const dir = join(root, rule.dir);
  // `npm run build` builds one target (the first pack's); another pack's folder is then not there, which is fine.
  if (!existsSync(dir)) return [{ ok: true, what: `${rule.dir}/ not built by \`npm run build\`: not checked` }];
  const files = walk(dir);
  const rels = files.map((f) => relative(dir, f).split("\\").join("/")).sort();
  const total = files.reduce((n, f) => n + statSync(f).size, 0);
  const out = [];
  if (rule.maxBytes) out.push({ ok: total <= rule.maxBytes, what: `${rule.dir}/ is ${(total / 1048576).toFixed(2)} MB (limit ${(rule.maxBytes / 1048576).toFixed(0)} MB)` });
  if (rule.onlyFiles) {
    const same = rels.length === rule.onlyFiles.length && rule.onlyFiles.every((f) => rels.includes(f));
    out.push({ ok: same, what: same ? `${rule.dir}/ holds only ${rule.onlyFiles.join(", ")}` : `${rule.dir}/ holds ${rels.slice(0, 6).join(", ")}${rels.length > 6 ? ", …" : ""}; expected only ${rule.onlyFiles.join(", ")}` });
  }
  for (const needle of rule.forbid ?? []) {
    const hit = files.find((f) => readFileSync(f, "latin1").includes(needle));
    out.push({ ok: !hit, what: hit ? `"${needle}" found in ${relative(root, hit)}` : `no "${needle}" in ${rule.dir}/` });
  }
  return out;
}

function outputRules(root) {
  const dir = join(root, ".claude", "packs");
  const rules = [];
  if (!existsSync(dir)) return rules;
  for (const pack of readdirSync(dir)) {
    const f = join(dir, pack, "qa-rules.json");
    if (!existsSync(f)) continue;
    try { for (const r of JSON.parse(readFileSync(f, "utf8")).outputs ?? []) rules.push({ ...r, pack }); } catch { rules.push({ broken: true, pack }); }
  }
  return rules;
}

/** Specs to run: those the diff adds or changes under e2e/, plus every baseline spec. */
export function pickSpecs(root, changed) {
  const specs = new Set(changed.filter((p) => /^e2e\/.+\.spec\.[jt]s$/.test(p) && existsSync(join(root, p))));
  const e2e = join(root, "e2e");
  if (existsSync(e2e)) for (const f of walk(e2e)) if (/baseline\.spec\.[jt]s$/.test(f)) specs.add(relative(root, f).split("\\").join("/"));
  return [...specs].sort();
}

export async function qaRun(root, { base = "main", all = false } = {}) {
  const rows = [];
  const add = (step, ok, detail) => rows.push({ step, ok, detail });
  const pkg = existsSync(join(root, "package.json")) ? JSON.parse(readFileSync(join(root, "package.json"), "utf8")) : {};
  const scripts = pkg.scripts ?? {};
  const { summarize } = await import("./failure-summary.mjs");
  const fail = (label, r) => summarize(`${r.stdout ?? ""}\n${r.stderr ?? ""}`, { label }).split("\n").slice(0, 12).join("\n");

  if (scripts.build) {
    const r = run("npm", ["run", "build"], root);
    add("build", r.status === 0, r.status === 0 ? "npm run build" : fail("Build", r));
  } else add("build", false, "no `build` script in package.json");

  const diff = run("git", ["diff", "--name-only", `${base}...HEAD`], root);
  const changed = diff.status === 0 ? diff.stdout.split("\n").filter(Boolean) : [];
  if (!scripts["test:e2e"]) add("browser specs", false, "no `test:e2e` script in package.json");
  else {
    const specs = all ? [] : pickSpecs(root, changed);
    if (!all && !specs.length) add("browser specs", true, "no changed or baseline spec to run (the qa agent checks coverage)");
    else {
      const r = run("npm", ["run", "test:e2e", "--", ...specs], root);
      add("browser specs", r.status === 0, r.status === 0 ? (all ? "the whole suite" : specs.join(", ")) : fail("Browser specs", r));
    }
  }
  for (const rule of outputRules(root)) {
    if (rule.broken) { add("build output", false, `${rule.pack}/qa-rules.json is not valid JSON`); continue; }
    for (const c of checkOutput(root, rule)) add("build output", c.ok, `[${rule.pack}] ${c.what}`);
  }
  return rows;
}

export function table(rows) {
  const lines = ["| Step | Result | Detail |", "| --- | --- | --- |"];
  for (const r of rows) lines.push(`| ${r.step} | ${r.ok ? "pass" : "FAIL"} | ${r.detail.replace(/\n/g, "<br>").replace(/\|/g, "\\|")} |`);
  lines.push("", rows.every((r) => r.ok) ? "qa-run: all mechanical steps passed. Exploratory checks are still yours." : "qa-run: some steps failed; report them as bugs.");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const a = process.argv.slice(2);
  const rows = await qaRun(process.cwd(), { base: a.includes("--base") ? a[a.indexOf("--base") + 1] : "main", all: a.includes("--all") });
  console.log(a.includes("--json") ? JSON.stringify(rows, null, 2) : table(rows));
  process.exit(rows.every((r) => r.ok) ? 0 : 1);
}
