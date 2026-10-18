---
doc: DECISIONS
last_verified_commit: none
last_updated: 2026-10-18
owner: Harris Shamsi
---

# Decisions

> Append-only. Never edit an accepted ADR; supersede it with a new one and set the old status to `superseded by ADR-NNN`.

| ADR | Title | Status | Date |
|---|---|---|---|
| ADR-001 | Document-agnostic claims, no framework adapters | accepted | 2026-10-12 |
| ADR-002 | GitHub App PR check is v1; local mode v1.1; benchmark v1.2 | superseded by ADR-012 | 2026-10-14 |
| ADR-003 | Stack: Next.js + Convex + Clerk + Railway worker, TypeScript throughout | accepted; worker host superseded by ADR-018 | 2026-10-14 |
| ADR-004 | Deterministic first; LLM for Judgement and fix text only | accepted | 2026-10-14 |
| ADR-005 | Bring-your-own LLM key via Vercel AI SDK | accepted | 2026-10-14 |
| ADR-006 | Nothing writes silently: fixes are PR suggestions only | accepted | 2026-10-14 |
| ADR-007 | Neutral check by default; optional fail on Verified only | accepted | 2026-10-14 |
| ADR-008 | LLM keys sealed with the worker's public key | accepted | 2026-10-15 |
| ADR-009 | Dashboard access = installing GitHub user (v1) | accepted | 2026-10-15 |
| ADR-010 | Worker called synchronously from a Workpool action | accepted | 2026-10-15 |
| ADR-011 | MIT licence, open source | accepted | 2026-10-14 |
| ADR-012 | Web-first with an optional local CLI; v1 = PR check + CLI + MCP + relay | accepted | 2026-10-17 |
| ADR-013 | Local fixes need explicit approval; MCP proposes, never writes; dashboard is view-only for local | accepted | 2026-10-17 |
| ADR-014 | CLI relay auth: dashboard-created tokens, hashed at rest, OS keychain on device | accepted | 2026-10-17 |
| ADR-015 | MCP server: local stdio only, official TypeScript SDK | accepted | 2026-10-17 |
| ADR-016 | Symbol extraction via `@ast-grep/napi` in both adapters | accepted | 2026-10-17 |
| ADR-017 | Data retention: findings 90 days, idle local snapshots 30 days | accepted | 2026-10-17 |
| ADR-018 | Worker hosted on Render instead of Railway | accepted | 2026-10-18 |

---

## ADR-001 — Document-agnostic claims, no framework adapters
- **Context:** Spec frameworks (Spec Kit, Kiro, OpenSpec, BMAD, Agent OS) all name files differently; DocGuard already covers a fixed canonical doc set.
- **Decision:** Extract checkable claims from any markdown and verify them; choose edit behaviour per file via edit modes, not via framework adapters.
- **Consequences:** Works on any repo; per-file safety (append-only, flag-only) must be inferred or tagged.

## ADR-002 — Scope sequencing
- **Status:** superseded by ADR-012 (2026-10-17).
- **Decision:** v1 = GitHub App PR check with LLM. v1.1 = browser local mode + rolling heal PR. v1.2 = public benchmark, leaderboard, badges. GitHub only.
- **Consequences:** 2–3 weekend budget; fallback ship point is Verified-only.

## ADR-003 — Stack
- **Options considered:** Supabase (excluded by owner), Firebase/Firestore (weak for aggregation), Neon + Inngest, Cloudflare, Python-first, self-hosted.
- **Decision:** Next.js on Vercel, Convex (webhooks, Workpool, crons, data), Clerk sign-in, TypeScript worker on Railway.
- **Why:** One language; Convex covers webhook + queue + live dashboard; Convex actions can't run git/ast-grep and cap at 10 min / 512 MiB (Node), so repo work lives in a container.
- **Consequences:** Two compute vendors; TypeScript engine reusable in browser (v1.1).

