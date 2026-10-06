# 04 — Wails, Neutralino & the smaller options

> **Status: 6 October 2026.** Versions fetched from primary sources today and
> cited inline.

---

## 1. Wails v2 — the credible middle option

> **Version: `v2.16.0`, released 14 Sep 2026.**
> Source: [Wails changelog](https://wails.io/changelog) · [wails.io](https://wails.io)
> Note: **Wails v3 is in Beta** ([v3 blog](https://v3.wails.io/blog)) — v3
> introduces "a more direct application model, richer bindings, and a clearer
> foundation".

### Architecture

Identical shape to Tauri: **Go backend + web frontend + system webview**.

```text
Go (main, compiled static binary)
  → wails runtime (github.com/wailsapp/wails/v2/pkg/runtime)
  → binds Go methods to the frontend
  → WKWebView / WebView2 / WebKitGTK
Frontend: HTML/CSS/JS (any framework), talks to Go via generated bindings
```

The binding model is the pleasant part: you write ordinary Go methods on a
struct, and Wails generates the JS. `//go:embed` embeds your frontend build into
the binary, so distribution is a **single file per platform** with no installer
required.

```go
// main.go
type App struct{ ctx context.Context }

func (a *App) OpenDocument(path string) (*Document, error) {
    // Heavy work here runs in Go, off the JS thread.
    b, err := os.ReadFile(path)
    if err != nil { return nil, err }
    return Parse(b)
}

func main() {
    app := NewApp()
    err := wails.Run(&options.App{
        Title:  "Siyana Markdown Viewer",
        Width:  1200, Height: 800,
        AssetServer: &assetserver.Options{ /* serve dist */ },
        Bind: []interface{}{ app },
        OnStartup: func(ctx context.Context) { app.ctx = ctx },
    })
}
```

### Platform support

| Platform | Engine | Status |
|----------|--------|--------|
| **Windows** | **WebView2** | ✅ Excellent — "Uses WebView2, no external DLLs, no CGO, Acrylic + Mica effects, Dark/Light Mode, Custom theming" |
| **macOS** | WKWebView | ✅ Good, native menus and dialogs |
| **Linux** | **WebKitGTK** | ⚠️ **The weak point — see below** |
| Mobile | — | ❌ **Not supported.** (v3 is where this may change) |

**The Linux problem is documented and precise**, which is more useful than
Tauri's vaguer story. From
[Wails Linux distro support](https://wails.io/docs/guides/linux-distro-support):

| Distribution | GTK3 | WebKit2GTK | ABI | Install |
|-------------|------|-----------|-----|---------|
| Debian 12 / Ubuntu 22.04+ | `libgtk-3-0` | `libwebkit2gtk-4.1-0` | 4.1 | ✅ |
| Debian 11 / Ubuntu 20.04 | `libgtk-3-0` | `libwebkit2gtk-4.0-37` | 4.0 | ✅ |
| Fedora 40+ | `gtk3` | `webkit2gtk4.1` | 4.1 | ✅ |
| RHEL / CentOS / AlmaLinux / Rocky 8–9 | `gtk3` | `webkit2gtk3` | **4.0** | ⚠️ |

**This is materially better than Tauri here**: Wails supports **both** WebKit2GTK
ABIs, selected at **compile time with a build tag**:

```bash
go build -tags webkit2_41   # modern distros
go build -tags webkit2_40   # RHEL 8/9, old Debian/Ubuntu
```

That is a real, documented escape hatch from the RHEL problem that Tauri does
not offer. It also means **two binaries to build and test** where Tauri needs
one.

Wails also documents `nfpm` packaging with per-distro dependency overrides —
practical detail a lot of projects skip.

### Where Wails genuinely beats Tauri

1. **The learning curve.** Go is a small, boring, fast-to-learn language with
   no borrow checker, no lifetimes, no `Send`/`Sync` fights, no MSRV. A
   TypeScript developer productive in Wails in **under a week** versus weeks for
   Tauri+Rust. This is the single biggest practical advantage.
2. **Build times.** Go compiles fast, caches aggressively, and produces a static
   binary. No LTO-by-default, no huge dependency tree. `go build` is seconds
   after the first build.
3. **The `wails dev` loop** with live frontend reload and a Go backend binary.
   Simpler than `cargo tauri dev`.
4. **`wails doctor`** — a genuine diagnostic that checks platform
   dependencies and tells you what's missing. Tauri has no equivalent.
5. **Single-file distribution** with no installer needed (macOS/Linux).
6. **Simpler architecture.** One repo, one language on the backend, no
   capability/ACL system to configure — bindings are explicit method calls, so
   the security model is "what you exported is what you can call". Understandable
   in one reading.
7. **Linux WebKitGTK 4.0 support** (above).

### Where Wails loses to Tauri

1. **No capability/permission model.** Tauri denies by default with scopes. Wails
   exports whatever you bind. For a viewer opening untrusted files, **this is a
   meaningful difference** — we must then be careful ourselves. Wails does have
   an asset server, but the default posture is "the frontend can call anything
   you bound".
2. **No auto-updater.** Wails had an updater in earlier versions; the current
   changelog shows no active updater work. **We would have to build or adopt
   one.** This is a serious gap for a shipped desktop app.
3. **A thinner ecosystem.** Wails has no equivalent of Tauri's plugin
   architecture. Global shortcuts, notifications, single-instance, deep links,
   window state — all things Tauri ships first-party with permissions — must be
   done by hand or found in community packages.
4. **No mobile.** For a project with a mobile target, this is disqualifying as
   a single-stack choice (though fine as a desktop shell in a hybrid topology).
5. **GitHub velocity.** The changelog shows releases at a reasonable cadence
   (2.16.0 Sep, 2.15.0 Aug, 2.14.0 Aug, 2.13.0 Jul, 2.12.0 Mar, 2.11.0 Nov
   2025) — but note **2.10.2 → 2.11.0 was a four-month gap**, and the project
   also publishes nightly builds. Smaller-team dynamics.
6. **Smaller community.** Much less Stack Overflow, fewer blog posts, fewer
   people to ask.

### Wails scorecard

| Dimension | Rating |
|-----------|--------|
| Learning curve | **Excellent** — Go, ~1 week |
| Build time | **Excellent** |
| Security model | **Fair** — explicit but no deny-by-default or scopes |
| Packaging | **Good** — nfpm, single binary; no built-in installers for MSI/NSIS |
| Auto-update | **Poor** — build it yourself |
| Plugin ecosystem | **Poor** |
| Linux coverage | **Good** — 4.0 *and* 4.1 |
| Mobile | **None** |
| Debugging | **Good** — Go + browser DevTools |
| Viability | **Fair–good** — active, small team, v3 in Beta (churn risk) |

**Honest verdict: Wails v2 is a legitimately good desktop framework and the
most *pleasant* to learn of everything surveyed. It is not credible as our
single stack, because there is no mobile story and no updater.** It is
**absolutely credible as the desktop shell in a hybrid topology** — see
[`07-hybrid-architectures.md`](07-hybrid-architectures.md) — where it would give
us Tauri's footprint with none of Tauri's Rust learning curve.

---

## 2. Neutralino

> **Version: `v6.9.0`** (release notes list v6.9.0 as the newest; a nightly
> channel also exists). The npm `neutralino` package does not exist — Neutralino
> ships prebuilt binaries via its own `neu` CLI rather than npm.
> Sources: [release notes](https://neutralino.js.org/docs/release-notes/framework) ·
> [introduction](https://neutralino.js.org/docs/)

### Architecture

A **C++ binary** (~2–5 MB) that embeds an **HTTP static server** and opens the
system webview, communicating with JS over a **local WebSocket**. No bundled
runtime, no compiler needed for app developers — you download a binary and ship
your static files.

```jsonc
// neutralino.config.json
{
  "$schema": "https://neutralino.js.org/schemas/neutralino.config.schema.json",
  "applicationId": "app.siyana.markdown-viewer",
  "version": "0.1.0",
  "defaultMode": "window",
  "port": 0,
  "documentRoot": "/resources/",
  "url": "/",
  "singlePageServe": true,
  "enableServer": true,
  "enableNativeAPI": true,
  "nativeAllowList": ["app.*", "window.*", "filesystem.*", "os.*", "storage.*"],
  "globalVariables": { "MY_CONST": "value" },
  "extensions": { "claude": { "commands": ["getSum"] } }
}
```

### The honest problems

**1. The webview choice is the old one, and it is bad.**

Per the Neutralino docs and release notes, Neutralino loads
**`libwebkit2gtk-4.0-37` or `libwebkit2gtk-4.1-0`** on Linux, dynamically
discovered. Since v5.5.0 it searches both ABIs — good, and comparable to Wails.

**But on Windows the historically reported engine is MSHTML (IE)** in older
versions, and current versions use WebView2 with the loader statically linked
(added 4.12.0, so no `WebView2Loader.dll` needed). WebView2 is fine.

The real problem is **Linux CSS**: WebKitGTK 4.0 on a RHEL 8 box is a *2019-era*
engine. Modern CSS simply will not work. And unlike Tauri, Neutralino gives us
**no control over which ABI to build against** — it dynamically loads whatever it
finds.

**2. `MSHTML` legacy risk is real for old versions.** If any path still
resolves to MSHTML, we are shipping an app to IE's engine. Verify on the
version we adopt.

**3. Security: WebSocket + local HTTP server is a weaker model.**

- v5.0.0 added connect-token authentication, origin checking on the WS
  handshake, and stopped passing the token via command-line args (they now go
  over stdin) because *"other processes can't read them by scanning the process
  list."* These are real fixes for real advisories — the project has been
  responsive.
- But the architecture is inherently: **a local HTTP server** that the webview
  talks to. `server.mount(path, target)` (added 5.6.0) exists precisely because
  Neutralino *"doesn't support the `file://` protocol … due to application
  security concerns"*. So the security model is a **mounted-directory allow-list
  on a local HTTP server**. That's more surface than a scoped asset protocol.
- `nativeAllowList` is a coarse glob list (`"filesystem.*"`), **not** granular
  per-command permissions with path scopes like Tauri.

**4. Ecosystem is minimal.** No plugins. Every capability is built in, and the
built-in list is small: `app`, `window`, `filesystem`, `os`, `computer`,
`storage`, `debug`, `clipboard`, `resources`, `server`, `custom`, `net`, `events`.
No notifications beyond `os.showNotification`, no global shortcuts, no
auto-updater beyond a simple one, no updater signing.

**5. Mobile: none.** (Neutralinojs participates in GSoC and lists "Web" as a
mode, but that is a browser tab, not a phone app.)

**6. Desktop polish is partial.** From the release notes, several features are
explicitly unimplemented or degraded:

| Feature | Status |
|---------|--------|
| Native window **menu key accelerators on Linux/Windows** | ❌ **"the framework only displays the keyboard shortcut within the particular menu item and doesn't register a key accelerator yet"** (6.1.0). Planned, not shipped |
| Native menus on macOS/Linux/Windows | ✅ `window.setMainMenu` (6.1.0), works |
| System tray | ✅ `os.setTray`, with bugs fixed through 6.9.0 |
| `target="_blank"` handling | ✅ New window policy (6.8.0): `system` / `browser` / `custom` |
| File drag-and-drop with real paths | ✅ (6.8.0) via `emitDropEvents` |
| `window.print()` | ✅ (6.2.0) — explicitly added because the macOS webview lacks it |
| Wayland input simulation | ❌ `computer.sendKey` etc. throw on Wayland (6.7.0) |
| Multi-window | ✅ |
| Auto-updater | ⚠️ "simple portable auto-updater" — no signing docs |
| ARM Linux | ✅ armhf/arm64 since 4.6.0 |
| ARM macOS | ✅ arm64 + universal since 4.10.0 |

### Size

The best public data point is a third-party tutorial measuring a Windows build at
**~2.5 MB** and macOS at ~2 MB. **Label: unsourced third-party measurement of
their sample app, not our app.** The C++ framework binary itself is in the same
range. Among the smallest options surveyed.

### Verdict

**Not credible for us.** Tiny and interesting, but: no mobile, no granular
security model, a coarse `nativeAllowList`, a local-HTTP-server security posture
that is a step backwards from Tauri/Wails for an app that renders untrusted
files, a thin API surface requiring us to implement global shortcuts / tray
menu accelerators / updater ourselves, and a small single-org team. It is a
delightful weekend project and a poor foundation for a product we intend to
maintain.

---

## 3. NW.js

> **Version: `0.117.0`** (26 Sep 2026). Source: [npm `nw`](https://registry.npmjs.org/nw)

**NW.js is Chromium + Node.js in the *same* process**, with direct access to
Node from the DOM. `package.json` has a `main` entry that runs in a Node
context, and `window.require` is available to the page.

```json
{
  "name": "siyana-markdown-viewer",
  "main": "index.html",
  "node-main": "main.js",
  "chromium-args": "--enable-features=UseOzonePlatform",
  "window": {
    "title": "Siyana Markdown Viewer",
    "width": 1200, "height": 800,
    "frame": true
  }
}
```

**Why it is not credible for a Markdown viewer:**

1. **Node is in the renderer by design.** `node-main` and `window.require` mean
   the page that renders untrusted Markdown has Node access. This inverts
   Electron's entire security model. **The official security guidance for
   Markdown rendering does not exist because the architecture makes it
   impossible to isolate.**
2. **Same bundle cost as Electron** (~150 MB class) with none of Electron's
   process isolation, `contextIsolation`, sandbox, or 20-item checklist.
3. **Far smaller ecosystem.** A fraction of Electron's plugins and far less
   documentation.
4. **Linux support is decent** (same Chromium runtime, so same distro coverage)
   — this is genuinely its best feature, along with being the most "web-native"
   of the Chromium options.
5. **No auto-updater** comparable to Squirrel.

**Verdict: architecturally disqualified for our threat model.** Electron
dominates it on every axis except "less ceremony". Its niche is thin legacy apps
written as web pages that needed Node bolted on.

---

## 4. Ultralight

**Commercial, proprietary. Not open source. Disqualified for this project
outright**, and I will not spend research budget on it beyond saying so.

For completeness: it is a lightweight HTML/CSS/JS engine with its own minimal
DOM, aimed at embedded and GPU-less environments. Historically it has been GPU
acceleration-light, which makes it a poor fit for a scrolling reader, and it has
no packaging or updater story. It is also not something we could fork or patch.

---

## 5. Sciter

**Commercial** (Sciter SDK / Sciter Studio, with a free tier for small
apps — but a proprietary licence with revenue thresholds). **Disqualified for an
open-source project.**

For completeness: a full HTML/CSS/JS engine with its own DOM, purpose-built for
desktop UI rather than web compatibility. Its real strengths are small footprint,
fast startup, and native-feeling widgets. Its real weaknesses are a
**non-standard, incomplete CSS dialect** (you write their CSS, not browser CSS),
a small commercial-vendor ecosystem, and no web/mobile story. Writing a
Markdown viewer against Sciter's CSS means the CSS is not reusable anywhere
else — including in our own web build.

---

## 6. Summary table — the smaller options

| | **Wails v2** | **Neutralino** | **NW.js** | **Ultralight** | **Sciter** |
|---|---|---|---|---|---|
| Version today | `2.16.0` (14 Sep 2026) | `6.9.0` | `0.117.0` (26 Sep 2026) | Commercial | Commercial |
| Licence | MIT | MIT | MIT | **Proprietary** | **Proprietary** |
| Backend language | Go | C++ (extensions in any) | Node.js | C++/JS | C/C++/JS |
| Webview | System (WebView2/WKWebView/WebKitGTK) | System | **Bundled Chromium** | Own engine | Own engine |
| Webview 4.0 *and* 4.1 on Linux | ✅ build tag | ✅ dynamic | n/a | n/a | n/a |
| Approx. size (published) | ~10–20 MB *(unsourced)* | **~2–5 MB** *(3rd-party, unsourced)* | ~150 MB class | small | small |
| Deny-by-default security | ❌ explicit binds | ⚠️ coarse `nativeAllowList` | ❌ Node in renderer | ⚠️ own model | ⚠️ own model |
| Granular path scopes | ❌ | ⚠️ server mounts | ❌ | ? | ? |
| Signed auto-updater | ❌ build it | ⚠️ simple, unsigned | ❌ build it | ❌ | ❌ |
| Plugin ecosystem | Thin | **None** | Thin | None | None |
| Global shortcuts | Manual | ❌ | Manual | ❌ | Manual |
| Native menu accelerators (Win/Linux) | Manual | ❌ **not implemented** | Manual | ❌ | ✅ |
| Wayland | ⚠️ | ⚠️ input sim throws | ⚠️ (Chromium) | ? | ? |
| **Mobile** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Linux distro coverage | Good (both ABIs) | Medium (whatever's installed) | **Good** (Chromium) | ? | ? |
| Debugging | Good | Good | Good | ? | ? |
| Learning curve | **Low** | Low | Low | Medium | Medium |
| Community size | Small | Small | Small | n/a | n/a |
| Mobile-capable | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Credible for Siyana?** | **As a desktop shell in a hybrid topology. Not as the single stack.** | No | No (arch. disqualified) | No (licence) | No (licence) |

---

## 7. The honest ranking of this tier

1. **Wails v2** — a real framework, worth keeping on the shelf. Not our stack
   (no mobile, no updater) but the **best desktop shell for a hybrid topology**
   after Electron and Tauri, because it costs almost nothing to learn.
2. **Neutralino** — genuinely tiny and pleasant, but too thin, too coarse, and
   no mobile.
3. **NW.js** — architecturally wrong for us. Node in the renderer is fatal for a
   viewer of untrusted Markdown.
4. **Ultralight / Sciter** — **disqualified on licence.** An open-source project
   cannot build on either.

**The meta-observation about this tier:** *not one of these options has a
credible mobile story.* Every single framework in this document that lacks a
serious mobile target is disqualified from being our single stack, no matter how
good it is on desktop. Only **Tauri**, **Electron** (via Capacitor), and
**Flutter** clear that bar. That is not a coincidence — it is the strongest
argument in this entire folder for taking the
[hybrid architecture](07-hybrid-architectures.md) question seriously rather than
treating "choose one framework" as the only option.
