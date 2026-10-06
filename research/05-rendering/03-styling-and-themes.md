# 03 — Styling and themes

> A Markdown viewer is a reading tool. Everything here is in service of the
> sentence on the screen.

---

## 1. Layered CSS: reset, tokens, content, components, print

Five stylesheets, loaded in this order, each with one job. The layering matters
because it is what lets a theme be **data** instead of **code**.

```html
<link rel="stylesheet" href="/css/reset.css" />
<link rel="stylesheet" href="/css/tokens.css" />
<link rel="stylesheet" href="/css/content.css" />
<link rel="stylesheet" href="/css/components.css" />
<link rel="stylesheet" href="/css/print.css" media="print" />
```text

| Layer | Job | Ships to the user? |
|-------|-----|--------------------|
| `reset.css` | remove user-agent styling so our rules are the only ones | no |
| `tokens.css` | `:root { --fg: …; --measure: …; }` and the theme definitions | partly — custom properties, so a theme is a small file |
| `content.css` | typography for the rendered Markdown, scoped to `.markdown-body` | no |
| `components.css` | app chrome: sidebar, TOC, toolbar, search | no |
| `print.css` | `@page`, break control, chrome hiding | no |

The scoping rule — every rule in `content.css` is prefixed with `.markdown-body`
— is not tidiness. It means (a) document content can never style app chrome, and
(b) app chrome can never accidentally style document content. A hostile document
cannot add a `class="sidebar"` to an element and have it match our layout,
because a document element is inside `.markdown-body` and `.sidebar` is outside.

## 2. Resetting user-agent styles

The user-agent stylesheet is a browser's opinion about how HTML should look,
and it differs per engine. WebKit, Gecko, and Blink disagree about `<h1>` margins,
list indentation, `<small>` sizing, and `<table>` border behaviour. If we style on
top of it, our output differs per platform for reasons that have nothing to do
with our design.

```css
/* reset.css */
*, *::before, *::after { box-sizing: border-box; }

html {
  -webkit-text-size-adjust: 100%;      /* stop iOS inflating text in landscape */
  text-size-adjust: 100%;
  tab-size: 4;                         /* code-adjacent default, overridable per-block */
}

body {
  margin: 0;
  /* Never set font here — that belongs to .markdown-body so chrome can differ. */
}

h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd, ul, ol, pre {
  margin-block: 0;                     /* vertical rhythm comes from flow + --leading */
}

ul, ol { padding-inline-start: 0; list-style: none; }   /* we own markers */

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select { font: inherit; color: inherit; }

a { color: inherit; }                  /* link colour comes from a token */

:where(button, [role="button"]) { -webkit-tap-highlight-color: transparent; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```text

The `:where()` selector is deliberate: zero specificity. Our component and
content rules then win without `!important`, and a user stylesheet can still win
over ours. Specificity is a budget, and resets should spend none of it.

Note `list-style: none` + `padding-inline-start: 0`. We then re-add markers
ourselves with counters (§6) because we need control over alignment, nesting
depth, and print rendering. `list-style: none` also removes list semantics from
Safari/VoiceOver unless `role="list"` is added — we add it in the renderer.

## 3. Design tokens: themes as data

Every theme is a set of custom properties on `:root`. There is no theme
JavaScript, no theme-specific CSS file, no `if (theme === 'dark')` anywhere.

