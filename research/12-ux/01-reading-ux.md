# 01 · Reading UX

> **Question this document answers:** what does a person actually *do* in a
> Markdown viewer? And therefore, what must the window do for them?

Everything here is derived from one observation: **the file is already
written.** Our user did not author the words in front of them. They are a
consumer. Every requirement below is written from the consumer's side of the
glass.

> ### Authority note
>
> Four existing documents already cover parts of this territory in more
> mechanical detail. This document is the **UX and requirements** authority and
> deliberately does not duplicate them:
>
> | Document | Owns | Read it for |
> |---|---|---|
> | [`05-rendering/04-media-and-images.md`](../05-rendering/04-media-and-images.md) | Image resolution, `srcset`, broken images, the media scheme | §8 below is the *UX decision*; that file is the *implementation* |
> | [`05-rendering/05-export-and-print.md`](../05-rendering/05-export-and-print.md) | `@page`, break control, print CSS mechanics | §12 below is the *product decision*; that file is the *stylesheet* |
> | [`05-rendering/03-styling-and-themes.md`](../05-rendering/03-styling-and-themes.md) | Tokens, reset, measure, line-height, code-wrap CSS | §2, §4, §6 below state the *numbers and rationale*; that file implements them |
> | [`11-security/`](../11-security/) | Why `style`, `javascript:`, and `form` are denied | Referenced from §8, §10, §12 |

---

## Table of contents

