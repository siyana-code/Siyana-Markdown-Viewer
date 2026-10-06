# Research log

Chronological record of what was investigated, what was consulted, what was
concluded, and what was left open. Newest entry at the top of each day's block.

Conventions: **Verified** = primary source read. **Ran** = we executed code.
**Open** = unresolved, carried forward to `15-open-questions/`.

---

## 2026-10-06 — Phase 1, session 1: method and bibliography scaffolding

### Investigated
Whether this project already had a research methodology, an index, or partially
written foundations documents that would constrain us.

**Consulted:** local repository tree (`docs/README.md`, `research/README.md`).

**Concluded:**
- `research/README.md` already fixes the folder taxonomy and the ground rules
  (cite a primary source, mark inference, prefer versioned facts, record
  unknowns). Our method document must be *consistent* with those rules, not
  invent parallel ones.
- The confidence tags **VERIFIED / INFERRED / UNVERIFIED** are named in the
  assignment and match the repo's "mark inference as inference" rule. Kept.
- `docs/adr/0004-markdown-parser-strategy.md` is listed as *not yet existing*.
  The research phase exists to make that ADR writable.
- No application code exists yet. Nothing to benchmark against; the "library"
  half of the picture must be built from scratch.

**Open:** the repo has no `research/15-open-questions/` yet. Created lazily when
we have something real to put in it.

---

## 2026-10-06 — Session 2: primary sources, first pass

### Investigated
What Markdown actually is, per its own author, rather than per our memory.

**Consulted:**
- <https://daringfireball.net/projects/markdown/> — project page, Markdown 1.0.1
  dated 17 Dec 2004, BSD-style licence, "two things" framing (syntax + Perl
  tool).
- <https://daringfireball.net/projects/markdown/syntax> — the canonical syntax
  page, including the Philosophy section and the Inline HTML section that
  establishes "no Markdown inside block-level HTML".
- <https://daringfireball.net/projects/markdown/license> — confirmed BSD-style,
  copyright 2004 John Gruber. Note: the 2004-03-11 archived project page says
  "The code is open source, licensed under the GPL" and "free for personal use,
  costs $50 per domain for commercial use" — i.e. the licence **changed** after
  the first release. Important for anyone vendoring `Markdown.pl`.

**Concluded:**
- The design goal is quotable and load-bearing: "The overriding design goal for
  Markdown's formatting syntax is to make it as readable as possible."
- "HTML is a *publishing* format; Markdown is a *writing* format." — this single
  sentence answers most questions about why Markdown omits constructs.
- Markdown 1.0.1 is from **17 December 2004** and has never been superseded. That
  is over 21 years of a frozen reference implementation.
- Gruber's original emphasis documentation is one sentence long. Everything since
  is other people's elaboration.

**Open:** none.

---

## 2026-10-06 — Session 3: the specification landscape

### Investigated
What specs exist, what their current versions are, and what authority they carry.

**Consulted:**
- <https://spec.commonmark.org/> — full version index with dates.
- <https://spec.commonmark.org/0.31.2/> — the current spec.
- `https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/spec.txt`
  — the machine-readable source, which contains the *prose rationale* sections
  that the rendered spec hides in appendices.
- `https://spec.commonmark.org/changelog.txt` — per-version change log.
- <https://github.github.com/gfm/> — GFM spec, self-labelled
  **Version 0.29-gfm (2019-04-06)**.
- <https://www.rfc-editor.org/rfc/rfc7763.txt> and `rfc7764.txt` — full text.
- <https://www.iana.org/assignments/markdown-variants/markdown-variants.xhtml>
  — the live registry; **last updated 2026-09-24**, listing 12 variants.

**Concluded:**
- Current CommonMark is **0.31.2, released 2024-01-28**. Versions are 0.x;
  there is **no 1.0**. See the 1.0 discussion below.
