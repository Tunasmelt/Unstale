---
last_verified_commit: none
---
# Rules — rationale (cold tier)

The one-line, binding form of every rule lives in `CLAUDE.md`. This file holds the **why**, so a rule can be judged, improved or retired. Do not add rules here that aren't in CLAUDE.md.

Format (parsed by `harness.mjs sunset`):
`### <ID> — <title>` then `enforced-by:` (hook name or `discipline`), `exempt:` (yes = never sunset), `status:` (active | retired).

Lifecycle: a rule that logs zero hits between two `/retro`s and is not exempt becomes a **sunset candidate**. Retiring moves it to *Retired* below verbatim — never delete text.

---

## Active

### R-tier — Ceremony scales with the task
enforced-by: discipline · exempt: no · status: retired — v2: tier table removed from CLAUDE.md — unattended runs ignored it (5/25 labelled a tier) and instruction count degrades adherence (IFScale).
Why: full ceremony on a typo fix teaches you to skip ceremony everywhere. Three tiers keep T2 rigorous because T0/T1 stay cheap.

### R-sot — One file answers each question
enforced-by: discipline · exempt: no · status: retired — v2: source-of-truth table removed — overviews don't reduce steps (AGENTS.md study, ICLR 2026); R-docmap points to the right doc at edit time instead.
Why: two docs that both describe the data model will disagree within a month. Each question has exactly one home.

### R-evidence — Docs are not evidence; code is
enforced-by: discipline · exempt: yes · status: active
Why: agents read a spec, believe the feature exists, and build on air. Grep for the symbol before asserting it exists.

### R-drift — Docs carry last_verified_commit
enforced-by: session.mjs (start banner) + /doc-drift · exempt: no · status: active
Why: stale docs are worse than no docs because the agent trusts them. The stamp makes staleness computable instead of a feeling.

### R-brief — No T2 code without an approved brief
enforced-by: discipline · exempt: no · status: active
Why: the most expensive bug is building the wrong thing. A/B forces the scope decision into the open; the protected floor stops "minimal" from meaning "insecure".

### HS — Hard stops ask first
enforced-by: bash_guard (permission prompt) · exempt: yes · status: active
Why: irreversible or public actions. A hard stop that "never fires" is working, not useless — hence exempt from sunset.

### R-grades — Verification grades, honestly reported
enforced-by: discipline · exempt: no · status: active
Why: "fixed" without evidence is a hypothesis. Grades make the confidence level explicit; only the user can say `verified`.

### R-branch — Code changes live on a branch
enforced-by: edit_guard, bash_guard · exempt: no · status: active
Why: solo devs lose work to half-finished changes on main. A branch per feature gives free rollback and a clean diff to review. Set `branchPolicy.mode` to `warn` or `off` if this costs more than it saves.

### R-readonly — Env files, raw data and committed migrations are read-only
enforced-by: edit_guard, bash_guard · exempt: yes · status: active
Why: editing an applied migration desyncs every environment that already ran it. Env files hold secrets that must never enter context or git.

### R-env-values — Env values never enter context; names are fine
enforced-by: bash_guard (denyCommands), edit_guard (Read tool) · exempt: yes · status: active
Why: benchmark 2026-10-23: a blanket "don't read .env" made the agent refuse a legitimate "which variable is missing?" request, while `cat .env` via Bash was not blocked at all. Names-only inspection answers the question without exposing secrets. Not done via settings `permissions.deny: Read(.env)`: Claude Code applies that to Bash reads too, which blocked `cut -d= -f1 .env`.

### R-secrets — No secrets in files
enforced-by: edit_guard, bash_guard · exempt: yes · status: active
Why: a key in a commit is a leaked key, even after deletion (git history). Env var + `.env.example` placeholder, always.

### RT — Ratchets: no new instances of known-bad patterns
enforced-by: post_edit, bash_guard · exempt: no · status: active
Why: you can't fix all legacy debt today, but you can stop it growing. Counts compare against HEAD, so old code never trips it. Each `RT-*` id in config is a member of this family; sunset individual members via config.

### R-agents — Sub-agents only where they add independence
enforced-by: discipline · exempt: no · status: retired — v2: removed from CLAUDE.md — 0/50 runs used sub-agents; verifier stays available via /gate-review.
Why: a verifier that saw the implementer's reasoning grades its own homework. Agents cost tokens and RAM; use them for independence, not ceremony.

### R-close — End code sessions with /close
enforced-by: session.mjs (auto-HANDOFF block written by the Stop hook) · exempt: no · status: retired — v2: replaced by the hook-written auto-HANDOFF block; /close remains for the human-written part.
Why: the next session starts from HANDOFF. A stale HANDOFF sends it in the wrong direction confidently.

### R-docmap — Know which doc governs the file you touched
enforced-by: post_edit · exempt: no · status: active
Why: drift starts at the edit. A reminder at edit time is cheaper than a drift audit later.

### R-handoff-size — HANDOFF stays hot
enforced-by: post_edit · exempt: no · status: active
Why: HANDOFF is injected into every session. Every line costs context. History belongs in CHANGELOG, decisions in DECISIONS.

---

### R-product — Unstale product invariants
enforced-by: discipline · exempt: yes · status: active
Why: the CLAUDE.md "Never" lines on App writes, local writes, repo-code execution, LLM in CLI, relay content, Verified vs Judgement, LLM keys, prompt injection and ID reuse are product security guarantees, not process. Full rationale lives in their sources (ADR-004/006/008/013/014, REQ-025, SEC-010/020–022/032/094/099/102); this entry only exempts them from sunset.

### R-learn — Reflect only on real execution feedback
enforced-by: session.mjs (Stop hook) · exempt: no · status: active
Why: ACE (ICLR 2026) — itemized, delta-updated playbooks learned from execution feedback improve agents without labels; intrinsic self-correction without external feedback lowers accuracy (Huang et al., ICLR 2024). So the reflector fires only on setup/environment failures (before the first edit, or env-type errors — never on red-green iteration), once per session; if tests are still red it first asks for a short search for the setup fix (trial: this 'second chance' is what made Haiku learn), and asks for ≤2 itemized bullets of the form symptom → root cause → fixing command. Lessons that normalise a failure are forbidden (trial 2026-10-24: Sonnet recorded 'baseline failure, ignore it', after which later sessions accepted red tests).

## Candidates
<!-- Lessons that might become rules. Promote at /retro only if they would have caught a real incident. Format: date — lesson — incident/evidence -->

---

## Retired
<!-- Moved here verbatim at /retro, with: retired <date> — reason. -->
