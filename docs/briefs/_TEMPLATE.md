---
status: draft | approved-A | approved-B | superseded
reqs: [REQ-xx]
phase: <P#·G#>
---
# Brief: <feature>

## 1. Summary
<2–3 lines. What changes for the user.>

## 2. Premise check
- Claim in request: <…> → evidence: `<file:line>` or `rg -n "…"` → <n hits>
- Already built: <…>

## 3. Data
- Convex tables / indexes: <convex/schema.ts changes>
- Access checks: <who can read/write what (IDOR: SEC-040/041)>

## 4. API
- Own endpoints: <method path · auth · request/response> → update docs/API.md
- External APIs: <name · pinned version>

## 5. UI
- Screens/components: <paths> · states: loading / empty / error / success
- Convention followed: <e.g. shadcn Form + zod; WAI-ARIA dialog pattern>

## 6. Security
- Threats from docs/SECURITY.md that apply: <…>
- Mitigations: <…>

## 7. Edge cases
- <…>

## 8. Testing plan
| Test | Level | Proves |
|---|---|---|
| <name> | unit / integration / e2e | <REQ-xx behaviour> |

## 9. Rollback
<additive? feature flag? migration down path?>

## 10. Options
| | A — full | B — minimal |
|---|---|---|
| Scope | | |
| Effort | | |
| Cuts | — | <scope only; never auth/access, validation, data-loss, a11y, secrets, tests> |
**Recommendation:** <A|B> because <…>

## 11. Decisions for you
1. <question> — options: <a> / <b>
