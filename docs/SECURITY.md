---
doc: SECURITY
last_verified_commit: a37f180
last_updated: 2026-10-17
owner: Harris Shamsi
status: draft
---

# Security

> Living document. Threats map to `COMP-` IDs in ARCHITECTURE.md; guardrails are referenced by `GATE-` criteria in PHASES.md. Never write secret values here.

## 1. Scope, data classification & trust boundaries

**In scope:** GitHub App, Convex backend, Render worker, engine, LLM layer, web dashboard, local CLI (COMP-08), local MCP server (COMP-09), relay ingest.
**Out of scope / deliberately deferred:** formal pen test, SOC 2, org-member access control (ADR-009), browser local mode (v1.1 gets its own pass).

| Data | Classification | Where it lives | Notes |
|---|---|---|---|
| Repo source code (incl. private) | sensitive | COMP-04 temp dir only, deleted per job | never stored (REQ-017) |
| Finding records (file, line, claim, fix text) | sensitive | COMP-03 `findings` | may quote short doc snippets; deleted after 90 days (ADR-017) |
| User LLM API keys | secret | COMP-03 `llmKeys` as sealed ciphertext | plaintext only in COMP-04 memory |
| GitHub installation tokens | secret | COMP-04 memory, ≤ 1 h | never persisted |
| GitHub user id, login | internal | COMP-03, Clerk | |
| Doc text sent to LLM provider | sensitive | user's provider account | only sections mentioning changed files |
| CLI tokens | secret | plaintext: user's OS keychain; COMP-03 `cliTokens` holds SHA-256 hash + last 4 | shown once at creation |
| Local scan snapshots (doc path, line, claim ≤ 200 chars, rule, status, repo name) | sensitive | COMP-03 `localScans`, latest only; deleted after 30 days idle (ADR-017) | no code, no doc text |
| Local working tree | sensitive | user's machine only | read by COMP-08/09; never uploaded |

**Trust boundaries**
- GitHub → Convex webhook (COMP-06 → COMP-03): authenticated by HMAC, otherwise untrusted
- Convex → Worker (COMP-03 → COMP-04): HMAC-signed requests
- Repo content → Engine/LLM (COMP-07, COMP-05): fully untrusted, attacker-controlled
- Browser → Convex (COMP-01 → COMP-03): Clerk JWT, untrusted input
- Worker → LLM provider (COMP-05): user's key, data leaves the system
- CLI → Convex relay (COMP-08 → COMP-03): bearer CLI token, untrusted body
- Coding agent → MCP server (COMP-09): stdio; tool arguments untrusted (agent may be prompt-injected)
- Local repo content → CLI/MCP (COMP-08, COMP-09): untrusted, may be a cloned third-party repo

## 2. Threat model

Status: `open` · `mitigated` · `accepted` (needs EXC-) · `retired`

