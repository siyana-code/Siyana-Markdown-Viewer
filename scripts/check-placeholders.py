#!/usr/bin/env python3
"""Guard against shipping unfinished documentation.

A regex over the raw Markdown is the obvious approach and the wrong one: this
corpus legitimately contains the words the check looks for.

    "> [!todo] Yes!, they can."        an example of admonition syntax
    "> Lorem ipsum"                    quoted from the CommonMark spec
    "Superseded by ADR-XXXX"           the ADR status template
    "TODO: revisit once v1 is stable"  a real to-do, which this should catch

So the check runs on *prose*, with code spans, fenced blocks, inline HTML, and
quoted lines removed first, and the ADR template line exempted by name. A real
to-do reads differently from all of the above, and this catches those.

Usage
-----
    python scripts/check-placeholders.py
    python scripts/check-placeholders.py --verbose
"""

import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS = {"node_modules", "target", "dist", ".git", "vendor", "build"}

# Legitimate uses of these words that are not our unfinished work.
ALLOW_LINES = [
    # The ADR status table, where the placeholder names the referencing ADR.
    "Superseded by ADR-XXXX",
    # The to-do list in the method doc is a research artefact, not our debt.
    "TODO: revisit once v1 is stable",
]

# Folders where the words are subject matter rather than leftovers.
EXEMPT_PATHS = ("research/15-open-questions",)

FENCE_RE = re.compile(r"^\s*(```+|~~~+)")
PLACEHOLDER_RE = re.compile(r"\bTODO\b|\bFIXME\b|\bXXX\b|lorem ipsum", re.I)
TASK_MARKER_RE = re.compile(r"^\s*>\s*\[![a-z]+\]", re.I)   # "> [!todo]" examples
INLINE_HTML_RE = re.compile(r"<[^>]+>")


def strip_code(lines):
    """Remove fenced blocks, inline code spans, and inline HTML."""
    out = []
    in_fence = False
    fence = ""
    for line in lines:
        m = FENCE_RE.match(line)
        if m:
            marker = m.group(1)
            if not in_fence:
                in_fence, fence = True, marker
            elif marker[0] == fence[0] and len(marker) >= len(fence):
                in_fence = False
            out.append("")
            continue
        out.append("" if in_fence else line)
    cleaned = []
    for line in out:
        line = re.sub(r"`[^`]*`", " ", line)
        line = INLINE_HTML_RE.sub(" ", line)
        cleaned.append(line)
    return cleaned


def is_allowed(line):
    if TASK_MARKER_RE.match(line):
        return True
    return any(a in line for a in ALLOW_LINES)


def main():
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    os.chdir(REPO_ROOT)

    findings = []
    scanned = 0

    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if not name.endswith(".md"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, REPO_ROOT).replace("\\", "/")
            if rel.startswith(EXEMPT_PATHS):
                continue
            with open(path, encoding="utf-8") as fh:
                lines = fh.read().splitlines()
            scanned += 1
            for i, line in enumerate(strip_code(lines), 1):
                if PLACEHOLDER_RE.search(line) and not is_allowed(line):
                    findings.append((rel, i, line.strip()[:90]))

    print("markdown files scanned: %d" % scanned)
    if findings:
        print("placeholders found: %d" % len(findings))
        shown = findings if verbose else findings[:20]
        for rel, line_no, text in shown:
            print("  %s:%d  %s" % (rel, line_no, text))
        if not verbose and len(findings) > 20:
            print("  ... and %d more (re-run with --verbose)" % (len(findings) - 20))
        return 1

    print("No placeholder text in documentation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())