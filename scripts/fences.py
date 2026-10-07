#!/usr/bin/env python3
"""Shared fence detection for the documentation checkers.

Three scripts need to agree on what a code fence is: `check-anchors.py`,
`check-fences.py`, and `fix-anchors.py`. When they disagree, one of them reads
headings inside code blocks or misses blocks entirely, and the resulting
reports are noise in both directions. So the rule lives here, once.

## The rules

CommonMark defines fenced code blocks with three details that are easy to get
wrong, and each one caused real miscounts in this repository:

1. **Up to three spaces of indent.** A run of backticks further in is content.

2. **A closing fence may not have an info string.** ```` ```text ```` where a
   closer is expected does *not* close the block. Everything below is then
   inside the code block: invisible to GitHub's outline, unsearchable, and
   unlinkable. Writers do it by habit, because the language label reads as a
   label rather than as content.

3. **Code blocks cannot nest.** A run longer than the opener, carrying an info
   string, is *content*: a sample of a nested fence, or an ASCII ruler. It must
   not be mistaken for a nested opener, or the remaining headings in the file
   disappear from every heading-aware tool.

Rule 2 and rule 3 pull in opposite directions, and the length comparison is what
distinguishes them:

    ```` ```text ````      opened, tagged, same length   -> author typo, report
    `````````````````` ``````  inside a ``` block       -> content, ignore
"""

import re

# Group 1: bare fence (no info string).
# Group 2/3: fence with an info string. Two details:
#   - the info string may abut the run with no space, because that is the common
#     form: ```jsonc, not ``` jsonc. Requiring a space silently failed on most
#     of this corpus.
#   - the info may not itself begin with a backtick or tilde, which excludes
#     prose opening with literal fence syntax and a longer run used as content.
FENCE_RE = re.compile(
    r"^ {0,3}(`{3,}|~{3,})[ \t]*$"
    r"|^ {0,3}(`{3,}|~{3,})(?!`)([ \t]*[^`~][^`]*?)[ \t]*$"
)


def fence_parts(line):
    """Return ``(marker, info)`` for a fence line, or ``None`` if it is not one.

    ``marker`` is the literal run of backticks or tildes; ``info`` is the
    trimmed info string, empty for a bare fence.
    """
    m = FENCE_RE.match(line.rstrip("\n"))
    if not m:
        return None
    if m.group(1) is not None:
        return m.group(1), ""
    return m.group(2), (m.group(3) or "").strip()


def fence_marker(line):
    """Return the fence marker for a fence line, or ``None``."""
    parts = fence_parts(line)
    return None if parts is None else parts[0]


def classify_fence_lines(lines):
    """Yield ``(index, kind)`` for each line.

    ``kind`` is one of:

    ``"open"``       a block was opened here
    ``"close"``      a block was closed here
    ``"bad-close"``  a tagged fence of the *same length* as the opener, with
                     content above it: almost certainly an intended closer whose
                     language tag was pasted down. Repairable.
    ``None``         not a fence boundary
    """
    open_len = 0
    open_char = ""
    has_content = False

    for i, line in enumerate(lines):
        parts = fence_parts(line)
        if parts is None:
            if open_len and line.strip():
                has_content = True
            yield i, None
            continue

        marker, info = parts
        char = marker[0]

        if open_len == 0:
            open_len, open_char, has_content = len(marker), char, False
            yield i, "open"
            continue

        if char != open_char or len(marker) < open_len:
            yield i, None
            if open_len:
                has_content = True
            continue

        # Long enough to close.
        if info:
            if len(marker) == open_len:
                if has_content:
                    open_len, open_char = 0, ""
                    yield i, "bad-close"
                else:
                    # An empty block followed by a new tagged fence: the author
                    # opened one block and is now opening the next.
                    open_len, open_char = len(marker), char
                    yield i, "open"
            else:
                # Longer than the opener: content inside the block.
                yield i, None
            has_content = True
            continue

        open_len, open_char, has_content = 0, "", False
        yield i, "close"

    if open_len:
        yield len(lines), "unclosed"


def in_fence_flags(lines):
    """Yield ``(index, in_fence)`` for each line, for heading extraction.

    Differs from `classify_fence_lines` in one respect: a tagged fence of the
    same length does *not* close the block, which is what CommonMark says and
    what makes a heading below it invisible. Heading extraction must follow the
    spec here, not the repair heuristic.
    """
    in_fence = False
    fence = ""
    char = ""

    for i, line in enumerate(lines):
        parts = fence_parts(line)
        if parts is None:
            yield i, in_fence
            continue

        marker, info = parts
        if not in_fence:
            in_fence, fence, char = True, marker, marker[0]
        elif (
            not info
            and marker[0] == char
            and len(marker) >= len(fence)
        ):
            in_fence = False
        yield i, True