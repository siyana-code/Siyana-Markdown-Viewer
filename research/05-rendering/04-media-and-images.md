# 04 — Media and images

> `![](diagram.png)` is not a filename. It is a request to a file system, a
> network, or a document renderer — and which one depends on a decision we have
> not made yet.

---

## 1. What a Markdown image actually is

Per the CommonMark/GFM link grammar, an image destination is a **link
destination**: either `<…>`-wrapped, or a run of non-whitespace characters with
balanced parentheses. It may therefore be:

| Destination | Kind | Who loads it |
|-------------|------|--------------|
| `img/x.png` | relative path | the filesystem, resolved against the document's directory |
| `./img/x.png`, `../assets/y.png` | relative path with traversal | the filesystem, possibly **outside** the document's directory |
| `/usr/share/icons/x.png` | absolute path (Unix) | the filesystem, at an absolute location |
| `C:\Users\me\secret.png` | absolute path + drive letter (Windows) | the filesystem |
| `\\server\share\x.png` | UNC path (Windows) | a network share, authenticated as the user |
| `https://example.com/x.png` | remote | **the network** |
| `//example.com/x.png` | protocol-relative | **the network** |
| `data:image/png;base64,…` | inline | nothing; bytes are in the document |
| `file:///C:/…` | explicit file URL | the filesystem |
| `javascript:alert(1)` | a script URL | nobody, if we are sane |

Every one of those is legal Markdown that a real user will one day paste. The
renderer's job is to classify each and apply a policy, not to assume.

**The three questions to answer, in order:**

1. Where does this URL point? (scheme + resolved location)
2. Is the user permitted to load it, and did they consent to that class of load?
3. Through which API do we load it — the webview's own URL resolution, or a
   narrow native command that validates the path?

Question 3 is the one that is usually answered by accident.

---

## 2. The base-URL problem

Relative paths need a base. There are three candidate answers and each one has a
trap.

### 2.1 Option A: `<base href="file:///…">`

```html
<base href="file:///home/me/notes/" />
```

- **Pro:** one line; the HTML spec does all the resolution.
- **Con 1 — it rewrites every relative URL in the document**, including ones
  injected by raw HTML. DOMPurify's threat model calls `<base>` a landmine: "A
  single `<base href>` rewrites **every** relative URL in the document — resource
  loads, link targets, form actions." We would be doing to ourselves exactly
  what we forbade the document from doing.
- **Con 2 — `file://` origin.** `file://` URLs are opaque origins in Chromium;
  most of the security model we rely on does not apply, and Electron's own
  checklist says: "Avoid usage of the `file://` protocol and prefer usage of
  custom protocols."
- **Con 3 — changing documents means mutating the document head**, which fights
  any "one DOM per document" cache and reintroduces a window of time where the
  base is stale.
- **Con 4 — a document can also contain its own `<base>`** if the sanitizer ever
  regresses. We set `base-uri 'none'` in CSP as the mitigation, and we deny the
  `base` tag.

**Verdict: rejected.**

### 2.2 Option B: rewrite every `src` during transform

Resolve the relative path to an absolute app-internal URL before the sanitizer
sees it, and emit the resolved value as the `src`.

- **Pro:** no document-level state; resolution happens once, in the transform
  stage we already own ([05-rendering/01](./01-ast-to-html.md)); the sanitizer
  sees only fully-qualified URLs and its scheme check is trivially satisfied.
- **Con:** every `src` in *raw HTML* also needs rewriting, which means running a
  rewriter over document content — a second HTML parse, and a second place where
  a bug becomes an XSS.

**Verdict: partially adopted.** We rewrite `img` destinations in the AST, where
it is safe and free. Raw-HTML `img` elements are handled by the *native loader*
(option C) rather than by string rewriting.

### 2.3 Option C: a custom protocol that validates the path — **recommended**

Register a scheme (e.g. `mdimg://`) whose handler does the resolution and the
policy check in native code, then hands the browser bytes (or a validated URL)
for that one resource.

