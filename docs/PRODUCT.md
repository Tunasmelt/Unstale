---
doc: PRODUCT
last_verified_commit: none
last_updated: 2026-10-17
owner: Harris Shamsi
status: draft
---

# Product — Unstale

> Docs that stay true. Unstale keeps your docs true while you code and on every PR: it flags doc lines your changes made false and offers one-click fixes. Open source, web-first, with an optional local CLI.

## Problem

Coding agents change code faster than anyone updates the docs. Stale `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md` and README claims send the next agent run confidently down the wrong path. At least ten tools detect some of this (agnix, agentrot, unrot, DocGuard, spec-kit-sync …), but healing is thin and none publish accuracy. Catching drift only at PR time is late: the agent has already worked from the false doc for the whole session.

## Users

| Who | Need |
|---|---|
| Solo devs and small teams whose code is mostly written by coding agents | Know, while working and on every PR, which doc lines their changes made false, and fix them with one approval |

## Scope (v1)

Two surfaces, one engine (ADR-012):

| Surface | What it does |
|---|---|
| **GitHub App PR check** (primary) | Check run + suggestion blocks on every PR; LLM Judgement with the user's own key |
| **Local CLI** `unstale` (optional) | `watch` re-checks on save; `check` one-shot; `fix` applies approved diffs; `mcp` lets coding agents query findings; `login` relays findings to the dashboard |

Document-agnostic: works on any markdown, no per-framework adapters. Deterministic claim checks first; the LLM (PR check only in v1) writes fix text and flags meaning-level drift, labelled **Judgement**.

## Requirements

| ID | Requirement | Phase |
|---|---|---|
| REQ-001 | A repo owner can install the GitHub App on selected repos with permissions `contents:read`, `pull_requests:write`, `checks:write`, `metadata:read` | P2 |
| REQ-002 | On `pull_request` opened, synchronize or reopened, Unstale runs a check on the PR head commit; a newer push supersedes a pending run for the same PR | P2 |
| REQ-003 | The engine extracts claims from any markdown file: inline code spans, relative links and anchors, `@imports`, and command lines in shell-fenced blocks. Plain prose is never parsed for claims | P1 |
| REQ-004 | The engine verifies 8 claim types against the repo at that commit: path, command, package manager, version/tool, identifier, route, count, link | P1 |
| REQ-005 | False-positive guards: negations, "e.g." lines, create-file instructions, placeholders, URLs, gitignored paths, common words, changelog/ADR deprecation notes; `<!-- unstale-ignore -->` and config ignores suppress findings | P1 |
| REQ-006 | Each file gets an edit mode — auto-fix, propose, append/flag-only — resolved in order: `heal:` frontmatter tag → `.unstale.yml` → git-history inference → propose | P1 |
| REQ-007 | Findings appear as one check run with annotations on exact doc lines, each labelled **Verified** (deterministic) or **Judgement** (LLM) | P2 |
| REQ-008 | Fixes appear as review suggestion blocks the user commits in one click; nothing is ever written to the repo by the GitHub App | P2 |
| REQ-009 | The check is neutral by default; `.unstale.yml` can set it to fail on Verified errors only. Judgement findings never fail a check | P2 |
| REQ-010 | With an LLM key set, the LLM reviews only doc sections that mention files changed in the PR, flags sentences now false with evidence, within a 30k-token budget per PR (most-referenced sections first; skipped sections reported) | P3 |
| REQ-011 | With an LLM key set, the LLM writes replacement text for findings that have no deterministic fix | P3 |
| REQ-012 | Bring your own key: a user sets an API key and provider (Anthropic, OpenAI, Google) per installation in the dashboard; the key is never shown again; without a key, LLM features are off and deterministic checks still run | P3 |
| REQ-013 | `.unstale.yml` configures ignores, edit modes, model, blocking mode and token budget; the CLI reads the same file | P1 |
| REQ-014 | Dashboard: signed-in user sees installations they own, recent runs with findings, and the key field | P4 |
| REQ-015 | Landing page: problem, static before/after demo, install button, CLI quick start, privacy policy | P4 |
| REQ-016 | Limits per installation: 50 runs/day, 1 concurrent job; repos over 2,000 files get deterministic checks only, with a note in the check summary | P2 |
| REQ-017 | Privacy: the clone is deleted when each job ends; only finding records (file, line, claim, verdict, fix text) are stored, never source code; finding records are deleted after 90 days (ADR-017) | P2 |
| REQ-018 | Fixture suite: script-built git repos with golden `expected.yaml`; deterministic output must match exactly; mutation test reports catch rate | P1 |
| REQ-019 | LLM tests: CI replays recorded model responses; a live eval on demand must reach Judgement precision ≥ 0.80 before release | P3 |
| REQ-020 | Dogfood the PR check and the CLI on Docify and Cerebro 2.0 before public release | P5 |
| REQ-021 | One npm package `unstale` (Node ≥ 20) with commands `check`, `watch`, `fix`, `login`, `logout`, `mcp`; runs offline with no account; uploads nothing unless logged in | P6 |
| REQ-022 | `unstale check` scans the working tree once, prints findings (text or `--json`), and exits non-zero on Verified errors when `--fail` is set | P6 |
| REQ-023 | `unstale watch` runs a full scan on start, then re-checks ~1 s after file changes stop: changed docs plus docs that reference changed paths; respects `.gitignore` and `.unstale.yml` | P6 |
| REQ-024 | `unstale fix` shows each fixable finding as a diff and asks yes / no / skip; writes only approved hunks; refuses a file whose content changed since the scan; never writes outside the repo root | P6 |
| REQ-025 | Local checks are Verified-only in v1: the CLI never calls an LLM | P6 |
| REQ-026 | `unstale mcp` is a stdio MCP server with two tools: `check_docs` (read-only findings for the repo or given paths) and `propose_fix` (returns a unified diff for one finding and never writes); the agent applies diffs with its own edit tool | P6 |
| REQ-027 | Relay: `unstale login` stores a dashboard-created CLI token in the OS keychain; when logged in, `check` and `watch` upload finding records only (doc path, line, claim, rule, status, repo name); each upload replaces that repo's previous snapshot; `watch` uploads at most once a minute; a repo's `.unstale.yml` can turn relay off but never on; a snapshot not refreshed for 30 days is deleted | P6 |
| REQ-028 | Dashboard **Local** view: live latest local snapshot per repo, view-only, with a "copy fix command" button per finding; users create, list and revoke CLI tokens | P6 |
| REQ-029 | The engine runs identically in the worker and the CLI: the full fixture suite passes through both the clone adapter and the local file adapter | P6 |

