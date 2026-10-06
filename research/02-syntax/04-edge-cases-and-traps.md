# 04 — Edge cases and traps

> **Scope.** The inputs that break naive parsers. Every row here is a bug report
> for somebody. The tables are written to be lifted directly into
> `packages/test-fixtures/traps/` as regression tests.
>
> `→` = TAB (U+0009) · `␣` = one SPACE · `␤` = LINE FEED · `␍` = CARRIAGE RETURN · `␀` = NUL · `␃` = BACKTICK. Real backticks appear only as code-span delimiters. See [README §2.0](README.md#20-the-visible-glyph-convention).
>
> **Provenance of the measurements.** Timings in §11 and §12 were produced on
> **Windows / Node v24.14.1** on **2026-10-06** against
> `markdown-it@15.0.2` (UMD build) and `marked@18.1.0` (UMD build). Absolute
> numbers will differ on other hardware; the **scaling shape** will not. Every
> pathological input shape is transcribed from `cmark`'s
> [`test/pathological_tests.py`](https://raw.githubusercontent.com/github/cmark-gfm/master/test/pathological_tests.py)
> (CC-BY-SA 4.0), which is the closest thing the Markdown world has to a
> ReDoS conformance suite.

---

## 1. How to read the master table

| Input | Correct output | Naive output | Why it differs |
|-------|----------------|--------------|----------------|
| The literal bytes | The CommonMark 0.31.2 / GFM 0.29-gfm HTML | What a regex- or single-pass parser emits | The rule that the naive version misses |

Example rows in this document follow that shape. Trailing-whitespace
significance is called out as `␣`; a real tab is `→`.

---

## 2. Nested emphasis ambiguity

### 2.1 The classic mis-parse

| Input | Correct | Naive | Why |
|-------|---------|-------|-----|
| `*foo *bar**` | `<em>foo <em>bar</em></em>` | `<em>foo *bar</em>*` | Rule of three: 1 + 2 = 3 blocks the `**` close |
| `**foo *bar***` | `<strong>foo <em>bar</em></strong>` | `<strong>foo <em>bar</em>**` | |
| `***foo** bar*` | `<em><strong>foo</strong> bar</em>` | `<strong><em>foo</strong> bar</strong>*` | Rule 14 prefers `<em><strong>` |
| `*foo **bar baz**` | `<p>*foo <strong>bar baz</strong></p>` | `<p><em>foo </em><strong>bar baz</strong></p>` | Rule 16: same closer ⇒ **shorter wins** |
| `**foo **bar baz**` | `<p>**foo <strong>bar baz</strong></p>` | `<p><strong>foo **bar baz</strong></p>` | Rule 16 |
| `*foo _bar* baz_` | `<p><em>foo _bar</em> baz_</p>` | `<p><em>foo <em>bar</em></em> baz</p>` | Rule 15: overlapping ⇒ first takes precedence |
| `**_foo_**` | `<p><em><em>foo</em></em></p>` | `<p><strong>foo</strong></p>` | Rule 13: nested emphasis must switch delimiter characters |
| `****foo****` | `<p><strong><strong>foo</strong></strong></p>` | `<p><em><em><em><em>foo</em></em></em></em></p>` | Rule 14.1: **minimise nestings** first |
| `foo***bar***baz` | `<p>foo<em><strong>bar</strong></em>baz</p>` | `<p>foo***bar***baz</p>` | Both runs are multiples of 3 ⇒ the sum-must-not-be-multiple-of-3 clause does not block |
| `**foo*bar***` | `<p><strong>foo*bar</strong></p>` | `<p><em><em>foo</em>bar</em>**</p>` | CommonMark **0.26** changed this deliberately |
| `*foo**bar**baz*` | `<p><em>foo<strong>bar</strong>baz</em></p>` | `<p><em>foo</em><em>bar<em></em>baz</em></p>` | Rule of three, 1 + 2 = 3 |

### 2.2 What a regex cannot do

Any grammar where a `*` may open or close *depending on its neighbours in a way
that depends on the whole run* is not regular. The four conditions that make it
non-regular:

1. A delimiter run's length is compared **modulo 3** against a *different* run's length.
2. Whether a run can open depends on whether it is *also* right-flanking, which
   depends on the characters on **both** sides.
3. Emphasis nests to **unbounded** depth.
4. Link brackets participate in the same delimiter stack.

**Therefore: no regular expression, finite-state scanner, or "match balanced
pairs" approach can be correct.** The delimiter-stack algorithm in
[02 §4.9](02-inline-elements.md#49-the-delimiter-stack-algorithm-appendix-a-process-emphasis)
is mandatory. All 132 fixtures of §6.2 must pass.

---

## 3. List vs setext vs thematic break ambiguity

### 3.1 The three-way `---`

| Input | Correct | Naive | Rule |
|-------|---------|-------|------|
| `Foo␣␣` / `---` / `bar` | `<h2>Foo␣␣</h2>` + `<p>bar</p>` | `<p>Foo␣␣</p><hr /><p>bar</p>` | CM §4.1 Ex. 59: setext beats thematic break |
| `Foo` / `---` | `<h2>Foo</h2>` | `<p>Foo</p><hr />` | same |
| `Foo` / `---` / `Bar` / `---` | `<h2>Foo\nBar</h2>` | two headings | §4.3 Ex. 95 — multi-line setext |
| `---` / `---` | `<hr /><hr />` | one heading, one break | §4.3 Ex. 98 — first line is a break, second has no text above |
| `Foo` / `= =` | `<p>Foo\n= =</p>` | `<h1>Foo</h1>` | §4.3 Ex. 88 — internal space in the underline |
| `Foo` / `---␣␣` | `<h2>Foo</h2>` | `<p>Foo</p><hr />` | §4.8 Ex. 226: trailing spaces stripped before inline parsing |
| `Foo\` / `----` | `<h2>Foo\</h2>` | `<h2>Foo</h2>` + break | §4.3 Ex. 90 |
| `Foo` / `    ---` | `<p>Foo\n---</p>` | `<h2>Foo</h2>` | §4.3 Ex. 87 — 4-space indent |
| `Foo` / `-` | `<p>Foo</p><ul><li></li></ul>` | `<h2>Foo</h2>` | **CM 0.26**: empty list items cannot interrupt a paragraph, and a single `-` is an empty list item |

### 3.2 `* * *` — break vs list

| Input | Correct | Naive | Rule |
|-------|---------|-------|------|
| `* Foo` / `* * *` / `* Bar` | list, `<hr />`, list | one list with a break as item 2 | §4.1 Ex. 60 |
| `- Foo` / `- * * *` | `<ul><li>Foo</li><li><hr /></li></ul>` | two breaks, or a break between lists | §4.1 Ex. 61 |
| `foo␣␣` / `***` / `bar` | `<p>foo</p><hr /><p>bar</p>` | one paragraph | §4.1 Ex. 58 |
| `a` / `*a*` | `<p>a\n<em>a</em></p>` | `<p>a <em>a</em></p>` | §4.1 Ex. 56 — a mixed line is not a break |

### 3.3 List indentation — the columns fallacy

| Input | Correct | Naive | Rule |
|-------|---------|-------|------|
| `- one` / *blank* / `␣two` | `<ul><li>one</li></ul><p>two</p>` | two items | §5.2 Ex. 255 — **the blank line is required**; without it, ` two` is a *lazy continuation* |
| `- one` / *blank* / `␣␣two` | one item, two paragraphs | two items | §5.2 Ex. 256 |
| `␣␣␣␣␣-␣␣␣␣one` / *blank* / `␣␣␣␣␣␣two` | item + `<pre><code> two` | item with two paragraphs | §5.2 Ex. 257 — N is capped at 4 |
| `- one␤ ␣two` (no blank line) | `<ul><li>one two</li></ul>` | `<ul><li>one</li></ul><p>two</p>` | §5.2 rule #5 — **laziness**. This is the single most commonly mis-transcribed list fixture |
| `␣␣␣>␣>␣1.␣␣one` / `>>` / `>>␣␣␣␣␣two` | `two` **is** in the item | `two` is a sibling | §5.2 Ex. 259 — column comparison is wrong |
| `>>- one` / `>>` / `␣␣>␣␣> two` | `two` is **not** in the item | it is | §5.2 Ex. 260 |
| `-␣␣␣␣foo` / `␣␣bar` | list + paragraph | item with two paragraphs | §5.2 Ex. 276 — 3-space first block is not covered by rules #1/#2 |
| `- a` / `␣- b` / `␣␣- c` / `␣␣␣- d` / `␣␣- e` / `␣- f` / `- g` | 7 siblings, 7 spaces total | a nested tree | §5.3 Ex. 310 |
| `- a` / `␣- b` / `␣␣- c` / `␣␣␣- d` / `␣␣␣␣- e` | `- e` becomes text of item `d` | 5 siblings | §5.2 Ex. 312 — **>3 spaces never opens a list item** |

### 3.4 Which construct wins — the decision list

Implemented as a linear scan, in this order (§16 of [01](01-block-elements.md#16-the-precedence-table-we-will-implement)):

| Order | Construct | Beats |
|------:|-----------|-------|
| 1 | indented code (≥4 columns) | heading, break, quote, list |
| 2 | fence | paragraph, list |
| 3 | ATX heading | paragraph |
| 4 | HTML block 1–5 | paragraph |
| 5 | HTML block 6 | 1–5 |
| 6 | block quote | paragraph |
| 7 | setext underline | thematic break |
| 8 | thematic break | list item |
| 9 | list item | paragraph continuation |
| 10 | table | paragraph continuation |

---

## 4. HTML blocks swallowing Markdown

| Input | Correct | Naive | Rule |
|-------|---------|-------|------|
| `<div></div>` / ```` ␃␃␃ c ```` / `int x = 33;` / ```` ␃␃␃ ```` | one raw HTML block containing the fences | a `<pre><code>` block | §4.6 Ex. 161 — **type 6 ends at the next blank line** |
| `<table><tr><td>` / `<pre>` / `**Hello**,` / blank / `_world_.` / `</pre>` / `</td></tr></table>` | `<table>…**Hello**,</td></tr></table>` then `<p><em>world</em>.</p>` | Markdown parsed inside the `<table>` | §4.6 Ex. 148 — the block's end condition was fixed at its start |
| `<del>` / `*foo*` / `</del>` | raw: `<del>\n*foo*\n</del>` | `<p><em>foo</em></p>` inside | §4.6 Ex. 166 |
| `<del>` / blank / `*foo*` / blank / `</del>` | `<del>` raw, then `<p><em>foo</em></p>` | one block | §4.6 Ex. 167 |
| `<del>*foo*</del>` | `<p><del><em>foo</em></del></p>` | raw block | §4.6 Ex. 168 — tag not alone on its line ⇒ **inline** |
| `Foo` / `<a href="bar">` / `baz` | one paragraph | `<p>Foo</p><a …>baz` | §4.6 Ex. 187 — **type 7 cannot interrupt a paragraph** |
| `Foo` / `<div>` / `bar` / `</div>` | paragraph + raw block | all one paragraph | §4.6 Ex. 185 — types 1–6 *can* interrupt |
| `<style` / `␣␣type="text/css">` / blank / `foo` / blank / blank | raw to EOF | `<p>foo</p>` | §4.6 Ex. 173 — no matching end tag ⇒ end of container |
| `<!-- foo -->*bar*` / `*baz*` | `<!-- foo -->*bar*` raw, then `<p><em>baz</em></p>` | `<p><em>bar</em></p>` | §4.6 Ex. 177 — end tag on the start line |
| `<script>` / `foo` / `</script>1. *bar*` | all raw | `<p>` after `</script>` | §4.6 Ex. 178 |
| `<table>` / blank / `␣␣<tr>` / blank / `␣␣␣␣<td>` … | `<table><pre><code>&lt;td&gt;` | clean table | §4.6 Ex. 191 — 4-space indent ⇒ code block *inside* an HTML block |

**The security consequence.** `<script>` is a type-1 HTML block and is passed
through verbatim. `<style type="text/css">` with no closing tag swallows the rest
of the document. Both are reasons the sanitiser and a raw-HTML size cap are
mandatory, not optional. → [01 §9.1](01-block-elements.md#91-security-implications--read-this-before-implementing)

---

## 5. Lazy continuation

| Input | Correct | Naive | Rule |
|-------|---------|-------|------|
| `> # Foo` / `> bar` / `baz` | quote with `h1` + 2-line paragraph | quote, then a top-level paragraph | §5.1 Ex. 232 |
| `> bar` / `baz` / `> foo` | one quote, one paragraph, 3 lines | two quotes | §5.1 Ex. 233 |
| `>>> foo` / `bar` | 3-deep quote, 2-line paragraph | 3-deep quote with 1 line, then a paragraph | §5.1 Ex. 250 |
| `> foo` / `---` | quote + `<hr />` | `<blockquote><h2>foo</h2></blockquote>` | §5.1 Ex. 234 — `---` is not paragraph continuation text |
| `> - foo` / `- bar` | quote with 1-item list, then a sibling list | one list of 2 inside the quote | §5.1 Ex. 235 |
| `> \`\`\␃␃ / `foo` / `\`\`\␃␃ | empty code in quote, `<p>foo</p>`, empty code | one big code block in the quote | §5.1 Ex. 237 |
| `> foo` / `␣␣␣␣- bar` | quote, one paragraph, `- bar` as text | quote ending, list outside | §5.1 Ex. 238 — with `> ` prefixed it *would* be an indented code block, which cannot interrupt a paragraph, so it is continuation text |
| `␣␣1.␣␣A paragraph` / `with two lines.` / blank / `␣␣␣␣␣␣␣␣indented code` / blank / `␣␣> A block quote.` | one item with all three blocks | item text stops after the first line | §5.2 Ex. 290 — laziness applies to **list items** too (rule #5) |
| `␣␣1.␣␣A paragraph` / `␣␣␣␣with two lines.` | one tight item | one loose item | §5.2 Ex. 291 — partial indentation deletion |

**Implementation predicate.** A line lacking its container's marker continues
the container **iff** the line would be *paragraph continuation text* after
removing the markers already consumed. That means: reject laziness if the line
would open a thematic break, a list item, an ATX heading, a fence, an indented
code block, or an HTML block.

---

## 6. Entity edge cases

| Input | Correct | Naive | Rule |
|-------|---------|-------|------|
| `&#42;foo&#42;` | `<p>*foo*</p>` (literal asterisks) | `<p><em>foo</em></p>` | §2.5 Ex. 37 — entities cannot create structure |
| `&#42; foo` / `* foo` | `<p>* foo</p>` + `<ul><li>foo</li></ul>` | one list | §2.5 Ex. 38 |
| `foo&#10;&#10;bar` | `<p>foo␤␤bar</p>` — **one** paragraph | two paragraphs | §2.5 Ex. 39 — `&#10;` is not a line ending |
| `&#9;foo` | `<p>→foo</p>` — literal tab | an indented code block | §2.5 Ex. 40 |
| `[a](url &quot;tit&quot;)` | literal | `<a href="url" title="tit">a</a>` | §2.5 Ex. 41 — entities are not title delimiters |
| `&copy` | `&amp;copy` | `©` | §2.5 Ex. 29 — **HTML5 allows no-semicolon entities; CommonMark does not** |
| `&nbsp` | `&amp;nbsp` | U+00A0 | §2.5 Ex. 28 |
| `&hi?;` | `&amp;hi?;` | ??? | §2.5 Ex. 28 |
| `&ngE;` | **two** code points: `≧` + `̸` | one char | §2.5 Ex. 25 |
| `&HilbertSpace;` | **one** code point | a space + `ℋ` | §2.5 Ex. 25 |
| `&#87654321;` (8 digits) | literal | U+10FFFFD or a throw | §2.5 Ex. 28 + 0.29 digit limits |
| `&#abcdef0;` (7 hex digits) | literal | decoded | §2.5 Ex. 28 — hex limit is 6 |
| `&#X22;` and `&#x22;` | both `"` | only lowercase `x` | §2.5 Ex. 27 |
| `&#0;` | U+FFFD | dropped | §2.3 / §2.5 Ex. 26 — **replace, never omit** |
| `&ouml;` inside `` ␃code␃ `` | `&amp;ouml;` | `ö` | §2.5 Ex. 35 |
| `&ouml;` in an info string | decoded (`language-föö`) | literal | §2.5 Ex. 34 |
| `&ouml;` inside `<a href="…">` | preserved raw | decoded | §2.5 Ex. 31 / §6.6 Ex. 630 |
| `\&ouml;` | literal `&ouml;` | `&amp;ouml;` | §2.4 Ex. 14 — escape beats entity |

**Performance note.** Entity decoding must be a **table lookup on the WHATWG
`entities.json`**, not a regex over "looks like `&…;`". A regex entity decoder
is both slow and wrong for the ~2 231 names.

---

## 7. Characters, line endings, and BOM

### 7.1 Line endings

| Input bytes | CommonMark verdict | Naive |
|-------------|--------------------|-------|
| `a\na` | two lines | one line (if only `\n` is handled) |
| `a\ra` (classic Mac CR only) | two lines | one line |
| `a\r\na` | two lines | **three** lines if `\r` and `\n` are split separately |
| `a\r\na\rb\nc` (mixed) | three lines | varies |

CM §2.1 defines a line ending as LF, or CR-not-followed-by-LF, or CRLF. The
**correct tokenizer is: scan for `\r\n`, `\r`, or `\n` in that order.** A parser
that splits on `/\r?\n/` will leave a bare `\r` inside a line and fail.

**Verification fixture:** the same document written three ways (LF, CRLF, CR)
must produce **byte-identical** block trees. Only the sourcepos offsets differ.

### 7.2 BOM

| Byte sequence | Should | Naive |
|---------------|--------|-------|
| `EF BB BF` at file start | **Strip before parsing** | Becomes U+FEFF, which is Unicode `Cf` (a format character, not whitespace) |

Consequences if not stripped:

| Case | Symptom |
|------|---------|
| `# Heading` after BOM | The ATX opener is preceded by U+FEFF, which is neither a space nor a tab ⇒ **not a heading** |
| `> quote` after BOM | Not a block quote |
| `` ␃code␃ `` after BOM | The backtick string is "preceded by U+FEFF" — U+FEFF is not a backtick, so it still works, but the literal U+FEFF ends up in the output |
| Front matter `---` after BOM | **Front-matter detection fails**, because the fence is no longer at byte 0 |

CommonMark §2.1 does not mention a BOM (it is silent about encodings). **This is
an inference from practice, not a spec requirement** — but every real Markdown
file we have seen from Windows tooling has been observed to carry one, and all
three behaviours above are real bugs. Our rule: **strip a leading UTF-8 BOM, and
also handle UTF-16 BOMs (`FF FE` / `FE FF`) by transcoding to UTF-8 first.**

A UTF-16LE Markdown file read as UTF-8 yields `�` runs and no structure at all.
We must sniff and transcode. → [09-platform](../09-platform/)

### 7.3 Other invisible characters

| Code point | Name | In CommonMark? | Effect if mishandled |
|-----------|------|----------------|----------------------|
| U+00A0 | NO-BREAK SPACE | **Unicode whitespace** (Zs) | Satisfies "followed by whitespace" in flanking rules (§6.2 Ex. 353) |
| U+2007 | FIGURE SPACE | Unicode whitespace | same |
| U+2028 / U+2029 | LINE / PARAGRAPH SEPARATOR | **Not** whitespace in the CM definition, **not** a line ending | Treated as ordinary characters. A naive `split(/\s+/)` will split on U+2028 and produce a wrong tree |
| U+FEFF | ZWNBSP | Category `Cf`, not whitespace, not punctuation | See above |
| U+0000 | NULL | Must become U+FFFD | §2.3 |
| U+200E / U+200F | LRM / RLM | Category `Cf` | **Not** punctuation ⇒ a delimiter next to them is classified by the *other* side |
| U+200D | ZWJ | `Cf` | **Inside emoji.** Splitting grapheme clusters breaks emoji |
| U+0301 etc. | combining marks | `Mn`, not punctuation, not whitespace | See §8 |

---

## 8. Unicode traps

### 8.1 Right-to-left text and bidi markers

| Input | Correct | Naive | Why |
|-------|---------|-------|-----|
| `‏# heading` (RLM before `#`) | `<p># heading</p>` — **not** a heading | `<h1>heading</h1>` | U+200F is category `Cf`. CM §2.1 defines "up to three spaces of indentation"; U+200F is **not** a space ⇒ the `#` is not at the start of a line |
| `> ‎- item` (LRM after `>`) | list item | paragraph | Same: U+200E is not a space |
| `- ‏*emph*` | emphasis | not emphasis | The `*` run is preceded by U+200F which is neither whitespace nor punctuation ⇒ **left-flanking test (2a) passes** but the opener is not preceded by whitespace… this is genuinely subtle; get the classification right by consulting CM §2.1 rather than guessing |
| `**שלום**` | `<strong>שלום</strong>` | — | Hebrew is alphabetic, so `**` is both left- and right-flanking |
| `пристаням_стремятся_` | literal | `<em>` | §6.2 Ex. 362 — Cyrillic is alphabetic ⇒ intraword `_` rejected |

**Concrete danger.** Hebrew/Arabic notes are common in Obsidian and Logseq
vaults, and RTL text at the start of a line is exactly where people put `#`,
`-`, `>`, and `|`. A viewer that only tests for `x === ' '` will mis-parse them.

**Rule:** indentation must be measured in **CM §2.1 "space" (U+0020) and "tab"
(U+0009) only**, and nothing else. Do not use a generic `\s` test.

### 8.2 Emoji, ZWJ sequences, and variation selectors

| Sequence | Code points | Graphemes | Trap |
|----------|------------:|----------:|------|
| `👍` | 1 | 1 | baseline |
| `👍🏽` (skin tone) | 2 | 1 | must not be split |
| `👨‍👩‍👧‍👦` (family) | 5 (`Z` + 4 emoji, 3 × U+200D) | 1 | `Intl.Segmenter` required; naive `Array.from` gives 5 |
| `❤️` | 2 (U+2764 + U+FE0F) | 1 | U+FE0F is `Mn` |
| `#️⃣` (keycap) | 3 | 1 | |
| `🇺🇳` (flag) | 2 regional indicators | 1 | |

Markdown-specific consequences:

| Situation | Trap |
|-----------|------|
| Emoji inside `*…*` | U+FE0F is `Mn`, not punctuation, so flanking works the same as with a letter |
| Emoji immediately after `**` | `**👍text**` — the closer is preceded by `d`, fine. But `😀**text**` at line start is fine too. The trap is `👨‍👩‍...**x**` where a naive implementation strips ZWJ and mis-classifies |
| Emoji as a list marker | `- 👍 item` — the `-` rule is unaffected |
| Emoji in a heading used for a slug | `# 👍 Hello` — our slug algorithm must handle astral planes and ZWJ |
| Emoji as a width-2 character in a table | CJK/emoji **column alignment** breaks: `\| a \|` vs `\| 👍 \|` renders misaligned |

### 8.3 CJK and full-width characters

| Construct | ASCII form | CJK form | Trap |
|-----------|-----------|----------|------|
| Fullwidth `＃` (U+FF03) | `#` | `＃` | **Not** an ASCII punctuation character ⇒ `# heading` with a fullwidth hash is **plain text**. Naive `text.replace(/＃/g,'#')` would be wrong |
| Ideographic space U+3000 | ` ` | `　` | Category `Zs` ⇒ **Unicode whitespace**, but **not** a "space" for indentation purposes |
| Fullwidth `｜` (U+FF5C) | `\|` | `｜` | Not a GFM pipe ⇒ not a cell separator |
| Fullwidth `＞` | `>` | `＞` | Not a block quote marker |
| `。` `、` `，` `．` | ASCII punctuation | CJK punctuation | These are category `Po` ⇒ **they count as Unicode punctuation** in flanking rules. `*好。*好。*` behaves differently from `*a.b*` |
| CJK text has **no** inter-word spaces | | | Line-wrapping and soft-break handling: a wrapped CJK paragraph must not gain spaces at soft breaks |

**Table alignment trap.** GFM tables align in the *source*; a CJK or emoji cell
makes the visual alignment wrong. CommonMark/GFM say nothing about display
width. Our decision must be: **render tables with `border-collapse` and let the
browser align**, and additionally ship an **optional East-Asian-aware source
formatter** for the editor — never silently reformat the user's file.

### 8.4 Combining characters and code points vs graphemes

| Input | Code points | Naive length | Correct length |
|-------|------------:|-------------:|---------------:|
| `ὐ` (U+1F50 alone) | 1 | 1 | 1 |
| `ὐ` (U+1F50 + U+0301) | 2 | 2 | 1 |
| `ȩ́` (U+1E69 + U+0301) | 2 | 2 | 1 |
| `ﬁ` (U+FB01 ligature) | 1 | 1 | 1 |
| `각` (U+AC01) | 1 | 1 | 1 |
| `👨‍👩‍👧‍👦` | 5 | 5 | 1 |
| `e` + U+0301 vs `é` (U+00E9) | 2 vs 1 | — | **Not equal.** `String.normalize('NFC')` makes them equal; that changes semantics and **must not** be applied to content |

CommonMark Example 3 (§2.2) is *precisely* this test:

```markdown
    a→a
    ὐ→a
```

The `ὐ` line must keep **two** characters and the tab must advance to the next
multiple of 4 **in code points**, giving `<code>ὐ\ta</code>` — a 3-column
first token followed by a tab to column 4. A parser that uses UTF-16 code units
or bytes gets the column wrong here.

**Rule for our codebase:** index by **code point**, never by UTF-16 code unit,
in the block phase. JavaScript strings are UTF-16, so iterate with
`for (const ch of s)` or `Array.from(s)` / `Intl.Segmenter`. In Rust, `str`
iteration is already code-point-based.

---

## 9. Tabs

| Input (`→` = tab) | Correct | Naive | Rule |
|--------------------|---------|-------|------|
| `→foo→baz→→bim` | `<pre><code>foo→baz→→bim` | expanding tabs ⇒ loses interior tabs | §2.2 Ex. 1 |
| `␣␣→foo` | code block | paragraph | 2 spaces + tab → column 4 |
| `→→→→bar` after a paragraph | code block | hard break + text | Indented code **can** follow a paragraph's sibling; only *interrupting* is forbidden |
| `␣␣- foo` / blank / `→bar` | item with 2 paragraphs | sibling paragraph | §2.2 Ex. 4 |
| `- foo` / blank / `→→bar` | item with `<pre><code>␣␣bar` | item with 2-space paragraph | §2.2 Ex. 5 |
| `>→→foo` | `<blockquote><pre><code>␣␣foo` | `<blockquote><pre><code>foo` | §2.2 Ex. 6 — **one space of the tab belongs to the `>` delimiter** |
| `-→→foo` | `<ul><li><pre><code>␣␣foo` | same as above | §2.2 Ex. 7 |
| `␣␣␣␣foo` / `→bar` | `<pre><code>foo\nbar` | second line treated as non-code | §2.2 Ex. 8 — code continues while indent ≥ 4 |
| `␣- foo` / `␣␣␣- bar` / `→␣- baz` | 3-level nest | flat list | §2.2 Ex. 9 — tab advances to column 4 |
| `#→Foo` | `<h1>Foo</h1>` | paragraph | §2.2 Ex. 10 — tab satisfies "space or tab" |
| `*→*→*→` | `<hr />` | paragraph | §2.2 Ex. 11 |

**Naive tab handling is the single most common bug in from-scratch parsers.**
The rule is *not* "expand tabs to 4 spaces". It is:

> Walk the line, tracking the current **column**. For a space, `col += 1`. For a
> tab, `col = (floor(col / 4) + 1) * 4`. Record, for each structural offset we
> care about (indent, marker end, content column), whether it was reached by
> spaces, by a tab, or by "past the end of the tab".

`cmark` literally does this: it records `partially_consumed_tab` /
`column_offset` and then *skips columns* when continuing an indented code block
(changelog 0.28: *"Fix typo and clarified tab expansion rule"*; changelog 0.22
added a mixed-indentation code-block test).

---

## 10. Trailing whitespace, empty documents, and whitespace-only files

| Input | Correct | Naive | Rule |
|-------|---------|-------|------|
| `foo␣␣␣␣␣` / `baz` | `<p>foo<br />\nbaz</p>` | `<p>foo   \nbaz</p>` | §4.8 Ex. 226 — **final** spaces of the paragraph are stripped before inline parsing, but a line in the middle is not |
| `foo␣␣` (alone) | `<p>foo</p>` | `<p>foo<br /></p>` | §6.7 Ex. 645 |
| `foo␣␣␣␣␣␣␣` / `baz` | `<p>foo<br />\nbaz</p>` | only exactly-2 counted | §6.7 Ex. 635 |
| `␣␣␣␣foo␣␣` | `<pre><code>foo␣␣` | trailing spaces trimmed | §4.4 Ex. 118 — **trailing spaces are part of code content** |
| `` ␃foo␣␣␃ `` | `<code>foo␣␣</code>` | `foo` | §6.1 — code spans preserve interior spaces |
| `` ␃␣␣␃ `` | `<code>␣␣</code>` | `<code></code>` | §6.1 Ex. 334 — no stripping when content is all spaces |
| `` ␃␣foo␣␃ `` | `<code> foo </code>` | `<code>foo</code>` | §6.1 Ex. 329/330 |
| `␣␣␣␣␣␣␣` (whitespace-only) | **nothing** | a paragraph of spaces | §4.9 — blank lines are ignored |
| ␃␃ (empty string) | **nothing**, exit 0, render an empty container | crash on `lines[0]` | §1.3: *"Any sequence of characters is a valid CommonMark document"* |
| `→` (one tab only) | **nothing** | a code block | blank line definition includes tabs |
| `␤` (LF only) | **nothing** | empty paragraph | |

**Empty-document contract.** Our renderer must handle, without throwing:

| Document | Expected |
|----------|----------|
| 0 bytes | empty container; no scrollbar; document title falls back to the filename |
| only a BOM | same as 0 bytes |
| only whitespace | same |
| only `---` (thematic break) | `<hr />` |
| only `---␣␣␣` | `<hr />` — thematic break, since front matter has no closing fence |
| `---` / `title: x` / `---` | front matter only, **no visible content** |
| `[]` / `[]: /uri` | two paragraphs (`§4.7 Ex. 551`) |
| ```` ␃␃␃ ```` | `<pre><code></code></pre>` (§4.5 Ex. 130) |
| `   ` (3 spaces) | nothing |

---

## 11. Deep nesting and stack depth

### 11.1 Measured recursion limits

Binary search on the smallest nesting depth that **throws**, Node 24.14.1,
default stack, 2026-10-06:

| Shape | markdown-it 15.0.2 | marked 18.1.0 |
|-------|:-----------------:|:-------------:|
| `"> " × n + "a"` (nested block quotes) | **no failure to n = 20 000**; 40 000 deep renders in **3 ms** | **`RangeError: Maximum call stack size exceeded` at n = 2 500** |
| `"  "×i + "- a\n"` nested to 1 000 levels | no failure (linear, 30 ms) | 9.0 s at depth 1 000; **OOM (`JavaScript heap out of memory`)** at depth ≥ 5 000 |
| `"> - > - …"` alternating, 5 000 levels | no failure | not measured (crashed before reaching it) |
| `"[a](" × n + "b" + ")" × n` (nested inline links) | no failure to 5 000 | not reached |
| `"*" × n + "x" + "*" × n` (nested emphasis) | no failure to 5 000 | no failure |

**Architectural reading.** A parser built on the CommonMark reference
algorithm is **iterative** for block structure (Appendix A walks the open-block
tree) and uses a **linked list** for inline delimiters. That is why markdown-it
survives 40 000-deep block quotes. A parser built with recursive descent over
containers — which is what `marked` does — crashes at ~2 500.

### 11.2 Our contract

| Limit | Value | Behaviour on exceed |
|-------|-------|---------------------|
| Block nesting depth | **500** | Render the excess as literal text and emit a diagnostic; **never** throw |
| List nesting depth | **100** | ditto |
| Inline emphasis nesting | **50** | ditto |
| Delimiter stack size | **cap at 100 000** entries | drop oldest, emit diagnostic |
| Link label length | **999** (CM §6.3) | no match |
| Paren nesting in a destination | **≥ 3** required by CM §6.3; we allow **32** | no match beyond 32 |
| Fence length | **≤ 3 000** backticks/tildes | no fence |
| Raw-HTML block size | **≤ 1 MiB** | emit a truncation notice |

These numbers are **our engineering choice**, not spec requirements. CM §6.3's
"at least three levels" is the only one the spec dictates.

### 11.3 Deeply nested structures that are legitimate

| Input | Why it appears | Must not crash |
|-------|----------------|----------------|
| 40 000-deep block quotes | adversarial | yes |
| 500-deep lists | generated documentation | yes |
| 10 000 sibling list items | generated TOC | yes (breadth, not depth) |
| A 1 MiB paragraph | minified content | yes |
| A single 10 MB line | minified HTML | yes, but must not be quadratic |
| 50 000 `[a` openers | adversarial | yes |

---

## 12. Catastrophic backtracking (ReDoS)

### 12.1 Measured: unclosed emphasis openers

`"_a ".repeat(n)` — *n* emphasis opener runs with **no closers anywhere**.

| n | Input size | `marked` 18.1.0 | `markdown-it` 15.0.2 |
|---:|-----------:|----------------:|--------------------:|
| 500 | 1 500 B | 132 ms | — |
| 1 000 | 3 000 B | 692 ms | 17 ms |
| 2 000 | 6 000 B | 1 901 ms | 11 ms |
| 4 000 | 12 000 B | 8 074 ms | 26 ms |
| 8 000 | 24 000 B | **30 478 ms** | 44 ms |
| 16 000 | 48 000 B | 134 266 ms | — |
| 32 000 | 96 000 B | 732 975 ms | — |
| 65 000 | 195 000 B | **≈ 33 minutes** (extrapolated) | **< 1 s** |

Ratios for `marked`: ×3.65, ×3.65, ×4.3, ×3.8, ×4.4, ×5.5 → **O(n²)**, with
super-quadratic drift. `markdown-it` is **linear** (17, 11, 26, 44 ms for
doubling inputs — flat within noise; the earlier 8 000→65 000 run completed in
under 156 ms).

65 000 repetitions is exactly cmark's pathological test size. **A 195 KB file
can freeze a `marked`-based viewer for half an hour.**

### 12.2 Measured: nested lists

`"  ".repeat(i) + "- a\n"` for *i* = 0…n.

| Depth n | Input size | `marked` 18.1.0 | `markdown-it` 15.0.2 |
|--------:|-----------:|----------------:|--------------------:|
| 200 | 40 600 B | 229 ms | 21 ms |
| 400 | 161 200 B | 780 ms | 5 ms |
| 600 | 361 800 B | 2 557 ms | 11 ms |
| 800 | 642 400 B | 5 122 ms | 15 ms |
| 1 000 | 1 003 000 B | **8 967 ms** | 30 ms |
| ≥ 5 000 | — | **`JavaScript heap out of memory`** | not reached |

`marked` is again **O(n²)** in *input size* (and note input size itself is
O(n²) in depth, so the true complexity in depth is O(n⁴)). `markdown-it` is
flat.

### 12.3 Measured: unclosed HTML comments — markdown-it's weak spot

`"</" + "<!--".repeat(n)` — CM §4.6 type-2 HTML block with **no `-->`**.

| n | Input size | `markdown-it` 15.0.2 | `marked` 18.1.0 |
|---:|-----------:|---------------------:|----------------:|
| 5 000 | 20 002 B | 801 ms | 188 ms |
| 10 000 | 40 002 B | 2 723 ms | 541 ms |
| 20 000 | 80 002 B | **9 612 ms** | 2 085 ms |

Ratios ×3.4 and ×3.5 per doubling → **≈ O(n^1.8)**. Extrapolating to cmark's
test size of 300 000 repetitions (1.2 MB) gives **≈ 20 minutes** in markdown-it.
So *neither* library is safe on this input; markdown-it is just safer on the
others.

**Action item for our own implementation:** the HTML-block scanner must be a
**single left-to-right pass** that, on seeing `<!--`, scans forward once for
`-->`. If a naïve implementation instead repeatedly re-tests the start
condition at each line, it is O(lines × lines).

### 12.4 Measured: backtick ramp

`"e`" + "e``" + "e```" + … + "e`"×n` — every possible backtick-run length.

| n | Input size | `markdown-it` 15.0.2 |
|---:|-----------:|---------------------:|
| 2 000 | 2 003 000 B | 89 ms |
| 4 000 | 8 006 000 B | 485 ms |
| 8 000 | 32 012 000 B | 1 872 ms |
| 16 000 | 128 024 000 B | 7 961 ms |

Linear in input size (the string is itself O(n²) long), but the **caller must
cap the fence length** at 3 000 characters precisely so this input cannot be
constructed cheaply. See [01 §8.1](01-block-elements.md#81-renderer-obligations-for-fences).

### 12.5 The full pathological corpus

Input *shapes* transcribed from `cmark`'s `pathological_tests.py`. The
`markdown-it (commonmark)` column is measured; others are shapes we will adopt
as fixtures regardless.

| # | Shape | Purpose |
|--:|-------|---------|
| 1 | `("*a **a " × 65000) + "b" + (" a** a*" × 65000)` | nested strong+emph, 910 KB |
| 2 | `"a_ " × 65000` | many emph closers, no openers |
| 3 | `"_a " × 65000` | many emph openers, no closers — **the worst case we found** |
| 4 | `"a]" × 65000` | many link closers, no openers |
| 5 | `"[a" × 65000` | many link openers, no closers |
| 6 | `"*a_ " × 50000` | mismatched `*`/`_` openers and closers |
| 7 | `"a**b" + ("c* " × 50000)` | run lengths that are multiples of 3 |
| 8 | `"[ a_" × 50000` | link openers with emph closers interleaved |
| 9 | `"[ (](" × 80000` | repeated `[ (](` |
| 10 | `"![[]()" × 160000` | repeated image/link opener, 800 KB |
| 11 | `"**x [a*b**c*](d)"` | the "hard link/emph case" — expects `**x <a href="d">a<em>b**c</em></a>` |
| 12 | `"[" × 50000 + "a" + "]" × 50000` | nested brackets, 100 KB |
| 13 | `"> " × 50000 + "a"` | nested block quotes, 100 KB |
| 14 | nested lists, 1 000 deep | container depth |
| 15 | `"abc␀de␀"` | `U+0000` ⇒ must become `U+FFFD` |
| 16 | `"e" + "`"×1` … `"e" + "`"×4999` | every backtick-run length |
| 17 | `"[a](<b" × 30000` | unclosed angle-bracket destinations |
| 18 | `"[a](b" × 30000` | unclosed paren destinations |
| 19 | `"</" + "<!--" × 300000` | unclosed comment — **markdown-it's worst case** |
| 20 | `"aaa\rbbb\n-\v\n" × 30000` | CR line endings + form feed inside a table |
| 21 | 50 000 `[n]: u` definitions + 5 000 uses | reference-map construction; `cmark` allows this one to fail (hash collisions) |
| 22 | AFL corpus `cmark-gfm/test/afl_test_cases/test.md` | one 382-byte hand-built file exercising `>`, `]]`, a backslash, `_`, `~~`, GFM autolinks, a table pipe, and `<xmp>` together |

### 12.6 Our defences

| Defence | Where | What it stops |
|---------|-------|---------------|
| Wall-clock budget per parse | renderer worker | Anything quadratic, at the cost of truncating one pathological document |
| Input size cap (default 32 MiB, configurable) | file open | Everything oversized |
| Block nesting depth cap (500) | block parser | Recursion crashes and quadratic container scans |
| Delimiter-stack cap (100 000) | inline parser | Unbounded stack growth |
| Fence length cap (3 000) | fence scanner | The backtick ramp |
| Paren-nesting cap in destinations (32) | link scanner | `foo((((…))))` blowups |
| HTML-block single-pass scan | HTML block parser | The unclosed-comment O(n^1.8) |
| No regex with nested quantifiers over document text | code review rule | The whole ReDoS class |
| `openers_bottom` indexed by (length mod 3, can-also-open) | inline parser | Quadratic emphasis matching |
| Fuzzing in CI (`@jazzer.js` for JS, `cargo-fuzz` for Rust) | CI | Whatever we did not think of |
| Pathological suite run on every commit with a 5 s per-case timeout | `packages/test-fixtures/pathological/` | Regressions in complexity |

**Budget choice.** cmark's own harness uses a **5-second timeout** per
pathological case. We should adopt exactly that number and fail CI on exceed.

---

## 13. The master trap table

Everything below becomes a fixture. `→` = tab, `␣` = one space.

| # | Input | Correct | Naive | Why it differs |
|--:|-------|---------|-------|----------------|
| 1 | `- \`one␤- two\␃␃ | two list items | one item with a code span | CM §3.1 Ex. 42 |
| 2 | `Foo␤---␤bar` | `<h2>Foo</h2>` + `<p>bar</p>` | paragraph + `<hr />` | §4.1 Ex. 59 |
| 3 | `* Foo␤* * *␤* Bar` | list, `<hr />`, list | one list | §4.1 Ex. 60 |
| 4 | `→→→→foo␤→bar` | one code block, 2 lines | two blocks | §2.2 Ex. 8 |
| 5 | `>→→foo` | code block starting with 2 spaces | code block `foo` | §2.2 Ex. 6 |
| 6 | `␣␣␣>␣>␣1.␣␣one␤>>␤>>␣␣␣␣two` | `two` in the item | sibling | §5.2 Ex. 259 |
| 7 | `>>- one␤>>␤␣␣>␣␣> two` | `two` is a sibling paragraph | inside the item | §5.2 Ex. 260 |
| 8 | `␣␣␣␣foo␤bar` | code + paragraph | 4-space code + code | §4.8 Ex. 225 |
| 9 | `aaa␤␤␤␤␤bbb` | `<p>aaa<br />␤bbb</p>` | `<p>aaa   ␤bbb</p>` | §4.8 Ex. 226 |
| 10 | `␤␣␣␣␣chunk1␤␣␣␣␣␤␣␣␣␣␣␣chunk2` | one code block, trailing spaces kept | trailing spaces trimmed | §4.4 Ex. 112 |
| 11 | ```` ␃␃␃ aaa␤    ␃␃␃ ```` | code block containing the line | closed early | §4.5 Ex. 137 |
| 12 | ```` ␃␃␃ ␃␃␃␤aaa```` | `<p><code> </code>␤aaa</p>` | a fence | §4.5 Ex. 138 |
| 13 | ````<div></div>␤ ␃␃␃ c␤int x = 33;␤ ␃␃␃ ```` | one HTML block | a `<pre>` block | §4.6 Ex. 161 |
| 14 | `<table><tr><td>␤<pre>␤**Hello**,␤␤_world_.␤</pre>␤</td></tr></table>` | `**Hello**,` verbatim; `_world_.` after the blank line is emphasised | all emphasised | §4.6 Ex. 148 |
| 15 | `Foo␤<a href="bar">␤baz` | one paragraph | paragraph + raw block | §4.6 Ex. 187 |
| 16 | `[foo]: /url "title" ok` | literal paragraph | a definition | §4.7 Ex. 209 |
| 17 | `Foo␤[bar]: /baz␤␤[bar]` | paragraph + paragraph | definition + link | §4.7 Ex. 213 |
| 18 | `> # Foo␤> bar␤baz` | quote with 2-line paragraph | quote + paragraph | §5.1 Ex. 232 |
| 19 | `> foo␤---` | quote + `<hr />` | `<blockquote><h2>foo</h2></blockquote>` | §5.1 Ex. 234 |
| 20 | `*foo *bar**` | `<em>foo <em>bar</em></em>` | `<em>foo *bar</em>*` | §6.2 Ex. 409 + rule of three |
| 21 | `****foo****` | `<strong><strong>foo</strong></strong>` | 4 nested `<em>` | §6.2 Ex. 464 + rule 14.1 |
| 22 | `foo_bar_` | literal | `<em>bar</em>` | §6.2 Ex. 360 |
| 23 | `foo-_(bar)_` | `<em>(bar)</em>` | literal | §6.2 Ex. 364 (rule 2b) |
| 24 | `*$*alpha.` | literal | `<em>$</em>` | §6.2 Ex. 354 (`Sc` is punctuation) |
| 25 | `*U+00A0aU+00A0*` | literal | `<em>a</em>` | §6.2 Ex. 353 — NBSP is Unicode whitespace |
| 26 | ``␃foo␃␃bar␃␃`` | `␃foo` + `<code>bar</code>` | one span, `<code>foo␃␃bar</code>` | §6.1 Ex. 349 — closers must equal the opener |
| 27 | ``␃foo\␃bar␃`` | `␃<code>foo\</code>bar␃` | `<code>foo\bar</code>` | §6.1 Ex. 338 — no escapes inside a code span |
| 28 | ``␃  ␃␃  ␃`` | `<code> ␃␃ </code>` | `<code>␃␃</code>` | §6.1 Ex. 331 — only one space per side is stripped |
| 29 | `[link]("title")` | `href="%22title%22"` | a title | §6.3 Ex. 504 |
| 30 | `[foo] [bar]` + `[bar]: /url` | `[foo] <a>bar</a>` | one link | §6.3 Ex. 542 |
| 31 | `[foo][bar](` + `[baz]: /url1` + `[bar]: /url2` | `[foo]`→`/url2`, `bar`→`/url2`, `baz`→`/url1` | different pairing | §6.3 Ex. 570 |
| 32 | `![foo [bar](/url)](/url2)` | `src="/url2" alt="foo bar"` | `alt="foo <a…>"` | §6.4 Ex. 575 |
| 33 | `[a](<b)c>)` | `href="b)c"` | not a link | §6.3 Ex. 492 |
| 34 | `<m:abc>` | escaped | a link | §6.5 Ex. 609 — 1-char scheme |
| 35 | `https://example.com` (CommonMark) | plain text | a link | §6.5 Ex. 611 — **GFM differs** |
| 36 | `&#42;foo&#42;` | `*foo*` | `<em>foo</em>` | §2.5 Ex. 37 |
| 37 | `foo&#10;&#10;bar` | one paragraph | two | §2.5 Ex. 39 |
| 38 | `&copy` | `&amp;copy` | `©` | §2.5 Ex. 29 |
| 39 | `\` + non-punctuation | literal `\` + char | escaped char | §2.4 Ex. 13 |
| 40 | `\\*emphasis*` | `\` + `<em>emphasis</em>` | `\emphasis\` | §2.4 Ex. 15 |
| 41 | `<a href="\*">` | raw | `href="*"` | §6.6 Ex. 631 |
| 42 | `foo␣␣` / `baz` | `<br />` | soft break | §6.7 Ex. 633 |
| 43 | `foo\` (block end) | `<p>foo\</p>` | `<p>foo<br /></p>` | §6.7 Ex. 644 |
| 44 | `Multiple␣␣␣␣␣spaces` | preserved | collapsed | §6.9 Ex. 652 |
| 45 | `` ␃Foo␤----␤␃ `` | `<h2>\`Foo</h2>` + `<p>\`</p>` | a code span containing `----` | §4.3 Ex. 91 |
| 46 | `\## foo` | `<p>## foo</p>` | `<h2></h2>` | §4.2 Ex. 65 |
| 47 | `#hashtag` | paragraph | `<h1>hashtag</h1>` | §4.2 Ex. 64 |
| 48 | `####### foo` | paragraph | `<h7>` | §4.2 Ex. 63 |
| 49 | `    ***` | code block | `<hr />` | §4.1 Ex. 48 |
| 50 | `### foo ### b` | `<h3>foo ### b</h3>` | `<h3>foo</h3>` + text | §4.2 Ex. 74 |
| 51 | `Foo␤␣␣␣␣bar` | one paragraph | code block | §4.4 Ex. 113 |
| 52 | `␣␣␣␣- foo␤␤␣␣␣␣bar` | item with 2 paragraphs | item + code | §4.4 Ex. 108 |
| 53 | `1.  foo␤␣␣␣␣␤- bar` | nested list in the item | sibling list | §4.4 Ex. 109 |
| 54 | `␣␣␣foo␤bar` | 2 paragraphs | code + paragraph | §5.2 Ex. 275 |
| 55 | `-␣␣␣␣foo␤␤␣␣bar` | item + paragraph | item with 2 paragraphs | §5.2 Ex. 276 — 3-space first block; the blank line matters |
| 55b | `- one␤ ␣two` | one item, "one two" | item + `<p>two</p>` | §5.2 rule #5 — laziness, no blank line |
| 56 | `1234567890. not ok` | paragraph | `<ol start="1234567890">` | §5.2 Ex. 266 |
| 57 | `foo␤*␤␤foo␤1.` | 2 paragraphs | an empty list item | §5.2 Ex. 285 |
| 58 | `- foo␤-␤␤- bar` | empty item | 2 items | §5.2 Ex. 281 |
| 59 | `-␣␣␣␤␣␣foo` | item with 2 paragraphs | item + code | §5.2 Ex. 279 |
| 60 | `␣␣␣␣1.␣␣A paragraph␤␣␣␣␣␣with two lines.` | code block | a list | §5.2 Ex. 289 |
| 61 | `␣* a␤␣␣- b␤␣␣␣- c␤␣␣- d␤␣- e␤␣␣- f␤␤- g` | 7 siblings | a tree | §5.3 Ex. 310 |
| 62 | `1. a␤␤␣␣2. b␤␤␣␣␣3. c` | 2 loose items + code | 3 items | §5.3 Ex. 313 |
| 63 | `- a␤-␤␤␣␣[ref]: /url␤- d` | loose list | tight | §5.3 Ex. 317 |
| 64 | `---` / `title: x` / `---` (no YAML) | front matter, empty output | `<hr /><h2>title: x</h2><hr />` | extension, [01 §14](01-block-elements.md#14-front-matter-conventions) |
| 65 | `EF BB BF` + `# H` | `<h1>H</h1>` | paragraph with U+FEFF | BOM stripping |
| 66 | `‏# H` (U+200F before `#`) | paragraph | `<h1>H</h1>` | U+200F is not a space |
| 67 | `a\rb` | 2 paragraphs | 1 paragraph | CR is a line ending |
| 68 | `_a ` × 65 000 | `<p>_a _a …</p>` in < 1 s | **33 minutes** in `marked` | [§12.1](#121-measured-unclosed-emphasis-openers) |
| 69 | `</` + `<!--` × 20 000 | raw text, < 1 s ideally | 9.6 s in `markdown-it` | [§12.3](#123-measured-unclosed-html-comments--markdown-it's-weak-spot) |
| 70 | `> ` × 2 500 | render, no crash | `RangeError` in `marked` | [§11.1](#111-measured-recursion-limits) |
| 71 | `\u0000` anywhere | U+FFFD | dropped | §2.3 |
| 72 | `\u0301` after a letter | preserved as 2 code points | NFC-normalised | §2.2 Ex. 3 + [§8.4](#84-combining-characters-and-code-points-vs-graphemes) |

---

## 14. Fixtures that must exist but have no spec example

These are our own additions, and each one needs a comment in the fixture file
explaining which rule it covers.

| Fixture | Covers |
|---------|--------|
| LF / CRLF / CR of the same document | [§7.1](#71-line-endings) |
| UTF-8 BOM before a heading, before front matter, before a list | [§7.2](#72-bom) |
| UTF-16LE and UTF-16BE files | [§7.2](#72-bom) |
| U+00A0 as the flanking whitespace | §6.2 Ex. 353 |
| U+200E / U+200F before a block marker | [§8.1](#81-right-to-left-text-and-bidi-markers) |
| U+3000 ideographic space before `#` | [§8.3](#83-cjk-and-full-width-characters) |
| Fullwidth `＃` heading | [§8.3](#83-cjk-and-full-width-characters) |
| ZWJ family emoji inside emphasis | [§8.2](#82-emoji-zwj-sequences-and-variation-selectors) |
| 999-character link label (match) and 1 000-character (no match) | [02 §6.4](02-inline-elements.md#64-the-999-character-label-limit) |
| `$5 and $6` (no math), `$ x $`, `$x $`, `` ␃$x$␃ `` | [03 §9.1](03-extensions-and-dialects.md#91-the-delimiter-rule--this-is-the-whole-spec) |
| `[[note\|alias]]` inside a GFM table cell | [03 §15.1](#151-the-mode-model) |
| `> [!note]` as the first line of a list item | [03 §11](03-extensions-and-dialects.md#11-admonitions-alerts-and-rst-style-callouts--extension) |
| `%%comment%%` inside a code span | [03 §13](03-extensions-and-dialects.md#13-highlight-superscript-subscript-comment--nonstandard) |
| `%%{init: …}%%` inside a ```` ␃␃␃mermaid ```` fence | [03 §10](#10-mermaid-and-other-diagram-fences--extension) |
| `---` / `title: x` / `---` at byte 0 of a file | [01 §14](01-block-elements.md#14-front-matter-conventions) |
| `---` alone (no closing fence) | must be a thematic break |
| `+++` and `{` front matter | [03 §12](#12-front-matter-variants--extension) |

---

## 15. Review checklist for any parser change

| # | Question | If "no" |
|---|----------|---------|
| 1 | Which trap row(s) in §13 does this touch? | The change is not reviewable |
| 2 | Is there a fixture? | Not reviewable |
| 3 | Does it add recursion? | Check against the depth caps in [§11.2](#112-our-contract) |
| 4 | Does it add a regex with a nested quantifier over document text? | **Block the PR** |
| 5 | Does it change any existing fixture's expected output? | Needs an ADR |
| 6 | Does it change an HTML output *shape* (`<br>` vs `<br />`, `align=` vs `style=`)? | Update the tier that reports it; do not silently "fix" it |
| 7 | Is the change Unicode-correct at the code-point level? | §8.4 |
| 8 | Does it depend on `\s`, `\w`, or a locale-aware regex for structural tests? | **Block the PR** — use explicit CM §2.1 character classes |

---

**Next:** [05-test-fixture-strategy.md](05-test-fixture-strategy.md) — how to
turn all of this into a CI gate.
