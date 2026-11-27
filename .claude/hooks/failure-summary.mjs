// Turns the output of a failed check into a short summary: what failed, where (file:line) and the message.
// Used by the hooks (check.mjs) and by CI (scripts/ci-run.mjs), so Claude reads ~10 lines, not a whole log.
// Understands: node:test (spec reporter), vitest, ESLint (stylish); anything else gets the lines that look
// like errors plus the last few lines. Node built-ins only. Shared studio harness file: change it in app-studio.

const MAX_LINES = 30;
const clip = (s, n = 200) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const rel = (p) => p.replace(/^file:\/\//, "").replace(process.cwd() + "/", "");

/** Each failure: { name, where, message }. */
function parseNodeTest(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:\s*)test at (.+:\d+:\d+)$/.exec(lines[i]);
    if (!m || !/^\s*✖ /.test(lines[i + 1] ?? "")) continue;
    const name = lines[i + 1].replace(/^\s*✖ /, "").replace(/ \([\d.]+ms\)$/, "");
    const parts = [];
    for (let j = i + 2; j < lines.length && !/^\s*at /.test(lines[j]) && !/^test at /.test(lines[j]) && parts.length < 2; j++) {
      const l = lines[j].trim();
      if (l) parts.push(l);
    }
    const message = parts.join(" ");
    out.push({ name, where: rel(m[1]), message });
  }
  return out;
}

function parseVitest(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*FAIL\s+(\S+?)(?:\s+>\s+(.+))?$/.exec(lines[i]);
    if (!m) continue;
    let message = "";
    let where = m[1];
    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      const l = lines[j].trim();
      if (/^FAIL\s/.test(l)) break;
      const at = /^❯\s+(\S+:\d+(?::\d+)?)/.exec(l);
      if (at) { where = at[1]; break; }
      if (!message && /(Error|expected|Expected)/.test(l)) message = l;
    }
    out.push({ name: m[2] ?? m[1], where: rel(where), message });
  }
  return out;
}

function parseEslint(lines) {
  const out = [];
  let file = "";
  for (const l of lines) {
    if (/^\S.*\.(c|m)?(t|j)sx?$/.test(l.trim()) && !/^\s/.test(l)) { file = l.trim(); continue; }
    const m = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.*?)\s{2,}(\S+)\s*$/.exec(l);
    if (m && file) out.push({ name: m[5], where: `${rel(file)}:${m[1]}:${m[2]}`, message: m[4] });
  }
  return out;
}

/**
 * Short summary of a failed check's output (at most `max` lines). `label` names the check ("Unit tests").
 * `logPath` (optional) is where the full output was saved.
 */
export function summarize(output, { label = "Check", logPath = "", max = MAX_LINES } = {}) {
  const lines = strip(String(output ?? "")).split("\n");
  const found = [...parseNodeTest(lines), ...parseVitest(lines), ...parseEslint(lines)];
  const res = [];
  if (found.length) {
    res.push(`${label} failed: ${found.length} problem${found.length === 1 ? "" : "s"}. First ${Math.min(found.length, 5)}:`);
    for (const f of found.slice(0, 5)) {
      res.push(`- ${clip(f.name, 120)}`);
      res.push(`  at ${f.where}`);
      if (f.message) res.push(`  ${clip(f.message)}`);
    }
    if (found.length > 5) res.push(`...and ${found.length - 5} more.`);
  } else {
    const errs = lines.map((l) => l.trim()).filter((l) => /\b(error|fail(ed|ure)?|not ok|✖|cannot find|ENOENT)\b/i.test(l));
    res.push(`${label} failed. Most relevant lines:`);
    const pick = errs.length ? errs.slice(0, 8) : lines.map((l) => l.trim()).filter(Boolean).slice(-10);
    for (const l of pick) res.push(`  ${clip(l)}`);
  }
  if (logPath) res.push(`Full output: ${logPath}`);
  return res.slice(0, max).join("\n");
}