**Tauri** ships this shape: the `asset:` protocol plus
[`convertFileSrc`](https://v2.tauri.app/reference/javascript/api/namespacecore/#convertfilesrc),
gated on `app.security.assetProtocol`:

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "requireLiteralLeadingDot": true,
          "allow":  ["$HOME/Documents/**/*", "$HOME/notes/**/*"],
          "deny":   ["$HOME/**/.ssh/**", "$HOME/**/.aws/**", "$HOME/**/.config/**"]
        }
      }
    }
  }
}
```

Tauri's docs are explicit about two behaviours that matter:

- "Paths resolved when loading assets are usually absolute … A pattern like
  `["*/**"]` typically does not match those paths, because it does not line up
  with a leading `/` or a base-directory variable." A wrong glob silently blocks
  images, which users report as "images don't work."
- "deny takes precedence over allow when both match."
- On Unix, `requireLiteralLeadingDot` defaults to `true`, so `$HOME/**` will not
  match `/home/user/.cache/…` — which is *desirable*, but must be understood
  rather than discovered.

**Electron** equivalent: `protocol.handle()` with a registered scheme
(`protocol.registerSchemesAsPrivileged([{ scheme: 'mdimg', privileges: {
standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP:
false, corsEnabled: false } }])`) and a handler that resolves the path, validates
it, and returns the bytes. Electron's checklist prefers exactly this over
`file://`.

**The critical property:** validation happens in **native code**, on the
**resolved real path**, with **symlinks resolved first**, against an
**explicitly enumerated set of roots that the user has opened**. Not a prefix
check on the string.

### 2.4 The resolution algorithm

```ts
/**
 * Resolve an image destination from a Markdown document.
 * Returns null when the destination must not be loaded.
 */
export function resolveMediaUrl(
  dest: string,
  doc: { realDir: string; allowedRoots: string[]; policy: MediaPolicy },
): { kind: 'bytes'; url: string } | { kind: 'data'; mediaType: string; bytes: Uint8Array }
   | null {
  // 1. Strip ASCII whitespace and C0 controls. Browsers ignore them when
  //    resolving; a filter that doesn't strip them is bypassable.
  const cleaned = dest.replace(/[\u0000-\u0020\u007F-\u009F]/g, '');
  if (!cleaned) return null;

  // 2. Absolute URL? Classify by scheme. See 02-sanitization.md §4.
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) {
    const scheme = cleaned.slice(0, cleaned.indexOf(':')).toLowerCase();
    if (scheme === 'data') return parseDataImage(cleaned);   // §3
    if (scheme === 'file') return null;                      // never honour explicit file://
    if (scheme === 'http' || scheme === 'https') {
      return doc.policy.allowRemoteImages ? remotePlaceholder(cleaned) : null;
    }
    return null;                                             // javascript:, vbscript:, blob:, …
  }

  // 3. Protocol-relative: //host/path. Inherits our scheme; treat as remote.
  if (cleaned.startsWith('//')) {
    return doc.policy.allowRemoteImages ? remotePlaceholder(cleaned) : null;
  }

  // 4. Fragment-only or empty: not an image source.
  if (cleaned.startsWith('#')) return null;

  // 5. Local path. Resolve, canonicalize, then check containment.
  const joined = path.resolve(doc.realDir, cleaned);
  const real = fs.realpathSync.native(joined);   // resolves symlinks + .. + 8.3 names
  const rel = path.relative(doc.realDir, real);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;   // containment
  if (!doc.allowedRoots.some(r => isInside(real, r))) return null; // user's opened roots
  if (!ALLOWED_IMAGE_TYPES.has(extOf(real))) return null;          // extension allowlist
  return { kind: 'bytes', url: `mdimg://${encodePath(real)}` };
}
```

Steps 5's three checks are **independent** and all three are necessary:

- **Containment relative to the document directory** answers "does this document
  reach outside its own folder?"
- **Containment to `allowedRoots`** answers "did the user open this folder?"
- **Extension allowlist** answers "is this plausibly an image?" — it stops
  `<img src="../../../.ssh/id_rsa">` from being read into a `<img>` even if
  path containment somehow passed, and it means we never hand a `.html` or
  `.svg` to an image decoder.

Note that `fs.realpathSync.native` is called **before** the containment check,
not after. CWE-22's guidance is explicit: "Use a built-in path canonicalization
function (such as `realpath()` in C) that produces the canonical version of the
pathname, which effectively removes `..` sequences and symbolic links." A
prefix check on the *unresolved* string is a check on attacker-controlled text.

Full path-traversal treatment, including NTFS alternate data streams, device
paths, and Windows 8.3 short names, is in
[11-security/03-filesystem-safety.md §2](../11-security/03-filesystem-safety.md#2-path-traversal-and-the-windows-special-cases).

---

## 3. Data URIs

### 3.1 Allowlist, MIME types, and the SVG exclusion

`data:` is allowed **only** for `img[src]`, only for raster types, only
base64-encoded, and only under a size cap:

```ts
const DATA_IMAGE_RE = /^data:(image\/(?:png|jpeg|gif|webp|bmp|x-icon|vnd\.microsoft\.icon));base64,/i;
const MAX_DATA_IMAGE_BYTES = 8 * 1024 * 1024;   // decoded

