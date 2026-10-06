# 12 · UX Research

> **The viewer is a reading tool first and an editing tool second.**
> Every decision in this folder is judged against that sentence.

This folder studies what a person *does* when they open a Markdown file in a
viewer, and what the window must therefore look like, feel like, respond to,
and print like. It is written before any component exists, so it is written as
requirements, not as design.

---

## The frame

Most of the Markdown tooling in the world is built by people who *write* Markdown
to publish it: GitHub, mdBook, MkDocs, Docusaurus. Their user opens a file
already knowing its contents, wanting to ship it. The person who opens our app
does not know what is in the file. They have a URL, a filename, a folder, or a
half-remembered phrase, and they want to *absorb*.

That difference in intent produces most of the design decisions below:

| | A writing tool | A reading tool |
|---|---|---|
| Success is | the file gets published | the reader gets it |
| Cost of a bad frame | a few seconds of annoyance | the reader stops reading |
| Default width | as wide as the window | constrained measure |
| Default chrome | editor, toolbar, tabs | as close to nothing as possible |
| Primary keypress | Enter | Space, `J`, `K`, `N`, `P` |
| Primary output | a file on disk | comprehension (and optionally paper) |
| Failure mode | a typo | a wall of unreadable text |

Editing is real and we will support it — but it is the *second* verb. When the
two conflict, reading wins the default.

---

## Documents in this folder

| # | File | What it answers |
|---|------|-----------------|
| 01 | [Reading UX](01-reading-ux.md) | What are the real jobs-to-be-done of reading Markdown, and what does typography, measure, code, tables, images and print have to do for each? |
| 02 | [Navigation & Find](02-navigation-and-find.md) | TOC, anchors, three scopes of search, find-in-page, backlinks, outline, and the full keyboard shortcut set — including which shortcuts Chromium/Electron and Tauri grab by default and how to take them back. |
| 03 | [Theming](03-theming.md) | Light/dark/auto, themes as *data*, a theme schema, font pairing, syntax-highlight pairing, and a WCAG 2.2 AA audit of our own warm-minimalist palette. |
| 04 | [Accessibility](04-accessibility.md) | Why a reading app has an unusually high a11y bar, and what the webview accessibility-tree risk means for Electron and Tauri. |

---

## What is verified here

Per the repository ground rules ([research/README.md](../README.md)):

- **Verified facts** are cited to a primary source in the text: an MDN page, a
  W3C Recommendation, an official product page, an official repository file, or
  an official API doc.
- **Versioned claims** carry the date. The research was done on **6 October
  2026**.
- **Anything I could not confirm from a primary source is marked
  `UNVERIFIED`** and is *not* used to justify a decision.
- **Inferences** are labelled as inferences. Colour-contrast numbers in
  [03](03-theming.md) were computed directly from the palette hex values using
  the WCAG relative-luminance formula, so those are arithmetic, not opinion.

There is no vendor marketing copy in this folder. Where a claim originates from
a project's own website or README, the text says so.

---

## The five principles that fall out of the research

These are stated up front because every numbered document below is a long
elaboration of one of them.

### Principle 1 — Typography is the product

