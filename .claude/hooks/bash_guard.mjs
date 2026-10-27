#!/usr/bin/env node
// PreToolUse + PostToolUse: Bash
// Pre:  deny dangerous patterns, ASK the user on hard stops, snapshot the working tree.
// Post: diff the working tree against the snapshot and run the SAME checks as the edit hooks on
//       every file Bash touched. Closes the "sed -i / cat > / python -c bypasses Write/Edit hooks" gap
//       by checking the outcome, not by guessing from the command text.
import { join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import {
  readInput, preDecision, postBlock, config, hit, stateDir, readJson, writeJson, isRepo, statusPaths, mtime,
  git, matchList, branchViolation, ratchetViolations, findSecrets, readText, headContent,
} from "./lib.mjs";

const input = readInput();
const event = input.hook_event_name;
const cmd = (input.tool_input || {}).command || "";
const cfg = config();
const snapFile = join(stateDir("tmp"), `bash-${input.tool_use_id || input.session_id || "x"}.json`);

if (event === "PreToolUse") {
  for (const d of cfg.denyCommands || []) {
    if (new RegExp(d.pattern, "i").test(cmd)) {
      hit(d.id, { cmd: cmd.slice(0, 200) });
      preDecision("deny", `[harness ${d.id}] ${d.reason}`);
    }
  }

  if (isRepo()) {
    const paths = statusPaths();
    writeJson(snapFile, { head: git(["rev-parse", "HEAD"]), files: Object.fromEntries(paths.map((p) => [p, mtime(p)])) });
  }

  for (const h of cfg.hardStops || []) {
    if (new RegExp(h.pattern, "i").test(cmd)) {
      hit(h.id, { cmd: cmd.slice(0, 200) });
      preDecision("ask", `[harness ${h.id}] HARD STOP: ${h.reason} Needs the user's explicit go.`);
    }
  }
  process.exit(0);
}

if (event === "PostToolUse") {
  if (!isRepo() || !existsSync(snapFile)) process.exit(0);
  const snap = readJson(snapFile, { files: {} });
  try { unlinkSync(snapFile); } catch {}

  const changed = new Set();
  for (const p of statusPaths()) {
    if (!(p in snap.files) || snap.files[p] !== mtime(p)) changed.add(p);
  }
  const head = git(["rev-parse", "HEAD"]);
  if (snap.head && head && snap.head !== head) {
    // Bash committed something: inspect what the commits touched too.
    (git(["diff", "--name-only", snap.head, head]) || "").split("\n").filter(Boolean).forEach((p) => changed.add(p));
  }

  const problems = [];
  for (const r of changed) {
    if (r.startsWith(".harness/")) continue;
    if (matchList(r, cfg.readOnlyGlobs || [])) {
      hit("R-readonly", { path: r, via: "bash" });
      problems.push(`[harness R-readonly] Bash modified read-only ${r}. Revert: git restore -- '${r}' (or recreate as a new file).`);
    }
    const bv = branchViolation(r);
    if (bv && bv.mode === "deny") {
      hit("R-branch", { path: r, via: "bash" });
      problems.push(`[harness R-branch] Bash changed code on '${bv.branch}': ${r}. Move the change to a branch (git stash; git switch -c feat/x; git stash pop).`);
    }
    const now = readText(r);
    if (now != null) {
      const before = new Set(findSecrets(headContent(r) || "", r));
      const added = findSecrets(now, r).filter((s) => !before.has(s));
      if (added.length) {
        hit("R-secrets", { path: r, ids: added, via: "bash" });
        problems.push(`[harness R-secrets] Bash wrote a likely secret into ${r} (${added.join(", ")}). Remove it; use an env var.`);
      }
      for (const v of ratchetViolations(r)) {
        hit(v.id, { path: r, added: v.added, via: "bash" });
        problems.push(`[harness ${v.id}] ${r}: +${v.added}. ${v.message}`);
      }
    }
  }
  if (problems.length) postBlock(problems.join("\n") + "\nThis bypassed the edit hooks via Bash. Fix it now and prefer Edit/Write for file changes.");
  process.exit(0);
}

process.exit(0);
