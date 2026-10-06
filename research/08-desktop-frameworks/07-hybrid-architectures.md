# 07 — Hybrid architectures

> The desktop framework comparison in [`06-comparison-matrix.md`](06-comparison-matrix.md)
> concluded with a number that should be uncomfortable: **Electron 4.17, Tauri
> 3.74 — a 0.43 gap, which is noise.**
>
> This document asks the question that actually decides the project: **what
> architecture maximises code reuse across desktop, web and mobile?**
>
> **Every reuse percentage below is an estimate, not a measurement.** They are
> my judgement of "how much of the code is literally the same file". They are
> stated with rough ranges and the reasoning is shown, because the reasoning is
> what you should argue with, not the numbers.

---

## The framing

"Which framework?" is the wrong first question. The right first questions are:

1. **How many renderers will we maintain?**
2. **How many cores (parsing / indexing / file watching) will we maintain?**
3. **How thin can we make the shell?**

Because there is a decisive structural fact:

> **The framework choice governs ~5% of our code.** The renderer — Markdown →
> sanitised HTML → CSS, which is where the product quality, the bug surface, and
> the entire test suite live — is **identical** whether it is hosted by Tauri,
> Electron, Wails, or a browser.

That is why this folder can defer the decision honestly. It is not fence-sitting;
it is observing that the shell is the cheap decision.

So: four topologies, evaluated on reuse, rewrite cost, and risk.

---

## Legend for the diagrams

```mermaid
graph TB
  subgraph LEGEND[" "]
    direction LR
    L1["Shared source<br/>written once"] --> L2["Compiled/loaded per target<br/>one implementation"]
    L3["Per-target code<br/>must be written separately"]
  end
```text

In each diagram:
- **Blue** = one implementation, shared
- **Amber** = thin per-target adapter
- **Red** = genuinely duplicated work

---

## Option (a) — Pure web-tech everywhere

**Electron for desktop, plain web for browser, Capacitor/Cordova for mobile.**

> Versions verified 6 Oct 2026: `electron@44.5.1` ·
> `@capacitor/core@8.5.2` / `@capacitor/cli@8.5.2` (11 Sep 2026) ·
> `@ionic/core@9.0.6` (30 Sep 2026) ·
> `react-native@0.87.1` (26 Aug 2026) ·
> `react-native-webview@14.0.1` (20 Jun 2026) · `expo@57.0.26` (29 Sep 2026)

```mermaid
graph TB
    subgraph SHARED["Written ONCE — ~70-80% of code"]
        R["Renderer<br/>Markdown → sanitised HTML → CSS"]
        C["Core (TypeScript)<br/>parsing, AST, TOC, search index,<br/>sanitisation policy, themes"]
        P["Presentation layer<br/>virtual scroller, code blocks,<br/>settings UI"]
    end

    subgraph DESKTOP["Electron shell — ~5-8%"]
        E1["main.ts<br/>BrowserWindow + protocol.handle()"]
        E2["preload.ts<br/>contextBridge, ~40 methods"]
        E3["native adapters<br/>file watch, dialogs, shell, tray,<br/>single-instance, deep-link"]
    end

    subgraph WEB["Web — ~2-4%"]
        W1["Browser app<br/>same bundle"]
        W2["Optional: FS Access API<br/>or server-backed file access"]
    end

    subgraph MOBILE["Capacitor — ~3-6%"]
        M1["Capacitor shell<br/>WKWebView / Android WebView"]
        M2["@capacitor/* plugins<br/>Files, Filesystem, Share, StatusBar"]
        M3["Platform adapters<br/>safe-area, keyboard, back-button"]
    end

    R --> E1
    C --> E1
    P --> E1
    R --> W1
    C --> W1
    R --> M1
    C --> M1
    E3 -.capabilities.-> M2
    W2 -.optional.-> W1

    style SHARED fill:#1565c0,color:#fff
    style SHARED text color:#fff
    style DESKTOP fill:#f9a825,color:#000
    style WEB fill:#f9a825,color:#000
    style MOBILE fill:#f9a825,color:#000
```

### Reuse accounting

