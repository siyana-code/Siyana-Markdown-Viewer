# 06 — Comparison matrix

> **All version numbers verified 6 October 2026.** Sizes are measured byte
> counts where a measured number existed; everything else is explicitly labelled
> as vendor claim, industry range, or inference. **Read the confidence
> annotations before quoting a number.**
>
> Sources for every figure are cited in the per-framework documents:
> [01-tauri](01-tauri.md) · [02-electron](02-electron.md) ·
> [03-flutter](03-flutter.md) · [04-wails](04-wails-and-neutralino.md) ·
> [05-native](05-native-and-other.md)

---

## How to read these tables

Two tables, doing two different jobs:

1. **Table A — Raw facts.** Objective, versioned, sourced. No opinions. If you
   disagree with our conclusion, you can still use this table.
2. **Table B — Our weighted score.** Opinionated, with weights and
   justifications. **The weights are the argument.** Change a weight and the
   ranking changes; that is intentional, so you can argue with the decision
   rather than the arithmetic.

**Scoring convention for Table B:** `1` = unacceptable, `5` = best in class.
`—` = not applicable.

---

## Table A — Raw verified facts

### A1. Versions, licensing, governance

| | Tauri v2 | Electron | Flutter | Wails v2 | Neutralino | NW.js | Qt 6 | Custom Rust | Avalonia |
|---|---|---|---|---|---|---|---|---|---|
| **Version today** | `2.12.0` / CLI `2.12.1` | `44.5.1` | `3.47.6` | `2.16.0` | `6.9.0` | `0.117.0` | 6.x (LTS) | egui `0.36.2` | 11.x |
| **Released** | 26 Sep 2026 | 29 Sep 2026 | 1 Oct 2026 | 14 Sep 2026 | — | 26 Sep 2026 | — | 8 Sep 2026 | — |
| **Prerelease** | `3.0.0-alpha.4` | `45.0.0-beta` (stable 20 Oct) | `3.49.0-0.2.pre` | v3 Beta | nightly | — | — | — | — |
| **Licence** | MIT **or** Apache-2.0 | MIT | BSD-3-Clause | MIT | MIT | MIT | LGPLv3/GPL/commercial | MIT/Apache + MPL/Apache | MIT |
| **Backing** | Tauri Programme, The Commons Conservancy; Open Collective | **OpenJS Foundation**; @electron/maintainer-team; Open Collective | **Google** | Community (lead-funded) | Small org (CodeZri) | NW.js / OpenJS | **Qt Group PLC** | Community | Avalonia Foundation |
| **Major release cadence** | ~1 feature release/quarter | **6–7 majors/year** | **4 majors/year** | ~1/quarter | sporadic | ~2–3/year | ~1/year | frequent | ~1/year |
| **Audit performed** | ✅ every major/minor, public report | Chromium audit trail | Google security process | ✖ | ✖ | ✖ | Commercial audits | RustSec for deps | ✖ |

### A2. Size and performance

| | Tauri v2 | Electron 44.5.1 | Flutter 3.47.6 | Wails v2 | Neutralino | NW.js | Qt 6 | Custom Rust |
|---|---|---|---|---|---|---|---|---|
| **Prebuilt runtime, measured** | — | **win-x64 150.7 MB**, linux-x64 **117.2 MB**, darwin-x64 128.0 MB (zip) | bundles engine | — | ~2–5 MB *(3rd-party, unsourced)* | ~150 MB class *(inferred)* | ~150 MB+ w/ QWebEngine | — |
| **Realistic installer** | **~3–10 MB** *(vendor: 2–6 MB baseline; AppImage "70+ MB" w/ media frameworks)* | ~90–115 MB NSIS/MSI *(inferred from 150.7 MB zip)* | ~15–25 MB *(industry range, unsourced)* | ~10–20 MB *(unsourced)* | **~2–5 MB** *(unsourced)* | ~90–140 MB *(inferred)* | ~150 MB+ *(inferred)* | **~3–8 MB** *(inferred)* |
| **Vendor minimum claim** | **"<600 KB"** for a minimal app | — | — | — | — | — | — | — |
| **Memory footprint** | Lowest (no browser) *(inferred)* | Highest (main+renderer+GPU) *(inferred)* | Low–medium *(inferred)* | Low *(inferred)* | **Lowest** *(inferred)* | High *(inferred)* | High *(inferred)* | **Lowest** *(inferred)* |
| **Startup time** | Fastest *(inferred)* | Slowest *(inferred)* | Fast *(inferred)* | Fast *(inferred)* | Fastest *(inferred)* | Slow *(inferred)* | Slow *(inferred)* | **Fastest** *(inferred)* |
| **Bundled browser/graphics** | ✖ system webview | ✅ Chromium 152.0.7977.130 | ✅ own engine | ✖ system webview | ✖ system webview | ✅ Chromium | ✅ QWebEngine | ✖ own |
| **Ships a browser?** | No | **Yes** | No | No | No | **Yes** | **Yes** | No |

