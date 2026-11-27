#!/usr/bin/env node
// Prefills the issue for the harness-idea skill: title prefix, label, app name, harness version and the
// body headings. Claude supplies only the free text. Prints JSON ({title, labels, body}) to pass to the
// GitHub issue tool; it posts nothing. Node built-ins only.
//
//   node .claude/skills/harness-idea/idea-file.mjs --area <skill|agent|hook|template|pack> --title "<idea in one line>"
//        --happened "<what happened>" --why "<why it's the harness>" [--suggest "<change>"]
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../../hooks/backlog.mjs";

/** App name from the App profile row and harness version from the lock; either may be missing. */
export function appFacts(app) {
  const md = existsSync(join(app, "CLAUDE.md")) ? readFileSync(join(app, "CLAUDE.md"), "utf8") : "";
  const name = /^\|[ \t]*App[ \t]*\|[ \t]*(.*?)[ \t]*\|[ \t]*$/m.exec(md)?.[1];
  let version;
  try {
    version = JSON.parse(readFileSync(join(app, ".claude/studio/lock.json"), "utf8")).studio;
  } catch {
    // no lock: reported below
  }
  return { name, version };
}

export function ideaIssue({ area, title, happened, why, suggest, name, version }) {
  const missing = [["--area", area], ["--title", title], ["--happened", happened], ["--why", why], ["the App row in CLAUDE.md's App profile", name], ["the harness version (.claude/studio/lock.json)", version]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
  const body = [
    `**App name**\n${name}`,
    `**Harness version**\n${version}`,
    `**What happened**\n${happened}`,
    `**Why it's the harness**\n${why}`,
    `**Suggested change**\n${suggest || "(none)"}`,
  ].join("\n\n");
  return { title: `[harness-idea] ${area}: ${title}`, labels: ["harness-idea"], body };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { flags } = parseArgs(process.argv.slice(2), []);
    console.log(JSON.stringify(ideaIssue({ ...flags, ...appFacts(process.cwd()) }), null, 2));
  } catch (e) {
    console.error(`idea-file: ${e.message}`);
    process.exit(1);
  }
}
