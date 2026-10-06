# ADR-0003: Desktop framework — defer the choice, build the renderer first

- **Status:** Accepted (strategy) / Proposed (shell choice, deliberately deferred)
- **Date:** 2026-10-06
- **Deciders:** Siyana Markdown Viewer maintainers
- **Consulted:**
  - [`research/08-desktop-frameworks/`](../../research/08-desktop-frameworks/README.md)
  - [`research/08-desktop-frameworks/06-comparison-matrix.md`](../../research/08-desktop-frameworks/06-comparison-matrix.md)
  - [`research/08-desktop-frameworks/07-hybrid-architectures.md`](../../research/08-desktop-frameworks/07-hybrid-architectures.md)
  - [`research/09-platform/02-linux.md`](../../research/09-platform/02-linux.md)
  - [`research/10-performance/03-memory-and-startup.md`](../../research/10-performance/03-memory-and-startup.md)

## Context

Phase 1 is a desktop app for **Windows and Linux**. Phases 6 and 7 add web and
mobile. We want maximum code reuse across all three, a small install footprint,
a fast start, and a security model strong enough to render untrusted files.

We went into this ADR expecting to pick between Tauri, Electron, and Flutter.
Two of the findings below overturned the assumptions that framing rested on, so
this ADR now records a different decision: **structure the codebase so the shell
is a replaceable detail, and defer the choice until we can measure it.**

## What the research changed

### Finding 1 — Tauri's Linux cold start is ~3× Electron's

A dated, reproducible benchmark (2026-09-24, Ubuntu 24.04 container, 2 vCPU,
no GPU, Xvfb, warm starts, n=10, alternating runs, Electron 44.4.5 /
Tauri 2.11.6 / WebKitGTK 2.52.6) measured **process exec → first page loaded**:

| Configuration | n | External median | Range |
|---|---|---|---|
| Electron 44.4.5, default | 10 | **260 ms** | 243–291 |
| Tauri 2.11.6, default | 10 | **798.5 ms** | 772–853 |
| Tauri, `WEBKIT_DISABLE_COMPOSITING_MODE=1` | 5 | 735–776 | |
| Electron, `--disable-gpu` | 5 | 234–253 | |

Tauri's `setup()` closure is reached at only 130–175 ms — roughly **two thirds
of its startup is webview process spawn we do not control.**