```css
/* tokens.css */
:root {
  color-scheme: light dark;             /* makes form controls + scrollbars follow */

  /* --- Type --------------------------------------------------------- */
  --font-serif: ui-serif, "Iowan Old Style", "Source Serif 4", Charter,
                "Bitstream Charter", "Sitka Text", Cambria, Georgia,
                "Times New Roman", serif;
  --font-sans:  ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
                "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --font-mono:  ui-monospace, "Cascadia Code", "JetBrains Mono", "Fira Code",
                "SF Mono", Menlo, Consolas, "DejaVu Sans Mono",
                "Liberation Mono", monospace;

  /* Body size is user-controlled and clamped; see §4. */
  --font-size: 17px;
  --leading-body: 1.65;                /* unitless; scales with --font-size */
  --leading-tight: 1.25;
  --measure: 68ch;                     /* line length cap for prose */
  --measure-code: 92ch;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-bold: 680;                  /* 700 is often too heavy at body sizes */

  /* --- Space: a modular scale, 1.25 (major third-ish) ----------------- */
  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs:  0.75rem;
  --space-s:   1rem;
  --space-m:   1.5rem;
  --space-l:   2.5rem;
  --space-xl:  4rem;

  --radius-s: 3px;
  --radius-m: 6px;

  /* --- Colour (light is the default; dark overrides below) -------------- */
  --bg:          #ffffff;
  --bg-subtle:   #f6f8fa;
  --bg-inset:    #eef1f4;
  --fg:          #1f2328;
  --fg-muted:    #59636e;
  --fg-subtle:   #818b98;
  --border:      #d1d9e0;
  --border-strong: #b7c0ca;

  --accent:      #0969da;
  --accent-fg:   #ffffff;
  --mark-bg:     #fff8c5;
  --mark-fg:     #1f2328;

  --code-bg:     #f6f8fa;
  --code-fg:     #1f2328;
  --code-border: #d1d9e0;
  --quote-fg:    #59636e;
  --quote-border:#b7c0ca;
  --table-stripe: #f6f8fa;

  /* Syntax (defaults; overridden by the active highlighter theme) */
  --syn-plain:   var(--fg);
  --syn-comment: #6a737d;
  --syn-keyword: #cf222e;
  --syn-string:  #0a3069;
  --syn-number:  #0550ae;
  --syn-func:    #8250df;
  --syn-type:    #953800;
  --syn-const:   #0550ae;
  --syn-punct:   var(--fg-muted);

  --shadow-pop: 0 8px 28px rgb(0 0 0 / 0.14);

  /* --- Syntax theme selection ---------------------------------------- */
  --syntax-theme: light;               /* "light" | "dark" */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* dark token overrides */ }
  :root:not([data-theme="light"]) { --bg: #0d1117; --fg: #e6edf3; /* … */ }
}

:root[data-theme="dark"] { /* same dark overrides, unconditional */ }
```text

### 3.1 The auto/light/dark triple

Three states, one mechanism. The trick is that the `auto` state must be
expressible in CSS, not in JS, because it has to respond to an OS theme change
that happens while the app is running.

```css
/* 1. tokens.css declares :root defaults = light. */
/* 2. Follow the OS only when the user has NOT chosen explicitly. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme="dark"]) { /* dark tokens */ }
}
/* 3. Explicit choice wins, in both directions. */
:root[data-theme="dark"]  { /* dark tokens */ }
:root[data-theme="light"] { /* light tokens */ }
```

JS's entire job is to write one attribute on `<html>`:

```js
const KEY = 'siyana.theme';
const mql = matchMedia('(prefers-color-scheme: dark)');

function apply(mode /* 'auto' | 'light' | 'dark' */) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');   // CSS decides
  else root.setAttribute('data-theme', mode);
  root.dataset.themeResolved = mode === 'auto' ? (mql.matches ? 'dark' : 'light') : mode;
}

apply(localStorage.getItem(KEY) ?? 'auto');
mql.addEventListener('change', () => {
  if (!document.documentElement.hasAttribute('data-theme')) apply('auto');
});
```text

`data-theme-resolved` exists so that syntax-highlighting code and inline SVG
icons can react to the *effective* theme without re-implementing the cascade.

Also set `<meta name="color-scheme" content="light dark">` so the native
scrollbars, form controls, and the WebView2/GTK background follow, avoiding the
white-flash-on-dark-startup problem.

### 3.2 A custom theme is one JSON file

```json
{
  "id": "siyana-midnight",
  "name": "Midnight",
  "mode": "dark",
  "syntaxTheme": "nord",
  "tokens": {
    "--bg": "#0b1021",
    "--fg": "#d7e0f0",
    "--fg-muted": "#8b98b4",
    "--border": "#1e2740",
    "--accent": "#7aa2f7",
    "--code-bg": "#111830",
    "--syn-keyword": "#bb9af7",
    "--syn-string": "#9ece6a",
    "--syn-comment": "#565f89"
  }
}
```text

```ts
export function applyTheme(t: Theme) {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(t.tokens)) {
    if (!k.startsWith('--')) throw new Error(`theme token must be a custom property: ${k}`);
    s.setProperty(k, v);
  }
  s.setProperty('--syntax-theme', t.mode);
  document.documentElement.setAttribute('data-theme', t.mode);
}
```text

Two rules that matter: only custom properties (so a theme file can never inject
a selector), and only from the token allowlist (so a theme file can never set
`--evil` that some rule uses for something sensitive). Validate against a
`Set<string>` of known token names at load; reject the theme file otherwise.

### 3.3 Contrast

Every token pair ships a measured ratio and a note. WCAG 2.2 requires 4.5:1 for
body text, 3:1 for large text and for UI component boundaries.

