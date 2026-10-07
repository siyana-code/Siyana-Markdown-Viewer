# 01 — CommonMark in depth

> **Scope of this document.** By the end of it you should be able to (a) state
> exactly what the CommonMark specification normatively covers, (b) implement
> every construct it defines, (c) explain what it deliberately excludes and
> why, and (d) make a defensible claim about your parser's conformance.

---

## 1. What CommonMark actually is

CommonMark is **a specification, not a program**. It is a Markdown document
(`spec.txt`) with a small, custom extension for side-by-side test cases. A build
script (`tools/makespec.py`) converts it into HTML or CommonMark; a test runner
(`test/spec_tests.py`) extracts the examples into JSON and runs them against a
program.

| Property | Value (verified 2026-10-06) |
|----------|------------------------------|
| Title | CommonMark Spec |
| Author | John MacFarlane (`@jgm`) |
| Canonical URL | <https://spec.commonmark.org/> |
| Latest version | **0.31.2, dated 2024-01-28** |
| Repository | <https://github.com/commonmark/commonmark-spec> |
| Discussion forum | <https://talk.commonmark.org/> (Discourse) |
| Licence | CC-BY-SA 4.0 |
| Executable examples | **652** in `spec.json` |
| Reference implementations | `cmark` (C99), `commonmark.js` (Emscripten port of cmark) |
| Conformance levels | **None defined.** See §6. |
| Normative keywords | **None.** No RFC 2119. See §5. |

The repository description is literally "CommonMark spec, with reference
implementations in C and JavaScript" — the spec and two reference parsers live
in the same tree, and both are tested against the same 652 examples on every
commit.

### 1.1 Version history

| Version | Date | Notes |
|---------|------|-------|
| 0.28 | 2017-08-01 | The first version most implementations actually targeted. |
| 0.29 | 2019-04-06 | Adopted as the base of GFM. 649 examples. |
| 0.30 | 2021-06-19 | After a long quiet period. |
| 0.31 → **0.31.2** | **2024-01-28** | Current. 652 examples. |

There is a version for essentially every release from 0.5 (2014-10-25) onward,
each with a `changes.html` diff and its own `spec.json`.

