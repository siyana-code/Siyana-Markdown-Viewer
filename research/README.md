# Research

> Everything here is **why we believe what we believe**.
> `docs/` is what we *decided*; `research/` is what we *learned* to decide it.

This folder is the deep study of Markdown and of everything needed to build a
Markdown viewer. It starts at the ground level (what a `#` character actually
means) and climbs to production concerns (sandboxing, incremental parsing,
code-signing, spec-conformance test suites).

## How to read this

Read in numbered order if you are new. Jump around if you are here for one
specific question.

| # | Folder | What it answers |
|---|--------|-----------------|
| 00 | [method](00-method/) | How was this research done? What is verified vs inferred? |
| 01 | [foundations](01-foundations/) | What is Markdown, who made it, why does it exist? |
| 02 | [syntax](02-syntax/) | Every construct, from `# Heading` to footnotes, with examples |
| 03 | [specifications](03-specifications/) | CommonMark vs GFM vs extensions vs dialects. Where is the line? |
| 04 | [parsing-internals](04-parsing-internals/) | How parsers actually work: blocks, inlines, precedence, algorithms |
| 05 | [rendering](05-rendering/) | AST to HTML, sanitization, theming, print/PDF |
| 06 | [libraries](06-libraries/) | Every serious parser, compared. What should we use? |
| 07 | [editor-internals](07-editor-internals/) | CodeMirror vs Monaco, WYSIWYG vs live-preview, incremental parsing |
| 08 | [desktop-frameworks](08-desktop-frameworks/) | Electron vs Tauri vs Flutter vs Wails vs native |
| 09 | [platform](09-platform/) | Windows and Linux reality: WebViews, packaging, signing, paths, IME |
| 10 | [performance](10-performance/) | 100 MB files, virtual scrolling, worker threads, memory |
| 11 | [security](11-security/) | XSS in a viewer is RCE-adjacent. Treat untrusted files as hostile. |
| 12 | [ux](12-ux/) | Reading comfort, typography, themes, keyboard-first navigation |
| 13 | [competitors](13-competitors/) | What Obsidian, Typora, MarkText, Logseq, mdBook, Dillinger got right/wrong |
| 14 | [architecture-options](14-architecture-options/) | Monorepo shape, shared core, file watching, sync |
| 15 | [open-questions](15-open-questions/) | What we still do not know. Tracked, not hidden. |

## The three questions this project lives on

1. **How do we parse?** → [04 parsing-internals](04-parsing-internals/),
   [06 libraries](06-libraries/)
2. **How do we keep it safe?** → [11 security](11-security/),
   [05 rendering](05-rendering/)
3. **What runs the window?** → [08 desktop-frameworks](08-desktop-frameworks/),
   [09 platform](09-platform/)

## Ground rules for content in this folder

- Cite a primary source (spec text, official docs, source file, or RFC) whenever
  one exists. Mark inference as inference.
- Include runnable examples. A syntax table without rendered output is not
  research, it is a list.
- Prefer versioned facts ("as of Tauri 2.11") over timeless ones.
- Record what is **unknown** in [15-open-questions](15-open-questions/) rather
  than guessing silently.
- No vendor marketing copy. If a claim comes from a project's own README, say
  so.