| Pair | Light | Dark |
|------|-------|------|
| `--fg` on `--bg` | 15.1:1 | 13.9:1 |
| `--fg-muted` on `--bg` | 5.3:1 | 6.1:1 |
| `--accent` on `--bg` | 4.7:1 | 6.8:1 |
| `--code-fg` on `--code-bg` | 12.6:1 | 11.2:1 |
| `--border` on `--bg` | 1.4:1 *(non-text; decorative only)* | 1.5:1 |
| `--syn-comment` on `--code-bg` | 4.5:1 | 5.0:1 |

`--syn-comment` is the one people get wrong: syntax comments are frequently
dropped to 30–40% opacity, which is unreadable for the exact readers who most
need it (low-vision developers reading code). It gets the same 4.5:1 as body
text, and this is enforced by an automated contrast test over the token sets
rather than by eye.

**Rule: comments in code are never de-emphasised below body-text contrast.**
De-emphasis is expressed by hue, not by contrast.

## 4. Typography for long-form reading

### 4.1 Measure

```css
.markdown-body {
  max-width: var(--measure);
  margin-inline: auto;
}
```

`68ch` is the widely-cited sweet spot (roughly 45–75 characters for Latin
script). Two caveats we must handle:

- **`ch` is the width of `0` in the current font.** A font with a wide `0`
  yields fewer characters per `ch` than one with a narrow `0`. Good enough;
  better would be a per-theme `--measure` tuned to the chosen font.
- **CJK has no word spaces**, so the "characters per line" heuristic doesn't
  apply directly. CJK at 17px needs fewer characters — roughly 35–40 — because
  each glyph is full-width. We handle it with a language-scoped override:

```css
:lang(zh), :lang(ja), :lang(ko) { --measure: 40em; }   /* em, not ch: CJK is full-width */
```text

Using `em` for CJK is the correct unit: one CJK glyph is one em wide, so `40em`
is literally 40 characters.

### 4.2 Line height

```css
.markdown-body {
  font-size: var(--font-size);
  line-height: var(--leading-body);   /* 1.65 for prose */
}
.markdown-body h1, h2, h3, h4, h5, h6 {
  line-height: var(--leading-tight);
}
```text

1.65 for body prose is at the upper end of the comfortable band (1.5–1.7) and
is what long-form reading guidelines converge on. Headings at 1.25 because
headings are one or two lines and generous leading just makes them look loose.

User-adjustable, clamped so a misconfiguration cannot produce unreadable output:

```ts
fontSize:  clamp(14, stored ?? 17, 24)      // px
lineHeight: clamp(1.3, stored ?? 1.65, 2.2) // unitless
```text

`line-height: 1.65` is unitless on purpose. A unitless line-height inherits into
children as a multiplier; a `px` line-height does not, which produces
inconsistency the moment an element changes `font-size`.

### 4.3 Font stacks

Three stacks, in `tokens.css` (§3). The ordering principle is
**platform-native first, then the fonts people actually have installed, then a
generic family as the terminal fallback.** Never end with a font that does not
exist on the platform:

```css
--font-serif: ui-serif, "Iowan Old Style", "Source Serif 4", Charter, …, serif;
--font-sans:  ui-sans-serif, system-ui, -apple-system, "Segoe UI", …, sans-serif;
--font-mono:  ui-monospace, "Cascadia Code", "JetBrains Mono", …, monospace;
```

`ui-serif` / `ui-sans-serif` / `ui-monospace` are the CSS `ui-*` generic
families that resolve to the OS's own faces. On Windows `ui-serif` is Georgia,
on macOS it is New York, on most Linux desktops it is whatever fontconfig picks
as the serif default. Using them means **zero font files ship with the app**, no
FOUT, no licensing question, and native rendering quality.

The cost is that the app looks different on different platforms. That is a
deliberate trade for a desktop reading tool: users prefer their system's faces,
and it removes an entire class of licensing and update problems. Users who want
a specific typeface get it via a custom theme setting a `--font-serif`.

Caveat to document: `system-ui` behaviour differs across Windows versions and
across the various Linux font stacks, so line breaking and therefore where lines
wrap can differ per platform. We do not fight this.

### 4.4 OpenType features

```css
.markdown-body {
  font-feature-settings:
    "liga"   1,   /* standard ligatures: fi fl ffi — required for readability */
    "calt"   1,   /* contextual alternates: proper punctuation in code-ish text */
    "kern"   1,   /* kerning */
    "liga"   0;   /* (last wins — see below) */
}
```text

Careful, and worth writing down because the naive rule is wrong:
**ligatures on, except inside code.** In prose, `fi` as a ligature is a
typographic improvement and readers expect it. In code, `->`, `!=`, `>=`
becoming a single glyph breaks copy-paste and confuses search — GitHub renders
code with `font-variant-ligatures: none` for this reason.