The Markdown file is already written. The renderer's only job is to not
degrade it. Almost every "this viewer feels bad" report that is not a bug is a
typography complaint: the measure is too wide, the line-height is too tight, the
code font is too small, the heading rhythm is wrong. See
[01 § Typography](01-reading-ux.md#2-typography-the-product).

### Principle 2 — Chrome is a cost, not a feature

Every permanently visible panel is subtracted from the reading column. Focus
mode, a full-width toggle, and collapsible panels are not "nice extras" — they
are the difference between a tool you tolerate and a tool you keep open.
See [01 § Reading modes](01-reading-ux.md#3-reading-modes).

### Principle 3 — Nothing is mouse-only

Every action reachable by pointer is reachable by keyboard, every keyboard
action has a visible discoverable name in a menu, and nothing traps focus.
Reading tools are used for long sessions; long sessions break wrists.
See [02 § Keyboard model](02-navigation-and-find.md#6-the-keyboard-model) and
[04](04-accessibility.md).

### Principle 4 — Themes are data

A theme is a JSON document of CSS custom properties, not a stylesheet of
arbitrary CSS and not a fork of the app. This keeps theming testable,
diff-able, and safe to import from a stranger.
See [03 § Themes as data](03-theming.md#4-themes-as-data-not-code).

### Principle 5 — Accessibility is a correctness property, not a feature

WCAG 2.2 AA is a testable acceptance criterion, not an aspiration. Semantic
HTML is not a styling convenience — it is *the* screen-reader interface, and a
sanitizer that strips semantics has silently removed the product.
See [04](04-accessibility.md).

---

## Verification status of the highest-risk claims in this folder

| Claim | Status | Where to look |
|---|---|---|
| WCAG 2.2 is the current W3C Recommendation (published 5 Oct 2023); WCAG 3 is still a draft | **Verified** — W3C WAI, *What's New in WCAG 2.2* | [04 §1](04-accessibility.md#1-which-standard-and-when-was-it-published) |
| 2.5.8 Target Size (Minimum) is 24×24 CSS px, Level AA, new in WCAG 2.2 | **Verified** — w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | [04 §7](04-accessibility.md#7-target-size) |
| `prefers-color-scheme` is Baseline *Widely available* (since Jan 2020) | **Verified** — MDN | [03 §1](03-theming.md#1-light-dark-auto) |
| `prefers-reduced-motion` is Baseline *Widely available* (since Jan 2020) | **Verified** — MDN | [04 §6](04-accessibility.md#6-reduced-motion) |
| `light-dark()` is Baseline *Newly available* (since May 2024) | **Verified** — MDN | [03 §1](03-theming.md#1-light-dark-auto) |
| Electron enables a11y automatically when AT is detected; `app.setAccessibilitySupportEnabled()` is the manual override | **Verified** — Electron docs, `docs/tutorial/accessibility.md` | [04 §9](04-accessibility.md#9-the-webview-accessibility-tree-risk) |
| `Menu.setApplicationMenu(null)` suppresses Electron's default menu | **Verified** — Electron `docs/api/menu.md` | [02 §7](02-navigation-and-find.md#7-electron-and-tauri-the-shortcuts-we-have-to-take-back) |
| The warm-minimalist palette fails AA for `muted` and `accent` as text colours | **Verified** — computed; see the table | [03 §8](03-theming.md#8-auditing-our-own-brand-palette) |
| Frutiger is a commercially licensed typeface (Monotype) and cannot be shipped as a free default | **Verified** — Monotype licensing pages | [03 §6](03-theming.md#6-font-pairing) |
| Tauri exposes a platform-specific a11y tree (UIA on Windows, NSAccessibility on macOS, AT-SPI via WebKitGTK on Linux) | **Partially verified** — mapping is asserted by third-party sources, not by a Tauri primary doc. Treat the *Linux/WebKitGTK* case as **UNVERIFIED** and test early | [04 §9](04-accessibility.md#9-the-webview-accessibility-tree-risk) |

---

## Open questions carried forward

These are unresolved and are tracked in
[15-open-questions](../15-open-questions/). They are listed here because they
directly gate implementation.

1. **Do we build editing at all in v1?** The frame says reading-first, but a
   "viewer" that cannot fix a typo in the file will be replaced by a text
   editor. Recommendation: ship read-only, plus an "open in external editor"
   affordance, and revisit after the reading UX is proven. See
   [01 §11](01-reading-ux.md#11-the-second-verb-editing-deferred-not-refused).
2. **Whose find-in-page?** The browser/webview already has a very good one.
   Replacing it with a worse one is a regression. See
   [02 §5](02-navigation-and-find.md#5-find-in-page).
3. **How big is "a folder"?** The three search scopes in
   [02 §4](02-navigation-and-find.md#4-search) need a definition of the corpus,
   and that definition determines whether an inverted index is worth building
   at all.
4. **Does the Linux webview meet the a11y bar?** If WebKitGTK/AT-SPI does not
   expose a usable tree, that is a *platform* accessibility fact we cannot fix
   in CSS, and it changes the framework recommendation in
   [08-desktop-frameworks](../08-desktop-frameworks/). This must be spiked
   before the desktop framework decision is locked.

---

## Overlap with existing research — read before writing CSS

Three documents already cover parts of this folder in more mechanical detail.
**This folder is the UX and requirements authority and deliberately does not
duplicate them:**

| Existing document | Owns | This folder adds |
|---|---|---|
| [`05-rendering/03-styling-and-themes.md`](../05-rendering/03-styling-and-themes.md) | CSS layer order, reset, token naming, syntax-highlighter comparison, print CSS mechanics, the CI contrast script | [03](03-theming.md) owns the **palette audit**, the **theme JSON schema**, light/dark/auto mechanics, and the **dark-mode counterpart**, which that file does not have |
| [`05-rendering/05-export-and-print.md`](../05-rendering/05-export-and-print.md) | `@page`, break control, print CSS mechanics | [01 §12](01-reading-ux.md#12-print-and-pdf-as-a-first-class-output) owns the **product decision** and the three export paths |
| [`05-rendering/04-media-and-images.md`](../05-rendering/04-media-and-images.md) | Image resolution, `srcset`, broken images, the media scheme | [01 §8](01-reading-ux.md#8-images) owns the **reading UX** of images |
| [`14-architecture-options/05-search-architecture.md`](../14-architecture-options/05-search-architecture.md) | Search tiers, engine choice, indexing pipeline, persistence, benchmark gate | [02 §4](02-navigation-and-find.md#4-search) owns the **UX** and restates the same engine conclusion |

> ⚠️ **One known unresolved conflict.** `05-rendering/03` proposes token names
> `--bg` / `--fg` / `--fg-muted` / `--bg-subtle`; [03](03-theming.md) proposes
> `--color-bg` / `--color-text` / `--color-text-muted` / `--color-surface`.
> **These are not the same names and they must be reconciled in an ADR before
> any CSS is written.** Flagged in [15-open-questions](../15-open-questions/).

---

## Sources for the verification table

- W3C WAI, "What's New in WCAG 2.2" — <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
- W3C, `WCAG 2.2` (W3C Recommendation) — <https://www.w3.org/TR/WCAG22/>
- W3C WAI, "Understanding SC 2.5.8: Target Size (Minimum)" — <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- MDN, `prefers-color-scheme` — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme>
- MDN, `prefers-reduced-motion` — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- MDN, `light-dark()` — <https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark>
- Electron, "Accessibility" tutorial — <https://github.com/electron/electron/blob/main/docs/tutorial/accessibility.md>
- Electron, `Menu` API — <https://github.com/electron/electron/blob/main/docs/api/menu.md>
- Tauri v2, "Window Menu" — <https://v2.tauri.app/learn/window-menu/>
- Monotype, font licensing — <https://support.monotype.com/en/articles/7872341-licensing>
- WCAG 2.2 relative-luminance and contrast-ratio formula — <https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio>
