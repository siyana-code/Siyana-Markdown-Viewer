# 05 · Feature Matrix

> **Research date:** 6 October 2026. Cells marked *(v)* are verified against the
> project's official site or repository. Cells marked *(u)* are **UNVERIFIED**
> and were not confirmable from a primary source at time of writing — read them
> as "probably, but check".

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | **Yes, first-class.** A documented, supported feature of the product |
| ◐ | **Partial, degraded, or third-party.** Works, but with caveats, or only via a plugin/extension/community add-on, or a reduced form only |
| ❌ | **No.** Not present |
| n/a | **Not applicable.** The category does not apply to this kind of tool (e.g. "sync" for a build tool, "live preview" for a static site generator) |
| — | **Deliberately excluded by us.** Not a gap in the product; a design decision, argued in the linked document |

**One caution about reading this matrix:** rows are different *kinds* of thing.
Editors, applications, and build-time generators are being compared on the same
axes, and for many cells "n/a" is the honest answer. The matrix is most useful
read **vertically** (what does each tool do) and least useful read
horizontally (what is the score).

---

## Part 1 · Authoring and structuring

| Product | Live preview | WYSIWYG-ish editing | Folder tree | Full-text search | Backlinks / wikilinks | Graph view | Plugins / extensibility |
|---|---|---|---|---|---|---|---|
| **Siyana Markdown Viewer** *(planned)* | ❌ | — *(read-only v1; "open in your editor at this line")* | ✅ | ✅ *(3 scopes)* | ✅ *(links + backlinks panel)* | — | ❌ *(v1)* |
| **Obsidian** *(v)* | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ *(8,449 plugins, 826 themes)* |
| **Typora** *(v)* | ✅ | ✅ | ✅ | ✅ | ◐ *(internal links + bookmarks; no backlink panel)* | ❌ | ❌ |
| **MarkText** *(v)* | ✅ | ✅ | ✅ | ✅ | ◐ *(community plugin)* | ❌ | ◐ *(themes only; no plugin API)* |
| **Logseq** *(v)* | ◐ *(block editor, not Markdown preview)* | ✅ | ◐ *(graph/journal-first)* | ✅ | ✅ | ✅ | ✅ |
| **Zettlr** *(v)* | ◐ *(WYSIWYG slider, not live preview)* | ✅ | ✅ | ✅ | ✅ *(internal links, related files)* | ✅ | ❌ |
| **VS Code preview** *(v)* | ✅ *(scroll-synced side-by-side)* | ❌ | ✅ *(Explorer)* | ◐ *(text search; not rendered results)* | ◐ *(Find All References command)* | ❌ | ✅ *(markdown-it plugins)* |
| **GitHub** *(v)* | ❌ | ❌ | ✅ *(repo browser)* | ✅ *(code search)* | ◐ *(web search)* | ◐ *(Insights dependency graph)* | ◐ *(Markdown API / Enterprise)* |
| **mdBook** *(v)* | ❌ | ❌ | ✅ *(sidebar from `SUMMARY.md`)* | ✅ *(built into output)* | ❌ | ❌ | ✅ *(preprocessors + backends)* |
| **MkDocs Material** *(v)* | ❌ | ❌ | ✅ | ✅ *(client-side index)* | ❌ | ❌ | ✅ *(plugins + components)* |
| **glow** *(v)* | ❌ | ❌ | ◐ *(finds files in dirs / git repos)* | ❌ | ❌ | ❌ | ❌ |

---

## Part 2 · Rendering fidelity

