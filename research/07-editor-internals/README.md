# 07 — Editor internals

> How do we let someone **change** a Markdown file without it becoming a
> hostile place to type?

Three documents, in the order you should read them:

| Doc | Answers |
|-----|---------|
| [01-editor-engines.md](01-editor-engines.md) | CodeMirror 6 vs Monaco vs ProseMirror vs Tiptap vs Lexical vs raw `contenteditable`. Size, mobile, IME/CJK, accessibility, maturity — and which one fits a *viewer that also has an editing mode*. |
| [02-editing-models.md](02-editing-models.md) | The three editing models (raw source, live preview, WYSIWYG) and their UX trade-offs. Scroll sync, cursor mapping, tables, IME composition. **Which model we pick and why.** |
| [03-incremental-parsing.md](03-incremental-parsing.md) | How live preview avoids re-parsing the whole document on every keystroke. Block caching, Lezer's incremental parser, position mapping, dirty-region re-rendering. **A concrete architecture sketch.** |

Verified 2026-10-06. All versions from `registry.npmjs.org`; all bundle sizes
from the Bundlephobia API on the exact pinned version; star counts from the
repository pages on that date; **all timings ours**, Node v24.14.1 on Windows,
with Lezer driven through its real public API (`parser.parse`,
`TreeFragment.addTree`, `TreeFragment.applyChanges`) — the numbers in
[03](03-incremental-parsing.md) come from an instrumented run, not from
documentation.

---

## The short version

| Question | Answer | Where |
|---|---|---|
| Which editor engine? | **CodeMirror 6** — `@codemirror/state` 6.7.6 + `@codemirror/view` 6.43.13 + `@codemirror/lang-markdown` 6.5.2, with `@lezer/markdown` 1.7.2 for incremental parsing | [01](01-editor-engines.md) |
| Which editing model? | **(b) live preview** as the default, **(a) raw source** always available, **(c) WYSIWYG not shipped** | [02](02-editing-models.md) |
| How does live preview stay fast? | Block-level HTML cache keyed on source lines, invalidated per block; Lezer incremental parse for the syntax tree; dirty-region DOM updates only | [03](03-incremental-parsing.md) |

## The three facts that drive everything

**1. CodeMirror 6 and Monaco differ by 30× in code, and by more in
philosophy.** `@codemirror/state` + `@codemirror/view` is 105,800 B gzipped
(16,441 + 79,345, measured). `monaco-editor`'s shipped `min/vs` directory is
**24,583 KB of JavaScript across 137 files**, of which `editor.main.js` alone
is 2,735 KB. We could not find a credible published benchmark comparing their
keystroke latency; we measured what we could (see [01 §5](01-editor-engines.md#8-what-we-actually-measured))
and are explicit about the rest.

**2. CodeMirror's Markdown support comes with a real parser we can reuse.**
`@lezer/markdown` is a Lezer parser, and Lezer parsers are incremental *by
construction*: they take a list of reusable tree fragments and a position, and
reuse everything before that position. We verified the mechanism works and
measured it — cold parse 10–14 ms, incremental reparse **1.05–1.64 ms** on
the same document, a **~9× reduction**. That is not a micro-optimisation; it is
the difference between live preview being usable and being a slideshow. Full
detail and the caveats are in [03 §3](03-incremental-parsing.md#43-lezer-incremental-parsing-verified).

**3. The editing model choice is a UX decision, not a technical one.** All
three models are technically achievable today. Which one we ship determines
what the app *is*. [02](02-editing-models.md) argues for live preview on the
grounds that it is the only model that (a) preserves the file as the source
of truth, (b) degrades gracefully on syntax the model does not understand, and
(c) is the model users already know from Obsidian's legacy mode and VS Code's
preview.

---

## Ground rules for this folder

1. **No invented numbers.** If there is no benchmark, say so and describe the
   measurement we would run. We did this for Monaco, ProseMirror, Tiptap and
   Lexical — **there is no credible published cross-engine keystroke-latency
   benchmark**, and pretending otherwise would be the worst kind of
   overclaiming.
2. **Mobile is a stated project phase.** Any engine we pick must have a
   credible mobile story. This eliminates candidates faster than any other
   criterion and it is the reason Monaco scores 4.6/10.
3. **CJK and IME are first-class.** A viewer for Chinese notes must not drop
   composition events, must not reflow during composition, and must not
   mangle full-width punctuation. Most engines handle this; the ones that do
   not are disqualified, not merely penalised.
4. **Prefer the smaller, more modular engine for a desktop app.** A desktop
   app already has a native window, native menus, native file dialogs and
   native shortcuts. Importing an entire IDE's rendering engine to gain
   features we do not need is a poor trade, and we should say so plainly
   rather than reaching for the most famous option.