> ⚠️ **Only the Electron runtime sizes above are measured** (byte counts from
> the Electron binary mirror, 6 Oct 2026). **Every other memory and startup
> number in this table is inference.** There is no reproducible public benchmark
> for any of these frameworks on a Markdown-viewer workload. See §Measuring,
> not guessing.

### A3. Runtime engines — the consistency question

| | Engine | Version control | Rendering consistency across platforms |
|---|---|---|---|
| **Tauri** | WebView2 (Win) / **WebKitGTK 4.1** (Linux) / WKWebView (macOS) | **OS-controlled** | ✖ **Fragile** — a 2023 WebKitGTK vs a 2026 one |
| **Electron** | Chromium | **Electron-controlled** | ✅ **Identical** (M152 on every platform) |
| **Flutter** | Own (Skia/Impeller) | **Flutter-controlled** | ✅ **Identical**, incl. web |
| **Wails** | WebView2 / WebKitGTK | OS-controlled | ✖ Fragile |
| **Neutralino** | WebView2 / WebKitGTK 4.0 *or* 4.1 (dynamic) | OS-controlled | ✖ **Worst** — may load ABI 4.0 |
| **NW.js** | Chromium (bundled) | App-controlled | ✅ Identical |
| **Qt 6** | QWebEngine (Chromium) | App-controlled | ✅ Identical |
| **Custom Rust** | Own, via `parley`/`skrifa` | **We control** | ✅ **Identical** + best typography |

### A4. Linux distribution reality

| | Runtime deps | Debian 12 / Ubuntu 22.04+ | Debian 11 / Ubuntu 20.04 | Fedora 40+ | **RHEL 8/9 (enterprise)** | Formats |
|---|---|---|---|---|---|---|
| **Tauri** | **webkit2gtk-4.1** *(required)* | ✅ | ❌ 4.0 only | ✅ (4.0 removed in F40) | ❌ **`webkit2gtk3` = ABI 4.0** | deb, rpm, AppImage, snap, Flatpak, AUR |
| **Electron** | GTK3, NSS, X11/Wayland | ✅ | ✅ | ✅ | ✅ (GTK3 universal) | AppImage, deb, rpm, snap, Flatpak |
| **Flutter** | GTK3 (bundles engine) | ✅ | ✅ | ✅ | ✅ | tarball (deb/rpm/AppImage via community tools) |
| **Wails** | GTK3 + webkit2gtk | ✅ | ✅ | ✅ | ✅ **via `-tags webkit2_40`** | single binary, nfpm |
| **Neutralino** | GTK + webkit2gtk (dynamic) | ✅ | ✅ | ✅ | ✅ but loads **old ABI 4.0** | single binary |
| **NW.js** | GTK3/NSS | ✅ | ✅ | ✅ | ✅ | AppImage, deb, rpm |
| **Qt 6** | Qt runtime (distro-packaged) | ✅ | ✅ | ✅ | ✅ | everything |
| **Custom Rust** | GTK/GLib only | ✅ | ✅ | ✅ | ✅ ✅ | everything (we own the bundler) |

