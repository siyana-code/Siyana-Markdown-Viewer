# 03 — Flutter (Desktop)

> **Status: 6 October 2026.** Stable **`3.47.6`** (1 Oct 2026), bundling
> **Dart 3.13.5**. Beta is `3.49.0-0.2.pre` (1 Oct 2026).
>
> Sources: [Flutter release JSON (Google Cloud Storage)](https://storage.googleapis.com/flutter_infra_release/releases/releases_windows.json)
> (the authoritative machine-readable feed) ·
> [SDK archive](https://docs.flutter.dev/install/archive) ·
> [desktop support docs](https://docs.flutter.dev/platform-integration/desktop)

---

## 1. The one thing that matters: Flutter does not use a system webview

This is the whole story, and everything else follows from it.

**Flutter renders to its own graphics surface using its own engine.** It does
not embed a browser. There is no DOM, no CSS, no HTML parser, no
`document.createElement`. Instead:

```text
Dart code
  → widget tree (retained-mode, declarative)
  → Flutter's own layout engine
  → Skia / Impeller rasterisation
  → GPU
```text

Impeller — Flutter's renderer — became the default across platforms, and
**Impeller on Desktop landed in 3.47** (12 Aug 2026,
["What's new in Flutter 3.47: Modular by design: Standalone UI Packages and
Impeller on Desktop"](https://flutter.dev/blog/whats-new-in-flutter-3-47)). That
was the last major desktop rendering milestone.

### What this buys us

**1. Pixel-perfect cross-platform consistency — guaranteed, not hoped for.**
The same Dart code produces the same glyphs at the same positions on Windows,
Linux, macOS, Android, iOS, and web. Not "nearly". *Identically*, because
Flutter ships its own text shaper and rasteriser rather than deferring to
DirectWrite / CoreText / Pango / whatever the OS provides.

**2. No webview fragmentation.** No `libwebkit2gtk-4.1` requirement. No RHEL 8/9
blocker. No "does this distro's WebKitGTK support `:has()`". Flutter's engine is
in our binary.

**3. Predictable, excellent rendering performance.** 60fps on a 2015 laptop is
attainable; 120fps on supported hardware. Consistent frame times because we
control the rasteriser.

**4. One codebase for Android and iOS** — and it is genuinely one. This is
Flutter's strongest argument and it is real.

**5. Hot reload that is genuinely instant** (~200ms in release, sub-second in
debug), and a first-class `flutter` CLI with `flutter run -d windows|linux|macos`.

### What this costs us — and it is expensive for a Markdown viewer

**We cannot use HTML or CSS. At all.**

Markdown is a text format whose entire *rendering* story is "produce an HTML
tree, then style it with CSS." Every one of these is unavailable in Flutter:

| What we would want | Why it's unavailable |
|--------------------|----------------------|
| `markdown-it` / `remark` / `commonmark` JS parsers | No JS engine in the renderer |
| Any HTML output | No DOM, no HTML parser |
| Any CSS — including a pre-existing reader stylesheet | No CSS engine |
| `<h1>`…`<h6>`, `<table>`, `<pre>`, `<sub>`/`<sup>` semantics | No HTML elements |
| CSS Grid / Flexbox / `subgrid` / container queries | No CSS |
| Web fonts via `@font-face` | Flutter's own font pipeline (`pubspec.yaml` `fonts:`) |
| Browser accessibility tree | Flutter has its own semantics tree — different, not absent |
| `Ctrl+F` browser find | **Does not exist.** Must be built |
| Print / "Save as PDF" via `window.print()` | Must be built |
| Right-click → "Copy" | Flutter's `SelectableText` / `TextField` semantics |
| Browser devtools | Flutter DevTools instead — different model |
| Pyodide/WASM for a Rust parser | Possible but heavy |

**The consequence is blunt: to ship a Markdown viewer in Flutter we must write a
Markdown renderer in Dart.** Not wrap one — write one.

---

## 2. The Markdown-rendering cost, itemised

### The parser exists. The renderer does not

The Dart `markdown` package (pub.dev, **7.3.1**, 18 Mar 2026 — fetched today)
provides a CommonMark+GFM-ish parser producing `md.Document` — a tree of
`md.Element` / `md.Text` / `md.UnparsedText` nodes. The *parsing* half of the
problem is solved and reasonably well.

The rendering half is a tree-walk from `md.Document` to Flutter widgets. That is
tractable — maybe 800–2,000 lines for solid CommonMark coverage — but it is
**our** code, and it has to be **our** code forever**, because every time
CommonMark, GFM, or our dialect evolves, we implement it.

### Existing widget-based renderers (all verified on pub.dev today)

| Package | Latest | Last published | Assessment |
|---------|--------|----------------|------------|
| `flutter_markdown` | `0.7.7+1` | 6 May 2025 | **The official-ish one** (flutter/packages). Thinnest wrapper over `markdown`. ⚠️ **17 months without a release** |
| `gpt_markdown` | `1.3.1` | **4 Oct 2026** | Most actively maintained. Purpose-built for LLM/streaming output; rich block support; LaTeX-ish; code blocks with highlighting |
| `markdown_widget` | `2.3.2+8` | 26 Apr 2025 | Older. Custom `TextSpan`-based approach |
| `flutter_html` | `3.0.0` | 11 Mar 2025 | Renders **HTML with CSS** via `flutter_html`. Interesting escape hatch — see below |

**Note the dates.** `flutter_markdown` last shipped May 2025; `markdown_widget`
April 2025. Both ~18 months stale as of today. `gpt_markdown` shipped **two days
ago** and is clearly alive. This tells you something real: **the Flutter
Markdown ecosystem is thin and its flagship renderer is not well maintained.**

### `flutter_html` — the interesting escape hatch

`flutter_html` renders **actual HTML and a CSS subset** in Flutter without a
webview. That would let us write our renderer as "emit HTML like we do for the
web build, render it with a Dart HTML parser." That's a genuinely interesting
idea for us because it maximises shared thinking with the web renderer.

But: it is a **CSS subset**, not a browser. No Grid, no subgrid, no container
queries, limited selectors, no custom properties beyond a simple cascade. It is
last published March 2025. And a Rust/WASM Markdown parser feeding it is a lot of
machinery for one screen.

**Assessment: `flutter_html` is a trap dressed as a shortcut.** It gives an
illusion of "the same renderer everywhere" while being a different, worse
renderer — the worst of both worlds.

### What we would have to build regardless

These are not optional for a *viewer*, and none of them exist in any Flutter
package:

| Feature | Why it's hard |
|---------|---------------|
| **Syntax highlighting** | `highlight.js` is JS. Dart's `highlight` package (`0.7.0`, **last published 7 Mar 2021**) is stale. We'd write or vendor a tokenizer. `gpt_markdown` bundles one |
| **`Ctrl+F` find-in-document** | **No browser find.** Need our own: index visible text, highlight matches, scroll-to-match. This is a real feature, not a nicety |
| **Print / Export PDF** | `Printing` package (community) can render Flutter widgets to PDF — but only our widget tree. Works, but layout-for-print is custom work |
| **Copy selection** | `SelectableText` per-block, or a full custom selection model across blocks |
| **Anchor links / TOC scroll** | Custom scroll controller + `ScrollablePositionedList`-style index math |
| **Tables** | Tables are *hard* in Flutter: intrinsic width, horizontal scroll, sticky headers, cell overflow. Flutter has no `display: table` |
| **Images from disk** | `Image.file` works, but sizing/intrinsic-dimension handling is manual |
| **Link handling** | `url_launcher` `6.3.2` (2 Oct 2026) — actively maintained, fine. But we must validate schemes ourselves |
| **Text selection across block boundaries** | Flutter's selection model is per-`RenderParagraph`; spanning blocks needs custom work |

**Tables and Ctrl+F alone are weeks of work.** A Markdown viewer is
*table-heavy* and *find-in-page* is table stakes.

---

## 3. Security: genuinely better, for a non-obvious reason

This is Flutter's strongest argument for a Markdown viewer and it is
mathematically sound rather than a matter of configuration.

**There is no HTML DOM, so there is no DOM-XSS surface.**

| Threat | Web approach | Flutter approach |
|--------|--------------|------------------|
| `<script>` in Markdown | Sanitiser must strip it | **No HTML parser — the tag is just text** |
| `<img onerror=...>` | Sanitiser must strip it | No HTML — nothing to sanitise |
| `<a href="javascript:...">` | Sanitiser must reject the scheme | We construct widgets; we decide what to do with links |
| `javascript:` URLs | **Must** be filtered | Only if we choose to launch them |
| CSS injection (`style="..."`) | Sanitiser must strip `style` attrs | No CSS |
| DOM clobbering | Real risk | No DOM |
| Prototype pollution | Real risk | Dart, no prototype chain |

**In Flutter, "sanitisation" mostly collapses into "we never build a widget from
untrusted structure."** Our renderer maps `md.Element` tags to a **closed enum
of known widgets**; anything unknown renders as literal text. There is no path
from Markdown to an executable construct. That is a categorically stronger
position than "we sanitise carefully", and it is the single most compelling
technical argument for Flutter for *this* product.

**But — and this is important — the risks move, they don't vanish:**

| New risk | Detail |
|----------|--------|
| **Link scheme handling** | We control `onTap`. We must allow-list (`https`, `mailto`) and refuse `javascript:`, `file:`, `intent:`, custom schemes. `url_launcher` will happily launch whatever you give it |
| **Embedded web content** | If we ever embed HTML (e.g. an inline HTML block, or a YouTube embed), we need `flutter_webview` — and **that reintroduces the entire webview threat model we just escaped.** `flutter_webview` is a wrapper around the platform WebView; its `setJavaScriptMode(JavaScriptMode.unrestricted)` is the same footgun |
| **Path traversal via image paths** | `![](../../.ssh/id_rsa)` — we must resolve and constrain, exactly like the Tauri asset scope / Electron protocol allow-list |
| **Denial of service** | A 100 MB file or a pathological table still hangs the UI unless we virtualise. Flutter's `ListView.builder` helps; a huge single `Column` does not |
| **Dart AOT obfuscation is not encryption** | `dart compile exe` / `--obfuscate` is not a security boundary. If we ship proprietary features, they are recoverable. (Moot for an open-source project) |

**Honest verdict: Flutter is the most secure renderer option for untrusted
Markdown — by a clear margin — provided we never embed web content.** That
"provided" is doing real work.

---

## 4. Desktop maturity and known desktop-specific issues

### Where Flutter is strong on desktop

- **Consistent rendering** (see §1).
- **Impeller on Desktop** landed in 3.47 (12 Aug 2026) — the modern renderer
  with better text and better GPU behaviour.
- **Hot reload across all platforms** including desktop, which is the best
  dev-loop of any candidate.
- **`flutter build windows` / `flutter build linux` / `flutter build macos`** —
  first-class, documented, no extra tooling to learn.
- **First-party plugins** for exactly what we need: `window_manager` `0.5.2`
  (4 Jul 2026), `desktop_drop` `0.8.4` (1 Sep 2026), `screen_retriever` `0.2.2`
  (4 Jul 2026), `url_launcher` `6.3.2` (2 Oct 2026), `go_router` `18.0.2`
  (28 Sep 2026) — all actively maintained as of the last few months.
- **Accessibility** has a real semantics tree and passes screen-reader audits
  (though see below).

### Known desktop-specific issues

**1. Text rendering is *not* OS-native, and that cuts both ways.**

Flutter does its own shaping (via HarfBuzz, embedded) and its own rasterisation.
So text does **not** get the OS's subpixel antialiasing, ClearType tuning, or
hinting. On Windows this is the most commonly reported "why does this look
different from every other app" issue. For a **typography product** this is
ironic and significant: a Markdown viewer's entire value is reading comfort, and
we would be shipping our own antialiasing rather than the OS's.

Conversely, we get **identical text on every platform**, which is a genuine
benefit for a reader that must look the same everywhere.

**2. Accessibility on desktop is weaker than web.**

This is a real, documented-in-practice gap. Screen-reader support on Windows
desktop is behind the web, and desktop has no equivalent of the browser's
accessibility tree inspection tooling. There *is* a semantics tree and
[Flutter's accessibility docs](https://docs.flutter.dev/ui/accessibility) are
thorough, and Flutter has published desktop a11y audits. But if we care about
a11y, the web target will be ahead of the desktop target — the opposite of
usual.

**3. No native menu parity — but Tauri has the same gap, differently.**

Flutter desktop menus are built from Flutter widgets (`PlatformMenuBar`,
`MenuBar`), **not** the OS's native menu bar on Windows/Linux. `window_manager`
exposes `setMenuBar` which takes Flutter widgets. On macOS the app menu is
integrated more natively. So on Windows, our File/Edit/View menus are
in-window chrome, not a real `HMENU`. That is visible to users. **Note this is
not a Flutter-specific sin** — Tauri and Electron both have partial native menu
support with platform gaps. Electron's `Menu.setApplicationMenu` is genuinely
native on Windows and macOS, and that is one place Electron wins.

**4. IME (input method) for CJK.**

Critical for a Markdown viewer, given the Siyana lineage and likely CJK users.
Flutter's IME integration works on desktop but has historically been rougher than
on mobile, and composing-text behaviour in a `TextField`/`EditableText` is not
the same as in a browser `contenteditable`. **This is a must-test item** — it
would be a serious regression for CJK users. Electron gets a real browser's IME
for free.

**5. No `Ctrl+F`.** Covered in §2. Must be built.

**6. Text selection across blocks.** Flutter selection is per-`RenderParagraph`.
Selecting across a heading and the paragraph below it requires custom work.
**Must be built.**

**7. Accessibility tree + custom widgets cost.** Every custom widget needs a
`Semantics` wrapper to be accessible. We will write a lot of custom widgets, so
we will write a lot of `Semantics`. This is a real, ongoing cost the web
renderer gets for free from real HTML.

**8. Web target is mediocre.** Flutter web (CanvasKit / skwasm) produces large
load bundles and has poorer text rendering and accessibility than plain HTML.
Since we want a web build too, Flutter's web output would be our *weakest*
target despite being "the same codebase".

**9. Desktop plugin maturity.** Mobile plugins vastly outnumber desktop ones.
What we need exists, but the tail is thinner — and `flutter_markdown` being
17 months stale is representative.

---

## 5. Packaging

### Commands

```bash
flutter build windows          # release .exe + runner in build/windows/x64/runner/
flutter build windows --debug
flutter build linux            # release bundle in build/linux/x64/release/bundle/
flutter build linux --debug
flutter build macos
```text

Add desktop to an existing project:

```bash
flutter create --platforms=windows,linux,macos .
```

### Formats and what it actually costs

| Platform | Format | Notes |
|----------|--------|-------|
| **Windows** | Plain `.exe` + DLLs | **No installer by default.** `msix` support exists; **MSIX needs a code-signing certificate**. WiX-based MSI via a community tool. `Inno Setup` is common |
| **Linux** | Tarball bundle | **Deb/RPM/AppImage are NOT built in.** Community tools (`ots` from the Flutter project, or third-party) produce them |
| **macOS** | `.app` bundle | **No `.dmg` by default.** `flutter build macos --dwarf` for on-device debugging. Sign + **notarise** manually |

**This is the weakest packaging story of the three majors.** Electron gets
electron-builder with all formats first-class. Tauri gets MSI/NSIS/deb/rpm/
AppImage/snap/Flatpak/dmg from its own CLI. **Flutter gives you a folder of
files and expects you to find a packager.**

A Windows user receives a `.exe` in a zip. That is acceptable for a GitHub
release but poor for anything else. And **Flutter has no built-in auto-updater
at all** — that is community territory (`updater`, `auto_updater` packages),
with the same Windows signing and macOS notarisation requirements as everyone
else.

### Dependency footprint

Flutter bundles the engine. A release Linux build includes `libflutter_linux_gtk.so`
plus `flutter/`, `icudtl.dat`, and per-architecture blobs. Realistic sizes:

| Build | Approximate size | Confidence |
|-------|------------------|-----------|
| Windows release (x64) | 15–25 MB | Industry range, **unsourced** — measure |
| Linux release (x64) | 15–25 MB + GTK deps | as above |
| macOS `.app` (single arch) | 30–50 MB | as above |
| macOS universal | 2× single arch | by construction |

**That is an order of magnitude better than Electron (150.7 MB measured) and
worse than Tauri (~3–10 MB), and roughly comparable to a well-trimmed Wails or
Neutralino.** It also pulls in GTK as a system dependency on Linux — so Flutter
is *not* dependency-free like a pure-Rust GUI, but its deps are ubiquitous
rather than exotic (unlike Tauri).

### App size tooling

Flutter has first-class tooling we should use: `flutter build --analyze-size`
and the [App size tool](https://docs.flutter.dev/tools/devtools/app-size) in
DevTools, which gives a per-section, per-symbol breakdown. **Better size
introspection than either Tauri or Electron offers out of the box.** Only ship
one ABI per platform; `--split-debug-info` and `--obfuscate` (not a security
boundary) are available.

---

## 6. Tooling and developer experience

**Flutter's DX is the best on desktop. This is not close.**

| Capability | Flutter |
|-----------|---------|
| Hot reload | Sub-second across desktop **and** device. The best loop of any candidate |
| Hot restart | Fast, preserves state |
| DevTools | Inspector (widget tree), Performance (frame charts, jank), CPU Profiler, Memory, Network, **Debug console**, **App size**. Integrated with `flutter run` |
| DevTools extensions | Community extensions exist |
| Widget inspection | The **widget tree inspector** is genuinely excellent — you can click a widget and see exactly which widget rendered that pixel, and why it is that size. Electron/Tauri give you a DOM inspector; Flutter gives you a *declarative* inspector, which for a custom renderer is more useful |
| `flutter analyze` | Excellent static analysis, catches layout mistakes at author time |
| Tests | `flutter_test` with golden-file tests — **pixel-diff our Markdown output across platforms**. This is a killer feature for a typography product |
| Integration tests | `integration_test`, `patrol` for E2E |
| CLI | `flutter run -d windows`, `flutter doctor`, `flutter config`, `flutter build` — coherent |
| IDEs | VS Code (with the Flutter extension) and Android Studio/IntelliJ, both good |
| **Widget Previews** | **Stable in 3.47** — "instantly render, inspect, and iterate on individual UI components without building and launching your entire application" ([3.47 release](https://flutter.dev/blog/whats-new-in-flutter-3-47)) |

**The IDE/CLI story is genuinely better than anything else here.** VS Code's
Dart/Flutter extension is excellent, and Flutter Previewer makes iterating on a
Markdown block fast.

**The catch:** the developer must learn Flutter's mental model — widgets,
build methods, `const` constructors, `setState`, `CustomPaint`, slivers,
constraints. **This is a bigger learning curve than Electron or Tauri-from-JS,
and comparable to Tauri-from-JS-with-Rust.** Flutter's "everything is a widget"
model is conceptually clean but has sharp edges (const constructors, the widget
lifecycle, when to use `CustomPainter` vs widgets).

**For a web team, the honest cost is: we are learning a second UI paradigm, not
a second language.** We would keep TypeScript for the parser and the web build,
and learn Dart for the UI. That is two frontend languages.

---

## 7. Mobile: Flutter's actual home turf

This is Flutter's strongest, most defensible claim, and it should carry real
weight in our weighting.

| | Flutter |
|---|---|
| Android + iOS from one codebase | ✅ Genuinely one. Not aspirational |
| Store acceptance | ✅ Play Store + App Store, documented |
| App Store review reality | ⚠️ Flutter apps are accepted; WebView-based apps are scrutinized, native-rendered apps are generally *less* scrutinised than WebView hybrids (Apple has explicitly signalled this) |
| Package ecosystem | ✅ Largest on pub.dev of any non-web option |
| `flutter_markdown` staleness | ⚠️ The one place the ecosystem disappoints |
| Platform-channel escape hatch | ✅ Method channels / Pigeon for anything a plugin lacks |

**If our mobile target were a "read + annotate + sync notes" app, Flutter would
be the clear winner.** And unlike Tauri's mobile (still landing lifecycle
fixes), Flutter's mobile is its core competency.

---

## 8. What Flutter would actually cost us

An honest day-count style estimate (inference, based on the §2 gap analysis and
§4 issues):

| Work item | Estimate | Confidence |
|-----------|----------|-----------|
| Markdown parser → widget renderer, CommonMark | 1–2 weeks | Medium |
| GFM tables | 1–2 weeks | Medium — Flutter tables are genuinely hard |
| Syntax highlighting | 1 week | Medium |
| Link/image handling + scheme validation | 2–4 days | High |
| Find-in-document (Ctrl+F) | 1–2 weeks | Medium |
| Cross-block text selection + copy | 1–2 weeks | Medium |
| TOC / anchor scroll | 3–5 days | High |
| Print / Export PDF (with pagination) | 1–2 weeks | Medium |
| Theming, typography, reading comfort | 1–2 weeks | Medium |
| **Packaging** (MSI/MSIX, deb, AppImage, dmg + signing + notarisation) | 2–3 weeks | Medium |
| **Auto-updater** (from nothing, all platforms) | 1–2 weeks | Medium |
| IME + accessibility hardening | 1–2 weeks | Low — surprises here |
| **Total** | **~4–7 months of focused work before a shippable viewer** | |

**And that is work we would then maintain forever.** Whereas the web/HTML
renderer reuses: every CSS technique, every Markdown-to-HTML library
(`markdown-it`, `remark`, `micromark`, `marked`), every syntax highlighter,
every existing reader theme, every accessibility pattern, `Ctrl+F` for free, and
print for free.

**The decisive comparison:** to ship in Electron or Tauri we write
"Markdown → sanitised HTML → CSS, plus a thin native shell". To ship in Flutter
we write "Markdown → widgets, plus print, plus find, plus selection, plus
tables, plus a packager, plus an updater". Those are not the same project.

---

## 9. Scorecard for Siyana

| Dimension | Rating | Note |
|-----------|--------|------|
| Security model | **Best available** | No DOM → no DOM-XSS. Weakened by `flutter_webview` if we embed content |
| Cross-platform consistency | **Perfect** | Own engine, identical everywhere including web |
| Mobile story | **Best available** | Its core competency |
| Rendering performance | **Excellent** | 60/120fps, Impeller on desktop in 3.47 |
| Linux distro support | **Excellent** | No WebKitGTK; only GTK, which is ubiquitous |
| Install size | **Very good** | ~15–25 MB. Measure |
| Memory | **Good** (inferred) | Engine process + Dart heap. Measure |
| Startup | **Good** (inferred) | Measure |
| Packaging / signing / update | **Poor** | No built-in installers, no built-in updater |
| HTML/CSS ecosystem leverage | **None** | Must build the renderer |
| Code reuse with our **web** target | **Medium** | Flutter web output is our weakest target |
| Debugging / testing | **Excellent** | Best DX; golden tests are ideal for a reader |
| Learning curve | **High** | New UI paradigm + Dart, for a web team |
| Ecosystem maturity | **Medium** | Desktop plugin tail is thin; `flutter_markdown` stale |
| Licensing | **Excellent** | BSD-3-Clause |
| Viability | **Very strong** | Google-backed, huge team, quarterly majors |

---

## 10. The verdict for a Markdown *viewer*

Flutter wins on the two axes that are hardest for anything to fake —
**rendering consistency** and **security against hostile Markdown** — and loses
on the axis that decides this project: **ecosystem leverage.**

We are building a *viewer*. A viewer's job is to render someone else's text
using the best available typographic and layout primitives. In 2026 those
primitives are HTML and CSS, and they are maintained by a global community with
20 years of accumulated craft, test suites, and accessibility work.

Choosing Flutter means **declining all of it** and rebuilding it in Flutter
widgets. We would gain XSS immunity by construction — a real and serious gain —
at the cost of 4–7 months of renderer construction plus permanent maintenance,
plus weaker accessibility, plus no free `Ctrl+F`, plus our own print pipeline.

**The honest read: Flutter is the right answer for a Markdown *editor* built
around structured, block-level editing (where a widget model beats HTML's
contenteditable-by-hack), and the wrong answer for a viewer that must leverage
the whole CSS ecosystem.**

If we later build a rich block editor and a mobile companion app, Flutter
becomes considerably more attractive. For the desktop-first viewer we are
actually specifying, it is not.

**One thing Flutter would win outright, and it is worth stating separately: if
we decided that absolute rendering consistency and zero-webview-dependency
mattered more than everything else combined — e.g. if "it looks and behaves
identically everywhere, forever, with no distro dependency" were the product
thesis — Flutter would be the correct and I would argue defensible choice.**
That is not our thesis, but the option is real and this document should not
pretend otherwise.
