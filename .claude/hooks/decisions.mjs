#!/usr/bin/env node
// Routine upkeep of the app's decision log, so Claude doesn't number, date or supersede by hand and two
// parallel threads can't keep the same id. Judgement stays with Claude (what was decided and why).
// The log is the file named by the App profile's "Decision log" row (docs/PRD.md "Decisions" by default).
// Node built-ins only. Shared studio harness file: change it in app-studio, never in an app.
//
//   node .claude/hooks/decisions.mjs next [--fetch]                  next free D-NNN (this tree + every remote branch)
//   node .claude/hooks/decisions.mjs add "<title>" --decision ".." [--why ".."] [--by ".."] [--date YYYY-MM-DD] [--fetch]
//   node .claude/hooks/decisions.mjs supersede <id> "<title>" --decision ".." [--why ".."] [--by ".."] [--fetch]
//   node .claude/hooks/decisions.mjs list [--all]                    one line per decision (active ones unless --all)
//   node .claude/hooks/decisions.mjs show <id>
//
// An entry is `### D-NNN Title (date)` with Status, Decision, Why and Decided by lines. New entries go at
// the top. `supersede` adds a new entry and only sets the old one's Status line; its text stays as written.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc, nl, parseArgs } from "./backlog.mjs";

const DEFAULT_LOG = "docs/PRD.md";
const SECTION = "Decisions";
const ID = "D-(\\d+)";

