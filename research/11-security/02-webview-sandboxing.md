# 02 — Webview sandboxing

> Three shells, one principle: **a compromised renderer must not be code
> execution.** Everything else is tuning.

---

## 1. Why this document exists

A Markdown viewer displays content from an untrusted source inside a process
that, by construction, has more power than a browser tab. Electron's own
security documentation puts it more bluntly than we can:

> "As web developers, we usually enjoy the strong security net of the browser —
> the risks associated with the code we write are relatively small. … When
> working with Electron, it is important to understand that **Electron is not a
> web browser**. It allows you to build feature-rich desktop applications with
> familiar web technologies, but your code wields much greater power. JavaScript
> can access the filesystem, user shell, and more. … the inherent security
> risks scale with the additional powers granted to your code."
>
> "With that in mind, be aware that **displaying arbitrary content from untrusted
> sources poses a severe security risk that Electron is not intended to
> handle.**"
>
> — <https://www.electronjs.org/docs/latest/tutorial/security>

We display arbitrary content. So this document is where we accept responsibility
for the gap between "a webview" and "a browser."

The governing question for every choice below:

> If an attacker achieves script execution in the renderer, what is the worst
> thing they can do?

| Shell | If the renderer is compromised, and we followed this document |
|-------|--------------------------------------------------------------|
| **Electron** (correctly configured) | Read and rewrite the pixels. Make network requests the CSP allows. Call our handful of audited preload functions with our validated arguments. Nothing else. **Not RCE.** |
| **Tauri v2** (correctly configured) | The same. Commands are capability-gated and argument-validated in Rust. **Not RCE.** |
| **Electron** (misconfigured: `nodeIntegration: true`) | `require('child_process').exec(…)`. **RCE.** |
| **Electron** (`contextIsolation: false` + any preload) | `window.api` is fully replaceable by the attacker; prototype pollution of `Array.prototype` reaches into the preload's realm. **RCE.** |
| **Flutter** (no system webview) | Nothing. There is no DOM to compromise; the canvas renderer draws what our code tells it to. |

## 2. Electron

### 2.1 The checklist, and which items we must not skip

Electron's list is the industry baseline. Reproduced with our notes on each:

| # | Requirement | Our note |
|---|-------------|-----------|
| 1 | Only load secure content | our renderer is a bundled local file; no remote content ever |
| 2 | Do not enable Node.js integration for remote content | `nodeIntegration: false`, always, for every window |
| 3 | Enable context isolation in all renderers | `contextIsolation: true` (default since 12.0.0) — we still set it explicitly |
| 4 | Enable process sandboxing | `sandbox: true` (default since 20.0.0) — set explicitly; enforced globally too |
| 5 | `setPermissionRequestHandler` in all sessions | **deny everything.** A Markdown viewer needs no camera, microphone, geolocation, notifications, or clipboard-read permission |
| 6 | Do not disable `webSecurity` | leave the default on |
| 7 | Define a CSP with restrictive rules | `script-src 'self'`, via `onHeadersReceived` |
| 8 | Do not enable `allowRunningInsecureContent` | default off |
| 9 | Do not enable experimental features | — |
| 10 | Do not use `enableBlinkFeatures` | — |
| 11 | `<webview>`: do not use `allowpopups` | we do not use `<webview>` at all |
| 12 | Disable or limit navigation | `will-navigate` → `preventDefault()` unless allowlisted |
| 13 | Disable or limit creation of new windows | `setWindowOpenHandler` → `deny()` |
| 14 | Do not use `shell.openExternal` with untrusted content | 4-scheme allowlist + explicit user gesture |
| 15 | Use a current version of Electron | pinned exact version; rebased on each release |
| 16 | Validate the sender of all IPC messages | check `event.senderFrame` identity, not just presence |
| 17 | Avoid `file://`; prefer custom protocols | `mdimg:`, `mdapp:` |
| 18 | Check which fuses you can change | flip all of them |
| 19 | Do not expose Electron APIs to untrusted web content | the preload surface is a hand-written list |

### 2.2 Recommended main-process configuration

