# `research/01-foundations/` — What Markdown is, and why

> The ground floor. If you have never read the CommonMark spec, start here.
> Everything downstream — the syntax reference, the parser, the renderer — assumes
> the vocabulary these four documents establish.

| Doc | Question it answers |
|-----|---------------------|
| [`01-what-is-markdown.md`](01-what-is-markdown.md) | What is Markdown, from first principles? Why does a plain-text markup format exist at all? What does it cost to store the same document as Markdown, as HTML, and as a rich-text editor's internal AST? |
| [`02-history-and-evolution.md`](02-history-and-evolution.md) | How did we get here, 2004–2026? Gruber, Markdown.pl, Markdown Extra, the CommonMark project, GFM. Why did the community fragment, and why did it partially re-converge? |
| [`03-core-principles.md`](03-core-principles.md) | Which design principles survive every dialect? And the deepest single question in Markdown: **why does emphasis need delimiter-run rules at all?** |
| [`04-the-viewer-problem.md`](04-the-viewer-problem.md) | What does a *viewer* need that a renderer library does not give you? The 23 obligations that fall on the application, of which only two are the parser's job. |

## The shortest possible answer

Markdown is a plain-text format for writing structured documents, based on
conventions for indicating formatting in email and usenet posts. Its design goal
is that the source stays readable and writable as plain text.

That goal is the whole point, and it is worth restating because everything in
this repository follows from it:

- The stored bytes are characters. No binary framing, no style table, no
  serializer version. There is no magic number.
- It is a **format**, not a language. A format has a storage grammar; a language
  has semantics and a runtime.
- It is **derived, not invented** — a re-derivation of conventions people
  already used when plain text was the only transport.

## Why plain text wins for storage

Documented with measurements in
[`01-what-is-markdown.md` §6](01-what-is-markdown.md):

| Representation | Size for one document | Diff on a one-word edit | Tool-portability |
|---|---|---|---|
| Markdown | 194 B | One line | Total |
| Rendered HTML | 332 B | One line | Total |
| Editor AST, minified | 943 B | **Whole file** — no line structure | Tied to the editor |

Plain text is greppable, diffable, version-controllable, and readable with no
software at all. Those four properties are why the format survived twenty years
of rich-text editors, and why every tool that tried to replace Markdown as the
*storage* format eventually became worse at it.

## The trap worth knowing before you read further

**Markdown is two things: a syntax, and a program that converts it to HTML.**
Conflating them causes bugs directly. A document is not "CommonMark" — it is
*parsed as* CommonMark by a particular implementation. When two tools disagree,
the question is always *which parser*, never *which Markdown*.

That split is precisely what caused the twenty-year divergence documented in
[`02-history-and-evolution.md`](02-history-and-evolution.md), and it is why we
must state our parser and our declared extension set explicitly
([`ADR-0004`](../../docs/adr/0004-markdown-parser-strategy.md)) rather than
claiming to support "Markdown".

## Confidence tags

These documents use the tags defined in
[`00-method/README.md` §3](../00-method/README.md):

| Tag | Meaning |
|-----|---------|
| `[VERIFIED]` | Primary source read and quoted |
| `[INFERRED]` | Reasoned from verified premises; the argument is stated |
| `[UNVERIFIED]` | Flagged as uncertain, not relied upon |

Experiments run for these documents were performed on **Node 24.14.1, win32-x64,
2026-10-06**, and the results are labelled as measurements rather than
estimates. Method and its known weaknesses:
[`00-method/README.md`](../00-method/README.md).

## Where to go next

- **I want to write a parser** → [`02-syntax/`](../02-syntax/), then
  [`04-parsing-internals/`](../04-parsing-internals/)
- **I want to know what "correct" means** →
  [`03-specifications/`](../03-specifications/)
- **I want to build the application** → [`04-the-viewer-problem.md`](04-the-viewer-problem.md)
- **I want to know why emphasis is hard** →
  [`03-core-principles.md` §5](03-core-principles.md)
