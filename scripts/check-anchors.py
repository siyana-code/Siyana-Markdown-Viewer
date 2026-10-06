#!/usr/bin/env python3
"""Verify that Markdown anchor links resolve, using GitHub's slug algorithm.

Why this exists instead of markdownlint's MD051
----------------------------------------------
MD051 is disabled in .markdownlint-cli2.jsonc because it computes heading
fragments differently from GitHub. This corpus numbers its sections, so
"## 4. Search" anchors as "#4-search" on GitHub while markdownlint derives
something else, and MD051 reported every one of those correct links as broken.

Disabling a rule leaves anchors unverified, which is worse than a noisy check:
a broken anchor in a reference corpus sends the reader to the top of the page.
So this reimplements GitHub's slugger closely enough to catch real breakage, and
reports every mismatch rather than accepting one silently.

What it handles
---------------
- GitHub's slug rules: lowercase, punctuation and symbols removed, spaces to
  hyphens, duplicate headings suffixed -1, -2, ...
- The section sign and similar symbols are dropped (Unicode category So, not
  merely "non-ASCII"), which is what tripped the first implementation.
- Code fences via the shared rules in fences.py, including four-backtick blocks
  wrapping three-backtick examples, and runs of backticks used as content.
- Links quoted inside code spans are specimen text illustrating syntax, not
  navigation, and are skipped.

Usage
-----
    python scripts/check-anchors.py            # report, exit 1 on any failure
    python scripts/check-anchors.py --verbose  # list every failure
"""

import os
import re
import sys
import unicodedata
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fences import in_fence_flags  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS = {"node_modules", "target", "dist", ".git", "vendor", "build"}
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
CODE_SPAN_RE = re.compile("`[^`]*`")

# Schemes that are not repository links.
EXTERNAL = ("http://", "https://", "mailto:", "tel:", "data:")


def slugify(text, seen):
    """GitHub's heading slug algorithm, approximately."""
    # Strip inline formatting to the text a reader sees.
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = text.replace("\\", "")

    # Keep letters, digits, '-', '_' and spaces. Test the Unicode category:
    # the section sign '§' is non-ASCII but is a symbol, and GitHub drops it.
    kept = [
        c
        for c in text
        if c.isalnum() or c in "-_ " or unicodedata.category(c)[0] in ("L", "N")
    ]
    slug = "".join(kept).strip().lower()
    slug = re.sub(r"\s+", "-", slug)
    slug = "".join(c for c in slug if c.isalnum() or c in "-_")

    count = seen.get(slug, 0)
    seen[slug] = count + 1
    return slug if count == 0 else "%s-%d" % (slug, count)


def headings_of(lines):
    anchors = {}
    seen = defaultdict(int)
    for i, in_fence in in_fence_flags(lines):
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
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    os.chdir(REPO_ROOT)

    files = {}
    for path in markdown_files():
        # Always POSIX-style relative paths. os.path.join emits backslashes on
        # Windows, and comparing those against forward-slash dict keys makes
        # every cross-file lookup silently miss.
        rel = os.path.relpath(path, REPO_ROOT).replace("\\", "/")
        with open(path, encoding="utf-8") as fh:
            files[rel] = fh.read().splitlines()

    anchor_cache = {}

    def anchors_of(rel):
        if rel not in anchor_cache:
            anchor_cache[rel] = headings_of(files[rel]) if rel in files else None
        return anchor_cache[rel]

    failures = []
    checked = 0

    for rel, lines in files.items():
        for i, in_fence in in_fence_flags(lines):
            if in_fence:
                continue
            line = lines[i]
            spans = [m.group(0) for m in CODE_SPAN_RE.finditer(line)]

            for m in LINK_RE.finditer(line):
                body = m.group(1)
                if body.startswith(EXTERNAL):
                    continue
                if "#" not in body:
                    continue
                # Quoted specimen rather than navigation.
                if any(body in s for s in spans):
                    continue

                file_part, frag = body.split("#", 1)
                frag = frag.lower()

                target = (
                    rel
                    if not file_part
                    else os.path.normpath(
                        os.path.join(os.path.dirname(rel), file_part)
                    ).replace("\\", "/")
                )
                anchors = anchors_of(target)
                if anchors is None:
                    continue  # missing file: the relative-link check reports it
                if frag in anchors:
                    continue

                checked += 1
                failures.append((rel, i + 1, frag, line.strip()[:90]))

    print("anchor links checked: %d" % checked)
    if failures:
        print("unresolved: %d" % len(failures))
        shown = failures if verbose else failures[:25]
        for rel, line_no, frag, ctx in shown:
            print("  %s:%d  #%s" % (rel, line_no, frag))
            print("      %s" % ctx)
        if not verbose and len(failures) > 25:
            print("  ... and %d more (re-run with --verbose)" % (len(failures) - 25))
        return 1

    print("All anchor links resolve.")
    return 0


if __name__ == "__main__":
    sys.exit(main())