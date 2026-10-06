# `research/02-syntax/` — The syntax reference

> This folder is the **ground truth** for what Siyana Markdown Viewer must parse.
> Every claim here is traceable to a primary source, to a measured experiment, or
> is explicitly marked as inference. If you implement a parser from this folder and
> then disagree with the prose, the fixtures in
> [05-test-fixture-strategy.md](05-test-fixture-strategy.md) win.

---

## 1. What is in here

| Doc | Scope | Read it when |
|-----|-------|--------------|
| [01-block-elements.md](01-block-elements.md) | Everything that establishes **block** structure: headings, rules, code blocks, HTML blocks, quotes, lists, tables, front matter | You are writing the line-by-line block parser |
| [02-inline-elements.md](02-inline-elements.md) | Everything inside a block's text: code spans, emphasis, links, images, autolinks, entities, escapes, breaks, raw inline HTML | You are writing the delimiter-stack inline parser |
| [03-extensions-and-dialects.md](03-extensions-and-dialects.md) | Everything **beyond** CommonMark: GFM, Markdown Extra, Pandoc, MultiMarkdown, Obsidian, Logseq, math, diagrams, callouts | You are deciding which extensions the viewer supports |
| [04-edge-cases-and-traps.md](04-edge-cases-and-traps.md) | The inputs that break naive parsers: ambiguity, Unicode, line endings, tabs, BOM, stack depth, ReDoS | You are writing regression tests, or you are about to be surprised |
| [05-test-fixture-strategy.md](05-test-fixture-strategy.md) | How to build the conformance suite: which upstream files, how to run them, what pass rate to expect | You are wiring up CI |

---

## 2. The three-column convention

Every construct in docs 01–03 is presented in the same shape. Learn the shape
once and you can read any row at a glance.

### 2.0 The visible-glyph convention

Because these documents have to *show* Markdown source inside a code span — and
a code span cannot contain its own delimiter run — the folder uses a set of
**visible glyphs** for whitespace and structural characters. This is the same
trick the CommonMark spec itself uses for tabs.

| Glyph | Code point | Stands for | Why we need it |
|-------|-----------|------------|-----------------|
| `→` | U+2192 | TAB (U+0009) | The spec's own convention; tab expansion must advance to a *column*, so the raw tab is unreadable |
| `␣` | U+2423 | one SPACE (U+0020) | Trailing-space significance (hard breaks, code content) is otherwise invisible |
| `␤` | U+2424 | LINE FEED (U+000A) | Multi-line inputs are shown on one table row |
| `␀` | U+2400 | NUL (U+0000) | A raw NUL would make this file binary; CommonMark §2.3 requires it to become U+FFFD |
| `␃` | U+2403 | BACKTICK (U+0060) | **A code span cannot contain a backtick run of its own delimiter length.** A literal three-backtick fence therefore cannot live inside a single-backtick span, and re-writing delimiters by hand across ~40 rows is exactly the kind of thing that silently corrupts a syntax reference |
| `␍` | U+240D | CARRIAGE RETURN (U+000D) | Same reason as `␤` |

**No glyph for U+00A0.** NBSP is *not* a SPACE for any rule in this folder —
CM §6.1 strips only U+0020 — so writing it as `␣` would be actively misleading.
It is always spelled **`U+00A0`** in prose and in tables.

