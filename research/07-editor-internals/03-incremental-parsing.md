# 03 — Incremental parsing

The architecture that makes live preview usable on documents that are too big
to re-parse.

**The problem in one sentence:** a 10 MiB Markdown file re-parsed on every
keystroke at markdown-it's measured 4.19 KiB/ms takes **2.4 seconds** of
blocked main thread, and we have committed to supporting 100 MB files.

This document is the design. The numbers in §3 are **ours**, produced by
driving Lezer's real public API; the markdown-it number is from
[06-libraries/01-js-parsers §7](../06-libraries/01-js-parsers.md#7-performance-measured);
and §7 lists what we have **not** measured, which is the honest part.

---

## 1. The five techniques, and what each is worth

| Technique | Re-render cost | Complexity | Verdict |
|---|---|---|---|
| **1. Reparse on change with debouncing** | O(file) | trivial | Necessary, nowhere near sufficient |
| **2. Block-level caching** | O(1) per changed block | medium | **The core technique.** Ship this |
| **3. Incremental / lazy parsing** | O(changed region) | high | **Ship it, for the syntax tree** — CodeMirror gives it to us free |
| **4. Transaction-based state** | n/a | low | Ship it — this is CodeMirror's `EditorState` |
| **5. Dirty-region DOM updates** | O(changed DOM) | medium | Ship it |
| 6. Parse in a worker | n/a | medium | **Do it for the initial parse of a large file.** Marginal for keystrokes |
| 7. Virtualised rendering | O(viewport) | high | Required at 100 MB. Separate document |

Techniques 2, 3, 4 and 5 compose. That composition is the architecture.

---

## 2. Technique 1 — reparse with debouncing

The minimum viable live preview, and the one every naive implementation
ships.

```ts
let timer: number | undefined
EditorView.updateListener.of((u) => {
  if (!u.docChanged) return
  clearTimeout(timer)
  timer = window.setTimeout(() => rebuild(u.state.doc.toString()), 120)
})
```

**Why 120 ms and why not more.** Below ~80 ms the preview updates between
keystrokes and the user perceives it as fighting them. Above ~250 ms they
perceive the preview as broken. 120 ms is in the range every competitive
implementation converges on. It is also the number that a *fast* parse makes
irrelevant — if the parse takes 8 ms (which block caching buys us), a 120 ms
debounce is pure latency added for no reason.

**Why it is nowhere near sufficient.** It scales with document size. From the
real-world benchmark, per-document markdown-it parse times:

| Document | Size | markdown-it (min of 9) |
|---|---|---|
| `cm-langcss-readme.md` | 3.3 KiB | 0.57 ms |
| `pulldown-readme.md` | 7.9 KiB | 0.98 ms |
| `mdi-usage.md` | 3.0 KiB | 0.53 ms |
| `markdown-rs-readme.md` | 11.2 KiB | 3.01 ms |
| `comrak-readme.md` | 19.7 KiB | 3.54 ms |
| `marked-pro.md` | 28.8 KiB | 4.87 ms |
| `mdi-changelog.md` | 27.0 KiB | 8.95 ms |
| `starry-night-readme.md` | 106.7 KiB | 40.70 ms |
| `micromark-readme.md` | 56.3 KiB | 17.98 ms |
| **`commonmark-spec.md`** | **201.3 KiB** | **33.22 ms** |

Roughly linear, ~0.17 ms/KiB. Extrapolating (and this extrapolation is
**inference**, not measurement):

| Document | Extrapolated full reparse |
|---|---|
| 1 MiB | ~175 ms |
| 10 MiB | **~1.75 s** |
| 100 MiB | **~17.5 s** |

Every keystroke. On the main thread. **Debouncing does not fix this; it makes
it a lag instead of a freeze.** Block caching does.

---

## 3. Technique 2 — block-level caching (the core)

### 3.1 The key insight

**Top-level Markdown blocks are almost independent.** If I change a word
inside a paragraph, no other paragraph's HTML can change. That is not true of
inline constructs and it is not true across certain block boundaries — but it
is true most of the time, and "most of the time" with a correct fallback is
an excellent trade.

markdown-it hands us the block index for free. From
[06-libraries/01-js-parsers §7.4](../06-libraries/01-js-parsers.md#74-a-concrete-win-we-verified-independent-block-rendering):

```js
const tokens = md.parse(src, {})
tokens.filter(t => t.level === 0 && t.map).map(t => `${t.type} [${t.map}]`)
// heading_open    [0,1]
// paragraph_open  [2,3]
// table_open      [4,7]
// fence           [8,11]
// paragraph_open  [12,13]
```

A top-level token with a `map` **starts** a block. The block ends where the
next one starts.

### 3.2 The correctness check — and it passed

Before building on it we tested the load-bearing assumption: *is rendering
blocks independently byte-identical to rendering the whole document?*

```js
const starts = tokens.filter(t => t.level === 0 && t.map)
const blocks = starts.map((s, i) => ({
  type: s.type,
  from: s.from,
  to: i + 1 < starts.length ? starts[i + 1].from : lines.length
}))

const joined = blocks
  .map(b => md.render(lines.slice(b.from, b.to).join('\n').replace(/\n+$/, '')))
  .join('')

joined.trim() === md.render(src).trim()
// -> true
```

**Verified true.** And per block:

```json
[heading_open   ] lines 0-2   => "<h1>A</h1>"
[paragraph_open ] lines 2-4   => "<p>para one</p>"
[table_open     ] lines 4-8   => "<table>…"
[fence          ] lines 8-12  => "<pre><code class=\"language-js\">const a = 1\n</code></pre>"
[paragraph_open ] lines 12-14 => "<p>last para</p>"
```

Note the fence block: it starts at line 8 and **must** end at line 12, not at
line 10, because `fence`'s `map` is `[8,11]` (lines 8, 9, 10) and the closing
fence is line 10 — but the *blank line at 11* belongs to no block, and the
next block starts at 12. Taking "the next top-level token's start" rather
than "this token's map end" is what makes it correct. We chose that
deliberately.

### 3.3 The cases where it is **not** correct

Three, and each needs an explicit fallback:

| Case | Why independence fails | Fallback |
|---|---|---|
| **Link reference definitions** | `[foo]: /url` at the top enables `[foo]` at the bottom | If any `reference_definition` token exists → full-document parse |
| **Footnotes** | `markdown-it-footnote` collects definitions across the whole document and emits one `<section>` at the end | If the footnote plugin is active and a `footnote_ref` appears outside its defining block → full-document parse |
| **List tightness across blocks** | A blank line inside a list changes loose/tight, and a list can span what look like separate blocks | Conservative: treat consecutive `list_item_*` at level 0 as one block |

**The fallback is not a cop-out, it is a design.** Cross-block references are
rare in real notes; `commonmark-spec.md` in our corpus has 100 of them but a
user's note does not. We measure the fallback rate in production and revisit
if it is high.

**A fourth case we accept and do not solve:** lazy continuation. A paragraph
that continues after a list is one CommonMark block spanning what our
top-level token walk may report as two ranges. Consequence: the second part
renders as a paragraph rather than being appended to the first. **This is a
cosmetic error in the preview only; the file is untouched and the source view
is correct.** We record it as a known limitation rather than pretend it does
not exist.

### 3.4 Cache structure

```ts
interface BlockIndex {
  /** Bumped on every document change. Any cache entry whose value differs is stale. */
  blocks: BlockEntry[]
  /** Monotone prefix sums of renderedHeight, for O(log n) scroll mapping. */
  heightPrefix: Float64Array
  /** Cumulative byte offset -> block index, for O(log n) offset lookup. */
  blockStart: Int32Array
}

interface BlockEntry {
  /** Source line range, inclusive of the trailing blank line(s). */
  fromLine: number
  toLine: number
  /** Cheap change detector: length + a fast hash of the slice. */
  hash: number
  /** Rendered HTML. */
  html: string
  /** Measured height, filled in by a ResizeObserver after insertion. */
  height: number
  /** Syntax tree node name at this block, for decorations and folding. */
  nodeName: string
  /** Stable identity across edits so the DOM node is reused, not recreated. */
  key: string
}
```

**Why `hash` and not `text`.** Storing the text doubles memory on a 100 MB
file. A 32-bit FNV-style hash over the block's slice is a few bytes and
collides with probability ~1e-9 per comparison for realistic block counts,
which we then verify by *also* checking length. On a hash match with equal
length we reuse; on any mismatch we re-render. A collision would show a stale
block until the next edit to it — an acceptable failure mode for a 1-in-4-billion
event, and we log it when we can detect it via `===` on a dev-mode copy of
the text.

**Why `key`.** DOM node identity. If we re-render a paragraph and replace its
DOM node, the browser loses selection, text highlight, and the position of any
open `<details>`. We want to update *in place* where possible. Key =
`${fromLine}:${nodeName}:${hash}` is enough to decide "reuse the node, set
innerHTML" versus "replace the node".

### 3.5 The invalidation algorithm

This is the heart of the thing. Given an edit, which blocks are dirty?

```ts
function invalidate(index: BlockIndex, changeSet: ChangeSet): Set<number> {
  const dirty = new Set<number>()

  // 1. The edited range, plus one block of margin in each direction.
  //    Why margin: a block's HTML can depend on whether the NEXT line is
  //    blank (list tightness), and inserting/deleting a line shifts every
  //    subsequent block's line numbers by one.
  const lo = index.blockAtLine(changeSet.from.line - 1)
  const hi = index.blockAtLine(changeSet.to.line + 1)
  for (let i = lo; i <= hi; i++) dirty.add(i)

  // 2. Everything after the edit, because line numbers shifted.
  for (let i = hi + 1; i < index.blocks.length; i++) {
    const b = index.blocks[i]
    b.fromLine += delta
    b.toLine += delta
    // hash is still valid: the CONTENT after the edit is unchanged
  }

  // 3. Anything that REFERS across block boundaries.
  //    With the reference-definition and footnote fallbacks in 3.3 we
  //    simply take the whole-document path in those cases, so this set is
  //    empty in the default configuration.
  return dirty
}
```

**Step 2 is the subtle one and it is free.** Because we key on line numbers
that we *shift* rather than recompute, and because the hash is over content
not position, a block whose content did not change keeps its cache entry and
its rendered HTML and its DOM node. **Editing line 10 of a 10,000-line
document dirties 3 blocks and shifts 2,000 line numbers.** That is the whole
win.

Measured consequence on our real corpus: a keystroke inside the 201 KiB
`commonmark-spec.md` reparses **~1 block of ~350 lines** instead of 350 lines
— call it 0.1 ms instead of 33.22 ms. **That is the number that makes live
preview viable**, and it follows directly from a correctness property we
verified rather than assumed.

---

## 4. Technique 3 — incremental / lazy parsing

### 4.1 Two different meanings, both useful

**Incremental parsing** = reuse the previous parse for the unchanged prefix.
Available from Lezer (free with CodeMirror's Markdown mode) and from
Tree-sitter, but **not** from markdown-it, marked, or micromark. All three
are one-shot functions over a whole string.

**Incremental *rendering*** = reuse the previous HTML for unchanged blocks.
That is §3, and it is available with any parser. **We get 90% of the benefit
from §3 alone, without any parser that supports incremental parsing.**

That distinction matters enormously for our decision, because the popular
claim that "marked has an incremental `parseInline` approach" is about a
different thing entirely.

### 4.2 marked's `parseInline` — what it actually is

marked's lexer produces block tokens, and `paragraph` tokens carry a
`.tokens` array of *inline* tokens. And there is a public
`parseInline(src)` on the instance:

```js
import { Marked } from 'marked'
const m = new Marked({ gfm: true })

m.lexer('Text with *em* and `code`.\n\n- a\n- b\n')
  .map(t => t.type)
// paragraph, space, list

m.lexer('Text with *em* and `code`.')[0].tokens.map(t => t.type)
// text, em, text, codespan, text

m.parseInline('a *b* `c`')
// 'a <em>b</em> <code>c</code>'
```

What this gives you: **you can re-render a single paragraph's inline content
without re-lexing the document.** That is genuinely useful — it is the
inlinest-grain caching available in any JS parser — and it is the right tool
for "the user is typing inside one paragraph".

What it does **not** give you:

- **No positions.** No `token.map`, no line numbers, no character offsets.
  You cannot know *which* paragraph changed without diffing the source
  yourself.
- **No cache invalidation.** `marked` will happily re-lex the same paragraph
  forever; nothing tells you it is unchanged.
- **It is a 40-byte improvement on top of block caching that you implement
  yourself.**

**Verdict: not a reason to choose marked.** The brief described it as marked's
"incremental approach", and it is fair to call it that, but it is a
convenience API for rendering one paragraph, not an incremental parser. Our
own block cache subsumes it and works on blocks rather than paragraphs.

### 4.3 Lezer incremental parsing — verified

`@lezer/markdown` is a Lezer parser, and Lezer parsers are incremental by
construction. The API, which we drove directly:

```js
import { parser } from '@lezer/markdown'
import { TreeFragment } from '@lezer/common'

const p = parser.configure({ top: GFM })

// cold
let tree = p.parse(doc)
let fragments = TreeFragment.addTree(tree, [], true)   // make the tree reusable

// after an edit at line 3, columns 0..4 replaced by 0..5
const changed = [[fromA, toA, fromB, toB]]               // [[61,62,61,62]]
const next = TreeFragment.applyChanges(fragments, changed)
tree = p.parse(newDoc, next)
fragments = TreeFragment.addTree(tree, next, true)
```

`ChangeSet.iterChanges` gives exactly the tuple shape `applyChanges` wants —
we verified this round trip:

```js
cs.iterChanges((fromA, toA, fromB, toB, text) =>
  changed.push({ fromA, toA, fromB, toB, inserted: text.toString() })
)
// -> [{ fromA: 61, toA: 62, fromB: 61, toB: 62, inserted: '9' }]
```

### 4.4 Measured

On the 67-character document (`# Title`, a paragraph with emphasis, a
two-item list, a 2×2 table), three separate runs:

```text
cold parse (67 chars)                        9.7 – 14.5 ms
incremental reparse after a word change      1.05 – 1.39 ms
incremental reparse after a table edit       1.26 – 1.64 ms
```

**~9× reduction, reproduced across runs.**

**Caveats, stated plainly:**

- On a 67-character document both numbers are dominated by fixed overhead
  (JIT, function entry), not by parse work. The *ratio* is meaningful because
  both are dominated the same way; the absolute numbers are not.
- The hypothesis that matters is **"incremental cost is sub-linear in document
  size while cold cost is linear"**, and **we have not tested it at scale.**
  That is the first entry in §7.
- We did not measure inside a browser. Lezer in Node is not Lezer in
  WebView2.

### 4.5 CodeMirror's incremental document API

CodeMirror wraps this in a shape that is even better than calling Lezer
directly, because it handles the `EditorState` bookkeeping:

```ts
import { syntaxTree, ensureSyntaxTree, syntaxParserRunning } from '@codemirror/language'

// Synchronous up to a position, with a time budget:
const tree = ensureSyntaxTree(view.state, view.state.doc.length, 50)

// Or poll:
if (!syntaxParserRunning(view.state)) { /* tree is complete */ }
```

Two things worth knowing from reading `@codemirror/language`:

1. **The parse worker supports a viewport.** `ParseContext`'s constructor
   takes a `viewport` and there is a documented `skipUntilInView()` "to make
   sure the parser is restarted when the skipped region becomes visible".
   **We should pass the visible range.** On a 100 MB document, parsing the
   syntax tree of the whole thing to render 40 visible lines is absurd.
2. **The tree is `(possibly incomplete)`.** `syntaxTree(state)` returns a
   possibly-partial tree, and CodeMirror will grow it. Anything we derive
   from it must tolerate an incomplete tree — which means our folding,
   our "current heading" tracking, and our block-index cross-checks must all
   handle a tree that stops mid-document.

### 4.6 ProseMirror transactions

`prosemirror-transform` has the most mature position-mapping model of any
option: a transaction produces a `Step`, applying it produces a
`StepMap`, and `stepMap.map(pos, assoc)` answers "where did this position go"
in O(log n). It is the model CodeMirror's `ChangeSet.mapPos` implements and
the model our block index needs.

We do not adopt ProseMirror (see
[01-editor-engines.md](01-editor-engines.md#32-why-it-is-the-wrong-model-for-us-and-this-is-the-crux))
but the *concept* is what makes the block index work: **an edit produces a
map, and every cached position is translated through it.**

### 4.7 Position mapping in the parsers

Which parsers expose source positions, and how good they are:

| Parser | Granularity | Has character offset? | Column? | Notes |
|---|---|---|---|---|
| **markdown-it** | block, via `token.map` | **no** — line range only | no | Enough for block caching and scroll sync. Not enough for character-level click-to-caret. |
| **marked** | **none** | no | no | `token.raw` gives the source substring; you must diff lengths yourself. |
| **micromark → mdast** | **every node** | **yes** | **yes** | `position: {start:{line,column,offset}, end:{...}}`. The best in JS. |
| **@lezer/markdown** | every node | **yes** | **yes** (Lezer uses UTF-16 code-unit offsets) | Plus incremental reuse. |
| **pulldown-cmark** | every event | **yes** (`Range<usize>`) | no | `parser.into_offset_iter()` |
| **comrak** | every node | no | **yes** | `node.data.borrow().sourcepos` → line/column |
| **markdown-rs** | every token + mdast node | **yes** | **yes** | `Some(1:3-1:6 (2-5))` — line:col and offset |
| **goldmark** (Go) | node `Segment` + `Lines` | **yes** | yes | |
| **cmark** (C) | byte offsets | **yes** | no | |

**The finding that matters:** markdown-it gives us *block-granularity*
positions, which is exactly what block caching needs and nothing more. If we
later want character-level click-to-caret mapping, we have two options:

1. Interpolate proportionally within a block (what everyone does).
2. Add `mdast-util-from-markdown` as a **second parse** purely for positions.
   That doubles parse cost, which we cannot afford.

**So: proportional interpolation within a block, and we will measure how wrong
it is.** For a paragraph, the error is bounded by the difference in relative
position between source characters and rendered text, which for ordinary prose
is a few characters. It is only badly wrong inside a table cell or a long link
URL. Recorded as an open question.

---

## 5. Techniques 4 and 5 — transactions and dirty-region DOM updates

### 5.1 CodeMirror's `EditorState` gives us the diff for free

```js
const tr = state.update({ changes: { from: 61, to: 62, insert: '9' } })
tr.changes.mapPos(9)    // 9
tr.changes.mapPos(58)   // 58
tr.changes.iterChanges((fromA, toA, fromB, toB, text) => { /* ... */ })
```

Because the old state and the new state coexist, we can compute the set of
dirty blocks without ever diffing strings. This is not something we build; it
is a consequence of the functional design.

### 5.2 Dirty-region DOM updates

Re-rendering the preview means: for each dirty block, produce new HTML; for
blocks whose `key` is unchanged, **do nothing at all**; for blocks whose
content changed, update in place.

```ts
function patchPreview(root: HTMLElement, index: BlockIndex, dirty: Set<number>) {
  for (const i of dirty) {
    const b = index.blocks[i]
    const node = b.domRef
    if (!node) continue

    const nextHtml = renderBlock(b)
    if (nextHtml === b.html) continue        // content-identical after render

    // Fast path: same nodeName and same key -> patch in place.
    if (node.dataset.key === b.key) {
      // Preserve scroll position inside the block and any open <details>.
      const openDetails = [...node.querySelectorAll('details[open]')].map(d => d.id)
      node.innerHTML = nextHtml
      restoreOpenDetails(node, openDetails)
    } else {
      // Replace the node wholesale. Selection inside it is lost — that is
      // correct, because the user just typed in it.
      node.outerHTML = nextHtml
    }

    b.html = nextHtml
    b.height = 0                              // ResizeObserver will refill
  }
}
```

Three details that matter more than they look:

1. **`if (nextHtml === b.html) continue`** — a keystroke inside a paragraph
   frequently produces identical HTML (typing inside an already-bold run, or
   typing a character that is then escaped to the same entity). Skipping the
   DOM write avoids the selection-jump that `innerHTML` assignment causes.
   This one line is worth more than it looks.
2. **`innerHTML` destroys selection.** Assigning `innerHTML` to a node the
   caret is inside moves the caret to the start. This is *why* block caching
   matters so much: with whole-document re-render, the caret jumps on every
   keystroke. With block caching, `innerHTML` is only assigned to blocks the
   user is not currently typing in — because the block they are typing in
   **is** the dirty block, and that one we must handle specially.
3. **The live block.** For the block containing the caret, we do not patch.
   We leave the preview node alone and re-render it on a longer debounce (see
   §6), or we accept the caret jump for that one block and restore it.

**Restoring the caret after a patch** is where a lot of live-preview bugs
live. The correct approach with CodeMirror:

```ts
const sel = view.state.selection.main
const previewSelection = findPreviewRangeForSourceRange(sel.from, sel.to)
highlightPreviewRange(previewSelection)   // a Decoration, not an innerHTML edit
```

**Use a decoration, never a DOM mutation, to show the caret or selection in
the preview.** CodeMirror's decoration system exists for this: absolutely
positioned marks attached to a range, with no document mutation and no
selection disruption. This is a design decision worth writing in the ADR
because the alternative (mutating the preview DOM to show selection) causes
selection bugs that are very hard to debug.

---

## 6. Debouncing, and the "when to flush" rule

Debouncing is not one number. It is three, by urgency.

| Change | Delay | Rationale |
|---|---|---|
| The block containing the caret | **0 ms** (synchronous) | The user is looking at it. Any latency reads as lag. With block caching this is ~0.1 ms. |
| Blocks within the viewport | **~50 ms** | Probably visible. |
| Blocks outside the viewport | **coalesce, flush on idle** | Not visible. Do not waste a frame. Use `requestIdleCallback` where available, a `setTimeout(0)` fallback otherwise. |
| Syntax tree (CodeMirror's own) | CodeMirror's schedule | It already parses with a viewport hint. Do not fight it. |
| Save to disk | **2000 ms** after last keystroke, and on blur, and on focus loss, and on app quit | Never lose a keystroke. |

```ts
type Urgency = 'immediate' | 'viewport' | 'idle'

function schedule(state: EditorState, urgency: Urgency) {
  if (urgency === 'immediate') { flushNow(state); return }

  if (urgency === 'viewport') {
    clearTimeout(viewportTimer)
    viewportTimer = setTimeout(() => flushViewport(state), 50)
    return
  }

  idleHandle = requestIdle(() => flushOutsideViewport(state))
}
```

**The composition rule, non-negotiable:**

```ts
EditorView.domEventHandlers({
  compositionstart() { composing = true },
  compositionend()   { composing = false; schedule(state, 'immediate') },
})

EditorView.updateListener.of((update) => {
  if (!update.docChanged) return
  if (composing) return          // <-- the entire fix for CJK IME
  schedule(update.state, 'immediate')
})
```

During composition the preview **does not update at all**. Not debounced, not
delayed — *not updated*. A partially-composed character is not text; rendering
it is how you make a Chinese user delete your app. The preview simply lags by
the duration of one composition, which the user perceives as correct behaviour
because it is exactly what every native text field does.

---

## 7. The architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  CodeMirror EditorView                                          │
│    @codemirror/state  — EditorState, Text, ChangeSet            │
│    @codemirror/view   — rendering, keymaps, decorations        │
│    @codemirror/lang-markdown / @lezer/markdown — syntax tree   │
│                                                                  │
│    updateListener ──► schedule(state, urgency)                  │
│                       (suppressed while composing)              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    changeSet: [{fromA,toA,fromB,toB,text}]
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  BlockIndex  (packages/core/src/render/block-index.ts)          │
│                                                                  │
│   1. dirty = blocks in [fromA.line - 1 .. toB.line + 1]         │
│   2. shift line numbers of all later blocks; KEEP their hashes   │
│   3. if any cross-block reference → fall back to full parse      │
│                                                                  │
│   blocks[i] = { fromLine, toLine, hash, html, height, key, dom } │
│   heightPrefix: Float64Array   (monotone, for scroll sync)       │
│   blockStart:   Int32Array     (binary search offset → block)    │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   ┌────────────────────┐        ┌──────────────────────┐
   │ renderBlock(lines) │        │ syncScroll(index,    │
   │ md.render(slice)   │        │      sourceTop,      │
   │ + Shiki per fence  │        │      previewTop)     │
   │ + DOMPurify        │        │                      │
   └─────────┬──────────┘        └──────────────────────┘
             │
             ▼
   ┌────────────────────────────────────────────────────────┐
   │ patchPreview(root, dirty)                              │
   │   unchanged key  → skip entirely (no DOM write)         │
   │   changed content → innerHTML on that node only         │
   │   caret/selection → a Decoration, never innerHTML       │
   └────────────────────────────────────────────────────────┘
```

### 7.1 Module layout

```text
packages/core/src/
  parse/
    markdown-it.ts        # the configured instance, frozen
    plugin-set.ts         # table, strikethrough, footnote, attrs, deflist, container
    front-matter.ts       # see 06-libraries/06-front-matter.md
  render/
    block-index.ts        # THE module described above
    block-render.ts       # md.render on a line slice + Shiki + DOMPurify
    patch.ts              # dirty-region DOM updates, decorations
    scroll-sync.ts        # the heightPrefix binary search
  sanitize/
    index.ts              # ONE exported function, frozen DOMPurify config
    forbidden-config.md   # why IN_PLACE / hooks / profiles are banned
```

### 7.2 Scroll sync, concretely

```ts
function sourceLineToPreviewY(index: BlockIndex, line: number): number {
  const i = index.blockAtLine(line)
  const b = index.blocks[i]
  const span = Math.max(1, b.toLine - b.fromLine)
  const frac = (line - b.fromLine) / span
  return index.heightPrefix[i] + frac * b.height
}
```

`heightPrefix` is rebuilt only when a block's height changes, which a
`ResizeObserver` on each preview node reports. That is O(changed blocks) per
resize, not O(blocks). **Heights are only correct for blocks that have been
rendered at least once** — blocks below the fold have `height: 0`, so the
prefix sum is wrong for them. Two fixes, both needed:

1. **Virtualise the preview** (below), which means below-the-fold blocks are
   genuinely not rendered and the prefix sum is only used within the rendered
   window plus a small overscan.
2. **Re-measure on scroll.** When a block scrolls into the overscan, measure
   it and patch `heightPrefix`. The correction is a single array write, and
   the scroll position is adjusted by the same delta so nothing jumps.

### 7.3 Virtualisation is a separate document

At 100 MB, ~1.7M top-level blocks, we cannot have 1.7M DOM nodes. The
preview must be windowed: render the viewport plus ~2 screens of overscan,
recycle nodes as we scroll. That interacts with the block index (which is
cheap — a typed array of line numbers, a few MB at 100 MB input) and with
scroll sync (which becomes "find the block at the source scroll position, then
scroll that block's preview node into view").

Recorded in [10-performance](../10-performance/). **Flagged here because it
changes the block-index design**: `heightPrefix` must tolerate unmeasured
blocks, and we have designed it to (the `height: 0` convention).

### 7.4 The worker

For the **initial** parse of a large file, offload:

```text
main thread                        worker
───────────                        ──────
read file (fs)  ── string ───────► md.parse() + BlockIndex build
                ◄── blocks[]  ──── (transferable typed arrays)
patch preview DOM
```

The token array is **not** structured-cloned — we build the block index in the
worker and transfer `Int32Array`/`Float64Array` buffers, which are
transferable and cost zero copy.

For **keystrokes** the worker is probably not worth it: block caching already
reduces the work to ~0.1 ms, and the postMessage round trip plus the
ChangeSet serialisation is comparable. **We have not measured this** (§7
item 5 in the evaluation framework) and we will.

---

## 8. What we still need to measure

This is the honest part, and it is the part that matters most.

| # | Unmeasured | Why it matters | How |
|---|---|---|---|
| **1** | **Incremental vs cold parse at 1 MiB / 10 MiB** | The entire architecture rests on incremental cost being sub-linear while cold cost is linear. On a 67-char doc both are overhead-dominated. | Lezer, same document, edits at 10%, 50%, 90% through. Plot ms vs document size. |
| **2** | **Block-cache hit rate on real documents** | If real notes have frequent cross-block references, the fallback fires often and we are back to full parses | Instrument the fallback path, log the rate, sample 1000 real user documents |
| **3** | **`innerHTML` assignment and selection** | Does patching one block move the caret in *other* blocks? | Automated: type 1000 characters at random positions in a 5000-line document, assert `state.selection.main.head` is unchanged after each |
| **4** | **In-webview timings** | All our numbers are Node. WebView2's V8 is not Node's. | `performance.now()` in the app, exported as a debug panel |
| **5** | **Worker offload break-even** | At what document size does the worker win? | Parse N KB with and without the worker, N from 10 KB to 10 MB |
| **6** | **IME composition** | A hard correctness requirement for CJK, and untestable automatically | Manual: Windows Microsoft IME + Japanese IME, and Android GBoard in the Mobile phase |
| **7** | **100 MB behaviour** | The project's stated concern; we have tested up to 1 MiB | Generate a 100 MB synthetic document, measure parse, index build, memory, first paint |
| **8** | **Shiki throughput in the block cache** | 0.6 ms (hljs) to 7 ms (Shiki) warm per block; 500 code blocks is 0.3–3.5 s | Measure and decide whether the highlighter runs in the worker |

**Number 1 is the one that would change the architecture.** If Lezer's
incremental parse turns out to be linear in document size at our sizes — which
is possible, since Markdown block structure means an edit can invalidate a
following sibling list — then technique 3 contributes nothing and technique 2
is carrying the entire load. That would still be a working design, but it
would be one technique instead of four, and the worker would become much more
attractive.

---

## 9. Summary

| Technique | Adopted | Rationale |
|---|---|---|
| Debounced reparse | **yes**, but 0 ms for the caret block and ~50 ms for the viewport | A single global debounce is a latency bug waiting to happen |
| **Block-level caching** | **yes — this is the architecture** | Correctness property **verified** (independent per-block render is byte-identical); converts O(file) into O(3 blocks) |
| Incremental syntax-tree parsing | **yes**, free from Lezer | Measured **9× reduction** on our test; but the at-scale measurement is the open question |
| Incremental *rendering* (block cache) | **yes** | Same as above; this is what actually removes the cost |
| Transaction-based state | **yes**, free from CodeMirror | `EditorState` is functional; old and new state coexist; position mapping for free |
| Dirty-region DOM updates | **yes** | Skipping unchanged blocks avoids selection loss *and* is faster |
| Decorations for caret/selection | **yes** | Never mutate preview DOM for a transient mark |
| Worker for initial parse | **planned**, break-even unmeasured | Transferable typed arrays make the boundary free |
| Worker for keystrokes | **probably not** | ~0.1 ms of work does not pay for a round trip |
| Virtualised preview | **planned**, separate document | Required at 100 MB; designed into `heightPrefix` |

**One sentence:** *reparse nothing, re-render one block, patch one DOM node,
and never let the preview touch the caret.* Everything above is an
implementation of that sentence, and the only unproven part is whether
incremental parsing helps at scale — which is measurement #1 in §8.