function parseDataImage(u: string): … | null {
  if (!DATA_IMAGE_RE.test(u)) return null;                 // svg+xml, text/html, … all denied
  const b64 = u.slice(u.indexOf(',') + 1);
  let bytes: Uint8Array;
  try {
    // atob + explicit re-encode, or Buffer.from(b64, 'base64') in the native layer
    bytes = decodeBase64Strict(b64);
  } catch { return null; }
  if (bytes.byteLength > MAX_DATA_IMAGE_BYTES) return null;
  // Verify the sniffed type matches the declared type. A .png header on a
  // polyglot is the classic image-parser attack surface.
  const sniffed = sniffImageType(bytes);
  if (!sniffed || !DATA_IMAGE_RE.test(`data:${sniffed};base64,`)) return null;
  return { kind: 'data', mediaType: sniffed, bytes };
}
```

Two things here are not decoration:

- **Strict base64 decoding.** A lenient decoder silently ignores invalid
  characters, which means two different strings can decode to the same bytes —
  the classic filter-bypass shape. `CVE-2018-5773` in `markdown2` is the
  canonical historical example of a markdown sanitizer bypassed by a small
  syntactic variation (an omitted `>`).
- **Content sniffing and cross-checking the declared MIME type.** We do not
  hand bytes to the image decoder on the strength of a string the author wrote.
  Polyglot files (a valid PNG with a ZIP appended, an SVG with an embedded
  script) are the reason image decoders have their own CVE lists.

### 3.2 Why `image/svg+xml` is banned in `data:`

An SVG file is a document. It can contain `<script>`, `<foreignObject>`,
`<animate onbegin=…>`, event handlers, `<use href="…">` pointing at remote
content, and CSS `@import`. In `<img>` context browsers neuter script — but:

- the same string in `<object>`, `<iframe>`, a CSS `background-image` on an
  engine with different rules, or a third-party viewer that renders exported
  HTML, may not;
- "it works in `<img>`" is a property of the *consumer*, and we are building
  several consumers (screen, print, export) plus a future web build.

`markdown-it` bans `data:` except gif/png/jpeg/webp by default
([safety doc](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)),
and we match that set. Users who want SVG get it as a *file path* (§4), where we
can sanitize the file's contents.

### 3.3 Size

Base64 inflates 4/3. A 10 MB PNG in a document becomes ~13.3 MB in the HTML
string, in the DOM, in memory, and again in the export file. Policy:

| Data URI decoded size | Behaviour |
|-----------------------|-----------|
| ≤ 2 MB | render normally |
| 2 MB – 8 MB | render with a spinner, warn in the status bar |
| > 8 MB | refuse; show a clickable placeholder that offers "open externally" |

Refuse loudly. Silently truncating produces a corrupt image and a bug report
about "random Markdown files don't load".

---

## 4. SVG images

### 4.1 The risk

An SVG rendered from a file path is loaded as a **separate document**. In
Chromium and WebKit, an SVG loaded via `<img>` runs in a restricted mode: no
script, no external resource loading. That is a genuine mitigation.

It is not sufficient, for three reasons:

1. **The restricted mode depends on the context.** An SVG referenced from
   `<object data="x.svg">`, from a direct navigation, or from a third-party
   renderer is a full document with full privileges. Our export
   ([05-export-and-print.md §4](./05-export-and-print.md#4-single-file-html-export))
   produces a file that will be opened in a browser — and a base64-inlined SVG
   in an exported file is a full document.
2. **We may want to inline SVG someday** for theming (fill colours from CSS) or
   for icons. Inlining moves it from "image" context to "document" context, and
   the entire mXSS/namespace surface opens up
   ([02-sanitization.md §2.3](./02-sanitization.md#23-svg-and-mathml-the-classic-bypass-vector)).
3. **SVG is a documented XSS vector in applications.** An SVG carrying script,
   pasted into a Markdown document, executed in a renderer with `file://` or
   Node privileges, is RCE. We are building precisely that renderer.

