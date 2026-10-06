# 02 — Electron

> **Status: 6 October 2026.** Stable **`electron@44.5.1`** (published 29 Sep
> 2026). Bundles **Chromium 152.0.7977.130**, **Node.js 24.21.0**, **V8
> 15.2.124.28**.
> `45.0.0-beta` is in beta; **45.0.0 goes stable 20 Oct 2026**; 46.0.0 alpha
> started 22 Oct 2026.
>
> Sources: [npm electron](https://registry.npmjs.org/electron) ·
> [release page v44.5.1](https://releases.electronjs.org/release/v44.5.1) ·
> [official schedule](https://releases.electronjs.org/schedule) ·
> [release policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)

---

## 1. Architecture

Electron is Chromium plus Node.js plus a process model. From the
[security docs' own preface](https://www.electronjs.org/docs/latest/tutorial/security),
which is unusually blunt and worth reading in full:

> "When working with Electron, it is important to understand that **Electron is
> not a web browser.** It allows you to build feature-rich desktop applications
> with familiar web technologies, but your code wields much greater power.
> JavaScript can access the filesystem, user shell, and more."

That sentence is the whole risk story. In a browser, a hostile page is contained.
In Electron, a hostile page with Node integration is the user's account.

### The processes

| Process | Contains | Trust |
|---------|----------|-------|
| **Main** | Node.js, full filesystem/network/shell, window management | Trusted, ours |
| **Renderer** | Blink + V8 + DOM, one per `BrowserWindow`/`WebContentsView` | **UNTRUSTED — this renders user Markdown** |
| **Preload** | Node in a sandboxed context that can expose a narrow API via `contextBridge` | Ours, but runs adjacent to untrusted content |
| **GPU** | GPU rasterisation, shared | Chromium |
| **Utility** | `utilityProcess.fork()` — Node in a sandboxed, Node-API-only host | Our code, isolated |

A minimal app runs **main + at least one renderer + GPU process**. That is the
memory floor.

### The security model — done properly

The defaults are already right, which is a genuine and underrated achievement:

| Preference | Default | Since |
|-----------|---------|-------|
| `nodeIntegration` | `false` | **5.0.0** |
| `contextIsolation` | `true` | **12.0.0** |
| `sandbox` | `true` | **20.0.0** |
| `webSecurity` | `true` | always |
| `allowRunningInsecureContent` | `false` | always |

Critically, the docs warn about an interaction that is easy to get wrong:

> "*Disabling context isolation* (see above) *also disables process sandboxing*,
> regardless of the default, `sandbox: false` or globally enabled sandboxing!"

And, from checklist item 3:

> "**Even when `nodeIntegration: false` is used, to truly enforce strong
> isolation and prevent the use of Node primitives `contextIsolation` must also
> be used.**"

**Comparison to Tauri:** Tauri makes the *default* safe by construction (no JS
API at all unless a capability grants it). Electron makes the default safe by
*convention* (Node off unless you turn it on). Both are good; Tauri's is a
stronger design because it fails closed on new API surface, while Electron's
fails closed only because someone remembered.

### The full official security checklist

All 20 items from
[the security docs](https://www.electronjs.org/docs/latest/tutorial/security),
condensed with our relevance for a Markdown viewer:

| # | Recommendation | Ours |
|---|----------------|------|
| 1 | Only load secure content (HTTPS/WSS) | ✅ N/A — we load local |
| 2 | **Do not enable Node.js integration for remote content** | ✅ Critical. Never enable |
| 3 | **Enable context isolation** | ✅ Default. Verify in our `webPreferences` |
| 4 | **Enable process sandboxing** | ✅ Default since 20 |
| 5 | Use `session.setPermissionRequestHandler()` on all remote sessions | ✅ See snippet below |
| 6 | Do not disable `webSecurity` | ✅ Never |
| 7 | **Define a restrictive CSP** (`script-src 'self'`) | 🔴 **We must.** This is our XSS backstop |
| 8 | Do not enable `allowRunningInsecureContent` | ✅ |
| 9 | Do not enable `experimentalFeatures` | ✅ |
| 10 | Do not use `enableBlinkFeatures` | ✅ |
| 11 | `<webview>`: do not use `allowpopups` | ✅ We won't use `<webview>` |
| 12 | Verify `<webview>` options before creation | ✅ N/A |
| 13 | **Disable or limit navigation** | 🔴 **Critical for a viewer.** Markdown links must not navigate our window |
| 14 | **Disable or limit new window creation** | 🔴 Critical. `target="_blank"` in Markdown! |
| 15 | **Do not use `shell.openExternal` with untrusted content** | 🔴 **Critical.** This is the #1 Electron RCE vector in viewers |
| 16 | Use a current version of Electron | ✅ Ongoing cost (see §8) |
| 17 | **Validate the `sender` of all IPC messages** | 🔴 Critical |
| 18 | **Avoid `file://`; use custom protocols** | 🔴 Critical — this is the file:// pit |
| 19 | **Check which fuses you can change** | ✅ Use `@electron/fuses` |
| 20 | **Do not expose Electron APIs to untrusted web content** | 🔴 Critical — the classic preload bug |

Items 13–15 and 18 are the ones a Markdown viewer *specifically* must get right,
because Markdown is full of `[links](url)` and `![img](src)`. Let me show the
correct patterns, because this is the crux of Electron's security for us.

### Correct `BrowserWindow` configuration for a Markdown viewer

```js
// src/main/main.js
const { app, BrowserWindow, shell, ipcMain, session, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    // Do not show until the renderer paints, to avoid a white flash
    show: false,
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // The four that matter. All are defaults in 44.x; stated explicitly
      // because they are the ones a well-meaning PR will "helpfully" change.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Not a secret: leaks renderer URL to any inspected page. Keep false.
      webviewTag: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // --- 13. Limit navigation -------------------------------------------------
  // Markdown links must never navigate our own window.
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.origin !== 'app://viewer') {
      event.preventDefault();
      // Only open externally if it's a scheme we allow AND we validated it.
      if (isSafeExternalUrl(parsed)) openExternal(parsed);
    }
  });

  // --- 14 & 15. New windows + safe external opens ---------------------------
  win.webContents.setWindowOpenHandler(({ url }) => {
    const parsed = new URL(url);
    if (isSafeExternalUrl(parsed)) {
      setImmediate(() => openExternal(parsed));
    }
    // Never create a child BrowserWindow from untrusted content.
    return { action: 'deny' };
  });

  win.loadURL(isDev ? 'http://localhost:5173' : 'app://viewer/index.html');
  return win;
}

// 15. openExternal is an RCE primitive if you pass it user data.
const ALLOWED_PROTOCOLS = new Set(['https:', 'mailto:']);
const BLOCKED_HOSTS = [/^localhost$/i, /^127\./, /^\[?::1\]?$/, /^0\.0\.0\.0$/];

function isSafeExternalUrl(parsed) {
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  if (parsed.username || parsed.password) return false;   // credential phishing
  // Reject raw IPs and loopback: a Markdown link to http://127.0.0.1:PORT/
  // can reach a local dev server or a router admin page.
  if (BLOCKED_HOSTS.some((re) => re.test(parsed.hostname))) return false;
  return true;
}

function openExternal(parsed) {
  // Backstop: refuse anything that isn't http(s)/mailto even if a caller
  // passes a raw string.
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return;
  shell.openExternal(parsed.toString());
}
```

**`file://` — the trap (checklist 18).** The docs are explicit:

> "The `file://` protocol gets more privileges in Electron than in a web browser…
> Pages running on `file://` have **unilateral access to every file on your
> machine** meaning that XSS issues can be used to load arbitrary files from the
> users machine. Using a custom protocol prevents issues like this as you can
> limit the protocol to only serving a specific set of files."

So: **register a custom scheme**, never `loadFile`.

```js
// src/main/main.js — register BEFORE app.ready
const { protocol, net } = require('electron');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,       // gets origin semantics, so CSP/COOP work
      secure: true,          // treated as a secure context (crypto, service workers)
      supportFetchAPI: true,
      corsEnabled: false,    // we don't need cross-origin
      stream: true,          // range requests => <video> seeking
    },
  },
]);

app.whenReady().then(() => {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    // Only serve from our bundled dist. Nothing else. No traversal.
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const distDir = path.join(app.getAppPath(), 'dist');
    const target = path.resolve(distDir, rel);
    if (!target.startsWith(distDir + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
});
```

Then a **second, scoped protocol for user images** referenced by Markdown —
this is the equivalent of Tauri's asset protocol, and it is more work:

```js
// A separate privileged scheme for on-disk images, with an explicit
// allow-list of roots the user has actually opened. Never '*'.
protocol.registerSchemesAsPrivileged([{
  scheme: 'mdimg',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

app.whenReady().then(() => {
  protocol.handle('mdimg', async (request) => {
    const { pathname } = new URL(request.url);
    const filePath = decodeURIComponent(pathname);
    if (!allowedImageRoots.some((root) => isInside(root, filePath))) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
});
```

**Honest verdict: Electron's story here is worse than Tauri's.** Tauri gives you
`assetProtocol.scope` with globs, allow/deny, and dot-directory semantics as
*config*. Electron makes you write the protocol handler, the traversal guard,
and the root allow-list yourself, and get it right by hand. For a project whose
entire input is user-supplied files, that is a meaningful tax.

### IPC: `contextBridge`, `ipcMain.handle`, `ipcRenderer.invoke`

The preload script is the security boundary. The docs' example of what **not**
to do (checklist 20) is worth internalising:

```js
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// ❌ Bad — hands the renderer the whole IPC event system
contextBridge.exposeInMainWorld('electronAPI', {
  on: ipcRenderer.on,
});

// ❌ Also bad — IpcRendererEvent leaks `sender`
contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateCounter: (callback) => ipcRenderer.on('update-counter', callback),
});

// ✅ Good — narrow, explicit, no event object escapes
contextBridge.exposeInMainWorld('siyana', {
  readDocument: (path) => ipcRenderer.invoke('doc:read', path),
  watchDocument: (path) => {
    const ch = new MessageChannel();
    ipcRenderer.invoke('doc:watch', path).then((id) => {
      // Never forward the raw event object.
      ipcRenderer.on(`doc:changed:${id}`, (_event, payload) => ch.port1.postMessage(payload));
    });
    return ch.port1;
  },
  onOpenExternal: (cb) => ipcRenderer.on('app:open-external', (_e, url) => cb(url)),
});
```

Why the middle one is bad is stated in the docs: *"The first argument to IPC
event callbacks is an `IpcRendererEvent` object, which includes properties like
`sender` that provide access to the underlying `ipcRenderer` instance."* You
would be handing XSS the keys to the whole app.

On the main side, **always validate the sender** (checklist 17):

```js
const { ipcMain } = require('electron');

// ❌ Bad
ipcMain.handle('get-secrets', () => getSecrets());

// ✅ Good — validate the frame's ORIGIN, not its URL
ipcMain.handle('doc:read', async (event, path) => {
  if (!validateSender(event.senderFrame)) return null;
  return readMarkdown(path);
});

function validateSender(frame) {
  // Use origin, not URL: about:blank, blob: and sandboxed documents have
  // URLs that don't identify who controls them.
  if (frame && frame.origin === 'app://viewer') return true;
  return false;
}
```

The docs also warn to use Node's URL parser rather than string prefix checks:
*"a `startsWith('https://example.com')` test would let
`https://example.com.attacker.com` through."*

### `UtilityProcess`

`utilityProcess.fork()` spawns a **Node.js child in a Chromium-sandboxed,
Node-API-only host** — it gets `require` and Node APIs but *no* Chromium/Blink
and no DOM. This is the right place for CPU-heavy, untrusted-adjacent work.

**This is Electron's best answer to our actual problem.** Parsing a 100 MB
Markdown file and rendering it to HTML is exactly the workload that would
otherwise jank or hang the renderer. Put the parser in a utility process:

```js
// src/main/parser-host.js — runs in a utilityProcess
const { parentPort } = require('node:worker_threads');

parentPort.on('message', async ({ id, path, bytes }) => {
  try {
    const ast = parseMarkdown(bytes);          // heavy, synchronous, isolated
    const html = renderToSafeHtml(ast);         // sanitise HERE
    parentPort.postMessage({ id, ok: true, html });
  } catch (err) {
    parentPort.postMessage({ id, ok: false, error: String(err) });
  }
});
```

```js
// src/main/main.js
const { utilityProcess } = require('electron');
const child = utilityProcess.fork(path.join(__dirname, 'parser-host.js'));
child.postMessage({ id: 1, path: '/home/u/big.md' });
child.on('message', (msg) => { /* msg.html is already sanitised */ });
```

The same pattern in Tauri is just "do it in Rust", which is also isolated. But
Electron's version keeps the code in **JavaScript**, which matters enormously for
code reuse. See [07](07-hybrid-architectures.md).

### Fuses

`@electron/fuses` lets you permanently flip switches in the packaged binary, so
a user cannot undo your security posture via CLI flags:

```js
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

flipFuses({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
});
```

The docs' reason: *"Some fuses, like `runAsNode` and `nodeCliInspect`, allow the
application to behave differently when run from the command line… This can let
external scripts run commands on the device through your application."*
`RunAsNode: false` alone removes `ELECTRON_RUN_AS_NODE=1` as an RCE primitive.

**This is a real security advantage over the Tauri equivalent.** Tauri has no
equivalent fuse mechanism — its hardening is compile-time (capabilities) rather
than post-link.

### Security warnings in dev

Electron prints security warnings to the developer console when the binary is
named `Electron` (i.e. you're in dev). Force with
`ELECTRON_ENABLE_SECURITY_WARNINGS`. **We should treat any security warning in
CI as a build failure.** Cheap, high-value guardrail.

---

## 2. Bundle size — real, measured numbers

The most-cited Electron criticism is that a Hello World app is ~150 MB. Let me
give you the actual byte counts for the current version, pulled from the
Electron binary mirror rather than from a blog post.

**`electron-v44.5.1-*.zip` (the prebuilt runtime, before your app is even
added)** — from the [npmmirror Electron binary index](https://registry.npmmirror.com/-/binary/electron/v44.5.1/),
fetched 6 Oct 2026:

| Artefact | Bytes | Size |
|----------|------:|-----:|
| `electron-v44.5.1-win32-x64.zip` | 157,998,329 | **150.7 MB** |
| `electron-v44.5.1-win32-arm64.zip` | 156,452,332 | 149.2 MB |
| `electron-v44.5.1-linux-x64.zip` | 122,932,200 | **117.2 MB** |
| `electron-v44.5.1-linux-arm64.zip` | 124,016,190 | 118.3 MB |
| `electron-v44.5.1-darwin-x64.zip` | 134,208,970 | 128.0 MB |
| `electron-v44.5.1-mas-arm64.zip` | 129,355,605 | 123.4 MB |
| `ffmpeg-v44.5.1-linux-x64.zip` | 1,508,097 | 1.4 MB |
| `hunspell_dictionaries.zip` | 34,144,908 | 32.6 MB |
| `libcxx-objects-v44.5.1-linux-x64.zip` | 5,751,545 | 5.5 MB |

**So the "150 MB" figure is accurate — but it is the *compressed zip* of the
runtime, measured today, on Windows x64.** That is the floor for any Electron
app. Your application code, your HTML/JS/CSS bundle, your syntax highlighter
themes, and your fonts are all *additional*.

The `@electron/packager` README confirms the relationship:

> "Note that packaged Electron applications can be relatively large. A zipped,
> minimal Electron application is approximately the same size as the zipped
> prebuilt binary for a given target platform, target arch, and Electron
> version."

**What compression and packaging actually gets you:**

| Format | Realistic size for a small app | Notes |
|--------|-------------------------------|-------|
| Unpacked (`dir` target) | ~180–260 MB | The honest baseline. Uncompressed Chromium |
| Zip | ~150–175 MB | Close to the prebuilt runtime |
| NSIS installer | ~90–110 MB | LZMA compresses well; includes uninstaller |
| MSI | ~95–115 MB | |
| macOS `.app` | ~200–280 MB | Universal or separate arch binaries double it |
| DMG | ~90–110 MB | Compressed |
| AppImage | ~100–130 MB | |
| Snap | ~100–140 MB | |
| Flatpak | ~120–200 MB | Depends on runtime choice |

**Pruning levers, and their honest ceilings:**

| Lever | Saving | Reality |
|-------|--------|---------|
| Remove unused locales (`electron_locales`) | 5–15 MB | Real, easy |
| Remove `*.pdb` / symbol files | 10–30 MB | Usually already excluded |
| `asar` your app | 0 (no size change) | **Does not shrink the runtime.** Common misconception |
| `electron-builder` `files` allow-list | 1–5 MB | Only affects *your* code |
| `--prune` dependencies | 1–20 MB | Only your deps |
| Use `electron-builder --dir` and ship unpacked | N/A | Bigger download, faster start |
| Replace the runtime entirely | ~120 MB | i.e. don't use Electron |

**Conclusion: there is no way to get an Electron app under ~90 MB.** The
runtime is the floor. This is architectural, not a tuning problem.

**For our project specifically**, this is not fatal. A Markdown viewer with a
syntax-highlighting theme set might legitimately be 100–160 MB installed, and
users of desktop apps expect that. But it *is* a real cost on Linux, where
distro mirrors and Flathub have size conventions, and on metered connections.

---

## 3. Memory footprint

**Same honesty rule as the Tauri document: no reproducible third-party
benchmark exists for a Markdown-viewer workload.** The commonly cited figures
("a basic Electron app uses ~150–250 MB", "Tauri ~50 MB") are **widely
repeated but unsourced**.

What we can state from the architecture:

- Electron's floor is main process + 1 renderer + GPU process. Each renderer is
  a real Blink/V8 renderer with its own JS heap, layout tree, and paint buffers.
- Chromium's shared libraries (`.pak`, `libGLESv2`, `icudtl.dat` — the latter is
  ~30 MB of ICU data) are **mapped per app instance**, not shared with the
  user's browser, because they are loaded from the app's own directory.
- `hunspell_dictionaries.zip` is 32.6 MB on disk; whether it is paged in depends
  on use. A spellchecker in a Markdown viewer would pull it in. **We should not
  ship a spellchecker unless we need one.**

**Measurement protocol** (same as §"Measuring, not guessing" in the Tauri doc —
use it identically so the numbers are comparable):

```bash
# ELECTRON — sum the whole process tree, since the renderer is the memory
# user cares about and it is a *separate process* you will otherwise miss.
ps -o pid,rss,comm -C siyana-markdown-viewer        # Linux
tasklist /FI "IMAGENAME eq siyana-markdown-viewer.exe" /FO CSV   # Windows
```
On Windows the renderer will show as multiple `siyana-markdown-viewer.exe`
processes. **Sum them.** Reporting only the main process understates Electron by
roughly half — a very common error in blog comparisons.

Report **private** memory (commit) alongside working set, because working set
over-credits shared pages and would flatter whichever framework leans harder on
shared libraries.

**Concrete advice:** a Markdown viewer must be careful with Electron regardless
of framework, because Chromium renderers balloon if we naively put a 100 MB
document into the DOM. Mitigations that apply to both Electron and Tauri:
virtualise the rendered blocks, keep the DOM to what is visible, and parse off
the main thread. See [10 performance](../10-performance/). **The framework
choice does not save us from this; only the architecture does.**

---

## 4. Startup time

**No sourced measurement found.** The commonly repeated "Electron starts in
~1s, Tauri in ~100ms" figures are **unsourced**. Mechanistically the claim is
plausible — Electron must initialise Node, spin up a GPU process, and boot a
full Chromium renderer, whereas Tauri boots an already-running OS component —
but we will not put a number on it without measuring.

**Also note:** Electron's startup is not just slow, it is *warm-up sensitive*.
The first window often paints before the GPU process is ready, causing a
white flash. This is why the `show: false` + `ready-to-show` pattern above
matters. Under Wayland, Linux Electron apps are notably slower to first paint
than X11, which is another reason to build and measure on the target compositor.

**Our metric should be time-to-first-painted-document, not
`did-finish-load`** (which fires before paint) and not `app.whenReady()` (which
knows nothing about our renderer).

---

## 5. Maintenance reality — the upgrade treadmill

This is Electron's defining structural characteristic and the reason many teams
that start on Electron do not stay.

**The cadence, from the official schedule** ([releases.electronjs.org/schedule](https://releases.electronjs.org/schedule)):

> "Electron's cadence between major version releases is **8 weeks** long. Before
> each major version hits stable, it goes through a four-week **alpha** phase and
> a four-week **beta** phase."

Confirmed by the schedule table: Electron 43 stable 30 Jun 2026, 44 stable
25 Aug 2026, 45 stable 20 Oct 2026. **Roughly 6–7 major versions per year.**

**The Chromium consequence:** *"Electron targets Chromium even-number versions,
releasing every 8 weeks in concert with Chromium's 4-week release schedule."*
Electron 44 = Chromium **M152**. Every 8 weeks we jump **8 Chromium major
versions**. That is enormous churn in the rendering engine underneath our
renderer.

**The Node consequence:** *"Electron upgrades its `main` branch to even-number
versions of Node.js when they enter Active LTS."* Electron 44.5.1 ships Node
24.21.0. Node majors also move on a ~1-year cycle, so we get a Node major
bump every ~4 Electron majors.

**The breaking-change policy, verified:**

> "When an API is changed or removed in a way that breaks existing functionality,
> the previous functionality will be supported for a **minimum of two major
> versions** when possible before being removed… Past the minimum two-version
> threshold, we will attempt to support backwards compatibility beyond two
> versions until the maintainers feel the maintenance burden is too great."

This is genuinely good practice — we get ≥2 majors (≈16 weeks) of deprecation.
But "breaking changes to *our* code" is the bigger axis: Chromium deprecations
(removed CSS, removed JS APIs, changed defaults) land inside our renderer
whether or not Electron's *Node API* changed.

**What this costs in practice (inference grounded in the cadence data):**

| Cost | Estimate | Basis |
|------|----------|-------|
| Per-major upgrade, small app | 0.5–2 days | 6 majors/yr × 1 day ≈ 1 week/yr |
| Per-major upgrade, app with native modules | 2–5 days | Plus `electron-rebuild` verification |
| Chromium visual/CSS regressions | ~1 per 2–3 majors | Requires visual regression tests |
| Node API deprecation fixes | ~1 per 3–4 majors | Read the breaking-changes doc each time |
| **Total steady-state** | **~15–20% of one developer's time** | 6–7 majors/year |

Compare Tauri at ~1 feature release per quarter with **no forced major
migration** — we could plausibly stay on 2.x for two years.

**The counter-argument, and it is strong:** during those 8-week cycles we are
*not* waiting for Electron's security fixes. A Chromium CVE is patched in
Electron 8 weeks later, and we ship it 8 weeks later. On a desktop app that
displays untrusted content, **being on an old Chromium is a security liability of
exactly the kind this project's threat model cares about.** Tauri's equivalent
risk is *worse in a different way*: the WebView2 version on the user's machine is
outside our control entirely (see [01-tauri.md §15](01-tauri.md)).

**Honest framing: Electron's treadmill is a maintenance cost. Tauri's webview is
a security uncertainty. Neither is free; they are different currencies.**

---

## 6. EOL policy — verified

From the [release policy docs](https://www.electronjs.org/docs/latest/tutorial/electron-timelines):

> "**The latest three _stable_ major versions are supported by the Electron
> team.** For example, if the latest release is 42.1.x, then the 41.0.x as well
> as 40.2.x series are supported. We only support the latest minor release for
> each stable release series."

And the tiering:

> "The latest stable release unilaterally receives all fixes from `main`, and
> the version prior to that receives the vast majority of those fixes as time
> and bandwidth warrants. The oldest supported release line will receive **only
> security fixes** directly."

Verified against the schedule as of 6 Oct 2026:

| Major | Stable | EOL | Supported today? |
|-------|--------|-----|-----------------|
| 46 | 5 Jan 2027 | 22 Jun 2027 | No (alpha) |
| 45 | 20 Oct 2026 | 27 Apr 2027 | Beta |
| **44.5.1** | 25 Aug 2026 | **2 Mar 2027** | ✅ **Current stable** |
| 43 | 30 Jun 2026 | 5 Jan 2027 | ✅ Supported |
| 42 | 5 May 2026 | **20 Oct 2026** | ✅ Supported — **EOL in 2 weeks** |
| 41 | 10 Mar 2026 | 24 Aug 2026 | ❌ **EOL — already past** |

**Confirmed: three most recent stable majors.** And there is a **two-week
deadline**: if we ship on Electron 42 we must upgrade within a fortnight. That
is a concrete, dated obligation, and a good illustration of what the treadmill
actually means.

Historical note from the same page: *"Electron temporarily extended support for
Electron 22 until October 10, 2023, to support an extended end-of-life for
Windows 7/8/8.1."* So Windows 7 support is long gone — matching Tauri's 2.12.0
drop.

---

## 7. Packaging, signing, and updates

### electron-builder

`electron-builder@26.15.3` (9 Jun 2026) is the incumbent. A config for Siyana:

```jsonc
// electron-builder.yml
appId: app.siyana.markdown-viewer
productName: Siyana Markdown Viewer
copyright: Copyright © 2026 Siyana contributors

directories:
  output: dist
  buildResources: build

# Only our code. Everything else is trimmed.
files:
  - dist/**/*
  - package.json
  - '!**/*.map'
  - '!**/{.eslintrc,.editorconfig,.prettierrc,.nycrc}'
  - '!**/{test,__tests__,docs}/**'

asar: true
# Harden the packaged binary itself.
electronFuses:
  runAsNode: false
  enableCookieEncryption: true
  enableNodeOptionsEnvironmentVariable: false
  enableNodeCliInspectArguments: false
  enableEmbeddedAsarIntegrityValidation: true
  onlyLoadAppFromAsar: true

win:
  target:
    - target: nsis
      arch: [x64, arm64]
    - target: msi
      arch: [x64]
  # SmartScreen reputation: start unsigned-clean, get a reputation, then sign.
  signAndEditExecutable: true
  artifactName: ${productName}-${version}-${arch}.${ext}
  publisherName: Siyana Contributors

nsis:
  oneClick: false                 # let users choose install scope
  perMachine: false               # default to user install => no admin needed
  allowToChangeInstallationDirectory: true
  differentialPackage: false      # shrinks installer; we already have our own updater

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

dmg:
  # Apple notarisation requires a notarised, signed .dmg
  notarize: true

linux:
  target:
    - target: AppImage
      arch: [x64]
    - target: deb
      arch: [x64]
    - target: rpm
      arch: [x64]
    - target: snap
      arch: [x64]
  category: Office
  synopsis: Read and organise Markdown
  desktop:
    entry:
      Name: Siyana Markdown Viewer
      MimeType: text/markdown;text/x-markdown;
  # Never ship a blob. This is a security and size win.
  executableName: siyana-markdown-viewer

deb:
  depends:
    - libgtk-3-0
    - libnotify4
    - libnss3
    - libxss1
    - libxtst6
    - xdg-utils
    - libatspi2.0-0
    - libsecret-1-0

snap:
  # Confined snap = strong sandbox, but needs the right plugs
  confinement: strict
  plugs: [default, home, network, removable-media]

npmRebuild: false                 # we handle native modules explicitly
buildDependenciesFromSource: false

publish:
  provider: github
  owner: siyana
  repo: markdown-viewer
```

**Note on `npmRebuild: false`:** if we ever add a native module, setting this
false stops electron-builder from silently rebuilding it against the wrong
Electron ABI. We prefer to fail loudly and run `electron-rebuild` in CI
explicitly.

### electron-forge

`electron-forge@5.2.4` — **last published January 2019** per the npm registry.
It is effectively **unmaintained**. The official docs still link to
[electronforge.io](https://electronforge.io), which is misleading. **Use
electron-builder.** This is a good example of why we verify: the "official"
recommendation in the docs nav points at a seven-year-dead package.

### Native modules and `electron-rebuild`

A native module must be compiled against **Electron's headers and ABI**, not
Node's. Node 24.21.0 in Electron 44 means a module built for `node` fails to
load. `electron-rebuild` handles this:

```bash
# Every time we bump Electron
npx electron-rebuild -f -w siyana-markdown-viewer
```

Or in `package.json`:
```json
{
  "scripts": {
    "postinstall": "electron-builder install-app-deps",
    "rebuild": "electron-rebuild -f -w siyana-markdown-viewer"
  }
}
```

**This is a genuine, ongoing tax.** Native modules must be rebuilt after every
Electron major, and prebuilt binaries for Electron 44 may not exist for the
Node ABI it uses, forcing a source build with a full toolchain on each
contributor's machine and in CI.

**My strong advice for Siyana: use zero native modules.** Everything a Markdown
viewer needs — file watching, dialogs, shell-out, clipboard, PDF via headless
print — has a pure-JS or zero-dependency path. Avoiding native modules removes
an entire class of "works on my machine" failures *and* removes the rebuild step
from every future Electron upgrade. This is worth more than any single feature.

### `autoUpdater` and the signing requirements

Electron's `autoUpdater` is **not a built-in updater** — it is a thin
abstraction with different backends per platform, and it does **not** ship a
server.

| Platform | Backend | What Electron gives you |
|----------|---------|------------------------|
| Windows | Squirrel.Windows | Downloads `RELEASES`/`.nupkg`, applies |
| macOS | Squirrel.Mac / `MacUpdater` | Sparkle-based, needs a `appcast.xml` |
| Linux | **Nothing built in** | ❌ Must implement or use a third party |

**Linux is the sharp edge. Electron has no `autoUpdater` on Linux.** Options:
`electron-updater` (community), a plain HTTPS check + `app.relaunch()`, or
self-hosting. Since we already need Linux self-update, this is a real chunk of
work that Tauri's updater plugin gives us for free on **all five platforms
including Android and iOS**.

**Windows code signing is effectively mandatory for auto-update to work
usefully.** Two reasons:

1. **SmartScreen.** Unsigned Windows executables trigger the "Windows protected
   your PC" interstitial. Users click through or they don't install. Worse, our
   *update* executable is a new, unsigned binary every time — SmartScreen treats
   each update as a new file. Reputation builds slowly; some organisations
   block unsigned outright.
2. **Signature validation.** Many auto-update chains verify the downloaded
   package's signature against the running app's. Without signing, either the
   check is skipped (insecure) or the update is refused (broken).

The Windows signing story is documented at
[/distribute/windows-installer](https://v2.tauri.app/distribute/windows-installer/)
for Tauri and is equally required here. Practical cost: an EV code-signing
certificate runs **~$100–500/year**, and it must be on a hardware token or in a
CI secret store. Signing has also been progressively more expensive as
certificate authorities consolidated.

**macOS requires both signing AND notarisation** for distribution outside the
App Store — Apple requires an Apple-issued Developer ID plus a notarisation
ticket from Apple's notary service, which requires successfully uploading and
passing automated checks. Both are documented and both are effectively
mandatory. Plus: macOS apps must be **both x64 and arm64** now, or you lose half
your users.

**Summary of the signing/update story:**

| | Tauri | Electron |
|---|---|---|
| Built-in updater | ✅ All 5 platforms | ⚠️ Win + mac only |
| Update signature | ✅ **Mandatory**, cannot disable (minisign) | ⚠️ Your responsibility |
| Win signing | Required for distribution | Required for distribution *and* updates |
| mac notarisation | Required | Required |
| Linux | ✅ Included | ❌ DIY |
| Server needed | Static JSON works | Squirrel/electron-updater, or DIY |

**Tauri's updater is materially better and it is not close.** Mandatory
signing of update artifacts by default is a security property Electron simply
does not have.

---

## 8. Linux support quality

**Electron's Linux support is far more mature and far less fragile than Tauri's.**
This is its single strongest argument, and for a Linux-first project it deserves
weight.

| | Electron | Tauri |
|---|---|---|
| Runtime dependencies | GTK3, NSS, X11/Wayland — **present on essentially every desktop distro** | **WebKitGTK 4.1 — absent on RHEL 8/9 and anything still on 4.0** |
| Chromium version | **Identical on every platform** (152.0.7977.130) | Whatever the OS has — years apart |
| Wayland | Supported, increasingly default | Works, GTK4 path, more rough edges |
| Package formats | AppImage, deb, rpm, snap, Flatpak | AppImage, deb, rpm, snap, Flatpak, AUR |
| glibc floor | Build on old base (same problem as Tauri) | Same |
| Rendering consistency | **Perfect** | Fragmented |
| Missing system libs | Rare | Common (webkit2gtk, ayatana-appindicator) |

**Where Electron's Linux story still hurts:**
- **glibc floor** — identical problem to Tauri. Build on `ubuntu-22.04`.
- **Wayland first-paint is slower** than X11. Worth measuring.
- **snap confinement is painful** — a file viewer needs the `home` interface;
  confinement is strict by default and each plug is a policy negotiation.
- **Flatpak is the cleanest path** but sandboxing means `xdg-open` of files
  outside the sandbox needs `--talk-name=org.freedesktop.FileManager1` or the
  `xdg-desktop-portal` Document Portal. Real work.

**The decisive advantage: Chromium 152 rendering on every platform.** For a
Markdown viewer whose whole product is *typography and CSS*, having identical
rendering on Windows, Linux, macOS and web — from the same runtime version —
removes an entire class of bug. Tauri cannot promise this at any price.

---

## 9. Debugging — the best in class

This is Electron's most underrated strength and it deserves more than a line.

**Chrome DevTools, fully featured.** In our renderer: Elements with live CSS,
the computed-style pane, the full Performance profiler with flame charts, the
Memory heap-snapshot tool with allocation timeline, Network with request
blocking, the Application panel for localStorage/IndexedDB, and **source maps**
so we debug TypeScript directly. Tauria's `Nebula` is a Chromium DevTools
fork, so this is closer than the comparison usually implies — but Electron gets
it with zero setup and it is the *same* DevTools every frontend developer
already knows.

**Node debugging is first-class.** `--inspect`, `node --inspect-brk`, VS Code's
automatic attach to the main process, and `--remote-debugging-port` to attach a
second DevTools client. Rust debugging in Tauri requires CodeLLDB and a
deliberate setup; Node debugging in Electron is a checkbox.

**`ELECTRON_ENABLE_SECURITY_WARNINGS`** prints security misconfigurations to the
console automatically. We should fail CI on these.

**Playwright has first-class Electron support:**

```js
// tests/e2e/app.spec.ts
import { _electron as electron } from 'playwright';

test('renders a hostile Markdown file safely', async () => {
  const app = await electron.launch({ args: ['src/main/main.js'] });
  const win = await app.firstWindow();
  await win.waitForSelector('[data-testid=doc-body]');

  // Real file dialog interception, real IPC, real renderer.
  await app.evaluate(async ({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, '/tmp/hostile/xss.md');

  // A <script> in the Markdown must NOT execute.
  const alerts = await win.evaluate(() => window.__alertsSeen);
  expect(alerts).toEqual([]);
});
```

**This is materially better than Tauri.** Tauri offers `tauri-driver`
(WebDriver, crate 2.1.0) plus WebdriverIO/Selenium — which works, but is a
generation behind Playwright and cannot test the Rust side.

**Our testing story is therefore much better on Electron**, and since we will
lean heavily on E2E tests for Markdown correctness (XSS, table rendering, edge
cases across hundreds of CommonMark fixtures), that is not a minor advantage.

---

## 10. Known strengths, consolidated

| Strength | Detail | Why it matters to us |
|----------|--------|---------------------|
| **Perfect rendering consistency** | Chromium 152.0.7977.130 on every platform, plus we get a real browser for the web target | Removes a whole class of visual bugs. Markdown is CSS |
| **One renderer for three targets** | Desktop, browser, and (via Capacitor) mobile all run the *same* HTML/JS/CSS | Directly serves our reuse priority |
| **Best debugging in the industry** | Full DevTools + Node inspector + Playwright Electron | Our test strategy depends on this |
| **Mature auto-update ecosystem** | `electron-updater`, Squirrel — even if Linux needs DIY | Not great, but it exists |
| **Enormous ecosystem** | Thousands of packages, `awesome-electron`, active maintainers | We will find anything else we need |
| **Node.js in main** | Mature, huge, and our existing JS skills transfer | |
| **Mature Linux support** | All formats, all major distros, no exotic deps | Decisive for Linux-first |
| **Documented, enforced security** | 20-item checklist + fuses + in-dev warnings | Security is our #1 criterion |
| **Predictable APIs** | Frequent breaking changes, but ≥2 majors of notice and a canonical breaking-changes doc | The treadmill is annoying but not chaotic |
| **Stable governance** | OpenJS Foundation, @electron/maintainer-team, Open Collective | Low vendor risk |
| **Sandbox + fuses** | `RunAsNode: false` etc. — hardening impossible in Tauri | Real security edge |

---

## 11. Known weaknesses, consolidated

| Weakness | Detail | Severity for us |
|----------|--------|-----------------|
| **~150 MB floor** | Measured 150.7 MB zip (win-x64), 117.2 MB (linux-x64) today | High on Linux mirrors; acceptable for a desktop utility |
| **High memory** | main + renderer + GPU; unmeasured but structurally higher | Medium — mitigate with virtualised DOM |
| **8-week majors** | 6–7/year; 3-majors EOL means a **2-week window** if we ship 42 today | High — real ongoing cost |
| **Chromium jumps** | +8 Chromium majors every 8 weeks; CSS/JS deprecations land in our renderer | Medium-high |
| **No Linux autoUpdater** | Must implement or adopt `electron-updater` | Medium-high |
| **Signing required everywhere** | Win cert ~$100–500/yr; macOS notarisation mandatory | Medium — cost, not difficulty |
| **XSS → RCE risk** | One preload mistake hands the renderer `ipcRenderer` | **High if mishandled**; well-documented mitigations |
| **Native module tax** | `electron-rebuild` per major | Avoidable — use zero native modules |
| **`file://` is dangerous** | Docs: pages on `file://` can read every file | Avoidable — custom protocol |
| **`shell.openExternal` RCE** | Checklist item 15, specific to viewers with links | Avoidable — allow-list + validate |
| **Chromium CVE treadmill** | Security depends on upgrading promptly | **Genuine security risk if we lag** |
| **electron-forge is dead** | Last release Jan 2019, still in official docs nav | Use electron-builder |

---

## 12. Scorecard for Siyana

| Dimension | Rating | Note |
|-----------|--------|------|
| Security model | **Excellent if followed** | 20-item checklist + fuses + defaults. Mismanaged = RCE |
| Bundle size | **Poor** | 150.7 MB measured floor. Unavoidable |
| Memory | **Fair–good** | Structurally higher. Measure |
| Startup | **Fair** | Slower. Measure |
| Cross-platform consistency | **Perfect** | Chromium 152 everywhere |
| Linux coverage | **Excellent** | No exotic deps. All formats |
| Packaging / signing / update | **Good but work** | electron-builder + DIY Linux updates + certs |
| Code reuse (desktop+web+mobile) | **Excellent** | One renderer + Capacitor |
| Debugging / testing | **Best in class** | DevTools + Playwright Electron |
| Learning curve | **Low** | JS/TS throughout; zero Rust |
| Ecosystem | **Excellent** | Largest of any candidate |
| Licensing | **Excellent** | MIT |
| Viability | **Excellent** | OpenJS Foundation, best-resourced |
| Maintenance cost | **Poor** | The 8-week treadmill is real |

**Electron's weakness for us is not any single property — it is the sum of
150 MB, higher memory, a 6–7×/year upgrade treadmill, and DIY Linux updates,
paid for the privilege of maximum code reuse.** Whether that trade is right
depends entirely on how much we value reuse, which is exactly the question
[`07-hybrid-architectures.md`](07-hybrid-architectures.md) tries to quantify.
