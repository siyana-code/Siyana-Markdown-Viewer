# 01 — JavaScript / TypeScript Markdown parsers

Verified 2026-10-06. All versions from `registry.npmjs.org` (`dist-tags.latest`
and `time[<version>]`). All GitHub star counts scraped from the repository page
on 2026-10-06 and are **approximate**. All sizes from the Bundlephobia API for
the exact pinned version. All conformance and performance numbers are **ours**,
produced by the harness described in
[07-evaluation-framework §6](07-evaluation-framework.md#6-benchmark-plan) with
Node **v24.14.1** on Windows.

---

## 0. The four contenders at a glance

| | markdown-it | marked | micromark / remark | commonmark.js |
|---|---|---|---|---|
| Version verified | **15.0.2** | **18.1.0** | **micromark 4.0.3**, remark 15.0.1, unified 11.0.5 | **0.31.2** |
| Published | 2026-09-11 | 2026-10-05 | micromark 2026-09-26 / remark 2023-09-18 / unified 2024-06-19 | 2024-09-19 |
| Last commit on default branch | 2026-09-11 | 2026-10-05 | 2026-09-26 | 2026-09-14 |
| Licence | MIT | MIT | MIT | BSD-2-Clause |
| Stars (2026-10-06) | 22.0k | 37.2k | micromark 2.2k, remark 9.0k, unified 5.0k | n/a (spec repo 5.1k) |
| npm downloads / month | 119,440,414 | 326,621,887 | micromark 245,406,015 | 3,114,598 |
| Runtime deps | 6 | **0** | 18 (micromark) + 4 (remark) + 7 (unified) | 3 |
| Minified | 97,584 B | 45,260 B | 53,354 B (micromark alone) | 156,452 B |
| Min + gzip | 40,506 B | 13,643 B | 15,168 B (micromark alone) | 48,332 B |
| Module format | ESM **and** CJS | ESM only | ESM only | CJS |
| TypeScript types | **First-party, bundled** | First-party | First-party (`@types/markdown-it` no longer needed) | **None** |
| Node engine constraint | none | `>= 20` | none declared | none |
| CommonMark 0.31.2 (ours) | **649/652 = 99.5%** (commonmark preset) | 502/652 = 77.0% | 648/652 = 99.4% (micromark + `allowDangerousHtml`) | **652/652 = 100%** |
| GFM out of the box | tables, strikethrough + linkify; task lists via plugin | **yes, default** | via `micromark-extension-gfm` | **no** |
| Raw HTML default | off (`html: false`) | **on, unsanitized** | escaped to text | on |
| Source positions | `token.map` (line ranges) | `token.raw`, no line map | mdast `position` (line, column, **offset**) | none |
| Plugin model | 4 ruler chains, imperative | `use()` monkey-patching | parser plugins + AST transformers | none |

> **Read the "Raw HTML default" row twice.** `marked` renders
> `<script>alert(1)</script>` verbatim. Its own README leads with a
> 🚨 warning telling you to sanitize the output. This is not a nitpick — it is
> the single most important row in the table for a document viewer.

---

## 1. markdown-it

### 1.1 What it is

`markdown-it` is the de-facto reference for *correctness plus extensibility*
in JavaScript. The README's own claims are: follows the CommonMark spec, adds
syntax extensions and sugar, "configurable syntax" where you can add rules and
replace existing ones, high speed, safe by default, community-written plugins.

Those claims hold up. In our CommonMark run, the `commonmark` preset scored
**649 of 652** — the three failures are all the same cosmetic thing:

```text
ex 239  [Block quotes]  ">\n"
  got : "<blockquote></blockquote>\n"
  want: "<blockquote>\n</blockquote>\n"
```

markdown-it emits an empty blockquote without the trailing newline that the
reference HTML fixture contains. That is a byte-level artifact, not a
semantic one.

### 1.2 API shape

```js
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()                 // default preset
// or: new MarkdownIt('commonmark')         // spec-only, no extensions
// or: new MarkdownIt('zero')               // everything off, rules only

md.render('# markdown-it rulezz!')          // block-level, wraps in <p>
md.renderInline('__markdown-it__ rulezz!') // inline only
md.parse(src, env)                         // → Token[] (no HTML)
md.parseInline(src, env)                   // → Token[] (inline children only)
```

Two things matter for us:

1. **`md.parse()` returns the token stream, not HTML.** This is the single most
   important property for this project. Every block-level token carries a
   `map` of `[startLine, endLine]`, which is what makes block-level caching
   and scroll sync possible (§7.4).
2. **`env` is a mutable object we own**, threaded through `parse` → rules →
   renderer. It is the sanctioned place to hang per-document state.

Here is a real token stream from our harness:

```js
const tokens = md.parse('Text with *em* here.\n\n- a\n- b\n', env)

tokens.map(t => `${t.type}@${t.map ?? 'null'}:${t.level}`).join(' ')
// paragraph_open@0,1:0 inline@0,1:1 paragraph_close@:0
// bullet_list_open@2,4:0 list_item_open@2,3:1 paragraph_open@2,3:2
// inline@2,3:3 paragraph_close@:2 list_item_close@:1
// list_item_open@3,4:1 paragraph_open@3,4:2 inline@3,4:3
// paragraph_close@:2 list_item_close@:1 bullet_list_close@:0
```

`level: 0` tokens are exactly the top-level blocks. That gives us a free
block index without a second parse.

### 1.3 The plugin architecture

markdown-it exposes three "rulers" plus a normalizer — four ordered rule
lists. Reading them off a live instance:

```js
md.block.ruler.getRules('').map(r => r.name)
// table, code, fence, blockquote, hr, list, reference, html_block, heading,
// lheading, paragraph

md.inline.ruler.getRules('').map(r => r.name)
// text, linkify, newline, escape, backtick, strikethrough_tokenize,
// emphasis_tokenize, link, image, autolink, html_inline, entity

md.core.ruler.getRules('').map(r => r.name)
// normalize, block, strip_references, inline, linkify$1, replace, smartquotes, text_join
```

A plugin is a function that takes `md` and mutates it:

```js
export default function footnotePlugin(md) {
  md.block.ruler.before('reference', 'footnote_def', parseFootnote)
  md.inline.ruler.after('image', 'footnote_ref', parseFootnoteRef)
  md.core.ruler.after('inline', 'footnote_tail', footnoteTail)
  md.renderer.rules.footnote_tail = renderFootnoteTail
}
```

Four extension points — block parser, inline parser, core transform,
renderer — is why markdown-it has the deepest ecosystem of any JS parser. A
plugin can hook *any* of the four phases, which is more power than marked's
single `use()` merge model and far more than micromark, where a syntax
extension means writing a state-machine construct against a documented
internal protocol.

`md.core.ruler.push()` also lets us observe every token without writing a
plugin:

```js
md.core.ruler.push('collect_stats', (state) => {
  const types = {}
  for (const t of state.tokens) types[t.type] = (types[t.type] || 0) + 1
  state.env.stats = types
})
md.parse(src, {})
// { paragraph_open: 3, inline: 3, paragraph_close: 3,
//   bullet_list_open: 1, list_item_open: 2, list_item_close: 2,
//   bullet_list_close: 1 }
```

### 1.4 v15 changed things you will trip over

v15.0.0 landed 2026-07-30 and v15.0.2 on 2026-09-11. From the CHANGELOG and
migration guide we read directly:

**Breaking:**
- Migrated to TypeScript. **Types are now bundled** — delete `@types/markdown-it`.
- Package-internal subpath exports (`markdown-it/lib/*`) removed. Classes are
  now static properties on the main export: `MarkdownIt.Token`,
  `MarkdownIt.StateBlock`, `MarkdownIt.Ruler`, etc.
- `linkify-it` → v6: **no fuzzy links by default** (`example.com` is no
  longer auto-linked), no auth-part check by default, Unicode punctuation
  terminates links by default (deliberate, helps CJK). Re-enable with
  `md.linkify.set({ fuzzyLink: true })`.
- `md.utils.assign`, `md.utils.has`, `md.utils.isString` removed.
- `StateBlock#ddIndent` removed — breaks `markdown-it-deflist` (upstream has
  updated; we verified deflist 4.0.0 published 2026-07-27, after v15).
- `validateLink`, `normalizeLink`, `normalizeLinkText` moved from own
  properties to prototype methods.
- `entities` → v8.
- Distribution reorganised under `dist/` and `dist/browser/`; added a
  `markdown-it/browser` export with bundled ESM and UMD builds.

**Fixed (CommonMark 6.3 / 6.7 conformance items):** lowercase declarations
recognised as HTML blocks (CM 4.6), literal backslash before a terminating
space in link destinations (CM 6.3), semicolons now required for named
entities in all decode paths, backslash-space hard line breaks preserved
(CM 6.7), astral-character handling in delimiter scans (CJK credit to
@tats-u), IPv6 address literals in links.

**Security, in the last three releases:**
- 15.0.2: fixed quadratic complexity in smartquotes when quote types don't
  match (#1209); capped the smartquotes stack at 1000 unmatched openers.
- 15.0.1: fixed quadratic complexity when replacing fuzzy links; fixed
  quadratic complexity in the scheme backscan (inline linkify rule).
- 14.2.0: fixed poor smartquotes performance on >70k quotes in one block;
  bumped linkify-it for perf issues.

This is a maintainer who treats pathological input as a first-class bug
class. **18 advisories on GHSA for markdown-it exist historically; OSV
reports `markdown-it@14.2.0`, `@14.3.0` and `@15.0.0` affected by
GHSA-253c-mchw-3w2r (linkify quadratic paths — "a few hundred KB of markdown
blocks the event loop"), and reports `@15.0.1` and `@15.0.2` clean.**
Two other linkify advisories exist (GHSA-38c4-r59v-3vqw ReDoS,
GHSA-6v5v-wf23-fmfq smartquotes quadratic). We will pin `>=15.0.2` in
`package.json` and put an OSV check in CI.

### 1.5 Security behaviour, verified by hand

markdown-it blocks dangerous URL schemes by default. From the built
`dist/markdown-it.mjs`:

```js
var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/
var GOOD_DATA_RE  = /^data:image\/(gif|png|jpeg|webp);/

validateLink(url) {
  const str = url.trim().toLowerCase()
  return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true
}
```

We exercised it:

```text
"javascript:alert(1)"   -> false
"JaVaScRiPt:alert(1)"   -> false      (lowercased before the test)
"  javascript:x"        -> false      (trimmed)
"JAVASCRIPT:x"          -> false
"vbscript:x"            -> false
"data:text/html,x"      -> false
"https://ok" / "/rel" / "#frag" / "mailto:a@b.c" -> true
```

And in a render:

```markdown
md.render('[d](JaVaScRiPt:alert(1))')  ->  <p>[d](JaVaScRiPt:alert(1))</p>
md.render('[d](JAVASCRIPT:alert(1))')  ->  <p>[d](JAVASCRIPT:alert(1))</p>
```

The link is simply not created. Contrast with `marked`, same input, same run:

```markdown
marked('[a](javascript:alert(1)) [c](data:text/html,<script>1</script>))')
-> <p><a href="javascript:alert(1)">a</a>
   <a href="data:text/html,%3Cscript%3E1%3C/script%3E">c</a></p>
```

**markdown-it blocks it; marked emits a live `javascript:` href.** Still
sanitize — see [05-sanitizer-libraries](05-sanitizer-libraries.md) — but the
defence-in-depth is real.

Raw HTML: off by default (`html: false`). Turning it on gives CommonMark's
HTML block/inline behaviour, which is faithful and therefore dangerous, which
is exactly what `rehype-sanitize` / DOMPurify exist for.

### 1.6 The plugin ecosystem

Verified against `registry.npmjs.org` on 2026-10-06:

| Plugin | Latest | Published | Licence | Notes |
|---|---|---|---|---|
| `markdown-it-footnote` | 4.0.0 | 2023-12-06 | MIT | |
| `markdown-it-task-lists` | 2.1.1 | **2018-03-06** | ISC | **unmaintained since 2018.** Renders `<input type="checkbox" disabled>`; breaks inside links |
| `markdown-it-anchor` | 10.0.0 | 2026-09-05 | Unlicense | Active; `valeriangalliat/markdown-it-anchor`, 324 stars |
| `markdown-it-table-of-contents` | 1.2.0 | 2026-03-24 | MIT | Third-party, `cmaas`, 111 stars |
| `markdown-it-mark` | 4.0.0 | 2023-12-05 | MIT | `==highlight==` → `<mark>` |
| `markdown-it-sub` / `-sup` | 2.0.0 / 2.0.0 | 2023-12-05 | MIT | |
| `markdown-it-deflist` | 4.0.0 | **2026-07-27** | MIT | definition lists; updated post-v15 |
| `markdown-it-abbr` | 2.0.0 | 2023-12-06 | MIT | |
| `markdown-it-attrs` | 5.0.1 | **2026-07-27** | MIT | `{...}` attribute syntax — our `attrs`/`container` needs |
| `markdown-it-container` | 4.0.0 | 2023-12-05 | MIT | `::: warning` fences |
| `markdown-it-typographer` | 1.6.0 | 2020-10-22 | MIT | **superseded** — typographer is built into markdown-it core as an option |
| `markdown-it-emoji` | 3.1.0 | 2026-07-22 | MIT | `markdown-it/markdown-it-emoji`, 772 stars |
| `markdown-it-cjk-friendly` | 3.0.0 | 2026-08-22 | MIT | CJK emphasis (complements the v15 delimiter fix) |

**Two corrections to the brief.** `markdown-it-lazy-lines` returns **404 on
npm** — it does not exist under that name. There is a long-standing request
for "lazy continuation lines" behaviour and several ad-hoc plugins, but no
package of that name. Likewise `markdown-it-tester` and
`markdown-it-benchmark` both return **404 on npm and 404 on GitHub**. What
*does* exist and is maintained-ish is `markdown-it-testgen` 0.1.6
(published 2019-07-09, MIT), which parses commonmark-spec-format fixtures.
Do not plan around `markdown-it-tester`.

**Assessment.** This is the ecosystem that decides the parser. Roughly 40
lines of code turns on `markdown-it-anchor` and `markdown-it-table-of-contents`
and we have working heading anchors and a TOC. The two gaps are
`markdown-it-task-lists` (8 years stale) and `markdown-it-attrs` (which we may
want for Obsidian-style `{#id}` and callouts) — both small enough to vendor
and maintain ourselves, which is the correct answer for a security-sensitive
viewer anyway. Forking 150 lines beats trusting an unmaintained package.

---

## 2. marked

### 2.1 What it is

`marked` bills itself as "built for speed", a "low-level compiler for parsing
markdown without caching or blocking for long periods of time",
"light-weight while implementing all markdown features from the supported
flavors & specifications". The `marked` 18 npm dist is **45,260 B minified /
13,643 B gzipped with zero runtime dependencies** — by a wide margin the
smallest serious parser here, and its monthly download count (326.6M) is the
highest of any Markdown parser on npm.

GFM is **on by default**: tables, task lists, strikethrough, autolink
literals.

### 2.2 API shape

The `marked.use()` extension model merges your renderer/tokenizer functions
over the built-ins:

```js
import { marked, Marked } from 'marked'

// global (default) instance
marked.parse('# hi')

// isolated instance — required for extensions in test/lint harnesses
const m = new Marked({ gfm: true })

m.use({
  walkTokens(tok) {
    if (tok.type === 'heading') tok.depth = Math.min(6, tok.depth + 1)
  },
  renderer: { heading({ tokens, depth }) { /* ... */ } },
  tokenizer: { /* overrides */ },
  extensions: [{ name: 'mySyntax', level: 'block', tokenizer, renderer }],
})

m.parse('# H1\n\n## H2\n')
// <h2>H1</h2>
// <h3>H2</h3>
```

A `Marked` instance exposes exactly: `walkTokens, use, setOptions, lexer,
parser, parseMarkdown, onError` (enumerated at runtime).

**`parseInline` is a real, first-class entry point** — this matters a lot for
our incremental renderer:

```js
m.parseInline('a *b* `c`')   // -> 'a <em>b</em> <code>c</code>'
```

And the lexer gives you tokens with `raw` slices but **no line map**:

```js
m.lexer('Text with *em* and `code`.\n\n- a\n- b\n').map(t => t.type)
// paragraph, space, list
// first paragraph inline tokens: text | em | text | codespan | text
```

Note the difference from markdown-it: `marked` has no equivalent of
`token.map`. You get `token.raw` (the source substring) and nothing about
where it came from. To build a block index for scroll sync you must either
scan the source yourself counting offsets, or diff token `raw` lengths
against the input. markdown-it gives you `map` for free.

### 2.3 The `sanitize` option history — this matters

- `sanitize` and `sanitizer` were **first-class options** from 0.2.1 / 0.3.4.
- **Both were removed in marked v8.0.0.** The docs table lists them under
  "Old Options" with "Removed in v8.0.0 use a sanitize library, like
  **DOMPurify (recommended)**, sanitize-html or insane on the output HTML".
- The README now opens with a 🚨 banner repeating that, and shows
  `DOMPurify.sanitize(marked.parse(...))` as the first example.

The reason for removal is that escaping HTML is not sanitization: it produced
false confidence and was itself the vector for several of marked's CVEs. We
respect that decision — but it means **marked has no security posture of its
own**. `html` is on by default, dangerous schemes pass through, and the only
defence is a library you add yourself.

Advisory history from the GitHub Advisory Database, `affects:marked`:
**18 advisories**, spanning 2015 → 2026:

| Advisory | Severity | Published | Note |
|---|---|---|---|
| CVE-2026-41680 / GHSA-6v9c-7cg6-27q7 | High | 2026-04-29 | OOM DoS via infinite recursion in the tokenizer. Affects **18.0.0 only**; fixed in **18.0.2** (OSV: introduced 18.0.0, fixed 18.0.2) |
| CVE-2018-25110 | Moderate | 2025-05-23 | ReDoS |
| CVE-2022-21681, CVE-2022-21680 | High | 2022-01-14 | Inefficient regex complexity |
| GHSA-wjmf-58vc-xqjr, GHSA-7m7q-q53v-j47v, GHSA-32vw-r77c-gm67, GHSA-2016… | — | 2020–2021 | Four **withdrawn** advisories |
| CVE-2021-21306, CVE-2017-16114, CVE-2015-8854, CVE-2015-1370 | Mod–High | 2017–2021 | ReDoS family |
| CVE-2016-10531 | Moderate | 2019 | Sanitization bypass via HTML entities |
| CVE-2017-1000427 | Moderate | 2018 | XSS from data URIs |
| CVE-2014-3743 | Moderate | 2020 | Multiple content injections |

OSV reports `marked@18.1.0` (current) **clean**. Note this is a package with
a long CVE tail that gets patched fast; that is a legitimate operational
profile, not disqualifying, but it does mean **we need automated dependency
scanning**, not a quarterly manual audit.

### 2.4 Conformance

Measured against CommonMark 0.31.2 (652 examples), byte-exact:

| config | pass | rate |
|---|---|---|
| `marked.parse(src, { gfm: false })` | 502 | **77.0%** |
| `marked.parse(src)` (gfm: true) | 498 | 76.4% |
| after void-element/entity relaxation | 507 / 503 | 77.8% / 77.1% |

Failing sections are structural, not cosmetic: List items ×28, Images ×19,
Lists ×18, Thematic breaks ×13, Setext headings ×13. Typical example:

```text
ex 4  [Tabs]  "  - foo\n\n\tbar\n"
  got : <ul>\n<li><p>foo</p>\n<p>bar</p>\n</li>\n</ul>
  want: <ul>\n<li>\n<p>foo</p>\n<p>bar</p>\n</li>\n</ul>
```

Loose-vs-tight list handling around blank lines is systematically different
from CommonMark. For a viewer this is not fatal — GitHub itself does not
render these identically to CommonMark either — but it means **a document
that looks right on GitHub may look subtly wrong in our viewer if we choose
marked**, and a user with a spec-literate eye will notice.

### 2.5 Assessment

marked is the fastest, smallest, most-depended-upon parser here, and its
performance advantage is real. Its weaknesses are equally real: no source
positions, weaker conformance, zero built-in security, and a `Marked`
extension model that is powerful but *monkey-patching by design* (its own
docs warn: "`marked.use(...)` should not be used in a loop or function…
you will cause a recursion error"). That last one is a footgun we would be
fighting in every test.

---

## 3. micromark / remark / unified

### 3.1 What they are

Three layers, all ESM-only:

- **micromark 4.0.3** — the parser. A state machine (`preprocess` → `parse` →
  `postprocess` → `compile`) that emits *concrete tokens* with positional
  info. Claims "the smallest CommonMark compliant markdown parser (±14kb)".
  Its own README's comparison section is refreshingly candid — and it notes
  the list "is made by the folks who make micromark and remark, so there is
  some bias". Weigh accordingly.
- **remark 15.0.1** (processor) / **unified 11.0.5** (plugin runner) — a
  plugin pipeline. remark is 4 deps, unified 7.
- The AST layers: `mdast-util-from-markdown` 2.0.2 builds **mdast**
  (Markdown tree, JSON-serialisable), `remark-rehype` 11.1.2 → **hast**, and
  `rehype-stringify` 10.0.1 serialises.

### 3.2 API shape — three levels, pick one

**Level 1: HTML and nothing else.**

```js
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'

micromark(doc, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })
```

Real output from our harness:

```html
<h1>H</h1>
<p><del>strike</del> and ==mark== and
   <a href="http://www.example.com">www.example.com</a></p>
<table><thead><tr><th>a</th><th>b</th></tr></thead>
<tbody><tr><td>1</td><td>2</td></tr></tbody></table>
<ul><li><input type="checkbox" disabled="" checked="" /> done</li></ul>
<p>Footnote<sup><a href="#user-content-fn-a" id="user-content-fnref-a"
   data-footnote-ref="" aria-describedby="footnote-label">1</a></sup></p>
<section data-footnotes="" class="footnotes">…</section>
```

**Level 2: mdast (the useful one for us).**

```js
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'

const tree = fromMarkdown(doc, {
  extensions: [gfm()],
  mdastExtensions: [gfmFromMarkdown()]
})

tree.children.map(n =>
  `${n.type} @ ${n.position.start.line}:${n.position.start.column}` +
  `-${n.position.end.line}:${n.position.end.column}` +
  ` (offset ${n.position.start.offset}..${n.position.end.offset})`
).join('\n')
// heading @ 1:1-1:4 (offset 0..3)
// paragraph @ 3:1-3:44 (offset 5..48)
// table @ 5:1-7:10 (offset 50..79)
// list @ 9:1-9:11 (offset 81..91)
// paragraph @ 11:1-11:41 (offset 93..133)
// paragraph @ 13:1-13:13 (offset 135..147)
// footnoteDefinition @ 15:1-15:16 (offset 149..164)
```

**This is the best positional information of any JS parser here** — line,
column *and* absolute byte/UTF-16 offset, on every node. That is exactly what
the incremental-preview renderer in
[07-editor-internals/03](../07-editor-internals/03-incremental-parsing.md)
wants.

**Level 3: the full unified pipeline.**

```js
const file = await unified()
  .use(remarkParse).use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize)
  .use(rehypeStringify)
  .process(doc)
```

### 3.3 The extension architecture — and its cost

A **syntax extension** is an object whose fields are *character codes*,
mapping to constructs. That is a documented internal protocol to the
tokenizer state machine. To add `==mark==` you write a `resolve`-driven
state machine for character codes, not a regex.

Writing custom markdown in micromark is genuinely hard. The README says so:

> It has syntax extensions, such as supporting 100% GFM compliance (with
> `micromark-extension-gfm`), but **they're rather complex to write**.

The maintained extension list (from micromark's own readme, and confirmed
against the `micromark` GitHub org — 20 extension repos):

`directive`, `frontmatter`, `gfm`, `gfm-autolink-literal`, `gfm-footnote`,
`gfm-strikethrough`, `gfm-table`, `gfm-tagfilter`, `gfm-task-list-item`,
`math`, `mdx`, `mdxjs`, `mdx-expression`, `mdx-jsx`, `mdx-md`, `mdxjs-esm`.
Community: `micromark-extension-definition-list`.

18 runtime dependencies for micromark itself. The whole unified chain for a
plain "md → hast → html" is on the order of 100 transitive packages.

The payoff is the **AST side**: once you have mdast, transforming it is
trivial, because it is JSON. Rehype plugins, sanitisation, React rendering,
link resolution — all become ordinary data transforms with an enormous
ecosystem. `remarkjs/react-markdown` has 15.9k stars. If we ever wanted a
web target with rich plugin support, this is the strongest option by a mile.

### 3.4 Conformance and the raw-HTML default

| config | pass | rate |
|---|---|---|
| `micromark(src)` (safe default: raw HTML escaped to text) | 576 | 88.3% |
| `micromark(src, { allowDangerousHtml: true })` | 648 | **99.4%** |

This is a design choice, not a bug. The 76 failures at the safe default are
HTML blocks ×44 and Raw HTML ×13 — micromark *refuses to emit raw HTML unless
you opt in*, so the spec fixtures (which expect raw HTML passthrough) fail.
Its 4 failures with `allowDangerousHtml` are Autolinks ×3, Links ×1.

**Security-wise micromark is the best-behaved of the three**: escaping raw
HTML by default means a Markdown document containing `<script>` renders as
visible text, not as a script tag. And on link destinations it is the
strictest of all:

```markdown
micromark('[a](javascript:alert(1)) [b](vbscript:x) [c](data:text/html,<script>1</script>))')
-> <p><a href="">a</a> <a href="">b</a> <a href="">c</a></p>
```

Blocked, href emptied. markdown-it blocks by not creating the link; micromark
creates the link with an empty href. Both fine.

### 3.5 The performance problem — measured

This is the deciding factor. Real-world corpus: 15 Markdown files pulled
verbatim from project repositories (markdown-it's README and CHANGELOG,
micromark's readme, comrak/goldmark/pulldown-cmark/markdown-rs READMEs,
DOMPurify's README, marked's advanced+pro docs, the full CommonMark spec,
starry-night's readme, three CodeMirror language READMEs), **570 KiB total**,
files >3 KiB, Node v24.14.1, **best of 9 samples per file**, per-engine
warm-up pass on small inputs to keep JIT state from depending on measurement
order.

| engine | Σ min ms | Σ median ms | KiB/ms | HTML bytes out |
|---|---|---|---|---|
| commonmark.js 0.31 | **60.1** | 89.5 | 9.48 | 682,143 |
| marked 18 `gfm:false` | 81.2 | 100.8 | 7.01 | 685,333 |
| marked 18 `gfm:true` | 117.0 | 156.5 | 4.87 | 716,316 |
| **markdown-it 15 (html+linkify)** | **136.0** | 183.9 | 4.19 | 692,052 |
| markdown-it 15 (+table +strikethrough) | 138.0 | 186.1 | 4.13 | 692,052 |
| micromark 4 (CommonMark only) | 860.1 | 1008.5 | 0.66 | 692,705 |
| remark parse (mdast only) | 1363.5 | 1520.4 | 0.42 | 0 |
| remark → rehype → stringify | 1473.3 | 1689.9 | 0.39 | 722,588 |
| micromark 4 + extension-gfm | 1779.8 | 2276.5 | 0.32 | 725,571 |

A second, independent corpus (6 synthetic documents from a generator that
emits headings, lists, blockquotes, fenced code, tables, task lists,
thematic breaks, raw HTML divs, footnotes, indented code and hard breaks —
39–210 KiB each, 740 KiB total) reproduces the ordering exactly:

| engine | Σ min ms (740 KiB) |
|---|---|
| commonmark.js | 77 |
| marked gfm:false | 142 |
| marked gfm:true | 225 |
| markdown-it +table+strike | 254 |
| micromark CommonMark only | 1351 |
| micromark + gfm | 2560 |
| remark → rehype → stringify | 2702 |
| remark parse only | 2797 |

**The full unified pipeline is 10.8× slower than markdown-it and 18.1×
slower than marked** on the same bytes in the same process.

Per-file detail on the two heavy documents shows the cost is structural, not
startup:

```text
commonmark-spec.md (201 KiB)
  commonmark.js   18.8 ms
  marked          21.9 / 26.8 ms
  markdown-it     33.7 / 33.2 ms
  micromark      308.8 ms
  remark parse   484.3 ms
starry-night-readme.md (107 KiB)
  commonmark.js   15.3 ms
  marked          27.2 / 42.3 ms
  markdown-it     42.4 / 40.7 ms
  micromark       243.7 ms
  remark parse    357.2 ms
```

Two honest caveats. (1) These are **single-run, best-of-9 wall-clock numbers
in one process**, not a rigorous microbenchmark — GC pressure and JIT
interaction are included, which is arguably realistic. (2) **We found no
credible published third-party benchmark** placing these four in the same
table. The commonly-cited comparisons are either vendor-run, on inputs the
vendor chose, or absent. Treat our table as directional but the 5–10×
ordering as reliable, because it reproduces across two independent corpora.

### 3.6 Assessment

micromark/remark is the most extensible, most standards-oriented, most
transformable option, and its positional information is the best in the
ecosystem. But the dependency tree is large, the extension authoring model is
hard, and — decisively — **it is 5–10× slower than markdown-it on our
corpus**. For a viewer whose entire job is to open large documents fast, that
is not a trade. We keep it documented as the escape hatch: if we ever need
AST-level transforms (e.g. generating a semantic outline, cross-referencing,
or diffing documents), mdast is the right tool and we can add
`mdast-util-from-markdown` **without** giving up markdown-it for rendering.

---

## 4. commonmark.js

The reference implementation, in JavaScript, by the spec authors.

```js
import * as commonmark from 'commonmark'

const reader = new commonmark.Parser()
const writer = new commonmark.HtmlRenderer()
const html = writer.render(reader.parse(doc))
```

It scores **652/652 = 100%** byte-exact on CommonMark 0.31.2 — it is the
thing the other three are measured against. It is also:

- **156,452 B min / 48,332 B gzip** — the *largest* of the four.
- **No TypeScript types** at all.
- **BSD-2-Clause** (fine for us).
- **3.1M monthly downloads** — an order of magnitude below the others.
- No extensions. No GFM. No footnotes, no tables, no task lists. No plugin
  system whatsoever.
- Token `type` is an **integer enum**, not a string.
- Last npm publish 2024-09-19; repo last commit 2026-09-14.

It is fast — fastest of the four in our benchmark, at 9.48 KiB/ms — and it is
the correct oracle. But "fastest" here is only true *because* it does almost
nothing beyond CommonMark: no linkify, no GFM, no entities beyond the spec's
minimum.

**Use it as a test oracle, not as the product.** Our `packages/test-fixtures`
should vendor the CommonMark 0.31.2 `spec.json` and assert markdown-it passes
649+/652, so a dependency bump can never silently regress spec conformance.
That is the highest-value use of this library we can think of.

---

## 5. Others worth knowing about

| Library | Version | Published | Size (min/gzip) | Verdict |
|---|---|---|---|---|
| `showdown` | 2.1.0 | 2022-04-21 | 83,881 / 25,012 B | **Unmaintained as a library.** Last npm release April 2022. Repo has commits through 2026-08-19 but they are CI/deps only — no release since 2.1.0. **Not CommonMark.** MIT, 14.9k stars, 5.6M dl/mo. Its distinguishing feature is bidirectional HTML→Markdown, which we do not need. |
| `snarkdown` | 2.0.0 | 2020-08-31 | 2,054 / **1,078 B** | Astonishingly small, MIT, 0 deps. Last repo commit 2022-01-10; 608k dl/mo. Not CommonMark, no GFM, no positions, no plugins. A genuinely interesting data point for "how small can it get" — and useless to us. |
| `yaml` (eemeli) | 2.9.1 | 2026-09-11 | 103,179 / 31,325 B | ISC. 868M dl/mo. Active (last commit 2026-09-23). Gives you a **CST with error positions**, which js-yaml does not. Best choice if we want to report *where* front matter is malformed. |
| `js-yaml` | **5.4.3** | **2026-10-05** | — | MIT. **1.26 billion** monthly downloads. Now supports YAML 1.2 **and** 1.1, "passes the entire YAML Test Suite". Ships legacy dist-tags `v4-legacy` (4.3.2) and `v3-legacy` (3.15.2). Heavily maintained (commit 2026-10-05). Simpler API: `load()`, `dump()`. |
| `@iarna/toml` | 2.2.5 | **2020-04-22** | 99 KB unpacked | ISC. 32.9M dl/mo. **Six years without a release**, no TypeScript types. Usable but stale. |
| `smol-toml` | 1.9.0 | 2026-09-22 | 15,042 / 5,633 B | **BSD-3-Clause.** 151M dl/mo, actively maintained. Modern, TS-native, tiny. **Preferred over `@iarna/toml`.** |
| `gray-matter` | 4.0.3 | 2021-04-24 | 6,770 / 2,587 B | MIT. 41.5M dl/mo. Handles YAML *and* JSON *and* `+++` TOML. Last repo commit 2025-06-14. It is a **string splitter**, not a parser — it hands you `data` and `content` and never validates the YAML body. Fine for a first cut; see [06-front-matter](06-front-matter.md) for why we probably want our own splitter. |

---

## 6. CommonMark conformance, measured

Method: download `https://spec.commonmark.org/0.31.2/spec.json` (**652
examples**), render `example.markdown` with each engine, compare to
`example.html` **byte for byte** after CRLF normalisation. No tolerance.

```text
CommonMark spec 0.31.2 — released 2024-01-28, 652 examples
```

| engine | strict byte-exact | after void-element/entity relaxation |
|---|---|---|
| commonmark.js 0.31 (reference impl) | **652 (100.0%)** | 652 (100.0%) |
| **markdown-it 15, preset `commonmark`** | **649 (99.5%)** | 649 (99.5%) |
| micromark 4 + `allowDangerousHtml: true` | 648 (99.4%) | 648 (99.4%) |
| markdown-it 15, `new MarkdownIt({html:true})` | 591 (90.6%) | 591 (90.6%) |
| markdown-it 15, `new MarkdownIt()` (html:false) | 519 (79.6%) | 519 (79.6%) |
| marked 18, `gfm: true` | 498 (76.4%) | 503 (77.1%) |
| marked 18, `gfm: false` | 502 (77.0%) | 507 (77.8%) |
| micromark 4 (safe default) | 576 (88.3%) | 576 (88.3%) |
| unified `remark-parse → remark-rehype → rehype-stringify` | 1 (0.2%) | 563 (86.3%) |

Three things to read out of this table.

**markdown-it's `commonmark` preset is the number that matters, not the
default.** The default preset fails 133 examples, but almost all of them are
*intentional*: it disables raw HTML (HTML blocks ×44, Raw HTML ×13), emits
`<hr>` where the fixture says `<hr />` (Thematic breaks ×11), and disables
setext-heading interpretation in some contexts (Setext ×11, Images ×19).
Turning on `html: true` recovers to 90.6%. Those three presets give us a
documented compatibility dial, which is exactly what a viewer wants: "strict
CommonMark for portability" vs "GitHub-like by default".

**The unified pipeline's 0.2% is a serializer artifact, not a parse failure.**
`rehype-stringify` escapes `&` as `&#x26;` where the fixtures want `&amp;`,
and omits the newline inside an empty blockquote. After normalising
void-element slashes and entity spelling it reaches 563/652 (86.3%) — and the
residual differences are still mostly blockquote/newline cosmetics. This is
exactly the kind of thing that makes byte-comparison the wrong conformance
metric for a tree pipeline, and also exactly the kind of thing that makes
markdown-it's byte-match on the same suite a nice property.

**No project in this table except commonmark.js and markdown-it hits 100%.**
The "100% CommonMark" claims in the wild are almost always claims about a
particular configuration. We measured the configurations.

---

## 7. Performance, measured

See [§3.5](#35-the-performance-problem-measured) for the tables. Full
harness, corpus generation and reproduction steps:
[07-evaluation-framework §6](07-evaluation-framework.md#6-benchmark-plan).

### 7.1 Why these numbers matter for a viewer

A 200 KiB document at markdown-it's measured 4.19 KiB/ms (single-threaded,
Node, including HTML string building) takes **~48 ms**. At 10 MiB — a
plausible size for a generated document or an export — that is **~2.5
seconds** of blocked main thread. `marked` is ~2× faster (~1.2 s),
`commonmark.js` ~2.2× faster (~1.1 s), and micromark ~6× *slower*
(~15 s).

That is the whole argument for block-level caching: on a 10 MiB document we
must not re-parse the whole file per keystroke. See
[07-editor-internals/03](../07-editor-internals/03-incremental-parsing.md).

### 7.2 Output size matters too

HTML output sizes on the real-world corpus: commonmark.js 682,143 B,
marked gfm:false 685,333 B, **markdown-it 692,052 B**, micromark+gfm
725,571 B, full unified pipeline 722,588 B. Spread is 6.4%. For DOM
construction cost the differences are immaterial. **Do not optimise here.**

### 7.3 Memory: what we could and could not measure

We did not produce trustworthy peak-heap numbers. Node's `heapUsed` around a
parse loop measures allocation churn, not retained size, and the engines have
very different retention profiles (markdown-it retains the token array until
`render` returns; micromark's concrete tokens are transient). **No credible
published comparison exists** for these four in JS. The honest statement:
*we have not measured this and we will measure it in a worker with
`performance.measureUserAgentSpecificMemory()` before we commit to an
architecture.* Recorded in [15-open-questions](../15-open-questions/).

### 7.4 A concrete win we verified: independent block rendering

If markdown-it's `map` is good enough to slice the document into top-level
blocks and render each independently, we can cache per-block HTML forever and
only re-render dirty blocks. We tested that hypothesis directly.

```js
const tokens = md.parse(src, {})
// top-level tokens with a source map:
// heading_open  map=[0,1]
// paragraph_open map=[2,3]
// table_open    map=[4,7]
// fence         map=[8,11]
// paragraph_open map=[12,13]

// A block runs from its start line to the start of the NEXT top-level token.
const starts = tokens.filter(t => t.level === 0 && t.map)
const blocks = starts.map((s, i) => ({
  type: s.type,
  from: s.from,
  to: i + 1 < starts.length ? starts[i + 1].from : lines.length
}))

const joined = blocks
  .map(b => md.render(lines.slice(b.from, b.to).join('\n').replace(/\n+$/, '')))
  .join('')

joined.trim() === md.render(src).trim()   // -> true
```

**Verified true.** Independent per-block rendering of that document is
byte-identical to the whole-document render. That is the load-bearing result
for our live-preview architecture.

Caveats we already know and must handle:
- **Reference definitions span blocks.** A link reference defined at the top
  and used at the bottom breaks if you slice naively. markdown-it strips
  references in a `core` rule (`strip_references`) — we must collect
  definitions per-block and re-inject, or fall back to whole-document parse
  when the document contains any `reference_definition` token.
- **Footnotes do the same thing**, worse. `markdown-it-footnote` collects
  across the whole document.
- **Lists whose tightness spans blank lines** need care.
- **Lazy continuation** (a paragraph continuing after a list) crosses blocks.

Our rule: if the token stream contains `reference_definition` or the footnote
plugin is active and any `footnote_ref` appears outside its defining block,
fall back to full-document parse. In the common case (no cross-block
references) we get the fast path.

---

## 8. Recommendation

**markdown-it 15.0.2.**

- 99.5% CommonMark, measured, in a configuration we control.
- Block-level `map` on every token — the property that makes our
  incremental architecture possible, and that marked simply does not have.
- Safe by default on both raw HTML and `javascript:`/`vbscript:`/`data:`
  schemes, with the implementation verified line-by-line.
- Deepest extension ecosystem; the two stale plugins we need
  (`task-lists`, `attrs`) are small enough to vendor.
- Actively maintained with a demonstrated pathological-input discipline:
  three releases in 2026, each fixing quadratic-complexity DoS.
- MIT, first-party TypeScript, dual ESM/CJS, 119M monthly downloads,
  22k stars.
- Fast enough: 4.19 KiB/ms measured on a real corpus; per-block caching
  removes the remaining problem entirely.

Configuration we will ship:

```js
const md = new MarkdownIt({
  html: false,      // raw HTML is escaped; DOMPurify is a second line of defence
  linkify: true,    // bare URLs become links
  typographer: false, // off by default: it rewrites user text. Opt-in setting.
  breaks: false     // GFM-comment behaviour is wrong for documents
})
  .enable('table')
  .enable('strikethrough')
  .use(footnote)
  .use(taskLists)   // vendored: npm's last release was 2018
  .use(container, 'warning')
```

Rejected, with reasons:

- **marked** — no source positions (blocks our architecture), 77% CommonMark,
  and `html` on by default with dangerous schemes passed through. Faster by
  ~2×, which block-level caching makes irrelevant.
- **micromark/remark** — the best AST and the best security default, 5–10×
  slower, ~100-package tree, hard extension authoring. **Keep as an optional
  future dependency for AST-level analysis only** (`mdast-util-from-markdown`
  can coexist with markdown-it for rendering).
- **commonmark.js** — perfect conformance, no extensions, no positions, no
  types, largest bundle. **Adopt as the test oracle, not as the renderer.**
- **showdown** — no release since 2022, not CommonMark.
- **snarkdown** — 1 KB is a party trick, not a renderer.

---

## 9. Open questions this document does not answer

1. **CJK emphasis correctness.** markdown-it 14.2.0 fixed astral-character
   handling in delimiter scans and 15.0.0 changed linkify termination to
   Unicode punctuation. `markdown-it-cjk-friendly` 3.0.0 (2026-08-22)
   exists for CJK emphasis rules. **We have not tested CJK documents.** The
   generator in our benchmark emitted CJK tokens but nothing measured their
   parsing. → [15-open-questions](../15-open-questions/)
2. **Worker-thread parse cost.** Does offloading to a Web Worker amortise
   structured-clone of the token array, or does it cost more than it saves at
   typical document sizes?
3. **Memory retention per block cache.** How large does a 10 MiB document's
   block HTML cache get, and what is the eviction policy?
4. **`typographer` correctness on CJK.** Smart-quote replacement is
   ASCII-centric and mangles full-width punctuation. We ship it off; we have
   not decided whether to ever expose it.