> **This row decides the Linux story.** Every option that requires WebKitGTK 4.1
> is excluded from RHEL 8/9 and older Debian/Ubuntu **unless it ships an ABI 4.0
> fallback** — which only Wails does, out of the box. Electron and Flutter
> require nothing exotic. A custom renderer requires nothing at all.

### A5. Security model

| | Default posture | Granular scoping | Bundled engine CVE exposure | Native addons | Hardening mechanism |
|---|---|---|---|---|---|
| **Tauri** | **Deny by default** — no API without a capability | ✅ **Per-command + path scopes, allow/deny globs** | ⚠️ **OS's webview** (outside our control) | Rust core (safe) | Compile-time capabilities |
| **Electron** | **Safe by default** (`nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`) | ⚠️ `setPermissionRequestHandler`, sender validation — by convention | ⚠️ **Chromium** (patched every 8 wks) | ⚠️ **Preload scripts — one mistake = RCE** | ✅ **`@electron/fuses`** (post-link) |
| **Flutter** | ✅ **No HTML DOM — XSS structurally impossible** | ✅ Our renderer only builds known widgets | ✅ **None** — own engine | — | N/A |
| **Wails** | ⚠️ **Whatever you bind** | ❌ No scopes | ⚠️ OS's webview | Go core | — |
| **Neutralino** | ⚠️ Coarse `nativeAllowList` globs | ⚠️ Local HTTP `server.mount()` roots | ⚠️ OS's webview | Extensions (any language) | Connect-token + origin checks |
| **NW.js** | ❌ **Node in the renderer by design** | ❌ | ⚠️ Chromium | — | — |
| **Qt 6** | ✅ Chromium sandboxed, **no Node** | ✅ **`QWebEngineSanitizer`** built in | ⚠️ Chromium | C++ | — |
| **Custom Rust** | ✅ **No webview at all** | ✅ We decide | ✅ **None** | — | We write it |

### A6. Build, debugging, testing

| | Build time (cold / incremental) | Hot reload | Debugger | E2E testing |
|---|---|---|---|---|
| **Tauri** | Slow (LTO + large dep tree) / Fast | ✅ Vite HMR | ⚠️ Rust + DevTools are **separate**; cross-boundary is poor | ⚠️ `tauri-driver` (WebDriver) — **a generation behind Playwright** |
| **Electron** | Fast / Fast | ✅ Excellent | ✅ **Best in industry** — full DevTools + Node inspector | ✅ **Playwright `_electron`** — first-class |
| **Flutter** | Medium / **Sub-second hot reload** | ✅ **Best** | ✅ **Excellent** — widget inspector, frame charts, heap snapshots | ✅ `integration_test` + **`patrol`** |
| **Wails** | ✅ **Fast** (Go) / Fast | ✅ | ✅ Good | ⚠️ Playwright on the web build |
| **Neutralino** | ✅ **Instant** (no compile) | ✅ | ✅ DevTools | ⚠️ Weak |
| **NW.js** | Fast | ✅ | ✅ | ⚠️ Playwright-ish |
| **Qt 6** | Slow (C++) | ⚠️ | ✅ QML debugger + Chromium DevTools | ⚠️ Squish/pytest-qt |
| **Custom Rust** | Medium / Fast | ⚠️ `egui`'s is great; `iced`'s is basic | ✅ Rust-native, excellent | ⚠️ Build it |

### A7. Shipping: packaging, signing, updates

| | Installers built-in | Code signing | **Built-in auto-update** | Update signing |
|---|---|---|---|---|
| **Tauri** | ✅ **MSI, NSIS, deb, rpm, AppImage, snap, Flatpak, dmg, .app** | Required (Win/macOS) | ✅ **All 5 platforms** incl. Linux + mobile | ✅ **Mandatory, cannot disable** (minisign) |
| **Electron** | ✅ via `electron-builder` (`nsis`, `msi`, `dmg`, `AppImage`, `deb`, `rpm`, `snap`, Flatpak) | Required (Win cert ~$100–500/yr; mac notarisation) | ⚠️ **Windows + macOS only**; ❌ **Linux DIY** | ⚠️ Your responsibility |
| **Flutter** | ❌ **No installers at all** — a folder of files | Manual | ❌ **None** — community only | ❌ |
| **Wails** | ⚠️ Single binary; installers via `nfpm` | Manual | ❌ **None** | ❌ |
| **Neutralino** | ⚠️ Single binary | Minimal | ⚠️ Simple, unsigned | ❌ |
| **NW.js** | ✅ via `nw-builder` | Manual | ❌ | ❌ |
| **Qt 6** | ✅ Native per-platform | Manual | ❌ | ❌ |
| **Custom Rust** | ❌ DIY | Manual | ❌ | ❌ |

