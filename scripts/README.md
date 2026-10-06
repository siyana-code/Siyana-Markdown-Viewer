# Documentation checks

Four scripts guard the documentation in this repository. All are standard-library
Python and run on every push and pull request as part of the `docs` CI job.

```bash
python scripts/check-fences.py         # code fence structure
python scripts/check-anchors.py        # anchor links resolve
python scripts/check-placeholders.py   # no unfinished text
npx markdownlint-cli2 "**/*.md"        # style and table structure
```

## Why each one exists

**`check-fences.py`** — A closing code fence may not carry an info string per
CommonMark, so ```` ```text ```` in closer position does not close the block.
Everything below it is then inside the code block: invisible to GitHub's outline,
unsearchable, and unlinkable. It renders "fine", which is why it went unnoticed
in 62 files across this repository, including the README, where a directory tree
was labelled `diff`. markdownlint does not flag it.

`fences.py` holds the detection rule. Three scripts had three copies of it and
they disagreed in both directions — one read headings inside code blocks, another
missed blocks entirely.

The run's length is what distinguishes a typo from legitimate content. A run
*longer* than the opener, carrying an info string, is content: a sample of a
nested fence, or an ASCII ruler. Code blocks cannot nest, so it must be left
alone. Only a run of the *same* length is reported as a probable mislabelled
closer.

```bash
python scripts/check-fences.py           # report
python scripts/check-fences.py --apply   # repair what is unambiguous
```

**`check-anchors.py`** — markdownlint's MD051 is disabled because it computes
heading fragments differently from GitHub. This corpus numbers its sections, so
`## 4. Search` anchors as `#4-search` on GitHub while MD051 derives something
else, and it reported every one of those correct links as broken.

Disabling a rule leaves anchors unverified, which is worse than a noisy check: a
broken anchor in a reference corpus sends the reader to the top of the page. So
this reimplements GitHub's slug algorithm and verifies against it.

**`check-placeholders.py`** — Guards against shipping unfinished text. A `grep`
over raw Markdown cannot do this: the corpus legitimately contains the words it
looks for. `> [!todo]` is an admonition-syntax example, `Lorem ipsum` is quoted
from the CommonMark spec, and `Superseded by ADR-XXXX` is the ADR status
template. The check runs on prose, with fences, code spans, and inline HTML
stripped, and lists its exemptions explicitly in `ALLOW_LINES`.

## Fixing anchors

```bash
python scripts/fix-anchors.py           # report
python scripts/fix-anchors.py --apply   # repair what is unambiguous
```

Three distinct causes, in increasing order of confidence:

| Cause | Example | Repaired |
|---|---|---|
| Truncated | `#3-list-vs-setext-vs-thematic-break` for the heading `3. List vs setext vs thematic break ambiguity` | Yes, when exactly one heading matches |
| Dash collapsing | `#11-admonitions--extension` for `## 11. Admonitions - **EXTENSION**`, which slugs to `admonitions---extension` | Yes |
| Renumbered | `#5-gfm-autolink-literals` after the target document was reorganised | Only at ≥ 75 % word match with a ≥ 0.15 margin |

Anything below those thresholds is reported rather than guessed. A wrong
auto-fix is worse than a reported failure.

## When a check disagrees with you

The checkers implement CommonMark, not intuition. Two cases are worth knowing:

1. **A closing fence with a language tag.** It looks like it closes the block.
   It does not. Verified against `commonmark.js`: the block's contents leak
   into a following paragraph while headings still parse, so the damage is
   invisible in a rendered diff but real to anything reading structure.

2. **Headings inside code blocks.** If a heading is not in GitHub's outline, find
   the unclosed fence above it rather than assuming the heading is wrong.

`--verbose` on either script lists every finding instead of the first few.

## Related

- [`docs/branching-strategy.md`](../docs/branching-strategy.md) — how a change
  reaches `develop`
- [`docs/engineering/coding-standards.md`](../docs/engineering/coding-standards.md)
  — style rules markdownlint enforces