| ID | Component | Entry point | Threat (STRIDE) | Impact | Likelihood | Mitigations | Status |
|---|---|---|---|---|---|---|---|
| THR-001 | COMP-06 | `POST /github/webhook` | Spoofing / replay: forged or replayed webhook triggers runs | Medium | Medium | SEC-001, SEC-002 | mitigated |
| THR-002 | COMP-05 | Repo markdown sent to LLM | Tampering: indirect prompt injection makes the model emit misleading or malicious suggestions | High | Medium | SEC-010, SEC-011, SEC-012 | mitigated |
| THR-003 | COMP-03 | `llmKeys` table, key mutation | Info disclosure: user LLM key leaked via DB, logs or API | High | Low | SEC-020, SEC-021, SEC-022 | mitigated |
| THR-004 | COMP-04 | Cloned repo contents | Elevation: malicious repo escapes clone dir (symlinks) or executes code during indexing | High | Medium | SEC-030, SEC-032 | mitigated |
| THR-005 | COMP-04 | Installation token | Info disclosure: token leaked via logs, remote URL or error, giving repo access | High | Low | SEC-033, SEC-022 | mitigated |
| THR-006 | COMP-03 | Dashboard queries | Info disclosure: user reads another installation's runs/findings (IDOR) | High | Medium | SEC-040, SEC-041 | mitigated |
| THR-007 | COMP-03, COMP-04 | Webhook flood / huge repos | DoS / cost abuse of the free worker | Medium | High | SEC-050, SEC-051, SEC-031 | mitigated |
| THR-008 | COMP-01 | Findings rendered in dashboard | Tampering: stored XSS from doc text in findings | Medium | Medium | SEC-060 | mitigated |
| THR-009 | COMP-07 | Suggestion block content | Tampering: fix text breaks out of the suggestion fence and alters the review body | Low | Medium | SEC-061 | mitigated |
| THR-010 | COMP-02 | Sign-in, session | Spoofing: unauthenticated access to dashboard or Convex functions | High | Low | SEC-070 | mitigated |
| THR-011 | COMP-05 | User's LLM key spend | DoS / cost abuse: runaway tokens on the user's key | Medium | Medium | SEC-013 | mitigated |
| THR-012 | COMP-07 | Crafted markdown / manifests | DoS: ReDoS or oversized files stall the engine | Medium | Medium | SEC-031, SEC-034 | mitigated |
| THR-013 | COMP-04 | Convex → worker endpoint | Spoofing: anyone calls `POST /jobs/run` to use the worker or GitHub key | High | Medium | SEC-035 | mitigated |
| THR-014 | all | Dependencies (all apps) | Tampering: vulnerable or typosquatted package | Medium | Low | SEC-080, SEC-081 | mitigated |
| THR-015 | COMP-08 | CLI token (keychain, env, relay header) | Spoofing / info disclosure: stolen token used to push fake snapshots or token leaked from server DB | Medium | Medium | SEC-090, SEC-091, SEC-022 | mitigated |
| THR-016 | COMP-03 | `POST /local/scans` | DoS / tampering: flood or oversized/malformed snapshots; body claims another user's repo | Medium | Medium | SEC-092, SEC-093, SEC-101 | mitigated |
| THR-017 | COMP-08 | Relay upload payload, repo `.unstale.yml` | Info disclosure: CLI uploads code, doc text or remote credentials beyond finding records, or a cloned repo's config turns relay on | Medium | Low | SEC-094, SEC-102 | mitigated |
| THR-018 | COMP-08 | `unstale fix` writes | Tampering: write escapes repo root via symlink/`..`, or overwrites edits made since the scan | High | Medium | SEC-030, SEC-095, SEC-096 | mitigated |
| THR-019 | COMP-09 | MCP tool calls from a prompt-injected agent | Tampering / info disclosure: agent tricked into reading files outside the repo or writing via the server; injected doc text steers the agent | High | Medium | SEC-097, SEC-098, SEC-010 | mitigated |
| THR-020 | COMP-08 | Scanning an untrusted local repo | Elevation: CLI executes repo code (scripts, hooks) while indexing | High | Low | SEC-099, SEC-034 | mitigated |
| THR-021 | COMP-01, COMP-03 | Local view, CLI token pages | Info disclosure: user reads another user's local snapshots or tokens (IDOR) | High | Medium | SEC-040, SEC-041 | mitigated |
| THR-022 | COMP-08 | npm package `unstale` | Tampering: compromised publish or typosquat ships malicious CLI to users' machines | High | Low | SEC-100, SEC-080, SEC-103 | mitigated |
| THR-023 | all | Repo history, CI logs | Info disclosure: a platform secret is committed to the repo or printed in CI | High | Low | SEC-023, SEC-022 | mitigated |
| THR-024 | COMP-04 | Check-run summary, annotations, review comments | Tampering / spoofing: repo doc text quoted into GitHub output pings users (`@mention`, `#123`), embeds tracking images or raw HTML, or spoofs Unstale's own wording | Medium | Medium | SEC-104, SEC-061 | mitigated |
| THR-025 | COMP-08, COMP-09 | Terminal output, MCP tool results | Tampering: repo doc text carries ANSI/OSC escape or control sequences that rewrite the terminal, spoof prompts or set hyperlinks | Medium | Medium | SEC-105, SEC-098 | mitigated |
| THR-026 | COMP-03 | `findings`, `localScans` tables | Info disclosure: stored doc-derived text kept indefinitely widens what a breach or IDOR bug exposes | Medium | Low | SEC-106 | mitigated |

## 3. Guardrails

