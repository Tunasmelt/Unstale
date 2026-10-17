"""GATE-5 check: SECURITY.md is internally consistent and agrees with ARCHITECTURE.md and PHASES.md.

Usage: python scripts/check_security_doc.py --security docs/SECURITY.md --architecture docs/ARCHITECTURE.md --phases docs/PHASES.md
Exit 0 on pass, 1 on any error. Stdlib only.
"""
import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docchecks import Report, components, duplicates, expand_ranges, ids_in, read, section, table_rows  # noqa: E402

THR_STATUS = {"open", "mitigated", "accepted", "retired"}
SECRET_VALUE_PATTERNS = [
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"\bsk-[A-Za-z0-9_-]{20,}",
    r"\bgh[pousr]_[A-Za-z0-9]{20,}",
    r"\buns_[A-Za-z0-9_-]{20,}",
    r"\bAKIA[0-9A-Z]{16}\b",
    r"\bxox[abp]-[A-Za-z0-9-]{10,}",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--security", required=True)
    ap.add_argument("--architecture", required=True)
    ap.add_argument("--phases", required=True)
    args = ap.parse_args()

    r = Report("check_security_doc")
    sec = read(args.security, r)
    arch = read(args.architecture, r)
    phases = read(args.phases, r)

    comps = components(arch)
    if not comps:
        r.error("ARCHITECTURE: no COMP- rows found")

    # Threats
    thr_rows = table_rows(section(sec, "## 2."), r"THR-\d+")
    sec_rows = table_rows(section(sec, "## 3."), r"SEC-\d+")
    thr_ids = [t[0] for t in thr_rows]
    sec_ids = [s[0] for s in sec_rows]
    for d in duplicates(thr_ids):
        r.error(f"{d}: defined more than once")
    for d in duplicates(sec_ids):
        r.error(f"{d}: defined more than once")
    thr_set, sec_set = set(thr_ids), set(sec_ids)

    thr_mitigations = {}
    for t in thr_rows:
        if len(t) != 8:
            r.error(f"{t[0]}: expected 8 columns, found {len(t)}")
            continue
        tid, comp, _entry, _threat, _impact, _lik, mitig, status = t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7]
        for c in ids_in(comp, "COMP"):
            if c not in comps:
                r.error(f"{tid}: component {c} not in ARCHITECTURE")
        if not ids_in(comp, "COMP") and comp.lower() != "all":
            r.error(f"{tid}: component cell '{comp}' names no COMP- id (or 'all')")
        if status not in THR_STATUS:
            r.error(f"{tid}: status '{status}' not one of {sorted(THR_STATUS)}")
        m = expand_ranges(mitig, "SEC")
        thr_mitigations[tid] = m
        if status == "mitigated" and not m:
            r.error(f"{tid}: status mitigated but lists no SEC- guardrail")
        if status == "accepted" and "EXC-" not in sec:
            r.error(f"{tid}: accepted risk needs an EXC- row in §6")
        for s in sorted(m - sec_set):
            r.error(f"{tid}: mitigation {s} is not a defined guardrail")

    # Guardrails
    for s in sec_rows:
        sid = s[0]
        if len(s) != 4:
            r.error(f"{sid}: expected 4 columns, found {len(s)}")
            continue
        enforcement, mitigates = s[2], s[3]
        if not enforcement:
            r.error(f"{sid}: no enforcement")
        targets = set(ids_in(mitigates, "THR"))
        if not targets:
            r.error(f"{sid}: mitigates no threat")
        for t in sorted(targets):
            if t not in thr_set:
                r.error(f"{sid}: mitigates undefined {t}")
            elif sid not in thr_mitigations.get(t, set()):
                r.error(f"{sid} says it mitigates {t}, but {t} does not list {sid}")
    for tid, mset in thr_mitigations.items():
        for s in mset & sec_set:
            row = next(x for x in sec_rows if x[0] == s)
            if len(row) == 4 and tid not in ids_in(row[3], "THR"):
                r.error(f"{tid} lists {s}, but {s} does not name {tid} in Mitigates")

    # Gate triggers
    trig_section = section(sec, "## 5.")
    triggers = {row[0] for row in table_rows(trig_section, r"T\d+")}
    if not triggers:
        r.error("§5: no trigger table (T1…)")
    for t in table_rows(trig_section, r"T\d+"):
        for s in expand_ranges(" ".join(t[1:]), "SEC") - sec_set:
            r.error(f"trigger {t[0]}: guardrail {s} not defined")
    sec_gates = re.findall(r"^### (GATE-\d+)", trig_section, re.M)
    for g in sec_gates:
        body = section(trig_section, f"### {g}")
        planned = re.search(r"Triggers planned:\s*(.*)", body)
        if not planned:
            r.error(f"§5 {g}: no 'Triggers planned' line")
            continue
        for t in re.findall(r"\bT\d+\b", planned.group(1)):
            if t not in triggers:
                r.error(f"§5 {g}: trigger {t} not defined")
        for s in ids_in(body, "SEC"):
            if s not in sec_set:
                r.error(f"§5 {g}: guardrail {s} not defined")

    # PHASES gates
    phase_gates = re.findall(r"^### (GATE-\d+)", phases, re.M)
    covered = set()
    for g in phase_gates:
        body = section(phases, f"### {g}")
        line = re.search(r"^- Security:\s*(.*)$", body, re.M)
        if not line:
            r.error(f"PHASES {g}: no '- Security:' line")
            continue
        for s in ids_in(line.group(1), "SEC"):
            covered.add(s)
            if s not in sec_set:
                r.error(f"PHASES {g}: guardrail {s} not defined in SECURITY")
        if g not in sec_gates:
            r.error(f"PHASES {g}: no matching checklist in SECURITY §5")
    for g in sec_gates:
        if g not in phase_gates:
            r.error(f"SECURITY §5 {g}: no matching gate in PHASES")
    for s in sorted(sec_set - covered):
        r.error(f"{s}: not enforced at any gate in PHASES")

    # Secrets: names only
    for pat in SECRET_VALUE_PATTERNS:
        for m in re.finditer(pat, sec):
            r.error(f"possible secret value in SECURITY.md: '{m.group(0)[:12]}…'")

    # Exceptions cite an ADR
    for row in table_rows(section(sec, "## 6."), r"EXC-\d+"):
        if not ids_in(" ".join(row), "ADR"):
            r.error(f"{row[0]}: exception cites no ADR")

    r.finish()


if __name__ == "__main__":
    main()
