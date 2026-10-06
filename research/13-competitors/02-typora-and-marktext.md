# 02 · Typora & MarkText

> **Typora: class — competitor.**
> **MarkText: class — inspiration.**
>
> Between them they define the *seamless live preview* model, which is the most
> loved and most under-built editing UX in Markdown. Understanding *why* is
> required reading for our own roadmap, even though we are a viewer.

Research date: **6 October 2026**. Verified against `typora.io`,
`support.typora.io`, `github.com/marktext/marktext` (README, `package.json`,
developer docs, releases), and `marktext.me/docs`.

---

# Part 1 · Typora

## 1. What it is

Typora's own homepage (verified, 6 Oct 2026) states the thesis exactly:

> "Typora gives you a seamless experience as both a reader and a writer. It
> removes the preview window, mode switcher, syntax symbols of markdown source
> code, and all other unnecessary distractions. Instead, it provides a real live
> preview feature to help you concentrate on the content itself."

The tag line on the `<title>`: **"a minimal markdown editor."**

In one sentence: **Typora is an editor that renders as you type, with no
preview pane and no visible Markdown syntax.**

## 2. Platform support and price (verified, `typora.io`, 6 Oct 2026)

| Item | Verified value |
|---|---|
| **Price** | **$14.99** (excl. tax), one-time |
| **Trial** | **15 days** free trial |
| **Device limit** | Up to **3 devices** |
| **macOS** | ✅ Universal (Apple Silicon + Intel) |
| **Windows** | ✅ **64-bit**, **32-bit**, and **ARM** builds listed. "Requires Windows 10, 11" — a separate build exists for Windows 7/8 |
| **Linux** | ✅ **Yes.** `.deb` (own APT repo with a `typora.gpg` key), **snap**, and standalone **binary for x64 and ARM** |

**Correction to a common misconception:** Typora is *not* macOS-only any more,
and in fact has not been for years — it has shipped Linux builds and Snap
packages for a long time. The "macOS only" claim is a fossil from the early
2010s. Verified: the download section lists macOS, three Windows architectures,
and Linux; the Linux panel even carries the "Sorry, Not Ready yet..." joke from
an older era alongside current install instructions. **Treat any "Typora is
Mac-only" claim as wrong.**

**Version (verified, `support.typora.io`):** release history shows
**Typora 1.14, 2026-07-19**, after 1.13 (2026-04-03) and 1.12 (2025-09-19).

## 3. Licence (verified, `support.typora.io/License-Agreement/`)

**Proprietary. Not open source.** The EULA page states:

> "Published · January 16, 2019 · **Updated · September 6, 2026**"
> "'We' a.k.a. 'us', or 'typora.io'. Developer(s) of Typora, a.k.a.
> **Qiyun (Shanghai) Technology Ltd**."

It defines "Full version", "Trial version", "Beta version", "Stable version",
"Dev version", "Updates", "Major Update", and "Use" (which includes
"access, download, install, copy or get benefit from using the Software"), and
binds the purchaser to the terms. It also defines "Open Source Software" as a
distinction — i.e. it explicitly asserts Typora is *not* it.

**Consequence for us:** there is no Typora source to read. Its editing
behaviour is observable, its feature list is published, and its themes are a
public gallery — but nothing else. All technique analysis below is therefore
inference from observable behaviour, marked as such.

## 4. The seamless-preview technique — the actual intellectual content

This is the part worth understanding.

### 4.1 The idea

The classic Markdown editor has two surfaces: a source pane and a preview pane.
Every rendering approach that keeps two surfaces has to solve
**synchronisation** — scroll position, caret position, selection, and latency.
Every one of those solutions is imperfect.

Typora's answer: **there is only one surface.** The document is HTML. The
Markdown syntax characters are *in the DOM*, wrapped in elements, and their
`display` is toggled by CSS so that they are invisible — except in the specific
place your caret is.

The result: no synchronisation problem at all, because there is nothing to
synchronise. The rendered output and the editing surface are the same pixels.

### 4.2 How the toggling works (inference from observable behaviour)

The observable behaviours that constrain the implementation:

