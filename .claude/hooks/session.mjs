#!/usr/bin/env node
// SessionStart | Stop | PreCompact | SessionEnd — v2 (evidence-driven, see docs/EVIDENCE.md)
// Start: inject ONLY what's non-empty and high-signal (real HANDOFF, stale docs, watch-outs, playbook). Silent otherwise.
// Stop:  (1) trail line, (2) auto-HANDOFF from git + transcript (zero agent tokens),
//        (3) reflector: after a session with failed commands, ask ONCE for ≤2 itemized lessons (ACE-style delta update).
import { join } from "node:path";
import { appendFileSync, unlinkSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  ROOT, readInput, emit, hit, config, stateDir, readJson, writeJson, isRepo, branch, git, statusPaths, isProcess, mtime, readText,
} from "./lib.mjs";
import { drift, processRatio, hits } from "../harness/core.mjs";

const input = readInput();
const event = input.hook_event_name;
const sid = input.session_id || "x";
const tmp = stateDir("tmp");
const sessFile = join(tmp, `session-${sid}.json`);
const cfg = config();
const ad = cfg.adaptive || {};
const handoffPath = cfg.handoff?.path || "docs/HANDOFF.md";
const playbookPath = ad.playbookPath || "docs/PLAYBOOK.md";

const today = () => new Date().toISOString().slice(0, 10);
const hhmm = () => new Date().toTimeString().slice(0, 5);
const trail = (line) => appendFileSync(join(stateDir("trail"), `${today()}.md`), line + "\n");

function changedSince(s) {
  const startDirty = s.dirty || {};
  const files = new Set(statusPaths().filter((p) => !(p in startDirty) || startDirty[p] !== mtime(p)));
  const head = git(["rev-parse", "HEAD"]);
  let subjects = [];
  if (s.head && head && s.head !== head) {
    (git(["diff", "--name-only", s.head, head]) || "").split("\n").filter(Boolean).forEach((f) => files.add(f));
    subjects = (git(["log", "--format=%h %s", `${s.head}..${head}`]) || "").split("\n").filter(Boolean);
  }
  return { files: [...files].filter((f) => !f.startsWith(".harness/")), subjects };
}

/** Parse the session transcript: failed tool calls (excluding harness denials) and the last test-like command. */
function transcriptFacts() {
  const out = { failures: [], lessonWorthy: [], lastTest: null };
  let edited = false;
  const p = input.transcript_path;
  if (!p || !existsSync(p)) return out;
  const uses = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type === "tool_use") {
        uses[b.id] = b;
        if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(b.name)) edited = true;
        if (b.name === "Bash" && /(^|[;&|]\s*)(sed\s+-i|tee\s|cat\s*>|python3?\s+-\s*<<|perl\s+-pi)|>\s*\S+\.(ts|tsx|js|py|json|sql)\b/.test(b.input?.command || "")) edited = true;
      }
      if (b.type === "tool_result") {
        const u = uses[b.tool_use_id];
        const text = typeof b.content === "string" ? b.content : (b.content || []).map((x) => x.text || "").join("\n");
        const cmd = u?.input?.command || "";
        // Failure = non-zero exit OR failure text. `cmd | tail` / `| grep` exits 0 even when tests fail.
        const failText = /#\s*fail\s+[1-9]|^not ok\b|\bFAILED\b|^Traceback|npm ERR!|\b(TypeError|ReferenceError|SyntaxError|ENOENT)\b/m.test(text);
        const harnessDeny = /\[harness /.test(text);
        const failed = (b.is_error || (u?.name === "Bash" && failText)) && !harnessDeny;
        if (failed) {
          out.failures.push((cmd || u?.name || "?").slice(0, 120));
          // Lesson-worthy = project/environment knowledge, not normal red-green iteration:
          // a failure BEFORE any edit (pre-existing / setup), or an environment-type error at any time.
          const probe = /^\s*(rg|grep|ls|find|test|\[|git\s+(diff|show|log|status|grep))\b/.test(cmd);
          const envErr = /ENOENT|command not found|Cannot find module|ERR_MODULE_NOT_FOUND|ModuleNotFoundError|Missing script|No such file or directory|ECONNREFUSED|EADDRINUSE|permission denied/i.test(text);
          if (envErr || (!edited && !probe)) out.lessonWorthy.push((cmd || u?.name || "?").slice(0, 120));
        }
        if (u?.name === "Bash" && cmd.split(/&&|;|\|\|/).some((seg) => TEST_CMD.test(seg))) {
          const m = text.match(/#\s*pass\s+(\d+)[\s\S]*?#\s*fail\s+(\d+)/) || text.match(/Ran (\d+) tests?[\s\S]*?(OK|FAILED[^\n]*)/);
          out.lastTest = { cmd: cmd.slice(0, 100), ok: !b.is_error && !failText, summary: m ? m[0].replace(/\s+/g, " ").slice(0, 80) : (b.is_error || failText ? "failed" : "exit 0") };
        }
      }
    }
  }
  return out;
}