| Component | Shared? | Notes |
|-----------|---------|-------|
| **Markdown → HTML renderer** | ✅ **100%** | Byte-identical |
| **CSS / themes** | ✅ **100%** | Byte-identical — the whole point |
| **Parser + AST + TOC + search index** | ✅ **100%** | TS package, imported by all three |
| **Sanitisation policy** | ✅ **100%** | Same DOMPurify config everywhere |
| **Settings/preferences UI** | ✅ **~100%** | |
| **Virtual scroller** | ✅ **100%** | |
| **Syntax highlighting** | ✅ **~100%** | Same `highlight.js`/`shiki` + CSS |
| **Core UI (sidebar, outline, search)** | ✅ **~100%** | |
| **Native file I/O** | 🔴 **~0%** | `fs` + `dialog` (Electron) vs Capacitor `Filesystem` vs File System Access API |
| **File watching** | 🔴 **~0%** | Three different APIs |
| **Global shortcuts** | 🔴 **~0%** | `globalShortcut` / web `KeyboardEvent` / Capacitor plugin |
| **Tray, native menus, single-instance, deep links** | 🔴 **~0%** | Desktop-only; no mobile equivalent |
| **Auto-update** | 🔴 **~0%** | Electron-updater / web = browser / Capacitor `@capacitor/updater` |
| **Print / Export PDF** | ⚠️ **~30%** | Electron `webContents.printToPDF` vs browser print vs mobile share |

**Estimated renderer/core reuse: ~75–80%.**

### What must be rewritten per platform

- **Native capability adapters** — three thin layers behind one interface.
- **Keyboard/shortcut handling** — genuinely different paradigms.
- **File access** — this is the hardest one. Desktop has real paths; a browser
  has opaque handles; mobile has sandboxed content URIs. **The abstraction is
  the work.**
- **Distribution** — three entirely separate release pipelines.

### Risk

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Web file access is genuinely hard.** The browser has no filesystem. `showOpenFilePicker` returns handles, not paths, and is Chromium-only. `FileSystemAccess` cannot be assumed. A "just open a folder" web viewer needs OPFS, IndexedDB, or a **local server** | 🔴 **High** | Decide early: web = local-only (drag-drop, IndexedDB) or web = client for a local API. **Do not promise folder access on the web** |
| **Capacitor's WebView is not a modern browser.** Android System WebView and iOS WKWebView lag Chrome. Same CSS/JS gap as Tauri | 🟡 Medium | Same baseline strategy as [Tauri §15](01-tauri.md#15-known-limitations-consolidated) |
| **Electron security must be impeccable.** One preload mistake = RCE on a viewer of untrusted files | 🔴 High | The 20-item checklist as a CI gate; Playwright security tests |
| **The 8-week major treadmill** | 🟡 Medium | Budget ~15–20% of one dev; track EOL dates in CI |
| **Capacitor + iOS App Store review** — a WebView-based app may face scrutiny, especially for a *document* app with file access | 🟡 Medium | Add genuinely native value (share sheet, Files integration, document types). Consider a native module |
| **150 MB installer** | 🟡 Medium | Acceptable for a desktop utility |

### Verdict on (a)

**The maximum-reuse option, and the option the weighting in Table B favours
(4.17, our top score).** The trade is explicit: pay 150 MB, ~2× the memory, and
a 6–7×/year upgrade treadmill, in exchange for a renderer that is genuinely one
codebase on all three platforms, plus the best debugging and E2E testing in the
industry.

**If reuse is the dominant priority — and the brief says it is — this is the
logically correct answer.** The weakness is not technical, it is strategic:
we accept a permanent maintenance tax to buy reuse, and we inherit Electron's
security burden.

---

## Option (b) — Tauri everywhere (desktop + web + Tauri mobile)

> Tauri `2.12.0`, stable since 2.0. Mobile stable, multiple windows on Android/iOS
> since 2.11.0 (30 Apr 2026). **But: Tauri is not a web framework.**