```js
// main.js — Electron. Pinned exact version; see dependency docs.
const { app, BrowserWindow, session, protocol, shell, clipboard, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// --- 1. Custom privileged scheme, instead of file:// -------------------
// registerSchemesAsPrivileged must run before app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mdapp',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false },
  },
  {
    scheme: 'mdimg',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true,
                  bypassCSP: false, corsEnabled: false },
  },
]);

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    width: 1200, height: 800,
    backgroundColor: '#0d1117',        // avoids the white flash on dark start
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      spellcheck: false,
      devTools: isDev,                  // never in a release build
    },
  });

  win.once('ready-to-show', () => win.show());
  installNavigationGuards(win);
  win.loadURL('mdapp://bundle/index.html');
  return win;
}

// --- 2. Sandbox every renderer, globally, including any we forget -------
app.enableSandbox();

app.whenReady().then(() => {
  const ses = session.defaultSession;

  // 2a. CSP via response headers. This is the layer that actually applies to
  //     subframes and to anything loaded from disk.
  ses.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'none'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' mdimg: mdapp: data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "media-src 'self' mdimg:",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'none'",
            "frame-src 'none'",
            "frame-ancestors 'none'",
            "require-trusted-types-for 'script'",
            "trusted-types siyana",
          ].join('; '),
        ],
      },
    });
  });

  // 2b. Deny every permission request. A viewer needs none of them.
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);

  // 2c. Never grant a device. A Markdown viewer needs no camera, mic, USB,
  //     serial, Bluetooth, or HID access.
  ses.setDevicePermissionHandler(() => false);

  // 2d. No <webview>, no plugins, no background page throttling exemptions.
  ses.setPreloads([]);

  installProtocols();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

Two details worth flagging:

- `require-trusted-types-for 'script'` in the CSP is the single highest-value
  line above. OWASP: it "is one of the few controls that eliminates entire
  classes of DOM XSS rather than mitigating them. Combine with a default policy
  that delegates to a sanitizer (e.g. DOMPurify) for legacy code paths." With it,
  `el.innerHTML = attackerString` **throws** instead of executing.
- `bypassCSP: false` on the `mdimg` scheme, explicitly. The default is false;
  stating it means a future edit that flips it is a visible diff.

### 2.3 Navigation guards

```js
function installNavigationGuards(win) {
  const wc = win.webContents;

  // No document may navigate the window. Only our own bundle may.
  wc.on('will-navigate', (event, url) => {
    if (url.startsWith('mdapp://bundle/')) return;
    event.preventDefault();
    void maybeOpenExternally(url, /* userGesture */ false);
  });

  wc.on('will-redirect', (event, url) => {
    if (url.startsWith('mdapp://bundle/')) return;
    event.preventDefault();
  });

  wc.on('will-frame-navigate', (event) => { event.preventDefault(); });

  // No new windows, ever. Deny, do not "open external" — opening a window
  // with the document's URL is how phishing gets a chrome and an address bar.
  wc.setWindowOpenHandler(({ url }) => {
    void maybeOpenExternally(url, /* userGesture */ true);
    return { action: 'deny' };
  });

  // No attaching webviews, no detaching.
  wc.on('will-attach-webview', (event) => event.preventDefault());

  // The user cannot be moved or resized by the page.
  wc.on('will-resize', (e) => { if (!allowGeometry(e)) e.preventDefault(); });
  wc.on('will-move',   (e) => { if (!allowGeometry(e)) e.preventDefault(); });
}

const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:']);

function maybeOpenExternally(rawUrl, userGesture) {
  const cleaned = String(rawUrl).replace(/[\u0000-\u0020\u007F-\u009F]/g, '');
  let u; try { u = new URL(cleaned); } catch { return; }
  if (!EXTERNAL_SCHEMES.has(u.protocol)) return;
  if (!userGesture) return;               // never launch without a real click
  void shell.openExternal(u.toString());
}
```

`userGesture` matters: a document must not be able to make the app launch
programs by itself. `openExternal` is a **launch primitive** — on Windows it is
`ShellExecute`, which will happily run a `.exe`, open a `.lnk`, or hit a UNC path.
Four schemes, plus a required user gesture, is the correct reduction.

### 2.4 The preload bridge — minimal, validated, closed

```js
// preload.js — the entire native surface available to the renderer.
const { contextBridge, ipcRenderer } = require('electron');

/** Only this exact frame may talk to us. */
const ALLOWED_SENDER = 'mdapp://bundle/index.html';

