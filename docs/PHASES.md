---
doc: PHASES
last_verified_commit: none
last_updated: 2026-10-17
owner: Harris Shamsi
budget: 5 weekends
---

# Phases

> Each phase ends in a gate. A gate passes only when every command exits 0 and its security checks (SECURITY.md §5) have evidence. Record results in `docs/reviews/GATE-N.md`. Phase IDs are never renumbered: P6 was added on 2026-10-17 and runs **before** P5.

| Order | Phase | Goal | Est. | Status |
|---|---|---|---|---|
| 1 | P0 | Monorepo, CI, accounts, reserve npm name | 0.5 day | in progress (M0.1–M0.2 done locally; M0.3 accounts pending) |
| 2 | P1 | Engine + fixtures (deterministic, adapter boundary) | 1.5 days | not started |
| 3 | P2 | GitHub App PR check, Verified-only | 1.5 days | not started |
| 4 | P3 | LLM layer (BYOK, Judgement, fix text) | 1 day | not started |
| 5 | P4 | Web: landing + dashboard | 1 day | not started |
| 6 | P6 | Local: CLI `check`/`watch`/`fix`, MCP server, relay + Local view | 3 days | not started |
| 7 | P5 | Dogfood + release (App + npm) | 1 day | not started |

≈ 9.5 working days ≈ 5 weekends.

**Cut order if late:** drop relay (M6.4–M6.5, REQ-027/028) first, then MCP (M6.3, REQ-026); they move to v1.0.1. PR check (P2), web (P4) and CLI `check`/`watch`/`fix` (M6.1–M6.2) always ship. P3 can still slip to v1.0.1 as the last resort (Verified-only release).

## P0 — Setup
- M0.1 pnpm workspace: `apps/web`, `apps/worker`, `apps/cli`, `packages/engine`, `convex/`; TypeScript strict; Zod.
- M0.2 CI (GitHub Actions): lint, typecheck, test, gitleaks, audit.
- M0.3 Accounts: Convex project, Clerk app (GitHub social login), Render workspace (worker web service), Vercel project, GitHub App `unstale-dev`; register `unstale.dev`; reserve npm package `unstale` with 2FA and trusted publishing configured.

### GATE-0
- Commands: `pnpm -r lint && pnpm -r typecheck && pnpm -r test` · `gitleaks detect --no-banner` · `pnpm audit --audit-level=high`
- Requirements: none (infra)
- Security: SEC-023, SEC-080, SEC-100

## P1 — Engine
- M1.1 Parse + extract (REQ-003)
- M1.2 Classify + verify 8 claim types (REQ-004), git rename detection; `RepoIndex` interface + `CloneRepoIndex`; symbols via `@ast-grep/napi` (ADR-016)
- M1.3 False-positive guards + suppression (REQ-005)
- M1.4 Edit-mode resolution + `.unstale.yml` parsing incl. `local:` keys (REQ-006, REQ-013)
- M1.5 Fixture builder + 18 fixtures with golden `expected.yaml`; mutation test (REQ-018)

### GATE-1
- Commands: `pnpm --filter engine test` · `pnpm --filter engine test:fixtures` (exact golden match) · `pnpm --filter engine test:mutation` (report catch rate)
- Requirements: REQ-003, REQ-004, REQ-005, REQ-006, REQ-013, REQ-018
- Security: SEC-030, SEC-031, SEC-034, SEC-061

## P2 — GitHub App PR check (Verified-only)
- M2.1 Convex: schema, `POST /github/webhook`, signature + replay guard, installation sync, retention cron (REQ-001, REQ-017)
- M2.2 Enqueue + limits + supersede; Workpool action → worker (REQ-002, REQ-016)
- M2.3 Worker: HMAC auth, token mint, clone at SHA, index, run engine, delete clone (REQ-017)
- M2.4 Check run with annotations; review with suggestion blocks; neutral / fail-on-verified (REQ-007, REQ-008, REQ-009)
- M2.5 End-to-end on a test repo with seeded drift

### GATE-2
- Commands: `pnpm --filter convex test` · `pnpm --filter worker test` · `pnpm e2e:dev-app` (opens PR on test repo, asserts check run + suggestions)
- Requirements: REQ-001, REQ-002, REQ-007, REQ-008, REQ-009, REQ-016, REQ-017
- Security: SEC-001, SEC-002, SEC-022, SEC-032, SEC-033, SEC-035, SEC-050, SEC-061, SEC-104, SEC-106

