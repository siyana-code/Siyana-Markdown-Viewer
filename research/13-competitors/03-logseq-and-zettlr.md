# 03 · Logseq & Zettlr

> **Logseq: class — reference (a different product).**
> **Zettlr: class — reference (the academic use case).**
>
> Neither is a Markdown *viewer*. Both are nonetheless the best available
> evidence about two things we must get right: **block-level references** and
> **what happens when Markdown has to serve an academic**.

Research date: **6 October 2026**. Verified against `github.com/logseq/logseq`
(README, `LICENSE.md`, GitHub API), `github.com/logseq/docs`
(`db-version.md`, `db-version-changes.md`), `github.com/Zettlr/Zettlr`
(README, GitHub API), `zettlr.com`, and `docs.zettlr.com`.

---

# Part 1 · Logseq

## 1. What it is

Logseq describes itself (verified from the README) as:

> "A privacy-first, open-source platform for knowledge management and
> collaboration."

Its own framing of priorities is unusual and worth quoting: "It focuses on
**privacy**, **longevity**, and [**user control**]" — linking directly to
`gnu.org/philosophy/free-sw`.

The defining structural choice: **Logseq is an outliner.** A document is a
*sequence of blocks*, not a sequence of paragraphs. Every bullet is a block.
Blocks nest. Blocks are addressable, linkable, and referenceable. The document is
one of several views onto a graph of blocks.

## 2. Licence, scale, platform

| Item | Verified value |
|---|---|
| **Licence** | **AGPL-3.0** (verified from `LICENSE.md` and the GitHub API licence field) |
| **Language** | **Clojure / ClojureScript** (`shadow-cljs`, `bb.edn`, `deps.edn`), plus a `sidecar/` native component and `capacitor.config.ts` for mobile |
| **Scale** | **45.1k** stars, 2.8k forks, 824 open issues, 141 open PRs; last push **2026-10-06** |
| **Platforms** | Windows, macOS, Linux desktop; **iOS** app for the DB version; **Android "coming soon"** for the DB version; a **web version** at `app.logseq.com` |
| **Price** | Free, donation/sponsor-funded |
| **Storage** | Local files (file graphs, now spun out to `github.com/logseq/og`) and SQLite (DB graphs) |

## 3. The architecture shift — this is the single most important thing to understand

Logseq is mid-migration from **file graphs** to **DB graphs**, and the migration
has been severe. Verified from `github.com/logseq/docs/db-version-changes.md`
and `db-version.md` (docs dated **28 April 2026**):

> "**File graphs have been split off to https://github.com/logseq/og**"
> "The application performance is better — loading faster, handling larger
> graphs and large tables."

### 3.1 What changed (verified)

| Change | Detail |
|---|---|
| **Blocks and pages are unified as "nodes"** | "They are referenced as `[[]]` and blocks no longer use `(())` for referencing" |
| **New properties system** | First-class key/value properties, more capable than the old `key:: value` syntax |
| **Tags became a whole subsystem** | Pressing enter on `#` triggers "a powerful tags feature"; properties are *not* part of block content, so tags can be attached to code/quote/math blocks naturally |
| **Markdown only** | "**Org mode files are no longer supported**" |
| **Tables rewritten** | Replaced by a "shadcn based table" with "inline editing like spreadsheets by default" |
| **UI rewritten with shadcn** | |
| **Flashcards reimplemented** | New algorithm, "isn't compatible with the previous flashcards", old data is not imported |
| **Markdown syntax in blocks hidden** | "Markdown syntax for blocks e.g. a heading or quote is no longer visible or editable" — removed via a right-click H icon |
| **Zotero integration removed** | "no longer a built-in feature and will hopefully be moved to a plugin" |
| **Slides removed** | |
| **Whiteboards removed** | |
| **Excalidraw removed** | "`/draw` is no longer a built-in feature" |
| **Templates redefined** | Now a block tagged `#Template` |
| **MCP server** | New — Logseq exposes an MCP server so AI agents can query the graph |
| **RTC sync** | Real-Time Collaboration as the sync model for the DB version |
| **Web plugin restriction** | "Plugins can be used from the web. For security reasons only plugins configured with **no 'effect'** are usable" |
| **New mobile app** | Separate iOS app for DB graphs, in alpha |

### 3.2 What this teaches us

**Lesson L1 — an architecture migration is a user-facing catastrophe, not a
technical detail.** Every one of the removals above is a feature someone used
and now cannot. When we migrate our rendering core (and we will — see
[05-rendering](../05-rendering/)), the migration path for users is: old files
keep rendering, new files get new features, nothing is removed until a major
version. **Never remove a file format's capability in place.**

