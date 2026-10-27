---
name: retro
description: Harness retrospective at the end of each phase (or monthly) — rule hit counts, sunset candidates, promote lessons, process-vs-product check. Use when the user says /retro or after a phase gate passes.
disable-model-invocation: true
---

# /retro — keep the harness earning its place

Solo replacement for a weekly review: run once per phase, or monthly if phases are long.

## Steps

1. **Numbers.**
   - `node .claude/harness/harness.mjs stats`: process vs product commits, hits per rule since last retro.
   - `node .claude/harness/harness.mjs sunset`: non-exempt rules with zero hits → candidates.

2. **Process check.** If process > product: say it plainly and propose what to cut (skills not used, rules not firing, docs nobody reads).

3. **Sunset.** For each candidate:
   - Discipline-enforced rules can't log hits. Judge them by whether they came up in this phase's trail/reviews.
   - Propose: retire / keep / convert to a hook. The user decides.
   - Retire = move the section verbatim to `## Retired` in `docs/RULES.md` with `retired <date> — reason`, set `status: retired`, and delete its one-liner from `CLAUDE.md`. For a ratchet member, remove it from `harness.config.json`.

4. **Promote.** Each entry in `RULES.md → Candidates`: would it have caught a real incident this phase? Yes → propose the CLAUDE.md one-liner + RULES.md entry, and whether it can be a hook or ratchet instead (prefer hook). No → leave or drop.

5. **Noise.** Rules with very high hits: is the rule wrong, or is the agent repeatedly making the mistake? Wrong rule → loosen. Repeated mistake → make the CLAUDE.md line sharper or move the check earlier.

6. **CLAUDE.md size.** Keep it under ~100 lines. Over → something must move to a hook or retire.

7. **Write `docs/reviews/retro-<yyyy-mm-dd>.md`** (the filename date resets the hit window) with the tables and decisions. Report + DO THIS with each proposal as a yes/no.