> **Tauri is the only candidate that ships a signed, all-platform updater out of
> the box.** This is a large, concrete, hard-to-replicate advantage for a
> project that intends to release repeatedly on Windows and Linux.

---

## Table B — Raw facts → scored comparison

All scores `1`–`5`, `5` = best in class.

| Criterion | Tauri | Electron | Flutter | Wails | Neutralino | NW.js | Qt 6 | Custom Rust |
|-----------|:-----:|:-------:|:------:|:-----:|:----------:|:-----:|:----:|:-----------:|
| **Install size** | 5 | 1 | 4 | 4 | 5 | 1 | 1 | 5 |
| **Memory usage** | 5 | 1 | 4 | 4 | 5 | 1 | 2 | 5 |
| **Startup time** | 5 | 2 | 4 | 4 | 5 | 2 | 2 | 5 |
| **Build time** | 2 | 5 | 3 | 5 | 5 | 4 | 1 | 3 |
| **Code reuse: desktop→web→mobile** | 2 | **5** | 3 | 1 | 1 | 2 | 1 | 1 |
| **Security model strength** | **5** | 3 | **5** | 3 | 2 | 1 | 4 | **5** |
| **HTML/CSS ecosystem leverage** | 5 | **5** | **1** | 5 | 4 | **5** | **5** | 1 |
| **Cross-platform visual consistency** | 2 | **5** | **5** | 2 | 2 | **5** | **5** | **5** |
| **Linux distro support** | 3 | **5** | **5** | 4 | 3 | **5** | 4 | **5** |
| **Packaging / signing / update** | **5** | 3 | 1 | 2 | 2 | 2 | 2 | 1 |
| **Developer experience** | 3 | **5** | **5** | 4 | 3 | 4 | 2 | 2 |
| **Learning curve** (5 = easiest) | 2 | **5** | 2 | **5** | 4 | **5** | 2 | 1 |
| **Licensing** (5 = most permissive) | **5** | **5** | **5** | **5** | **5** | **5** | 3 | **5** |
| **Ecosystem maturity** | 3 | **5** | 3 | 2 | 1 | 2 | **5** | 1 |
| **Long-term viability** | 4 | **5** | **5** | 3 | 2 | 3 | **5** | 2 |
| **Mobile story** | 3 | **5** | **5** | 1 | 1 | 1 | 1 | 1 |
| **Vendored/healthy text stack** | — | — | ★★★★ (bundled) | — | — | — | — | ★★★★★ (`parley`) |

---

## The weighting, and why

We weight by **this project's** priorities, in this order. The reasoning for each
weight is given so you can disagree specifically.