**Lesson L2 — "the file format is the product" cuts both ways.** Logseq had to
split file graphs into a separate repo to make the DB version work. For a
*viewer*, that entire class of problem disappears, because we do not own the
mutation path. **This is an argument for narrowness, not for ambition.**

**Lesson L3 — the outliner model genuinely serves a different job.** Block
references (`((abc123))`), per-block properties, block-level queries, and
journals are excellent for capturing thoughts. They are **not** what you want
when you are reading a 60-page specification someone else wrote. A reader
arrives at a document, not at a graph.

**Lesson L4 — features accumulate because they are each individually
reasonable.** Every removal in §3.1 was, in its day, a good idea. The total is
a product nobody can hold in their head. This is Obsidian's Bases problem and
Logseq's problem and it will be ours if we are not careful.

## 4. What Logseq does brilliantly

| # | Strength | Detail |
|---|---|---|
| 1 | **Block references** | `(())` in file graphs, `[[]]` in DB graphs. Address a specific bullet, not a file. For note-taking this is the killer feature |
| 2 | **Outliner-native editing** | Every block is a target, has properties, and can be collapsed, referenced, and queried. Nothing is trapped inside a paragraph |
| 3 | **Privacy and longevity as stated values** | Local-first, AGPL, no cloud dependency, explicit anti-cloud-sync position (only if you opt in) |
| 4 | **Plugins and themes** | A real ecosystem; and, unusually, a stated plugin-permission model — plugins with "no effect" are safe from the web, effect plugins must be certified. That is a permission model we should copy the *shape* of |
| 5 | **AGPL** | If you want your tool to stay free, AGPL is the strongest available licence. Our MIT choice is a different bet: more adoption, less protection. Both are defensible |
| 6 | **Exemplar issue discipline** | The `db-version-changes.md` document — an honest, itemised list of what is being removed and why — is better migration communication than most commercial software ships |

## 5. Where Logseq is weak

| Weakness | Detail |
|---|---|
| **Mid-migration pain** | §3.1. Users are being asked to relearn the product |
| **AGPL commercial friction** | Many companies cannot adopt AGPL software. Zettlr (GPL) and MarkText (MIT) are easier to deploy |
| **Clojure stack** | Excellent if you know Clojure; a small hiring pool and a high bar for contributors otherwise |
| **Model mismatch for reading** | An outliner is a capture tool. Reading a written document in an outliner is possible and *worse* than in a plain renderer |
| **Org-mode removal** | A real loss for a real audience, done for coherence |
| **Slide / whiteboard / Excalidraw removal** | Each removal breaks a workflow |
| **Built-in media handling is now plugin-dependent** | A consequence of narrowing, and the right trade for a viewer |

## 6. What we learn from Logseq

| # | Lesson | Where it lands |
|---|---|---|
| 1 | **Block-level addressing is valuable — for the reading side it means: link to a heading, and support deep anchor targets robustly.** A reader's "block" is a section | [02 §2](../12-ux/02-navigation-and-find.md#2-heading-anchals) |
| 2 | **Never remove a rendering capability in place.** Migrate additively | [05 rendering](../05-rendering/), [14 architecture](../14-architecture-options/) |
| 3 | **A plugin permission model is a first-class design artefact**, not an afterthought. "No effect" plugins are safe on the web is a genuinely good idea | [14](../14-architecture-options/) |
| 4 | **Narrowness is a feature.** Every one of Logseq's removed features was individually justified and collectively fatal | The core positioning in [01-obsidian §12](../13-competitors/01-obsidian.md#12-the-gap-stated-precisely) |
| 5 | **Markdown-only is a legitimate scope decision** for a product whose files must interoperate everywhere |
| 6 | **Migration communication is product design.** Write the "what is being removed" document before you remove it | |

---

# Part 2 · Zettlr

## 7. What it is

Zettlr (verified from `zettlr.com` and the GitHub README):

> "**Your One-Stop Publication Workbench**"
> "From idea to publication in one app: Zettlr supports your writing process at
> every stage — from initial idea to a final publication, already typeset in
> the appropriate template."

Read that positioning carefully. It is **not** a note app and **not** a
Markdown editor. It is an **academic writing workbench**: notes → draft →
citations → journal submission → typeset output.

## 8. Licence, scale, platform (verified)

