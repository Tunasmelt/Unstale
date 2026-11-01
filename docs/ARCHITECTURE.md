---
doc: ARCHITECTURE
last_verified_commit: a37f180
last_updated: 2026-10-28
owner: Harris Shamsi
status: draft
---

# Architecture — Unstale v1

> One engine, two entry points. PR checks start from a GitHub webhook, run in a worker against that exact commit, and land on GitHub as annotations and suggestions. Local checks run the same engine in the `unstale` CLI on the user's machine, report in the terminal or to a coding agent over MCP, and optionally relay finding records to the dashboard. Nothing writes without the user's approval.

## Components

| ID | Component | Tech | Runs on | Responsibility |
|---|---|---|---|---|
| COMP-01 | Web app | Next.js 16 (App Router) | Vercel | Landing page; dashboard (installations, runs, findings, key field, Local view, CLI tokens) |
| COMP-02 | Auth | Clerk (`@clerk/nextjs`) with GitHub social login; Convex via `ConvexProviderWithClerk` | Clerk | Sign-in; session JWT carries the user's GitHub user id as a custom claim |
| COMP-03 | Backend | Convex (HTTP actions, queries, mutations, Workpool, crons, database) | Convex cloud | Webhook intake, job queue, run limits, findings store, sealed LLM keys, CLI token store, local-scan relay ingest |
| COMP-04 | Worker | Node 22 + TypeScript HTTP service (Hono) with `git`, `ripgrep` in the image; symbols via `@ast-grep/napi` (ADR-016) | Render (Docker web service, ADR-018) | Clone at commit, build repo index, run engine, call LLM, post check run + review to GitHub, delete clone |
| COMP-05 | LLM layer | Vercel AI SDK (`ai` v7) with Anthropic / OpenAI / Google providers | Inside COMP-04 only | Judgement pass on affected sections; fix text; structured output only |
| COMP-06 | GitHub integration | GitHub App; Octokit (`@octokit/app`, `@octokit/webhooks`) | GitHub ↔ COMP-03/04 | Webhooks in; installation tokens; Checks API and pull request reviews out |
| COMP-07 | Engine | `packages/engine` (pure TypeScript, no Node-only APIs in core) | COMP-04, COMP-08; browser in v1.1 | Markdown parse, claim extraction, classification, verification, edit-mode resolution, fix generation |
| COMP-08 | CLI | `apps/cli`, npm package `unstale`, Node ≥ 20, `commander`, Node `fs.watch({ recursive: true })`, `@napi-rs/keyring`, `diff`, `@ast-grep/napi` | User's machine | `check`, `watch`, `fix`, `login`/`logout`; local file adapter for the engine; relay upload |
| COMP-09 | MCP server | `@modelcontextprotocol/sdk`, stdio transport, started by `unstale mcp` | User's machine (child process of the coding agent) | Tools `check_docs` (read-only) and `propose_fix` (returns diff, never writes) |

## Repo layout

```
unstale/
  apps/web/            COMP-01 Next.js
  apps/worker/         COMP-04 worker service + Dockerfile
  apps/cli/            COMP-08 CLI + COMP-09 MCP server (one npm package: unstale)
  packages/engine/     COMP-07 engine + fixtures/ + adapters (clone, local)
  convex/              COMP-03 schema, functions, http.ts
  docs/                this doc set
  .unstale.yml         dogfooding config
```

pnpm workspaces; TypeScript strict everywhere; Zod for every boundary.

## Flow A — one PR check

1. GitHub sends `pull_request` to `POST /github/webhook` (Convex HTTP action, API-001).
2. COMP-03 verifies `X-Hub-Signature-256`, de-duplicates on `X-GitHub-Delivery`, checks limits (REQ-016), records a `runs` row `queued`, cancels any older queued run for the same PR, replies 2xx within 10 s.
3. A Workpool action (pool `checks`, `maxParallelism` set globally; per-installation concurrency 1 enforced in the enqueue mutation) calls the worker `POST /jobs/run` (API-002) synchronously (8 min worker timeout under the 10 min action limit, ADR-010) with an HMAC-signed payload: installation id, repo, PR number, head SHA, base SHA, sealed LLM key (if any), config overrides.
4. COMP-04 mints an installation token scoped to that one repo, clones at head SHA (shallow + enough history for rename detection on changed docs), never runs repo code.
5. COMP-07 builds the index through the clone adapter (file tree, manifests, lockfiles, git renames, `@ast-grep/napi` symbols) and verifies claims → Verified findings.
6. If a sealed key is present and repo ≤ 2,000 files: COMP-05 runs the Judgement pass on doc sections mentioning changed files, within 30k tokens, and writes fix text.
7. COMP-04 posts one check run (annotations batched 50/request) and one PR review with suggestion blocks, then deletes the clone.
8. COMP-04 returns the finding records to the Workpool action, which writes them to `findings` and marks the run `done` / `failed`.

