#!/usr/bin/env node
// Study ids and the index rows of docs/research/studies.md, so nobody picks an id or types a row by hand
// and a thread never takes an id another thread has already pushed. Judgement stays with Claude (what a study asks, its tier, its
// verdict). Node built-ins only. Shared studio harness file (research module): change it in app-studio,
// never in an app.
//
//   node .claude/packs/research/studies.mjs next [--fetch]              next free id (this tree + every remote branch)
//   node .claude/packs/research/studies.mjs add "<title>" --type "<type>" --tier light|standard|deep [--slug <slug>] [--fetch]
//   node .claude/packs/research/studies.mjs verdict <R-NNN> "<verdict>"
//
// `add` writes the index row (verdict "In progress") and prints the study folder; the research skill
// writes the protocol there. `verdict` sets the row's last cell.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DIR = "docs/research";
export const INDEX = `${DIR}/studies.md`;
const TIERS = ["light", "standard", "deep"];
const HEAD = "| Id | Study | Type | Tier | Verdict |\n| --- | --- | --- | --- | --- |";
const FRESH = `# Research studies\n\nIndex of every study run with the research method (\`.claude/packs/research/FRAMEWORK.md\`). Rows are added and updated by \`node .claude/packs/research/studies.mjs\`, never by hand: \`add\` when a study starts, \`verdict\` when its report is done.\n\n${HEAD}\n`;
const nl = (s) => s.replace(/\r\n/g, "\n");
/** Text that is safe inside one table cell. */
const cell = (s) => String(s).replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");

/** Highest study number used in the texts: index rows, links and paths to study folders, folder names. An id inside a title or a sentence is not counted. */
export function maxId(texts) {
  let max = 0;
  for (const t of texts) for (const m of nl(t ?? "").matchAll(/(?:^|[|(/])[ \t]*R-(\d+)(?![A-Za-z0-9])/gm)) max = Math.max(max, Number(m[1]));
  return max;
}
export const nextId = (texts) => `R-${String(maxId(texts) + 1).padStart(3, "0")}`;

/** "Who pays for it? (first look, 2026)" -> "who-pays-for-it-first-look-2026", cut at a word within about 40 characters. */
export function slugOf(title) {
  const words = title.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  let out = "";
  for (const w of words) {
    if (out && out.length + 1 + w.length > 40) break;
    out = out ? `${out}-${w}` : w.slice(0, 40);
  }
  if (!out) throw new Error("the title needs at least one letter or digit (or pass --slug)");
  return out;
}

/** Adds the study's row at the end of the index table: the first table whose header starts with "Id" (the table and the file are made when missing). */
export function addRow(md, { id, title, slug, type, tier }) {
  if (!TIERS.includes(tier)) throw new Error(`--tier must be one of ${TIERS.join(", ")}`);
  if (!cell(title)) throw new Error("the study needs a title");
  if (!cell(type ?? "")) throw new Error('pass --type "<research type>" (for example "Market size" or "Generic")');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error("--slug takes lower-case letters, digits and single hyphens");
  let text = nl(md ?? FRESH);
  if (new RegExp(`^\\| ${id} \\|`, "m").test(text)) throw new Error(`${id} is already in ${INDEX}`);
  const row = `| ${id} | [${cell(title).replace(/[[\]]/g, "")}](${id}-${slug}/protocol.md) | ${cell(type)} | ${tier} | In progress |`;
  const lines = text.replace(/\n+$/, "").split("\n");
  let last = lines.findIndex((l) => /^\|\s*Id\s*\|/i.test(l));
  if (last === -1) return `${lines.join("\n")}\n\n${HEAD}\n${row}\n`;
  while (last + 1 < lines.length && /^\|/.test(lines[last + 1])) last++;
  lines.splice(last + 1, 0, row);
  return `${lines.join("\n")}\n`;
}

/** Sets the Verdict cell (the last one) of the study's row. */
export function setVerdict(md, id, verdict) {
  if (!cell(verdict ?? "")) throw new Error("the verdict text is empty");
  const lines = nl(md ?? "").split("\n");
  const i = lines.findIndex((l) => l.startsWith(`| ${id} |`));
  if (i === -1) throw new Error(`${id} is not in ${INDEX}`);
  const cells = lines[i].split(/(?<!\\)\|/).slice(1, -1);
  if (cells.length < 5) throw new Error(`the row of ${id} does not have the index's five columns; fix it by hand first`);
  cells[cells.length - 1] = ` ${cell(verdict)} `;
  lines[i] = `|${cells.join("|")}|`;
  return lines.join("\n");
}

// --- command line ---
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
/** Everything that can hold a used id: the index and the study folder names, here and on every remote branch. */
function textsFor(app) {
  const texts = [existsSync(join(app, INDEX)) ? readFileSync(join(app, INDEX), "utf8") : ""];
  if (existsSync(join(app, DIR))) texts.push(readdirSync(join(app, DIR)).join("\n"));
  try {
    for (const ref of git(["for-each-ref", "--format=%(refname)", "refs/remotes"], app).split("\n").filter(Boolean)) {
      for (const args of [["show", `${ref}:${INDEX}`], ["ls-tree", "--name-only", ref, `${DIR}/`]]) {
        try {
          texts.push(git(args, app));
        } catch {
          // Not on that branch.
        }
      }
    }
  } catch {
    // Not a git repo: this tree only.
  }
  return texts;
}
function parseArgs(argv, bool = ["fetch"]) {
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
  if (flags.fetch) {
    try {
      git(["fetch", "-q", "origin"], app);
    } catch {
      console.error("(could not fetch; numbering from what is here)");
    }
  }
  if (cmd === "next") {
    console.log(nextId(textsFor(app)));
  } else if (cmd === "add" && pos[0]) {
    const id = nextId(textsFor(app));
    const slug = flags.slug ?? slugOf(pos[0]);
    const md = addRow(read(INDEX), { id, title: pos[0], slug, type: flags.type, tier: flags.tier });
    mkdirSync(dirname(join(app, INDEX)), { recursive: true });
    writeFileSync(join(app, INDEX), md);
    console.log(`${id} added to ${INDEX} (${flags.tier}, In progress). Study folder: ${DIR}/${id}-${slug}/ . Write protocol.md there and merge it, with this row, in its own PR before the first search.`);
  } else if (cmd === "verdict" && pos[0] && pos[1]) {
    if (read(INDEX) === null) throw new Error(`${INDEX} not found (run from the app's root)`);
    writeFileSync(join(app, INDEX), setVerdict(read(INDEX), pos[0], pos[1]));
    console.log(`${pos[0]}: verdict recorded in ${INDEX}.`);
  } else {
    console.error('Usage: studies.mjs next [--fetch] | add "<title>" --type "<type>" --tier light|standard|deep [--slug <slug>] [--fetch] | verdict <R-NNN> "<verdict>"');
    process.exit(1);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`studies: ${e.message}`);
    process.exit(1);
  }
}
