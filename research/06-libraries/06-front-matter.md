# 06 — Front matter

Front matter is the block of structured metadata at the top of a Markdown
file. It is not part of CommonMark, not part of GFM, and has **no
specification** — every tool invented its own dialect, and several of them
are incompatible with each other in ways that produce *silent data loss*.

This document covers: what the dialects actually are (verified against
primary sources), the detection heuristics including the `---` collision with
setext headings and thematic breaks, and what a viewer should *do* with the
result.

Verified 2026-10-06. Library versions from `registry.npmjs.org`. Dialect
details quoted from Jekyll's, Hugo's and Pandoc's own documentation, fetched
from their repositories on the day.

---

## 1. The dialects

### 1.1 Jekyll — `---` YAML, must be valid YAML

From `jekyll/jekyll` `docs/_docs/front-matter.md`:

> Any file that contains a YAML front matter block will be processed by Jekyll
> as a special file. **The front matter must be the first thing in the file**
> and must take the form of **valid YAML** set between triple-dashed lines.

```yaml
---
layout: post
title: Blogging Like a Hacker
---
```

Two details in that documentation are load-bearing:

> If you want to use Liquid tags and variables but don't need anything in your
> front matter, just leave it empty! **The set of triple-dashed lines with
> nothing in between will still get Jekyll to process your file.**

So `---\n---\n` is valid front matter. A viewer that requires at least one key
will disagree with Jekyll on empty front matter.

> If you use UTF-8 encoding, make sure that no **BOM** header characters exist
> in your files or **very, very bad things** will happen to Jekyll.

A UTF-8 BOM before `---` breaks detection in Jekyll. **We must strip the BOM
before sniffing.** That is a real, shipped bug in a major tool.