## Non-goals (v1)

| Item | When |
|---|---|
| Browser local mode (File System Access API) | v1.1 |
| Coding-agent hooks (Claude Code, Cursor, Codex, Gemini CLI) via `unstale init` | v1.1 |
| Pre-commit hook via `unstale init` | v1.1 |
| LLM Judgement in local mode | v1.1 |
| Rolling heal PR on main (needs `contents:write`) | v1.1 |
| Editor extension / language server | v1.2 |
| Public benchmark, leaderboard, repo scores, badges | v1.2 |
| GitLab / Bitbucket | not planned |
| Hosted LLM key (project pays) | not planned |
| Docs outside git (Notion, Confluence) | not planned |
| Dashboard "Apply" button that writes to a local machine | never (ADR-013) |
| MCP tool that writes files | never (ADR-013) |
| Writing anything without the user's approval | never |

## Success criteria for v1

- Fixture golden files match exactly through both adapters; mutation catch rate reported.
- Judgement precision ≥ 0.80 on the live eval.
- PR check and CLI used on Docify and Cerebro 2.0, catching at least one real stale claim each, with zero false-positive blocks.
- Shipped within 5 weekends. Cut order if late: relay (REQ-027/028) first, then MCP (REQ-026). PR check and CLI `check`/`watch`/`fix` always ship.

## Assumptions

- Users accept bringing their own LLM key for Judgement features.
- Most stale claims in agent-written repos are mechanical (paths, scripts, versions), so Verified-only already delivers value locally.
- Users who want local detection are comfortable running one `npx` command.
- Railway worker cost at 50 runs/day/installation stays within a hobby budget for early adoption.

## Open questions

- OQ-1: Org installations with several members — v1 grants dashboard access to the installing GitHub user only (ADR-009). Is org-member access needed before launch?
- OQ-2: Default model per provider — pin exact model IDs during P3 against live provider docs.
- OQ-3: Worker cost ceiling — set a monthly Railway spend alert value.
- OQ-4: Re-test Clerk Device Authorization Grant token verification in v1.1 to replace pasted CLI tokens (ADR-014).
