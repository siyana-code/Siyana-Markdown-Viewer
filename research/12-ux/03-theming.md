# 03 · Theming

> **Question this document answers:** how do we let someone change how the
> document *looks* without letting them break it, and does our own palette
> survive WCAG 2.2 AA?

Research date: **6 October 2026**.

---

## 0. Relationship to other documents — read this first

| Document | Scope | Authority |
|---|---|---|
| [`05-rendering/03-styling-and-themes.md`](../05-rendering/03-styling-and-themes.md) | The **mechanism**: CSS layer order, reset strategy, token *naming*, syntax-highlighter comparison, print stylesheet mechanics, the CI contrast script | **Mechanism authority.** If the two disagree about how to do it, that document wins |
| **This document** | The **decision**: light/dark/auto mechanics, theme-as-data schema, the org palette audit, dark-mode counterparts, font pairing, syntax-theme pairing, the curated starter set | **Decision authority** on the palette and the schema shape |
| `siyana-code/brand` (external repo) | The canonical design tokens for the whole org | Upstream authority on values |

> ⚠️ **Known conflict, deliberately left unresolved here.** `05-rendering/03`
> proposes token names `--bg`, `--fg`, `--fg-muted`, `--bg-subtle`,
> `--bg-inset`, `--measure`. This document proposes `--color-bg`,
> `--color-text`, `--color-text-muted`, `--color-surface`, `--measure`.
> **They are not the same names and they must be reconciled before any CSS is
> written.** Reconciling them is an ADR, not a research note, and it belongs in
> `docs/adr/`. Flagged in
> [15-open-questions](../15-open-questions/).
>
> Also note that `05-rendering/03` uses a **GitHub-like neutral palette**
> (`#ffffff` / `#1f2328` / `#59636e`) as its worked example, and states
> "**comments in code are never de-emphasised below body-text contrast**". §8
> below audits a **different palette** — the org's warm-minimalist one — and
> finds it *fails* on muted and accent. Both positions are compatible: the rule
> is right, and the org palette does not currently satisfy it. **That is the
> finding**, and it is why §8 proposes role-split tokens rather than accepting
> the palette as-is.

---

## Table of contents