Jekyll's own docs are themselves front matter, which is a nice sanity check:
`layout: post`, `permalink:`, `redirect_from:` — and its Markdown body uses
`{{ ... Liquid }}` templating, which we render as literal text (correctly: we
are not a template engine, per
[03-other-ecosystems §7](03-other-ecosystems.md#7-cross-ecosystem-dialect-matrix)).

### 1.2 Hugo — format determined by the **delimiter**, not the extension

From `gohugoio/hugo` `docs/content/en/content-management/front-matter.md`:

> Provide front matter using a serialization format, one of JSON, TOML, or
> YAML. **Hugo determines the front matter format by examining the delimiters
> that separate the front matter from the page content.**

| Format | Delimiters |
|---|---|
| YAML | `---` … `---` |
| TOML | `+++` … `+++` |
| JSON | `{` … `}` |

That is the whole detection algorithm, and it is elegant: **the opening
delimiter determines the format.** We should do the same. Hugo also notes:

> Front matter fields may be boolean, integer, float, string, arrays, or maps.
> Note that the TOML format also supports **unquoted date/time values**.

Which is a YAML-vs-TOML trap: TOML's `2024-02-02T04:14:54-08:00` is a native
datetime, while YAML would quote it to get a string. `smol-toml` returns a
`Date` object; `js-yaml` with the default schema returns a `Date` for
unquoted ISO timestamps. **Our UI has to handle both.**

### 1.3 Pandoc — three different things called "metadata"

Pandoc has three *separate extensions*, and this is where people get confused:

**(a) `pandoc_title_block`** — a percent-prefixed block, must be the very
first thing:

```text
% title
% author(s) (separated by semicolons)
% date
```

> If the file begins with a title block […] it will be parsed as
> bibliographic information, **not regular text.**

Note "may contain just a title, a date and an author, or all three elements",
and:

> In HTML output, titles will appear twice: once in the document head […] and
> once at the beginning of the document body. The title in the body appears as
> an H1 element with **class "title"**.

**(b) `yaml_metadata_block`**:

> A YAML metadata block is a valid YAML object, delimited by a line of three
> hyphens (`---`) at the top and a line of three hyphens (`---`) **or three
> dots (`...`)** at the bottom. **The initial line `---` must not be followed
> by a blank line.** A YAML metadata block **may occur anywhere in the
> document**, but if it is not at the beginning, it must be preceded by a
> blank line.

Two things a viewer must handle that Jekyll does not mention: **`...` as a
valid closing delimiter**, and **front matter not at the top of the file**.
Plus: *"(Note that JSON may be used as well, because JSON is a subset of
YAML.)"*

**(c) `mmd_title_block`** — MultiMarkdown style:

```yaml
Title:   My title
Author:  John Doe
Date:    September 1, 2008
Comment: This is a sample mmd title block, with
         a field spanning multiple lines.
```

> If `pandoc_title_block` or `yaml_metadata_block` is enabled, it will take
> precedence over `mmd_title_block`.

**And a fourth that is definitely metadata but not front matter:**
Pandoc's `abbreviations` extension parses PHP Markdown Extra abbreviation
keys (`*[HTML]: Hypertext Markup Language`) — a block-level construct that is
*not* at the top of the file and is *not* front matter. A viewer must not
swallow it.

### 1.4 Obsidian

Obsidian's front matter is YAML in `---` fences, and its documentation is not
publicly normative in the way Jekyll's is. What we can state from the
ecosystem: Obsidian uses `---` YAML, adds `tags` and `aliases` conventions
widely used by plugins, and — critically — **uses `[[wikilinks]]` and
`> [!callout]` inside the body**, which we handle as extensions, not as
metadata. We treat Obsidian files as "Jekyll YAML + our `attrs`/`container`
plugins".

### 1.5 Summary table

| Dialect | Open | Close | Position | Format |
|---|---|---|---|---|
| Jekyll | `---` | `---` | must be first | **must be valid YAML** (may be empty) |
| Hugo YAML | `---` | `---` | top | YAML |
| Hugo TOML | `+++` | `+++` | top | TOML, native datetimes |
| Hugo JSON | `{` | `}` | top | JSON |
| Pandoc `yaml_metadata_block` | `---` | `---` **or `...`** | **anywhere**, blank line before if not first | YAML (JSON is a subset) |
| Pandoc `pandoc_title_block` | `% ` | — | must be first | `key: value` lines |
| Pandoc `mmd_title_block` | `Key:` | — | top, lowest precedence | `Key: value` |
| Obsidian | `---` | `---` | top | YAML |

**No two of these agree completely.** Our detector has to be permissive in
what it *accepts* and explicit about what it *reports*.

---

## 2. The libraries

| Library | Version | Published | Licence | Size (min/gzip) | Types | Notes |
|---|---|---|---|---|---|---|
| `yaml` (eemeli) | **2.9.1** | 2026-09-11 | **ISC** | 103,179 / 31,325 B | first-party | **CST with error positions.** `parseDocument()` gives you `doc.errors` with line/column. |
| `js-yaml` | **5.4.3** | 2026-10-05 | MIT | — | first-party | Supports **YAML 1.2 and 1.1**, "passes the entire YAML Test Suite". Ships legacy tags `v4-legacy` (4.3.2), `v3-legacy` (3.15.2). 1.26 **billion** monthly downloads. |
| `smol-toml` | **1.9.0** | 2026-09-22 | BSD-3-Clause | **15,042 / 5,633 B** | first-party | Modern, TS-native, zero deps. **Preferred.** |
| `@iarna/toml` | 2.2.5 | **2020-04-22** | ISC | 99 KB unpacked | **none** | Six years without a release. Use `smol-toml` instead. |
| `gray-matter` | 4.0.3 | 2021-04-24 | MIT | 6,770 / 2,587 B | first-party | Splitter only — never validates the body. 41.5M monthly dl; last repo commit 2025-06-14. |
| `remark-frontmatter` | 5.0.0 | 2023-09-18 | MIT | 20,789 / 8,443 B | first-party | unified plugin. ESM only. |
| `mdast-util-frontmatter` | 2.0.1 | 2023-09-14 | MIT | — | first-party | Front-matter nodes in an mdast tree. |
| `micromark-extension-frontmatter` | 2.0.0 | 2023-06-27 | MIT | — | first-party | `frontmatter()` + `frontmatterHtml()`; YAML (`---`) and TOML (`+++`). |

### 2.1 Verified API shapes

**`yaml` (eemeli) — the one we want, for its error positions:**

```js
import { parseDocument } from 'yaml'

const doc = parseDocument('title: A\nn: 1\nbad: [unclosed')
// doc.errors.length          -> 1
// doc.toJS()                 -> { title: 'A', n: 1, bad: [ 'unclosed' ] }
doc.errors[0].linePos        // { line, col } — we can underline it in the editor
```

Note what it does with malformed input: it **still returns the content**. That
is the right behaviour for a viewer — show the user what they wrote, with an
error marker, rather than refusing to open the file.

**`js-yaml` — the simple path:**

```js
import { load, dump } from 'js-yaml'

load('a: 1\nb: [x, y]')    // { a: 1, b: [ 'x', 'y' ] }
dump({ greeting: 'hello' }) // 'greeting: hello\n'
```

**`smol-toml` — note the null-prototype objects:**

```js
import { parse as tomlParse } from 'smol-toml'

tomlParse('title = "T"\n[owner]\nname = "x"\n')
// [Object: null prototype] {
//   title: 'T',
//   owner: [Object: null prototype] { name: 'x' }
// }
```

**`[Object: null prototype]` matters.** TOML parsers return null-prototype
objects to avoid prototype-pollution attacks. `obj.hasOwnProperty('title')`
throws. We must use `Object.hasOwn` / `Object.entries`. This is a small thing
that will bite us in an `in`-loop and is worth writing down.

**`gray-matter` — a splitter, not a validator:**

```js
import matter from 'gray-matter'

const fm = matter(`---\ntitle: Hello "World"\ntags: [a, b, c]\ndate: 2026-01-02\nnested:\n  x: 1\n---\n\n# Body`)

// Object.keys(fm.data) -> [ 'title', 'tags', 'date', 'nested' ]
// fm.data              -> { title: 'Hello "World"', tags: [ 'a','b','c' ],
//                          date: 2026-01-02T00:00:00.000Z,  // <- a Date!
//                          nested: { x: 1 } }
// fm.content            -> '\n# Body'
```

Two observations from that run. `date:` became a **JavaScript `Date`**, which
means it will be serialised into JSON as an ISO string with a timezone we
inferred. And `gray-matter` **handed us the parsed data without complaining**,
because it uses js-yaml's non-throwing mode. If the YAML were malformed, it
would give us `{}` and a note in `fm.content` or nowhere at all. **That is
unacceptable for an editor** — the user needs to know their front matter is
broken, and where.

**`remark-frontmatter` — for the unified path:**

```js
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'

const p = unified().use(remarkParse).use(remarkFrontmatter, ['yaml', 'toml'])
p.parse('---\ntitle: Hello "World"\n---\n\n# Body').children
// [ { type: 'yaml', value: 'title: Hello "World"' }, { type: 'heading' } ]
```

We are not adopting the unified pipeline (see
[01-js-parsers §3.5](01-js-parsers.md#35-the-performance-problem-measured)),
so this is here for completeness.

---

## 3. Detection heuristics

This is the part that has to be right, because getting it wrong means either
losing user data or rendering garbage.

### 3.1 The `---` collision

`---` is three different things in CommonMark:

1. **A thematic break** (`hr`) anywhere in a document.
2. **A setext heading underline** for the line above it (`Title\n---` → `<h2>`).
3. **Front matter**, if it is the *first* thing in the file and there is a
   matching closing delimiter.

We verified the collision by rendering each case through markdown-it's
`commonmark` preset:

| Input | markdown-it output | What it is |
|---|---|---|
| `Text\n---\nmore` | `<h2>Text</h2>\n<p>more</p>` | **setext heading** |
| `---\n---\n` | `<hr />\n<hr />` | two thematic breaks |
| `a\n=\n` | `<h1>a</h1>` | setext h1 |
| `+++\ntitle = "x"\n+++\nbody` | `<p>+++\ntitle = &quot;x&quot;\n+++\nbody</p>` | a paragraph (no TOML support by default) |
| `;;;\n{"a":1}\n;;;\nbody` | `<p>;;;\n{&quot;a&quot;:1}\n;;;\nbody</p>` | a paragraph |
| `Title\n#####\n` | `<p>Title</p>\n<h5></h5>` | paragraph + empty heading |

**So a document that opens with `---` and closes with `---` is ambiguous
between "front matter" and "two thematic breaks with content in between".**
Resolution: front matter wins, and only when the delimited body **parses as
valid YAML/TOML/JSON**. If the body does not parse, it is not front matter and
we render the `---` lines as thematic breaks. This is Jekyll's rule
("must take the form of valid YAML") and it is the only defensible one.

### 3.2 The algorithm

```markdown
detectFrontMatter(source: string): { format, raw, data, endOffset } | null

  1. Strip a UTF-8 BOM.                       // Jekyll: BOM causes "very, very bad things"
  2. Normalise CRLF -> LF for the probe only.  // never mutate the source
  3. Take line 0, trimmed of trailing whitespace ONLY. Not leading.

  --- YAML      -> line0 === '---'   -> scan forward for '---' or '...'
                    (Pandoc: '...' is a valid terminator)
  +++ TOML      -> line0 === '+++'   -> scan forward for '+++'
  {  JSON       -> line0 === '{'     -> brace-match to the matching '}'
  %  Pandoc tb  -> line0.startsWith('% ') -> consume consecutive '% ' lines
  Key:  mmd     -> line0 matches /^[A-Za-z][\w -]*:\s/ and a *second* such line
                    follows within 8 lines  -> mmd block
                     // two lines minimum: "Comment:" alone is not a title block

  4. An EMPTY body is still front matter (Jekyll says so explicitly).
  5. Parse the body with the format's parser.
       success -> front matter, record endOffset
       failure -> NOT front matter. Return null. Let the Markdown parser have it.
  6. Never consume a delimiter that is inside a fenced code block.
     // '```\n---\nfoo\n---\n```' must not be detected as front matter.
```

**Step 6 is the one people forget and it is a data-loss bug.** A document that
starts with a fenced code block containing `---` lines must not have its code
block eaten. We have to run a fence-awareness scan before accepting a
delimiter. `micromark-extension-frontmatter` gets this right by being part of
the block parser; our standalone splitter has to do it explicitly.

### 3.3 Detection in our corpus

The 15-file real-world corpus from
[01-js-parsers §3.5](01-js-parsers.md#35-the-performance-problem-measured)
contains front matter in exactly one file — `micromark-readme.md`'s own
`--- outline: deep` fences (which is *inside* Markdown content, not front
matter, and must not be detected). That is a useful accident: it proves the
"not at the top of the file" rule matters, because a naive
`source.startsWith('---')` would not fire but a naive
"find the first `---` pair" absolutely would eat the table of contents
heading.

---

## 4. What should a viewer *do* with front matter?

The brief asks three options: hide it, show it as a table, make it editable.
The honest answer is **all three, in different modes**, plus a fourth nobody
expects.

### 4.1 Reading mode: show it, but as *metadata*, not as a property table

**Hide it.** Default behaviour, and it is right for a reading-focused viewer.
Front matter is scaffolding; a reader wants the prose.

**Show it as a collapsible metadata panel**, one row per top-level key, with:
- the key,
- a type-aware rendering (`Date` → formatted, array → comma list,
  object → nested),
- a **copy value** affordance (people copy tags and aliases constantly),
- **no editing affordance in reading mode** (read-only is a feature),
- the raw YAML available behind a "view source" toggle for the keys we cannot
  render sensibly.

**Not a raw property table.** `Object.entries` on a nested front matter object
produces `{nested: "[object Object]"}` in the UI, which is a bug users report.
Recursive rendering with a depth limit of 3 is the minimum.

**And render errors prominently.** If front matter failed to parse, the panel
must say so with the line and column from `yaml`'s `errors[0].linePos`, and
link to the raw text. Silent `{}` is the worst outcome.

### 4.2 The window title and the outline

Front matter's most valuable contribution to a viewer is not display, it is
**function**:

- `title:` → the window title, the tab label, the outline root, and the
  default filename suggestion.
- `aliases:` / `permalink:` → not meaningful in a local viewer, but Obsidian
  users expect aliases to resolve `[[alias]]` links.
- `tags:` → feed the tag pane. This is the single most requested feature in
  every notes app ever built.
- `date:` → sort order in the file list.
- `draft: true` (Hugo) → show a "draft" badge.

**Aliases feeding wikilink resolution is a genuine cross-feature
interaction** and belongs in the ADR, not in a code comment.

### 4.3 Editing mode: yes, but as *source*, not as a form

This is the answer we should commit to, and it has three parts:

1. **Front matter is part of the document text.** The editor shows the
   `---\n…\n---` block inline at the top, with YAML syntax highlighting. It
   is not a modal, not a sidebar, not a separate document.
2. **Validation is live and non-blocking.** On every change (debounced), we
   re-parse the block and, if it fails, we show an inline marker on the
   offending line using `yaml`'s `linePos`. **We do not block the keystroke.**
   The parse happens on the block, which is a few lines, so it is cheap.
3. **Round-tripping must not reformat the user's file.** If the user writes
   `title:   Hello    World`, we must not rewrite it to `title: Hello World`
   on save. We only touch the bytes the user actually changed. This means
   **we never serialise the parsed object back** — the parsed data exists for
   *reading* (title, tags, aliases), and the *source* is the truth for
   *writing*. Every "generated" front-matter writer we have ever used in a
   notes app has caused a diff storm.

**What about a form?** A form is right for exactly one case: **creating a new
note**. "New note" → a dialog with Title / Tags / Date / Aliases fields →
generates canonical YAML. That is a write-time convenience on a new file, not
an editing surface on an existing one.

### 4.4 The fourth option: security

Nobody puts this in a front-matter document, so we will.

Front matter is **attacker-controlled data that our application reads as
configuration.** Treating it as data is mandatory:

- **Never interpret.** A `permalink: //evil.example` must not become a base
  URL. A `redirect_from:` must not become a redirect. A
  `layout: ../../../../etc/passwd` must not become a path we read. We are not
  Jekyll and we do not have layouts.
- **Never merge into app settings.** `theme: dark` in a note must not change
  the app's theme. If we ever support per-note theme, it must be an
  **explicitly named and validated** subset (`viewer_theme: sepia`, matched
  against an enum), never a free-form key mapped to app config.
- **Bound the size.** A 50 MB `---` block is a DoS on the YAML parser. Cap
  front matter at, say, 256 KiB and refuse beyond that with a clear message.
- **Bound the parse.** YAML anchors and aliases enable billion-laughs style
  expansion. Both `js-yaml` and `yaml` have options for this; we must set
  them and we must test billion-laughs explicitly. `yaml` exposes
  `maxAliasCount`; js-yaml has no direct equivalent, which is a point for
  `yaml`.
- **Never render front matter values as HTML.** They go through the same
  sanitiser as everything else, or — better — through `textContent`, never
  `innerHTML`.

Front matter is the **first** attacker-controlled input a Markdown viewer
processes. It deserves the same scrutiny as the Markdown body, and in a naive
implementation it usually gets less.

---

## 5. Recommended implementation

```ts
// packages/core/src/front-matter/index.ts

export type FrontMatterFormat = 'yaml' | 'toml' | 'json' | 'pandoc' | 'mmd' | null

export interface FrontMatter {
  format: FrontMatterFormat
  raw: string          // exact source text, including delimiters
  body: string         // the delimited payload, unmodified
  data: Record<string, unknown>
  bodyOffset: number   // byte offset where the Markdown body starts
  error: { line: number; column: number; message: string } | null
}

export function parseFrontMatter(source: string): FrontMatter | null
```

Behaviour, in order:

| Case | Result |
|---|---|
| BOM present | stripped before sniffing, source otherwise untouched |
| `---\nvalid yaml\n---` | `format: 'yaml'`, `data` populated |
| `---\n---\n` | `format: 'yaml'`, `data: {}` — Jekyll's documented behaviour |
| `---\nvalid yaml\n...` | `format: 'yaml'` — Pandoc's documented terminator |
| `---\n: : not yaml\n---` | **`null`** — not front matter; `---` renders as thematic breaks |
| `---\ntitle: x\n---` at EOF | `format: 'yaml'`, empty body |
| `+++\ntitle = "x"\n+++` | `format: 'toml'` (Hugo) |
| `{\n "a": 1\n}` | `format: 'json'` (Hugo) |
| `% title\n% author\n% date` | `format: 'pandoc'` |
| `Title: x\nAuthor: y` (≥2 such lines, ≤8) | `format: 'mmd'` |
| front matter > 256 KiB | `null` + a warning surfaced to the user |
| `---` inside a fence | not a delimiter |
| front matter not at position 0 | not front matter (we do **not** implement Pandoc's anywhere-in-document rule; a viewer showing metadata mid-document is a bug, not a feature) |

Parser choice: **`yaml` 2.9.1** for YAML (error positions), **`smol-toml`
1.9.0** for TOML, **`JSON.parse` in a try/catch** for JSON. `js-yaml` 5.4.3 as
a fallback if `yaml`'s YAML 1.1-only cases bite us — note it now supports both
1.2 and 1.1 and passes the YAML Test Suite, which is a genuine improvement over
the 3.x/4.x line most projects still pin.

`@iarna/toml` is **not** used: last release 2020-04-22, no TypeScript types.

---

## 6. Open questions

1. **Does `yaml`'s YAML 1.2 default reject documents that Jekyll accepts?**
   Jekyll uses js-yaml, which is YAML 1.1: `yes`/`no`/`on`/`off` are booleans
   in 1.1 and strings in 1.2. `draft: no` means `false` in Jekyll and
   `"no"` in a 1.2 parser. **We have not tested this and it will produce
   silently wrong behaviour for Hugo/Jekyll users.** → must test.
2. **YAML alias-expansion limits.** Which library, which option, what value?
   Needs a billion-laughs test case.
3. **Should we support Pandoc's anywhere-in-document metadata block?** Our
   answer is no. Reversible, but a user with a Pandoc book may disagree.
4. **Does Obsidian have a normative front-matter spec we should cite?**
   Its `app.css` and plugin conventions are observable but its documentation
   is not a spec. This is an inference, and we mark it as one.
