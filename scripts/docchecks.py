"""Shared helpers for the doc checkers (stdlib only)."""
import re
import sys
from pathlib import Path

ID_RE = r"(?:SEC|THR|API|ADR|REQ|COMP|EXT|EXC)-\d+"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


class Report:
    def __init__(self, name):
        self.name = name
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def finish(self):
        for w in self.warnings:
            print(f"warning: {w}")
        for e in self.errors:
            print(f"error: {e}")
        status = "FAIL" if self.errors else "PASS"
        print(f"{self.name}: {status} ({len(self.errors)} errors, {len(self.warnings)} warnings)")
        sys.exit(1 if self.errors else 0)


def read(path, report):
    p = Path(path)
    if not p.is_file():
        report.error(f"{path}: file not found")
        report.finish()
    return p.read_text(encoding="utf-8")


def section(text, heading_prefix):
    """Text from a heading starting with heading_prefix up to the next heading of the same level."""
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if line.startswith(heading_prefix):
            level = len(line) - len(line.lstrip("#"))
            out = []
            for nxt in lines[i + 1:]:
                if nxt.startswith("#") and len(nxt) - len(nxt.lstrip("#")) <= level:
                    break
                out.append(nxt)
            return "\n".join(out)
    return ""


def table_rows(text, first_col_re):
    """Rows of markdown tables whose first cell matches first_col_re, as lists of stripped cells."""
    rows = []
    for line in text.split("\n"):
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells and re.fullmatch(first_col_re, cells[0]):
            rows.append(cells)
    return rows


def ids_in(cell, prefix):
    return re.findall(rf"\b{prefix}-\d+\b", cell)


def expand_ranges(cell, prefix):
    """IDs in a cell, expanding ranges such as `SEC-020–023` or `SEC-010–SEC-013`."""
    found = set(ids_in(cell, prefix))
    for a, b in re.findall(rf"\b{prefix}-(\d+)\s*[–-]\s*(?:{prefix}-)?(\d+)\b", cell):
        width = len(a)
        for n in range(int(a), int(b) + 1):
            found.add(f"{prefix}-{n:0{width}d}")
    return found


def duplicates(values):
    seen, dup = set(), set()
    for v in values:
        (dup if v in seen else seen).add(v)
    return sorted(dup)


def components(arch_text):
    return {r[0] for r in table_rows(arch_text, r"COMP-\d+")}