Worker holds no Convex credentials; all writes to Convex go through the action that called it.

## Flow B — local detection

1. `unstale watch` (or `check`) finds the repo root (nearest `.git`), loads `.gitignore` and `.unstale.yml`, and builds the index through the **local file adapter** (working-tree files, `git` CLI for renames and ignore rules, `@ast-grep/napi` symbols in-process; spawns only `git`). `repoKey` is derived from the git remote with any `user:password@` part stripped.
2. Full scan on start → findings printed in the terminal.
3. `fs.watch` events are debounced (~1 s after the last change). The engine re-checks changed docs plus docs whose claims reference changed paths (reverse claim index kept in memory).
4. If logged in (`unstale login`) and relay is not disabled, the CLI uploads a snapshot to `POST /local/scans` (API-009). Uploads are coalesced: `watch` sends at most one per minute plus one on exit, and skips a snapshot identical to the last one sent (SEC-101). Each upload goes with `Authorization: Bearer <cli token>`. COMP-03 hashes the token, checks it is active, rate-limits, validates the allow-listed schema, and replaces that user's `localScans` row for the repo. The dashboard Local view updates live through a Convex query.
5. `unstale fix` re-runs the scan, shows each fixable finding as a diff, writes only approved hunks after checking the file hash still matches the scan, and stays inside the repo root.

## Flow C — coding agent over MCP

1. The agent starts `npx -y unstale@<pinned version> mcp` as a stdio child process (configured once per client; setup docs always pin a version, SEC-103).
2. `check_docs({ paths? })` runs Flow B steps 1–3 once and returns findings as structured content; doc text is returned as quoted data. Each finding `id` is the first 16 hex chars of SHA-256(`file`, `claimType`, `claim`, `rule`), so it survives line shifts.
3. `propose_fix({ findingId })` re-scans that finding's file, locates it by `id` (error `stale` if gone), and returns a unified diff plus the file's SHA-256. The server has no write path; the agent applies the diff with its own edit tool, so the user approves it in the agent's UI (ADR-013).

## Data model (Convex)

| Table | Key fields | Notes |
|---|---|---|
| `installations` | `githubInstallationId`, `accountLogin`, `installerGithubUserId`, `repos[]`, `blockingMode` | from `installation` / `installation_repositories` webhooks |
| `llmKeys` | `installationId`, `provider`, `model`, `sealedKey`, `last4`, `updatedAt` | sealed with worker public key; plaintext never stored |
| `runs` | `installationId`, `repo`, `prNumber`, `headSha`, `status`, `startedAt`, `finishedAt`, `skipped[]`, `tokensUsed` | `queued · running · done · failed · superseded · limited` |
| `findings` | `runId`, `file`, `line`, `claimType`, `claim`, `verdict`, `source` (`verified`/`judgement`), `fixText?`, `editMode` | no source code stored; deleted 90 days after the run finished (ADR-017) |
| `deliveries` | `deliveryId`, `receivedAt` | webhook replay guard; pruned after 7 days |
| `usage` | `installationId`, `day` (UTC date), `runCount` | 50/day limit, resets 00:00 UTC |
| `cliTokens` | `githubUserId`, `tokenHash` (SHA-256), `last4`, `label`, `createdAt`, `lastUsedAt`, `revokedAt?` | plaintext shown once at creation; max 10 active per user |
| `localScans` | `githubUserId`, `repoKey`, `scannedAt`, `cliVersion`, `findings[]` (≤ 500: `file`, `line`, `claimType`, `claim` ≤ 200 chars, `rule`, `status`, `fixable`) | one row per user + repo, replaced on each upload; no history; no code; `claim` is the only doc-derived text; deleted after 30 days without an upload (ADR-017) |

Retention: one daily cron prunes `deliveries` (7 days), `findings` (90 days) and idle `localScans` (30 days) (ADR-017, SEC-106).

