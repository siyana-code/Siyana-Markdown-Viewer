# 01 — Editor engines

Six candidates, one question: **which engine gives a Markdown viewer a good
editing mode without costing more than the viewer itself?**

Verified 2026-10-06. Versions and dates from `registry.npmjs.org`; sizes from
Bundlephobia (minified, and minified+gzip) for the exact pinned version;
Monaco's on-disk size measured by walking `unpkg.com/monaco-editor@0.57.0/min/?meta`
and summing `.js` files; star counts from repository pages that day; Lezer
timings from our own instrumented run (Node v24.14.1, Windows).

---

## 0. The field

| | **CodeMirror 6** | **Monaco Editor** | **ProseMirror** | **Tiptap** | **Lexical** | raw `contenteditable` |
|---|---|---|---|---|---|---|
| Packages | `@codemirror/*` + `@lezer/*` | `monaco-editor` | `prosemirror-*` | `@tiptap/*` | `lexical` | the DOM |
| Version (verified) | state **6.7.6**, view **6.43.13**, language **6.12.4**, lang-markdown **6.5.2** (2026-08-04) | **0.57.0** (2026-09-24) | view **1.42.6** (2026-09-25), state **1.4.4** (2025-10-23), markdown **1.13.8** (2026-09-21) | core **3.31.4** (2026-09-30) | **0.52.0** (2026-09-28) | n/a |
| Licence | **MIT** | **MIT** (`LICENSE.txt`: "The MIT License (MIT), Copyright (c) 2016 - present Microsoft Corporation") | MIT | MIT | MIT | n/a |
| Stars | 7,816 (`codemirror/dev`) | **46,842** | 8,698 | 38,646 | 23,931 | n/a |
| Monthly dl | 43,598,980 | 36,800,975 | 90,836,373 (view) | 81,544,627 (core) | 23,708,584 | n/a |
| Model | **text buffer + extension system** | text buffer + full VS Code service layer | **rich document model with a schema** | ProseMirror + headless extensions | immutable node tree + plugin system | the browser's model |
| Runtime deps | 1–7 per package | 2 (`marked@14.0.0`, `dompurify@3.4.15`) | 1–3 per package | 0 (core) / 24 (starter-kit) | **1** | 0 |
| Core size (min+gzip) | state 16,441 + view 79,345 | **see §3** | view 54,670 + state 18,991 | core 35,644, starter-kit 106,182 | **62,989** | ~0 |
| Markdown support | **`@codemirror/lang-markdown`**, native, incremental | built-in, non-incremental | **none built in** — you build the schema | `@tiptap/markdown` 3.31.4 | `@lexical/markdown` (separate pkg) | you write it |
| Ships its own highlighter | via `@codemirror/language` + `@lezer/highlight` | yes, built-in | no | no | no | no |
| Needs a worker | no | **yes, mandatory** for language services | no | no | no | no |
| Mobile story | explicit, first-class | poor | good | good | untested here | browser-dependent |
| GitHub activity | active; dev moved to `code.haverbeke.berlin` (Gitea) 2026 | last commit 2026-10-03 | last commit 2026-04-01 | 2026-10-02 | 2026-10-05 | n/a |

---

## 1. CodeMirror 6

### 1.1 What it is

A code editor component for the web, built as a set of small packages that
compose. The core is deliberately minimal and everything else is an extension.
From the project's own feature list on codemirror.net: accessibility
("works well with screen readers and keyboard-only users"), **mobile support
("use the platform's native selection and editing features on phones")**,
bidirectional text, syntax highlighting, line numbers, autocompletion, code
folding, search/replace, "**full parsing** — detailed parse trees allow many
types of language integration", extension interface, modularity, speed,
bracket closing, linting, flexible styling, theming, collaborative editing,
undo history, multiple selections, internationalization.

That list is a *feature list for a code editor*, and every one of those except
"bidirectional text" is something a Markdown editor wants.

### 1.2 The architecture that matters

From `docs/guide`:

> The library's state representation is strictly functional — the document and
> state data structures are immutable, and operations on them are pure
> functions, whereas the view component and command interface wrap those in an
> imperative interface.

