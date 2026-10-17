"""GATE-5 check: API.md is internally consistent, agrees with SECURITY.md, ARCHITECTURE.md (and PRODUCT.md
beside it), matches the code in --repo, and its external APIs were verified within --stale-days.

Usage: python scripts/check_api_doc.py --doc docs/API.md --security docs/SECURITY.md --architecture docs/ARCHITECTURE.md --repo . --stale-days 30
Exit 0 on pass, 1 on any error. Stdlib only.
"""
import argparse
import datetime as dt
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docchecks import Report, components, duplicates, ids_in, read, section, table_rows  # noqa: E402

METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "QUERY", "MUTATION", "ACTION", "MCP"}
API_STATUS = {"planned", "active", "deprecated", "retired"}
EXT_STATUS = {"active", "deprecated", "removed"}
CODE_DIRS = ["apps", "convex", "packages"]
CODE_EXT = {".ts", ".tsx", ".js", ".mjs", ".cjs"}
SKIP_DIRS = {"node_modules", ".next", "dist", "build", "coverage", ".git", "_generated"}


def backticked(cell):
    return re.findall(r"`([a-z]+)`", cell)


def code_files(repo):
    for d in CODE_DIRS:
        base = repo / d
        if not base.is_dir():
            continue
        for p in base.rglob("*"):
            if p.suffix in CODE_EXT and not (SKIP_DIRS & set(p.parts)):
                yield p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc", required=True)
    ap.add_argument("--security", required=True)
    ap.add_argument("--architecture", required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--stale-days", type=int, default=30)
    ap.add_argument("--today", help="YYYY-MM-DD, for tests; default is the system date")
    args = ap.parse_args()

    r = Report("check_api_doc")
    api = read(args.doc, r)
    sec = read(args.security, r)
    arch = read(args.architecture, r)
    product_path = Path(args.doc).with_name("PRODUCT.md")
    reqs = {row[0] for row in table_rows(product_path.read_text(encoding="utf-8"), r"REQ-\d+")} if product_path.is_file() else None
    if reqs is None:
        r.warn(f"{product_path} not found: REQ- references not checked")
    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()

    comps = components(arch)
    sec_ids = {row[0] for row in table_rows(section(sec, "## 3."), r"SEC-\d+")}
    secret_names = {row[0] for row in table_rows(section(sec, "## 4."), r"[A-Za-z].*")} - {"Name"}

    conv = section(api, "## Conventions")
    auth_line = re.search(r"\*\*Auth tiers:\*\*(.*)", conv)
    rate_line = re.search(r"\*\*Rate-limit tiers:\*\*(.*)", conv)
    auth_tiers = set(backticked(auth_line.group(1))) if auth_line else set()
    rate_tiers = set(backticked(rate_line.group(1))) if rate_line else set()
    if not auth_tiers:
        r.error("Conventions: no **Auth tiers:** line")
    if not rate_tiers:
        r.error("Conventions: no **Rate-limit tiers:** line")

    # Part 1: own API, between the index markers
    m = re.search(r"<!-- api-index:start -->(.*?)<!-- api-index:end -->", api, re.S)
    if not m:
        r.error("Part 1: <!-- api-index:start/end --> markers missing")
        r.finish()
    rows = table_rows(m.group(1), r"API-\d+")
    for d in duplicates([x[0] for x in rows]):
        r.error(f"{d}: defined more than once")
    api_ids = {x[0] for x in rows}

    for row in rows:
        aid = row[0]
        if len(row) != 11:
            r.error(f"{aid}: expected 11 columns, found {len(row)}")
            continue
        _, method, path, summary, auth, rate, comp, req, guards, status, _notes = row
        if method not in METHODS:
            r.error(f"{aid}: method '{method}' not one of {sorted(METHODS)}")
        if not path or not summary:
            r.error(f"{aid}: path and summary are required")
        if method in {"GET", "POST", "PUT", "PATCH", "DELETE"} and not path.startswith("/"):
            r.error(f"{aid}: HTTP path '{path}' must start with /")
        if auth not in auth_tiers:
            r.error(f"{aid}: auth '{auth}' is not a declared tier {sorted(auth_tiers)}")
        if rate not in rate_tiers:
            r.error(f"{aid}: rate limit '{rate}' is not a declared tier {sorted(rate_tiers)}")
        if comp not in comps:
            r.error(f"{aid}: component '{comp}' not in ARCHITECTURE")
        if status not in API_STATUS:
            r.error(f"{aid}: status '{status}' not one of {sorted(API_STATUS)}")
        g = ids_in(guards, "SEC")
        if auth != "public" and not g:
            r.error(f"{aid}: non-public endpoint lists no guardrail")
        for s in g:
            if s not in sec_ids:
                r.error(f"{aid}: guardrail {s} not defined in SECURITY")
        if reqs is not None:
            for q in ids_in(req, "REQ"):
                if q not in reqs:
                    r.error(f"{aid}: requirement {q} not in PRODUCT")

    notes = section(api, "### Endpoint notes")
    for n in re.findall(r"\*\*(API-\d+)\*\*", notes):
        if n not in api_ids:
            r.error(f"Endpoint notes: {n} has no index row")

    # Part 2: external APIs
    ext_rows = table_rows(section(api, "## Part 2"), r"EXT-\d+")
    for d in duplicates([x[0] for x in ext_rows]):
        r.error(f"{d}: defined more than once")
    for row in ext_rows:
        eid = row[0]
        if len(row) != 10:
            r.error(f"{eid}: expected 10 columns, found {len(row)}")
            continue
        comp, secret, verified, status = row[3], row[6], row[8], row[9]
        for c in ids_in(comp, "COMP"):
            if c not in comps:
                r.error(f"{eid}: component {c} not in ARCHITECTURE")
        for name in re.findall(r"\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b", secret):
            if name not in secret_names:
                r.error(f"{eid}: secret {name} not in SECURITY §4")
        if status not in EXT_STATUS:
            r.error(f"{eid}: status '{status}' not one of {sorted(EXT_STATUS)}")
        try:
            age = (today - dt.date.fromisoformat(verified)).days
            if age > args.stale_days:
                r.error(f"{eid}: last verified {verified} ({age} days ago, limit {args.stale_days}); re-verify against live docs")
        except ValueError:
            r.error(f"{eid}: last verified '{verified}' is not a YYYY-MM-DD date")

    # Code vs doc
    repo = Path(args.repo)
    sources = {p: p.read_text(encoding="utf-8", errors="replace") for p in code_files(repo)}
    blob = "\n".join(sources.values())
    for row in rows:
        if len(row) != 11:
            continue
        aid, method, path, status = row[0], row[1], row[2], row[9]
        needle = path.split(":")[-1] if method in {"QUERY", "MUTATION", "ACTION"} else path
        found = bool(sources) and re.search(rf"['\"`]{re.escape(needle)}['\"`]|\b{re.escape(needle)}\b\s*=", blob)
        if status == "active" and not found:
            r.error(f"{aid}: status active but '{needle}' not found in code under {', '.join(CODE_DIRS)}")
        if status == "planned" and found:
            r.warn(f"{aid}: '{needle}' appears in code; mark the row active")
    documented_paths = {row[2] for row in rows if len(row) == 11}
    route_res = [
        r"path:\s*['\"](/[^'\"]*)['\"]",  # Convex httpRouter
        r"\.(?:get|post|put|patch|delete)\(\s*['\"](/[^'\"]*)['\"]",  # Hono
    ]
    for p, text in sources.items():
        for rx in route_res:
            for route in re.findall(rx, text):
                if route not in documented_paths:
                    r.error(f"{p.relative_to(repo)}: route {route} has no API.md row")
    if not sources:
        r.warn("no code under apps/, convex/, packages/: code checks skipped")

    # Freshness of the doc itself
    lu = re.search(r"^last_updated:\s*(\d{4}-\d{2}-\d{2})", api, re.M)
    if not lu:
        r.error("front matter: last_updated missing")
    elif (today - dt.date.fromisoformat(lu.group(1))).days > args.stale_days:
        r.warn(f"last_updated {lu.group(1)} is older than {args.stale_days} days")

    r.finish()


if __name__ == "__main__":
    main()
