# 01.2 — History and evolution, 2004 → 2026

> Confidence tags: [`00-method/README.md` §3](../00-method/README.md#3-confidence-tags).
> Every date in this document carries a link to where it was verified.

---

## 1. Corrections to the working brief

Three dates in the assignment brief were wrong or approximate. Corrections are
listed first because a research document that silently accepts a bad premise is
worse than no document.

| Brief said | Reality | Verified at |
|------------|---------|-------------|
| "Markdown 1.0.1 (2009)" | **Markdown 1.0.1 is dated 17 December 2004** and has never been superseded | [daringfireball.net/projects/markdown](https://daringfireball.net/projects/markdown/): "Markdown 1.0.1 (18 KB) — 17 Dec 2004". Wikipedia's infobox agrees. |
| "marked (2012)" | **2011.** `marked@0.0.1` was published to npm on **2011-07-24T13:15:10Z**; the GitHub repo was created the same day | [npm registry](https://registry.npmjs.org/marked), [GitHub API](https://api.github.com/repos/markedjs/marked) |
| "CommonMark project formation (2014, Jeff Atwood + John MacFarlane)" | **Partly right, but muddled.** Atwood's call to action was **25 October 2012**; the *repo* was created **2014-08-14**; the *first spec version* (0.5) was **25 October 2014**. And the project was called **"Standard Markdown"** until September 2014 | <https://blog.codinghorror.com/the-future-of-markdown/>, GitHub API, [spec version index](https://spec.commonmark.org/), [Coding Horror rename post](https://blog.codinghorror.com/standard-markdown-is-now-common-markdown/) |

The 2009 date in the brief may be a conflation with a real 2009 event: **GitHub
began using its own Markdown variant "as early as 2009"** (Wikipedia, citing
jschan's vendored parser). That event matters; Markdown 1.0.1's release date
does not move.

---

## 2. Timeline

`[VERIFIED]` unless marked otherwise. "Repo created" and "npm first publish"
are registry facts, not marketing.

| Date | Event | Why it matters | Source |
|------|-------|----------------|--------|
| c. 1992 | **Setext** heading convention (`===` / `---`) | The only pre-Markdown construct that survived verbatim into CommonMark | [Wikipedia: Setext](https://en.wikipedia.org/wiki/Setext) `[date UNVERIFIED]` |
| 2002 | **atx** by Aaron Swartz — `#` headings | CommonMark still cites `aaronsw.com/2002/atx/atx.py` for the "space required after `#`" rule | <https://www.aaronsw.com/2002/atx/> |
| c. 2002 | **Textile**, **reStructuredText** | The other influences Gruber names. reST is a permanent contrast case: it requires blank lines before lists *inside* list items; CommonMark deliberately does not | [Wikipedia: reStructuredText](https://en.wikipedia.org/wiki/reStructuredText); [CommonMark §Lists, "principle of uniformity"](https://spec.commonmark.org/0.31.2/#lists) |
| **2004-03-09** | **Markdown 1.0b1** — first public release, 19 KB. Licence at this moment: **GPL**, commercial use **$50 per domain** | Establishes that "Markdown is BSD" is only true of the *later* release | [Wayback capture of the original project page](https://web.archive.org/web/20040311230924/https://daringfireball.net/projects/markdown/index.text) |
| 2004-03-19 | Swartz publishes about the project on his weblog | The co-authorship is documented, not folklore | <https://www.aaronsw.com/weblog/001189> |
| 2004-03 | Gruber's *Dive Into Markdown* | Contemporary description of intent | <https://daringfireball.net/2004/03/dive_into_markdown> |
| **2004-12-17** | **Markdown 1.0.1**. **BSD-style licence.** `Markdown.pl` last modified this day and never again | The end of the original project. Everything since is other people's work | [project page](https://daringfireball.net/projects/markdown/), [licence](https://daringfireball.net/projects/markdown/license), [CommonMark front page](https://commonmark.org/) |
| 2005-07 | Gruber's post on footnotes | The origin of the footnote convention that Markdown Extra formalised | <https://daringfireball.net/2005/07/footnotes> |
| 2007-05-09 | `[ANN] Markdown.pl 1.0.2b8` on the markdown-discuss list | The reference implementation's *last* announced revision, per RFC 7764's citation | [RFC 7764 §7.2 references](https://www.rfc-editor.org/rfc/rfc7764.html) |
| 2009 | GitHub starts using its own Markdown variant | The first large-scale dialect, years before any spec existed for it | Wikipedia, [Markdown §Variants](https://en.wikipedia.org/wiki/Markdown#variants) `[S5]` |
| 2010-03-20 | **pandoc** repository created | Markdown becomes a document *interchange* format, not just a web-publishing format | GitHub API |
| **2011-07-24** | **`marked` 0.0.1** published to npm | The first widely-adopted JS Markdown parser. `[VERIFIED]` — **2011, not 2012** | npm registry |
| 2012-07-01 | **mdtest** repository created; last push **2022-02-23** | The pre-CommonMark test suite, derived from Gruber's own MarkdownTest. Abandoned in practice | GitHub API |
| **2012-10-25** | **Jeff Atwood: "The Future of Markdown"** | The origin of the standardisation effort | <https://blog.codinghorror.com/the-future-of-markdown/> |
| 2013-11-03 | `remark` first published to npm | The start of the unified ecosystem | npm registry |
| **2014-08-14** | **commonmark-spec** repository created | The work begins | GitHub API |
| **2014-09-04** | "Standard Markdown" is renamed **CommonMark** | Gruber objected to the use of the word "Markdown" in the name (Wikipedia, citing a Sept 2014 exchange); Atwood announced the rename the same day | <https://blog.codinghorror.com/standard-markdown-is-now-common-markdown/> |
| **2014-10-25** | **CommonMark 0.5** — first published spec version | CommonMark's own index lists 0.5 (2014-10-25) | [spec version index](https://spec.commonmark.org/) |
| 2014-11-05 | `commonmark` (commonmark.js) first published to npm | Reference implementation becomes consumable | npm registry |
| **2014-12-19** | **markdown-it** repository created | The "high-speed pluggable implementation"; now ~22k stars | GitHub API |
| 2015-01-24 | commonmark.js repository created | | GitHub API |
| 2015 | **GFM** in use at GitHub (undated within the year) | The dialect that would dominate real-world `.md` files | Wikipedia `[S5]` |
| 2015-07-31 | **unified** repository created | The pluggable-processor architecture that mdast comes from | GitHub API |
| **2016-03** | **RFC 7763** and **RFC 7764** published (both *Informational*) | The only standards-adjacent Markdown documents. Registers `text/markdown` and the IANA "Markdown Variants" registry | <https://www.rfc-editor.org/rfc/rfc7763.html>, <https://www.rfc-editor.org/rfc/rfc7764.html> |
| 2016-12-01 | **cmark-gfm** repository created (GitHub's fork of cmark) | The C code that actually renders README files on github.com | GitHub API |
| **2017-03-14** | GitHub announces a **formal GFM specification** | The end of GFM-as-folklore | <https://githubengineering.com/a-formal-spec-for-github-markdown/> |
| 2017-08-01 | CommonMark **0.28** (624 examples) | | [spec index](https://spec.commonmark.org/) |
| 2018-11-13 | **micromark** repository created | The CommonMark parser used by the remark/unified ecosystem | GitHub API |
| **2019-04-06** | **CommonMark 0.29** (649 examples) **and GFM 0.29-gfm** | GFM freezes here. As of 2026-10-06 the GFM spec page still self-labels "Version 0.29-gfm (2019-04-06)" | [spec index](https://spec.commonmark.org/), <https://github.github.com/gfm/> |
| 2021-06-19 / 2021-06-20 | **CommonMark 0.30** (652 examples) | The only substantive spec release in five years | [spec index](https://spec.commonmark.org/) says 2021-06-19; the [GitHub release](https://github.com/commonmark/commonmark-spec/releases) was published 2021-06-20. Both dates noted rather than picking one |
| 2022-05-19 | Gruber on **Markdoc** and reserved characters | "I'm not sure I ever made this clear, publicly, but I avoided using curly braces in Markdown itself — even though they are very tempting characters — to unofficially reserve them for implementation-specific extensions" | <https://daringfireball.net/linked/2022/05/19/markdoc> |
| 2022-09-26 | **PHP Markdown Lib 2.0.0** (requires PHP 7.4+) | The most-used Markdown Extra implementation is actively maintained | <https://michelf.ca/projects/php-markdown/> |
| **2024-01-28** | **CommonMark 0.31.2** (652 examples) — **the current version as of 2026-10-06** | | [spec index](https://spec.commonmark.org/), [changelog](https://spec.commonmark.org/changelog.txt): 0.31.2 = "Fix packaging bug (date not updated in spec.txt)" |
| 2024-09-19 | `commonmark@0.31.2` npm publish; commonmark.js GitHub release | Reference implementation catches up to the spec | npm registry, GitHub API |
| 2025-02-03 | Issue **#788** "The case for calling it Version 1.0" opened; last activity 2025-10-14 | The live 1.0 debate | <https://github.com/commonmark/commonmark-spec/issues/788> |
| 2025-10-13 | The 1.0 blocker thread last updated | Non-empty | <https://talk.commonmark.org/t/issues-we-must-resolve-before-1-0-release-6-remaining/1287> |
| **2026-09-24** | IANA "Markdown Variants" registry last updated. 13 identifiers registered, including `CommonMark`, `GFM`, `Extra`, `pandoc`, `myst`, `quarto`, `mdc` | The registry has become a real, maintained index of the dialect space | <https://www.iana.org/assignments/markdown-variants/markdown-variants.xhtml> |
| 2026-09-29 | pandoc **3.12** | Multi-target converter still shipping monthly | GitHub API |
| 2026-10-05 | **`marked` 18.1.0** | | npm registry |
| 2026-10-06 | **This research.** Latest CommonMark is still 0.31.2; no 1.0 exists | | [spec index](https://spec.commonmark.org/), GitHub releases API |

---

## 3. How the community fragmented

### 3.1 The mechanism

Gruber's core was frozen on **17 December 2004** with no governance, no bug
tracker, and no versioning policy. RFC 7764 §1.2 names the resulting condition
exactly `[VERIFIED]`:

> "As a result, there is no such thing as 'invalid' Markdown, there is no
> standard demanding adherence to the Markdown syntax, and no governing body
> that guides or impedes its development."

A format with **no error state** and **no arbiter** fragments in a predictable
way. It did.

```mermaid
timeline
    title Markdown fragmentation, 2004-2026
    section Core
        2004-12-17 : Markdown 1.0.1 (BSD) : Markdown.pl frozen
    section Divergence
        2007-05-09 : Markdown.pl 1.0.2b8 announced, never released
        2009 : GitHub forks (tables, autolinks)
        2011-07-24 : marked ships its own dialect
        2012 : Markdown Extra, MultiMarkdown, pandoc add constructs
    section Standardisation attempt
        2012-10-25 : Atwood calls for a spec
        2014-08-14 : commonmark-spec repo
        2014-10-25 : CommonMark 0.5
    section Re-convergence
        2016-03 : RFC 7763 / 7764
        2017-03-14 : GFM spec written
        2019-04-06 : GFM 0.29-gfm (freezes at CommonMark 0.29)
        2024-01-28 : CommonMark 0.31.2 (still current in 2026)
```text

### 3.2 The three forces

**Force 1 — features.** Tables, footnotes, definition lists, abbreviations,
task lists. Markdown Extra formalised them with reference-style definitions
(`[^1]:`, `Apple\n:   defn`, `*[HTML]: Hyper Text Markup Language`) — the
community's solution to in-band syntax collision was *reuse existing
punctuation in new positions*, which is why `{}` were left free.

**Force 2 — output targets.** Markdown was designed for HTML. Pandoc needs LaTeX,
EPUB, DOCX, ODT. Each target needs constructs HTML cannot express: citations,
math, definition lists, notes. `markdown_in_html_blocks` and `native_divs` exist
because of this.

**Force 3 — the renderers that became products.** Obsidian, Notion, Discourse,
GitLab, MkDocs Material and Docusaurus all needed features a 2004 web-publishing
tool did not. Each shipped them. Each shipped them differently.

Gruber's own view, quoted in Wikipedia and traceable to his September 2014
exchange `[S5, quoting S2]`: "Different sites (and people) have different needs.
No one syntax would make all happy."

### 3.3 Why fragmentation was not *solved*, only *described*

CommonMark did not end the dialects. It did something narrower and more useful:
it made the divergence **measurable**. Before CommonMark there was no way to ask
"is your parser correct?" — RFC 7764 §1.3 identifies the substitute people used,
and it is remarkable `[VERIFIED]`:

> "the primary arbiter of the syntax's success is *running code*. The tool that
> converts the Markdown to a presentable format, and not a series of formal
> pronouncements by a standards body, is the basis for whether syntactic elements
> matter."

Then: "Markdown has become something of an Internet meme, in that Markdown gets
received, reinterpreted, and reworked as additional communities encounter it."

Babelmark 2/3 (<https://babelmark.github.io/>) is the tool that operationalises
this: it runs 20+ implementations against the same input and shows where they
disagree. `[VERIFIED]` that it exists and is maintained; `[UNVERIFIED]` any claim
about what a given implementation "agrees on most", since the tool is
client-rendered and results move.

---

## 4. How the community re-converged

### 4.1 What CommonMark actually did

Read the spec's own account of why it exists `[VERIFIED]`, from
[§1 "Why is a spec needed?"](https://spec.commonmark.org/0.31.2/):

> "John Gruber's canonical description of Markdown's syntax does not specify the
> syntax unambiguously. […] In the absence of a spec, early implementers
> consulted `Markdown.pl` to resolve these ambiguities. But `Markdown.pl` was
> quite buggy, and gave manifestly bad results in many cases, so it was not a
> satisfactory replacement for a spec."

It then lists **fourteen** concrete ambiguities — sublist indentation, blank
lines before block quotes, tightness of lists, marker indentation, thematic
breaks inside lists, marker-type changes, inline precedence, emphasis
precedence, block-vs-inline precedence, headings in list items, empty list
items, reference definitions in containers, duplicate definitions.

The strategy was **not** "write a better Markdown". It was:

1. Take Gruber's prose description as the intent.
2. Where it is silent, look at what the majority of implementations actually did
   (not what `Markdown.pl` did).
3. Write the rule so that "normal" documents in the wild keep rendering as their
   authors intended.
4. Attach a test to every claim.

The spec repo's README states the method `[VERIFIED]`:

> "the spec is written from the point of view of the human writer, not the
> computer reader. It is not an algorithm — an English translation of a computer
> program — but a declarative description of what counts as a block quote, a
> code block, and each of the other structural elements"

That is a genuinely unusual design choice, and it is why the spec reads like
prose and why conformance is checkable but performance is not specified.

### 4.2 The measured result: divergence is dominated by deliberate choices

**This is our own measurement (Tier S4).** Corpus: the 652 examples in
`spec.commonmark.org/0.31.2/spec.json`. Run on **2026-10-06**, Node **v24.14.1**,
**win32-x64**. Comparator for the "normalised" column: the spec's own
`normalize.py`, downloaded from the spec repo rather than reimplemented — because
the spec explicitly states that not all HTML samples are normative.

| Implementation | strict | normalised | Verdict |
|----------------|-------:|-----------:|---------|
| `commonmark@0.31.2` (reference) | **652 / 652** | **652 / 652** | Perfect by construction |
| `markdown-it@15.0.2`, preset `commonmark` | 649 / 652 | **652 / 652** | **Functionally perfect.** The 3 strict misses are `<blockquote>\n</blockquote>` vs `<blockquote></blockquote>` — serialisation, not semantics |
| `markdown-it@15.0.2`, default preset | 519 / 652 | 580 / 652 | Deliberately divergent: `html: false` escapes raw HTML |
| `markdown-it@15.0.2`, default + `html: true` | 591 / 652 | — | Enabling raw HTML recovers 72 examples but reintroduces the injection surface |
| `marked@18.1.0`, default | 498 / 652 | 640 / 652 | GFM-first: 12 residual differences, most intentional |
| `marked@18.1.0`, `pedantic: true` | 380 / 652 | 425 / 652 | Explicitly non-CommonMark; for original-Markdown compatibility |

Where the 72 real deviations come from, by spec section (measured):

| Section | `markdown-it` default | `marked` default |
|---------|---------------------:|-----------------:|
| HTML blocks | 44 | — |
| Raw HTML | 13 | — |
| Links | 4 | 1 |
| Emphasis and strong emphasis | 3 | — |
| Lists | 2 | 1 |
| Hard line breaks | 2 | — |
| Backslash escapes | 1 | — |
| Entity and numeric character references | 1 | 5 |
| Link reference definitions | 1 | — |
| Code spans | 1 | — |
| Autolinks | — | 4 |
| Tabs | — | 1 |
| **Total** | **72** | **12** |

**Reading of this data `[INFERRED]`:**

1. **markdown-it's default is not "wrong", it is *safer and non-conformant on
   purpose*.** 57 of its 72 deviations are in HTML blocks and Raw HTML, i.e.
   entirely explained by `html: false`. Its remaining deviations are entity
   percent-encoding (which the spec explicitly calls non-normative) and three
   genuine differences in emphasis/list/break handling.
2. **marked's 12 deviations are mostly GFM features.** Four are extended
   autolinking (`https://example.com` → `<a>`, `foo@bar.example.com` →
   `mailto:`) which CommonMark does not do and GFM does. Five are entity
   handling: marked passes `&ouml;` through verbatim where the spec's expected
   output has it decoded. Two are percent-encoding of non-ASCII in link
   destinations, which the spec says is not normative. **Only two are arguably
   defects:** tab handling inside a block quote (`>\t\tfoo` loses a leading
   space in a code block) and a fenced code block losing a blank line inside a
   list item.
3. **Conclusion C3, now with data:** re-convergence happened, and it was
   *substantial* — a fast JS parser reaches 652/652 after normalisation — but it
   is **dialect-first, not spec-first**. Implementations choose a dialect (GFM,
   original, pedantic) and conform well *within* it. Divergence is now a product
   decision rather than ignorance.

**A reader should not take the raw numbers as a quality ranking.** They measure
agreement with CommonMark, not correctness. marked's bare-URL autolinking is a
*feature*, not a bug.

---

## 5. Spec compliance vs user expectation

This is the central tension, and it is not resolvable in principle — only
managed.

### 5.1 The two failure modes

```mermaid
flowchart LR
    subgraph A["Spec-first: Markdown.pl, pedantic mode"]
        A1["Author writes foo_bar_baz"] --> A2["Parser has an opinion"]
        A2 --> A3["Author sees unexpected output"]
        A3 --> A4["Author blames the tool"]
        A4 --> A5["The tool is broken"]
    end
    subgraph B["User-first: original Markdown, GFM, pandoc"]
        B1["Author writes foo_bar_baz"] --> B2["Parser does nothing"]
        B2 --> B3["Source looks exactly as written"]
        B3 --> B4["Author is happy"]
        B4 --> B5["The spec is wrong for being precise"]
    end
```text

Both are rational. The tension is real and is documented from both sides.

**The spec side.** CommonMark's `#` heading rule requires a space after the
`#`s, and justifies it explicitly `[VERIFIED]`, [ATX headings](https://spec.commonmark.org/0.31.2/#atx-headings):

> "Note that many implementations currently do not require the space. However,
> the space was required by the original ATX implementation, and it helps prevent
> things like the following from being parsed as headings: `#5 bolt`, `#hashtag`."

So CommonMark *broke* thousands of documents where `#hashtag` used to be a
heading. Wikipedia records the same class of break for GFM: "GFM now requires
that the hash symbol that creates a heading be separated from the heading text
by a space character" `[S5]`.

**The user side.** Gruber's original emphasis rule is one sentence: "Text
wrapped with one `*` or `_` will be wrapped with an HTML `<em>` tag". Under it,
`un*frigging*believable` emphasises mid-word. CommonMark still allows `*`
intraword (`foo*bar*baz` → `<em>bar</em>`) but **forbids** `_` intraword
(`foo_bar_baz` → literal), a change from `Markdown.pl`. PHP Markdown Extra made
the same trade independently and documented the motivation with a real example
`[VERIFIED]`, <https://michelf.ca/projects/php-markdown/extra/>:

> "With Markdown Extra, underscores in the middle of a word are now treated as
> literal characters. […] For example, with this: `Please open the folder
> "secret_magic_box"`. Markdown Extra won't convert underscores to emphasis
> because they are in the middle of the word."

**Nobody is wrong.** One optimises for `foo_bar_baz` (a filename), the other for
`un*frigging*believable` (a joke). The format cannot satisfy both because both
use the same character.

### 5.2 The unsatisfiable case: no error to report

RFC 7763 §2 `[VERIFIED]`: "Markdown interpreted as plain text is relatively
harmless." But:

> "Since Markdown may have different interpretations depending on the tool and
> the environment, a better approach is to analyze (and sanitize or block) the
> output markup, rather than attempting to analyze the Markdown."

Combined with Gruber's "there is no such thing as 'invalid' Markdown" and the
consequence is stark: **a viewer can be wrong about a document and have nothing
to tell the user.** There is no parse error. There is no warning channel. The
document renders, and it is not what the author meant.

`[INFERRED]` This is the most under-appreciated fact about Markdown as a viewing
format, and it has a product consequence: a viewer's UX *must* include a way to
show the user the raw Markdown next to the rendering, and must never silently
"fix" a document. There is no diagnostic. Design accordingly — this becomes a
requirement in [`12-ux/`](../12-ux/).

### 5.3 Who arbitrates

There is no standards body. The actual authority structure is:

| Layer | Who | Power | Durability |
|-------|-----|-------|-----------|
| **S1 spec text** | **John MacFarlane** (jgm) — effectively sole maintainer of commonmark-spec since ~2019 | Writes the spec, cuts releases, decides disputes | High de-facto legitimacy, low bus factor. Raised openly: <https://talk.commonmark.org/t/move-to-different-authority-after-v1-0/4892> asks "Who will continue this work if @jgm isn't willing or able to do so?" `[S6]` |
| **Dialect in production** | **GitHub** (GFM), **Pandoc** (jgm), **Discourse**, **GitLab**, **Reddit** | Whatever real users type with. GFM has frozen at CommonMark 0.29 since 2019-04-06 `[VERIFIED]` | Very high. 100M+ GitHub users' documents |
| **Registry** | **IANA**, first-come-first-served, documentation only | Names a variant; defines nothing | Procedural. Registry last updated 2026-09-24 with 13 entries `[VERIFIED]` |
| **Informal** | **Babelmark** community, **talk.commonmark.org** | Produces evidence; no authority | Advisory |
| **Licensing** | IETF "Informational" RFCs 7763/7764 | Registered `text/markdown`; registered variant names | Formal but non-normative. Explicitly "not an Internet Standards Track specification" `[VERIFIED]` |
| **Vendor** | Any single product | Can and does fork | Zero formal power, all practical power |

**The honest summary `[INFERRED]`:** *implementation* arbitrates, not *spec*.
When GitHub renders your file a certain way, that is the de facto meaning,
regardless of what any spec says. RFC 7764 §1.3 predicted this in 2016: "the
primary arbiter of the syntax's success is *running code*."

The practical implication for us is uncomfortable but clear: **pick a dialect
deliberately, name it in our documentation, and accept that our renderer will
sometimes disagree with a real user's expectation — with no way to detect it.**
Shipping CommonMark 0.31.2 as the core and GFM's five extensions as an explicit,
toggleable layer is the only combination that is both defensible and honest.

---

## 6. Is CommonMark 1.0 coming?

**As of 2026-10-06: no.** Latest is **0.31.2 (2024-01-28)** `[VERIFIED]`.

The state of play `[VERIFIED]`:

- The forum carries a `release-1.0` tag and a blocker thread titled
  *Issues we MUST resolve before 1.0 release*, last updated 2025-10-13.
- Issue **#788**, "The case for calling it Version 1.0", opened 2025-02-03,
  argues that the spec is already stable in every way that matters and that the
  version number is now symbolic. A representative quote from that thread:
  "The Yeas at this point aren't going to change their mind if the number changes
  from 0.31.2 to 1.0. Most of them are doing whatever GitHub is doing."
- MacFarlane's own position, quoted in that thread (2019): "1.0 implies
  stability. We're not there yet."
- A substantive semantic change is still on the table: an open proposal to make
  the emphasis rules CJK-friendly, referenced repeatedly in the 1.0 debate.
  `[UNVERIFIED]` the current status of that proposal — we read the discussion,
  not the issue itself.

**Decision for us: do not wait. Target 0.31.2, pin it, and design so the
emphasis configuration is swappable.** If 1.0 lands with different emphasis
semantics, we must be able to change that in a config flag, not a rewrite.

`[UNVERIFIED]` The claim in issue #788 that "GitHub has abandoned staying in
sync with CommonMark" is a *forum participant's assertion*. GitHub has not
confirmed it. It is consistent with the observable fact that GFM has been frozen
at CommonMark 0.29 since 2019, but consistency is not confirmation. Flagged,
not used as a premise.

---

## 7. Consequences for the project

| # | Decision | Justification |
|---|----------|---------------|
| D1 | **Core dialect = CommonMark 0.31.2**, pinned exactly | Current, testable, 652 examples, de-facto reference. §4.2 shows a compliant parser is achievable |
| D2 | **GFM's five extensions as a separate, named layer** — tables, task lists, strikethrough, extended autolinks, tagfilter | GFM is what real users mean when they say Markdown. §4.2 shows the autolink difference alone accounts for 4 of marked's 12 deviations |
| D3 | **No round-trip guarantee in v1.** Render-only | §5.2: we cannot detect wrong parses, so rewriting a document risks silently changing it |
| D4 | **Expose the source alongside the render, permanently** | §5.2: no diagnostics exist; the source is the only ground truth |
| D5 | **Make emphasis behaviour configurable** | §6: CJK emphasis may change in CommonMark 1.0 |
| D6 | **Never claim "Markdown" without naming the dialect** | §5: "Markdown" is not a meaning |

---

## 8. Open questions

| Question | Status | Destination |
|----------|--------|-------------|
| How often do real documents diverge across Markdown 1.0.1 / CommonMark 0.31.2 / GFM? | `[UNVERIFIED]` — **highest-value missing measurement in this document** | Corpus study; gates ADR-0004 |
| What is the current status of the CJK-emphasis proposal? | `[UNVERIFIED]` | Watch commonmark-spec#650 |
| Is GFM still tracking CommonMark internally? | `[UNVERIFIED]` — only forum assertion | Watch github/cmark-gfm |
| Who maintains CommonMark after jgm? | `[UNVERIFIED]` — raised, unresolved | Governance risk; note it in ADR-0004 |
| What does Babelmark actually show today? | `[UNVERIFIED]` — tool is client-rendered | `06-libraries/` |

Next: [`03-core-principles.md`](./03-core-principles.md).
