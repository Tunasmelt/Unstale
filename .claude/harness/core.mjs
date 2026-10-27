// Core analyses shared by the CLI and the SessionStart hook: doc drift, process ratio, rule hits.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, config, git, matchList, readText } from "../hooks/lib.mjs";

// ---------- doc drift ----------
// A doc is stale when code it governs (via docMap) has commits after the doc's `last_verified_commit`.
export function frontmatter(text) {
  const m = text && text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/); // CRLF checkouts on Windows
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return fm;
}

function expand(glob) {
  const m = glob.match(/\{([^{}]*)\}/);
  if (!m) return [glob];
  return m[1].split(",").flatMap((alt) => expand(glob.replace(m[0], alt)));
}

export function drift() {
  const cfg = config();
  const byDoc = new Map();
  for (const m of cfg.docMap || []) for (const d of m.docs) {
    if (!byDoc.has(d)) byDoc.set(d, []);
    byDoc.get(d).push(...expand(m.glob));
  }
  const rows = [];
  for (const [doc, globs] of byDoc) {
    const text = readText(doc);
    if (text == null) { rows.push({ doc, status: "missing", commits: [] }); continue; }
    const fm = frontmatter(text) || {};
    const since = fm.last_verified_commit;
    if (!since || /^(none|tbd|-)?$/i.test(since)) { rows.push({ doc, status: "unstamped", commits: [] }); continue; }
    if (git(["cat-file", "-e", `${since}^{commit}`]) === null) { rows.push({ doc, status: "unknown-commit", since, commits: [] }); continue; }
    const out = git(["log", "--format=%h %s", `${since}..HEAD`, "--", ...globs.map((g) => `:(glob)${g}`)]) || "";
    const commits = out.split("\n").filter(Boolean);
    rows.push({ doc, status: commits.length ? "stale" : "fresh", since, commits });
  }
  return rows.sort((a, b) => a.doc.localeCompare(b.doc));
}

// ---------- process vs product ----------
export function processRatio(days) {
  const cfg = config();
  const w = days || cfg.processRatio?.windowDays || 14;
  const out = git(["log", `--since=${w}.days`, "--name-only", "--format=@@%h"]) || "";
  let proc = 0, prod = 0;
  for (const block of out.split("@@").filter(Boolean)) {
    const files = block.split("\n").slice(1).map((s) => s.trim()).filter(Boolean);
    if (!files.length) continue;
    if (files.every((f) => matchList(f, cfg.processGlobs || []))) proc++; else prod++;
  }
  const min = cfg.processRatio?.minCommits ?? 6;
  return { days: w, process: proc, product: prod, warn: proc + prod >= min && proc > prod };
}

// ---------- rule hits & sunset candidates ----------
export function hits(sinceIso) {
  const p = join(ROOT, ".harness", "hits.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((h) => h && (!sinceIso || h.ts >= sinceIso));
}

/** Parse docs/RULES.md rule headers: `### R-xxx — title` + `exempt: yes|no` + `enforced-by: ...` */
export function rules() {
  const text = readText("docs/RULES.md") || "";
  const out = [];
  // ids: R-branch, or a family prefix like HS / RT that matches HS-force-push, RT-ts-any …
  const re = /^###\s+([A-Z]{1,3}(?:-[\w-]+)?)\s+[—-]\s+(.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    const body = text.slice(m.index, text.indexOf("\n### ", m.index + 1) > 0 ? text.indexOf("\n### ", m.index + 1) : undefined);
    out.push({
      id: m[1],
      title: m[2].trim(),
      exempt: /exempt:\s*yes/i.test(body),
      enforcedBy: (body.match(/enforced-by:\s*(.+?)\s*(?:·|$)/im) || [])[1]?.trim() || "discipline",
      retired: /status:\s*retired/i.test(body),
    });
  }
  return out;
}

export function lastRetro() {
  const dir = join(ROOT, "docs", "reviews");
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter((n) => /^retro-\d{4}-\d{2}-\d{2}\.md$/.test(n)).sort().pop();
  return f ? f.slice(6, 16) + "T00:00:00.000Z" : null;
}

export function sunsetReport() {
  const since = lastRetro();
  const counts = {};
  for (const h of hits(since)) counts[h.rule] = (counts[h.rule] || 0) + 1;
  const all = rules().filter((r) => !r.retired);
  // A hook may log many ids under one rule family (e.g. RT-*, HS-*): match by prefix too.
  const countFor = (id) => Object.entries(counts).filter(([k]) => k === id || k.startsWith(id + "-")).reduce((s, [, v]) => s + v, 0);
  return {
    since,
    rows: all.map((r) => {
      const n = countFor(r.id);
      const discipline = /^discipline$/i.test(r.enforcedBy);
      // Discipline rules log no hits, so zero means nothing: flag for human judgement instead.
      const verdict = r.exempt ? "" : discipline ? "REVIEW" : n === 0 ? "CANDIDATE" : "";
      return { ...r, hits: discipline ? "-" : n, verdict, candidate: verdict === "CANDIDATE" };
    }),
    unmapped: Object.keys(counts).filter((k) => !all.some((r) => k === r.id || k.startsWith(r.id + "-"))),
    counts,
  };
}
