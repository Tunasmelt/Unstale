#!/usr/bin/env node
// PreToolUse: Write | Edit | MultiEdit | NotebookEdit
// Blocks BEFORE the write: read-only paths, code edits on a protected branch, secrets in content.
import { readInput, preDecision, rel, insideRepo, matchList, config, findSecrets, branchViolation, hit, isRepo } from "./lib.mjs";

const input = readInput();
const ti = input.tool_input || {};
const r = rel(ti.file_path || ti.notebook_path);
if (!insideRepo(r)) process.exit(0);

const cfg = config();

// 0. Read tool on env files: values must not enter context (names-only inspection via Bash is allowed).
//    Done here instead of settings `permissions.deny: Read(.env)`, because Claude Code also applies that
//    deny to Bash commands that read the file — which blocked the safe `cut -d= -f1 .env` (benchmark 2026-10-23).
if (input.tool_name === "Read") {
  if (/(^|\/)\.env(\.(?!example$)[\w.-]+)?$/.test(r)) {
    hit("R-env-values", { path: r, via: "Read" });
    preDecision("deny", `[harness R-env-values] Reading ${r} would put secret values in context. Names only: cut -d= -f1 ${r}`);
  }
  process.exit(0);
}

// 1. Read-only paths (env files, raw data, already-committed migrations)
if (isRepo() && matchList(r, cfg.readOnlyGlobs || [])) {
  hit("R-readonly", { path: r });
  preDecision(
    "deny",
    `[harness R-readonly] ${r} is read-only. Committed migrations are immutable: write a NEW migration instead. ` +
      `Env files hold secrets: tell the user which variable to add and let them edit it.`
  );
}

// 2. Branch policy
const bv = isRepo() ? branchViolation(r) : null;
if (bv && bv.mode === "deny") {
  hit("R-branch", { path: r, branch: bv.branch });
  preDecision(
    "deny",
    `[harness R-branch] Code edits are blocked on '${bv.branch}'. Create a branch first: ` +
      `git switch -c feat/<short-name> (or fix/…). Docs/.claude edits are allowed on '${bv.branch}'.`
  );
}

// 3. Secrets in the new content
const text = [ti.content, ti.new_string, ti.new_source, ...(ti.edits || []).map((e) => e.new_string)]
  .filter(Boolean)
  .join("\n");
const secrets = findSecrets(text, r);
if (secrets.length) {
  hit("R-secrets", { path: r, ids: secrets });
  preDecision(
    "deny",
    `[harness R-secrets] Content looks like a live secret (${secrets.join(", ")}). ` +
      `Read it from an env var instead (process.env.X / os.environ["X"]) and add a placeholder to .env.example.`
  );
}

process.exit(0); // no opinion → normal permission flow