function assertSender(event) {
  const url = event.senderFrame?.url ?? '';
  if (url !== ALLOWED_SENDER) throw new Error('unauthorized sender');
  return event.senderId;
}

/**
 * Every exposed function is (a) named specifically, (b) takes only primitives,
 * (c) validates them here, and (d) returns only structured-cloneable data.
 * No generic `invoke(command, args)` escape hatch. Ever.
 */
contextBridge.exposeInMainWorld('md', {
  // ── filesystem ──────────────────────────────────────────────────────
  openFile: async () => {
    const r = await ipcRenderer.invoke('fs:open-dialog');
    return r ? { path: r.path, text: r.text } : null;
  },
  readFile: async (path) => {
    assertString(path, 4096);
    const r = await ipcRenderer.invoke('fs:read', path);
    return r.text;
  },
  writeFile: async (path, text) => {
    assertString(path, 4096);
    assertString(text, 64 * 1024 * 1024);
    return ipcRenderer.invoke('fs:write', path, text);
  },
  // ── shell ──────────────────────────────────────────────────────────
  openExternal: async (url) => {
    assertString(url, 2048);
    return ipcRenderer.invoke('shell:open-external', url);   // main re-validates
  },
  // ── window ─────────────────────────────────────────────────────────
  setTitle: async (t) => { assertString(t, 300); return ipcRenderer.invoke('win:title', t); },
  // ── diagnostics ────────────────────────────────────────────────────
  reportError: async (message, stack) => {
    assertString(message, 8192); assertString(stack ?? '', 8192);
    return ipcRenderer.invoke('diag:error', message, stack);
  },
});

function assertString(v, max) {
  if (typeof v !== 'string') throw new TypeError('expected string');
  if (v.length > max) throw new RangeError('too long');
}
```

Rules this file encodes, each of which will be argued about in review:

1. **No generic `invoke`.** A generic bridge lets the renderer call *anything*,
   which reintroduces the whole Node surface with extra steps. Nine named
   functions, each auditable in one read.
2. **Only primitives cross the bridge.** No functions, no class instances, no
   objects with methods. Structured-cloneable data only.
3. **Validation in the preload *and* in main.** The preload check is for
   developer ergonomics; the main-process handler is the security boundary and
   re-validates everything, including a fresh path canonicalization.
4. **Sender identity is checked**, not merely the presence of a sender. Without
   this, any frame we load — including a frame created by document content —
   gets the bridge.
5. **No `clipboard`, no `shell.openPath`, no `webContents`, no `app`** on the
   bridge. Clipboard reads are gated behind an explicit user action in the main
   process, because clipboard contents are attacker-controlled
   ([CVE-2023-2318](./01-threat-model.md#59-vector-clipboard--paste-path)).

```js
// main-side handlers re-validate, always.
ipcMain.handle('fs:read', async (event, path) => {
  assertSender(event);
  return fsAdapter.readDocument(path);        // realpath + containment + caps
});
ipcMain.handle('shell:open-external', async (event, url) => {
  assertSender(event);
  return shell.openExternal(validateExternal(url));
});
```

### 2.5 Fuses

Electron "fuses" are magic bits flipped at package time, before code signing, so
the OS's signature validation prevents flipping them back (Gatekeeper on macOS,
AppLocker on Windows). From the
[fuses documentation](https://www.electronjs.org/docs/latest/tutorial/fuses):

| Fuse | Default | Set | Why |
|------|---------|-----|-----|
| `runAsNode` | Enabled | **disable** | blocks the `ELECTRON_RUN_AS_NODE` living-off-the-land trick |
| `nodeOptions` | Enabled | **disable** | blocks `NODE_OPTIONS` / `NODE_EXTRA_CA_CERTS` injection |
| `nodeCliInspect` | Enabled | **disable** | blocks `--inspect` and `SIGUSR1` opening a debugger on our process |
| `cookieEncryption` | Disabled | enable | encrypts Chromium's cookie store at rest |
| `embeddedAsarIntegrityValidation` | Disabled | enable | validates `app.asar` on macOS/Windows, so a patched archive is refused |
| `onlyLoadAppFromAsar` | Disabled | enable | Electron loads only from `app.asar`, never from a sibling `app/` directory |

`embeddedAsarIntegrityValidation` + `onlyLoadAppFromAsar` together are the
pairing Electron's docs describe as ensuring "it is impossible to load
non-validated code". On a machine where another user can write to the install
directory, that is the difference between "local attacker can rewrite our JS" and
"they cannot".

```json
// package.json
"electron": {
  "fuses": {
    "runAsNode": false,
    "cookieEncryption": true,
    "nodeOptions": false,
    "nodeCliInspect": false,
    "embeddedAsarIntegrityValidation": true,
    "onlyLoadAppFromAsar": true
  }
}
```

Flip the fuses **before** signing, in the packaging step, and assert in CI that
the built artifact's fuse bytes match expectations.

### 2.6 Media protocol

```js
const ALLOWED_ROOTS = new Set();       // populated when the user opens a folder
const IMAGE_EXT = new Set(['.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg','.ico','.avif']);
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

