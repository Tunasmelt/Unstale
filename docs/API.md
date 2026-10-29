---
doc: API
last_verified_commit: none
last_updated: 2026-10-28
owner: Harris Shamsi
openapi_source: none yet — worker (Hono) to export via zod-openapi in P2; Convex functions listed by hand
---

# API

> Part 1 lists what Unstale exposes; all rows are `planned` until their phase's code exists (P2–P6). Part 2 lists external APIs, verified against live docs/registries on 2026-10-15. Never write secret values here.

## Conventions

- **Surfaces:** Convex HTTP actions (GitHub webhook, CLI relay), worker HTTP API (service only), Convex queries/mutations (dashboard; called via the Convex client, not REST), local MCP tools (stdio, COMP-09; no network).
- **Auth tiers:** `public` · `user` (Clerk JWT via Convex) · `service` (HMAC-signed, Convex → worker) · `github` (webhook HMAC) · `cli` (bearer CLI token, write-only to relay) · `local` (stdio child process of the user's agent; no network auth)
- **Errors:** `{ "error": { "code": "string", "message": "string" } }` — no stack traces
- **IDs / dates:** Convex ids; GitHub numeric ids; ISO 8601 UTC
- **Rate-limit tiers:** `install` (50 runs/day, 1 concurrent per installation) · `relay` (60 uploads/hour per CLI token, body ≤ 256 KB) · `default` (Convex built-in) · `none`

## Change policy

- Breaking: changing `.unstale.yml` keys, worker job payload, finding schema, relay snapshot schema, or MCP tool input/output schemas.
- Relay accepts the current and previous snapshot `schemaVersion`; older CLIs get a 426 with an upgrade message.
- `.unstale.yml` carries `version:`; old versions keep working for one minor release with a warning in the check summary.

## Part 1 — Own API

Status: `planned` · `active` · `deprecated` · `retired`

<!-- api-index:start -->
| ID | Method | Path | Summary | Auth | Rate limit | Component | Requirements | Guardrails | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| API-001 | POST | /github/webhook | Receive GitHub App webhooks | github | install | COMP-03 | REQ-001, REQ-002 | SEC-001, SEC-002, SEC-050 | planned | Convex HTTP action; reply 2xx < 10 s |
| API-002 | POST | /jobs/run | Run one PR check | service | none | COMP-04 | REQ-002, REQ-007, REQ-008, REQ-010 | SEC-035, SEC-031, SEC-032, SEC-033, SEC-104 | planned | worker; synchronous, 8 min timeout |
| API-003 | GET | /health | Worker health check | public | none | COMP-04 |  |  | planned |  |
| API-004 | QUERY | installations:listMine | Installations owned by caller | user | default | COMP-03 | REQ-014 | SEC-040, SEC-070 | planned | Convex query |
| API-005 | QUERY | runs:listByInstallation | Recent runs for an installation | user | default | COMP-03 | REQ-014 | SEC-040, SEC-070 | planned | Convex query, paginated |
| API-006 | QUERY | findings:listByRun | Findings for one run | user | default | COMP-03 | REQ-014 | SEC-040, SEC-060, SEC-070 | planned | text only |
| API-007 | MUTATION | llmKeys:set | Seal and store an LLM key | user | default | COMP-03 | REQ-012 | SEC-020, SEC-021, SEC-022, SEC-040 | planned | returns last4 only |
| API-008 | MUTATION | llmKeys:remove | Delete an installation's key | user | default | COMP-03 | REQ-012 | SEC-040, SEC-070 | planned |  |
| API-009 | POST | /local/scans | Upload a local scan snapshot from the CLI | cli | relay | COMP-03 | REQ-027 | SEC-092, SEC-093, SEC-094, SEC-101 | planned | Convex HTTP action; replaces the user's row for that repo |
| API-010 | MUTATION | cliTokens:create | Create a CLI token (plaintext returned once) | user | default | COMP-03 | REQ-027, REQ-028 | SEC-090, SEC-040, SEC-070 | planned | max 10 active |
| API-011 | QUERY | cliTokens:listMine | List caller's CLI tokens (label, last4, dates) | user | default | COMP-03 | REQ-028 | SEC-040, SEC-070 | planned | never returns hash |
| API-012 | MUTATION | cliTokens:revoke | Revoke one CLI token | user | default | COMP-03 | REQ-028 | SEC-040, SEC-070 | planned |  |
| API-013 | QUERY | localScans:listMine | Latest local snapshot per repo for caller | user | default | COMP-03 | REQ-028 | SEC-040, SEC-060, SEC-070 | planned | live via Convex subscription |
| API-014 | MCP | check_docs | Return findings for the repo or given paths | local | none | COMP-09 | REQ-026 | SEC-097, SEC-098, SEC-105 | planned | stdio; read-only |
| API-015 | MCP | propose_fix | Return a unified diff for one finding | local | none | COMP-09 | REQ-026 | SEC-097, SEC-098, SEC-105 | planned | stdio; never writes |
| API-016 | POST | /local/token-check | Confirm a CLI token is active (used by `unstale login`) | cli | relay | COMP-03 | REQ-027 | SEC-090, SEC-092 | planned | Convex HTTP action; returns no data |
<!-- api-index:end -->

### Endpoint notes

- **API-001** — handles `pull_request` (opened, synchronize, reopened), `installation`, `installation_repositories`; ignores other events with 204. Dedupe on `X-GitHub-Delivery`.
- **API-002** — payload: `installationId, repo, prNumber, headSha, baseSha, sealedKey?, config`. Headers: `X-Unstale-Timestamp`, `X-Unstale-Signature`. Returns finding records; never returns tokens.
- **API-009** — header `Authorization: Bearer <cli token>`; body `{ schemaVersion, repoKey, cliVersion, scannedAt, findings[] }` (fields per ARCHITECTURE `localScans`). User resolved from token hash only. Returns `{ ok: true }`; 401 unknown/revoked token, 413 too large, 422 schema, 429 rate limit.
- **API-010** — args `{ label }`; returns `{ token, last4 }` once. Token = 32 random bytes, base64url, prefix `uns_`.
- **API-014** — input `{ paths?: string[] }` (repo-relative); output `{ findings: [{ id, file, line, claimType, claim, rule, status, fixable }] }`. `id` = first 16 hex of SHA-256(`file`, `claimType`, `claim`, `rule`). Paths outside the repo root are rejected.
- **API-015** — input `{ findingId }`; re-scans the finding's file; output `{ diff, file, baseSha256 }`, or error `stale` if the finding no longer exists. The agent applies `diff` with its own edit tool.
- **API-016** — header `Authorization: Bearer <cli token>`, empty body; returns `{ ok: true, last4 }` or 401. Updates `lastUsedAt`; reads nothing else.
- **API-007** — plaintext key arrives in the mutation args, is sealed immediately with `KEY_SEAL_PUBLIC_KEY`, never logged or returned (ADR-008).

## Part 2 — External APIs

Status: `active` · `deprecated` · `removed`

| ID | Provider | Purpose | Component | API version | SDK | Secret | Data sent | Last verified | Status |
|---|---|---|---|---|---|---|---|---|---|
| EXT-01 | GitHub REST + webhooks | Installation tokens, Checks API, PR reviews, webhooks | COMP-06 | `X-GitHub-Api-Version: 2022-11-28` | @octokit/app@16.1.4, @octokit/webhooks@14.2.0 | GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET | finding annotations, suggestion text | 2026-10-15 | active |
| EXT-02 | Convex | Backend, DB, Workpool | COMP-03 | n/a | convex@1.46.0, @convex-dev/workpool@0.4.14 | CONVEX_DEPLOY_KEY | all app data | 2026-10-15 | active |
| EXT-03 | Clerk | Sign-in (GitHub social) | COMP-02 | n/a | @clerk/nextjs@7.9.15 | CLERK_SECRET_KEY | GitHub user id, email | 2026-10-15 | active |
| EXT-04 | LLM providers via Vercel AI SDK | Judgement + fix text | COMP-05 | provider default | ai@7.0.140, @ai-sdk/anthropic@4.0.79, @ai-sdk/openai@4.0.93, @ai-sdk/google@4.0.95 | user keys (sealed) | doc sections + related code snippets | 2026-10-15 | active |
| EXT-05 | Render | Worker hosting (Docker web service, ADR-018) | COMP-04 | n/a | none | none | none | 2026-10-18 | active |
| EXT-06 | Vercel | Web hosting | COMP-01 | n/a | next@16.4.1 | none | none | 2026-10-15 | active |
| EXT-07 | Model Context Protocol (stdio) | Local MCP server for coding agents | COMP-09 | spec 2025-11-25 (SDK default); 2026-07-28 tracked | @modelcontextprotocol/sdk@1.32.1 | none | findings + diffs to the local agent only | 2026-10-17 | active |
| EXT-08 | OS keychain (macOS Keychain, Windows Credential Manager, Secret Service) | Store CLI token | COMP-08 | n/a | @napi-rs/keyring@2.1.1 | CLI tokens | CLI token | 2026-10-17 | active |
| EXT-09 | npm registry | Publish `unstale` CLI | COMP-08 | n/a | none | none (OIDC trusted publishing) | package tarball | 2026-10-17 | active |
| EXT-10 | markdown-it | Markdown parsing and source maps | COMP-07 | token/ruler API | markdown-it@15.0.3 | none | none (in-process) | 2026-10-28 | active |

### EXT-10 — markdown-it
- **Docs used:** https://markdown-it.github.io/markdown-it/ · installed package TypeScript definitions (`dist/markdown-it.d.mts`).
- Exact version 15.0.3, MIT licence, maintained upstream `markdown-it/markdown-it`; native TypeScript declarations included. No extra type dependency. Dependency install used `--ignore-scripts`; audit at high threshold exits 0 (two existing moderate advisories).
- Uses block `Token.map` plus public inline ruler APIs (`enableOnly`, `getRules`, `before`, `at`) to retain source offsets; never renders HTML or executes document content.

### EXT-01 — GitHub
- **Docs used:** https://docs.github.com/en/rest/about-the-rest-api/api-versions · https://docs.github.com/en/rest/checks/runs · https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api · https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app · https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks
- **What we call:** `POST /app/installations/{id}/access_tokens` (scoped to one repo), `POST /repos/{o}/{r}/check-runs`, `PATCH .../check-runs/{id}` (append annotations), `POST /repos/{o}/{r}/pulls/{n}/reviews` with suggestion comments.
- **Limits:** installation 5,000–12,500 req/h; 50 annotations per request; summary/text ≤ 65,535 chars; token expires after 1 h; webhook reply within 10 s.
- **Timeout / retries:** 20 s per call; 3 retries with backoff on 5xx/secondary rate limit.
- **Failure behavior:** run marked `failed`; check run (if created) set to `neutral` with an error summary.
- **Gotchas:** version `2026-03-10` also exists; `2022-11-28` supported until 2028-03-10 — migrate before then.

### EXT-02 — Convex
- **Docs used:** https://docs.convex.dev/production/state/limits · https://cdn.jsdelivr.net/npm/@convex-dev/workpool@0.4.14/README.md · https://docs.convex.dev/auth/clerk
- **What we call:** HTTP actions, queries, mutations, Workpool `enqueueAction`, crons.
- **Limits:** Node actions 10 min / 512 MiB; documents ≤ 1 MiB; free plan 8 concurrent scheduled jobs.
- **Gotchas:** worker work stays outside Convex (ADR-003).

### EXT-03 — Clerk
- **Docs used:** https://docs.convex.dev/auth/clerk
- **What we call:** `ClerkProvider`, `useAuth`, `ConvexProviderWithClerk`; `auth.config.ts` with `CLERK_JWT_ISSUER_DOMAIN`, `applicationID: "convex"`; custom session claim `github_user_id`.
- **Gotchas:** `ClerkProvider` must wrap the Convex provider.

### EXT-04 — LLM providers
- **Docs used:** https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- **What we call:** `generateText({ output: Output.object({ schema }) })` at temperature 0.
- **Limits:** 30k tokens per PR (our cap); provider limits per user key.
- **Failure behavior:** Judgement skipped, Verified findings still posted; summary says why.
- **Gotchas:** default model IDs per provider to be pinned in P3 against live provider docs (PRODUCT OQ-2). Re-verify every 30 days.

### EXT-07 — Model Context Protocol
- **Docs used:** https://modelcontextprotocol.io/specification/2026-07-28/changelog
- **What we call:** `McpServer` + `StdioServerTransport`; two tools with Zod input/output schemas.
- **Gotchas:** 2026-07-28 removes the `initialize` handshake, replaces server-initiated elicitation with MRTR, deprecates Roots and Sampling — we use none of them. Tool annotations are hints only; safety comes from having no write path (SEC-097).

### EXT-08 — OS keychain
- **What we call:** `Entry('unstale', 'cli-token')` get/set/delete.
- **Failure behavior:** no keychain (headless Linux) → refuse to store; tell user to set `UNSTALE_TOKEN`.

### EXT-09 — npm registry
- **What we call:** `npm publish --provenance` from GitHub Actions with OIDC trusted publishing.
- **Gotchas:** reserve the `unstale` name in P0.
