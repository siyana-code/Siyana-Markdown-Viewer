#!/usr/bin/env python3
"""Repair Markdown anchors broken by renumbering, truncation, or dash collapsing.

Run this after editing section headings, then commit the result. It reports
anything it cannot fix rather than guessing.

Three distinct causes are handled, in increasing order of confidence:

1. TRUNCATED   the fragment is a prefix of exactly one heading's slug. The
               heading was renamed and the link kept the old short form, or the
               link was typed by hand and left incomplete.
               Example: "#3-list-vs-setext-vs-thematic-break" for the heading
               "3. List vs setext vs thematic break ambiguity".

2. DASHES      the fragment matches a heading once runs of hyphens are collapsed
               to one. These arise around removed emphasis markers: the heading
               "## 11. Admonitions - **EXTENSION**" slugs to
               "...admonitions---extension" (three hyphens, because the bold
               markers vanish but their surrounding spaces do not), while a
               human writes "--extension".
               Example: "#11-admonitions-alerts---extension" written as
               "#11-admonitions-alerts--extension".

3. RENUMBERED  section numbers no longer agree, but the words do. Only applied
               when the fragment's words are largely present in one candidate
               heading and clearly better than any other. Section numbers alone
               are never matched, because they are exactly what went stale.

Usage
-----
    python scripts/fix-anchors.py            # report only
    python scripts/fix-anchors.py --apply    # rewrite the files
"""

import os
import re
import sys
import unicodedata
from collections import defaultdict

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fences import in_fence_flags  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS = {"node_modules", "target", "dist", ".git", "vendor", "build"}
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
LINK_RE = re.compile(r"\]\(([^)\s#]*)(#[^)\s]+)?\)")
CODE_SPAN_RE = re.compile("`[^`]*`")
EXTERNAL = ("http://", "https://", "mailto:", "tel:", "data:")
SECTION_PREFIX = re.compile(r"^\d+(?:\.\d+)*[-]?")

RENAME_THRESHOLD = 0.75
RENAME_MARGIN = 0.15


def slugify(text, seen):
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = text.replace("\\", "")
    kept = [
        c
        for c in text
        if c.isalnum() or c in "-_ " or unicodedata.category(c)[0] in ("L", "N")
    ]
    slug = "".join(kept).strip().lower()
    slug = re.sub(r"\s+", "-", slug)
    slug = "".join(c for c in slug if c.isalnum() or c in "-_")
    n = seen.get(slug, 0)
    seen[slug] = n + 1
    return slug if n == 0 else "%s-%d" % (slug, n)


def squash(s):
    return re.sub(r"-{2,}", "-", s.lower())


def words(s):
    s = SECTION_PREFIX.sub("", squash(s))
    return [w for w in s.split("-") if len(w) > 2]


def similarity(frag, slug):
    fw = words(frag)
    sw = set(words(slug))
    if len(fw) < 2:
        return 0.0
    return sum(1 for w in fw if w in sw) / len(fw)


def fence_states(lines):
    return in_fence_flags(lines)


def headings_of(lines):
    anchors, seen = {}, defaultdict(int)
    for i, in_fence in fence_states(lines):
        if in_fence:
            continue
        m = HEADING_RE.match(lines[i].rstrip("\n"))
        if m:
            anchors[slugify(m.group(2), seen)] = True
    return anchors


def markdown_files():
    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if name.endswith(".md"):
                yield os.path.join(dirpath, name)


def main():
    apply_changes = "--apply" in sys.argv
    os.chdir(REPO_ROOT)

    files = {}
    for path in markdown_files():
        rel = os.path.relpath(path, REPO_ROOT).replace("\\", "/")
        with open(path, encoding="utf-8") as fh:
            files[rel] = fh.read().splitlines()

    cache = {}

    def anchors_of(rel):
        if rel not in cache:
            cache[rel] = headings_of(files[rel]) if rel in files else None
        return cache[rel]

    fixes = []
    unfixed = []

    for rel, lines in files.items():
        spans_by_line = {}
        for i, in_fence in fence_states(lines):
            if in_fence:
                continue
            spans = [m.group(0) for m in CODE_SPAN_RE.finditer(lines[i])]

            for m in LINK_RE.finditer(lines[i]):
                file_part, frag = m.group(1), m.group(2)
                if not frag or file_part.startswith(EXTERNAL):
                    continue
                if any(m.group(0)[2:-1] in s for s in spans):
                    continue  # quoted specimen

                frag = frag[1:].lower()
                target = (
                    rel
                    if not file_part
                    else os.path.normpath(
                        os.path.join(os.path.dirname(rel), file_part)
                    ).replace("\\", "/")
                )
                anchors = anchors_of(target)
                if anchors is None or frag in anchors:
                    continue

                rec = [rel, i, m.start(2), m.end(2), frag, target, None, None]

                cands = [a for a in anchors if a.startswith(frag)]
                if len(cands) == 1:
                    rec[6], rec[7] = cands[0], "truncated"
                    fixes.append(rec)
                    continue

                want = squash(frag)
                cands = [a for a in anchors if squash(a) == want]
                if len(cands) == 1:
                    rec[6], rec[7] = cands[0], "dashes"
                    fixes.append(rec)
                    continue

                scored = sorted(
                    ((similarity(frag, a), a) for a in anchors), key=lambda x: -x[0]
                )
                best = scored[0][0] if scored else 0.0
                second = scored[1][0] if len(scored) > 1 else 0.0
                if best >= RENAME_THRESHOLD and best - second >= RENAME_MARGIN:
                    rec[6], rec[7] = scored[0][1], "renumbered"
                    fixes.append(rec)
                else:
                    unfixed.append(rec)

    by_kind = defaultdict(int)
    for rec in fixes:
        by_kind[rec[7]] += 1

    print("fixable: %d  (%s)" % (len(fixes), ", ".join(
        "%s=%d" % (k, by_kind[k]) for k in sorted(by_kind))))
    print("not fixable automatically: %d" % len(unfixed))

    if not apply_changes:
        if fixes:
            print("\nre-run with --apply to write changes")
        for rec in unfixed[:20]:
            print("  %s:%d  #%s  (in %s)" % (rec[0], rec[1] + 1, rec[4], rec[5]))
        if len(unfixed) > 20:
            print("  ... and %d more" % (len(unfixed) - 20))
        return 1 if unfixed else 0

    by_file = defaultdict(list)
    for rec in fixes:
        by_file[rec[0]].append(rec)

    for rel, lines in list(files.items()):
        edits = sorted(
            {(r[1], r[2], r[3], "#" + r[6]) for r in by_file.get(rel, [])},
            key=lambda x: -x[1],
        )
        if not edits:
            continue
        out = list(lines)
        for i, s, e, rep in edits:
            out[i] = out[i][:s] + rep + out[i][e:]
        with open(os.path.join(REPO_ROOT, rel), "w", encoding="utf-8", newline="\n") as fh:
            fh.writelines([l if l.endswith("\n") else l + "\n" for l in out])
        files[rel] = [l.rstrip("\n") for l in out]
        cache.clear()

    print("applied %d fix(es)" % len(fixes))
    if unfixed:
        print("\nstill unresolved:")
        for rec in unfixed[:20]:
            print("  %s:%d  #%s  (in %s)" % (rec[0], rec[1] + 1, rec[4], rec[5]))
    return 1 if unfixed else 0


if __name__ == "__main__":
    sys.exit(main())