```mermaid
graph TB
    subgraph RUST["Rust core — ~15-25% of code, ONE implementation"]
        CORE["Core: parsing, AST, incremental reparse,<br/>search index, sanitisation, syntax highlight"]
        FS["File watching (notify), reading, encoding"]
        CMDS["Tauri commands"]
        WASM["wasm-bindgen exports"]
    end

    subgraph DESKTOP["Tauri desktop — ~10%"]
        T1["Rust binary + wry"]
        T2["Web frontend (same as web)"]
        T3["Official plugins<br/>fs, dialog, opener, updater,<br/>single-instance, window-state, deep-link"]
    end

    subgraph MOBILE["Tauri mobile — ~10%"]
        M1["Same Rust core, compiled to<br/>aarch64-linux-android / aarch64-apple-ios"]
        M2["Same web frontend"]
    end

    subgraph WEB["Web — ~50% of work, SECOND implementation"]
        W1["Web app"]
        W2["Rust core compiled to WASM"]
        W3["WASM loader, memory management,<br/>worker, bundling, streaming"]
        W4["Browser file access layer<br/>(hardest part)"]
    end

    CORE --> CMDS
    FS --> CMDS
    CMDS --> T1
    T2 -.frontend.-> T1
    CORE --> M1
    CORE --> WASM
    WASM --> W2
    W2 --> W3
    W3 --> W1
    W4 --> W1

    style RUST fill:#1565c0,color:#fff
    style DESKTOP fill:#f9a825,color:#000
    style MOBILE fill:#f9a825,color:#000
    style WEB fill:#c62828,color:#fff
    style WEB text color:#fff
```text

### Reuse accounting

| Component | Shared? | Notes |
|-----------|---------|-------|
| **Rust core** (parse, index, sanitize, highlight) | ✅ **~90%** | Compiled natively *and* to WASM. `wasm-bindgen`. **This is the real win** |
| **Web frontend (HTML/CSS/TS)** | ✅ **100%** between desktop and web | Same bundle |
| **Web frontend** vs **mobile frontend** | ✅ **~90%** | Same bundle, different safe-area/keyboard CSS |
| **Native adapters** | ⚠️ **~20%** | Plugins on desktop, different plugins on mobile |
| **WASM loader + memory management** | 🔴 **~0%** — new work | Streaming, workers, bundler config, memory limits |
| **Browser file access** | 🔴 **~0%** — new work | Same problem as (a) |
| **Packaging × 3** | 🔴 **~0%** | |

**Estimated total reuse: ~55–65%.** **Lower than (a)**, despite Tauri being
the strongest single framework, because **Tauri gives us nothing for the web
target.** The WASM port of the Rust core is real reuse of the *logic*, but the
*presentation layer* — which is most of the product — still has to be built
twice if we don't use HTML on web.

### Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Tauri's mobile is good but young.** 2.11.0 and 2.12.0 both landed Android lifecycle fixes. Platform-specific bugs still arriving each minor | 🔴 High | Time-box a mobile spike before committing |
| **WASM memory limits** on large documents. 100 MB Markdown + a WASM heap is a genuine engineering problem; `wasm32` has a 4 GB ceiling but browsers are stricter in practice | 🟡 Medium | Worker-based streaming; never hold the whole document in WASM |
| **`wasm-bindgen` + `wasm-pack` toolchain** adds build complexity | 🟡 Medium | Use `wasm-pack` + `vite-plugin-wasm`; keep the Rust core free of Tauri types so it compiles both ways |
| **Rust core must stay runtime-agnostic.** Any `tauri::` type in the core makes it un-compilable to WASM | 🟡 Medium | Strict layering: `core/` has zero Tauri deps; `src-tauri/` is a thin adapter |
| **WebKitGTK 4.1 excludes RHEL 8/9** on desktop | 🟡 Medium | Build an ABI-4.0 variant, or drop enterprise Linux |
| **Two frontends to keep visually in sync** — the WebKitGTK CSS gap means the desktop and web builds *will* diverge | 🟡 Medium | Feature-detect + progressive enhancement; visual regression tests on the oldest engine |

### Verdict on (b)

**The strongest *core* reuse of any option** — a Rust parser/indexer/higrindex
compiled to native and to WASM is genuinely elegant and it is the best story for
"our parser runs everywhere identically, with no JS reimplementation and no
memory-safety bugs".

**But the reuse is in the wrong place.** We would reuse the *parsing*, which is
maybe 20% of the product, and duplicate the *presentation*, which is 60%+.
Compare (a), which reuses the presentation completely and writes the native
adapters three times — but the adapters are thin and testable, while a
duplicated renderer is not.

**Also note: it is the option that requires the most total engineering.** Rust +
WASM + Tauri plugins + Tauri mobile + a separate web app. For a small team that
is a lot of simultaneous unfamiliar territory.

---

## Option (c) — Flutter everywhere