### 4.2 The policy

**Preferred: rasterize on load, cache the raster.**

```ts
/** Returns a raster data URI. Never returns SVG bytes to the document. */
async function rasterizeSvg(bytes: Uint8Array, maxEdge = 2048): Promise<{
  dataUri: string; mime: string; width: number; height: number;
} | null> {
  // 1. Structural pre-check: reject before doing any expensive work.
  if (looksDangerous(bytes)) return null;
  // 2. Rasterize in an isolated, sandboxed context with no network and no
  //    filesystem: a headless Chromium page with <img src=blob:…>, or
  //    resvg on the Rust side (resvg does not execute script at all).
  const png = await renderToPngIsolated(bytes, { maxEdge });
  // 3. Sniff the result. If it is not a raster image, refuse.
  if (!sniffImageType(png)) return null;
  return { dataUri: `data:image/png;base64,${encodeBase64(png)}`, mime: 'image/png', … };
}
```

The structural pre-check is cheap and catches the obvious cases:

```ts
const SVG_DANGER = [
  /<script[\s>]/i,
  /<foreignObject[\s>]/i,
  /\son[a-z]+\s*=/i,             // event handler attribute
  /javascript\s*:/i,
  /<animate[\s>][^>]*\battributeName\s*=\s*["']?on/i,
  /<set[\s>][^>]*\battributeName\s*=\s*["']?on/i,
  /<use[\s>][^>]*\bhref\s*=\s*["']?\s*(?!#)/i,   // external use
  /<!ENTITY/i,                   // XXE / billion laughs
  /<!DOCTYPE[^>]*\[/i,
  /<image[\s>][^>]*\bhref\s*=\s*["']?\s*https?:/i,
  /@import/i,
  /xlink:href\s*=\s*["']?\s*javascript:/i,
];
```

Note what this is: a **belt**, not the sanitizer. Anything that survives it goes
to an isolated rasterizer that has no script execution capability at all.

**Fallback if rasterization is too heavy for v0.1:** load SVG as a file path
(via the scoped `mdimg:` protocol) into `<img>`, which gives us the restricted
mode, and additionally cap the file size, cap the rendered pixel dimensions,
and never inline SVG bytes into the export. Document the residual risk in
[15-open-questions](../15-open-questions/). Be explicit in the UI when a document
contains SVG, because it is the one image type where a user might reasonably
expect script to work and we will be refusing.

**Never:** set an `<img>`'s `src` to SVG bytes *and* give the document the
ability to inline them. And never allow `object`/`embed`/`iframe` so that an
SVG could be loaded as a document.

