#!/usr/bin/env node
// Routine upkeep of docs/BACKLOG.md and docs/BACKLOG-DONE.md, so Claude doesn't do it by hand:
// numbering new items and moving finished ones to Done. Judgement stays with Claude (what an item says,
// which criteria passed, which lane it belongs in). Node built-ins only. Shared studio harness file:
// change it in app-studio, never in an app.
//
//   node .claude/hooks/backlog.mjs next <XX> [--fetch]                    next free id (this tree + every remote branch)
//   node .claude/hooks/backlog.mjs add <XX> "<title>" [--why ".."] [--section Ready] [--lane now|next|later]
//   node .claude/hooks/backlog.mjs add <XX> "Bug: .." --bug --found-in "v1.2.0, step 4" --steps ".." --expected ".." --actual ".."
//   node .claude/hooks/backlog.mjs move <id> "In progress" | "To test" | Ready | Backlog | Later
//   node .claude/hooks/backlog.mjs done <id> <version> [--tick]           full item to BACKLOG-DONE, title line under Done, id off the Roadmap
//   node .claude/hooks/backlog.mjs roadmap-add <id> now|next|later
//
// `add` with the roadmap module (.claude/packs/roadmap/) needs --lane. `done` refuses an item with criteria
// still unticked unless --tick (Claude ticks the ones that passed first).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LANES = ["now", "next", "later"];
const SECTIONS = ["In progress", "To test", "Ready", "Backlog", "Later"];
const ID_RE = "[A-Z][A-Z0-9]*-\\d+[a-z]?";
export const nl = (s) => s.replace(/\r\n/g, "\n");
export const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Highest number used with this prefix anywhere in the texts: headings, Done lines, ranges and prose mentions ("Bug XX-016 closed as not a bug"). */
export function maxId(prefix, texts) {
  let max = 0;
  const any = new RegExp(`(?<![A-Za-z0-9])${esc(prefix)}-(\\d+)`, "g");
  for (const t of texts) for (const m of nl(t ?? "").matchAll(any)) max = Math.max(max, Number(m[1]));
  return max;
}
export function nextId(prefix, texts) {
  return `${prefix}-${String(maxId(prefix, texts) + 1).padStart(3, "0")}`;
}