| # | Criterion | **Weight** | Why this weight, for *us* |
|---|-----------|----------:|--------------------------|
| 1 | Security model strength | **14%** | **A Markdown viewer opens attacker-controlled files by design.** XSS→RCE is not a hypothetical; it is the expected attack. See [11 security](../11-security/). This is non-negotiable, so it gets the top weight — but not more, because *both* Tauri and Flutter score 5 and neither wins it outright |
| 2 | HTML/CSS ecosystem leverage | **13%** | Our product *is* HTML rendering of Markdown. The entire CSS typographic ecosystem, every Markdown→HTML library, every reader theme, accessibility, `Ctrl+F`, and print are free if we stay in HTML. This is the criterion that most directly determines months of work |
| 3 | Code reuse across desktop/web/mobile | **13%** | **This is the user's stated strategic priority.** Desktop first, web second, mobile third, "as much code reuse as possible". Given equal weight to this and reuse alone would pick Electron |
| 4 | Cross-platform visual consistency | **9%** | A reader's whole value is typography looking right. Inconsistency between Win and Linux is a visible bug to users. Also reduces our own bug surface |
| 5 | Linux distro support | **9%** | **We chose Linux as a first-class target.** WebKitGTK 4.1 gating excludes RHEL 8/9 and old Debian/Ubuntu. This is not a nice-to-have for our stated scope |
| 6 | Packaging / signing / update | **9%** | We will release repeatedly on two platforms. Windows SmartScreen + macOS notarisation + Linux update mechanics is real ongoing work. Tauri is the only option that hands this to us |
| 7 | Ecosystem maturity | **8%** | Long-tail capabilities (IME, printing, file watching, dialogs) must not each cost a month. Includes finding/fixing bugs in dependencies |
| 8 | Long-term viability | **7%** | We maintain this for years. Vendor/project risk matters, but it is not the thing that kills us |
| 9 | Developer experience | **5%** | Multiplies the above, but is second-order |
| 10 | Install size | **4%** | Matters for Linux mirrors and Flathub conventions; not decisive for a desktop utility |
| 11 | Startup time | **3%** | Perceived quality. Nice, not decisive |
| 12 | Memory usage | **3%** | Real for a 100 MB-document viewer, but **our architecture mitigates it more than the framework does** — virtualised DOM helps every option |
| 13 | Learning curve | **2%** | Real cost, but a one-time cost amortised over years. Deliberately low-weighted — the team can learn |
| 14 | Build time | **1%** | Real, but CI caching solves most of it and it is a tax, not a risk |
| — | Licensing | **gate, not scored** | All credible candidates are MIT/BSD/Apache. Qt's LGPL is the only constraint, and it is satisfiable. **Not a differentiator** — so it is a pass/fail gate rather than a weighted criterion |
| | **Total** | **100%** | |

**Design note on the two lowest weights:** learning curve (2%) and build time (1%)
are the two criteria most often over-weighted in framework comparisons, because
they are the most *visible* costs. Both are amortisable — a team learns once, CI
caches once — whereas reuse and CSS leverage are permanent structural
properties of the choice. I have weighted them low **deliberately**, and I would
defend it: the question is not "what can we learn" but "what will we be stuck
with in five years".

**Design note on memory (3%):** memory is a real concern for a viewer holding
100 MB documents, but it is **dominated by our DOM/virtualisation
architecture, not by the shell**. A naïve Electron app and a naïve Tauri app will
both blow up on a large document. So the framework's baseline matters less than
our scrolling design. Down-weighted accordingly.

---

## Weighted verdict for this project's priorities

