# ADR-0003: Desktop framework — Tauri, Electron, or Flutter

- **Status:** Proposed
- **Date:** 2026-10-06
- **Deciders:** Pending — needs a maintainer decision and a 2-day prototype
- **Consulted:**
  - [`research/08-desktop-frameworks/`](../../research/08-desktop-frameworks/README.md)
  - [`research/08-desktop-frameworks/06-comparison-matrix.md`](../../research/08-desktop-frameworks/06-comparison-matrix.md)
  - [`research/08-desktop-frameworks/07-hybrid-architectures.md`](../../research/08-desktop-frameworks/07-hybrid-architectures.md)
  - [`research/09-platform/](../../research/09-platform/README.md)
  - [`research/10-performance/03-memory-and-startup.md`](../../research/10-performance/03-memory-and-startup.md)

## Context

Phase 1 is a desktop app for **Windows and Linux**. Phases 6 and 7 add web and
mobile. We want maximum code reuse across all three, a small install footprint,
and a security model strong enough to render untrusted files safely.

The candidate frameworks, with versions verified at the time of writing
(October 2026):

| Framework | Current | Runtime |
|---|---|---|
| **Tauri 2** | 2.11.x stable (3.0.0 in alpha) | System webview (WebView2 on Windows, WebKitGTK on Linux) + Rust |
| **Electron** | 44.x stable (Chromium 152, Node 24.x) | Bundled Chromium + Node |
| **Flutter** | 3.x stable | Own Skia/Impeller renderer, no system webview |
| Wails 2 | current | System webview + Go |
| Native (egui, iced, Qt, GTK) | various | Own widgets, or webview, or none |

The full comparison lives in
[`research/08-desktop-frameworks/06-comparison-matrix.md`](../../research/08-desktop-frameworks/06-comparison-matrix.md).
This ADR records the decision criteria and the decision we intend to make.

## Decision criteria

Weighted for this project's priorities, not for "desktop apps in general":

| Criterion | Weight | Why it matters here |
|---|---|---|
| Security model strength | 25% | We render untrusted files. A compromised renderer must not reach the filesystem. |
| Code reuse across desktop/web/mobile | 20% | Three targets, one team. Reuse is the whole reason the roadmap works. |
| Install size and memory | 15% | A viewer gets installed by many people; a 200 MB download and 300 MB RSS is a real cost. |
| Startup time | 10% | It is a viewer. It must feel instant. |
| Linux support quality | 10% | We ship Linux. WebKitGTK packaging and Wayland are the known pain points. |
| HTML/CSS leverage | 10% | Markdown rendering, theming, and layout are web problems. We get them free in a webview. |
| Distribution, signing, auto-update | 5% | Solved by each framework's tooling, but not equally well. |
| Team capability and learning curve | 5% | Real cost. A Rust core is a commitment. |

## Candidate summary

### Tauri 2

**For:** ~10 MB installers versus Electron's ~150 MB+; RSS measured in tens of
MB; a capability/permission model that makes the IPC surface explicit and
reviewable, which is exactly the security posture we need; update signing via
minisign; one Rust codebase could serve desktop, web (WASM), and mobile.

**Against:** Linux depends on the host's `libwebkit2gtk`, and version
fragmentation across distributions is the single most common way a Tauri app
fails to launch — see
[`research/09-platform/02-linux.md`](../../research/09-platform/02-linux.md).
We would be writing and maintaining Rust. Rendering is the system webview, so
CSS and JS behaviour differ between Windows and Linux. Mobile support is
younger than Electron's.

### Electron 2

**For:** identical Chromium everywhere, so CSS and JS behave the same on both
targets. Best debugging story. `contextIsolation` + `sandbox` +
`nodeIntegration: false` is a well-documented, well-trodden security model. The
largest ecosystem, so the auto-updater, the packaging tooling, and every
Stack Overflow answer exist. No Rust requirement.

**Against:** the install is roughly 150 MB and idle memory is high. Every user
downloads a browser they almost certainly already have. The Chromium upgrade
triage is relentless — a new major every ~8 weeks, each with breaking changes.
Electron dropped 32-bit builds from v44 onwards.

### Flutter

**For:** one codebase covering desktop, web, and mobile — the best answer to the
reuse criterion. Perfectly consistent rendering across platforms, no webview
inconsistency. Excellent touch support for Phase 7. Fast startup and low memory
for what it delivers.

**Against:** **this is the disqualifying problem.** We cannot use HTML or CSS, so
we cannot reuse any Markdown-to-HTML renderer, any existing sanitization
approach, any web-based syntax highlighter integration, any web UI kit, or any
of the accessibility semantics we get from real HTML elements. We would have to
write a widget-based Markdown renderer, a widget-based code highlighter, and a
custom focus/semantics layer for screen readers. That is a second application,
not a shell. The team would need Dart fluency.

## Decision

**Proposed: Tauri 2.**

The reasoning, in short:

1. **Security decides it.** The capability model in Tauri v2 is an allowlist by
   default and the IPC surface is enumerable. For an app whose entire input is
   attacker-controlled, "what can the renderer reach?" must have a
   one-glance answer. We can put that answer in a reviewed file.
2. **Footprint matters for a viewer.** A reader app is not a CAD app. Shipping
   tens of megabytes rather than hundreds is the difference between "installed
   it" and "did not bother."
3. **The renderer is still HTML.** Our whole `packages/core` and `packages/ui`
   are HTML/CSS/TypeScript. Flutter would force us to rewrite both for widget
   trees, and would make Phase 6 (web) a third rewrite rather than a
   repackaging.
4. **Rust is a net cost we accept deliberately.** It buys the Tauri shell and
   the option of a Rust parsing core compiled to WASM for the web target. The
   alternative — JavaScript-only with Electron — is simpler but commits us to
   shipping a browser inside the app.

### The one serious argument against

The research produces one finding that could overturn this decision, so it is
stated here rather than buried:

**Linux is our weakest platform and our hardest constraint.** Tauri requires
`webkit2gtk-4.1`, which is **not available on Debian 11 or Ubuntu 20.04**, and
RHEL 8/9 ships the ABI 4.0 webkit that Tauri cannot use. Tauri's own Linux
dependency chain (`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`,
`librsvg2-dev`, `patchelf`) is a genuine distribution problem — the most common
way a Tauri app fails to launch.

Electron has the opposite property: it bundles its own Chromium, so the same
binary runs identically on every distro, old or new, with no webview
dependency at all. On a project that ships Linux as a first-class target,
that is not a small advantage.

What keeps Tauri ahead is the size and memory difference — Electron's measured
runtime is **150.7 MB on Windows and 117.2 MB on Linux**, against a Tauri
install in the single-digit-to-low-double-digit megabytes — and the fact that
we have already committed to a web renderer for correctness and accessibility
reasons, which Flutter would forfeit and Electron merely makes expensive.

**Therefore this decision is conditional on the prototype, not settled by
argument.** See the validation section.

### What we will not do

- We will not render raw HTML unsanitized, in any shell. See
  [ADR-0005](0005-security-baseline-xss-sanitization.md).
- We will not use `dangerousDisableAssetCspModification` or any equivalent
  escape hatch to make image loading "just work".
- We will not add a Tauri capability in the same PR that uses it. Capabilities
  are reviewed as security changes.

## Alternatives considered

**Electron.** The strongest alternative and a completely defensible choice. We
would pick it if the team had no appetite for Rust, if Linux webview
fragmentation proved unworkable in the prototype, or if we needed a feature that
only exists in the Electron ecosystem. The cost is install size, memory, and the
Chromium triage treadmill.

**Flutter.** Rejected for the reuse problem described above. Reconsider only if
the project were dropped to a single target and dropped the HTML renderer
entirely — which contradicts the roadmap.

**Wails 2.** Genuinely smaller and simpler than Tauri, and Go is easier to pick
up than Rust. Rejected because its ecosystem, plugin set, and mobile story are
materially thinner, and we would be trading away Tauri maturity for a modest
simplification. See
[`research/08-desktop-frameworks/04-wails-and-neutralino.md`](../../research/08-desktop-frameworks/04-wails-and-neutralino.md).

**Native Rust UI (egui / iced).** Rejected. A Markdown document is a rich
typographic layout problem with nested block structure, tables, and code blocks.
Building that with immediate-mode widgets is a large amount of work with no
dependency payoff, and it would forgo the HTML ecosystem entirely.

**Hybrid: Electron for desktop, plain web for browser, Capacitor for mobile.**
This maximises renderer reuse and minimises Rust exposure, and it is the option
we would choose if Rust capability in the team were a real risk. It is second
place, and the deciding factor between first and second is team composition.

## Consequences

### Good

- Install and memory in the range of a native utility rather than a browser.
- IPC surface is small, declared, and reviewable.
- One Rust codebase is available for a WASM parsing core in Phase 6 if we
  benchmark JS parsing as insufficient.
- The frontend is plain web technology, so `packages/ui` and `packages/core` are
  reusable as-is for the web build.

### Bad / accepted costs

- **We take on Rust.** Build times, compile-error cycles, and a learning curve
  for anyone joining.
- **Linux WebKitGTK fragmentation.** Our oldest and most likely-to-break
  platform. We must test on a clean Ubuntu LTS, a current Fedora, and a
  non-Debian distribution (Arch or openSUSE) before every release, and we must
  be honest in the README about which distros are verified.
- **Windows/Linux rendering differences.** CSS support differs between WebView2
  (Chromium) and WebKitGTK. We will keep our CSS conservative and test on both.
- **Mobile is younger on Tauri than on Electron.** Phase 7 may be re-planned.
- **Two toolchains in one repo** (see [ADR-0002](0002-monorepo-with-workspaces.md)).

### Follow-up work

- [ ] **Prototype before committing.** Two days: open a file, render HTML, use
      the official sanitizer, read a local image, on Windows and on Ubuntu
      22.04 and 24.04. Measure install size and idle RSS.
- [ ] Verify screen-reader accessibility in a webview on Windows (NVDA) and
      Linux (Orca). If the accessibility tree is not exposed, this decision is
      wrong regardless of everything else — see
      [`research/12-ux/04-accessibility.md`](../../research/12-ux/04-accessibility.md).
- [ ] Measure parser performance in the WebKitGTK JS engine versus Chromium.
      If WebKitGTK is materially worse, that pushes toward a Rust parser.
- [ ] Decide Turborepo vs Nx vs plain workspaces for the JS side.
- [ ] Confirm the minimum supported Linux distribution and its `libwebkit2gtk`
      version, and document it.

## Validation

We will revisit this decision if **any** of the following is true:

1. The prototype cannot launch on a supported Ubuntu LTS.
2. The webview does not expose a usable accessibility tree to the OS screen
   reader.
3. Idle RSS or startup time exceeds our published budget
   ([`research/10-performance/03-memory-and-startup.md`](../../research/10-performance/03-memory-and-startup.md))
   by a wide margin.
4. The team's Rust capability turns out to be a delivery risk rather than an
   investment.

If (2) turns out to be true for both webviews, we should switch to Flutter for
its first-party accessibility semantics and accept the renderer rewrite — a
viewer that cannot be used with a screen reader fails a hard requirement, and
no amount of bundle size compensates.

### The prototype

Two days, both platforms, with a fixed acceptance test. Not a spike to explore —
a spike to measure.

**Build:** a Tauri app that opens a file from a native dialog, parses it with
`markdown-it`, sanitizes with `DOMPurify`, renders it, resolves one relative
image, and shows a table of contents.

**Must pass, or the decision is reversed:**

| # | Test | Why it is a gate |
|---|---|---|
| 1 | Launches on Ubuntu 22.04 and 24.04 | The Linux webview dependency is the known failure mode |
| 2 | `webkit2gtk-4.1` install documented and reproducible | Users will hit this; so will our release process |
| 3 | NVDA reads the rendered document with correct heading structure | Hard accessibility requirement (`R-P3-45`) |
| 4 | Idle RSS under 200 MB with a 5 MB document open | Published budget (`R-P3-31`) |
| 5 | Install size under 50 MB | The main reason we prefer Tauri |
| 6 | Cold start to first render under 700 ms | Published budget (`R-P3-30`) |
| 7 | Parser performance in WebKitGTK within 1.5× of Chromium | If materially worse, that pushes toward a Rust parser (ADR-0004) |

**Recorded whether it passes or fails.** A prototype that is not documented is
not evidence.

**If any of 1, 3, or 7 fails**, the recommendation changes:

- 1 fails → Electron. Accept 150 MB, gain identical behaviour on every distro.
- 3 fails for Tauri and Electron → Flutter. Accept the renderer rewrite; a
  viewer unusable with a screen reader fails a hard requirement.
- 7 fails → keep Tauri, add a Rust parser core (see
  [ADR-0004](0004-markdown-parser-strategy.md#deliberately-rejected)).