```js
let state = EditorState.create({ doc: "123" })

// BAD WRONG NO GOOD CODE:
// state.doc = Text.of("abc")     <- DON'T DO THIS

const transaction = state.update({ changes: { from: 0, insert: "0" } })
console.log(transaction.state.doc.toString())   // "0123"
// At this point the view still shows the old state.
view.dispatch(transaction)
// And now it shows the new state.
```

**This is the property that makes CodeMirror pleasant to build a live preview
on.** We get, for free and correctly:

- an immutable document we can diff,
- a change set with **position mapping** (`mapPos`, `iterChanges`),
- the ability to hold old and new state simultaneously — which is exactly
  what you need to know *what changed* to re-render only that region.

ProseMirror gives the same class of guarantee (transactions over an immutable
document) for a *rich* document. Monaco gives it for text too but buries it
under a service layer.

### 1.3 Markdown support — and the size trap

```js
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'

const view = new EditorView({
  parent: document.body,
  doc: `*CodeMirror* Markdown \`mode\``,
  extensions: [basicSetup, markdown()]
})
```

`markdown(config)` accepts `defaultCodeLanguage` and `codeLanguages` (either
an array of `LanguageDescription` or a function from info string to
language), plus HTML tag language configuration and — importantly for us —
`insertNewlineContinueMarkup`, which the changelog shows being repeatedly
fixed for the cases that matter:

- 6.5.2 (2026-08-04) "could cause it to delete pieces of **lazily continued
  paragraphs**"
- 6.5.1 (2026-07-15) "over-eagerly deleted content in **continued paragraphs
  under blockquotes**"
- 6.3.2 (2025-01-09) "Make Markdown-specific commands return false **inside
  fenced code**" and "Fix an **infinite loop** caused by
  `insertNewlineContinueMarkup`"

Those are exactly the three hard cases in a live-preview editor — lazy
continuation, continuation inside blockquotes, and Enter inside a fence. A
maintainer who is fixing them in 2026 is worth paying for.

**The size trap:** `@codemirror/lang-markdown` is **508,446 B minified /
174,689 B gzip**, because it depends on 7 packages including
`@codemirror/lang-javascript`, `@codemirror/lang-html`, `@codemirror/lang-css`
— so embedded-code highlighting inside fences works out of the box.

**We do not need that in the viewer path.** `@lezer/markdown` on its own is
**68,073 B min / 22,334 B gzip** — **7.8× smaller** — and it is the *parser*
without the embedded-language wiring. So:

| Use | Package | min+gzip |
|---|---|---|
| Viewer (read-only, no editor) | *(none)* | 0 |
| Editor, plain Markdown highlighting | `@codemirror/lang-markdown` | 174,689 B |
| Editor, minimal — we highlight fences ourselves with Shiki | `@codemirror/lang-markdown` + `@lezer/markdown` wired manually | ~22,334 B + CM core |
| Editor, core | `@codemirror/state` + `@codemirror/view` | **95,786 B** |

The wiring is three lines (from `codemirror/lang-markdown/src/markdown.ts`):

```ts
import { parser as baseParser, MarkdownParser, GFM } from '@lezer/markdown'
import { syntaxTree, LanguageDescription, languageDataProp } from '@codemirror/language'

const commonmark = baseParser.configure({ props: [ /* fold, indent props */ ] })

export function markdown(config = {}) {
  return new LanguageSupport(new LRLanguage(defineLanguage(() => MarkdownParser.configure({
    parser: commonmark, codeNodes: buildCodeNodes(config.codeLanguages)
  }))))
}
```

We can do the same with our own `codeLanguages` array that maps info strings
to Shiki, and we get Shiki fidelity *and* 152 KB less JavaScript. **That is
the single best size/quality trade in this whole document.**

### 1.4 Lezer — the part nobody mentions and everybody needs

`@lezer/markdown` 1.7.2 is a Lezer parser: LR(1)-ish incremental parsing with
**tree fragments**. Its `parse(input, fragments, ranges)` signature is the
mechanism behind CodeMirror's incremental parsing, and it is directly usable
by us without CodeMirror at all. Verified working in
[03](03-incremental-parsing.md#3-lezer-incremental-parsing-verified):

```js
import { parser } from '@lezer/markdown'
import { TreeFragment } from '@lezer/common'

