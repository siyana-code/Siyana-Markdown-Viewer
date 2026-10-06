# 04 · More Tools

> **Class: mostly *reference implementations*.** These are not competitors.
> They are the tools whose **output** we must render, whose **techniques** we
> should adopt, and whose **mistakes** we should avoid.

Research date: **6 October 2026**. Verified against each project's own site,
repository, `README`, or `LICENSE`. Anything unverified is marked.

For each entry: **what it solves well**, **what it deliberately skips**, and
**class**.

---

## The landscape in one table

| Tool | Licence | Language | Class | One-line verdict |
|---|---|---|---|---|
| **GitHub** | Service; `github/markup` + `github/html-pipeline` are MIT | Ruby + `commonmarker`/C | Reference | **The canonical definition of "safe" Markdown rendering.** Our correctness and safety baseline |
| **VS Code preview** | MIT (VS Code) | TypeScript, **markdown-it** | Reference | The best-embedded viewer in the world, and it is only half a viewer |
| **mdBook** | **MPL-2.0** | Rust | Reference | The best *book* renderer. Its `SUMMARY.md` is a great UX idea |
| **MkDocs Material** | **MIT** | Python | Reference | The best *documentation site* renderer. Design gold standard |
| **Docusaurus** | **MIT** | TypeScript / React | Reference | Best-in-class MDX + versioning + i18n. Heavyweight |
| **VitePress** | **MIT** | TypeScript / Vue | Reference | Fastest docs SSG. Great perf numbers |
| **Hugo** | **Apache-2.0** (code); content CC BY 4.0 | Go, **Goldmark** | Reference | The most spec-correct Markdown renderer in wide use |
| **Jupyter Book** | **BSD-3-Clause** | Python / TypeScript | Reference | The scientific-publishing reference. Best citation + cross-ref UX |
| **Notion / Obsidian importers** | Varies | — | Inspiration | A huge UX lesson in **tolerating everything and losing nothing** |
| **Markmap** | **MIT** (`markmap/markmap`) | TypeScript | Inspiration | One idea: Markdown's outline *is* a mind map |
| **mdpdf** | Varies by fork (**UNVERIFIED**) | JavaScript / Rust / C# | Inspiration | Markdown → print is a solved problem worth copying the shape of |
| **glow** | **MIT** (verified from `LICENSE`) | Go | Inspiration | **The minimal-UI masterclass.** Watch how much it chooses not to do |
| **mdcat** | **MPL-2.0**, **archived** | Rust | Inspiration | Terminal reading, and a lesson in project death |

---

## 1. GitHub — the canonical "safe" rendering pipeline

**Class: reference implementation. This is the standard we are measured against.**

### What it is

When you view a Markdown file on github.com, the content passes through a
multi-stage pipeline. The `github/markup` README (verified) describes stage one
precisely:

> "This library is the **first step** of a journey that every markup file in a
> repository goes on before it is rendered on GitHub.com:
>
> 1. `github-markup` selects an _underlying library_ to convert the raw markup
>    to HTML.
> 1. The HTML is **sanitized, aggressively** removing things that could harm you
>    and your kin — such as `script` tags, inline-styles, and `class` or `id`
>    attributes.
> 1. **Syntax highlighting** is performed on code blocks. See
>    `github/linguist`.
> 1. The HTML is passed through **other filters that add special sauce**, such as
>    **emoji, task lists, named anchors, CDN caching for images, and
>    autolinking**.
> 1. The resulting HTML is rendered on GitHub.com."

And critically:

> "Please note that **only the first step** is covered by this gem — the rest
> happens on GitHub.com. In particular, `markup` itself **does no sanitization**
> of the resulting HTML, as it expects that to be covered by whatever pipeline
> is consuming the HTML."

### 1.1 The parser situation (a correction worth making)

