# 03 — Other ecosystems

This document is about **compatibility reasoning**, not adoption. We are
building a Windows/Linux desktop viewer in TypeScript. We will not call a
Python or JVM library directly. What we *will* do is open files written for
Pandoc, MkDocs, Hugo, Obsidian, Jupyter, VS Code and Doxygen, and we need to
know what each of those tools does so that "this renders wrong" becomes a
diagnosis rather than a shrug.

Verified 2026-10-06. Python versions from `pypi.org/pypi/<pkg>/json`
(`info.version` + `releases[version][0].upload_time_iso_8601`). Go from
`proxy.golang.org`. Dart from `pub.dev/api`. Java from
`repo1.maven.org/maven2/<path>/maven-metadata.xml` (`<latest>`, `<lastUpdated>`).
C from GitHub releases. GitHub stars scraped from repository pages on the day.
Where a claim is inference rather than a citation, it says so inline.

---

## 0. Why this document exists

Three concrete reasons, in order of how often they will bite us:

1. **Silently different dialects.** A file that came out of MkDocs is not
   "Markdown", it is MkDocs-flavoured Markdown, and it will use `attr_list`
   (`{: .class }`), `def_list`, `footnotes` and `admonition` (`!!! note`)
   syntaxes that our CommonMark+GFM renderer will show as literal text. We
   need to know which tools emit which extensions so we can offer a
   "compatibility profile" setting instead of a bug report. See
   [§6b](#6b-tools-that-produce-markdown-we-must-open) for the inventory of
   tools and their latest verified releases.
2. **Escaping and re-encoding round trips.** A document exported from Word →
   HTML → Markdown by Pandoc comes out with backslash escapes in places that
   surprise everyone (`\_`, `\#`, hard-coded entities). If we re-save such a
   file we can make it worse. Knowing the source tool's escaping conventions
   is the only defence.
3. **The C implementations are the oracle.** `cmark` and `cmark-gfm` *are*
   the definitions of correct behaviour. `md4c` is what LibreOffice and
   Blender ship. If a user's document renders differently in our viewer than
   in `cmark`, *we* are wrong.

---

## 1. Python

| Library | Version | Released | Licence | Notes |
|---|---|---|---|---|
| `Markdown` (Python-Markdown) | **3.11** | 2026-09-25 | BSD-3-Clause | The original Python port, by the man who wrote Markdown.pl's descendant. `requires_python >= 3.11`. Extension-by-design: every syntax feature is a `Extension` class you register. |
| `markdown-it-py` | **4.2.0** | 2026-05-07 | MIT | A faithful **port of markdown-it** to Python, by the ExecutableBook project. `requires_python >= 3.10`. Its value to us is as an **executable spec** of markdown-it behaviour. |
| `mistune` | **3.3.4** | 2026-07-22 | BSD-3-Clause | Very fast, AST-based (`mistune.create_markdown(renderer='ast')`), plugin API. `requires_python >= 3.8`. Popular in Python web stacks. |
| `commonmark` (PyPI) | **0.9.2** | 2026-05-28 | BSD-3-Clause | The spec authors' Python binding, wrapping the reference `cmark` C library via ctypes. It is *published recently* but it is **not** a spec-tracking binding: 0.9.2 corresponds to CommonMark **0.29** (2019), not 0.31.2. Treat it as a "reads 0.29-era cmark" reference, not as current. |
| `cmarkgfm` | 2025.10.22 | 2025-10-22 | BSD-2-Clause | ctypes bindings to `cmark-gfm`. This is **GitHub's own parser** as used by GitHub's rendering services. |
| `pymdown-extensions` | **12.1** | 2026-09-23 | MIT | The richest Markdown extension set in any language: 40+ extensions including `arithmatex`, `pymdownx.tasklist`, `superfences`, `critic`, `details`, `emoji`, `tabbed`, `inlinehilite`, `snippets`, `pathconverter`. |
| `Pygments` | **2.21.0** | 2026-08-17 | BSD-2-Clause | The Python highlighter. Relevant as a *comparison* for our highlighting choice. |

### 1.1 What each one does that we care about

**`markdown-it-py` is the most valuable entry on this list, and not because we
will use it.** It is a *port*, meaning it is a slow, executable translation
of markdown-it's behaviour into another language by someone who read the JS
source. When we want to answer "what does markdown-it do with this gnarly
input?", we can run the same input through `markdown-it-py` and get an
independent confirmation that our reading of the JS was right. It is a
test-oracle for our test-oracle.

```python
from markdown_it import MarkdownIt
md = MarkdownIt("commonmark")
md.render("[foo]\n\n> [foo]: /url\n")
# '<p><a href="/url">foo</a></p>\n<blockquote></blockquote>\n'
```

That output — `<blockquote></blockquote>` with no newline inside — is exactly
markdown-it 15's ex-239 failure in our CommonMark run. **Cross-language
confirmation of a real result.** We will use this as a spot-check tool.

**`Markdown` (Python-Markdown) is the opposite philosophy from every JS
parser.** It is explicitly *not* CommonMark and does not try to be. Its
documentation lists extensions that CommonMark does not have, and its
deviations are documented rather than accidental:

```python
import markdown
html = markdown.markdown(text, extensions=['tables', 'fenced_code',
                                          'attr_list', 'def_list',
                                          'footnotes', 'toc', 'admonition'])
```

The `attr_list` extension is the one we will meet most in the wild. It turns
`{: .class #id }` after any block or inline into attributes. Combined with
`def_list` (definition lists) and `admonition` (`!!! warning` blocks), that
is the MkDocs dialect. **Profile to ship:** "MkDocs" = GFM + `attrs` +
`deflist` + `container`. We already have all four plugins for markdown-it
(`markdown-it-attrs`, `-deflist`, `-container`). That is an argument for
markdown-it we did not have when we chose it.

**`mistune` is the fastest Python option** and worth noting for one specific
reason: its `renderer='ast'` mode means its output shape is mdast-like
(`{'type': 'paragraph', 'children': [...]}`), which means we can compare our
rendering pipeline against a second AST implementation.

**`cmarkgfm` is GitHub's parser.** If a user says "it looks different on
GitHub", we can reproduce it locally with `cmarkgfm` and know whether the
discrepancy is ours or GitHub's. This is the single most useful debugging
tool in the Python ecosystem for a viewer, and it costs one `pip install`.

**`pymdown-extensions` defines the long tail** we will eventually need:
arithmatex/mathjax, superfences (nested fences with custom formatters),
tabbed (tabbed code blocks), critic (insertion/deletion marks),
details (collapsible), and `pathconverter` (rewrites relative image paths).
`pymdownx.snippets` even does `--8<--` file includes, which is a
*security-relevant* feature: a Markdown file that reads other files off disk
is a capability, not a syntax. Our viewer must **never** implement it, and we
should note in docs why.

### 1.2 Verdict

Do not adopt. Adopt **`markdown-it-py` as a cross-language oracle** and
**`cmarkgfm` as a GitHub-fidelity reference**, both dev-only, both optional.

---

## 2. Go

| Library | Version | Released | Licence | Notes |
|---|---|---|---|---|
| `github.com/yuin/goldmark` | **v1.8.6** | 2026-09-03 | MIT | **Hugo's parser.** We proved this: Hugo's `go.mod` on `master` pins `github.com/yuin/goldmark v1.8.6`, plus `hugo-goldmark-extensions/extras v0.7.0`, `.../passthrough v0.5.0`, `yuin/goldmark-emoji v1.0.6`. 5,055 stars. |
| `github.com/gomarkdown/markdown` | pseudo-version `v0.0.0-20261006014541-eb0281f1d676` | **2026-10-06 — today** | BSD-2-Clause | Actively developed; a pseudo-version timestamped to the moment we fetched it means commits land constantly. Successor to `russross/blackfriday`, whose list-handling bugs the author explicitly documents. |

**goldmark's extension set is the interesting part, because Hugo is a
competing product and its dialect is a compatibility target.** From goldmark's
README: tables, strikethrough, task lists, **definition lists** built in,
plus separately-extended: GFM-style linkify, typographer, footnotes,
definition lists (again), sub/superscript, `==mark==`, and Hugo's
`extras` set (passthrough, codeblocks with named instances, `mark`/spoiler).
Hugo additionally defines **shortcodes** — `{{< figure >}}` — which are a
template language, not Markdown, and which we should not attempt.

goldmark's own performance claim: *"goldmark's performance is on par with
that of cmark, the CommonMark reference implementation written in C."* We
found **no independent benchmark** confirming this. It is a plausible claim
about a plausible design; we note it as an unverified claim.

**gomarkdown/markdown** matters as the successor to `blackfriday` — whose
last tagged release is **v2.1.0, 2020-11-07**, and whose issues goldmark's
README singles out for exactly the failure mode we care about:

> This behavior sometimes causes problems. If you migrate your Markdown text
> from GitHub to blackfriday-based wikis, many lists will immediately be
> broken.

Deep nested lists and list-blocks-with-multiple-paragraphs. If a user's
documents came from a blackfriday-based tool (many static site generators
were), their lists may be malformed *as written*. We should detect and warn
rather than silently render badly. That is a note for the UX research.

---

## 3. Dart / Flutter

| Package | Version | Published | SDK | Notes |
|---|---|---|---|---|
| `markdown` (dart.dev) | **7.3.1** | 2026-03-18 | `^3.9.0` | The Dart team's own. Small, CommonMark-oriented, block/inline tokenizer split mirroring `cmark`. Used by Flutter's own docs tooling. |

Dart's `markdown` package matters to us for one reason: **it is a
Flutter-adjacent reference implementation of a cmark-style two-phase parser**,
and its source is short and readable. If we ever need to reason about
"block phase then inline phase" with a clean example, it is 2,000 lines of
Dart instead of 3,000 lines of JS.

We are not adopting Flutter (see
[08-desktop-frameworks](../08-desktop-frameworks/)), so this is reference
reading only.

---

## 4. C

These are the **definition**, not the alternatives.

| Library | Latest release | Released | Licence | Used by |
|---|---|---|---|---|
| `cmark` | **0.31.2** | **2026-02-14** | BSD-2-Clause | The CommonMark reference implementation, by the spec authors. The npm `commonmark` package wraps a JS port of it. Note the release cadence: 0.31.1 → 2024-08-03, 0.31.2 → 2026-02-14 — a spec patch version taking 18 months is itself informative about how stable CommonMark is. |
| `cmark-gfm` | **0.29.0.gfm.13** | **2023-07-21** | BSD-2-Clause | GitHub's fork. **Last release 2023-07-21 — three years stale.** comrak's GFM badge pins `cmark-gfm` commit `2f13eee` for exactly this reason. |
| `md4c` | rolling `master` (**no GitHub Releases** — tag-per-release) | active | MIT | "**MD4C is maintained as independent open-source software.**" Passes CommonMark 0.31.2 per its README. Used by **Blender, LibreOffice, ONLYOFFICE, Qt, Stellarium**. In OSS-Fuzz. |

### 4.1 `md4c` deserves attention

md4c is a Markdown parser designed **"for applications that need to process
Markdown without building a large document tree"** — the same argument as
pulldown-cmark's pull parser, arrived at independently in C. Its own
performance pointer is to `https://talk.commonmark.org/t/2520`, the CommonMark
forum. It is the most interesting "third way" in this document:

- **No document tree at all.** Documents are walked as a token callback
  stream, like SAX.
- It is what `markdown-wasm` (the 1,674-star npm package) is built on.
- **It is embedded in desktop applications we compete with or ship alongside**
  — LibreOffice and ONLYOFFICE both use it. If a user opens a `.odt` or a
  `.docx` exported from LibreOffice, the Markdown inside was parsed by md4c.
  Matching md4c's dialect is therefore a *market* requirement, not a nicety.
- It has **extensive GFM-compatible extensions** including tables,
  strikethrough, autolinks, tasklists and footnotes.
- It is fuzzed continuously via OSS-Fuzz and has an OSS-Fuzz badge in its
  README.

**We did not find a credible published benchmark for md4c against cmark on a
document corpus**; its README links a forum thread rather than a chart. The
`talk.commonmark.org` thread is the place where the community discusses
throughput numbers informally. Treat "very fast" as a design claim, not a
measurement.

### 4.2 `cmark-gfm` being three years stale is important

GFM as a *specification* is versioned separately from its reference
implementation. When GitHub ships a rendering change, `cmark-gfm` may not
follow for years. **Practical consequence for us: `cmark-gfm` is a description
of GFM circa 2023, and GitHub's live renderer has moved on.** For fidelity
checks against "what GitHub does today", `cmarkgfm` on PyPI (2025.10.22, also
lagging) is *not* authoritative either.

If we want a live-GitHub reference we have to actually ask GitHub's API. That
is a network dependency in a desktop app, which we will not take. Instead:
**document our target as "CommonMark 0.31.2 + GFM as of the micromark
extension-gfm behaviour"**, and pin those versions.

---

## 5. Java / Kotlin

| Library | Latest | `lastUpdated` | Notes |
|---|---|---|---|
| `org.commonmark:commonmark` (commonmark-java) | **0.30.0** | **2026-08-06** | The spec authors' Java implementation. `org.commonmark:commonmark-ext-gfm-tables` at **0.18.1** — extensions are **separate artifacts** with their own (staggered) versions. |
| `com.vladsch.flexmark:flexmark` | 0.64.8 | **2023-05-23** | By far the most extensive Java Markdown implementation: ~100 optional modules. **Three years without a release.** |

`commonmark-java` at 0.30.0 with an August 2026 `lastUpdated` is alive and
healthy, and its module split is a design lesson for us: **the core parser
has no knowledge of extensions, and extensions are opt-in artifacts.** That
is what keeps core conformance at 100% while tables live at 0.18.1. markdown-it
achieves the same effect with ruler phases but in one package.

flexmark's 2023 staleness is a warning about the cost of the
"100 optional modules" strategy: 100 modules is 100 things to keep working
when the base language moves.

**No JVM Markdown parser should ever be on our critical path.** Recording
them here so that "the Java ecosystem solved this differently" is on the
record, and so that if we ever ship an Android build (Mobile phase) we know
the local-quality option exists.

---

## 6. Rust WASM builds

Covered in detail in [02-rust-parsers §7](02-rust-parsers.md#7-the-ffi-wasm-question).
Summary of the verified gap:

| Wanted | crates.io status |
|---|---|
| `pulldown-cmark-wasm` | **404** |
| `comrak-wasm` | **404** |
| `markdown-wasm` | **404** (the Rust crate; the *npm* `markdown-wasm` is a different thing built on md4c) |
| `ammonia-wasm` | **404** |

What exists on npm, verified:

- `markdown-wasm@1.2.0`, published **2021-07-01**, MIT, 1,674 stars, md4c
  based, "31 kB gzipped". **Five years stale.**
- `@ptdgrp/markdown-wasm@1.1.4`, published 2026-08-14, MIT, **2 stars**,
  comrak based.

**Conclusion: Markdown-in-WASM is not a competitive option in 2026.** For the
web target, markdown-it in JS is 4.19 KiB/ms measured and ~40 KB gzipped;
the WASM alternatives are 1–2 MB with a much smaller extension story. The
one place WASM is genuinely the right answer is **Oniguruma**, the C regex
engine that TextMate grammars require — and that is exactly how Shiki ships
it. See [04-frontend-highlighting](04-frontend-highlighting.md).

---

## 6b. Tools that *produce* Markdown we must open

The libraries above are implementations; these are the applications whose
output lands in our users' file pickers. Release data from GitHub Releases,
2026-10-06.

| Tool | Latest release | Released | Emits | What we must handle |
|---|---|---|---|---|
| **Pandoc** | **3.12** | **2026-09-29** | Pandoc Markdown: tables, deflists, footnotes, citations, math, metadata blocks, smart quotes, `~` subscripts | Everything in [06-front-matter §1.3](06-front-matter.md#13-pandoc-three-different-things-called-metadata). Also Pandoc's *escaping*: `\_`, `\#`, hard-coded `&nbsp;` after Word imports. |
| **Obsidian** | — (continuous) | — | `---` YAML front matter, `[[wikilinks]]`, `> [!callout]`, `===` embeds, `$math$` | Wikilinks and callouts. Wikilink *resolution* is a vault problem, not a parser problem — see [§7](#7-cross-ecosystem-dialect-matrix). |
| **Hugo** | — (rolling, monthly) | — | `---` YAML / `+++` TOML / `{` JSON front matter, shortcodes, goldmark extensions | Front matter (all three formats) and **shortcodes must render as literal text** — they are a template language. |
| **MkDocs** | **1.6.1** | 2024-08-30 | Python-Markdown + Material for MkDocs: `attr_list`, `def_list`, `admonition` (`!!! note`), `toc`, `pymdownx.*` | The "MkDocs profile": `attrs` + `deflist` + `container`. All three plugins exist for markdown-it. |
| **Quarto** | **v1.10.18** | 2026-07-24 | Pandoc Markdown + Jupyter notebooks; shortcodes `{{< >}}`, divs `:::`, callouts `> [!NOTE]`, `code-cell` | Pandoc dialect plus fenced divs and callouts. |
| **Docusaurus** | **v3.10.2** | 2026-07-10 | MDX, admonitions `:::note`, `Tabs`/`TabItem` JSX | **MDX is not Markdown.** MDX embeds JSX. We must render `<Tabs>` as literal text rather than crash, and MDX is a compatibility profile we do not support. |
| **VitePress** | **v2.0.0-alpha.20** | 2026-09-04 | markdown-it based; custom containers `:::info`, `:::tip`; Vue SFC blocks | markdown-it with `container` — our closest relative. |
| **Jupyter / nbconvert** | **v7.17.1** | 2026-04-08 | `.ipynb` JSON, not Markdown; converts to Markdown via pandoc | `.ipynb` is JSON. Opening one in a Markdown viewer should produce a clear message, not a parse error. |
| **Zettlr** | **v4.8.0** | 2026-09-18 | CommonMark + YAML front matter, Zotero citations `@key`, Pandoc-style `[@key]` citations | Citation syntaxes. **We render them as literal text** — resolving them requires a bibliography store we do not have. |
| **LibreOffice / ONLYOFFICE** | — | — | Export to Markdown via **md4c**'s dialect, and to HTML | See [§4.1](#41-md4c-deserves-attention). LibreOffice's Markdown export is a *very* common source of user files in this category. |
| **Word / Google Docs → Pandoc** | — | — | Pandoc with `smart` on, entity-heavy, `\` escapes | The single most common source of "why is my file full of backslashes". |

**The pattern.** Every tool in this table that is *actively developed*
(Pandoc, Quarto, Obsidian, Zettlr, Docusaurus, VitePress) emits **some
construct beyond CommonMark + GFM**, and the constructs are always the same
small set: front matter, definition lists, admonitions/callouts, footnotes,
math, and something tool-specific (shortcodes, wikilinks, citations, JSX).
**Six plugins cover six of the seven common constructs.** The seventh —
tool-specific syntax — we render literally, and say so in the UI rather than
guessing.

---

## 7. Cross-ecosystem dialect matrix

What to implement, and which tool taught us to. This table is the actionable
output of this document.

| Feature | Syntax | Who emits it | Our plugin |
|---|---|---|---|
| MkDocs attrs | `{: .class #id }` after block/inline | `markdown` + `attr_list` | `markdown-it-attrs` |
| MkDocs admonition | `!!! warning "Title"` | `markdown` + `admonition` | `markdown-it-container` |
| Definition list | `Term\n: Definition` | Python-Markdown, goldmark, PHP Extra | `markdown-it-deflist` |
| Obsidian callout | `> [!note]` | Obsidian | `markdown-it-container` |
| Obsidian wikilink | `[[Page]]`, `[[Page\|alias]]` | Obsidian, comrak, Docusaurus | **must write our own** |
| Hugo shortcode | `{{< figure >}}` | Hugo | **must not implement** — template language |
| PyMdown superfences | nested ```` ``` ```` with `{}` options | PyMdown | `markdown-it-container` |
| PyMdown tabbed | `=== "Tab"` | PyMdown | `markdown-it-container` |
| Tab leader | `\t` indentation vs 4 spaces | Everyone disagrees | we follow CommonMark |
| Front matter | `---` YAML, `+++` TOML | Jekyll/Hugo/Obsidian/Hugo | see [06-front-matter](06-front-matter.md) |
| Critic marks | `{--del--}`, `{++ins++}` | PyMdown, rST | **not implementing** |
| File includes | `--8<-- "file.md"` | PyMdown snippets | **must not implement** — reads disk |
| Math | `$inline$`, `$$block$$` | KaTeX, MathJax, GitHub, comrak, markdown-rs | `markdown-it-math` or own |
| Heading ids | `{#custom-id}` | kramdown, Python-Markdown, goldmark `WithHeadingAttribute` | `markdown-it-attrs` |
| Footnotes | `[^a]` + `[^a]:` | GFM, PHP Extra, comrak, micromark, Pandoc | `markdown-it-footnote` |
| Task list | `- [x]` | GFM | vendored `markdown-it-task-lists` |

Three rows marked **must not implement** deserve a sentence each, because the
absence of an implementation is a deliberate security decision:

- **Hugo shortcodes** are a template language that can execute code in Hugo's
  context. A viewer that interpreted them would be a remote code execution
  vector the moment a user opened an untrusted file.
- **PyMdown snippets** read other files from disk. In a desktop app where the
  user opened a folder, "the Markdown can read `~/.ssh/id_rsa` and inline it
  into a link" is a catastrophic disclosure primitive. We render the syntax as
  literal text and document why.
- **Critic marks** are harmless, but they imply a tracked-changes workflow that
  a viewer does not have; rendering them as literal text is the honest answer.

And one row marked **must write our own**: **Obsidian wikilinks**. `[[Page]]`
is a *link into a knowledge base*, not into a file path, and the resolution
semantics (by name? by path? case-insensitive? relative to which root?) belong
to the vault, not the parser. That is a resolver problem for the file-system
layer, and it is the single most-requested feature in the notes ecosystem.
It belongs in `packages/core`'s plugin surface, not in the parser config.

---

## 8. Verdict

**Adopt nothing from this document. Read all of it.**

Three concrete actions come out of it:

1. **Add `markdown-it-attrs`, `markdown-it-deflist` and `markdown-it-container`
   to the default plugin set**, not as opt-ins. `attrs` + `deflist` +
   `container` covers MkDocs, kramdown, goldmark and Obsidian callouts — four
   ecosystems for three plugins. That materially raises our compatibility
   surface for about 20 KB of gzipped JavaScript.
2. **Vendor the spec suite as a test fixture** and use `markdown-it-py` plus
   `cmarkgfm` as dev-only cross-checks. `markdown-it-py` independently
   reproduced markdown-it 15's `<blockquote></blockquote>` output, which is
   exactly the kind of confirmation a test oracle should give you.
3. **Write the three negative decisions down** — no shortcodes, no file
   includes, no template evaluation — in `docs/architecture/` next to the
   rendering pipeline, so that a future contributor proposing "just support
   Hugo shortcodes" reads the reason before the code.
