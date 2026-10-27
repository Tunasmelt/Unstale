---
name: doc-drift
description: Find and fix docs that no longer match the code they govern, using last_verified_commit stamps and the docMap in harness.config.json. Use when the session banner reports doc drift, before a gate review, or when the user says /doc-drift.
---

# /doc-drift — make the docs true again

## Steps

1. **Measure.** `node .claude/harness/harness.mjs drift`
   | status | meaning | action |
   |---|---|---|
   | fresh | no governed commits since stamp | nothing |
   | stale | governed code changed after stamp | step 2 |
   | unstamped | no `last_verified_commit` | verify whole doc, then stamp |
   | unknown-commit | stamp sha not in history (rebase/squash) | verify whole doc, then stamp |
   | missing | doc in docMap doesn't exist | ask user: create it, or remove the mapping |

2. **For each stale doc:** `git log -p <since>..HEAD -- <governed paths>` (paths from `docMap` in `.claude/harness.config.json`). For each change, check the doc's relevant section against the **code**, not against your memory of the code.
   - Data model / access → compare to `convex/` schema and access checks.
   - API.md → regenerate own-API part from OpenAPI if the project does that; for external APIs re-check pinned version and set a new last-verified date. If the `api-spec` skill exists, use it.
   - SECURITY.md → if a new component or boundary appeared, it needs a threat entry. If the `security-spec` skill exists, use it.

3. **Edit the doc** to match the code. If the code looks wrong rather than the doc, don't "fix" the doc. Flag it to the user as a possible bug.

4. **Stamp only what you verified.** `node .claude/harness/harness.mjs stamp docs/API.md docs/SECURITY.md`. Never stamp a doc you didn't check line by line against the diff.

5. **Report** table: doc · was · changes made · now. Code-vs-doc conflicts listed separately as decisions for the user.