```mermaid
graph TB
    subgraph DART["Dart — ~100% of UI code, ONE implementation"]
        U["Widgets: reader, sidebar, TOC, search,<br/>settings, themes"]
        M["markdown package parser<br/>→ our widget renderer"]
        L["Layout + painting<br/>OUR CODE, not a framework's"]
    end

    subgraph PLAT["Compiled per target — no source duplication"]
        D1["flutter build windows"]
        D2["flutter build linux"]
        D3["flutter build macos"]
        D4["flutter build apk / ipa"]
        D5["flutter build web<br/>(CanvasKit/skwasm)"]
    end

    subgraph GAPS["Must be BUILT — no framework provides these"]
        G1["Markdown → widget renderer<br/>(~1-2 weeks CommonMark)"]
        G2["Tables with intrinsic layout<br/>(1-2 weeks)"]
        G3["Ctrl+F find-in-document<br/>(1-2 weeks)"]
        G4["Cross-block selection + copy<br/>(1-2 weeks)"]
        G5["Print / PDF pagination<br/>(1-2 weeks)"]
        G6["Syntax highlighter<br/>(flutter_markdown stale since 2025)"]
        G7["Native accessibility bridge<br/>(weaker than web)"]
        G8["Packaging + signed updater<br/>(Flutter ships neither)"]
    end

    M --> U
    U --> D1
    U --> D2
    U --> D3
    U --> D4
    U --> D5
    G1 -.-> M
    G6 -.-> U
    G8 -.-> PLAT

    style DART fill:#1565c0,color:#fff
    style DART text color:#fff
    style PLAT fill:#f9a825,color:#000
    style GAPS fill:#c62828,color:#fff
    style GAPS text color:#fff
```

### Reuse accounting

| Component | Shared? | Notes |
|-----------|---------|-------|
| **All Dart UI code** | ✅ **~95%** | Genuinely one codebase across 5+ platforms |
| **Parser** (`markdown` package) | ✅ **100%** | |
| **Our Markdown → widget renderer** | ✅ **100%** — *our own code* | But we have to write it |
| **Packaging × 5** | 🔴 **~0%** | Flutter ships no installers and no updater |
| **Print / find / selection / tables** | 🔴 We build each | Once, but we own them forever |

**Estimated total reuse: ~85–90% — the highest of any option.**

### The catch, and it is a real one

Highest reuse *of what exists* — because we write the rest. And what we write is
substantial: the §8 gap analysis in
[`03-flutter.md`](03-flutter.md) puts it at **4–7 months before a shippable
viewer**, plus permanent maintenance of a Markdown renderer, a table layout
engine, a print pipeline, and a syntax highlighter. Plus:

- **No CSS ecosystem** (score 1/5 in the matrix, 13% weight)
- **Weaker accessibility** than web
- **Flutter web is our weakest target**, despite being "the same codebase"
- **No `Ctrl+F`**, no free print
- Two languages for a web team (TS parser + Dart UI) — or the parser in Dart too

### Verdict on (c)

**The most reusable UI codebase of any option, and the most work.** It is the
right answer if and only if the team is willing to build an HTML-equivalent
rendering stack and own it permanently. For a *viewer*, that is the wrong
trade — but for an *editor* with block-level structured editing, it is the right
one. Worth revisiting if the product scope ever shifts.

---

## Option (d) — Shared core + thin shells (separate implementations, shared logic)

**This is the option the matrix actually recommended, and the one I think is
correct. It deserves the most careful treatment.**

The insight: **the renderer is 70% of the work and it is framework-independent.**
Tauri and Electron both accept identical HTML/CSS/JS. So build the renderer as a
**plain web application first**, then make every shell a *host* for it.