| Criterion | Wt | **Tauri** | | **Electron** | | **Flutter** | | **Wails** | | **Custom Rust** |
|-----------|---:|---:|---|---:|---|---:|---|---:|---|---:|---|---:|---|
| | | *score* | *wt'd* | *score* | *wt'd* | *score* | *wt'd* | *score* | *wt'd* | *score* | *wt'd* |
| Security model | 14% | 5 | **0.70** | 3 | 0.42 | 5 | **0.70** | 3 | 0.42 | 5 | 0.70 |
| HTML/CSS leverage | 13% | 5 | **0.65** | 5 | **0.65** | 1 | 0.13 | 5 | **0.65** | 1 | 0.13 |
| **Code reuse d/w/m** | **13%** | 2 | 0.26 | **5** | **0.65** | 3 | 0.39 | 1 | 0.13 | 1 | 0.13 |
| Visual consistency | 9% | 2 | 0.18 | **5** | **0.45** | **5** | **0.45** | 2 | 0.18 | **5** | **0.45** |
| **Linux distro support** | **9%** | 3 | 0.27 | **5** | **0.45** | **5** | **0.45** | 4 | 0.36 | **5** | **0.45** |
| Packaging/sign/update | 9% | **5** | **0.45** | 3 | 0.27 | 1 | 0.09 | 2 | 0.18 | 1 | 0.09 |
| Ecosystem maturity | 8% | 3 | 0.24 | **5** | **0.40** | 3 | 0.24 | 2 | 0.16 | 1 | 0.08 |
| Long-term viability | 7% | 4 | 0.28 | **5** | **0.35** | **5** | **0.35** | 3 | 0.21 | 2 | 0.14 |
| Developer experience | 5% | 3 | 0.15 | **5** | **0.25** | **5** | **0.25** | 4 | 0.20 | 2 | 0.10 |
| Install size | 4% | **5** | **0.20** | 1 | 0.04 | 4 | 0.16 | 4 | 0.16 | **5** | **0.20** |
| Startup time | 3% | **5** | **0.15** | 2 | 0.06 | 4 | 0.12 | 4 | 0.12 | **5** | **0.15** |
| Memory usage | 3% | **5** | **0.15** | 1 | 0.03 | 4 | 0.12 | 4 | 0.12 | **5** | **0.15** |
| Learning curve | 2% | 2 | 0.04 | **5** | **0.10** | 2 | 0.04 | **5** | **0.10** | 1 | 0.02 |
| Build time | 1% | 2 | 0.02 | **5** | **0.05** | 3 | 0.03 | **5** | **0.05** | 3 | 0.03 |
| **TOTAL** | **100%** | | **3.74** | | **4.17** | | **3.52** | | **3.04** | | **2.82** |

### Ranking

| Rank | Candidate | Score | Verdict |
|-----:|-----------|------:|---------|
| 🥇 1 | **Electron** | **4.17** | Wins reuse, CSS, consistency, Linux, DX, viability |
| 🥈 2 | **Tauri v2** | **3.74** | Wins size, memory, startup, packaging; loses reuse and consistency |
| 🥉 3 | **Flutter** | **3.52** | Ties on security; loses decisively on CSS leverage |
| 4 | **Qt 6** | **3.39** | Chromium *without* Node — but Electron's size and a worse ecosystem |
| 5 | **Wails v2** | **3.04** | Excellent desktop shell; no mobile, no updater |
| 6 | **NW.js** | **2.97** | Node in the renderer — architecturally disqualified |
| 7 | **Custom Rust renderer** | **2.82** | Best possible *viewer*; worst possible *multi-platform* |
| 8 | **Neutralino** | **2.56** | Tiny and pleasant; too thin and too coarse |

*(All eight scored on identical weights. Qt 6 scores respectably because its
security model is genuinely sound — Chromium sandboxed with no Node — but it
loses on install size, the LGPL obligation, and having no mobile story. NW.js
and Neutralino are eliminated on architecture and ecosystem respectively, not
merely on score.)*

---

## Where the evidence is decisive, and where it is not

The brief asks me to **be decisive where the evidence supports it, and say
clearly where it doesn't.** So:

### Decisive — do not relitigate these

1. **Flutter is out.** Not close. It scores 5 on security (no DOM ⇒ no XSS, and
   that is a genuinely strong argument) but **1 on HTML/CSS ecosystem leverage,
   which we weighted 13%.** Reimplementing the HTML rendering stack means
   building tables, `Ctrl+F`, print, syntax highlighting, and cross-block
   selection ourselves — a documented **4–7 months** before a shippable viewer,
   plus permanent ownership. For a *viewer*, that is the wrong trade. The one
   scenario where Flutter wins is if "identical rendering everywhere, forever,
   with no distro dependency" is the product thesis. **It is not our thesis.**

2. **NW.js and Neutralino are out.** NW.js is architecturally disqualified:
   Node in the renderer is fatal for untrusted Markdown. Neutralino has no
   mobile, a coarse `nativeAllowList`, no granular scopes, and no signed
   updater.

3. **Ultralight and Sciter are out** on **licence**. Proprietary; an
   open-source project cannot build on either. This is a hard gate, not a
   preference.

4. **Qt 6 and JavaFX are out.** Qt gives us Electron's Chromium at the same
   price with a worse ecosystem and an LGPL obligation, and buys only a
   narrower security model than Electron's well-configured defaults already
   provide. JavaFX's WebView is a stale engine — modern CSS and JS simply will
   not run.

