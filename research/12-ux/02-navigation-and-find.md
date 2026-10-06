# 02 · Navigation & Find

> **Question this document answers:** when the reader wants to *go somewhere*
> or *find something*, what does the window offer — and which keyboard
> shortcuts are already taken by the shell we run inside?

---

## Table of contents

1. [Layers of navigation](#1-layers-of-navigation)
2. [Heading anchors](#2-heading-anchors)
3. [The table of contents](#3-the-table-of-contents)
4. [Search](#4-search)
5. [Find-in-page](#5-find-in-page)
6. [The keyboard model](#6-the-keyboard-model)
7. [Electron and Tauri: the shortcuts we have to take back](#7-electron-and-tauri-the-shortcuts-we-have-to-take-back)
8. [The full shortcut list](#8-the-full-shortcut-list)
9. [Backlinks](#9-backlinks)
10. [The outline panel](#10-the-outline-panel)
11. [Acceptance criteria](#11-acceptance-criteria)

---

## 1. Layers of navigation

A Markdown file has four navigation layers and they serve different intents.
Most viewers implement one and leave the reader stuck.

| Layer | Scope | Serves | Frequency |
|---|---|---|---|
| **Anchor** | Within one document | "that section I was told about" | High |
| **Outline / TOC** | Within one document | "the shape of this thing" | High |
| **Folder / file tree** | Across a directory | "which file do I want" | Medium |
| **Workspace search** | Across everything | "where was that phrase" | Medium |
| **Backlinks / references** | Inverted | "what leads here" | Low, but load-bearing when present |

Design rule: **the reader must always be able to answer "where am I, how do I
get back, and what else is here" without using the mouse.** That is the whole
document.

A second rule, learned from Obsidian: **links are a feature, not a
gimmick.** A reader who discovers that `docs/setup.md#linux` is clickable
inside the app stops thinking of it as a web page and starts thinking of it as
a document set. See [13-competitors/01-obsidian](../13-competitors/01-obsidian.md).

---

## 2. Heading anchors

### 2.1 Slugs must be GitHub-compatible

This is not a preference. Thousands of documents contain links authored against
github.com. If our slugs differ, every one of those links is broken *in our
app* while working everywhere else. Readers will file it as "your app has bad
links", and they will be right.

The GitHub algorithm, as observed in GFM's own spec and in
`github/cmark-gfm`'s autolink extension:

1. Convert to lowercase.
2. Remove anything that is not a letter, a number, a space, or a hyphen
   (this strips most punctuation; Unicode letters are preserved).
3. Replace spaces with hyphens.
4. **De-duplicate:** if the resulting slug already exists in the document, append
   `-1`, then `-2`, and so on.
5. The leading `#` characters and following spaces are not part of the text.

Two consequences people get wrong:

- **Duplicate headings must be de-duplicated in document order**, not by
  re-hashing. GitHub appends a counter; it does not add a hash of the content.
- **Explicit `{#id}` attributes** (the attribute syntax Hugo supports, and which
  authors increasingly use) must win over the generated slug. If we do not
  support attributes, we must at least not *break* them — treat `{#custom-id}`
  as part of the heading text but recognise and honour it when present.

### 2.2 Anchor affordances

| Requirement | Detail |
|---|---|
| Every heading gets a visible-on-hover anchor | A `#` link to the left of the heading text. Opacity 0 until heading hover or focus-within; `opacity` transition only 80 ms and disabled under `prefers-reduced-motion` |
| The anchor is a real `<a href="#slug">` | Not a `<button>` with a JS handler. It must be middle-clickable, it must appear in the status bar on hover, and it must work when the JS bundle fails |
| `aria-label` on the anchor | `Permalink to “<heading text>”`. A screen reader announcing "link, #" is useless |
| `scroll-margin-top` | `calc(var(--sticky-header-h) + 1rem)` so the target is never under the chrome |
| Copy-link | A `Cmd/Ctrl + Shift + C`-style action, or a right-click menu item, that copies the full path + slug |
| Scroll behaviour | `scroll-behavior: smooth` normally; `auto` under `prefers-reduced-motion`; **never** smooth on initial load |

### 2.3 Broken anchors

A link to a heading that does not exist must:

- not navigate silently,
- not open a blocking dialog,
- mark the link with `aria-invalid="true"` and a visual treatment that is *not*
  colour-only (dashed underline + a small icon),
- offer a suggestion list when a case-insensitive, punctuation-insensitive match
  exists: "Did you mean `#installing-on-linux`?"

The last one is a small feature that makes a real class of reader frustration
disappear.

---

## 3. The table of contents

### 3.1 Requirements

| # | Requirement | Notes |
|---|---|---|
| 1 | Auto-generated from the renderer's AST, **not** by re-parsing the rendered HTML | The renderer already has the heading tree; re-parsing is wasteful and error-prone |
| 2 | Nested to arbitrary depth | Real documents go to `h5` |
| 3 | Sticky by default in focus mode, collapsible otherwise | |
| 4 | Current-section highlighting | See §3.2 |
| 5 | Click-to-scroll with scroll offset | |
| 6 | Filter box (`/`-less; a dedicated input with a clear button) that filters as you type and matches a fuzzy subsequence, not a substring | Readers remember "…config" not the exact word |
| 7 | Shows heading text, not an anchor icon | Recognition is by words |
| 8 | Rebuilds on document reload; preserves scroll and selection when possible | |
| 9 | Each TOC entry is a real link in the a11y tree: `<nav aria-label="Table of contents">` containing a nested `<ul>` | |
| 10 | Collapsed state shows a **heading count badge** rather than nothing | A reader can then judge document size before expanding |

### 3.2 Current-section highlighting

The naive implementation is a `scroll` event handler that measures every
heading's bounding box on every scroll tick. That is O(headings) per frame and
will visibly stutter on a 400-heading document.

**Implementation:** an `IntersectionObserver` observing each heading with a
root margin that creates a narrow band near the top of the viewport, plus a
final fallback that recomputes on `scrollend` and on resize. In practice:

```js
// A band from just below the sticky header to 20% down the viewport.
const io = new IntersectionObserver(onEnter, {
  rootMargin: `-${stickyHeaderHeight + 8}px 0px -70% 0px`,
  threshold: 0,
});
```

The "current" heading is the last one that entered the band. Handle the
edge case where the reader is scrolling *up* (the entering heading is the one
leaving the band).

### 3.3 Drag-to-reorder — and why it is a mistake in a viewer

Reorderable outlines are a beloved Obsidian power feature: drag a heading and
it moves in the source file.

**In a read-only viewer, dragging a TOC entry has no meaning.** There is
nothing to reorder. Offering the gesture would be either a no-op or a
surprise in-app file write.

**Recommendation:**

- Do **not** implement drag-to-reorder in v1.
- If and when editing ships, implement drag-to-reorder as a real source-level
  move of the heading *and its whole subtree*, with an undo entry, and persist
  the dragged order to disk — never to a UI-only state that silently diverges
  from the file.
- Until then, the TOC panel offers **pin, unpin, collapse subtree, and
  "copy link to this heading"**, which are the gestures a reader actually
  wants in a viewer.

If the requirement comes from a stakeholder, the honest counter is: *"What is
persisted, and where? A UI-only reorder is a lie the next time the file is
touched by another tool."* Record the answer in
[15-open-questions](../15-open-questions/).

---

## 4. Search

### 4.1 Three scopes, three engines

| Scope | Corpus | Latency target | Index | Persistence |
|---|---|---|---|---|
| **In document** | one file | < 5 ms | none — a linear scan of text nodes | n/a |
| **In folder** | the opened directory tree | < 50 ms for 10 000 files | in-memory inverted index, rebuilt on open | rebuilt; optionally cached to disk with an mtime manifest |
| **In workspace** | multiple opened folders, or a user-chosen root | < 100 ms for 100 000 files | persistent inverted index | on-disk, invalidated by mtime+size |

The in-document scope must exist and must be instant, because it is the 95% case
for "read this doc and find the thing in it".

### 4.2 Naive scan vs inverted index — the actual numbers

A naive scan over N files reads each file, strips it to text, and does a
case-insensitive substring or regex match. Cost is dominated by I/O and
tokenisation.

At a rough but useful model — 2 000 files × 4 KB average = 8 MB of text:

| Operation | Naive scan | In-memory inverted index |
|---|---|---|
| Read + tokenise 8 MB | ~120–300 ms (cold disk), ~15 ms (warm, mmap'd) | Same — the index must be built at least once |
| Query "authentication" | ~8–30 ms per query after warm cache | < 1 ms |
| Query latency, 10 queries in a row | 80–300 ms total | < 10 ms total |
| Memory | ~0 | 15–60 MB depending on engine and tokenizer |
| Correctness with stemming/fuzzy | Must be reimplemented per query | Free — the engine does it |
| Phrase search | Regex scan | Native |

**Conclusion:** if search is even *allowed* to be slower than ~30 ms, a naive
scan is defensible and dramatically simpler, and it is what several
Markdown tools actually do. The moment the workspace is large, or the moment
you want stemming, fuzzy matching, field boosting, or highlighted snippets, you
need an inverted index.

**The honest engineering position:** build the naive scan first (it is ~200
lines), measure it against the real worst case, and only then decide whether
the index is warranted. Do not build an index before you have measured a scan.

### 4.3 Library comparison (as of Oct 2026)

| Library | Model | Persistence | Fuzzy | Language handling | Notes |
|---|---|---|---|---|---|
| **`minisearch`** | In-memory inverted index with BM25-style scoring; docs in JS objects | Export/import to plain objects (`JSON`/`JSONL`); you persist it yourself | Yes — prefix + fuzzy (Levenshtein/dice), field boosting, auto-suggest | Custom tokenizer, easy to plug `Intl.Segmenter` | Zero dependencies; small; runs in Node and browser; works in a Web Worker. **Best default for an in-app folder index.** Concurred with by [14-architecture-options §4](../14-architecture-options/05-search-architecture.md) |
| **`flexsearch`** 0.8 | Chunked/worker-native indexes, several index types (including a `Map`-based "document" index) | Yes — built-in `WorkerIndex`, `Index`, and export/import | Yes; has an `Encoder` abstraction for charset folding | Custom `Encoder`, `Charset` | Highest raw throughput. The README claims up to 1,000,000× faster "compared to other libraries" — **that is the project's own marketing claim, treat it as unverified**. API has churned across major versions; the 0.8 migration guide is a warning sign. Our architecture doc additionally notes a slow release cadence |
| **`lunr`** | In-memory inverted index, TF-IDF-ish scoring | `lunr.Index.serialize()` / `load()` — a compact text format | Yes — wildcards and edit distance | Per-language pipelines (`lunr.multiLanguage`), 14 languages | Small, stable, boring in the best way. But: unmaintained momentum and **not worker-aware** — you build the worker. [14-architecture-options §4.2](../14-architecture-options/05-search-architecture.md) recommends **avoiding** it |
| **`orama`** (`@orama/orama`) | Schema-declared index; full-text, vector, hybrid search; BM25; stemming/tokenization in ~30 languages | Yes (`save`/`load`) | Typo tolerance, exact match, boosting, pinning | Strong — explicit schema, strong multilingual support | Much more than we need. Its vector and hybrid search are aimed at a different product, and it has grown into a *product* with a paid cloud tier. Overkill for a Markdown folder |
| **SQLite FTS5** | A virtual table inside SQLite; **persistent, transactional, incremental** | Native — it *is* the database | Built-in `porter`, `trigram`, `unicode61` tokenizers; `NEAR`, prefix (`*`), column filters, `bm25()` ranking, `snippet()` and `highlight()` helpers | `unicode61` + `trigram` covers CJK poorly; custom tokenizers are possible | The **only** option on this list that gives durable, incrementally-updated, crash-safe indexes for free, and it is already in every desktop toolchain. Also the only one that can hold the *file content* alongside the index, enabling result previews without a second read. **Strongest candidate for the workspace scope** |

> **Authority note.** The engine *decision* is already made in
> [`14-architecture-options/05-search-architecture.md`](../14-architecture-options/05-search-architecture.md):
> SQLite FTS5 via `rusqlite` (bundled) on desktop, MiniSearch on web and mobile,
> with a phased plan and a benchmark gate before tier (c) is justified. This
> section restates the same conclusion from the UX side and adds the versions
> and licences verified on 6 Oct 2026. **Where the two disagree, the
> architecture document wins.**

**Recommendation:**

| Scope | Engine | Why |
|---|---|---|
| In document | The browser/webview's own find, or a `TreeWalker` + `String.prototype.indexOf` linear scan | No index needed; must be synchronous and instant |
| In folder | **`minisearch`** in a Web Worker | Zero deps, small, fast enough, easy to persist, easy to test |
| In workspace | **SQLite FTS5** | Persistence, incremental updates, snippets, ranking, and no extra index-format design |

If only one thing ships, ship the folder scope with `minisearch`. If two,
add the workspace scope with FTS5 later.

### 4.4 Search UX

| Concern | Requirement |
|---|---|
| Scope switch | A visible segmented control (`Document` / `Folder` / `Workspace`), remembered per session |
| As-you-type | Debounce 80–120 ms; results stream in; never a spinner for a small corpus |
| Highlighting | Highlight matches in the result list and in the rendered document, with the highlight being `background` + `outline`, never colour-only, and never removing the document's own text colours |
| Result context | 1–2 lines of surrounding text with the match centred; for workspace scope use FTS5's `snippet()` |
| Ordering | Group by file, then by line; keep the file grouping stable across keystrokes |
| Filters | Add a scope filter row: `path:`, `ext:`, `modified:` — cheap to implement on top of any engine, enormously useful on big vaults |
| Keyboard | `↑`/`↓` to move, `Enter` to open, `F3`/`Shift+F3` to cycle results *in the document*, `Esc` to close and return focus to where it was |
| No results | Say what was searched: "No matches in 1,284 files in `~/notes`." Blank state with no context is the worst outcome |
| Indexing feedback | In the background, index silently; expose a progress line only when it exceeds 500 ms |

---

## 5. Find-in-page

**The honest answer: do not build a custom find-in-page for v1.**

> This conclusion agrees with
> [`14-architecture-options/05-search-architecture.md` §2](../14-architecture-options/05-search-architecture.md),
> which has already worked through "what we actually get for free", "Electron's
> `Ctrl+F` problem", and the bar our own built-in bar must clear anyway. The
> architecture document owns the mechanism; this section owns the UX.

Every Chromium and WebKit webview ships an excellent native find: it is
incremental, it highlights, it has a result counter, it scrolls to the match,
it supports case and whole-word options, and it is already keyboard- and
screen-reader-tested. A hand-rolled one in a `<div>` with `window.getSelection()`
will be worse in at least one of: correctness across element boundaries,
performance on large documents, RTL, CJK, and keyboard focus management.

What we must do instead:

1. **Not fight it.** Do not call `preventDefault` on `Ctrl/Cmd + F`. Do not
   install a global keydown handler that swallows it.
2. **Not confuse it.** Our search panel must not be triggered by the same key.
3. **Add the parts it lacks**:
   - "Find in all files" as a distinct action (`Ctrl/Cmd + Shift + F`),
     which opens the *workspace* search, not a find dialog.
   - A "search results in document" list for the case where the reader wants to
     *see all matches* rather than step through them — this is genuinely better
     than the native dialog for "which of these 40 mentions is the one".
4. **Verify the webview keeps it.** Some Electron hardening options and some
   Linux webview builds behave differently. Test `Ctrl+F` in the packaged app
   on both platforms before declaring it done.

**When we would build a custom one:** if we later want regex search, or
search-within-selection, or a "search inside code blocks" mode. All three are
plausible; none is MVP.

---

## 6. The keyboard model

Principles, in priority order:

1. **`mod` = `Cmd` on macOS, `Ctrl` on Windows/Linux.** Display it as
   `Ctrl`/`Cmd` in the docs and as `⌘`/`Ctrl` in the UI, matching platform
   convention. Never bind bare `Ctrl` where `Cmd` is expected — the mapping is
   per-platform in the shortcut registry, not hardcoded.
2. **Never override a browser/shell default without a reason and a menu
   entry.** Every shortcut we claim must appear in the application menu, so a
   user who forgets it can find it. See [§7](#7-electron-and-tauri-the-shortcuts-we-have-to-take-back).
3. **Vim-style document motion for the reading surface.** `j`/`k` for a
   screen-ish line, `Ctrl+D`/`Ctrl+U` for half-page, `g g` / `G` for top/bottom.
   This is the single biggest "it feels native to reading" differentiator, and
   it costs nothing. Obsidian, glow, and every pager use these.
4. **`Esc` always exits the innermost mode**, in a predictable order:
   lightbox → find panel → search palette → focus mode → (normal).
   It must never propagate further if it already handled something.
5. **`F1` or `?` opens a shortcut sheet** — a modal listing every binding,
   grouped, filterable. Cheap to build from the same registry that renders the
   menus. Mandatory for discoverability.
6. **Focus is restored on every close.** Search palette closes → focus returns
   to the document. Lightbox closes → focus returns to the image. Menu closes →
   focus returns to the invoker. This is [04 §3](04-accessibility.md#3-focus-management).
7. **No modal steals focus on load.** Only `Ctrl/Cmd + O`-style explicit opens.

---

## 7. Electron and Tauri: the shortcuts we have to take back

**This is the part teams get wrong.** In a desktop shell, a bare
`keydown` listener in the renderer is not the end of the story: the *menu* layer
runs first, and it claims accelerators.

### 7.1 What Electron claims by default

Verified from Electron's own docs:

- **`Menu.setApplicationMenu(menu)`** — "Passing `null` will suppress the default
  menu. On Windows and Linux, this has the additional effect of removing the
  menu bar from the window." (Electron `docs/api/menu.md`)
- **"The default menu will be created automatically if the app does not set
  one. It contains standard items such as File, Edit, View, and Window."**
  (same file)
- Those standard items carry **roles**, and the tutorial states that a
  `role` "will default to appropriate values for each platform" for both
  `label` and `accelerator` (Electron `docs/tutorial/menus.md`). The `viewMenu`
  role is documented as containing "Reload, Toggle Developer Tools, etc.";
  `windowMenu` covers "Minimize, Zoom"; `editMenu` covers "Undo, Copy, etc.".

Consequence: an Electron app that does not set a menu gets a default one whose
accelerators have already claimed the standard editing, view, and window
shortcuts — including `Ctrl/Cmd + F`, `Ctrl + P`-adjacent print items, `Ctrl + W`,
`Ctrl + T`, `Ctrl + N`, `Ctrl + Shift + I`, `Ctrl + R`/`F5`, `F12`, and the
`Alt`-key menu mnemonic system.

Two more verified details that matter on Windows and Linux specifically:

- **The `&` mnemonic.** From `docs/api/menu.md`: on Windows and Linux, "you can
  use a `&` in the top-level item name to indicate which letter should get a
  generated accelerator. For example, using `&File` for the file menu would
  result in a generated `Alt-F` accelerator." So **just naming a top-level menu
  `&File` claims `Alt+F`**. If we ship an Electron app, we should name menus
  without `&` unless we *want* the mnemonic, or accept that `Alt` activates
  the menu bar.
- **`before-input-event` can suppress menu shortcuts.**
  `webContents.on('before-input-event', (event, input) => { ... })` fires before
  `keydown`/`keyup` reach the page. Verified: *"Calling `event.preventDefault`
  will prevent the page `keydown`/`keyup` events and the menu shortcuts."*
  And for the narrower case, the docs give
  `webContents.setIgnoreMenuShortcuts(!input.control && !input.meta)` as the
  way to keep menu shortcuts but only while Ctrl/Cmd is held.

**The three Electron levers, in order of preference:**

| Lever | Effect | Use when |
|---|---|---|
| `Menu.setApplicationMenu(myMenu)` | Replaces the default entirely; only your accelerators are claimed | Always. Build one menu and derive the shortcut list from it |
| `Menu.setApplicationMenu(null)` | Suppresses the default menu; on Win/Linux also removes the menu bar | If you genuinely want zero chrome. **Loses discoverability and loses native `Alt` menu access on Windows/Linux** — a real accessibility regression, since the menu bar is how many users reach every feature |
| `webContents.on('before-input-event', …)` + `event.preventDefault()` | Per-keystroke veto, also blocking the menu shortcut | For the handful of keys we must take back from the OS or from the menu |

**Recommended Electron plan:** ship a real application menu (File / Edit / View
/ Go / Help) whose accelerators are the *source of truth* for our shortcut list,
then take back only:
`Ctrl/Cmd + F` (we want the webview's own find? then no — actually we want to
*not* claim it at all), `Ctrl + P`, `Ctrl + W`, `Ctrl + T`, `Ctrl + N`,
`Ctrl + Shift + I`, `F5`, `F12`, and `Alt`-alone.

Notes on individual claims:

- `Ctrl/Cmd + F` — **do not claim.** Let the webview find work.
- `Ctrl + P` — we want print. Claim it and route to our print path.
- `Ctrl + W` / `Ctrl + T` / `Ctrl + N` — close tab / new tab / new window. For a
  single-document-per-window viewer, `Ctrl + W` should close the window
  (expected!) and `Ctrl + N` should open a new window. `Ctrl + T` should be
  **left unclaimed** so the webview's tab strip works, *or* claimed and used for
  "new tab" in our own tab strip. Pick one model and be consistent; do not leave
  it ambiguous.
- `Ctrl + Shift + I` and `F12` — DevTools. **Claim both.** Shipping a desktop
  app with an openable DevTools is a security and support liability; gate them
  behind a `--devtools` flag or a debug setting.
- `F5` / `Ctrl + R` — reload. `Ctrl + R` should **reload the document from disk**
  (our most useful reload), not the whole window. `F5` should do the same. This
  is a genuine product win over a naive webview default.
- `Alt` alone — on Windows/Linux this focuses the menu bar. Suppressing it makes
  the app feel less native and can break keyboard-only discovery. **Recommend
  keeping `Alt` behaviour**, and instead ensuring our menu has proper
  `Alt`-mnemonics.

### 7.2 What Tauri offers

Verified from the Tauri v2 docs (`v2.tauri.app/learn/window-menu/` and the
`@tauri-apps/api/menu` reference):

- Native application menus can be attached to a window or the system tray,
  "Available on desktop."
- The JS `Menu` class exposes `setAsAppMenu()`, `setAsWindowMenu()`,
  `append`, `prepend`, `insert`, `items`, `remove`, `removeAt`, `popup`, and
  `default()`.
- `MenuItem`, `CheckMenuItem`, `IconMenuItem`, and `PredefinedMenuItem` exist,
  each with `setAccelerator`, `setText`, `setEnabled`, `setIcon`,
  `isChecked`, `setChecked`.
- `Submenu` has `setAsHelpMenuForNSApp()` and `setAsWindowsMenuForNSApp()` —
  these are macOS conventions, and their presence confirms that macOS gets a
  native menu bar while Windows/Linux get Tauri's platform-specific handling.

The same discipline applies: define the menu declaratively, derive the
shortcut list from it, and use a `keydown` handler for anything the menu cannot
express. Tauri's window-menu support differs by platform (the "Available on
desktop" caveat and the macOS-specific submenu setters mean Windows/Linux
behaviour is not identical), which is a **spike item, not a settled fact**.

**Cross-framework conclusion:** the shortcut table in
[§8](#8-the-full-shortcut-list) is a *specification*, not an implementation.
It must be defined once as data, rendered into the menu, rendered into the
shortcut sheet, and consumed by the key handler. Three consumers, one source.
This is the single highest-leverage piece of engineering hygiene in this
document.

---

## 8. The full shortcut list

Legend: `mod` = `Cmd` on macOS, `Ctrl` on Windows/Linux. "Claim" means we take
it from the shell/menu; "Free" means we leave it to the webview.

### Global / application

| Shortcut | Action | Claim? | Rationale |
|---|---|---|---|
| `mod+N` | New window | Claim | Standard. Clashes with the default Electron `windowMenu` role; the menu entry replaces it |
| `mod+W` | Close document (or window if last) | Claim | Expected; also the default Electron role. Keep both meanings consistent |
| `mod+T` | New tab / new document in tab strip | Claim *or* Free — decide in the ADR | Ambiguity here is the bug |
| `mod+O` | Open file | Claim | Standard |
| `mod+Shift+O` | Open folder | Claim | |
| `mod+Q` | Quit | Free (OS role) | macOS handles it |
| `mod+,` | Settings | Claim | Platform convention |
| `mod+Shift+?` / `F1` | Shortcut sheet | Claim | Discoverability |
| `F1` on Windows/Linux | Shortcut sheet | Claim | |
| `F11` | Toggle fullscreen | Claim | Common in readers |
| `F12` | **Disabled** — DevTools gated behind a debug flag | Claim (suppress) | Support/security |
| `mod+Shift+I` | **Disabled** — DevTools gated | Claim (suppress) | Support/security |

### Document / navigation

| Shortcut | Action | Claim? | Rationale |
|---|---|---|---|
| `mod+←` / `mod+→` | Previous / next document (history) | Claim | A viewer with a folder is a browser |
| `Alt+←` / `Alt+→` | Back / forward | **Free** | Never touch the webview's history. This is the most common mistake in desktop webview apps |
| `PageUp` / `PageDown` | Scroll a page | Free | Native |
| `Home` / `End` | Top / bottom | Free | Native |
| `j` / `k` | Down / up one visual line | Claim | Pager muscle memory |
| `Ctrl+D` / `Ctrl+U` | Half page down / up | Claim | Same |
| `g g` | Jump to top | Claim | Same |
| `G` | Jump to bottom | Claim | Same |
| `mod+L` | Jump to a heading in the document | Claim | Like a browser's URL bar but for headings. Distinct from `mod+P` |
| `mod+P` | Quick-open file by fuzzy name | Claim | VS Code / Obsidian convention. **Do not let the OS print dialog take this** |
| `Esc` | Close innermost mode / leave focus mode | Claim | |
| `[` / `]` | Previous / next heading | Claim | Cheap, memorable, complements `j/k` |

### Panels

| Shortcut | Action | Claim? | Rationale |
|---|---|---|---|
| `mod+Shift+O` | Toggle outline/TOC | Claim | |
| `mod+B` | Toggle file tree / sidebar | Claim | Universal convention |
| `mod+\` | Toggle all side panels | Claim | |
| `mod+Shift+F` | Toggle search panel (workspace scope) | Claim | Distinct from find-in-page |
| `mod+Shift+B` | Toggle **backlinks** panel | Claim | Obsidian convention |
| `mod+Shift+E` | Toggle reading-mode menu | Claim | |

### Reading

| Shortcut | Action | Claim? | Rationale |
|---|---|---|---|
| `mod+Shift+D` | Toggle focus / distraction-free mode | Claim | Discoverability for the most-wanted feature |
| `mod+Shift+W` | Cycle content width (focus → full → padded) | Claim | |
| `mod+Shift+C` | Toggle code-block wrap for this document | Claim | See [01 §6](01-reading-ux.md#6-code-blocks-for-reading) |
| `mod+Shift+M` | Toggle "follow current heading" / sync-scroll | Claim | |
| `mod+Shift+=` / `mod+Shift+-` | Increase / decrease font size | Claim | Also reachable via `mod+=`/`mod+-` |
| `mod+0` | Reset zoom to 100% | Claim | Standard |

### Printing / export

| Shortcut | Action | Claim? | Rationale |
|---|---|---|---|
| `mod+P` (when not bound to quick-open) | Print / Save as PDF | Claim | See note below |
| `mod+Shift+E` (in export menu) | Export HTML / EPUB / DOCX | Claim | |

**Note on `mod+P`:** it is genuinely contested — browser convention says print,
editor convention (VS Code, Obsidian) says quick-open. **Recommendation: print.**
Rationale: our most likely user has this app open next to a browser, and the
browser is one keystroke away. Losing `mod+P`-to-print in a document viewer is
more annoying than losing quick-open, which has a perfectly good alternative in
the `Open` command and in the file tree. Map quick-open to `mod+Shift+P` and
record the decision in an ADR.

### Search / find

| Shortcut | Action | Claim? | Rationale |
|---|---|---|---|
| `mod+F` | **Find in page — leave to the webview** | **Free** | Never rebuild a worse one |
| `mod+Shift+F` | Search across files | Claim | |
| `F3` / `Shift+F3` | Next / previous match in document | Free (webview) | Matches native find |
| `Enter` / `Shift+Enter` | In search panel: next / previous result | Claim | |

### Accessibility

| Shortcut | Action | Claim? | Rationale |
|---|---|---|---|
| `mod+Alt+S` | Toggle a **screen-reader-optimised** document mode (explicit landmarks, no decorative icons, expanded link text) | Claim | Cheap, high value for low-vision and SR users |
| `Alt+Shift+ArrowUp/Down` | Move focus between document landmarks | Claim | Landmark navigation without a screen reader |

---

## 9. Backlinks

### What they are

A **backlink panel** lists every place in the folder that links *to* the current
document (or to the current heading). This is Obsidian's signature feature and
it is the thing that converts a folder of files into a *body of work*.

### Why it belongs in a viewer

The reader's question when reading file B is "what is this part of?" A backlink
panel answers it in one glance, with zero configuration, because it is derived
from links that already exist in the text.

### Requirements

| # | Requirement |
|---|---|
| 1 | Build from the same parsed AST that renders documents — collect heading ids and relative-path targets during parsing, never by regexing rendered HTML |
| 2 | Group by source file; show the heading text of the link and a one-line snippet of surrounding context |
| 3 | Clicking a backlink navigates to the *exact* source line, and marks the link visually for a few seconds so the reader sees where they landed |
| 4 | Show a count in the panel header; `0` is a useful fact, not an error |
| 5 | Resolve relative paths and bare filenames (`setup.md`, `./setup.md`, `../docs/setup.md`, `setup`) — this requires a path-normalisation layer and an index of known filenames |
| 6 | Handle `#heading` fragments: a link to `file.md#section` should appear both in the file's backlink list and in that *section's* unlinked/backlinked list |
| 7 | **Unlinked mentions** (files that mention the name but do not link) — Obsidian's "unlinked references". Very high value, moderately expensive (requires a text search over the corpus). Ship in v2 |
| 8 | Correctness over speed: a false backlink is worse than a missing one, because the reader will click it |

### Cost model

Building backlinks requires an index of, per document, the set of outbound
targets and heading anchors. That is the *same* index structure search needs.
**This is a strong argument to build the folder index even if search is
cut** — it is one parse pass producing two features.

---

## 10. The outline panel

The outline is conceptually the TOC in a different place (VS Code puts it under
the file explorer; Obsidian puts it in the right sidebar; mdBook has none). The
question is whether it is a separate panel or a view of the TOC.

**Recommendation: one component, two placements.** Same tree data, same
highlighting logic, same selection sync. Rendered in the right sidebar next to
backlinks by default, and available as a floating panel in focus mode. Two
independent implementations would drift.

Differences from the TOC, if any:

- The outline may include a **document-level breadcrumb** above the tree.
- In focus mode the outline is *hidden* by definition; in the floating variant
  it is opt-in.
- The outline may additionally offer a "collapse to level N" control, which is
  genuinely useful on a 200-heading document and is a pure *view* operation
  (never persisted to the file).

---

## 11. Acceptance criteria

| # | Criterion | Priority |
|---|---|---|
| N1 | Heading slugs match GitHub exactly, including `-1`/`-2` de-duplication | P0 |
| N2 | `file.md#slug` navigates within the app when the file is in the opened folder | P0 |
| N3 | Broken anchors show an inline, non-modal warning with a "did you mean" suggestion | P1 |
| N4 | TOC is auto-generated, nested, filterable, sticky, and highlights the current section without scroll jank on a 400-heading document | P0 |
| N5 | In-document search returns in < 5 ms on a 5 MB file | P0 |
| N6 | Folder search returns in < 50 ms on 10 000 files | P1 |
| N7 | `Ctrl/Cmd + F` is *not* intercepted | P0 |
| N8 | Every claimable shortcut appears in the app menu and in the shortcut sheet, and the three render from one registry | P0 |
| N9 | DevTools cannot be opened by `F12` or `Ctrl+Shift+I` in a release build | P0 |
| N10 | Backlinks panel lists inbound links with working navigation | P1 |
| N11 | `Esc` exits exactly one mode per press and restores focus | P0 |
| N12 | Reading position persists per document across restarts | P1 |
| N13 | All panel toggles are reachable by keyboard alone and each toggle target has `aria-expanded` | P0 |
| N14 | History navigation (`Alt+←`/`Alt+→`) is the webview's, never reimplemented | P0 |
## Sources

- Electron, `Menu.setApplicationMenu` — "Passing `null` will suppress the default menu. On Windows and Linux, this has the additional effect of removing the menu bar from the window."; "The default menu will be created automatically if the app does not set one. It contains standard items such as File, Edit, View, and Window."; `&File` → generated `Alt-F` accelerator on Windows and Linux — <https://github.com/electron/electron/blob/main/docs/api/menu.md>
- Electron, `Menus` tutorial — `role` values and their default `label`/`accelerator` per platform; the default menu roles `fileMenu`, `editMenu`, `viewMenu`, `windowMenu` and what each contains — <https://github.com/electron/electron/blob/main/docs/tutorial/menus.md>
- Electron, `webContents` — `before-input-event`: "Calling `event.preventDefault` will prevent the page `keydown`/`keyup` events and the menu shortcuts."; `setIgnoreMenuShortcuts` for suppressing only the menu shortcuts — <https://github.com/electron/electron/blob/main/docs/api/web-contents.md>
- Electron, `InputEvent` object (the `modifiers` value space: `shift`, `control`, `ctrl`, `alt`, `meta`, `command`, `cmd`, …) — <https://github.com/electron/electron/blob/main/docs/api/structures/input-event.md>
- Tauri v2, "Window Menu" — `setAsAppMenu`, `setAsWindowMenu`, `append`/`prepend`/`insert`/`remove`, desktop-only, custom items and multi-level menus — <https://v2.tauri.app/learn/window-menu/>
- Tauri v2, `@tauri-apps/api/menu` reference — `Menu`, `MenuItem`, `CheckMenuItem`, `IconMenuItem`, `PredefinedMenuItem`, `Submenu` with `setAccelerator`, `setAsHelpMenuForNSApp`, `setAsWindowsMenuForNSApp` — <https://v2.tauri.app/reference/javascript/api/namespacemenu/>
- GitHub Flavored Markdown, heading anchors and the de-duplication suffix algorithm — <https://github.github.com/gfm/#heading-anchors>
- `minisearch` — <https://github.com/lucaong/minisearch>
- `flexsearch` 0.8 — README, `Encoder` abstraction, worker/persistent indexes; the "1,000,000 times faster" figure is the project's own — <https://github.com/nextapps-de/flexsearch>
- `lunr` — <https://github.com/olivernn/lunr.js>
- `@orama/orama` — schema-declared index, BM25, stemming in 30 languages, vector and hybrid search — <https://github.com/oramasearch/orama>
- SQLite FTS5 — `bm25()`, `snippet()`, `highlight()`, `porter`/`unicode61`/`trigram` tokenizers, contentless and external-content tables — <https://www.sqlite.org/fts5.html>
- WAI-ARIA Authoring Practices Guide — `aria-expanded`, `aria-controls`, dialog focus management — <https://www.w3.org/WAI/ARIA/apg/>
- Existing internal decisions this document defers to: `14-architecture-options/05-search-architecture.md` §2 (tier (a), find-in-page, and "Electron's Ctrl+F problem") and §4 (tier (c) engine choice)