- GFM is frozen at CommonMark 0.29 plus five extensions (tables, task lists,
  strikethrough, extended autolinks, disallowed raw HTML). Confirmed by reading
  the extension markers in the spec source: exactly five `## … (extension)`
  headings.
- RFC 7763/7764 (March 2016) are the only *standards-track-adjacent* documents
  Markdown has. Both are **Informational**, not Standards Track. They register
  `text/markdown` and a variant registry; they do not specify syntax.
- RFC 7764 §1.2 contains the single best statement of *why* Markdown exists that
  we have found anywhere, and it attributes it to Gruber: "Fed up with the
  complexity and security pitfalls of formal markup languages (e.g., HTML5) and
  proprietary binary formats (e.g., commercial word-processing software), yet
  unwilling to be confined to the restrictions of plain text, many users have
  turned to Markdown for document processing."
- RFC 7763's Security considerations section contains an actionable, citable
  engineering recommendation: *"a better approach is to analyze (and sanitize or
  block) the output markup, rather than attempting to analyze the Markdown."*
  This is our C7 conclusion's primary source and it predates us by a decade.
- RFC 7763 §3: `[MARKDOWN] does not define any fragment identifiers, but some
  variants do`. So heading anchors are **not** a spec feature. Important for the
  viewer: anchor generation is ours to define.

**Open:** CommonMark 1.0. Investigated next; see session 4.

---

## 2026-10-06 — Session 4: is CommonMark 1.0 coming?

### Investigated
Whether the "no 1.0 yet" statement in Wikipedia (and repeated by us) is still
true, or whether a 1.0 has shipped that our knowledge missed.

**Consulted:**
- <https://spec.commonmark.org/> — latest is still 0.31.2 (2024-01-28).
- GitHub API `repos/commonmark/commonmark-spec/releases` — top five releases are
  0.31.2, 0.31.1, 0.31.0, 0.30, 0.29. Nothing newer. Branches present:
  `master`, `mom`, `entities`, `newformat`.
- <https://talk.commonmark.org/t/issues-we-must-resolve-before-1-0-release-6-remaining/1287>
  — the blocker list, last updated 2025-10-13.
- <https://github.com/commonmark/commonmark-spec/issues/788> — "The case for
  calling it Version 1.0", opened 2025-02-03, still open, last touched
  2025-10-14.

**Concluded:**
- As of 2026-10-06, the latest CommonMark specification is **0.31.2 (2024-01-28)**.
- A 1.0 release is **proposed and debated, not scheduled**. The tag
  `release-1.0` exists on the forum; the blocker list is non-empty.