1. [Light / dark / auto](#1-light--dark--auto)
2. [Following the OS accent](#2-following-the-os-accent)
3. [Theme switching without a flash](#3-theme-switching-without-a-flash)
4. [Themes as data, not code](#4-themes-as-data-not-code)
5. [Images and figures](#5-images-and-figures)
6. [Font pairing](#6-font-pairing)
7. [Syntax highlight themes](#7-syntax-highlight-themes)
8. [Auditing our own brand palette](#8-auditing-our-own-brand-palette)
9. [A curated starter set](#9-a-curated-starter-set)
10. [Acceptance criteria](#10-acceptance-criteria)

---

## 1. Light / dark / auto

### The three states

| State | Meaning | Implementation |
|---|---|---|
| `light` | Always light | `<html data-theme="light">` |
| `dark` | Always dark | `<html data-theme="dark">` |
| `auto` | Follow the OS | `<html data-theme="auto">` and CSS resolves it |

### The correct modern mechanism

**Verified:** `prefers-color-scheme` is a **Baseline *Widely available***
feature per MDN — "It's been available across browsers since January 2020" —
and is the documented way to "detect if a user has requested light or dark color
themes."

**Verified:** the `light-dark()` CSS function is **Baseline *Newly available***
per MDN — "Since May 2024" — and "accepts two colors or two images and returns
a color or an image based on the active color scheme, without needing a
`prefers-color-scheme` media feature."

This means a theme does not need *two* palettes and does not need a media
query. It needs one palette expressed as pairs:

```css
:root {
  color-scheme: light dark;

  --bg:          light-dark(#F5F3F0, #1C1A18);
  --surface:     light-dark(#EBE7E2, #262320);
  --text:        light-dark(#2A2724, #EDE8E2);
  --muted:       light-dark(#6E675D, #9E968B);
  --accent:      light-dark(#6F5240, #C9A88C);
  --accent-hover:light-dark(#4A3B30, #E6D2BC);
  --border:      light-dark(#D8D2CA, #3A3531);
}
```

`color-scheme: light dark` also gets the *rest* of the platform for free: the
form control rendering, the scrollbar, the default canvas, and — critically —
the browser's own UI (find-in-page highlight colours, selection colour) — all
follow the theme.

To let an explicit user choice override `auto`, set
`color-scheme: light` or `color-scheme: dark` on the root for that theme,
which makes every `light-dark()` pair resolve to one side. This is the
mechanism Obsidian-like apps and GitHub itself use.

**Decision:** implement themes with `light-dark()` pairs + `color-scheme`, and
use a `@media (prefers-color-scheme)` block **only** as a fallback for the
older-engine case (some Linux WebKitGTK builds lag). Guard the whole fallback
behind `@supports not (color: light-dark(#000, #fff))`.

### What must change with the theme, not just colours

| Element | Light | Dark |
|---|---|---|
| Selection | `background: color-mix(in oklab, var(--accent) 25%, transparent)` | Same recipe, but verify the alpha blends correctly over a dark base |
| Image with transparency | as-authored | see [§5](#5-images-and-figures) |
| Shadows | `0 1px 2px rgb(0 0 0 / .06)` | `0 1px 2px rgb(0 0 0 / .4)` — shadows read as smudges on light, vanish on dark |
| Borders | hairlines at `--border` are visible | hairlines at `--border` disappear; dark themes need either a lighter border or a surface *elevation* step instead |
| Scrollbar | themed or auto | themed; WebKit overlay scrollbars are near-invisible on dark |
| Code block background | `--surface` at 100% | `--surface` — do **not** use a dark grey, use a warm tint consistent with the brand |
| Mermaid / diagram | default | default + `themeVariables`; KaTeX inherits |
| Print | `@media print` overrides *both* — printing always uses the light palette | same |

---

## 2. Following the OS accent

Desktop shells expose the OS accent colour; the web platform does not, but
Electron and Tauri both provide a bridge.

**Verified (Tauri):** the `window` plugin exposes a **ColorPanel** concept and
the `@tauri-apps/api/window` surface is documented around window customization;
the Rust `tauri::window` API has `Window::theme()`. **UNVERIFIED** whether
Tauri v2 exposes the *system accent colour* directly — see
[15-open-questions](../15-open-questions/).

**Verified (Electron):** `nativeTheme` is a documented module ("NativeTheme lets
you read and set the color preferences of the OS"). **UNVERIFIED** whether it
exposes the OS accent colour as opposed to dark/light.

**Recommendation:**

1. Do not make accent-following-OS a v1 dependency. It is a nice-to-have that
   couples us to a platform API whose exact shape is unconfirmed in both
   shells.
2. Design the token system so it *could* support it: `--accent` is a single
   token used only for focus rings, links, and small accents. Nothing structural
   depends on its hue.
3. Provide a **manual accent picker** (8–10 curated accents plus a free colour
   field) that computes the necessary derived colours. That gives users 90% of
   the perceived benefit, works identically on all platforms including web, and
   has no platform risk.
4. When a platform accent *is* available, derive from it with
   `color-mix(in oklab, var(--os-accent) 80%, var(--bg))` and validate the
   result against the contrast gates in [§8](#8-auditing-our-own-brand-palette)
   before use. If it fails, fall back to the manual accent. Never trust a
   user-supplied hue to be legible.

---

## 3. Theme switching without a flash

The classic, and extremely visible, bug: the user picks a dark theme at 10 pm,
the app repaints light for 200 ms, then goes dark.

Requirements:

| # | Requirement |
|---|---|
| 1 | The resolved theme is known **before first paint**. Apply it in a tiny inline `<script>` in `<head>` reading `localStorage`, or via the platform's native background colour so the window frame and the page agree |
| 2 | On an explicit user choice, update `color-scheme` immediately and re-render in one frame — no cross-fade (a cross-fade of a whole document reads as a glitch) |
| 3 | On an *OS* change while `auto` is active, transition only the colour properties (`background-color`, `color`, `border-color`), never `all`, and disable the transition under `prefers-reduced-motion` |
| 4 | The window's native chrome (title bar, traffic lights, frame) follows the theme; otherwise a light frame around a dark document is jarring. In Electron this is `nativeTheme.themeSource`; in Tauri it is a window-level theme. **Both verified as the general mechanism; exact property names to be confirmed against the target versions** |
| 5 | Persist the choice per *app*, not per document |
| 6 | The theme picker itself must be legible in every theme — including themes with a user-supplied accent |

---

## 4. Themes as data, not code

### The rule

> **A theme is a JSON document of CSS custom property values. It is never CSS,
> never JS, and never a fork of the app.**

Why this matters, concretely:

- A CSS theme is arbitrary code. Loading a stranger's CSS into a document
  viewer is an injection surface (CSS can exfiltrate via `url()` on computed
  values, can overlay UI, can hide content). Loading a **value** for a token we
  own is not.
- A CSS theme cannot be schema-validated. A JSON theme can.
- A CSS theme cannot be auto-generated, diffed, or merged. A JSON theme can.
- A CSS theme makes the contrast gate unenforceable. A JSON theme lets a CI job
  compute every pair's contrast ratio and fail the build. See
  [§8](#8-auditing-our-own-brand-palette).

### The token schema

```jsonc
{
  "$schema": "https://siyana.app/schemas/theme-1.json",
  "id": "warm-minimal-dark",
  "name": "Warm Minimal Dark",
  "version": 1,
  "author": "Siyana",
  "license": "MIT",
  "kind": "dark",                  // "light" | "dark" — used for color-scheme
  "extends": "warm-minimal",       // optional base theme id
  "tokens": {
    "color.bg":          { "light": "#F5F3F0", "dark": "#1C1A18" },
    "color.surface":     { "light": "#EBE7E2", "dark": "#262320" },
    "color.surface-2":   { "light": "#E3DED8", "dark": "#2E2A26" },
    "color.text":        { "light": "#2A2724", "dark": "#EDE8E2" },
    "color.text-muted":  { "light": "#6E675D", "dark": "#9E968B" },
    "color.accent":      { "light": "#6F5240", "dark": "#C9A88C" },
    "color.accent-hover":{"light": "#4A3B30", "dark": "#E6D2BC" },
    "color.border":      { "light": "#D8D2CA", "dark": "#3A3531" },
    "color.border-strong": { "light": "#8A8378", "dark": "#6E655C" },
    "color.focus-ring":  { "light": "#6F5B4C", "dark": "#B08A6A" },
    "color.selection":   { "light": "#E2D7CB", "dark": "#4A3B30" },
    "color.link":        { "light": "#6F5240", "dark": "#C9A88C" },
    "color.link-visited":{ "light": "#5F594F", "dark": "#B7A99A" },
    "color.code-bg":     { "light": "#EFECE8", "dark": "#221F1D" },
    "color.code-text":   { "light": "#2A2724", "dark": "#E5DFD8" },
    "color.mark-bg":     { "light": "#F0E3CE", "dark": "#4A3826" },

    "font.body":    "\"Inter var\", Inter, \"Segoe UI\", system-ui, sans-serif",
    "font.heading": "\"Frutiger Next\", \"Inter var\", Inter, system-ui, sans-serif",
    "font.mono":    "\"JetBrains Mono\", \"Cascadia Code\", ui-monospace, monospace",

    "font.size.body":  "1.0625rem",
    "font.size.h1":    "2rem",
    "font.size.h2":    "1.5rem",
    "font.size.h3":    "1.25rem",
    "font.size.h4":    "1.125rem",
    "font.size.small": "0.875rem",
    "font.size.caption": "0.75rem",

    "line.height.body": "1.7",
    "line.height.code": "1.55",
    "line.height.table": "1.5",

    "measure":      "68ch",
    "measure-max":  "78ch",
    "space.unit":   "0.5rem",
    "radius":       "6px",
    "shadow.raised":"0 1px 2px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.04)",
    "syntax.theme": { "light": "github-light", "dark": "github-dark" }
  },
  "meta": {
    "contrast": {
      "text-on-bg":            { "ratio": 13.4, "pass": "AAA" },
      "text-on-surface":       { "ratio": 12.1, "pass": "AAA" },
      "muted-on-bg":           { "ratio": 5.0, "pass": "AA" },
      "accent-on-bg":          { "ratio": 6.4, "pass": "AA" },
      "focus-ring-on-bg":      { "ratio": 5.8, "pass": "AA" }
    }
  }
}
```

### Rules for the schema

1. **Every colour token takes a `light` and a `dark` value** (a
   `light-dark()` pair). No theme ships one colour and hopes.
2. **No `!important`, no arbitrary properties, no `calc()` with units the
   app does not own.** Values are parsed and validated; unknown keys are a
   warning, invalid values are rejected with a message naming the key.
3. **Theme authors cannot add or remove tokens.** Only override. This keeps the
   contract with the stylesheet stable.
4. **Font stacks are strings, and fonts are not bundled by the theme** — see
   [§6](#6-font-pairing). A theme may *reference* a font the user has
   installed; it may not ship a font file. Shipping font binaries has licensing
   implications we do not want to inherit.
5. **A JSON Schema is published and versioned** (`$schema`, `version: 1`), so a
   future breaking change is detectable and old themes degrade with a warning
   instead of a crash.
6. **CI validates every bundled theme** against the contrast gates. A theme that
   fails cannot be merged.
7. `extends` allows a light/dark *pair* theme. A theme that provides only one
   side must still declare both (it may `extend` a base and override one side).

### CSS variables as the contract

```css
:root {
  /* Populated from the theme JSON. These names are the public API. */
  --color-bg: #F5F3F0;
  --color-surface: #EBE7E2;
  --color-text: #2A2724;
  --color-text-muted: #6E675D;
  --color-accent: #6F5240;
  --color-border: #D8D2CA;
  --color-focus-ring: #6F5B4C;
  --font-body: "Inter var", Inter, system-ui, sans-serif;
  --font-heading: "Inter var", Inter, system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;
  --measure: 68ch;
  --fs-body: 1.0625rem;
  --lh-body: 1.7;
  --space-unit: 0.5rem;
}
```

Every stylesheet rule in the app references **only** these variables. No rule
may hardcode a hex colour. That single rule is what makes theming a data
problem instead of a fork problem.

---

## 5. Images and figures

Dark mode breaks images in three specific ways. Each needs its own answer.

| Problem | Cause | Solution |
|---|---|---|
| **Transparent PNG logos vanish** | A white/transparent logo on a dark background | Default to *nothing* and let the author supply a dark variant. Offer an opt-in "invert transparent images" filter, applied only to images detected to have an alpha channel and a light-dominant histogram |
| **Screenshots with white backgrounds glare** | Genuinely white UI screenshots are fine but very bright | Never auto-invert screenshots — inverting a screenshot produces an unreadable lie. Offer a `filter: brightness(.9)` "dim images in dark mode" opt-in, per theme |
| **Diagrams baked on white** | Same | Same as above |

**Figures.**

| Concern | Rule |
|---|---|
| `figure` / `figcaption` | Use real `<figure>` and `<figcaption>`. A caption in a `<p>` with a class is not a caption to a screen reader |
| Caption styling | `--fs-caption`, `--color-text-muted`, centred, `margin-block-start: .5rem` |
| Figure alignment | Left by default, `text-align: center` on the figure and `margin-inline: auto` on the image. Centring images in a long measure is a classic readability mistake — but a *figure* is an object, and centring objects is conventional |
| `figure` full-bleed | Offer `figure.full-bleed { width: 100vw; margin-inline: calc(50% - 50vw) }` guarded by `overflow-x: clip` on an ancestor. Full-bleed images and code blocks are the one place a reader wants the full width — see [01 §3](01-reading-ux.md#1-reading-modes) |
| Print | Figures never break across a page; captions stay with their figure (`break-inside: avoid` on the `figure`, not just the image) |

---

## 6. Font pairing

### 6.1 The Frutiger problem

The organisation's palette specifies **Frutiger for headings and Inter for
body**.

**Verified:** Frutiger is a commercial typeface owned by Monotype (originally
Linotype, Adrian Frutiger). Monotype's licensing documentation states that "a
production font is one that is utilized for a purpose described by a license
that you hold for the font," and the licensing is per-use (desktop, web,
within-software). **A viewer that bundles a font binary needs a desktop/embedded
licence, which is a paid commercial licence.**

**Conclusion: Frutiger cannot be the shipped default.** It may be honoured for
users who have already licensed and installed it, via an `font-family` entry
in the stack. That is the correct, respectful resolution:

```css
--font-heading: "Frutiger Next", "Frutiger", "Inter var", Inter, system-ui, sans-serif;
```

Users with the licence get the brand face. Users without get Inter, which is
the intended fallback. Nobody commits a font-licensing violation.

### 6.2 The actual pairing decision

| Role | Recommended | Why |
|---|---|---|
| Body | **Inter** (variable), fallback `"Segoe UI"` on Windows, `system-ui` | Already the brand choice. Excellent at 17 px, tall x-height, unambiguous `1`/`l`/`I`, large character set, SIL OFL |
| Headings | **Inter** (variable, `wght` 600/700) or, for more character, **Source Serif 4** / **Newsreader** | Two plausible directions, and they are different products. See below |
| Mono | **JetBrains Mono**, **Cascadia Code** (Windows, ships with Windows Terminal/VS), or **IBM Plex Mono** | Cascadia being present on Windows is a real advantage for a Windows-first app |
| UI (chrome, not the document) | **Inter** | Keep the document and the chrome in the same family so the chrome recedes |

**Direction A — "Inter all the way" (recommended for v1).** One family, two
weights, differentiated by size and weight only. This is the warm-minimalist
brand's actual voice: quiet, typographic, no display faces. It also removes an
entire class of "the heading font didn't load" bugs and halves the font payload.

**Direction B — "serif headings, sans body" (a v2 theme, not a default).**
Ship it as a *theme*, not as the default. A reader reading for hours in a
technical document is better served by a neutral sans; a reader reading prose
for pleasure is better served by a serif heading. Let the theme decide, not the
app.

### 6.3 Font loading rules

| Rule | Reason |
|---|---|
| Ship Inter **variable** (`InterVariable.woff2`), subset to Latin + Latin-1 + Cyrillic + Greek, `font-display: swap` | ~50–90 KB subset; three weight files cost more |
| `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` on the fallback face | **Critical**: without this, the metric-compatible fallback causes a visible reflow when Inter loads, which destroys the reader's place. This is the single most common font-loading bug |
| Never use a webfont for the UI chrome; use `system-ui` | Chrome must be instant |
| Do **not** use `font-optical-sizing` aggressively | Variable optical sizing changes glyph widths and can shift measure mid-read |
| Bundled fonts must be OFL / SIL / Apache only | Legal review, not preference |
| Provide a "use system fonts only" setting | Some users have strong preferences and some enterprises forbid webfonts |

---

## 7. Syntax highlight themes

Code is the most-read content in technical documentation, and its colours are
the most likely to break a brand palette.

### Pairing rule

> **A syntax theme is a *pair*: a light theme and a dark theme. A document
> theme names the pair. It never names a single theme.**

Why: a single syntax theme on a dark document background is one of the most
visually unpleasant things a Markdown viewer can produce (yellow `#fff` block
comments on near-black, bright cyan strings). Pairing is not optional.

### Constraints on syntax colours

| Constraint | Value | Reason |
|---|---|---|
| Contrast of code text vs code background | ≥ 4.5:1 | 1.4.3, text |
| Contrast of *punctuation/delimiters* vs code background | ≥ 3:1 | 1.4.11, meaningful graphics |
| Saturation ceiling | Chroma ≤ ~0.12 in OKLCH for the body of a theme | Code colour must not out-compete the document text |
| Accent usage | At most 2–3 token classes use a saturated hue (typically keyword, string, function) | More than that is visual noise |
| Never colour by *meaning the reader must know* | e.g. red = deleted | Diff colouring must be backed up by a +/- glyph |

### Engine choice

| Engine | Licence | Notes |
|---|---|---|
| **Shiki** | **MIT** (verified from the project README) | TextMate-grammar based, extremely accurate, WASM-based, ~200+ themes. Wasm load cost and a large grammar set are real concerns for a small desktop app; **the branch structure (v4 on `main`, v3/v2/v1/v0 branches) signals churn** |
| **highlight.js** | BSD-3-Clause | Browser-first, small, fast, but a smaller language set than Shiki and a self-chosen grammar format |
| **Prism** | MIT | Fast, tiny, tokenisation-only (no AST) |
| **Oniguruma grammars** (TextMate) | MIT | The grammars are a separate asset from the highlighter; licensing must be checked per grammar |
| **linguist** (GitHub) | MIT for the library; grammars licensed separately | What GitHub uses; the reference for coverage |

**Recommendation:** start with **Shiki** for accuracy and theme breadth,
pre-generate the highlighted HTML at render time (so the wasm load happens once
per document, in a worker, not per code block), and ship only the grammars we
have measured. Re-evaluate against `highlight.js` if the wasm payload proves
too heavy for a small install. See [06 libraries](../06-libraries/).

### Pairings that work

| Brand | Syntax light | Syntax dark | Note |
|---|---|---|---|
| Warm Minimal | `github-light` desaturated toward the warm palette | `github-dark` warmed | GitHub's themes are the most familiar to the audience |
| Warm Minimal (alt) | `one-light` | `one-dark-pro` | Slightly warmer, lower saturation |
| High contrast (a11y theme) | `hc-light` | `hc-dark` | Use for the `prefers-contrast: more` case |
| Plain | none | none | Monochrome. A legitimate and underrated choice for reading prose docs with incidental code |

The token `syntax.theme` in the theme JSON selects the pair, so a theme author
can override it without touching our code.

---

## 8. Auditing our own brand palette

### The palette under audit

The organisation's warm-minimalist palette, maintained in the separate
[`siyana-code/brand`](https://github.com/siyana-code/brand) repository
(referenced from the root `README.md`; **note:** there is no `BRAND.md` file in
*this* repository, and the values below are treated as authoritative per the
project brief):

| Token | Hex | Role |
|---|---|---|
| background | `#F5F3F0` | page background |
| surface | `#EBE7E2` | cards, code blocks, TOC panel |
| text | `#2A2724` | body text |
| muted | `#8A8378` | captions, secondary text |
| accent | `#8B6F5C` | links, focus, accents |
| accent-hover | `#5C4A3D` | link hover |
| border | `#D8D2CA` | hairlines |

### Method

WCAG relative luminance per channel:

```
c_lin = c/12.92                if c <= 0.03928
c_lin = ((c+0.055)/1.055)^2.4  otherwise
L     = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

Thresholds: **1.4.3 Contrast (Minimum), Level AA = 4.5:1** for normal text;
**1.4.11 Non-text Contrast, Level AA = 3:1** for boundaries and graphics
needed to identify a component; **2.4.13 Focus Appearance is Level AAA** in
WCAG 2.2, so focus-ring contrast has **no AA threshold** — but 3:1 against
adjacent colours is the practical target because the ring must be *visible*
to satisfy 2.4.7 Focus Visible (Level AA) in practice.

### Results

| Pair | Ratio | Verdict |
|---|---|---|
| `text` on `background` | **13.41** | ✅ AAA |
| `text` on `surface` | **12.07** | ✅ AAA |
| `muted` on `background` | **3.39** | ❌ **fails 4.5:1** for normal text |
| `muted` on `surface` | **3.05** | ❌ **fails 4.5:1** |
| `accent` on `background` | **4.19** | ❌ **fails 4.5:1** for link text |
| `accent` on `surface` | **3.77** | ❌ fails 4.5:1; ✅ passes 3:1 non-text |
| `accent-hover` on `background` | **7.58** | ✅ AAA |
| `border` on `background` | **1.36** | ⚠️ decorative only — fails 3:1 |
| `border` on `surface` | **1.22** | ⚠️ decorative only |
| `surface` on `background` | **1.11** | ⚠️ decorative only |

### Verdict

**The palette is beautiful and it does not pass AA as specified.** Three
specific problems:

1. **`muted` is unusable as a text colour.** At 3.39:1 it fails 1.4.3 even for
   normal text, and it fails badly at the 12 px caption size where the WCAG
   large-text exemption does not apply. Any caption, attribution, or "last
   modified" line in `#8A8378` is an AA failure today.
2. **`accent` is unusable as a link colour.** At 4.19:1 it misses AA for body
   links by a small margin — the worst kind of failure, because it looks fine
   to a designer with good eyesight on a calibrated monitor and fails in the
   real world.
3. **`border` at 1.36:1 is fine as a hairline and not fine as a component
   boundary.** Any control whose only affordance is a 1px border (an input, an
   unselected tab, a checkbox outline) fails 1.4.11. We need a second, darker
   border token for meaningful boundaries.

Nothing about the palette needs to change aesthetically. The failures are all
"this value is used for a job it is slightly too light for". The fix is
**split the roles**: keep `#8A8378` as a decorative/de-emphasised tone, and
introduce a darker muted for text.

### Proposed corrections (light mode)

| Token | Current | **Proposed** | Ratio on bg | Ratio on surface | Change |
|---|---|---|---|---|---|
| `text` | `#2A2724` | `#2A2724` | 13.41 | 12.07 | unchanged |
| `text-muted` (new) | — | **`#6E675D`** | **5.04** | **4.54** | new token, passes AA |
| `text-deemphasized` | `#8A8378` | `#8A8378` | 3.39 | 3.05 | keep, **non-text use only** |
| `link` / `accent` | `#8B6F5C` | **`#6F5240`** | **6.41** | **5.77** | darkened |
| `accent-hover` | `#5C4A3D` | `#4A3B30` | **9.68** | 8.71 | darkened for more headroom |
| `border` (decorative) | `#D8D2CA` | `#D8D2CA` | 1.36 | 1.22 | unchanged |
| `border-strong` (new) | — | **`#8A8378`** | **3.39** | 3.05 | on `bg` ✅ 3:1; on `surface` fails — see note |
| `focus-ring` (new) | — | **`#6F5B4C`** | **5.79** | **5.21** | new token |

**Note on `border-strong`:** 3:1 against a near-white background requires a
value around `#8A8378` (3.39:1 on `bg`) or darker — `#A9A196` gives only 2.31:1
on `bg` and 2.07:1 on `surface`. That is visually heavy for a control border on
a warm minimalist palette. The pragmatic, standards-correct resolution:

- Use the light border for decorative separation (`hr`, table cell dividers,
  panel edges) — this is legitimately exempt under 1.4.11, which applies only
  to boundaries "required to identify a component."
- For **interactive control borders**, do not rely on the border alone: give
  controls a surface fill *and* a border that reaches 3:1 against the *page*,
  not against the control's own fill. `--border-strong: #8A8378` is 3.39:1 on
  `bg` ✅ but only 3.05:1 on `surface`, so a control that sits on a `--surface`
  fill needs `#7F776D` or darker. Test this specific case per theme; it is the
  pair most likely to be missed.

### Proposed dark mode (new — there is currently no dark counterpart)

A dark theme for a warm palette should stay warm; a neutral-cold dark would
break the brand. Proposed:

| Token | Dark value | on `bg` `#1C1A18` | on `surface` `#262320` | Verdict |
|---|---|---|---|---|
| `background` | `#1C1A18` | — | — | warm near-black |
| `surface` | `#262320` | 1.09 | — | elevation step |
| `surface-2` | `#2E2A26` | 1.22 | 1.10 | second elevation |
| `text` | `#EDE8E2` | **14.25** | **12.83** | ✅ AAA |
| `text-muted` | `#9E968B` | **5.94** | **5.35** | ✅ AA |
| `link` / `accent` | `#C9A88C` | **7.82** | **7.04** | ✅ AAA — warm tan, on-brand |
| `accent-hover` | `#E6D2BC` | **11.82** | **10.65** | ✅ AAA |
| `link-visited` | `#B7A99A` | **7.56** | — | ✅ AAA |
| `border` (decorative) | `#3A3531` | 1.43 | 1.29 | decorative |
| `border-strong` | `#6E655C` | **3.04** | 2.74 | 3:1 on `bg` ✅; on `surface` use `#7A7267` or darker |
| `focus-ring` | `#B08A6A` | **5.53** | **4.98** | ✅ well above 3:1 |
| `selection` | `#4A3B30` | 1.62 | — | selection contrast is not an AA requirement; keep the native selection where possible |
| `code-bg` | `#221F1D` | 1.06 | 1.05 | slightly darker than bg so code *recedes*; `text` on it = **13.45** ✅ |
| `mark-bg` | `#4A3826` | 2.86 | 2.51 | `text` on it = **9.15** ✅ AA |

**Two things to fix in that table:**

- `selection` at 1.62:1 is acceptable for selection (contrast of the selection
  highlight is not subject to 1.4.3), but it must not be the *only* indicator —
  keep the platform selection from `color-scheme` where possible.
- `border-strong` is the pair most likely to be missed: `#6E655C` reaches 3:1 on
  `bg` but only 2.74:1 on `surface`. Any control that sits on a `--surface` fill
  needs `#7A7267` or darker. This is precisely the case the CI gate in §8
  exists to catch.

### The gate

This audit is a one-off. It must be a **test**. Concretely:

| # | Rule |
|---|---|
| 1 | A CI job loads every bundled theme, computes every declared text/background pair, and fails below the required threshold |
| 2 | The required thresholds are: `text`, `text-muted`, `link`, `accent-hover` on both `bg` and `surface` ≥ **4.5**; `focus-ring`, `border-strong` on `bg` and `surface` ≥ **3.0**; `text` on `code-bg` ≥ **4.5**; `text` on `mark-bg` ≥ **4.5** |
| 3 | Themes declare which pairs they intend to use (the `meta.contrast` block), so the gate checks intent, not every possible combination |
| 4 | Imported user themes are checked on import and a *warning* is shown — never a hard block, because blocking a user is hostile. The app then offers to auto-darken the offending token until it passes, with a live preview |
| 5 | The auto-darkener must preserve hue and chroma and only adjust lightness until the threshold is met, so the user's theme stays recognisably theirs |

---

## 9. A curated starter set

Ship few, ship well. Every bundled theme is a maintenance and a support
burden.

| # | Theme | Kind | Fonts | Rationale |
|---|---|---|---|---|
| 1 | **Warm Minimal Light** | light | Inter | The brand. Our own palette, corrected per §8 |
| 2 | **Warm Minimal Dark** | dark | Inter | The brand's dark counterpart. Warm, not neutral |
| 3 | **Paper** | light | Source Serif 4 / Newsreader | For prose and long-form reading. The typographically distinct option |
| 4 | **Paper Dark** | dark | same | |
| 5 | **System** | both | `system-ui` / `ui-monospace` | No bundled fonts, fastest load, respects the OS. The default for very old hardware |
| 6 | **High Contrast Light / Dark** | both | Inter | For `prefers-contrast: more` and low-vision users. Near-black on white, ≥ 14:1, thick borders, no transparency |
| 7 | **Solarized Light / Dark** | both | system | A community favourite with a genuinely well-tested dark warm/cool pair. Free goodwill |

Acceptance rules for a bundled theme:

- Passes the CI contrast gate with zero warnings.
- Renders the project's entire fixture corpus correctly, including: tables,
  task lists, footnotes, nested blockquotes, KaTeX output, Mermaid output,
  Shiki output, images, and the print stylesheet.
- Has a light/dark pair (a single-mode theme must ship as a pair).
- Ships only OFL/SIL/Apache-licensed fonts, or none.
- Has a screenshot in the theme picker, generated from the fixture corpus, not
  a mockup.
- Is under ~4 KB of JSON.

---

## 10. Acceptance criteria

| # | Criterion | Priority |
|---|---|---|
| T1 | `light` / `dark` / `auto` with `auto` tracking the OS live, without a reload | P0 |
| T2 | `prefers-color-scheme` used where supported; `light-dark()` pairs used where supported; `@supports not (color: light-dark(...))` fallback present | P0 |
| T3 | `color-scheme` set so native scrollbars, form controls, and the find-in-page highlight follow the theme | P0 |
| T4 | No flash of the wrong theme on cold start or on theme switch | P0 |
| T5 | A theme is a JSON file; no bundled theme contains CSS or JS; unknown keys are warnings not crashes | P0 |
| T6 | JSON Schema published and versioned | P1 |
| T7 | CI gate fails any bundled theme below the §8 thresholds | P0 |
| T8 | User theme import shows a live contrast warning and offers a one-click fix | P1 |
| T9 | Every rule in the app references tokens only; `grep` for hex literals in `packages/ui` returns nothing | P0 |
| T10 | `--font-heading` stack begins with the licensed Frutiger family names, then falls back to Inter; no Frutiger binary is bundled | P0 |
| T11 | Inter loads with metric-compatible fallbacks (`size-adjust`, `ascent-override`, `descent-override`) so there is no reflow | P0 |
| T12 | Every theme has a light/dark syntax-highlight pair; no single theme can be selected | P0 |
| T13 | `<figure>`/`<figcaption>` styling applies to real figure elements, not to `<div>`s with a class | P1 |
| T14 | Seven bundled starter themes, all passing T7 | P2 |
| T15 | A "system fonts only" setting exists and disables all bundled font loading | P1 |
## Sources

- MDN, `prefers-color-scheme` — Baseline *Widely available*, "It's been available across browsers since January 2020" — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme>
- MDN, `light-dark()` — Baseline *Newly available*, "Since May 2024"; accepts two `<color>` values or two images, and works with `var()` — <https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark>
- CSS Color Adjustment Module Level 1, `color-scheme` — <https://www.w3.org/TR/css-color-adjust-1/#color-scheme-prop>
- MDN, `color-mix()` — <https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix>
- MDN, `text-wrap` — Baseline *Widely available* "since March 2024", with uneven support for `balance` and `pretty` — <https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap>
- MDN, `forced-colors` — <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors>
- Electron, `nativeTheme` module — <https://www.electronjs.org/docs/latest/api/native-theme>
- Tauri v2, `@tauri-apps/api/window` (which includes `ColorPanel`) and `tauri::window::Window::theme()` — <https://v2.tauri.app/reference/javascript/api/namespacewindow/> . **UNVERIFIED** whether Tauri v2 exposes the *system accent colour* specifically.
- Monotype, "Licensing" — "A production font is a font that is utilized for a purpose described by a license that you hold for the font", with desktop / web / within-application as distinct uses — <https://support.monotype.com/en/articles/7872341-licensing>
- Monotype, "Font licenses for Monotype Fonts" — <https://support.monotype.com/en/articles/9956482-font-licensing-monotype-fonts>
- Shiki — MIT, TextMate-grammar based; branch table showing `v4.x` on `main` with `v3`/`v2`/`v1`/`v0` maintenance branches — <https://github.com/shikijs/shiki>
- highlight.js — BSD-3-Clause — <https://github.com/highlightjs/highlight.js>
- KaTeX — MIT — <https://github.com/KaTeX/KaTeX>
- W3C, SC 1.4.3 Contrast (Minimum) — <https://www.w3.org/TR/WCAG22/#contrast-minimum>
- W3C, SC 1.4.11 Non-text Contrast — <https://www.w3.org/TR/WCAG22/#non-text-contrast>
- W3C, the relative-luminance definition from which every ratio in §8 was computed — <https://www.w3.org/TR/WCAG22/#dfn-relative-luminance>
- `siyana-code/brand` — the org design-token repository referenced from the root `README.md` — <https://github.com/siyana-code/brand>