| Observable behaviour | Implied mechanism |
|---|---|
| `#` marks are visible in the paragraph you are editing, hidden elsewhere | Each syntax mark is wrapped in a span; `display: none` by default, `display: inline` when an ancestor has an "is-active" class |
| The caret never appears in a gap where a hidden mark sits | The editor maintains its own text-offset ↔ visual-position mapping; the browser's native caret cannot be relied on across a `display` change |
| `**bold**` shows as **bold** with no asterisks, but the asterisks flash when you enter the span | Same mechanism, `*` spans toggle with the block |
| Toggling a checkbox with the mouse rewrites `[ ]` ↔ `[x]` in the source | The DOM is authoritative *and* the source is serialised back to disk; it is a round-trip, not a view |
| Code fences stay as `<pre><code>` and are never "hidden into" inline code | Block-level code is a distinct rendering path |
| Focus Mode dims all blocks except the active one | `data-active` / class per block |

### 4.3 The limitations, and they are structural

These are not bugs. They are consequences of the approach, and every
implementation hits them.

| Limitation | Why it is structural |
|---|---|
| **Caret handling is the hard part** | Any `display` change on an element adjacent to the caret can reflow it. A correct implementation must either (a) keep the caret inside a single always-visible container and move the container, or (b) implement a custom caret with an offset map. Both are substantial work with IME, selection, and autocorrect implications |
| **IME is a minefield** | Composition (Japanese, Chinese, Korean, Vietnamese) requires the editor to not interfere with the composing region. Any caret remapping during `compositionstart`/`compositionend` will corrupt input. See MarkText's CJK fixes below |
| **Tables are hard** | Inserting a column means generating a full raw row plus the `|---|` alignment row, at the right offset, while the caret is elsewhere in the table |
| **Math is a source/render hybrid** | `$$` delimiters hidden, formula inserted; editing means temporarily reverting to source. There is no elegant version of this |
| **Fenced code with a language needs a highlight round-trip** | You are rendering and un-rendering |
| **Round-trip fidelity** | Serialising the DOM back to Markdown must be exact or the file is corrupted. Every edge case (nested emphasis, autolinks, HTML blocks, entity references) is a potential data-loss bug |
| **Not source-viewable while editing** | "Where is the raw Markdown?" is a real question, and there is no good answer |

### 4.4 Typora's actual mitigation

Typora ships **three modes** (verified from the homepage feature list):

1. **Seamless / live preview** — the default, the whole point.
2. **Source Code mode** — plain Markdown text. (MarkText has the same.)
3. **A pure reading/writing mode** — the homepage describes the app as
   "**Readable & Writable**", with a "Focus Mode" that "helps you focus only on
   the current line, by blurring the others" and a "TypeWriter Mode [that]
   always keeps the currently active line in the middle of the window."

**The existence of a Source mode is the tell.** It exists because the seamless
model is not always sufficient. Any project attempting this must plan for it.

### 4.5 What this means for us

