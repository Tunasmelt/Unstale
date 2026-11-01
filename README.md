# Unstale

**Docs that stay true.** Unstale flags the lines in your docs that your code changes made false, and offers one-click fixes. It runs on every PR and, optionally, while you code.

> **Status: pre-alpha.** The engine is being built (phase P1). There is no GitHub App, dashboard or npm release yet. Progress: [docs/HANDOFF.md](docs/HANDOFF.md).

## Why

Coding agents change code faster than anyone updates the docs. A stale `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md` or README sends the next agent run confidently down the wrong path. Catching that only at PR time is late, because the agent has already worked from the false doc for the whole session.

## How it works

Unstale reads any markdown file and pulls out checkable claims: inline code spans, relative links and anchors, `@imports`, and commands in shell code blocks. Plain prose is never parsed for claims. It then checks each claim against the repo at that commit.

| Claim type | Example of drift it catches |
|---|---|
| path | doc names `src/auth.ts`, the file was moved |
| command | doc says `pnpm test:e2e`, the script no longer exists |
| package manager | doc says `npm install`, the repo uses pnpm |
| version / tool | doc says Node 18, `engines` now says ≥ 20 |
| identifier | doc names a function that was renamed |
| route | doc lists an endpoint the server no longer serves |
| count | "three services" when there are now four |
| link | relative link or anchor that no longer resolves |

Every finding is labelled:

- **Verified**: a deterministic check proved it. Only these can fail a check, and only if you turn that on.
- **Judgement**: an LLM flagged meaning-level drift, using your own API key. Judgement findings never block.

## Surfaces (v1, planned)

| Surface | What it does |
|---|---|
| **GitHub App** (primary) | A check run on every PR, with annotations on the exact doc lines and review suggestion blocks you commit in one click. The App never writes to your repo. |
| **Dashboard** | Your installations, recent runs and findings, and the field for your LLM key. |
| **CLI + MCP** (optional) | npm package `unstale`: `check` scans once, `watch` re-checks on save, `fix` applies approved hunks, `mcp` lets coding agents query findings. Works offline with no account and uploads nothing unless you log in. |

Configuration lives in `.unstale.yml` and is shared by the App and the CLI.

## Privacy and security

- The GitHub App asks only for `contents:read`, `pull_requests:write`, `checks:write` and `metadata:read`.
- Repo code is never executed: no installs, builds, scripts or git hooks.
- Clones are deleted when each job ends. Only finding records are stored, and they are deleted after 90 days.
- LLM keys are sealed, never logged and never sent back to the browser.
- The CLI never calls an LLM. Relay to the dashboard is opt-in and sends finding records, never code.

Threat model and guardrails: [docs/SECURITY.md](docs/SECURITY.md).

## Repository layout

| Path | Component |
|---|---|
| `packages/engine` | Claim extraction and verification, pure TypeScript |
| `apps/worker` | Clones a PR and runs the engine (Hono, Docker, on Render) |
| `apps/web` | Landing page and dashboard (Next.js on Vercel, Clerk sign-in) |
| `apps/cli` | The `unstale` CLI and MCP server |
| `convex` | Backend: webhooks, job queue, findings, retention |
| `docs` | Product, architecture, security, API and phase plans |
| `scripts` | Doc consistency checkers |

## Development

Requires Node ≥ 20, pnpm 10 and Python 3 (for the doc checks).

```bash
pnpm install
```

```bash
pnpm -r lint && pnpm -r typecheck
```

```bash
pnpm -r test
```

```bash
pnpm check:docs
```

Contribution rules, including what agents may never do: [CLAUDE.md](CLAUDE.md) (Codex: [AGENTS.md](AGENTS.md)).

## Docs

| Doc | Contents |
|---|---|
| [PRODUCT](docs/PRODUCT.md) | Problem, scope, requirements (REQ-) |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Components (COMP-), flows, data model |
| [SECURITY](docs/SECURITY.md) | Threats (THR-), guardrails (SEC-), gate checklists |
| [API](docs/API.md) | Endpoints (API-), external APIs (EXT-) |
| [DECISIONS](docs/DECISIONS.md) | Architecture decision records (ADR-) |
| [PHASES](docs/PHASES.md) | Build phases P0–P6 and their gates |
| [SETUP](docs/SETUP.md) | Owner runbook: npm, GitHub App, Render |
| [CHANGELOG](docs/CHANGELOG.md) | What changed, by date |

## License

MIT