## ADR-004 — Deterministic first
- **Decision:** Verified findings come only from deterministic checks. The LLM writes fix text and flags meaning-level drift in sections mentioning changed files, labelled Judgement. Judgement never blocks and is never the only evidence for a Verified finding.
- **Why:** Doc-to-code LLM tracing reaches ~0.80 F1 but recall 47–75%; reproducibility matters for trust.

## ADR-005 — Bring your own key
- **Decision:** Users supply Anthropic, OpenAI or Google keys; Vercel AI SDK `generateText` with `Output.object` for structured output. Without a key, LLM features are off.
- **Why:** No revenue; the project must not pay for strangers' tokens.

## ADR-006 — Nothing writes silently
- **Decision:** App permissions exclude `contents:write`. Fixes are review suggestions the user commits.
- **Consequences:** Rolling heal PR (needs write) waits for v1.1 with its own ADR.

## ADR-007 — Blocking behaviour
- **Decision:** Check conclusion `neutral` by default; `.unstale.yml blocking: fail-on-verified` sets `failure` when Verified errors exist.

## ADR-008 — Sealed LLM keys
- **Context:** Grilling Q1 chose "encrypted in Convex, decrypted only in the worker". AES-GCM with a Convex-held secret would let Convex decrypt too.
- **Decision:** Seal keys with the worker's X25519 public key (libsodium sealed box). Convex stores only ciphertext + last 4 chars; only the worker holds the private key. Plaintext passes through one mutation's arguments transiently and is never logged or returned.
- **Consequences:** Rotating the worker key pair requires users to re-enter keys (acceptable in v1).

## ADR-009 — Dashboard access model
- **Decision:** v1 shows an installation only to the GitHub user who installed it (`installation.sender.id`), matched to a `github_user_id` claim in the Clerk session token.
- **Consequences:** Other org members can't see runs in v1 (PRODUCT OQ-1). Revisit with org membership checks.

## ADR-010 — Worker invocation
- **Decision:** A Convex Workpool action calls the worker over HTTPS (HMAC-signed), waits for the result (worker job timeout 8 min, under the action limit), then writes findings via mutation. Per-installation concurrency of 1 is enforced in the enqueue mutation.
- **Why:** Keeps Workpool retries/status; the worker needs no Convex credentials.

## ADR-011 — Licence
- **Decision:** MIT.

## ADR-012 — Web-first with an optional local CLI
- **Context:** Scope corrected on 2026-10-17: Unstale must also detect drift while the user works locally, not only on PRs. Earlier stance was "strictly web-based, no local CLI". A browser tab alone can't watch reliably (`FileSystemObserver` is experimental, Chromium-only) and can't see agent edits when closed.
- **Options considered:** browser tab polling; `npx` CLI watcher; CLI relaying to dashboard; dashboard reading a localhost server (Drizzle Studio pattern — rejected: Chrome 142 Local Network Access prompt, Safari/Brave block localhost); agent hooks; MCP server; editor extension; language server; pre-commit hook.
- **Decision:** The GitHub App and dashboard remain the product. v1 adds one optional npm package `unstale` with `check`, `watch`, `fix`, `login`, `mcp`, and a relay of finding records to the dashboard. Local checks are Verified-only. v1.1: browser local mode, agent hooks and pre-commit via `unstale init`, local LLM, rolling heal PR. v1.2: editor extension/LSP, benchmark, badges. GitHub only.
- **Consequences:** Budget 5 weekends. Cut order if late: relay, then MCP; PR check and CLI always ship. Engine must keep the injected `RepoIndex` boundary (new `LocalRepoIndex`). New surfaces get threat rows (THR-015…THR-020).

## ADR-013 — Local fix rule
- **Context:** ADR-006 covers the GitHub App. Locally there are three surfaces that could write: CLI, MCP, dashboard. MCP tool annotations are hints only; MCP 2026-07-28 replaced server-initiated elicitation with MRTR, so per-call confirmation is not portable across clients. A dashboard "Apply" button would make the cloud a write channel into the user's machine.
- **Decision:** `watch`/`check` only report. `unstale fix` writes only hunks the user approves in the terminal, only inside the repo root, and only if the file hash matches the scan. MCP exposes `check_docs` (read) and `propose_fix` (returns a diff) and has no write code path; the agent applies diffs with its own approval UI. The dashboard Local view is view-only with a "copy fix command" button.
- **Consequences:** No server-to-device commands exist. Agent hooks (v1.1) also report only.

