#!/usr/bin/env node
// Fixed-text and pure-mapping steps of `new-app` (and `migrate-app`), so Claude doesn't re-type them each run.
// Judgement stays with Claude: the questions, the product paragraph, the proposed "What do you want to work on?"
// sentence and merging into an existing CLAUDE.md. Node built-ins only. Shared studio harness file: change it in
// app-studio, never in an app.
//
//   node .claude/hooks/app-setup.mjs pack-plan --target artifact|web|web+artifact|static-site --ai on|off
//        --access invite|open|none|shared [--storage per-person|shared|other] [--roadmap yes|no] --slug <repo> --title "<App name>"
//   node .claude/hooks/app-setup.mjs admin-checklist --repo <owner/repo> [--checks "CI gate,health"] [--default-branch <name>] [--env-missing] [--cloudflare]
//   node .claude/hooks/app-setup.mjs project-report --name "<App name>" --repo <owner/repo> [--goal "<sentence>"] [--studio <app-studio dir>] [admin-checklist flags]
//   node .claude/hooks/app-setup.mjs profile set "Field=value" ...
//   node .claude/hooks/app-setup.mjs profile init --discovery --name "<App name>" --prefix <XX> --repo <owner/repo> ["Field=value" ...]
//   node .claude/hooks/app-setup.mjs discovery-profile init --product "<one line>" --users "<one line>" [--idea <path>] [--docs <folder>]
//        [--sign-off "per artifact"|"autonomous with record"] ["Row=value" ...]      (the discovery module's profile section)
//   node .claude/hooks/app-setup.mjs discovery-profile set "Row=value" ...
//   node .claude/hooks/app-setup.mjs discovery-profile close [--date YYYY-MM-DD]     (at "start building": removes the section, marks status.md as history)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc, nl, parseArgs } from "./backlog.mjs";
import { decisionEntries, logPath, maxDecision, textsFor } from "./decisions.mjs";

const SYNC = "node .claude/studio/studio-sync.mjs";
const BOOL = ["env-missing", "cloudflare", "discovery"];
const TARGETS = ["artifact", "web", "web+artifact", "static-site"];

/** Pack list, commands and flags from the App Creator's answers (new-app steps 2, 4 and 7). Throws on a combination that can't exist. */
export function packPlan({ target, ai, access, storage = "other", roadmap = "no", slug, title }) {
  if (!TARGETS.includes(target)) throw new Error(`--target must be one of ${TARGETS.join(", ")}`);
  if (!slug || !title) throw new Error('--slug <repo> and --title "<App name>" are required');
  const site = target === "static-site";
  const web = target.includes("web");
  if (site) {
    if (ai === "on") throw new Error("a static site has no AI (no base pack): pick another target or turn AI off");
    if (access && !["none"].includes(access)) throw new Error("a static site has no sign-in: access is `none`");
  } else {
    if (!["on", "off"].includes(ai)) throw new Error("--ai must be on or off");
    if (!["invite", "open", "none", "shared"].includes(access)) throw new Error("--access must be invite, open, none or shared");
    if (web && access === "shared") throw new Error("`shared` (whoever the App Creator shares it with) is the artifact-only access model; a web app needs invite, open or none");
    if (!web && access !== "shared") throw new Error("an artifact-only app is shared by link: use --access shared (a sign-in model needs the web target)");
  }
  const packs = site ? ["static-site"] : target === "web+artifact" ? ["web", "artifact"] : [target];
  const commands = [`${SYNC} pack add ${packs.join(" ")} --slug ${slug} --title "${title}"`, "npm install"];
  if (web) commands.push("npm install --prefix server");
  const notes = [];
  if (!site && ai === "on") commands.push(`${SYNC} pack add ${web ? "ai-web" : "ai"}`);
  const user = !site && (access === "invite" || access === "open" || (!web && storage === "per-person"));
  if (user) commands.push(`${SYNC} pack add user`);
  if (roadmap === "yes") commands.push(`${SYNC} pack add roadmap`);
  const signIn = web ? access : null;
  if (signIn) notes.push(`Set SIGN_IN_MODE=${signIn} in render.yaml and in .github/workflows/ci.yml (the server refuses to start until it is set).`);
  if (!site && ai === "on" && (access === "open" || access === "none")) notes.push("AI is on and anyone can get in: raise the AI public use decision now (prd-intake \"Features\", question 4) and fill the App profile's AI public use row.");
  if (site) notes.push("Static site: no seed page, SIGN_IN_MODE, ai, ai-web or user. Profile rows are the ones in new-app's static-site.md.");
  return { packs, commands, signIn, user, notes };
}

