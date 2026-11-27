// Claude Code hook runner. Cross-platform (Windows + Linux cloud sessions).
//   node .claude/hooks/check.mjs lint  -> PostToolUse: ESLint the file that was just edited
//   node .claude/hooks/check.mjs test  -> Stop: ESLint the TS/JS files changed since the last push (however they were
//                                          edited, also by shell commands), then run the unit tests before the turn ends
//   node .claude/hooks/check.mjs commit -> PreToolUse (Bash): run the harness health check before a git commit
//   node .claude/hooks/check.mjs merge  -> PreToolUse (GitHub merge tool): block a merge of this app's PR unless its
//                                          checks were read after the last push and all finished green
//                                          Also blocks it without a passing review and QA result for HEAD (verdict.mjs).
//                                          Also refuses, in every repo listed in the App profile's "Owner-merged repos" row,
//                                          a merge, switching on auto-merge and approving a PR: only the App Creator does that there.
//   node .claude/hooks/check.mjs write  -> PreToolUse (GitHub file-write tools): block writes to this app's repo that
//                                          skip the local clone (and so the health check)
//   Every mode that touches GitHub also refuses writes to the harness repo itself (app-studio): an app Project only files
//   `harness-idea` issues there, whatever anyone approves. Issues and issue comments stay allowed.
// Exit code 2 sends the output back to Claude as a blocking error to fix.
// Shared studio harness file: change it in app-studio, not in an app.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mode = process.argv[2];

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}") ?? {};
  if (typeof input !== "object") input = {};
} catch {
  // No or invalid stdin: treat as an empty event.
}