| Product | Math | Diagrams (Mermaid) | Task lists | Tables | Footnotes | Front-matter handling |
|---|---|---|---|---|---|---|
| **Siyana Markdown Viewer** *(planned)* | ✅ *(KaTeX)* | ✅ | ◐ *(rendered + read-only checkbox)* | ✅ | ✅ *(inline, ARIA doc roles)* | ◐ *(parsed + displayed; never rewritten)* |
| **Obsidian** *(v)* | ✅ *(MathJax)* | ✅ | ✅ | ◐ *(source + limited live editing)* | ✅ | ✅ *(Properties editor)* |
| **Typora** *(v)* | ✅ *(MathJax + mhchem, AMSmath, BBox)* | ✅ *(Mermaid + flowchart.js + sequence)* | ✅ | ✅ *(drag-resize)* | ✅ *(hover preview)* | ◐ *(compatible)* |
| **MarkText** *(v)* | ✅ *(KaTeX + mhchem)* | ✅ *(Mermaid + PlantUML)* | ✅ | ✅ | ✅ | ✅ |
| **Logseq** *(v)* | ✅ | ◐ *(Mermaid; built-in Excalidraw **removed** in DB version)* | ✅ | ◐ *(DB version: shadcn tables)* | ◐ | ✅ *(Properties)* |
| **Zettlr** *(v)* | ✅ | ✅ *(Mermaid)* | ✅ | ✅ | ◐ *(via Pandoc Markdown)* | ✅ *(YAML + CSL)* |
| **VS Code preview** *(v)* | ✅ *(KaTeX; `markdown.math.enabled`)* | ✅ *(built-in, with pan/zoom)* | ✅ | ✅ | ✅ | ◐ |
| **GitHub** *(v)* | ✅ | ✅ | ✅ | ✅ | ✅ *(inline, at end)* | ◐ *(rendered as a table)* |
| **mdBook** *(v)* | ✅ *(MathJax)* | ◐ *(community)* | ◐ | ✅ | ◐ | ◐ |
| **MkDocs Material** *(v)* | ✅ | ✅ | ✅ | ✅ *(sortable, filterable)* | ✅ | ◐ |
| **glow** *(v)* | ◐ *(terminal math is limited)* | ❌ | ✅ | ✅ | ✅ | ◐ |

**Reading this section:** rendering fidelity is **solved**. Every tool in the
matrix that renders Markdown at all renders essentially all of it correctly.
There is no rendering gap to exploit. This is important, because it means the
market cannot be won on "renders Markdown better" — we will be *tied* there, and
we must win on something else.

---

## Part 3 · Output and portability

| Product | Export → PDF | Export → HTML | Export → EPUB | Built-in sync | Local-first | Mobile |
|---|---|---|---|---|---|---|
| **Siyana Markdown Viewer** *(planned)* | ✅ | ✅ *(self-contained single file)* | ❌ | — *(use OS/git/syncthing)* | ✅ | ◐ *(planned: web then mobile)* |
| **Obsidian** *(v)* | ✅ | ◐ *(community plugins; Publish)* | ◐ *(community plugins)* | ✅ *(paid: Sync, shared vaults)* | ✅ | ✅ *(iOS + Android)* |
| **Typora** *(v)* | ✅ *(with heading bookmarks)* | ✅ | ✅ *(also DOCX, ODT, LaTeX, MediaWiki)* | ❌ *(OS-level)* | ✅ | ❌ |
| **MarkText** *(v)* | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Logseq** *(v)* | ✅ | ◐ | ❌ | ✅ *(Sync + RTC beta)* | ✅ | ✅ *(iOS; Android "coming soon" for DB)* |
| **Zettlr** *(v)* | ✅ *(Pandoc + profile + template)* | ✅ | ✅ *(Pandoc)* | ❌ | ✅ | ❌ |
| **VS Code preview** *(v)* | ❌ *(core; extensions exist)* | ❌ *(core)* | ❌ | n/a *(Settings Sync is preferences)* | ✅ | ◐ *(vscode.dev)* |
| **GitHub** *(v)* | ❌ *(browser print)* | ◐ *(API / raw)* | ❌ | n/a | ◐ *(files are local via git; viewing is cloud)* | ✅ *(web)* |
| **mdBook** *(v)* | ◐ *(community printers)* | ✅ *(primary output)* | ◐ *(community)* | n/a | ✅ | ◐ *(web)* |
| **MkDocs Material** *(v)* | ✅ *(via plugin)* | ✅ *(primary output)* | ✅ *(via plugin)* | n/a | ✅ | ◐ *(responsive web)* |
| **glow** *(v)* | ◐ *(terminal print pipeline)* | ✅ *(TUI export to HTML — verify)* | ❌ | n/a | ✅ | ❌ |