function installProtocols() {
  protocol.handle('mdapp', async (req) => {
    // Only our own bundle. Everything else is not ours.
    const p = new URL(req.url).pathname;
    const file = path.join(__dirname, 'bundle', path.normalize(p));
    if (!file.startsWith(path.join(__dirname, 'bundle'))) return new Response('no', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  protocol.handle('mdimg', async (req) => {
    // The renderer must not be able to name an arbitrary path. The resolver
    // in the renderer passes an opaque token, not a path.
    const token = new URL(req.url).hostname + new URL(req.url).pathname;
    const entry = mediaRegistry.get(token);
    if (!entry) return new Response('not found', { status: 404 });

    const real = fs.realpathSync.native(entry.realPath);          // re-resolve: symlinks may have moved
    if (!ALLOWED_ROOTS.has(path.dirname(real))) return new Response('denied', { status: 403 });
    if (!IMAGE_EXT.has(path.extname(real).toLowerCase())) return new Response('denied', { status: 403 });

    const st = fs.statSync(real);
    if (!st.isFile() || st.size > MAX_IMAGE_BYTES) return new Response('too big', { status: 413 });
    return new Response(fs.readFileSync(real), { headers: { 'content-type': contentTypeOf(real) } });
  });
}
```

The **opaque token** is the key design choice. If the `mdimg:` URL contained the
real path, the renderer could mutate it and ask for anything; with a registry
lookup, the renderer can only refer to entries the native side already
validated and registered. And `realpath` is re-resolved on *every* request
because a symlink can be swapped between registration and use.

### 2.7 What a renderer compromise gets you

With the configuration above, an attacker who achieves script execution in the
renderer has:

| Capability | Available? |
|------------|-----------|
| Read any file from disk | **No.** `readFile` re-runs canonicalization and containment; and the renderer must first know a path |
| Read the app bundle | Yes, it is already loaded |
| Write a file | Only via `writeFile`, which is user-initiated and path-validated |
| Run a program | **No.** No `child_process`, no `shell`, no Node builtins in the renderer |
| Steal cookies / tokens | **No.** No cookie jar, no `localStorage` secrets, `cookieEncryption` on, `safeStorage` never bridged |
| Read the clipboard | **No**, unless the user presses a paste button |
| Make network requests | Only what `connect-src 'self'` allows — i.e. to our own bundle origin, and our origin makes no API calls |
| Persist | **No.** No `ELECTRON_RUN_AS_NODE`, no `NODE_OPTIONS`, asar integrity validated |
| Rewrite the UI | **Yes.** It can render anything it likes in the window |

That last row is why the CSP's `frame-ancestors 'none'` and our refusal of
unrequested geometry changes matter: a renderer that can overlay the OS taskbar
or change the window title can impersonate a system dialog.

## 3. Tauri v2

### 3.1 The architecture

Tauri does not bundle a browser engine. It uses the **system** WebView2 on
Windows, WebKitGTK on Linux, WKWebView on macOS. The frontend is HTML/CSS/JS in
that engine; the backend is Rust, reached through an IPC layer modelled on
message passing.

From the [IPC documentation](https://v2.tauri.app/concept/inter-process-communication/):

> "Message passing is a safer technique than shared memory or direct function
> access because the recipient is free to reject or discard requests as it sees
> fit. For example, if the Tauri Core process determines a request is malicious,
> it simply discards the requests and never executes the corresponding function."

And, crucially, the reason it is *not* a true FFI boundary:

> "Because Commands still use message passing under the hood, they do not share
> the same security pitfalls as real FFI interfaces do."

### 3.2 Capabilities: the allowlist that replaced the allowlist

Tauri v1 had a global allowlist. v2 replaced it with **capabilities**, which bind
permission sets to specific window labels. From
[the capabilities docs](https://v2.tauri.app/security/capabilities/):

> "Tauri provides application and plugin developers with a capabilities system, to
> **granularly enable and constrain** the core exposure to the application
> frontend running in the system WebView. Capabilities define which permissions
> are granted or denied for which windows or webviews."

```json
// src-tauri/capabilities/viewer.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "viewer-capability",
  "description": "Read-only access for the document viewer window. No write, no shell, no http.",
  "windows": ["main"],
  "permissions": [
    "core:event:default",
    "core:window:allow-set-title",
    "core:window:allow-start-dragging",
    "core:path:default"
  ]
}
```

Note what is **absent**: `fs:allow-write-file`, `shell:allow-execute`,
`shell:allow-open`, `http:default`, `clipboard-manager:allow-read-text`,
`opener:allow-open-url`, `updater:default`. A Markdown viewer needs none of
them, and the whole point of a capability system is that "we need it eventually"
is not a reason to include it now.

Two more rules from the same page:

- "All capabilities inside the capabilities directory are automatically enabled
  by default. Once capabilities are explicitly enabled in the `tauri.conf.json`,
  **only these are used** in the application build." So the allowlist is
  explicit, and the set of files in `capabilities/` is the whole story.
- "Windows and WebViews which are part of more than one capability effectively
  **merge the security boundaries and permissions of all involved capabilities**."
  Capability composition is additive. Reviewing "what does window X have" means
  reading every capability that mentions X.

And the crucial default: "By default, **all** commands that you registered in
your app … are allowed to be used by all the windows and webviews of the app."
To change that you must pass an explicit `AppManifest::commands` in `build.rs`.
A forgotten manifest means every window gets every command — the opposite of what
a careful reader assumes.

### 3.3 Scopes: path and URL restriction

Capabilities grant *permission*; scopes constrain *arguments*. From
[the scopes docs](https://v2.tauri.app/security/scope/):

> "A scope is a granular way to define (dis)allowed behavior of a Tauri command.
> Scopes are categorized into allow or deny scopes, where **deny always supersedes
> the allow scope**. … For instance, the Fs plugin allows you to use scopes to
> allow or deny certain directories and files and the http plugin uses scopes to
> filter URLs that are allowed to be reached."

So `fs:default` plus a scope is a real containment control, not just a
permission toggle. Our asset-protocol scope, from
[the asset protocol docs](https://v2.tauri.app/security/asset-protocol/):

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "requireLiteralLeadingDot": true,
          "allow": ["$HOME/Documents/**/*", "$HOME/notes/**/*"],
          "deny":  ["$HOME/**/.ssh/**", "$HOME/**/.aws/**", "$HOME/**/.config/**"]
        }
      }
    }
  }
}
```

Documented pitfalls we must design around, quoted from the same page:

- "Paths resolved when loading assets are usually absolute … A pattern like
  `["*/**"]` typically does not match those paths." A wrong glob silently blocks
  images.
- "deny takes precedence over allow when both match."
- "On Unix, `requireLiteralLeadingDot` defaults to `true`. Then wildcard tokens
  such as `*`, `?`, `**`, and `[...]` **do not match a path component that starts
  with `.`**." Desirable, but it means `~/.cache`-relative images do not load,
  and users must be told why.
- "Prefer `**/*` over bare `**`."

### 3.4 The IPC surface

Every `#[tauri::command]` is a function the frontend can call with arbitrary
JSON. Treat each as an unauthenticated network endpoint.

```rust
use tauri::State;
use std::path::{Component, Path, PathBuf};

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]     // reject unknown keys: no smuggling
pub struct ReadDocArgs {
    pub path: String,
}

#[tauri::command]
pub async fn read_document(
    args: ReadDocArgs,
    roots: State<'_, AllowedRoots>,
) -> Result<ReadResult, DocError> {
    // 1. Length bound before any allocation.
    if args.path.len() > 4096 { return Err(DocError::PathTooLong); }

    // 2. Canonicalize FIRST. A prefix check on the unresolved string is a
    //    check on attacker-controlled text. This also resolves symlinks,
    //    collapses "..", and handles Windows 8.3 short names and ::DATA on
    //    most platforms.
    let real = std::fs::canonicalize(&args.path).map_err(|_| DocError::NotFound)?;

    // 3. Must be a regular file.
    let meta = std::fs::metadata(&real).map_err(|_| DocError::NotFound)?;
    if !meta.is_file() { return Err(DocError::NotADirectory); }

    // 4. Size cap before reading.
    const MAX_DOC_BYTES: u64 = 64 * 1024 * 1024;
    if meta.len() > MAX_DOC_BYTES { return Err(DocError::TooLarge); }

    // 5. Containment: the resolved path must be inside a root the user opened.
    if !roots.contains(&real) { return Err(DocError::OutsideRoots); }

    // 6. Extension allowlist.
    let ext = real.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    if !ALLOWED_EXT.iter().any(|e| *e == ext) { return Err(DocError::BadExtension); }

    // 7. Read, then re-stat to detect a concurrent swap.
    let bytes = std::fs::read(&real).map_err(|_| DocError::Read)?;
    let meta2 = std::fs::metadata(&real).map_err(|_| DocError::Read)?;
    if meta2.len() != meta.len() || meta2.modified().ok() != meta.modified().ok() {
        return Err(DocError::ChangedWhileReading);
    }

    Ok(ReadResult { bytes })
}
```

Every one of those seven steps is a security control, and every one is the kind
of thing that gets "simplified" out of a hotfix. Note step 4 vs 7: cap before
allocating, and detect the swap after reading. Note `deny_unknown_fields`:
without it, an attacker can smuggle extra JSON keys past a validation layer that
only looks at known ones.

```rust
// src-tauri/build.rs — restrict our own commands to an explicit manifest,
// because the default is "all windows may call all commands".
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "read_document",
                "list_directory",
                "watch_start",
                "watch_stop",
                "open_external",
                "export_document",
                "get_app_info",
            ]),
        ),
    ).unwrap();
}
```

`open_external` is the one command that hands data to the OS, and it must
re-validate with the same four-scheme allowlist as the Electron path:

```rust
#[tauri::command]
pub fn open_external(app: tauri::AppHandle, url: String) -> Result<(), DocError> {
    let cleaned: String = url.chars().filter(|c| !c.is_ascii_control()).collect();
    let parsed = tauri::Url::parse(&cleaned).map_err(|_| DocError::BadUrl)?;
    if !matches!(parsed.scheme(), "https" | "http" | "mailto" | "tel") {
        return Err(DocError::SchemeNotAllowed);
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(parsed, None::<&str>)?;
    Ok(())
}
```

### 3.5 CSP

Tauri rewrites the CSP at build time, injecting nonces and hashes for local
scripts and styles:

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' asset: http://asset.localhost data: blob:",
        "font-src": "'self'",
        "connect-src": "ipc: http://ipc.localhost",
        "object-src": "'none'",
        "base-uri": "'none'",
        "form-action": "'none'",
        "frame-src": "'none'",
        "frame-ancestors": "'none'"
      }
    }
  }
}
```

The docs' cautions, taken seriously:

> "**Avoid loading remote content such as scripts served over a CDN as they
> introduce an attack vector.** In general any untrusted file can introduce new
> and subtle attack vectors. The CSP protection is only enabled if set on the
> Tauri configuration file. **You should make it as restricted as possible**,
> only allowing the webview to load assets from hosts you trust, and preferably
> own."

Note `connect-src` is `ipc: http://ipc.localhost` only — the renderer cannot
make HTTP requests to the internet at all. That is what implements O4 at the
platform level, and it is why the remote-image feature requires an explicit,
separate permission rather than just a CSP edit.

