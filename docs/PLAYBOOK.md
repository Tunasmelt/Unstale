# Playbook — project lessons (itemized, delta-updated)

<!-- Format: - [L-n] <non-obvious project fact + the command that works> (yyyy-mm-dd). Edit in place; mark wrong ones (retired). Injected at session start (last 8). -->
- [L-1] Combined check command exits 1 while lint/types/tests/check:docs all pass → `gitleaks` is not installed on this Windows machine, so `which gitleaks` fails at the end of the chain → run checks as separate commands (`pnpm -r test`, `pnpm -r lint && pnpm -r typecheck`, `pnpm check:docs`); owner installs gitleaks (unverified: `choco install gitleaks`) before `gitleaks detect --no-banner` (2026-10-29)