- There is a live community argument (issue #788) that the field already
  *behaves* as if 1.0 exists and that the version number is symbolic. Key quote
  from that thread: "In all the ways that matter CommonMark is stable."
- Counter-pressure worth tracking: an open issue proposes that emphasis rules be
  made CJK-friendly before 1.0 (linked as commonmark-spec#650). That is a
  *semantic change*, which is exactly why 1.0 is blocked.

**Decision:** we do **not** wait for 1.0. We target **0.31.2** and pin it.

**Open:** [UNVERIFIED] the claim that "GitHub has abandoned staying in sync with
CommonMark" appears in a forum post and is not confirmed by GitHub. Flagged; not
used as a premise.

---

## 2026-10-06 — Session 5: history, verified rather than remembered

### Investigated
The actual dates and artefacts of the timeline, because the version numbers in our
brief were partly approximate.

**Consulted:**
- <https://en.wikipedia.org/wiki/Markdown> — used as an *index*; every load-bearing
  claim chased to its footnote.
- Wayback capture of the original project page,
  <https://web.archive.org/web/20040311230924/https://daringfireball.net/projects/markdown/index.text>
  — proves the first public release was **Markdown 1.0b1, 9 March 2004**, and
  that at that moment the code was GPL and commercial use cost $50/domain.
- <https://www.aaronsw.com/2002/atx/> — Aaron Swartz's `atx`, the 2002 precursor.
  CommonMark's ATX heading section cites it directly for the "space required after
  `#`" rule.
- <https://www.aaronsw.com/weblog/001189> — Swartz's 19 March 2004 post.
- npm registry metadata for `marked` (created 2011-07-24, first version `0.0.1`
  same day), `markdown-it` (created 2014-12-19), `commonmark` (2014-11-05),
  `micromark` (2014-11-29), `unified` (2015-07-31), `rehype-sanitize` (2017-02-23),
  `remark` (2013-11-03).
- GitHub API for repo creation dates: `markedjs/marked` 2011-07-24,
  `markdown-it/markdown-it` 2014-12-19, `commonmark/commonmark.js` 2015-01-24,
  `jgm/pandoc` 2010-03-20, `github/cmark-gfm` 2016-12-01, `michelf/mdtest`
  2012-07-01 (last push 2022-02-23), `micromark/micromark` 2018-11-13.
- <https://githubengineering.com/a-formal-spec-for-github-markdown/> — the 2017
  announcement of a written GFM spec.
- <https://michelf.ca/projects/php-markdown/extra/> — Markdown Extra feature list.

**Concluded / corrections to the working brief:**
- `marked` is from **2011**, not 2012. First npm version `0.0.1`, published
  2011-07-24T13:15:10Z.
- CommonMark's first public spec is **0.5, 25 October 2014** (per the spec's own
  version index). Wikipedia's "initial release 25 October 2014" agrees. The
  *project* was announced earlier — Atwood's "The Future of Markdown" is
  25 October **2012**.
- The rename Standard Markdown → CommonMark happened in **September 2014**
  (Atwood, Coding Horror). Before that there is no "CommonMark".
- **Markdown.pl was last updated 17 December 2004** and is described by the
  CommonMark project as "quite buggy, and gave manifestly bad results in many
  cases, so it was not a satisfactory replacement for a spec."
- PHP Markdown Lib current is **2.0.0, September 2022** (michelf.ca), requiring
  PHP 7.4+.
- `michelf/mdtest` has not been touched since **2022-02-23**. CommonMark's own
  front page calls it "the closest thing we had, and is now obsolete."

**Open:** the exact date of the first `atx` release (2002 per Swartz and
Wikipedia) — we have the archive but did not pin a day. Not load-bearing.

---

## 2026-10-06 — Session 6: the delimiter-run problem, from the source

### Investigated
Why emphasis needs the elaborate flanking rules, with real examples and real
output rather than folklore.

**Consulted:** `spec.txt` at tag `0.31.2`, section
[Emphasis and strong emphasis](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis)
— including the 12 numbered rules, the 17 disambiguation principles, and the
Appendix A description of the delimiter-stack algorithm with `openers_bottom`.

**Ran:** `commonmark@0.31.2` on 20 hand-picked pathological inputs, to see the
actual output rather than trusting our memory of it.

**Concluded:**
- The rules exist because the original prose is one sentence long and the
  original implementation was buggy. That is stated by the spec itself.
- CommonMark uses **left-flanking / right-flanking** defined over Unicode
  whitespace and Unicode punctuation, and adds the **"multiple of 3" rule** to
  break the worst residual ambiguity.
- Rules 13–17 are *tie-breakers*, not definitions: minimize nesting; prefer
  `<em><strong>` over `<strong><em>`; earlier span wins on overlap; later-opening
  shorter span wins on same closer; and **code spans, links, images and HTML
  tags bind tighter than emphasis**.
- The intraword asymmetry (`foo*bar*baz` emphasises, `foo_bar_baz` does not) is
  a deliberate safety rule, motivated by variable names like `secret_magic_box`
  — confirmed by reading PHP Markdown Extra's docs, which made the same call.
- Verified outputs we will cite (commonmark.js 0.31.2):
  - `*foo *bar* baz*` → `<em>foo <em>bar</em> baz</em>` (nested emphasis, not
    `<em>foo *bar</em> baz*>`)
  - `**foo *bar** baz**` → `<p><em><em>foo <em>bar</em></em> baz</em>*</p>`
    (rule 13/14 disambiguation, not strong)
  - `**foo **bar baz**` → `<p>**foo <strong>bar baz</strong></p>` (rule 16)
  - `*foo _bar* baz_` → `<p><em>foo _bar</em> baz_</p>` (rule 15)

**Open:** none. This is the most solid section we have.

---

## 2026-10-06 — Session 7: the conformance experiment

### Investigated
Whether popular JS Markdown libraries actually conform to CommonMark, and what
"conform" even means given the spec's own escape hatch.

**Consulted:** the spec's §1.3 caveat that HTML samples are not all normative;
`normalize.py` from the spec repo.

**Ran** (2026-10-06, Node v24.14.1, win32 x64, corpus =
`spec.commonmark.org/0.31.2/spec.json`, 652 examples):

| Implementation | strict | normalised |
|---|---|---|
| `commonmark@0.31.2` | 652/652 | 652/652 |
| `markdown-it@15.0.2`, `commonmark` preset | 649/652 | **652/652** |
| `markdown-it@15.0.2`, default preset | 519/652 | 580/652 |
| `markdown-it@15.0.2`, default + `html:true` | 591/652 | (not normalised separately) |
| `marked@18.1.0`, default | 498/652 | 640/652 |

**Concluded:**
- markdown-it's three strict failures are cosmetic: `<blockquote>\n</blockquote>`
  vs `<blockquote></blockquote>`. After the spec's normaliser it is **perfect**.
  Choosing the `commonmark` preset is a configuration decision, not a library
  decision.
- markdown-it's *default* preset loses 72 examples after normalisation, almost
  all in **HTML blocks** — because `html: false` escapes raw HTML by default.
  That is a security feature, and it is why the default preset is not
  CommonMark-conformant. Conflating "conformance" with "unsafe" here would be a
  category error; both facts need to be stated together.
- `marked` at 18.1.0 defaults to GFM semantics, so its 12 residual
  normalisation failures are mostly **intentional GFM deviations**:
  bare-URL autolinking (`https://example.com` → link), entity preservation
  (`&ouml;` kept verbatim), and non-percent-encoded link destinations. Two are
  genuine bugs: tab handling inside a block quote (`>\t\tfoo`), and a fenced code
  block losing a blank line inside a list item.
- **Therefore:** "Markdown parsers diverge" is true and measurable, but the
  divergence is dominated by *deliberate dialect choice*, not by ignorance.

**Methodological correction applied:** the first run compared raw strings and
reported 649/652 for markdown-it. We re-ran with the spec's own `normalize.py`
and got 652/652. The first number was wrong. Both are recorded; the normalised
one is the honest conformance measure, the strict one is the
"byte-identical-to-reference" measure.

**Open:** no performance measurement was taken. Deliberate. See method §6.

---

## 2026-10-06 — Session 8: the viewer problem

### Investigated
What a Markdown *viewer* must do that a Markdown *library* does not.

**Consulted:**
- <https://nodejs.org/api/fs.html> (and `fs.md` in the Node source repo) — the
  `fs.watch` caveats section, verbatim: not 100% consistent across platforms;
  Windows emits no events if the watched directory is moved or renamed; on Linux
  and macOS the watch follows the **inode**, so delete-and-recreate silently
  detaches the watcher; the `filename` argument is not guaranteed; watching is
  unreliable on NFS/SMB and under Vagrant/Docker.
- <https://man7.org/linux/man-pages/man7/inotify.7.html> — the three
  `/proc/sys/fs/inotify/*` limits, `IN_Q_OVERFLOW`, and the queue-drop behaviour.
- <https://jekyllrb.com/docs/front-matter/> — YAML front matter delimited by
  triple-dashed lines, must be the first thing in the file; explicit warning
  about BOM headers on Windows.
- <https://gohugo.io/content-management/front-matter/> — a competing front matter
  standard (TOML/JSON/YAML).
- RFC 7763 §3 on fragment identifiers — Markdown defines none.
- RFC 7763 §2 security considerations — the "sanitize the output" recommendation,
  plus the specific warning that "malicious Unicode-based Markdown could, for
  example, surreptitiously change the directionality of the text."
- <https://www.w3.org/TR/wai-aria-1.2/> — for the accessibility obligation.
- <https://quilljs.com/docs/delta/> and <https://prosemirror.net/> — real
  rich-text-editor internal formats, for the three-way representation comparison.
  Quill's Delta is a genuinely instructive counterexample: "Deltas can describe
  any Quill document, includes all text and formatting information, without the
  ambiguity and complexity of HTML" — i.e. a rich editor can fix HTML's
  *ambiguity* problem without fixing HTML's *verbosity* problem.

**Concluded:**
- The filesystem watcher is the highest-risk, lowest-library-support part of a
  viewer. Node's own documentation says the API is unreliable in exactly the
  situations a viewer runs in. This must be an app-level decision with its own
  ADR, not a library call.
- Anchor/fragment handling is **unspecified by Markdown**. RFC 7763 says so
  explicitly. Any `#slug` scheme we ship is a product decision that must be
  documented, and interop with GitHub-style slugs is worth choosing deliberately.
- Front matter is a de-facto convention (Jekyll/Hugo), not part of Markdown, and
  its delimiters collide with Markdown's own syntax: a file starting with `---` is
  ambiguous between front matter and a thematic break. This is a concrete parsing
  problem, not a style question.
- Trust boundary: we render files that arrive from outside our control. RFC 7763
  says sanitise the output. GFM shows the industry taking this seriously with a
  `tagfilter` extension that neutralises nine specific tags by rewriting `<` to
  `&lt;`.

**Open:** [UNVERIFIED] nothing here was measured. The watcher section is
documentation-derived. Recorded as such.

---

## 2026-10-06 — Session 9: bibliography curation

### Investigated
Which sources are real, current, and load-bearing enough to cite.

**Ran:** HTTP status verification of ~95 candidate URLs.

**Concluded:**
- Verified live and usable: all 40+ sources listed in
  [`source-index.md`](./source-index.md).
- Rejected as dead or wrong:
  - `github.com/remarkjs/unified` → **404**; the correct org is
    `github.com/unifiedjs/unified`.
  - `github.com/gruber/markdown` → 404. There is no canonical Gruber repo.
  - `daringfireball.net/projects/markdown/markdown.pl` → 404. The tool is
    distributed as `Markdown_1.0.1.zip` on the project page, not as a browsable
    file.
  - `johnmacfarlane.net/babelmark2/faq.html` → 404; only the Wayback capture is
    live.
  - `developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Guides/CORS` → 404
    (MDN restructured its URL space).
- Live but not usable as citations: `arstechnica.com/...markdown-throwdown...`
  returns **405** to automated fetches. Excluded from the index rather than cited
  from memory.
- npm registry and GitHub REST API are the authoritative sources for
  "version as of date". Used in preference to READMEs wherever they disagree.

**Open:** none.

---

## Carry-forward: open questions after session 9

1. **Corpus.** We have a syntax corpus (652 spec examples) and no content corpus.
   Blocked on nothing; just not started. Highest-value next research task.
2. **CommonMark 1.0.** Watch `talk.commonmark.org` tag `release-1.0`.
3. **CJK emphasis.** commonmark-spec#650 may change emphasis semantics in 1.0.
   Our renderer must be able to change this without a rewrite.
4. **Performance.** Zero data. Must measure before choosing a parser on speed
   grounds. `10-performance/`.
5. **Windows/Linux watcher behaviour in the wild.** Documentation is clear about
   guarantees and silent about reality. Needs an experiment.
6. **Whether we target 0.31.2 strictly or 0.31.2 + GFM subset.** This is
   ADR-0004's job; this research phase's job is to make the trade-off legible.
