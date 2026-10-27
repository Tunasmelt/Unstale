---
doc: HANDOFF
last_verified_commit: none
updated: 2026-10-28
---
# HANDOFF  (overwritten every session by /close · cap 40 lines)

## Now
- Phase / gate: P0 Setup · GATE-0 (CI green incl. gitleaks)  (docs/PHASES.md)
- Branch: `main` (code edits now need a `feat/` or `fix/` branch: harness R-branch)
- Brief: none

## State
| Item | Grade | Evidence |
|---|---|---|
| M0.1 pnpm workspace (web, worker, cli, engine, convex; TS strict, Zod, ESLint, Vitest) | run-checked | pushed to Tunasmelt/Unstale `main` (378206f) |
| M0.2 CI `.github/workflows/ci.yml` | hypothesis | file present; GATE-0 not run |
| M0.3 accounts (npm `unstale`, GitHub App `unstale-dev`, Render, Convex, Vercel, Clerk, `unstale.dev`) | not started | owner task, `docs/SETUP.md` |
| Solo harness v2 (`.claude/`, RULES, PLAYBOOK, briefs) | run-checked | `harness.mjs doctor` + `selftest` |
| Next.js (P4), Convex (P2) | placeholders | not initialised |

## Next action
1. Owner follows `docs/SETUP.md` (M0.3), then Clerk + Next.js in `apps/web` (Clerk app `app_3KrbFB6OLixkseXu7K6hlVZdsDp`) on a `feat/` branch → `/gate-review GATE-0`.

## Blockers / open questions
- None for P0. PRODUCT OQ-1 (org-member access), OQ-2 (default model IDs), OQ-3 (worker spend ceiling), OQ-4 (CLI device grant, v1.1).
- EXT-01…06 go stale 2026-11-14 (`check_api_doc.py --stale-days 30`): re-verify before then.
- Known erratum: ADR-012 says THR-015…020; actual THR-015…022 (ADR append-only, left as is).
- Decided: retention ADR-017; worker on Render ADR-018. Last gate passed: none.

## Tried and failed (don't repeat)
- none