```css
.markdown-body :is(pre, code, kbd, samp) {
  font-family: var(--font-mono);
  font-feature-settings: normal;          /* or: "liga" 0, "calt" 0 */
  font-variant-ligatures: none;
  font-variant-numeric: tabular-nums;     /* so 0/O and 1/l are distinguishable */
}
```text

For prose numerals that should align in tables:

```css
.markdown-body table { font-variant-numeric: tabular-nums lining-nums; }
```text

Old-style figures are a nice touch and a real hazard in code. Where a document
uses numerals for data, `onum` is pleasant:

```css
:root[data-prose-figure-style="oldstyle"] .markdown-body p { font-variant-numeric: oldstyle-nums; }
```

Offer it as an option; default to `lining-nums`. Old-style figures in a table of
numbers looks lovely and in a table of IDs looks like a bug.

### 4.5 Hyphenation

```css
.markdown-body p {
  hyphens: auto;
  -webkit-hyphens: auto;
  hyphenate-limit-chars: 6 3 3;   /* min word 6, min before 3, min after 3 */
}
```text

`hyphens: auto` needs a `lang` attribute to work — the browser uses the
language to load the right hyphenation dictionary, and with no `lang` most
engines decline to hyphenate at all. Since our document root has a known
language, this is a one-line correctness fix with a large visual payoff at long
measures. `hyphenate-limit-chars: 6 3 3` prevents the two-character orphan
hyphens that make prose look broken.

Never hyphenate in these places regardless:

```css
.markdown-body :is(h1,h2,h3,h4,h5,h6, pre, code, table, .task-list-item) {
  hyphens: manual;
  -webkit-hyphens: manual;
}
```text

### 4.6 Text wrapping

```css
.markdown-body {
  text-wrap: pretty;          /* default */
  hanging-punctuation: first last;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3 {
  text-wrap: balance;         /* headings are ≤3 lines; balancing is free quality */
}
```text

`text-wrap: pretty` is Chromium's last-line-orphan avoidance: it will pull a word
down to avoid a single-word last line. `balance` distributes lines evenly and
is applied only where the line count is small and known. Both degrade to `wrap`
where unsupported, which is why there is no `@supports` guard — the fallback is
exactly the old behaviour.

`overflow-wrap: anywhere` goes **only** on code and long URLs:

```css
.markdown-body :is(pre, code, kbd, samp) { overflow-wrap: anywhere; }
.markdown-body a[href] { overflow-wrap: anywhere; }
```

Applied to prose it breaks words mid-syllable in normal text, which is worse
than the overflow it fixes. Applied to a 200-character URL in a code block it is
exactly right.

### 4.7 Vertical rhythm

One base unit, everything a multiple of it. `--space-s` (1rem) is the base;
headings use whole multiples; lists and quotes use a fraction.

```css
.markdown-body > * + * { margin-block-start: var(--space-m); }   /* 1.5rem between blocks */

.markdown-body :is(h1,h2,h3,h4,h5,h6) { margin-block: var(--space-l) 0 var(--space-s); }
.markdown-body h1 + *, .markdown-body h2 + * { margin-block-start: var(--space-xs); }

.markdown-body :is(ul,ol) { padding-inline-start: 1.6em; }
.markdown-body li + li { margin-block-start: var(--space-3xs); }
.markdown-body li > :is(ul,ol) { margin-block-start: var(--space-3xs); }

.markdown-body blockquote { margin-inline: 0; padding-inline-start: var(--space-s); }
.markdown-body pre { margin-block: var(--space-m); }
```text

`:is()` and `>` combinators keep specificity at or near the element default, so
component styles can still win without `!important`. The adjacent-sibling margin
(`* + *`) rather than a bottom margin on every block avoids the classic
"last-child margin collapses through the container" bug, which shows up as
extra space under the last paragraph of a document.

## 5. Code blocks

Two policies, one per content type, and the difference is a UX decision, not an
oversight.

