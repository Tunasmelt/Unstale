---
status: approved-B
reqs: [REQ-003]
phase: P1 · M1.1
---
# Brief: Markdown claim extraction

## 1. Summary
Start P1 with a pure TypeScript extractor returning candidate claim text, source kind, markdown path and one-based line. Candidates are not Verified findings. Verification and fixes remain M1.2 onward.

## 2. Premise check
- `packages/engine/src/index.ts:3` defines claim types; line 6 defines the version. No parser or RepoIndex exists.
- `packages/engine/src/index.test.ts` contains one scaffold assertion.
- ADR-001 and ARCHITECTURE specify document-agnostic extraction using markdown-it. No earlier extraction brief exists (`rg -il 'extract|engine' docs/briefs docs/DECISIONS.md docs/CHANGELOG.md`).

## 3. Data
No database changes or persistence. Input markdown is untrusted data; output is an in-memory candidate list.

## 4. API
One exported engine function and its candidate type. No network endpoint. Follow markdown-it token/source-map API after checking official documentation; pin the dependency and review its licence and audit before installation.

## 5. UI
None. Existing engine exports remain compatible.

## 6. Security
SEC-031/034: reject or explicitly skip input over 1 MB; bounded parsing and adversarial-input tests. No filesystem access, processes, network, HTML execution or LLM calls. Paths remain text until a later RepoIndex boundary validates containment (SEC-030).

## 7. Edge cases
CRLF and LF; nested markdown; repeated identical candidates on different lines; multi-backtick spans; relative links and anchors; reference links; imports; empty input; shell fences with language aliases. Ignore plain prose and non-shell code fences. Retain exact doc line provenance.

## 8. Testing plan
| Test | Level | Proves |
|---|---|---|
| Inline spans, relative links/anchors, imports, shell commands | unit | REQ-003 extraction sources |
| Plain prose and non-shell fences produce no candidates | unit | REQ-003 scope |
| CRLF, repeated claims and nested markdown preserve lines | unit | REQ-003 provenance |
| Oversized and adversarial input | unit | SEC-031/034 boundary |

## 9. Rollback
Additive exports and dependency only; remove the slice without data migration. No deployment.

## 10. Options
| | A — full P1 | B — extraction slice |
|---|---|---|
| Scope | M1.1–M1.5: parser, RepoIndex, eight verifiers, guards, modes, config, fixtures/mutation runner | M1.1 only; extraction API and tests |
| Effort | Several implementation sessions | One bounded implementation slice |
| Cuts | None | Verification, adapters and fixture builder deferred to their planned milestones |
**Recommendation:** B. Establish reliable extraction and line provenance before building verifiers.

## 11. Decisions for you
1. Owner approved B on 2026-10-28: M1.1 extraction first.