**Reading this section:** output is *inconsistent*, and that is a real
observation. **PDF export is universal** — everyone has it, including two of
them via the browser. **EPUB is genuinely rare** — only Typora and Zettlr, and
both get it from Pandoc. **HTML export is universal but usually means "a build
step you run elsewhere."**

Our PDF + HTML is a parity requirement, not a differentiator. It is table
stakes, and we must hit it well rather than treat it as an advantage.

---

## Part 4 · Governance and cost

| Product | Open source | Licence | Price (verified 6 Oct 2026) |
|---|---|---|---|
| **Siyana Markdown Viewer** *(planned)* | ✅ | **MIT** | **Free, forever. No paid tier planned.** |
| **Obsidian** *(v)* | ❌ | **Proprietary.** App free for all purposes incl. commercial; optional paid licences | App **$0**. Sync **$4**/mo annual, **$5** monthly (Standard); **$8**/**$10** (Plus). Publish **$8**/**$10** per site/mo. Catalyst **$25** one-time. Commercial **$50**/user/yr |
| **Typora** *(v)* | ❌ | **Proprietary EULA** (Qiyun (Shanghai) Technology Ltd; published 2019-01-16, updated 2026-09-06) | **$14.99** one-time, 15-day trial, **3 devices** |
| **MarkText** *(v)* | ✅ | **MIT** | **Free** (donations) |
| **Logseq** *(v)* | ✅ | **AGPL-3.0** | **Free** (donations); Sync paid |
| **Zettlr** *(v)* | ✅ | **GPL-3.0** | **Free** (donations) |
| **VS Code** *(v)* | ✅ | **MIT** | **Free** |
| **GitHub** *(v)* | n/a | n/a *(service; `github/markup` + `html-pipeline` are MIT)* | Free for public repos; paid plans for private |
| **mdBook** *(v)* | ✅ | **MPL-2.0** | **Free** |
| **MkDocs Material** *(v)* | ✅ | **MIT** *(Insiders is a paid sponsorware tier)* | Free; **Insiders sponsorship** = early access to features in a private repo |
| **glow** *(v)* | ✅ | **MIT** | **Free** |

---

## Part 5 · Accessibility

Not a column in most comparisons, and the reason it is one here.