```css
/* Block code: horizontal scroll, never wrap. Wrapping code changes its meaning
   visually — indentation and continuation become ambiguous. */
.markdown-body pre {
  font-family: var(--font-mono);
  font-size: 0.9em;                    /* slightly smaller than prose */
  line-height: 1.5;
  background: var(--code-bg);
  color: var(--code-fg);
  border: 1px solid var(--code-border);
  border-radius: var(--radius-m);
  padding: var(--space-s);
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;      /* don't scroll the parent while scrolling code */
  tab-size: 4;
  white-space: pre;                    /* explicit: no wrapping */
  scrollbar-width: thin;
}

.markdown-body pre code {
  display: block;
  padding: 0;
  background: none;                    /* no double background */
  font-size: inherit;
  font-family: inherit;
}

/* Inline code: wrap, because a long identifier must not break layout. */
.markdown-body :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: var(--radius-s);
  padding: 0.15em 0.35em;
  overflow-wrap: anywhere;
  white-space: break-spaces;
}
```text

Notes that cost us real debugging time before:

- `overscroll-behavior-x: contain` on a `pre` inside a horizontally scrolling
  page is the difference between "scroll the code block" and "scroll the whole
  document sideways, which looks like a bug."
- `:not(pre) > code` rather than `code` — otherwise the `pre > code` rule for
  background removal never wins.
- `white-space: pre` is stated explicitly. `pre` implies it, but a reset that
  touches `white-space` will break it silently.

### 5.1 Optional soft wrap

A user preference, because `pre` scroll is wrong for some content and right for
others:

```css
:root[data-code-wrap="on"] .markdown-body pre code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```text

With wrap on, line numbers must go away (a wrapped line has no line number) —
so the setting also disables the gutter. Ship them as one toggle.

### 5.2 Code block chrome

The toolbar (copy, wrap, language label, expand) is **not** inside `<pre>`:

```html
<div class="code-block" data-lang="rust">
  <div class="code-block__bar" aria-hidden="true">
    <span class="code-block__lang">rust</span>
    <button class="code-block__copy" data-action="copy">Copy</button>
  </div>
  <pre><code class="language-rust">…</code></pre>
</div>
```

Putting interactive elements inside `<pre>` corrupts the text content that a
user selects and copies, and it makes the code block no longer a clean
`text/plain` extraction target for export. The wrapper is emitted by the
renderer, the button is ours, and the `aria-hidden` on the bar keeps a screen
reader from reading "Copy" before every code block.

## 6. Per-element styling for every block type

A single reference block, so nothing is left to "style it later". This is the
file a designer reads first.