---

## 5. Links: clickjacking and external navigation

Links are the other media sink and the one most likely to be overlooked.

### 5.1 Never navigate the webview

```ts
// Bad — the document navigates our app window away from the app.
content.addEventListener('click', (e) => {
  const a = (e.target as Element).closest('a[href]');
  if (a) window.location.href = a.getAttribute('href')!;
});

// Good — classify, hand to the shell, keep the window.
content.addEventListener('click', (e) => {
  const a = (e.target as Element).closest('a[href]');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href')!;
  if (href.startsWith('#')) { scrollToFragment(href); return; }   // in-document
  if (!isExternal(href)) return;
  if (!confirmExternal(href)) return;                              // §5.3
  void openExternal(href);   // allowlisted scheme, via the shell plugin
});
```

Electron's checklist, verbatim, is the requirement: "Disable or limit
navigation", "Disable or limit creation of new windows", and "Do not use
`shell.openExternal` with untrusted content."

### 5.2 `shell.openExternal` is a launch primitive

`openExternal` hands a string to the OS. On Windows that is `ShellExecute`, which
will **run `file:` and UNC targets, and will happily open `.exe`, `.msi`, `.lnk`,
and `\\server\share\…`** — some of which prompt, some of which do not. Treat
every external URL as a launch request:

```ts
const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:']);

function isExternal(href: string): boolean {
  const cleaned = href.replace(/[\u0000-\u0020\u007F-\u009F]/g, '');
  let u: URL;
  try { u = new URL(cleaned); } catch { return false; }
  return EXTERNAL_SCHEMES.has(u.protocol);   // file:, javascript:, vbscript:, ms-msdt: all excluded
}
```

`ms-msdt:` deserves a specific mention: it is a Windows protocol handler that was
the basis of a widely-exploited RCE chain (Follina). Any allowlist that includes
"other Windows protocol handlers" inherits that. We allow exactly four schemes.

### 5.3 Confirmation, and the clickjacking shape

A `javascript:` href is inert now. But a *visual* attack survives: raw HTML can
position a full-viewport transparent link over the window.

```html
<a href="https://evil.example/fake-login"
   style="position:fixed;inset:0;z-index:99999;opacity:0">…</a>
```