const CLICK = "→";
/** The Admin's one-time repo clicks (new-app step 10, migrate-app via the proof PR), as exact text. */
export function adminChecklist({ repo, checks = "CI gate,health", defaultBranch = "main", envMissing = false, cloudflare = false }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? "")) throw new Error("--repo must be <owner/repo>");
  const names = checks.split(",").map((s) => s.trim()).filter(Boolean);
  const url = `github.com/${repo}`;
  const out = [];
  let n = 1;
  if (defaultBranch !== "main")
    out.push(`${n++}. Switch the default branch to \`main\` first (Project threads start from it and the ruleset targets it): ${url} ${CLICK} Settings ${CLICK} General ${CLICK} Default branch ${CLICK} switch icon ${CLICK} choose \`main\` ${CLICK} Update ${CLICK} confirm.`);
  out.push(`${n++}. ${url} ${CLICK} Settings ${CLICK} General ${CLICK} Pull Requests: untick **Allow merge commits** and **Allow rebase merging** (keep **Allow squash merging**), tick **Allow auto-merge** and **Automatically delete head branches**.`);
  out.push(
    `${n++}. ${url} ${CLICK} Settings ${CLICK} Rules ${CLICK} Rulesets ${CLICK} New ruleset ${CLICK} New branch ruleset: name \`main\`; Enforcement status **Active**; Target branches ${CLICK} Add target ${CLICK} **Include default branch**; tick **Restrict deletions** and **Block force pushes**; tick **Require status checks to pass** ${CLICK} Add checks ${CLICK} ${names.map((c) => `\`${c}\``).join(" and ")}; leave "Require branches to be up to date" off, so a PR doesn't stall when \`main\` moves; **Create**.`,
  );
  if (envMissing) out.push(`${n++}. Select the cloud environment "app-studio apps" for this Project (the thread had no "Studio harness loaded" message).`);
  if (cloudflare)
    out.push(`${n++}. Cloudflare (static site): create the account, then add the API token and account id as GitHub repository secrets; \`docs/PREVIEW.md\` in the app has the exact steps, including Cloudflare Access to protect previews and the content repo. Until then the first Deploy run can't publish.`);
  out.push(`When these are done, tell me: I then switch on auto-merge on the bootstrap PR, which proves the setup.`);
  return out.join("\n");
}

/** The part of the project-instructions template below its `---` line, with the app's names filled in. */
export function projectInstructions(template, { name, repo }) {
  const body = nl(template).split(/^---\s*$/m).slice(1).join("---").trim();
  if (!body) throw new Error("the project-instructions template has no `---` line");
  return body.replaceAll("<App name>", name).replaceAll("<app repo>", repo.split("/").pop());
}

export function projectReport({ name, repo, goal, template, checklist }) {
  return [
    "## 1. Project instructions (set as Project settings → Memory → Project instructions)",
    "",
    projectInstructions(template, { name, repo }),
    "",
    "## 2. Settings to apply",
    "- Thread model: Sonnet",
    "- Thread effort: medium",
    "- Coordinator model: Opus",
    "",
    '## 3. Proposed "What do you want to work on?" (the App Creator approves it; if it can\'t be set, it goes on the App Creator\'s checklist)',
    goal ?? "TODO (Claude): one or two sentences from the PRD's goal and first milestone, e.g. \"Ship <App name> v1: <the core promise>, tested by the App Creator on <the release target>\".",
    "",
    "## 4. Admin's checklist (exact clicks, only what isn't done yet)",
    checklist,
  ].join("\n");
}

// --- App profile table ---
const PROFILE_FIELDS = ["App", "Phase", "Id prefix", "Stack", "User", "Repo", "Release target", "Preview target", "Capabilities", "AI", "AI plan", "Access model", "Storage shape", "Decision log", "Owner-merged repos", "AI public use"];
const TBD_ROWS = ["Stack", "Release target", "Preview target", "Capabilities", "AI", "AI plan", "Access model", "Storage shape"];
const TBD = "TBD (decided at build start)";
const profileRange = (md, heading = "App profile") => {
  const m = new RegExp(`^## ${esc(heading)}[ \\t]*$`, "m").exec(md);
  if (!m) return null;
  const bodyStart = m.index + m[0].length;
  const next = /^## /m.exec(md.slice(bodyStart));
  return { bodyStart, end: next ? bodyStart + next.index : md.length };
};
const rowOf = (field, value) => `| ${field.padEnd(14)} | ${String(value).replace(/\|/g, "\\|")} |`;
const ROW_RE = (field) => new RegExp(`^\\|[ \\t]*${esc(field)}[ \\t]*\\|.*$`, "m");

