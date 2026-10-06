# 08 — Desktop Frameworks

> What runs the window? This folder compares every credible candidate for
> Siyana Markdown Viewer's desktop shell, then asks the harder question:
> which one lets us reuse the most code when we get to Web and Mobile.

**Date of research: 6 October 2026.** Every version number below was fetched
from an official source on that date and the URL is cited inline. Where a
number is widely repeated but unsourced, it is labelled as such.

---

## The decision we are actually making

We are **not** choosing "the best desktop framework". We are choosing a
**three-platform code-reuse topology**:

1. **Desktop first** — Windows and Linux, ideally macOS for free.
2. **Web next** — a hosted browser build.
3. **Mobile last** — Android and iOS.

That ordering inverts the usual framing. Most framework comparisons optimise
for desktop polish and treat web/mobile as afterthoughts. For us, **code reuse
across all three targets is a first-class criterion**, not a bonus.

The corollary is uncomfortable but important: **the desktop shell and the
web/mobile renderer may not be the same technology.** A perfect desktop
experience built on a Rust+webview shell can strand us on mobile, because
Tauri's mobile story is young. We therefore documented a fourth possibility
(shared core + separate shells) in [`07-hybrid-architectures.md`](07-hybrid-architectures.md)
rather than pretending a single framework wins everything.

---

## Documents in this folder

| # | Document | What it answers |
|---|----------|-----------------|
| 01 | [Tauri v2](01-tauri.md) | Rust backend + system webview. Capabilities, IPC, plugins, updater, Linux webkit2gtk pain |
| 02 | [Electron](02-electron.md) | Chromium + Node. Security checklist, bundle size, the 8-week upgrade treadmill |
| 03 | [Flutter](03-flutter.md) | Own renderer, no webview. Perfect consistency, but you rewrite the Markdown renderer |
| 04 | [Wails, Neutralino & friends](04-wails-and-neutralino.md) | The smaller options, honestly assessed |
| 05 | [Native & custom rendering](05-native-and-other.md) | egui/iced, Qt, GTK4, Avalonia, and the Rust text-shaping stack |
| 06 | [Comparison matrix](06-comparison-matrix.md) | Two tables: raw facts, then our weighted score |
| 07 | [Hybrid architectures](07-hybrid-architectures.md) | Reuse percentages, mermaid diagrams, mobile shells, web hosting |

---

## Verified version snapshot (6 October 2026)

Every cell fetched today. Sources are in the linked documents.