// A real test invocation at the start of a command (optionally after `cd x &&`), not a sed/echo that mentions "npm test".
const TEST_CMD = /^\s*(\S+=\S+\s+)*(npm\s+(run\s+)?test|pnpm\s+(-r\s+|--filter\s+\S+\s+)*(run\s+)?test(:\w+)?|yarn\s+test|node\s+--test|python3?\s+-m\s+(pytest|unittest)|pytest|npx\s+(vitest|jest))\b/;

const isTemplate = (t) => /<the single next concrete step>|updated: <yyyy/.test(t);

function writeAutoHandoff(s, ch, facts) {
  const lines = [
    "<!-- auto:start (hook-written from git + transcript; do not edit) -->",
    `## Auto · ${today()} ${hhmm()}`,
    `- Branch: \`${branch() || "(detached)"}\``,
    ...(ch.subjects.length ? [`- Commits this session: ${ch.subjects.slice(0, 5).join(" · ")}`] : []),
    `- Uncommitted: ${statusPaths().filter((p) => !p.startsWith(".harness/") && p !== handoffPath).slice(0, 8).join(", ") || "none"}`,
    ...(facts.lastTest ? [`- Last test: \`${facts.lastTest.cmd}\` → ${facts.lastTest.ok ? "ok" : "FAILED"} (${facts.lastTest.summary})`] : []),
    ...(facts.failures.length ? [`- Failed commands this session: ${facts.failures.length}`] : []),
    "<!-- auto:end -->",
  ];
  const block = lines.join("\n");
  let cur = readText(handoffPath);
  if (cur == null || isTemplate(cur)) cur = "# HANDOFF\n\n## Next action\n- (agent or user: one concrete step)\n";
  const next = /<!-- auto:start[\s\S]*?<!-- auto:end -->/.test(cur)
    ? cur.replace(/<!-- auto:start[\s\S]*?<!-- auto:end -->/, block)
    : cur.trimEnd() + "\n\n" + block + "\n";
  writeFileSync(join(ROOT, handoffPath), next);
}