### 3.6 Tauri versus Electron, for this project

| Property | Electron | Tauri v2 |
|----------|----------|----------|
| Engine | bundled Chromium (ours to update) | system WebView2 / WebKitGTK / WKWebView |
| Binary size | ~150 MB base | ~10 MB base |
| Engine security patches | ours to ship | dependent on the user's OS updates |
| Renderer→native isolation | `contextIsolation` + `sandbox` + hand-written preload | capability system + Rust-side validation, no explicit preload needed |
| Granularity | whatever the preload exposes | per-window, per-platform, per-permission, with scopes |
| Auditability of the native surface | "read the preload file" | "read the capability files + the command list" |
| Node in the main process | yes (convenient, risky) | no |
| Print-to-PDF | `webContents.printToPDF` first-class | not first-class; system dialog or headless Chromium |
| Cross-platform consistency | highest (same engine everywhere) | varies by platform |
| Cold start | slower | faster |
| XSS → RCE when misconfigured | easy | harder (no Node in the renderer at all) |

**On balance Tauri v2 is the better fit for this project**, and the deciding
factors are specific: (a) no Node in the renderer means no `require`, so the
worst case for a sanitizer bypass is much smaller by construction; (b) the
capability system is a *declarative allowlist checked by the framework*, whereas
an Electron preload is code we have to remember to write correctly; (c) the
capability/scope model maps directly onto our "user opened these roots" model.

