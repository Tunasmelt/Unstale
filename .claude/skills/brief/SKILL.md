---
name: brief
description: Write a T2 feature brief before any code — premise check with file:line evidence, then option A (full) vs B (minimal) for the user to pick. Use when the user asks to build, add, change or remove a feature, or says /brief.
---

# /brief — decide what to build before building it

Output: `docs/briefs/<yyyy-mm-dd>-<slug>.md` from `docs/briefs/_TEMPLATE.md`, then a short chat summary and stop. **No implementation code in this skill.**

## Steps

1. **Prior art.** `rg -il "<key nouns>" docs/briefs docs/DECISIONS.md docs/CHANGELOG.md`. If briefed, built or superseded before, say so and link it. Ask whether to extend it or start fresh.

2. **Map to requirements.** Find the REQ-IDs in `docs/PRODUCT.md` this serves. None? Say so: either it's out of scope (check non-goals) or PRODUCT.md needs a new REQ first. That's a decision for the user.

3. **Premise check, with evidence.**
   - Every claim in the request about current code gets a `file:line` or an exact search with its hit count.
   - "Remove X" when X doesn't exist → stop and report. "Fix Y" when Y works on inspection → stop and report.
   - Docs describing code are not evidence. Grep the symbol.

4. **Current state.** What's already built that this touches: files, tables, policies, endpoints. Read `docs/ARCHITECTURE.md` (data model/access) and `docs/SECURITY.md` sections that apply.

5. **Convention check.** Name the established pattern you're following (framework docs, WAI-ARIA, Convex auth/access patterns, OWASP item). Use Context7 or official docs for anything version-sensitive. One line per decision.

6. **Write the brief.** All 11 sections of the template. Testing plan rows must map to REQ-IDs.

7. **Options A vs B.**
   - A: what you'd build by default.
   - B: smallest version that delivers the REQ.
   - B may cut scope only. Never: auth/access checks, input validation, data-loss handling, accessibility, secrets hygiene, tests for the changed path.
   - Recommend one, with the reason in one line.

8. **Report and stop.** Chat summary: premise result, A vs B table, recommendation, numbered decisions. Wait for "A", "B", or edits. On approval set `status: approved-A|B` in the brief's frontmatter.

## After approval (not part of this skill)
`test-writer` agent writes failing tests from §8 → implement → run checks → `/close`.