/** The log's path from the App profile's "Decision log" row: the first `quoted` or bare *.md path, else docs/PRD.md. */
export function logPath(claudeMd) {
  const start = (claudeMd ?? "").indexOf("## App profile");
  if (start < 0) return DEFAULT_LOG;
  const end = claudeMd.indexOf("\n## ", start + 5);
  const row = claudeMd.slice(start, end < 0 ? undefined : end).split("\n").find((l) => /^\|\s*Decision log\s*\|/.test(l));
  if (!row) return DEFAULT_LOG;
  const cell = row.replace(/\\\|/g, " ").split("|")[2] ?? "";
  return /`([^`\s]+\.md)`/.exec(cell)?.[1] ?? /(?:^|\s)([\w./-]+\.md)\b/.exec(cell)?.[1] ?? DEFAULT_LOG;
}

/** Highest D-NNN mentioned anywhere in the texts. */
export function maxDecision(texts) {
  let max = 0;
  const any = new RegExp(`(?<![A-Za-z0-9])${ID}`, "g");
  for (const t of texts) for (const m of nl(t ?? "").matchAll(any)) max = Math.max(max, Number(m[1]));
  return max;
}
export const nextDecisionId = (texts) => `D-${String(maxDecision(texts) + 1).padStart(3, "0")}`;

/**
 * Entries in the "## Decisions" section of a file, numbered or not: a D-NNN heading, any other ### or ####
 * heading, or a list item. Comments, blank lines and plain prose (such as a pointer to another file) are not entries.
 */
export function decisionEntries(md) {
  const h = new RegExp(`^## ${SECTION}[ \\t]*$`, "m").exec(nl(md ?? ""));
  if (!h) return 0;
  const text = nl(md).slice(h.index + h[0].length).replace(/<!--[\s\S]*?-->/g, "");
  const next = /^## /m.exec(text);
  const lines = (next ? text.slice(0, next.index) : text).split("\n");
  return lines.filter((l, i) => /^(#{3,4}[ \t]+\S|\s*(?:[-*]|\d+[.)])[ \t]+\S)/.test(l) || (/^\s*\|/.test(l) && !/^\s*\|[\s:|-]+$/.test(l) && !/^\s*\|[\s:|-]+$/.test(lines[i + 1] ?? ""))).length;
}

const ENTRY = /^#{2,4} (D-\d+)\b/m;
const HEADING = /^(?=#{1,4} )/m;
// An entry runs from its heading to the next heading of any level.
const entries = (md) => nl(md).split(HEADING).filter((b) => ENTRY.test(b));

/** Where new entries go: before the first entry of the "## Decisions" section (or of a log file of its own), else at the end of that section. */
function insertAt(md, own) {
  const h = new RegExp(`^## ${SECTION}[ \\t]*$`, "m").exec(md);
  if (h) {
    const from = h.index + h[0].length;
    const next = /^## /m.exec(md.slice(from));
    const end = next ? from + next.index : md.length;
    const first = /^#{3,4} D-\d+\b/m.exec(md.slice(from, end));
    return { at: first ? from + first.index : end, add: "" };
  }
  if (own) {
    const first = /^#{2,4} D-\d+\b/m.exec(md);
    return { at: first ? first.index : md.length, add: "" };
  }
  return { at: md.length, add: `\n\n## ${SECTION}` };
}

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
export function entryText(id, { title, decision, why, by, date, supersedes }) {
  const lines = [`### ${id} ${oneLine(title)} (${date})`, `- Status: Active`];
  if (supersedes) lines.push(`- Supersedes: ${supersedes}`);
  lines.push(`- Decision: ${oneLine(decision) || "TODO"}`, `- Why: ${oneLine(why) || "TODO"}`, `- Decided by: ${oneLine(by) || "TODO"}`);
  return lines.join("\n");
}

export function addDecision(md, fields, { own = false } = {}) {
  md = nl(md);
  if (new RegExp(`^#{2,4}[ \\t]+${esc(fields.id)}\\b`, "m").test(md)) throw new Error(`${fields.id} already exists in the decision log`);
  const { at, add } = insertAt(md, own);
  const before = `${md.slice(0, at).trimEnd()}${add}`;
  const after = md.slice(at).trimStart();
  return `${before}\n\n${entryText(fields.id, fields)}\n${after ? `\n${after}` : ""}`; // blank lines tidied only around the new entry
}

/** Sets the old entry's Status line (adds one under its heading if missing); the rest of its text is untouched. */
export function markSuperseded(md, oldId, newId, date) {
  md = nl(md);
  const m = new RegExp(`^#{2,4} ${esc(oldId)}\\b.*$`, "m").exec(md);
  if (!m) throw new Error(`${oldId} is not in the decision log`);
  const bodyStart = m.index + m[0].length;
  const next = /^#{1,4} /m.exec(md.slice(bodyStart));
  const bodyEnd = next ? bodyStart + next.index : md.length;
  const body = md.slice(bodyStart, bodyEnd);
  if (/^- Status: Superseded/m.test(body)) throw new Error(`${oldId} is already superseded`);
  const status = `- Status: Superseded by ${newId} (${date})`;
  const out = /^- Status:.*$/m.test(body) ? body.replace(/^- Status:.*$/m, status) : `\n${status}${body}`;
  return md.slice(0, bodyStart) + out + md.slice(bodyEnd);
}

export function listDecisions(md, { all = false } = {}) {
  return entries(md)
    .map((b) => ({ id: ENTRY.exec(b)[1], title: b.split("\n")[0].replace(/^#+ D-\d+\s*/, ""), status: /^- Status:\s*(.*)$/m.exec(b)?.[1]?.trim() ?? "Active" }))
    .filter((e) => all || !/^Superseded/i.test(e.status))
    .map((e) => `${e.id} ${e.title}${/^Active$/i.test(e.status) ? "" : ` [${e.status}]`}`);
}

export function showDecision(md, id) {
  const b = entries(md).find((x) => ENTRY.exec(x)[1] === id);
  if (!b) throw new Error(`${id} is not in the decision log`);
  return b.trimEnd();
}

// --- command line ---
const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
export function textsFor(app, file) {
  const texts = [existsSync(join(app, file)) ? readFileSync(join(app, file), "utf8") : ""];
  try {
    for (const ref of git(["for-each-ref", "--format=%(refname)", "refs/remotes"]).split("\n").filter(Boolean)) {
      try {
        texts.push(git(["show", `${ref}:${file}`]));
      } catch {
        // The file isn't on that branch.
      }
    }
  } catch {
    // Not a git repo: this tree only.
  }
  return texts;
}
const today = () => new Date().toISOString().slice(0, 10);

function fetchRemote() {
  try {
    git(["fetch", "-q", "origin"]);
  } catch {
    console.error("(could not fetch; numbering from what is here)");
  }
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const { pos, flags } = parseArgs(rest, ["fetch", "all"]);
  const app = process.cwd();
  const claude = join(app, "CLAUDE.md");
  const file = logPath(existsSync(claude) ? readFileSync(claude, "utf8") : "");
  const own = file !== DEFAULT_LOG;
  const read = () => (existsSync(join(app, file)) ? readFileSync(join(app, file), "utf8") : "");
  const need = () => {
    if (!existsSync(join(app, file))) throw new Error(`${file} not found (the App profile's Decision log row; run from the app's root)`);
  };
  const date = flags.date ?? today();
  if (flags.date && !/^\d{4}-\d{2}-\d{2}$/.test(flags.date)) throw new Error(`"${flags.date}" is not a date (use YYYY-MM-DD)`);
  if (cmd === "next") {
    if (flags.fetch) fetchRemote();
    console.log(nextDecisionId(textsFor(app, file)));
  } else if (cmd === "add" && pos[0]) {
    need();
    if (flags.fetch) fetchRemote();
    const id = nextDecisionId(textsFor(app, file));
    writeFileSync(join(app, file), addDecision(read(), { id, title: pos[0], decision: flags.decision, why: flags.why, by: flags.by, date }, { own }));
    console.log(`${id} added to ${file}. ${flags.decision && flags.why && flags.by ? "" : "Fill in the TODO lines."}`.trim());
  } else if (cmd === "supersede" && pos[0] && pos[1]) {
    need();
    if (flags.fetch) fetchRemote();
    const id = nextDecisionId(textsFor(app, file));
    let md = markSuperseded(read(), pos[0], id, date);
    md = addDecision(md, { id, title: pos[1], decision: flags.decision, why: flags.why, by: flags.by, date, supersedes: pos[0] }, { own });
    writeFileSync(join(app, file), md);
    console.log(`${id} added; ${pos[0]} is now superseded by it.`);
  } else if (cmd === "list") {
    need();
    const rows = listDecisions(read(), { all: !!flags.all });
    console.log(rows.length ? rows.join("\n") : "No decisions recorded.");
  } else if (cmd === "show" && pos[0]) {
    need();
    console.log(showDecision(read(), pos[0]));
  } else {
    console.error('Usage: decisions.mjs next [--fetch] | add "<title>" --decision ".." [--why ".."] [--by ".."] | supersede <id> "<title>" --decision ".." | list [--all] | show <id>');
    process.exit(1);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`decisions: ${e.message}`);
    process.exit(1);
  }
}