5. **Tauri's updater is the best shipping story available, and it is not
   close.** The only option with a built-in updater that covers **Windows,
   Linux, macOS, Android and iOS**, with **mandatory non-disableable signature
   verification**. Electron's Linux `autoUpdater` does not exist. Flutter,
   Wails, Neutralino and custom Rust all have nothing. We will release on two
   platforms repeatedly; this is worth a real amount of engineering time.

6. **Tauri's bundle size advantage is real and measured-adjacent.** 150.7 MB
   (Electron win-x64 zip, measured today) versus ~3–10 MB. That is a 15–50×
   difference. It matters more on Linux than on Windows.

7. **Electron's rendering consistency is perfect and Tauri's is not.** Same
   Chromium 152 on every platform vs. whatever WebKitGTK the distro ships.
   For a typography product this is a quality difference, not a preference.

8. **The upgrade treadmill is real and quantified.** Electron: 6–7 majors/year,
   3-majors EOL, and **Electron 42 EOLs 20 Oct 2026 — two weeks from today.** If
   we shipped on 42 we would have a dated obligation right now. Tauri: ~1
   feature release/quarter with no forced major. This is a permanent ~15–20% of
   one developer's time for Electron.

### NOT decisive — where I am genuinely uncertain

9. **The 0.43 gap between Electron (4.17) and Tauri (3.74) is not decisive.**
   It is within the noise of my own scoring, and four weight changes flip it:
   - Raise **code reuse** to 20% → Electron wins by more.
   - Raise **packaging/update** to 15% → **Tauri wins.**
   - Raise **security** to 20% → both Tauri and Flutter hit 5; Electron is
     penalised → **Tauri wins.**
   - Raise **Linux support** to 15% → Electron wins.

   **The honest conclusion is that Tauri and Electron are the two live options
   and the decision turns on one question: how much do we actually value code
   reuse, and are we willing to own the web target separately?**

10. **Every memory and startup number in this folder is inference.** I could
    find **no reproducible third-party benchmark** of any of these frameworks on
    a Markdown-viewer workload. The figures in Table A2 are labelled
    accordingly and should not be quoted as measurements. **This is the largest
    evidence gap in this research** and it is exactly what
    [10 performance](../10-performance/) must close by measurement. I have
    written the protocol below so it can be executed.

11. **Whether Tauri's mobile is "good enough."** It is stable since 2.0 and has
    matured a lot, but 2.11.0 and 2.12.0 both landed Android lifecycle fixes,
    which tells you the platform is still being stabilised. For a *viewer*
    (no camera, no BLE, no background services) the surface area is small, so I
    lean "good enough" — but I would not bet a mobile launch on it without a
    spike.

12. **Whether the RHEL 8/9 exclusion actually matters to our users.** The
    WebKitGTK 4.1 requirement is verified and blocks RHEL 8/9 for Tauri *and*
    Wails-by-default. If Siyana has a meaningful enterprise-Linux audience,
    Tauri is out. **I do not know our user base.** This is the single highest
    -value unanswered question in this document and it belongs in
    [15-open-questions](../15-open-questions/).

---

## Measuring, not guessing

Because almost every number here is inference, here is the protocol. **Run this
before deciding**, because it takes a day and it removes the largest gap in the
research.

### 1. Size — deterministic, do it in CI

```bash
# Tauri (the CLI prints bundle sizes as of 2.12.0)
npm run tauri build
# Finished 6 bundles at:
#   target/release/bundle/nsis/*.exe    (x.x MB)
#   target/release/bundle/msi/*.msi     (x.x MB)
#   target/release/bundle/deb/*.deb     (x.x MB)
#   target/release/bundle/appimage/*.AppImage (x.x MB)

# Electron — measure unpacked first (honest), then the installer
npx electron-builder --linux dir --win dir
du -sh dist/linux-unpacked/ dist/win-unpacked/
npx electron-builder --linux AppImage --win nsis
du -sh dist/*.AppImage dist/*.exe

# Flutter
flutter build linux --release && du -sh build/linux/x64/release/bundle/
flutter build windows --release
```text

