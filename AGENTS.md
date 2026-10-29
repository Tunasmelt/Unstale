# Unstale agent entry point

Read `CLAUDE.md`, `docs/HANDOFF.md` and `docs/PHASES.md` before working. `CLAUDE.md` contains the shared project rules, commands and product invariants; apply them in Codex too. Check claims in code before relying on documentation.

The executable hooks in `.claude/settings.json` integrate with Claude Code only. In Codex, branch policy, secret hygiene, hard stops and session handoff are instruction-based; these hooks do not intercept Codex tools. Never claim hook enforcement for a Codex session.

- Before code changes, create a `feat/` or `fix/` branch. Never discard existing uncommitted work.
- Never read or print `.env*` values. Inspect names only. Ask before a protected-branch push, destructive operation, production deployment or package publication, as listed in `CLAUDE.md`.
- Run `node .claude/harness/harness.mjs doctor` and `selftest` after harness edits. They are explicit diagnostic commands, not tool interceptors.
- Use `.claude/skills/brief/SKILL.md` for new features and `.claude/skills/gate-review/SKILL.md` when reviewing a gate. Update HANDOFF with evidence at the end of work; automatic Claude Stop hooks do not do this for Codex.

Instruction discovery reference: https://learn.chatgpt.com/docs/agent-configuration/agents-md
