# 02 — Editing models

Three models. All three are technically achievable today with the stack we
have chosen. This document argues for one of them.

Verified 2026-10-06. Competitor claims are from public documentation and are
marked as claims; the measurements are ours.

---

## 0. The three models

| | **(a) Raw source** | **(b) Live preview** | **(c) WYSIWYG** |
|---|---|---|---|
| What the user sees | syntax-highlighted source | source + rendered, side by side or stacked | rendered only; source is generated |
| What is stored | the text | the text | the text, regenerated on every edit |
| Source of truth | the source | **the source** | **the document model** |
| Typora | source mode only | source mode only | **default** |
| MarkText | yes | yes | **default** |
| Obsidian | yes | yes (legacy source-and-preview) | yes (Live Preview, default) |
| VS Code | yes | yes (side-by-side extension) | no |
| Zed | yes | no | yes (as of 2025's markdown support) |
| Notion | no | no | yes |
| **Our complexity** | low | **medium** | high |

---

## 1. Model (a): raw source editing

### What it is

A syntax-highlighted code editor over the file. One pane. What you type is
what you see, with colours.

```ts
import { EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'

new EditorView({
  parent: document.body,
  doc: fileContents,
  extensions: [markdown()]
})
```

### Pros

- **Zero ambiguity.** The buffer is the file. No round trip, no
  normalisation, no "why did my list get renumbered".
- **Byte-exact round trip.** Open, close, save: nothing changed. This is the
  property every serious Markdown tool needs and the one WYSIWYG gives up
  first.
- **Everything else works for free**: search, replace, multi-cursor, undo
  history, code folding, find-in-file, all the keyboard shortcuts users
  already have in their fingers.
- **No preview at all is a legitimate product.** Some people *want* the
  source. VS Code's Markdown users are a large group.
- **Cheapest to build.** No preview pane, no sync, no position mapping.

### Cons

- **Tables are miserable.** A 6-column table is 7 lines of `|` and `-`
  alignment you have to count characters to get right. This is the single
  strongest argument against source-only.
- **Typing markup is a tax.** Every bold word costs four keystrokes. Every
  heading is `#`. Every link is `[text](url)`.
- **No confidence that the document renders as intended.** The user is asking
  the tool to trust their memory of the syntax.
- **Front matter is raw YAML text**, which is fine for the first minute and a
  configuration file afterwards.

### Implementation difficulty: **low**

Days, not weeks. `markdown()` from `@codemirror/lang-markdown` gives you
headings, emphasis, links, lists, tables, fences and code-block-aware
behaviour. The maintainer is actively fixing lazy continuation and
blockquoted continuation, which are the two cases that would otherwise be
painful.

**We ship this unconditionally.** It is the fallback when live preview
fails, the escape hatch when the preview is wrong, and the mode that users
drop into when they are typing a table.

---

## 2. Model (b): live preview

### What it is

Source on the left, rendered on the right. Type in the source; the render
updates. Both panes scroll in sync. Optionally the rendered half is
interactively editable for the simple cases.

This is Obsidian's "Source and Preview" mode, VS Code's side-by-side Markdown
preview, and the model this project is named after.

### The four genuinely hard problems

**Problem 1 — scroll sync.** The two panes have different heights because
`<pre>` wraps differently from source lines, because a table is 7 source
lines and 1 rendered element, because a footnote definition at the bottom
becomes a reference at the top. Any naive `scrollTop * ratio` mapping drifts
within a screen and is unusable after a table.

**The fix is a position index, and we already have the data.** From
[03-incremental-parsing.md](03-incremental-parsing.md):

```text
source line 8-12  →  <pre><code class="language-js">   (rendered height 84px)
source line 4-8   →  <table>                            (rendered height 132px)
```

We build, per top-level block, `{ sourceFrom, sourceTo, renderedHeight }`.
Scrolling is then a binary search over a monotone array, not a ratio. Where a
source line falls *inside* a block, we interpolate within that block's
rendered range. Blocks that are one source line mapping to many rendered
lines are the entire problem, and indexing by block solves it.

**Problem 2 — cursor-to-source mapping, and its inverse.** Clicking a word in
the preview should put the caret in the source; selecting source text should
highlight the preview. This needs the same block index plus, inside a block,
a character-level mapping. markdown-it gives us `token.map` at *block* level
(line ranges) — **not** character level. Inside a block we fall back to a
proportional estimate, which is what every live-preview implementation does
and which users stop noticing. We should measure how wrong it is before
investing in better.

**Problem 3 — typing in tables and code blocks.** Tab in a table should move
to the next cell. Tab in a fence should insert two spaces. Enter at the end
of a list item should continue it. CodeMirror's `markdown()` extension has
`insertNewlineContinueMarkup` and its changelog shows repeated 2026 fixes for
exactly the hard cases: 6.5.2 "delete pieces of **lazily continued
paragraphs**", 6.5.1 "over-eagerly deleted content in **continued paragraphs
under blockquotes**", 6.3.2 "return false **inside fenced code**" and "Fix an
**infinite loop**". Adopting it means inheriting a maintainer who is actively
on this problem.

**Problem 4 — IME composition breaking live rendering.** This is the one
that gets missed and it is the one that makes a CJK user delete the app.

The failure mode: the user is composing a character. The IME holds
`compositionstart` … repeated `compositionupdate` … `compositionend`. If the
preview re-renders on every `input`, the rendered pane mutates *while the
composition candidate window is open*. Depending on platform the caret can
jump, the candidate window can be dismissed, or the composition can be
committed at the wrong offset. Microsoft IME on Windows, Google Japanese IME
on Windows, and Pinyin/Google on Android all behave differently.

**The rule is non-negotiable: do not re-render on any input where
`event.isComposing` is true.** CodeMirror's own guide notes that state is
deterministic "with a few exceptions (like composition and drag-drop
handling)", which tells us composition is handled outside the transaction
model — the right place. Concretely:

```ts
EditorView.updateListener.of((update) => {
  if (update.docChanged && !update.transactions.some(t => t.annotation(composing))) {
    schedulePreviewRebuild(update.state)
  }
})
// and on 'compositionend', rebuild once.
```

**Problem 5 (bonus) — debouncing.** Even without composition, re-rendering on
every keystroke is wrong. See [03 §6](03-incremental-parsing.md#6-debouncing-and-the-when-to-flush-rule).

### Pros

- **The source stays the source.** Byte-exact round trip. If the preview is
  wrong, nothing is lost.
- **Degrades gracefully.** Unknown syntax renders as text. A construct we do
  not support shows up as literal text in the preview *and is still correct in
  the file*. Nothing is destroyed.
- **Zero migration risk.** Open any file, edit any byte.
- **Tables**: still painful, but the preview shows you the result, which
  turns a memory task into a feedback task.
- **Everything from (a) still works**, because (a) is always one keystroke
  away.

### Cons

- **Two panes on a small screen.** On a 1280×800 laptop, half is gone.
  On mobile it is untenable without a mode switch.
- **Scroll sync is a real engineering project**, not a `onscroll` handler.
- **Preview latency is visible** if the architecture is wrong — this is what
  [03](03-incremental-parsing.md) exists to prevent.
- **Two views of the same thing** can disagree, and when they do the user
  cannot tell which one is lying.

### Implementation difficulty: **medium-high**

The scroll index is the bulk of it. Everything else is CodeMirror
configuration plus the renderer in [03](03-incremental-parsing.md).

---

## 3. Model (c): WYSIWYG

### What it is

The user sees only rendered output. Typing `# ` at the start of a line turns
that line into a heading. Typing `**` makes the next two characters bold.
The source is regenerated from the document model and is a *derived artifact*.

Typora made this its whole identity and it is genuinely impressive to use.
MarkText does the same. Obsidian's Live Preview is a partial, very clever
hybrid that hides most markers but keeps the block you are editing as source.

### Why it is hard — the round-trip problem

The hard part is not the rendering. It is that **the source must stay valid
Markdown through every intermediate state**, and users type invalid Markdown
constantly.

Typing `# Heading` one character at a time:

| Keystroke | Buffer | Is it valid Markdown? | What does the user see? |
|---|---|---|---|
| `#` | `#` | yes — empty h1 | an empty heading |
| `# ` | `# ` | yes — empty h1 | an empty heading, still |
| `# H` | `# H` | yes | "H" as a heading |
| — user then presses Backspace 3 times | | | |
| `` (empty) | `` | **valid, but now a paragraph** | the heading collapses to a paragraph mid-keystroke |

The classic failure: **a document model must represent every intermediate
state, and most intermediate states are not what the user meant.** Obsidian's
Live Preview solves this with a specific trick: **the block being edited stays
as raw source; the blocks around it are rendered.** One block is always in
"source mode". That is a much better design than pretending the whole document
is rich, and it is the pattern to copy if we ever want (c).

Other problems:

1. **The caret must be placeable in rendered output.** Clicking in the middle
   of a bold run must land between two `<strong>` text nodes. ProseMirror
   solves this with a schema and a position model. Solving it without a
   schema means intercepting every click and every arrow key and mapping DOM
   offsets to text offsets — which is a lossy, bug-prone mapping.
2. **IME composition in rich text is harder**, not easier, because
   composition can span markup boundaries.
3. **Whitespace and entity normalisation.** Typing two spaces at the end of a
   line: does the model keep them? Markdown says that's a hard break.
   Round-tripping it changes the file.
4. **Focus loss on every model change.** If typing `*` converts a paragraph
   into a list, the DOM subtree the caret lived in is destroyed. The caret
   must be restored, and getting it exactly right across every model
   transition is where these editors lose users.
5. **Paste.** Pasting Markdown *into* a WYSIWYG editor must decide whether
   the pasted text is literal text or Markdown to be parsed. Every product
   has got this wrong in a different way.

### Pros

- **The lowest barrier to entry.** A user who does not know Markdown can
  write a document. For a "viewer" aimed at note-takers rather than
  developers, this is a genuine and large advantage.
- **No syntax to remember.**
- **Tables are real tables**, with alignment handled for you.
- **Nothing to break.** You cannot write invalid Markdown in a WYSIWYG editor.

### Cons

- **Round-trip damage.** Open a Typora-edited file in something else and the
  formatting has moved. This is a real, ongoing source of user pain.
- **Not a viewer.** You cannot *see* the source. For a product whose premise
  is "a Markdown viewer", that is disqualifying.
- **Cannot open arbitrary files safely.** A file with syntax we do not
  implement has to be shown as source. So the WYSIWYG model is a
  **transformer**, not a viewer — and it needs a *separate* viewer path. That
  is two products.
- **Data loss risk.** Any model bug destroys user content.
- **Schema maintenance forever.** Every Markdown construct is a node type.

### Implementation difficulty: **high**

ProseMirror or Tiptap, a schema for every construct, plus an editor that
falls back to source mode for unknown constructs. Per
[01-editor-engines.md](01-editor-engines.md#32-why-it-is-the-wrong-model-for-us-and-this-is-the-crux),
that is a second editor engine, because our chosen engine (CodeMirror) cannot
host it.

---

## 4. The comparison that decides it

| | **(a) Raw** | **(b) Live preview** | **(c) WYSIWYG** |
|---|---|---|---|
| Byte-exact round trip | **yes** | **yes** | **no, without care** |
| Opens arbitrary user files correctly | **yes** | **yes** | **partially** — unknown syntax needs a fallback |
| Degrades safely on unknown syntax | **yes** (it *is* the syntax) | **yes** (literal text in preview, correct in file) | **no** — either reject or corrupt |
| Markdown literacy required | **yes** | optional | **no** |
| Tables | painful | painful + visible | **easy** |
| Scroll-sync work | none | **the main project** | none |
| Second engine required | no | no | **yes** |
| Failure mode is data loss | no | no (preview-only bugs) | **yes** |
| Fits the product name ("Viewer") | yes | yes | **no** |
| Implementation cost | days | weeks | months |
| Maintenance cost | low | medium | **high** (schema forever) |

### What the competitors chose, and why that is not decisive

**Typora chose (c)** and made it a commercial success with a free tier. Its
audience is people who write documents, not people who maintain Markdown in
git. That is a real market and Typora serves it well.

**MarkText chose (c)**, open source, and has 62,150 GitHub stars. Its GitHub
activity has slowed substantially, which is a data point about the
*sustainability* of maintaining a schema for a moving language.

**Obsidian chose (b) with (c)'s trick layered on top** — Live Preview, where
the current block shows source and the rest renders. This is the most
sophisticated answer in production and it is roughly two years of work by a
large team. It is also, notably, **optional**: Obsidian's users can switch it
off entirely and use (a) or (b).

**The pattern across all three: every successful product ships at least two
models, and the source is always reachable.** That is the lesson. The
question is not "which model" but "which models, and which is default".

---

## 5. Recommendation

**Ship (b) live preview as the default editing mode. Ship (a) raw source
always, as the toggle and as the fallback. Do not ship (c).**

```text
Reading mode            : rendered, full width
Editing mode            : live preview, source left, rendered right
    Tab / Escape        : toggle to source-only (a)
Rendering failure       : automatically drop to source-only, visibly, with a message
Unknown / broken syntax: preview shows it literally; file is untouched
```

**Why (b) and not (c):**

1. **We are a viewer first.** The product opens files the user did not write.
   A WYSIWYG editor cannot render an arbitrary file; it can only render files
   its schema understands. Every unknown construct becomes either a
   corruption or a fallback. **A viewer must have a fallback for 100% of
   inputs, which means the raw path is mandatory anyway** — and once it
   exists, (c) is a large cost for a moderate gain.
2. **The file is the user's data.** (b) never rewrites a byte the user did
   not change. (c) does, and every bug in (c) is data loss.
3. **One engine.** (c) means ProseMirror or Tiptap *in addition to*
   CodeMirror, because CodeMirror cannot host a schema — a fact we established
   in [01](01-editor-engines.md#32-why-it-is-the-wrong-model-for-us-and-this-is-the-crux).
   Two editor engines is one too many for a first release.
4. **(b) teaches Markdown.** A user in live preview sees the rendered output
   *and* the markup that produced it, side by side, updating together. That
   is a teaching surface, and it is worth something for a product aimed at
   people who are learning to write Markdown.
5. **Cost.** (c) is months and a permanent schema-maintenance burden. (b) is
   weeks, and the hard part — incremental rendering — is
   [03-incremental-parsing.md](03-incremental-parsing.md), which we have to
   build for the *viewer* anyway (a 100 MB file must render progressively).

**The honest cost of this decision.** A user who does not know Markdown at
all will find (b) harder than (c). We accept that, and we mitigate it: (a) is
one keystroke away, the preview makes the result of markup visible
immediately, and a future inline-format toolbar (Ctrl+B wrapping the
selection in `**`) gives 80% of (c)'s benefit for 5% of its cost — **because
a toolbar action is a text transformation, not a model change.** That is the
right place to spend effort.

**We will revisit (c) if and only if** research shows a large
non-technical-writing audience, and even then the correct version is
Obsidian's: *one block at a time*, source for the block you are in.

---

## 6. Design notes that fall out of this decision

### 6.1 Layout

| Width | Layout |
|---|---|
| ≥ 1280 px | side by side, 50/50, divider draggable |
| 768–1279 px | stacked, source on top, preview below, single scroll (sync by section, not by pixel) |
| < 768 px | one pane at a time, with an explicit mode switch. **Never both.** Mobile is a stated phase and two panes on a phone is a non-starter. |

The draggable divider is not a detail. Users who write long documents in a
wide editor and read short lines in a wide reader want to set it once.

### 6.2 The "rendering failed" path

This must exist and must be **visible, not silent**. If the renderer throws,
or a block's HTML is rejected, or a highlight times out:

1. Stop updating that region.
2. Show a small, non-blocking marker at the block's location: "could not
   render this block", with the reason in a tooltip.
3. **Leave the source untouched.**
4. Offer a one-click "open in source view at line N".

Silently falling back to source-only loses the user's place, which is the
thing they were editing. A marker preserves it.

### 6.3 What "interactive preview" we *do* want

Small, high-value, text-only, and impossible to lose data:

| Interaction | Implementation | Risk |
|---|---|---|
| Click a rendered link → caret in source at the link | block index + proportional offset | none — no text changes |
| Ctrl/Cmd-click a rendered link → open externally | the href, through `sanitize-url` | none |
| Click a rendered heading → scroll source to it | block index, exact | none |
| Click a footnote marker → jump to its definition | block index, exact | none |
| Click a rendered image → open it | path resolution through the FS layer | path traversal — must be sandboxed |
| Hover a heading → show its anchor link | `markdown-it-anchor` slug | none |
| **Ctrl+B / Ctrl+I** on a selection | **wrap the selection in `**` / `_`** | **low** — a pure text transform, reversible, and if the selection is mid-word we widen it deliberately |
| Tab in a table | handled by `@codemirror/lang-markdown`'s markup continuation | low |

**Everything on that list is a text transformation or a navigation.** Nothing
is a document-model change. That is the test we apply before adding any
interactive-preview feature: *does this ever rewrite text the user did not
type?* If yes, it is out of scope for v1.

### 6.4 Save semantics

- **Never rewrite the file on open.** Read, parse for preview, cache. No
  write.
- **Never rewrite the file on close** unless the buffer is dirty.
- **Save writes the buffer, verbatim.** No normalisation, no trailing-newline
  fixing, no CRLF conversion, no encoding sniffing that rewrites. The bytes
  the user produced are the bytes on disk. **If we ever want to normalise, it
  is an explicit user-initiated action with a diff preview.**
- Encoding: detect UTF-8/UTF-8-BOM/UTF-16 on open, **preserve on save**. A
  UTF-16 file stays UTF-16. Silently transcoding a user's file is the kind of
  thing that loses emoji.