### Webhooks
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-001 | Verify `X-Hub-Signature-256` (HMAC-SHA256, constant-time compare) before any work; reject otherwise with 401 | `pnpm --filter convex test webhook.signature` | THR-001 |
| SEC-002 | De-duplicate on `X-GitHub-Delivery`; ignore events for unknown installations | `pnpm --filter convex test webhook.replay` | THR-001 |

### AI / agent safety
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-010 | Repo content is wrapped in delimited data blocks; the system prompt states it is data, never instructions | `pnpm --filter worker test prompt.template` incl. injection fixture | THR-002, THR-019 |
| SEC-011 | LLM output must parse against a Zod schema; suggestions may only replace lines the model was given; anything else is dropped | `pnpm --filter worker test llm.schema` | THR-002 |
| SEC-012 | The LLM has no tools and no network access beyond the provider call | code review: no `tools` in AI SDK calls (grep in CI) | THR-002 |
| SEC-013 | Hard token budget per PR (default 30k, max output tokens per call set); stop and report skipped sections | `pnpm --filter worker test llm.budget` | THR-011 |

### Secrets & keys
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-020 | LLM keys sealed with the worker's X25519 public key (ADR-008); only ciphertext + last 4 stored | `pnpm --filter convex test keys.sealed` | THR-003 |
| SEC-021 | No query or action ever returns a key or ciphertext to the client | `pnpm --filter convex test keys.notReturned` | THR-003 |
| SEC-022 | Logs redact keys, tokens and `Authorization` headers | `pnpm --filter worker test log.redaction` · `pnpm --filter convex test log.redaction` · `pnpm --filter cli test log.redaction` | THR-003, THR-005, THR-015, THR-023 |
| SEC-023 | Secrets only via platform env (Vercel, Convex, Render); none committed | `gitleaks detect --no-banner` in CI | THR-023 |

### Worker isolation
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-030 | Never follow symlinks outside the clone root; resolve and check every path read | `pnpm --filter engine test fixtures/symlink-escape` | THR-004, THR-018 |
| SEC-031 | Size and time caps: files > 1 MB skipped, ≤ 20k files indexed, job timeout 8 min, LLM off > 2,000 files | `pnpm --filter worker test limits` | THR-007, THR-012 |
| SEC-032 | Never execute repo code: no install, build, scripts or hooks; clone with hooks disabled | grep CI rule for `exec`/`spawn` allow-list (git, rg only; symbols in-process via `@ast-grep/napi`, ADR-016) | THR-004 |
| SEC-033 | Installation token scoped to one repo and minimal permissions; passed via `http.extraHeader`, never in remote URL; not persisted | `pnpm --filter worker test token.scope` | THR-005 |
| SEC-034 | Engine regexes are linear-time (RE2-safe patterns) with per-file time limit | `pnpm --filter engine test redos` | THR-012, THR-020 |
| SEC-035 | Worker accepts only HMAC-signed requests with timestamp ≤ 5 min old | `pnpm --filter worker test auth.hmac` | THR-013 |

### Access control
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-040 | Every dashboard query/mutation derives the GitHub user id from the Clerk JWT and filters by installation ownership (ADR-009); never trusts ids from args alone | `pnpm --filter convex test access.idor` | THR-006, THR-021 |
| SEC-041 | Cross-installation access test exists for every dashboard function | same suite, enumerated per function | THR-006, THR-021 |

### Rate limiting & cost
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-050 | 50 runs/day and 1 concurrent job per installation; newer push supersedes queued run | `pnpm --filter convex test limits` | THR-007 |
| SEC-051 | Render worker instance type and instance count capped; billing notifications on; monthly spend reviewed | manual review (Render dashboard) — candidate to automate | THR-007 |

### Output handling
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-060 | Dashboard renders finding text as plain text; no `dangerouslySetInnerHTML` | eslint `react/no-danger` error | THR-008 |
| SEC-061 | Suggestion fences use a backtick run longer than any in the content | `pnpm --filter engine test suggestion.fence` | THR-009, THR-024 |
| SEC-104 | Repo-derived text in check-run summaries, annotations and review comments is placed in code spans (backtick run longer than the content) or fences; `@` and `#` outside them are escaped; no raw HTML, images or links built from repo text; Unstale's own wording is visually separate from quoted text | `pnpm --filter worker test github.output` incl. mention / image / HTML fixtures | THR-024 |
| SEC-105 | CLI and MCP strip ANSI/OSC escapes and C0/C1 control characters (except newline, tab) from repo-derived text before printing or returning it; CLI colours only its own labels | `pnpm --filter cli test output.sanitize` incl. escape-sequence fixtures | THR-025 |
| SEC-106 | Daily cron deletes `findings` 90 days after their run finished and `localScans` rows idle for 30 days; `deliveries` after 7 days | `pnpm --filter convex test retention` (mocked clock) | THR-026 |

