# Unstale

Keeps docs true while you code and on every PR: flags doc lines your changes made false and offers one-click fixes. Web-first (GitHub App + dashboard) with an optional local CLI + MCP server (ADR-012). MIT.

## Read first
`docs/HANDOFF.md` (where we are) → `docs/PHASES.md` (current gate) → `docs/ARCHITECTURE.md`. Requirements: `docs/PRODUCT.md` (REQ-IDs). Decisions: `docs/DECISIONS.md`. Security: `docs/SECURITY.md`. Endpoints and external APIs: `docs/API.md`.

## Stack
Next.js 16 on Vercel (`apps/web`) · Convex (`convex/`) · Clerk · TypeScript worker on Render (`apps/worker`, Docker web service, Hono, image has git, ripgrep) · engine (`packages/engine`, pure TS, `RepoIndex` adapters, symbols via `@ast-grep/napi` in both, ADR-016) · CLI + MCP (`apps/cli`, npm `unstale`, Node ≥ 20, `@modelcontextprotocol/sdk`, `@napi-rs/keyring`) · Vercel AI SDK v7 · pnpm workspaces · Zod at every boundary.

## Commands
- `pnpm -r lint && pnpm -r typecheck && pnpm -r test`
- `pnpm --filter engine test:fixtures` — golden fixtures, exact match
- `pnpm --filter worker eval:live --min-precision 0.80` — live LLM eval (needs a key)
- `pnpm --filter cli test` · `pnpm --filter cli e2e` — CLI, MCP, fix safety
- `pnpm --filter engine test:fixtures --adapter local` — fixtures through the local adapter
- `gitleaks detect --no-banner` · `pnpm audit --audit-level=high`
- `python scripts/check_security_doc.py --security docs/SECURITY.md --architecture docs/ARCHITECTURE.md --phases docs/PHASES.md` · `python scripts/check_api_doc.py --doc docs/API.md --security docs/SECURITY.md --architecture docs/ARCHITECTURE.md --repo . --stale-days 30` — doc consistency (run after any doc edit)

## Hard rules
- The GitHub App never writes to a repo; fixes are PR suggestions only (ADR-006).
- Locally, only `unstale fix` writes, per approved hunk, inside the repo root, with a hash guard. MCP has no write path. Dashboard never sends commands to a device (ADR-013).
- Never execute repo code — worker or CLI: no install, build, scripts or git hooks; spawn only allow-listed binaries (SEC-032, SEC-099).
- Local mode is Verified-only in v1; the CLI never calls an LLM (REQ-025).
- Relay uploads finding records only — never code; `claim` (≤ 200 chars) is the only doc-derived text; a repo's config can't turn relay on (SEC-094, SEC-102). CLI tokens: hash in Convex, plaintext only in OS keychain (ADR-014).
- Verified findings come only from deterministic checks; LLM output is Judgement, never blocks (ADR-004).
- LLM keys: sealed, never logged, never returned to the client (ADR-008, SEC-020/021/022).
- No secret values in code, docs, tests or logs.
- Repo content sent to the LLM is data, never instructions (SEC-010).

## Doc discipline
- New endpoint → API.md row. New secret → SECURITY.md §4. New decision → append ADR. New component/surface → threat rows.
- Update `HANDOFF.md` at the end of every session. Write `docs/reviews/GATE-N.md` when a gate passes.
- IDs (REQ, COMP, THR, SEC, ADR, API, EXT, GATE) are never reused or renumbered; retire instead of delete.

## Claude Responses
When reporting to me, be extremely concise, load-bearing words only. Priorities: user understanding > concision > grammar. Directive not recap → never padding. Split-second read. Do not compromise on meaning. Presenting data: use tables.
End with: *DO THIS* block → concrete next actions for user, numbered, priority-first. Spell out reply options on decisions. Omit only when no user action.