| Item | Verified value |
|---|---|
| **Licence** | **GPL-3.0** (verified via the GitHub API licence field) |
| **Language** | **TypeScript** |
| **Stack** | "Zettlr is powered by **Electron**, **WinterCMS**, and **UIKit**" (their own words, `zettlr.com` footer) |
| **Scale** | **13.7k** stars; last push **2026-10-06** |
| **Price** | Free, "supported by donations" |
| **macOS** | ✅ Intel **and** Apple Silicon |
| **Windows** | ✅ **x64 only** |
| **Linux** | ✅ **Debian/Ubuntu (x64 + ARM)**, **Fedora/Red Hat (x64 + ARM)**, **AppImage (x64 + ARM)**; plus Homebrew, Aptitude, Flathub, Winget, Chocolatey, Arch |
| **32-bit** | ❌ Not supported |
| **Privacy** | "There is no **forced** cloud-synchronization or **telemetry**… The only time Zettlr connects to the internet is to check for updates. And if you want to, you can even disable that." |

That Linux packaging list is better than Obsidian's for anyone on RPM or ARM.

## 9. What Zettlr does brilliantly

### 9.1 First-class citations

This is the feature that makes Zettlr irreplaceable in its niche, and it is
worth understanding precisely.

Verified from `zettlr.com`:

> "Zettlr provides first-class support for your reference manager. Whether you
> use **Zotero, JabRef, or Juris-M** — Zettlr supports them all. Simply load
> your library into Zettlr, and begin to cite. Zettlr supports industry
> standard citations, allowing you to use **one of over 9,000 different
> styles**."

