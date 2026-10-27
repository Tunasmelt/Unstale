---
name: close
description: End-of-session bookkeeping — overwrite docs/HANDOFF.md, append CHANGELOG/DECISIONS only when earned, report verification grades. Use at the end of any session that changed code, or when the user says /close, "wrap up", or "end session".
---

# /close — leave the next session a true starting point

Bookkeeping only. Check once, report, no verifier rounds.

## Steps

1. **Collect facts, not memory.**
   - `git status --short` and `git log --oneline <session start>..HEAD` (start is in the session's first trail line in `.harness/trail/<today>.md`).
   - Test/check commands you actually ran this session and their results.

2. **Update `docs/HANDOFF.md`** (≤40 lines). The `<!-- auto -->` block (branch, commits, uncommitted, last test) is hook-written: leave it. You write only:
   - Now: phase/gate, branch, brief + chosen option.
   - State table: each item with its **grade** (`hypothesis` / `red-green` / `run-checked` / `verified`) and evidence. Never write `verified` unless the user said so this session.
   - Next action: one concrete step.
   - Blockers / open questions.
   - Tried and failed: keep entries that still matter; drop resolved ones.
   - Update `updated:` in frontmatter.

3. **Append only when earned.**
   - `docs/CHANGELOG.md`: only if behaviour shipped (merged or ready to merge). One entry per user-visible change, with REQ-IDs.
   - `docs/DECISIONS.md`: only if a real decision was made (chose X over Y for reason Z). ADR format: date, context, decision, consequences.
   - `docs/RULES.md → Candidates`: only if something went wrong that a rule would have caught. Date — lesson — incident.

4. **Drift note.** If you edited code mapped to a doc (the R-docmap reminders this session) and didn't update that doc, list it in HANDOFF → Blockers as "doc drift: <doc>".

5. **Commit bookkeeping** on the current branch: `docs: close session <yyyy-mm-dd>`. Do not push (pushing main is a hard stop; pushing a feature branch is fine if the user has said so before).

6. **Report** (table): what changed · grade · evidence · next action. Then the DO THIS block.