```mermaid
graph TB
    subgraph SHARED["THE PROJECT — written once, ~75% of code"]
        direction TB
        subgraph RENDERER["Renderer — pure TypeScript, zero framework deps"]
            MD["Parser: markdown-it / remark / micromark"]
            SAN["Sanitiser: DOMPurify + our hardened profile"]
            AST["Markdown AST → document model"]
            DOC["Rendered block tree (virtualised)"]
            THEME["Theme engine + typography scale"]
            SEARCH["Search index + Ctrl+F"]
            HL["Syntax highlighting"]
        end
        subgraph CORE["Shared core package — the contract"]
            IFACE["PlatformAdapter interface<br/>readFile, watch, openExternal,<br/>getPref, setPref, print, updateCheck"]
            MODEL["Document model, TOC, outline,<br/>settings schema, IPC types"]
            TEST["Shared test suite<br/>CommonMark fixtures, XSS corpus, snapshots"]
        end
    end

    subgraph HOSTS["Hosts — thin, ~25% total, each tiny"]
        direction LR
        H1["Tauri host<br/>~1500-3000 LOC Rust<br/>fs, watch, dialog, deep-link,<br/>single-instance, updater"]
        H2["Electron host<br/>~1000-1500 LOC TS<br/>protocol.handle(), preload,<br/>contextBridge"]
        H3["Web host<br/>~500 LOC<br/>File System Access API or<br/>IndexedDB, or remote API"]
        H4["Capacitor host<br/>~500-800 LOC<br/>Filesystem, Share, keyboard,<br/>safe-area"]
    end

    IFACE --> H1
    IFACE --> H2
    IFACE --> H3
    IFACE --> H4
    MODEL --> HOSTS
    TEST -.runs against.-> RENDERER
    RENDERER --> DOC

    style SHARED fill:#1565c0,color:#fff
    style SHARED text color:#fff
    style HOSTS fill:#2e7d32,color:#fff
    style HOSTS text color:#fff
```text

### The key structural property

> **The renderer never imports a host API.** It talks to an injected
> `PlatformAdapter` interface. That single discipline is what makes the reuse
> real rather than aspirational.

```ts
// packages/core/src/platform.ts — the ONLY thing the renderer knows about
// the outside world. Implemented 2–4 times, each impl is trivial.

export interface PlatformAdapter {
  // --- Files ---
  pickFile(): Promise<PickedFile | null>;
  pickFolder(): Promise<PickedFolder | null>;
  readText(file: PickedFile): Promise<string>;
  watch(file: PickedFile, onChange: () => void): Promise<() => void>;

  // --- External ---
  openExternal(url: string): Promise<void>;   // MUST validate scheme in impl

  // --- App ---
  getPreference<T>(key: string, fallback: T): Promise<T>;
  setPreference(key: string, value: unknown): Promise<void>;
  onBackButton(handler: () => boolean): void;   // mobile/no-op on desktop
  setWindowTitle(title: string): Promise<void>;

  // --- Output ---
  print(opts: PrintOptions): Promise<void>;     // or exportPdf()
  copyToClipboard(text: string): Promise<void>;

  // --- Updates ---
  checkForUpdate(): Promise<UpdateInfo | null>;
}

// The renderer never knows which one it has:
export let platform: PlatformAdapter;
export function setPlatform(p: PlatformAdapter) { platform = p; }
```

### Reuse accounting

| Component | Shared? | Notes |
|-----------|---------|-------|
| **Markdown parser + AST** | ✅ **100%** | Pure TS, no platform deps |
| **Sanitisation** | ✅ **100%** | One hardened DOMPurify profile. **Single source of truth for our #1 security criterion** |
| **Rendering + virtual scroller** | ✅ **100%** | |
| **CSS / themes** | ✅ **100%** | Byte-identical on all four targets |
| **Ctrl+F, TOC, outline, settings** | ✅ **100%** | |
| **Syntax highlighting** | ✅ **100%** | |
| **Test suite** | ✅ **100%** | Same CommonMark fixtures, same XSS corpus, same snapshots |
| **Platform adapters** | 🔴 **4 × ~300 LOC** | Trivial, mechanical, individually testable |
| **Packaging** | 🔴 **4 ×** | Unavoidable everywhere |

**Estimated renderer/core reuse: ~75–80%** — the same as option (a), because
(a) *is* this topology with Electron as the only desktop shell.

**What (d) adds over (a):** the desktop shell is *pluggable*. We can start on
Electron (best reuse, best DX, best testing), and if the 150 MB / treadmill
combination becomes unbearable, **swap the shell to Tauri without touching a
line of the renderer.** The renderer is 100% identical either way.

**What (d) adds over (b) and (c):** it does not require Rust, WASM, or Dart. The
core is TypeScript. The only cost is ~300 LOC × 4 of adapter boilerplate.

### Cost breakdown