// A section is its "## Name" line up to the next "## " line.
function sectionRange(md, name) {
  const m = new RegExp(`^## ${esc(name)}[ \\t]*$`, "m").exec(md);
  if (!m) return null;
  const bodyStart = m.index + m[0].length;
  const next = /^## /m.exec(md.slice(bodyStart));
  return { start: m.index, bodyStart, end: next ? bodyStart + next.index : md.length };
}
function ensureSection(md, name) {
  if (sectionRange(md, name)) return md;
  const done = sectionRange(md, "Done");
  const add = `## ${name}\n\n`;
  if (done) return md.slice(0, done.start) + add + md.slice(done.start);
  return md.replace(/\n*$/, "\n\n") + add;
}
const blocksOf = (body) => body.split(/^(?=### )/m);
const isPlaceholder = (line) => /^\s*(_[^_]*_|\([^)]*\)|\*[^*]*\*)\s*$/.test(line);

function insertBlock(md, section, block, { top = false } = {}) {
  md = ensureSection(md, section);
  const r = sectionRange(md, section);
  const body = md.slice(r.bodyStart, r.end);
  const parts = blocksOf(body);
  const intro = parts[0].startsWith("### ") ? "" : parts.shift();
  const keepIntro = intro.split("\n").filter((l) => !isPlaceholder(l)).join("\n").trim();
  const blocks = parts.map((b) => b.trim());
  const b = block.trim();
  if (top) blocks.unshift(b);
  else blocks.push(b);
  const text = `\n${keepIntro ? `${keepIntro}\n\n` : ""}${blocks.join("\n\n")}\n\n`;
  return md.slice(0, r.bodyStart) + text + md.slice(r.end);
}

function findItem(md, id) {
  for (const name of SECTIONS) {
    const r = sectionRange(md, name);
    if (!r) continue;
    const body = md.slice(r.bodyStart, r.end);
    let offset = r.bodyStart;
    for (const b of blocksOf(body)) {
      if (new RegExp(`^### ${esc(id)}\\b`).test(b)) return { section: name, block: b.trimEnd(), start: offset, end: offset + b.length };
      offset += b.length;
    }
  }
  return null;
}
function removeBlock(md, found) {
  const out = md.slice(0, found.start) + md.slice(found.end);
  const r = sectionRange(out, found.section);
  const body = out.slice(r.bodyStart, r.end);
  // Keep one blank line between the heading and what follows.
  return out.slice(0, r.bodyStart) + `\n${body.trim() ? `${body.trim()}\n\n` : "\n"}` + out.slice(r.end).replace(/^\n+/, "");
}
const hasId = (md, id) => new RegExp(`^#{2,4}[ \\t]+${esc(id)}\\b`, "m").test(md);

export function addItem(md, { id, title, why = "TODO", section = "Backlog", bug = false, foundIn = "", steps = "", expected = "", actual = "" }) {
  md = nl(md);
  if (hasId(md, id)) throw new Error(`${id} already exists in the backlog`);
  const block = bug
    ? `### ${id} ${title}\n- Found in: ${foundIn || "TODO"}\n- Steps to reproduce: ${steps || "TODO"}\n- Expected: ${expected || "TODO"} / Actual: ${actual || "TODO"}\n- Acceptance criteria:\n  - [ ] The failing step now shows the expected result\n  - [ ] A regression test covers it`
    : `### ${id} ${title}\n- Why: ${why}\n- Acceptance criteria:\n  - [ ] Given …, when …, then … (observable in the app)\n- Notes: `;
  return insertBlock(md, bug ? "Ready" : section, block.replace(/[ \t]+$/gm, ""), { top: bug });
}

export function moveItem(md, id, section) {
  md = nl(md);
  if (!SECTIONS.includes(section)) throw new Error(`unknown section "${section}" (use ${SECTIONS.join(", ")})`);
  const found = findItem(md, id);
  if (!found) throw new Error(`${id} is not an open item in the backlog`);
  if (found.section === section) return md;
  return insertBlock(removeBlock(md, found), section, found.block);
}

const laneLine = (lane) => new RegExp(`^(- \\*\\*${lane[0].toUpperCase()}${lane.slice(1)}:\\*\\*)(.*)$`, "m");
function listed(md, id) {
  return LANES.some((l) => (laneLine(l).exec(md)?.[2] ?? "").split(/[,\s]+/).includes(id));
}
export function roadmapAdd(md, id, lane) {
  md = nl(md);
  if (!LANES.includes(lane)) throw new Error(`lane must be one of ${LANES.join(", ")}`);
  if (!/^## Roadmap[ \t]*$/m.test(md)) {
    const first = /^## /m.exec(md);
    const sec = "## Roadmap\n- **Now:**\n- **Next:**\n- **Later:**\n\n";
    md = first ? md.slice(0, first.index) + sec + md.slice(first.index) : md.replace(/\n*$/, "\n\n") + sec;
  }
  if (listed(md, id)) throw new Error(`${id} is already in the Roadmap list`);
  return md.replace(laneLine(lane), (_, head, rest) => `${head}${rest.trim() ? `${rest.trimEnd()}, ` : " "}${id}`);
}
export function roadmapRemove(md, id) {
  md = nl(md);
  for (const lane of LANES) {
    md = md.replace(laneLine(lane), (_, head, rest) => {
      const kept = rest.split(",").map((s) => s.trim()).filter((s) => s && s !== id);
      return kept.length ? `${head} ${kept.join(", ")}` : head;
    });
  }
  return md;
}

export function finishItem(md, doneMd, id, version, { tick = false } = {}) {
  md = nl(md);
  const v = String(version).replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+([-+][\w.]+)?$/.test(v)) throw new Error(`"${version}" is not a version (use X.Y.Z)`);
  const found = findItem(md, id);
  if (!found) throw new Error(`${id} is not an open item in the backlog`);
  let block = found.block;
  if (/^\s*- \[ \]/m.test(block)) {
    if (!tick) throw new Error(`${id} still has criteria not ticked; tick the ones that passed, or pass --tick if all did`);
    block = block.replace(/^(\s*- )\[ \]/gm, "$1[x]");
  }
  const lines = block.split("\n");
  const title = lines[0].replace(new RegExp(`^### ${esc(id)}\\s*`), "").trim();
  lines.splice(1, 0, `- Done in: v${v}`);
  let out = removeBlock(md, found);
  out = ensureSection(out, "Done");
  const r = sectionRange(out, "Done");
  const body = out.slice(r.bodyStart, r.end);
  out = out.slice(0, r.bodyStart) + `\n- ${id} ${title} — v${v}\n` + body.replace(/^\n+/, "") + out.slice(r.end);
  out = roadmapRemove(out, id);
  const d = nl(doneMd ?? "# Backlog: done\n");
  const first = /^### /m.exec(d);
  const entry = lines.join("\n");
  const doneOut = first ? `${d.slice(0, first.index)}${entry}\n\n${d.slice(first.index)}` : `${d.replace(/\n*$/, "\n\n")}${entry}\n`;
  return { md: out.replace(/\n{3,}/g, "\n\n"), doneMd: doneOut };
}