/** Sets table rows in CLAUDE.md's App profile; a known field with no row is added under the table. `values` is { Field: value }. */
export function profileSet(md, values, { heading = "App profile", fields = PROFILE_FIELDS, missing = "merge it from app-studio's templates/CLAUDE.md first" } = {}) {
  md = nl(md);
  const r = profileRange(md, heading);
  if (!r) throw new Error(`CLAUDE.md has no "## ${heading}" section (${missing})`);
  let body = md.slice(r.bodyStart, r.end);
  for (const [field, value] of Object.entries(values)) {
    const re = ROW_RE(field);
    if (re.test(body)) body = body.replace(re, () => rowOf(field, value));
    else if (fields.includes(field)) {
      const lines = body.split("\n");
      let last = -1;
      lines.forEach((l, i) => {
        if (l.startsWith("|")) last = i;
      });
      if (last < 0) throw new Error(`the ${heading} has no table`);
      lines.splice(last + 1, 0, rowOf(field, value));
      body = lines.join("\n");
    } else throw new Error(`unknown ${heading} field "${field}" (known: ${fields.join(", ")})`);
  }
  return md.slice(0, r.bodyStart) + body + md.slice(r.end);
}

/** Values for a discovery app: the identifying rows real, every undecided row TBD. */
export function discoveryValues({ name, prefix, repo }) {
  if (!name || !prefix || !repo) throw new Error('--name "<App name>", --prefix <XX> and --repo <owner/repo> are required');
  return { App: name, Phase: "discovery", "Id prefix": `\`${prefix}\``, Repo: `https://github.com/${repo} (private)`, ...Object.fromEntries(TBD_ROWS.map((f) => [f, TBD])) };
}

// --- Discovery profile (the discovery module's section of CLAUDE.md) ---
const DISCOVERY = "Discovery profile";
export const DISCOVERY_FIELDS = ["Product", "Target users", "Starting idea", "Docs folder", "Sign-off mode", "Exit criteria", "Principles", "Domain risks", "Prototype look and feel"];
export const SIGN_OFF_MODES = ["per artifact", "autonomous with record"];
const NOT_SET = "not set yet";
const DISCOVERY_INTRO =
  'The discovery skills are generic: they read this section for everything about this product. Keep it current as the documents evolve (`node .claude/hooks/app-setup.mjs discovery-profile set "Row=value"`). What each row means: `.claude/packs/discovery/STACK.md`.';
const bare = (v) => String(v ?? "").replace(/`/g, "").trim();

/** A repo-relative folder with one trailing slash; throws on an absolute path or one that leaves the repo. */
export function docsFolder(v) {
  const f = bare(v).replace(/^\.\//, "").replace(/\/+$/, "");
  if (!f || f.startsWith("/") || f.split("/").includes("..") || /\s/.test(f)) throw new Error(`the docs folder must be a folder inside the repo, e.g. docs/discovery/ (got "${bare(v)}")`);
  return `${f}/`;
}

/** Checks and tidies Discovery profile values before they are written. */
function discoveryValuesOf(values) {
  const out = { ...values };
  for (const f of Object.keys(out)) if (!DISCOVERY_FIELDS.includes(f)) throw new Error(`unknown ${DISCOVERY} field "${f}" (known: ${DISCOVERY_FIELDS.join(", ")})`);
  for (const [f, v] of Object.entries(out)) if (!bare(v)) throw new Error(`${DISCOVERY}: "${f}" needs a value`);
  if ("Sign-off mode" in out) {
    out["Sign-off mode"] = bare(out["Sign-off mode"]).toLowerCase();
    if (!SIGN_OFF_MODES.includes(out["Sign-off mode"])) throw new Error(`Sign-off mode must be "${SIGN_OFF_MODES.join('" or "')}" (got "${values["Sign-off mode"]}")`);
  }
  if ("Docs folder" in out) out["Docs folder"] = `\`${docsFolder(out["Docs folder"])}\``;
  return out;
}

/**
 * Adds the "## Discovery profile" section to CLAUDE.md, straight after the App profile. `own` says whether the
 * discovery decision log may become the app's log (it exists and no decision is recorded yet): then the App
 * profile's Decision log row points at it. Returns { md, decisionLog } (decisionLog: the new row's path, or null).
 */
