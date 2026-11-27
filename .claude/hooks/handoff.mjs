#!/usr/bin/env node
// Mechanical limits of the Tester's test script (test-handoff Part A), so Claude doesn't count by hand.
// Judgement stays with Claude: what the steps say and which target shows the change. Node built-ins only.
// Shared studio harness file: change it in app-studio, never in an app.
//
//   node .claude/hooks/handoff.mjs lint <script.md>      (or the script on stdin: lint -)
//
// A script is one or more items, each a heading (`#`..`####`) followed by numbered steps; a script with no
// headings is one item. Every step has a "Do" and an "Expect" part. At most 7 steps per item, 15 in all,
// and the last line is the closing request for the failed step numbers. Exits 1 and lists what to fix.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nl } from "./backlog.mjs";

export const MAX_ITEM = 7;
export const MAX_ALL = 15;
export const CLOSING = /reply with the step numbers that failed/i;
const label = (word) => new RegExp(`(^|[\\s>*_(-])${word}\\s*:|\\*\\*${word}:?\\*\\*`, "i");
const HAS_DO = label("do");
const HAS_EXPECT = label("expect");

/** Returns the problems (empty = ok) of a test script. */
export function lintHandoff(text) {
  const lines = nl(text).split("\n");
  const problems = [];
  const items = [{ title: "(script)", steps: [] }];
  let step = null;
  for (const line of lines) {
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    const s = /^\s{0,3}(\d+)[.)]\s+(.*)$/.exec(line);
    if (h) {
      items.push({ title: h[1].trim(), steps: [] });
      step = null;
    } else if (s) {
      step = { n: s[1], text: s[2] };
      items.at(-1).steps.push(step);
    } else if (step && line.trim()) step.text += `\n${line}`;
  }
  let total = 0;
  for (const it of items) {
    total += it.steps.length;
    if (it.steps.length > MAX_ITEM) problems.push(`${it.title}: ${it.steps.length} steps, at most ${MAX_ITEM} per item`);
    for (const st of it.steps) {
      if (!HAS_DO.test(st.text)) problems.push(`${it.title}, step ${st.n}: no "Do:" part`);
      if (!HAS_EXPECT.test(st.text)) problems.push(`${it.title}, step ${st.n}: no "Expect:" part`);
    }
  }
  if (!total) problems.push("no numbered steps found");
  if (total > MAX_ALL) problems.push(`${total} steps in all, at most ${MAX_ALL} for a combined script`);
  const last = lines.filter((l) => l.trim()).at(-1) ?? "";
  if (!CLOSING.test(last)) problems.push('the last line is not the closing request ("Reply with the step numbers that failed and what you saw. A screenshot helps.")');
  return problems;
}

function main(argv) {
  const [cmd, file] = argv;
  if (cmd !== "lint" || !file) {
    console.error("Usage: handoff.mjs lint <script.md | ->");
    process.exit(2);
  }
  const problems = lintHandoff(readFileSync(file === "-" ? 0 : file, "utf8"));
  if (problems.length) {
    console.error(["handoff lint failed:", ...problems.map((p) => `- ${p}`)].join("\n"));
    process.exit(1);
  }
  console.log("handoff lint: ok");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`handoff: ${e.message}`);
    process.exit(2);
  }
}