## ADR-014 — CLI relay authentication
- **Context:** Clerk Device Authorization Grant shipped 2026-09-08, but its docs don't confirm a token format Convex can verify. Owner chose the simpler path.
- **Decision:** The dashboard creates a CLI token (32 random bytes, shown once). Convex stores only its SHA-256 hash and last 4 chars. The token can only call the relay ingest endpoint; it can't read data. Users list and revoke tokens in the dashboard (max 10 active). The CLI stores it with `@napi-rs/keyring` in the OS keychain; if no keychain is available it refuses to store and asks for `UNSTALE_TOKEN` in the environment.
- **Consequences:** Copy/paste step at login. Revisit device grant in v1.1 (PRODUCT OQ-4).

## ADR-015 — MCP server shape
- **Decision:** Local stdio transport only (no HTTP listener, no network), built on the official `@modelcontextprotocol/sdk`. Two tools, deterministic output, doc text returned as quoted data. No Sampling, Roots or elicitation dependency (Roots and Sampling are deprecated in spec 2026-07-28); paths are tool arguments.
- **Consequences:** Works with any stdio MCP client (Claude Code, Cursor, Codex, Gemini CLI). Re-check SDK spec support when spec 2026-07-28 adoption settles.

## ADR-016 — Symbol extraction via `@ast-grep/napi`
- **Context:** The worker indexed identifiers by spawning the `ast-grep` binary, while the CLI may spawn only `git` (SEC-099). Identifier claims would then verify differently per adapter, breaking REQ-029.
- **Options considered:** bundle the `ast-grep` binary in the CLI (adds a second spawned binary); pure-TypeScript symbol extraction (lower accuracy, more code to own); `@ast-grep/napi` in-process in both adapters.
- **Decision:** Both `CloneRepoIndex` and `LocalRepoIndex` extract symbols in-process with `@ast-grep/napi`. The worker no longer spawns `ast-grep`; its spawn allow-list is `git` and `rg`. Engine core stays pure TypeScript: symbol extraction sits behind the `RepoIndex` interface.
- **Consequences:** Native prebuilt binaries ship in the npm package (platforms without a prebuild get no identifier checks, reported in the summary). The v1.1 browser adapter needs a WASM symbol extractor. One extractor, one fixture expectation.

## ADR-017 — Data retention
- **Context:** `findings` and `localScans` hold short doc-derived text (claims, fix text) with no expiry; SECURITY §8 left retention open.
- **Decision:** One daily Convex cron deletes `findings` whose run finished more than 90 days ago and `localScans` rows not updated for 30 days. `runs` rows stay as metadata (status, counts, timestamps). `deliveries` keep their 7-day prune.
- **Consequences:** Dashboard history shows findings for the last 90 days only; a repo not scanned locally for 30 days drops off the Local view until the next upload. The privacy policy (REQ-015) states both periods.

## ADR-018 — Worker on Render
- **Context:** Owner uses Render, not Railway. ADR-003's reason for a container host (git, ripgrep, native `@ast-grep/napi`, jobs up to 8 min) still holds; only the host changes.
- **Decision:** COMP-04 runs as a Render **web service** (Docker runtime, image built from `apps/worker/Dockerfile`), reachable over HTTPS by the Convex Workpool action (ADR-010). Secrets live in Render environment variables; the GitHub App private key may be a Render secret file. Everything else in ADR-003 stands.
- **Consequences:** Render's free instances sleep when idle, so the first PR check after a quiet period waits for a cold start; acceptable in dev, a paid instance is chosen before launch (PRODUCT OQ-3). Health check uses `GET /health` (API-003). Railway rows in SECURITY and API become Render.
