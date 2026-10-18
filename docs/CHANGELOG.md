---
doc: CHANGELOG
last_verified_commit: none
---

# Changelog

> Append-only, newest first.

## [Unreleased]

### 2026-10-18 — Render, setup runbook
- DECISIONS: ADR-018 worker on Render (Docker web service); ADR-003 worker host superseded.
- Railway replaced by Render in ARCHITECTURE, SECURITY (§1, §4, SEC-023, SEC-051, §7), API (EXT-05), PHASES (M0.3), PRODUCT (OQ-3), CLAUDE.md.
- New `docs/SETUP.md`: npm reservation, GitHub App `unstale-dev`, Render, domain.
- `.gitignore`: `*.pem`.

### 2026-10-17 — P0 scaffold
- pnpm workspace (apps/web, apps/worker, apps/cli, packages/engine, convex), `tsconfig.base.json` strict, ESLint (typescript-eslint strict), Vitest 4.1.11, Zod 4 in engine; `.npmrc` save-exact.
- CI: lint, typecheck, test, `pnpm audit --audit-level=high`, doc checkers, gitleaks.
- Vitest 3 rejected: critical tinypool advisories; pinned 4.1.11 (patched, not a <2-week-old release).

### 2026-10-17 — Retention decided
- DECISIONS: ADR-017 — findings deleted 90 days after the run, idle localScans after 30 days; runs kept as metadata.
- SECURITY: THR-026, SEC-106 (retention cron); §1 and §8 updated. ARCHITECTURE, PRODUCT (REQ-017, REQ-027), PHASES (M2.1, M4.1, GATE-2, GATE-6) aligned.

### 2026-10-17 — Doc checkers
- `scripts/check_security_doc.py`: IDs unique, threat ↔ guardrail links both ways, components exist, triggers defined, every guardrail enforced at a PHASES gate, gate lists match, no secret values, exceptions cite an ADR.
- `scripts/check_api_doc.py`: index columns, auth/rate tiers, components, guardrails, requirements, endpoint notes, EXT staleness and secrets, code routes vs rows (`--repo`).
- SECURITY: Mitigates back-links added for SEC-010, 030, 034, 040, 041, 080, 098 (found by the checker).

### 2026-10-17 — T7 output checks
- SECURITY: THR-024 (repo text in GitHub output: mentions, images, HTML), THR-025 (terminal/MCP escape sequences); SEC-104 GitHub output escaping, SEC-105 CLI/MCP output sanitising; GATE-2 and GATE-6 checklists, PHASES and API guardrails updated.

### 2026-10-17 — Gate triggers
- SECURITY §5: defined T1–T11 (when each fires, required checks, guardrails); planned triggers per gate aligned to what each gate changes.

### 2026-10-17 — Doc review fixes
- DECISIONS: ADR-016 `@ast-grep/napi` symbol extraction in both adapters (fixes REQ-029 parity).
- API: API-016 `POST /local/token-check`; stable finding `id` and `stale` error for MCP; corrected EXT-01/EXT-02 doc links.
- SECURITY: THR-023 committed secrets; SEC-101 relay coalescing, SEC-102 repo config can only disable relay, SEC-103 pinned `unstale@<version>` in docs; SEC-094 credential strip; component fixes; WORKER_URL, NEXT_PUBLIC_CONVEX_URL, UNSTALE_API_URL in §4; localScans retention question.
- ARCHITECTURE / PHASES / PRODUCT / CLAUDE.md aligned: worker spawns `git`, `rg` only; UTC usage day; dogfood mode paths; gate test names.

### 2026-10-17 — Scope correction: local detection
- Scope: Unstale detects drift while you work locally and on every PR. Web-first with optional CLI (ADR-012 supersedes ADR-002).
- PRODUCT: REQ-021…REQ-029 (CLI `check`/`watch`/`fix`/`login`/`mcp`, relay, Local view, dual-adapter fixtures); non-goals and v1.1 list updated (browser local, agent hooks, pre-commit, local LLM).
- ARCHITECTURE: COMP-08 CLI, COMP-09 MCP server; flows B (local) and C (MCP); tables `cliTokens`, `localScans`.
- DECISIONS: ADR-013 local fix rule, ADR-014 CLI tokens, ADR-015 MCP shape.
- SECURITY: THR-015…THR-022, SEC-090…SEC-100, GATE-6 checklist, new secrets rows.
- API: API-009…API-015, auth tiers `cli` and `local`, rate tier `relay`, EXT-07…EXT-09.
- PHASES: new P6 (runs before P5); budget 5 weekends; cut order relay → MCP.

### 2026-10-15 — Documentation phase
- Kickoff doc set created: PRODUCT, ARCHITECTURE, DECISIONS (ADR-001…011), PHASES (P0–P5), SECURITY, API, HANDOFF.
- Design locked through grilling session: GitHub App PR check v1, Convex + Railway worker, BYOK LLM, MIT.
