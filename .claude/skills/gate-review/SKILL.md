---
name: gate-review
description: Review a phase gate from docs/PHASES.md — run its gate commands, check REQ coverage, security checklist and doc drift, get an independent verifier pass, and write docs/reviews/<gate>.md. Use when the user says /gate-review, "review the gate", or a milestone is claimed done.
disable-model-invocation: true
---

# /gate-review — is this gate actually passed?

Argument: gate id (e.g. `G1.2`). If missing, use the current gate from HANDOFF.

## Steps

1. **Load the gate** from `docs/PHASES.md`: its milestones, gate commands, covered REQ-IDs, security checks.

2. **Run every gate command** exactly as written. Record command → exit code → key output line. A command you can't run is a FAIL with reason, not a skip.

3. **REQ coverage.** For each covered REQ-ID: the test(s) that prove it (`rg -n "REQ-xx" tests/ src/` or test names) and whether they ran green in step 2. A REQ with no test is a gap.

4. **Security checklist.** The per-gate checklist in `docs/SECURITY.md`. Each item: evidence (`file:line`, policy name, test) or gap.

5. **Doc drift.** `node .claude/harness/harness.mjs drift`. Stale docs block the gate unless the user waives them.

6. **Independent verification.** Spawn the `verifier` agent with: gate id, REQ list, gate commands, and the *paths* changed in this phase (`git diff --stat <phase start>..HEAD`). Do NOT pass your conclusions. Merge its findings; where it disagrees with you, show both.

7. **Write `docs/reviews/<gate>-<yyyy-mm-dd>.md`:**
   - Verdict: PASS / PASS WITH WAIVERS / FAIL
   - Table: check · result · evidence
   - Gaps → each becomes a next action or an explicit waiver for the user to accept
   - Verifier findings

8. **Report** verdict + gaps table, DO THIS block with waiver decisions spelled out. Updating PHASES.md status is the user's call.