The design is right: Zettlr does **not** implement citation styles. It
integrates with the tools academics already use (Zotero's database, JabRef's
`.bib` files, Juris-M's JSON), and delegates style rendering to
**Pandoc + citeproc**, which genuinely supports thousands of CSL styles.

**This is the single most transferable idea in this document**, and it is not
about citations at all. It is:

> **Do not reimplement a solved problem. Delegate to the tool that already
> solved it, and spend your effort on the thing you are actually for.**

We are not a citation tool and will never be. But the same principle says:
if a user asks us to render LaTeX math, use **KaTeX**; do not write a TeX
engine. If they ask for diagrams, use **Mermaid**; do not write a layout engine.
If they want search across a huge folder, use **SQLite FTS5**; do not write an
inverted index from scratch when a battle-tested one exists. See
[06 libraries](../06-libraries/).

### 9.2 Export profiles

> "With its powerful **profile system**, powered by **Pandoc**, you can export
> any paper with a template in just one click. Simply create a new profile, add
> your template, and click export."

And presentations: "Beamer, reveal.js, or Powerpoint".

So Zettlr's export model is: **a profile is a named Pandoc invocation with a
template.** One mechanism, unbounded outputs, no per-format code. That is
exactly the right shape for a feature like export.

**Transferable version for us:** one export pipeline (Pandoc, if we adopt it)
plus user-supplied templates gives us DOCX, LaTeX, ODT, and EPUB for free,
without six bespoke implementations. That would make Typora's enormous export
list tractable — see
[02-typora-and-marktext §12 T13](../13-competitors/02-typora-and-marktext.md#what-we-learn-from-typora--marktext).

**But:** it also drags in a heavyweight dependency (Pandoc is ~30 MB). For a
fast viewer, HTML and PDF must work with **no Pandoc present**, with Pandoc as
an *optional* enhancement. That is the honest architecture.

### 9.3 Zettelkasten support

> "Zettlr offers first-class support for any style of curating your own
> Zettelkasten. Zettlr supports **note IDs, internal Wiki-style links, related
> files, seamless navigation, and even a graph view**."

Note IDs are the difference between a Zettelkasten and a folder of Markdown
files: a stable, unique, content-derived identifier for each note, so a link
never breaks when the title changes. Logseq solved this with block refs;
Zettlr with note IDs.

### 9.4 Snippets with tabstops

> "Zettlr includes a powerful **snippets** system that allows you to define
> blueprints for files that you can quickly insert anywhere. It includes
> **variable support, tabstops**, and many more features."

A snippet system with variables and tabstops is essentially a LaTeX macro
system for prose. Small, well-designed, and very cheap to implement for a
viewer (even read-only, we could offer snippets as *insertion* helpers if
editing ever ships).

### 9.5 The WYSIWYG slider

> "From bare metal code to rich text: **With Zettlr, you decide how much WYSIWYG
> you see.**"

A *continuous* slider from raw Markdown to rendered text, rather than discrete
modes. This is a nicer idea than Typora's mode switch, and it is a better
answer to the "when do I want source?" question in
[02-typora §4.4](../13-competitors/02-typora-and-marktext.md#44-typoras-actual-mitigation).

### 9.6 Journal-submission workflow automation

Export profiles + a template per journal = one-click submission to venues with
different format requirements. This is a *workflow* product, not a *document*
product, and it is a category a viewer should not enter.

## 10. Where Zettlr is weak

| Weakness | Detail |
|---|---|
| **GPL-3.0** | Copyleft is a real adoption barrier for many companies, and the plugin/core boundary is heavier to navigate for contributors |
| **Electron** | Large install, memory footprint, and it inherits Electron's a11y caveats (see [04-accessibility §9](../12-ux/04-accessibility.md#9-the-webview-accessibility-tree-risk)) |
| **Windows x64 only** | No 32-bit, no ARM. Windows is our first target — this is a real gap they have |
| **Scope is narrow by design** | It is an academic writing tool. If you are not writing a paper with citations, most of the app is irrelevant. **Which is, again, our entire opening** |
| **No mobile, no web** | Desktop only |
| **Setup cost** | Reference manager configuration, Pandoc profiles, LaTeX installation. A high bar to entry that is only worth paying for the academic workflow |
| **Small ecosystem** | 13.7k stars, no plugin marketplace to speak of. Obsidian has 8,449 plugins; Zettlr has a community forum |

## 11. What we learn from Zettlr

| # | Lesson | Where it lands |
|---|---|---|
| 1 | **Delegate to the tool that already solved the problem** (citeproc/Pandoc for citations, KaTeX for math, Mermaid for diagrams, FTS5 for search) | [06 libraries](../06-libraries/) is written on this principle |
| 2 | **One export mechanism plus user templates**, not one implementation per format | [01-reading-ux §12](../12-ux/01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) |
| 3 | **Stable identifiers beat titles.** A note/heading ID that survives a retitle is what makes links durable. Our heading slugs must be stable and our backlinks must survive file renames where the OS allows us to track them | [02 §2](../12-ux/02-navigation-and-find.md#2-heading-anchals), [02 §9](../12-ux/02-navigation-and-find.md#9-backlinks) |
| 4 | **A continuous "how much WYSIWYG" control beats discrete modes.** If we ever edit, this is the better shape than Typora's three modes | [01-reading-ux §11](../12-ux/01-reading-ux.md#11-the-second-verb-editing-deferred-not-refused) |
| 5 | **A category that serves one job extremely well beats a category that serves five jobs adequately.** Zettlr is useless for a README and perfect for a dissertation. That is not a defect — it is the shape of a good product | Our positioning |
| 6 | **"No telemetry, not even update checks unless you want them"** is a publishable, verifiable privacy stance | [01-obsidian §8.4](../13-competitors/01-obsidian.md#84-local-first-done-properly) |
| 7 | **Document the shortcuts.** Zettlr publishes a full keyboard-shortcuts page. A tool with 100 features has to be operable without discovery-by-exploration. We have far fewer features and should do it better | [02 §6](../12-ux/02-navigation-and-find.md#6-the-keyboard-model) |

---

## 12. Outline vs flow — the model question, settled for us

The two remaining documents make the architectural point most clearly, so it is
worth stating explicitly as a decision.

| | **Flow (document) model** | **Outline (block) model** |
|---|---|---|
| The unit | A document with a linear heading hierarchy | A tree of addressable blocks |
| Used by | Typora, MarkText, Zettlr, Obsidian (Reading view), mdBook, MkDocs, GitHub | Logseq |
| Excellent for | Reading a written argument. Headings, TOC, sections, print, PDF, search, TOCs, pagination | Capturing and reorganising thoughts. Per-block refs, queries, collapsible structure |
| Requires mutability | Not much | A great deal |
| Addressability | Heading anchors | Block IDs |
| Cost to a viewer | Low | **High** — an outliner needs an editor to be worth anything |

> **A viewer is a flow-document tool. Full stop.**

The moment we adopt the block model, we are obliged to solve authoring, block
identity, reordering, and persistence. Every one of those is a multi-month
project and every one of them pulls the product toward being an editor.

**Decision (to be recorded in an ADR):** our document model is a linear flow
of blocks within a document, with a heading hierarchy as the addressing
mechanism. We do not implement block-level references. Where a user needs a
"deep link", that is `#heading-slug` — which is exactly what the rest of the
Markdown world already uses and already links to.

This is not a limitation. It is the reason a viewer can open a file in
milliseconds.

---

## 13. The gap, restated with the two new pieces of evidence

Both Logseq and Zettlr are excellent at what they do and both are irrelevant to
our user. Add them to the Obsidian evidence and the picture is consistent:

| Product | Optimised for | Our user's problem |
|---|---|---|
| Obsidian | Capturing and connecting | "I have the file already" |
| Typora | Writing beautifully | "I did not write this" |
| MarkText | Writing beautifully, free, one maintainer | Same, and fragile |
| Logseq | Capturing via blocks | Same |
| Zettlr | Writing a paper with citations | Same |
| **Siyana Markdown Viewer** | **Reading what already exists** | **This** |

The gap is not a missing feature. It is a **missing category**. And every one
of these products has spent years adding features *toward* the categories
around it — Bases, Canvas, sync, publish, plugins, clipper, CLI, multiplayer —
while the reader at the centre of the format got less and less attention. The
reader is the original use case for Markdown. It is the least served.
## Sources

### Logseq

- README — "A privacy-first, open-source platform for knowledge management and collaboration"; "It focuses on privacy, longevity, and user control" linking to the GNU Free Software Definition; DB version overview (DB graphs, new iOS mobile app in alpha, RTC in beta, "data loss is possible so we recommend automated backups"); file graphs split off to `github.com/logseq/og`; `test/db` branch for stable; `app.logseq.com` web version; Linux install script; Org-mode and Markdown support; plugins and themes — <https://github.com/logseq/logseq/blob/master/README.md>
- `LICENSE.md` — AGPL-3.0 — <https://github.com/logseq/logseq/blob/master/LICENSE.md>
- DB version feature reference, "as of April 28th 2026" — nodes (unified blocks and pages), properties, tags, tag-based features, tasks, journals, queries, cards, assets, templates, bulk actions, views, tables, library, search commands, MCP server, sync, publish, plugins, DB graph importer, automated backup, export and import, graph export/import, build EDN data, iOS app, Android app, scripting, CLI — <https://github.com/logseq/docs/blob/master/db-version.md>
- DB version changes — "Blocks and pages are united as nodes… referenced as `[[]]` and blocks no longer use `(())`"; "The application performance is better"; shadcn-based tables replacing v1/v2; shadcn UI rewrite; new flashcard algorithm with no data import; "**Markdown is the only supported format. Org mode files are no longer supported.**"; "Zotero integration is no longer a built-in feature"; Slides, Whiteboards and Excalidraw removed; templates via `#Template`; "Plugins can be used from the web. For security reasons only plugins configured with no 'effect' are usable"; graph cache moved from `~/.logseq/graphs/` to `~/logseq/graphs/`; "File graphs have been split off to https://github.com/logseq/og" — <https://github.com/logseq/docs/blob/master/db-version-changes.md>
- GitHub REST API, unauthenticated, 6 October 2026 — 45.1k stars, 2.8k forks, 824 open issues, 141 open pull requests, last push 2026-10-06, licence AGPL-3.0, primary language Clojure, topics include `local-first` and `knowledge-graph`

### Zettlr

- README — "Zettlr brings simplicity back to your texts"; "Publish, not perish."; privacy-first; citation integration with Zotero/JabRef/Juris-M; available in over a dozen languages; LaTeX and Word template support; exports with Pandoc, LaTeX and Textbundle; snippets with variable support and tabstops; themes, dark modes and custom CSS; code highlighting; Zettelkasten support; full-text search; "Zettlr is Free and Open Source Software (FOSS)"; platform matrix — macOS (Intel and Apple Silicon), Windows (x64), Debian/Ubuntu (x64 and ARM), Fedora/Red Hat (x64 and ARM), AppImage (x64 and ARM), with "32-bit is not supported"; Homebrew, Aptitude, Flathub, WinGet, Chocolatey, Arch — <https://github.com/Zettlr/Zettlr/blob/develop/README.md>
- Website — "Your One-Stop Publication Workbench"; "Available for Windows, macOS, and Linux. Zettlr is Free and Open Source software, supported by donations."; "There is no forced cloud-synchronization or telemetry, and all files stay on your computer"; "The only time Zettlr connects to the internet is to check for updates. And if you want to, you can even disable that."; first-class reference-manager support with "one of over 9,000 different styles"; Pandoc-powered export profiles with user templates; Beamer / reveal.js / PowerPoint export; "From bare metal code to rich text: With Zettlr, you decide how much WYSIWYG you see."; LaTeX math and Mermaid charts; snippets system; Zettelkasten methodology support; "Zettlr is powered by Electron, WinterCMS, and UIKit"; footer "© Hendrik Erz 2017–2026" — <https://www.zettlr.com/>
- GitHub REST API, unauthenticated, 6 October 2026 — 13.7k stars, licence GPL-3.0, primary language TypeScript, last push 2026-10-06
- Pandoc — the delegated conversion engine behind the export profiles — <https://pandoc.org/>
- Citation Style Language / citeproc — the delegated citation-style engine behind the "9,000 styles" claim — <https://citationstyles.org/>
