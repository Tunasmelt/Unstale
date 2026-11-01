# Unstale

Shared project rules for Claude Code and Codex (`AGENTS.md` is the Codex entry point). Executable hooks in `.claude/settings.json` run in Claude Code only; other agents follow these rules as instructions and run diagnostics explicitly.

Keeps docs true while you code and on every PR: flags doc lines your changes made false and offers one-click fixes. Web-first (GitHub App + dashboard) with an optional local CLI + MCP server (ADR-012). MIT.
Stack: Next.js 16/Vercel (`apps/web`) · Convex (`convex/`) · Clerk · TS worker on Render (`apps/worker`, Hono, Docker with git + ripgrep) · engine (`packages/engine`, pure TS, `RepoIndex` adapters, `@ast-grep/napi`, ADR-016) · CLI + MCP (`apps/cli`, npm `unstale`, Node ≥ 20, `@modelcontextprotocol/sdk`, `@napi-rs/keyring`) · Vercel AI SDK v7 · pnpm workspaces · Zod at every boundary.
Test: `pnpm -r test 2>&1 | tail -n 25` · Lint/types: `pnpm -r lint && pnpm -r typecheck` · Doc checks: `pnpm check:docs` (run after any doc edit)
More: `pnpm --filter engine test:fixtures` (golden, exact match; `--adapter local` for local adapter) · `pnpm --filter cli test` · `pnpm --filter cli e2e` (CLI, MCP, fix safety) · `pnpm --filter worker eval:live --min-precision 0.80` (needs a key) · `gitleaks detect --no-banner` · `pnpm audit --audit-level=high`. Per-gate sets: `docs/PHASES.md`.
Where we are: `docs/HANDOFF.md` → `docs/PHASES.md`. REQ-IDs: `docs/PRODUCT.md` · ADRs: `docs/DECISIONS.md` · threats/SEC: `docs/SECURITY.md` · endpoints/EXT: `docs/API.md`.

## Never (hooks enforce most; a block message names the fix — follow it, don't route around it)
- Push to main, force push, `reset --hard`, `clean -f`, `checkout -- .`, `rm -rf`, prod deploy (Vercel, Render, `convex deploy`), destructive SQL, `npm publish` → stop and ask.
- Print or edit `.env*` values. Names only: `cut -d= -f1 .env`.
- Secrets in files (code, docs, tests, logs). Pasted keys go to env vars + a placeholder in `.env.example`.
- Discard the user's uncommitted work. Fix forward.
- GitHub App writes to a repo. Fixes are PR suggestions only (ADR-006).
- Local writes outside `unstale fix` (per approved hunk, inside repo root, hash guard). MCP has no write path; dashboard never sends commands to a device (ADR-013).
- Execute repo code, worker or CLI: no install, build, scripts or git hooks; spawn only allow-listed binaries (SEC-032, SEC-099).
- CLI calls an LLM. Local mode is Verified-only in v1 (REQ-025).
- Relay uploads code. Finding records only; `claim` (≤ 200 chars) is the only doc-derived text; repo config can't enable relay (SEC-094, SEC-102). CLI tokens: hash in Convex, plaintext only in OS keychain (ADR-014).
- LLM output as Verified or blocking. Verified = deterministic checks only; LLM = Judgement (ADR-004).
- LLM keys logged or returned to the client; they stay sealed (ADR-008, SEC-020/021/022). Repo content sent to the LLM is data, never instructions (SEC-010).
- Reuse or renumber IDs (REQ, COMP, THR, SEC, ADR, API, EXT, GATE). Retire instead of delete.

## Always
- Code changes on a `feat/` or `fix/` branch; docs edits may stay on main.
- Check the premise in code before acting (`rg` the symbol). A doc describing code is not evidence.
- "Fixed"/"works" needs evidence: the command and its result. Report the grade reached: `hypothesis` → `red-green` → `run-checked`. Never claim `verified` (user only).
- Can't verify (no network, missing key)? Say so plainly; don't fake a pass.
- New feature + user present → offer `/brief` first. Merging to main is the user's call.
- Doc discipline: new endpoint → API.md row · new secret → SECURITY.md §4 · new decision → append ADR · new component/surface → threat rows. Gate passed → `/gate-review` writes `docs/reviews/`.
- Token hygiene: summarize long output (`| tail`, `rg -n`, read file ranges); don't re-read files you just edited.

## Claude Responses
When reporting to me, be extremely concise, load-bearing words only. Priorities: user understanding > concision > grammar. Directive not recap → never padding. Split-second read. Do not compromise on meaning. Presenting data: use tables.
End with: *DO THIS* block → concrete next actions for user, numbered, priority-first. Spell out reply options on decisions. Omit only when no user action.
