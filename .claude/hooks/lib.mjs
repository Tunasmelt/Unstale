// Shared helpers for the solo harness hooks. Node >= 18, zero dependencies.
import { readFileSync, existsSync, mkdirSync, appendFileSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, isAbsolute, sep } from "node:path";

export const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// ---------- stdin / output ----------
export function readInput() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

export const preDecision = (decision, reason) =>
  emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } });

export const postBlock = (reason) => emit({ decision: "block", reason });

export const postContext = (text) =>
  emit({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } });

// ---------- config ----------
let _cfg;
export function config() {
  if (_cfg) return _cfg;
  const p = join(ROOT, ".claude", "harness.config.json");
  _cfg = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  return _cfg;
}

// ---------- paths ----------
export function rel(p) {
  if (!p) return "";
  const abs = isAbsolute(p) ? p : join(ROOT, p);
  return relative(ROOT, abs).split(sep).join("/");
}

export const insideRepo = (r) => r && !r.startsWith("..") && !isAbsolute(r);

// ---------- globs (supports **, *, ?, [..], {a,b}) ----------
function expandBraces(glob) {
  const m = glob.match(/\{([^{}]*)\}/);
  if (!m) return [glob];
  const [whole, body] = m;
  return body.split(",").flatMap((alt) => expandBraces(glob.replace(whole, alt)));
}

const _re = new Map();
function globToRegex(glob) {
  if (_re.has(glob)) return _re.get(glob);
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "[") {
      const end = glob.indexOf("]", i);
      re += glob.slice(i, end + 1);
      i = end;
    } else re += /[.+^$()|\\]/.test(c) ? "\\" + c : c;
  }
  const rx = new RegExp("^" + re + "$");
  _re.set(glob, rx);
  return rx;
}

export function matchGlob(path, glob) {
  return expandBraces(glob).some((g) => globToRegex(g).test(path));
}

/** Ordered glob list with `!negation` and optional `@committed` suffix (file must exist in HEAD). */
export function matchList(path, globs = []) {
  let hit = false;
  for (const raw of globs) {
    const neg = raw.startsWith("!");
    let g = neg ? raw.slice(1) : raw;
    let needCommitted = false;
    if (g.endsWith("@committed")) { needCommitted = true; g = g.slice(0, -"@committed".length); }
    if (!matchGlob(path, g)) continue;
    if (needCommitted && !onProtected(path)) continue;
    hit = !neg;
  }
  return hit;
}

export const isProcess = (r) => matchList(r, config().processGlobs || []);

// ---------- git ----------
export function git(args, { raw = false } = {}) {
  try {
    const out = execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return raw ? out : out.trim();
  } catch {
    return null;
  }
}
export const isRepo = () => git(["rev-parse", "--is-inside-work-tree"]) === "true";
export const branch = () => git(["branch", "--show-current"]) || "";
export const headSha = () => git(["rev-parse", "--short", "HEAD"]);
export const inHead = (r) => git(["cat-file", "-e", `HEAD:${r}`]) !== null;

/** `@committed` = the file exists on a protected branch (main). A migration you created and committed
 *  on an unmerged feature branch has never been applied anywhere, so it stays editable.
 *  Falls back to HEAD when no protected branch exists yet. */
export function onProtected(r) {
  const refs = (config().branchPolicy?.protected || ["main", "master"]).filter((b) => git(["rev-parse", "--verify", "-q", b]) !== null);
  if (!refs.length) return inHead(r);
  return refs.some((b) => git(["cat-file", "-e", `${b}:${r}`]) !== null);
}
export const headContent = (r) => git(["show", `HEAD:${r}`]);

export function statusPaths() {
  // raw: the first line's leading status space is significant (" M path"); trimming shifts the path.
  const out = git(["status", "--porcelain=v1", "-uall"], { raw: true });
  if (!out) return [];
  return out.split("\n").filter(Boolean).map((l) => {
    let p = l.slice(3);
    if (p.includes(" -> ")) p = p.split(" -> ")[1];
    return p.replace(/^"|"$/g, "");
  });
}

export function mtime(r) {
  try { return statSync(join(ROOT, r)).mtimeMs; } catch { return -1; }
}

// ---------- state dirs / logging ----------
export function stateDir(...parts) {
  const d = join(ROOT, ".harness", ...parts);
  mkdirSync(d, { recursive: true });
  return d;
}

/** Every rule firing is logged so /retro can sunset rules that never fire. */
export function hit(rule, detail = {}) {
  try {
    appendFileSync(join(stateDir(), "hits.jsonl"), JSON.stringify({ ts: new Date().toISOString(), rule, ...detail }) + "\n");
  } catch { /* logging must never break a hook */ }
}

export function readJson(p, fallback) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
}
export function writeJson(p, v) {
  writeFileSync(p, JSON.stringify(v, null, 2));
}

export function readText(r) {
  try { return readFileSync(join(ROOT, r), "utf8"); } catch { return null; }
}

// ---------- content checks shared by edit + bash guards ----------
export function countMatches(text, pattern, flags = "gm") {
  if (!text) return 0;
  return (text.match(new RegExp(pattern, flags)) || []).length;
}

export function findSecrets(text, r) {
  const cfg = config();
  if (!text || matchList(r, cfg.secretAllowGlobs || [])) return [];
  return (cfg.secretPatterns || []).filter((s) => new RegExp(s.pattern, "m").test(text)).map((s) => s.id);
}

/** Ratchet: flag only when a file has MORE matches than its committed version. Legacy code never trips it. */
export function ratchetViolations(r) {
  const cfg = config();
  const now = readText(r);
  if (now == null) return [];
  const base = headContent(r) || "";
  const out = [];
  for (const rt of cfg.ratchets || []) {
    if (!matchGlob(r, rt.glob)) continue;
    if ((rt.exclude || []).some((g) => matchGlob(r, g))) continue;
    if (rt.onlyIfContains && !new RegExp(rt.onlyIfContains, "m").test(now)) continue;
    const a = countMatches(base, rt.pattern);
    const b = countMatches(now, rt.pattern);
    if (b > a) out.push({ id: rt.id, message: rt.message, added: b - a });
  }
  return out;
}

export function branchViolation(r) {
  const bp = config().branchPolicy || {};
  if (!bp.mode || bp.mode === "off") return null;
  if (isProcess(r)) return null;
  const b = branch();
  if (!b || !(bp.protected || []).includes(b)) return null;
  return { mode: bp.mode, branch: b };
}

export function docsFor(r) {
  return (config().docMap || []).filter((m) => matchGlob(r, m.glob));
}