| Work item | Estimate | Confidence |
|-----------|----------|-----------|
| `PlatformAdapter` interface + types | 1–2 days | High |
| Renderer (Markdown → sanitised HTML → virtualised DOM) | **8–12 weeks** | Medium — this is the real work |
| CommonMark + GFM test suite | 3–4 weeks | Medium |
| XSS/sanitiser test corpus | 2 weeks | Medium |
| CSS/theming/typography system | 3–4 weeks | Medium |
| Desktop shell (Electron or Tauri) | 2–4 weeks | High |
| Web shell | 1 week (no local FS) | High |
| Packaging + signing + updater | 2–3 weeks | Medium |
| **Total to a shippable desktop beta** | **~5–7 months** | |

### The web target's file-access problem — solve this first

Every option hits it. **Decide before building anything else:**

| Approach | What the user gets | Effort | Honest fit |
|----------|-------------------|--------|-----------|
| **(A) Local-only web** | Drag-drop files; stored in IndexedDB; no folder sync | Low | ✅ Honest. Don't over-promise |
| **(B) File System Access API** | Chromium-only; handles not paths; permission must be re-granted | Medium | ⚠️ Chrome/Edge/Arc only. Firefox and Safari excluded |
| **(C) Local API server** | Full folder access; requires running our daemon | High | 🔶 Most capable; most complexity |
| **(D) Remote-first** | Web is a *client* for a sync service | Very high | 🔶 Only if we build sync (out of scope) |

**Recommendation: (A) for v1.** The web build is a *reader* — open a file, read
it, keep it in IndexedDB. Do not claim folder access. Revisit (B) as an
enhancement behind a feature check.

### Risk

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Adapter abstraction leaks.** Renderer code starts calling host APIs directly and the reuse quietly dies | 🔴 **High — the main risk of this design** | Lint rule banning direct imports of `@tauri-apps/*` or `electron` from `packages/renderer`. Enforce in CI. **This is non-negotiable** |
| **"Lowest common denominator" UI.** We avoid Electron/Tauri APIs in the renderer and lose native niceties | 🟡 Medium | Deliberate, and the right trade. Add capability *flags* to the adapter (`can: { print, tray, globalShortcuts }`) so hosts can expose extras |
| **Four shells to test.** A bug may appear in only one | 🟡 Medium | A CI matrix that runs the shared Playwright suite against each host |
| **Choosing the shell late feels like indecision** | 🟢 Low | It is not indecision. The renderer is shell-agnostic, so the shell choice is a cheap late decision. **Deliberately deferring it is the strategy** |
| **Capability drift between hosts** | 🟡 Medium | Version the `PlatformAdapter` interface; hosts declare what they implement |

### Verdict on (d)

**Highest value, lowest risk of the four — and the only one that is not a
compromise.** It gets:
- **The same reuse as (a)** — because the renderer is one codebase
- **The freedom to change desktop shells** — because the renderer does not care
- **A single security policy** — one sanitiser, one CSP, one test corpus
- **The best testing story** — Playwright against the web build tests the
  renderer; the hosts get a small additional smoke suite
- **No Rust, no WASM, no Dart** required

It costs ~1,200 LOC of adapter boilerplate and one discipline (no direct host
imports). **That is a very cheap price for optionality on the single most
consequential architectural decision in the project.**

---

## Mobile shells compared

Because mobile is the third target and the least-served by desktop frameworks:

| | **Capacitor** | **Ionic** | **React Native + WebView** | **Expo** | **Tauri mobile** | **Flutter** |
|---|---|---|---|---|---|---|
| Version today | `8.5.2` | `9.0.6` | `0.87.1` + `rnw 14.0.1` | `57.0.26` | `2.12.0` | `3.47.6` |
| Rendering | System WebView (WKWebView / Android WebView) | Same | Same | Same | Same | Own engine |
| Reuses our HTML renderer? | ✅ **Yes** | ✅ Yes | ⚠️ Only if you use `react-native-webview` as a *host for a web app* — RN itself does not render HTML | ⚠️ Same as RN | ✅ Yes | ❌ **No** |
| Language | TS/JS | TS/JS + Ionic components | TSX | TSX | HTML+TS + Rust | Dart |
| Plugin ecosystem | `@capacitor/*` — Files, Filesystem, Share, Camera, StatusBar, App, Preferences, SplashScreen | Ionic Native wraps Capacitor | Huge RN ecosystem | Expo Modules (largest, best DX) | Tauri plugins (thinner, desktop-weighted) | pub.dev (largest non-web) |
| Store acceptance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Native component access | Via plugins / custom native code | Same | ✅ **Best** — you *are* writing native | ✅ Via Expo Modules | Via Swift/Kotlin plugins | ✅ Platform channels |
| Desktop support too? | ❌ | ❌ | ❌ | ⚠️ Expo has early desktop/web | ✅ **Yes — same shell** | ✅ **Yes — same app** |
| Best for us? | ✅ **Yes** — smallest step from web | ⚠️ Ionic's component model is not what a reader needs | ⚠️ Only as a WebView host, which is just Capacitor with more steps | ⚠️ Same | ⚠️ Possible, but young | ⚠️ Excellent, but no HTML |