| Decision | Reason |
|---|---|
| **We do not attempt seamless editing in v1** | It is genuinely one of the hardest UIs in software. It requires a custom caret model, an exact Markdown serialiser, and three years. See [01-reading-ux §11](../12-ux/01-reading-ux.md#11-the-second-verb-editing-deferred-not-refused) |
| **We keep the renderer one-way and pure** | `Markdown text → sanitized HTML`, no DOM→Markdown. A one-way function is testable against spec fixtures and has no data-loss failure mode |
| **Our reading mode is trivially available** | Because we never render source in the same surface, reading is the *only* mode, and it is therefore perfect by default |
| **If we ever do implement editing, "Source Code mode" ships first** | Typora and MarkText both did. There is no counter-example |
| **We study this for the round-trip problem, not the rendering** | If editing lands, the serialiser is the project, and it deserves its own research folder. Add to [15-open-questions](../15-open-questions/) |

---

## 5. Typora's feature surface (verified, `typora.io`, 6 Oct 2026)

This is worth listing because it defines the *bar* for "feels like a real tool",
even for a viewer.

### Reading and navigation

| Feature | Note |
|---|---|
| Table of contents | Author writes `[TOC]`; all headings listed. **Author-driven, not automatic** |
| Internal links / bookmarks | Setting an `href` to a heading "will create a bookmark that allow you to jump to that section after clicking" |
| Outline panel | "Automatically see the Outline structure of your documents in outline panel" |
| Focus Mode | Blurs everything except the current line |
| TypeWriter Mode | Keeps the active line vertically centred |
| File tree + articles panel | Two-panel file management |
| Word count | Words, characters, lines, **and reading minutes** |

### Authoring

| Feature | Note |
|---|---|
| Indent / Outdent | Tab / Shift+Tab, "Arrange nested lists like a rich editor" |
| GFM task lists | Supported, manageable from the file |
| Change list type | Shortcuts, context menu, or touch bar |
| Table resize | **Quickest steps to resize tables in Markdown file: just mouse dragging** |
| Insert tables | Shortcuts with given layouts; typing Markdown also works |
| Auto pair | Brackets and quotes "like a code editor"; an option to also auto-pair Markdown symbols like `*` or `_` |
| Emoji input | Autocomplete |
| Line numbers | Toggle in preferences |
| Drag & drop images | |
| Image upload | macOS, via **iPic Service** integration |
| Image resize / retina | `<img>` tag with customised size or zoom factor |
| Relative path base | "you could set its base path towards the root folder of your static blog" |

### Rendering

| Feature | Note |
|---|---|
| Syntax highlighting | "**around 100 languages**" |
| Math | **MathJax** with "most extensions built-in, including **mhchem, AMSmath, BBox**"; optional auto-numbering of equations |
| Flowcharts | "simple SVG flow chart diagrams powered by **flowchart.js**" |
| Mermaid | "flowchart, sequence, gantt and more" |
| Sequence diagrams | "simple SVG sequence diagrams" |
| Footnotes | "Display footnotes you write **on hover**" |
| CJK support | "All styles include Strong and emphasis can be correctly rendered in CJK charsets" |
| Front matter | "Compatible with files contain YAML Front Matter" |

### Import / export

| Feature | Note |
|---|---|
| Export to PDF | "with **bookmarks**" |
| Import & export | "More formats, including **docx, OpenOffice, LaTeX, MediaWiki, Epub**" |
| Themes | "**fully configurable by CSS**" |

### Reading this list for our own purposes

Four things stand out.

1. **"PDF export with bookmarks"** is a small detail that signals real care.
   A viewer that exports a PDF should generate an outline/bookmarks tree from
   the headings. Add to
   [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output).
2. **"reading minutes"** in the word count is a *reader* metric, not a writer
   metric. Cheap, delightful, and it signals the product's centre of gravity.
   Adopt.
3. **Footnotes on hover** is the pattern we argued *against* in
   [01-reading-ux §10](../12-ux/01-reading-ux.md#10-footnotes) — it is
   inaccessible and unusable on touch. It is instructive that a widely-loved app
   shipped it anyway.
4. **The export list is enormous.** docx, OpenOffice, LaTeX, MediaWiki, Epub.
   That is Pandoc-shaped ambition. **We will not do this.** Our export target is
   HTML + PDF, because those are the two outputs a *reader* wants. EPUB is the
   one on that list we might eventually need, and only if the mobile app
   materialises.

## 6. Where Typora is weak

| Weakness | Detail |
|---|---|
| **Closed source** | Nothing to inspect, no security audit visible, no plugin API. Every bug is a support ticket |
| **Paid, no perpetual-free tier** | $14.99 forever. That is *cheap* for what it is, and free is a real differentiator for us, but it is not a real complaint |
| **Editor-only, no corpus features** | No folder search, no backlinks, no tag view, no full-text index across files. It opens one file. **This is our entire opening** |
| **`[TOC]` is author-driven** | If the author did not write `[TOC]`, there is no table of contents. A viewer should always have one, generated from the AST. **We win here trivially** |
| **No web or mobile** | Verified: no browser or mobile product listed. Desktop only |
| **CSS themes are arbitrary code** | "fully configurable by CSS" means loading stranger CSS into the app. Correct, and it is a small security surface. Our JSON-token model in [03](../12-ux/03-theming.md#4-themes-as-data-not-code) avoids it |
| **Hover footnotes / no accessibility claim** | No published WCAG conformance statement |
| **Flowchart.js and MathJax are legacy choices** | MathJax is slower and larger than KaTeX; flowchart.js is essentially unmaintained (UNVERIFIED — no longer appears in Typora's release notes). Mermaid has absorbed most of that ground |
| **Slow release cadence** | 1.12 → 1.13 was ~6.5 months; 1.13 → 1.14 was ~3.5 months. Not bad, not fast |

---

# Part 2 · MarkText

## 7. What it is

From its own README (verified):

> "MarkText is an open-source Markdown editor powered by the support of its
> community."
> "A simple and elegant open-source markdown editor that focused on speed and
> usability. Available for Linux, macOS and Windows."
> Built by "Jocs and contributors"; the project presents itself as the
> open-source Typora alternative (originally named Mark Text, renamed in 0.17.0:
> *"Mark Text is now MarkText!"*).

## 8. Licence, price, platform (verified, 6 Oct 2026)

| Item | Verified value |
|---|---|
| **Licence** | **MIT** — verified from both the repository `LICENSE` file and the README ("License **MIT**") |
| **Price** | **Free**, donation-supported |
| **macOS** | ✅ Requires **macOS 11 (Big Sur)** or later. **Universal builds are not published** — separate arm64 and x64 `.dmg`. Homebrew Cask available |
| **Windows** | ✅ Requires **Windows 10 or 11**. Both **x64 and arm64** `.exe` setup installers, per-user or machine-wide. Chocolatey and Winget |
| **Linux** | ✅ `AppImage`, `.deb`, `.rpm`, `.snap`, `.tar.gz` (all present in the v0.20.0 release assets) |
| **Latest release** | **v0.20.0, released 2 October 2026** (four days before this research) |
| **Scale** | **62.1k** GitHub stars, 4.6k forks, 335 open issues, 17 open PRs |

## 9. Architecture (verified)

This is unusually well documented for a project this size, and it changed
recently in a way worth knowing.

**Current state (v0.20.x):**

| Layer | Detail |
|---|---|
| Shell | **Electron** (built with `electron-builder`; `build:win` / `build:mac` / `build:linux` scripts) |
| Repo shape | **pnpm monorepo** — "chore: convert repo to pnpm monorepo (`packages/desktop`, `muyajs`, `website`)" |
| Language | **TypeScript** throughout; main + preload compile to CommonJS, renderer is ESModules only |
| Bundler | **Vite** (dev and build) |
| Editor engine | **In transition.** The v0.20.0 notes show a **TypeScript rewrite named `@muyajs/core`** living in `packages/muya`, migrating the renderer and desktop app onto it while the legacy `muyajs` remains: "feat(muya): migrate TS rewrite to packages/muya alongside legacy muyajs", "feat(desktop): migrate editor.vue to @muyajs/core engine". The package on `develop` is `marktext-monorepo` at **0.21.0-dev** |
| Docs stack | Next.js 15 + Cloudflare Workers CI for the website |
| Toolchain | Node **≥ 20.19.0**; Python **≥ 3.12**; **MSVC with spectre-mitigated libs required** on Windows |
| Sanitizer | **DOMPurify** — "feat(desktop): consume @muyajs/core in util files (markdownToHtml/**pdf**/**dompurify**/printService/sourceCode/icon)" |

Two of those are directly relevant to our own research:

1. **MarkText uses DOMPurify**, the same library we recommend in
   [04-accessibility §2](../12-ux/04-accessibility.md#23-the-sanitizer-allow-list-we-must-ship).
   That is a useful third-party validation: the MIT-licensed editor that most
   closely matches our threat model chose the same tool.
2. **The engine rewrite is a large, ongoing, risky refactor** carried by
   essentially one maintainer. That is the story of the project's maintenance
   state, and §11 is about it.

### 9.1 A concrete correctness detail worth stealing

The v0.20.0 release includes several CJK/emphasis fixes that are exactly the
kind of thing our own parser research must handle:

- "fix(muya): **allow CJK ideographs as flanking boundary for emphasis**"
  (#4355)
- "fix(muya): **treat CJK as punctuation for strong/em flanking**" (#4301 / #4307)
- "fix(muya): preserve nested lists of differing types" (#4341)

These are Unicode **delimiter runs** and **left/right-flanking** problems from
CommonMark §6.2. CommonMark explicitly handles CJK punctuation classes for
emphasis, and getting it wrong means `**加粗**` inside CJK text renders wrong or
not at all. **Our test fixture suite in `packages/test-fixtures` must include
CJK emphasis cases**, and the fact that a 62k-star project shipped this fix in
2026 tells us it is a live class of bug. Add to
[02 syntax](../02-syntax/) test plans.

## 10. MarkText's feature set (verified from README)

- Real-time preview (WYSIWYG) and a clean, distraction-free interface
- **CommonMark**, **GitHub Flavored Markdown**, and *selective* **Pandoc
  Markdown**
- Math via **KaTeX** (note: Typora uses MathJax — KaTeX is the faster, smaller
  modern choice and is what VS Code also uses)
- Front matter, emoji
- Paragraph and inline-style shortcuts
- **Output HTML and PDF**
- Themes (Cadmium Light, Material Dark, …) and **themes for exporting**
- **Source Code mode, Typewriter mode, Focus mode**
- Clipboard image paste
- Portable mode; a full command-line interface documented

Older feature history worth noting (from the changelog): image upload via
**PicGo** and SM.MS/GitHub uploaders (deprecated), **PlantUML** diagram support,
**chemical equations (mhchem)** in math mode, regex group replacement in the
searcher, and automatic find-in-file on pane open.

## 11. Why MarkText lags — and the honest version

**Maintenance reality (verified):**

| Signal | Value | Reading |
|---|---|---|
| Last release | **v0.20.0, 2 Oct 2026** | Very much alive |
| Last push | **2026-10-03** | Very much alive |
| Stars | 62.1k | Enormous |
| Forks | 4.6k | Healthy |
| Open issues | **335** | High for a 62k-star project |
| Open PRs | **17** | Some community contribution |
| v0.20.0 release commits | A single release branch dominated by **one author** (`@Jocs`) across ~60 PRs | Effectively a **single-maintainer project** |
| Release history | 0.17.1 → … → 0.20.0 after a long gap; the public changelog page's newest visible entry is 0.17.1 | **Historically slow, recently accelerating** |
| Structural risk | An in-flight **engine rewrite** (`muyajs` → `@muyajs/core`) with a **legacy and new engine both in the tree**, plus a "failing-test scoreboard for #4406 muyajs→@muyajs/core gaps" commit | The riskiest possible place to be |

**So the honest diagnosis is not "MarkText is dead".** It is:

1. **Bus factor of one.** Sixty-plus PRs in one release by one author. If that
   person stops, the project stops. Obsidian has a company; Zettlr has a
   long-lived maintainer and a community; Typora has a company. MarkText has a
   volunteer with extraordinary stamina.
2. **A rewrite in the danger zone.** The v0.20.0 release notes are dominated by
   `muyajs` → `@muyajs/core` migration, with a "parity scoreboard" tracking
   regressions between the old and new engines. That is an honest, well-run
   process — and also an admission that parity is not yet achieved. Users on
   0.20.x are running an engine that was mid-migration.
3. **Feature debt in the exact hard areas.** The fixes in §9.1 are all in the
   seamless-preview layer: cursor behaviour, emphasis flanking, nested list
   types, cross-cell table selection ("restore cross-cell table selection",
   "resolve dead TableChessboard picker"). These are the limitations predicted
   in §4.3, being paid for over years.
4. **The scope is wrong for one person.** Seamless preview *plus* syntax
   highlighting for 100 languages *plus* Mermaid *plus* PlantUML *plus* math
   *plus* image upload *plus* PDF export *plus* Pandoc flavour *plus* three
   editing modes *plus* two desktop platforms and Linux packaging *plus* a
   website and docs site. Each is a project.

**The lesson, which is the most useful thing in this document:**

> A seamless-preview editor is a **multi-year, multi-maintainer** project. It is
> not a feature. It is a product.

That is why we defer it. And it is why, if we ever build it, we build it
*after* the viewer exists and has paying-for-it users in the sense that
matters: people who complain when it is missing.

## 12. What we learn from Typora + MarkText

### Adopt

| # | Lesson | Where it lands |
|---|---|---|
| T1 | **A reading experience that hides syntax is the good experience.** Even if we never edit, our output must be indistinguishable from a well-set page | [01-reading-ux §2](../12-ux/01-reading-ux.md#2-typography-the-product) |
| T2 | **Focus mode and typewriter mode are table stakes.** Focus mode ships in v1; typewriter mode is a small feature over it | [01-reading-ux §3](../12-ux/01-reading-ux.md#1-reading-modes) |
| T3 | **Reading-minutes in the status bar** — a reader metric that signals the product's centre of gravity | [01-reading-ux](../12-ux/01-reading-ux.md) |
| T4 | **PDF export with heading bookmarks.** Small, shows care | [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) |
| T5 | **An automatic TOC**, not an author-inserted `[TOC]`. Typora requires the author to opt in; we must not | [02 §3](../12-ux/02-navigation-and-find.md#3-the-table-of-contents) |
| T6 | **DOMPurify is the right sanitizer.** Two independent projects now use it | [04-accessibility §2](../12-ux/04-accessibility.md#23-the-sanitizer-allow-list-we-must-ship), [11 security](../11-security/) |
| T7 | **KaTeX, not MathJax**, for inline math. Faster, smaller, synchronous layout. VS Code made the same call | [01-reading-ux §7](../12-ux/01-reading-ux.md#7-read-docs-with-math-and-diagrams) |
| T8 | **CJK emphasis flanking is a real, live bug class.** Test it explicitly | [02 syntax](../02-syntax/), `packages/test-fixtures` |
| T9 | **Export themes are separate from UI themes.** MarkText documents "themes for exporting". Correct: the print stylesheet is its own medium | [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) |
| T10 | **Portable mode / no install required.** Users value running from a USB stick | Product requirement |

### Reject, with reasons

| # | Typora/MarkText behaviour | Why we reject it |
|---|---|---|
| T11 | Hover-only footnote previews | Inaccessible and unusable on touch. Our bottom-of-document model is the accessible one — [01-reading-ux §10](../12-ux/01-reading-ux.md#10-footnotes) |
| T12 | Arbitrary-CSS themes | An injection surface, and it prevents a contrast gate. Our JSON-token model — [03 §4](../12-ux/03-theming.md#4-themes-as-data-not-code) |
| T13 | PDF **and** DOCX **and** LaTeX **and** MediaWiki **and** ODT **and** EPUB export | Six export pipelines is six products. We ship HTML and PDF |
| T14 | `flowchart.js` alongside Mermaid | One diagram engine. Mermaid (MIT, 90k stars, actively developed) has absorbed the flowchart/sequence/gantt space |
| T15 | Cloud image upload integrations (iPic, PicGo, SM.MS) | A reader has no business uploading to a third-party image host. See [11 security](../11-security/) |
| T16 | Seamless preview in v1 | Multi-year, multi-maintainer. See §12 |

### The competitive statement

> **Typora is the best Markdown *editor*. MarkText is the best free *editor*.
> Neither is a *reader*.**
>
> Typora opens one file. It has no folder search, no backlinks, no generated
> outline, no corpus view, no accessibility claim, no web, no mobile, and a
> `$14.99` price and closed source.
>
> We are not trying to beat Typora at Typora's game. We are trying to be the
> thing a person opens when they already *have* the Markdown and just want to
> **read** it — beautifully, instantly, accessibly, and for free.
## Sources

### Typora

- Homepage and full feature list — "seamless experience as both a reader and a writer"; "It removes the preview window, mode switcher, syntax symbols of markdown source code"; Type of Contents via `[TOC]`; internal links creating bookmarks; file tree panel plus articles side panel; outline panel; focus mode and typewriter mode; "around 100 languages" of syntax highlighting; MathJax with mhchem / AMSmath / BBox; flowchart.js; Mermaid; sequence diagrams; "Display footnotes you write on hover"; "All styles include Strong and emphasis can be correctly rendered in CJK charsets"; YAML front matter compatibility; "Export to PDF with bookmarks"; import/export of docx, OpenOffice, LaTeX, MediaWiki and Epub; word count in words/characters/lines/**reading minutes**; "Custom Themes /*fully configurable by CSS*/"; image upload via iPic Service on macOS; `<img>` tag with customised size or zoom; relative-path base setting; drag-and-drop image insertion; line numbers — <https://typora.io/>
- Price, trial, device limit and platform downloads — \$14.99 excl. tax; 15-day free trial; up to 3 devices; macOS; Windows 64-bit / 32-bit / ARM; "Requires Windows 10, 11" with a separate Windows 7/8 download; Linux `.deb` with the `typora.gpg` APT key, `snap`, and standalone binary for x64 and ARM — <https://typora.io/>
- Release history — Typora 1.14 (2026-07-19), 1.13 (2026-04-03), 1.12 (2025-09-19), 1.11 (2025-08-16), 1.10 (2025-02-15), 1.9 (2024-06-20) — <https://support.typora.io/what's-new/>
- End User License Agreement — "Published · January 16, 2019" / "Updated · September 6, 2026"; "Developer(s) of Typora, a.k.a. Qiyun (Shanghai) Technology Ltd"; definitions of Full version, Trial version, Beta version, Stable version, Dev version, Updates, Major Update, Use, and Open Source Software — <https://support.typora.io/License-Agreement/>

### MarkText

- README — MIT licence; "A simple and elegant open-source markdown editor that focused on speed and usability. Available for Linux, macOS and Windows."; CommonMark + GitHub Flavored Markdown + "selective support Pandoc markdown"; KaTeX math; front matter and emoji; output HTML and PDF; Source Code / Typewriter / Focus modes; clipboard image paste; platform badges and install instructions — <https://github.com/marktext/marktext/blob/develop/README.md>
- `LICENSE` — MIT, "Copyright (c) 2017-present Luo Ran" and "Copyright (c) 2018-present MarkText Contributors" — <https://github.com/marktext/marktext/blob/develop/LICENSE>
- macOS: "Requires macOS 11 (Big Sur) or later. Universal builds aren't published"; Homebrew Cask `brew install --cask mark-text`. Windows: "Requires Windows 10 or 11. Both x64 and arm64 installers are published", Chocolatey and Winget. Linux: see their install docs — same README
- Release **v0.20.0, 2 October 2026** — monorepo conversion to pnpm (`packages/desktop`, `muyajs`, `website`); `muyajs` → `@muyajs/core` TypeScript migration including "a failing-test scoreboard for #4406 muyajs→@muyajs/core gaps"; DOMPurify consumed by the desktop util files alongside `markdownToHtml`/`pdf`/`printService`; **CJK emphasis fixes** (#4355 "allow CJK ideographs as flanking boundary for emphasis", #4301 "treat CJK as punctuation for strong/em flanking"); nested list preservation (#4341); cross-cell table selection restore and the TableChessboard picker; flowchart and sequence diagram restore; Next.js 15 + Cloudflare Workers site; unsigned macOS builds with a quarantine-flag note; SHA256SUMS verification; assets for Linux AppImage/.deb/.rpm/.snap/.tar.gz and a macOS arm64 `.dmg` — <https://github.com/marktext/marktext/releases/tag/v0.20.0>
- Developer overview — Python ≥ 3.12, Node.js ≥ 20.19.0, Build Tools for Visual Studio 2022 with spectre-mitigated MSVC on Windows; `pnpm install`; `pnpm run dev`; `pnpm run build:win|mac|linux`; main and preload compile to CommonJS, renderer is ESModules only — <https://marktext.me/docs/dev/overview>
- Changelog — 0.17.0 "Mark Text is now MarkText!"; changed default key bindings mapped to US equivalents; image path variables; PicGo image upload; PlantUML diagram support; chemical equations in math mode; regex group replacement in the searcher; 0.17.1 experimental native Apple M1 support — <https://marktext.me/docs/changelog/>
- Introduction — "Themes for exporting", portable mode, command line interface — <https://marktext.me/docs/introduction>
- `package.json` on the `develop` branch — `"name": "marktext-monorepo"`, `"version": "0.21.0-dev"` — <https://github.com/marktext/marktext/blob/develop/package.json>
- CommonMark §6.2, the left/right-flanking delimiter-run rules that the CJK fixes relate to — <https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis>
- GitHub REST API, unauthenticated, 6 October 2026 — 62.1k stars, 4.6k forks, 335 open issues, 17 open pull requests, last push 2026-10-03, licence MIT, primary language TypeScript