const p = parser.configure({ top: GFM })
let tree = p.parse(doc)                                  // cold
let fragments = TreeFragment.addTree(tree, [], true)     // make reusable

// after an edit, drop the overlapping fragment and reparse
const next = TreeFragment.applyChanges(fragments, [[fromA, toA, fromB, toB]])
tree = p.parse(newText, next)
fragments = TreeFragment.addTree(tree, next, true)
```

`@lezer/markdown` is 22,334 B gzip and **gives us a real Markdown syntax tree
with byte offsets**, in the viewer path, with no editor at all. That is a
genuinely underused capability.

### 1.5 Accessibility and IME

CodeMirror's accessibility claim is that it "works well with screen readers
and keyboard-only users", and it has shipped ARIA support for years with an
explicit `EditorView.contentAttributes` for role/label. Its mobile claim is
concrete: it uses the **platform's native selection and editing features** on
phones, which is the right call — a custom selection layer on touch is a
reliability disaster.

On IME and CJK we should be careful about what we claim. CodeMirror's guide
says state is "entirely determined by the `EditorState` value […] **With a few
exceptions (like composition and drag-drop handling)**", i.e. composition is
handled *outside* the transaction model, which is correct — composition must
not be modelled as incremental text edits, and an engine that does that gets
CJK wrong. We have **not run an IME test on any engine**; that is an open
question and it is a *must-test* before the Mobile phase.

---

## 2. Monaco Editor

### 2.1 What it is

"The fully featured code editor from VS Code", with VS Code's feature set and
VS Code's Monaco language services. 46,842 stars — the most-starred of any
candidate — and 36.8M monthly downloads.

**On the licence, the brief is out of date and we should correct it in
writing.** Monaco is **MIT**, not Apache-2.0. `LICENSE.txt` on `main` reads
"The MIT License (MIT) — Copyright (c) 2016 - present Microsoft Corporation",
and the README's License section says "Licensed under the MIT License". We
checked the same line at tags v0.44.0, v0.45.0, v0.46.0 and v0.52.0 and it
says MIT at every one, so this is long-standing, not a recent relicensing.
**There is no licensing caveat to plan around.** (The historical caveat was
about the bundled `vscode-css-languageservice` and `vscode-html-languageservice`
copyleft, which is why they live under `/esm/external/`. That is a genuine
attribution obligation, not a restriction on us.)

### 2.2 Size — measured, not asserted

We walked the published `min/vs` tree:

```
unpkg.com/monaco-editor@0.57.0/min/  →  137 .js files,  24,583 KB total