## P3 — LLM layer
- M3.1 Key sealing + dashboard mutation (no UI yet) (REQ-012)
- M3.2 Section selection by changed files; budget + skipped report (REQ-010)
- M3.3 Judgement pass + fix text via `generateText` + `Output.object` (REQ-010, REQ-011)
- M3.4 Recorded replays in CI; live eval script (REQ-019)

### GATE-3
- Commands: `pnpm --filter worker test` (replay mode) · `pnpm --filter worker eval:live --min-precision 0.80`
- Requirements: REQ-010, REQ-011, REQ-012, REQ-019
- Security: SEC-010, SEC-011, SEC-012, SEC-013, SEC-020, SEC-021, SEC-022

## P4 — Web
- M4.1 Landing: problem, static before/after demo, install button, CLI quick start, privacy policy stating retention periods (REQ-015, ADR-017)
- M4.2 Dashboard: installations, runs, findings, key field (REQ-014)
- M4.3 Brand: Fraunces / Inter / JetBrains Mono; ink `#14161A`, paper `#F6F3EC`, proof red `#D9442B`, verified green `#2F8F5B`

### GATE-4
- Commands: `pnpm --filter web test` · `pnpm --filter convex test access.idor auth.required` · `pnpm --filter web build`
- Requirements: REQ-014, REQ-015
- Security: SEC-040, SEC-041, SEC-060, SEC-070

## P6 — Local (runs before P5)
- M6.1 CLI skeleton (`commander`), `LocalRepoIndex` (working tree + `git` CLI, spawn allow-list, `@ast-grep/napi` symbols); `unstale check` text/JSON/`--fail`; fixtures through local adapter (REQ-021, REQ-022, REQ-025, REQ-029)
- M6.2 `unstale watch` (recursive `fs.watch`, ~1 s debounce, reverse claim index); `unstale fix` (per-hunk diff approval, hash guard, root containment) (REQ-023, REQ-024)
- M6.3 `unstale mcp`: stdio server, `check_docs`, `propose_fix`; tested with Claude Code and Cursor configs (REQ-026)
- M6.4 Convex: `cliTokens` create/list/revoke; `POST /local/scans` ingest with hash auth, limits, allow-list; `POST /local/token-check` (REQ-027)
- M6.5 CLI `login`/`logout` (keychain), relay upload from `check`/`watch` with coalescing and repo opt-out; dashboard Local view + token page (REQ-027, REQ-028)

### GATE-6
- Commands: `pnpm --filter cli test` · `pnpm --filter engine test:fixtures --adapter local` · `pnpm --filter convex test relay` · `pnpm --filter convex test access.idor auth.required` · `pnpm --filter cli e2e` (temp repo: seed drift → `check --fail` exits 1 → `fix --yes-to-all` in sandbox → `check` exits 0; MCP `check_docs` returns the finding)
- Requirements: REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029
- Security: SEC-022, SEC-040, SEC-041, SEC-090, SEC-091, SEC-092, SEC-093, SEC-094, SEC-095, SEC-096, SEC-097, SEC-098, SEC-099, SEC-101, SEC-102, SEC-034, SEC-105, SEC-106

## P5 — Dogfood + release
- M5.1 Install the App and run the CLI (watch + MCP in Claude Code) on Docify and Cerebro 2.0; triage every finding (REQ-020)
- M5.2 README, CONTRIBUTING, `.unstale.yml` reference, CLI + MCP setup guide, MIT licence
- M5.3 Promote `unstale` prod GitHub App; deploy prod; publish npm `unstale` 1.0.0 from CI with provenance

### GATE-5
- Commands: all earlier gate commands green in CI · `python scripts/check_security_doc.py --security docs/SECURITY.md --architecture docs/ARCHITECTURE.md --phases docs/PHASES.md` · `python scripts/check_api_doc.py --doc docs/API.md --security docs/SECURITY.md --architecture docs/ARCHITECTURE.md --repo . --stale-days 30`
- Requirements: REQ-020
- Security: SEC-051, SEC-080, SEC-081, SEC-100, SEC-103