export function discoveryProfileInit(md, { product, users, idea, docs = "docs/discovery/", signOff = SIGN_OFF_MODES[0], extra = {} } = {}, { own = () => false } = {}) {
  md = nl(md);
  if (profileRange(md, DISCOVERY)) throw new Error(`CLAUDE.md already has a "## ${DISCOVERY}" section (change a row with: discovery-profile set "Row=value")`);
  const r = profileRange(md);
  if (!r) throw new Error('CLAUDE.md has no "## App profile" section (merge it from app-studio\'s templates/CLAUDE.md first)');
  if (!bare(product) || !bare(users)) throw new Error('--product "<the product in one line>" and --users "<the target users in one line>" are required (ask the App Creator; never invent them)');
  // A "Docs folder=.." pair means the same as --docs: every path below follows the one folder.
  const { "Docs folder": pairDocs, ...rest } = extra;
  const folder = docsFolder(pairDocs ?? docs);
  const ideaPath = bare(idea) ? docsFolder(idea).slice(0, -1) : `${folder}starting-idea.md`;
  const values = discoveryValuesOf({
    Product: product,
    "Target users": users,
    "Starting idea": `\`${ideaPath}\` (a starting point, not a fixed plan)`,
    "Docs folder": folder,
    "Sign-off mode": signOff,
    "Exit criteria": "default",
    Principles: NOT_SET,
    "Domain risks": NOT_SET,
    "Prototype look and feel": NOT_SET,
    ...rest,
  });
  const section = [`## ${DISCOVERY}`, "", DISCOVERY_INTRO, "", "| Field | Value |", "| --- | --- |", ...DISCOVERY_FIELDS.map((f) => rowOf(f, values[f])), ""].join("\n");
  let out = `${md.slice(0, r.end).trimEnd()}\n\n${section}${r.end < md.length ? `\n${md.slice(r.end)}` : ""}`;
  const log = `${folder}decision-log.md`;
  const decisionLog = logPath(md) === "docs/PRD.md" && own(log) ? log : null;
  if (decisionLog) out = profileSet(out, { "Decision log": `\`${decisionLog}\`` });
  return { md: out, decisionLog };
}

export const discoveryProfileSet = (md, values) => profileSet(md, discoveryValuesOf(values), { heading: DISCOVERY, fields: DISCOVERY_FIELDS, missing: "run discovery-profile init first" });

const FROZEN = /^> \*\*Frozen on /m;
/**
 * Ends discovery in the app's files ("start building"): takes the "## Discovery profile" section out of CLAUDE.md
 * and marks the status tracker as history. `status` is the text of `<docs folder>/status.md`, or null when there
 * is none. Returns { md, status, folder }; the documents themselves are never touched.
 */