// --- command line ---
const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
function textsFor(app) {
  const files = ["docs/BACKLOG.md", "docs/BACKLOG-DONE.md"];
  const texts = files.map((f) => (existsSync(join(app, f)) ? readFileSync(join(app, f), "utf8") : ""));
  try {
    for (const ref of git(["for-each-ref", "--format=%(refname)", "refs/remotes"]).split("\n").filter(Boolean)) {
      for (const f of files) {
        try {
          texts.push(git(["show", `${ref}:${f}`]));
        } catch {
          // The file isn't on that branch.
        }
      }
    }
  } catch {
    // Not a git repo: this tree only.
  }
  return texts;
}
/** `--flag value` and bare words; names in `bool` take no value. Shared by the other harness helper scripts. */
export function parseArgs(argv, bool = ["fetch", "bug", "tick"]) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      flags[k] = bool.includes(k) ? true : argv[++i];
    } else pos.push(argv[i]);
  }
  return { pos, flags };
}
function main(argv) {
  const [cmd, ...rest] = argv;
  const { pos, flags } = parseArgs(rest);
  const app = process.cwd();
  const read = (f) => (existsSync(join(app, f)) ? readFileSync(join(app, f), "utf8") : null);
  const write = (f, t) => writeFileSync(join(app, f), t);
  if (cmd === "next" && pos[0]) {
    if (flags.fetch) {
      try {
        git(["fetch", "-q", "origin"]);
      } catch {
        console.error("(could not fetch; numbering from what is here)");
      }
    }
    console.log(nextId(pos[0], textsFor(app)));
  } else if (cmd === "add" && pos[0] && pos[1]) {
    if (existsSync(join(app, ".claude/packs/roadmap")) && !flags.bug && !flags.lane) throw new Error("this app has the roadmap module: pass --lane now|next|later");
    if (!existsSync(join(app, "docs/BACKLOG.md"))) throw new Error("docs/BACKLOG.md not found (run from the app's root)");
    const id = nextId(pos[0], textsFor(app));
    let md = addItem(read("docs/BACKLOG.md"), { id, title: pos[1], why: flags.why, section: flags.section, bug: !!flags.bug, foundIn: flags["found-in"], steps: flags.steps, expected: flags.expected, actual: flags.actual });
    if (flags.lane || (flags.bug && existsSync(join(app, ".claude/packs/roadmap")))) md = roadmapAdd(md, id, flags.lane ?? "now");
    write("docs/BACKLOG.md", md);
    console.log(`${id} added to ${flags.bug ? "Ready" : (flags.section ?? "Backlog")}${flags.lane ? ` and the Roadmap (${flags.lane})` : ""}. Fill in the criteria.`);
  } else if (cmd === "move" && pos[0] && pos[1]) {
    write("docs/BACKLOG.md", moveItem(read("docs/BACKLOG.md") ?? "", pos[0], pos[1]));
    console.log(`${pos[0]} moved to ${pos[1]}.`);
  } else if (cmd === "done" && pos[0] && pos[1]) {
    const r = finishItem(read("docs/BACKLOG.md") ?? "", read("docs/BACKLOG-DONE.md"), pos[0], pos[1], { tick: !!flags.tick });
    write("docs/BACKLOG.md", r.md);
    write("docs/BACKLOG-DONE.md", r.doneMd);
    console.log(`${pos[0]} moved to Done (v${pos[1].replace(/^v/, "")}).`);
  } else if (cmd === "roadmap-add" && pos[0] && pos[1]) {
    write("docs/BACKLOG.md", roadmapAdd(read("docs/BACKLOG.md") ?? "", pos[0], pos[1]));
    console.log(`${pos[0]} added to the Roadmap (${pos[1]}).`);
  } else {
    console.error('Usage: backlog.mjs next <XX> [--fetch] | add <XX> "<title>" [--why ..] [--section ..] [--lane ..] [--bug --found-in .. --steps .. --expected .. --actual ..] | move <id> <section> | done <id> <version> [--tick] | roadmap-add <id> <lane>');
    process.exit(1);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`backlog: ${e.message}`);
    process.exit(1);
  }
}