### Auth
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-070 | Clerk middleware protects all `/dashboard` routes; every Convex dashboard function calls `ctx.auth.getUserIdentity()` and rejects null | route test + `pnpm --filter convex test auth.required` | THR-010 |

### Local CLI, MCP and relay
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-090 | CLI tokens: 32 random bytes; Convex stores SHA-256 hash + last 4 only; plaintext returned once by `cliTokens:create`; revocable; max 10 active per user | `pnpm --filter convex test cliTokens.hashOnly` | THR-015 |
| SEC-091 | CLI stores the token only in the OS keychain (`@napi-rs/keyring`) or reads `UNSTALE_TOKEN`; never writes it to a file or prints it; token is write-only (relay ingest), no read scope | `pnpm --filter cli test token.storage` · `pnpm --filter convex test cliTokens.scope` | THR-015 |
| SEC-092 | Relay ingest resolves the user only from the token hash; ignores any user id in the body; rejects revoked/unknown tokens with 401 | `pnpm --filter convex test relay.auth` | THR-016 |
| SEC-093 | Relay ingest: body ≤ 256 KB, ≤ 500 findings, claim ≤ 200 chars, Zod allow-list schema; 60 uploads/hour per token | `pnpm --filter convex test relay.limits` | THR-016 |
| SEC-094 | Upload payload is built from an allow-list of fields (path, line, claimType, claim, rule, status, fixable, repoKey, cliVersion); no file contents; `claim` (≤ 200 chars) is the only doc-derived text; `repoKey` has remote credentials stripped | `pnpm --filter cli test relay.payload` (snapshot test) | THR-017 |
| SEC-095 | `fix` writes only paths whose realpath is inside the repo root; refuses symlinks pointing outside | `pnpm --filter cli test fix.containment` | THR-018 |
| SEC-096 | `fix` writes a hunk only after explicit per-hunk approval and only if the file's SHA-256 matches the scan; writes via temp file + rename | `pnpm --filter cli test fix.approval` | THR-018 |
| SEC-097 | MCP server has no file-write, shell or network code path; CI fails if `apps/cli/src/mcp/**` imports `fs.write*`, `child_process` (except shared `git` runner), `fetch` | `pnpm --filter cli test mcp.noWrite` + import-lint rule | THR-019 |
| SEC-098 | MCP tool path arguments are resolved against the repo root and rejected if outside; doc text in tool results is returned as quoted data with a "data, not instructions" note | `pnpm --filter cli test mcp.paths` | THR-019, THR-025 |
| SEC-099 | CLI never executes repo code; it spawns only `git` with an argument allow-list and `core.hooksPath` disabled | `pnpm --filter cli test spawn.allowlist` + grep CI rule | THR-020 |
| SEC-100 | npm publish only from GitHub Actions via trusted publishing (OIDC) with provenance; no long-lived npm token; 2FA on the npm account; package name `unstale` reserved before launch | CI workflow review at gate; `npm view unstale` shows provenance | THR-022 |
| SEC-101 | CLI coalesces relay uploads: `watch` sends at most one per minute plus one on exit; identical snapshots are not re-sent | `pnpm --filter cli test relay.coalesce` | THR-016 |
| SEC-102 | A repo's `.unstale.yml` can only disable relay (`local.relay: false`); `true` is ignored; global opt-out `UNSTALE_RELAY=0` | `pnpm --filter cli test relay.optIn` | THR-017 |
| SEC-103 | MCP and CLI setup docs pin an exact `unstale@<version>`; no unpinned `npx -y unstale` in docs or examples | grep docs/README at GATE-5 | THR-022 |

### Dependencies
| ID | Rule | Enforcement | Mitigates |
|---|---|---|---|
| SEC-080 | Lockfile committed; high/critical advisories block gates | `pnpm audit --audit-level=high` | THR-014, THR-022 |
| SEC-081 | New dependencies checked for name, maintenance and licence before adding | manual review at gate | THR-014 |

