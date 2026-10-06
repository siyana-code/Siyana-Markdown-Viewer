# 02 — Linux

> Linux is not one platform. It is six packaging systems, three display
> protocols, four webview API versions, and a filesystem whose behaviour depends
> on a mount flag. This document is an inventory of that.

Legend: ✅ **VERIFIED** (primary source linked) · 🟡 **UNVERIFIED** (community
report / our inference) · 🔧 **RECOMMENDED** (our decision)

---

## 1. The webview fragmentation problem

### 1.1 What Tauri v2 actually requires

✅ **VERIFIED** — Tauri v2 uses **WebKit2GTK 4.1**. The main difference from 4.0
is the soup library: *"WebKit2GTK-4.0 uses soup2 and WebKit2GTK-4.1 uses soup3"*,
and Tauri moved to 4.1 from `v2.0.0-alpha.3` onward
([Tauri — Migration to webkit2gtk-4.1](https://v2.tauri.app/blog/tauri-2-0-0-alpha-3/)).

The **official** Debian/Ubuntu dependency list
([Tauri — Prerequisites](https://v2.tauri.app/start/prerequisites/), page last
updated 2026-08-20) is:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```text

Note what is *not* there: `libgtk-3-dev`, `patchelf`, `libappindicator3-dev`.
Those come in transitively. 🟡 And note `libayatana-appindicator3-dev` declares
`Conflicts:` against Canonical's deprecated `libappindicator3-dev`, so installing
both fails — several projects have hit this
([community report](https://github.com/Manwe-777/pid-tuna/commit/b350fd510ab6824b0e134af154f70c8ccdda4607)).

🔧 **RECOMMENDED.** Put this exact list in `docs/CONTRIBUTING.md` and in a
`make doctor` target that runs `pkg-config --modversion webkit2gtk-4.1` and prints
the version it found. Do not paraphrase it.

### 1.2 What each distro calls it — verified, do not guess

| Distro | Dev package | Runtime package |
|--------|-------------|-----------------|
| Debian / Ubuntu | `libwebkit2gtk-4.1-dev` | `libwebkit2gtk-4.1-0` |
| Fedora | `webkit2gtk4.1-devel` | `webkit2gtk4.1` |
| Arch | `webkit2gtk-4.1` (AUR/upstream, in `extra`) | same |
| openSUSE | ⚠️ Tauri docs list `webkit2gtk3-devel` — see note | |
| Alpine | `webkit2gtk-4.1-dev` | |
| Gentoo | `net-libs/webkit-gtk:4.1` | |
| NILinuxOS / rpm-ostree | `webkit2gtk4.1-devel` | |
| macOS (for cross-checks) | `brew install webkit2gtk-4.1` | |

Sources: [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for
Debian/Arch/Fedora/Gentoo/rpm-ostree/openSUSE/Alpine.

⚠️ **openSUSE note.** The official Tauri page lists `webkit2gtk3-devel` and
`libayatana-appindicator3-1` for openSUSE, which is **inconsistent with the 4.1
requirement** stated elsewhere on the same page. 🟡 This looks like a stale
entry. 🔧 Until we verify it against zypper ourselves, do not copy that line into
our docs; probe with `zypper se webkit2gtk` on a real openSUSE Leap/Tumbleweed
image.

### 1.3 Which distro version ships what — verified from packages.ubuntu.com

✅ **VERIFIED** — Querying `https://packages.ubuntu.com/search?keywords=libwebkit2gtk`:

| Suite | `libwebkit2gtk-4.0-dev` | `libwebkit2gtk-4.1-0` |
|-------|--------------------------|----------------------|
| **jammy (22.04 LTS)** | ✅ present, `2.50.4-0ubuntu0.22.04.1` (security); `2.36.0-2ubuntu1` on ports | ✅ present **in `universe`**: `2.36.0-2ubuntu1` (ports), `2.50.4-0ubuntu0.22.04.1` (security) |
| **noble (24.04 LTS)** | ❌ `libwebkit2gtk-4.0-doc` is now a *"WebKitGTK documentation (transitional dummy package)"* — the 4.0 series is retired | ✅ `2.52.6-0ubuntu0.24.04.1` (security); `2.44.0-2` on ports |
| **questing (25.10)** | ❌ retired | ✅ `2.52.3-0ubuntu0.25.10.1` |

Three consequences, all important:

1. 🔴 **Ubuntu 22.04's WebKitGTK is 2.36.0.** That is *January 2023*. Any CSS or
   Web API from 2023–2026 is missing. `content-visibility` (Safari 18 /
   WebKit ~2.48) is **absent**. This is the single most important compatibility
   fact in this document.
2. 🔴 **Ubuntu 22.04's `libwebkit2gtk-4.1-0` lives in `universe`.** A minimal
   server or a locked-down image without `universe` enabled will say
   `E: Unable to locate package libwebkit2gtk-4.1-dev`. Our docs must say
   "enable `universe`" for 22.04, not just "apt install".
3. ✅ **Ubuntu 24.04 → WebKitGTK 2.52.6**, which is recent enough for
   `content-visibility`. So on a modern Ubuntu our optimal long-document CSS
   works, and on the oldest supported Ubuntu it does not.

For reference, upstream ✅ **VERIFIED** — the current WebKitGTK release as of
2026-10-02 is **2.54.1**, *"the first bug fix release in the stable 2.54 series"*
([webkitgtk.org](https://webkitgtk.org/2026/10/02/webkitgtk2.54.1-released.html)).
So the newest Ubuntu LTS user is roughly **one year behind** upstream.

### 1.4 GTK3 vs GTK4

WebKitGTK ships two API generations:

- **`webkit2gtk-4.0` / `4.1`** → GTK 3. API version distinguishes the *soup*
  version, not the GTK version.
- **`webkitgtk-6.0`** → GTK 4. ✅ **VERIFIED** — the Jammy package list shows
  `gir1.2-webkit-6.0` alongside `gir1.2-webkit2-4.0`.

✅ **VERIFIED** — Tauri v2's GTK dependency is GTK 3 (`wry` embeds
`WebKitWebView` from `libwebkit2gtk-4.1`). So Tauri is a GTK3 app. Electron, by
contrast, bundles Chromium and is GTK3/GTK4 agnostic — it does not use
WebKitGTK at all. 🟡 Tauri v3 is expected to move to the GTK4 / `webkitgtk-6.0`
API; not verifiable as of writing, so treat as unknown.

### 1.5 What happens when the webkit version is missing

This is not one failure, it is three, at three different times:

| When | Symptom | Root cause |
|------|---------|------------|
| **Build time** | `error: Could not find system library 'javascriptcoregtk-4.1' pkg-config` from `wry`'s build script | `libwebkit2gtk-4.1-dev` not installed, or `PKG_CONFIG_PATH` wrong |
| **Build time (wrong API)** | `pkg-config --modversion webkit2gtk-4.1` returns nothing but `webkit2gtk-4.0` does | Someone followed a Tauri **v1** guide; 🟡 v1 wanted 4.0 |
| **Run time** | App exits immediately, no window, no error message on some distros | `dlopen` of `libwebkit2gtk-4.1.so.0` fails; `wry` has no graceful fallback |

🔴 **The run-time case is the "app won't launch on Ubuntu 22.04" problem.** The
canonical shape of the bug report is: *"works on my machine, works on Ubuntu
24.04, does nothing on Ubuntu 22.04"* — because the developer has a recent
WebKitGTK and the user's machine has 2.36.0 or nothing at all.

🔧 **RECOMMENDED** defences, in order of value:

1. **Ship a runtime preflight check.** Before creating the window, `dlopen` the
   expected `.so` (or ask the webview to construct and catch). On failure, show a
   native message box (not a webview — the webview is what is missing) saying
   exactly which package to install, with a copy-to-clipboard command per distro.
2. **Never bundle WebKitGTK.** Bundling a 300 MB engine into an AppImage would
   fix this but create a worse problem: an engine that is never patched, and a
   300 MB download. See §2 on Flatpak, which is the *correct* answer to this
   problem, not bundling.
3. **Put the minimum supported distro in the download page's first line.** Not in
   the FAQ. In the first line.

### 1.6 `libxdo`, `libayatana-appindicator3`, `librsvg2` — why they exist

- **`libxdo`** — `wry` links `-lxdo` (the X11 "do" library) for `libxdo` /
  `global-keyboard` style features. 🟡 Missing it yields
  `/usr/bin/ld: cannot find -lxdo`. This was a **documentation gap** in Tauri
  fixed in 2024 after users filed
  [tauri-docs issue #2230](https://github.com/tauri-apps/tauri-docs/issues/2230).
- **`libayatana-appindicator3`** — the maintained fork of Ubuntu's deprecated
  `libappindicator3`, providing the tray-icon protocol on GTK3.
- **`librsvg2`** — SVG icon rendering for the bundle's default icons.

None of these are optional. 🔧 `make doctor` should `pkg-config --exists` each of
`webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`, `ayatana-appindicator3-0.1`,
`librsvg-2.0`, `xdo` and report all failures at once, not one at a time.

---

## 2. X11 vs Wayland

### 2.1 What actually happens under Wayland

✅ **VERIFIED** — WebKitGTK's Wayland support required a **nested compositor**
inside the UI process: *"The way to share composited frames with the UI process
was X11 specific, so when Wayland support was introduced we had to find a
different way. For Wayland we added a nested compositor running in the UI
process"*
([WebKit docs — Graphics, WebKitGTK and WPE WebKit](https://docs.webkit.org/Ports/WebKitGTK%20and%20WPE%20WebKit/Graphics.html)).

✅ **VERIFIED** — In WebKitGTK **2.39.1** (Nov 2022) they *"Remove internal
nested wayland compositor making libwpe mandatory when building with wayland
enabled"* ([webkitgtk.org 2.39.1 release notes](https://webkitgtk.org/2022/11/11/webkitgtk2.39.1-released.html)).

🔴 **The consequence that matters:** a WebKitGTK app under Wayland is doing more
work and has more failure modes than the same app under X11 — EGL buffers,
nested-compositor round-trips, and (per the WebKitGTK/Wayland design page) issues
such as *"Wayland-egl does not support pixmaps so we should try to use pbuffers"*
and fullscreen video not being implemented because `waylandsink` from
`gst-plugins-bad` *"does not implement the video overlay interface"*
([trac.webkit.org WebKitGTK/Wayland](https://trac.webkit.org/wiki/WebKitGTK/Wayland)).

### 2.2 GTK4 Wayland and what it means for us

🟡 **UNVERIFIED.** GTK 4's native Wayland backend has matured substantially
through the 4.10–4.20 cycle (2023–2025), but a broad set of GTK 4 applications
still require XWayland for specific features. Since Tauri v2 is a GTK3 app, this
is not our direct problem — but it means **"we are Wayland-native" is not a claim
we can make**, and we should not put it on the download page.

### 2.3 The flags people will tell you to use (and which ones are ours)

- 🔴 **`--ozone-platform-hint` is a Chromium/Electron flag.** It has no effect on
  WebKitGTK. If a forum tells you to set it, they are debugging an Electron app.
  For a Tauri/WebKitGTK app the equivalent is `GDK_BACKEND=x11` or
  `GDK_BACKEND=wayland`.
- 🔴 **`WEBKIT_DISABLE_DMABUF_RENDERER=1`** — this is a real, frequently-recommended
  workaround for blank/black WebKitGTK windows on some NVIDIA + Wayland
  combinations. 🟡 **UNVERIFIED as a blanket recommendation**; it disables a
  zero-copy path and costs performance. 🔧 Use it **only** as a
  user-invokable escape hatch surfaced in `docs/TROUBLESHOOTING.md`, never baked
  into the launcher.
- ✅ **VERIFIED** — Tauri itself ships a `Linux Graphics Issues` debug page, which
  confirms these are real, environment-specific, and worth documenting.

🔧 **RECOMMENDED.** Test matrix for Linux CI, non-negotiable:

| Distro | Display | Session |
|--------|---------|---------|
| Ubuntu 22.04 | X11 | GNOME on Xorg |
| Ubuntu 24.04 | X11 | GNOME on Xorg |
| Ubuntu 24.04 | Wayland | GNOME on Wayland |
| Fedora 42 | Wayland | GNOME |
| openSUSE Tumbleweed | Wayland | KDE Plasma |

Plus, at least once per release, a hand test on a non-GNOME desktop (KDE Plasma,
XFCE) because those have different theme and portal implementations.

### 2.4 Global shortcuts under Wayland

Wayland deliberately gives clients no "grab this key globally" API. The
`org.freedesktop.portal.GlobalShortcuts` portal exists to fill that gap, and it
is **not universally implemented** — GNOME, KDE and others have shipped support
at different times, and it requires user permission.

🟡 **UNVERIFIED.** Tauri's `global-shortcut` plugin has historically documented
reduced or absent functionality on Wayland/X11
([Tauri — Global Shortcut plugin](https://v2.tauri.app/plugin/global-shortcut/)).
🔧 **RECOMMENDED**: treat global shortcuts as a **Windows-only MVP feature**,
and on Linux implement them (a) as **in-app accelerators only**, and (b)
optionally via the portal with a clear "grant permission" prompt, degrading
silently if the portal is absent. Do not advertise global hotkeys on Linux in
v1.

---

## 3. Distribution formats

### 3.1 The comparison

| | **deb** | **rpm** | **AppImage** | **Snap** | **Flatpak** | **Nix** |
|---|---|---|---|---|---|---|
| Who installs it | distro package manager | dnf/yum | user (`chmod +x`) | Snap Store | Flatpak | Nix daemon/store |
| Repo required? | ✅ ours or a PPA | ✅ ours or COPR | ❌ | ✅ Snap Store | ✅ Flathub | ✅ nixpkgs or ours |
| Needs internet to install? | ✅ (deps) | ✅ | ❌ | ✅ | ✅ (runtime download) | ✅ |
| WebKit version | **host's** | **host's** | **host's** | Snap's bundled | **Flathub runtime's** | **pinned by nixpkgs** |
| Updates | `apt upgrade` | `dnf upgrade` | app-managed or none | **automatic, store-controlled** | `flatpak update` | `nix profile upgrade` |
| Sandbox | ❌ | ❌ | ❌ | ✅ strict confinement | ✅ strictest | ❌ |
| Size | small | small | **70–150 MB** | ~100 MB+ | ~150 MB+ | small |
| Supported arches | deb-native | rpm-native | ✅ cross-arch is hard | amd64/arm64 | amd64/arm64 | ✅ everything |

### 3.2 AppImage — portable, with a FUSE tax

✅ **VERIFIED** — Tauri on AppImage: *"the output file is larger but easier to
distribute since it is supported on many Linux distributions and can be executed
without installation"*, and *"you should carefully use it as the file size grows
from the 2–6 MB range to 70+ MB"*
([Tauri — AppImage](https://v2.tauri.app/distribute/appimage/)).

🔴 **FUSE.** AppImages are SquashFS images mounted at runtime, and mounting
requires **FUSE 2**. ✅ **VERIFIED** — the AppImage project's own wiki warns:
*"While libfuse2 is OK, do not install the `fuse` package as of 22.04 or you may
break your system"* ([AppImageKit wiki — FUSE](https://github.com/AppImage/AppImageKit/wiki/FUSE)).
Ubuntu ≥ 22.04 ships `libfuse2`; Ubuntu 24.04 renamed it to **`libfuse2t64`** due
to the 64-bit time_t transition; Fedora uses `fuse-libs`.

The two escapes:

```bash
./MyApp.AppImage --appimage-extract          # dump to squashfs-root/, no FUSE
./MyApp.AppImage --appimage-extract-and-run  # extract then run
```

🟡 Also note that Ubuntu's AppArmor has historically blocked some AppImages on
24.04 unless a profile is written — a real user-support burden.

✅ **VERIFIED — the glibc baseline rule.** *"Core libraries such as glibc
frequently break compatibility with older systems. For this reason, you must build
your Tauri application using the oldest base system you intend to support that
also provides Tauri v2's required WebKitGTK 4.1 packages. **Ubuntu 22.04 and
Debian 12 are suitable baseline examples**"* — building on a newer base can yield
`/usr/lib/libc.so.6: version 'GLIBC_2.33' not found` at runtime on older systems.
🔧 Build Linux artifacts on a **Debian 12 or Ubuntu 22.04 container**, never on
`ubuntu-latest` if `latest` moves to a newer glibc.

🟡 **ARM.** ✅ **VERIFIED** — `linuxdeploy`, Tauri AppImage's tooling, *"does not
support cross-compiling ARM AppImages"*, though GitHub now offers public
`ubuntu-22.04-arm` / `ubuntu-24.04-arm` runners and ARM builds take ~10 min there
(Tauri docs, Aug 2025 note).

### 3.3 Flatpak — the WebKit version tension

This deserves its own section, because it is the one place where Linux's
"sandboxed and always-works" story directly conflicts with "we need a modern
rendering engine."

**What Flatpak gives us (all ✅ VERIFIED from
[Flatpak — Sandbox Permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html)):**

- No host files except the runtime, the app, and `~/.var/app/$FLATPAK_ID`.
- No host services: X11, system D-Bus, PulseAudio are all unavailable by default.
- Filesystem access is a static allow-list of `finish-args`; permissions
  **cannot** be templated or expanded.
- `--socket=wayland` / `--socket=fallback-x11` gives both display protocols.
- D-Bus access is **filtered** by default: the app may own its own
  `$FLATPAK_ID` namespace and `org.mpris.MediaPlayer2.$FLATPAK_ID`, and talk to
  `org.freedesktop.portal.*` and nothing else.
- Portals (`xdg-desktop-portal`) give native file choosers, printing,
  notifications, screenshots — with user consent implied by the file selection.
- GTK apps get transparent portal support "meaning that applications don't need to
  do any additional work to use them."
- `$XDG_CONFIG_HOME`/`$XDG_DATA_HOME`/`$XDG_CACHE_HOME` are rewritten to
  `~/.var/app/$FLATPAK_ID/{config,data,cache}`.
- Reserved paths that `--filesystem` cannot expose: `/app /bin /dev /etc /lib
  /lib32 /lib64 /proc /run/flatpak /run/host /sbin /usr`.

**The WebKit tension:**

✅ **VERIFIED** — *"A given branch of the Freedesktop runtime has a 2 year support
period after which they are declared EOL. A new major version is published on
**August** of every year"*
([Flatpak — Available Runtimes](https://docs.flatpak.org/en/latest/available-runtimes.html)).

So the WebKitGTK inside `org.freedesktop.Platform//YY.08` is whatever upstream
shipped by that August, **frozen**, and you must support it for two years. If
today is October 2026, the newest runtime is `26.08` and the oldest still
supported is `24.08`. Meanwhile Windows users are on Edge/WebView2 major 152+ and
Linux AppImage users are on whatever their distro shipped.

✅ **VERIFIED** — you can inspect exactly what is inside a runtime:

```bash
flatpak run --command=pkg-config org.freedesktop.Sdk//24.08 --modversion webkit2gtk-4.1
flatpak run --command=ldconfig org.freedesktop.Platform//24.08 -p | awk '/\.so/ {print $1}'
flatpak run --command=cat org.freedesktop.Platform//24.08 /usr/manifest.json \
  | jq -r '."modules"|.[]|."name"' | sort -u
```text

**How we resolve it (🔧 RECOMMENDED):**

- **Declare a minimum runtime branch** in the Flathub manifest and refuse to
  build against older ones. If we require `25.08` because we need a CSS feature
  it introduced, we say so loudly in CI rather than shipping a broken build.
- **Feature-detect in CSS regardless** (`@supports (content-visibility: auto)`).
  A Flatpak build is a *third* engine version in our matrix, not a variant of the
  AppImage build.
- **Flatpak is a distribution channel, not our only one.** Users on a modern
  distro who want the newest WebKitGTK should use our AppImage; users who want
  sandboxing and don't care about engine age should use Flathub. Offering both is
  strictly better than choosing.
- **Portal-first file access.** See §6.

### 3.4 Snap — brief, because the answer is "not for us"

Snap's `strict` confinement is excellent and hostile to file access: a classic
Markdown viewer wants to read arbitrary paths, which requires
`personal-files` interface grants. Snap also historically mounts its squashfs
content over FUSE, which is slow for large file trees, and store updates are
automatic and outside our control — meaning we cannot roll back a bad release.

🔧 **RECOMMENDED.** Do not ship a Snap in v1. If we add one, make it a
`devmode`-ish thin wrapper that hands off to our AppImage, and only if a
distributor asks.

### 3.5 Nix — for the people who already have it

`nix build` / `nix run` pin every dependency including WebKitGTK, which means
**we do not have the WebKit problem at all** — but we also do not choose the
version; nixpkgs does.

🔧 **RECOMMENDED.** Publish a `flake.nix` and a `package.nix` in the repo and let
the community maintain the nixpkgs recipe. It costs us a 40-line file and gets us
onto `nixpkgs` and NixOS channels.

### 3.6 Our Linux distribution decision

🔧 **RECOMMENDED**, in priority order:

| Priority | Artifact | Why |
|----------|----------|-----|
| 1 | **AppImage (x86_64, aarch64)** | Zero-install, works on the widest range of distros including non-systemd and exotic ones, self-updatable, no repo relationship. Build on Debian 12 / Ubuntu 22.04 for glibc compatibility. |
| 2 | **`.deb`** (Debian 12+, Ubuntu 22.04+) | `apt install ./siyana-markdown-viewer_*.deb` works; gets us `apt upgrade` for free. Distribute directly, then add a PPA. |
| 3 | **`.rpm`** (Fedora 41+, RHEL-family) | Same for dnf; also unlocks COPR later. |
| 4 | **Flatpak on Flathub** | Best sandbox story, gets us into GNOME Discover/KDE Discover/Plasma, but the WebKit version is pinned by the runtime. Ship once stable. |
| 5 | **`flake.nix`** | Community maintainable, near-zero cost. |
| 6 | Zip/tar.gz | Universal fallback; always uploaded to the GitHub Release. |

---

## 4. Code signing on Linux — the honest version

🔧 **Short answer: on Linux, almost nobody verifies, so signing buys us very
little.** But it costs almost nothing, and it distinguishes us from malware, so:

### 4.1 AppImage signatures (the closest thing Linux has to Authenticode)

✅ **VERIFIED** — Tauri documents signing an AppImage with **GPG**:

```bash
gpg2 --full-gen-key     # create the signing key

# Build-time environment variables consumed by appimagetool:
export SIGN=1
export SIGN_KEY=<GPG_KEY_ID>
export APPIMAGETOOL_SIGN_PASSPHRASE='<key password>'   # required in CI
export APPIMAGETOOL_FORCE_SIGN=1                       # fail the build if signing fails

# Show the embedded signature:
./SiyanaMarkdownViewer_1.0.0_amd64.AppImage --appimage-signature
```

✅ **VERIFIED — and read this twice:** *"The signature is not verified. AppImage
does not validate the signature, so you can't rely on it to check whether the file
has been tampered with or not. The user must manually verify the signature using
the AppImage validate tool. This requires you to publish your key ID on an
authenticated channel (e.g. your website served via TLS)"*
([Tauri — Linux Code Signing](https://v2.tauri.app/distribute/sign/linux/)).

Validation output looks like:

```console
$ ./validate-x86_64.AppImage SiyanaMarkdownViewer_1.0.0_amd64.AppImage
Validation result: validation successful
Signatures found with key fingerprints: $KEY_ID
=================== Validator report: ===================
Signature checked for key with fingerprint $KEY_ID:
Validation successful
```text

### 4.2 deb, rpm, Launchpad

| Format | Tool | Notes |
|--------|------|-------|
| `.deb` | `dpkg-sig --sign builder <file>.deb` | ✅ rarely installed, rarely checked |
| `.deb` (Launchpad PPA) | GPG, `gpg --export-secret-keys` uploaded to Launchpad's importer | ✅ **the only Linux signing that a normal package manager actually enforces** — `apt` refuses unsigned repositories |
| `.rpm` | `rpm --addsign --checksig` + repo `gpgcheck=1` | Enforced only if the repo enables it |
| Flatpak | GPG-signed OSTree commits; `flatpakremote-add --gpg-verify=...` | Enforced by the Flatpak client; Flathub signs its own commits |
| Snap | Store signing, automatic | Enforced, but by Snap, not us |

✅ **VERIFIED** — Launchpad's PPA model: you generate a GPG key, export the
secret key, upload it to Launchpad (which imports it), and Launchpad signs the
`Release` file for your PPA. `apt` then verifies that signature.

🔧 **RECOMMENDED** sequence:

1. v1.x: sign the AppImage with GPG (`APPIMAGETOOL_FORCE_SIGN=1`), publish the
   key fingerprint on our HTTPS site, and document the two-command verification
   in `docs/INSTALL.md`.
2. When we add a PPA: sign properly. This is the one place it pays off.
3. Never claim a signature is "verified". Say "signed; verification is manual."

### 4.3 Notarization

N/A. 🔧 Do not spend a single minute on Linux notarization; there is no such
mechanism.

---

## 5. XDG directories

### 5.1 The spec

✅ **VERIFIED** — [freedesktop.org Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/):

| Variable | Default | Lifetime | What goes in it |
|----------|---------|----------|-----------------|
| `$XDG_CONFIG_HOME` | `~/.config` | durable | User-editable config |
| `$XDG_DATA_HOME` | `~/.local/share` | durable | App data: themes, plugins, logs, user-installed content |
| `$XDG_STATE_HOME` | `~/.local/state` | durable, **not user-editable** | History, logs, caches-that-must-survive-restart, queues |
| `$XDG_CACHE_HOME` | `~/.cache` | **disposable** | Anything you can delete without asking |
| `$XDG_DATA_DIRS` | `/usr/local/share:/usr/share` | read-only, **colon-separated** | System-wide data dirs |
| `$XDG_CONFIG_DIRS` | `/etc/xdg` | read-only | System-wide config |
| `$XDG_RUNTIME_DIR` | `/run/user/$UID` | **per-session, `0700`** | Sockets, locks. Deleted at logout |
| `$XDG_STATE_HOME` | `~/.local/state` | | |

🔧 **RECOMMENDED** layout:

```text
$XDG_CONFIG_HOME/siyana-markdown-viewer/
    settings.json            # user settings, hand-editable, documented
    keybindings.json

$XDG_DATA_HOME/siyana-markdown-viewer/
    themes/                  # user-installed themes
    plugins/
    logs/app.log             # rotating; state, not config
    session.json             # last-open files, window geometry

$XDG_STATE_HOME/siyana-markdown-viewer/
    highlight-cache/         # LRU; rebuilt on demand
    recent-index.json

$XDG_CACHE_HOME/siyana-markdown-viewer/
    webview/                 # WebKitGTK data dir
    thumbnails/

$XDG_RUNTIME_DIR/siyana-markdown-viewer/
    app.lock                 # single-instance lock
    render-worker.sock       # if we need one
```

🔴 **Respect the variables.** A user who sets `XDG_DATA_HOME=/mnt/bigdisk/.local/share`
wants their themes on the big disk. Hardcoding `~/.local/share` is a bug that
makes us the app that ignores configuration.

🔧 **Never assume a single directory.** ✅ **VERIFIED** — `$XDG_DATA_DIRS` is
**colon-separated and plural**: data can come from several places. Our theme and
plugin loader must scan *all* of it, in order, with user directories taking
precedence.

### 5.2 `xdg-user-dir` and the localized home problem

✅ **VERIFIED** — the XDG user dirs (`Documents`, `Desktop`, `Downloads`, …) are
user-configurable and often localized (e.g. `~/Dokumente` on German systems).
`xdg-user-dir DOCUMENTS` is the only correct way to ask
([freedesktop — xdg-user-dir](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)).

```bash
xdg-user-dir DOCUMENTS      # -> /home/ann/Dokumente
xdg-user-dir DOWNLOAD
xdg-open "$HOME/notes.md"   # respects the user's preferred app
```text

🔧 **RECOMMENDED.** "Open containing folder" and "Save as… default directory"
must go through `xdg-user-dir` / the portal, never through a hardcoded
`~/Documents`.

---

## 6. Desktop entries, MIME types, and portals

### 6.1 The `.desktop` file

✅ **VERIFIED** — [Desktop Entry Specification](https://specifications.freedesktop.org/desktop-entry-spec/latest/).

A Tauri app installs `/usr/share/applications/siyana-markdown-viewer.desktop`:

```ini
[Desktop Entry]
Type=Application
Version=1.5
Name=Siyana Markdown Viewer
GenericName=Markdown Viewer
Comment=Read and preview Markdown files
Exec=siyana-markdown-viewer %f
TryExec=siyana-markdown-viewer
Icon=siyana-markdown-viewer
Terminal=false
Categories=Utility;TextEditor;Viewer;
MimeType=text/markdown;text/x-markdown;
StartupWMClass=siyana-markdown-viewer
StartupNotify=true
Keywords=Markdown;md;text;viewer;preview;
```

- `%f` = a single file; `%u` = a URL; `%F`/`%U` = multiple. ✅ **VERIFIED** —
  `%f` is the right one for a file-based app.
- ✅ **VERIFIED** — `StartupWMClass` matters for Electron specifically: the
  Electron docs note that on Linux the dock badge *"is associated with the app's
  `.desktop` file, so `app.setDesktopName` (or the `desktopName` field in
  `package.json`) must match the name of the app's actual `.desktop` file"*
  ([Electron — `app`](https://www.electronjs.org/docs/latest/api/app)). Without
  it the icon groups wrong in the task switcher. 🟡 Same class of problem applies
  to WebKitGTK/GTK apps via `GtkApplication.set_wmclass`.

### 6.2 MIME registration

✅ **VERIFIED** — MIME definitions live in the **shared MIME info database**
(`/usr/share/mime/packages/*.xml`), maintained by the
`shared-mime-info` package. `.md` maps to `text/markdown` there.

An app contributes by shipping its own XML into
`/usr/share/mime/packages/<app>.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="text/markdown">
    <comment>Markdown document</comment>
    <glob pattern="*.md"/>
    <glob pattern="*.markdown"/>
    <sub-class-of type="text/plain"/>
  </mime-type>
  <mime-type type="text/x-markdown">
    <comment>Markdown document (legacy)</comment>
    <glob pattern="*.mkd"/>
    <glob pattern="*.mdown"/>
    <sub-class-of type="text/plain"/>
  </mime-type>
</mime-info>
```text

Then refresh and claim defaults:

```bash
# rebuild the shared MIME cache after installing the XML
update-mime-database /usr/share/mime

# make us the default handler (writes ~/.config/mimeapps.list)
xdg-mime default siyana-markdown-viewer.desktop text/markdown
xdg-mime query default text/markdown

xdg-mime query filetype ~/notes.md
```

🔧 **RECOMMENDED**:

- **Declare `text/markdown` only** as the canonical type. Registering
  `text/x-markdown` as a *separate* type creates a duplicate that some desktops
  show as two rows. Use `<sub-class-of type="text/plain"/>` for the legacy glob.
- **Never call `xdg-mime default` silently at first run.** ✅ **VERIFIED**
  practice across desktops: default-association changes belong in the
  application's settings UI, behind a button labelled "Make Siyana Markdown
  Viewer the default app for Markdown files." Stealing a default is how you get a
  one-star review.
- Also ship `update-desktop-database` for the MimeType cache, and register
  `application/x-siyana-viewer` for our own deep-links (`siyana-mv://open?path=…`).

### 6.3 Portals — how we actually get a file path on Linux

Under Flatpak, and increasingly under "portals as the modern way", the user
picks a file through `xdg-desktop-portal`'s `org.freedesktop.portal.FileChooser`
and we receive a **document-portal path**:

```text
/run/user/1000/doc/Ab3kQ2p7nZ9/note.md
```text

✅ **VERIFIED** — `xdg-desktop-portal`'s `FileChooser` returns URIs that the
Document portal maps into the sandbox's `doc` directory; the path is **valid only
for that session** and is invalidated at logout
([Flatpak — Sandbox Permissions, Portals section](https://docs.flatpak.org/en/latest/sandbox-permissions.html)).

🔴 **Three consequences for a file-watching Markdown viewer:**

1. The path is **not stable**. `~/.config/siyana-markdown-viewer/session.json`
   storing `/run/user/1000/doc/Ab3kQ2p7nZ9/note.md` is garbage at next boot.
   🔧 Store the *original* URI/real path in a **document-portal–aware** way, and
   on startup re-resolve via `org.freedesktop.portal.Documents.GetLocation` /
   `PrepareForRead`, falling back to "file not found, please re-open".
2. The document portal itself is a **FUSE mount**, so it is slower than a local
   path and, crucially, **`inotify` behaviour on it is not something to rely
   on**. 🔧 Treat watches under the portal as best-effort and lean on the 30 s
   reconciliation poll from [01-windows.md §6.4](01-windows.md#64-the-three-libraries-compared).
3. We may need `--filesystem=xdg-documents` or nothing at all depending on how
   we obtain the path. 🔧 **Prefer the portal with zero extra `--filesystem`
   grants.** Flathub reviewers and users both penalise broad grants, and the
   Flatpak docs are explicit: *"Using portals as an alternative to blanket
   filesystem access, wherever possible."*

---

## 7. Inotify

### 7.1 The mechanics

✅ **VERIFIED** — [inotify(7)](https://man7.org/linux/man-pages/man7/inotify.7.html):
`inotify_init(2)` creates an instance (a file descriptor), `inotify_add_watch(2)`
adds a watch on a path with a mask, each watch has a unique watch descriptor,
`inotify_rm_watch(2)` removes it.

🔴 **There is no recursive watch.** One watch per directory. `notify`'s docs say
it explicitly: *"for recursive watched folders each file and folder inside counts
towards the limit"* ([notify 8.2.0](https://docs.rs/notify/latest/notify/)).

### 7.2 The quota — the thing that will page a user

✅ **VERIFIED** — the default `fs.inotify.max_user_watches` is **8192** (this is
stated in `inotifywatch(1)`: *"The default maximum is 8192; it can be increased
by writing to `/proc/sys/fs/inotify/max_user_watches`"*), and
`fs.inotify.max_user_instances` bounds the number of instances.

When you exhaust it you get **`ENOSPC` / "No space left on device"** — an error
message that is actively misleading, and which appears in the wild as
`Bad File Descriptor` or `ENOSPC` depending on where it hits.

```bash
cat /proc/sys/fs/inotify/max_user_watches    # 8192 by default
cat /proc/sys/fs/inotify/max_user_instances  # 128 by default

# fix
sudo sysctl fs.inotify.max_user_instances=8192
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl -p
```

🔧 **RECOMMENDED**:

1. **Watch directories, not files.** One watch on `~/vault` recursively costs
   one watch per subdirectory — but watching 5000 individual `.md` files costs
   5000 watches *and* misses every file created later. Directory watching is
   both cheaper and correct.
2. **Detect `ENOSPC` at watch-registration time and surface it.** "Your system's
   file-watcher limit (8192) was reached; live reload is disabled for
   `/mnt/huge`. See <link>." Silent degradation is worse than an honest message.
3. **Fall back to a polling watcher for the subtree that failed.** `notify`
   ships `PollWatcher` and its docs note *"the PollWatcher is not restricted by
   this limitation, so it may be an alternative if your users can't increase the
   limit"*.
4. **Never watch the whole home directory** unless the user explicitly asks.

### 7.3 Where inotify does not work

✅ **VERIFIED** — `notify` 8.2.0's documented Known Problems, verbatim in
substance:

- *"Network mounted filesystems like NFS may not emit any events for notify to
  listen to. This applies especially to WSL programs watching windows paths"* —
  workaround: `PollWatcher`.
- *"Some filesystems like `/proc` and `/sys` on \*nix do not emit change events or
  use correct file change dates"* — workaround: `PollWatcher` with
  `compare_contents`.
- *"When watching a very large amount of files, notify may fail to receive all
  events. For example the linux backend is documented to not be a 100% reliable
  source"* (issue #412).
- *"If you want to receive an event for a deletion of folder `b` for the path
  `/a/b/..`, you will have to watch its parent `/a`."*

🔴 **Same conclusion as Windows.** 🔧 Every watch is advisory. Notifications mean
"go look." Add a **reconciliation poll** (every 30 s over the open document tree,
every 5 min over the folder tree) so that a dropped inotify event costs 30
seconds of staleness, not permanent wrongness.

### 7.4 Editor behaviour (platform-independent, worth stating here)

✅ **VERIFIED** — `notify`'s docs warn: *"If you rely on precise events
(Write/Delete/Create..), you will notice that the actual events can differ a lot
between file editors. Some truncate the file on save, some create a new one and
replace the old one."* This is exactly why debounce-and-reread is mandatory, and
why our change-detection must be **content-hash or mtime+size based**, never
event-kind based.

---

## 8. Case sensitivity — varies, and you cannot detect it once

On ext4, `Notes.md` and `notes.md` are two files. On a vfat/exFAT SD card, they
are one. On btrfs with `casefold`, they are one. On NFS exports it depends on the
server. 🟡 `casefold` on btrfs has been available for a while but its status in
2026 across distros needs verification.

🔴 **The asymmetry that matters:** Windows is always case-insensitive; Linux is
sometimes. So the *bug* only reproduces on Linux, and the *fix* (folding case)
only *matters* on Windows.

🔧 **RECOMMENDED** — a single canonicalisation function used by the whole app:

```ts
/** Case-folded key for cache / recency / dedupe.
 *  On Windows this is a no-op in effect (NTFS already folds);
 *  on Linux it merges case-variant paths the way most user expectations say they
 *  should be merged. It is deliberately NOT a Unicode normalisation: we do not
 *  want to conflate NFC/NFD filenames on macOS.
 */
export const pathKey = (p: string) => p.normalize("NFC").toLowerCase();
```text

Rules:

- **Cache keys, recency lists, and "is this file already open?" checks** use
  `pathKey`.
- **Anything we write to disk** uses the path exactly as the user's filesystem
  returned it. Never write back a folded path.
- **Never use `toLowerCase()` on display strings.** Only on keys.

🟡 **Detection, for diagnostics only:** compare `stat("Notes.md")` with
`stat("notes.md")`; if both succeed, the filesystem folds case. Log it once. Do
not branch behaviour on it — branch on nothing, and be correct everywhere.

---

## 9. Theme integration

### 9.1 What "native-feeling" costs

A Tauri/Wry window is a **WebKitGTK view inside a GTK window**. The window
decoration, the menus, the file chooser, and the scrollbars come from **GTK**, and
follow the user's **GTK theme** (`gtk-theme` in
`~/.config/gtk-3.0/settings.ini`). The page inside comes from **us**, and follows
our CSS.

🔴 So a user on Adwaita-dark gets dark GTK chrome and a white document unless we
detect and respond.

### 9.2 Detection

✅ **VERIFIED** — `prefers-color-scheme` is a Baseline, widely-available CSS media
feature (since January 2020) that reports the user's requested light/dark
preference, and per MDN it works in embedded `<svg>` and `<iframe>` based on the
parent's color scheme
([MDN — `prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/prefers-color-scheme)).

```css
:root { color-scheme: light dark; }

@media (prefers-color-scheme: dark) {
  :root { --bg: #16181d; --fg: #e6e6e6; }
}
```

- ✅ **GNOME** exposes `org.gnome.desktop.interface color-scheme` via GSettings
  (`'prefer-dark'` / `'default'`).
- ✅ **KDE** uses `~/.config/kdeglobals` `[KDE] colorScheme=...`.
- ✅ **The webview reports it for us** on all three engines. This is the portable
  path.
- 🔧 For the **GTK chrome** (menu bar, native dialogs) to match, we also need
  GTK to know. 🟡 The GTK3 API for this is
  `gtk_style_context_preferred_color_scheme()` (GTK ≥ 3.22) — needs verification
  that it tracks the OS preference rather than the `gtk-application-prefer-dark-theme`
  setting, which is a *GtkApplication* property, not an OS signal.

🔧 **RECOMMENDED** ordering:

1. **In-app setting wins.** `system → light → dark`, persisted. Users of reading
   apps care about this more than OS integration.
2. If `system`, use `prefers-color-scheme` in CSS.
3. Additionally read `org.gnome.desktop.interface color-scheme` when
   `gsettings` is available, because **older WebKitGTK versions had incomplete
   `prefers-color-scheme` support under GNOME** — 🟡 needs verification against
   WebKitGTK 2.36 specifically, which is our floor.
4. Set `gtk-application-prefer-dark-theme` on the `GtkApplication` so the native
   chrome matches.

### 9.3 Parse the GTK theme? Almost certainly not

🟡 **UNVERIFIED but strongly discouraged.** Reading `~/.config/gtk-3.0/gtk.css`
and the theme's `gtk-dark.css` to extract colours is possible (GTK themes are
`@define-color` blocks) and several apps do it. It is fragile: themes are
per-widget, not a palette; dark variants are separate files; Adwaita ships
`Adwaita:dark` as a *name*.

🔧 **RECOMMENDED — do not parse GTK themes.** Ship our own light and dark themes,
tuned for reading, and use GTK only for the window chrome. Users pick a "Markdown
Viewer" theme, not "whatever GTK is doing."

---

## 10. Secret storage

| Backend | D-Bus API | Available on |
|---------|-----------|--------------|
| **GNOME Keyring** (via `libsecret`) | `org.freedesktop.Secret.Service` | GNOME, and now many others |
| **KWallet** | `org.kde.kwalletd5` | KDE Plasma |
| `libsecret` | abstracts the above | Anywhere either exists |

🔧 For a Markdown viewer in v1, the honest answer is: **we probably don't need
secrets.** We read local files. There is no account, no token, no sync key.

If we later add sync, the portable Linux answer is `libsecret` (which D-Bus-talks
to whichever keyring the desktop provides), not a bespoke implementation. 🟡
Under Flatpak, keyring access goes through `org.freedesktop.portal.Secret`, which
requires an explicit `--talk-name=org.freedesktop.portal.Secret` grant — verify
the exact portal interface name and permission at implementation time.

🔧 **RECOMMENDED**: design the settings layer so that *if* we need a secret, it
is one `SecretStore` interface with three implementations (`Win32 Credential
Manager`, `libsecret`, and an encrypted-file fallback behind an explicit user
opt-in with a loud warning). Do not build it until something needs it.

---

## 11. Linux landmine checklist

| # | Landmine | Our defence |
|---|----------|-------------|
| 1 | `libwebkit2gtk-4.1-dev` missing → build fails with a cryptic `pkg-config` error | `make doctor` checks all six pkg-config modules at once |
| 2 | Ubuntu 22.04's WebKitGTK is 2.36.0 (Jan 2023) | `@supports` guards on every modern-CSS dependency |
| 3 | On 22.04, `libwebkit2gtk-4.1-0` is in `universe` | Docs say "enable universe"; error message says the same |
| 4 | Wrong runtime → app exits with no window and no error | Native preflight + `dlopen` check + a message box |
| 5 | `libappindicator3-dev` and `libayatana-appindicator3-dev` `Conflicts:` | Only ever install the ayatana fork |
| 6 | AppImage built on newer base → `GLIBC_2.33 not found` | Build Linux on Debian 12 / Ubuntu 22.04 containers, pinned |
| 7 | AppImage needs FUSE 2; Ubuntu 24.04 renamed it `libfuse2t64` | Document both; document `--appimage-extract-and-run` |
| 8 | Flatpak WebKit is pinned by the Aug-yearly, 2-year runtime | Declare a minimum runtime branch; feature-detect anyway |
| 9 | Flatpak: no host access, filtered D-Bus | Portal-first file access; minimal `finish-args` |
| 10 | Document-portal paths die at logout | Store the real path; re-resolve on startup; re-open gracefully |
| 11 | `inotify` has no recursive watch; 8192 default quota; `ENOSPC` | Watch directories; detect `ENOSPC`; fall back to polling |
| 12 | NFS / `/proc` / `/sys` emit no events | `PollWatcher` fallback; 30 s reconciliation poll |
| 13 | Filesystem case sensitivity varies by mount | Single `pathKey` canonicaliser used app-wide |
| 14 | Wayland: no global shortcuts; WebKitGTK uses a nested compositor | Global shortcuts are Windows-only in v1; `GDK_BACKEND` documented |
| 15 | `$XDG_DATA_DIRS` is plural and colon-separated | Scan all of it, user dirs first |
| 16 | `~/Documents` may be `~/Dokumente` | `xdg-user-dir`, never hardcoded |
| 17 | `.desktop` `StartupWMClass` mismatch → wrong task-switcher icon | Set it, and verify on both X11 and Wayland |
| 18 | Silently stealing the `.md` default association | Explicit button in Settings, never at first run |
| 19 | Snap's FUSE squashfs is slow for file trees; store owns updates | No Snap in v1 |
| 20 | `xdg-user-dir` / portals absent in bare X sessions | Degrade to a native GTK file chooser |

---

## Sources

- [Tauri — Prerequisites](https://v2.tauri.app/start/prerequisites/) (last updated 2026-08-20) · [AppImage](https://v2.tauri.app/distribute/appimage/) · [Linux Code Signing](https://v2.tauri.app/distribute/sign/linux/) · [Migration to webkit2gtk-4.1](https://v2.tauri.app/blog/tauri-2-0-0-alpha-3/) · [Global Shortcut](https://v2.tauri.app/plugin/global-shortcut/)
- [packages.ubuntu.com — libwebkit2gtk search](https://packages.ubuntu.com/search?keywords=libwebkit2gtk&searchon=names&suite=all&section=all) (jammy / noble / questing versions)
- [WebKitGTK 2.54.1 release](https://webkitgtk.org/2026/10/02/webkitgtk2.54.1-released.html) · [2.39.1 release notes](https://webkitgtk.org/2022/11/11/webkitgtk2.39.1-released.html) · [trac — WebKitGTK/Wayland](https://trac.webkit.org/wiki/WebKitGTK/Wayland) · [WebKit Graphics docs](https://docs.webkit.org/Ports/WebKitGTK%20and%20WPE%20WebKit/Graphics.html)
- [Flatpak — Sandbox Permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html) · [Available Runtimes](https://docs.flatpak.org/en/latest/available-runtimes.html)
- [freedesktop Base Directory Spec](https://specifications.freedesktop.org/basedir-spec/latest/) · [Desktop Entry Spec](https://specifications.freedesktop.org/desktop-entry-spec/latest/) · [xdg-user-dirs](https://www.freedesktop.org/wiki/Software/xdg-user-dirs/)
- [inotify(7)](https://man7.org/linux/man-pages/man7/inotify.7.html) · [inotifywatch(1)](https://www.man7.org/linux/man-pages/man1/inotifywatch.1.html)
- [AppImageKit wiki — FUSE](https://github.com/AppImage/AppImageKit/wiki/FUSE) · [AppImage — FUSE troubleshooting](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)
- [notify 8.2.0 — Known Problems](https://docs.rs/notify/latest/notify/)
- [MDN — prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/prefers-color-scheme) · [Electron — app.getAppMetrics](https://www.electronjs.org/docs/latest/api/app)
