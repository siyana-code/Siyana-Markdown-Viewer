# 05 — Native and other options

> **Status: 6 October 2026.** Crate and framework versions fetched from
> crates.io / official sites today.
>
> This document is written to be *honest about when a native approach is right*,
> not to dismiss it. For a product that is fundamentally **a text layout
> problem**, a custom renderer is not a fallback — under the right conditions it
> is the best answer.

---

## 1. When a custom-rendered approach is the RIGHT call

Let me steelman this properly before listing the options, because our product is
unusually well-suited to it.

### The case for building our own renderer

**1. A Markdown viewer IS a text layout engine.** That is the whole product.
There is no 3D, no audio, no video, no physics. The hard problems are: font
selection, text shaping, bidirectional text, line breaking, inline layout,
justification, block spacing, table layout, and scrolling. A rendering engine is
*exactly* the right abstraction, and it is a well-solved problem.

**2. Pixel-perfect typography is achievable and is a differentiator.** With
HarfBuzz-quality shaping (cosmic-text), full control over line-breaking and
justification, and our own hinting/antialiasing decisions, we can produce
reading comfort **better than any browser allows** — because we can tune
line-height, measure, kerning, and hanging punctuation in ways a CSS engine
resists. Typora and Obsidian are loved partly for exactly this.

**3. Zero webview security surface.** No Chromium/WebKitGTK CVE applies to us.
No XSS possible (no HTML). No dependency on a distro shipping
`libwebkit2gtk-4.1`. **RHEL 8/9 works.** The security argument from
[`03-flutter.md` §3](03-flutter.md) applies in full, and without Flutter's
weight.

**4. Tiny footprint.** A Rust binary with cosmic-text + tiny-skia is single-digit
MB. Faster startup. Small memory.

**5. Total control over the reading experience.** Custom scrollbars, custom
selection, custom find, perfect print pagination, dark/light theme with a real
colour pipeline. All of these are *hard or impossible* in a webview and are
*dramatically easier* when we own the renderer.

**6. Linux works everywhere.** GTK/GLib only. No exotic deps. This is the option
that actually solves the §9 problem that constrains Tauri and Wails.

### The cost, honestly

| Cost | Detail |
|------|--------|
| **We build the HTML-equivalent** | Block layout, inline layout, tables, images, code blocks, footnotes, math. This is months. |
| **We build the accessibility tree** | A screen reader needs an OS-specific bridge (UI Automation / AT-SPI / NSAccessibility). Flutter got this; a custom renderer does not come with it. **This is a serious, often-underestimated cost.** |
| **We build print/PDF** | Real pagination, headers/footers, page breaks. |
| **We build find-in-document** | Trivially easy for us, but we must build it. |
| **We build selection & clipboard** | Cross-block selection with proper copy semantics. |
| **Text input / IME** | Only if we build editing. As a *viewer* we skip this entirely — which is our situation. |
| **We own the bugs** | Font fallback, missing glyphs, RTL, ligature surprises, HiDPI, subpixel positioning. A mature text stack helps enormously but these bugs still land. |
| **We lose the web target** | Unless we compile the renderer to WASM, which is a second implementation |
| **We lose the CSS ecosystem** | Every existing reader theme is unusable |

### The verdict framing

**As a viewer with a hard "must work on every Linux distro" requirement and a
pixel-perfect-typography thesis, a custom Rust renderer is genuinely the best
technical answer.** That is why it is documented here in detail and why
[`06-comparison-matrix.md`](06-comparison-matrix.md) scores it seriously rather
than dismissing it.

**As a project that needs desktop + web + mobile from one team in reasonable
time, it is a trap** — because the web and mobile targets would then require a
*second*, completely different renderer, which is precisely the reuse we are
trying to maximise.