The costs are real and must be acknowledged in the ADR: system-webview variance
on Linux, no first-class print-to-PDF, and an engine we do not control. The
print-to-PDF gap is the one that most affects this project specifically and it
should be priced into the decision.

### 3.7 What a Tauri renderer compromise gets you

With the capabilities and CSP above:

| Capability | Available? |
|------------|-----------|
| Read a file | **No.** No `fs` permission at all; and `read_document` re-validates |
| List a directory | **No.** No `fs:allow-read-dir` |
| Write a file | **No.** No write permission |
| Run a program | **No.** No `shell` permission |
| Make network requests | **No.** `connect-src` is `ipc:` only, and no `http` plugin permission |
| Read the clipboard | **No.** No clipboard permission |
| Set the window title | Yes — `core:window:allow-set-title`, and we overwrite it natively after render |
| Move/resize the window | Partially — `allow-start-dragging` only, which is user-initiated |
| Rewrite the UI | **Yes** |

The last two rows of the Electron table and this one are the same. **In both
shells, a compromised renderer can lie to the user about everything inside the
window.** The mitigation is the shell configuration ensuring it cannot do
anything *outside* the window, plus not letting it change the title or geometry
so it cannot impersonate a system dialog.

## 4. Flutter (and why it is a different category)

Flutter does not use a system webview for its UI. It renders to a canvas via
Skia/Impeller and draws every pixel itself. There is no HTML DOM in the app
window.