## 4. Secrets inventory

Names only. Never values.

| Name | Purpose | Stored in | Read by | Rotation |
|---|---|---|---|---|
| GITHUB_WEBHOOK_SECRET | verify webhooks | Convex env | COMP-03 | on exposure |
| GITHUB_APP_PRIVATE_KEY | mint installation tokens | Render env or secret file | COMP-04 | yearly; on exposure |
| GITHUB_APP_ID | app identity (not secret) | Render env | COMP-04 | n/a |
| WORKER_URL | worker base URL (not secret) | Convex env | COMP-03 | n/a |
| WORKER_HMAC_SECRET | sign Convex → worker calls | Convex env, Render env | COMP-03, COMP-04 | quarterly |
| KEY_SEAL_PRIVATE_KEY | open sealed LLM keys | Render env | COMP-04 | on exposure (users re-enter keys) |
| KEY_SEAL_PUBLIC_KEY | seal LLM keys (not secret) | Convex env | COMP-03 | with private key |
| CLERK_SECRET_KEY | server-side Clerk | Vercel env | COMP-01 | on exposure |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | client Clerk (public) | Vercel env | COMP-01 | n/a |
| NEXT_PUBLIC_CONVEX_URL | Convex deployment URL (public) | Vercel env | COMP-01 | n/a |
| CLERK_JWT_ISSUER_DOMAIN | Convex auth config (not secret) | Convex env | COMP-03 | n/a |
| CONVEX_DEPLOY_KEY | CI deploys | GitHub Actions secret | CI | on exposure |
| User LLM keys | Judgement + fix text | Convex `llmKeys` (sealed) | COMP-04 | by user |
| CLI tokens | relay uploads | user's OS keychain (plaintext); Convex `cliTokens` (hash) | COMP-08, COMP-03 | by user (revoke + create) |
| UNSTALE_TOKEN | CLI token via env when no keychain (user-side) | user's shell / CI env | COMP-08 | by user |
| UNSTALE_API_URL | relay base URL override, dev only (not secret) | developer shell | COMP-08 | n/a |
| NPM_TOKEN | not used: publish via npm trusted publishing (OIDC) from GitHub Actions | n/a | CI | n/a |

## 5. Gate security checklist

A trigger fires when the gate's changes touch its area; every fired trigger's checks must have evidence. Results `pass` · `fail` · `unknown` with evidence. Planned triggers below; record actual triggers and results in `docs/reviews/GATE-N.md` when each gate runs. A trigger that fires but was not planned is added, never skipped.

| ID | Fires when the change… | Required checks | Guardrails |
|---|---|---|---|
| T1 | adds or changes an endpoint, MCP tool, or auth path | auth required; IDOR / ownership test per function; API.md row with auth tier and guardrails | SEC-001, SEC-035, SEC-040, SEC-041, SEC-070, SEC-092 |
| T2 | adds or changes stored data (table, field, retention) | data classification row in §1; no code or secrets stored; access rule in ARCHITECTURE | SEC-021, SEC-090, SEC-094 |
| T3 | adds, reads or moves a secret, key or token | §4 row (name only); never logged or returned; storage form (sealed / hashed / keychain) tested | SEC-020–023, SEC-033, SEC-090, SEC-091 |
| T4 | parses untrusted input (repo content, request body, webhook, tool args) | Zod schema at the boundary; size/time caps; ReDoS-safe patterns; path containment | SEC-002, SEC-031, SEC-034, SEC-093, SEC-098 |
| T5 | adds or changes an LLM call | data-not-instructions template + injection fixture; output schema + line scope; no tools; token budget | SEC-010–013 |
| T6 | adds or upgrades a dependency | `pnpm audit --audit-level=high` exit 0; name / maintenance / licence review | SEC-080, SEC-081 |
| T7 | renders repo- or user-derived text (dashboard, PR review, terminal) | plain-text rendering; fence / escape test; mention + control-sequence fixtures | SEC-060, SEC-061, SEC-104, SEC-105 |
| T8 | writes files or resolves filesystem paths | realpath inside root; symlink-escape fixture; approval + hash guard for writes | SEC-030, SEC-095, SEC-096 |
| T9 | spawns a process or touches the code-execution boundary | spawn allow-list test; hooks disabled; no repo code run; MCP no-write lint | SEC-032, SEC-097, SEC-099 |
| T10 | adds or changes limits, quotas or anything that costs money | limit tests; supersede / coalesce behaviour; spend alert | SEC-013, SEC-050, SEC-051, SEC-093, SEC-101 |
| T11 | changes CI, build, deploy or publishing | `gitleaks` exit 0; CI runs every gate command; publish via OIDC with provenance; pinned versions in docs | SEC-023, SEC-100, SEC-103 |