Mitigation is not a sanitizer flag — it is that `style` is **forbidden**
([02-sanitization.md §2.2](./02-sanitization.md#22-our-allowlist)), so
`position: fixed` cannot be set from content. That is a concrete payoff for a
seemingly restrictive decision made elsewhere in the pipeline. The remaining
shape (a real link styled by our CSS) is handled by §5.2 and by showing the
target in the status bar on hover.

## 6. Remote images: should we load them by default?

**Arguments for loading by default:**

- Fidelity. Documents from the web (a README cloned from GitHub, a spec
  downloaded) reference remote badges and screenshots. Blocking them makes the
  viewer look broken for the most common real-world corpus of Markdown.
- Expectation. The user pressed Ctrl+V on a URL and asked for this document to
  open.
- It is what a browser does, so users' mental model transfers.

**Arguments against:**

- **Privacy.** Loading `https://tracker.example/pixel.gif?doc=…` leaks the user's
  IP address, User-Agent, and the fact that they opened a particular document, to
  whoever wrote it. For a Markdown viewer this is a genuine and underappreciated
  risk: a document is a *tracking surface* the user does not know they are
  offering. DOMPurify's non-goals list says it plainly: it "will **NOT** reliably
  stop HTML that requests external resources (tracking pixels, prefetch, etc.).
  There are too many ways to do it."
- **Offline breakage.** Most desktop use of a Markdown viewer is offline. A
  document with 40 remote images shows 40 broken-image placeholders and a long
  loading spinner.
- **SSRF-adjacent value.** A document that makes the renderer issue requests to
  attacker-chosen hosts lets an attacker (a) confirm the user's IP, (b) probe
  which hosts the user's network can reach (including `http://192.168.1.1/`,
  `http://localhost:*`, and cloud metadata endpoints
  `http://169.254.169.254/latest/meta-data/`), and (c) time the responses to
  measure latency. Even with `img-src` CSP blocking non-allowlisted hosts, the
  *allowlisted* case is enough for the IP leak.
- **Malformed-URL and parser exposure.** Every remote URL is parsed by the
  engine's network stack, redirect handling, and image decoder. That is attack
  surface we do not control, on inputs we did not write.

### 6.1 Recommendation: blocked by default, one click to load, per document

**Default: no remote images are loaded.** Remote `img` destinations are
rewritten to a local placeholder that shows the host and offers an explicit
"Load remote images" action for the document. Three states, remembered per
document path, not globally:

| State | When | What happens |
|-------|------|--------------|
| `off` (default) | never, or user said "not for this file" | placeholders only; **no network request at all** |
| `on` | user clicked "Load remote images" for this document | images load; `img-src` CSP widened to `https:` for the session, then restored |
| `off-once` | user clicked "Load" on a single placeholder | that one image loads; the rest stay blocked |

Implementation detail that matters: **the placeholder must not contain the real
URL in a way that triggers a fetch.** It shows a truncated host for the human and
keeps the full URL in a `data-` attribute we read — and it must not be an `<img>`
at all, because an `<img>` with a `srcset` or a `src` we later "restore" is a
fetch we said we would not do.

```text
┌────────────────────────────────────────────────────────────┐
│  ⛔  Remote image not loaded                                │
│      evil.example/track.gif                                 │
│      [ Load this image ]  [ Load all remote images ]       │
└────────────────────────────────────────────────────────────┘
```

Also show a per-document count in the status bar: "12 remote images blocked" —
transparency is what turns an annoyance into a feature.

**Rationale:** the fidelity cost is a visible placeholder with a button; the
privacy cost of the alternative is silent and permanent. Default to the
reversible one, and make reversing it trivial.

This is a **default**, not a hard rule. A settings option for
`media.remoteImages = 'block' | 'placeholder' | 'load'` ships in v0.1, and a
per-directory trust list is a v0.2 feature.

### 6.2 The `img-src` CSP consequence

Blocking at the app layer is not enough on its own, because raw HTML can also
request remote resources via `<img>`, CSS `background-image`, `<video poster>`,
and (before we forbade `link`) `rel=preload`. So the CSP must back it up:

```json
"img-src": "'self' asset: http://asset.localhost data: blob:"
```

Note there is **no `https:`** in the default CSP. When the user opts in to
remote images for a document, we temporarily widen `img-src` via the
platform's CSP-update API and restore it on navigation. This is a
**secondary** control — DOMPurify's non-goal about HTTP leaks means the primary
control must be the rewrite, and the CSP is the backstop for shapes we forgot.

## 7. Large images and lazy loading

```html
<img src="mdimg://…" alt="…"
     loading="lazy"
     decoding="async"
     width="1600" height="900" />
```

| Concern | Handling |
|---------|----------|
| **Decode cost** | `decoding="async"` keeps a 40 MP JPEG off the main thread. Without it, opening a document with big images drops frames for hundreds of ms |
| **Fetch cost** | `loading="lazy"` — but note lazy loading only works for images below the fold at load time; it does not defer in a virtualized list |
| **Layout stability** | `width`/`height` attributes when we can determine them (from the file header — see below) so the page does not reflow as images arrive. CLS is the single most complained-about Markdown-viewer issue |
| **Dimension cap** | Read the header before rendering; if either dimension exceeds a cap (say 12 000 px or 40 MP), refuse and offer "open externally". Decoders have their own integer-overflow CVE history, and a decompression bomb is a DoS |
| **First-screen images** | `loading="eager"` for the first N images or anything above the fold; pure-lazy looks broken on a fast scroll |

**Reading dimensions from headers.** For PNG, IHDR at bytes 16–23. For JPEG, walk
the segment chain to an SOFn marker. For GIF, bytes 6–9. For WebP, the VP8/
VP8L/VP8X chunk. This is ~150 lines and buys us both the dimension cap and
`width`/`height` for CLS avoidance.

**Virtualized lists and lazy loading.** In a document with 10 000 images, the
browser may still fetch all of them because `loading="lazy"` uses a generous
viewport margin. Our virtualizer must additionally set `src` to a placeholder
and swap in the real URL when the row enters the viewport — and clear it when it
leaves, if memory is a concern. See [10-performance](../10-performance/).

## 8. Broken image handling

A broken image is a normal condition, not an exception. It must never produce a
layout jump, an unhandled rejection, or an error dialog.

```css
.markdown-body img[data-state="pending"] {
  background: var(--bg-inset);
  min-block-size: 8rem;
  /* An animated shimmer, disabled under prefers-reduced-motion. */
}
.markdown-body img[data-state="error"] {
  /* The <img> is display:none; this sibling shows. */
  display: none;
}
.markdown-body .media-error {
  display: grid;
  gap: var(--space-3xs);
  place-items: center;
  padding: var(--space-m);
  background: var(--bg-inset);
  border: 1px dashed var(--border);
  border-radius: var(--radius-m);
  color: var(--fg-muted);
  font-size: 0.9em;
}
```

```html
<!-- generated by the app on the 'error' event -->
<div class="media-error">
  <span>⚠ Image not found</span>
  <code>img/diagram.png</code>
  <span>looked in <code>C:\Users\me\notes\</code></span>
  <button data-action="reveal">Show in file manager</button>
</div>
```

The "looked in" line matters more than it looks. A relative image in a document
opened from a different directory than the user expects is the single most
common support issue for any Markdown viewer, and printing the resolved directory
turns a mystery into a diagnosis.

`alt` text must remain visible on error — for a broken image with meaningful alt
text, showing the alt is strictly better than showing our error box. Rule: if
`alt` is non-empty, render it above the error box; otherwise render only the box.

## 9. Caching

Three distinct caches, with different lifetimes and different invalidation rules.

```ts
interface MediaCache {
  /** Resolved absolute path → bytes. The only cache that touches the disk. */
  disk: LruCache<string, Uint8Array>;      // 64 MB default, 512-byte blocks? no: 64 KB blocks
  /** Resolved absolute path → decoded dimensions. Cheap to keep forever. */
  meta: Map<string, { w: number; h: number; type: string; mtimeMs: number }>;
  /** Canonical URL of the document → its opened directory roots. */
  roots: Map<string, string[]>;
}
```

| Cache | Key | Invalidated by | Why |
|-------|-----|----------------|-----|
| Bytes | realpath + `mtimeMs` + `size` | stat mismatch | correct and cheap; `mtimeMs` misses sub-second rewrites, hence also keying on `size` |
| Dimensions | realpath | stat mismatch | avoids re-sniffing on every render |
| Remote | canonical URL, **in-memory only** | session end | never persist a remote image to disk: that turns our cache into a local tracking-pixel archive |
| Rasterized SVG | hash of source bytes + rasterizer version | both | the version key matters: improving the rasterizer must invalidate |

```ts
const key = `${realPath}:${st.mtimeMs}:${st.size}`;
```

**Never write a cache entry before validating it.** A cache populated from a
path that was inside the allowed root and later symlinked out must be re-checked
on read, not trusted because it is in the cache. Symlink swaps are exactly the
TOCTOU case in
[11-security/03-filesystem-safety.md §5](../11-security/03-filesystem-safety.md#5-toctou-and-concurrent-modification).

**Never cache an authorization decision.** `allowedRoots` is re-evaluated on
every access, not cached.

### 9.1 The export cache

For single-file HTML export, images must be inlined as base64 (§4 of
[05-export-and-print.md](./05-export-and-print.md#4-single-file-html-export)).
Base64 inflates 4/3, so a document with 20 MB of images produces a ~27 MB HTML
file. Policy:

| Total inlined bytes | Behaviour |
|--------------------|-----------|
| ≤ 16 MB | inline everything, one file |
| 16–64 MB | inline; warn with the resulting file size before writing |
| > 64 MB | refuse inline; offer "export with linked images" (a directory of assets) or "export HTML only, images omitted" |

## 10. Summary: the media decision table

| Destination | Default | Rationale |
|-------------|---------|-----------|
| relative path inside the document's directory | **load** via `mdimg:` | the point of the feature |
| relative path with `..`, still inside an opened root | **load** | Markdown legitimately does this; contained |
| absolute path, UNC path, `file://` | **refuse** | path traversal / local file exfiltration ([11-security/03](../11-security/03-filesystem-safety.md)) |
| outside all opened roots | **refuse** | least privilege |
| `.svg` | **rasterize**, then load | script inside SVG |
| `.html`, `.htm`, `.js`, `.exe`, `.lnk`, … | **refuse** | extension allowlist |
| NTFS ADS (`x.png::$DATA`), 8.3 name, `\\.\` device | **refuse** | `realpath` + extension check catch these; the ADS case is real — see [CVE-2026-53571](https://www.sentinelone.com/vulnerability-database/cve-2026-53571), where a Windows path-deny list was bypassed with `::$DATA` and 8.3 short names |
| `data:image/{png,jpeg,gif,webp,bmp}` | **load** under 8 MB | real feature; sniffed |
| `data:image/svg+xml`, `data:text/html`, `data:*` | **refuse** | script-bearing documents |
| `https:` / `http:` / `//host` | **blocked by default**, per-document opt-in | privacy, offline, SSRF-adjacent probing |
| `javascript:`, `vbscript:`, `blob:`, `about:`, anything unknown | **refuse** | allowlist |
| `.gif` over 20 MB, any image over the dimension cap | **refuse**, offer "open externally" | decompression bombs |

## Sources

- CommonMark 0.31.2 §4.6 HTML blocks (raw HTML pass-through) —
  <https://spec.commonmark.org/0.31.2/#html-blocks>
- GFM Spec §4.7 Images — <https://github.github.com/gfm/#images->
- Tauri, asset protocol scope —
  <https://v2.tauri.app/security/asset-protocol/>
- Tauri CSP (for the `asset:` source list) — <https://v2.tauri.app/security/csp/>
- Tauri JS API, `convertFileSrc` —
  <https://v2.tauri.app/reference/javascript/api/namespacecore/#convertfilesrc>
- Electron security checklist ("Avoid usage of the `file://` protocol",
  "Do not use `shell.openExternal` with untrusted content",
  "Do not disable webSecurity") — <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron `protocol` module / `registerSchemesAsPrivileged` —
  <https://www.electronjs.org/docs/latest/api/protocol>
- DOMPurify non-goals: HTTP leaks and tracking pixels; `<base>` as a landmine —
  <https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model>
- `markdown-it` safety, `data:` scheme policy —
  <https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md>
- CWE-22 Path Traversal — <https://cwe.mitre.org/data/definitions/22.html>
- CWE-59 Improper Link Resolution Before File Access (zip-slip, symlinks) —
  <https://cwe.mitre.org/data/definitions/59.html>
- CWE-69 Improper Handling of Windows `::DATA` Alternate Data Stream —
  <https://cwe.mitre.org/data/definitions/69.html>
- OWASP, Windows Alternate Data Streams attack —
  <https://owasp.org/www-community/attacks/Windows_alternate_data_stream>
- CVE-2026-53571, Vite `server.fs.deny` bypass via ADS and 8.3 short names —
  <https://www.sentinelone.com/vulnerability-database/cve-2026-53571>
- CVE-2018-5773, `markdown2` `safe_mode` XSS filter bypass —
  <https://github.com/advisories/GHSA-p6h9-gw49-rqm4>
- OWASP XSS Prevention Cheat Sheet, URL context —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
