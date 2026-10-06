# 04 · Accessibility

> **Standard:** WCAG 2.2, Level AA.
> **Research date:** 6 October 2026.

> ### Authority note
>
> [`11-security/`](../11-security/) owns the sanitizer threat model and the
> sandboxing story; [`05-rendering/02-sanitization.md`](../05-rendering/02-sanitization.md)
> owns the allow-list mechanics. **This document owns the conformance
> requirements, the semantic contract the sanitizer must not break, and the
> webview accessibility-tree risk.** §2 restates the allow-list only to make the
> accessibility argument; where the two disagree, `05-rendering/02` wins on
> mechanics.

---

## Table of contents

1. [Which standard, and when was it published](#1-which-standard-and-when-was-it-published)
2. [Semantic HTML is the product](#2-semantic-html-is-the-product)
3. [Focus management](#3-focus-management)
4. [Landmarks and heading hierarchy](#4-landmarks-and-heading-hierarchy)
5. [Live regions: file watching made audible](#5-live-regions-file-watching-made-audible)
6. [Reduced motion](#6-reduced-motion)
7. [Target size](#7-target-size)
8. [Reflow at 320 CSS px](#8-reflow-at-320-css-px)
9. [The webview accessibility tree risk](#9-the-webview-accessibility-tree-risk)
10. [Screen-reader testing protocol](#10-screen-reader-testing-protocol)
11. [The full conformance checklist](#11-the-full-conformance-checklist)

---

## 1. Which standard, and when was it published

**Verified (W3C WAI, *What's New in WCAG 2.2*):**

- "WCAG 2.2 was published as a 'W3C Recommendation' web standard on
  **5 October 2023**."
- "WCAG 2.2 provides **9 additional success criteria** since WCAG 2.1."
- "The 2.0 and 2.1 success criteria are essentially the same in 2.2, with one
  exception: **4.1.1 Parsing is obsolete and removed from WCAG 2.2**."
- The nine new criteria are: **2.4.11 Focus Not Obscured (Minimum) (AA)**,
  **2.4.12 Focus Not Obscured (Enhanced) (AAA)**, **2.4.13 Focus Appearance
  (AAA)**, **2.5.7 Dragging Movements (AA)**, **2.5.8 Target Size (Minimum)
  (AA)**, **3.2.6 Consistent Help (A)**, **3.3.7 Redundant Entry (A)**,
  **3.3.8 Accessible Authentication (Minimum) (AA)**, **3.3.9 Accessible
  Authentication (Enhanced) (AAA)**.

**Verified:** SC 2.5.8 Target Size (Minimum) is "at least **24 by 24 CSS
pixels**, except when…" (W3C, *Understanding SC 2.5.8*). Level **AA**.

**WCAG 3** exists as a working draft but is not a Recommendation and does not
replace 2.2. **Target: WCAG 2.2 AA.**

### Why a *reading* app has an unusually high bar

This deserves its own paragraph because it is not obvious.

A typical app can be inaccessible in a way users work around: a mislabelled
icon is annoying; an unannounced toast is missed. **A reading app's entire value
is the delivery of text to a person.** Remove the semantics and you have not
degraded the product, you have removed it for a subset of users.

| Degradation elsewhere | Degradation in a viewer |
|---|---|
| A colour token is slightly off | The reader cannot read the words |
| A menu item has no accessible name | The reader cannot find the navigation |
| Focus order is odd in one dialog | The reader cannot reach half the document |
| A missing `alt` | The reader cannot know what a diagram shows — and in a doc about a system, the diagram *is* the content |

Concretely, for our audience:

- **Dyslexia and low vision** — need reflow at 320 px, 200% zoom without loss
  of content, and a theme with real contrast control. Every default we ship is
  a decision about these users.
- **Screen reader users** — the entire UI must be reachable and describable, and
  the document must be semantic. Not "nice for them"; the product.
- **Motor impairment** — every action keyboard-reachable; a drag-only reorder is
  a *blocked* feature, not a degraded one. (This is exactly why
  [02 §3.3](02-navigation-and-find.md#33-drag-to-reorder--and-why-it-is-a-mistake-in-a-viewer)
  recommends against drag-only interactions.)
- **Cognitive** — reduced motion, no auto-advancing anything, a focus mode that
  genuinely removes distraction, and a reading position that survives a crash.
- **Photosensitive epilepsy** — no flashing, no large-area rapid luminance
  change. A "typewriter mode" that scrolls the viewport is a trigger risk.

The practical consequence: **accessibility work here is mostly rendering-pipeline
work and CSS work, done once, correctly.** That is a good deal.

---

## 2. Semantic HTML is the product

### 2.1 We get most of it for free — and that is the point

A correct Markdown renderer emits:

```html
<article class="doc">
  <h1 id="installation">Installation</h1>
  <p>…</p>
  <h2 id="linux">Linux</h2>
  <ul><li>…</li></ul>
  <table><thead><tr><th scope="col">…</th></tr></thead>
    <tbody><tr><td>…</td></tr></tbody></table>
  <blockquote><p>…</p></blockquote>
  <figure><img src="…" alt="…"><figcaption>Figure 1 — …</figcaption></figure>
  <pre><code class="language-rust">…</code></pre>
</article>
```

A screen reader, a search engine, a print stylesheet, a browser's find-in-page,
and every assistive technology built since 1998 all understand that. **If our
renderer is correct, we are accessible for free.** That is the single largest
lever available to us and it costs nothing.

### 2.2 So why does every Markdown viewer get this wrong

Because it is easier to strip. Concretely, these are the three ways teams break
the free win:

| Mistake | Consequence |
|---|---|
| Allow-list sanitization of HTML *tags* only (`<h1>`…`<h6>`, `<p>`, `<ul>`… but no `<figure>`, no `<caption>`, no `<thead>`, no `<sup>`, no `<section>`) | The document loses structural meaning. A table becomes a grid of `<div>`s and a screen reader announces nothing useful |
| Strip `role` and `aria-*` unconditionally | Every ARIA annotation our renderer adds is deleted, and — worse — our *own* future annotations cannot work |
| Strip `id` and `class` "because they're not content" | **Anchor links break.** `#installation` stops working. And `class` is how syntax highlighting, footnote numbering, and theme overrides work |

### 2.3 The sanitizer allow-list we must ship

**The rule: the sanitizer is a semantic-preserving sanitizer.** Its job is to
remove *scripting and exfiltration* vectors, not to normalise markup.

**Allowed unconditionally:**

| Category | Elements |
|---|---|
| Structure | `article section header footer main nav aside h1 h2 h3 h4 h5 h6 p div span hr br` |
| Lists | `ul ol li dl dt dd` |
| Tables | `table caption colgroup col thead tbody tfoot tr th td` |
| Text semantics | `strong em b i u s del ins mark small sub sup abbr cite q dfn time data kbd samp var` |
| Links/media | `a img figure figcaption picture source video audio track` |
| Code | `pre code kbd samp` |
| Document | `details summary` |
| Math/Mermaid | the KaTeX and Mermaid output roots — **which must be allow-listed as an explicit, audited subtree, never `svg`/`math` wholesale** |

**Attributes allowed:** `id`, `class` (a documented, non-arbitrary prefix set),
`href`, `src`, `srcset`, `sizes`, `alt`, `title`, `lang`, `dir`,
`colspan`, `rowspan`, `scope`, `headers`, `start`, `reversed`, `type`
(restricted), `value`, `checked`, `disabled`, `open`, `colspan`,
`role`, and **every `aria-*` attribute**.

**Explicitly denied:**

| Denied | Why |
|---|---|
| `style` | CSS-based attacks: `url()` exfiltration of attribute values, UI overlay, clickjacking, `position: fixed` chrome spoofing. This is the highest-value single denial. It is also why user themes are *JSON tokens*, not CSS — see [03 §4](03-theming.md#4-themes-as-data-not-code) |
| `on*` event handlers | Script |
| `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<frame>`, `<frameset>` | Script and framing |
| `<form>` and form controls except the disabled checkbox used by task lists | Credential phishing inside a document reader is a real attack (see [11 security](../11-security/)) |
| `<link>`, `<meta>`, `<base>` | Style injection, base-URI hijack |
| `href` with `javascript:`, `data:`, `vbscript:`, `file:` | Script and local-file read |
| `src` with anything but the app's own asset/media scheme | Same |
| `target` other than `_blank` with `rel="noopener noreferrer"` | Reverse-tabnabbing |
| `xmlns` on arbitrary elements | Namespace confusion |
| Unknown `data-*` | Payload smuggling; only our own documented `data-*` keys allowed |
| `aria-*` with an **unknown** value | An `aria-label="button"` on a `<div>` produces a broken widget; validate against the ARIA value space |

**Two additional rules:**

1. **`id` values must be re-namespaced or at least validated.** Author-supplied
   ids must be filtered to `[A-Za-z][\w-]*` and de-duplicated. An id of
   `__proto__` or one that collides with an app id (`app`, `search-panel`,
   `shortcut-sheet`) is a bug and a small attack surface.
2. **Sanitize *after* rendering every extension.** KaTeX, Mermaid, and the
   syntax highlighter all inject HTML. The sanitizer is the last step, always,
   with no exceptions and no "this output is trusted" bypass.

The recommended engine is **DOMPurify** — **verified** from its README as
"a DOM-only, super-fast, uber-tolerant XSS sanitizer for HTML, MathML and SVG",
at **version v3.4.16**, licensed **MPL-2.0 OR Apache-2.0** (a dual
copyleft-permissive grant, comfortably compatible with an MIT project, provided
we comply with the MPL file-level requirements for any files we modify).

---

## 3. Focus management

### 3.1 Rules

| # | Rule | Why |
|---|---|---|
| 1 | **Skip link first in the DOM.** `<a class="skip-link" href="#doc-content">Skip to document</a>` as the first focusable element, visible on focus | Bypass blocks. In a long document this is the difference between usable and not |
| 2 | Focus order follows DOM order. Never use `tabindex` > 0 | WCAG 2.4.3 Focus Order |
| 3 | `tabindex="-1"` only, for programmatic targets (the document container, the search panel heading) | |
| 4 | Every modal traps focus, and on close **returns focus to the invoker** | The single most-tested a11y rule in practice |
| 5 | Every panel that expands gets `aria-expanded` on its trigger and `aria-controls` pointing at the panel | |
| 6 | Nothing receives focus on app load except `document.body` (and only to allow `Esc`). **Never auto-focus the TOC, never auto-focus search** | Auto-focus on load is disorienting and causes accidental input |
| 7 | `:focus-visible` styling with a **≥ 3:1 contrast ring against adjacent colours** and a ≥ 2 px thickness — see [03 §8](03-theming.md#8-auditing-our-own-brand-palette) | 2.4.7 Focus Visible (AA). **2.4.13 Focus Appearance is AAA in 2.2**, so there is no AA threshold — but a ring you cannot see fails 2.4.7 in practice |
| 8 | Never remove the focus outline without an equally visible replacement | The single most common a11y regression in "polished" apps |
| 9 | Focus must not be obscured by sticky chrome — **2.4.11 Focus Not Obscured (Minimum), new in 2.2, Level AA** | A sticky TOC or toolbar must not cover the focused element. Use `scroll-margin-top`/`scroll-padding-top` equal to the chrome height |
| 10 | On navigating to a new document, move focus to the document container (which has `tabindex="-1"`) and announce the new document in a live region | A screen reader user otherwise has no idea anything happened |
| 11 | The lightbox, the search palette, and the shortcut sheet each need their own documented focus-management behaviour, tested | |
| 12 | Focus ring must be visible on **every** interactive element including inside code blocks, tables, footnotes, and the image lightbox | |

### 3.2 The skip link, concretely

```html
<a class="skip-link" href="#doc">Skip to document</a>
…
<main id="main">
  <aside id="toc" aria-label="Table of contents"> … </aside>
  <article id="doc" class="doc" tabindex="-1" aria-labelledby="doc-title">
    <h1 id="doc-title">Installation</h1>
    …
  </article>
  <aside id="backlinks" aria-label="Backlinks"> … </aside>
</main>
```

```css
.skip-link {
  position: absolute; inset-inline-start: 0; inset-block-start: 0;
  transform: translateY(-120%);
  background: var(--color-bg); color: var(--color-link);
  padding: .5rem .75rem; border: 2px solid var(--color-focus-ring);
  z-index: 100;
}
.skip-link:focus-visible { transform: none; }
```

Two more skip links are justified: "Skip to table of contents" and "Skip to
search", for readers who mostly use navigation.

---

## 4. Landmarks and heading hierarchy

### 4.1 Landmarks

| Element | `role` / element | Label |
|---|---|---|
| Document | `<main>` | — (one per window) |
| Table of contents | `<nav>` | `aria-label="Table of contents"` |
| Backlinks | `<aside>` or `<nav>` | `aria-label="Backlinks"` |
| Search panel | `<search>` or `<form role="search">` | `aria-label="Search"` |
| File tree | `<nav>` | `aria-label="Files"` |
| Header/toolbar | `<header>` + `role="toolbar"` for button groups | `aria-label="Document toolbar"` |
| Status / announcements | `<div role="status">` | |
| Progress | `<div role="progressbar">` | |

`<search>` is now a real HTML element; feature-detect or use
`role="search"` for older engine support.

**Exactly one `<main>` per window.** If we later have a split view, the two
documents are two `<article>` elements inside one `<main>`, or two `<main>`s
each in its own document region — but not two `<main>`s with no distinction,
which breaks landmark navigation.

### 4.2 Heading hierarchy

**We cannot fix the author's Markdown, but we can make our output navigable.**

| Situation | What the renderer must do |
|---|---|
| Author starts at `##` (no `#`) | Emit as authored. Do **not** inject an `<h1>`; that changes the outline the author wrote. But *do* render the document's own title in the chrome (from front matter or the filename) as a visually-hidden `<h1>` **outside** the document article, or as the app-level page heading |
| Heading levels skip (`#` → `###`) | Emit as authored, but **mark the jump** with a `data-skip-level` attribute so the UI can (a) style it and (b) offer a "fix heading levels" affordance in editing mode. Do not silently renumber — that lies about the source |
| Multiple `h1` in one document | Allowed in HTML5 within a `<section>`, and common in Markdown. Our article has one visual `<h1>`; the rest render as authored. Screen readers handle multiple `h1`s inside a landmarked `<article>` acceptably |
| Heading text is empty (`##` alone) | Emit `<h2 id="auto-generated-id" class="empty-heading" aria-label="Empty heading"></h2>`. Do not let it vanish — an empty heading is content, and it appears in the TOC |
| Heading contains only an image or only markup | Preserve the markup inside the heading, and give the heading a sensible accessible name |

The rule that matters: **the heading tree our TOC shows must be the heading
tree a screen reader user sees.** One source, the AST. See
[02 §3](02-navigation-and-find.md#3-the-table-of-contents).

### 4.3 Screen-reader-optimised mode

Offer a toggle that: sets `lang` from front matter or a per-document setting;
removes decorative iconography from the a11y tree (`aria-hidden="true"` on all
chrome glyphs); ensures every link has either text or an `aria-label`; exposes
heading levels visually; and marks external links with `(opens in browser)`.

---

## 5. Live regions: file watching made audible

This is a genuinely novel a11y problem for this app, and nobody else has
solved it well because nobody else re-renders content under the user.

### The scenario

The reader is mid-paragraph. A file watcher fires because `git pull`, a
syncthing client, or a colleague's save changed the file on disk. The app
re-renders. **The reader's cursor is now at the top of a document they have not
finished reading.**

For a sighted reader this is disorienting but recoverable — they see the
scroll jump and scroll back. For a screen reader user it may be worse: focus
may be destroyed, and if the whole article node is replaced, the virtual
cursor can be dropped entirely.

### The rules

| # | Rule |
|---|---|
| 1 | **Never auto-reload a document that has been scrolled away from the top** without the reader's consent |
| 2 | Detect "reader is reading" = the user has scrolled, selected text, or focused inside the document |
| 3 | If reading: do **not** re-render. Show a non-intrusive banner — "This file changed on disk. [Reload] [Show diff] [Ignore]" — with a keyboard shortcut |
| 4 | The banner must be a `role="status"` live region (polite), so it is announced once without stealing focus |
| 5 | If reload is confirmed: preserve scroll offset *by heading anchor*, not by pixel, because the document may have shifted. Restore focus to the element that had it, matched by a stable identifier if possible |
| 6 | If re-render happens and focus *was* inside the document, after the re-render restore focus to the nearest equivalent element and announce it |
| 7 | Every announcement must be a **human sentence**, not a log: "Installation updated on disk" — not "reload" and not "MD5 changed" |
| 8 | Announce only once per change burst. Debounce file-watcher events (300 ms) so a `git checkout` does not produce forty announcements |
| 9 | An `aria-live="assertive"` region is **forbidden** in the normal reading path. Use it only for errors the user must act on now |
| 10 | The reload action must be reachable by keyboard and by a documented shortcut |
| 11 | A "never reload while reading" setting, default on, with a "always reload" option for people who want it (some do — this is a preference, not a defect) |

### The DOM contract

```html
<div role="status" aria-live="polite" class="sr-only" id="announcer"></div>
…
<div id="reload-banner" role="status" hidden>
  <p>This file changed on disk.</p>
  <button type="button" id="reload-now">Reload</button>
  <button type="button" id="reload-dismiss">Keep reading</button>
</div>
```

One subtlety: **a live region must exist in the DOM *before* the text is
inserted into it.** Creating an element and immediately writing to it does not
reliably announce in all screen readers. Both regions above are always
present.

---

## 6. Reduced motion

**Verified:** `prefers-reduced-motion` is Baseline ***Widely available*** per
MDN — "It's been available across browsers since January 2020" — and "is used
to detect if a user has enabled a setting on their device to minimize the
amount of non-essential motion… Such animations as scaling or panning large
objects can be vestibular triggers."

### What must change

| Motion | Default | Under `reduce` |
|---|---|---|
| Smooth scroll to an anchor | `scroll-behavior: smooth` | `auto` (instant jump) |
| Anchor `#` fade-in | 120 ms opacity | none |
| Lightbox open | scale 0.96 → 1, 150 ms | opacity only, 0 ms, or instant |
| Panel slide | 200 ms transform | none |
| Reading-position "jump to last position" offer | animated | instant, or no animation |
| TOC current-section indicator | animated colour | instant |
| Diagram pan/zoom inertia | enabled | disabled |
| Theme change cross-fade | 0 ms anyway | n/a |
| **Typewriter mode auto-scroll** | continuous scroll of the active line | **disabled entirely** — this is the highest-risk motion in the app |
| Any auto-playing / auto-advancing content | never used | never used |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

The blanket rule above is the community-standard snippet. It is *not* enough
on its own: JS-driven motion (smooth scrolling, inertia, drag physics) is not
affected by it, so every JS animation path must consult
`window.matchMedia('(prefers-reduced-motion: reduce)')` itself. Centralise that
in one helper and lint for direct `requestAnimationFrame` animation loops.

**Also relevant:** `prefers-contrast: more` and `prefers-forced-colors`. Under
forced-colors mode, all our carefully chosen backgrounds are replaced by system
colours — we must ensure borders and focus indicators survive, which means
using system colour keywords in forced-colors mode rather than relying on
`border-color` alone. Ship the high-contrast theme from
[03 §9](03-theming.md#9-a-curated-starter-set).

---

## 7. Target size

**Verified:** SC 2.5.8 Target Size (Minimum) — "the size of the target for
pointer inputs is at least **24 by 24 CSS pixels**, except when…" Level AA.
New in WCAG 2.2.

The listed exceptions include: equivalent targets, inline links in a sentence,
user-agent-controlled sizing, essential cases, and **spacing** (a target under
24×24 passes if a 24px-diameter circle centred on it does not intersect
another target's circle).

### Where we will get this wrong

| Element | Risk | Fix |
|---|---|---|
| Heading anchor links (`#`) | Typically 16×16 | Give the anchor a `padding: 4px` and `min-width/min-height: 24px`, with `margin: -4px` so it does not shift layout |
| Code-block copy button | Frequently 20×20 or a 16px icon | `min-inline-size: 24px; min-block-size: 24px`; use 32×32 for comfort |
| Task-list checkboxes | Native checkbox is ~13×13 | Wrap in a `<label>` with a 24×24 hit area |
| Table row toggles (collapsible rows) | Small chevrons | 24×24 minimum |
| TOC collapse triangles | 12px chevrons | 24×24 hit area via a padding box |
| Carousel / diagram zoom buttons | 28px is fine | ✅ |
| Toolbar icon buttons | Usually fine | Audit anyway |
| Code-block language badge | Not interactive → **exempt** | Non-interactive text is not a target |
| Mermaid pan handles | Not a target if the whole diagram is draggable | ✅ |

For touch (the future mobile app), 2.5.8's 24px is a *floor*, not a target —
aim for 44×44.

---

## 8. Reflow at 320 CSS px

**Verified:** WCAG 2.2 SC **1.4.10 Reflow, Level AA** requires content to be
presentable without loss of information or functionality at **320 CSS px**
width (equivalent to a 1280px viewport at 400% zoom) without two-dimensional
scrolling, except for content that "requires two-dimensional layout for usage
or meaning" (which includes data tables, code, and preformatted text).

### The layout budget at 320 px

| Element | Strategy |
|---|---|
| Page padding | `0.875rem` (14 px) each side → 292 px of content |
| Measure | `100%`; the `68ch` constraint must yield to the viewport |
| TOC / file tree / backlinks panels | Become off-canvas sheets, or tabs. Never a column |
| Side-by-side view | Becomes a tab switcher |
| Tables | In a focusable horizontal scroll region (the 1.4.10 exception) |
| Code blocks | Automatically wrap below `--code-min-width`, per [01 §6](01-reading-ux.md#6-code-blocks-for-reading) |
| Long unbroken strings (URLs in prose) | `overflow-wrap: anywhere` on paragraphs |
| Headings | Never below 1.25rem; a heading that wraps to 3 lines is a heading that is too big |
| Font size | Do **not** reduce the body size at narrow widths. Reduce the padding instead |
| Touch targets | 44×44 |
| `position: fixed` elements (toolbar) | Never cover more than ~15% of the viewport height; every one of them needs 2.4.11 compliance |
| `100vw` usage | **Never** — `100vw` includes the scrollbar width and causes horizontal overflow. Use `100%` or `100dvw` |

### Reflow is also a desktop requirement, not just a mobile one

400% browser zoom on Windows is a *desktop* accessibility setting people
actually use. So:

- Test the app at `Ctrl/Cmd + +` until 400% with a 1280×1024 window and assert
  zero horizontal page scroll.
- **All UI must be built in `rem`, not `px`**, for text. Spacing may be `rem`
  too, for simplicity.
- No fixed-height containers around text.
- No `user-scalable=no` and no `maximum-scale` in the `<meta viewport>` — this
  is a WCAG 1.4.4 failure (1.4.4 is **Resize Text**: text must be resizable up
  to **200%** without loss of content or functionality) and it is also an
  Apple App Store review rejection for the future iOS app.

---

## 9. The webview accessibility tree risk

**This is the highest-risk unknown in this entire research folder, and it must
be spiked before the desktop framework decision in
[08-desktop-frameworks](../08-desktop-frameworks/) is locked.**

### The question

An Electron or Tauri window is a Chromium/WebKit render surface hosted inside a
native window. **Does the operating system's screen reader see the DOM as a
native accessibility tree, or as one opaque "web view" widget?**

If the answer is "opaque widget", then we can satisfy every WCAG criterion in
this document inside the DOM and still ship an app that is completely
unusable with NVDA or VoiceOver. No amount of CSS or ARIA fixes that.

### What is verified

**Electron (verified, from `docs/tutorial/accessibility.md`):**

> "Electron applications will automatically enable accessibility features in
> the presence of assistive technology (e.g. JAWS on Windows or VoiceOver on
> macOS). See Chrome's accessibility documentation for more details."

> "You can also manually toggle these features either within your Electron
> application or by setting flags in third-party native software."

> "By using the `app.setAccessibilitySupportEnabled(enabled)` API, you can
> manually expose Chrome's accessibility tree to users in the application
> preferences. **Note that the user's system assistive utilities have priority
> over this setting and will override it.**"

The docs also give the macOS escape hatch: third-party AT can enable
accessibility in an Electron app by setting the `AXManualAccessibility`
attribute on the app's `AXUIElement`, with Objective-C and Swift examples
provided.

**So on Electron, the architecture supports it, and Chromium's accessibility
tree is exposed through `app.setAccessibilitySupportEnabled()`.** That is a
strong positive signal. It is *not* a guarantee that the tree is *good*, nor
that auto-detection works reliably on every Windows configuration.

**Tauri (partially verified, and this is the weak spot):**

- Tauri uses the **system webview**: WebView2 on Windows, WKWebView on macOS,
  WebKitGTK on Linux (`tauri-apps/wry`).
- The mapping from DOM to platform accessibility API is:
  **WKWebView → NSAccessibility**, **WebView2 → UI Automation**,
  **WebKitGTK → AT-SPI**. *(This mapping is asserted by third-party sources;
  we did not find it stated in Tauri primary documentation. Treat as
  **UNVERIFIED**.)*
- Tauri's own docs list a **macOS only** accessibility-caveat area but the
  `wry` and Tauri docs do not publish a cross-platform accessibility
  guarantee. **UNVERIFIED.**
- The macOS-specific `AXManualAccessibility`-equivalent concern does not apply,
  because WKWebView is the system's own web engine and VoiceOver drives it the
  way it drives Safari.

**The Linux case is the real risk.** WebKitGTK's AT-SPI bridge has a history of
incomplete mappings. A Chromium headless spike on Linux CI will *not* find
this, because Chromium headless has no AT-SPI integration at all. It must be
tested on a real GNOME/KDE desktop with Orca or Accerciser, on the distro's
actual WebKitGTK version.

### The spike

A two-day, pre-commitment spike. Build the smallest possible Electron **and**
Tauri app that renders a document with:

| Element | What we are testing |
|---|---|
| A heading hierarchy with an `<h1>` and three `<h2>`s | Does a screen reader enumerate headings? |
| A paragraph, a list, a link with accessible text | Basic text + link |
| A table with `scope="col"` headers | Does the table expose as a table with headers? |
| An `<img alt="…">` | Is alt text announced? |
| An ARIA live region | Does the announcement fire? |
| A `role="status"` banner shown dynamically | Announcement reliability |
| A `<figure>` / `<figcaption>` | Is the caption associated? |
| A `role="doc-endnotes"` footnote list | Are the ARIA roles honoured? |
| A focusable scroll region for tables | Is it announced as a region and reachable? |
| A `role="toolbar"` | Toolbar pattern support |
| `lang="zh-Hans"` on a sub-span | Language switching announcement |

Test matrix:

| Platform | Shell | Screen reader |
|---|---|---|
| Windows 11 | Electron **and** Tauri | **NVDA** (primary; free) and JAWS if a licence is available |
| macOS | Electron and Tauri | **VoiceOver + Safari** (VoiceOver + Chromium is a different and worse combination — verify which one we target) |
| Linux (GNOME, Ubuntu LTS) | Tauri (WebKitGTK) | **Orca**; Accerciser for tree inspection |
| Linux (KDE Plasma) | Tauri (WebKitGTK) | Orca |

**Pass criteria:** every element above is reachable, correctly named, and
correctly typed by the screen reader; `app.setAccessibilitySupportEnabled(true)`
and auto-detection both work; focus is not trapped; the live region announces.

**Fail criteria and their consequences:**

| Failure | Consequence |
|---|---|
| Electron + NVDA fails | Block the Electron decision; re-test Tauri on Windows (WebView2 + UIA) |
| Tauri + WebView2 + NVDA fails | This would be severe — Windows is our first target. Investigate hard |
| Tauri + WebKitGTK + Orca fails | Ship Linux with a documented, honest accessibility statement ("screen-reader support on Linux is experimental") rather than silently claiming AA. **A stated limitation is acceptable; a silent one is not** |
| Live regions unreliable everywhere | Fall back to `accessibilitySupport` detection via `dom.automation`, or accept a degraded (but still useful) experience and document it |

### Belt-and-braces measures regardless of the spike result

1. **Never use canvas for text.** If any part of the document were rendered to
   `<canvas>` — for a minimap, for a diagram, for a PDF preview — that content
   is *invisible* to every screen reader and to browser find-in-page. Never.
2. **Never render text as an image.** No screenshot-based "render the doc to a
   bitmap" fast path, even as a performance optimisation.
3. **Mermaid output must have a text alternative.** A rendered SVG diagram is a
   single opaque node to most screen readers. Ship the Mermaid source in a
   `<details>` labelled "View diagram source" immediately after the figure.
4. **KaTeX output must have a text alternative.** KaTeX renders a visual
   formula plus a MathML tree plus an `aria-label` carrying the raw TeX.
   Ensure the MathML is not stripped by the sanitizer and that the
   `aria-label` survives.
5. **Provide a "copy as plain text" / "view source" affordance.** Even a
   perfect a11y tree is slow for reading a whole document linearly; the ability
   to dump the sanitized plain text is a universal fallback.
6. **Keep a documented, always-reachable "Accessibility" section in Help** with
   the tested screen reader / browser combinations.

---

## 10. Screen-reader testing protocol

### The combinations that matter

| Platform | Screen reader | Browser / shell | Priority |
|---|---|---|---|
| Windows | **NVDA** (free) | Firefox (best-tested pairing) and Chromium/Electron | **P0** |
| Windows | JAWS | Chromium/Electron | P1 (if a licence is obtainable) |
| macOS | **VoiceOver** | **Safari** | **P0** |
| macOS | VoiceOver | Chromium/Electron | P1 |
| iOS | VoiceOver | Safari (the future mobile app) | P2 |

Note that NVDA's primary development target is Firefox, and NVDA+Chromium is a
less-tested combination. **For web content development, test in Firefox with
NVDA, and separately verify the Electron/Chromium packaging** — they are not
the same target.

### What to actually test, in order

| # | Test | Success |
|---|---|---|
| 1 | Load a document. Without touching the mouse, can you hear that it loaded, and its title? | Announcement via live region or `aria-labelledby` on the `<main>` |
| 2 | Can you get a list of headings for the document? | `H` in NVDA / `VO+Cmd+H` in VoiceOver produces the real outline |
| 3 | Can you navigate by landmark (main, navigation, search, complementary)? | Yes, and each is labelled |
| 4 | Navigate into a table. Are headers announced as headers? | Yes — proves the renderer emitted `scope` |
| 5 | Navigate an image. Is the alt read? Is a missing alt announced? | Yes / yes |
| 6 | Navigate to a footnote reference. Is it announced as a note reference? | Yes — proves `role="doc-noteref"` survived sanitization |
| 7 | Follow a link to an anchor in another file. Is the new document announced and focused? | Yes |
| 8 | Trigger the file-reload banner. Is it announced without stealing focus? | Yes, politely |
| 9 | Open the search panel with the keyboard. Is focus inside? `Esc` — is focus back where it was? | Yes |
| 10 | Open the lightbox with the keyboard. Is focus trapped? Is `Esc` returning focus to the image? | Yes |
| 11 | Tab through the entire UI. Is the order logical? Is anything skipped? Is anything focusable that should not be? | Yes |
| 12 | Zoom to 400%. Is there horizontal scroll? Is anything clipped? | No |
| 13 | Set `prefers-reduced-motion`. Does smooth scroll stop? | Yes |
| 14 | Read a Mermaid diagram. Is the source available as text? | Yes |
| 15 | Read a KaTeX formula. Is the TeX available as text? | Yes |
| 16 | Turn on the browser's own accessibility inspector (Firefox: `about:accessibility`) or Chromium DevTools a11y pane and check for **serious/critical** issues | Zero |

### Tooling

| Tool | Use |
|---|---|
| Firefox `about:accessibility` | Full ARIA tree inspection, no install |
| Chromium DevTools → Elements → Accessibility pane | Quick pass/fail with contrast warnings |
| **axe DevTools** | Automated pass over every screen; run in CI as a smoke test |
| Lighthouse a11y score | CI gate; note it only catches ~30–40% of real issues |
| Pa11y CI | Automated regression gate |
| Manual NVDA / VoiceOver / Orca | **The only way to catch 60–70% of issues.** Automated tools are necessary and not sufficient |

**CI policy:** automated axe/Lighthouse must be **zero serious and zero
critical** on the document page, the settings page, and the search palette.
Manual screen-reader testing is a **release checklist item**, signed off, per
platform — not a nice-to-have.

---

## 11. The full conformance checklist

A consolidated list, each line testable. Level AA unless noted.

| # | SC | Requirement | Where handled |
|---|---|---|---|
| A1 | 1.1.1 | Non-text content has a text alternative | Renderer; image policy; Mermaid `<details>`; KaTeX `aria-label` |
| A2 | 1.3.1 | Info and relationships are determinable from markup | Semantic renderer; `scope` on `<th>`; `<figure>`/`<figcaption>` |
| A3 | 1.3.2 | Meaningful sequence | DOM order = source order; no `flex-direction: row-reverse` or `order` on document content |
| A4 | 1.3.3 | Sensory characteristics | "Scroll down to the bottom" never appears as the only instruction |
| A5 | 1.3.4 | Orientation | No orientation lock; works in portrait and landscape |
| A6 | 1.3.5 | Identify input purpose | N/A (read-only) — revisit when editing ships |
| A7 | 1.4.1 | Use of colour | Focus is not colour-only; errors are not colour-only; code tokens are not the only signal |
| A8 | 1.4.2 | Audio control | N/A — no audio |
| A9 | 1.4.3 | Contrast (Minimum) 4.5:1 | Theme CI gate — [03 §8](03-theming.md#8-auditing-our-own-brand-palette) |
| A10 | 1.4.4 | Resize text to 200% | `rem` everywhere; no `user-scalable=no` |
| A11 | 1.4.5 | Images of text | Diagrams-as-image allowed (they *are* content); UI chrome must be text, not images |
| A12 | 1.4.10 | Reflow at 320 CSS px | [§8](#8-reflow-at-320-css-px) |
| A13 | 1.4.11 | Non-text contrast 3:1 | `--border-strong`, `--focus-ring`, code block boundary, checkbox outline |
| A14 | 1.4.12 | Text spacing | No `!important` fixed heights on text containers; line-height can be overridden by the user |
| A15 | 1.4.13 | Content on hover or focus (dismissible, hoverable, persistent) | Footnote popups and link previews must be dismissible with `Esc`, hoverable, and persist |
| A16 | 2.1.1 | Keyboard | Every action; the table scroll region is focusable |
| A17 | 2.1.2 | No keyboard trap | Dialogs trap intentionally and release; the lightbox releases on `Esc`; **verify WebKitGTK has no trap** |
| A18 | 2.1.4 | Character key shortcuts | A single-character shortcut (`j`, `k`, `g`, `[`, `]`, `f`) must be disable-able or remappable — **this is a real Level A requirement and single-letter bindings violate it by default.** Ship a "single-key shortcuts: off / on" setting |
| A19 | 2.2.1 | Timing adjustable | No timeouts anywhere in the reading path |
| A20 | 2.2.2 | Pause, stop, hide | No auto-playing content; any transient tooltip is dismissible |
| A21 | 2.3.1 | Three flashes | Nothing flashes |
| A22 | 2.4.1 | Bypass blocks | Skip links — [§3.2](#32-the-skip-link-concretely) |
| A23 | 2.4.2 | Page titled | Window title updates to `<filename> — <app>` |
| A24 | 2.4.3 | Focus order | DOM order |
| A25 | 2.4.4 | Link purpose in context | Link text is meaningful standalone, or gets an `aria-label` |
| A26 | 2.4.5 | Multiple ways | TOC + outline + search + heading nav + file tree — five routes, satisfies 2.4.5 for the document |
| A27 | 2.4.6 | Headings and labels | Headings describe their section; buttons are verb+noun ("Reload document", not "OK") |
| A28 | 2.4.7 | Focus visible | `:focus-visible` ring, ≥ 3:1 |
| A29 | **2.4.11** | **Focus Not Obscured (Minimum) — AA, new in 2.2** | `scroll-padding-top`; sticky chrome offset |
| A30 | 2.5.1 | Pointer gestures | Every drag has a single-pointer alternative; no pinch-only zoom on desktop |
| A31 | 2.5.2 | Pointer cancellation | Use `pointerup`/`click`, not `mousedown` |
| A32 | 2.5.3 | Label in name | Accessible name contains the visible label text |
| A33 | 2.5.4 | Motion actuation | Shake/tilto gestures have button equivalents |
| A34 | **2.5.7** | **Dragging Movements — AA, new in 2.2** | Any drag (reorder, TOC collapse, splitter) needs a non-drag alternative: a button, or a keyboard move |
| A35 | **2.5.8** | **Target Size (Minimum) 24×24 — AA, new in 2.2** | [§7](#7-target-size) |
| A36 | 3.1.1 | Language of page | `lang` from front matter or a setting; per-block `lang` preserved |
| A37 | 3.1.2 | Language of parts | Preserved and not stripped |
| A38 | 3.2.1 | On focus | No context change on focus |
| A39 | 3.2.2 | On input | No context change on input — **the search box must not navigate as you type** |
| A40 | 3.2.3 | Consistent navigation | Same order in every panel |
| A41 | 3.2.4 | Consistent identification | Same icon and name for the same function everywhere |
| A42 | 3.2.6 | Consistent Help — A, new in 2.2 | Help is reachable from every screen in the same place |
| A43 | 3.3.1 | Error identification | File-watcher and render errors described in text, with a suggested fix |
| A44 | 3.3.2 | Labels or instructions | Every input labelled; the search box says what it searches |
| A45 | 3.3.3 | Error suggestion | Broken anchors get "did you mean" |
| A46 | 3.3.4 | Error prevention | Deleting/overwriting is confirmed or undoable |
| A47 | **4.1.2** | Name, Role, Value | Every widget; `aria-expanded` on toggles |
| A48 | — | (4.1.1 Parsing is **removed** in 2.2) | No obligation, but keep the HTML valid anyway |
| A49 | AAA (2.4.13) | Focus Appearance | Nice-to-have: consistent indicator shape across the app |
| A50 | AAA (2.4.12) | Focus Not Obscured (Enhanced) | Already met by A29 in practice |

**Two lines deserve emphasis:**

- **A18 (2.4.1 Character Key Shortcuts)** — the single-letter bindings in
  [02 §6](02-navigation-and-find.md#6-the-keyboard-model) (`j`, `k`, `g`, `f`)
  are a genuine Level A violation unless they can be turned off. Ship the
  setting, and make "on" opt-in for users who did not previously have those
  bindings.
- **A34 (2.5.7 Dragging Movements)** — this is the standards reason behind
  [02 §3.3](02-navigation-and-find.md#33-drag-to-reorder--and-why-it-is-a-mistake-in-a-viewer).
  Even if we shipped drag-to-reorder, it would need a keyboard equivalent. The
  argument for not shipping it at all in a read-only viewer is now backed by a
  success criterion rather than taste.

---

## Summary of the three highest-risk items

| # | Risk | Impact | Mitigation | Spike |
|---|---|---|---|---|
| 1 | **The webview a11y tree is not exposed** on some platform/shell/AT combination | The app is unusable with a screen reader regardless of our HTML quality | Test early, publish an honest support matrix | [§9](#9-the-webview-accessibility-tree-risk) — **do this before locking the framework** |
| 2 | **The sanitizer strips semantics** we depend on | Silent loss of headings, tables, footnotes, figure captions, and anchor ids | Semantic-preserving allow-list, CI test that asserts a specific semantics-preserving fixture | [§2](#2-semantic-html-is-the-product) |
| 3 | **The theme palette fails contrast** (as measured: `muted` 3.39:1, `accent` 4.19:1) | AA failure on captions and links for every user | Role-split tokens + CI gate | [03 §8](03-theming.md#8-auditing-our-own-brand-palette) |

## Sources

- W3C WAI, "What's New in WCAG 2.2" — "WCAG 2.2 was published as a 'W3C Recommendation' web standard on 5 October 2023"; the nine new criteria; "4.1.1 Parsing is obsolete and removed from WCAG 2.2" — <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
- W3C, `WCAG 2.2` (W3C Recommendation) — <https://www.w3.org/TR/WCAG22/>
- W3C WAI, "Understanding SC 2.5.8: Target Size (Minimum)" — "at least 24 by 24 CSS pixels, except when…", Level AA — <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- W3C WAI, "Understanding SC 1.4.10: Reflow" — 320 CSS px and the two-dimensional-layout exception — <https://www.w3.org/WAI/WCAG21/Understanding/reflow.html>
- W3C, `WCAG2Mobile` — applying WCAG 2.2 to native applications, including 2.5.8 — <https://www.w3.org/TR/wcag2mobile-22/>
- MDN, `prefers-reduced-motion` — Baseline *Widely available* "since January 2020" — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- WAI-ARIA 1.2, document-content concepts (`doc-noteref`, `doc-endnotes`, `doc-footnote`) — <https://www.w3.org/TR/wai-aria-1.2/#document_concept>
- WAI-ARIA Authoring Practices Guide — dialog, toolbar, region and disclosure patterns — <https://www.w3.org/WAI/ARIA/apg/>
- DOMPurify — "a DOM-only, super-fast, uber-tolerant XSS sanitizer for HTML, MathML and SVG", version v3.4.16, licence MPL-2.0 OR Apache-2.0 — <https://github.com/cure53/DOMPurify>
- Electron, "Accessibility" tutorial — "Electron applications will automatically enable accessibility features in the presence of assistive technology (e.g. JAWS on Windows or VoiceOver on macOS)"; `app.setAccessibilitySupportEnabled(enabled)`; "the user's system assistive utilities have priority over this setting and will override it"; the macOS `AXManualAccessibility` Objective-C and Swift examples — <https://github.com/electron/electron/blob/main/docs/tutorial/accessibility.md>
- Chromium, "Accessibility" design document (how Chrome detects assistive technology) — <https://www.chromium.org/developers/design-documents/accessibility/>
- `tauri-apps/wry` — the cross-platform webview library: WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux — <https://github.com/tauri-apps/wry>
- Tauri v2, "Webview versions" — "The diverse nature of the Linux ecosystem makes it very hard to compile accurate information about WebKitGTK on the various distros" — <https://v2.tauri.app/reference/webview-versions/>
- **UNVERIFIED:** the DOM → platform accessibility API mapping (WebView2 → UI Automation, WKWebView → NSAccessibility, WebKitGTK → AT-SPI) is asserted by third-party sources but not stated in Tauri primary documentation. This is exactly the gap §9 spikes, and it is the reason the spike must happen before the framework decision is locked.
- NVDA User Guide — <https://nvdac.nvaccess.org/user-guide/>
- axe-core / axe DevTools — <https://github.com/dequelabs/axe-core>
- Lighthouse accessibility auditing — <https://developer.chrome.com/docs/lighthouse/overview>
- Pa11y CI — <https://github.com/pa11y/pa11y-ci>
- Existing internal documents this section defers to: `05-rendering/02-sanitization.md` (allow-list mechanics) and `11-security/` (threat model, sandboxing)