**Recommendation: Capacitor.** Reasons:
1. Our renderer is HTML — Capacitor hosts HTML natively. **Zero rewrite.**
2. We need exactly five native capabilities: filesystem, share, back button,
   safe-area insets, status bar. All first-party `@capacitor/*` plugins.
3. It is TypeScript, so the adapter is trivial.
4. **It keeps a fourth option open**: Capacitor can host the same renderer inside
   an Electron shell too, if we ever want a "one installer" experience.

**Why not Ionic:** its value is its *component library*, which is precisely what
we do not want — a Markdown viewer's UI must be a CSS typesetting system, not
an Ionic component set.

**Why not React Native/Expo:** RN renders React Native views, not HTML. Using
`react-native-webview` to host our web app inside RN is strictly worse than
Capacitor: it adds React Native's whole toolchain and buys nothing. **If the
mobile app needs genuinely native, non-HTML UI** (a custom diagram editor,
hardware-accelerated canvas, AR), RN/Expo is the right answer — but not for a
viewer.

---

## How a web build would be hosted

Verified versions and hosting options for the web target:

| Host | Cost | Fit for a Markdown viewer | Notes |
|------|------|---------------------------|-------|
| **GitHub Pages** | Free | ✅ **Good for v1** | Static only. No server-side rendering needed. Custom domain + HTTPS included. Dependabot for Pages actions enabled by default. Versioned URLs via tags. **Blocked in some regions** |
| **Cloudflare Pages** | Free tier | ✅ **Best-in-class** | Global CDN, unlimited bandwidth on free tier, automatic HTTP/2 + Brotli, preview deploys per branch (huge for a project iterating fast). Can add Cloudflare Workers at the edge if we later need an API |
| **Netlify / Vercel** | Free tier | ✅ Good | Generous. Vercel's edge network is excellent. Both add function hosting |
| **Self-host (Docker + nginx)** | Server cost | ⚠️ Only if we have a server | Full control; needed if the web build must reach local files via an API — see option (C) above |
| **Obsidian Publish-like SaaS** | Paid | ⚠️ Out of scope | We are not building a hosted service |

**Recommendation: Cloudflare Pages for staging (preview deploys per PR are
genuinely valuable while the renderer is being built), GitHub Pages as the
permanent home.** Both are static hosting, which is all a TypeScript renderer
needs. Revisit self-hosting only if we implement web-as-a-client-for-a-local-API.

**Static-build requirements we must satisfy:**
- **Relative asset paths** (`base: './'`) so it works from a subpath
- **No server-side rendering** — fine, a viewer is inherently client-side
- **Cache headers**: hashed asset filenames + immutable caching for
  `assets/*`, `no-cache` for `index.html`
- **A strict CSP as an HTTP header** (GitHub Pages supports only a meta tag for
  CSP, which is weaker — another point for Cloudflare)

---

## Comparison of the four options