export function discoveryClose(md, status, date) {
  md = nl(md);
  const m = new RegExp(`^## ${esc(DISCOVERY)}[ \\t]*$`, "m").exec(md);
  if (!m) throw new Error(`CLAUDE.md has no "## ${DISCOVERY}" section (nothing to close)`);
  const r = profileRange(md, DISCOVERY);
  const row = ROW_RE("Docs folder").exec(md.slice(r.bodyStart, r.end));
  const folder = docsFolder(row ? bare(row[0].split("|")[2]).split(/\s/)[0] : "docs/discovery/"); // the first word, as health reads the row
  const out = `${md.slice(0, m.index).trimEnd()}\n${r.end < md.length ? `\n${md.slice(r.end)}` : ""}`;
  if (status === null || FROZEN.test(status)) return { md: out, status: null, folder };
  const note = `> **Frozen on ${date}.** Discovery ended when the App Creator said "start building". This file is history and is no longer updated: the plan is now \`docs/BACKLOG.md\`.`;
  const lines = nl(status).split("\n");
  const h1 = lines.findIndex((l) => /^# /.test(l));
  lines.splice(h1 + 1, 0, "", note);
  return { md: out, status: lines.join("\n"), folder };
}

export function pairs(list) {
  const out = {};
  for (const p of list) {
    const i = p.indexOf("=");
    if (i < 1) throw new Error(`expected Field=value, got "${p}"`);
    out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return out;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const { pos, flags } = parseArgs(rest, BOOL);
  const checkArgs = { repo: flags.repo, checks: flags.checks, defaultBranch: flags["default-branch"], envMissing: !!flags["env-missing"], cloudflare: !!flags.cloudflare };
  if (cmd === "pack-plan") {
    const p = packPlan({ target: flags.target, ai: flags.ai, access: flags.access, storage: flags.storage, roadmap: flags.roadmap, slug: flags.slug, title: flags.title });
    console.log(["Run in order:", ...p.commands.map((c) => `  ${c}`), ...p.notes.map((n) => `Note: ${n}`)].join("\n"));
  } else if (cmd === "admin-checklist") {
    console.log(adminChecklist(checkArgs));
  } else if (cmd === "project-report") {
    if (!flags.name || !flags.repo) throw new Error('--name "<App name>" and --repo <owner/repo> are required');
    const studio = flags.studio ?? "../app-studio";
    const tpl = join(studio, "plugins/studio/templates/project-instructions.md");
    if (!existsSync(tpl)) throw new Error(`template not found at ${tpl} (pass --studio <app-studio dir>)`);
    console.log(projectReport({ name: flags.name, repo: flags.repo, goal: flags.goal, template: readFileSync(tpl, "utf8"), checklist: adminChecklist(checkArgs) }));
  } else if (cmd === "profile" && (pos[0] === "set" || pos[0] === "init")) {
    const file = join(process.cwd(), "CLAUDE.md");
    if (!existsSync(file)) throw new Error("CLAUDE.md not found (run from the app's root)");
    let values = pairs(pos.slice(1));
    if (pos[0] === "init") {
      if (!flags.discovery) throw new Error("profile init needs --discovery (a built app is filled with `profile set`)");
      values = { ...discoveryValues({ name: flags.name, prefix: flags.prefix, repo: flags.repo }), ...values };
    }
    writeFileSync(file, profileSet(readFileSync(file, "utf8"), values));
    console.log(`App profile updated: ${Object.keys(values).join(", ")}.`);
  } else if (cmd === "discovery-profile" && pos[0] === "close") {
    const file = join(process.cwd(), "CLAUDE.md");
    if (!existsSync(file)) throw new Error("CLAUDE.md not found (run from the app's root)");
    const md = readFileSync(file, "utf8");
    const { folder } = discoveryClose(md, null, "");
    const tracker = join(process.cwd(), folder, "status.md");
    const r = discoveryClose(md, existsSync(tracker) ? readFileSync(tracker, "utf8") : null, flags.date ?? new Date().toISOString().slice(0, 10));
    writeFileSync(file, r.md);
    if (r.status !== null) writeFileSync(tracker, r.status);
    console.log(`Discovery profile removed from CLAUDE.md. ${r.status !== null ? `${folder}status.md is marked as history.` : `${folder}status.md was left as it is.`} The documents in ${folder} stay as the app's own files.`);
  } else if (cmd === "discovery-profile" && (pos[0] === "set" || pos[0] === "init")) {
    const file = join(process.cwd(), "CLAUDE.md");
    if (!existsSync(file)) throw new Error("CLAUDE.md not found (run from the app's root)");
    const values = pairs(pos.slice(1));
    const at = (f) => join(process.cwd(), f);
    if (pos[0] === "set") {
      if (!Object.keys(values).length) throw new Error('discovery-profile set needs at least one "Row=value"');
      writeFileSync(file, discoveryProfileSet(readFileSync(file, "utf8"), values));
      console.log(`Discovery profile updated: ${Object.keys(values).join(", ")}.`);
    } else {
      // The discovery log becomes the app's decision log only while nothing is recorded yet, so no id is ever reused.
      // "Nothing recorded" is judged the way decisions.mjs numbers: any D-NNN in the default log, here or on a remote branch.
      // Entries without a D-NNN number count too: the log never moves while docs/PRD.md "Decisions" holds any entry.
      const prd = existsSync(at("docs/PRD.md")) ? readFileSync(at("docs/PRD.md"), "utf8") : "";
      const kept = decisionEntries(prd);
      const own = (log) => existsSync(at(log)) && kept === 0 && maxDecision(textsFor(process.cwd(), "docs/PRD.md")) === 0;
      const r = discoveryProfileInit(readFileSync(file, "utf8"), { product: flags.product, users: flags.users, idea: flags.idea, docs: flags.docs, signOff: flags["sign-off"], extra: values }, { own });
      writeFileSync(file, r.md);
      console.log(`Discovery profile written to CLAUDE.md. ${r.decisionLog ? `The App profile's Decision log row now points at ${r.decisionLog}.` : `The App profile's Decision log row is unchanged${kept ? `: docs/PRD.md "Decisions" already has ${kept} entr${kept === 1 ? "y" : "ies"}, so the log stays there` : ""}.`}`);
    }
  } else {
    console.error('Usage: app-setup.mjs pack-plan --target .. --ai .. --access .. --slug .. --title ".." | admin-checklist --repo <owner/repo> | project-report --name ".." --repo <owner/repo> | profile set "Field=value".. | profile init --discovery --name ".." --prefix XX --repo <owner/repo> | discovery-profile init --product ".." --users ".." | discovery-profile set "Row=value".. | discovery-profile close');
    process.exit(1);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`app-setup: ${e.message}`);
    process.exit(1);
  }
}