1. [Jobs-to-be-done](#1-jobs-to-be-done)
2. [Typography: the product](#2-typography-the-product)
3. [Reading modes](#3-reading-modes)
4. [Line-height and measure, with justification](#4-line-height-and-measure-with-justification)
5. [Spacing rhythm](#5-spacing-rhythm)
6. [Code blocks for reading](#6-code-blocks-for-reading)
7. [Tables](#7-tables)
8. [Images](#8-images)
9. [Long lists, blockquotes, horizontal rules](#9-long-lists-blockquotes-and-horizontal-rules)
10. [Footnotes](#10-footnotes)
11. [The second verb: editing, deferred not refused](#11-the-second-verb-editing-deferred-not-refused)
12. [Print and PDF as a first-class output](#12-print-and-pdf-as-a-first-class-output)
13. [Requirement checklist](#13-requirement-checklist)

---

## 1. Jobs-to-be-done

These are the concrete things people do. Each is stated as a situation, not a
feature request, because feature requests are usually solutions.

### JTBD 1 — "Check what this file says, quickly"

> *Someone dropped a `README.md` link in chat. I want to know in 15 seconds
> whether it is worth my time.*

Characteristics: 5–30 seconds. High scroll velocity. Zero intent to interact.
The reader is scanning for shape: what is this, is it a library, how big is it,
is there an install step.

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 1.1 | Content visible at 100% zoom with no scrolling required for the first screenful | A 15-second job must not start with a scroll |
| 1.2 | Headings must be visually distinct from body text at a glance, without relying on colour alone (bold + size + weight together) | Scanning by shape, not by hue |
| 1.3 | Code blocks collapsed by default? **No** — visible but visually quiet | Install commands are the payload of a README; hiding them defeats the 15-second job |
| 1.4 | No modal anything, no splash, no "welcome, pick a folder" on a file that was opened directly | The job starts at open |
| 1.5 | The TOC panel must be one keystroke away and collapsed by default | Structure without cost |

### JTBD 2 — "Read a long document for hours"

> *A 60-page spec, a book chapter, an RFC. I am going to be in here for two
> hours. Do not hurt me.*

Characteristics: sustained, immersive, high cost of interruption, high cost of
eye strain, scrolling becomes continuous.

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 2.1 | Focus / distraction-free mode that removes all chrome except content and a way out | The single most requested feature in every Markdown tool |
| 2.2 | Position memory across session restarts — reopen the file at the same scroll offset, or at the last heading read | Hours-long reading gets interrupted by real life |
| 2.3 | `Scroll to top` and `End` must be instant, and `End` must not render the whole tail first | Long documents are where naive renderers fall over |
| 2.4 | No layout shift during scroll — no late-loading images pushing text down | Layout shift destroys the reading "spot" |
| 2.5 | The measure must stay constant as the window is resized | A changing measure re-educates the eye constantly |
| 2.6 | Cumulative scroll never jumps; anchors must not be hijacked by lazy images | Jump = lost place = re-read |

### JTBD 3 — "Skim for one specific heading"

> *I know the answer about authentication is somewhere in here. I do not know
> which section.*

Characteristics: navigation-dominated, high tolerance for a different UI,
frequently abandoned the moment the target is found.

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 3.1 | Auto-generated TOC from the heading tree, nested, with an always-visible text of each heading (not just an icon) | You must recognise the heading by its words |
| 3.2 | Filter-as-you-type in the TOC | Section names are longer than the panel is wide |
| 3.3 | Jump must be instant and must land with the heading below the top edge, not flush | Flush-to-top puts the heading behind sticky chrome |
| 3.4 | Current-section highlighting that updates on scroll, using `IntersectionObserver` or `scroll` + rAF, not a scroll handler that fires per event | Correct and cheap |
| 3.5 | TOC should be reorderable **only if** the user is in an editing context — see [02 §3](02-navigation-and-find.md#3-the-table-of-contents) | Drag-to-reorder TOC in a read-only viewer is a strange gesture |

### JTBD 4 — "Follow a link to an anchor, in a different file"

> *The spec says "see §4.2". I want to be there.*

Characteristics: the reader is confident the target exists; failures are
embarrassing and common (renamed headings, wrong case, GitHub's slug algorithm).

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 4.1 | Anchor slugs must match **GitHub's algorithm exactly**, including collisions (`-1`, `-2` suffixes) and stripping of punctuation | Links were authored against GitHub; anywhere else is wrong |
| 4.2 | `file.md#anchor` navigation must work within the app when the file is inside the opened folder | Obsidian-style internal navigation is expected |
| 4.3 | Broken anchors must produce a visible, non-modal inline warning near the link, not a silent no-op and not a blocking dialog | See [11 security](../11-security/) — we never navigate to `javascript:` |
| 4.4 | Back/forward must work across in-app document navigations, not just in-page anchors | The reader's mental model is a browser's |
| 4.5 | Copying an anchor link must produce a link that works on GitHub | Round-tripping is the trust test |

### JTBD 5 — "Compare two documents side by side"

> *Which of these two configs? What differs between the upstream README and
> ours?*

Characteristics: requires a second surface, screen real estate is the binding
constraint, and the two panes must be independently scrollable **and
independently navigable**.

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 5.1 | A split view with independent scroll positions | A synced scroll is wrong for comparison — you rewind one side constantly |
| 5.2 | An optional "align by heading" mode is a nice-to-have, not MVP | Most real comparisons are "is this section present in both" |
| 5.3 | Both panes must honour the same theme and measure | Otherwise the comparison is unreadable |
| 5.4 | Each pane needs its own TOC, or at least a per-pane outline | Comparing structure is half the job |
| 5.5 | On a window narrower than ~900 CSS px the split must collapse to tabs, not to two 300px columns | 300px is below the minimum usable measure |

### JTBD 6 — "Read code-heavy documentation"

> *I am reading a parser crate's docs to understand an API. There is more code
> than prose.*

Characteristics: code dominates; the reader must be able to (a) scan code
vertically quickly, (b) see long signatures in full, (c) copy code without the
line numbers, (d) not be interrupted by the code block's chrome.

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 6.1 | Monospace at ≥ the body size, never smaller than 0.9× | Sub-0.9 monospace is a classic readability failure |
| 6.2 | `tab-size: 2` for code regardless of user preference; configurable | Tabs in code are meaning |
| 6.3 | Optional line numbers, off by default, and **excluded from copy** | Line numbers pollute paste; `::selection` + a `data-` flag handles it |
| 6.4 | A visible language badge, small and quiet | Orientation without noise |
| 6.5 | Syntax highlighting must be *low* saturation — code colour must not out-compete body text for attention | See [03 §7](03-theming.md#7-syntax-highlight-themes) |
| 6.6 | Inline code must be visually distinct from code blocks at a glance | Readers confuse the two constantly |

### JTBD 7 — "Read docs with math and diagrams"

> *Physics paper. Or an architecture doc with Mermaid.*

Characteristics: the constructs are *rendered*, so they carry layout risk
(KaTeX inline elements affecting line height, Mermaid SVGs being enormous or
unreadably small).

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 7.1 | Inline math must not increase line height unpredictably — allow the line box to grow, do not clip | A clipped fraction loses information |
| 7.2 | Display math (`$$…$$`) centred, with breathing room above and below | |
| 7.3 | Mermaid diagrams: render, then fit to the content column; allow pan/zoom for anything wider | |
| 7.4 | Mermaid output must be keyboard-reachable and must have a text alternative — its source, in a `<details>` | A diagram with no alt is invisible to half your users. See [04](04-accessibility.md) |
| 7.5 | Diagram render failures must degrade to a `<pre>` of the source with an error note, never to a blank box | See [06 libraries](../06-libraries/) |
| 7.6 | Diagrams must print. That means a print stylesheet that un-hides SVG and drops interactivity | |

### JTBD 8 — "Read on a small screen"

> *Phone, tablet split-screen, or a 320px-wide side panel in a desktop window.*

Characteristics: single column, touch targets, no hover, high cost of chrome.

**Requirements**

| # | Requirement | Rationale |
|---|---|---|
| 8.1 | Reflow at 320 CSS px with no two-dimensional scrolling, *except* for code blocks, tables, and pre-formatted content — this is the WCAG 2.2 Reflow exception | 1.4.10 |
| 8.2 | All controls ≥ 24×24 CSS px, ideally 44×44 for touch | 2.5.8 |
| 8.3 | Side panels become sheets, not columns | |
| 8.4 | Body size ≥ 16 CSS px and scalable | 1.4.4 |
| 8.5 | Measure becomes `100%` and padding becomes the page margin | A `65ch` column on a 320px screen is a lie |

---

## 2. Typography: the product

### 2.1 A typographic scale for document content

Document text needs a scale that is *narrower* than a UI scale. A general UI
type system has six steps spanning a 3:1 range. A document has six steps
spanning a **1.8:1** range, because a reader's eye is tracking continuously and
large jumps force re-adjustment at every heading.

Recommended scale, in `rem` off a 16 px root, using a ~1.25 modular ratio
stepped down for body:

| Token | Size | Line height | Used for |
|---|---|---|---|
| `--fs-caption` | `0.75rem` / 12 px | 1.4 | figure captions, table footnotes, code language badges |
| `--fs-small` | `0.875rem` / 14 px | 1.5 | blockquote attribution, inline code, "last modified" chrome |
| `--fs-body` | `1.0625rem` / 17 px | 1.7 | **body copy** |
| `--fs-h4` | `1.125rem` / 18 px | 1.5 | `####` |
| `--fs-h3` | `1.25rem` / 20 px | 1.4 | `###` |
| `--fs-h2` | `1.5rem` / 24 px | 1.3 | `##` |
| `--fs-h1` | `2rem` / 32 px | 1.2 | `#` |
| `--fs-title` | `2.75rem` / 44 px | 1.1 | the document title (front matter `title:` or first `#`) |

Notes:

- **17 px body, not 16.** 17 px at a ~70-character measure is the classic
  reader's-eye sweet spot. 16 px is a UI default, not a reading default.
- **`h1` at 2rem, not 3rem.** A README's `#` title should not shout; the
  document is the point, not the title. Typora, GitHub, and mdBook all land in
  the 1.6–2.2rem range for `#`.
- Every heading gets `text-wrap: balance` (Baseline *Widely available* since
  March 2024 per MDN for the `text-wrap` shorthand; `balance`/`pretty` support
  varies by engine — feature-detect and degrade) so a two-line heading does not
  leave `Install` alone on the second line.
- Headings must carry `scroll-margin-top` equal to the sticky header height plus
  the panel offset, or in-page navigation lands underneath the chrome.

### 2.2 The scale must be one object

Define it once in CSS custom properties on `:root`, and derive everything —
including the print stylesheet — from it. A theme can then change `--fs-body`
and the whole document follows. See [03 §4](03-theming.md#4-themes-as-data-not-code).

---

## 3. Reading modes

Offer **three** content-width modes, not a boolean.

| Mode | Content column | Chrome | When |
|---|---|---|---|
| **Focus** | constrained measure, e.g. `min(68ch, 100% - 2rem)` | hidden; only a thin top bar that fades out after 2 s of no pointer movement | reading for hours; default offered on open with a one-time prompt |
| **Full width** | `100% - 2rem`, no max | normal | tables, wide code, diagrams, people who like it |
| **Paged** | constrained, vertically paginated, no continuous scroll | hidden | touch devices; Kindle-alikes; for anyone who finds infinite scroll tiring |

Implementation notes:

- Focus mode must be escapable with a single key (`Esc`) and must restore all
  chrome state exactly on exit. Losing your sidebar widths on exit is the
  classic bug.
- The `Full width` mode must not remove the gutter entirely — a minimum of
  `1.5rem` of page margin is required for [reflow](04-accessibility.md#8-reflow-at-320-css-px-1410) and for comfortable reading at the window edges.
- **Paged mode is a deliberate differentiator.** Continuous scroll is a
  web-page habit; paged reading is a *book* habit. Almost no Markdown viewer
  offers it and it is the single most book-like thing we could ship. It is also
  the mode that makes the print layout feel continuous. Risk: paged scrolling
  has notoriously poor implementation ergonomics in webviews (scroll snapping
  fights momentum scrolling on macOS/trackpads). **Recommendation: investigate
  early, ship last, never as a default.**

---

## 4. Line-height and measure, with justification

### Measure

The line length is the single highest-leverage typographic decision in a
document renderer. Too wide and the eye loses the return sweep; too narrow and
the rhythm breaks and hyphenation/justification goes wrong.

**Recommendation: `--measure: 68ch` in focus mode, `78ch` maximum in full-width
mode, `100%` below the breakpoint where the column would fall under 34ch.**

Why `68ch` and not the frequently quoted 45–75: the range's *low* end (45–55ch)
is calibrated for single-column print at ~11 pt on A4. Screen reading at 17 px
with a UI sans-serif tolerates and benefits from a slightly longer line. 68ch
keeps a ~30-character-per-word average word from wrapping badly while keeping
the return sweep under ~1.5 seconds of eye travel.

Why the `ch` unit: it measures the advance width of `0`, which for most
proportional UI fonts correlates with average character width. It is not
perfect — `ch`-based measures are noticeably narrower than a fixed `px` measure
for fonts with wide `0`. If we ship a font whose `0` is unusually wide, we must
re-tune the `ch` value. **Record the actual rendered characters-per-line in a
test rather than trusting the number.**

### Line-height

**Body: `1.7`.** Not 1.5, not 1.6.

- 1.5 is a *UI* line-height. It is tight for continuous prose.
- 1.7 puts roughly 17px of leading between baselines at a 17px size. Text
  ascenders/descenders occupy about 1.2em, so 1.7 gives ~0.5em of visual
  separation, which is where the return sweep starts to be reliable.
- Above 1.8 the paragraph blocks break apart and lists stop reading as lists.

Per-element overrides:

| Element | Line height | Why |
|---|---|---|
| Body | 1.7 | The default |
| Headings 1–3 | 1.15–1.3 | Big type needs *less* relative leading |
| Code blocks | 1.55 | Monospace needs less leading than proportional at the same size |
| Tables | 1.5 | Tabular scanning, not prose reading |
| Blockquotes | 1.7 (inherit) | Same prose, just indented |

### Justification

**Do not justify by default.** Justified text requires hyphenation to avoid
rivers; the CSS `hyphens: auto` implementation is inconsistent across the
Chromium and WebKitGTK engines we would be running on, and a justified
no-hyphenation column at 68ch produces visible rivers in Latin script. Reading
studies consistently favour left-aligned (ragged right) for on-screen prose.

**But** provide `justify` as an opt-in, and when it is on, force
`hyphens: auto` and `text-wrap: pretty` together — never one without the other.
This matters for non-Latin scripts: CJK and Thai justify well *without*
hyphenation because they have no inter-word spaces to stretch, and Typora
explicitly advertises correct rendering of strong/emphasis in CJK charsets.
So the `justify` toggle is not a Latin-only feature; it is a CJK feature.

---

## 5. Spacing rhythm

Use a single base unit and derive all vertical space from it.

**`--space-unit: 0.5rem` (8 px) at the default scale**, with a spacing scale of
`1, 2, 3, 4, 6, 8, 12, 16` units (4, 8, 12, 16, 24, 32, 48, 64 px).

Rules:

1. **Paragraph separation is not margin-top-only.** Use `margin-block: 0 1rem`
   and rely on line-height for intra-paragraph rhythm. Margin collapsing in the
   rendered HTML is unpredictable once sanitizers and wrappers get involved;
   `padding-block-start` on the paragraph is safer, or a `.doc > * + *` rule
   with explicit resets.
2. **Heading top margin must exceed paragraph spacing.** A heading that is only
   1rem above the paragraph below it looks like it belongs to that paragraph.
   Use **2rem above / 1rem below** for `h2`–`h4`, **3rem above / 1rem below**
   for `h1`. This asymmetry is what creates the "section" feeling.
3. **Never separate a heading from its content with more space than separates
   sections.** That is the whole game.
4. **A 2px top border on `h2`** (or a subtle background) is a legitimate way to
   make sections visible without more vertical space — and it costs nothing on
   narrow screens.
5. Lists: `margin-block: 0 1rem`, `padding-inline-start: 1.5rem`. Nested list
   items get `margin-block: 0.25rem`. Ordered lists should use
   `list-style-type` that survives RTL (`@counter-style` or a CSS counter
   driven by `direction`), because the default decimal renders as
   `1. 2. 3.` in the wrong order in RTL locales.
6. Code blocks get `margin-block: 1.5rem` and `padding: 1rem`. They are the
   most-attended block type in technical docs; give them air.
7. Blockquotes get `margin-block: 1.5rem`, `padding-inline-start: 1rem`, and a
   left border in `--color-border`.

Everything above must be expressed in `--space-*` tokens so a theme can retune
density.

---

## 6. Code blocks for reading

### The wrap-vs-scroll argument

There are two defensible behaviours, and this document argues for **both,
exposed as a toggle, with one default**.

**Scroll (default) — argue for it:**
- Fidelity. Wrapping a line of code changes its meaning: the trailing `\` in
  Python, the `// comment` in JS, the column alignment in a Rust struct, the
  `--` continuation in a shell command. Wrapping silently destroys these.
- Copy/paste integrity. A wrapped pre that soft-wraps still copies correctly
  *if* you use `white-space: pre-wrap` (real newlines are preserved; visual
  wrapping is only presentational) — but any implementation that inserts real
  newlines on wrap breaks it.
- Horizontal scroll is a *known* affordance. A reader who sees a scrollbar
  knows there is more content that way. A reader who sees a broken-looking
  sentence in a code block does not know what happened.
- Modern wide monitors mean the common case (an 80-column function) fits in
  full-width mode on a 1440px display.

**Wrap — argue for it:**
- On a phone, on a narrow split pane, and on a 320px window, a horizontally
  scrolling code block is *unusable*. The reader cannot see line 2 of a
  signature.
- Newcomers to a language do not yet know that they are missing the right-hand
  side. They do not know to scroll. They just see truncated code.
- Reading prose inside a comment-heavy code block at a narrow width is
  miserable.

### The recommendation

> **Default: `scroll`, with `wrap` as a per-document and per-app setting, and
> `wrap` forced automatically when the available width is less than
> `--code-min-width` (suggest 48ch).**

Rationale for the automatic override: it captures both arguments. On a wide
window nobody loses fidelity; on a narrow window nobody loses content. Do not
make the user choose; derive it from the width, and let them override
afterwards.

Implementation:

```css
/* wrap OFF (default): real overflow scroll, text stays honest */
.doc pre > code {
  display: block;
  white-space: pre;          /* NOT pre-wrap */
  overflow-x: auto;
  overflow-y: hidden;
  tab-size: 2;
}

/* wrap ON: soft wrap, no horizontal scroller, copy still faithful
   because pre-wrap preserves the original newlines */
.doc[data-code-wrap="on"] pre > code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;   /* break unbroken tokens like long URLs */
}
```

Two implementation rules that are easy to get wrong:

1. **The scroll container must be the `<pre>`, not the `<code>`,** and it must
   have `overscroll-behavior-x: contain` so a horizontal scroll at the end of a
   block does not chain to the page and confuse the reader's model.
2. **Scrolling a code block must not steal the wheel from the page** in a way
   that traps the user. Native `overflow-x: auto` gives the correct behaviour
   with no JS; do not "improve" it with a custom scroll handler.

Optional, and only if it does not cost accessibility:

- A `⤢ wrap` toggle affordance *inside* the code block's chrome, 24px minimum
  hit area (2.5.8), with `aria-pressed`.
- A copy button in the code block chrome. `navigator.clipboard.writeText` with
  the raw source text, not `innerText`, so line numbers and badges never land
  in the clipboard.

---

## 7. Tables

Tables are the most common cause of horizontal page scroll in a Markdown
viewer, and the most common cause of an inaccessible one.

**Requirements**

| Concern | Decision | Rationale |
|---|---|---|
| Overflow | Wrap the table in `<div class="table-scroll" role="region" aria-label="Table" tabindex="0">` with `overflow-x: auto` | Reflow (1.4.10) explicitly exempts "content that requires two-dimensional layout for usage or meaning" — tables qualify |
| Scrollability for keyboard users | The wrapper is `tabindex="0"` and has an accessible name | A scrollable region with no focusable content is unreachable by keyboard — this is WCAG 2.1.1 (Keyboard) in practice, and screen readers announce it as a region |
| Scroll affordance | A subtle inset shadow on the edge that has more content (`background-attachment: local` gradient trick) | Otherwise users cannot tell there is more |
| Header | `<th scope="col">` / `<th scope="row">` emitted by the renderer | Not decoration: this is what makes a table navigable by screen reader |
| Sticky header | `thead th { position: sticky; top: var(--sticky-header-h) }` on viewports ≥ 720px tall, off on short viewports | Genuinely useful for long tables; genuinely broken when it eats half a short window |
| Zebra | `tbody tr:nth-child(even)` with a `--color-surface` tint, **off by default in print** | Helps row tracking on wide tables; adds noise on 3-column tables |
| Alignment | Respect the source's `---:` / `:---` alignment via `text-align`; default to left, never centre body cells | Centred body text in tables is an accessibility anti-pattern |
| Wrapping | `white-space: normal` in cells; `word-break: break-word` for long tokens | A table cell containing `data:image/png;base64,…` must not destroy the layout |
| Print | `font-size: 0.8em`, `break-inside: auto` on rows, `thead { display: table-header-group }` for repeat-on-page-break | Browsers repeat `<thead>` across pages only with this value |
| Very wide tables (>8 columns) | Offer a "fit to width" toggle that applies `table-layout: fixed` + `font-size` reduction | Opt-in, never automatic |

---

## 8. Images

| Concern | Decision | Rationale |
|---|---|---|
| Sizing | `img { max-width: 100%; height: auto; }` | Mandatory; the classic broken-layout bug |
| Aspect ratio | Always reserve space via `width`/`height` attributes parsed from the file, or `aspect-ratio` from a metadata pass | Prevents the scroll-jump problem (2.4) that wrecks hours-long reading |
| Loading | `loading="lazy"` + `decoding="async"` below the fold; **eager** for the first two viewport heights | Native lazy loading is free and correct |
| Local files | Must resolve relative to the document, must be served through a scheme that is not `file://` in a sandboxed context | See [11 security](../11-security/) |
| Retina | `srcset` from a small set of widths (1× / 2×) when the file is local; no CDN proxying of local images | Privacy and correctness |
| Lightbox | Click opens a full-window overlay at natural size | |
| Lightbox a11y | The overlay is `role="dialog"`, `aria-modal="true"`, focus is trapped inside, focus returns to the triggering `<img>`'s wrapper on close, `Esc` closes, `←`/`→` step through images in the document, and the image has an accessible name from its `alt` | See [04](04-accessibility.md) |
| Zoom | `+` / `-` inside the lightbox, and click-on-the-image-background to close | Users of diagrams need this |
| Alt text | If `alt` is empty, the image is decorative: render it but do **not** make the lightbox reachable | `alt=""` is a deliberate author statement |
| Missing image | Render a labelled placeholder with the resolved path, not a browser broken-image icon | Debuggability; the reader can report it |
| Dark mode | Diagrams with transparent backgrounds vanish on dark. Detect alpha at load; if the PNG has alpha and is predominantly light, apply `filter: invert(1) hue-rotate(180deg)` in dark mode **only if** the user opts in | See [03 §5](03-theming.md#5-images-and-figures) |

---

## 9. Long lists, blockquotes, and horizontal rules

**Long lists** (a 400-item checklist, a long API parameter list):

- `list-style-position: outside` so the marker sits in the gutter and long
  items wrap to a shared left edge.
- Nested depth capped visually at 3 levels; deeper nesting is rendered but
  progressively flattened indentation (still correct for screen readers) —
  a 9-level nest otherwise consumes the entire measure.
- Task lists (`- [ ]`) render as `<input type="checkbox" disabled>` inside a
  `<li class="task-list-item">`, wrapped in a real `<ul class="contains-task-list">`
  so the list semantics survive. A disabled checkbox must still be exposed to
  assistive tech — do **not** `display: none` it.
- Very long lists (≥ 200 items) get `content-visibility: auto` with
  `contain-intrinsic-size` so they do not cost layout time. Verify this does not
  break find-in-page in Chromium/WebKitGTK before enabling by default; the
  specification says `content-visibility: auto` content *should* be searchable,
  but engine behaviour has historically differed.

**Blockquotes:**

- Nested blockquotes step the left border in and reduce `--fs-body` by one step,
  floor at `--fs-small`.
- Attribution lines (`— Author`, typically the last line in italics) get a
  `--color-muted` colour and are *not* italic-if-body-is-italic — use a
  separate class so CJK italic synthesis is not triggered. Many webview
  engines synthesize italic for CJK by skewing, which is ugly.
- `cite` / attribution links are always visibly underlined, never colour-only.

**Horizontal rules:**

- A Markdown document uses `---` for two different things: a thematic break and
  a front-matter delimiter. The renderer must disambiguate (the front matter is
  consumed before rendering), and then render the thematic break at `--color-border`.
- `hr` spacing: `margin-block: 3rem`, `border: 0`, `border-top: 1px solid`.

---

## 10. Footnotes

Footnotes are where a viewer's "reading tool" credentials get tested. Three
implementations exist and they are not equal.

| Model | Behaviour | Readability | Faithfulness |
|---|---|---|---|
| **Inline at bottom** (GitHub, mkBook) | All notes collected at the end of the document | Excellent for reference, requires scrolling away from the reference point | Highest |
| **Hover popup** (Typora advertises "Display footnotes you write on hover") | Note appears in a tooltip at the reference point | Good on desktop, useless on touch, invisible to keyboard unless focusable, and a screen-reader trap | Medium |
| **Sidenote in the margin** | Note sits in the outer margin beside its reference | Excellent on wide screens, impossible below ~1200px | Medium |

**Recommendation:** ship the inline-at-bottom model as the default, matching
GitHub, because it is the only one that is (a) accessible, (b) touch-usable,
and (c) printable. Add hover/focus preview as a *progressive enhancement* that:

- is implemented as a `<dialog>` or a positioned panel with `role="note"`,
- opens on `focus` of the reference (not only on `hover`), so keyboard users
  get it,
- never contains the only copy of the note text — the bottom-of-document list
  is always present in the DOM,
- is suppressed entirely under `prefers-reduced-motion` (no fade),
- is disabled in print (print always uses the bottom list).

Rendering rules:

- The reference is `<sup><a href="#fn-1" id="fnref-1" role="doc-noteref">1</a></sup>`.
- The list is `<section class="footnotes" role="doc-endnotes"><h2 class="visually-hidden">Footnotes</h2><ol>…`.
- `role="doc-noteref"` / `doc-endnotes` / `doc-footnote` are the correct ARIA
  roles here and are the reason screen readers announce the relationship.
  **The sanitizer must not strip them.** See [04 §2](04-accessibility.md#2-semantic-html-is-the-product).
- Back-links from each note to its reference (`aria-label="Back to reference 1"`).
- `scroll-margin-top` on every footnote target.

---

## 11. The second verb: editing, deferred not refused

The frame for this project is "reading tool first". But a viewer that cannot
correct a typo gets uninstalled, so editing must exist — at the right
*altitude*.

| Tier | What | When |
|---|---|---|
| 0 | Read-only. "Open in external editor" / "Open in VS Code" / "Reveal in file manager" | v1 default |
| 1 | Inline corrections: fix a link target, edit a single block's text in place, toggle a task checkbox | v1.x, only if the editor tech is already in the box |
| 2 | Full live-preview editing (Typora-style seamless preview) | Later, and see [07-editor-internals](../07-editor-internals/) — this is genuinely hard |

The Tier-2 technique that Typora popularised, and which is worth understanding
even if we defer it: the *same* DOM is both the source of truth and the
rendered output, with raw syntax markers toggled by CSS. The raw markers are
wrapped in elements whose `display` flips between `none` and `inline` depending
on cursor proximity (Typora's "show marks only in the active block" mode) or
on whether the caret is inside them. This gives a perfect WYSIWYG illusion
because there is no second surface to sync.

Its documented limitations, from having looked at implementations:

- **Cursor handling.** The caret must land *between* the right characters when
  the markers are invisible. Any `display` change that reflows the container
  can move the caret. The editor has to model the raw text offsets and map them
  to visual positions — i.e. a custom caret model, not the browser's.
- **Tables.** Column insertion/deletion requires generating and deleting raw
  pipe characters, alignment rows, and cell contents, all while the caret is
  somewhere else in the block.
- **Math.** `$$` delimiters must be hidden but the rendered formula inserted,
  and editing a formula means temporarily reverting to source.
- **Sanitization vs. editing.** If the sanitizer strips `style`, then user
  themes that rely on inline styles break; if it *allows* `style`, we have an
  XSS surface (CSS-based attacks are real). This tension is exactly the reason
  the security research exists separately.

**Recommendation:** do not attempt Tier 2 in v1. Ship Tier 0 with an excellent
"reveal in editor / copy path" affordance, and keep the renderer a pure,
sanitized, one-way function of the file so that an editor can later be layered
on without rewriting the rendering core.

---

## 12. Print and PDF as a first-class output

For many Markdown files, the terminal destination is **paper**. A spec that
gets reviewed, marked up, and archived; a thesis chapter; a runbook that gets
printed and pinned. If we treat print as an afterthought ("Ctrl+P works"), we
lose the users for whom print is the *entire* job.

Requirements:

| Concern | Decision |
|---|---|
| `@media print` is a designed stylesheet, not a reset | |
| Page setup | `@page { size: A4; margin: 20mm 18mm; }` with a user-overridable size (`A4`, `Letter`, and "fit to page") |
| Chrome | Hidden: TOC panel, outline, search bar, status bar, lightbox, toolbars |
| Links | Show the target URL in parentheses after external links; internal anchors resolve to their heading text. This is the single most useful print feature in a Markdown viewer |
| Code blocks | `white-space: pre-wrap` (never truncate a signature), `break-inside: avoid` where the block is < 30 lines, background tint removed or converted to a 5% grey that survives mono printing |
| Code blocks that must not wrap | Offer a `code { white-space: pre }` print option and let overflow be clipped with a visible note — some documents *must* not wrap |
| Tables | `thead { display: table-header-group }`, `tr { break-inside: avoid }`, borders in `#000` (tints vanish on mono printers), full width |
| Images | `max-width: 100%`, `break-inside: avoid`, `page-break-inside: avoid`; reserve space via `aspect-ratio` so the printer does not reflow |
| Headings | `break-after: avoid` — never a heading alone at the bottom of a page |
| Footnotes | Inline list at the end, no hover popup, `font-size: 0.9em` |
| Math | KaTeX's server-side/sync rendering prints as real glyphs; verify that `print-color-adjust: exact` does not bloat the PDF on Chromium |
| Diagrams | Render at print resolution; if the SVG is interactive, print the static form |
| Links/anchors | Print the heading slug as a small marker so a printed page can be referenced |
| Front matter | Offer "hide front matter" (default on) and "render as metadata block" (YAML as a definition table) |
| Page numbers | `@page` counters are unreliable across webview print paths. Test Electron `webContents.printToPDF` and Tauri equivalent separately; a fallback is a generated footer in the HTML |
| Output paths | (a) **Print dialog** (user picks "Save as PDF"); (b) **Print to PDF** to a chosen path with no dialog; (c) **Export standalone HTML** — one file, self-contained (inlined CSS, base64 or relative images), openable anywhere. (c) is the most valuable and cheapest, and doubles as our "send someone this document" feature |

Implementation note for (b): in Chromium-based shells, `printToPDF` is
available and gives better defaults than the print dialog (it can skip headers
and footers). In Tauri, the equivalent is a webview print API or shelling out.
**This is a real cross-framework divergence — verify in
[08-desktop-frameworks](../08-desktop-frameworks/).**

---

## 13. Requirement checklist

Acceptance criteria for the reading UX, in priority order. Each is testable.

| # | Criterion | Priority |
|---|---|---|
| R1 | Body copy renders at `--fs-body` (17 px) with `line-height: 1.7` and a measure of `68ch` in focus mode | P0 |
| R2 | Focus mode hides all chrome and is escapable with `Esc`; exit restores prior state | P0 |
| R3 | No page-level horizontal scrolling at any viewport ≥ 320 CSS px, excluding code blocks and table wrappers | P0 |
| R4 | Code blocks scroll by default, wrap below `--code-min-width`, and never alter copied text | P0 |
| R5 | Every heading has a GitHub-compatible `id`; `#anchor` navigation lands below the sticky offset | P0 |
| R6 | Auto-generated TOC with current-section highlighting; updates on scroll without jank | P0 |
| R7 | Images are lazy below the fold, never cause layout shift, and open in an accessible lightbox | P0 |
| R8 | Tables are in keyboard-focusable scroll regions with `scope`-correct `<th>` | P0 |
| R9 | Footnotes render inline at the bottom in the DOM, with correct ARIA doc roles | P0 |
| R10 | `@media print` hides all chrome, expands external link URLs, repeats table headers, and never clips a code block | P0 |
| R11 | Front matter is either hidden or rendered as a metadata block; never shown as raw `---`/`key: value` | P1 |
| R12 | Focus mode restores scroll position on reopen | P1 |
| R13 | Export to a single self-contained HTML file | P1 |
| R14 | Reading position persisted per document across sessions | P1 |
| R15 | Paged reading mode | P3 |
| R16 | Split-view document comparison | P2 |
| R17 | Inline editing (tier 1) | P2 |

## Sources

- MDN, `text-wrap` (Baseline *Widely available*, since March 2024) — <https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap>
- MDN, `scrollbar-gutter` (Baseline 2024) — <https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter>
- MDN, `content-visibility` — <https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility>
- W3C WAI, "Understanding SC 1.4.10: Reflow" — the 320 CSS px requirement and the exception for "content that requires two-dimensional layout for usage or meaning" — <https://www.w3.org/WAI/WCAG21/Understanding/reflow.html>
- WAI-ARIA 1.2, document-content roles `doc-noteref`, `doc-endnote`, `doc-footnote` — <https://www.w3.org/TR/wai-aria-1.2/#document_concept>
- Typora feature list — footnote-on-hover, focus mode, typewriter mode, PDF export with bookmarks, export to docx/ODT/LaTeX/MediaWiki/Epub, word count including reading minutes — <https://typora.io/>
- KaTeX — "Print quality: KaTeX's layout is based on Donald Knuth's TeX"; synchronous layout and server-side rendering — <https://github.com/KaTeX/KaTeX>
- Mermaid — <https://github.com/mermaid-js/mermaid>
- Measure in `ch` vs `em`: this document's `68ch` default is compatible with the per-language override in `05-rendering/03-styling-and-themes.md` §4.1, which sets `--measure: 40em` for `:lang(zh)`/`:lang(ja)`/`:lang(ko)`. That file owns the mechanism; this one owns the default value and the rationale.
- Reuse of existing decisions: `05-rendering/04-media-and-images.md`, `05-rendering/05-export-and-print.md`, `10-performance/`, `11-security/`
