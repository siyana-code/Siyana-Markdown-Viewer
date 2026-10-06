# 01 — Block elements

> **Scope.** Everything that establishes *block* structure: the tree of
> paragraphs, headings, quotes, lists, code blocks, rules, raw HTML, and tables.
> Inline syntax that appears *inside* those blocks is in
> [02-inline-elements.md](02-inline-elements.md).
>
> **Reading convention.** Every construct is presented as
> `Syntax` / `CommonMark verdict` / `Notes`. In code samples `→` (U+2192) stands
> for a real tab (U+0009), exactly as the CommonMark spec does. Example numbers
> are from **CommonMark 0.31.2** unless prefixed `GFM Ex.`.
>
> **Spec section map used below** (all numbers verified against
> <https://spec.commonmark.org/0.31.2/>):

| § | Title | Examples |
|---|-------|----------:|
| 2.1 | Characters and lines | — |
| 2.2 | Tabs | 1–11 |
| 2.3 | Insecure characters | — |
| 3.1 | Precedence | 42 |
| 3.2 | Container blocks and leaf blocks | — |
| 4.1 | Thematic breaks | 43–61 |
| 4.2 | ATX headings | 62–79 |
| 4.3 | Setext headings | 80–106 |
| 4.4 | Indented code blocks | 107–118 |
| 4.5 | Fenced code blocks | 119–147 |
| 4.6 | HTML blocks | 148–191 |
| 4.7 | Link reference definitions | 192–218 |
| 4.8 | Paragraphs | 219–226 |
| 4.9 | Blank lines | 227 |
| 5.1 | Block quotes | 228–252 |
| 5.2 | List items | 253–300 |
| 5.3 | Lists | 301–326 |
| GFM 4.10 | Tables (extension) | 198–205 |
| GFM 5.3 | Task list items (extension) | 279–280 |

---

## 1. Preliminaries you cannot skip

Four definitions from §2 constrain every rule in this document. A parser that
gets any of them wrong will fail specific fixtures for reasons that look
unrelated.

### 1.1 Characters, lines, and line endings (CM §2.1)

| Term | Definition (CM §2.1) |
|------|----------------------|
| **character** | Any Unicode code point. Combining accents are characters. The spec does not fix an encoding. |
| **line** | Zero or more characters other than LF (U+000A) or CR (U+000D), followed by a line ending or EOF. |
| **line ending** | LF (U+000A), **or** CR (U+000D) not followed by LF, **or** CR followed by LF. |
| **blank line** | A line with no characters, or only spaces (U+0020) and tabs (U+0009). |
| **space** | U+0020 only. |
| **ASCII punctuation** | `!`–`/`, `:`–`@`, `[`–`` ␃ ``, `{`–`~` (U+0021–2F, U+003A–0040, U+005B–0060, U+007B–007E). |
| **Unicode punctuation** | Any character in general category `P` *or* `S`. |
| **Unicode whitespace** | Category `Zs`, plus tab, LF, form feed, CR. |

Two consequences that bite:

* **CR alone is a line ending.** A classic-Mac (CR-only) file is a valid
  Markdown document, and mixed endings in one file are explicitly allowed
  (changelog 0.20: *"The line endings can even be mixed in a single document"*).
* **Whitespace ≠ space.** `\f` (form feed) is Unicode whitespace but is *not* a
  "space or tab", so it does **not** count toward the 0–3 spaces of indentation
  allowed before a block marker. See [04 §7](04-edge-cases-and-traps.md#7-characters-line-endings-and-bom).

### 1.2 Tabs (CM §2.2, Examples 1–11)

```text
RULE (CM §2.2)

  Tabs are NOT expanded to spaces. But in contexts where spaces help define
  block structure, a tab behaves as if it were replaced by spaces with a
  tab stop of 4 characters. Internal tabs are passed through as literal tabs.
```

The "tab stop of 4" wording is the load-bearing detail: a tab advances to the
next multiple of four, it does not always add four. Example 3 proves the parser
must advance to a *column*, not offset by 4:

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `→foo→baz→→bim` → `<pre><code>foo→baz→→bim\n</code></pre>` | **Valid**, §2.2 Ex. 1 | One leading tab == 4 spaces of indent; interior tabs survive as tabs |
| `  →foo→baz→→bim` → same | **Valid**, §2.2 Ex. 2 | 2 spaces + tab to column 4 |
| `    a→a` / `    ὐ→a` → `<pre><code>a→a\nὐ→a\n</code></pre>` | **Valid**, §2.2 Ex. 3 | `ὐ` (U+1F50, one code point) vs `ὐ` (U+1F50 + U+0301 combining acute) — the parser must **skip to the next tab stop**, not count bytes or even code units |
| `  - foo` + blank + `→bar` → `<ul><li><p>foo</p><p>bar</p></li></ul>` | **Valid**, §2.2 Ex. 4 | A tab continues a list item exactly like 4 spaces would |
| `>→→foo` → `<blockquote><pre><code>  foo\n</code></pre></blockquote>` | **Valid**, §2.2 Ex. 6 | Trap: after `>`, one space of the tab is "part of the delimiter", so `→→` leaves 6 columns → an indented code block starting with 2 spaces |
| `#→Foo` → `<h1>Foo</h1>` | **Valid**, §2.2 Ex. 10 | A tab satisfies the "space or tab required after `#`" rule |
| `*→*→*→` → `<hr />` | **Valid**, §2.2 Ex. 11 | Inter-character whitespace is allowed in a thematic break |

### 1.3 Insecure characters (CM §2.3)

```text
RULE (CM §2.3)

  U+0000 must be replaced with REPLACEMENT CHARACTER (U+FFFD).
```

**Replacement, not deletion.** `cmark`'s pathological suite asserts
`abc\ufffd?de\ufffd?`. Also note that entity references resolving to U+0000 are
replaced too (changelog 0.20). → [04 §6](04-edge-cases-and-traps.md#6-entity-edge-cases)

---

## 2. Precedence (CM §3.1, Example 42)

```text
RULE (CM §3.1)

  Indicators of block structure always take precedence over indicators of
  inline structure.
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `- \`one` + newline + `- two\␃␃ → `<ul><li>\`one</li><li>two\`</li></ul>` | **Valid**, §3.1 Ex. 42 | A list with two items — **not** one item containing a code span. The `- ` wins before the backtick is ever considered |

**Architectural consequence.** Parsing is two-phase:

1. **Phase 1** consumes lines and builds the block tree. It also harvests link
   reference definitions into a map.
2. **Phase 2** walks the tree and parses the raw text of paragraphs and headings
   into inlines, using that map.

CM §3.1 also notes phase 2 *"can be parallelized, since the inline parsing of one
block element does not affect the inline parsing of any other."* That is the hook
for a worker-thread renderer later.

### 2.1 Container blocks vs leaf blocks (CM §3.2)

| Category | Members |
|----------|---------|
| **Container blocks** (contain other blocks) | block quote, list item; lists are "meta-containers" of list items |
| **Leaf blocks** (contain only inlines) | thematic break, ATX heading, setext heading, indented code, fenced code, HTML block, link reference definition, paragraph |

Definitions defined in this folder map 1:1 onto that taxonomy, plus GFM's table
extension which adds a **leaf block**.

---

## 3. Thematic breaks (CM §4.1, Examples 43–61)

```text
RULE (CM §4.1)

  A line consisting of up to THREE spaces of indentation, followed by a
  sequence of three or more MATCHING -, _, or * characters, each followed
  optionally by any number of spaces or tabs, forms a thematic break.
```

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `***` / `---` / `___` → three `<hr />` | **Valid**, §4.1 Ex. 43 | All three spellings |
| `+++` → `<p>+++</p>` | **Invalid**, §4.1 Ex. 44 | `+` is not a break character (it *is* a bullet) |
| `===` → `<p>===</p>` | **Invalid**, §4.1 Ex. 45 | `=` never forms a break |
| `--` / `**` / `__` → `<p>--\n**\n__</p>` | **Invalid**, §4.1 Ex. 46 | Fewer than three |
| ` ***` … `   ***` → three `<hr />` | **Valid**, §4.1 Ex. 47 | 1–3 spaces of indent |
| `    ***` → `<pre><code>***\n</code></pre>` | **Invalid**, §4.1 Ex. 48 | 4 spaces ⇒ indented code |
| `Foo` + `    ***` → `<p>Foo\n***</p>` | **Invalid**, §4.1 Ex. 49 | 4-space line cannot interrupt a paragraph |
| `- - -` → `<hr />` | **Valid**, §4.1 Ex. 51 | Inter-character spaces OK |
| ` **  * ** * ** * **` → `<hr />` | **Valid**, §4.1 Ex. 52 | Whitespace anywhere between characters |
| ` *-*` → `<p><em>-</em></p>` | **Invalid**, §4.1 Ex. 56 | **All** non-whitespace characters must be the *same* |
| `* Foo` `* * *` `* Bar` → list, `<hr />`, list | **Valid**, §4.1 Ex. 60 | **Thematic break beats list item.** A `* * *` line is never a list item |
| `- Foo` / `- * * *` → list with an `<hr />` in item 2 | **Valid**, §4.1 Ex. 61 | To get a break *inside* a list item you must use a different bullet, because `- * * *` would be ambiguous |

### 3.1 The precedence trap

```text
Foo
---
bar
```

→ `<h2>Foo</h2>` + `<p>bar</p>` (§4.1 Ex. 59, §4.3 Ex. 84)

**If a line of dashes could be either a thematic break or a setext underline,
setext wins.** See [§6](#6-setext-headings-cm-43-examples-80106) and
[§14](#14-front-matter-conventions).

---

## 4. ATX headings (CM §4.2, Examples 62–79)

```text
RULE (CM §4.2)

  An ATX heading is inline content between an opening sequence of 1–6
  UNESCAPED # characters and an OPTIONAL closing sequence of any number of
  unescaped # characters.

  - The opening sequence must be followed by a space or tab, or by EOL.
  - The opening # may be preceded by 0–3 spaces of indentation.
  - The optional closing sequence must be PRECEDED by a space or tab and may
    be followed by spaces or tabs ONLY.
  - Raw contents are stripped of leading/trailing spaces and tabs before
    inline parsing.
  - Level == number of # in the OPENING sequence.
```

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `# foo` … `###### foo` → `<h1>`…`<h6>` | **Valid**, §4.2 Ex. 62 | The canonical ladder |
| `####### foo` → `<p>####### foo</p>` | **Invalid**, §4.2 Ex. 63 | Seven `#` is a paragraph. Level 7 does not exist; clamping to `<h6>` is a *choice*, not conformance |
| `#5 bolt`, `#hashtag` → two paragraphs | **Invalid**, §4.2 Ex. 64 | Space required. Gruber's ATX required it; it prevents `#hashtag` becoming a heading |
| `\## foo` → `<p>## foo</p>` | **Invalid**, §4.2 Ex. 65 | Backslash-escaped `#` is not part of the opening sequence |
| `# foo *bar* \*baz\*` → `<h1>foo <em>bar</em> *baz*</h1>` | **Valid**, §4.2 Ex. 66 | Contents are parsed as inlines |
| `#                  foo                      ` → `<h1>foo</h1>` | **Valid**, §4.2 Ex. 67 | Outer whitespace stripped |
| ` ### foo` … `   # foo` | **Valid**, §4.2 Ex. 68 | 0–3 spaces |
| `    # foo` → `<pre><code># foo\n</code></pre>` | **Invalid**, §4.2 Ex. 69 | 4 spaces |
| `foo` / `    # bar` → one paragraph | **Invalid**, §4.2 Ex. 70 | 4-space line does not interrupt a paragraph |
| `## foo ##`, `  ###   bar    ###` | **Valid**, §4.2 Ex. 71 | Closing sequence optional; extra inner spaces are fine |
| `# foo ##################################` | **Valid**, §4.2 Ex. 72 | Closing length need not match |
| `### foo ### b` → `<h3>foo ### b</h3>` | **Valid**, §4.2 Ex. 74 | `###` followed by `b` is *content*, not a closing sequence |
| `# foo#` → `<h1>foo#</h1>` | **Invalid** (as a close), §4.2 Ex. 75 | Closing must be preceded by space/tab |
| `### foo \###` → `<h3>foo ###</h3>` | **Valid**, §4.2 Ex. 76 | Escaped `#` are not part of the closing sequence |
| `****` / `## foo` / `****` → `<hr />`, `<h2>`, `<hr />` | **Valid**, §4.2 Ex. 77 | Headings need no surrounding blank lines and interrupt paragraphs |
| `## ` / `#` / `### ###` → `<h2></h2><h1></h1><h3></h3>` | **Valid**, §4.2 Ex. 79 | Empty headings are legal |

### 4.1 What changed in 0.30 / 0.31 for ATX headings

From the official changelog (<https://spec.commonmark.org/changelog.txt>):

* **0.30** — clarified the character-group wording: "newline" was renamed
  *line feed* / *line ending*, and the spec now says **spaces or tabs** where
  earlier wording said spaces. Concretely: `#\tFoo` is a heading (Ex. 10 in §2.2).
* **0.30** — "Clarify language for backtick code spans"; unrelated to ATX.
* **0.31** — "Correct emphasis typo", "Remove `source` element as HTML block start
  condition", "Add `search` element to list of known block elements". No ATX change.
* **0.26** removed the example of an ATX heading with a tab after `#`; §2.2
  Ex. 10 now re-establishes it.

**Bottom line for implementers:** ATX heading semantics have been stable since
0.24 except for the tab/space clarification. If your parser requires a literal
space, it fails CM §2.2 Ex. 10.

---

## 5. Thematic break vs list item (recap of §4.1 Ex. 60/61)

This is the one ambiguity in CM §4.1 that has an explicit precedence statement,
so it is worth restating as a decision table we will implement literally:

| Line | Interpretation | Authority |
|------|----------------|-----------|
| `* * *` | thematic break | §4.1 Ex. 60 |
| `***` (≥3 `*`) | thematic break | §4.1 Ex. 43 |
| `* a` | list item | §5.2 |
| `- * * *` | list item whose content is a thematic break | §4.1 Ex. 61 |
| `  * * *` (2-space indent) | thematic break | §4.1 (0–3 spaces allowed) |
| `    * * *` (4-space indent) | indented code | §4.4 |

---

## 6. Setext headings (CM §4.3, Examples 80–106)

```text
RULE (CM §4.3)

  A setext heading is one or more lines of text, each containing at least one
  non-whitespace character, with 0–3 spaces of indentation, followed by a
  SETEXT HEADING UNDERLINE.

  The text lines must be such that, were they not followed by the underline,
  they would be interpreted as a PARAGRAPH. They cannot be interpretable as a
  code fence, ATX heading, block quote, thematic break, list item, or HTML
  block.

  A setext heading underline is a sequence of = characters or a sequence of
  - characters, 0–3 spaces of indentation, any number of trailing spaces/tabs.

  = gives level 1; - gives level 2.
```

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `Foo *bar*` / `=========` → `<h1>Foo <em>bar</em></h1>` | **Valid**, §4.3 Ex. 80 | |
| `Foo *bar*` / `---------` → `<h2>…</h2>` | **Valid**, §4.3 Ex. 80 | |
| `Foo *bar` / `baz*` / `====` → `<h1>Foo <em>bar\nbaz</em></h1>` | **Valid**, §4.3 Ex. 81 | **Multi-line setext headings.** Most pre-CommonMark parsers get this wrong |
| `  Foo *bar` / `baz*→` / `====` | **Valid**, §4.3 Ex. 82 | Leading whitespace of each line stripped; trailing tabs too |
| `Foo` / `-------------------------` | **Valid**, §4.3 Ex. 83 | Underline can be any length ≥ 1 |
| `   Foo` / `---`, `  Foo` / `  ===` | **Valid**, §4.3 Ex. 84 | Text and underline need not align |
| `    Foo` / `    ---` → indented code | **Invalid**, §4.3 Ex. 85 | 4 spaces |
| `Foo` / `    ---` → `<p>Foo\n---</p>` | **Invalid**, §4.3 Ex. 87 | Underline with 4-space indent does not apply |
| `Foo` / `= =` → `<p>Foo\n= =</p>` | **Invalid**, §4.3 Ex. 88 | No *internal* spaces in the underline |
| `Foo` / `--- -` → `<p>Foo</p>` + `<hr />` | **Invalid**, §4.3 Ex. 88 | `--- -` is a thematic break (inter-character spaces allowed), so the `Foo` paragraph closes and cannot become a heading |
| `Foo··` / `-----` → `<h2>Foo</h2>` | **Valid**, §4.3 Ex. 89 | **Trailing spaces in the content line are stripped, so they do NOT create a hard break** |
| `Foo\` / `----` → `<h2>Foo\</h2>` | **Valid**, §4.3 Ex. 90 | A trailing backslash is literal here, not a hard break |
| `` ␃Foo `` / `----` / `` ␃ `` → `<h2>\`Foo</h2><p>\`</p>` | **Valid**, §4.3 Ex. 91 | Block structure beats the code span |
| `> Foo` / `---` → quote + `<hr />` | **Invalid**, §4.3 Ex. 92 | **The underline cannot be a lazy continuation line** |
| `> foo` / `bar` / `===` → one paragraph in a quote | **Invalid**, §4.3 Ex. 93 | |
| `- Foo` / `---` → list + `<hr />` | **Invalid**, §4.3 Ex. 94 | |
| `Foo` / `Bar` / `---` → `<h2>Foo\nBar</h2>` | **Valid**, §4.3 Ex. 95 | Blank line needed to separate a paragraph from a following heading |
| `---` `Foo` `---` `Bar` `---` `Baz` → `<hr />`, `<h2>Foo</h2>`, `<h2>Bar</h2>`, `<p>Baz</p>` | **Valid**, §4.3 Ex. 96 | Blank lines are *not* required between headings |
| `====` → `<p>====</p>` | **Invalid**, §4.3 Ex. 97 | Setext headings cannot be empty |
| `---` / `---` → two `<hr />` | **Valid**, §4.3 Ex. 98 | First `---` is a break; the second has no text line above it |
| `- foo` / `-----` → list + `<hr />` | **Valid**, §4.3 Ex. 99 | |
| `    foo` / `---` → code + `<hr />` | **Valid**, §4.3 Ex. 100 | |
| `> foo` / `-----` → quote + `<hr />` | **Valid**, §4.3 Ex. 101 | |
| `\> foo` / `------` → `<h2>&gt; foo</h2>` | **Valid**, §4.3 Ex. 102 | Escape is how you get literal text in a setext heading |

### 6.1 The four-way ambiguity of `Foo\n---`

The spec itself enumerates the historical disagreement (CM §4.3, "Compatibility
note"). Given:

```text
Foo
bar
---
baz
```

| Interpretation | Result |
|----------------|--------|
| 1. paragraph `Foo`, heading `bar`, paragraph `baz` | authors who want this insert a blank line after `Foo` (§4.3 Ex. 73) |
| 2. paragraph `Foo bar`, `<hr />`, paragraph `baz` | authors use blank lines around the break, or a break that cannot be a setext underline such as `* * *` (§4.3 Ex. 74, 75) |
| 3. one paragraph `Foo bar — baz` | authors backslash-escape: `\---` (§4.3 Ex. 76) |
| **4. heading `Foo bar`, paragraph `baz`** | **the CommonMark choice**, "most natural", and it increases expressiveness |

We implement 4. It is also the reading that keeps multi-line setext headings
consistent with §4.3 Ex. 81.

### 6.2 GFM note — the `-` disambiguation differs

GFM 0.29-gfm §4.3 adds: *"If a line containing a single `-` can be interpreted as
an empty list item, it should be interpreted this way and not as a setext heading
underline."* Combined with GFM's CommonMark 0.26 rule that **empty list items
cannot interrupt a paragraph**, this removes the `foo\n-` ambiguity that CM 0.26
also removed. We follow CommonMark 0.31.2 and note the historical difference in
the fixture set. → [04 §3](04-edge-cases-and-traps.md#3-list-vs-setext-vs-thematic-break)

---

## 7. Indented code blocks (CM §4.4, Examples 107–118)

```text
RULE (CM §4.4)

  An indented code block is one or more INDENTED CHUNKS separated by blank
  lines. A chunk is a sequence of non-blank lines each preceded by four or
  more spaces. Content is the literal line contents INCLUDING trailing line
  endings, minus four spaces of indentation. No info string. Cannot interrupt a
  paragraph.
```

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `    a simple` / `      indented code block` | **Valid**, §4.4 Ex. 107 | Extra indent beyond 4 is preserved |
| `  - foo` + blank + `    bar` → one `<li>` with two `<p>` | **Valid**, §4.4 Ex. 108 | **List item interpretation beats code block** when both fit |
| `1.  foo` + blank + `    - bar` → nested list in the item | **Valid**, §4.4 Ex. 109 | |
| `    <a/>` / `    *hi*` / blank / `    - one` → literal text | **Valid**, §4.4 Ex. 110 | Contents are **never** parsed as Markdown |
| 3 chunks separated by blank lines → one block with 3 blank lines inside | **Valid**, §4.4 Ex. 111 | Blank lines *inside* the code are preserved |
| `    chunk1` / `      ` / `      chunk2` → trailing spaces on the blank line preserved | **Valid**, §4.4 Ex. 112 | Indentation beyond 4 is kept even on interior blank lines |
| `Foo` / `    bar` → `<p>Foo\nbar</p>` | **Invalid**, §4.4 Ex. 113 | Cannot interrupt a paragraph — this is what makes hanging indents work |
| `    foo` / `bar` → code + `<p>bar</p>` | **Valid**, §4.4 Ex. 114 | But a paragraph may follow code immediately |
| `        foo` / `    bar` → `<pre><code>    foo\nbar\n</code></pre>` | **Valid**, §4.4 Ex. 116 | |
| `    foo··` → `<pre><code>foo··\n</code></pre>` | **Valid**, §4.4 Ex. 118 | **Trailing spaces are part of code content** |

---

## 8. Fenced code blocks (CM §4.5, Examples 119–147)

```text
RULE (CM §4.5)

  A code fence is a sequence of AT LEAST THREE consecutive backticks or
  tildes. Backticks and tildes may not be mixed.

  Opening fence: 0–3 spaces of indentation. May be followed by an info string,
  trimmed of leading/trailing spaces AND TABS (changelog 0.29).
  - After a BACKTICK fence the info string may not contain any backtick.
  - After a TILDE fence the info string may contain anything, including
    backticks and tildes.

  Content: all subsequent lines until a closing fence of the SAME character with
  AT LEAST as many characters as the opening fence.

  If the opening fence is preceded by N spaces of indentation, up to N spaces
  are removed from each content line (if present).

  Closing fence: 0–3 spaces of indentation, followed only by spaces or tabs,
  which are ignored. Closing fences may not have info strings.

  No closing fence found => the block ends at the end of the containing block
  or document (NO backtracking; the spec explicitly chooses efficiency here).
```

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| ```` ␃␃␃ ```` … ```` ␃␃␃ ```` → `<pre><code>` | **Valid**, §4.5 Ex. 119 | |
| ```` ␃␃␃ ```` → ```` ␃␃␃ ```` → `<p><code>foo</code></p>` | **Invalid**, §4.5 Ex. 121 | Two backticks is an *inline code span*, not a fence |
| ```` ␃␃␃ ```` / `aaa` / `~~~` / ```` ␃␃␃ ```` | **Valid**, §4.5 Ex. 122 | `~~~` inside a backtick fence is literal content |
| ```` ```` ```` / ␃aaa␃ / ```` ␃␃␃ ```` / ```` ```` ```` → closes | **Valid**, §4.5 Ex. 124 | **Closing must be ≥ opening length** |
| ```` ␃␃␃ ```` / ```` ␃␃␃ aaa```` / ```` ␃␃␃ ```` → the middle line is content | **Valid**, §4.5 Ex. 147 | Closing fences cannot have info strings |
| ```` ␃␃␃ ␃␃␃ ```` → `<p><code> </code>\naaa</p>` | **Invalid**, §4.5 Ex. 138 | A fence may not contain internal spaces |
| ```` ␃␃␃ruby```` → `<pre><code class="language-ruby">` | **Valid**, §4.5 Ex. 142 | First word of the info string becomes the class — *the spec does not mandate this*, it is conventional |
| `~~~~    ruby startline=3 $%@#$` → `class="language-ruby"` | **Valid**, §4.5 Ex. 143 | Remaining info-string words are **unspecified**; cmark discards them |
| ```` ````; ␃␃␃␃ → `<pre><code class="language-;"></code></pre>` | **Valid**, §4.5 Ex. 144 | A one-character language is legal |
| ```` ␃␃␃ aa ␃␃␃ ```` → `<p><code>aa</code>\nfoo</p>` | **Invalid**, §4.5 Ex. 145 | Backtick in a backtick-fence info string |
| ````~~~ aa ␃␃␃ ~~~```` / `foo` / `~~~` → `class="language-aa"` | **Valid**, §4.5 Ex. 146 | Tilde fences may have backticks in the info string |
| ```` ␃␃␃ ```` / `aaa` / ````    ␃␃␃ ```` → the last line is content | **Valid**, §4.5 Ex. 137 | 4-space-indented closer is not a closer |
| ```` ␃␃␃ ```` / `aaa` / ````   ␃␃␃ ```` → closes | **Valid**, §4.5 Ex. 135 | Closer indent need not match opener |
| ````    ␃␃␃ ```` / `    aaa` / ````    ␃␃␃ ```` → indented code containing fences | **Invalid**, §4.5 Ex. 134 | 4-space indent |
| ```` ␃␃␃   ```` + ` aaa` + `aaa` + ```` ␃␃␃   ```` → two lines, no indent | **Valid**, §4.5 Ex. 131 | N=1 opener removes 1 space of indent |
| `foo` / ```` ␃␃␃ ```` / `bar` / ```` ␃␃␃ ```` / `baz` → p, code, p | **Valid**, §4.5 Ex. 140 | Fences interrupt paragraphs and need no blank lines |
| ```` ␃␃␃ ```` / `aaa` → `<pre><code>aaa\n</code></pre>` with no closer | **Valid**, §4.5 | Unclosed fences terminate at container end |

### 8.1 Renderer obligations for fences

The spec does not mandate them, so we must decide and document:

| Obligation | Our decision | Rationale |
|------------|--------------|-----------|
| `class="language-X"` on `<code>` | **Yes** | Convention across cmark, GitHub, markdown-it, Obsidian, VS Code |
| Info-string words beyond the first | Preserve in `data-info` | Cheap, enables tooling; never rendered |
| Escaping of code content | Escape `&`, `<`, `>` only | CM §4.5 Ex. 119 shows `<` → `&lt;`; do **not** escape quotes |
| `<pre>` needs `white-space` handling | Ship `pre { white-space: pre; }` | Browsers collapse nothing inside `pre` by default, but this protects against inherited `white-space: normal` from a parent |
| Maximum fence length | Cap at 3 000 (mirrors cmark's behaviour) | Prevents an O(n²) "find matching closer" scan on a pathological ```` ````…␃␃␃␃ |

---

## 9. HTML blocks (CM §4.6, Examples 148–191)

```text
RULE (CM §4.6)

  An HTML block is a group of lines treated as RAW HTML and not escaped in the
  output. There are SEVEN kinds, defined by start and end conditions. The block
  begins with a line meeting a start condition (after 0–3 spaces of indent) and
  ends with the first line meeting a matching end condition, or the last line of
  the document, or the last line of the enclosing container block.
```

The seven types, verbatim from §4.6:

| # | Start condition | End condition | Can it interrupt a paragraph? |
|---|-----------------|---------------|-------------------------------|
| 1 | line begins with `<pre`, `<script`, `<style`, or `<textarea` (case-insensitive) followed by space, tab, `>`, or EOL | line contains `</pre>`, `</script>`, `</style>`, or `</textarea>` (case-insensitive, need not match the start tag) | **Yes** |
| 2 | line begins with `<!--` | line contains `-->` | **Yes** |
| 3 | line begins with `<?` | line contains `?>` | **Yes** |
| 4 | line begins with `<!` followed by an ASCII letter | line contains `>` | **Yes** |
| 5 | line begins with `<![CDATA[` | line contains `]]>` | **Yes** |
| 6 | line begins with `<` or `</` followed by (case-insensitive) `address`, `article`, `aside`, `base`, `basefont`, `blockquote`, `body`, `caption`, `center`, `col`, `colgroup`, `dd`, `details`, `dialog`, `dir`, `div`, `dl`, `dt`, `fieldset`, `figcaption`, `figure`, `footer`, `form`, `frame`, `frameset`, `h1`–`h6`, `head`, `header`, `hr`, `html`, `iframe`, `legend`, `li`, `link`, `main`, `menu`, `menuitem`, `nav`, `noframes`, `ol`, `optgroup`, `option`, `p`, `param`, `search`, `section`, `summary`, `table`, `tbody`, `td`, `tfoot`, `th`, `thead`, `title`, `tr`, `track`, `ul`, followed by space, tab, EOL, `>`, or `/>` | line is followed by a **blank line** | **Yes** |
| 7 | line begins with a **complete open tag** (tag name other than `pre`, `script`, `style`, `textarea`) or a complete closing tag, followed by 0+ spaces/tabs and EOL | line is followed by a **blank line** | **No** |

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `<table><tr><td>` … blank … `</td></tr></table>` → one `<table>` block, then a paragraph | **Valid**, §4.6 Ex. 148 | **The `<pre>` inside is content, not a new start condition.** The block's end condition was fixed when it started; "any HTML within an HTML block that might otherwise be recognised as a start condition will be ignored by the parser" (§4.6) |
| ` <div>` / `  *hello*` / `         <foo><a>` → raw | **Valid**, §4.6 Ex. 150 | 3-space indent OK |
| `    <div>` / `    *hello*` → indented code | **Invalid**, §4.6 Ex. 184 | 4 spaces |
| `</div>` / `*foo*` → raw HTML block containing `*foo*` | **Valid**, §4.6 Ex. 151 | A *block* may start with a closing tag (type 7) |
| `<div></div>` / ```` ␃␃␃ c ```` / `int x = 33;` / ```` ␃␃␃ ```` | **Valid**, §4.6 Ex. 161 | Type 6 swallows the fence: "what looks like a Markdown code block is actually part of the HTML block" |
| `<a href="foo">` / `*bar*` / `</a>` → all raw | **Valid**, §4.6 Ex. 162 | `a` is not in the type-6 list, so this is a type-7 block; the tag must be alone on its line |
| `<Warning>` / `*bar*` / `</Warning>` → all raw | **Valid**, §4.6 Ex. 163 | Type 7 permits any tag name |
| `<del>` / `*foo*` / `</del>` → raw | **Valid**, §4.6 Ex. 166 | |
| `<del>` / blank / `*foo*` / blank / `</del>` → `<del>` raw, then `<p><em>foo</em></p>` | **Valid**, §4.6 Ex. 167 | Blank line ends the type-7 block |
| `<del>*foo*</del>` → `<p><del><em>foo</em></del></p>` | **Valid**, §4.6 Ex. 168 | Tag not alone on its line ⇒ **inline** HTML, Markdown still parsed inside |
| `<script>` / `foo` / `</script>1. *bar*` → all raw | **Valid**, §4.6 Ex. 178 | Anything after the end tag on the same line is in the block |
| `Foo` / `<div>` / `bar` / `</div>` → paragraph then raw block | **Valid**, §4.6 Ex. 185 | Types 1–6 interrupt paragraphs |
| `Foo` / `<a href="bar">` / `baz` → one paragraph | **Valid**, §4.6 Ex. 187 | **Type 7 may not interrupt a paragraph** |
| `<div>` / `bar` / `</div>` / `*foo*` → raw block then `*foo*` paragraph | **Valid**, §4.6 Ex. 186 | |
| `- <div>` / `- foo` → `<ul><li><div></li><li>foo</li></ul>` | **Valid**, §4.6 Ex. 175 | HTML block ends at the end of its **container** |

### 9.1 Security implications — read this before implementing

This is the part of §4.6 that matters most for a viewer that opens files the
user did not write.

| Risk | Mechanism | Mitigation we must implement |
|------|-----------|-------------------------------|
| **XSS via `<script>`** | Type 1 blocks let `<script>` through verbatim. | A **sanitiser is not optional**. Sanitise after rendering, not before parsing. |
| **XSS via event handlers** | `<div onclick="…">` is type 7 raw HTML. | Sanitiser allow-list must strip `on*` attributes. |
| **XSS via `javascript:` URLs** | `<a href="javascript:alert(1)">` passes link destination rules (a "nonempty sequence of characters"). | Scheme allow-list at render time. CM has **no** scheme restriction on link destinations — only on *autolinks* (§6.5). |
| **Hidden content / phishing** | `<div style="display:none">`, `<iframe>`, `<object>`. | Tag allow-list, not a deny-list. |
| **Layout escape** | `</div>` typed by a user closes *our* layout divs. | Never concatenate user HTML into our own document structure; render into a scoped root. |
| **Resource exhaustion** | Type 1/2/3/4/5 blocks end at a specific string; a file with `<style>` and no `</style>` swallows the rest of the document. | Cap raw-HTML block size; surface a diagnostic rather than failing silently. |
| **CSS exfiltration** | `<style>@import url(...)</style>` | Strip `<style>` entirely, or scope it under a nonce + strict CSP. |

**GFM's `tagfilter` extension (§6.11)** is the *minimal* mitigation GitHub
specifies: replace the leading `<` of `<title>`, `<textarea>`, `<style>`,
`<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<script>`, `<plaintext>` with
`&lt;`. GitHub additionally runs a real sanitiser — RFC 7764 §3.2 says
explicitly that for GFM *"Only some HTML allowed; sanitization is integral to the
format"*. A `tagfilter` is **necessary and not sufficient**.

### 9.2 Historical divergence from Gruber

CM §4.6 quotes Gruber's rule and explains the difference. Gruber's original:
block-level HTML must be separated by blank lines, and start/end tags must not
be indented. CommonMark instead:

* **is more restrictive** for types 6/7 (no blank lines inside; blank line ends
  the block),
* **is more permissive** about indentation (0–3 spaces allowed),
* **is more permissive** about requiring a matching end tag.

Gruber's one real advantage: blank lines are allowed inside HTML blocks.
CommonMark trades that away because balancing tags *"is expensive and can
require backtracking from the end of the document"*, and because blank-line
separation gives a trivial way to interleave Markdown and HTML. → [01 §11](#11-paragraphs-and-blank-lines-cm-48-49-examples-219227)

---

## 10. Link reference definitions (CM §4.7, Examples 192–218)

```text
RULE (CM §4.7)

  A link reference definition consists of:
    link label (0–3 spaces indent)
    colon (:)
    optional spaces or tabs, including up to ONE line ending
    link destination
    optional spaces or tabs, including up to ONE line ending
    optional link title, separated from the destination by spaces or tabs

  NO further character may occur.
```

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `[foo]: /url "title"` + `[foo]` → `<a href="/url" title="title">foo</a>` | **Valid**, §4.7 Ex. 192 | Definitions produce **no output** |
| `[Foo*bar\]]:my_(url) 'title (with parens)'` | **Valid**, §4.7 Ex. 194 | Backslash escapes work in label and title; parens allowed unescaped in the destination if balanced |
| `[Foo bar]:` / `<my url>` / `'title'` → `my%20url` | **Valid**, §4.7 Ex. 195 | Angle-bracket destination may contain spaces; percent-encoding policy is **not mandated** |
| `[foo]: /url '` / `title` / `line1` / `line2` / `'` | **Valid**, §4.7 Ex. 196 | Titles may span lines |
| `[foo]: /url 'title` / blank / `with blank line'` → all literal | **Invalid**, §4.7 Ex. 197 | **No blank line inside a title** |
| `[foo]:` / `[foo]` → literal text | **Invalid**, §4.7 Ex. 199 | Destination may not be omitted… |
| `[foo]: <>` + `[foo]` → `<a href="">foo</a>` | **Valid**, §4.7 Ex. 200 | …but an *empty* destination is expressible in angle brackets |
| `[foo]: <bar>(baz)` → literal | **Invalid**, §4.7 Ex. 201 | Title must be separated from destination by space/tab |
| `[foo]: /url\bar\*baz "foo\"bar\baz"` | **Valid**, §4.7 Ex. 202 | Escapes and literal backslashes both allowed |
| `[foo]` then `[foo]: url` | **Valid**, §4.7 Ex. 203 | A link may precede its definition |
| `[foo]: first` / `[foo]: second` → `/url1`-style, first wins | **Valid**, §4.7 Ex. 204 | **First** definition in the document wins |
| `[FOO]: /url` + `[Foo]` → resolves | **Valid**, §4.7 Ex. 205 | Case-insensitive matching |
| `[ΑΓΩ]: /φου` + `[αγω]` → resolves | **Valid**, §4.7 Ex. 206 | Unicode case fold (not just ASCII) |
| `[foo]: /url` alone → **no output at all** | **Valid**, §4.7 Ex. 207 | Unused definitions are legal and invisible |
| `[\nfoo\n]: /url` + `bar` → `<p>bar</p>` | **Valid**, §4.7 Ex. 208 | Multi-line labels are fine |
| `[foo]: /url "title" ok` → literal | **Invalid**, §4.7 Ex. 209 | Trailing junk disqualifies the whole definition |
| `[foo]: /url` / `"title" ok` → `<p>"title" ok</p>` | **Valid**, §4.7 Ex. 210 | Definition without title, then a paragraph |
| `    [foo]: /url "title"` → indented code | **Invalid**, §4.7 Ex. 211 | 4 spaces |
| `[foo]: /url` inside a fence → literal | **Invalid**, §4.7 Ex. 212 | |
| `Foo` / `[bar]: /baz` → one paragraph | **Invalid**, §4.7 Ex. 213 | **Definitions cannot interrupt a paragraph** |
| `# [Foo]` / `[foo]: /url` / `> bar` | **Valid**, §4.7 Ex. 214 | Can directly follow a heading or break |
| `[foo]: /url` / `bar` / `===` / `[foo]` → `<h1>bar</h1>` + link | **Valid**, §4.7 Ex. 215 | |
| Three definitions in a row without blank lines | **Valid**, §4.7 Ex. 217 | |
| `[foo]` then `> [foo]: /url` → resolves | **Valid**, §4.7 Ex. 218 | **Definitions inside containers are document-global** |

> **Implementation note.** Because definitions are stripped from the tree, they
> must be harvested *when a paragraph closes* (Appendix A, "Phase 1"), not
> greedily line-by-line — otherwise Example 213 fails.

---

## 11. Paragraphs and blank lines (CM §4.8–4.9, Examples 219–227)

```text
RULE (CM §4.8)

  A paragraph is a sequence of non-blank lines that cannot be interpreted as
  other kinds of blocks. Raw content = the lines concatenated, minus initial
  and final spaces/tabs.
```

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `aaa` / blank / `bbb` → two paragraphs | **Valid**, §4.8 Ex. 219 | |
| `aaa` / `bbb` → one paragraph | **Valid**, §4.8 Ex. 220 | |
| `  aaa` / ` bbb` → `<p>aaa\nbbb</p>` | **Valid**, §4.8 Ex. 222 | Leading whitespace skipped |
| `aaa` / `             bbb` / `                    ccc` → one paragraph | **Valid**, §4.8 Ex. 223 | **Continuation lines may be indented any amount** — this is the other half of "indented code cannot interrupt a paragraph" |
| `    aaa` / `bbb` → code + paragraph | **Invalid**, §4.8 Ex. 225 | |
| `aaa     ` / `bbb     ` → `<p>aaa<br />\nbbb</p>` | **Valid**, §4.8 Ex. 226 | Final spaces/tabs are stripped *before* inline parsing, so the paragraph-final ones do not make a hard break |
| Leading and trailing blank lines around the document are ignored | **Valid**, §4.9 | §4.9 Ex. 227 |

---

## 12. Block quotes (CM §5.1, Examples 228–252)

```text
RULE (CM §5.1)

  A block quote marker, optionally preceded by 0–3 spaces of indentation,
  consists of (a) the character > together with a following space of
  indentation, OR (b) a single > not followed by a space.

  Three clauses define block quotes:
    1. BASIC CASE     — prepend the marker to each line of a block sequence.
    2. LAZINESS       — you may DELETE the marker from lines where the next
                        non-space/tab character after the marker would be
                        PARAGRAPH CONTINUATION TEXT.
    3. CONSECUTIVENESS— two block quotes cannot be adjacent without a blank
                        line between them.
```

"Paragraph continuation text" is the exact term to implement: *text that will be
parsed as part of the content of a paragraph, but does not occur at the
beginning of the paragraph.*

| Syntax | CommonMark verdict | Notes |
|--------|--------------------|-------|
| `> # Foo` / `> bar` / `> baz` | **Valid**, §5.1 Ex. 228 | Block markers may be optional (one space), so even `># Foo` works (Ex. 229) |
| `   > # Foo` / `  > baz` | **Valid**, §5.1 Ex. 230 | 0–3 spaces |
| `    > # Foo` → indented code | **Invalid**, §5.1 Ex. 231 | 4 spaces |
| `> # Foo` / `> bar` / `baz` → quote with 2-line paragraph | **Valid**, §5.1 Ex. 232 | **Laziness** |
| `> bar` / `baz` / `> foo` → one quote, 3 lines | **Valid**, §5.1 Ex. 233 | Mixed lazy/non-lazy lines |
| `> foo` / `---` → quote + `<hr />` | **Valid**, §5.1 Ex. 234 | `---` is *not* paragraph continuation text (it would start a new block), so laziness does not apply |
| `> - foo` / `- bar` → quote with 1-item list, then a sibling list | **Valid**, §5.1 Ex. 235 | Same reason |
| `> \`\`\␃␃ / `foo` / `\`\`\␃␃ → empty code, paragraph, empty code | **Valid**, §5.1 Ex. 237 | The fence closes; laziness cannot save the fence body |
| `> foo` / `    - bar` → `<blockquote><p>foo\n- bar</p></blockquote>` | **Valid**, §5.1 Ex. 238 | The real lazy-continuation case: `>     - bar` would be an indented code block, which cannot interrupt a paragraph, so it is paragraph continuation text |
| `>` alone → `<blockquote>\n</blockquote>` | **Valid**, §5.1 Ex. 239 | Empty quote |
| `> foo` / blank / `> bar` → **two** block quotes | **Valid**, §5.1 Ex. 242 | Consecutiveness. Markdown.pl gave one quote with two paragraphs |
| `>>> foo` / `bar` → 3-deep quote | **Valid**, §5.1 Ex. 250 | Laziness omits *any number* of `>` on a continuation line |
| `>     code` → code in quote | **Valid**, §5.1 Ex. 252 | The marker `>` **plus one space** counts toward the 4, so 5 spaces are needed |
| `>    not code` → paragraph in quote | **Invalid** (for code), §5.1 Ex. 252 | 4 spaces = 3 after the delimiter |
| `> bar` / `baz` → quote containing both | **Valid**, §5.1 Ex. 247 | Laziness again |
| `> bar` / blank / `baz` → quote + paragraph | **Valid**, §5.1 Ex. 248 | **A blank line is needed** to end the quote before a paragraph |

### 12.1 Laziness — the implementation predicate

A line lacking the `>` marker stays inside the block quote **iff**, after
stripping the container's consumed markers, the line's first content character
would be parsed as paragraph continuation text. Concretely, reject laziness if
the line would open:

* a thematic break (`***`, `---`, `___`) → §5.1 Ex. 234
* a list item (`- foo`, `1. foo`) → §5.1 Ex. 235
* an ATX heading, a fence opener, an indented code block start, an HTML block
  start → §5.1 Ex. 237 and §4.3 Ex. 92
* anything else that CM §3.1 would treat as block structure

---

## 13. Lists (CM §5.2 + §5.3, Examples 253–326)

### 13.1 List markers (§5.2)

```text
RULE (CM §5.2)

  A BULLET LIST MARKER is -, +, or *.
  An ORDERED LIST MARKER is 1–9 arabic digits followed by . or ).
  (The 9-digit cap exists because with 10 digits we start seeing integer
   overflows in some browsers.)
```

### 13.2 The five list-item rules (§5.2)

The spec defines list items by *how they can be constructed from their
contents*. We implement the corresponding acceptance rules:

| Rule | Name | Statement |
|------|------|-----------|
| **#1** | Basic case | Lines `Ls` form blocks `Bs` starting with a character other than space/tab; `M` is a marker of width `W` followed by `1 ≤ N ≤ 4` spaces of indentation ⇒ `M` + those spaces prepended to the first line, and subsequent lines indented by `W + N` spaces, is a list item containing `Bs` |
| **#2** | Item starting with indented code | If `Bs` starts with an indented code block and `M` is followed by **one** space, the item's content is indented by `W + 1`; empty lines need not be indented |
| **#3** | Item starting with a blank line | If `Ls` starts with a single blank line, prepend `M` and indent subsequent lines by `W + 1`; **the number of spaces after the marker does not matter** |
| **#4** | Indentation | Preceding every line by the same 0–3 spaces still yields the same list item |
| **#5** | Laziness | Deleting some or all of the indentation from lines that are paragraph continuation text yields the same list item |

Exceptions to rule #1, stated in the spec:

* **Paraphrase the rule table:** when the *first* item of a list interrupts a
  paragraph, (a) `Ls` must not begin with a blank line, and (b) if the item is
  ordered, **the start number must be 1**.
* **If any line is a thematic break then that line is not a list item.**

### 13.3 The content-indent rule — the single hardest idea in §5.2

> *"The most important thing to notice is that the position of the text after
> the list marker determines how much indentation is needed in subsequent blocks
> in the list item."* — §5.2

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `- one` / blank / ` two` → list + `<p>two</p>` | **Valid**, §5.2 Ex. 255 | 1 space < required 2 ⇒ item closes |
| `- one` / blank / `  two` → both in the item | **Valid**, §5.2 Ex. 256 | 2 spaces == required |
| ` -    one` / blank / `     two` → list + `<pre><code> two` | **Valid**, §5.2 Ex. 257 | Marker `W=1`, spaces after marker `N=4` ⇒ content indent 5; 5 spaces ⇒ indented code with 1 leading space |
| `-one`, `2.two` → paragraphs | **Invalid**, §5.2 Ex. 261 | **At least one space or tab required after the marker** |
| `123456789. ok` → `<ol start="123456789">` | **Valid**, §5.2 Ex. 265 | 9 digits max |
| `1234567890. not ok` → paragraph | **Invalid**, §5.2 Ex. 266 | 10 digits ⇒ not a list item |
| `0. ok` → `<ol start="0">` | **Valid**, §5.2 Ex. 267 | Leading zeros allowed |
| `003. ok` → `<ol start="3">` | **Valid**, §5.2 Ex. 268 | Parsed as decimal 3 |
| `-1. not ok` → paragraph | **Invalid**, §5.2 Ex. 269 | Not negative |
| `- foo` / blank / `      bar` → item with code block | **Valid**, §5.2 Ex. 270 | Content indent 2, so 6 spaces = 4 + 2 |
| `  10.  foo` / blank / `           bar` → item with code block | **Valid**, §5.2 Ex. 271 | 11 spaces needed |
| `1.     indented code` / `   paragraph` / `       more code` | **Valid**, §5.2 Ex. 272 | Rule #2: exactly one space after the marker, then the normal 4 |
| `1.      indented code` … | **Valid**, §5.2 Ex. 274 | The extra space becomes part of the code |
| `   foo` / `bar` → two paragraphs | **Invalid**, §5.2 Ex. 275 | Rules #1/#2 do not cover a first block indented by exactly 3 |
| `-    foo` / `  bar` → list + paragraph | **Valid**, §5.2 Ex. 276 | Same reason |
| `    1.  A paragraph` … | **Invalid**, §5.2 Ex. 289 | 4 spaces ⇒ code block, not a list |
| `  1.  A paragraph` … | **Valid**, §5.2 Ex. 286 | 0–3 spaces per rule #4 |
| `   foo` / `bar` … `   - e` → `- e` is paragraph text of item `d` | **Valid**, §5.2 Ex. 312 | **List items may not be preceded by more than three spaces of indentation** |
| `- foo` / `   - bar` / `     - baz` / `      - boo` → 4-level nest | **Valid**, §5.2 Ex. 294 | A sublist needs the *same* indent a paragraph would need |
| `- foo` / ` - bar` / `  - baz` / `   - boo` → 4 siblings | **Valid**, §5.2 Ex. 295 | 1 space is not enough to nest |
| `10) foo` / `    - bar` → nested | **Valid**, §5.2 Ex. 296 | Marker width 3 ⇒ 4 spaces needed |
| `10) foo` / `   - bar` → sibling list | **Valid**, §5.2 Ex. 297 | 3 is not enough |
| `- - foo` | **Valid**, §5.2 Ex. 298 | A list may be the first block in a list item |
| `- # Foo` / `- Bar` / `  ---` / `  baz` | **Valid**, §5.2 Ex. 300 | **List items may contain headings** (Markdown.pl forbade this) |
| `-` / blank / `  foo` → `<ul><li></li></ul>` + `<p>foo</p>` | **Valid**, §5.2 Ex. 280 | A list item may begin with at most **one** blank line |
| `- foo` / `-` / `- bar` → empty item in the middle | **Valid**, §5.2 Ex. 281 | |
| `foo` / `*` → `<p>foo\n*</p>` | **Valid**, §5.2 Ex. 285 | **An empty list item cannot interrupt a paragraph** (this is the CM 0.26 change) |

### 13.4 The "columns" fallacy (§5.2, explicit warning)

The spec warns: *"It is tempting to think of this in terms of columns … However,
that is not quite right."* Two fixtures prove it:

| Syntax | Verdict | Why it matters |
|--------|---------|----------------|
| `   > > 1.  one` / `>>` / `>>     two` → `two` **is** in the list item | **Valid**, §5.2 Ex. 259 | `two` sits in the *same column* as `1.`, yet belongs to the item, because there was enough indentation after the last `>>` |
| `>>- one` / `>>` / `  >  > two` → `two` is **not** in the item | **Valid**, §5.2 Ex. 260 | `two` is far to the *right* of `one` but is not indented enough past the blockquote markers |

**Implementation rule:** compute content indent as `W + N` (marker width plus
the 1–4 spaces actually consumed *at that nesting level*), and compare against
the **remaining** columns after all enclosing container markers. Never use an
absolute column.

### 13.5 Tight vs loose lists (§5.3)

```text
RULE (CM §5.3)

  A list is LOOSE if any of its constituent list items are separated by blank
  lines, OR if any of its constituent list items DIRECTLY contain two
  block-level elements with a blank line between them.

  Otherwise the list is TIGHT.

  HTML difference: loose lists wrap paragraphs in <p>, tight lists do not.
```

| Syntax | Verdict | Tight/loose | Note |
|--------|---------|-------------|------|
| `- a` / `- b` / `- c` | Valid, §5.3 Ex. 322 | **tight** | Single paragraph per item, no blank lines |
| `- a` / `- b` / blank / `- c` | Valid, §5.3 Ex. 314 | **loose** | Blank line *between items* |
| `* a` / `*` / blank / `* c` | Valid, §5.3 Ex. 315 | **loose** | Empty second item still counts as separation |
| `- a` / `- b` / blank / `  c` / `- d` | Valid, §5.3 Ex. 316 | **loose** | One item directly contains two blocks with a blank line |
| `- a` / `- b` / blank / `  [ref]: /url` / `- d` | Valid, §5.3 Ex. 317 | **loose** | Even when the separated block is a *reference definition* |
| `- a` / `- \`\`\␃␃ / `  b` / blank / blank / `  \`\`\␃␃ / `- c` | Valid, §5.3 Ex. 318 | **tight** | Blank lines inside the code block do not count |
| `- a` / `  - b` / blank / `    c` / `- d` | Valid, §5.3 Ex. 319 | **outer tight, inner loose** | Looseness is per-list, not per-document |
| `* a` / `  > b` / `  >` / `* c` | Valid, §5.3 Ex. 320 | **tight** | Blank line inside a block quote does not count |
| `- a` / `  > b` / `  \`\`\␃␃ / `  c` / `  \`\`\␃␃ / `- d` | Valid, §5.3 Ex. 321 | **tight** | Consecutive blocks, no blank lines |
| `1. \`\`\␃␃ / `   foo` / `   \`\`\␃␃ / blank / `   bar` | Valid, §5.3 Ex. 324 | **loose** | |
| `- foo` / `  - bar` / blank / `  baz` | Valid, §5.3 Ex. 325 | **loose** | |

### 13.6 Same-type rule (§5.3)

```text
RULE (CM §5.3)

  Two list items are of the SAME TYPE if they begin with markers of the same
  type: (a) bullet markers using the same character, or (b) ordered markers with
  the same delimiter (either . or )).

  The start number of an ordered list is the number of its FIRST item.
  Subsequent item numbers are disregarded.
```

| Syntax | Verdict | Note |
|--------|---------|------|
| `- foo` / `- bar` / `+ baz` → two lists | Valid, §5.3 Ex. 301 | Different bullet char ⇒ new list |
| `1. foo` / `2. bar` / `3) baz` → `<ol>` + `<ol start="3">` | Valid, §5.3 Ex. 302 | Different delimiter ⇒ new list |
| `Foo` / `- bar` / `- baz` → paragraph + list | Valid, §5.3 Ex. 303 | **In CommonMark a list may interrupt a paragraph** |
| `The number of windows in my house is` / `14.  The number of doors is 6.` → one paragraph | Valid, §5.3 Ex. 304 | Only lists starting with **1** may interrupt |
| `The number of windows in my house is` / `1.  The number of doors is 6.` → paragraph + list | Valid, §5.3 Ex. 305 | The known residual false positive |
| `- foo` / `  - bar` / `    - baz` / blank / `      bim` | Valid, §5.3 Ex. 307 | |
| `- foo` / `- bar` / blank / `<!-- -->` / blank / `- baz` / `- bim` | Valid, §5.3 Ex. 308 | **A blank HTML comment is the documented way to split two same-type lists** |
| `- a` / ` - b` / `  - c` / `   - d` / `  - e` / ` - f` / `- g` → 7 siblings | Valid, §5.3 Ex. 310 | Items need not be at the same indent level |

---

## 14. Front matter conventions

> **Status: NOT in CommonMark, NOT in GFM.** It is a de-facto convention of the
> static-site and note-taking ecosystems. Tag: **EXTENSION**.

### 14.1 The three formats in the wild

| Format | Fence | Who | Notes |
|--------|-------|-----|-------|
| **YAML** | `---` … `---` (also `---` … `...`) | Jekyll, Hugo, Astro, Obsidian, MkDocs, Docusaurus, Gatsby, Hexo, 11ty, pandoc (`yaml_metadata_block`) | Overwhelmingly the default. Obsidian docs literally say *"Type `---` at the very beginning of a file"* to add properties |
| **TOML** | `+++` … `+++` | Hugo (`toml`), Zola | Avoids the `---` collision entirely |
| **JSON** | `{` … `}` at column 0 | Astro (`json`), some Node tooling | No fence at all; relies on "first char is `{`" |
| **Pandoc title block** | `Title: …` lines, then `---` or `...` | pandoc `title_block` | Not fenced front matter; a set of `Key: value` lines |

### 14.2 The `---` collision — full truth table

`---` is simultaneously a **thematic break** (§4.1), a **setext underline**
(§4.3), a **YAML front matter fence**, and the **pandoc title-block delimiter**.
Resolution:

| Position in file | Line is | Correct interpretation |
|-------------------|---------|------------------------|
| Line 1, with a matching closing fence later | `---` | **Front matter delimiter** (pre-pass wins) |
| Line 1, no matching fence | `---` | **Thematic break** (Gruber-compatible) |
| After paragraph text | `---` | **Setext `<h2>` underline** (§4.1 Ex. 59) |
| After a blank line, at column 0 | `---` | **Thematic break** |
| Line 1 of a block quote body | `>` … `---` | **Thematic break** (§4.3 Ex. 101) |

**Implementation contract:**

1. Strip front matter in a **pre-pass**, before the block parser sees a single
   line.
2. The pre-pass requires: byte 0 of the file is exactly `---` (or `+++`, or
   `{` for JSON), and a matching terminator exists.
3. Preserve the stripped block as **document metadata**, and give it a source
   range so the editor can map it back.
4. Never let the block parser produce a setext heading or thematic break from a
   fence line.

### 14.3 Metadata keys we must read

| Key | Used by | Effect in a viewer |
|-----|---------|-------------------|
| `title` | Jekyll, Hugo, Astro, pandoc | Window/document title fallback |
| `tags` / `categories` | Jekyll, Hugo, Obsidian (`tags` property) | Sidebar tag index |
| `aliases` | Obsidian, Hugo (`aliases`) | Resolve `[[wikilink]]` targets |
| `cssclasses` | Obsidian | Apply extra CSS classes to the document root — a **CSS injection surface**, must be sanitised |
| `date` / `created` / `modified` | Jekyll, Hugo, Obsidian | Sort order, metadata panel |
| `draft` | Jekyll | Badge only |
| `math` | Some pandoc/Hugo setups | Enable/disable math extension for the doc |
| `flavors` / `extensions` | Proposed, **not registered** (commonmark-spec issue #830, 2026-05-22) | Would let a document declare its dialect — worth tracking, not worth implementing yet |

> RFC 7763 registers `text/markdown` with an optional **`variant=`** parameter
> naming the dialect (`variant=GFM`, `variant=CommonMark`, …) and RFC 7764
> registers those names in IANA's *Markdown Variants* registry. The registry was
> last updated **2026-09-24** and currently contains: `Original`, `MultiMarkdown`,
> `GFM`, `pandoc`, `Fountain`, `CommonMark`, `kramdown-rfc2629`, `rfc7328`,
> `Extra`, `SSW`, `quarto`, `myst`, `mdc`. This is the closest thing to an
> official answer to "which flavour is this file?".

---

## 15. Tables — GFM extension (GFM §4.10, Examples 198–205)

> **Status: GFM.** Tag: **GFM**. CommonMark itself has no tables.

```text
RULE (GFM §4.10)

  A table is an arrangement of data with rows and columns: a single header row,
  a DELIMITER ROW separating header from data, and zero or more data rows.

  Each row consists of cells containing arbitrary text, in which inlines are
  parsed, separated by pipes (|). A leading and trailing pipe is RECOMMENDED.
  Spaces between pipes and cell content are trimmed. Block-level elements cannot
  be inserted in a table.

  The DELIMITER ROW consists of cells whose only content are hyphens (-), and
  optionally a leading or trailing colon (:), or both, for left/right/centre.
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `\| foo \| bar \|` / `\| --- \| --- \|` / `\| baz \| bim \|` → full `<table>` | **Valid**, GFM §4.10 Ex. 198 | |
| `\| abc \| defghi \|` / `:-: \| -----------:` / `bar \| baz` → `align="center"` / `align="right"` | **Valid**, GFM §4.10 Ex. 199 | Alignment applied to every cell in the column. **cmark-gfm emits `align=`; markdown-it emits `style="text-align:…"`** — measured difference, see [05 §6](05-test-fixture-strategy.md#6-what-gfm-actually-diverges-on) |
| `\| f\|oo  \|` / `\| ------ \|` / `\| b `\|` az \|` / `\| b **\|** im \|` | **Valid**, GFM §4.10 Ex. 200 | **A pipe inside a cell must be backslash-escaped**, including inside other inline spans |
| table then `> bar` → table ends | **Valid**, GFM §4.10 Ex. 201 | Table ends at the first empty line or the start of another block-level structure |
| table then `bar` (no blank) → `bar` becomes a **row with 2 cells** | **Valid**, GFM §4.10 Ex. 202 | Not a paragraph — a surprising and correct behaviour |
| header has 2 cells, delimiter has 1 → **not a table**, all paragraphs | **Invalid**, GFM §4.10 Ex. 203 | Header cell count must match the delimiter row |
| body row short/long → empty cells inserted / excess ignored | **Valid**, GFM §4.10 Ex. 204 | |
| header + delimiter only → `<table>` with `<thead>` and **no `<tbody>`** | **Valid**, GFM §4.10 Ex. 205 | |

### 15.1 Table interaction with the rest of the block grammar

| Trap | Fixture | Correct behaviour |
|------|---------|-------------------|
| A literal pipe inside a code span in a cell | GFM Ex. 200 | **Must be written `\|`** — even inside a code span, an unescaped `\|` ends the cell. Rendered: `<code>&#124;</code>` |
| Table immediately after a paragraph with no blank line | our own | **Not a table** — the paragraph absorbs the delimiter row (CM §3.1). GFM requires the table to start a new block |
| Table inside a block quote / list item | our own | Works; each row needs the container's indentation |
| Table inside a table cell | impossible | "Block-level elements cannot be inserted in a table" (GFM §4.10) |
| Multi-line cell content | impossible | Cells are single-line by construction; a blank line terminates the table |

---

## 16. The precedence table we will implement

This is the single decision table for ambiguous block openers, in the order the
parser must check them.

| # | Check | Wins over | Authority |
|---|-------|-----------|-----------|
| 1 | U+0000 → U+FFFD | — | §2.3 |
| 2 | Front matter (pre-pass) | everything | EXTENSION, [§14](#14-front-matter-conventions) |
| 3 | Blank line | all block starts | §4.9 |
| 4 | Indented code (≥4 cols) | setext, list | §4.4 |
| 5 | Fenced code (```` ␃␃␃ ````, `~~~`) | paragraph, list | §4.5 |
| 6 | ATX heading (1–6 `#` + space/EOL) | paragraph | §4.2 |
| 7 | HTML block types 1–5 | paragraph | §4.6 |
| 8 | HTML block types 6–7 | types 1–5 | §4.6 |
| 9 | Block quote `>` | paragraph | §5.1 |
| 10 | Setext underline (`=` or `-` run) | thematic break | §4.3, §4.1 Ex. 59 |
| 11 | Thematic break | list item | §4.1 Ex. 60 |
| 12 | List item | paragraph continuation | §5.2, §5.3 |
| 13 | Table (GFM) | paragraph continuation | GFM §4.10 |
| 14 | Link reference definition | — (only when the paragraph closes) | §4.7 |
| 15 | Paragraph | — | §4.8 |
| 16 | Inline parsing of the block's raw text | — | §3.1 phase 2 |

**Row 10 vs row 11 is the `Foo\n---` case. Row 11 vs row 12 is the `* * *` case.
Row 4 vs row 10 is `    Foo\n    ---` (indented code, no heading).**

---

## 17. Block-parser checklist

Before declaring the block phase done, confirm all of these are true. Each maps
to a fixture in [05](05-test-fixture-strategy.md).

- [ ] Tabs advance to the next multiple-of-4 column, and *interior* tabs are never expanded (§2.2).
- [ ] `U+0000` is replaced with `U+FFFD`, not dropped (§2.3).
- [ ] Front matter is stripped in a pre-pass with a recorded source range (§14).
- [ ] A 4-column indent never opens a heading, rule, fence, or block quote (§4.2 Ex. 69, §4.1 Ex. 48, §4.6 Ex. 184).
- [ ] Continuation lines of a paragraph may be indented arbitrarily (§4.8 Ex. 223).
- [ ] A line that both looks like `-` and like a list bullet is a **setext underline** if it can be one (§4.3).
- [ ] `* * *` is a thematic break even when a list is open (§4.1 Ex. 60).
- [ ] Only lists starting with `1` interrupt a paragraph (§5.3).
- [ ] An empty list item cannot interrupt a paragraph (§5.2 Ex. 285).
- [ ] Content indent is `W + N` relative to the *current container*, not an absolute column (§5.2 Ex. 259–260).
- [ ] Laziness applies only to paragraph continuation text (§5.1).
- [ ] Type 7 HTML blocks cannot interrupt a paragraph; types 1–6 can (§4.6 Ex. 185/187).
- [ ] A type-6 HTML block's end condition is fixed at its start (§4.6 Ex. 148).
- [ ] Link reference definitions are harvested when a paragraph closes, and are document-global (§4.7 Ex. 218).
- [ ] Tight/loose is computed **per list**, and blank lines inside code fences or block quotes do not make a list loose (§5.3 Ex. 318–320).
- [ ] Unclosed fenced code ends at the container end, with no backtracking (§4.5).
- [ ] Nesting depth is bounded and the bound produces a **diagnostic**, not a crash ([04 §11](04-edge-cases-and-traps.md#11-deep-nesting-and-stack-depth)).
- [ ] Total work is bounded by input size; see [04 §12](04-edge-cases-and-traps.md#12-catastrophic-backtracking-redos).

**Next:** [02-inline-elements.md](02-inline-elements.md) — the delimiter-stack
algorithm, the rule of three, and 90 link fixtures.
