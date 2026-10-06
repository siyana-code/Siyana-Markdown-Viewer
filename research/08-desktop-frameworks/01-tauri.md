# 01 — Tauri v2

> **Status: 6 October 2026.** Stable `tauri` **2.12.0** (26 Sep 2026); `tauri`
> crate and `tauri-cli` at **2.12.1** (30 Sep–1 Oct 2026). Prerelease
> `3.0.0-alpha.4` published to crates.io.
>
> Sources: [crates.io API for tauri](https://crates.io/api/v1/crates/tauri) ·
> [tauri-cli Cargo.toml on `dev`](https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/Cargo.toml) ·
> [v2.tauri.app release notes](https://v2.tauri.app/release/tauri/) ·
> [@tauri-apps/cli on npm](https://registry.npmjs.org/@tauri-apps/cli)

---

## 1. What Tauri actually is

Tauri is not an Electron alternative in the "same model, smaller binary" sense.
It is a **different architecture** that happens to produce a smaller binary.

An Electron app **ships a browser**. A Tauri app **borrows the one already on the
user's machine**:

| Platform | What renders your HTML | Who ships the engine |
|----------|------------------------|---------------------|
| Windows | **Microsoft Edge WebView2** (`webview2-com` 0.39) | Windows (pre-installed since Win10 1803) |
| Linux | **WebKitGTK 4.1** (`webkit2gtk` 2.0.2 → libsoup3) | The distro |
| macOS | **WKWebView** | macOS |
| Android / iOS | System WebView / WKWebView | The OS |

Everything else — the window, the event loop, the tray, the menus, the HTTP
client, the updater — is Rust compiled into your binary.

From the [architecture docs](https://v2.tauri.app/concept/architecture/), the
crate stack is:

```text
tauri                       ← the facade; owns IPC, ACL, config, asset embedding
├── tauri-runtime           ← abstract window/event-loop interface
│   └── tauri-runtime-wry   ← the real implementation
├── tauri-macros            ← #[tauri::command], #[cfg_attr(mobile, ...)]
├── tauri-utils             ← config parsing, CSP injection, platform triples
├── tauri-build             ← build.rs codegen + JSON schema generation
├── tauri-codegen           ← embeds & compresses assets + icons at compile time
└── tauri-plugin            ← the plugin trait everything official is built on
```text

Two **upstream** crates are maintained by the Tauri org and are useful
standalone:

- **[TAO](https://github.com/tauri-apps/tao)** `0.37.1` — windowing. A
  `winit` fork extended with menus, tray, and mobile support.
- **[WRY](https://github.com/tauri-apps/wry)** `0.57.0` — the webview
  abstraction. Decides *which* system webview to use and how to talk to it.

The docs are explicit that Tauri is **not** a kernel wrapper and **not** a VM:
"Tauri is not a lightweight kernel wrapper. Instead, it directly uses WRY and
TAO to do the heavy lifting." ([source](https://v2.tauri.app/concept/architecture/))

### Licensing

MIT **or** Apache-2.0, at your option. That is about as permissive as a
framework gets and it is the right licence for an open-source project. Tauri's
own docs note you are responsible for verifying upstream licences if you
repackage and modify source ([source](https://v2.tauri.app/concept/architecture/#license)).

---

## 2. Release cadence

The 2.x line has been steady. From the
[release table](https://v2.tauri.app/release/tauri/):

| Version | Date | Notes |
|---------|------|-------|
| 2.12.0 | 26 Sep 2026 | `limitNavigationsToAppBoundDomains`, `appDirectoriesOverride`, wry permission handler API, MSRV 1.90, **drops Windows 7** |
| 2.11.5 | 1 Jul 2026 | dep pin only |
| 2.11.4 | 30 Jun 2026 | `time` pin |
| 2.11.3 | 17 Jun 2026 | drag-region, `Scope::once` deadlock, `Listener::once` re-entrancy |
| 2.11.2 | 16 May 2026 | Windows menu fix |
| 2.11.1 | 6 May 2026 | **2 security fixes**: ACL enforcement for remote origins even with no `AppManifest`; `.localhost` suffix confusion on Windows/Android |
| 2.11.0 | 30 Apr 2026 | multiple windows on Android/iOS, `dbus` feature for Linux theme detection |
| 2.10.0 | 2 Feb 2026 | `webkit2gtk-rs` 2.0.2, wry 0.54 |
| 2.9.5 | 9 Dec 2025 | |

**Reading of the cadence:** roughly one minor (feature) release per quarter
with patch releases in between. That is a **fraction** of Electron's pace. It
also means we will not be forced into a major upgrade annually, which is a real
cost saving. But it is a double-edged sword: **the security-fix latency is
Tauri's, not Chromium's.** When a WebView2 or WebKitGTK CVE lands, there is no
"bump a major and be done" button — we wait for Tauri's next patch.

**Important v2.12.0 security fix** (GHSA-w28w-mhc8-qvjv): channel data IPC
queue entries were not bound to their originating webview, so queued channel
payloads and large `invoke` responses could be read by *other* webviews. Fixed
in 2.12.0. If you are on 2.11.x, upgrade — this is directly relevant to a
multi-window viewer.

### MSRV and the upcoming 3.0

MSRV is pinned at **Rust 1.90** (`1cffb01da`, #13221). The CLI is already on
**edition 2024** (`2e6e33c85`, #16029). `3.0.0-alpha.4` is on crates.io now
with all crates published in lockstep (`tauri`, `tauri-runtime`, `tauri-utils`,
`tauri-plugin`, `tauri-macros`, `tauri-codegen`).

`createUpdaterArtifacts` is documented as **"will be removed in v3"**, so v3
will carry at least one breaking config change. Plan for a migration budget.

---

## 3. The capability & permission model

This is Tauri's most important architectural contribution and the direct
replacement for v1's flat `allowlist`.

### The three-layer model

```text
Permission   →  "this operation is allowed, under these conditions"
   ↓
Capability   →  "these permissions apply to these windows/webviews, on these platforms"
   ↓
Command      →  "this is the actual #[tauri::command] function"
```

A **permission** is a TOML description of explicit privilege
([docs](https://v2.tauri.app/security/permissions/)):

```toml
# src-tauri/permissions/home-read-extends.toml
[[set]]
identifier = "allow-home-read-extended"
description = """
  Allows non-recursive read access to files and creating directories
  in the $HOME folder.
"""
permissions = [
  "fs:read-files",
  "fs:scope-home",
  "fs:allow-mkdir",
]
```text

An official plugin ships granular, individually-grantable permissions. From
the File System plugin's generated `read-files.toml`:

```toml
[[permission]]
identifier = "read-files"
description = """
  This enables all file read related commands without any pre-configured
  accessible paths.
"""
commands.allow = [
  "read_file", "read", "open",
  "read_text_file", "read_text_file_lines", "read_text_file_lines_next"
]
```text

Identifier namespacing is enforced at compile time — `<plugin>:default`,
`<plugin>:<command-name>`, max length 116 chars because of how the Rust
`package` field length limits propagate.

### Capabilities wire it to windows

```jsonc
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:path:default",
    "core:event:default",
    "core:window:default",
    "core:app:default",
    "core:resources:default",
    "core:menu:default",
    "core:tray:default",
    "core:window:allow-set-title"
  ]
}
```text

Capabilities are **platform-scoped**, which matters for a multi-platform app:

```jsonc
// src-tauri/capabilities/desktop.json
{
  "identifier": "desktop-capability",
  "windows": ["main"],
  "platforms": ["linux", "macOS", "windows"],
  "permissions": ["global-shortcut:allow-register"]
}
```

They can also be scoped to **remote URLs**, though the docs warn: *"On Linux
and Android, Tauri is unable to distinguish between requests from an embedded
`<iframe>` and the window itself. Please consider usage of this feature very
carefully."* For a viewer that opens local files, **we should never use
`remote` capabilities at all** — a capability with no `remote` key means remote
origins get nothing.

### What it does and does not protect against

Quoting the [capabilities doc](https://v2.tauri.app/security/capabilities/)'s
own honest list:

*Protects against:* frontend compromise impact, accidental exposure of local
system interfaces, privilege escalation from frontend to backend.

*Does **not** protect against:* malicious Rust code, lax scopes, incorrect
scope checks in your own commands, intentional bypasses from Rust,
**0-days or unpatched 1-days in the system WebView**, supply-chain compromise.

That last bullet is the crux for us: **Tauri's security ceiling is the security
of whatever WebKitGTK version the user's distro ships.** On a rolling-release
distro that is fine; on a stale LTS it is a liability we do not control. This
is a genuine, structural difference from Electron, and no amount of capability
configuration changes it.

### A real bug in the ACL worth knowing about

2.12.0 fixed a scenario where **any** deny permission in any capability denied
the command **for every origin**, because the origin-match result was
discarded. So a capability denying a command for a remote URL also denied it
locally ([`0349b6fb8`, #16072](https://v2.tauri.app/release/tauri/)). This is
exactly the class of bug that a capability system *introduces* and that a flat
allowlist cannot have. Worth knowing when you read bug reports.

---

## 4. IPC

Tauri uses **asynchronous message passing** — the docs call it out explicitly
([source](https://v2.tauri.app/concept/inter-process-communication/)):

> "Message passing is a safer technique than shared memory or direct function
> access because the recipient is free to reject or discard requests as it sees
> fit. For example, if the Tauri Core process determines a request is malicious,
> it simply discards the requests and never executes the corresponding function."

### Commands — request/response via `invoke`

JSON-RPC-like under the hood, so **everything must be JSON-serialisable**.

```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn parse_document(path: String, window: tauri::WebviewWindow) -> Result<DocMeta, String> {
    let meta = parse(&path).map_err(|e| e.to_string())?;
    let _ = window.set_title(&format!("{} — Siyana", meta.title));
    Ok(meta)
}
```text

```ts
import { invoke } from '@tauri-apps/api/core';
const meta = await invoke<DocMeta>('parse_document', { path: '/home/u/notes/a.md' });
```text

As of 2.11.0 you can `#[tauri::command(rename = "...")]` to decouple the Rust
function name from the IPC command name (#14473) — small but useful for keeping
the wire API stable across refactors.

### Events — fire-and-forget, both directions

Events are **not typed** and **always JSON strings**. The docs are candid:

> "The event system is not designed for low latency or high throughput
> situations."
>
> "events have no strong type support, event payloads are always JSON strings
> making them not suitable for bigger messages and **there is no support of the
> capabilities system to fine grain control event data and channels**."

That last clause matters: **events bypass the capability system.** They are
still useful for lifecycle and small state changes, but they are not a security
boundary.

```rust
use tauri::{AppHandle, Emitter, EventTarget};

#[tauri::command]
fn open_file(app: AppHandle, path: std::path::PathBuf) {
    // Multi-consumer: send only to specific window labels
    app.emit_filter("open-file", path, |target| match target {
        EventTarget::WebviewWindow { label } => label == "main" || label == "preview",
        _ => false,
    }).unwrap();
}
```text

### Channels — `Channel<T>` for streaming

Channels are the answer to "I need to stream a lot of typed data". They are
used internally by the updater (download progress), child processes, and
WebSockets.

```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase",
          tag = "event", content = "data")]
enum ParseEvent {
    Started { total_bytes: usize },
    Progress { bytes_done: usize },
    Block { index: usize, html: String },   // streaming rendered blocks
    Finished,
}

#[tauri::command]
fn parse_streaming(path: String, on_event: Channel<ParseEvent>) {
    on_event.send(ParseEvent::Started { total_bytes: 0 }).unwrap();
    for (i, block) in blocks.iter().enumerate() {
        on_event.send(ParseEvent::Block { index: i, html: block.html.clone() }).unwrap();
    }
    on_event.send(ParseEvent::Finished).unwrap();
}
```

```ts
import { invoke, Channel } from '@tauri-apps/api/core';

const onEvent = new Channel<ParseEvent>();
onEvent.onmessage = (m) => { /* m.event === 'started' | 'progress' | ... */ };
await invoke('parse_streaming', { path, onEvent });
```text

**For a Markdown viewer this is the single most useful Tauri feature.** Rendering
a 100 MB file means streaming block-by-block from Rust into the DOM. `Channel<T>`
gives ordered, typed, back-pressured delivery where `Event` gives you an
unordered JSON-string firehose. 2.12.0 also fixed channel payloads being queued
forever after the target webview closed (#15821) — so streaming is now safe when
windows close.

### IPC isolation patterns

Tauri v2 documents two patterns for defence-in-depth on a viewer that parses
untrusted files ([Brownfield](https://v2.tauri.app/concept/inter-process-communication/brownfield/),
[Isolation](https://v2.tauri.app/concept/inter-process-communication/isolation/)):

- **Brownfield** — the frontend is trusted, the network is not. Run untrusted
  parsing in a separate `Webview`/child and message it in.
- **Isolation** — the frontend is not trusted. The Rust core renders to a
  sandboxed webview with a minimal capability set.

For Siyana: we are rendering *user-supplied Markdown* but running *our own
bundled JS*. That is brownfield-ish, but the rendered HTML is untrusted. The
real isolation boundary we need is **sanitisation before the HTML ever reaches
a webview**, which is a [05 rendering](../05-rendering/) problem, not a shell
problem. See [11 security](../11-security/).

---

## 5. Plugin ecosystem

Official plugins in the [plugins-workspace](https://github.com/tauri-apps/plugins-workspace/tree/v2),
with versions from the
[ecosystem release index](https://v2.tauri.app/release) (fetched 6 Oct 2026):

| Plugin | Crate/npm version | Role for a Markdown viewer |
|--------|------------------|---------------------------|
| **fs** | 2.5.2 (31 Aug 2026) | Read/write `.md` files, with **path scopes** |
| **dialog** | 2.7.3 (31 Aug 2026) | Native open/save folder pickers — essential |
| **opener** | — | Open URLs/paths in the OS default handler. Replaces `shell.openExternal` |
| **shell** | — | Open paths, run sidecars. **Higher privilege — scope tightly** |
| **updater** | — | Signed self-update. See §7 |
| **notification** | — | "Update available", background-reindex done |
| **global-shortcut** | 2.3.2 (28 May 2026) | `Ctrl+Shift+S` from anywhere |
| **single-instance** | — | Second launch opens the file — essential for a file viewer |
| **window-state** | — | Persist size/position/maximised |
| **deep-link** | — | `siyana://open?path=...` from browser and other apps |
| **clipboard-manager** | — | Copy/paste rich content and image files |
| **http** | 2.7.0 (20 Sep 2026) | Theme sync, link checking (opt-in, CORS-free) |
| **process** | — | `relaunch()` after update; spawn sidecars |
| **store** | — | Small JSON settings persistence |
| **sql** | — | SQLite via `sqlx` for a large-document cache / index |
| **stronghold** | — | Encrypted secrets storage |
| **log** | — | Structured logging → file |
| **os** | — | Locale, platform detection |
| **persist** (scoped) | — | Persist fs/asset scope across restarts |
| **localhost** | — | Serve a local HTTP server (useful for a web build) |
| **websocket** | — | Live reload in dev |
| **cli** | — | CLI argument parsing — we want this for `siyana file.md` |
| **autostart** | — | Launch on login (weak feature, still in plugin list) |

**Assessment.** The plugins we actually need for a Markdown *viewer* (fs,
dialog, opener, single-instance, window-state, updater, global-shortcut,
deep-link, clipboard, os, process, log) are **all officially maintained**, all
have granular permissions, and all are first-party. That is an unusually strong
position compared with Electron, where you would be assembling a dozen
`electron-builder`-era community packages.

**But**: the plugin set is *small*. There is no `tauri-plugin-print`
equivalent for the `window.print()` → PDF flow we want, no rich-text/editing
plugin (irrelevant if we stay a viewer), and no PDF renderer. We would write
those ourselves or fall back to OS-level printing via the shell plugin.

**Windows-only note:** the `cli` plugin lets us parse `siyana-markdown-viewer
C:\notes\a.md` arguments. Combined with `single-instance` and `deep-link`, the
"open with / file association" story is fully covered.

---

## 6. Asset protocol — serving local files to the webview

A viewer has a specific, unusual need: **images referenced by a Markdown file
live next to it on disk, outside our bundle.** Tauri has a purpose-built answer.

Enable it and scope it (`app.security.assetProtocol`):

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "allow": [
            "$HOME/Documents/notes/**/*",
            "$HOME/Dropbox/**/*"
          ],
          "deny": [
            "$HOME/Documents/notes/.git/**",
            "$HOME/Documents/notes/**/.env"
          ]
        }
      }
    }
  }
}
```text

Then convert a path in the frontend:

```ts
import { convertFileSrc } from '@tauri-apps/api/core';
// /home/u/Documents/notes/img/a.png
// -> asset://localhost/%2Fhome%2Fu%2F...%2Fa.png  (or https:// if useHttpsScheme)
img.src = convertFileSrc(absPath);
```text

**Four sharp edges** the docs are unusually honest about
([asset-protocol docs](https://v2.tauri.app/security/asset-protocol/), last
updated 21 Sep 2026 — clearly written from support pain):

1. **`requireLiteralLeadingDot` defaults to `true` on Unix.** Wildcards do
   **not** match dot-prefixed path components. So `$HOME/**` allows
   `~/Documents/file.png` but **not** `~/.cache/myapp/preview.png`. This is a
   security feature and it will bite us the first time a user opens a note in a
   dot-directory. Workaround: name the segment literally
   (`$HOME/.cache/myapp/**`) or set `requireLiteralLeadingDot: false` with eyes
   open. Tracked upstream in [tauri#13788](https://github.com/tauri-apps/tauri/issues/13788).

2. **Absolute paths need absolute-looking patterns.** `["*/**"]` never matches
   on Linux because resolved paths start with `/`. Use `$HOME/**/*`,
   `/home/user/**/*`, or base-dir variables (`$APPCACHE`, `$RESOURCE`,
   `$APPDATA`).

3. **Static config ≠ runtime picks.** When the user chooses a folder in the
   dialog, that scope does **not** persist across restarts unless we use the
   **persisted-scope** plugin with the `protocol-asset` Cargo feature, and
   register `tauri_plugin_fs` **before** `tauri_plugin_persisted_scope`.

4. **Prefer `**/*` over bare `**`** for file globs. Bare `**` does not mean
   "recursively all files" in practice and causes confusion.

2.12.0 also fixed two asset-protocol bugs worth knowing: malformed
`asset://` multi-range responses (#15838) and, importantly, **assets are now
loaded asynchronously off the event loop** so "a slow or unreachable path no
longer freezes every window" (#16050). For a viewer opening a Markdown file on a
network drive, that fix is directly valuable.

**Verdict for us: the asset protocol is the right tool and it is a genuine
Tauri advantage.** Electron's equivalent (`file://` plus a custom protocol) is
considerably rougher and its own docs tell you to avoid `file://` because "pages
running on `file://` have unilateral access to every file on your machine"
(security checklist item 18). Tauri gives us **scoped, deny-capable, glob-based
local file access** out of the box. That is precisely the capability a Markdown
viewer needs and precisely the thing that is dangerous if left open.

---

## 7. The updater, and update signatures

From the [updater docs](https://v2.tauri.app/plugin/updater/).

**Signature enforcement is mandatory and cannot be disabled:**

> "Tauri's updater needs a signature to verify that the update is from a
> trusted source. **This cannot be disabled.**"

This is a **stronger** default than Electron's, where `autoUpdater` will happily
install from an unsigned feed (Electron docs recommend Squirrel's
`autoUpdater` and Windows code-signing is a separate requirement, not a
signature check on the update metadata).

### Key material and lifecycle

Two keys from `tauri signer generate`:

- **public key** → embedded in `tauri.conf.json` (`plugins.updater.pubkey`).
  Shareable.
- **private key** → `TAURI_SIGNING_PRIVATE_KEY` env var at build time. `.env`
  files **do not work**.

The docs state the failure mode plainly: *"if you lose this key you will NOT be
able to publish new updates to the users that have the app already installed."*
That is a real operational risk we must manage with offline backups. The signer
uses **minisign** — and the CLI Cargo.toml carries an explicit warning comment
in the dependency list: *"Careful with updating minisign, often broke our updater
signatures"* with a link to [PR #15022](https://github.com/tauri-apps/tauri/pull/15022).
Useful honesty from the maintainers; also a small supply-chain risk.

### Artifacts produced

```jsonc
{ "bundle": { "createUpdaterArtifacts": true } }
```

| Platform | Update artifact | Signature |
|----------|-----------------|-----------|
| Linux | `myapp.AppImage` | `myapp.AppImage.sig` |
| macOS | `myapp.app.tar.gz` | `myapp.app.tar.gz.sig` |
| Windows | `myapp-setup.exe` (NSIS), `myapp.msi` | `.sig` each |

`"v1Compatible"` exists for migrating from Tauri v1 and **will be removed in v3**.

### Static JSON vs dynamic server

Static JSON (works on GitHub Releases / S3 / a gist; `tauri-action` generates it):

```json
{
  "version": "1.4.0",
  "notes": "Fixes TOC scroll anchoring.",
  "pub_date": "2026-10-06T00:00:00Z",
  "platforms": {
    "linux-x86_64":    { "signature": "<contents of the .sig file>", "url": "https://…" },
    "windows-x86_64":  { "signature": "…", "url": "https://…" },
    "darwin-aarch64":  { "signature": "…", "url": "https://…" }
  }
}
```text

Keys are `OS-ARCH` where OS ∈ {`linux`, `darwin`, `windows`} and ARCH ∈ {`x86_64`,
`aarch64`, `i686`, `armv7`}. `signature` must be the **contents** of the `.sig`
file — *"A path or URL does not work!"*

Endpoints support server-side templating:
`https://releases.siyana.app/{{target}}/{{arch}}/{{current_version}}`.

Dynamic server returns `204 No Content` for "no update", or `200` with
`{version, pub_date, url, signature, notes}`.

### Windows install mode

```jsonc
{ "plugins": { "updater": { "windows": { "installMode": "passive" } } } }
```text

| Mode | Behaviour |
|------|-----------|
| `passive` | Progress bar, no interaction. **Default, recommended.** |
| `basicUi` | Interactive UI |
| `quiet` | Silent. Cannot request admin; only works for user-wide installs |

**A hard Windows limitation:** *"On Windows the application is automatically
exited when the install step is executed due to a limitation of Windows
installers."* There is an `on_before_exit` hook (2.10+) to save state first, but
users will see the app quit and reopen. We must design autosave around this.

Runtime configuration is available from Rust for channels and key rotation
(`endpoints`, `pubkey`, `version_comparator` for downgrades/rollbacks,
`on_before_exit`). Note the `format!` double-brace escaping quirk:
`format!("https://{channel}.myserver.com/{{{{target}}}}-{{{{arch}}}}")`.

---

## 8. Bundle formats per platform

From the [distribute docs](https://v2.tauri.app/distribute/):

| Platform | Formats | Notes |
|----------|---------|-------|
| **Windows** | `msi`, `nsis` | MSI via WiX. **MSI builds need the Windows `VBSCRIPT` optional feature enabled** — enabled by default but *deprecated by Microsoft*; `failed to run light.exe` is the symptom |
| **Linux** | `deb`, `rpm`, `AppImage`, `snap`, Flatpak (Flathub), AUR | Richest of any candidate here |
| **macOS** | `.app`, `.dmg`, Mac App Store | Direct distribution requires **signing + notarisation**; both required for App Store |
| **Android** | APK / AAB → Google Play | |
| **iOS** | IPA → App Store | Requires macOS + Xcode |

Splitting build from bundle:

```bash
npm run tauri build -- --no-bundle        # just compile
npm run tauri bundle -- --bundles app,dmg # bundle outside the App Store
npm run tauri bundle -- --bundles app --config src-tauri/tauri.appstore.conf.json
```text

Windows VC runtime: 2.12.0 added `bundle.windows.bundleVCRuntime` to copy the
VC++ redistributable DLLs into MSI/NSIS installers, locating them via
`VCTOOLS_REDIST_DIR` or `vswhere.exe`. Also new: the bundler **now prints the
size of each generated bundle** next to its path. That is convenient for our CI
size-regression checks.

### A starter `tauri.conf.json` for Siyana

This is the shape we should be building toward, annotated. It doubles as our
template.

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Siyana Markdown Viewer",
  "version": "0.1.0",
  "identifier": "app.siyana.markdown-viewer",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist",
    // Strips commands never granted in any capability file -> smaller binary
    "removeUnusedCommands": true
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Siyana Markdown Viewer",
        "width": 1200, "height": 800, "minWidth": 640, "minHeight": 400,
        "dragDropEnabled": true,
        "visible": false            // show after first paint to avoid white flash
      }
    ],
    "security": {
      // Rendered Markdown must not be able to execute anything.
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",   // we inject reader styles
        "img-src": "'self' asset: https://asset.localhost data: blob:",
        "font-src": "'self' data:",
        // No frame-src, no object-src, no connect-src => none. Deliberate.
        "connect-src": "'self' ipc: http://ipc.localhost"
      },
      "assetProtocol": {
        "enable": true,
        "scope": {
          "allow": ["$HOME/**/*", "$APPDATA/**/*"],
          "deny": [
            "$HOME/**/.ssh/**",
            "$HOME/**/.gnupg/**",
            "$HOME/**/.aws/**",
            "$HOME/**/.config/**"
          ]
        }
      },
      "freezePrototype": true,
      "dangerousDisableAssetCspModification": false
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "deb", "rpm", "appimage", "dmg", "app"],
    "createUpdaterArtifacts": true,
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "category": "Productivity",
    "shortDescription": "Read and organise Markdown",
    "longDescription": "A fast, offline-first Markdown viewer.",
    "windows": {
      "webviewInstallMode": { "type": "downloadBootstrapper" },
      "allowDowngrades": false,
      "nsis": { "installMode": "perMachine" }
    },
    "linux": {
      "deb": { "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"] },
      "rpm": { "depends": ["webkit2gtk4.1", "gtk3"] },
      "appimage": { "bundleMediaFramework": false }
    },
    "macOS": { "minimumSystemVersion": "10.15" }
  },
  "plugins": {
    "updater": {
      "pubkey": "CONTENT FROM PUBLICKEY.PEM",
      "endpoints": [
        "https://releases.siyana.app/{{target}}/{{arch}}/{{current_version}}"
      ],
      "windows": { "installMode": "passive" }
    }
  }
}
```

And the Cargo profile for a small binary, straight from the
[App Size docs](https://v2.tauri.app/concept/size/):

```toml
# src-tauri/Cargo.toml
[profile.release]
codegen-units = 1   # better LLVM optimisation
lto = true
opt-level = "s"     # prioritise size; use "3" for speed
panic = "abort"     # no unwinding tables
strip = true
```text

For a **viewer**, `opt-level = "s"` is likely wrong — we want parsing and
layout fast. Use `opt-level = 3` with `lto = "thin"` and measure. **This is an
inference to verify, not a documented recommendation.**

---

## 9. Linux system requirements — the known pain point

This is where Tauri earns its reputation, so we verified it carefully.

### The build-time dependency set

From the [prerequisites page](https://v2.tauri.app/start/prerequisites/) (last
updated 20 Aug 2026), Debian/Ubuntu:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl wget file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```yaml

Arch: `webkit2gtk-4.1 webkit2gtk-4.1-soup2 ... libappindicator-gtk3 librsvg`
Fedora: `webkit2gtk4.1-devel ... libappindicator-gtk3-devel librsvg2-devel`
openSUSE: `webkit2gtk-4_1-soup2-devel ... libayatana-appindicator3-devel librsvg2-devel`
Gentoo: `net-libs/webkit-gtk:4.1 dev-libs/libappindicator`
NixOS: multiple outputs of `webkitgtk_4_1` / `webkitgtk_4_1-soup2`
Alpine: `webkit2gtk-4.1-dev build-base ... libayatana-appindicator-dev librsvg-dev`

### The version story: WebKitGTK 4.1 is mandatory and it is a real gate

Tauri v2 **requires `libwebkit2gtk-4.1-dev`**. Not 4.0. This was a breaking
change from v1, announced in the
[2.0.0-alpha.3 blog post](https://v2.tauri.app/blog/tauri-2-0-0-alpha-3):
4.0 uses libsoup2, 4.1 uses libsoup3.

**Current distro availability** (this is the part that matters):

| Distro | webkit2gtk 4.1 available? | Source |
|--------|---------------------------|--------|
| **Ubuntu 22.04 LTS** | Yes — and Tauri names it a suitable build baseline | [Tauri AppImage docs](https://v2.tauri.app/distribute/appimage/) |
| **Debian 12 (bookworm)** | Yes — also named a baseline | same |
| **Ubuntu 24.04 LTS** | Yes (4.0 removed) | third-party analysis of distro removal timelines |
| **Fedora 40+** | Yes (`webkit2gtk4.1`); **4.0 removed in F40** | [Fedora change page](https://fedoraproject.org/wiki/Changes/Remove_webkit2gtk-4.0_API_Version) |
| **RHEL / CentOS / AlmaLinux / Rocky 8–9** | **`webkit2gtk3` only = ABI 4.0** | [Wails Linux distro table](https://wails.io/docs/guides/linux-distro-support) |
| **Debian 11 / Ubuntu 20.04** | **`libwebkit2gtk-4.0-37` only** | same |

**This is the single most important finding in this document.** As of Fedora's
removal of the 4.0 API, and Debian/Ubuntu having finished removal:

> "Debian and Ubuntu have finished the removal of webkit2gtk4.0."
> — [Fedora discussion](https://discussion.fedoraproject.org/t/what-is-the-status-of-the-webkit2gtk4-0-deprecation/88042)

**Conclusion: any actively-supported modern distro is fine. Enterprise LTS
derivatives (RHEL 8/9, and anything still on 4.0) are not.** A Tauri app will
not run there. If Siyana has users on RHEL-family enterprise Linux, this is a
hard blocker.

And one more from the AppImage docs, which is a genuine footgun:

> "Core libraries such as glibc frequently break compatibility with older
> systems. For this reason, you must build your Tauri application using the
> oldest base system you intend to support… Building on a newer base system can
> raise the minimum glibc version required by your app, so when running on an
> older system, you may face a runtime error like
> `/usr/lib/libc.so.6: version 'GLIBC_2.33' not found`. We recommend using a
> Docker container or GitHub Actions to build your Tauri application for Linux."

**CI rule for us: build Linux artefacts on `ubuntu-22.04` runners, never on
`ubuntu-latest`.** This is documented, explicit, and free to get wrong.

Other Linux notes:
- **The `dbus` feature** (default-on, added 2.11.0) is *required* for theme
  detection on Linux. Disabling it breaks dark/light mode sync.
- **AppImage size:** *"carefully use it as the file size grows from the 2–6 MB
  range to 70+ MB"* — that sentence is about bundling media frameworks, not
  baseline size, but it sets the expectation that AppImages are the heavy Linux
  format. `deb`/`rpm` will be much smaller.
- **ARM:** `linuxdeploy` cannot cross-compile ARM AppImages, so ARM AppImages
  need native or emulated builds (QEMU is "extremely slow"; GitHub's
  `ubuntu-22.04-arm` runners are free for public repos).
- **`$PATH` is not inherited** from shell dotfiles in GUI apps. Use the
  `fix-path-env-rs` crate if we ever shell out.

---

## 10. Memory footprint and startup time

**We are going to be honest here rather than invent numbers.**

There is **no reproducible third-party benchmark** of Tauri vs Electron vs
Flutter for a Markdown-viewer-shaped workload that we could find. The commonly
circulated figures ("Tauri uses ~50% less RAM", "60 MB vs 150 MB") trace back to
vendor blogs and content-marketing comparison sites, none of which publish
methodology, workload, or machine specs. Labelling them as **widely repeated but
unsourced**.

What *is* sourced:

| Claim | Value | Source & confidence |
|-------|-------|---------------------|
| Minimal Tauri app binary | "can be less than 600KB in size" | [Tauri docs](https://v2.tauri.app/start/) — **vendor claim**, measured how? unstated |
| Typical Tauri AppImage baseline | 2–6 MB (before media frameworks) | [Tauri AppImage docs](https://v2.tauri.app/distribute/appimage/) — vendor, plausible |
| Tauri releases | hundreds of KB per release | inferred from size claim |

**Structural reasoning we can defend (inference, but well-grounded):**

Tauri does not ship a browser, so it does not pay to *load* one. Electron's
process model spawns at minimum: 1 main process (Node + V8 isolate), 1+ renderer
per window (a full Blink + V8 renderer process), plus GPU and utility
processes. That is several hundred MB of Chromium shared libraries mapped per
app instance. Tauri maps the WebView2/WKWebView shared libraries instead, which
are **already resident** because the user's browser or OS components use them —
so a second Tauri app's marginal RSS is far lower. That reasoning is sound, but
the *magnitude* is exactly what we lack numbers for.

### How to actually measure it

This protocol is our job in [10 performance](../10-performance/), recorded here
so we can execute it later:

**Size — deterministic, do it in CI:**
```bash
# Tauri: the CLI prints bundle sizes as of 2.12.0
npm run tauri build
# -> Finished N bundles at:
#    target/release/bundle/nsis/Siyana Markdown Viewer_0.1.0_x64-setup.exe (4.2 MB)
#    target/release/bundle/deb/siyana-markdown-viewer_0.1.0_amd64.deb (3.1 MB)
#    target/release/bundle/appimage/siyana-markdown-viewer_0.1.0_amd64.AppImage (9.8 MB)

# Electron: sum the asar + the extracted electron dist
npx electron-builder --linux dir      # unpacked, no installer
du -sh dist/linux-unpacked/            # honest baseline before compression
```text

**Memory — on a fixed test document, fixed machine:**
```bash
# Linux: RSS of every process in the tree, after the app is idle
#   with a 100 MB Markdown file open at 50% scroll
ps -o pid,rss,comm --ppid $(pgrep -f siyana | head -1) -p $(pgrep -f siyana | head -1)

# Windows
powershell "Get-Process siyana*,*WebView2* | Select-Object Name,@{n='WS_MB';e={[int](\$_.WorkingSet64/1MB)}},@{n='PM_MB';e={[int](\$_.PrivateMemorySize64/1MB)}}"

# macOS
vmmap $(pgrep -x siyana-markdown-viewer) | tail -1
```
Sum across the tree. Electron will show multiple processes; that sum is the
number that matters, not the main process alone. Report **private** memory
(commit) as well as working set — working set over-reports shared pages and
would flatter Tauri, which leans harder on shared system webview libraries.

**Startup — time to first paint of the document body, not to `did-finish-load`:**
Use a `performance.mark()` in the frontend at first paint and log a timestamp;
wall-clock from `Process.Start` to that log line. Do **not** rely on
`did-finish-load` — it fires before paint and before we have read and parsed
anything. Report p50 over 30 cold launches after a reboot-equivalent (page
cache dropped where possible), on the same machine, for each framework.

Report median and p95, not means. Startup is a heavy-tailed distribution.

---

## 11. The Rust learning curve — honest cost

**Tauri does not let you avoid Rust.** `#[tauri::command]` is a proc macro over a
Rust function; `Builder::default().invoke_handler()` is a Rust builder; state is
`tauri::State<T>`; plugins are Rust traits. There is no "HTML-only" Tauri mode.

What a competent web developer actually has to learn to be productive here:

| Concept | Difficulty | Can you avoid it? |
|---------|-----------|-------------------|
| Ownership & borrowing | **Hard** | No — it is the language |
| Lifetimes (esp. `&self` in commands) | Hard | Partially — many commands take owned `String`/`PathBuf` |
| `Result<T, E>` and error propagation | Easy | No |
| `async`/`await`, `tokio` runtime | Medium | If you keep commands synchronous, mostly |
| `serde` derive for JSON | Easy | No |
| Traits & generics | Medium | Mostly — you mostly consume traits |
| Cargo / features / MSRV / workspace | Medium | No |
| `unsafe` | **Not needed** | Yes — Tauri apps rarely need it |
| Proc macros (`#[tauri::command]`) | Easy once understood | No |
| Debugging lifetimes (`dyn`/`impl` errors) | Hard, recurring | Rarely avoidable |

**Realistic estimate (inference, not a citation):** ~3–6 weeks for a strong TS
developer to write comfortable Tauri code, with a long tail of occasional
`Send`/`Sync`/`'static` friction for the first couple of months. Borrow-checker
fights are common in anything touching the event loop or `AppHandle` across
threads. Design around that early: keep commands thin, put logic in
plain-old Rust functions that take and return owned values, and unit-test those
without any Tauri types.

**Mitigations that actually work:**
1. **Keep the Rust surface minimal.** For a viewer, Rust needs to do: file
   watching (`notify` 8.2.0), reading/encoding detection, parsing or at least
   the AST→HTML step, and native dialogs. That is maybe 1,500–3,000 lines of
   Rust, not a Rust codebase. Everything else can be TypeScript in the frontend.
2. **Put parsing in TS if you can.** See [07-hybrid-architectures.md](07-hybrid-architectures.md)
   option (d). If the parser is TypeScript, the Rust layer is a thin
   file-I/O-and-watch shim and the learning curve collapses.
3. **Rust is the *smaller* half.** For Electron, Node's event-loop pathologies
   and the main/renderer boundary are a bigger practical burden on a web team
   than Rust's compile-time constraints.

---

## 12. Build times

**Cold release build (unverified, must measure):** a Tauri release build
compiles the entire dependency tree — `tokio`, `reqwest`/`ureq`, `serde`,
`wry`, `webkit2gtk-rs`, the bundler, `oxc_parser` — plus LTO. On a modern
developer machine expect **several minutes**; on CI runners, more. The CLI
itself compiles separately (`cargo install tauri-cli`), which is a long one-time
cost.

For reference on dependency weight, `tauri` 2.12.0 pulls `tokio 1.53`,
`tracing`, `specta`, `serde_json`, `objc2-*` on Apple, `webkit2gtk 2.0.2` on
Linux, and `reqwest`/`ureq` for HTTP ([deps.rs listing](https://deps.rs/crate/tauri/2.12.0)).
docs.rs needed **5.01 GB** of RAM and 2m44s just to *document* the crate, which
is a decent proxy for compile weight.

**Mitigations:**
- `sccache` / `cargo-chef` in CI — large win, low cost.
- `tauri-action` builds all platforms in one GitHub Actions workflow.
- `opt-level = "s"` + `lto = true` make the *link* step slower; measure whether
  the size win is worth it for a viewer (probably not — see §8).
- `debug = true` + `split-debuginfo = "unpacked"` on Linux cuts debug-build
  link times dramatically. (Inference; verify.)

**Incremental dev loop:** Vite HMR for the frontend is fast and independent of
Rust. Rust changes require a rebuild of just the `siyana-markdown-viewer` crate
when dependencies are cached — typically seconds. The pain is the **first**
build and any change to `Cargo.lock`.

---

## 13. Debugging experience

This is where Tauri is genuinely weaker than Electron, and we should say so.

**Frontend debugging — good.** You get DevTools. Tauri's docs list
[CrabNebula Nebula](https://v2.tauri.app/develop/debug/#crabnebula-nebula) as
the recommended browser; Tauri's own devtools; VS Code, JetBrains and Neovim
setups; and a dedicated
["New Linux Graphics Issues"](https://v2.tauri.app/develop/debug/#new-linux-graphics-issues)
page — the existence of which tells you Linux GPU problems are common and
underdocumented.

**There is no Rust+frontend integrated debugger.** No equivalent to VS Code's
"attach to renderer and main simultaneously with a single breakpoint model".
Rust debugging goes through `rust-gdb`/`lldb` (or VS Code CodeLLDB with
`tauri-vscode`), and the webview debugging is a separate DevTools instance.
Getting a breakpoint to fire in the right process while also watching the
frontend requires setup that is fiddly and, in our experience, something people
rediscover painfully.

**Logging:** `tauri-plugin-log` is the sanctioned answer; `tracing` underneath.
Cross-boundary correlation (which Rust command produced this frontend log line?)
is manual.

**Testing:**
- Rust unit tests: normal `cargo test`. Fine.
- Frontend: normal Vitest/Jest. Fine.
- End-to-end: `tauri-driver` (a WebDriver client, crate **2.1.0**) plus
  WebdriverIO/Selenium — see the [tests docs](https://v2.tauri.app/develop/tests/).
  This is *materially weaker* than Playwright driving a browser, and much weaker
  than Electron, where you can drive the real app with Playwright's Electron
  support. **For a project that will lean on E2E tests for Markdown rendering
  correctness, this is a real cost.**

**Honest summary:** debugging the *webview* is fine; debugging *across* the
Rust/JS boundary is worse than Electron; E2E automation is worse than Electron.
Since our renderer will be HTML/CSS in a browser, we can still get most of our
test coverage from **Vitest + Playwright against the web build** — which is a
strong argument for the hybrid topology in
[07](07-hybrid-architectures.md).

---

## 14. Mobile support status

Verified from the release notes and the plugin matrix.

**Stable since Tauri 2.0 (Oct 2024)**, and it has matured substantially:
- `2.0.0-alpha.0` shipped "Tauri mobile is here!" (mobile alpha announcement)
- 2.11.0 (30 Apr 2026): **multiple windows on Android** (activity embedding)
  and **iOS** (scenes), file association for Android/iOS, `RunEvent::Opened` on
  Android, monitor APIs on mobile
- 2.12.0 (26 Sep 2026): Android `AppHandle::exit` finishes the activity instead
  of killing the process (no more blank-screen flash); several Android
  lifecycle-crash fixes (#15949, #15798, #15828); Gradle 9.6.1 / Kotlin 2.2
  template migration

Mobile-relevant official plugins: `nfc`, `biometric`, `barcode-scanner`,
`haptics`, `geolocation`, plus mobile halves of `fs`, `dialog`, `opener`,
`notification`, `updater`, `deep-link`, `os`.

**Honest assessment for us:**

| Dimension | State |
|-----------|-------|
| Does it work? | Yes, and it is no longer alpha |
| Is it as polished as desktop? | **No.** Platform-specific bugs are still landing in every minor release |
| Plugin parity | Core file I/O, dialogs, opener, updater, deep links — yes |
| Do we need plugins we lack? | No. A Markdown *viewer* needs none of nfc/biometric/barcode |
| Keyboard/IME on Android | Not documented as a problem, but not documented as great |
| Plugin authoring | Swift/Kotlin bindings exist for plugins — we would not need them |
| Store acceptance | Google Play / App Store paths documented and supported |

**The honest verdict: Tauri mobile is good enough to be a serious contender and
young enough to be a risk.** The bugs landing in 2.11/2.12 are lifecycle and
process-management issues — the kind you hit in week one of mobile development,
which means "greenfield simple app" is exactly the case where it's least
painful. For a viewer (no camera, no BLE, no background services) the surface
area is small.

---

## 15. Known limitations, consolidated

### No true headless mode

**This is the biggest one for our test strategy.** Tauri has no headless mode.
`tauri::test::mock_builder` exists for unit-testing the Rust core with a
`MockRuntime`, but it does **not** render HTML. There is no "run the renderer in
a headless browser and diff the output" story inside Tauri itself.

**Consequence:** our Markdown rendering correctness tests cannot be Tauri tests.
They must be tests of the renderer running in a real browser (Playwright), which
means treating the renderer as browser-first. That is a strong architectural
signal, and it lines up with [07 option (d)](07-hybrid-architectures.md).

### Webview version differences across platforms

This is the fundamental trade. Verified reality:

| Platform | Webview | Version control | What it means for us |
|----------|---------|-----------------|----------------------|
| Windows | WebView2 (Edge/Chromium) | **Auto-updates via Edge Update**, out of our control | Generally modern Chromium; but a user on a locked-down corporate image can be months behind |
| Linux | WebKitGTK 4.1 | **Distro-controlled** | Huge spread: Ubuntu 22.04's WebKitGTK vs Arch's can differ by a year+ |
| macOS | WKWebView | **Apple-controlled**, lags Chromium | **No Chromium-only CSS/JS.** `:has()` availability, `CSS nesting`, `text-wrap: balance`, container queries, `dialog`, subgrid — all vary |

Concrete consequences we will hit:
- **`CSS Nesting`** — shipped in Safari 17.2 (2023) but syntax evolved; the
  *old* nesting syntax is dead and the new one differs. Writing `&` nesting that
  works on WebKitGTK 2.30 (Ubuntu 22.04's version) may be impossible.
- **`:has()`** — WebKitGTK 2.30 shipped `:has()` behind a flag. Ubuntu 22.04 LTS
  users will not have it.
- **Container queries, `text-wrap: pretty`, `@starting-style`, `field-sizing`** —
  all too new to assume.
- **JS**: we cannot ship a modern-browser bundle without transpilation, and even
  transpiled output can hit DOM-API gaps.

**Mitigation that works:** treat the CSS/JS baseline as **Safari 15 / Chromium 100**
and build up. Concretely:
1. No CSS nesting in source. Use a build step (Lightning CSS or PostCSS) to
   flatten it, if you want nesting ergonomics.
2. No `:has()`. Use JS `MutationObserver` + classes.
3. Feature-detect at runtime (`CSS.supports`) and progressively enhance for
   fancy footnotes/TOC behaviour.
4. Test on the *oldest* supported distro webview, not on your dev machine's
   Chrome. Build a CI job that runs the renderer tests inside
   `webkit2gtk` via Playwright's WebKit build and inside an old Chromium.

That last point is nontrivial and is itself an argument for keeping the renderer
independent of the shell.

### Linux webview fragmentation

Covered above, plus:
- **GPU/rendering bugs.** Tauri maintains a whole docs page on it. Expect
  `WEBKIT_DISABLE_COMPOSITING_MODE`, `WEBKIT_DISABLE_DMABUF_RENDERER`, and
  friends in your bag of tricks for older GPUs/drivers.
- **Wayland.** GTK4-based compositors change window behaviour; Tauri has fixed
  resize-cursor bugs for undecorated windows on Linux (2.12.0 #15701). Assume
  more.
- **Old glibc.** Build on Ubuntu 22.04 or you cut off old distros (see §9).

### Windows 7 support dropped

**Confirmed, with a precise version.** From the 2.12.0 release notes:

> "Updated `windows` to `0.62` and `webview2-com` to `0.39`, **this drops Windows
> 7 support**, see [windows-rs#3808](https://github.com/microsoft/windows-rs/issues/3808)."

So the drop landed in **2.12.0**, not at 2.0 as is often claimed. It is a
side-effect of the `webview2-com` upgrade. Tauri 2.0–2.11.x still supported
Windows 7.

Also note the [prerequisites page](https://v2.tauri.app/start/prerequisites/)
still says "Windows 7 and later" under System Dependencies. **That page is
stale** relative to the 2.12.0 changelog. If we support Windows 7 we must pin
Tauri ≤ 2.11.x and lose ongoing fixes — not viable. **Recommendation: target
Windows 10 (1803+, for the pre-installed WebView2) and Windows 11, and say so
explicitly.** Windows 10 reached end of support in October 2025, so in practice
we are a Windows 11 + current-LTS-Linux project.

### Other limitations worth knowing

| Limitation | Detail |
|-----------|--------|
| **VBSCRIPT for MSI** | MSI builds need a deprecated Windows optional feature. Prefer **NSIS** if this becomes a problem |
| **`$PATH` not inherited** | GUI apps don't get your shell env. Use `fix-path-env-rs` |
| **Events bypass capabilities** | Not a security boundary. Documented |
| **Event payloads are untyped JSON strings** | No compile-time safety on the wire for events |
| **Minisign fragility** | A `minisign` version bump broke updater signatures once ([#15022](https://github.com/tauri-apps/tauri/pull/15022)) |
| **Android `consumer-rules.pro`** | 2.12.0 renamed template files; plugin authors must rename `proguard-rules.pro` |
| **Updater key loss is unrecoverable** | Documented explicitly. Back up offline |
| **Windows auto-exit on update** | Installer limitation; design autosave around it |
| **v3 will break `createUpdaterArtifacts: "v1Compatible"`** | Budget a migration |
| **Rust MSRV 1.90** | CI images must track it |

---

## 16. Ecosystem and maturity

**Tauri is a young project with an unusually serious maintainer culture.**

Evidence:

- **Funded and staffed.** Governed under "Tauri Programme within The Commons
  Conservancy", with [Open Collective sponsorship](https://opencollective.com/tauri).
- **Security-audited.** Major and minor releases get an audit covering both
  Tauri code and upstream dependencies. The
  [Tauri 2.0 audit report](https://github.com/tauri-apps/tauri/blob/dev/audits/Radically_Open_Security-v2-report.pdf)
  is public, and the team publishes GHSA advisories with CVE equivalents
  (e.g. CVE-2024-35222 drove a breaking change at RC — they chose breaking over
  leaving overexposure in place).
- **Deliberate honesty in docs.** The asset-protocol page documents its own
  footguns with an upstream issue link; the capabilities page lists what it does
  *not* protect against; the updater page says key loss is fatal. This is a
  better security posture than any vendor we surveyed.
- **SBOM available** via FOSSA.
- **VS Code extension** (`tauri-vscode`).

Counter-evidence / risk:

- **Hobby-scale community relative to Electron.** Not a knock, but it means
  the long tail is thinner. Third-party Tauri plugins exist but there is no
  equivalent of Electron's `awesome-electron` density.
- **Wry and Tao are load-bearing single points of failure.** Tauri depends on
  two crates it maintains itself for the most OS-critical parts. They are
  well-maintained (wry 0.57.0, tao 0.37.1, both updated within the last month)
  but the bus factor is Tauri.
- **Crate-health warnings are real.** A `cargo audit` on Tauri surfaces
  unmaintained transitive deps — the release page shows advisories for
  `rustybuzz`, `ttf-parser`, `rustls-pemfile`, `yoke-derive`. Note this affects
  our build chain; some are only in the CLI, not the runtime.
- **Linux is the weak platform.** Everything is easiest on Windows and macOS.
  We are *choosing* Linux first-tier, which means we will be upstream
  reporters more often than we would on Windows.

**Verdict: strong project health, small team, high bus factor per person.
Acceptable and arguably better than a larger, more diffuse project. Not a
venture-backed company, so no "will they pivot" risk — but also no deep bench.**

---

## 17. Summary scorecard for Siyana

| Dimension | Rating | Note |
|-----------|--------|------|
| Security model | **Excellent** | Capabilities, mandatory CSP injection, mandatory signed updates. Ceiling = system webview |
| Bundle size | **Excellent** | ~3–10 MB. Verify in CI |
| Memory | **Very good** (inferred) | Must measure with our protocol |
| Startup | **Very good** (inferred) | Must measure |
| Desktop maturity | **Strong** | Windows/macOS excellent, Linux good with effort |
| Linux coverage | **Medium** | Modern distros yes; RHEL 8/9 and anything on webkit2gtk 4.0 no |
| Mobile | **Good but young** | Sufficient for a viewer; bugs still landing |
| Web story | **Weak** | Tauri is not a web framework. Web build = plain web build |
| Debugging | **Medium** | Frontend fine, cross-boundary and E2E weak |
| E2E testing | **Weak** | `tauri-driver` ≪ Playwright |
| Build time | **Medium** | Slow cold builds, fast incrementals |
| Learning curve | **Medium-high** | Rust is mandatory for the backend |
| Ecosystem | **Medium** | All the plugins we need are first-party; long tail thin |
| Licensing | **Excellent** | MIT/Apache-2.0 |
| Viability | **Strong** | Funded, audited, honest, small-team risk |

**Tauri's sharpest structural weakness for this project is not size or
security — it is that the desktop shell and the web target have nothing to do
with each other.** Tauri gives us a great desktop app and no help at all with
the web build. If reuse is a priority, that has to be solved in the
*architecture* (a shared renderer + shared core), not by the framework. See
[07-hybrid-architectures.md](07-hybrid-architectures.md).
