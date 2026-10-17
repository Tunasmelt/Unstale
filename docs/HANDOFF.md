---
doc: HANDOFF
last_verified_commit: none
last_updated: 2026-10-17
---

# Handoff

> Overwritten every session.

**Current phase:** P0 — Setup, in progress. M0.1 (pnpm workspace: apps/web, apps/worker, apps/cli, packages/engine, convex; TS strict; Zod; ESLint; Vitest) and M0.2 (`.github/workflows/ci.yml`) done locally, committed on `main` (not pushed). Placeholders only: Next.js (P4) and Convex (P2) are not initialised yet.

**Phase order:** P0 → P1 → P2 → P3 → P4 → P6 (local) → P5 (release). Budget 5 weekends. Cut order if late: relay, then MCP.

**Next action:** Owner: confirm `unstale.dev` is yours (registered 2026-10-12 via Hostinger) and reserve npm `unstale` (free as of 2026-10-17). Then first commit, push to GitHub, confirm CI green incl. gitleaks; then M0.3 accounts (Convex, Clerk, Railway, Vercel, GitHub App `unstale-dev`) → GATE-0.

**This session (2026-10-17, review):** ADR-016 (symbols via `@ast-grep/napi` in both adapters; worker spawns only `git`, `rg`). Added API-016 token-check, THR-023, SEC-101 upload coalescing, SEC-102 repo config can't enable relay, SEC-103 pinned versions in setup docs; stable finding IDs + `stale` error for MCP; `repoKey` credential strip. Re-applied earlier minors (component labels, per-package test names, doc links, UTC day, secrets rows, dogfood mode paths).

**Blockers:** none for P0. Gate triggers T1–T11 defined (SECURITY §5), T7 checks in place for every gate that plans it. Doc checkers `scripts/check_security_doc.py` and `scripts/check_api_doc.py` exist and pass; EXT rows go stale 30 days after last verified (2026-11-14 for EXT-01…06).

**Known erratum:** ADR-012 says THR-015…THR-020; actual rows are THR-015…THR-022 (ADR is append-only, left as is).

**Decided this session:** retention (ADR-017).

**Open questions:** PRODUCT OQ-1 (org-member access), OQ-2 (default model IDs), OQ-3 (worker spend ceiling), OQ-4 (Clerk device grant for CLI login, v1.1).

**Last gate passed:** none.