Source: [urhoba — Startup time comparison, 2026-09-24](https://www.urhoba.net/en/post/startup-time-comparison)
(series: *Electron or Tauri*, part 3 of 10).

Caveats we take seriously: this is Linux + WebKitGTK + software rendering in a
container, not real desktop hardware. The author did not measure Windows
(WebView2) or macOS (WKWebView), notes that WebView2 is shared between Windows
applications and may already be resident, and explicitly says the result does
**not** mean "Tauri is slow" and that you should measure on your own platform.

What it does mean: **"Tauri is fast" is not a free assumption, and on our
weakest platform it may be the opposite.** Our published budget is 700 ms to
first render (`R-P3-30`). On this measurement, a Tauri shell has almost no
headroom against it before rendering a single document.

### Finding 2 — The Linux webview floor is a hard gate, and it is old

Tauri requires `libwebkit2gtk-4.1`, which **is not available on Debian 11 or
Ubuntu 20.04, and does not work on RHEL 8/9** (which ship the ABI 4.0 webkit).
Ubuntu 22.04 ships **WebKitGTK 2.36.0** (January 2023).

That last detail is consequential: `content-visibility: auto` with
`contain-intrinsic-size` is the single most valuable CSS technique for our
long-document performance strategy, and it may not exist on our oldest
supported Linux. Feature detection via `@supports` becomes mandatory, and our
performance design must have a fallback that is not "hope for a newer distro".

Electron has the opposite property: it bundles its own Chromium, so one binary
runs identically on every distribution, old or new, with no webview dependency.

### Finding 3 — Every memory and startup number in the framework comparison is inference

There is no reproducible third-party benchmark of any of these frameworks on a
Markdown-viewer workload. The only measured sizes are Electron's binaries:
**150.7 MB** win-x64, **117.2 MB** linux-x64, 128.0 MB darwin-x64.

The scoring exercise scored Electron 4.17 against Tauri 3.74. That 0.43 gap is
within the noise of its own scoring — four plausible weight changes flip it:

| Weight change | Winner |
|---|---|
| Raise code reuse to 20% | Electron, by more |
| Raise packaging/update to 15% | **Tauri** |
| Raise security to 20% | **Tauri** |
| Raise Linux support to 15% | Electron |

A 0.43 gap that four argument moves reverse is not a decision. It is a
preference, and we should not encode a preference as an architecture decision.

### Finding 4 — The framework governs a small fraction of the code

From [`07-hybrid-architectures.md`](../../research/08-desktop-frameworks/07-hybrid-architectures.md):
the renderer — parser, sanitizer, AST, virtual scroller, themes, find-in-page,
tests — is **70–75% of the work** and is byte-identical HTML/CSS/JS under every
candidate shell. The framework governs roughly 5%.

## Decision

### 1. Build the renderer first, as a plain web application

`packages/core`, `packages/sanitize`, `packages/ui`, and `packages/search` are
plain TypeScript. They run in a browser with no framework dependency, no host
API, and no shell. This is Phase 1 work and it is not contingent on ADR-0003
resolving.

### 2. Define `PlatformAdapter` as a real interface and enforce it

```ts
export interface PlatformAdapter {
  readonly kind: 'desktop' | 'web' | 'mobile'

  fs: {
    openDocument(target: DocumentTarget): Promise<RawFile>
    listDirectory(target: DocumentTarget): Promise<Entry[]>
    writeDocument(target: DocumentTarget, bytes: Uint8Array): Promise<void>
    watch(target: DocumentTarget, onChange: ChangeListener): Promise<WatchHandle>
    capabilities: { canWrite: boolean; canWatch: boolean; hasRealPaths: boolean }
  }

  resolveAsset(basePath: PathRef, relative: string): Promise<AssetRef | null>
  shell: { openExternal(url: string): Promise<void>; onExternalRequest(cb: (u: string) => void): VoidHandle }
  window: { setTitle(t: string): void; getState(): WindowState; setState(s: WindowState): void }
  theme: { current(): ThemeName; subscribe(cb: (t: ThemeName) => void): VoidHandle }
  notifications: { notify(n: Notification): Promise<void> }
}
```

**The lint rule is the actual decision.** Without a rule preventing
`packages/core` and `packages/ui` from importing a host API, this architecture
silently degrades into "Electron everywhere" with extra steps, and the shell
stops being replaceable. The rule is enforced in CI from the first commit.

This is already the structure in
[ADR-0002](0002-monorepo-with-workspaces.md) and
[`docs/architecture/monorepo-structure.md`](../architecture/monorepo-structure.md).
This ADR makes the boundary load-bearing rather than aspirational.

### 3. Defer the shell decision to the Phase 2 prototype gate

Two candidates, decided by measurement on real hardware:

| | Tauri 2 | Electron 44 |
|---|---|---|
| Install size | ~3–10 MB | ~90–115 MB installer (150.7 MB runtime, measured) |
| Memory | Lower | Higher |
| Linux distro support | Requires `webkit2gtk-4.1`; excludes RHEL 8/9 | Bundled Chromium; every distro |
| Rendering consistency | Differs by OS webview | Identical Chromium everywhere |
| Mobile | Supported, still maturing | Supported via Capacitor |
| Auto-update | Built in, all platforms, mandatory signature verification | Windows/macOS only; Linux is DIY |
| Build/debug | Rust; DevTools and Rust inspector are separate | Best-in-industry |
| E2E testing | `tauri-driver` (WebDriver, a generation behind) | Playwright `_electron`, first-class |
| Language count | TypeScript + Rust | TypeScript only |
| Release cadence | ~1 feature release/quarter | 6–7 majors/year, 3-majors EOL |

Flutter, NW.js, Neutralino, Qt, JavaFX, Ultralight, and Sciter are **out** — not
on score alone but on structural grounds recorded in
[`06-comparison-matrix.md` §Decisive](../../research/08-desktop-frameworks/06-comparison-matrix.md).
The two worth restating: Flutter scores 1/5 on HTML/CSS leverage, which would
mean rebuilding tables, find-in-page, print, and selection — an estimated 4–7
months before a shippable viewer, and permanent ownership. Sciter and
Ultralight are proprietary and cannot be used by an MIT open-source project.

### 4. Phase 1 ships a shell, but treats it as provisional

Phase 1 needs a window to exist. We will pick whichever shell reaches the
Phase 2 measurement gate fastest — which on the evidence is **Electron**: it is
faster to build, its E2E story is first-class, it keeps the stack to one
language, and it is the only candidate with zero webview dependency risk on
Linux. If the Phase 2 measurements then show Tauri wins on the things that
matter to our users, **swapping the shell is a change confined to the adapter
layer and touches zero renderer lines.**

This is deliberately a provisional choice made for delivery speed, recorded
here so it is not mistaken for the architectural decision.

## Alternatives considered

**Commit to Tauri now.** This was the recommendation before the research
landed. Rejected because it rested on two claims that measurement undermines:
that Tauri is fast (Finding 1 contradicts it on Linux), and that the shell
choice is architecturally decisive (Finding 4 contradicts it — it is ~5% of the
code). Tauri's genuine advantages — size, memory, and being the only candidate
with a signed all-platform updater — are real, and the updater in particular is
worth real engineering time. They are not worth pre-empting a measurement over.

**Commit to Electron now.** Equally premature, in the other direction. 150 MB
measured, a Chromium upgrade every ~8 weeks, 3-majors EOL, and a 150 MB download
for users who almost certainly already have a Chromium. Also, Electron's own
documentation says the framework "is not intended to handle" displaying
arbitrary content from untrusted sources, and every real compromise of a
Markdown editor has gone through that gap. Both shells require our
[ADR-0005](0005-security-baseline-xss-sanitization.md) four-layer model
regardless; the question is which one makes that model easiest to enforce well.

**Build two shells and compare.** Rejected as an expensive way to answer a
question two prototypes answer in two days.

**Use the Rust core for the shell and WASM for everything else.** Attractive if
the team is strong in Rust. It is a bet on team composition, not on the
evidence, and it splits the renderer across two languages before we know we
need it.

## Consequences

### Good

- **The most valuable 75% of the work starts immediately** and is not blocked on
  a framework decision.
- The shell becomes a genuinely reversible choice, not a bet.
- We get real measurements on real hardware before committing, rather than
  inheriting someone else's inference.
- Phase 6 (web) is a repackaging of code that already exists, not a new build.
- The renderer stays testable in a browser, with fast tests and no native build
  step in the inner loop.

### Bad / accepted costs

- **We take on Electron's costs first**: 150 MB, the Chromium treadmill, and
  Linux auto-update being our problem. Accepted as the provisional state with a
  documented exit.
- **A second prototype later.** If Tauri wins the Phase 2 gate, we build a
  Tauri shell after building an Electron one. That is a few days, and it is
  cheaper than choosing wrong for a year.
- **The adapter boundary is a discipline we must enforce**, or the whole
  strategy collapses. The lint rule is the mechanism; without it maintained,
  option (d) degrades silently.
- **`PlatformAdapter` can over-abstract.** We must keep it small and let it grow
  only from demonstrated need. An adapter with fifteen methods and one
  implementation is worse than direct calls behind a lint rule.
- **Enterprise-Linux users are unknown.** If our audience turns out to include
  RHEL 8/9, Tauri is out entirely and this is settled without a prototype.

### Follow-up work

- [ ] Record the user-base question about enterprise Linux before the Phase 2
      gate — it is the single highest-value unknown
      ([`research/15-open-questions/`](../../research/15-open-questions/README.md)).
- [ ] Enforce the `PlatformAdapter` boundary with a lint rule before the first
      app code lands.
- [ ] Phase 2 gate: same document, same machine, sum the whole process tree, and
      **report RSS and PSS** — the two metrics disagree by enough to change the
      conclusion. Protocol:
      [`06-comparison-matrix.md` §Measuring](../../research/08-desktop-frameworks/06-comparison-matrix.md).
- [ ] Decide our minimum Linux version, and whether `content-visibility`
      availability (Finding 2) forces it higher than 22.04.
- [ ] Prototype on **real hardware**, not in CI containers. The benchmark above
      is explicitly container-bound and its author says so.

## Validation

This ADR's strategy — build the renderer, defer the shell — is validated by the
question being answerable rather than assumed. The shell choice itself is
validated by measurement at the Phase 2 gate:

| Measurement | Favours | Our budget |
|---|---|---|
| Cold start → first render, real hardware | — | ≤ 700 ms (`R-P3-30`) |
| Install size | Tauri decisively | ≤ 50 MB (`R-P3-31`) |
| Idle RSS, process tree summed, RSS **and** PSS | Tauri | ≤ 200 MB |
| Open a 5 MB document | — | ≤ 2 s (`R-P3-32`) |
| Launch on Ubuntu 22.04, 24.04, Fedora, Arch | Electron | hard gate |
| Launch on RHEL 8/9 | Electron only | hard gate |
| NVDA reads the document structure correctly | — | hard gate (`R-P3-45`) |

**Hard gates, not scores.** A shell that fails any hard gate is out regardless
of its other numbers. A shell that passes every hard gate and wins on size and
memory is Tauri. If it passes everything and is within budget, we keep Electron
and stop optimising, because the remaining difference is not worth a second
shell.