#!/usr/bin/env python3
"""Repair closing code fences that carry an info string.

Per CommonMark, a closing code fence may not have an info string. So this:

    ````markdown
    <script>alert(1)</script>
    ````text

does not close the block. Everything below it is then inside the code block:
invisible to GitHub's outline, unsearchable, and unlinkable. Markdownlint does
not flag it, which is how 60-odd documents in this corpus acquired the habit —
including this repository's own README, where a directory tree is labelled as
a diff.

Writers do it because the language label reads as a label rather than as
content, and because most renderers close anyway. The result looks right in
practice while silently destroying the document structure underneath.

The run's length distinguishes a typo from legitimate content: a longer run
inside a narrower block is a sample of a nested fence or an ASCII ruler, and
code blocks cannot nest, so it must be left alone. See fences.py.

Usage
-----
    python scripts/check-fences.py           # report
    python scripts/check-fences.py --apply   # repair
"""

import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fences import classify_fence_lines, fence_parts  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {"node_modules", "target", "dist", ".git", "vendor", "build"}


def markdown_files():
    for dirpath, dirnames, filenames in os.walk(REPO_ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if name.endswith(".md"):
                yield os.path.join(dirpath, name)


def main():
    apply_changes = "--apply" in sys.argv
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    os.chdir(REPO_ROOT)

    total_bad = 0
    total_unclosed = 0
    files_touched = 0

    for path in markdown_files():
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()

        bad, unclosed = [], False
        for i, kind in classify_fence_lines(lines):
            if kind == "bad-close":
                bad.append(i)
            elif kind == "unclosed":
                unclosed = True

        rel = os.path.relpath(path, REPO_ROOT).replace("\\", "/")
        if not bad and not unclosed:
            continue

        total_bad += len(bad)
        total_unclosed += 1 if unclosed else 0
        files_touched += 1

        if bad:
            print("%s: %d malformed closing fence(s) at line(s) %s"
                  % (rel, len(bad), ", ".join(str(i + 1) for i in bad[:6])))
        if unclosed:
            print("%s: a code fence is never closed" % rel)

        if apply_changes and bad:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                out = list(lines)
                for i in bad:
                    out[i] = fence_parts(out[i])[0]
                fh.writelines([l + "\n" for l in out])

    print("\nfiles affected: %d" % files_touched)
    print("malformed closing fences: %d" % total_bad)
    print("files with an unclosed fence: %d" % total_unclosed)
    if apply_changes and total_bad:
        print("repaired; re-run without --apply to confirm")
    elif total_bad:
        print("re-run with --apply to repair")
    return 1 if (total_bad or total_unclosed) else 0


if __name__ == "__main__":
    sys.exit(main())