**CommonMark has never reached 1.0.** This is a live, open question, not a
settled fact. As of the 0.31.2 announcement, jgm summarised the release as
follows (paraphrased from <https://talk.commonmark.org/t/version-0-31-2-of-the-commonmark-spec-has-been-released/4591>):

> Most of the changes to the spec are very minor. The main ones for implementers
> to notice are a slight change in the spec for inline HTML comments, we now
> treat Unicode symbols like Unicode punctuation for purposes of determining
> flankingness, `<search>` is now a recognized block element; `<source>` is not.

The 1.0 question has a dedicated meta-thread (64-post thread "When do you think
we'll ship 1.0 of the CommonMark spec?",
<https://talk.commonmark.org/t/when-do-you-think-well-ship-1-0-of-the-commonmark-spec/2797>)
and an open GitHub issue arguing for the bump
(<https://github.com/commonmark/commonmark-spec/issues/788>, opened 2025-02-03,
still open). The issue makes the sharpest observation available to us: **in
practice the ecosystem already treats CommonMark as a `v1.n.n` living standard,
regardless of the `0.x.y` label.** That is the position we adopt.

**Decision for this project:** target **CommonMark 0.31.2**. Pin the exact
version in code, tests, and user-facing docs. Never say "CommonMark" without a
version number.

### 1.2 Design goals

The spec does not have a "Goals" section, but its intent is legible from three
places:

1. **Gruber's overriding goal, quoted verbatim in §1.1** — a Markdown document
   should be "publishable as-is, as plain text, without looking like it's been
   marked up with tags or formatting instructions." CommonMark's entire design
   biases toward this: HTML is the escape hatch, not the point.
2. **jgm's "Beyond Markdown" post (2018-04-17)**, opening the 64-post thread at
   <https://talk.commonmark.org/t/beyond-markdown/2787>. Paraphrased: in
   developing CommonMark the authors tried to stay faithful to Gruber's original
   syntax description, diverging only occasionally to remove ambiguity and
   increase uniformity, plus adding a few now-virtually-ubiquitous constructs
   (fenced code blocks, shortcut reference links). Gruber's legacy had made the
   spec very complicated — 17 emphasis rules, complex list-item and HTML-block
   rules — and the author wrote that he despaired at times of getting to a spec
   worth calling *finished*, proposing that a future "CommonMark 2" could be
   partially backwards-incompatible.
3. **The compatibility notes scattered through the spec.** §4.3 (setext
   headings) explicitly enumerates four interpretations of a construct and picks
   one, explaining which authors get which behaviour by inserting which blank
   line. §4.5 explains that an alternative fence rule "would require
   backtracking" and that the chosen rule avoids it.

The thread also records the reason the conservative approach stuck. As one
participant put it, CommonMark 0.28 was already an industry standard in practice,
so changing it would produce a third incompatible dialect rather than
convergence.

---

## 2. Structure of the specification

The spec is organised as a grammar, roughly outside-in. Here is the section map
of 0.31.2, with example counts per section drawn from `spec.json`.

### 2.1 Preliminaries

| § | Section | Examples | Defines |
|---|---------|----------|---------|
| 2.1 | Characters and lines | 0 | `character` = Unicode code point; `line ending` = LF / CR / CRLF; `blank line`; the character classes `whitespace`, `Unicode whitespace`, `space`, `non-whitespace character`, `ASCII punctuation character`, `Unicode punctuation character` |
| 2.2 | Tabs | 11 | Tabs are **not** expanded, but in indentation-sensitive contexts behave as if expanded to a 4-column tab stop |
| 2.3 | Insecure characters | 0 | `U+0000` must be replaced with `U+FFFD` |

Two details here cause disproportionate implementation pain:

- **Character classes.** `Unicode whitespace character` is `Zs` plus tab, LF,
  form feed, CR. `Unicode punctuation character` in **0.31.2** is ASCII
  punctuation *or* anything in general categories `P` **and `S`**. Before
  0.31 it was `P` and `Pc/Pd/Pe/Pf/Pi/Po/Ps` only. The widening to `S` is what
  makes `*$alpha*` fail to emphasise — currency symbols are now punctuation.
- **Tabs.** You cannot naively expand tabs at load time; the spec says internal
  tabs are passed through literally but indentation-relevant positions behave as
  4-column tab stops. Almost every hand-rolled parser gets this wrong.

### 2.2 Blocks and inlines

| § | Section | Examples | Key content |
|---|---------|----------|-------------|
| 3.1 | Precedence | 1 | "Indicators of block structure always take precedence over indicators of inline structure." This single sentence is the formal licence for the two-phase parse. |
| 3.2 | Container blocks and leaf blocks | 0 | The container/leaf split |

### 2.3 Leaf blocks

| § | Section | Examples |
|---|---------|----------|
| 4.1 | Thematic breaks | 19 |
| 4.2 | ATX headings | 18 |
| 4.3 | Setext headings | 27 |
| 4.4 | Indented code blocks | 12 |
| 4.5 | Fenced code blocks | 29 |
| 4.6 | HTML blocks | 44 |
| 4.7 | Link reference definitions | 27 |
| 4.8 | Paragraphs | 8 |
| 4.9 | Blank lines | 1 |

`HTML blocks` at 44 examples is the single largest block-level surface. It is
the part of CommonMark most viewers get wrong, because most of them disable raw
HTML entirely (a security decision that is *not* CommonMark conformance). See
[`02-gfm.md`](02-gfm.md) and `research/11-security/`.

### 2.4 Container blocks

| § | Section | Examples |
|---|---------|----------|
| 5.1 | Block quotes | 25 |
| 5.2 | List items | 48 |
| 5.3 | Lists | 26 |

`List items` at 48 examples is the largest block section, and the hardest. It
has four numbered construction rules plus exceptions. This is covered in depth
in [`../04-parsing-internals/02-block-parsing.md`](../04-parsing-internals/02-block-parsing.md).

### 2.5 Inlines

| § | Section | Examples |
|---|---------|----------|
| 6.1 | Code spans | 22 |
| 6.2 | Emphasis and strong emphasis | **132** |
| 6.3 | Links | 90 |
| 6.4 | Images | 22 |
| 6.5 | Autolinks | 19 |
| 6.6 | Raw HTML | 20 |
| 6.7 | Hard line breaks | 15 |
| 6.8 | Soft line breaks | 2 |
| 6.9 | Textual content | 3 |

**Emphasis (132) + Links (90) = 222 of 652 examples, 34% of the suite.** If you
implement blocks correctly and get links wrong, you will still fail a third of
the suite. This ratio is the single best argument for why link/emphasis
handling deserves its own deep-dive document, which it gets in
[`../04-parsing-internals/03-inline-parsing.md`](../04-parsing-internals/03-inline-parsing.md).

### 2.6 Appendix: A parsing strategy

§A, "Appendix: A parsing strategy", is normative-adjacent and **is** part of the
specification. It says (paraphrased):

> In this appendix we describe some features of the parsing strategy used in the
> CommonMark reference implementations.

It has four parts:

- **A.1 Overview** — the two-phase model and the open/closed block tree.
- **A.2 Phase 1: block structure** — the three-step per-line procedure.
- **A.3 Phase 2: inline structure** — walking the tree after all input is seen.
- **A.4 An algorithm for parsing nested emphasis and links** — the *look for
  link or image* and *process emphasis* procedures.

Note that A.4's algorithm text is **identical in the GFM spec** (same appendix,
same wording), which means GFM inherits CommonMark's emphasis machinery verbatim.
GFM's strikethrough is implemented as an additional delimiter type in that same
machine, which is why it "does not disturb regular emphasis processing"
(`cmark-gfm` 0.28.3.gfm.7 release note).

Full treatment: [`../04-parsing-internals/01-reference-parsing-strategy.md`](../04-parsing-internals/01-reference-parsing-strategy.md).

---

## 3. Version deltas we must know about

Diffing 0.30 against 0.31.2 (<https://spec.commonmark.org/0.31.2/changes.html>)
and cross-checking jgm's release note:

| Change | Impact on an implementer |
|--------|--------------------------|
| `Unicode punctuation character` widened from `P*` to `P*` + `S*` | Flankingness changes for text adjacent to `+`, `=`, `$`, `€`, `^`, `\|`, `~`, emoji-ish symbols. |
| `<search>` added to the HTML-block type 6 tag list; `<source>` removed | One tag in, one tag out. 0.30 had `source`, not `search`. |
| Inline HTML comment handling clarified | §6.6 now defines a comment as `<!-->`, `<!--->`, or `<!--` + string + `-->`; the 0.31 text made the `-->`-less forms behave consistently. |
| Example URIs modernised `http://` → `https://`; backticks in autolink destinations percent-encode to `%60` | Cosmetic for parsing, but if you diff against the JSON you will see output changes that are not regressions. |
| 652 vs 649 examples | Minor rule clarifications folded into existing examples. |

**Practical advice:** when a conformance test fails, diff the example's *input*
against the previous version's. A surprising number of "failures" against a
0.30-era implementation are just the `http`/`https` example churn.

---

## 4. Validity, dialects, and what "conforming" means

### 4.1 CommonMark has no notion of invalid documents

§2.1 states flatly:

> Any sequence of characters is a valid CommonMark document.

This is the conceptual key to the whole layered model. **Nothing in Markdown is
a syntax error.** There is no parse failure, no error recovery, no diagnostic.
A conforming parser maps every possible input to *some* HTML. Divergence between
parsers is therefore always silent, which is exactly the pathology CommonMark
was created to end ("because nothing in Markdown counts as a 'syntax error,' the
divergence often isn't discovered right away" — §1.3).

The consequence for our viewer: **we cannot detect "this file is broken
Markdown."** We can only detect "this file uses constructs outside our declared
profile." Those are different things and our UI must not conflate them.

### 4.2 The word "dialect"

The spec never uses the word "dialect". GFM's introduction does, and defines
itself as one:

> GitHub Flavored Markdown, often shortened as GFM, is the dialect of Markdown
> that is currently supported for user content on GitHub.com and GitHub
> Enterprise.

For our purposes, a **dialect** = CommonMark + a declared, finite set of
extensions + a declared set of deviations. That is exactly what a "Siyana
Markdown Profile" is (§5 of `03-extension-standards.md`).

### 4.3 Rendering is *not* fully specified

§1.4 ("About this document") is unusually candid and we should quote it in our
own docs:

> Since this document describes how Markdown is to be parsed into an abstract
> syntax tree, it would have made sense to use an abstract representation of the
> syntax tree instead of HTML. But HTML is capable of representing the
> structural distinctions we need to make, and the choice of HTML for the tests
> makes it possible to run the tests against an implementation without writing
> an abstract syntax tree renderer.

and:

> Note that not every feature of the HTML samples is mandated by the spec. For
> example, the spec says what counts as a link destination, but it doesn't
> mandate that non-ASCII characters in the URL be percent-encoded. […] a
> conforming implementation can use a different renderer and may choose not to
> percent-encode non-ASCII characters in URLs.

**So conformance has two independent halves:**

| Half | What it means | How to test |
|------|---------------|-------------|
| **Parsing** | The AST you build | Can't be tested against the spec directly — the spec only publishes HTML |
| **Rendering** | The HTML you emit for that AST | Compare against `spec.json` |

The practical consequence: **we build an AST, not a string.** For our project
this is not optional — the viewer needs the AST for outline generation,
search indexing, virtual scrolling, and internal-link resolution. We then write
our own renderer, and we test that renderer against `spec.json`. If our renderer
percent-encodes differently from the reference, we will fail tests we should
pass; §1.4 explicitly permits that, and we normalise accordingly (see
`04-conformance-testing.md`).

### 4.4 What "conformance" means in practice

A parser conforms to CommonMark 0.31.2 if and only if, for all 652 examples in
`spec.json`, feeding `markdown` produces output that, after the standard HTML
normalisation, equals `html`.

We measured this on 2026-10-06 with Node 24.14.1 (`node commonmark 0.31.2`,
`markdown-it 15.0.2`, `marked 18.1.0`):

| Parser | Pass | Fail | Pass rate |
|--------|------|------|-----------|
| `commonmark` 0.31.2 (js reference port, default opts) | 652 | 0 | **100.00%** |
| `commonmark` 0.31.2 (js, `commonmark: true`) | 652 | 0 | **100.00%** |
| `markdown-it` 15.0.2, `'commonmark'` preset | 649 | 3 | **99.54%** |
| `markdown-it` 15.0.2, default preset | 519 | 133 | **79.60%** |
| `marked` 18.1.0, `gfm: true` | 498 | 154 | **76.38%** |

The 3 `markdown-it` failures are **HTML serialisation artifacts, not parse
failures** — empty `<blockquote></blockquote>` versus `<blockquote>\n</blockquote>`
in examples 218, 239, and 240. We verified this by inspecting all three. A
normalising runner (`normalize.py` in the reference repo) collapses them.

Note also that the *default* `markdown-it` preset scores 79.6% because it
enables extensions that deliberately break CommonMark. **An extension breaks
conformance by existing.** That is the whole argument for a declared profile.

---

## 5. Normative language: CommonMark does not use it

**Verified:** a full-text scan of `spec.txt` 0.31.2 finds no RFC 2119 `MUST`,
`SHOULD`, or `MAY` keywords, no "Conformance" section, and no definition of
conformance levels. The words "must" and "should" appear, but in ordinary
lowercase English within sentences, e.g.:

- "The opening `#` character may be indented 0-3 spaces." (§4.2)
- "An indented code block cannot interrupt a paragraph…" (§4.4)
- "A conforming parser may be limited to a certain encoding." (§2.1)

There is exactly one place where the spec talks about what implementations must
or may do, and it is about encoding, not syntax: §2.1 says the spec does not
specify an encoding and "a conforming parser may be limited to a certain
encoding."

**Implication for our documentation.** When we write "MUST", we are adopting
RFC 2119 *ourselves*. We should say so once, in `docs/glossary.md`, and then
be consistent. We should never write "CommonMark says MUST" — it never does.

---

## 6. "Conformance levels" — the concept does not exist here

There is no tier system. CommonMark does not have "Core", "Full", or "Basic"
conformance classes, does not allow optional feature sets, and does not have a
compatibility clause. There are exactly two states: **conforming** and **not
conforming** (for a given version).

Community attempts to build a tier system have failed:

- An early thread proposed extension specs as part of the CommonMark spec
  (2017-05-07, <https://talk.commonmark.org/t/extension-spec-as-part-of-the-commonmark-spec/2437>).
  One participant proposed a set of rules an extension spec "should" satisfy
  (documented, togglable, able to render under plain CommonMark, declaring which
  CommonMark syntax it changes). **Thread has 1 post. Nothing happened.**
- The "How to move ahead with extending CommonMark" thread (2020, 13 posts)
  asked the same question. jgm's reply explained *why* extension tiers are hard:
  the two-phase model means block extensions must decide whether a character is
  structural *before* inlines are parsed, which makes `|` ambiguous between a
  table separator and a literal pipe inside a code span. GitHub's table
  extension solved this by **requiring `\|` escapes**, which is a change to
  CommonMark semantics, not a pure extension.

**What we should do instead.** Adopt RFC 2119 in our own docs and define three
levels of our own, *outside* the spec:

| Our level | Meaning | Test |
|-----------|---------|------|
| **CommonMark-conformant** | All 652 examples of 0.31.2 pass | `npm test -- spec` |
| **CommonMark + declared profile** | The above, plus every extension the profile marks REQUIRED, plus zero UNSUPPORTED constructs appearing in the test corpus | profile conformance suite |
| **Dialect-tolerant** | Detects constructs outside the profile and reports them instead of mis-rendering them | detection suite |

None of these levels weaken the CommonMark claim; they describe what sits *on
top*. Our docs must never conflate "CommonMark-conformant" with "correct for
every file a user might open."

---

## 7. What CommonMark deliberately excludes

CommonMark does not contain an explicit "out of scope" list. But the omissions
are systematic and each one is a decision. The following table is our reading,
cross-checked against the spec text and against jgm's stated philosophy.

| Excluded construct | In CommonMark? | Nearest neighbour | Why excluded (paraphrase / inference) |
|--------------------|----------------|-------------------|-----------------------------------------|
| **Tables** | No | — | Block-level; interacts with the two-phase model (§3.1). Needs a delimiter row, alignment, and a `\|` escape rule. Handed to GFM. |
| **Task lists** | No | List items | Orthogonal metadata on list items; a rendering concern, not a parsing one. Handed to GFM. |
| **Strikethrough** | No | Emphasis | Same delimiter-stack machinery, but `~~` is a third delimiter char. Handed to GFM. |
| **Autolink literals** | No | Autolinks (§6.5) | Requires guessing where a bare URL ends (trailing punctuation rules, paren balancing). Handed to GFM. |
| **Footnotes** | No | Link reference definitions | Link references are document-global; footnotes are positional and can nest. Not resolvable in phase 1. |
| **Math** (`$…$`, `$$…$$`) | No | Code spans | Requires an embedded TeX/KaTeX engine and a delimiter policy nobody agreed on. |
| **Wikilinks** (`[[…]]`) | No | Links | Product-specific. Obsidian's, not Markdown's. |
| **Front matter** (YAML/TOML) | No | — | Requires a concrete serialization format, which a syntax spec must not choose. |
| **Hard-wrapped paragraph semantics** | No | Soft line breaks | CommonMark explicitly says a soft break "may be rendered in HTML either as a line ending or as a space" (§6.8). Rendering choice. |
| **Smart punctuation / smart quotes** | No | Textual content | Purely typographic, and rendering-specific. |
| **Attribute blocks** `{#id .class}` | No | Raw HTML | Pandoc's, PHP Markdown Extra's. |
| **Definition lists** | No | Lists | Pandoc's. |
| **Line blocks** | No | Paragraphs | Pandoc's. |
| **Admonitions / callouts** | No | Block quotes | Obsidian's. |
| **Emoji shortcodes** | No | Textual content | Rendering, not parsing. |
| **Heading IDs** | No | ATX headings | Rendering. Notably CommonMark produces `<h1>Foo</h1>` with **no** `id`. |

The spec *mentions* several of these in its introduction, and that mention is
the closest it comes to a scope statement:

> Some extended the original Markdown syntax with conventions for footnotes,
> tables, and other document elements.

That sentence, in §1.1, is CommonMark's entire acknowledgement that the
ecosystem moved past it.

**Two exclusions deserve special attention from a viewer's perspective:**

1. **No heading IDs.** Every real-world Markdown file on the internet contains
   `](#some-heading)` links that only resolve because the renderer invented
   slugs. CommonMark renders them as broken links. This is *the* most common
   source of "works on GitHub, broken in our viewer" bug reports.
2. **Raw HTML is fully normative.** §4.6 (44 examples) and §6.6 (20 examples)
   specify HTML blocks and inline HTML as *pass-through*. CommonMark says
   nothing about sanitising. A viewer that follows CommonMark and does not
   sanitise is fully conformant and completely insecure. This is not a bug in
   CommonMark; it is a division of labour between the syntax spec and the
   embedding application. See `research/11-security/`.

---

## 8. The appendix on a reference parsing strategy

Present in both CommonMark and GFM, and covered in full in
[`../04-parsing-internals/01-reference-parsing-strategy.md`](../04-parsing-internals/01-reference-parsing-strategy.md).
Summary of what it is and why it matters:

- It documents the **two-phase** parse: lines → block tree (phase 1), then tree
  → inline tree (phase 2).
- The document is a tree of blocks; the **last child of a block is "open"**,
  meaning subsequent lines can alter its contents.
- Per line, three effects are possible: close open blocks, open new blocks as
  children of the last open block, add text to the deepest open block. Once a
  line is incorporated it can be discarded — **the block phase is streaming**.
- Per line, three steps: (1) descend the open blocks, matching as many as
  possible but **not closing** unmatched ones yet (lazy continuation!);
  (2) look for new block starts, closing anything unmatched from step 1 *before*
  opening; (3) add the remaining text to the last open block.
- Setext headings and link reference definitions are **deferred**: they are
  recognised when the paragraph is *closed*, by re-examining the accumulated
  lines.
- Phase 2 walks the finished tree; because all link reference definitions are
  known by then, reference links resolve correctly.
- A.4 gives the delimiter-stack algorithm, including the `openers_bottom`
  optimisation that makes emphasis resolution sub-quadratic.

The appendix is descriptive ("the parsing strategy used in the CommonMark
reference implementations"), not normative. **But every conforming implementation
that achieves 100% is doing something structurally equivalent**, because the
rules in §§3–6 are only efficiently expressible this way. See the complexity
analysis in `04-parsing-internals/05-performance-and-limits.md`.

---

## 9. Implementation checklist derived from this document

If you are implementing from scratch, this is the minimum bar to claim
CommonMark 0.31.2 conformance:

- [ ] Character is a Unicode code point; handle `U+0000` → `U+FFFD`.
- [ ] Line endings: LF, CR, CRLF all terminate a line.
- [ ] Tabs: 4-column tab stop semantics *in indentation contexts only*, literal
      preservation elsewhere.
- [ ] Character classes: `Unicode whitespace` = `Zs` + `\t \n \f \r`;
      `Unicode punctuation` = ASCII punct + `P*` + **`S*`** (0.31 change!).
- [ ] Backslash escapes: only ASCII punctuation escapable; anything else keeps
      the backslash literally.
- [ ] Entity and numeric char refs: **not** recognised in code blocks/spans;
      `&#42;` may be a literal `*` but never a structural `*`.
- [ ] Block phase precedes inline phase. §3.1 is the licence.
- [ ] Container/leaf distinction: block quotes and list items are containers;
      everything else is a leaf.
- [ ] Leaf block start conditions in precedence order: thematic break, ATX,
      HTML block, fenced code, setext (only when closing a paragraph), indented
      code, paragraph.
- [ ] Setext headings and link reference definitions recognised at paragraph
      close, not at line read.
- [ ] HTML blocks: all 7 start/end condition types, including "only types 1–6
      may interrupt a paragraph".
- [ ] List items: the four construction rules + exceptions, including the
      "first item interrupting a paragraph must start with 1" rule.
- [ ] Lazy continuation for both block quotes and list items.
- [ ] List tightness propagation up the container tree.
- [ ] Inline phase: delimiter stack for `[`, `![`, `*`, `_`; `openers_bottom`;
      no links inside links (deactivate earlier `[` openers).
- [ ] Pass the 652 examples.

---

## Sources

All fetched 2026-10-06.

- Spec index and version table: <https://spec.commonmark.org/>
- Spec source (0.31.2, 9 757 lines): <https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/spec.txt>
- Test suite, 652 examples: <https://spec.commonmark.org/0.31.2/spec.json>
- 0.30 → 0.31.2 diff: <https://spec.commonmark.org/0.31.2/changes.html>
- Spec repository: <https://github.com/commonmark/commonmark-spec>
- Discussion forum: <https://talk.commonmark.org/>
- "Beyond Markdown" (jgm, 2018-04-17): <https://talk.commonmark.org/t/beyond-markdown/2787>
- "How to move ahead with extending CommonMark" (2020-11-26): <https://talk.commonmark.org/t/how-to-move-ahead-with-extending-commonmark/3706>
- "Extension spec as part of the CommonMark spec" (2017-05-07): <https://talk.commonmark.org/t/extension-spec-as-part-of-the-commonmark-spec/2437>
- 1.0 thread: <https://talk.commonmark.org/t/when-do-you-think-well-ship-1-0-of-the-commonmark-spec/2797>
- Issue #788 "The case for calling it Version 1.0": <https://github.com/commonmark/commonmark-spec/issues/788>
- 0.31.2 release note (jgm): <https://talk.commonmark.org/t/version-0-31-2-of-the-commonmark-spec-has-been-released/4591>
- Reference implementations: <https://github.com/commonmark/cmark>, <https://github.com/commonmark/commonmark.js>
- Our own measurements: `commonmark@0.31.2`, `markdown-it@15.0.2`, `marked@18.1.0`
  on Node 24.14.1, harness at `D:\Dev\Temp\opencode\mdbench\conform.js`.