**The rule:** in these files, a backtick that is part of the *demonstrated
Markdown source* is always written `␃`. A real `` ` `` character appears **only**
as a code-span delimiter. The same holds for `→`, `␣`, `␤` and `␀`.

**Newlines are the one place where two notations coexist, and the split is
deliberate:**

| Where the newline appears | Notation | Real example |
|---|---|---|
| Inside the **Markdown source** being demonstrated | `␤` (U+2424) | ``` `␃␃␤foo␤bar␣␣␤baz␃␃` ``` — CM §6.1 Ex. 335 |
| Inside a **rendered-HTML** column | the two-character escape `\n` | `` `<pre><code>foo\n</code></pre>` `` — CM §4.4 Ex. 118 |

A rendered-HTML column can never contain a real LINE FEED: the output has
already been serialised, so a literal LF there would be a lie, while `\n` is
exactly how every serialiser prints it. In a Markdown *source* column a real LF
is a real character of the input and must be shown as one.

This is machine-checkable and we check it: see
[05 §12](05-test-fixture-strategy.md#12-maintenance). If you add a fixture row to
these documents, follow the convention or the doc-lint job fails.

### 2.1 The canonical form (a single construct)

```markdown
### `###` ATX heading — ATX-3

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `` ### foo ### `` → `<h3>foo</h3>` | **Valid**, §4.2, Examples 62–79 | 0–3 spaces indent; 1–6 `#`; space or EOL after the opener; closing sequence optional and may be any length |
```

Read it as:

1. **Syntax** — the literal source, then `→` the HTML the spec produces. If the
   spec does *not* mandate the exact HTML (see §1.3 below), the rendered output is
   labelled as *conforming-but-not-normative*.
2. **CommonMark verdict** — `Valid`, `Invalid`, `Valid only under <condition>`, or
   `Not in CommonMark`, followed by the **spec section number** and, where one
   exists, the **spec example number(s)**. Example numbers refer to
   CommonMark 0.31.2 unless the row says `GFM Ex.`.
3. **Notes** — the actual rule in words, plus anything that surprises people.

### 2.2 Long-form variant

For constructs where a table cannot hold the rule (emphasis, HTML blocks,
fenced-code indentation removal), the doc uses this shape instead:

```text
SOURCE      the literal input, in a fenced block, tabs rendered as →
HTML        the expected HTML, in a fenced block
RULE        the rule, in prose, quoting or closely paraphrasing the spec
TRAP        what naive parsers do instead
```

Both forms are used; a construct may use both (summary table first, long form
for the interesting parts).

### 2.3 "Rendered HTML" is a conformance target, not a licence

CommonMark §1.3 says explicitly:

> not every feature of the HTML samples is mandated by the spec. For example,
> the spec says what counts as a link destination, but it doesn't mandate that
> non-ASCII characters in the URL be percent-encoded.

So:

* `<hr />` and `<hr>` are **both** conforming.
* `<a href="/f%C3%B6%C3%B6">` and `<a href="/föö">` are **both** conforming.
* `<img src="x" />` and `<img src="x">` are **both** conforming.

Our test harness therefore measures two numbers (see
[05 §5](05-test-fixture-strategy.md#5-two-tiers-of-conformance)):

| Tier | What it normalizes | What it catches |
|------|--------------------|-----------------|
| **spec-exact** | trailing whitespace, blank-line runs, a handful of HTML entities | everything |
| **semantic** | additionally `<x />` ≡ `<x>`, and cmark's newline inside otherwise-empty elements | parsing only, not serialisation |

Measured on 2026-10-06, the difference is large and matters:

| Parser | spec-exact | semantic |
|--------|-----------:|---------:|
| markdown-it 15.0.2, `commonmark` preset | **649 / 652 = 99.54 %** | **652 / 652 = 100 %** |
| markdown-it 15.0.2, `default` preset | 591 / 652 = 90.64 % | **652 / 652 = 100 %** |
| marked 18.1.0, defaults | 506 / 652 = 77.61 % | 554 / 652 = 84.97 % |

The 61-example gap for markdown-it's `default` preset is **entirely** HTML5
void-element serialisation (`<br>` vs `<br />`). It is not a parsing defect.
That single fact is the reason our CI gate is written the way it is.

---

## 3. The symbol legend

Every syntax item carries exactly one provenance tag. These are **not** quality
grades; they are statements about where the rule comes from and therefore about
how much authority it has and what happens if we violate it.

| Tag | Means | Authority | If we get it wrong, who complains? |
|-----|-------|-----------|-----------------------------------|
| **CORE** | Defined in CommonMark 0.31.2 and nothing else. | Spec §–number + example numbers. Normative, machine-testable. | Everyone who has read the spec. GitHub, Obsidian, pandoc, VS Code all agree here. |
| **GFM** | A named extension in the GFM spec (`0.29-gfm`). | GFM §-number + example numbers. A strict superset of CORE. | Only people rendering GitHub content. |
| **EXTENSION** | Defined by a *widely used* third-party engine but **not** in CommonMark or GFM: footnotes, definition lists, math, Mermaid, callouts, wikilinks. | The upstream project's docs. No neutral arbiter. | Whoever opened the file in *their* editor and got something different from us. |
| **DIALECT** | A named, whole alternative grammar: Pandoc's Markdown, MultiMarkdown, PHP Markdown Extra, kramdown, Quarto/MyST. | The dialect's own manual. Deliberately *diverges* from CommonMark. | Users of that dialect. We should not try to be that dialect. |
| **NONSTANDARD** | One product's private syntax with no spec at all: Obsidian wikilinks, Logseq `((uuid))`, Typora's `[TOC]`. | Vendor documentation only, and it can change without notice. | Only that product's users. |

### 3.1 Two rules that follow from the legend

1. **CORE is a floor, never a ceiling.** We must be 100 % semantically conformant
   on CORE. Every other tag is a *configuration toggle*.
2. **A DIALECT is a mode, not a layer.** Turning on "pandoc mode" is allowed to
   *disable* CORE behaviour (pandoc's `strikeout` / `subscript`, for example,
   reinterpret `~~x~~`). We therefore will not implement DIALECTs as a single
   "superset" mode — see [03 §12](03-extensions-and-dialects.md#12-our-recommendation-matrix).

---

## 4. Source inventory (pinned)

Everything in this folder was read from the sources below. Versions are pinned
because "latest" is not citable.

| Source | Version | Retrieved | URL | Used for |
|--------|---------|-----------|-----|----------|
| CommonMark Spec | **0.31.2 (2024-01-28)** | 2026-10-06 | <https://spec.commonmark.org/0.31.2/> | All CORE rows |
| CommonMark `spec.json` | 0.31.2 | 2026-10-06 | <https://spec.commonmark.org/0.31.2/spec.json> | 652 machine-readable examples |
| CommonMark `spec.txt` | 0.31.2 | 2026-10-06 | <https://spec.commonmark.org/0.31.2/spec.txt> | Canonical source, diffable |
| CommonMark changelog | through 0.31.2 | 2026-10-06 | <https://spec.commonmark.org/changelog.txt> | "what changed in 0.30/0.31" |
| GitHub Flavored Markdown Spec | **0.29-gfm (2019-04-06)** | 2026-10-06 | <https://github.github.com/gfm/> | All GFM rows |
| `cmark-gfm` `test/spec.txt` | master (0.29-gfm) | 2026-10-06 | <https://raw.githubusercontent.com/github/cmark-gfm/master/test/spec.txt> | 672 machine-readable GFM examples |
| `cmark-gfm` `pathological_tests.py` | master | 2026-10-06 | <https://raw.githubusercontent.com/github/cmark-gfm/master/test/pathological_tests.py> | DoS input shapes, [04 §12](04-edge-cases-and-traps.md#12-catastrophic-backtracking-redos) |
| Original Markdown syntax | 2002–2026 page | 2026-10-06 | <https://daringfireball.net/projects/markdown/syntax> | Gruber's rules; where CommonMark deliberately differs |
| PHP Markdown Extra | undated | 2026-10-06 | <https://michelf.ca/projects/php-markdown/extra/> | Footnotes, definition lists, abbreviations, attribute blocks |
| Pandoc User's Guide | live (3.x) | 2026-10-06 | <https://pandoc.org/MANUAL.html> | Extension list |
| MultiMarkdown 6 syntax | MMD 6 | 2026-10-06 | <https://fletcher.github.io/MultiMarkdown-6/syntax/> | MMD syntax |
| Obsidian Help (`obsidianmd/obsidian-help`, `master`) | live | 2026-10-06 | <https://github.com/obsidianmd/obsidian-help> | Obsidian extensions |
| Logseq docs | live | 2026-10-06 | <https://github.com/logseq/docs> | Logseq extensions |
| VS Code Markdown docs + 1.121 release notes | 1.121 (2026-05-20) | 2026-10-06 | <https://code.visualstudio.com/docs/languages/markdown> | What an editor-class viewer must match |
| IANA *Markdown Variants* registry | last updated 2026-09-24 | 2026-10-06 | <https://www.iana.org/assignments/markdown-variants> | The authoritative list of *named* dialects |
| RFC 7763 / RFC 7764 | 2016-03-22 | 2026-10-06 | <https://www.rfc-editor.org/rfc/rfc7764.html> | `text/markdown`, `variant=` parameter, flavor names |
| Whatwg HTML | living | 2026-10-06 | <https://html.spec.whatwg.org/entities.json> | The authoritative entity table used by CommonMark §2.5 |

### 4.1 SHA-256 of the machine-readable inputs

Use these to pin fixtures in CI and to detect upstream tampering.

```text
d431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20  spec.json         (CM 0.31.2, 652 examples)
7d8e5814befec287ac116786d81ff14e0adc9b13295b4494649e995408fd871c  gfm-spec.txt      (GFM 0.29-gfm, 672 examples)
```

`spec.txt` for CommonMark 0.31.2 is 204 538 bytes; `spec.json` is 140 264 bytes;
`cmark-gfm/test/spec.txt` is 216 680 bytes (the byte counts were verified by
HTTP fetch on 2026-10-06).

### 4.2 Licensing note — this matters before we vendor anything

* CommonMark spec **and** `spec.txt` are **CC-BY-SA 4.0**. Vendoring the 652
  examples into `packages/test-fixtures/` therefore puts a **share-alike
  obligation** on that directory. See
  [05 §10](05-test-fixture-strategy.md#10-licensing-and-attribution).
* `cmark-gfm`'s `pathological_tests.py` is also CC-BY-SA 4.0, same consequence.
* GFM's spec is CC-BY-SA 4.0.
* Obsidian's help repository and all Obsidian prose are proprietary; we cite
  and paraphrase, we do **not** vendor.
* IANA and RFC text is freely redistributable with attribution.

**Recommendation for the ADR:** vendor the CommonMark examples (share-alike is
acceptable for a test-data directory and is what `micromark`, `cmark` and
`markdown-it` all do), and *re-derive* the pathological inputs from shapes rather
than copying the file verbatim.

---

## 5. The five facts that will drive the architecture

If you read nothing else in this folder, read these. Each is backed by a
measurement or a spec citation in the linked doc.

### 5.1 Block structure beats inline structure, always

CommonMark §3.1: *"Indicators of block structure always take precedence over
indicators of inline structure."*

```diff
- `one
- two`
```

is **two list items**, not one item containing a code span. This single rule
forces the two-phase parser (line-by-line blocks, then per-block inlines) that
every conforming implementation uses. → [01 §2](01-block-elements.md#2-precedence-commonmark-31)

### 5.2 The `---` line has three claimants and a fixed priority order

A line of three or more `-` can be (a) a **setext** `<h2>` underline,
(b) a **thematic break**, or (c) **YAML front matter**. The priority is:

> setext underline **>** thematic break **>** front matter (and front matter
> only wins if it is the *first* thing in the file).

This is the single most common bug in hand-rolled Markdown parsers, and it is the
reason front-matter stripping must happen in a **pre-pass that runs before the
block parser** and never inside it. → [01 §14](01-block-elements.md#14-front-matter-conventions)

### 5.3 `markdown-it` is 100 % semantically CommonMark-conformant but only ~91 % byte-exact

Measured 2026-10-06 on the 652 official examples, Node 24.14.1:

| Configuration | spec-exact | semantic |
|---------------|-----------:|---------:|
| `markdown-it('commonmark')` | 99.54 % | **100.00 %** |
| `markdown-it({html:true})` | 90.64 % | **100.00 %** |
| `marked.marked.parse()` | 77.61 % | 84.97 % |

Two lessons: (1) never gate CI on byte-exact HTML; (2) `marked` is **not** a
conformance baseline. → [05 §5](05-test-fixture-strategy.md#5-two-tiers-of-conformance)

### 5.4 Emphasis is not regular, and `_` is not `*`

CommonMark §6.2 requires a delimiter-stack algorithm with left/right-flanking
classification, an `_`-specific extra condition, and the **rule of three**.
`foo*bar*` is emphasis; `foo_bar_` is not. A regex will never be correct.
The section contains **132 official examples** (Examples 350–481) — more than
any other section. → [02 §4](02-inline-elements.md#4-emphasis-and-strong-emphasis-commonmark-62)

### 5.5 The dangerous inputs are not the weird ones, they are the *repetitive* ones

Verified on Node 24.14.1, 2026-10-06:

| Input | Parser | Time |
|-------|--------|-----:|
| `"_a ".repeat(65000)` (65 000 unclosed emphasis openers, 195 KB) | `marked` 18.1.0 | **est. 33 minutes** (measured 30.5 s at n=8000, quadratic) |
| `"_a ".repeat(65000)` | `markdown-it` 15.0.2 | **< 1 s** (linear) |
| `"> ".repeat(2500)` (nested block quotes) | `marked` 18.1.0 | **RangeError: Maximum call stack size exceeded** |
| `"> ".repeat(40000)` | `markdown-it` 15.0.2 | **3 ms** |
| `"</" + "<!--".repeat(20000)` | `markdown-it` 15.0.2 | **9.6 s** (superlinear, ≈ n^1.8) |
| 1000-deep indented list | `marked` 18.1.0 | 9.0 s (quadratic) |

A viewer that opens untrusted `.md` files *must* have a size/depth/time budget.
→ [04 §12](04-edge-cases-and-traps.md#12-catastrophic-backtracking-redos)

---

## 6. How to use this folder

### 6.1 If you are writing the parser

1. Implement strictly from [01](01-block-elements.md) and [02](02-inline-elements.md).
   Do not consult a third-party parser's source to decide a rule.
2. For every row you implement, add a fixture. The spec already gives you 652
   CORE fixtures and 672 GFM fixtures — you do not need to invent them.
3. Run the suite on **every** commit. Target: 100 % of CORE at the *semantic*
   tier, and a documented, shrinking list at the spec-exact tier.
4. When your output differs from a fixture, decide which of three things is true
   and write it down: (a) we have a bug, (b) the spec's HTML is not normative
   here, or (c) we are implementing a non-default mode. Case (c) must be behind
   a flag and must be visible in the test report.

### 6.2 If you are deciding product scope

Read [03](03-extensions-and-dialects.md) §12 first (the recommendation matrix),
then §11 (the compatibility matrix across CommonMark, GFM, marked, markdown-it,
GitHub, Obsidian, pandoc, VS Code, Typora, MarkText). The short version:

* Ship **CORE** and **GFM** on by default, always.
* Ship **EXTENSION** on by default where it is present in real-world files:
  tables, task lists, strikethrough, footnotes, YAML front matter, math,
  Mermaid, wikilinks. Obsidian and Logseq vaults are full of them.
* Ship **DIALECT** and **NONSTANDARD** syntaxes only behind opt-in flags.

### 6.3 If you are writing tests

Start at [04](04-edge-cases-and-traps.md) — every row there is a bug report for
someone. Then [05](05-test-fixture-strategy.md) for the harness.

### 6.4 If you are reviewing a PR that touches parsing

Ask these five questions:

1. Does the change have a fixture? (No fixture ⇒ not reviewable.)
2. Which spec section number does the rule come from? ("CommonMark says so" is
   not an answer.)
3. Does it change any *existing* fixture's expected output? If yes, that is a
   behaviour change and needs an ADR, not a drive-by edit.
4. Does it add unbounded recursion or a new regex? See
   [04 §12–13](04-edge-cases-and-traps.md#12-catastrophic-backtracking-redos).
5. Is the new syntax tagged CORE/GFM/EXTENSION/DIALECT/NONSTANDARD? If not, the
   change is undocumented and incomplete.

---

## 7. Known gaps in this folder

Honesty register. These are *not* covered and should not be assumed:

| Gap | Why | Where it should go |
|-----|-----|--------------------|
| Djot | A serious modern competitor to CommonMark (John MacFarlane, <https://djot.net>). Not surveyed. | `03-specifications/` |
| MyST / Quarto / kramdown-rfc2629 / Fountain | Registered in IANA's *Markdown Variants* registry; only named, not analysed. | `03-specifications/` |
| GitLab Flavored Markdown (GLFM) | Mentioned only via the IANA registry; it is CommonMark + GFM + its own cruft. | `03-specifications/` |
| `text/markdown` media type + `variant=` parameter | RFC 7763/7764 exist and are directly relevant to how we should *tag* files we render. Only summarised. | `05-rendering/` |
| Mermaid grammar itself | We treat ```` ␃␃␃mermaid ```` as "opaque fenced block handed to Mermaid.js"; the diagram DSL is out of scope. | `13-competitors/` |
| KaTeX / MathJax rendering of math | This folder covers `$…$` *recognition*, not TeX typesetting. | `05-rendering/` |
| GitHub's HTML sanitiser (`github/markup`) | Only the GFM `tagfilter` extension is in scope; GitHub's real sanitiser is a separate allow-list. | `11-security/` |
| An actual WHATWG Markdown standard | **Does not exist.** See [03 §6](03-extensions-and-dialects.md#6-whatwg--there-is-no-whatwg-markdown). | n/a |

---

## 8. Maintenance

* **Spec bumps.** When CommonMark releases 0.32, diff `spec.txt`, list the changed
  examples, add the new `spec.json` under a new pinned directory
  (`packages/test-fixtures/commonmark/0.32/`), and run both. Do not silently
  replace 0.31.2.
* **New extension requests.** Go through [03 §12](03-extensions-and-dialects.md#12-our-recommendation-matrix).
  A new syntax needs: a source citation, at least one `SOURCE`/`HTML`/`RULE`
  block, and three fixtures (valid, invalid, and one interaction case).
* **New trap.** Add it to [04](04-edge-cases-and-traps.md) *and* to the fixture
  set, in the same PR. A trap without a fixture is a comment.
