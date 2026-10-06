# 01 — Windows

> Everything on this page is a trap that a Linux developer will not have, or a
> Linux developer will have in a completely different shape.

Legend: ✅ **VERIFIED** (primary source linked) · 🟡 **UNVERIFIED** (community
report / our inference) · 🔧 **RECOMMENDED** (our decision)

---

## 1. What Windows versions exist in 2026

| Version | Status (as of Oct 2026) | Our stance |
|---------|------------------------|------------|
| **Windows 11** (23H2, 24H2, 25H2 …) | Current, supported | 🔧 Primary target |
| **Windows 10 22H2** | End of support **2025-10-14** | 🔧 Supported for the life of v1.x |
| Windows 10 (Enterprise/Education/Pro, Volume Licensing) | ESU, 3 years: year 1 to 2026-10-13, year 2 to 2027-10-12, year 3 to 2028-10-10 | 🔧 Supported |
| Windows 10 (consumer, free ESU) | Extended **through 2027-10-12** | 🔧 Supported |
| Windows 10 LTSC / IoT | Separate lifecycle, still receiving updates | 🟡 Accept, do not optimise for |
| Windows 8.1 / 8 / 7 | Out of support | 🔧 Not supported |

✅ **VERIFIED** — Windows 10 reached end of support on 2025-10-14
([Microsoft — End of support](https://www.microsoft.com/en-us/windows/end-of-support)).

✅ **VERIFIED** — The Enterprise/Education/Pro ESU table gives year 1 ending
2026-10-13, year 2 ending 2027-10-12, year 3 ending 2028-10-10, at $61/device
for year 1 with the price doubling each year
([Microsoft — ESU FAQ](https://learn.microsoft.com/en-us/lifecycle/faq/extended-security-updates),
[Microsoft — Extended Security Updates](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates)).

✅ **VERIFIED** — In June 2026 Microsoft *quietly extended* the free consumer ESU
program by one more year, from 2026-10-12 to **2027-10-12**
([BleepingComputer, 2026-06-25](https://www.bleepingcomputer.com/news/microsoft/microsoft-quietly-extends-free-windows-10-esu-support-to-october-2027/)).

### What ESU means for us — concretely

ESU delivers **critical and important** security updates only. It does not deliver
features, non-security fixes, or driver updates. It does not change the webview
engine: an ESU-enrolled Windows 10 machine still receives the same Edge/WebView2
updates as everyone else, because those ride the Edge channel, not the Windows
servicing channel.

🔧 **RECOMMENDED.** Two implications:

1. **ESU status is not a feature-detection input.** Do not probe for it. Treat
   Windows 10 22H2 exactly like Windows 11. The one thing that *does* change is
   how often users update the OS, which changes nothing about us.
2. **Windows 10 users skew toward older hardware**, which skews toward more RAM
   pressure and slower disks. That is a performance-budget argument, not a
   compatibility argument, and it lands in
   [10-performance/README.md](../10-performance/README.md).

🟡 **UNVERIFIED.** Expect a meaningful fraction of Windows 10 installs to be
off managed-update paths entirely — machines where the user has disabled
`Microsoft Edge Update` services, which also disables WebView2 updates. If we
ship Fixed Version we sidestep that; if we ship Evergreen, a fraction of our
Windows 10 users may be running a WebView2 from 2023. Design our feature
detection so that path degrades rather than breaks.

---

## 2. WebView2 — what it actually is

WebView2 embeds **Microsoft Edge's rendering engine** (Chromium) into a native
Win32 application. Your process hosts a browser; the browser's UI process spawns
renderer, GPU and utility processes. This is not "an HTML control" — it is a
full browser engine with its own process tree and its own update lifecycle.

✅ **VERIFIED** — Since **version 153** (released the week of 2026-09-10) the
WebView2 Runtime moved from a four-week to a **two-week** release cadence, aligned
with Edge's major releases ([Microsoft — WebView2 is moving to a 2-week release
cadence](https://blogs.windows.com/msedgedev/2026/08/24/webview2-is-moving-to-a-2-week-release-cadence/)).

That cadence matters for us in two directions. It means our Windows users get
security fixes faster than any bundled alternative. It also means **the engine
version under a given user changes roughly every two weeks**, so any assumption
of "the version we tested against is the version users get" is wrong by
construction. This is the strongest single argument for feature detection.

### 2.1 Evergreen vs Fixed Version

✅ **VERIFIED** — Microsoft's own guidance: *"The Evergreen distribution mode is
recommended for most developers"*; Fixed Version is for *"constrained environments
that have strict compatibility requirements"*
([Microsoft — Evergreen vs Fixed Version](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)).

| | **Evergreen** | **Fixed Version** |
|---|---|---|
| Shipped with app? | No | Yes |
| Updated on client? | Yes, automatically, with Edge | No — we ship updates |
| Disk cost | One shared copy for all WebView2 apps | One copy **per app** |
| API availability | Whatever the installed runtime has | Exactly what we packaged |
| Patch latency | Days | Whatever our release cadence is |
| Can be installed by an installer? | Yes | ❌ *"The Fixed Version runtime can't be installed by using an installer"* |
| Runs from a network/UNC path? | n/a | ❌ *"Currently, Fixed Version cannot be run from a network location or UNC path"* |

✅ **VERIFIED** — Fixed Version binaries are *"over 250 MB"* and add that to the
package ([Microsoft — Distribute your app and the WebView2 Runtime](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)).

### 2.2 The four install modes, with real numbers

Tauri exposes exactly four strategies. These numbers are Tauri's own
([Tauri — Windows Installer](https://v2.tauri.app/distribute/windows-installer/)):

| Mode | Needs internet? | Installer size | Notes |
|------|-----------------|----------------|-------|
| `downloadBootstrapper` | **Yes** | 0 MB | Tauri's default. Fails on air-gapped machines. |
| `embedBootstrapper` | **Yes** | ~1.8 MB | Better Windows 7 story for MSI. |
| `offlineInstaller` | No | ~127 MB | The Evergreen Standalone Installer embedded. |
| `fixedVersion` | No | ~180 MB (Tauri's figure) | Embeds a pinned runtime. |
| `skip` | No | 0 MB | ⚠️ Not recommended — user may have no runtime at all. |

🔧 **RECOMMENDED.** **Ship `offlineInstaller` for the primary installer**, not
Tauri's default. Rationale:

- Our users' files are local. A meaningful fraction of them (corporate laptops
  behind proxies, lab machines, air-gapped desktops, users who "downloaded the
  app on the train") will hit a bootstrapper that cannot reach the CDN. A failed
  WebView2 bootstrap is an app that *does not launch* and gives no useful error.
- 127 MB is large but it is a **one-time, cached-once** cost. Fixed Version is
  ~180 MB **per app per install**, forever, and it makes *us* responsible for
  shipping Chromium security patches on a two-week clock.
- Evergreen keeps disk usage shared across every WebView2 app on the machine,
  which is the majority of what users notice about installer size.

We should additionally ship a **separate slim installer** for users who already
have Edge/WebView2 (a 2 MB NSIS installer with `downloadBootstrapper`) and a
**fully offline ZIP** for locked-down environments. Three artifacts, three
deployment stories.

### 2.3 Detecting the runtime before we commit to a launch

✅ **VERIFIED** — Microsoft documents a detection procedure: check the
`pv`/`EBWebView` registry value under
`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`,
or simply call `GetAvailableCoreWebView2BrowserVersionString`
([Microsoft — Distribute your app and the WebView2 Runtime](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)).

```rust
// Fail loudly and usefully, instead of showing an empty window.
match webview2_available() {
    Ok(Some(v)) => log::info!("WebView2 runtime {v}"),
    Ok(None) => {
        eprintln!("This app needs the Microsoft Edge WebView2 Runtime.");
        eprintln!("Download: https://developer.microsoft.com/microsoft-edge/webview2/");
        std::process::exit(2);
    }
    Err(e) => log::warn!("WebView2 probe failed: {e}"),
}
```text

🔧 **RECOMMENDED.** Ship a `docs/TROUBLESHOOTING.md` entry for
`WebView2RuntimeNotFound`, and make the error message a clickable link, not a
stack trace. Users do not know what WebView2 is.

### 2.4 `WebView2Loader.dll` and Fixed Version deployment

`WebView2Loader.dll` is a tiny shim that our native code links against to locate
and start the runtime. Two facts about it drive our packaging:

1. ✅ **VERIFIED** — With Fixed Version, on **Windows 10 only**, starting with
   Fixed Version **120**, unpackaged Win32 apps must run extra setup commands so
   the renderer can run inside the App Container. Windows 11, older runtimes, and
   packaged apps are unaffected ([Microsoft — Distribute your app](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)).
2. ✅ **VERIFIED** — The Fixed Version package must be extracted with
   `expand {path} -F:* {dest}`, *"avoid decompressing through File Explorer,
   because that approach might not generate the correct folder structure"*, and
   must produce `bin\<arch>\Release` with a matching version directory.

🔧 **RECOMMENDED.** If we ever need Fixed Version — the plausible trigger is a
locked-down enterprise that disables all Edge update services — we build it as a
**separate artifact** from the Evergreen build, and we script the extraction in
CI. It is a different distribution channel with a different update model, not a
flag we flip.

### 2.5 Handling runtime updates mid-session

✅ **VERIFIED** — *"Updates of the Evergreen WebView2 Runtime are automatically
downloaded, but a running WebView2 app will continue using its current version"*
; the recommended handling is a `NewBrowserVersionAvailable` event that prompts a
restart ([Microsoft — Developer guide](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/developer-guide)).

🔧 **RECOMMENDED.** Show a dismissible "A new version of the app engine is
available — restart to update?" banner at most once per week, after the window
has been idle, and **only if the user has unsaved state fully settled** (a viewer
has no unsaved state — this is a feature of being a viewer, and we should exploit
it: we can restart aggressively).

---

## 3. Packaging: MSIX vs NSIS vs MSI

✅ **VERIFIED** — electron-builder's own comparison table:

| | MSI | NSIS | Portable |
|---|---|---|---|
| Enterprise deployment | Excellent (Group Policy, SCCM/Intune, `/quiet`) | Limited | None |
| Custom scripting | Moderate (WiX) | **Excellent** | N/A |
| UI flexibility | Limited | **Highly customizable** | N/A |
| File size | Typically larger | Compressed | No overhead |
| Auto-update | Not supported via electron-updater | electron-updater | Manual |
| Recommended for | Enterprise | Consumer | USB / no-install |

([electron-builder — MSI](https://www.electron.build/docs/msi))

Tauri's split matches this exactly: **MSI via WiX Toolset v3**, **setup
executables via NSIS** ([Tauri — Windows Installer](https://v2.tauri.app/distribute/windows-installer/)).

⚠️ **Verified constraint.** MSI packages require the **VBSCRIPT** optional
Windows feature to be enabled at build time (`failed to run light.exe`
otherwise), and VBScript is deprecated
([Tauri — Prerequisites](https://v2.tauri.app/start/prerequisites/)). We would
build MSIX/MSI on a `windows-latest` runner where this is on by default, but any
developer building locally on a stripped image will hit it.

### MSIX, specifically

✅ **VERIFIED** — MSIX characteristics and limits: signature is **mandatory**;
registry writes go to containerized hives (`Registry.dat`, `User.dat`,
`User.Classes.dat`); default install location is `%ProgramFiles%\WindowsApps`;
custom actions can only run before app start or after close, never inside the
install sequence; desktop-bridge identity requires Windows 10 1709+
([Advanced Installer — MSIX limitations](https://www.advancedinstaller.com/msix-limitations.html)).

MSIX's *real* appeal is the **`.appinstaller`** file: declarative auto-update with
`HoursBetweenUpdateChecks`, `UpdateMode`, and automatic cleanup of superseded
versions. But it also means Store identity, Store review, and an update channel we
do not control.

🔧 **RECOMMENDED.**

| Artifact | Audience | Why |
|----------|----------|-----|
| **NSIS `-setup.exe`** | Everyone, primary | Best UI, supports our offline WebView2 mode, `electron-updater`/Tauri updater compatible, per-user install needs no elevation |
| **Portable ZIP** | Locked-down / IT / USB | Escape hatch when the updater, the installer, and SmartScreen all fail. See [03](03-distribution-and-updates.md) |
| **MSIX** | Later, Microsoft Store | Only if Store discovery + Store updates turn out to matter more than control. Requires Partner Center, reservation, certification |

We will not ship MSI. It buys us enterprise deployment we can get later through
MSIX or through an enterprise channel, and it costs us per-user installs,
customizable UI, and a supported updater path.

### Store vs direct distribution

✅ **VERIFIED** — Submitting to the Microsoft Store requires a Partner Center
account, a reserved app name, and certification; the Store signs the package for
you. Direct distribution via `.appinstaller` or a hosted `.msix` requires your own
signature ([Microsoft — Packaging your Electron app for distribution](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/electron-packaging)).

🔧 **RECOMMENDED.** Direct distribution first. It keeps our release cadence,
our changelog, and our update rollback in our hands. Revisit Store when we have
the maintainer bandwidth to sustain certification.

---

## 4. Code signing, Authenticode, and SmartScreen

### 4.1 How signing works

Authenticode embeds a PKCS#7 signature over a hash of the PE image, using an
X.509 certificate chaining to a trusted root. Optional RFC 3161 timestamping
pins the signature to a moment in time so it stays valid after the certificate
expires. Tauri configures this via `certificateThumbprint`, `digestAlgorithm`
(`sha256`) and `timestampUrl`
([Tauri — Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)).

### 4.2 EV vs OV — the 2024 change that surprised everyone

✅ **VERIFIED** — *"Since 2024, an EV Certificate no longer gives your app an
immediate reputation with Microsoft SmartScreen. Microsoft removed the special
treatment of EV code signing certificates from its Trusted Root Program in 2024,
so EV and OV certificates now build SmartScreen reputation the same way, and a
newly signed release can show a warning with either."*
([Tauri — Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/),
citing [Microsoft — SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/smart-screen-reputation-for-windows-app-developers)).

**This is a real, checkable fact and it changes purchasing advice.** Between 2016
and 2024 the correct advice to an open-source project was "get an EV cert or
SmartScreen will block you." As of 2026 that is no longer the differentiator. The
differentiator is **reputation accrued over downloads of a consistently-signed
binary**, which only time and download count can provide.

🔧 **RECOMMENDED.**

1. **One OV code-signing certificate, held by the project, used for every
   release.** Never rotate. Reputation is attached to the file, and consistency
   is what accumulates it.
2. **Buy it from a CA that will sign an open-source project's legal entity**
   (Sectigo, DigiCert, GlobalSign all offer OV to organisations). Individual
   (DTC) OV is cheaper and, as of 2023+, the practical norm for open source.
3. **Timestamp every signature.**
4. 🔧 **Build reputation deliberately**: ship early, ship often, ship
   continuously-signed builds, keep the download button prominent on the project
   page. The warning disappears when enough users have downloaded the exact file.
5. 🟡 Optionally submit to Microsoft's manual review — *"Although not guaranteed,
   if the app does not contain any malicious code, Microsoft may grant additional
   reputation"* ([Tauri](https://v2.tauri.app/distribute/sign/windows/)). Worth
   doing once, for the first stable release.
6. Consider **Azure Trusted Signing** — the Forge MSIX guide notes it "has no
   password at all" ([Electron Forge — MSIX](https://www.electronforge.io/config/makers/msix)),
   which removes a class of CI secret-exposure risk. 🟡 Availability and pricing
   for an open-source project need verification.

The honest framing for our README: **we will ship signed, and early users will
click "More info → Run anyway" until reputation accrues. Say so up front.**
Pretending otherwise wastes users' trust.

---

## 5. Paths: where things go and how you ask for them

### 5.1 The Known Folder API

✅ **VERIFIED** — Modern Windows resolves special folders through
`SHGetKnownFolderPath(FOLDERID_*, ...)`, keyed by GUIDs, not string names.
`FOLDERID_RoamingAppData` is `{3EB685DB-65F9-4CF6-A03A-E3EF65729F3D}`, default
path `%APPDATA%` = `%USERPROFILE%\AppData\Roaming`, folder type `PERUSER`
([Microsoft — Known Folder ID](https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid)).

| Folder | Env var | `FOLDERID_` | Use for |
|--------|---------|-------------|---------|
| Roaming | `%APPDATA%` | `FOLDERID_RoamingAppData` | Small settings that should follow the user via domain roaming |
| Local | `%LOCALAPPDATA%` | `FOLDERID_LocalAppData` | Caches, logs, downloaded webview data, per-machine-bound state |
| Documents | — | `FOLDERID_Documents` | **Never** write app data here |
| Temp | `%TEMP%` | `FOLDERID_LocalAppData\Temp` | Extraction, crash dumps — never durable state |

`std::env::temp_dir()` in Rust reads `TMP`/`TEMP` and falls back to
`GetTempPath`. 🔧 **RECOMMENDED** rule set:

- `%APPDATA%\SiyanaMarkdownViewer\` → user settings (`settings.json`),
  recent-files list, window geometry, theme choice. Small, hand-editable,
  documented. Putting it here means "where do I edit my config" has a one-line
  answer in the docs.
- `%LOCALAPPDATA%\SiyanaMarkdownViewer\` → caches that are safe to delete
  (highlight cache, thumbnails, webview user-data), logs, crash dumps.
- `%LOCALAPPDATA%\SiyanaMarkdownViewer\Cache\` → add a "rebuild cache" command
  in the UI. A cache that cannot be nuked from inside the app is a support
  burden.
- Never, ever write to the folder containing the user's documents. A viewer
  that drops index files next to a book is a viewer users uninstall.

🟡 **UNVERIFIED / caution.** `%APPDATA%` roams via Group Policy, and roaming a
large cache across a slow domain link is a well-known enterprise pathology.
Keep roaming payloads under ~1 MB.

### 5.2 The filesystem's actual rules

✅ **VERIFIED — Illegal characters** ([Microsoft — Naming Files](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)):

```text
<  >  :  "  /  \  |  ?  *      plus NUL (0) and control chars 1..31
```

Note that `:` is on the list — which is also the alternate-data-stream
delimiter. So `notes:work.md` on NTFS is not "a file with a colon in the name";
it is `notes` with a stream called `work.md`. ✅ **VERIFIED** — `spam:00` creates
a data stream named `00` on NTFS, is invalid on FAT, and is a literal filename on
VirtualBox shared folders ([CPython PR #95486 — `ntpath.isreserved()`](https://github.com/python/cpython/pull/95486)).

✅ **VERIFIED — Reserved device names**:

```text
CON  PRN  AUX  NUL
COM1..COM9, COM¹  COM²  COM³
LPT1..LPT9, LPT¹  LPT²  LPT³
```text

The superscript digits are the real trap: Windows treats the ISO/IEC 8859-1
superscripts as digits, so ``echo test > COM¹`` fails to create a file. Reserved
status applies with *any* extension — `NUL.txt`, `NUL.tar.gz` and `NUL` are all
the device.

✅ **VERIFIED — Trailing dots and spaces are stripped by the Object Manager on
creation**: `' Foo.txt'` → `Foo.txt`, `'Foo.txt '` → `Foo.txt`, `'Foo.txt.'` →
`Foo.txt`. Only ASCII Space (0x20) and ASCII Period (0x2E) are special;
U+3000 IDEOGRAPHIC SPACE is preserved ([Microsoft — Whitespace characters in file
and folder names](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/file-folder-name-whitespace-characters)).

✅ **VERIFIED — Case-insensitive but case-preserving**: `Notes.md` and `notes.md`
are the same file. NTFS stores the case you created it with and returns it, but
comparisons ignore case.

🔴 **The landmine.** A user has two files in different folders:
`C:\a\Notes.md` and `C:\b\notes.md`. Both exist. They are distinct paths. Now
make your recent-files list a `Map<string, ...>` keyed by **basename**. On
Windows they collide. On Linux they don't. This bug will not reproduce on the
developer's Linux CI.

🔧 **RECOMMENDED.**

- Key caches by a **case-folded full path**, never by basename.
- Never *create* a file whose name is not portable. Our app writes caches and
  exports; both must be safe to put on FAT32, a FAT-formatted SD card, and SMB.
- Validate any user-supplied filename before use with a portable-name check
  modelled on CPython's `isreserved()`: reject reserved device stems (case-
  insensitively, including the superscript forms), reject trailing dot/space,
  reject `<>:"/\|?*`.
- Use `GetShortPathNameW` as a last-resort compat trick when shelling out to
  another program near `MAX_PATH` — but 🟡 note that short names are
  unavailable on some volumes and `GetShortPathName` needs the path to already
  exist.

### 5.3 `MAX_PATH` and long paths

✅ **VERIFIED** — The classic limit is `MAX_PATH` = 260 characters *including the
terminating NUL*. Extended-length paths use the `\\?\` prefix and reach **32,767
characters**, with each component bounded by `GetVolumeInformation`'s
`lpMaximumComponentLength` (commonly 255 for NTFS/exFAT, 110 for Joliet CD,
protocol-dependent for network volumes)
([Microsoft — Maximum Path Length Limitation](https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation)).

To get extended behaviour **without** the `\\?\` prefix (i.e. normal path strings
just work), **two independent opt-ins are both required**:

1. Registry: `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled`
   = `REG_DWORD` `1`. Also settable by Group Policy at *Computer Configuration →
   Administrative Templates → System → Filesystem → Enable Win32 long paths*, or
   by Intune CSP. ⚠️ The value is **cached per-process on first use** and is not
   re-read; a reboot may be needed for all processes to notice.
2. Manifest:

```xml
<application xmlns="urn:schemas-microsoft-com:asm.v3">
  <windowsSettings xmlns:ws2="http://schemas.microsoft.com/SMI/2016/WindowsSettings">
    <ws2:longPathAware>true</ws2:longPathAware>
  </windowsSettings>
</application>
```

🔴 **`\\?\` is not free.** ✅ **VERIFIED** — the prefix means *"pass the string to
the filesystem with minimal modification"*: no forward-slash translation, no `.`
resolution, no `..` resolution, and **it cannot be used with a relative path**.
✅ **VERIFIED** — `"\\?\C:\dir\file . ."` is *not* equivalent to `"\\?\C:\dir\file"`,
so extended syntax and trailing-space stripping interact badly
([CPython PR #95486](https://github.com/python/cpython/pull/95486)).

✅ **VERIFIED** — Explorer itself does **not** declare `longPathAware`, so the
shell still refuses paths over 260 even when the machine is configured for long
paths. You can create a 300-character path with an app; you then cannot easily
delete it by double-clicking.

🔧 **RECOMMENDED.**

- Ship `<ws2:longPathAware>true</ws2:longPathAware>` in the app manifest. It costs
  nothing and removes a whole class of "works on my machine" bugs.
- Do **not** silently flip the machine-wide registry. That is an admin decision
  with system-wide side effects; 🔧 document the two opt-ins in
  `docs/TROUBLESHOOTING.md` instead.
- Never build `\\?\` paths by string concatenation. If you must, do it in one
  place, from an already-absolute, already-normalised path.
- **Never delete your own caches with naive recursive deletion.** Use
  `SHFileOperationW`/`IFileOperation`, or Rust's `remove_dir_all` on paths you
  constructed. A `MAX_PATH` failure inside a cache wipe leaves a directory the
  user cannot clean up by hand.
- ✅ **VERIFIED** — UNC has its own prefix form: `\\?\UNC\server\share`.

### 5.4 Junctions and reparse points

✅ **VERIFIED** — Windows 7+ kept `C:\Documents and Settings` and
`C:\ProgramData` as *junctions* to `C:\Users` and `C:\ProgramData` respectively, so
legacy paths keep working.

🔴 **This interacts badly with file watching.** A junction is a reparse point;
enumerating through it can double-count or loop, and a naive recursive watcher
can watch the same tree twice. See §6.

🟡 **UNVERIFIED.** `ReadDirectoryChangesW` behaviour around junctions has
changed across Windows versions and is thinly documented; the safe engineering
answer is to **normalise every path through `GetFinalPathNameByHandleW`** before
caching or comparing, and to refuse to follow reparse points during recursive
walks unless the user explicitly asked.

### 5.5 Alternate data streams — the security-relevant one

✅ **VERIFIED** — Full stream names are `filename:streamname:$DATA`, e.g.
`myfile.dat:stream1:$DATA`, and `"$DATA"` is itself a legal stream name so
`sample:$DATA:$DATA` is the fully-qualified default stream
([Microsoft — File Streams](https://github.com/MicrosoftDocs/win32/blob/docs/desktop-src/FileIO/file-streams.md)).

🔴 Why a *viewer* cares: a Markdown file on NTFS can carry hidden content in a
named stream. If we ever diff, hash, or sync "the file", the hash covers only
`::$DATA`. If we ever *write* an "export" using `path:with:colons`, we silently
create a stream. 🔧 **RECOMMENDED** — treat `:` in any user-derived path as a
hard error, and when fingerprinting a document for cache keys, hash the bytes we
actually read.

### 5.6 CRLF — why it matters more than it looks

Windows text files are `CRLF` (`\r\n`) by default. Three concrete consequences:

1. **CommonMark hard line breaks.** A line break inside a paragraph requires two
   trailing spaces *or* a backslash at end of line. A naive `split("\n")` leaves
   a trailing `\r` on every line, which means `"foo  \r"` — the two spaces are no
   longer trailing, so the hard break silently disappears. Our block splitter
   must strip `\r` at line boundaries.
2. **DOM text nodes normalise.** Setting `textContent` from a CRLF string and
   reading `getBoundingClientRect` is fine, but **measuring** and **searching**
   with CRLF in the needle will not match the normalised text. 🔧 Normalise to LF
   at the file-read boundary, once, and never again.
3. **Checksum instability.** If our on-disk cache key is a hash of the raw bytes,
   the same logical document has two keys depending on which machine's Git
   `core.autocrlf` setting produced it. 🔧 Hash the **normalised** text, and keep
   the raw bytes only for "has this file changed on disk" checks.

🔧 **RECOMMENDED pipeline:

```text
read bytes → decode UTF-8 (BOM tolerated, stripped)
           → normalise CRLF and lone CR to LF
           → this is the "canonical text"; everything downstream uses it
           → separately: (mtime, size) for change detection, raw bytes for
             "Save As" fidelity if the user edits
```diff

---

## 6. File watching on Windows

### 6.1 `ReadDirectoryChangesW` — the contract

✅ **VERIFIED** ([Microsoft — ReadDirectoryChangesW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw)):

- The directory handle comes from `CreateFileW` with
  `FILE_FLAG_BACKUP_SEMANTICS` (and `FILE_FLAG_OVERLAPPED` for async).
- The filter flags are `FILE_NOTIFY_CHANGE_FILE_NAME`, `_DIR_NAME`,
  `_ATTRIBUTES`, `_SIZE`, `_LAST_WRITE`, `_LAST_ACCESS`, `_CREATION`, `_SECURITY`.
- ✅ *"The operating system detects a change to file size **only when the file is
  written to the disk**. For operating systems that use extensive caching,
  detection occurs only when the cache is sufficiently flushed."* — i.e. a
  `notify`-then-`read` race is real; always **re-stat and re-read** after a
  notification rather than trusting the payload.
- ✅ *"If the network redirector or the target file system does not support this
  operation, the function fails with `ERROR_INVALID_FUNCTION`."*
- ✅ Supported over SMB 3.0, SMB 3.0 TFO, Scale-out File Shares, CSVFS, ReFS.
- ✅ *"If you opened the file using the short name, you can receive change
  notifications for the short name."* And `FILE_NOTIFY_INFORMATION` explicitly
  warns that when both short and long names exist, **which one you get is
  unspecified** ([QualApps — Understanding ReadDirectoryChangesW](https://qualapps.blogspot.com/2010/05/understanding-readdirectorychangesw_19.html)).

### 6.2 The buffer-size pitfall — the most important paragraph in this section

✅ **VERIFIED** — *"When you first call ReadDirectoryChangesW, the system
allocates a buffer to store change information. This buffer is associated with the
directory handle until it is closed and its size does not change during its
lifetime. Directory changes that occur between calls to this function are added
to the buffer... **If the buffer overflows, ReadDirectoryChangesW will still return
true, but the entire contents of the buffer are discarded and the
`lpBytesReturned` parameter will be zero**, which indicates that your buffer was
too small."*

So overflow is **silent**, reported only as `lpBytesReturned == 0`, or as
`ERROR_NOTIFY_ENUM_DIR`. There is **no** "you lost events" callback.

Two more verified constraints:

- ✅ *"ReadDirectoryChangesW fails with `ERROR_INVALID_PARAMETER` when the buffer
  length is greater than **64 KB** and the application is monitoring a directory
  over the network."* So you cannot just make the buffer huge to avoid overflow.
- ✅ `"ERROR_NOACCESS" when the buffer is not aligned on a DWORD boundary`, and
  `sizeof(FILE_NOTIFY_INFORMATION)` is 16 bytes minimum, so
  `nBufferLength` must be in **bytes** (`sizeof(array)`, not element count) —
  a mistake visible in several public code samples.

🟡 **Community finding:** the kernel-side buffer is allocated from **non-paged
pool**, sized to match your user buffer, and a new one is allocated per
`FileSystemWatcher`/`ReadDirectoryChangesW` instance. Raising `InternalBufferSize`
is therefore a global resource cost, not a local one
([ExchangeTutorials — FileSystemWatcher and Windows 7](https://www.exchangetuts.com/index.php/filesystemwatcher-and-windows-7-1640071923845537)).

🔧 **RECOMMENDED** — the only correct overflow strategy:

1. Request the **narrowest** filter set that still catches a save. For a Markdown
   viewer, `FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE |
   FILE_NOTIFY_CHANGE_SIZE` and deliberately *not* `_ATTRIBUTES` / `_SECURITY` /
   `_LAST_ACCESS`. Every excluded flag is events you don't have to buffer.
2. Use a **64 KB buffer on local paths** and **≤64 KB on network paths** — one
   code path, no platform branch.
3. **On `lpBytesReturned == 0` or `ERROR_NOTIFY_ENUM_DIR`, treat the watch as
   "I know nothing"** and do a full directory re-enumeration. Never try to
   reconstruct the lost events.
4. **Debounce.** Editors write files in bursts (write temp, rename, chmod). A
   150–400 ms trailing debounce per path collapses most bursts into one read.
5. **Always re-read from disk after the debounce.** Do not use the notification
   payload as content.

### 6.3 Two more verified behaviours that will bite

🟡 **Symbolic links produce no notifications.** ✅ **VERIFIED** via QualApps:
*"If you are using symbolic links... then no notification will [be] generated for
the linked file."* 🔴 Our users will absolutely put a symlinked vault in Dropbox
or Git and expect live reload. It will not happen through the link.

🔴 **Directory-handle watching locks the directory.** ✅ **VERIFIED** — the handle
must be opened with `FILE_SHARE_DELETE` or other processes cannot rename or
delete inside that directory; and a watched directory cannot itself be deleted.
To survive deletion of a watched subtree, watch the **parent** and filter.

### 6.4 The three libraries, compared

| | `.NET FileSystemWatcher` | Node `chokidar` | Rust `notify` |
|---|---|---|---|
| Underlying API | `ReadDirectoryChangesW` | `fs.watch` → libuv → `ReadDirectoryChangesW` | `ReadDirectoryChangesW` directly |
| Buffer | `InternalBufferSize`, default 8 KB, non-paged pool | libuv-managed, no user control | `BUF_SIZE` compile-time constant in `notify/src/windows.rs` |
| Overflow signal | `Error` event | 🟡 silent-ish, has fallbacks | 🟡 silent in older versions |
| Recursive | Yes (`IncludeSubdirectories`) | Yes | Yes |
| Extra surface | .NET runtime (~70 MB) | Already in our stack | Zero |
| Debouncing | DIY | ✅ built-in (`awaitWriteFinish`) | DIY or `notify-debouncer-*` |

✅ **VERIFIED — `notify`'s Windows backend** (`notify/src/windows.rs`,
[notify-rs/notify](https://github.com/notify-rs/notify/blob/main/notify/src/windows.rs)):
the type is `ReadDirectoryChangesWatcher`, it calls `ReadDirectoryChangesW`
asynchronously with a **completion routine**, uses an in-request
`buffer: [u8; BUF_SIZE]`, watches all seven `FILE_NOTIFY_CHANGE_*` flags, and
sets `bWatchSubtree` from `RecursiveMode`. Its own source notes *"An I/O
completion port would probably be more performant."* Its public API also has a
`WindowsPathSeparatorStyle` config added specifically because emitted event paths
did not match the watched path's separators (#375), and `unwatch()` was changed to
**block until the watch is fully removed** so later events do not leak (#730).

✅ **VERIFIED — `notify` v8.2.0**, published 2026-09-06. Its documented
**Known Problems** include: network filesystems like NFS may emit no events
(notably WSL watching Windows paths, issue #254); the Linux backend "is not a
100% reliable source" for very large directories (issue #412); and hitting
`max_user_watches` manifests as "Bad File Descriptor / No space left on device"
([docs.rs/notify 8.2.0](https://docs.rs/notify/latest/notify/)).

🟡 **Important gap.** A 2024+ PR ([notify-rs/notify #964](https://github.com/notify-rs/notify/pull/964))
exists to *"emit rescan events for lost change details"* — Windows signalling a
discarded buffer "either [as] a successful completion with zero transferred bytes,
or [as] `ERROR_NOTIFY_ENUM_DIR`". 🟡 The PR is merged in the changelog for
`8.x`, but **we must verify at implementation time** that the `notify` version we
pin actually emits `Flag::Rescan`, and if it does not, we must handle
`Rescan` ourselves or fall back to polling that path.

🔧 **RECOMMENDED.** Use **`notify` on the Rust side** (it is already in the tree
via Tauri, has no runtime cost, and is the only option that lets us handle
`Rescan` explicitly), and treat **every** watch as *advisory*: a notification
means "something changed, go look". Add a **low-frequency reconciliation poll**
(every 30 s for the open document tree) so that a silent overflow, a missed SMB
notification, or a symlinked folder degrades to "slightly stale" rather than
"permanently wrong". A viewer that is 30 seconds stale is fine. A viewer that
never notices a `git pull` is not.

---

## 7. Atomic rename semantics

Does `rename` overwrite on Windows? **Not with the API you probably think.**

| API | Overwrites an existing target? | Notes |
|-----|-------------------------------|-------|
| `MoveFileExW` + `MOVEFILE_REPLACE_EXISTING` | Yes | ✅ **VERIFIED**. Documented as *"replace an existing file, move a file across volumes, and delay moving the file until the OS is restarted"* ([Microsoft — Moving and Replacing Files](https://learn.microsoft.com/en-us/windows/win32/fileio/moving-and-replacing-files)) |
| `ReplaceFileW` | Yes | Preserves destination ACLs/attributes; can write a backup |
| Rust `std::fs::rename` | ❌ **Fails if the target exists** | POSIX semantics on Windows differ from the native API |
| Node `fs.rename` / `renameSync` | ✅ Replaces | Maps to `MoveFileExW` + `MOVEFILE_REPLACE_EXISTING` |
| `.NET File.Move` | ❌ Throws `IOException` unless the 2-arg overload | |
| Git's atomic-write pattern (temp + rename) | ✅ Works | The pattern everyone actually uses |

🟡 **UNVERIFIED — atomicity.** 🟡 Multiple sources note that Microsoft's docs do
**not** promise `MOVEFILE_REPLACE_EXISTING` is atomic
([LWN — Atomic rename in Windows](https://lwn.net/Articles/682988/)), and
Stack Overflow reports it failing with `ERROR_SHARING_VIOLATION` when the
destination is open by another process without `FILE_SHARE_DELETE`. The reliable
statement is: **on the same volume, NTFS metadata operations are journaled and
observers do not see a torn file**; across volumes `MoveFileEx` degrades to
copy+delete and is *definitely* not atomic.

🔴 **The practical failure.** 🔧 **RECOMMENDED** — this is the one that will
actually reach users:

> Rust's `std::fs::rename` fails if the destination exists. Our cache writer
> writes `cache.tmp` then renames to `cache.bin`. On Windows that **fails on the
> very first write after every process restart** and on every write where the
> previous file exists. Result: the cache silently never updates, forever,
> because the code swallows the error.

Fix: delete-then-rename, or use `ReplaceFileW`/`MoveFileExW` with
`MOVEFILE_REPLACE_EXISTING`, or write to a uniquely-named temp and rename. And
when you write to a directory the user can also have open in Explorer, always open
with `FILE_SHARE_DELETE` semantics (Rust's `OpenOptions` on Windows permits
delete sharing by default for `File`, but be deliberate).

---

## 8. DPI awareness — the manifest requirement

✅ **VERIFIED** — There are two manifest settings and they are not equivalent
([Microsoft — Setting the default DPI awareness for a process](https://learn.microsoft.com/en-us/windows/win32/hidpi/setting-the-default-dpi-awareness-for-a-process)):

| Mode | `dpiAware` (Vista) | `dpiAwareness` (Win10 1607+) |
|------|--------------------|--------------------------------|
| Unaware | absent / `false` | `Unaware` |
| System aware | `true` | `System` |
| Per Monitor | `true/pm` | `PerMonitor` |
| **Per Monitor V2** | ❌ not expressible | **`PerMonitorV2`** |

✅ **VERIFIED** — *"On Windows 10, version 1607 and on, the setting [`dpiAware`]
is ignored if the [`dpiAwareness`] element is present."* And ✅ *"Once a window
(an HWND) has been created in your process, changing the DPI awareness mode is no
longer supported"* — the programmatic `SetProcessDpiAwarenessContext` call must
happen before any window exists.

🔧 **RECOMMENDED** manifest, combining the DPI and long-path opt-ins:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"
          xmlns:asmv3="urn:schemas-microsoft-com:asm.v3">
  <assemblyIdentity version="1.0.0.0" name="SiyanaMarkdownViewer.app" type="win32"/>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
      <ws2:longPathAware xmlns:ws2="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</ws2:longPathAware>
    </windowsSettings>
  </application>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 / 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
</assembly>
```

**Per-Monitor V2 is what makes a text app usable.** ✅ **VERIFIED** — under PMv2
Windows sends `WM_DPICHANGED` and does *not* bitmap-stretch; the app is
responsible for resizing itself, and non-client areas (caption, scrollbars, menus)
scale automatically. ✅ **VERIFIED** — V2 additionally covers non-client scaling,
child-HWND DPI-change notification, and dialog/thread awareness.

🔴 What happens if we ship without it: Windows scales the *entire* webview as a
bitmap on a 150% or 200% display. Text is blurry, subpixel antialiasing is lost,
and scrolling tears. For an app whose entire product is reading text, this is
fatal to the product. For a Tauri app, the template ships the correct manifest —
but **verify, do not assume**, by checking the built `.exe` with
`mt.exe -inputresource:app.exe -out:dump.xml` in CI.

### Fractional scaling and the webview

🟡 **UNVERIFIED.** Chromium's handling of fractional device scale factors has
changed across Edge major versions (125%, 150%, 175%). Expect occasional
sub-pixel line-height drift at 125% and 150%. 🔧 Mitigation: express all metrics
in `rem`/`em` and avoid hard-coded pixel borders under 1 px; test on 125%, 150%
and 200% in CI with a screenshot diff.

---

## 9. Console/subsystem selection

✅ **VERIFIED** — MSVC links GUI apps as `/SUBSYSTEM:WINDOWS` with an entry
point of `wWinMain`; console apps as `/SUBSYSTEM:CONSOLE` with `main`.

A GUI app has no stdout. `println!` goes nowhere. Three consequences:

1. 🔧 **Logging must go to files**, under `%LOCALAPPDATA%\...\logs\`, with a
   rotation policy. A viewer that cannot tell a user "here is the log" when the
   webview fails to initialise has no support story.
2. 🔧 **`std::env::args()` still works**, so CLI flags (`--print`, `--export-pdf`)
   are fine.
3. 🔴 **If you ever want a bundled terminal or to run `git` interactively**, a
   GUI-subsystem binary has no console to attach to. 🟡 The standard fix is to
   ship a tiny **console-subsystem shim** (or set
   `tauri.conf.json > bundle > windows > webviewInstallMode` alongside a
   `console` feature). 🔧 **RECOMMENDED** — do this at the start, not later: it
   is a 20-line crate and retrofitting it into a shipped product is painful.

---

## 10. Symlinks require Developer Mode or admin

🔴 **VERIFIED.** Creating a symbolic link on Windows requires either
`SeCreateSymbolicLinkPrivilege` (administrators, by default) or **Developer Mode**
(`Settings → Privacy & security → For developers`), which grants the privilege to
the standard user.

```powershell
# Requires Developer Mode or an elevated shell
New-Item -ItemType SymbolicLink -Path C:\notes -Target D:\vault\notes

# Hard links work without either, same volume only
New-Item -ItemType HardLink -Path C:\notes.md -Target D:\vault\notes.md
```text

What this means for us:

- 🔧 **Never create symlinks in a normal code path.** If our cache or config
  layout ever wants one, feature-detect and fall back to a real directory.
- 🔧 **Follow symlinks on *input*.** Users symlink their vaults all the time
  *because* of this privilege situation. Our file picker and `open` path must
  resolve them (`GetFinalPathNameByHandleW`) and our "watch this folder" must
  watch the **target**, because — see §6.3 — links generate no notifications.
- 🟡 **UNC + symlink + WebView2 Fixed Version is a known-bad combination**; ✅
  **VERIFIED** that Fixed Version "cannot be run from a network location or UNC
  path", so a network-mounted install with a Fixed Version runtime is
  unsupported.

---

## 11. The Windows-only landmine checklist

Print this. Every line is a bug we have avoided by writing it down.

| # | Landmine | Our defence |
|---|----------|-------------|
| 1 | `std::fs::rename` fails when the target exists | Use replace-semantics explicitly; test restart-then-write |
| 2 | `ReadDirectoryChangesW` overflow is silent (`lpBytesReturned == 0`) | Narrow filter flags + 64 KB + re-enumerate on zero + 30 s reconciliation poll |
| 3 | >64 KB buffer over a network path = `ERROR_INVALID_PARAMETER` | One buffer size, 64 KB, everywhere |
| 4 | Reserved device names, incl. `COM¹` and `NUL.md` | Portable-name validation on every write |
| 5 | Trailing dot/space silently stripped on create | Reject on write; never trust on read |
| 6 | `:` creates an NTFS alternate data stream | Reject `:` in derived paths |
| 7 | Case-insensitive but case-preserving | Case-folded **full** paths as cache keys, never basenames |
| 8 | `MAX_PATH` = 260 unless registry **and** manifest opt in | Ship `longPathAware`; document the registry key; never naive `\\?\` |
| 9 | Explorer ignores `longPathAware` | Users can create paths they cannot delete; warn in-app if path > 240 |
| 10 | Missing `PerMonitorV2` → blurry bitmap scaling | Manifest + CI check of the built exe |
| 11 | `ReadDirectoryChangesW` gives no symlink notifications | Resolve with `GetFinalPathNameByHandleW`; poll as backstop |
| 12 | Watched directory can't be deleted; missing `FILE_SHARE_DELETE` blocks other apps | Watch the parent; open with share-delete |
| 13 | CRLF kills CommonMark hard line breaks | Normalise CRLF→LF at the read boundary, once |
| 14 | No stdout in a GUI subsystem | File logging + console shim crate from day one |
| 15 | Symlink creation needs Developer Mode/admin | Never create; always follow |
| 16 | MSI build needs the deprecated VBSCRIPT feature | Build MSI/MSIX on `windows-latest` only |
| 17 | WebView2 bootstrapper needs internet at install | Default to `offlineInstaller`; ship a slim + a portable build |
| 18 | EV certs no longer shortcut SmartScreen | One OV cert, never rotated, signed every release |
| 19 | File watchers observe only flushed writes | Debounce **and** re-read from disk |
| 20 | `C:\Documents and Settings` junctions cause double-walks | Reject reparse points in recursive walks |

---

## Sources

- [Windows 10 end of support](https://www.microsoft.com/en-us/windows/end-of-support) · [Consumer ESU](https://www.microsoft.com/en-us/windows/extended-security-updates) · [ESU FAQ](https://learn.microsoft.com/en-us/lifecycle/faq/extended-security-updates)
- [WebView2: Evergreen vs Fixed](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version) · [Distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution) · [Developer guide](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/developer-guide) · [2-week cadence announcement](https://blogs.windows.com/msedgedev/2026/08/24/webview2-is-moving-to-a-2-week-release-cadence/)
- [Maximum Path Length Limitation](https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation) · [Naming a File](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file) · [File Streams](https://github.com/MicrosoftDocs/win32/blob/docs/desktop-src/FileIO/file-streams.md) · [Moving and Replacing Files](https://learn.microsoft.com/en-us/windows/win32/fileio/moving-and-replacing-files)
- [ReadDirectoryChangesW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw) · [Obtaining Directory Change Notifications](https://learn.microsoft.com/en-us/windows/win32/fileio/obtaining-directory-change-notifications)
- [Setting the default DPI awareness](https://learn.microsoft.com/en-us/windows/win32/hidpi/setting-the-default-dpi-awareness-for-a-process) · [DPI awareness context](https://learn.microsoft.com/en-us/windows/win32/hidpi/dpi-awareness-context)
- [Known Folder ID](https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid) · [Whitespace in file names](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/file-folder-name-whitespace-characters)
- [Tauri: Prerequisites](https://v2.tauri.app/start/prerequisites/) · [Windows Installer](https://v2.tauri.app/distribute/windows-installer/) · [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)
- [notify 8.2.0 docs](https://docs.rs/notify/latest/notify/) · [notify source, Windows backend](https://github.com/notify-rs/notify/blob/main/notify/src/windows.rs) · [PR #964 rescan](https://github.com/notify-rs/notify/pull/964)
- [electron-builder MSI/NSIS/Portable](https://www.electron.build/docs/msi) · [MSIX limitations](https://www.advancedinstaller.com/msix-limitations.html)