// Any `git commit`, also inside a chain (`git add -A && git commit`) or with options (`git -C . commit`).
const isCommit = (cmd) => /(^|[\s;&|(])git(\s+-{1,2}\S+(\s+[^\s-]\S*)?)*\s+commit\b/.test(cmd ?? "");

/** True when `owner/repo` (or just `repo`) names the harness repo. */
const isHarnessRepo = (owner, repo) => /^app-studio$/i.test(`${repo ?? ""}`) && !!owner;
const HARNESS_MSG =
  "Blocked: nobody changes app-studio from an app Project, whoever approves it, and this includes marking a release as passed. " +
  "Changes to the harness happen only inside the app-studio Project. Decline, and offer the route that works: file a `harness-idea` issue (the harness-idea skill) " +
  "and point the App Creator to the app-studio Project.";

/** "owner/repo" from a remote URL, or null. */
const repoOf = (url) => {
  const m = /[/:]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/.exec(`${url ?? ""}`.trim());
  return m ? { owner: m[1], repo: m[2] } : null;
};
const isUrl = (word) => /^(\w+:\/\/|[\w.-]+@[\w.-]+:)/.test(word);

/** Shell words and operators of a command line: quotes and backslashes are read, nothing is expanded or run. */
function shellTokens(command) {
  // A here-document's body is text for the command, not commands: drop it, keep the rest of its first line.
  // Unless a shell reads it (`bash <<EOF`, `cat <<EOF | sh`): then the body is commands, and it stays.
  const text = command.replace(/<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, (all, _q, _word, rest, at) => {
    const line = command.slice(command.lastIndexOf("\n", at) + 1, at) + rest;
    return /(^|[;&|(])\s*(\w+=\S*\s+)*(\S*\/)?((ba|da|z|k)?sh|eval|source|\.)(\s|$)/.test(line) ? all : rest;
  });
  const out = [];
  let word = null;
  let quote = null;
  const end = () => {
    if (word !== null) out.push({ word });
    word = null;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else word += ch;
    } else if (ch === "\\" && i + 1 < text.length) {
      if (text[++i] !== "\n") word = (word ?? "") + text[i];
    } else if (quote === '"') {
      if (ch === '"') quote = null;
      else word += ch;
    } else if (ch === "#" && word === null) {
      // A comment runs to the end of its line (an apostrophe in it opens no quote).
      const nl = text.indexOf("\n", i);
      i = (nl < 0 ? text.length : nl) - 1;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      word ??= "";
    } else if (ch === "$" && text[i + 1] === "(") {
      end();
      out.push({ op: "(", rest: text.slice(i).split(/&&|;|\n/)[0] });
      i++;
    } else if (ch === "`") {
      end();
      out.push({ op: ";", rest: text.slice(i).split(/&&|;|\n/)[0] });
    } else if (ch === "\n") {
      end();
      out.push({ op: ";" });
    } else if (/\s/.test(ch)) {
      end();
    } else if (ch === "&" && (text[i - 1] === ">" || text[i + 1] === ">")) {
      word = (word ?? "") + ch; // a redirect (2>&1, &>file), not a separator
    } else if (";&|()".includes(ch)) {
      end();
      out.push({ op: ch });
      if ((ch === "&" || ch === "|") && text[i + 1] === ch) i++;
    } else {
      word = (word ?? "") + ch;
    }
  }
  end();
  return out;
}

/** The folder `to` names when typed in `from`: { path }, or { raw } when it holds something only the shell can expand. */
function folderFrom(from, to) {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  let t = `${to ?? ""}`;
  if (home) t = t.replace(/^~(?=$|[\\/])/, home).replace(/\$HOME\b|\$\{HOME\}/g, home);
  if (!t || t === "-" || /[$`*?]|^~/.test(t)) return { raw: to ?? "" };
  if (from.path === undefined && !/^([\\/]|[A-Za-z]:[\\/])/.test(t)) return { raw: `${from.raw}/${t}` };
  return { path: resolve(from.path ?? "/", t) };
}

const PREFIX_WORDS = new Set(["{", "!", "then", "do", "else", "if", "elif", "while", "until", "sudo", "command", "exec", "time", "nohup", "env", "export", "xargs"]);
const isCd = (word) => /^(cd|pushd)$/.test(`${word ?? ""}`.split(/[\\/]/).pop());
const GIT_VALUE_OPTIONS = new Set(["-c", "--work-tree", "--namespace", "--super-prefix", "--config-env"]);

/**
 * Every `git commit` and `git push` in a command line, with the folder it really runs in: the hook's folder, moved by
 * each `cd` before it (joined by `&&`, `;`, a new line; a subshell's `cd` ends with it), by `git -C` and by
 * `--git-dir` / `GIT_DIR=`. Looks inside `sh -c "..."` and `eval` too.
 */
function gitWrites(cmd, start, depth = 0) {
  const found = [];
  const stack = [];
  let here = start;
  const pushed = []; // folders left with pushd, for popd
  const added = {}; // remotes this same command line adds or re-points (`git remote add|set-url <name> <url>`), not yet in the config
  let exported = null; // GIT_DIR set for the commands that follow (`export GIT_DIR=...`, or an assignment on its own)
  let words = [];
  const flush = () => {
    let ws = words;
    words = [];
    let gitDir = exported;
    let from = here;
    while (ws.length && (PREFIX_WORDS.has(ws[0]) || /^[A-Za-z_]\w*=/.test(ws[0]))) {
      if (ws[0].startsWith("GIT_DIR=")) gitDir = folderFrom(here, ws[0].slice(8));
      if (ws[0] === "env" && /^(-C|--chdir)$/.test(ws[1] ?? "")) from = folderFrom(here, ws[2]);
      else if (ws[0] === "env" && ws[1]?.startsWith("--chdir=")) from = folderFrom(here, ws[1].slice(8));
      ws = ws.slice(1);
      while (ws[0]?.startsWith("-")) ws = ws.slice(/^(-C|--chdir|-u|--unset)$/.test(ws[0]) ? 2 : 1);
    }
    if (!ws.length) {
      exported = gitDir;
      return;
    }
    const name = ws[0].split(/[\\/]/).pop();
    if (name === "popd") {
      here = pushed.pop() ?? here;
      return;
    }
    if (name === "cd" || name === "pushd") {
      const to = ws.slice(1).find((w) => !/^-[LPe@]*$/.test(w) && w !== "--");
      if (name === "pushd") pushed.push(here);
      here = folderFrom(here, to ?? "~");
      return;
    }
    if (depth < 3 && (name === "eval" || /^(ba|da|z|k)?sh$/.test(name))) {
      const at = name === "eval" ? 0 : ws.findIndex((w, i) => i > 0 && /^-[a-z]*c$/.test(w));
      const script = name === "eval" ? ws.slice(1).join(" ") : at > 0 ? ws[at + 1] : null;
      if (script) found.push(...gitWrites(script, here, depth + 1));
      return;
    }
    const g = ws.findIndex((w) => /(^|[\\/])git(\.exe)?$/.test(w));
    if (g < 0) return;
    let dir = from;
    let i = g + 1;
    for (; i < ws.length && ws[i].startsWith("-"); i++) {
      if (ws[i] === "-C") dir = folderFrom(dir, ws[++i]);
      else if (ws[i] === "--git-dir") gitDir = folderFrom(dir, ws[++i]);
      else if (ws[i].startsWith("--git-dir=")) gitDir = folderFrom(dir, ws[i].slice(10));
      else if (GIT_VALUE_OPTIONS.has(ws[i])) i++;
    }
    if (ws[i] === "remote" && /^(add|set-url)$/.test(ws[i + 1] ?? "")) {
      const [name, url] = ws.slice(i + 2).filter((w, n, all) => !w.startsWith("-") && !/^(-t|-m|--track|--master)$/.test(all[n - 1] ?? ""));
      if (name && url) added[name] = url;
    }
    if (ws[i] !== "commit" && ws[i] !== "push") return;
    found.push({ what: ws[i], dir, gitDir, args: ws.slice(i + 1), added: { ...added } });
  };
  for (const t of shellTokens(cmd)) {
    if (t.word !== undefined) {
      words.push(t.word);
      continue;
    }
    // `cd $(...)` or cd `...`: only the shell knows that folder, so keep its text to judge.
    const cdTo = t.rest !== undefined && words.length && isCd(words[words.length - 1]) ? { raw: t.rest } : null;
    if (cdTo) words = [];
    else flush();
    if (t.op === "(") stack.push(cdTo ?? here);
    if (cdTo) here = cdTo;
    else if (t.op === ")") here = stack.pop() ?? here;
  }
  flush();
  return found;
}

/**
 * Best effort: why a command's git push/commit would change app-studio, or null. Judges the folder each one really runs in
 * (see gitWrites) by its `origin`, the remote a push names, and a URL on the command line. One line, for the block message.
 */
function bashTouchesHarness(cmd, cwd) {
  if (typeof cmd !== "string" || !/\bgit\b[^;&|]*\b(push|commit)\b/.test(cmd)) return null;
  const base = resolve(typeof cwd === "string" && cwd ? cwd : root);
  if ((originRepo() ?? "").endsWith("/app-studio")) return null;
  const remote = (where, name) => {
    const res = spawnSync("git", [...where, "remote", "get-url", "--push", name], { encoding: "utf8" });
    const r = res.status === 0 ? repoOf(res.stdout) : null;
    return r && isHarnessRepo(r.owner, r.repo) ? `${r.owner}/${r.repo}` : null;
  };
  const writes = gitWrites(cmd, { path: base });
  // Nothing readable as a git command (it is hidden in a quoted string, say): judge the hook's own folder and any URL, as before.
  if (!writes.length) {
    const url = /github\.com[/:]([^/\s]+)\/app-studio(\.git)?(\s|$|["'])/i.exec(cmd);
    if (url) return `a URL on the command line, ${url[1]}/app-studio`;
    writes.push({ what: "push or commit", dir: { path: base }, gitDir: null, args: [] });
  }
  for (const w of writes) {
    const run = `\`git ${w.what}\``;
    const at = w.gitDir ?? w.dir;
    if (at.path === undefined) {
      if (/app-studio/i.test(at.raw)) return `${run} in a folder this check could not resolve, "${at.raw}"`;
      continue;
    }
    const where = w.gitDir ? ["--git-dir", at.path] : ["-C", at.path];
    const origin = remote(where, "origin");
    if (origin) return `${run} in ${at.path}, whose origin is ${origin}`;
    if (w.what !== "push") continue;
    // What the push names: skip options and their values; `--repo=<x>` names it too. A URL anywhere among them is judged.
    const names = w.args.filter((a, n) => !a.startsWith("-") && !/^(-o|--push-option|--receive-pack|--exec)$/.test(w.args[n - 1] ?? ""));
    names.unshift(...w.args.filter((a) => a.startsWith("--repo=")).map((a) => a.slice(7)));
    const named = names.filter(isUrl).map(repoOf).find((r) => r && isHarnessRepo(r.owner, r.repo));
    if (named) return `${run} to a URL on the command line, ${named.owner}/${named.repo}`;
    const to = names[0];
    const fresh = repoOf(w.added?.[to ?? "origin"]);
    if (fresh && isHarnessRepo(fresh.owner, fresh.repo)) return `${run} in ${at.path} to the remote "${to ?? "origin"}" this command points at ${fresh.owner}/${fresh.repo}`;
    const other = !to || isUrl(to) ? null : remote(where, to);
    if (other) return `${run} in ${at.path} to its remote "${to}", which is ${other}`;
  }
  return null;
}

if (mode === "commit") {
  const judged = bashTouchesHarness(input.tool_input?.command, input.cwd);
  if (judged) {
    process.stderr.write(`${HARNESS_MSG}\nJudged: ${judged}.\n`);
    process.exit(2);
  }
  // Needs no dependencies: the health check uses Node built-ins only.
  if (!isCommit(input.tool_input?.command)) process.exit(0);
  const sync = join(root, ".claude", "studio", "studio-sync.mjs");
  const res = existsSync(sync)
    ? spawnSync(process.execPath, [sync, "health"], { cwd: root, encoding: "utf8" })
    : { status: 1, stdout: `${relative(root, sync)} is missing.` };
  if (res.status !== 0) {
    process.stderr.write(
      `Commit blocked: the harness isn't healthy. Fix this first (the harness-sync skill helps), then commit again:\n${`${res.stdout ?? ""}${res.stderr ?? ""}`.trim()}\n`,
    );
    process.exit(2);
  }
  process.exit(0);
}

/** "owner/repo" of this app's origin remote, lower case, or null. */
function originRepo() {
  const res = spawnSync("git", ["-C", root, "remote", "get-url", "origin"], { encoding: "utf8" });
  const m = /[/:]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/.exec((res.stdout ?? "").trim());
  return res.status === 0 && m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}
const targetsThisApp = (i) => {
  const mine = originRepo();
  return Boolean(mine && i?.owner && i?.repo && `${i.owner}/${i.repo}`.toLowerCase() === mine);
};
const block = (msg) => {
  process.stderr.write(`${msg}\n`);
  process.exit(2);
};

if (mode === "write") {
  if (isHarnessRepo(input.tool_input?.owner, input.tool_input?.repo) && !(originRepo() ?? "").endsWith("/app-studio")) block(HARNESS_MSG);
  if (!targetsThisApp(input.tool_input)) process.exit(0);
  block(
    "Blocked: don't write files to this app's repo through the GitHub API, because that skips the harness health check. " +
      "Edit the local clone, commit with git (the pre-commit check runs) and push.",
  );
}

/** Repos from the App profile's "Owner-merged repos" row (`owner/repo`, comma-separated; `none` or empty means none), lower case. */
function ownerMergedRepos() {
  let text = "";
  try {
    text = readFileSync(join(root, "CLAUDE.md"), "utf8");
  } catch {
    return [];
  }
  const start = text.indexOf("## App profile");
  if (start < 0) return [];
  const end = text.indexOf("\n## ", start + 5);
  for (const line of text.slice(start, end < 0 ? undefined : end).split("\n")) {
    const cells = line.replace(/\\\|/g, "\u0000").split("|").map((c) => c.replace(/\u0000/g, "|").trim());
    if (cells[0] === "" && cells[1] === "Owner-merged repos")
      return (cells[2] ?? "").replace(/`/g, "").split(/[,\s]+/).map((r) => r.toLowerCase()).filter((r) => /^[^/\s]+\/[^/\s]+$/.test(r));
  }
  return [];
}

if (mode === "merge") {
  const pr = input.tool_input ?? {};
  // Owner-merged repos: Claude never merges, switches on auto-merge or approves there, whatever the checks say.
  const tool = String(input.tool_name ?? "");
  if (isHarnessRepo(pr.owner, pr.repo) && !(originRepo() ?? "").endsWith("/app-studio")) block(HARNESS_MSG);
  const approves = /pull_request_review_write$/.test(tool) && /approve/i.test(`${pr.event ?? ""}`);
  const merges = /(merge_pull_request|enable_pr_auto_merge)$/.test(tool);
  if ((approves || merges || !tool) && pr.owner && pr.repo && ownerMergedRepos().includes(`${pr.owner}/${pr.repo}`.toLowerCase()))
    block(
      `Blocked: only the App Creator merges in ${pr.owner}/${pr.repo} (App profile, Owner-merged repos). ` +
        "Don't merge, switch on auto-merge or approve this PR; open it ready for review, tell the App Creator it waits for them, and stop.",
    );
  // Both gates below are only for merging this app's own PRs. Switching on auto-merge needs the review and QA
  // results too (it is the usual way a PR merges); only a direct merge also needs the checks read first.
  if (!/(merge_pull_request|enable_pr_auto_merge)$/.test(tool) && tool) process.exit(0);
  if (!targetsThisApp(pr)) process.exit(0);
  const verdict = /enable_pr_auto_merge$/.test(tool) ? "" : mergeVerdict(input.transcript_path, pr);
  if (verdict) {
    block(
      `Merge blocked: ${verdict}. Right before merging, read the PR's checks (the GitHub pull_request_read tool, method ` +
        "get_check_runs) and merge only when every check has finished green: CI for code, Harness for Markdown, " +
        ".claude/ and workflows. A PR may have one or both. Wait for running checks; fix red ones.",
    );
  }
  const results = (await import("./verdict.mjs")).verdictProblems(root);
  if (results.length) block(`Merge blocked: the review and QA results don't cover this commit.\n${results.map((r) => `- ${r}`).join("\n")}`);
  process.exit(0);
}

/** Why the merge must wait, or "" when the latest check read (after the last push) is all green. */
function mergeVerdict(transcript, pr) {
  if (!transcript || !existsSync(transcript)) return "the session transcript can't be read, so the PR's checks can't be confirmed";
  const uses = new Map();
  let lastPush = -1;
  let lastRead = null;
  readFileSync(transcript, "utf8")
    .split("\n")
    .forEach((line, i) => {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        return;
      }
      const content = entry?.message?.content;
      if (!Array.isArray(content)) return;
      for (const b of content) {
        if (b?.type === "tool_use") {
          uses.set(b.id, b);
          if (/^Bash$/.test(b.name) && /\bgit\b[^\n]*\bpush\b/.test(b.input?.command ?? "")) lastPush = i;
        } else if (b?.type === "tool_result") {
          const use = uses.get(b.tool_use_id);
          const inp = use?.input ?? {};
          if (
            /pull_request_read$/.test(use?.name ?? "") &&
            inp.method === "get_check_runs" &&
            Number(inp.pullNumber) === Number(pr.pullNumber) &&
            `${inp.owner}/${inp.repo}`.toLowerCase() === `${pr.owner}/${pr.repo}`.toLowerCase()
          ) {
            const text = typeof b.content === "string" ? b.content : (b.content ?? []).map((c) => c?.text ?? "").join("");
            lastRead = { i, text };
          }
        }
      }
    });
  if (!lastRead) return "this session hasn't read the PR's checks";
  if (lastRead.i < lastPush) return "there was a push after the last time the PR's checks were read";
  let runs;
  try {
    runs = JSON.parse(lastRead.text).check_runs;
  } catch {
    return "the last read of the PR's checks couldn't be understood";
  }
  if (!Array.isArray(runs) || !runs.length) return "the PR has no checks yet (they may not have started)";
  // Only each check's latest run counts, as on GitHub: a re-run, or the run that replaced a draft's,
  // supersedes the older one (the higher id is newer; without ids, GitHub lists the newest first).
  const latest = new Map();
  for (const r of runs) {
    const prev = latest.get(r.name);
    if (!prev || (r.id != null && prev.id != null && Number(r.id) > Number(prev.id))) latest.set(r.name, r);
  }
  runs = [...latest.values()];
  const pending = runs.filter((r) => r.status !== "completed").map((r) => r.name);
  if (pending.length) return `checks still running: ${pending.join(", ")}`;
  const red = runs.filter((r) => !["success", "skipped", "neutral"].includes(r.conclusion)).map((r) => `${r.name} (${r.conclusion})`);
  if (red.length) return `checks not green: ${red.join(", ")}`;
  if (!runs.some((r) => r.conclusion === "success")) return "no check has passed yet (all were skipped)";
  return "";
}

// Dependencies not installed yet (fresh clone): nothing to check.
if (!existsSync(join(root, "node_modules"))) process.exit(0);

const hasBin = (name) =>
  existsSync(join(root, "node_modules", ".bin", name)) ||
  existsSync(join(root, "node_modules", ".bin", `${name}.cmd`));

/**
 * Short failure text for Claude: what failed, file:line and message, plus where the full output was saved.
 * Falls back to the last 4,000 characters if the summary helper is missing (an old app copy).
 */
async function failureText(label, out) {
  let logPath = "";
  try {
    logPath = join(tmpdir(), `studio-${label.toLowerCase().replace(/\W+/g, "-")}-failure.log`);
    writeFileSync(logPath, out);
  } catch {
    logPath = "";
  }
  try {
    const { summarize } = await import("./failure-summary.mjs");
    return summarize(out, { label, logPath });
  } catch {
    return out.slice(-4000);
  }
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, encoding: "utf8", shell: true });
  return { ok: res.status === 0, out: `${res.stdout ?? ""}${res.stderr ?? ""}`.trim() };
}