```css
/* Paragraph — the default; nothing to say beyond inheriting body type. */
.markdown-body p { margin: 0; text-align: var(--prose-align, start); }

/* Headings */
.markdown-body :is(h1,h2,h3,h4,h5,h6) {
  font-weight: var(--weight-bold);
  line-height: var(--leading-tight);
  color: var(--fg);
  scroll-margin-block-start: var(--space-l);  /* anchor jumps clear the sticky titlebar */
  text-wrap: balance;
}
.markdown-body h1 { font-size: 2em;     letter-spacing: -0.015em; }
.markdown-body h2 { font-size: 1.5em;   letter-spacing: -0.01em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1.1em; }
.markdown-body h5 { font-size: 1em;     color: var(--fg-muted); }
.markdown-body h6 {
  font-size: 0.95em; color: var(--fg-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}

/* Heading anchor, revealed on hover/focus only */
.markdown-body :is(h1,h2,h3,h4,h5,h6) > .heading-anchor {
  margin-inline-start: 0.4em;
  color: var(--fg-subtle);
  text-decoration: none;
  opacity: 0;
  transition: opacity 120ms;
}
.markdown-body :is(h1,h2,h3,h4,h5,h6):hover > .heading-anchor,
.markdown-body :focus-within > .heading-anchor { opacity: 1; }
@media (forced-colors: active) { .heading-anchor { opacity: 1; } }

/* Emphasis */
.markdown-body :is(em, i) { font-style: italic; }
.markdown-body :is(strong, b) { font-weight: var(--weight-bold); }
.markdown-body del { text-decoration-thickness: 1px; color: var(--fg-muted); }
.markdown-body mark { background: var(--mark-bg); color: var(--mark-fg); padding: 0 0.15em; border-radius: 2px; }

/* Links */
.markdown-body a {
  color: var(--accent);
  text-decoration-line: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}
.markdown-body a:hover { text-decoration-thickness: 2px; }
.markdown-body a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Lists — custom markers for control over alignment and nesting */
.markdown-body :is(ul, ol) { margin-block: 0; padding-inline-start: 1.6em; }
.markdown-body ul { list-style: none; }
.markdown-body ul > li { position: relative; }
.markdown-body ul > li::before {
  content: "";
  position: absolute;
  inset-inline-start: -1.1em;
  inset-block-start: 0.62em;
  width: 0.34em; height: 0.34em;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.55;
}
.markdown-body ol { list-style: decimal; }
.markdown-body ol > li::marker { color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.markdown-body li > :is(ul,ol) { margin-block-start: var(--space-3xs); }
.markdown-body li > p + p { margin-block-start: var(--space-2xs); }  /* loose list */

/* Task lists */
.markdown-body .contains-task-list { list-style: none; padding-inline-start: 0.4em; }
.markdown-body .task-list-item { display: flex; gap: 0.55em; align-items: baseline; }
.markdown-body .task-list-item-checkbox {
  appearance: none; flex: none;
  inline-size: 0.95em; block-size: 0.95em;
  margin: 0; translate: 0 0.12em;
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-s);
  background: var(--bg);
}
.markdown-body .task-list-item-checkbox:checked {
  background: var(--accent) url("data:image/svg+xml,…") center / 0.7em no-repeat;
  border-color: var(--accent);
}
.markdown-body .task-list-item-checkbox:disabled { cursor: default; opacity: 1; }

/* Blockquote */
.markdown-body blockquote {
  margin-inline: 0;
  padding-inline-start: var(--space-s);
  border-inline-start: 3px solid var(--quote-border);
  color: var(--quote-fg);
  font-style: normal;
}
.markdown-body blockquote > :first-child { margin-block-start: 0; }
.markdown-body blockquote > :last-child { margin-block-end: 0; }

/* Horizontal rule */
.markdown-body hr {
  border: 0;
  border-block-start: 1px solid var(--border);
  margin-block: var(--space-l);
}

/* Media */
.markdown-body img {
  max-inline-size: 100%;
  block-size: auto;
  border-radius: var(--radius-s);
  background: var(--bg-inset);   /* visible while loading, and for broken images */
}
.markdown-body figure { margin: var(--space-m) 0; }
.markdown-body figcaption {
  font-size: 0.9em; color: var(--fg-muted);
  text-align: center; margin-block-start: var(--space-2xs);
}

/* Tables */
.markdown-body table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: 0.95em;
  display: block;                 /* horizontal scroll on narrow viewports */
  overflow-x: auto;
}
.markdown-body :is(th, td) {
  padding: var(--space-2xs) var(--space-xs);
  border: 1px solid var(--border);
  text-align: start;
  vertical-align: top;
}
.markdown-body thead th { background: var(--bg-subtle); font-weight: var(--weight-medium); }
.markdown-body tbody tr:nth-child(even) { background: var(--table-stripe); }
.markdown-body .md-align-center { text-align: center; }
.markdown-body .md-align-right  { text-align: right; }

/* Footnotes */
.markdown-body .footnotes {
  margin-block-start: var(--space-xl);
  font-size: 0.9em;
  color: var(--fg-muted);
}
.markdown-body .footnote-ref a,
.markdown-body .footnote-backref { text-decoration: none; }
.markdown-body .footnote-ref a { vertical-align: super; font-size: 0.8em; padding-inline: 0.15em; }

/* Math (opt-in feature) */
.markdown-body .math-block {
  overflow-x: auto;
  text-align: center;
  margin-block: var(--space-m);
}
.markdown-body .math-inline { white-space: nowrap; }
```text

Notes worth keeping:

- **`scroll-margin-block-start`** on headings is what makes `#fragment` links not
  hide the target under a sticky header. It is a one-line fix that users notice
  immediately and nobody thinks to add.
- **`display: block; overflow-x: auto` on `table`** is the standard escape hatch
  for wide tables in a narrow column, and it avoids the `overflow: hidden` bug
  where the table is clipped rather than scrollable.
- **`forced-colors: active`** is Windows High Contrast Mode. We opt back into
  visible affordances the OS otherwise strips. Any interactive control we hide
  until hover needs this, or it is invisible to a subset of users.
- **`:focus-visible` everywhere**, never `outline: none` without a replacement.
  Keyboard navigation through a long document is a primary use case.

## 7. Syntax highlighting: the three options compared

### 7.1 highlight.js

Auto-detects language by content, works from a plain `<pre><code>` block, has
a `language-*` class convention matching Markdown output.

- **Pros:** zero setup; works on already-rendered HTML; small per-language
  chunks; broad language coverage; completely reasonable output quality.
- **Cons:** regex-based detection and regex-based grammars, so it both guesses
  wrong sometimes and cannot handle pathological grammars correctly.
- **Runtime cost:** low. It mutates the existing DOM after render, so
  highlighting happens on already-parsed content.
- **Themes:** ~100 bundled, CSS-only.
- **Source:** <https://highlightjs.org/>

### 7.2 Prism