**Security consequences:**

- **No DOM-based XSS surface in the main window.** A malicious document cannot
  inject a `<script>` because there is no script execution model for our own UI.
  We draw text and images; a hostile string is text.
- **Markdown must be rendered by us**, into widget trees — meaning the "HTML
  render" is not an option, and neither is DOMPurify in the main window.
- **Web content can still appear**, inside a `WebView` widget. If we ever embed
  one, that subtree is a fresh web context and needs its own
  allowlist + CSP, and `JavascriptMode.unrestricted` is dangerous.
- **In-app webviews and plugins** are the residual risk; a plugin that reads
  arbitrary files is equivalent to a shell permission.

**CSS consequences**, which matter for [05-rendering/03-styling-and-themes.md](../05-rendering/03-styling-and-themes.md):

- No CSS. Our entire stylesheet strategy — custom properties, `ch` measure,
  `hyphens: auto`, `text-wrap: pretty`, `::marker` control, `@media print`,
  `orphans`/`widows`, `break-inside` — does not exist in Flutter. All of it would
  have to be reimplemented as widget properties and custom layout.
- Text shaping is available (via the text engine), so `font-feature-settings`
  equivalents exist; hyphenation does not ship by default.
- Printing is `Printing.layoutPdf`, which uses the widget tree, not a CSS paged
  media box. Our print stylesheet would become a parallel widget tree.

**Assessment:** Flutter's immunity to DOM XSS is real and substantial for a
Markdown viewer. But it converts an entire solved problem (CSS typography for
long-form reading, which has twenty years of refinement) into an unsolved one,
and it does not remove the other eleven threat vectors — path traversal, symlinks,
TODoU, supply chain, encoding, file permissions all still apply. The DOM-XSS
advantage is bought by not having a DOM, which is a large price for a *reader*.

**Recommendation: not Flutter for v0.1.** Revisit if the CSS strategy proves to
be a persistent blocker, and document the trade explicitly when we do.

## 5. Comparison summary