There is widespread belief that "GitHub uses cmark-gfm". That was true for
years. Currently (verified from the `github/markup` README's own markup list)
GitHub's `.md` handler maps to the **`commonmarker`** gem, which wraps
**`cmark-gfm`** — GitHub's fork of the C CommonMark reference implementation.
So both are partly right.

**Verified from `github/cmark-gfm`'s README:**

> "`cmark-gfm` is an extended version of the C reference implementation of
> CommonMark… This repository adds GitHub Flavored Markdown extensions to the
> upstream implementation, as defined in the spec."

> "It provides a shared library (`libcmark`) with functions for parsing
> CommonMark documents to an **abstract syntax tree (AST)**, manipulating the
> AST, and rendering the document to **HTML, groff man, LaTeX, CommonMark, or an
> XML representation of the AST**."

> "**Portable.** The library and program are written in standard **C99** and have
> **no external dependencies**. It has been tested with MSVC, gcc, tcc, and
> clang."

> "**Fast.** … In our benchmarks, `cmark` is **10,000 times faster** than the
> original `Markdown.pl**."

### 1.2 The sanitization engine: `html-pipeline`

**Verified** from `github/html-pipeline`'s README:

> "GitHub HTML processing filters and utilities. This module includes a small
> framework for defining **DOM based content filters** and applying them to user
> provided content."
> "A filter takes an HTML string or `Nokogiri::HTML::DocumentFragment`,
> optionally manipulates it, and then outputs the result."

A filter chain is composed as:

```ruby
pipeline = HTML::Pipeline.new [
  HTML::Pipeline::MarkdownFilter,
  HTML::Pipeline::SyntaxHighlightFilter
]
result = pipeline.call(source)
```

GitHub's production pipeline is a long chain of these filters, one per feature:
Markdown → sanitize → syntax highlight → task lists → mention links → emoji →
autolink → image CDN rewriting → anchor generation → **sanitize again**.

### 1.3 The pipeline architecture lesson — this is the big one

> **GitHub's design is: parse to AST → render to HTML → run a chain of
> independent, single-purpose DOM filters → sanitize. Every feature is a filter.**

Consequences we should copy exactly:

| # | Lesson | Why it matters to us |
|---|---|---|
| G1 | **One AST, many filters.** Features do not each own a parse | N features = 1 parse. Our `packages/core` should be a filter chain, not a monolith. See [05 rendering](../05-rendering/) |
| G2 | **Sanitize twice: once early, once at the end.** Early sanitization protects the intermediate filters; final sanitization catches what the filters introduced | This is the correct pattern and most home-grown implementations do it only once |
| G3 | **`markup` itself does no sanitization** — "it expects that to be covered by whatever pipeline is consuming the HTML" | The library's contract is explicit. Our renderer should have the same explicit contract: **it emits; it does not decide what is safe** |
| G4 | **Feature filters are the extension point.** Task lists, anchors, autolink, emoji, CDN rewriting — all interchangeable, testable in isolation | Our KaTeX, Mermaid, Shiki, and footnote renderers should be filters with the same shape |
| G5 | **`cmark-gfm` renders one AST to HTML, groff man, LaTeX, CommonMark, and XML.** Multi-output from one parse | Our PDF and HTML export paths should reuse one parse. See [10 performance](../10-performance/) |
| G6 | **Zero-dependency C99 portability** is how GitHub can run the same parser everywhere | Our parser choice in [06 libraries](../06-libraries/) should be judged on portability across the webview, a worker, and a web target |

### 1.4 What GitHub deliberately skips

| Skips | Why it matters to us |
|---|---|
| Arbitrary HTML in documents | Aggressive sanitization; **`style`, `class`, and `id` are stripped** (verified from the markup README). Note: **GitHub's own anchors are re-added as a filter *after* sanitization** — that is how they get `id`s back. We should do the same, and it means our *renderer* must own the ids, not rely on author HTML |
| No live preview | GitHub renders; it does not edit. **This is why GitHub is a reference and not a competitor** |
| No editing of rendered content | |
| No footnote hover | GitHub renders footnotes inline at the bottom. Confirms our choice — [01-reading-ux §10](../12-ux/01-reading-ux.md#10-footnotes) |
| No Mermaid sandbox | GitHub *does* render Mermaid now (via a filter), but sandboxed. We can render it locally with no network at all — a genuine advantage of a local viewer. See [11 security](../11-security/) |
| No local files beyond `https` | GitHub blocks `http` images. **We must allow local relative images** — that is a feature we have and GitHub cannot |

### 1.5 GitLab

Structurally the same idea with the same lineage: GFM rendering built on
`cmark-gfm` plus a sanitization filter chain. Nothing in this research depends on
GitLab's specific implementation, and its renderer is not documented as publicly
as GitHub's. **UNVERIFIED** for current internals. Treat GitHub as the reference
and GitLab as a corroborating implementation.

---

## 2. VS Code's built-in Markdown preview

**Class: reference implementation — and the most instructive one.**

### What it is

Verified from `code.visualstudio.com/docs/languages/markdown` (page last
updated **30 September 2026**):

> "You just start writing Markdown text, save the file with the `.md` extension
> and then you can toggle the visualization of the editor between the code and
> the preview of the Markdown file."
> "To switch between views, press ⇧⌘V (Windows, Linux Ctrl+Shift+V) in the
> editor. You can view the preview side-by-side (⌘K V (Windows, Linux
> **Ctrl+K V**)) with the file you are editing and see changes reflected in
> real-time as you edit."

And the stack, verified:

> "**Does VS Code support GitHub Flavored Markdown?**
> **No**, VS Code targets the CommonMark Markdown specification using the
> **markdown-it** library. GitHub is moving toward the CommonMark specification,
> which you can read about in this update."

**So: markdown-it, CommonMark-first, not GFM.** (markdown-it is MIT, 21.9k
stars, 100% CommonMark, with a plugin architecture for extensions.)

### What it does brilliantly

| Feature | Why it is excellent |
|---|---|
| **Scroll synchronisation, both directions** | Editor → preview and preview → editor, both disableable via `markdown.preview.scrollPreviewWithEditor` / `scrollEditorWithPreview`. This is the hardest UX problem in two-pane Markdown and it just works |
| **Current-line marker** | "The currently selected line in the editor is indicated in the Markdown preview by a light gray bar in the left margin." Brilliant, unobtrusive, cheap |
| **Double-click to open source** | Double-clicking an element in the preview opens the editor at the nearest source line. **This is the single best idea in the preview, and it is the answer to "I want to fix this one bit"** |
| **Preview locking** | Lock a preview to its document with `Markdown: Toggle Preview Locking`; locked previews show `[Preview]` in the title |
| **Three-level security model** | **Strict** (default: trusted content only, scripts disabled, `http` images blocked), **Allow insecure content** (`http` allowed, scripts still disabled), **Disable** (all restrictions off). A blocked resource produces a visible alert with a one-click "change preview security settings" |
| **Extension points** | `markdown.styles` for user CSS; extensions contribute **markdown-it plugins** and are "activated lazily, when a Markdown preview is shown for the first time"; lazy activation is a real perf win |
| **Built-in Mermaid with pan/zoom** | Rendered in `mermaid` fenced blocks; pan with Alt+drag, scroll to zoom, click to zoom, pinch on trackpads; controls appear on hover **or focus** (correct!), and a context menu offers "Copy Diagram Source" |
| **Built-in KaTeX math** | `$x^2$` inline, `$$…$$` blocks; toggleable via `markdown.math.enabled` |
| **Markdown preview in the diff view** | Renders a *diff* as a rendered document with changes highlighted. Opt-in, and settable as the default editor for `*.md` via `workbench.editorAssociations` |
| **Link validation** | Catches links to renamed headers and deleted files. Off by default; granular toggles per link type |
| **Find All References for headings** | `Shift+Alt+F12` finds every reference to a header or link in the workspace |
| **Rename Symbol (F2) for headings** | Updates the header *and every link to it*. This is the right primitive and there is no equivalent in Obsidian |
| **Automatic link updates on move/rename** | `markdown.updateLinksOnFileMove.enabled` — `never` (default) / `prompt` / `always` |
| **Workspace header completions** | `##` offers every heading in every Markdown file in the workspace. `onDoubleHash` (default) / `onSingleOrDoubleHash` / `never` |
| **Diff previews, scroll-synced side by side** | Side-by-side or inline, kept aligned |

### What it deliberately skips — and those are our product

| Skipped | Consequence for us |
|---|---|
| **No reading mode** | It is a *preview* inside an editor. There is no way to hide the editor. **Focus mode is our whole product** — [01-reading-ux §3](../12-ux/01-reading-ux.md#1-reading-modes) |
| **No file tree** | VS Code's is a generic file tree with a Markdown-specific *outline* below it. It is not a document browser |
| **No corpus search** | VS Code's search does not search inside `.md` file *content* by default; you must search text, and the results are not rendered |
| **No backlinks panel** | "Find All References" is a command with a modal list, not a persistent panel in the reading surface |
| **No theme pairing with a document palette** | Two themes (light/dark) with a fixed preview stylesheet |
| **Requires the whole IDE** | Startup, memory, and the belief that you want to edit |
| **CommonMark, not GFM** | Verified. **We should target GFM**, because that is what the links in the wild assume |
| **`http` images blocked by default** | Correct for a web-loaded preview. **We must allow local relative images** — the single most-used Markdown feature |

### Two things we should copy outright

1. **"Open the source at this line"** on double-click of a rendered element.
   This is the answer to the editing deferral in
   [01-reading-ux §11](../12-ux/01-reading-ux.md#11-the-second-verb-editing-deferred-not-refused):
   in a read-only viewer, double-clicking any rendered block **opens it in the
   user's own editor at that line**. That is 90% of the value of editing, for
   5% of the work.
2. **The three-level security model**, with a visible indicator and a one-click
   change. Security that is visible and user-controllable is better security
   *and* better UX. See [11 security](../11-security/).

---

## 3. mdBook

**Class: reference implementation — the best book renderer.**

**Verified** from the project README:

> "mdBook is a utility to create modern online books from Markdown files."
> "All the code in this repository is released under the **Mozilla Public
> License v2.0**."

**Verified** from the docs (site version **0.5.4**):

> "mdBook is a **command line tool to create books with Markdown**. It is ideal
> for creating **product or API documentation, tutorials, course materials** or
> anything that requires a clean, easily navigable and customizable
> presentation."
> Features: "Lightweight Markdown syntax", "**Integrated search support**",
> "Color syntax highlighting", "**Theme files** allow customizing the formatting
> of the output", "**Preprocessors** can provide extensions for custom syntax and
> modifying content", "**Backends** can render the output to multiple formats",
> "Written in **Rust** for speed, safety, and simplicity".

The documentation guide itself demonstrates the output, and its keyboard map is
a design lesson: `←`/`→` for chapters, `S` or `/` to search, `?` for help, `Esc`
to close.

### What it does brilliantly

| # | Feature | Lesson |
|---|---|---|
| 1 | **`SUMMARY.md` as the book structure** (verified from the user guide's own `SUMMARY.md`) | An explicit, ordered, human-editable table of contents that supports nesting, part titles, and draft chapters. **Better than auto-generation for a book, worse for a single file.** We do the opposite: auto-generate always. Both are right for their scope, and the contrast is instructive |
| 2 | **Preprocessors** | A documented extension point that transforms content before rendering. Same architecture as GitHub's filters |
| 3 | **Backends** | Render to multiple formats from one pipeline. Same lesson as `cmark-gfm`'s multi-output |
| 4 | **Theme files** (`index.hbs`, CSS, syntax highlighting config) | A *file-based theme system* with real templating. Closest thing in the ecosystem to a real theme architecture — see [03 §4](../12-ux/03-theming.md#4-themes-as-data-not-code) for why we chose JSON tokens instead |
| 5 | **A live-reloading `serve` command** | The dev-loop idea we should copy for *our* renderer: `siyana serve` with watch + instant re-render |
| 6 | **`mdbook test`** | Runs Rust code samples. Extreme rigour; a reminder that a doc tool can validate its content |
| 7 | **Keyboard-first reading**, on the generated site | The best built-in keyboard model in any Markdown tool. Confirms our shortcut plan — [02 §8](../12-ux/02-navigation-and-find.md#8-the-full-shortcut-list) |
| 8 | **The docs are the demo** | The user guide is itself an mdBook build. A small thing with a big payoff: your manual is your best reference implementation |

### What it deliberately skips

Editing (read/build only), themes beyond `theme/`, footnotes/math only as
documented features, no app, no live corpus. **Not a competitor — it produces
files, we read files.**

---

## 4. MkDocs Material

**Class: reference implementation — the design gold standard for docs sites.**

**Verified:** MIT licence (GitHub API), 27.5k stars, Python, last push
2026-10-02. Their own positioning: *"Write your documentation in Markdown and
create a professional static site for your Open Source or commercial project in
minutes – searchable, customizable, more than 60 languages, for all devices."*

They run a **sponsorware "Insiders"** model: "new features are first exclusively
released to sponsors as part of Insiders," via a private repository, with
tiered sponsorship plans whose exact figures live on their sponsors page
(**exact prices UNVERIFIED** — the page was not reachable at time of writing;
the *model* is verified and well documented). Also **"Privacy: we don't use any
trackers"** is a documented product feature.

### What it does brilliantly

| # | Feature | Lesson |
|---|---|---|
| 1 | **The component vocabulary**: admonitions, annotations, buttons, code blocks, content tabs, data tables, diagrams, footnotes, formatting, grids, icons, images, lists, **math**, tooltips | A *catalogue of Markdown extensions as composable components*. The right way to add expressiveness without a dialect |
| 2 | **Content tabs** | The same content rendered several ways (Python/Node/cURL) in one place. Solves a real documentation problem no renderer addresses |
| 3 | **Admonitions** | Block-level callouts with semantic meaning (`note`, `warning`, `danger`, `tip`). Semantically distinguishable — an a11y-correct pattern for a non-semantic `<div>` |
| 4 | **Diagrams** | Mermaid, and more |
| 5 | **Data tables** | Markdown tables with sorting, filtering, and alignment controls — build-time interactivity |
| 6 | **Navigation: sections, tabs, instant search, versioning, tags, blog, social cards, offline (`optimize`) builds** | The complete documentation IA. Useful reference even though we build none of it |
| 7 | **"60 languages"** | Real i18n, including CJK and RTL handling of the layout. Our theme system must not assume LTR |
| 8 | **Ensuring data privacy / offline building** | A build-time tool that makes network requests by default is a privacy problem they solved explicitly |
| 9 | **Search** | Build-time client-side search index — the same `minisearch`/`lunr` architecture we chose for the runtime folder index — [02 §4.3](../12-ux/02-navigation-and-find.md#43-library-comparison-as-of-oct-2026) |

### What it deliberately skips

Editing, application UI, live file watching, anything offline at runtime. Output
is static HTML. **Not a competitor.**

### What we take

The **extension component catalogue** as a design vocabulary for our
dialect/extension decisions, the **admonition semantics** approach, and the
**offline/privacy posture** as a default rather than a setting.

---

## 5. Docusaurus

**Class: reference implementation.**

**Verified:** MIT, 66.4k stars, TypeScript, last push 2026-10-05, from
Meta/Facebook. Their own description: "a project for building, deploying, and
maintaining open source project websites easily."

### What it does brilliantly

| # | Feature | Why it matters |
|---|---|---|
| 1 | **MDX** | Markdown with JSX components inline. The most important extension to the format since GFM, because it makes documentation *composable* rather than merely *formatted*. But: MDX is an **expressions-in-content** feature, which is a **security decision**, not a formatting one |
| 2 | **Docs versioning** | Multiple published versions with a version banner. Enormously valuable for documentation and completely absent from every Markdown app |
| 3 | **Built-in i18n via Crowdin** | "Empower and grow your international community by translating your documentation" |
| 4 | **Blog + docs + pages, precomposed** | A complete IA out of the box |
| 5 | **Playground: `docusaurus.new`** | "test Docusaurus immediately in a playground" — brilliant onboarding |

### What it deliberately skips

Runtime: it is a build tool. Weight: it is a React site generator; the docs
site ships React.

### What we take — and what we must be careful about

**MDX is the interesting part, and we should be wary.** MDX means a Markdown
file can contain `<Component />`. In a *static site build*, that is a trusted
author writing code for their own site — fine. In a **document viewer that opens
files we did not author**, that is arbitrary code execution in our renderer.
**Decision: we do not support MDX, and our sanitizer's job is precisely to
prevent it.** See [04-accessibility §2](../12-ux/04-accessibility.md#23-the-sanitizer-allow-list-we-must-ship)
and [11 security](../11-security/).

The versioning idea *is* worth stealing in a different form: **remember the
last scroll position per file** is the reader's version control. See
[01-reading-ux §13 R14](../12-ux/01-reading-ux.md#13-requirement-checklist).

---

## 6. VitePress

**Class: reference implementation — the performance reference.**

**Verified:** MIT, 18.4k stars, TypeScript, last push 2026-10-05. From the
README: "a **Vue-powered static site generator** and a spiritual successor to
VuePress, built on top of Vite."

### What it does brilliantly

| # | Feature | Why it matters |
|---|---|---|
| 1 | **Speed** | Vite-based dev server with instant HMR. The dev experience is the product for a docs author |
| 2 | **On-demand routing** | Only the current page's JS is loaded. The right performance model for a document tool |
| 3 | **Per-page theming** | Each page can override the theme. Fine-grained customisation without a rebuild-everything theme |
| 4 | **Localised search** | Built in, good enough that Algolia is optional |
| 5 | **Small output** | SSGs that emit fewer bytes produce faster pages, which is the same principle as our cold-start budget |

### What it deliberately skips

Framework-neutral output. It is Vue-only.

### What we take

**The on-demand-loading principle, applied to our renderer.** A viewer's cold
start budget is the same problem a docs site has: only parse and hydrate what is
on screen. See [10 performance](../10-performance/).

---

## 7. Hugo (Goldmark)

**Class: reference implementation — the most spec-correct renderer in wide use.**

**Verified:** Apache-2.0 (GitHub API), **90.0k stars**, Go, last push
2026-10-05. From Hugo's own content-formats documentation:

> "Hugo natively renders Markdown to HTML using **Goldmark**. Goldmark is fast
> and conforms to the **CommonMark** and **GitHub Flavored Markdown**
> specifications."

> "Hugo provides custom Markdown features including:
> - **Attributes**: Apply HTML attributes such as `class` and `id` to Markdown
>   images and block elements including blockquotes, fenced code blocks,
>   headings, horizontal rules, lists, paragraphs, and tables.
> - **Extensions**: … tables, definition lists, footnotes, task lists, inserted
>   text, mark text, subscripts, superscripts, and more.
> - **Mathematics**: Include mathematical equations and expressions in Markdown
>   using LaTeX markup.
> - **Render hooks**: Override the conversion of Markdown to HTML when rendering
>   **fenced code blocks, headings, images, and links**. For example, render
>   every standalone image as an HTML `figure` element."

### What it does brilliantly

| # | Feature | Lesson for us |
|---|---|---|
| 1 | **Goldmark is CommonMark + GFM conformant and fast.** It is the strongest correctness evidence available for a Markdown renderer | [03 specifications](../03-specifications/) and [06 libraries](../06-libraries/) should be validated *against Goldmark's behaviour* as an additional oracle, not just the spec fixtures |
| 2 | **Attributes (`{#id}`, `{.class}`)** | This is the escape hatch we must support for heading ids — [02 §2.1](../12-ux/02-navigation-and-find.md#21-slugs-must-be-github-compatible). Hugo supports it; authors use it |
| 3 | **Render hooks** | Extension points *per node type*, not a global filter chain. A finer-grained model than GitHub's filters and a good complement to them |
| 4 | **Content-format mixing** | Markdown + HTML + Org + AsciiDoc + Pandoc + reST in one tree, chosen by `markup` front matter or file extension. Right for a site; far too broad for us |
| 5 | **Render every standalone image as `<figure>`** | Directly validates our figure policy — [03 §5](../12-ux/03-theming.md#5-images-and-figures) |
| 6 | **90k stars and a decade of use** | The most widely deployed Markdown renderer in the world. Its behaviour is de facto |

### What it deliberately skips

Any application. Any editing. Any live behaviour. Output is static HTML.

### What we take

Attributes syntax support, render-hook-style per-node extension points, figure
promotion, and Goldmark as an oracle.

---

## 8. Jupyter Book

**Class: reference implementation — the scientific-publishing reference.**

**Verified:** BSD-3-Clause (GitHub API), 4.3k stars, Python/TypeScript, last
push 2026-10-01. From the README:

> "Jupyter Book is an open-source tool for building **publication-quality books
> and documents from computational material**."
> Users can:
> - "write their content in Markdown files or Jupyter notebooks",
> - "include **computational elements (e.g., code cells)** in either type",
> - "include **rich syntax such as citations, cross-references, and numbered
>   equations**",
> - "using a simple command, **run the embedded code cells, cache the outputs**
>   and convert this content into: a **web-based interactive book** and a
>   **publication-quality PDF**."
>
> "Jupyter Book is an official sub-project of Jupyter." v1 (the Sphinx-based
> engine) has been moved to the `v1` branch.

### What it does brilliantly

| # | Feature | Why it matters |
|---|---|---|
| 1 | **A dual output from one source: an interactive web book AND a typeset PDF.** Both are first-class, neither is an afterthought | **This is the model for our export design** — [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output). Not "print is the browser's problem" |
| 2 | **Numbered equations, citations, and cross-references** | The three things a scientific document needs and no general Markdown renderer provides. Cross-references in particular should be in our long-term plan |
| 3 | **Executable content with output caching** | Documentation that cannot go stale |
| 4 | **Notebooks as a first-class document type** | For the future, notebooks are a format a viewer will eventually have to render |
| 5 | **Graceful architecture migration** | v2 replaced the v1 Sphinx engine while keeping v1 alive on a branch and importable | Contrast with Logseq's removals — [03-logseq §3](../13-competitors/03-logseq-and-zettlr.md#3-the-architecture-shift--this-is-the-single-most-important-thing-to-understand). **This is how to do it** |

### What it deliberately skips

General-purpose note-taking. Anything not computational.

### What we take

The dual-output export model, the additive migration discipline, and the
long-term note that **notebook rendering is a future requirement we should plan
the renderer for** (a notebook is HTML + outputs + JSON; our pipeline can
accommodate it as a preprocessor).

---

## 9. Notion / Obsidian importers

**Class: inspiration. Not tools we can inspect; lessons we can extract.**

There is no open-source "Notion viewer". What exists is a genre of **importers**,
and the best-documented one is Obsidian's community **Importer** plugin
(verified from `obsidian.md/plugins`): *"Convert your data to Markdown files you
can use in Obsidian. Works with Apple Notes, OneNote, Evernote, Notion, Google
Keep, and many other formats."* Plus **Airtable import** on Obsidian's roadmap
(July 2026).

### What they do well

| # | Lesson | Detail |
|---|---|---|
| 1 | **Lossless-as-possible conversion** | Real importers map *every* Notion block type to something. Most tools that import Markdown produce lossy output; the good ones produce ugly-but-complete output |
| 2 | **Front matter as the carrier for metadata** | Notion properties, page icons, cover images, databases, and properties all have to go somewhere. YAML front matter is where they go. **This is why front-matter tolerance is non-negotiable for a viewer** |
| 3 | **Link rewriting** | A Notion page link becomes a Markdown link; a database becomes a folder plus an index. Rewriting relative paths correctly is the hardest part and where importers break |
| 4 | **Idempotency** | Re-running an import must not duplicate or destroy content |
| 5 | **A report of what could not be converted** | Honest importers tell you what they dropped |

### What they deliberately skip

Staying in sync after import. The imported corpus is static Markdown.

### What we take — this is a bigger deal than it looks

> **For a viewer, importers matter enormously and we will not build a single
> one.**

The reasoning:

1. Our users arrive with Markdown that came from **something**. Notion exports,
   Obsidian vaults, Bear, Apple Notes, Evernote, Logseq, Zettlr, Jupyter,
   Pandoc, and eleven static site generators.
2. Every one of those emits different, imperfect Markdown, with different
   front-matter dialects, different link styles, different heading conventions,
   and different escaping.
3. **Our renderer is therefore the last mile of eleven different producers.** It
   must be maximally tolerant and maximally faithful.

Concrete requirements that follow:

| # | Requirement |
|---|---|
| 1 | Never rewrite, reformat, or "fix" a file on open. **Read-only by default, always** — [01-reading-ux §11](../12-ux/01-reading-ux.md#11-the-second-verb-editing-deferred-not-refused) |
| 2 | Parse every front-matter dialect (YAML, TOML, JSON, `---\ntitle: x\n---`, `<!--\ntitle: x\n-->`); tolerate malformed front matter by rendering it as text rather than erroring |
| 3 | Handle `[[wikilinks]]`, `#tags`, `((block refs))`, `%%comments%%`, `<!--comments-->`, `==highlight==`, `^superscript^`, `~~strike~~`, `++insert++` — from Obsidian, Logseq, and friends. **Render unknown `[[wikilinks]]` as plain text with a subtle style, never as a broken link.** Obsidian learned this the hard way |
| 4 | Honour HTML comments so `<!-- hidden -->` content stays hidden |
| 5 | Never assume a single file per page; notebooks and multi-file books exist |
| 6 | Handle BOMs, CRLF, non-UTF-8 (try UTF-8, fall back to Latin-1, **never crash**), and files with no trailing newline |
| 7 | Handle very wide tables, deeply nested lists (>10 levels), unclosed HTML tags, unbalanced `**`, and stray backticks — **without failing**. Render what you can and mark the rest as source |

**Rule, to be written into our acceptance criteria:**

> **No input file may cause the viewer to fail, show an error dialog, or render
> nothing.** The worst case is that some Markdown source appears as literal text
> with a small, non-intrusive notice. A viewer that renders imperfectly is
> useful. A viewer that errors is not.

---

## 10. Markmap

**Class: inspiration. One idea, done well.**

**Verified:** repository `markmap/markmap`, **MIT licence** ("Copyright (c) 2020
Gerald"). From the README: "Visualize your Markdown as mindmaps." Architecturally
it is a two-package split: **"we use `markmap-lib` to preprocess Markdown into
structured data, then render the data into interactive SVG with `markmap-view`."**

It has spread into VS Code (`gera2ld.markmap-vscode`), Neovim (`coc-markmap`),
Vim (`markmap.vim`), Emacs (`eaf-markmap`), and an MCP server.

### What it solves well

One thing, perfectly: **a Markdown document's outline is already a tree, so it
is already a mind map.** No conversion, no authoring format, no AI. The heading
tree *is* the visualisation.

### What it deliberately skips

Editing, integration, anything but the visualisation.

### What we take

The **`lib` / `view` split**, which is exactly the shape of our `packages/core`
(framework-agnostic) and `packages/ui`. A renderer that produces *data* and a
renderer that produces *pixels* must be separable. Verify this in our
architecture: [14-architecture-options](../14-architecture-options/).

A secondary, cheaper take: **a collapsible outline visualisation is a real
reading aid.** A "collapse all / expand to level N" control on our TOC — from
[02 §10](../12-ux/02-navigation-and-find.md#10-the-outline-panel) — is the same
idea without the canvas.

---

## 11. mdpdf (Markdown → PDF converters)

**Class: inspiration. The name is not a single project — it is a category.**

There are several unrelated projects using this name; **exact licences are
UNVERIFIED per fork**, so consult each repository before use. Observed
approaches:

| Approach | Example | Notes |
|---|---|---|
| **Browser print-to-PDF** | `commonwealth-labs/mdpdf` — verified description: *"A client-side markdown to PDF converter. No server required… Type or paste markdown on the left, see a live preview on the right, and print to PDF using your browser's native print dialog."* Features listed: "Clean PDF output with **proper page breaks**", "**Headings stay with their content across page breaks**", "No server, no build step". Dependencies vendored locally: `marked` | The simplest possible architecture: **use the browser's own print pipeline** |
| **Headless browser + header/footer template** | `elliotblackburn/mdpdf` — "A command line markdown to pdf converter with support for **page headers, footers, and custom stylesheets**… incredibly configurable and has a JavaScript API" | Template-driven |
| **wkhtmltopdf + sanitiser + highlighter** | `Chaostheorie/mdpdf` — "converts commonmark files to PDF files. It leverages **pulldown-cmark**, **syntect** as well as **ammonia** and **wkhtmltopdf**… includes syntax highlighting and extensions such as tables, tasklists, strikethrough or footnotes. It features support footers" | The pipeline shape we want — parse → highlight → **sanitise** → render |
| **.NET / other** | Several others | |

### What they solve well

| # | Lesson | Where it lands |
|---|---|---|
| 1 | **The browser's print pipeline is the right tool.** Use `@media print` and let the engine handle pagination, `@page`, and the print dialog. It is what the web already does well | [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) |
| 2 | **`break-after: avoid` on headings and `break-inside: avoid` on figures is the whole craft.** "Headings stay with their content across page breaks" is the single most important PDF quality rule | same |
| 3 | **`thead { display: table-header-group }` for repeated table headers across pages** | same |
| 4 | **Headers, footers, and page numbers are template concerns, not CSS concerns** — you need either a print extension or a post-processing step | same, and a known gap |
| 5 | **Sanitise in the export pipeline**, not only in the viewer. An export path that re-renders from source is a second injection surface | [11 security](../11-security/) |
| 6 | **A separate "export stylesheet"** is a first-class artefact (MarkText documents this too) | [03 §7](../12-ux/03-theming.md#7-syntax-highlight-themes), [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) |

### What they deliberately skip

Interactivity, theming, quality beyond pagination. Output is a file.

### What we take

**We do not need an mdpdf. We need a good `@media print` stylesheet and the
framework's print-to-PDF capability.** That is cheaper, better, and produces a
better PDF than any of these, because the browser's print engine handles
pagination properly. The one thing we must build ourselves is **heading
bookmarks in the PDF outline** — which Typora advertises ("Export to PDF with
bookmarks") and none of these CLI tools do. That is a small, real
differentiator. See [01-reading-ux §12 R](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output).

---

## 12. glow

**Class: inspiration. The minimal-UI masterclass.**

**Verified:** MIT (`LICENSE`, "Copyright (c) 2019-2024 Charmbracelet, Inc"),
Go, **27.6k** stars, last push 2026-10-05. From the README: "Render markdown on
the CLI, with _pizzazz_!" and "a terminal based markdown reader designed from
the ground up to bring out the beauty—and power—of the CLI."

**Platforms (verified from its README):** Homebrew, MacPorts, pacman, xbps,
Nix, FreeBSD, eopkg, **Chocolatey / Scoop / Winget on Windows**, Termux on
Android, Snapcraft, and its own APT repository.

### What it does brilliantly

| # | Feature | The lesson |
|---|---|---|
| 1 | **It is a *reader*, not an editor.** It is the closest thing in the ecosystem to our product and it is read-only | Independent confirmation of the category |
| 2 | **It finds files for you.** "Glow will find local markdown files in subdirectories or a local Git repository." No vault, no index, no setup | The same idea as our "Open a folder" |
| 3 | **A colour scheme menu.** Multiple curated styles rather than arbitrary CSS | Validates our curated starter set — [03 §9](../12-ux/03-theming.md#9-a-curated-starter-set) |
| 4 | **It respects the terminal.** 24-bit colour detection, and it *adapts to the terminal's capabilities* rather than assuming | The desktop analogue: detect the OS accent, the system font, the display's colour depth |
| 5 | **Almost nothing else.** No file tree panel. No settings maze. No plugin system. No graph. `glow README.md` and you are reading | **This is the masterclass.** Count its features and compare with Obsidian's |
| 6 | **Installable everywhere, including Windows via three package managers** | [09 platform](../09-platform/) |

### What it deliberately skips

Everything. It is a terminal program that prints text.

### What we take

**The feature count is the message.** glow solves exactly one job and is beloved
for it. Obsidian has Bases, Canvas, Sync, Publish, a plugin ecosystem of 8,449,
and a CLI — and is *less* loved for reading a single file than glow is for
printing one.

Our decision, restated: **every feature must justify its cost in a reader's
attention.** If a proposed feature does not make *reading one document* better,
it does not ship.

Secondary lessons: detect and adapt to platform capabilities rather than
assuming; ship curated colour schemes rather than a theme editor first; make the
zero-configuration path excellent.

---

## 13. mdcat

**Class: inspiration — and a lesson in project death.**

**Verified:** `swsnr/mdcat`, **MPL-2.0** (GitHub API), Rust, 2.4k stars,
**last push 2026-06-19**, and — the important part — **`archived: true`**. The
README (verified) opens with:

> "**This repository is no longer maintained.**
> You can find a maintained fork at https://github.com/BIRSAx2/mdcat."

### What it did well

From the README (verified), `mdcat` is "Fancy `cat` for Markdown" with a
published terminal-support matrix:

| Terminal | Basic syntax | Syntax highlighting | Images | Jump marks |
|---|:-:|:-:|:-:|:-:|
| Basic ANSI | ✓ | ✓ | | |
| Windows 10 console | ✓ | ✓ | | |
| Termology | ✓ | ✓ | ✓ | |
| **iTerm2** | ✓ | ✓ | ✓ | **✓** |
| **kitty** | ✓ | ✓ | ✓ | |
| **WezTerm** | ✓ | ✓ | ✓ | |
| **VSCode** | ✓ | ✓ | ✓ | |
| Ghostty | ✓ | ✓ | ✓ | |

It highlights with **syntect**, uses **OSC 8** hyperlinks, renders images inline
in capable terminals, and adds **jump marks** in iTerm2 via `⇧⌘↓` / `⇧⌘↑`. It
documents exactly which terminal features it needs — strikethrough formatting
and inline links — and says plainly: "mdcat is likely to work well on old
terminals that lack these features (e.g. the Linux text console)."

**That last sentence is the best feature documentation in this entire document.**
It tells the user exactly what will and will not work, in one sentence.

### What it deliberately skipped

Inline images in the basic Windows console. CommonMark extensions. Being
maintained.

### Two lessons, and they are different in kind

**Lesson A — the capability matrix is the design.** mdcat's most valuable artefact
is its feature-support table. It communicates the whole product in eight rows. We
should publish an equivalent:

| Our equivalent | Contents |
|---|---|
| **Feature/platform support matrix** | Every feature × platform, with ✅/◐/❌ |
| **Accessibility support matrix** | Screen reader × shell × platform — directly from [04-accessibility §10](../12-ux/04-accessibility.md#10-screen-reader-testing-protocol) |

Publishing an honest matrix, including the ❌s, is more trustworthy than any
marketing claim and costs one page.

**Lesson B — a single-maintainer OSS tool can die, and the format outlives it.**
`mdcat` is archived. Its maintained fork exists. **The Markdown files it read
did not stop existing.** This is the strongest possible argument for the
"anything a user creates is a file they own" principle — and the strongest
argument for our project being MIT and open: **if we stop, the reader still
works.** A closed-source viewer that shuts down takes every document-open
workflow with it.

---

## 14. What we take from all of them — the synthesis

| # | Source | Lesson | Lands in |
|---|---|---|---|
| 1 | GitHub | One AST → HTML → chain of single-purpose filters → **sanitize twice** | [05 rendering](../05-rendering/), [11 security](../11-security/) |
| 2 | GitHub | The library does not sanitise; the pipeline does. Make the contract explicit | [05 rendering](../05-rendering/) |
| 3 | GitHub | Anchors are a *filter*, added after sanitization. So the renderer must own ids, not author HTML | [02 §2](../12-ux/02-navigation-and-find.md#2-heading-anchals) |
| 4 | `cmark-gfm` | One AST → HTML / man / LaTeX / CommonMark / XML. Multi-output from one parse | [10 performance](../10-performance/) |
| 5 | VS Code | **Double-click a rendered element → open source at that line.** 90% of editing's value for 5% of the work | [01-reading-ux §11](../12-ux/01-reading-ux.md#11-the-second-verb-editing-deferred-not-refused) |
| 6 | VS Code | A visible, user-controllable three-level security model | [11 security](../11-security/) |
| 7 | VS Code | markdown-it, CommonMark-first. **We target GFM instead**, because the links in the wild assume GFM | [03 specifications](../03-specifications/) |
| 8 | VS Code | Rename-a-heading-updates-all-links. A reader needs the inverse: *find* every link to a heading | [02 §9](../12-ux/02-navigation-and-find.md#9-backlinks) |
| 9 | mdBook | A keyboard-first reading model (`←`/`→`, `S` to search, `?` for help, `Esc`) | [02 §8](../12-ux/02-navigation-and-find.md#8-the-full-shortcut-list) |
| 10 | mdBook | `SUMMARY.md` → we auto-generate; a book needs an author-specified order, a single file does not | [02 §3](../12-ux/02-navigation-and-find.md#3-the-table-of-contents) |
| 11 | MkDocs Material | An extension **component catalogue**, and semantic admonitions | Future dialect work |
| 12 | Docusaurus | Versioning → we persist reading position per file | [01-reading-ux](../12-ux/01-reading-ux.md) |
| 13 | Docusaurus | **MDX is a security decision, not a formatting one.** We do not support it | [11 security](../11-security/) |
| 14 | VitePress | On-demand loading only | [10 performance](../10-performance/) |
| 15 | Hugo/Goldmark | Support `{#id}` attributes. Validate against Goldmark as an oracle. Promote standalone images to `<figure>` | [02 §2](../12-ux/02-navigation-and-find.md#2-heading-anchals), [03 §5](../12-ux/03-theming.md#5-images-and-figures) |
| 16 | Jupyter Book | **Interactive web + typeset PDF are both first-class outputs** | [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) |
| 17 | Jupyter Book | Migrate additively; keep the old version alive | [14 architecture](../14-architecture-options/) |
| 18 | Importers | **We build none. We must render all eleven producers' output.** No input may cause failure | [01-reading-ux](../12-ux/01-reading-ux.md) |
| 19 | Markmap | `lib` produces data, `view` produces pixels. Keep the split | [14 architecture](../14-architecture-options/) |
| 20 | mdpdf | Use the browser's print pipeline; `break-after: avoid` is the craft | [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) |
| 21 | mdpdf | Sanitise in the export path too | [11 security](../11-security/) |
| 22 | glow | **The feature count is the message.** Every feature must justify its cost in the reader's attention | [01-obsidian §12](../13-competitors/01-obsidian.md#12-the-gap-stated-precisely) |
| 23 | glow | Detect and adapt to platform capabilities | [03 §2](../12-ux/03-theming.md#2-following-the-os-accent), [09 platform](../09-platform/) |
| 24 | mdcat | Publish an honest capability matrix, **including the ❌s** | Public docs requirement |
| 25 | mdcat | A single-maintainer tool can die; **MIT means the reader still works if we stop** | The core argument for our licence |
## Sources

### GitHub rendering

- `github/markup` README — the five-stage journey: (1) select an underlying library, (2) "The HTML is sanitized, aggressively removing things that could harm you and your kin — such as `script` tags, inline-styles, and `class` or `id` attributes", (3) syntax highlighting via `github/linguist`, (4) "other filters that add special sauce, such as emoji, task lists, named anchors, CDN caching for images, and autolinking", (5) render; plus "only the first step is covered by this gem" and "markup itself does no sanitization"; the markup list mapping `.markdown`/`.md` to the `commonmarker` gem — <https://github.com/github/markup>
- `github/html-pipeline` README — "a small framework for defining DOM based content filters and applying them to user provided content"; the `MarkdownFilter` → `SyntaxHighlightFilter` composition example and its rendered output; `pygments.rb` for CSS generation — <https://github.com/github/html-pipeline>
- `github/cmark-gfm` README — "an extended version of the C reference implementation of CommonMark"; parse to AST, manipulate the AST, render to "HTML, groff man, LaTeX, CommonMark, or an XML representation of the AST"; "**Portable.** The library and program are written in standard **C99** and have **no external dependencies**… tested with MSVC, gcc, tcc, and clang"; the `Markdown.pl` benchmark — <https://github.com/github/cmark-gfm>
- `github/linguist` — the syntax highlighting grammars and language detection — <https://github.com/github/linguist>
- GitLab's renderer is structurally the same lineage (GFM via `cmark-gfm` plus a sanitisation filter chain) but its internals are not publicly documented in the same way. **UNVERIFIED** for current GitLab internals; GitHub is used as the reference.

### VS Code

- Markdown documentation, page last updated 30 September 2026 — `Shift+Cmd+V` / `Ctrl+Shift+V` preview and `Cmd+K V` / `Ctrl+K V` side-by-side; `markdown.preview.scrollPreviewWithEditor` and `scrollEditorWithPreview`; "The currently selected line in the editor is indicated in the Markdown preview by a light gray bar in the left margin"; "double clicking an element in the Markdown preview will automatically open the editor for the file and scroll to the line nearest the clicked element"; "Markdown: Toggle Preview Locking" with `[Preview]` in the title; **security** — "For security reasons, VS Code restricts the content displayed in the Markdown preview… disabling script execution and only allowing resources to be loaded over https", with Strict (default) / Allow insecure content / Disable levels, an alert popup, and "Markdown: Change preview security settings"; **Mermaid** with Alt-drag pan, scroll zoom, click zoom, hover-or-focus controls, and "Copy Diagram Source"; **math** via KaTeX with `markdown.math.enabled`; `markdown.styles`; smart selection with Shift+Alt+Left/Right; link validation settings; "Find All References" (`Shift+Alt+F12`); Rename Symbol (`F2`) updating headers and all links to them; `markdown.updateLinksOnFileMove.enabled`; workspace header completions; diff previews with `workbench.editorAssociations`; and the FAQ "**Does VS Code support GitHub Flavored Markdown? No, VS Code targets the CommonMark Markdown specification using the markdown-it library.**" — <https://code.visualstudio.com/docs/languages/markdown>
- Markdown extension guide — "Extensions that contribute markdown-it plugins are activated lazily, when a Markdown preview is shown for the first time"; the `markdown-emoji` example — <https://code.visualstudio.com/api/extension-guides/markdown-extension>
- `markdown-it` — MIT, "Markdown parser, done right. 100% CommonMark support, extensions, syntax plugins & high speed" — <https://github.com/markdown-it/markdown-it>

### mdBook

- README — "mdBook is a utility to create modern online books from Markdown files."; "All the code in this repository is released under the **Mozilla Public License v2.0**" — <https://github.com/rust-lang/mdBook>
- User guide (site version 0.5.4) — "a command line tool to create books with Markdown… ideal for creating product or API documentation, tutorials, course materials"; integrated search; syntax highlighting; theme files; preprocessors; backends; MathJax; keyboard map (`←`/`→` chapters, `S` or `/` search, `?` help, `Esc` close); automated testing of Rust code samples — <https://rust-lang.github.io/mdBook/>
- `SUMMARY.md` structure — part titles, nesting, draft chapters — <https://github.com/rust-lang/mdBook/blob/master/guide/src/SUMMARY.md>

### MkDocs Material

- README — MIT, Python, "Write your documentation in Markdown and create a professional static site for your Open Source or commercial project in minutes – searchable, customizable, more than 60 languages, for all devices." — <https://github.com/squidfunk/mkdocs-material>
- Extensions catalogue — admonitions, annotations, buttons, code blocks, content tabs, data tables, diagrams, footnotes, formatting, grids, icons, emojis, images, lists, math, tooltips; plus the `optimize` plugin for offline builds and `privacy` — <https://squidfunk.github.io/mkdocs-material/extensions/>
- Insiders programme — "Material for MkDocs uses the sponsorware release strategy, which means that new features are first exclusively released to sponsors as part of Insiders," via a private repository, with tiered monthly sponsorship. **Exact tier prices UNVERIFIED** — the sponsors page was not reachable at time of writing.
- MkDocs core — "a fast, simple and downright gorgeous static site generator"; plugins, Markdown extensions, themes, single YAML config — <https://github.com/mkdocs/mkdocs>

### Docusaurus, VitePress, Hugo, Jupyter Book

- Docusaurus README — "a project for building, deploying, and maintaining open source project websites easily"; MIT; Meta-authored; localization via CrowIn; home page, docs, blog and support pages; `docusaurus.new` playground; MDX and docs versioning are documented on the site — <https://github.com/facebook/docusaurus> · <https://docusaurus.io/docs/markdown-features>
- VitePress README — "a Vue-powered static site generator and a spiritual successor to VuePress, built on top of Vite"; MIT; per-page theming and on-demand routing are documented on the site — <https://github.com/vuejs/vitepress> · <https://vitepress.dev/guide/theming>
- Hugo content formats — Apache-2.0; "Hugo natively renders Markdown to HTML using Goldmark. Goldmark is fast and conforms to the CommonMark and GitHub Flavored Markdown specifications."; **Attributes** ("Apply HTML attributes such as `class` and `id` to Markdown images and block elements including blockquotes, fenced code blocks, headings, horizontal rules, lists, paragraphs, and tables"); **Extensions** (tables, definition lists, footnotes, task lists, inserted text, mark text, subscripts, superscripts); **Mathematics**; **Render hooks** ("Override the conversion of Markdown to HTML when rendering fenced code blocks, headings, images, and links. For example, render every standalone image as an HTML `figure` element") — <https://gohugo.io/content-management/formats/>
- Jupyter Book README — "an open-source tool for building publication-quality books and documents from computational material"; BSD-3-Clause; Markdown or notebooks; code cells; "citations, cross-references, and numbered equations"; execute-and-cache producing "a web-based interactive book and a publication-quality PDF"; "Jupyter Book is an official sub-project of Jupyter"; v1 (Sphinx-based) moved to the `v1` branch — <https://github.com/jupyter-book/jupyter-book>

### Importers

- Obsidian community plugin listing for `Importer` — "Convert your data to Markdown files you can use in Obsidian. Works with Apple Notes, OneNote, Evernote, Notion, Google Keep, and many other formats." — <https://obsidian.md/plugins>
- Obsidian roadmap — "Airtable import — Convert Airtable data to Markdown files and Obsidian Bases" (July 2026) — <https://obsidian.md/roadmap>
- CommonMark, HTML blocks and HTML comments — the constructs a tolerant reader must preserve or neutralise — <https://spec.commonmark.org/0.31.2/#html-blocks>

### Markmap, mdpdf, glow, mdcat

- Markmap — repository `markmap/markmap`; `LICENSE` = MIT, "Copyright (c) 2020 Gerald"; README: "Visualize your Markdown as mindmaps." and "Basically we use markmap-lib to preprocess Markdown into structured data, then render the data into interactive SVG with markmap-view"; integrations for VS Code, Neovim (`coc-markmap`), Vim (`markmap.vim`), Emacs (`eaf-markmap`) and an MCP server — <https://github.com/markmap/markmap> · <https://markmap.js.org/docs>
- mdpdf — **a category, not one project**, and several unrelated projects use the name. Verified descriptions: `commonwealth-labs/mdpdf` — "A client-side markdown to PDF converter. No server required… Type or paste markdown on the left, see a live preview on the right, and print to PDF using your browser's native print dialog… Clean PDF output with proper page breaks… Headings stay with their content across page breaks… No server, no build step", with `marked` vendored locally — <https://github.com/commonwealth-labs/mdpdf>. `elliotblackburn/mdpdf` — "A command line markdown to pdf converter with support for page headers, footers, and custom stylesheets… incredibly configurable and has a JavaScript API" — <https://github.com/elliotblackburn/mdpdf>. `Chaostheorie/mdpdf` — "a simple CLI to convert commonmark files to PDF files. It leverages pulldown-cmark, syntect as well as ammonia and wkhtmltopdf… includes syntax highlighting and extensions such as tables, tasklists, strikethrough or footnotes… features support footers" — <https://github.com/Chaostheorie/mdpdf>. **Individual fork licences UNVERIFIED — check each repository before use.**
- glow — `LICENSE` = MIT, "Copyright (c) 2019-2024 Charmbracelet, Inc"; README: "Render markdown on the CLI, with pizzazz!" and "a terminal based markdown reader designed from the ground up to bring out the beauty—and power—of the CLI"; "Glow will find local markdown files in subdirectories or a local Git repository"; install via Homebrew, MacPorts, pacman, xbps, Nix, FreeBSD, eopkg, **Chocolatey / Scoop / Winget on Windows**, Termux, Snapcraft, and its own APT repository — <https://github.com/charmbracelet/glow>
- mdcat — MPL-2.0, Rust, 2.4k stars, last push 2026-06-19, repository `archived: true`; README opens: "**This repository is no longer maintained.** You can find a maintained fork at BIRSAx2/mdcat"; the per-terminal support matrix (Basic syntax / Syntax highlighting / Images / Jump marks) for Basic ANSI, Windows 10 console, Termiology, iTerm2, kitty, WezTerm, VSCode and Ghostty; "mdcat requires that the terminal supports strikethrough formatting and inline links… mdcat likely won't work well on old terminals that lack these features (e.g. the Linux text console)"; `syntect` highlighting; OSC 8 hyperlinks; SVG via `resvg`; iTerm2 jump marks — <https://github.com/swsnr/mdcat> · maintained fork <https://github.com/BIRSAx2/mdcat>

### Libraries referenced

- KaTeX — MIT — <https://github.com/KaTeX/KaTeX>
- Mermaid — MIT, 90.6k stars — <https://github.com/mermaid-js/mermaid>
- highlight.js — BSD-3-Clause — <https://github.com/highlightjs/highlight.js>
- Shiki — MIT — <https://github.com/shikijs/shiki>
- DOMPurify — MPL-2.0 OR Apache-2.0 — <https://github.com/cure53/DOMPurify>
- `minisearch` — MIT — <https://github.com/lucaong/minisearch>