| Product | Published WCAG conformance statement | Published accessibility support matrix | Keyboard-first design | Screen-reader design intent |
|---|---|---|---|---|
| **Siyana Markdown Viewer** *(planned)* | ✅ **WCAG 2.2 AA** | ✅ *(from [04-accessibility §10](../12-ux/04-accessibility.md#10-screen-reader-testing-protocol))* | ✅ | ✅ |
| **Obsidian** | ❌ | ❌ | ◐ | ◐ *(community plugins exist)* |
| **Typora** | ❌ | ❌ | ◐ | ◐ *(footnotes are hover-only — a known barrier)* |
| **MarkText** | ❌ | ❌ | ◐ | ◐ |
| **Logseq** | ❌ | ❌ | ◐ | ◐ |
| **Zettlr** | ❌ | ❌ | ✅ *(publishes a keyboard-shortcuts page)* | ◐ |
| **VS Code preview** | ◐ *(VS Code is broadly screen-reader accessible; no per-preview conformance claim)* | ◐ *(VS Code publishes screen-reader docs)* | ✅ | ✅ |
| **GitHub** | ◐ *(public VPAT exists)* | ❌ | ◐ | ◐ |
| **mdBook** | ❌ | ❌ | ✅ *(a full keyboard map)* | ◐ |
| **MkDocs Material** | ❌ | ❌ | ◐ | ◐ |
| **glow** | n/a *(a TUI is a fundamentally different accessibility surface — screen readers are largely incompatible with terminal UIs)* | ❌ | ✅ *(terminal-native)* | ❌ *(screen readers do not read a TUI)* |

**This is the emptiest column set in the entire matrix, and it is the one we
believe in most.** Nine of eleven products make no accessibility claim at all.
Not one publishes a WCAG conformance statement for its Markdown *rendering*.

That is not an accusation. It is a **measurement of where the effort has gone.**
Accessibility work is expensive, invisible in a screenshot, and unglamorous in a
changelog. It got deprioritised almost everywhere.

---

## Part 6 · The matrix, compressed — where each product is strong

If you only read one section, read this one.

| Product | Genuinely excellent at | Fundamentally not trying to be |
|---|---|---|
| **Siyana Markdown Viewer** *(planned)* | Reading one document, beautifully and accessibly | Writing; organising; syncing; graph work |
| **Obsidian** | Linking, extensibility, and durability of plain files | Reading one file without the vault apparatus |
| **Typora** | Writing Markdown without seeing Markdown | Reading *someone else's* Markdown; corpora |
| **MarkText** | The same, free and MIT | Long-term maintenance (bus factor of one) |
| **Logseq** | Block-level thought capture | Reading a written linear document |
| **Zettlr** | Academic writing with citations and templates | Everything outside academia |
| **VS Code preview** | Previewing inside an editor | Being a reader |
| **GitHub** | Rendering untrusted Markdown *safely*, at scale | Editing; local files; being a workspace |
| **mdBook** | Turning a folder into a book | Being an application |
| **MkDocs Material** | Beautiful documentation sites | Being an application |
| **glow** | Reading Markdown, minimally | Everything else. Deliberately. |

---

## Part 7 · The gaps we can occupy

### Gap 1 — The dedicated reader does not exist

**Nobody in this matrix is a reader.** Every product that reads Markdown well is
either an **editor** (Typora, MarkText, Zettlr, VS Code) or a **vault and
knowledge system** (Obsidian, Logseq) or a **build tool** (mdBook, MkDocs,
GitHub) or a **terminal program** (glow).

Being a *viewer* — a tool whose only job is to render what already exists, as
well as possible — is treated as a mode rather than a product. Obsidian shipped a
distraction-free reading view **for its Web Clipper** in March 2026 (from their
own roadmap) because the app did not have a good one.

**We are the first product in this matrix whose primary verb is "read."**

### Gap 2 — The open, free, accessible, cross-platform reader does not exist

| | Free? | Open source? | Accessibility claim? | Desktop? | Web? | Mobile? |
|---|---|---|---|---|---|---|
| Obsidian | ✅ | ❌ | ❌ | ✅ | ◐ (clipper) | ✅ |
| Typora | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| MarkText | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Logseq | ✅ | ✅ | ❌ | ✅ | ✅ | ◐ |
| Zettlr | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Us** | ✅ | ✅ | ✅ **WCAG 2.2 AA** | ✅ | planned | planned |

**Five cells of that table are occupied by exactly one product: ours.** Every
other tool is missing at least two.

### Gap 3 — Rendering fidelity is a tie, so stop competing on it

Every mature tool renders Markdown correctly. `cmark-gfm`, Goldmark, markdown-it,
commonmarker, pulldown-cmark, and glamour all agree on the output. **There is no
rendering gap.** Winning on rendering is a tie, and a tie is a waste of the most
scarce resource we have: engineering time.

This is a strategic finding, not a disappointment. It redirects effort toward
the things that are *not* solved.

### Gap 4 — The trust axis is completely empty

| Trust dimension | Any product? |
|---|---|
| Published WCAG 2.2 AA conformance statement | **No** |
| Published screen-reader × platform support matrix, including the failures | **No** |
| Published honest feature/platform matrix with the ❌s | **No** (mdcat published one, and mdcat is archived) |
| No account required for the full product | Obsidian ✅, Logseq ✅, Zettlr ✅ (only those three) |
| No telemetry at all | Obsidian ✅, Zettlr ✅ |
| Independent third-party security audit, published | **Obsidian only** (Cure53 ×3, Trail of Bits ×1) |
| MIT, so the tool keeps working if the company stops | MarkText, Zettlr-adjacent, mdBook, MkDocs, glow, VS Code — but none of them are readers |

**Nobody has claimed "we are an accessible, auditable, MIT-licensed reader."
That is a position, not a feature list.**

### Gap 5 — Reading for *hours* is unoptimised

Focus mode exists in Typora and MarkText (as an editor mode), Obsidian (as
Blur), and nowhere else. **Paged reading** — the actual book metaphor — exists
in **none** of these. Reading-position memory exists in Obsidian and VS Code
and nowhere else. A real typographic scale with a controlled measure exists in
MarkText (Cadmium/Material themes) and nowhere else.

A viewer is *allowed* to do nothing but read. Nobody else is.

---

## Part 8 · Our non-negotiables, derived from the matrix

If a proposed feature does not appear in this list and cannot be traced to one of
the seven gaps, **it does not ship.**

| # | Non-negotiable | Gap | Priority |
|---|---|---|---|
| N1 | Open a file and be reading in under 200 ms. No wizard, no vault scan, no plugin boot | Gap 1 | P0 |
| N2 | A first-class focus mode with a real typographic scale and a controlled measure | Gap 5 | P0 |
| N3 | Automatic, nested, sticky TOC with current-section highlighting | Gap 1 | P0 |
| N4 | GitHub-compatible heading slugs and working `#anchor` navigation across files | Gap 1 | P0 |
| N5 | Math (KaTeX), Mermaid, tables, footnotes, task lists, images with lightbox | parity | P0 |
| N6 | WCAG 2.2 AA, published and enforced by a CI gate | Gap 4 | P0 |
| N7 | A published, honest feature/platform/accessibility matrix including the ❌s | Gap 4 | P0 |
| N8 | Export to PDF (with heading bookmarks) and to a single self-contained HTML file | Gap 1 | P0 |
| N9 | Free forever, MIT, no account, no telemetry, no upsell | Gap 4 | P0 |
| N10 | Folder tree + full-text search over the folder | Gap 1 | P1 |
| N11 | Backlinks panel, derived from links | Gap 1 | P1 |
| N12 | In-app links between documents in the opened folder | Gap 1 | P1 |
| N13 | Double-click any rendered element → open in the user's editor at that line | Gap 1 | P1 |
| N14 | Dark mode that is a designed theme, not an inverted colour filter | Gap 5 | P1 |
| N15 | A CLI: `open`, `search --format=json`, `export` | Gap 1 | P2 |
| N16 | Web target next, then mobile | Gap 2 | P2 |
| N17 | Paged reading mode | Gap 5 | P3 |
| N18 | Split-view comparison | Gap 5 | P3 |
| N19 | Editing | — | **deferred**, see below |

### What is deliberately absent, and why

| Not shipping | Reason |
|---|---|
| **Graph view** | Obsidian proves it is beautiful and answers almost no reader question. [01-obsidian §9.4](../13-competitors/01-obsidian.md#94-graph-view-is-largely-theatre) |
| **A plugin marketplace** | Obsidian's 8,449 plugins are why Obsidian is slow on large vaults. Their own roadmap has "Obsidian for Work — control access to plugins" as Active. [01-obsidian §9.1](../13-competitors/01-obsidian.md#91-performance-on-large-vaults) |
| **A query language / Bases** | Bases is a database engine. A reader does not query. [01-obsidian §10](../13-competitors/01-obsidian.md#10-canvas-and-bases-verified-from-the-roadmap-and-dev-docs) |
| **Canvas / whiteboard** | A creation tool, not a reading tool |
| **Built-in sync** | Files on disk are already syncable with git, Syncthing, Dropbox, or OneDrive — all of which are cross-platform, free, audited, and already installed. Rebuilding it is the single largest piece of unnecessary work in this product space |
| **Importers** | We build none. We render everyone's output. [04-more-tools §9](../13-competitors/04-more-tools.md#9-notion-obsidian-importers) |
| **MDX / arbitrary components in documents** | In a viewer, that is arbitrary code execution. [04-more-tools §5](../13-competitors/04-more-tools.md#5-docusaurus) |
| **Full editing (v1)** | A multi-year, multi-maintainer project. Ship "open in your editor at this line" instead and mean it. [02-typora §12](../13-competitors/02-typora-and-marktext.md#11-why-marktext-lags-and-the-honest-version) |

---

## Part 9 · The gap, in one paragraph

> Ten mature tools render Markdown well. **Every one of them was built to do
> something else with it** — write it, organise it, publish it, or print it to a
> terminal — and reading is either a mode, a pane, or an afterthought.
>
> Two are closed and cost money. Three are open but carry a licence that stops
> companies and contributors. Nine make no accessibility claim at all. Not one
> publishes a WCAG conformance statement for the thing it does to a document.
>
> **A Markdown *viewer* — free, MIT, cross-platform, keyboard-first, published
> WCAG 2.2 AA, honest about its limits, and interested in nothing but the act of
> reading — does not exist.**
>
> That is the gap. It is not a feature list; it is an absence, and absences are
> much easier to fill than to compete in.
## Sources

Every cell derives from the per-product sections of this folder. Primary
sources, all checked 6 October 2026:

- Obsidian — <https://obsidian.md/> · <https://obsidian.md/pricing> · <https://obsidian.md/sync> · <https://obsidian.md/download> · <https://obsidian.md/plugins> · <https://obsidian.md/roadmap> · <https://obsidian.md/cli>
- Typora — <https://typora.io/> · <https://support.typora.io/License-Agreement/>
- MarkText — <https://github.com/marktext/marktext> · <https://github.com/marktext/marktext/releases/tag/v0.20.0>
- Logseq — <https://github.com/logseq/logseq> · <https://github.com/logseq/docs/blob/master/db-version.md> · <https://github.com/logseq/docs/blob/master/db-version-changes.md>
- Zettlr — <https://github.com/Zettlr/Zettlr> · <https://www.zettlr.com/>
- VS Code — <https://code.visualstudio.com/docs/languages/markdown>
- GitHub — <https://github.com/github/markup> · <https://github.com/github/html-pipeline>
- mdBook — <https://github.com/rust-lang/mdBook> · <https://rust-lang.github.io/mdBook/>
- MkDocs Material — <https://squidfunk.github.io/mkdocs-material/>
- glow — <https://github.com/charmbracelet/glow>
- Licence identifiers and star counts: GitHub REST API, unauthenticated, 6 October 2026

### Cells to re-verify before relying on them 🔧

| Cell | Why it needs a second look |
|---|---|
| glow → Export to HTML ✅ | The glow TUI exports HTML in recent versions, but this was not confirmed against a specific tagged release. Downgrade to ◐ if you cannot confirm |
| glow → Task lists / Tables / Footnotes ✅ | `glamour` supports these constructs; the shipped default style set was not verified line by line |
| glow → Math ◐ | Terminal Unicode math is inherently limited; the ◐ is a judgement, not a measurement |
| Logseq → Export to HTML ◐ | The DB version removed several first-class features; confirm what actually ships in the version a user gets |
| Obsidian → Export to EPUB ◐ | Reachable only through community plugins, and plugin availability is not a guarantee |
| MkDocs Material → Insiders price | The sponsorware *model* is verified; the tier *prices* were not reachable at time of writing |
| Zettlr → Footnotes ◐ | Inferred from "selective support Pandoc markdown" rather than from a documented feature list |
| Obsidian → Tables ◐ | Obsidian has shipped both a source-mode and a live-preview table editor at various points; the current balance was not verified in detail |
| mdBook / Jupyter Book → EPUB ◐ | Both are achievable via community printers/converters; neither ships it in the core |