- **Pros:** smallest footprint (its own claim: "2KB minified & gzipped
  (core). Each language definition adds roughly 300-500 bytes"); styling via
  sensible class names (`.comment`, `.string`, `.property`); forces correct
  `<pre><code class="language-x">` markup, which is exactly our output shape.
- **Cons:** explicitly regex-based with a documented
  ["known failures"](https://prismjs.com/#known-failures) page; language
  definitions are third-party code evaluated in the renderer.
- **Runtime cost:** lowest of the three for a small set of languages; the
  "load all languages" build is ~250 KB.
- **Source:** <https://prismjs.com/>

### 7.3 Shiki

TextMate grammars, the same engine as VS Code, running Oniguruma (WASM).
Its own headline: "⏱️ **Zero Runtime** — Runs ahead of time, ship zero JavaScript
while getting the perfect syntax highlighting."

- **Pros:** by a wide margin the most accurate highlighting available in any
  web renderer; themes are VS Code themes, so a user's mental model transfers;
  `codeToHast` output is semantic HTML with token classes.
- **Cons:** **bundle size is the whole trade.** Shiki's own docs publish the
  numbers: `shiki/bundle/full` is **6.4 MB minified / 1.2 MB gzip** including
  async chunks; `shiki/bundle/web` is **3.8 MB / 695 KB gzip**. Even the
  fine-grained build needs an engine (`shiki/wasm` inlines the WASM binary as
  base64) plus one module per language and theme.

### 7.4 Is Shiki feasible for a live viewer?

Yes, and the answer depends entirely on whether we use the **codegen** or the
**runtime** path.

| Path | How | Verdict for a desktop app |
|------|-----|----------------------------|
| **A. Runtime highlighting** | ship `shiki/core` + `createHighlighterCore` + `createOnigurumaEngine`, with `import()` for a handful of languages | **Feasible but heavy.** The full bundle is 6.4 MB minified in a desktop app that ships as a single installer — that's a real cost, and it happens to be paid by users who open one file with one JavaScript block. WASM + Oniguruma is also a nontrivial startup cost on the low-end Linux machines we target |
| **B. Runtime, fine-grained** | pick ~12 languages (js, ts, jsx, tsx, html, css, json, yaml, toml, bash, python, rust, sql, go, java, c, cpp, csharp, php, ruby, markdown, diff) and 2 themes, import them statically | **This is the right answer if we ship Shiki at all.** 12 languages ≈ 1–2 MB minified, 2 themes ≈ 100 KB, WASM ≈ 800 KB. Acceptable in a desktop installer, and it covers the overwhelming majority of real code blocks |
| **C. Build-time / worker** | run the highlighter in a Web Worker so a 4000-line file doesn't jank the UI | **Required regardless of option**, because a document with 500 code blocks will otherwise block the main thread for hundreds of ms |
| **D. Codegen at build time** | pre-highlight a fixed corpus | Useless to us: documents are user files, not build-time inputs |

**Recommendation:** if highlighting quality is a differentiator, take Shiki via
option **B** in a **Web Worker**, with a curated language set and exactly two
themes (light + dark) that map onto our tokens. If install size matters more
than highlighting fidelity, take Prism for its CSS-class approach, or highlight.js
for zero-setup auto-detection.

Three constraints regardless of choice:

1. **Highlighting is a rendering stage, not a post-processing step that rewrites
   HTML.** It runs on the sanitized output's *text* content and emits markup
   built by us. Re-running the sanitizer after highlighting is mandatory if
   highlighting introduces any element or attribute not already in the
   allowlist — Prism's plugins emit `<span>` only, which is allowed; Shiki's
   `transformers` can emit whatever you write, so we do not use transformers.
2. **Never highlight inside an untrusted `<code>` element's *content*** without
   re-sanitizing. If we add `<span class="tok-keyword">` to the allowlist
   (see below) that widening is permanent.
3. **Language comes from the info string, filtered to
   `[A-Za-z0-9_+#.-]`** ([01-ast-to-html.md §1.4](./01-ast-to-html.md#14-code-fences-class-and-lang)),
   never from a host document.

### 7.5 Token allowlist consequence

Syntax highlighting requires `<span class="…">`. So:

```text
span    ← add to tag allowlist
class   ← already allowed (global)
style   ← still forbidden. Highlighters emit classes, and we map classes to
          colours in CSS. Never let a highlighter emit inline style.
```text

Both Prism and Shiki emit classes, so this costs nothing and keeps `style`
permanently forbidden. Shiki's `codeToHtml` with default options inlines styles
instead of emitting classes — we must use the `codeToHast` path and render the
HAST ourselves, or pass a theme that emits CSS variables per token. This is
exactly the kind of detail that turns "we sanitize `style`" into "we sanitize
`style` except in code blocks", so it goes in the config file, not in a comment.

### 7.6 Theme switching without re-highlighting

If the highlighter emits classes (our design), switching themes is a single
attribute write on `<html>` and a CSS variable change. No re-tokenization, no
re-render, no flash. This is a real architectural payoff from choosing
class-based output over inline styles, and it is the deciding factor when
theme switching has to feel instant.

## 8. Print stylesheet

Full treatment in
[05-export-and-print.md §2](./05-export-and-print.md#2-the-print-stylesheet).
The skeleton:

```css
@media print {
  @page { size: A4; margin: 18mm 16mm; }

  :root {
    --bg: #fff; --fg: #000;
    --code-bg: #f5f5f5; --code-border: #ddd;
    --quote-border: #999;
    --fg-muted: #444;
    --syn-comment: #555;         /* still 4.5:1 on white */
  }

  /* Force light tokens even when the screen is dark. Printers and the
     "save as PDF" engine both honour print media, but some users export
     from a dark UI and expect dark output. Make it a setting. */
  :root[data-print-theme="dark"] { /* … dark-on-white-safe overrides … */ }

  .app-chrome, .sidebar, .toc, .toolbar, .statusbar, .code-block__bar { display: none !important; }
  .markdown-body { max-width: none; margin: 0; font-size: 11pt; line-height: 1.45; }

  a { color: var(--fg); text-decoration: underline; }
  /* Print the destination so a paper copy is still usable. */
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; word-break: break-all; }
  /* …but not for links that are already text, and never for fragments. */
  a[href^="#"]::after, a[href^="mailto:"]::after { content: ""; }

  pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid #ddd; break-inside: auto; }
  table { display: table; font-size: 9.5pt; break-inside: auto; }
  thead { display: table-header-group; }   /* repeat headers on every page */
  tr, img, figure, blockquote { break-inside: avoid; }
  h1, h2, h3, h4, h5, h6 { break-after: avoid; break-inside: avoid; }
  p { orphans: 3; widows: 3; }
  @page { @top-center { content: string(doctitle); } }
}
```

`print-color-adjust: exact` is **not** set by default. Users printing a
dark-themed document to a plain office printer get a black rectangle otherwise,
which is a far worse outcome than a monochrome document. We offer an explicit
"print with background colours" toggle instead.

## 9. Verification

This is a rendering pipeline; its failures are visual and therefore need
non-visual tests.

| Check | Tool | Assert |
|-------|------|--------|
| Contrast | custom script over `tokens.css` + theme JSONs | every `--fg*`/`--bg*` pair ≥ 4.5:1 (or ≥ 3:1 for `--fg-subtle` decorative) |
| No layout shift on theme switch | Playwright | `getBoundingClientRect` of `h1` identical across `data-theme` values |
| Focus visibility | Playwright + axe | no interactive element with `outline: none` and no replacement |
| Reduced motion | Playwright, `prefers-reduced-motion: reduce` | transition durations < 1 ms |
| Forced colors | manual, Windows HCM | anchors and task checkboxes visible |
| Line length | Playwright | measured `clientWidth / charWidth` ∈ [45, 80] for Latin at default settings |
| Anchor scroll offset | Playwright | `heading.getBoundingClientRect().top > 0` after `#fragment` navigation |
| Code scroll containment | Playwright | wheel over `pre` does not scroll the document horizontally |
| Dark print | manual + `@media print` screenshot | no black blocks, code still legible |
| Reduced-motion + no-JS | manual | content still readable, theme still switchable |

Every theme JSON must pass the contrast script in CI. A theme that fails does
not ship.

## Sources

- MDN, `text-wrap` / `hyphens` / `font-feature-settings` / `overflow-wrap` —
  <https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap>
- Chromium, "Improved typography in web content with `text-wrap: pretty`" —
  <https://developer.chrome.com/blog/css-text-wrap-pretty>
- highlight.js — <https://highlightjs.org/>
- PrismJS, features and known failures — <https://prismjs.com/>
- Shiki, bundles and size table — <https://shiki.style/guide/bundles>
- WCAG 2.2, Contrast Minimum (1.4.3) — <https://www.w3.org/TR/WCAG22/#contrast-minimum>
- `prefers-reduced-motion` — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- `forced-colors` — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors>
- `@page` and margin boxes — <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_paged_media>
- `prefers-color-scheme` — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme>
- Unicode Standard Annex #9, the bidirectional algorithm — <https://www.unicode.org/reports/tr9/>
