# 01 — Rendering the AST to HTML

> The contract between a parser and a browser. Every node type, every wrapper
> element, every attribute, and exactly which characters get escaped.

This document specifies `packages/core`'s HTML renderer. It is normative: if the
output disagrees with this document, the output is wrong.

The renderer has three jobs and no fourth:

1. **Map each AST node to a fixed HTML element.** No node type may produce a
   tag that is not in the table below.
2. **Synthesise attributes from document content safely.** Heading `id`s,
   footnote links, `lang` from a code fence info string.
3. **Escape every text and attribute value.** No exceptions, no "this one is
   already safe."

It has **no** fourth job, and this is worth stating loudly because the pressure
to add one is relentless: **it does not decide what is safe to render.**
Sanitization is stage 6 ([02-sanitization.md](./02-sanitization.md)), a separate,
testable pass. Mixing them is how you end up with a renderer you cannot
security-audit.

---

## 1. Node-to-element mapping

The tables below use these conventions:

- `?` — attribute present only if the corresponding source construct carried it.
- `(sanitized)` — the value comes from the document and must pass the URL
  scheme allowlist ([02-sanitization.md §4](./02-sanitization.md#4-the-url-scheme-allowlist)).
- All text and attribute values pass through the escaper in §3.

### 1.1 Block nodes

| AST node | Emitted HTML | Attributes |
|-----------|--------------|------------|
| `document` | *(fragment; no wrapper element)* | — |
| `heading` level 1–6 | `<h1>` … `<h6>` | `id` (always, when heading anchors are on); `class="heading"` (optional theme hook) |
| `heading` with an explicit `{#custom-id}` (optional extension) | `<h1>` … `<h6>` | `id="custom-id"` — author value wins, still slugged/validated |
| `paragraph` | `<p>` | — |
| `thematicBreak` | `<hr>` | — |
| `blockquote` | `<blockquote>` | — |
| `codeBlock` | `<pre><code>` | `class="language-<lang>"` if info string has a language; `lang="<lang>"` if the language is a known-natural-language; `dir="rtl"` when detected |
| `codeBlock` with no info string | `<pre><code>` | — |
| `htmlBlock` (raw HTML pass-through) | the source bytes, verbatim | whatever the author wrote — **this is the danger**, see below |
| `table` | `<table>` | `<thead>` / `<tbody>` / `<tfoot>` emitted per §1.6 |
| `list` ordered | `<ol>` | `start` when the first item's number ≠ 1 |
| `list` unordered | `<ul>` | — |
| `listItem` | `<li>` | `class="task-list-item"` + child checkbox for GFM tasks (§1.5) |
| `footnoteDefinition` | `<section class="footnotes">` wrapping `<ol>` of `<li id="fn-N">` | see §1.7 |

**`htmlBlock` and `htmlInline` are the reason this application is dangerous.**
CommonMark 0.31.2 §4.6 defines HTML blocks as lines "treated as raw HTML (and
will not be escaped in HTML output)" — see
[the spec text](https://spec.commonmark.org/0.31.2/#html-blocks). Type 1 blocks
start on `<pre`, `<script`, `<style`, `<textarea`; type 6 blocks start on a
fixed list of tag names including `iframe`, `form`, `style`-adjacent
constructs. Type 7 blocks are "a complete open tag … or a complete closing tag
… followed by the end of the line", so *any* tag name starts one.

So the following is, per spec, not an error — it is a correctly parsed document:

````markdown
<script>alert(document.domain)</script>
````text

````markdown
<iframe src="https://evil.example/x.html"></iframe>
````

The renderer must emit these bytes unchanged and hand them to the sanitizer,
which will remove them. **A renderer that silently drops raw HTML is not
conformant with CommonMark and will produce visible diffs for legitimate
documents; a renderer that passes raw HTML through without a downstream
sanitizer is a remote code execution bug.** Both are wrong in different ways,
and we accept the CommonMark-conformant behaviour plus a hard sanitizer,
because "conformance" is what users' files actually depend on.

### 1.2 Inline nodes

| AST node | Emitted HTML | Attributes |
|-----------|--------------|------------|
| `text` | escaped text node | — |
| `softbreak` | `\n` (literal newline; CSS `white-space` handles rendering) | — |
| `hardbreak` | `<br />` | — |
| `emphasis` | `<em>` | — |
| `strong` | `<strong>` | — |
| `strikethrough` (GFM) | `<del>` | — |
| `inlineCode` | `<code>` | `class="language-<lang>"` if the span carries one |
| `link` | `<a>` | `href` (sanitized, required), `title` ? (sanitized), `rel` when `target` present, `target` only if we allow it (§1.8) |
| `image` | `<img>` | `src` (sanitized, required), `alt` (always emitted, possibly `""`), `title` ? , `width`/`height` ? when known, `loading="lazy"` by default |
| `autolink` `<http://…>` | `<a>` | `href` = the URL |
| `autolink` `<user@host>` | `<a>` | `href="mailto:user@host"` |
| `htmlInline` | source bytes, verbatim → sanitizer | — |

### 1.3 The required wrapper elements, and why each one is non-negotiable

Markdown's output is only "correct" relative to a renderer that understands
the subset of HTML Markdown produces. Two things make the choice forced:

**CommonMark 0.31.2 §1.3 states that the spec's HTML samples exist so you can
run its conformance tests against an implementation, and explicitly notes which
parts are *not* mandated** — for example, percent-encoding of non-ASCII
characters in URLs is a renderer choice:

> "not every feature of the HTML samples is mandated by the spec. For example,
> the spec says what counts as a link destination, but it doesn't mandate that
> non-ASCII characters in the URL be percent-encoded. … a conforming
> implementation can use a different renderer"

So: the *structure* (`<ul>` containing `<li>`, `<blockquote>` containing
blocks) is spec-mandated. The *serialization details* below are our choices,
and they exist to satisfy three constraints:

1. **Correct semantics for screen readers.** `<strong>` not `<b>`, `<del>` not
   `<strike>`, `<h1>`–`<h6>` in order.
2. **CSS we control.** Every styling hook is a `class` we chose, so a hostile
   document cannot smuggle in a `class="github"` and borrow our styling.
3. **Sanitizer compatibility.** Every emitted tag and attribute is in the
   allowlist ([02-sanitization.md §2](./02-sanitization.md#2-the-tag-and-attribute-allowlist)).
   A renderer that emits `<span style="…">` will have that attribute stripped,
   producing a visible regression that we would debug as "sanitizer bug" and
   wrongly relax the allowlist to fix. **This is the most likely way our own
   codebase will get compromised by an attacker: a rendering bug gets "fixed" by
   widening the allowlist.**

### 1.4 Code fences: `class` and `lang`

An info string like ```` ```rust,ignore ```` or ```` ```python title="x.py" ````
is a de-facto convention. We split on whitespace and commas, take the first
token, and:

```ts
function languageFromInfo(info: string | null): { lang: string | null; dir: 'ltr'|'rtl' } {
  if (!info) return { lang: null, dir: 'ltr' };
  const first = info.trim().split(/[\s,]+/)[0] ?? '';
  const lang = first.replace(/[^A-Za-z0-9_+#.-]/g, '');   // hard allowlist
  // Only a small set of human languages gets dir/lang; "auto" is not trusted.
  const rtl = new Set(['he','ar','fa','ur','yi','ps','dv','ku','sd','ug','hebrew','arabic']);
  const base = lang.split(/[-_+#.]/)[0].toLowerCase();
  return { lang: lang || null, dir: rtl.has(base) ? 'rtl' : 'ltr' };
}
```text

Three rules, all security-relevant:

- **The `class` value is filtered to `[A-Za-z0-9_+#.-]` before interpolation.**
  Otherwise ```` ```" onmouseover="alert(1) ```` becomes an attribute injection.
- **`lang` is a hint, not authority.** `lang="he"` on a code block does not make
  the *paragraph* RTL; it only helps screen-reader pronunciation of the code
  token. We do not set `dir` on prose.
- **We do not set `dir="auto"` on any node.** `dir="auto"` derives directionality
  from the first strong character of content, which is attacker-influenced. It
  enables "Trojan Source"-style confusion attacks (see
  [CWE-94-adjacent discussions of bidi control characters](https://cwe.mitre.org/data/published/cwe_v4.8.pdf),
  and Unicode's [UAX #9](https://www.unicode.org/reports/tr9/)). We set `dir`
  only from our own fixed language table above.

The full output shape:

```html
<pre><code class="language-rust" lang="rust" dir="ltr">fn main() {}</code></pre>
```

For a fence with no info string:

```html
<pre><code>plain</code></pre>
```text

For an info string we reject entirely (empty after filtering):

```html
<pre><code>plain</code></pre>
```

The code content itself is HTML-escaped (§3). This is not optional — it is the
one place where a renderer bug becomes an XSS, and `markdown-it` has a real,
documented CVE history in exactly this code path:
[CVE-2025-7969](https://nvd.nist.gov/vuln/detail/CVE-2025-7969) was filed
against the fence renderer in `lib/renderer.mjs` (the CNA, Fluid Attacks, later
disputed it; treat the class of bug as real regardless). Typora's
[CVE-2023-39703](https://nvd.nist.gov/vuln/detail/CVE-2023-39703) and
[CVE-2019-20374](https://nvd.nist.gov/vuln/detail/CVE-2019-20374) are the same
story at the application level.

### 1.5 Task lists (GFM)

```markdown
- [x] done
- [ ] not done
```text

Required output — this exact shape is what GitHub emits and what our stylesheet
targets:

```html
<ul class="contains-task-list">
  <li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled="" checked="" /> done</li>
  <li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled="" /> not done</li>
</ul>
```

Security notes:

- **`disabled` is mandatory.** Without it, a checked checkbox in a hostile
  document is a one-click script gadget (see DOMPurify's `autofocus` guidance in
  [02-sanitization.md §5](./02-sanitization.md#5-dom-purifys-threat-model)).
- **`checked` is the only author-controlled bit** and it is a boolean with only
  two legal serializations. The renderer must never emit `checked="<anything
  from the document>"`.
- **We do not use `<input>` in the allowlist unless we must.** If the sanitizer
  is configured without `input`, the checkbox vanishes and the list marker
  needs a CSS fallback. Decision: allow `input` but *only* with
  `type`/`checked`/`disabled`/`class`, and have the renderer emit nothing else.
  This is a place where the allowlist has to accommodate a Markdown feature, so
  it gets a test.
- **In the web build** the checkbox must not be interactive either. Reading mode
  is read mode.

### 1.6 Tables

GFM pipe tables. Required output shape:

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
| a    | b      | c     |
```text

```html
<table>
  <thead>
    <tr><th style="text-align:left">Left</th><th style="text-align:center">Center</th><th style="text-align:right">Right</th></tr>
  </thead>
  <tbody>
    <tr><td style="text-align:left">a</td><td style="text-align:center">b</td><td style="text-align:right">c</td></tr>
  </tbody>
</table>
```

The alignment question has three defensible answers, and we must pick one:

| Approach | Pros | Cons |
|----------|------|------|
| `align="left"` on `<th>`/`<td>` (HTML4) | matches some older renderers | presentational attribute, deprecated in HTML5, and `align` is not in most allowlists |
| `style="text-align:center"` | works everywhere, presentational | inline `style` — the exact attribute most sanitizers drop first |
| **`<th class="align-center">` + CSS** | no inline style, themeable, allowlist-safe | needs a stylesheet rule per alignment class |

**Recommendation: `<th class="md-align-center">`.** Our stylesheet owns:

```css
.md-align-left   { text-align: left; }
.md-align-center { text-align: center; }
.md-align-right  { text-align: right; }
```yaml

Rationale: `class` is on every allowlist, `style` is on none by default, and a
class is *ours* — a hostile document cannot use it to mean anything else because
we never grant class-driven behavior, only these four declarations. The
tradeoff is that an exported HTML file needs our stylesheet, which the export
stage inlines anyway ([05-export-and-print.md](./05-export-and-print.md)).

We emit `<thead>`, `<tbody>` explicitly. The HTML parser would insert them for
us, but doing it ourselves means the TOC builder, the print layout, and the
accessibility tree all see the same structure the sanitizer will see.

`colspan`/`rowspan`: GFM does not support them, and a Markdown table cannot
produce them. If a future extension does, they must be **integers clamped to a
small range** (say 1–1000) with no string passthrough.

### 1.7 Footnotes

```markdown
Text with a note.[^1]

[^1]: The note body.
```

```html
<p>Text with a note.<sup class="footnote-ref"><a href="#fn-1" id="fnref-1" role="doc-noteref">1</a></sup></p>
<section class="footnotes" role="doc-endnotes">
  <hr />
  <ol>
    <li id="fn-1" role="doc-endnote">
      <p>The note body. <a href="#fnref-1" class="footnote-backref" role="doc-backlink">&#8617;</a></p>
    </li>
  </ol>
</section>
```text

Both `id` and `name` matter here. DOMPurify's threat model calls `id` and `name`
on attacker content a **DOM clobbering** vector — `<img src=x name=getElementById>`
shadows properties on `document` and `window`, and code that reads
`document.foo` can be tricked. See
[DOMPurify §Prevent DOM Clobbering](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model)
and PortSwigger's
["DOM Clobbering strikes back"](https://portswigger.net/research/dom-clobbering-strikes-back).

Two mitigations, both mandatory:

1. **Do not emit `name` at all.** `<a name=…>` is obsolete; `id` is enough for
   fragment navigation. One clobbering surface instead of two.
2. **Prefix every generated `id`.** Heading ids get a `md-`-ish prefix (§4);
   footnote ids use `fn-`/`fnref-` which are already namespaced enough that no
   `document` property collides. Documented in markdown-it's own
   [safety notes](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md):
   "don't allow plugins to generate arbitrary element `id` and `name`. If those
   depend on user input — always add prefixes to avoid DOM clobbering."

A hostile document can still inject its *own* `<a name="getElementById">` —
that is raw HTML, and the sanitizer's job. Our job is to not make it easy.

### 1.8 Links: `target`, `rel`, and `noopener`

Default: **no `target`**, links open in the system browser via the shell, not in
the webview. Rationale in
[04-media-and-images.md §5](./04-media-and-images.md#5-links-clickjacking-and-external-navigation)
and
[11-security/02-webview-sandboxing.md](../11-security/02-webview-sandboxing.md).

If a future feature offers "open links in a viewer tab", the renderer must emit
`rel="noopener noreferrer"` unconditionally alongside `target="_blank"`, and
the sanitizer must be configured to keep `rel`. Without `noopener`,
`window.opener` is a reverse-tabnabbing primitive — the opened page can navigate
the viewer. Electron's security checklist calls this out explicitly: *"Do not use
`shell.openExternal` with untrusted content"*, and `<webview>` should not use
`allowpopups`.

`title` is emitted only if the link reference definition carried one, and it is
escaped like any attribute value.

### 1.9 Images

Rendered as `<img>`, never as a background-image in CSS, never as `<picture>`
with a `<source>` we generated.

```html
<img src="img/x.png" alt="A cat" title="hover" loading="lazy" decoding="async" />
```

- `alt` is **always present**, `alt=""` when the author gave none. A missing
  `alt` is an accessibility bug *and* an allowlist-surprise.
- The `src` value has already been rewritten to an app-internal URL by the
  media resolver ([04-media-and-images.md §2](./04-media-and-images.md#2-the-base-url-problem))
  before it reaches the sanitizer; the sanitizer then enforces the scheme
  allowlist on the result.
- `loading="lazy"` is set unless the image is above the fold, per
  [04-media-and-images.md §7](./04-media-and-images.md#7-large-images-and-lazy-loading).

---

## 2. `id` generation: the GitHub slugger algorithm

Heading anchors are the one place where the renderer derives an HTML attribute
from untrusted text and *must* produce something the sanitizer and the URL
parser both accept.

GitHub's algorithm is implemented in
[`github-slugger`](https://github.com/Flet/github-slugger). The whole thing,
decompiled from the published source:

```ts
import { regex } from './regex.js';   // a very large Unicode character class

const own = Object.hasOwnProperty;

export class BananaSlug {
  occurrences: Record<string, number>;
  constructor() { this.reset(); }

  slug(value: string, maintainCase = false): string {
    const self = this;
    let result = slug(value, maintainCase === true);
    const originalSlug = result;

    while (own.call(self.occurrences, result)) {
      self.occurrences[originalSlug]++;
      result = originalSlug + '-' + self.occurrences[originalSlug];
    }

    self.occurrences[result] = 0;
    return result;
  }

  reset() { this.occurrences = Object.create(null); }
}

export function slug(value: string, maintainCase = false): string {
  if (typeof value !== 'string') return '';
  if (!maintainCase) value = value.toLowerCase();
  return value.replace(regex, '').replace(/ /g, '-');
}
```text

And the character-stripping regex is generated, not hand-written. It is the
union of:

- `\0-\x1F` — C0 control characters
- a huge set of **Unicode punctuation and symbol blocks**: general punctuation,
  currency symbols, letterlike symbols, number forms, arrows, math operators,
  superscripts/subscripts, combining marks, geometric shapes, dingbats,
  Braille, and — crucially — **every CJK punctuation/symbol range**, plus
  Arabic, Hebrew, Devanagari, Thai, and general-category-symbol code points
- **surrogate-pair handling**: lone surrogates and specific low/high surrogate
  ranges are removed, plus unpaired-surrogate sequences

That last point matters for us: `String.prototype.toLowerCase()` and the regex
must agree, and a heading containing unpaired surrogates (which can come from a
mis-detected encoding, or from a crafted file) must not produce an `id` the URL
parser will mangle.

### 2.1 The five steps, stated plainly

1. **Lowercase.** `value.toLowerCase()` unless we deliberately preserve case.
   Note this is *Unicode* lowercasing, not ASCII.
2. **Strip.** Remove every character matching `regex` above — control chars,
   punctuation, symbols, and CJK punctuation. Letters, digits, whitespace, and
   combining marks survive.
3. **Spaces → hyphens.** `.replace(/ /g, '-')`. Only the **literal ASCII space
   U+0020**. Not tabs, not NBSP, not U+2009 thin space. This produces
   `my heading` → `my-heading` but `my heading` → `my heading` (unchanged,
   containing a non-ASCII space).
4. **Dedupe with a counter.** First occurrence gets the bare slug; second gets
   `-1`; third `-2`.
5. **Prefix.** We prepend a namespace prefix (`h-`) *after* dedupe, so a
   document cannot produce `id="main"` or `id="content"` and shadow our
   application chrome.

### 2.2 Dedupe, precisely

Note the subtle behaviour in the source: the counter is keyed on
`originalSlug`, and it is only consulted while the candidate is already taken:

```
"intro"        -> occurrences["intro"] = 0        -> id="h-intro"
"intro"        -> "h-intro" taken; occurrences["intro"]=1; candidate "intro-1"
                  occurrences["intro-1"]=0         -> id="h-intro-1"
"intro-1"      -> taken; occurrences["intro-1"]=1; candidate "intro-1-1"
                  occurrences["intro-1-1"]=0       -> id="h-intro-1-1"
```text

The third line is the interesting one: a document containing the literal
headings `intro`, `intro`, `intro-1` yields ids `intro`, `intro-1`,
`intro-1-1`. That is the real GitHub behaviour and matching it exactly matters
for anyone syncing anchors with GitHub-rendered documents.

`reset()` uses `Object.create(null)`, i.e. a **prototype-less** object, so a
heading named `constructor` or `__proto__` or `toString` does not collide with
`Object.prototype` members. This is the same class of bug as
[CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238) in DOMPurify,
where a `|| {}` fallback allowed `Object.prototype` pollution to disable
sanitization entirely. **Any counter map we build must be prototype-free.** We
state this in the code and test it with a heading literally named `__proto__`.

### 2.3 Escaping the slug

`slug()` output can still contain characters that need HTML-attribute escaping:
a literal `"` survives? No — `"` is in the stripped set. But `&`, `<`, `>` are
also stripped. What survives that is dangerous: characters like `` ` `` are
stripped, but non-ASCII letters survive and are legal in an `id`.

Still: **the slug is escaped like any attribute value before interpolation**,
because relying on "the regex removed the dangerous characters" is exactly how a
regex gets changed upstream and silently breaks us. Defense in depth, one line.

### 2.4 Empty slugs

A heading of only punctuation — `# !!!` or `# ---` — slugs to the empty string.
`id=""` is invalid and, in `document.getElementById`, meaningless but in
`querySelector('#')` an **invalid selector that throws**.

Rule: if the slug is empty after stripping, fall back to a positional id:

```
`h-${blockIndex}`
```text

and record that in the TOC entry so navigation still works. Never emit an empty
`id`, and never emit an `id` beginning with a digit without prefixing (CSS
selectors cannot start with a digit unescaped — the `h-` prefix handles this).

---

## 3. Escaping rules

There are two contexts in the renderer: text nodes and attribute values. They
use **different** escapers and the difference is load-bearing.

### 3.1 Text context

| Input character | Output |
|-----------------|--------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` (optional per spec, **we always do it**) |

`"` and `'` need no escaping in text content.

### 3.2 Double-quoted attribute context

| Input character | Output |
|-----------------|--------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |
| U+0000 | U+FFFD replacement character |
| other C0 controls | dropped, or replaced with U+FFFD |

We always quote attribute values with `"`. Single quotes are forbidden in
output. This is not a style preference — OWASP's guidance on
[HTML attribute context](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
is to use an attribute encoder *and* surround the value with `"` or `'`, and
fixing the quote character removes an entire class of "did we remember to
escape the other one" bug.

`>` is escaped in attributes too. Why? Because of the "dangling markup" /
post-XSS family: if sanitized output is later re-parsed in a context where the
attribute delimiter is not the one you assumed, an unescaped `>` is a live
payload. Cheap insurance; OWASP's
[OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
covers the class.

### 3.3 Never use `innerHTML` in the renderer

The renderer's job ends at "a string that is correct HTML". Inserting it is a
separate concern:

```ts
// Bad — the renderer and the DOM are now coupled, and this is a sink.
container.innerHTML = renderHtml(markdown);

// Good — sanitize, then insert, and never touch the string again.
const clean = DOMPurify.sanitize(renderHtml(markdown), CONFIG);
root.replaceChildren();            // clear
root.append(fragmentFrom(clean));  // or use RETURN_DOM_FRAGMENT
```

DOMPurify's own documentation of the safe recipe — `RETURN_DOM_FRAGMENT` skips
the serialize/reparse round trip entirely:

```js
const fragment = DOMPurify.sanitize(dirty, { RETURN_DOM_FRAGMENT: true });
element.replaceChildren(fragment);   // or element.appendChild(fragment)
```text

We use that form for the screen path. For the print and export paths we need a
string, and there we use `DOMPurify.sanitize()`'s string return and insert it
once, without post-processing.

---

## 4. Heading anchors and TOC generation, in full

The table of contents is not a rendering feature bolted on; it is a second
consumer of the *same* id-generation function as the heading `id` attributes. If
they disagree, every `#anchor` link in every exported file is broken.

```ts
export interface TocEntry {
  /** Depth: 1..6 */
  level: number;
  /** The rendered heading text, plain (no markup), for display */
  text: string;
  /** The id emitted on the <hN> element, and used as the fragment target */
  id: string;
  /** 1-based index of the heading block in document order */
  blockIndex: number;
}

export interface RenderResult {
  html: string;
  toc: TocEntry[];
  /** Ids in emission order; used to detect collisions after sanitization */
  emittedIds: string[];
}

const HEADING_SELECTOR = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]';

export function renderMarkdown(markdown: string, opts: RenderOptions = {}): RenderResult {
  const ast = parse(markdown, opts.parse);
  const slugger = new BananaSlug();        // prototype-free occurrence map
  const toc: TocEntry[] = [];
  const emittedIds: string[] = [];

  const ctx: TransformContext = {
    // A heading's slug comes from its *text content only* — never from raw
    // source, which may contain markup or raw HTML.
    headingText(h: HeadingNode): string {
      return inlineTextOf(h.children);
    },
    slugger,
    onHeading(level: number, id: string, text: string, blockIndex: number) {
      toc.push({ level, text, id, blockIndex });
      emittedIds.push(id);
    },
    nextBlockIndex: 0,
  };

  const transformed = transform(ast, ctx);       // assigns ids, resolves footnotes
  const html = serialize(transformed, opts.serialize);   // stage 5 output
  return { html, toc, emittedIds };
}
```

### 4.1 `inlineTextOf` — extracting the heading text

This is more subtle than `node.text`. Given a heading with inline children, the
text used for slugging must be the *rendered* text:

```ts
export function inlineTextOf(nodes: InlineNode[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text':        out += n.value; break;
      case 'inlineCode':  out += n.value; break;   // code *content*, not <code>
      case 'softbreak':
      case 'hardbreak':   out += ' '; break;
      case 'emphasis':
      case 'strong':
      case 'strikethrough':
      case 'link':        out += inlineTextOf(n.children); break;
      case 'image':       out += n.alt ?? ''; break;   // alt, not src
      // htmlInline contributes NOTHING. A heading containing
      //   # Hello <img src=x onerror=alert(1)>
      // slugs as "hello", and the raw HTML goes to the sanitizer as-is.
      case 'htmlInline':  break;
      default:            out += '';
    }
  }
  return out;
}
```text

Two deliberate choices:

- **`htmlInline` contributes nothing to the slug.** If it contributed its raw
  source, an attacker could inject `<a id="x" href="…">` text into an `id`
  attribute via a code path (heading text → slug → attribute) that does not go
  through attribute escaping correctly. Contributing nothing makes the slug a
  function of escaped-or-not text only.
- **`image` contributes `alt`.** GitHub's slug for `## ![cat](cat.png)` is
  `cat`. Matching this is worth a compatibility bug report.

### 4.2 Serializing the heading

```ts
function renderHeading(node: HeadingNode, ctx: TransformContext): string {
  const base = slug(node.text, /* maintainCase */ false);
  const slugged = ctx.slugger.slug(base);
  const id = `h-${slugged || String(ctx.nextBlockIndex)}`;   // prefix + fallback

  const attrs = ` id="${escapeAttr(id)}"`;
  ctx.onHeading(node.level, id, node.text, ctx.nextBlockIndex);

  return `<h${node.level}${attrs}>${renderInlines(node.children, ctx)}</h${node.level}>`;
}
```

Note the fallback uses `ctx.nextBlockIndex` — deterministic given the document,
so a re-render of the same bytes produces the same ids. **Id generation must be
a pure function of the document.** If it depended on render order across
multiple files, exported links would be unstable.

### 4.3 Filtering the TOC for the outline pane

Not every heading belongs in a table of contents. We need explicit, testable
rules:

```ts
export function tocForOutline(entries: TocEntry[], minLevel = 1, maxLevel = 4): TocEntry[] {
  // 1. Heading levels deeper than maxLevel are excluded from the pane but
  //    still get ids in the document (deep links must work).
  const kept = entries.filter(e => e.level >= minLevel && e.level <= maxLevel);
  // 2. Empty-text headings (### <img src=x>) are excluded from the pane:
  //    they render as an empty row.
  return kept.filter(e => e.text.trim().length > 0);
}
```text

Deep-link stability is the reason ids are emitted for **all six levels** even
though the pane shows four. A user who writes `<h6>` still expects
`file.md#h-something` to work from a shared link.

### 4.4 Scroll-spy, which depends on all of the above

```ts
export function observeHeadings(root: HTMLElement, toc: TocEntry[], onChange: (id: string) => void) {
  const byId = new Map(toc.map(e => [e.id, e]));
  const io = new IntersectionObserver((entries) => {
    // Pick the topmost intersecting heading, tie-broken by document order.
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    const first = visible[0];
    if (!first) return;
    const id = first.target.id;
    if (byId.has(id)) onChange(id);
  }, { rootMargin: '0px 0px -80% 0px', threshold: 0 });

  for (const el of root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)) io.observe(el);
  return () => io.disconnect();
}
```

`byId.has(id)` is a load-bearing guard, not a nicety: it means we ignore any
element that has an `id` but is not in *our* TOC — which includes raw HTML
anchors from the document. Without it, a hostile document can drive our UI state
with arbitrary elements.

---

## 5. Tables of the whole surface, for review

**Tags the renderer may emit.** If a code path emits anything else, that is a
bug. This list is a subset of the sanitizer's tag allowlist
([02-sanitization.md §2](./02-sanitization.md#2-the-tag-and-attribute-allowlist)),
deliberately.

```text
h1 h2 h3 h4 h5 h6
p br hr
ul ol li
blockquote
pre code em strong del
a img
table thead tbody tfoot tr th td
section sup ol li
(input)      ← GFM task lists only, see §1.5
(verbatim raw HTML from the document)  ← see §1.1
```

**Attributes the renderer may emit:**

```text
id            class
href          title         (a, img)
src           alt           (img)
width         height        (img)
lang          dir           (pre > code)
start                       (ol)
checked       disabled      (input[type=checkbox])
type                       (input[type=checkbox])
colspan       rowspan       (future table extension, integers only)
loading       decoding      (img)
rel            target       (a, only in the opt-in "open in tab" mode)
role                       (footnote accessibility)
```

**Attributes the renderer may never emit, even synthesized:**

```text
style          ← never. Alignment is classes (§1.6).
on*            ← never, for any reason.
name           ← never. Use id (§1.7).
srcdoc         ← never.
data-*         ← only for app-internal wiring, never from document content.
```

The last three lines are the ones that will be argued about in review. The
argument for each will be "it's just one attribute, and it's really useful."
The answer is the same each time: **the renderer output is attacker-controlled
input to the sanitizer, and every tag we add is a permanent expansion of the
attack surface we have to keep patched forever.** See
[11-security/01-threat-model.md §11](../11-security/01-threat-model.md#11-what-we-are-not-defending-against)
for the residual-risk accounting.

---

## 6. Verification

The renderer is spec-driven, so it is testable against spec:

- **CommonMark 0.31.2 §1.3 ships `spec_tests.py`** and a `spec.txt` with ~652
  examples, each with expected HTML. We run it against our renderer and treat
  every mismatch as a bug in our renderer until proven otherwise. Source:
  [spec.commonmark.org/0.31.2](https://spec.commonmark.org/0.31.2/).
- **GFM spec** for tables, task lists, strikethrough, autolinks, footnotes.
  [github.github.com/gfm/](https://github.github.com/gfm/).
- **Our own table tests** for the cases the specs do not cover:

| Test | Asserts |
|------|---------|
| ```` ```" onload="alert(1) ```` | output contains no `onload`, no stray attribute |
| `# !!!` | `id="h-<index>"`, not `id=""` |
| `# __proto__` | no prototype pollution; id is `h-__proto__` |
| `# intro` ×2 then `# intro-1` | ids are `h-intro`, `h-intro-1`, `h-intro-1-1` |
| `# <img src=x onerror=alert(1)>` | slug is `""`-derived fallback; raw HTML reaches sanitizer unchanged |
| `# 日本語 見出し` | CJK survives, CJK punctuation stripped |
| ```` ```he ```` | `lang="he" dir="rtl"` |
| ```` ```x"onmouseover=alert(1) ```` | filtered to `language-x` |
| heading with lone surrogate | no crash, no invalid id |
| two files rendered in sequence | second file's slugs unaffected by the first (slugger reset) |

## Sources

- CommonMark 0.31.2, §4.6 HTML blocks and §1.3 About this document —
  <https://spec.commonmark.org/0.31.2/#html-blocks>
- GitHub Flavored Markdown Spec — <https://github.github.com/gfm/>
- `github-slugger` source and generated regex — <https://github.com/Flet/github-slugger>
- `markdown-it` safety notes on generated `id`/`name` and DOM clobbering —
  <https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md>
- DOMPurify Security Goals & Threat Model (DOM clobbering, `id`/`name`,
  prototype pollution) — <https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model>
- OWASP XSS Prevention Cheat Sheet, output encoding and dangerous contexts —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- CVE-2025-7969, fence-renderer XSS in markdown-it (disputed, cited for the
  bug class) — <https://nvd.nist.gov/vuln/detail/CVE-2025-7969>
- CVE-2026-41238, DOMPurify default-config prototype-pollution bypass —
  <https://nvd.nist.gov/vuln/detail/CVE-2026-41238>
- CVE-2023-39703 and CVE-2019-20374, Typora XSS→RCE in an Electron app —
  <https://nvd.nist.gov/vuln/detail/CVE-2023-39703>,
  <https://nvd.nist.gov/vuln/detail/CVE-2019-20374>
- Unicode UAX #9, the bidirectional algorithm (why `dir="auto"` is not used) —
  <https://www.unicode.org/reports/tr9/>
