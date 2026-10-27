#!/usr/bin/env node
// PostToolUse: Write | Edit | MultiEdit
// After the write: ratchets (no NEW bad patterns), branch warnings, "which doc governs this" reminders, HANDOFF size.
import { join } from "node:path";
import {
  readInput, postBlock, postContext, rel, insideRepo, ratchetViolations, branchViolation, docsFor, hit,
  stateDir, readJson, writeJson, config, readText, isRepo,
} from "./lib.mjs";

const input = readInput();
const ti = input.tool_input || {};
const r = rel(ti.file_path || ti.notebook_path);
if (!insideRepo(r) || !isRepo()) process.exit(0);

const problems = [];
const notes = [];

// 1. Ratchets
for (const v of ratchetViolations(r)) {
  hit(v.id, { path: r, added: v.added });
  problems.push(`[harness ${v.id}] ${r}: +${v.added}. ${v.message}`);
}

// 2. Branch policy in warn mode
const bv = branchViolation(r);
if (bv && bv.mode === "warn") {
  hit("R-branch", { path: r, branch: bv.branch, mode: "warn" });
  notes.push(`[harness R-branch] Editing code directly on '${bv.branch}'. Fine for a hotfix; otherwise branch.`);
}

// 3. Doc reminders, once per docMap entry per session (not per file: avoids noise on big refactors)
const seenPath = join(stateDir("tmp"), `seen-${input.session_id || "x"}.json`);
const seen = readJson(seenPath, {});
for (const m of docsFor(r)) {
  const key = `${m.glob}`;
  if (seen[key]) continue;
  seen[key] = true;
  hit("R-docmap", { path: r, docs: m.docs });
  notes.push(`[harness R-docmap] ${r} is governed by ${m.docs.join(" + ")} (${m.why}). Check they still hold; note drift in HANDOFF if not.`);
}
writeJson(seenPath, seen);

// 4. HANDOFF must stay a hot-tier file
const h = config().handoff || {};
if (h.path && r === h.path) {
  const lines = (readText(r) || "").split("\n").length;
  if (lines > (h.maxLines || 60)) {
    hit("R-handoff-size", { lines });
    problems.push(`[harness R-handoff-size] ${r} is ${lines} lines (cap ${h.maxLines}). It is overwritten each session: move history to CHANGELOG.md, decisions to DECISIONS.md.`);
  }
}

if (problems.length) postBlock([...problems, ...notes].join("\n") + "\nFix the flagged lines now, before continuing.");
if (notes.length) postContext(notes.join("\n"));
process.exit(0);