/** True for a TS/JS source file inside the app that ESLint should see (not build output or dependencies). */
const lintable = (rel) =>
  /\.(c|m)?(t|j)sx?$/.test(rel) && !rel.startsWith("..") && !/(^|[\\/])(dist[^\\/]*|node_modules)[\\/]/.test(rel);

/** TS/JS files changed since the last push, however they were edited: uncommitted, untracked and unpushed commits. */
function changedFiles() {
  const git = (...args) => {
    const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    return r.status === 0 ? (r.stdout ?? "").split("\n").filter(Boolean) : [];
  };
  const names = new Set([
    ...git("diff", "--name-only", "--relative", "HEAD"),
    ...git("ls-files", "--others", "--exclude-standard"),
    ...git("diff", "--name-only", "--relative", "@{upstream}...HEAD"),
  ]);
  return [...names].filter((f) => lintable(f) && existsSync(join(root, f)));
}

if (mode === "lint") {
  const file = input.tool_input?.file_path;
  if (!file) process.exit(0);
  const rel = relative(root, file);
  if (!lintable(rel)) process.exit(0);
  if (!hasBin("eslint")) process.exit(0);
  const { ok, out } = run("npx", ["eslint", "--max-warnings=0", "--no-warn-ignored", JSON.stringify(rel)]);
  if (!ok) {
    process.stderr.write(`Fix before continuing (${rel}):\n${await failureText("ESLint", out)}\n`);
    process.exit(2);
  }
  process.exit(0);
}