function watchOuts() {
  const since = new Date(Date.now() - (ad.watchWindowDays || 14) * 864e5).toISOString();
  const counts = {};
  for (const h of hits(since)) counts[h.rule] = (counts[h.rule] || 0) + 1;
  const hints = ad.hints || {};
  const ratchetMsg = Object.fromEntries((cfg.ratchets || []).map((r) => [r.id, r.message]));
  return Object.entries(counts)
    .filter(([, n]) => n >= (ad.watchMinHits || 2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, ad.watchMax || 3)
    .map(([id, n]) => `- ${id} (blocked ${n}× recently): ${hints[id] || ratchetMsg[id] || hints[id.split("-")[0]] || "see the hook message"}`);
}

function playbook() {
  const t = readText(playbookPath);
  if (!t) return [];
  return t.split("\n").filter((l) => /^- \[L-\d+\]/.test(l) && !/\(retired/i.test(l)).slice(-(ad.playbookMax || 8));
}

if (!isRepo()) process.exit(0);

if (event === "SessionStart") {
  if (!readJson(sessFile, null)) {
    writeJson(sessFile, { start: Date.now(), head: git(["rev-parse", "HEAD"]), dirty: Object.fromEntries(statusPaths().map((p) => [p, mtime(p)])) });
  }
  const lines = [];
  const h = readText(handoffPath);
  if (h && !isTemplate(h)) lines.push(`[harness] ${handoffPath}:\n` + h.split("\n").slice(0, cfg.handoff?.maxLines || 40).join("\n"));
  try {
    const stale = drift().filter((r) => r.status === "stale");
    if (stale.length) {
      if ((input.source || "startup") === "startup") hit("R-drift", { docs: stale.map((r) => r.doc) });
      lines.push(`[harness] stale docs: ${stale.map((r) => r.doc).join(", ")} (code changed since last verified).`);
    }
  } catch {}
  try {
    const pr = processRatio();
    if (pr.warn) lines.push(`[harness] process commits (${pr.process}) > product (${pr.product}) over ${pr.days}d — tell the user.`);
  } catch {}
  if (ad.enabled !== false) {
    const w = watchOuts();
    if (w.length) lines.push("[harness] watch-outs from recent blocks:\n" + w.join("\n"));
    const pb = playbook();
    if (pb.length) lines.push(`[harness] project lessons (${playbookPath}):\n` + pb.join("\n"));
  }
  if (!lines.length) process.exit(0); // nothing high-signal: inject nothing
  emit({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") } });
}

if (event === "Stop") {
  const s = readJson(sessFile, null);
  if (!s) process.exit(0);
  const ch = changedSince(s);
  const code = ch.files.filter((f) => !isProcess(f));
  const facts = transcriptFacts();
  const sig = JSON.stringify([ch.files.sort(), ch.subjects.length]);
  if (ch.files.length && s.lastSig !== sig) {
    trail(`- ${hhmm()} | ${branch()} | commits +${ch.subjects.length} | ${ch.files.length} files: ${ch.files.slice(0, 6).join(", ")}`);
    s.lastSig = sig;
  }
  if (code.length && cfg.handoff?.auto !== false) {
    try { writeAutoHandoff(s, ch, facts); } catch {}
  }
  // Reflector (ACE-style): only with real execution feedback, only once, only if it hasn't already happened.
  const reflect = ad.enabled !== false && ad.reflect !== false;
  const minFail = ad.reflectMinFailures || 1;
  // Fire only on setup/environment failures (pre-edit or env-type errors) — never on normal red-green iteration.
  // Fire whether or not the session ended green: an unresolved setup failure gets one prompt to find the fix (second chance).
  const resolved = facts.lastTest?.ok === true;
  if (reflect && !input.stop_hook_active && !s.reflected && code.length && facts.lessonWorthy.length >= minFail && mtime(playbookPath) < s.start) {
    s.reflected = true;
    writeJson(sessFile, s);
    hit("R-learn", { failures: facts.lessonWorthy.length, resolved });
    const n = (readText(playbookPath) || "").match(/\[L-(\d+)\]/g)?.map((x) => Number(x.slice(3, -1))) || [];
    const next = (n.length ? Math.max(...n) : 0) + 1;
    const first = facts.lessonWorthy[0];
    emit({
      decision: "block",
      reason:
        `[harness R-learn] A setup/environment failure happened before your first edit (\`${first}\`). ` +
        (resolved
          ? `If you found its root cause and fix, append ≤2 bullets to ${playbookPath}: \`- [L-${next}] <symptom> → <root cause> → <fixing command> (${today()})\`. `
          : `Tests still aren't green. It is likely a project setup step: spend a few steps looking (package.json scripts, README, scripts/), apply the fix, re-run tests, then append the lesson to ${playbookPath} as \`- [L-${next}] <symptom> → <root cause> → <fixing command> (${today()})\`. If you can't find it, tell the user it is unexplained. `) +
        `Edit existing bullets instead of duplicating. Never record that a failure is expected, baseline or ignorable. ` +
        `Then give the user your normal final summary; mention this check only if you added a lesson or the failure remains unexplained.`,
    });
  }
  writeJson(sessFile, s);
  process.exit(0);
}

if (event === "PreCompact") {
  trail(`- ${hhmm()} | context compaction (${input.trigger || "auto"}) | ${branch()}`);
  process.exit(0);
}

if (event === "SessionEnd") {
  const s = readJson(sessFile, null);
  if (!s) process.exit(0);
  const ch = changedSince(s);
  trail(`- ${hhmm()} | session end (${input.reason || "?"}) | commits +${ch.subjects.length} | files ${ch.files.length}`);
  try { unlinkSync(sessFile); } catch {}
  process.exit(0);
}

process.exit(0);