| Control | Electron | Tauri v2 | Flutter |
|---------|----------|----------|---------|
| Renderer XSS surface | yes (DOM) | yes (DOM) | **none** |
| `require` reachable from renderer | only if misconfigured | **never** | never |
| Declarative capability allowlist | no (code) | **yes** | plugin allowlist |
| Path/URL scoping | code in main | **scopes** | code |
| CSP enforcement | `onHeadersReceived` | **build-time rewrite** | `WebView` only |
| Renderer compromise → RCE | possible if misconfigured | **not** | not |
| Renderer compromise → UI lie | yes | yes | yes |
| Engine we control | yes | no | n/a |
| Print-to-PDF | first-class | not | widget-tree only |
| Binary size | large | small | medium |
| CSS ecosystem | full | full (system webview) | **none** |

## 6. Verification

| # | Check | Method | Assert |
|---|-------|--------|--------|
| 1 | `require` unreachable from the renderer | inject `<script>window.__pwned = (()=>{try{return typeof require}catch(e){return 'blocked'}})()</script>` into a test document, read it back | `blocked` |
| 2 | `process` unreachable | same probe for `process` | `blocked` |
| 3 | Preload not replaceable | payload does `window.md = {readFile: …}` then calls it | main process logs no call |
| 4 | Navigation denied | document contains `<a href="mdapp://bundle/../evil.html">`; attempt navigation | `will-navigate` fires, is prevented |
| 5 | `window.open` denied | document calls `open('https://…')` | `setWindowOpenHandler` denies |
| 6 | No permissions | document calls `navigator.mediaDevices.getUserMedia()` | denied by handler |
| 7 | CSP present | `fetch('https://example.com')` from the renderer | blocked |
| 8 | Trusted Types active | `el.innerHTML = '<img src=x onerror=alert(1)>'` | throws, no `onerror` in DOM |
| 9 | Fuses flipped | read the fuse bytes from the packaged binary in CI | matches expected |
| 10 | asar integrity | modify `app.asar` in a built artifact and launch | refuses to load |
| 11 | Capability set minimal | snapshot the resolved permission set in CI and diff | matches a committed allowlist |
| 12 | Scope containment | attempt to load `$HOME/.ssh/id_rsa` via `asset:` | refused |
| 13 | `deny` beats `allow` | asset inside both an allow and a deny glob | denied |
| 14 | Dot-directory behaviour | attempt to load `~/.cache/x.png` with `$HOME/**` | denied, and the error message explains why |
| 15 | Command manifest | call a command not in `AppManifest::commands` | rejected |
| 16 | Sandbox enforced | attempt to read `/etc/passwd` from the renderer | no API, error |

Checks 1–8 belong in the automated E2E suite and run on every commit, because
they are cheap and because they are exactly the checks a future refactor will
break silently.

## Sources

- Electron security checklist — <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron context isolation —
  <https://www.electronjs.org/docs/latest/tutorial/context-isolation>
- Electron process sandboxing —
  <https://www.electronjs.org/docs/latest/tutorial/process-sandboxing>
- Electron fuses — <https://www.electronjs.org/docs/latest/tutorial/fuses>
- Electron ASAR integrity — <https://www.electronjs.org/docs/latest/tutorial/asar-integrity>
- Electron `protocol` / `registerSchemesAsPrivileged` —
  <https://www.electronjs.org/docs/latest/api/protocol>
- Electron `session.setPermissionRequestHandler` —
  <https://www.electronjs.org/docs/latest/api/session>
- Electron `webContents.printToPDF` —
  <https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions>
- Tauri inter-process communication —
  <https://v2.tauri.app/concept/inter-process-communication/>
- Tauri capabilities — <https://v2.tauri.app/security/capabilities/>
- Tauri command scopes — <https://v2.tauri.app/security/scope/>
- Tauri asset protocol scope — <https://v2.tauri.app/security/asset-protocol/>
- Tauri CSP — <https://v2.tauri.app/security/csp/>
- Tauri security overview (threats, runtime authority) —
  <https://v2.tauri.app/security/>
- Tauri process model (why the system webview) —
  <https://v2.tauri.app/concept/process-model/>
- Tauri updater (signed updates) —
  <https://v2.tauri.app/plugin/updater/>
- OWASP XSS Prevention Cheat Sheet, "Safe sinks" and Trusted Types —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- CVE-2019-20374 (Electron + XSS = RCE) —
  <https://nvd.nist.gov/vuln/detail/CVE-2019-20374>