`repoKey` = normalised git remote (`github.com/owner/repo`, credentials stripped) or `local/<folder name>` when no remote.

Access rule: every dashboard query resolves the caller's GitHub user id from the Clerk JWT and returns only installations where `installerGithubUserId` matches, and only `cliTokens` / `localScans` rows with the same `githubUserId` (ADR-009). The relay endpoint resolves the user only from the token hash, never from the request body.

## Engine (COMP-07)

| Stage | What it does |
|---|---|
| Parse | `markdown-it` tokens with line maps |
| Extract | inline code, relative links/anchors, `@imports`, shell-fence command lines |
| Classify | path · command · package manager · version/tool · identifier · route · count · link |
| Verify | against the repo index; path suffix variants; git renames (>50% similarity) |
| Guard | skip negations, examples, create-file lines, placeholders, URLs, gitignored, common words, changelog/ADR deprecations |
| Mode | `heal:` frontmatter → `.unstale.yml` → history inference (append-only files, ADR `status:`) → propose |
| Fix | deterministic replacement when unambiguous; else hand to COMP-05 for text (PR check only) |

Core is pure TypeScript with an injected `RepoIndex` interface. Adapters: `CloneRepoIndex` (worker), `LocalRepoIndex` (CLI), browser adapter in v1.1. Both v1 adapters extract symbols with `@ast-grep/napi` (ADR-016). The same fixture suite runs against both v1 adapters (REQ-029).

Implementation status (2026-10-28): `extractClaims(markdown, file)` in `packages/engine/src/extract.ts` uses markdown-it 15.0.3 block maps and inline rule source offsets. It returns candidate `{ file, line, source, text }` records, never Verified findings. Input over 1 MB UTF-8 throws `RangeError`; nesting is capped at 20. No file/process/network access. Adapters, verification, suppression, edit modes and fixes remain planned. A hard per-file execution deadline is not implemented by this synchronous extractor and remains a GATE-1 security gap.

## CLI commands (COMP-08 / COMP-09)

| Command | Behaviour | Network |
|---|---|---|
| `unstale check [--json] [--fail]` | one scan of the working tree | relay upload only if logged in |
| `unstale watch` | full scan, then debounced re-checks on change | relay upload only if logged in |
| `unstale fix` | interactive diff per fixable finding; writes approved hunks | none |
| `unstale login` / `logout` | store / delete the CLI token in the OS keychain | validates token once via `POST /local/token-check` (API-016) |
| `unstale mcp` | stdio MCP server (`check_docs`, `propose_fix`) | none |

## `.unstale.yml`

```yaml
version: 1
blocking: neutral          # neutral | fail-on-verified
llm:
  tokenBudget: 30000
  model: default           # or a provider model id
ignore:
  paths: ["examples/**"]
  rules: []
modes:
  "docs/DECISIONS.md": append-only
  "docs/CHANGELOG.md": append-only
  "docs/PRODUCT.md": flag-only
local:
  relay: false             # a repo may only turn relay OFF; `true` is ignored (SEC-102). Default: on when logged in; UNSTALE_RELAY=0 disables for all repos
  debounceMs: 1000
```

## Environments & deployment

| Env | Web | Convex | Worker | GitHub App | CLI |
|---|---|---|---|---|---|
| dev | `localhost:3000` | dev deployment | local Docker, exposed via tunnel | `unstale-dev` app | `pnpm --filter cli dev`, `UNSTALE_API_URL` → dev Convex site |
| prod | Vercel `unstale.dev`, `app.unstale.dev` | prod deployment | Render web service | `unstale` app | npm `unstale` (provenance-signed publish from CI) |

Secrets per env are listed in SECURITY.md §4 (names only).

## Source-of-truth rules

| Fact | Source of truth |
|---|---|
| Requirements | PRODUCT.md |
| Components, data model, flows | this file |
| Decisions | DECISIONS.md (append-only) |
| Threats, guardrails, secrets | SECURITY.md |
| Endpoints, MCP tools, external APIs | API.md |
| Phase status, next action | PHASES.md, HANDOFF.md |
| Runtime config per repo | `.unstale.yml` in that repo |
| LLM keys | Convex `llmKeys` (sealed) only |
| CLI tokens | Convex `cliTokens` (hash only); plaintext only in the user's OS keychain |