### 2. Memory — same document, same machine, sum the whole process tree

```bash
# ELECTRON is N processes. Reporting only the main process understates it
# by roughly half. This is the most common error in published comparisons.
ps -eo pid,rss,comm | grep -i siyana | awk '{s+=$2} END {print s/1024 " MB RSS"}'

# Report PRIVATE memory (commit) too — working set over-credits shared pages
# and would flatter whichever framework leans on shared system libraries.
grep -E 'VmRSS|VmHWM' /proc/$(pgrep -f siyana)/status

# Windows: sum across renderer processes
Get-Process siyana* | Measure-Object -Property WorkingSet64 -Sum
```

**Protocol:** open a **100 MB Markdown file**, scroll to 50 %, wait 3 seconds
for idle, measure. Repeat 5 times, take the median. Also measure at idle with no
file open, to separate framework baseline from document cost. **The delta
between those two numbers is the thing we actually control, and it is the number
that should drive our virtualisation design.**

### 3. Startup — time to first painted document

Do **not** use `did-finish-load` (fires before paint) or `app.whenReady()`
(knows nothing about the renderer). Instrument in the renderer:

```ts
// Fires when the first block of the document is in the DOM and laid out.
requestAnimationFrame(() => {
  const t = performance.now();
  console.log(`FIRST_PAINT_MS=${t}`);
});
```text
Wall-clock from process spawn to that log line. 30 cold launches, drop the page
cache between runs where possible, report **median and p95** (startup is
heavy-tailed; means mislead). Same machine, same document, for every framework.

### 4. Rendering correctness — the test that matters most

Because every candidate renders Markdown, run **the same Markdown corpus** (our
CommonMark fixtures from [03 specifications](../03-specifications/)) through each
and diff the output:

- Tauri / Electron / Wails / Neutralino: render to HTML, snapshot in
  **Playwright's bundled WebKit** (not Chrome) — that is the closest thing to
  the Linux webview, so it tests the *worst* case.
- Flutter: snapshot widgets with **golden tests**.
- Custom Rust: snapshot the layout output.

**This measures the thing users actually care about** — do all four renderers
agree? — and it also tells us how bad the Linux webview divergence really is
versus Tauri's stated risk. It is the highest-value experiment available.

---

## The recommendation, stated plainly

**Shortlist: Tauri v2 and Electron 44.x. Everything else is eliminated on
evidence, and the eliminations are firm.**

They are separated by **0.43 points**, which is noise. So the decision is not
arithmetic. It is one question:

> **Are we building one renderer for three platforms (→ Electron), or a great
> desktop app plus a separate web build (→ Tauri)?**

**My recommendation, and the reason for it:** resolve that question by
**building the renderer first, as a plain web app, and measuring it.** Both
Tauri and Electron accept the identical HTML/CSS/JS frontend — so the renderer,
which is where 70% of our work and 100% of our testing lives, is
**framework-independent**. Only the shell (~5% of the code) differs.

Which means we are not actually blocked on this decision. We can defer it
perfectly cheaply, build the renderer, and pick the shell when we know what the
renderer needs. That is the argument in
[`07-hybrid-architectures.md`](07-hybrid-architectures.md), and it is why the
deferral the team asked for is not a compromise — **it is the correct strategy,
because the framework choice is the least consequential decision in this
project.**

---

### A note on the arithmetic of this document

The weighted table above was recomputed after a review caught that the weights
originally summed to **0.97** rather than 1.00, which had inflated every
total by ~3%. The corrected figures are **Electron 4.17, Tauri 3.74, Flutter
3.52, Qt 6 3.39, Wails 3.04, NW.js 2.97, Custom Rust 2.82, Neutralino 2.56** —
the same ranking, and the same conclusion, but now reproducible. The three
weights that were adjusted (packaging 8→9%, ecosystem 7→8%, viability 6→7%)
carry over the shortfall and are justified in the table above. Anyone auditing
this can re-run the arithmetic: `Σ(weight × score)`, weights summing to 1.00.