**The synthesis — and I think this is the most interesting idea in this
folder — is not "custom renderer" but "shared core + thin renderers":** do the
parsing, layout math, and syntax highlighting once in Rust; compile it to WASM
for the web build; call it natively for desktop; and for mobile use the same
WASM inside a `WebView`/`react-native-webview`/Capacitor container that
*displays already-laid-out output* rather than running a web engine over HTML.
That gets a custom renderer with reuse. See
[`07-hybrid-architectures.md` § option (d)](07-hybrid-architectures.md).

---

## 2. Rust immediate-mode GUIs: `egui` and `iced`

> Versions: `egui` **`0.36.2`** (8 Sep 2026) · `iced` **`0.14.0`** (7 Dec 2025).
> Source: [crates.io egui](https://crates.io/api/v1/crates/egui) ·
> [crates.io iced](https://crates.io/api/v1/crates/iced)

### egui (`egui` / `eframe`)

**Immediate-mode**: you write a function `fn ui(&mut Context)` that is called
~every frame, and you *describe* the UI as a stream of immediate calls
(`ui.horizontal(...)`, `ui.label(...)`). There is no retained widget tree —
state lives in your own structs.

```rust
struct Viewer { doc: Vec<Block>, scroll: f32, query: String }

impl App for Viewer {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut Frame) {
        egui::TopBottomPanel::top("toolbar").show(ctx, |ui| {
            ui.horizontal(|ui| {
                if ui.button("📂 Open").clicked() { /* … */ }
                ui.text_edit_singleline(&mut self.query);
            });
        });
        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                for block in &self.doc {
                    match block {
                        Block::Heading(lvl, text) => {
                            ui.add(egui::RichText::new(text).heading());
                        }
                        Block::Para(spans) => {
                            ui.label(egui::RichText::new(rich_label(spans)).size(16.0));
                        }
                        Block::Code(lang, src) => {
                            ui.group(|ui| { ui.monospace(src); });
                        }
                    }
                }
            });
        });
    }
}
```

**Strengths:**
- **Exceptional for tools and debug UIs.** Widely used in that niche precisely
  because it is fast to build and fast to iterate.
- **Gorgeous built-in theme**, including the dark mode we want.
- **`egui_extras` has real widgets** for us: `ScrollArea`, `TextEdit`,
  `Image::from_bytes`, and a `TableBuilder`.
- **Runs everywhere**: wgpu renderer, tiny binaries, no system webview.
- **Playable in a browser** via `WebRunner` — so the web target exists, in a
  limited form.
- `0.36.2` released 8 Sep 2026: **actively developed**.

**Weaknesses for us:**
- **No text layout.** `egui::RichText` lays out within a `Label`. It does **not**
  wrap paragraphs with proper inline layout, mixed fonts, or a paragraph box we
  can measure and lay out. **We would have to render each block ourselves into
  a `Painter`,** which means building the renderer *on top of* egui with egui
  only providing the window, input handling, and chrome.
- **Immediate-mode is a poor fit for a document viewer.** It is excellent for
  tool panels; it is awkward for a scrollable virtualised document where you want
  retained-mode layout so off-screen blocks cost nothing. You *can* do it (only
  build visible blocks), but you are fighting the paradigm.
- **Immediate-mode accessibility is weak.** egui has limited screen-reader
  support. For a reading app, that matters.
- **No native text input quality issues** if we use `TextEdit` for search — that
  part is actually fine, IME included.

### iced (`0.14.0`)

A **retained-mode** (Elm-architecture) Rust GUI: `update(msg) → Command`,
`view(&state) → Element`. Better suited to a document model than egui, and the
author is the same as `cosmic-text`'s ecosystem, so the text crates integrate
naturally.

**Strengths:** retained mode suits a document; `iced` + `cosmic-text` is a
natural pairing; cross-platform including web.

**Weaknesses:** **no text layout engine at all** — we would bring our own;
`0.14.0` (7 Dec 2025) is a **~10-month-old release**, which for a young project
signals slower development than egui; smaller ecosystem; same accessibility
gap.

### egui/iced scorecard

| Dimension | Rating |
|-----------|--------|
| Binary size | **Excellent** — single-digit MB |
| Memory | **Excellent** |
| Startup | **Excellent** |
| Cross-platform consistency | **Good** — our own rendering, but GPU differences remain |
| Linux distro coverage | **Excellent** — GTK/GLib only |
| Security | **Excellent** — no webview |
| Text layout | **None provided** — we build all of it |
| Accessibility | **Poor** |
| Mobile | **Partial** — web/wasm only, no real touch-native story |
| Web target | **Weak** — wasm builds exist but are not a first-class web app |
| Learning curve | **Medium-high** for a web team (Rust + a new paradigm) |
| Ecosystem maturity | **Medium** |

**Verdict: credible only as the *window and input* layer of a custom-rendered
viewer — not as a UI framework we build a Markdown reader on.** Combined with
cosmic-text and our own layout code, it becomes the "native, tiny, perfectly
consistent" option. That is a real product thesis, but it is not the
maximum-reuse thesis.

---

## 3. The Rust text-shaping stack

> Versions fetched from crates.io today:
> **`cosmic-text` `0.19.0`** (22 Apr 2026) ·
> **`parley` `0.11.1`** (16 Aug 2026) ·
> **`skrifa` `0.48.0`** (3 Oct 2026).

This is the part that makes a custom renderer genuinely feasible rather than
fantasy, and it is genuinely excellent. All three are maintained by the
**Linebender** organisation and are used in production by Firefox's
`stylo`/`cosmic-text` work and by system software.

### What each one does

| Crate | Role | Licence |
|-------|------|---------|
| **`skrifa`** | Font loading, metrics, glyph outlines, colour, and **variable font** support | MIT OR Apache-2.0 |
| **`parley`** | **Line layout and text shaping.** Font fallback, itemisation, bidirectional text (bidi), inline layout of styled spans, line breaking, **line-breaks/measure**, alignment, `LineMetrics` | MIT OR Apache-2.0 |
| **`cosmic-text`** | A batteries-included higher-level API over `parley`, adding buffer/editor editing, cursor mapping, selection, and shaping | MIT OR Apache-2.0 |

`parley` is the important one, and it is the answer to "we need line breaking".
It gives you:

- **Real bidi** (Arabic, Hebrew) — hard, and solved.
- **Real font fallback** with a proper chain — the thing every hand-rolled
  renderer gets wrong (tofu boxes).
- **Inline layout of mixed-style spans**: `**bold** and _italic_ within a
  paragraph, with correct kerning across style boundaries.**
- **Line metrics**: ascent/descent/line-height/leading, which is what you need
  for good vertical rhythm.
- **`measure_line`** for on-demand layout (a "shape on demand" text engine, like
  Chromium's).

```rust
use parley::layout::{Layout, LineBreaker};
use parley::style::{Style, LineHeight, FontFamily};
use parley::font::Font;
use parley::color::Color;

let font = Font::from_bytes(font_bytes)?;      // skrifa
let mut lf = Layout::new();
lf.set_font_size(18.0);
lf.set_line_height(LineHeight::FontSizeRelative(1.55)); // reading comfort

// A paragraph is a sequence of items: text runs + inline boxes.
lf.push_text("Hello, ");
lf.push_text("bold world");                     // bold family
// ... then shape and break:
let mut breaker = LineBreaker::new(&lf);
breaker.init_range(&lf, range_of_paragraph);
while let Some(line_range) = breaker.next_line() {
    let metrics = breaker.line_metrics(line_range, &lf);
    // lay out this line, get its width, draw it
}
```

**Why this matters enormously for us:** it means the hardest, most
error-prone part of a text renderer — shaping, fallback, bidi, line breaking —
is *already solved, well-tested, and maintained by people whose job is exactly
this*. We would build **layout** (blocks, inline boxes, tables, images) and
**painting** on top of a professional text engine. That is a months-to-weeks
saving versus rolling our own.

**The hard parts we still own:**

| Problem | Difficulty | Notes |
|---------|-----------|-------|
| **Block layout** (headings, paragraphs, lists, quotes, hr) | Medium | We control it. Standard CSS-like box model |
| **Inline layout** of spans across a paragraph | Medium | `parley` does the run-level work; we place the runs |
| **Tables** | **Hard** | Intrinsic sizing, column widths, overflow, sticky headers, nested inline content. Real work |
| **Code blocks with syntax highlighting** | Medium | Need a tokenizer; `syntect` exists but is heavyweight; a small hand-rolled one for common languages is fine |
| **Math** | **Hard** | LaTeX layout is a research project. Or delegate to a webview/`<img>` — which reintroduces web content |
| **Images** | Medium | Decode (image crate), intrinsic size, layout modes (block, inline, side-by-side) |
| **Painting / AA** | Medium | `tiny-skia` is the natural choice; subpixel positioning decisions are ours |
| **Selection + clipboard** | Medium-Hard | Map hits back to text ranges; OS clipboard via `arboard` |
| **Accessibility tree → OS bridge** | **Hard** | UI Automation (Win), AT-SPI (Linux), NSAccessibility (macOS). Each is a separate subsystem |
| **IME** | N/A for a viewer | Skip it — huge saving |
| **Print / PDF** | Medium-Hard | Pagination with real page breaks |
| **Find-in-document** | **Easy** | Trivial once we own the text |
| **Virtual scrolling** | Medium | Standard |

**Dependency health note:** cosmic-text at `0.19.0` (Apr 2026) is a little
behind parley `0.11.1` (Aug) and skrifa `0.48.0` (Oct). These crates evolve
together; expect API churn. Also note that Tauri's own release page surfaced
`rustybuzz` and `ttf-parser` unmaintained advisories in its dependency tree —
`ttf-parser` is in this ecosystem, so we would need a `cargo audit` story too.

---

## 4. C/C++ toolkits with a webview

### Qt 6 + QWebEngineView

The heavyweight, maximally-capable option. QWebEngineView is real Chromium
(like Electron, ~150 MB), so you get **Chromium's CSS but with a native shell
around it** — and, importantly, **no Node.js in the renderer**.

| | |
|---|---|
| Licence | LGPLv3 (dynamic linking) / GPLv3 / **commercial** |
| Size | ~150 MB+ with QWebEngine (QtCore+GUI alone is ~5–10 MB) |
| Linux | Excellent; ships in most distros; Qt is everywhere |
| Windows/macOS | Excellent |
| Mobile | ❌ **Qt for Mobile (QML) exists but QWebEngine does not** |
| JS | ✅ Full ES202x+, because it is Chromium |
| Sanitiser | ✅ **Bundled as a real Qt module** |
| Debugging | Good (Chromium DevTools attachable) |
| Ecosystem | Enormous, commercial-backed (Qt Group PLC) |
| Learning curve | High but not exotic |

**The Qt angle deserves a fair hearing** because two of its properties are
genuinely attractive for us:

1. **QWebEngine ships a sanitiser** (`QWebEngineSanitizer`) with granular
   allow/deny. For a Markdown viewer that is a *lot* of the security work done
   for you.
2. **Node is not present**, so the "XSS → RCE" chain that makes Electron risky
   does not exist. The webview is a sandboxed Chromium with no system bridge —
   much closer to a browser's threat model.

**Against it:** LGPL means dynamic linking obligations (acceptable for an
open-source project if we comply, but it constrains distribution); the size is
Electron's; no mobile webview; Qt's C++ is not our team's likely strength; and
**we would be paying 150 MB to get Chromium when Electron also gives us Chromium
plus a better ecosystem and better tooling.** There is no scenario where, for
this project, Qt beats Electron. Qt's advantage over Electron is *security
narrowing*, not capability — and Electron's `sandbox: true` +
`contextIsolation: true` gets us most of the way at lower cost with far better
tooling.

**Include it for completeness. Do not build on it.**

### JavaFX + WebView

**This one is worse than it looks, and I want to say so clearly.**

| | |
|---|---|
| Licence | OpenJDK GPLv2 + Classpath Exception → usable in proprietary apps |
| Desktop maturity | ⚠️ **Weak and declining.** Oracle moved JavaFX out of the JDK and into **OpenJFX**, a separate project. Downloads are slow. Feature parity with Swing/AWT is incomplete |
| WebView | **Very old WebKit/Chromium fork, frequently stale.** On Windows it wraps IE-based MSHTML in older releases |
| Mobile | ❌ None |
| JS | ❌ **Old engine — modern JS will not run** |
| Packaging | Awkward; needs a JRE bundled (adds 40–60 MB) |

**JavaFX's WebView is not a modern browser engine.** A Markdown viewer needs
`text-wrap`, container queries, `:has()`, and modern CSS for a good reading
experience, plus a modern JS engine. You would be shipping 2015-vintage
rendering on a runtime you bundle anyway.

**Verdict: not credible.** The JRE dependency, the stalling OpenJFX cadence,
the ancient WebView, and the absence of any mobile story together rule it out.

### GTK4 + WebKitGTK

The "Linux-native" option: GTK4 for the window, `WebKitWebView` (GTK4 binding of
WebKitGTK) for content.

| | |
|---|---|
| Licence | LGPLv2.1+ |
| Linux | ✅ **The best of any option** — this *is* the Linux desktop stack |
| Windows/macOS | ⚠️ Poor. GTK on Windows is possible but nobody ships it that way |
| Mobile | ❌ None |
| CSS/JS | Whatever the distro's WebKitGTK is — the fragmentation problem in full |
| Dependencies | GTK4 + WebKitGTK 4.1 (or `webkitgtk-6.0` for GTK4) — exotic on RHEL |
| Ecosystem | Mature GNOME apps; would be a strange choice for a cross-platform tool |

**Only makes sense if the product is Linux-only and GNOME-integrated.** Not us —
we need Windows first.

**Interesting as a data point though:** GTK4 + WebKitGTK 6.0 is where the Linux
desktop is heading, and it is the *same* WebKitGTK our Rust and Tauri builds
depend on. Worth tracking.

### Avalonia (C#) + WebView

| | |
|---|---|
| Licence | MIT |
| Runtime | .NET (self-contained deployment bundles ~60–70 MB) |
| Rendering | **Skia-based, own renderer** — same thesis as Flutter, without Flutter's Dart |
| Desktop maturity | ✅ **Good.** Windows/macOS/Linux, genuinely cross-platform, actively developed |
| WebView | `WebView`/`WebView2` on Windows (real Chromium); **weaker on Linux/macOS** |
| Mobile | ⚠️ **iOS/Android in development/beta** — Avalonia has long promised this; the maturity is well below Flutter's |
| Text | Uses the OS text stack → **we lose pixel-perfect consistency** (unlike Flutter) |

**Avalonia is the most interesting "other" for a .NET shop** and it is a solid,
MIT-licensed, actively-developed framework with genuinely good desktop support.
Its XAML declarative UI is closer to Flutter's model than to Electron's.

**But it does not solve our problem for us:** it either renders its own UI (in
which case we have Flutter's problem *plus* the OS-text-consistency problem,
since Avalonia uses system fonts and text rendering) or embeds a webview (in
which case Linux/macOS webview support is weak, and we have Tauri's problem plus
a 70 MB runtime). And its mobile story is not ready.

**Also relevant: Avalonia's own XAML+Skia approach is a live demonstration that
a custom-rendered cross-platform desktop app is achievable without Flutter.**
That is worth knowing even if we don't pick it.

---

## 5. When each native option is the RIGHT call

| Option | Right when | Wrong when |
|--------|-----------|------------|
| **Custom Rust renderer** (cosmic-text + parley + tiny-skia, egui/iced shell) | Pixel-perfect typography is the product thesis; you need a ~5 MB binary; you must run on every Linux distro including RHEL; you can afford 6–12 months and permanent ownership; desktop is the *only* target | You need a web target soon; you need accessibility for free; you have a small team |
| **egui / iced** | You want a native window + input for a custom-rendered viewer, or a dev tool | You want a UI toolkit to build a document reader on |
| **Qt 6 + QWebEngine** | You need Chromium *without* Node (security), you have C++ skills, LGPL is acceptable, mobile is not a target | You want small size, modern JS tooling, or a mobile path |
| **JavaFX + WebView** | Already a Java shop and the app is trivial | Almost always — the WebView is too old |
| **GTK4 + WebKitGTK** | Linux-only, GNOME-integrated | You need Windows |
| **Avalonia + WebView2** | .NET shop, desktop-only, want a modern declarative UI | You need pixel-perfect consistency or a mature mobile story |

---

## 6. Scorecard for the native tier

| Dimension | Custom Rust renderer | egui/iced | Qt 6 | JavaFX | GTK4 | Avalonia |
|-----------|--------------------|-----------|------|---------|-------|----------|
| Install size | ★★★★★ | ★★★★★ | ★★ | ★★ | ★★★★ | ★★★ |
| Memory | ★★★★★ | ★★★★★ | ★★ | ★★ | ★★★★ | ★★★ |
| Startup | ★★★★★ | ★★★★★ | ★★ | ★ | ★★★★ | ★★★ |
| Linux distro coverage | ★★★★★ | ★★★★★ | ★★★★ | ★★ | ★★★★★ | ★★★★ |
| Security (no webview) | ★★★★★ | ★★★★★ | ★★★★ | ★★ | ★★★ | ★★★ |
| Text layout provided | ★★★★ (parley) | ★ | ★ (Chromium) | ★ (old) | ★ (WebKit) | ★ |
| Accessibility provided | ★ | ★ | ★★★★ | ★★ | ★★★★ | ★★★ |
| Packaging / signing | ★★★ | ★★ | ★★★★ | ★★ | ★★ | ★★★ |
| Auto-update | ★ (build it) | ★ (build it) | ★★ | ★ (build it) | ★ (build it) | ★★ |
| **Web target** | ★ (WASM only) | ★ | ★★ | ★ | ★ | ★★ |
| **Mobile target** | ★ | ★ | ★ | ★ | ★ | ★★ |
| Learning curve | ★★ | ★★ | ★★ | ★★★ | ★★★ | ★★★ |
| Ecosystem maturity | ★★ | ★★★ | ★★★★★ | ★★ | ★★★★ | ★★★ |
| Licensing | ★★★★★ | ★★★★★ | ★★★ (LGPL) | ★★★★ | ★★★★ | ★★★★★ |

---

## 7. The synthesis, stated plainly

The single most important conclusion of this document, and I want it recorded
because it is the design idea worth carrying forward:

> **A Markdown viewer is a text layout problem. The text layout stack is solved,
> open source, MIT/Apache licensed, and small: `skrifa` + `parley` +
> `cosmic-text`. That means the "write our own renderer" option is not a
> fantasy — it is a months-not-years project if we are willing to own it, and it
> would give us perfect typography, a tiny footprint, total security, and
> universal Linux support.**

**The strategic problem with it is not feasibility. It is reuse.** A custom
renderer means a second implementation for the web target (or a WASM port) and
a third for mobile. That directly contradicts our stated priority.

**Therefore: the highest-leverage architectural decision for this project is not
"which framework?" but "how many renderers will we maintain?"** — and the
answer should be **one**, with the shell being as thin as possible.

That points to the hybrid topologies in
[`07-hybrid-architectures.md`](07-hybrid-architectures.md), where the renderer
is HTML/CSS (one implementation, reused by desktop shell + browser + Capacitor),
and the native side is reduced to file I/O and window management.

If instead we conclude that **pixel-perfect typography plus a 5 MB footprint plus
universal Linux support outweighs cross-platform reuse**, then the custom Rust
renderer is the right answer and we should plan for it deliberately: build
`parley`-based layout as a **shared Rust core compiled to both native and WASM**,
so the layout engine is written once even if the *shell* is not. **That is the
version of the native option that does not throw away reuse**, and it is the
one I would argue for if we went native.