if (mode === "test") {
  // Avoid an endless loop if Claude is already continuing because of this hook.
  if (input.stop_hook_active) process.exit(0);
  // Files changed through shell commands (heredocs, scripts) skip the per-edit lint hook: lint them here.
  const files = hasBin("eslint") ? changedFiles() : [];
  if (files.length) {
    const lint = run("npx", ["eslint", "--max-warnings=0", "--no-warn-ignored", ...files.map((f) => JSON.stringify(f))]);
    if (!lint.ok) {
      process.stderr.write(`Fix before finishing (files changed this session):\n${await failureText("ESLint", lint.out)}\n`);
      process.exit(2);
    }
  }
  // Vitest with the compact reporter when the app uses it, otherwise the app's own test script.
  let scripts = {};
  try {
    scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};
  } catch {
    // No package.json: nothing to test.
  }
  let cmd;
  if (hasBin("vitest")) cmd = ["npx", ["vitest", "run", "--reporter=dot"]];
  else if (scripts.test && !/no test specified/.test(scripts.test)) cmd = ["npm", ["test", "--silent"]];
  else process.exit(0);
  const { ok, out } = run(...cmd);
  if (!ok) {
    process.stderr.write(`Fix before finishing:\n${await failureText("Unit tests", out)}\n`);
    process.exit(2);
  }
  process.exit(0);
}

process.stderr.write(`Unknown hook mode: ${mode}\n`);
process.exit(1);