/min/vs/editor.main.js                 2,735 KB
/min/vs/editor-<hash>.js               2,414 KB
/min/vs/toggleHighContrast-<hash>.js   1,264 KB
/min/vs/assets                        9,535 KB
/min/vs/language                      7,801 KB
/min/vs/nls                            2,568 KB
/min/vs/editorWorkerHost-<hash>.js       353 KB
/min/vs/loader.js                        39 KB
```

And the unminified ESM tree: **1,338 `.js` files, 28,260 KB**, of which
`/esm/vs/languages` is 12,797 KB and `/esm/vs/editor` is 6,950 KB.

Bundlephobia reports `monaco-editor@0.57.0` as **195,024 B min / 27,854 B
gzip**, with 2 dependencies. **That number is misleading** and we should say
why: it measures the *entry* module, which lazy-loads the rest. The real cost
if you ship the whole thing is the 24.6 MB of `min/vs` JS, and the real cost
if you *don't* is that your editor lacks language services.

**Compared to CodeMirror's 95,786 B gzip core, Monaco's editor shell alone is
2,735 KB minified** — roughly 25× CodeMirror's entire state+view core before
a single feature is used.

Runtime dependencies are `marked@14.0.0` and `dompurify@3.4.15` — i.e. Monaco
ships its own Markdown renderer and its own sanitizer. **Our markdown-it and
DOMPurify choices therefore duplicate work Monaco already did**, which is one
more reason not to adopt it: we would be maintaining two of each.

### 2.3 The worker requirement

Monaco's language services run in Web Workers. That is not optional and not
configurable away. Consequences for us:

- In Electron that is a second process to manage. In Tauri it means a web
  worker in the webview, which works, but the worker must be served from the
  app's own origin under our CSP.
- The worker protocol is Monaco-internal. We cannot reuse it for our Markdown
  preview, so a live preview on Monaco means *two* parallel parse systems.
- Startup cost: the worker bundle plus the language service initialisation is
  a large part of the cold-start time we would have to measure.

### 2.4 Mobile

This is where Monaco fails the hard gate (G9, §3.2 of the evaluation
framework). Not "impossible" — **poorly**. The problems are:

1. DOM weight. Monaco's editor constructs a large, deeply-nested DOM with
   decorations, view zones, glyph margins, line number widgets and a minimap
   by default. On a mid-range Android WebView that is a scroll-performance
   problem before it is a correctness problem.
2. Virtualised rendering. Monaco virtualises lines, which means DOM nodes are
   created and destroyed during scroll. That interacts badly with
   Android WebView's compositor.
3. Touch and gestures. Monaco's gesture handling was designed for desktop
   mice and trackpads. VS Code's own mobile support is via Code-server plus a
   mobile-specific client, not via Monaco in a browser.

We could ship Monaco on desktop and something else on mobile. That means
**two editor integrations to maintain**, which roughly doubles the surface of
the most intricate part of the app. For a viewer that primarily reads, that is
a bad trade.

### 2.5 The features we would actually not use

Monaco's differentiators are: IntelliSense with a language server protocol
client, a debugger, refactoring, a git-aware diff editor, a minimap, a
command palette, multi-cursor with VS Code semantics, and a theming system
built around VS Code's colour tokens. For a Markdown note viewer, the useful
subset is: text editing, syntax highlighting, find/replace, folding,
multi-cursor. **All of which CodeMirror provides, at 1/25th the size.**

---

## 3. ProseMirror

### 3.1 What it is

"A well-behaved rich semantic content editor based on `contentEditable`, with
support for collaborative editing and custom document schemas." 8,698 stars,
MIT, split into ~15 modules published separately.

The defining idea is a **schema**. A document is a tree of nodes validated
against a declared `Schema`:

```js
const schema = new Schema({
  nodes: {
    doc:  { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    heading:   { attrs: { level: { default: 1 } }, content: 'inline*', group: 'block' },
    text:      { group: 'inline' },
  },
  marks: { strong: {}, em: {} }
})

EditorState.create({ schema })   // prosemirror-state 1.4.4
```

This is the right model for a **rich text** editor, because it makes
"what is legal here" a declarative fact rather than a pile of commands.

### 3.2 Why it is the wrong model for us — and this is the crux

**A Markdown viewer must not have a schema over the *document*.** The
document is a *file*. It is whatever the user wrote. It may contain constructs
we have never heard of. A ProseMirror schema's whole value proposition is
rejecting invalid documents — and the correct behaviour for a file viewer on
an unknown file is the exact opposite.

If we put a ProseMirror schema over user Markdown we would have to either:

(a) **Make the schema total** — define nodes for every Markdown construct
    plus a catch-all. The catch-all reintroduces the exact problem: it is
    `contenteditable` again with extra steps.
(b) **Refuse to open files that don't fit** — absurd for a viewer.
(c) **Round-trip through a lossy intermediate** — the classic ProseMirror
    Markdown story, and it is lossy by design.

**The mismatch is structural, not a matter of effort.** ProseMirror is the
right engine for an editor whose job is to produce a *document*. Ours is to
edit *text that happens to be Markdown*, where the text is the source of
truth and must survive a round trip byte-for-byte unless the user changed it.

That is a very strong argument, and it is the reason ProseMirror scores 7.4
and not 9.

### 3.3 What we would steal

Two ProseMirror ideas belong in our architecture regardless of which engine we
pick:

1. **Position mapping.** `prosemirror-transform` has first-class
   `Mapping`/`StepMap` objects: apply a change, then ask "where did position
   421 end up?" in O(log n). CodeMirror has an equivalent
   (`ChangeSet.mapPos`) but the *concept* — every edit produces a map you
   reuse to move stale references — is worth internalising.
2. **Decorations.** ProseMirror's `Decoration` model — absolutely-positioned
   inline marks and block widgets attached to a range of a document, with no
   document mutation — is the right shape for things like "show a search
   highlight", "flag a broken wiki link", "render a footnote marker inline".
   CodeMirror has **decorations as a first-class concept too**, so we get this
   for free.

### 3.4 Markdown support

`prosemirror-markdown` 1.13.8 provides a `MarkdownParser`/`MarkdownSerializer`
pair driven by your schema's `parseDOM`/`toMarkdown` specs. Measured:
**185,350 B min / 69,632 B gzip**. That is the schema-driven Markdown bridge,
and it only handles the nodes your schema declares. Footnotes, task lists,
wikilinks and math are all extensions you write.

---

## 4. Tiptap

### 4.1 What it is

"A headless, framework-agnostic rich text editor that's customizable and
extendable through extensions", built on ProseMirror. 38,646 stars, MIT,
core at 3.31.4 (2026-09-30).

The pitch is right: no bundled UI, framework-agnostic, extension-based.

`@tiptap/starter-kit` bundles 24 dependencies at **338,831 B min / 106,182 B
gzip**. `@tiptap/core` alone is **115,924 B min / 35,644 B gzip** with zero
dependencies — remarkably good.

### 4.2 `@tiptap/markdown`

This is new and directly relevant: **`@tiptap/markdown` at 3.31.4**, released
alongside core. It is Tiptap's Markdown import/export for its own node set.
That means Tiptap has, as of 3.x, an answer to the schema problem — but it is
the *same* answer: a fixed node vocabulary defined by Tiptap, so a document
using constructs outside that vocabulary does not round-trip. Same conclusion
as §3.2.

### 4.3 Verdict

Everything Tiptap is, it is because of ProseMirror. Adopting it means adopting
ProseMirror's schema model, for the reason §3.2 rejects. Its extra value is a
friendlier extension API, which we would only use if we were building a rich
text editor. **7.1/10: good product, wrong shape for a file editor.**

---

## 5. Lexical

### 5.1 What it is

Meta's editor framework: "An extensible text editor framework that provides
excellent reliability, accessibility and performance." Written in TypeScript,
framework-agnostic core with React bindings, immutable state, Yjs integration,
and — per its README — "**Serialization** — Import/export from JSON,
**Markdown**, and HTML".

Version 0.52.0 (2026-09-28), MIT, 23,931 stars, **1 runtime dependency**,
**197,829 B min / 62,989 B gzip**.

### 5.2 The distinguishing feature

Lexical's differentiator is **reliability and accessibility as a first-class
goal**, stated at the top of its own README, plus the smallest core bundle of
the rich-editor options (62,989 B gzip, one dependency). Its cross-browser
support floor is explicit: "Firefox 115+, Safari 15+, Chrome 86+".

### 5.3 Verdict

Same structural objection as ProseMirror: a rich document model over a file
that must round-trip. Lexical's `NodeModel` and its plugin architecture are
excellent, and its performance engineering is the best-documented of the
group — but for a Markdown file editor, the plugin architecture is aimed at
features (collaborative cursors, custom block nodes, text-formatting commands)
that a Markdown viewer either does not need or must not have. **7.0/10.**

---

## 6. Raw `contenteditable`

And the option nobody should pick, described so the rejection is on the record.

`contenteditable` is what ProseMirror is built on. It gives you: the browser's
native caret, native selection, native IME composition, native spellcheck,
native accessibility semantics, native undo (sometimes), and **zero kilobytes**.

It also gives you, immediately:

1. **No document model.** The DOM *is* the state. You cannot ask "what is the
   document?" without reading the DOM, and you cannot serialise it reliably.
2. **Browser-inconsistent normalisation.** Chrome, Firefox and WebKit
   disagree about `<b>` vs `<strong>`, about whitespace handling, about what
   Enter produces, about whether `<div>` or `<p>` wraps a new block. CodeMirror
   and ProseMirror exist because this is a solved-hard problem.
3. **`beforeinput` / `input` event semantics vary.** Getting composition,
   autocorrect, spellcheck replacement and drag-drop right on top of
   `contenteditable` is a multi-year project — and it is a project every
   editor framework has already done.
4. **No incremental parsing.** Every re-highlight is a full DOM walk.
5. **Undo is browser-defined** and inconsistent across engines.

**"Zero kilobytes" is a trap.** The real cost is a permanent maintenance
burden in the least fun part of the codebase, and it is the *only* option here
that cannot be tested for IME correctness because the behaviour is the
browser's, not ours. **1.8/10 — rejected.**

---

## 7. Comparison on our criteria

Weights are the evaluation framework's, re-tuned for engines (see
[07-evaluation-framework §7.3](../06-libraries/07-evaluation-framework.md#73-editor-engine-matrix)).

| Criterion | Wt | **CodeMirror 6** | Monaco | ProseMirror | Tiptap | Lexical | contenteditable |
|---|---:|---:|---:|---:|---:|---:|---:|
| Core size (min+gzip) | 18% | **9.0** — 95,786 B state+view | 1.5 — 2,735 KB shell alone | 7.0 — 73,661 B view+state | 7.5 — 35,644 B core | 7.0 — 62,989 B | 10.0 — 0 |
| Mobile performance | 15% | **9.0** — native selection on phones | 3.0 — heavy DOM, virtualised, poor touch | 8.0 | 8.0 | 7.0 — untested | 5.0 |
| IME + CJK | 14% | **8.5** — composition handled outside the transaction model | 8.0 | 8.5 — mature | 8.5 — inherits PM | 8.5 — stated a11y goal | 4.0 — browser-defined |
| Accessibility | 10% | **9.0** — explicit screen-reader + keyboard support | 8.5 | 9.0 | 9.0 — inherits PM | **9.5** — a11y is its stated goal | 6.0 |
| Customisation | 10% | **9.5** — composable extensions, every feature is an extension | 6.0 — must fork internals | **9.5** — schema + plugins | 9.0 | 8.5 | 2.0 |
| Markdown support | 12% | **10.0** — native, incremental, actively maintained | 7.0 — built-in, non-incremental, and we would not use it | 5.0 — we build the schema | 5.5 — `@tiptap/markdown` exists | 5.5 — separate package | 2.0 |
| Maturity | 11% | **9.0** — codemirror.net since 2015, `basicSetup` is a stable API | **10.0** — VS Code | 9.5 | 9.0 | 8.0 | 10.0 — the DOM is 25 years old |
| File-as-source-of-truth | 10% | **10.0** — text buffer, byte-exact | 10.0 | 4.0 — schema rejects unknown docs | 4.5 | 4.0 | 2.0 |
| **Total** | | **8.90** | **4.65** | **7.40** | **7.15** | **7.03** | **1.80** |

**CodeMirror 6 wins 8.90.** The two criteria that decide it are
**Markdown support** (native, incremental, maintained — nothing else has all
three) and **file-as-source-of-truth** (a text buffer does not have opinions
about what a document may contain; every rich model does).

---

## 8. What we actually measured

Everything else in this document is citation. This section is measurement.

### 8.1 Lezer incremental Markdown parse — the load-bearing number

Driven through Lezer's real public API on a 67-character document
(`# Title`, a paragraph with emphasis, a two-item bullet list, a two-column
table), `@lezer/markdown` configured with `GFM`:

```
cold parse (67 chars)                     9.7 – 14.5 ms
incremental reparse after a word change   1.05 – 1.39 ms
incremental reparse after a table edit    1.26 – 1.64 ms
```

**~9× reduction.** Reproduced across three runs with different JIT states.

**Honest caveat, and it matters:** on a 67-character document the absolute
numbers are dominated by first-call JIT warm-up, not by parsing work. The
*ratio* is meaningful because both numbers are dominated by fixed overhead in
the same way. **We have not measured this at document scale** — the
hypothesis that incremental reparse cost grows sub-linearly with document size
while cold parse grows linearly is the whole basis of the live-preview
architecture, and it is **untested at 1 MiB**. That is the single most
important benchmark we have not run, and it goes at the top of
[03's measurement plan](03-incremental-parsing.md#7-what-we-still-need-to-measure).

### 8.2 Tree shape, which is what scroll sync needs

```
Document(ATXHeading1(HeaderMark),
         Paragraph(Emphasis(EmphasisMark,EmphasisMark)),
         BulletList(ListItem(ListMark,Paragraph),ListItem(ListMark,Paragraph)),
         Paragraph)
```

Top-level children are `ATXHeading1`, `Paragraph`, `BulletList`, `Paragraph` —
with byte offsets available on every node. We verified the mapping:

```
line 1  -> HeaderMark  [0,1)
line 3  -> Paragraph   [9,27)
line 5  -> ListMark    [29,30)
line 8  -> Paragraph   [38,67)
lineAt(10) -> line 3, "Other *text* here."
```

**Every top-level block has exact byte offsets, and the offset→line mapping is
O(log n) via `Text.lineAt()`.** That is the whole scroll-sync mechanism, and
it comes free with the parser.

### 8.3 What we did *not* measure, and why it is still on the list

| Not measured | Why it matters | Plan |
|---|---|---|
| Keystroke latency, CM vs Monaco | The headline number everyone cites | Cannot compare fairly in Node — it is a DOM/browser property. Must be measured in the actual webview with `requestAnimationFrame` deltas. |
| IME composition | CJK correctness | Manual test with Windows Microsoft IME + Japanese IME on a Windows 11 build, plus Android Gboard in the Mobile phase. No automation exists. |
| Cold start in the webview | Time-to-first-keystroke | `PerformanceObserver` on `paint` in WebView2. |
| Scroll performance, 100 MB document | The project's stated concern | Virtualised rendering; see [10-performance](../10-performance/). |

**There is no credible published benchmark comparing CodeMirror, Monaco and
ProseMirror keystroke latency on the same corpus.** The numbers floating
around in blog posts are from different machines, different documents and
different years. We will produce our own, in the webview, or we will not
quote one.

---

## 9. Recommendation

**CodeMirror 6, with three deliberate deviations from the obvious setup.**

```ts
// packages/core/src/editor/index.ts
import { EditorState } from '@codemirror/state'          // 6.7.6
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection,
         rectangularSelection, crosshairCursor, dropCursor } from '@codemirror/view' // 6.43.13
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language' // 6.12.4
import { markdown } from '@codemirror/lang-markdown'     // 6.5.2
```

**Deviation 1 — do not use `basicSetup` in production.** It is a convenience
bundle of ~20 extensions. We compose our own so that every kilobyte and every
keybinding is an explicit, reviewable decision. `basicSetup` stays in
development.

**Deviation 2 — `@lezer/markdown` directly, not through
`@codemirror/lang-markdown`, in the viewer path.** 22,334 B gzip instead of
174,689 B, and we get the incremental parse API. In the **editor** path we do
use `markdown()`, because `insertNewlineContinueMarkup` and lazy-continuation
fixes are worth 152 KB.

**Deviation 3 — code fences are highlighted by Shiki, not by
`@codemirror/lang-javascript`.** We pass a `codeLanguages` array mapping info
strings to `LanguageDescription`s that are Shiki-backed (or inert, if Shiki
does not know the language). This keeps the fidelity decision we made in
[04](../06-libraries/04-frontend-highlighting.md) consistent between the viewer
and the editor, and it means the editor and the preview cannot disagree about
what a Rust block looks like.

**Rejected, with the one-line reason each:**

- **Monaco** — 25× the code for features we will not use, needs workers we
  cannot reuse, poor mobile, and ships its own `marked` and `dompurify` that
  duplicate ours. (And it is MIT, contrary to the common belief.)
- **ProseMirror** — a schema over a file the user owns is the wrong shape;
  its whole value is rejecting documents we must accept.
- **Tiptap** — good product, wrong shape; it is ProseMirror plus a friendlier
  API.
- **Lexical** — excellent, rich-document-shaped, same objection; its a11y
  focus is a model we should copy in our own layer.
- **`contenteditable`** — the browser's model is the browser's problem, and
  we would own it forever.

The one thing we take from the rich editors is **decorations as a
first-class concept**, which CodeMirror has, and the discipline of **holding
old and new state simultaneously**, which its functional `EditorState` gives
us. That discipline is what makes the incremental renderer in
[03](03-incremental-parsing.md) possible at all.