| | **(a) Pure web-tech** | **(b) Tauri everywhere** | **(c) Flutter everywhere** | **(d) Shared core + thin shells** |
|---|---|---|---|---|
| **Reuse %** | ~75–80% | ~55–65% | ~85–90% | ~75–80% |
| **Of which is *new* work?** | Low | **High** (WASM + 2 frontends) | **Very high** (build the renderer) | **Low** (adapters only) |
| **Renderers to maintain** | **1** | 1–2 | **1** | **1** |
| **Languages required** | TS + TS(adapters) | **TS + Rust + WASM** | **Dart (+TS)** | **TS** |
| **Desktop shells possible** | Electron only | Tauri only | Flutter only | **Any — pluggable** ✅ |
| **Web target quality** | ✅ Native-quality | ⚠️ WASM-compiled | ⚠️ Flutter web (weakest) | ✅ Native-quality |
| **Install size** | ~90–115 MB | **~3–10 MB** | ~15–25 MB | **Depends on shell** |
| **Memory** | Highest | Lowest | Low–medium | **Depends on shell** |
| **Startup** | Slowest | **Fastest** | Fast | **Depends on shell** |
| **Security model** | ⚠️ Must be perfect | ✅ Deny-by-default + scopes | ✅ **No DOM, no XSS** | **Depends on shell** |
| **Signed updater included** | ⚠️ Linux DIY | ✅ **All 5 platforms** | ❌ None | **Depends on shell** |
| **Linux RHEL 8/9** | ✅ | ❌ (webkit2gtk 4.1) | ✅ | **Depends on shell** |
| **Testing** | ✅ **Playwright `_electron`** | ⚠️ `tauri-driver` | ✅ Golden + `patrol` | ✅ **Playwright on web build + host smoke tests** |
| **DX / learning curve** | ✅ Easiest (TS) | 🔶 Rust + WASM | 🔶 Dart | ✅ **Easiest (TS)** |
| **Build complexity** | Low | **High** | Medium | Low |
| **Biggest risk** | 150 MB + treadmill + preload security | Young mobile; WASM memory; 2 frontends | 4–7 months before shippable; weak a11y | **Abstraction leaking into the renderer** |

---

## Recommendation

**Option (d) — shared core + thin shells — with Electron first and Tauri
available later.**

Not because (d) wins on metrics — it ties (a) on reuse. Because **it is the only
option that keeps our most important decisions reversible while we learn what
the product actually needs.**

Specifically:

1. **Build the renderer as a plain web application.** Parser, sanitiser, AST,
   virtual scroller, themes, `Ctrl+F`, tests. All TypeScript, zero framework
   dependencies, running in a browser. This is 70–75% of the work and it is
   **completely independent of the shell decision.**

2. **Define `PlatformAdapter` as a real interface with typed adapters per host.**
   Lint-rule the renderer so it can never import a host API. **This one
   discipline is what makes the reuse real.** Without it, option (d) silently
   degrades into option (a) with extra steps.

3. **Ship desktop first, on the shell that is fastest to get running.** Electron
   wins here on three concrete counts, not on vibes: it is the fastest to build,
   it has the best E2E story (Playwright `_electron`), and it keeps our stack to
   a single language. If the 150 MB / 8-week-treadmill combination later proves
   unacceptable, **swapping the shell to Tauri is a ~2,000-LOC change that
   touches zero renderer lines.**

4. **Mobile via Capacitor, when we get there.** It hosts our HTML renderer
   natively and needs five first-party plugins.

5. **Web hosted on Cloudflare Pages (staging) / GitHub Pages (production),**
   with local-only file access in v1. **Decide the web file-access question
   before writing any platform code** — it is the one requirement that could
   invalidate the web target.

6. **Re-evaluate the native Rust renderer if and only if** the product thesis
   shifts to "pixel-perfect typography plus a 5 MB footprint plus universal
   Linux support, and web/mobile are no longer required". In that world, build
   the `parley`-based layout engine as a **shared Rust core compiled to native
   and WASM** so it is written once. See
   [`05-native-and-other.md` §7](05-native-and-other.md).

### The decision, stated as one sentence

> **We should not choose a desktop framework yet, because the framework governs
> ~5% of our code — and we can build the other 95% right now, in a form that
> works identically in every candidate shell.**

### What would change this recommendation

| Finding | Would change us to |
|---------|-------------------|
| Users are heavily enterprise Linux (RHEL 8/9) | Shell must be Electron/Flutter/custom Rust → drop Tauri as the shell |
| Memory/startup measured badly for Electron and well for Tauri | Tauri as the shell (which (d) allows) |
| Sync/backend becomes central | A hosted web client becomes primary; shell choice matters less |
| We decide pixel-perfect typography is the thesis | Custom Rust renderer (option d-native variant) |
| The team turns out to be strong in Rust and weak in TS | (b) Tauri everywhere becomes cheaper than it looks |