| Project | Current stable | Released | Prerelease | Source |
|---------|---------------:|----------|-----------|--------|
| **Tauri** | `2.12.0` (crate `2.12.1`) | 26 Sep 2026 | `3.0.0-alpha.4` | [crates.io tauri](https://crates.io/api/v1/crates/tauri) · [release notes](https://v2.tauri.app/release/tauri/) |
| **@tauri-apps/cli** | `2.12.1` | 30 Sep 2026 | — | [npm](https://registry.npmjs.org/@tauri-apps/cli) |
| **Electron** | `44.5.1` | 29 Sep 2026 | `45.0.0-beta` (stable 20 Oct 2026) | [npm](https://registry.npmjs.org/electron) · [schedule](https://releases.electronjs.org/schedule) |
| Electron bundled | Chromium **152.0.7977.130**, Node **24.21.0**, V8 **15.2.124.28** | | | [release page](https://releases.electronjs.org/release/v44.5.1) |
| **Flutter** | `3.47.6` (Dart `3.13.5`) | 1 Oct 2026 | `3.49.0-0.2.pre` | [releases JSON](https://storage.googleapis.com/flutter_infra_release/releases/releases_windows.json) |
| **Wails** | `v2.16.0` | 14 Sep 2026 | v3 in Beta | [changelog](https://wails.io/changelog) |
| **Neutralino** | `v6.9.0` | — | nightly | [release notes](https://neutralino.js.org/docs/release-notes/framework) |
| **NW.js** | `0.117.0` | 26 Sep 2026 | — | [npm](https://registry.npmjs.org/nw) |
| **electron-builder** | `26.15.3` | 9 Jun 2026 | — | [npm](https://registry.npmjs.org/electron-builder) |
| **Capacitor** | `8.5.2` | 11 Sep 2026 | — | [npm](https://registry.npmjs.org/@capacitor/core) |
| **Ionic** | `9.0.6` | 30 Sep 2026 | — | [npm](https://registry.npmjs.org/@ionic/core) |
| **React Native** | `0.87.1` | 26 Aug 2026 | — | [npm](https://registry.npmjs.org/react-native) |
| **react-native-webview** | `14.0.1` | 20 Jun 2026 | — | [npm](https://registry.npmjs.org/react-native-webview) |
| **Expo** | `57.0.26` | 29 Sep 2026 | — | [npm](https://registry.npmjs.org/expo) |
| **egui** | `0.36.2` | 8 Sep 2026 | — | [crates.io](https://crates.io/api/v1/crates/egui) |
| **iced** | `0.14.0` | 7 Dec 2025 | — | [crates.io](https://crates.io/api/v1/crates/iced) |
| **cosmic-text** | `0.19.0` | 22 Apr 2026 | — | [crates.io](https://crates.io/api/v1/crates/cosmic-text) |
| **parley** | `0.11.1` | 16 Aug 2026 | — | [crates.io](https://crates.io/api/v1/crates/parley) |
| **skrifa** | `0.48.0` | 3 Oct 2026 | — | [crates.io](https://crates.io/api/v1/crates/skrifa) |

> **Correction to an earlier assumption in this project's brief:** Tauri is
> **not** on 2.11.x. `tauri` 2.12.0 shipped 26 Sep 2026 and the CLI/crate are at
> 2.12.1 as of 30 Sep–1 Oct 2026. Electron 44.x is confirmed correct.

---

## Evaluation criteria

These are the axes we score on in
[`06-comparison-matrix.md`](06-comparison-matrix.md). They are ordered roughly
by how much they should influence the decision.

| # | Criterion | What we mean by it | Why it matters here |
|---|-----------|-------------------|---------------------|
| 1 | **Security model strength** | Is the default posture safe against malicious `.md` files? Is XSS contained by design? | A Markdown viewer opens attacker-controlled files by definition. XSS→RCE is the primary threat. See [11 security](../11-security/) |
| 2 | **Code reuse across desktop/web/mobile** | % of the renderer and core shared by all three targets | Our stated strategic priority |
| 3 | **HTML/CSS ecosystem leverage** | Can we use the entire existing Markdown/CSS/JS/typography ecosystem unchanged? | The rendering of Markdown *is* HTML. Anything else is a rewrite. See [05 rendering](../05-rendering/) |
| 4 | **Cross-platform visual consistency** | Does the app look and behave identically on Win/Linux/macOS/web/mobile? | Affects theme fidelity, typography, and our own bug surface |
| 5 | **Linux distro support** | Package formats, dependency story, WebKitGTK fragmentation | Windows is the easy half; Linux is where shells break |
| 6 | **Packaging / signing / auto-update** | Can we ship signed, self-updating binaries without heroics? | See [09 platform](../09-platform/) |
| 7 | **Memory usage** | RSS at idle with a large document open | 100 MB files are in scope ([10 performance](../10-performance/)) |
| 8 | **Startup time** | Cold start to first paint | Perceived quality |
| 9 | **Install size** | Download + on-disk footprint | Gate for Linux distro packaging and mirrors |
| 10 | **Build time** | Dev-loop rebuild and CI release build | Directly costs engineering hours |
| 11 | **Developer experience** | Hot reload, DevTools, error messages, IDE integration | Multiplies everything above |
| 12 | **Learning curve** | Weeks for a competent web dev to be productive | Team cost |
| 13 | **Ecosystem maturity** | Plugins, driver support, docs, community size | Long-tail capabilities (printing, IME, file watching) |
| 14 | **Licensing** | Licence of framework + runtime + bundled assets | Open-source project; must stay permissive |
| 15 | **Long-term viability** | Vendor risk, project health, governance | We will maintain this for years |

---

## How we researched this

Per the `research/` ground rules in [`../README.md`](../README.md):

- **Every version number** was fetched today from a primary source: crates.io
  API, npm registry, the Flutter release JSON, or the project's own release
  page. Sources are inline.
- **Bundle size numbers** are real byte counts, not blog estimates. Where we
  measured ourselves or pulled from a package mirror, we say so.
- **Memory and startup numbers are labelled by confidence.** In the public
  record there is no reproducible, third-party benchmark of Tauri vs Electron
  vs Flutter on *a Markdown viewer workload*. The famous figures circulate from
  vendor blogs and are methodologically weak. We say so explicitly and give
  a measurement protocol instead. See §"Measuring, not guessing" in
  [`06-comparison-matrix.md`](06-comparison-matrix.md).
- **Vendor claims are attributed.** Tauri saying "less than 600KB" is marked as
  Tauri saying so.
- **Inference is marked as inference.**

---

## Where we landed (short version)

The weighted verdict is in
[`06-comparison-matrix.md` § Weighted verdict](06-comparison-matrix.md#weighted-verdict-for-this-projects-priorities).
The short form:

| Rank | Candidate | Score | Why |
|-----:|-----------|------:|-----|
| 1 | **Electron 44.x** | **4.17** | Wins reuse, CSS leverage, rendering consistency, Linux, DX, viability |
| 2 | **Tauri 2.12** | **3.74** | Wins size, memory, startup, and is the only option with a signed all-platform updater |
| 3 | **Flutter 3.47** | **3.52** | Best renderer consistency and best mobile story — but 1/5 on CSS leverage, which is fatal for a *viewer* |
| 4 | Qt 6 | 3.39 | Chromium without Node (sound security) at Electron's size with a worse ecosystem |
| 5 | **Wails 2.16** | 3.04 | Excellent, easy-to-learn desktop shell — but no mobile, no updater |
| 6 | NW.js | 2.97 | Node in the renderer: architecturally disqualified for untrusted Markdown |
| 7 | Custom Rust renderer | 2.82 | The best possible *viewer*; the worst possible *multi-platform* story |
| 8 | Neutralino | 2.56 | Tiny and pleasant, but too thin and too coarse |

**Electron and Tauri are 0.43 apart, which is noise.** The decision is not
arithmetic — it is one question: *are we building one renderer for three
platforms, or a great desktop app plus a separate web build?*

And that question turns out to be **unnecessary to answer now**, because the
framework governs only ~5% of our code while the renderer governs ~70% — and
the renderer is **identical HTML/CSS/JS under every candidate shell**. So the
recommendation is [`07-hybrid-architectures.md` option (d)](07-hybrid-architectures.md):
**build the renderer first as a plain web app behind a typed
`PlatformAdapter` interface, then pick the shell.** Deferring is not fence
sitting here; it is the correct strategy, because it is the cheapest and most
reversible of all the decisions available.

Nothing here is decided. Per the brief, this folder documents all candidates
and defers the choice. But the evidence does support a *lean*, and the lean is
written down in the matrix with weights and justifications you can argue with.