### GATE-0 — Setup
- Triggers planned: T3, T6, T11
- Checks: `gitleaks detect` exit 0 (SEC-023); `pnpm audit --audit-level=high` exit 0 (SEC-080); CI runs both.

### GATE-1 — Engine + fixtures
- Triggers planned: T4, T6, T7, T8
- Checks: symlink-escape fixture (SEC-030); ReDoS suite (SEC-034); suggestion fence (SEC-061); size caps (SEC-031).

### GATE-2 — GitHub App PR check (Verified-only)
- Triggers planned: T1, T2, T3, T4, T7, T9, T10
- Checks: webhook signature + replay tests (SEC-001, SEC-002); worker HMAC (SEC-035); token scope, no token in URL/logs (SEC-033, SEC-022); never execute repo code (SEC-032); limits (SEC-050); secrets added to §4; GitHub output escaping: mentions, issue refs, images, HTML (SEC-104, SEC-061); retention cron for `findings` and `deliveries` (SEC-106).

### GATE-3 — LLM layer
- Triggers planned: T2, T3, T4, T5, T10
- Checks: injection fixture (SEC-010); schema + line-scope (SEC-011); no tools (SEC-012); budget (SEC-013); key sealing and never returned (SEC-020, SEC-021); log redaction (SEC-022).

### GATE-4 — Web: landing + dashboard
- Triggers planned: T1, T6, T7
- Checks: auth required (SEC-070); IDOR suite (SEC-040, SEC-041); no `dangerouslySetInnerHTML` (SEC-060).

### GATE-6 — Local CLI, MCP, relay
- Triggers planned: T1, T2, T3, T4, T6, T7, T8, T9, T10, T11
- Checks: token hash-only + scope + storage (SEC-090, SEC-091); relay auth + limits (SEC-092, SEC-093); payload allow-list + credential strip (SEC-094); upload coalescing (SEC-101); repo config can't enable relay (SEC-102); fix containment + approval + hash guard (SEC-095, SEC-096); MCP no-write + path checks (SEC-097, SEC-098); spawn allow-list (SEC-099); ReDoS suite through the local adapter (SEC-034); Local view IDOR (SEC-040, SEC-041); log redaction covers CLI tokens (SEC-022); terminal/MCP output sanitising: ANSI/OSC and control-char fixtures (SEC-105); retention cron for `localScans` (SEC-106).

### GATE-5 — Dogfood + release
- Triggers planned: T6, T10, T11
- Checks: all earlier suites green in CI; Render spend caps set (SEC-051); npm provenance publish (SEC-100); pinned versions in setup docs (SEC-103); `check_security_doc.py` passes; dependency audit (SEC-080, SEC-081).

## 6. Exceptions & accepted risks

Every exception must cite an ADR in DECISIONS.md.

| ID | Waives | Scope | Reason | Compensating control | Decision | Review by |
|---|---|---|---|---|---|---|

(none)

## 7. Incident basics

- Alerts: Render and Convex email to owner; GitHub App webhook delivery failures visible in app settings.
- GitHub App key exposure: generate new key in app settings → update Render env → redeploy → delete old key → review app audit log.
- Seal key exposure: rotate key pair → mark all `llmKeys` invalid → ask users to re-enter → notify users to rotate provider keys.
- Data exposure: identify affected installations → preserve logs → notify installers.
- CLI token store exposure: revoke all `cliTokens` (hashes only, but treat as compromised) → users create new tokens → purge `localScans`.
- npm package compromise: deprecate affected versions → publish fixed version → advisory on GitHub → notify via README and dashboard banner.

## 8. Open questions

- Org-member access (ADR-009) needs its own threat review before enabling.
- (decided 2026-10-17, ADR-017) Retention: `findings` 90 days, idle `localScans` 30 days.
