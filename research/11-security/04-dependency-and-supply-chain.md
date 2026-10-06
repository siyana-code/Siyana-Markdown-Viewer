# 04 — Dependency and supply chain

> A desktop app is not a library. "It'll resolve on install" is not a supply
> chain posture; it is an absence of one.

---

## 1. Why supply chain is a first-class risk here

Two arguments, both specific to this project.

**Argument 1: the app auto-updates, so compromise scales.** A malicious
dependency shipped in version 1.4.2 reaches every user who upgrades, on every
platform, with no user interaction beyond clicking "update". The attacker's
distribution problem is solved for them by our updater.

**Argument 2: our dependency graph contains the two most exploited components in
the Markdown ecosystem.** We will depend on a Markdown parser and an HTML
sanitizer. Both have long, well-documented CVE histories, and both are exactly
the components where a bug is remote code execution rather than a data leak:

| Component | Documented CVEs (all verified, see §6) |
|-----------|----------------------------------------|
| `marked` | [CVE-2017-1000427](https://nvd.nist.gov/vuln/detail/CVE-2017-1000427) XSS in the `data:` URI parser; [CVE-2017-17461](https://github.com/advisories/GHSA-p9wx-2529-fp83) ReDoS; [CVE-2022-21680](https://nvd.nist.gov/vuln/detail/CVE-2022-21680) ReDoS in `block.def`; [CVE-2022-21681](https://nvd.nist.gov/vuln/detail/CVE-2022-21681) ReDoS in `inline.reflinkSearch` |
| `markdown-it` | [CVE-2022-21670](https://nvd.nist.gov/vuln/detail/CVE-2022-21670) ReDoS; [CVE-2025-7969](https://nvd.nist.gov/vuln/detail/CVE-2025-7969) XSS in the fence renderer (disputed by the vendor, cited for the bug class); [CVE-2026-48988](https://nvd.nist.gov/vuln/detail/CVE-2026-48988) quadratic DoS in the smartquotes rule when `typographer` is enabled |
| DOMPurify | [CVE-2024-45801](https://nvd.nist.gov/vuln/detail/CVE-2024-45801), [CVE-2024-47875](https://nvd.nist.gov/vuln/detail/CVE-2024-47875), [CVE-2024-48910](https://nvd.nist.gov/vuln/detail/CVE-2024-48910), [CVE-2025-26791](https://nvd.nist.gov/vuln/detail/CVE-2025-26791), [CVE-2026-0540](https://nvd.nist.gov/vuln/detail/CVE-2026-0540), [CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238), [CVE-2026-41239](https://nvd.nist.gov/vuln/detail/CVE-2026-41239), [CVE-2026-41240](https://nvd.nist.gov/vuln/detail/CVE-2026-41240), [CVE-2026-47423](https://nvd.nist.gov/vuln/detail/CVE-2026-47423), [CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914) |
| `markdown2` | [CVE-2018-5773](https://github.com/advisories/GHSA-p6h9-gw49-rqm4) — the `safe_mode` XSS filter bypassed by an omitted `>` |
| Full products | Typora: [CVE-2019-7296](https://nvd.nist.gov/vuln/detail/CVE-2019-7296), [CVE-2020-18221](https://nvd.nist.gov/vuln/detail/CVE-2020-18221), [CVE-2020-18748](https://nvd.nist.gov/vuln/detail/CVE-2020-18748), [CVE-2023-2317](https://www.cve.org/CVERecord?id=CVE-2023-2317), [CVE-2023-39703](https://nvd.nist.gov/vuln/detail/CVE-2023-39703), [CVE-2024-31783](https://nvd.nist.gov/vuln/detail/CVE-2024-31783). MarkText: [CVE-2021-29996](https://nvd.nist.gov/vuln/detail/cve-2021-29996), [CVE-2022-21158](https://nvd.nist.gov/vuln/detail/CVE-2022-21158), [CVE-2022-24123](https://nvd.nist.gov/vuln/detail/CVE-2022-24123), [CVE-2022-25069](https://nvd.nist.gov/vuln/detail/CVE-2022-25069), [CVE-2023-2318](https://nvd.nist.gov/vuln/detail/CVE-2023-2318) |

Read that table again with the project in mind: **the sanitizer and the parser
we will depend on are both on it.** Supply chain hygiene is not a nice-to-have
for us; it is one of the two things keeping boundary 3 intact.

**Argument 3: the ecosystem is young.** Markdown is a large, low-barrier
contribution ecosystem. Package squatting on a plausible name (`markdown-sanitize`,
`dompurify-lite`) is trivial. We take exact versions and verify integrities for
exactly this reason.

## 2. Lockfiles are mandatory, and this is an app

The distinction matters and is often gotten wrong.

| | Library | App (us) |
|---|---|---|
| Consumers choose their own versions | yes | we ship a lockfile and *we* run the install |
| Caret ranges in `package.json` | fine, even preferred | **unacceptable** |
| Transitive floating versions | the consumer's problem | **our problem** |
| `npm install` vs `npm ci` | `install` is fine | **only `ci`** |
| `Cargo.lock` | often committed; for libraries, optional | **committed, always** |
| `Cargo.toml` caret ranges | fine | fine, *because* the lockfile pins |

Reasoning: a library consumer resolves the tree themselves and gets their own
security posture. An application's install is what the CI pipeline runs and what
a user might run from source. If `package.json` says `"dompurify": "^3.2.0"` and
CI runs `npm install`, then a new 3.x release that introduces a bypass gets
picked up by the next build — the exact scenario that produced
[CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238) exposure windows
in the ecosystem.

### 2.1 Concrete configuration

```jsonc
// package.json — ranges in package.json are still present (npm requires
// them), but CI never resolves them. Renovate/Dependabot updates the lockfile.
{
  "dependencies": {
    "dompurify": "3.4.16",                 // EXACT, not ^3.4.16
    "sanitize-html": "2.17.0"
  }
}
```text

```yaml
# .npmrc — belt and braces
save-exact=true
engine-strict=true
ignore-scripts=false          # we review scripts, we do not disable them
audit=true
fund=false
```text

```yaml
# .yarnrc.yml (if Yarn is used)
enableImmutableInstalls: true     # CI errors if the lockfile would change
```text

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = [...] }

[profile.release]
# Reproducibility helpers
strip = "symbols"
lto = true
codegen-units = 1
panic = "abort"                # smaller binary; a Rust panic cannot be caught anyway
```

**The one place ranges are allowed** is `Cargo.toml`, because `Cargo.lock` is
committed and CI runs `cargo build --locked`. `--locked` makes Cargo *error* if
the lockfile would need to change.

### 2.2 CI enforcement

```yaml
- name: Verify the lockfile is not modified
  run: |
    npm ci --ignore-scripts=false
    git diff --exit-code package-lock.json pnpm-lock.yaml || {
      echo "::error::The lockfile changed. Commit it or use --frozen-lockfile."; exit 1; }
    cargo build --locked --manifest-path src-tauri/Cargo.toml
```text

And for the packaged artifact, assert the resolved versions are what we expect:

```ts
// scripts/assert-pinned-deps.ts — run in CI
import { readFileSync } from 'node:fs';

const CRITICAL: Record<string, string> = {
  'dompurify':   '3.4.16',
  'marked':      'X.Y.Z',        // whichever parser ADR-0004 selects
};

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
for (const [name, want] of Object.entries(CRITICAL)) {
  const got = lock.packages[`node_modules/${name}`]?.version;
  if (got !== want) {
    throw new Error(`${name}: locked at ${got}, baseline requires ${want}. ` +
                    'This change requires a security review of the release notes.');
  }
}
```text

This is a deliberately annoying check. It is annoying in the same way a compiler
error is annoying: it converts a decision that would otherwise be implicit and
unreviewed into an explicit, greppable event.

## 3. Integrity verification

The lockfile records integrity hashes; the package manager verifies them on
install. What we must ensure is that nobody disables that.

```jsonc
// package-lock.json (v3) — integrity is present for every resolved package
"node_modules/dompurify": {
  "version": "3.4.16",
  "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz",
  "integrity": "sha512-<base64>",      // ← this is the security-relevant field
  "engines": { "node": ">=18" }
}
```bash

Cargo does the analogous thing with `Cargo.lock`'s `checksum` field, verified
against crates.io's index. Both are opt-*out*, not opt-*in*, which means we
should check for the opt-outs:

```bash
# CI: nothing may disable integrity verification.
! grep -rn -- '--no-verify' package.json .npmrc .yarnrc.yml scripts/ 2>/dev/null
! grep -rn 'ignore-scripts\s*=\s*true' .npmrc 2>/dev/null
! grep -rn 'net\.git-fetch-with-cli\|git = ' .cargo/config.toml 2>/dev/null || true
```

**`ignore-scripts` deserves a decision rather than a shrug.** Disabling install
scripts removes a real supply-chain vector (a malicious `postinstall` runs as our
user). It also breaks legitimate native builds, which `node-gyp`, `esbuild`,
and `sharp` all use. Our position:

1. Do **not** globally disable.
2. Review every dependency with an install script, and record the decision.
3. Prefer dependencies that do not need one. For a Markdown viewer, this is a
   real design constraint: it pushes toward prebuilt binaries and away from
   anything that compiles native code at install time.

```bash
# Enumerate install scripts in the tree so the list is reviewable, not implicit.
npm ls --all --json | jq -r 'to_entries[] | select(.value.hasInstallScript == true) | .key'
```text

For Cargo, `build.rs` is the equivalent. `cargo deny` can enforce a licence
policy and flag unusual sources; `cargo-audit` checks advisories:

```bash
cargo install cargo-deny cargo-audit
cargo deny check advisories bans licenses sources
cargo audit
```text

## 4. Automated update management

### 4.1 Dependabot vs Renovate

| | Dependabot | Renovate |
|---|---|---|
| Security advisories | yes, grouped by advisory | yes, and configurable |
| Dependency updates | yes | yes, with far more granular control |
| Grouping / monorepo awareness | limited | excellent |
| Regex-pinned versions | no | yes |
| Lockfile-only PRs | yes | yes |
| Auto-merge | yes (with tests passing) | yes (much more configurable) |
| Recommended for a Tauri + npm monorepo | acceptable | **better** |

We use **both, non-overlappingly**, which is a supported pattern:

- **Dependabot** for `npm` and `cargo` **security** updates. It is GitHub-native,
  its advisory database is the same one GitHub's Security tab uses, and its
  grouping by advisory means one PR for one CVE.
- **Renovate** for version bumps, with explicit grouping so we are not buried in
  PRs, and with **security updates disabled** to avoid duplication.

```json5
// renovate.json5
{
  "extends": ["config:recommended", ":dependencyDashboard", ":semanticCommits"],
  "ignoreDeps": [],
  "packageRules": [
    // Never auto-merge. A new major of a dependency is a review event.
    { "matchUpdateTypes": ["major"], "automerge": false },
    // Security-critical packages: always grouped, never auto-merged.
    {
      "matchPackageNames": ["dompurify", "sanitize-html", "marked", "markdown-it", "shiki", "prismjs", "highlight.js"],
      "groupName": "render + sanitize (security-critical)",
      "automerge": false,
      "labels": ["security", "review-required"]
    },
    {
      "matchPackageNames": ["tauri", "electron"],
      "groupName": "shell",
      "automerge": false,
      "labels": ["security"]
    },
    { "matchUpdateTypes": ["minor", "patch"], "automerge": false, "labels": ["dependencies"] }
  ],
  "lockFileMaintenance": { "enabled": true, "automerge": false }
}
```text

### 4.2 What a sanitizer or parser update PR must contain

A template, so review is a checklist rather than an opinion:

```markdown
## Dependency update: <name> <old> → <new>

- [ ] Changelog read, link included.
- [ ] **Any CVE/GHSA referenced? Link it.** If yes, this is a security release
      and the release-note notes below are mandatory.
- [ ] Is this a **semantic** change to parsing or sanitization output? If yes:
      - [ ] Full CommonMark spec suite passes.
      - [ ] Full GFM spec suite passes.
      - [ ] Sanitizer payload corpus (30 cases) passes, **in a real browser**.
      - [ ] `git diff` of fixture snapshots reviewed — a diff here means
            behavior changed, which is the whole risk.
- [ ] Bundle size delta measured and recorded.
- [ ] No new transitive dependency.
- [ ] No install script added.
- [ ] `npm audit` / `cargo audit` clean.
```

The **fixture snapshot diff** is the highest-signal item on that list. A sanitizer
or parser update that changes *any* of our output on our fixture corpus is a
change in security posture, whether or not the release notes say so. A silent
one-character change in how an attribute is escaped is exactly the kind of thing
that turns into a bypass six months later.

```bash
npm run test:fixtures -- --update-snapshots   # regenerate
git diff packages/test-fixtures/__snapshots__   # a human reads this diff
```text

## 5. Signed updates and verification

### 5.1 Tauri

Tauri requires a signature for updates and it cannot be disabled:

> "Tauri's updater needs a signature to verify that the update is from a trusted
> source. **This cannot be disabled.**"
>
> — <https://v2.tauri.app/plugin/updater/>

```bash
# One-time, offline, on a machine that is not connected to CI.
pnpm tauri signer generate -w ~/.tauri/siyana.key -p ""
# Produces the key pair; the PUBLIC key goes in tauri.conf.json,
# the PRIVATE key is a release-only secret.
```text

```jsonc
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",     // public, safe to commit
      "endpoints": ["https://releases.siyana.app/{{target}}/{{arch}}/{{current_version}}"],
      "windows": { "installMode": "passive" }
    }
  }
}
```text

**The private key is the highest-value secret in the project.** Losing it means
we can never publish an update to existing installs — a self-inflicted
end-of-life. Stealing it means a signed malicious update reaching every user.
Controls:

- Generated **offline**, on hardware the CI runners cannot reach.
- Never in the repository, never in CI logs, never in a Docker layer.
- Stored in CI as an environment secret, masked in all log output, with
  `::add-mask::` immediately on read.
- Access to produce a release limited to named maintainers, with the release
  event logged and announced.
- Backed up offline, in at least two physical locations.
- Rotation is a documented, tested procedure — we rehearse it, because the first
  time anyone tests key rotation should not be during an incident.

```yaml
- name: Sign
  env:
    TAURI_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  run: |
    echo "::add-mask::${TAURI_PRIVATE_KEY}"
    pnpm tauri signer sign -f "$ARTIFACT" -p "" -k "$TAURI_PRIVATE_KEY" "$BUNDLE"
```

### 5.2 Electron

Electron's `autoUpdater` verification is **code signing**, not a separate artifact
signature. The chain:

1. The updater downloads the artifact.
2. It is verified against the platform's signature check **before** being applied:
   Authenticode on Windows, notarization on macOS, AppImage/DEB metadata and
   package signature checks on Linux.
3. On Windows, Squirrel/Electron Updater checks the Authenticode signature of the
   downloaded `.exe`/`.nupkg`.

So for Electron the supply chain requirement is **code signing with a real
certificate**, and the private key handling is identical to Tauri's.

```js
autoUpdater.logger = require('electron-log').scope('updater');
autoUpdater.autoDownload = false;              // explicit user consent
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', i => promptUser(i));
autoUpdater.on('update-downloaded', (i) => promptInstall(i));
autoUpdater.on('error', e => showSafeError(e)); // never surface raw paths/URLs
```text

`autoDownload = false` matters. An app that silently downloads and installs
updates is an app where a compromised CDN or a network attacker gets code
execution on a timer. Consent costs one dialog per update; the alternative costs
the project its users.

### 5.3 Release transparency

Signature verification answers "did this come from us?". It does not answer "did
we mean to ship this?". Add:

- **A signed release manifest** listing every artifact with its hash, generated
  in the same signing step.
- **The manifest published to a transparency log or a public, append-only file**
  in the repository. Anyone can diff what we shipped against what we announced.
- **A `SECURITY.md` with the disclosure route**, and a stated policy on
  good-faith research.

## 6. Auditing the HTML sanitizer

The sanitizer deserves more scrutiny than any other dependency, because a bug in
it *is* an RCE. Concrete audit procedure:

### 6.1 Audit the source, not the README

DOMPurify's own documentation is unusually good, and it tells you where the
authoritative lists live — because the wiki page explicitly says it is not a
complete enumeration:

> "**The authoritative current lists live in source.** This page exists to
> orient you, not to enumerate. The static enumeration that used to live here
> referenced DOMPurify v1.0.8 (from 2020) and has not been kept in sync with the
> library."
>
> | HTML allowed tags | `src/tags.ts` → `html` |
> | HTML allowed attributes | `src/attrs.ts` → `html` |
> | SVG allowed tags | `src/tags.ts` → `svg` |
> | MathML allowed tags | `src/tags.ts` → `mathMl` |
>
> — <https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist>

So the audit reads `src/tags.ts` and `src/attrs.ts` at **our pinned version**,
not at HEAD:

```bash
npm pack dompurify@3.4.16
tar xzf dompurify-3.4.16.tgz
# Diff the allow-lists against the previous version we shipped. A NEW tag or
# attribute in a patch release is a security event, not a routine update.
git diff --word-diff v3.4.10/tags.ts v3.4.16/tags.ts
```text

Note the framework of the project itself: `src/tags.ts` has `svgDisallowed` and
`mathMlDisallowed` lists, and the arrays are `freeze()`d at module load "to
prevent mutation by the host environment". Reading the source confirms that.

### 6.2 Read the threat model and the attack history, in full

Two wiki pages, and they are the single most useful security documentation in
the JavaScript ecosystem:

- [Security Goals & Threat Model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model)
- [Attack Classes & Bypass History](https://github.com/cure53/DOMPurify/wiki/Attack-Classes-%26-Bypass-History)

The threat model lists the tags and attributes to "think very hard about" before
allow-listing, and it has a distinction worth copying into our own review process:
**"honest foot-guns"** (dangerous in an obvious, local, developer-controllable
way, like an allowed `<iframe>`) versus **"hidden landmines"** (dangerous in a
non-obvious or unmitigatable way, like `<selectedcontent>` where the browser
re-clones content *after* sanitization, or `iframe srcdoc` where the value is an
unsanitized document). Our audit questions must ask "which class is this?"

The attack history gives us the regression corpus, and its framing is the right
one for our own tests:

> "The examples below are defensive test vectors. They are drawn from DOMPurify's
> regression tests, configuration tests, fuzzing work, public advisories, and
> historical sanitizer research."

So we do not invent payloads; we adopt theirs, plus our own.

### 6.3 Questions to answer, in writing, in an ADR

1. Which DOMPurify version, pinned exactly, and why that one?
2. Which config options, and is each one default or narrowed? **Any `ADD_*`
   option requires a written justification** — DOMPurify says to require "a
   *reason*" for each.
3. Is `ALLOWED_URI_REGEXP` customized? We say no, because it runs against
   attacker-controlled input and a badly written pattern is an attacker-triggerable
   ReDoS.
4. Is `SAFE_FOR_XML` on? Always.
5. Is `SANITIZE_DOM` on? Always.
6. Is `SANITIZE_NAMED_PROPS` on or off, and how do our prefixed ids compensate?
7. Do we use `RETURN_DOM_FRAGMENT` (screen) and string output (print/export), and
   does that change the safety argument?
8. What is our HTML-only profile, and does `USE_PROFILES: { html: true }` remove
   SVG and MathML entirely?
9. What is the server-side story, if any? (DOMPurify's README is a warning label
   here: "older versions of *jsdom* are known to be buggy in ways that result in
   XSS **even if DOMPurify does everything 100% correctly**".)
10. Is `dompurify` the only HTML sanitizer in the tree? `sanitize-html` and
    `isomorphic-dompurify` both appear as transitive dependencies of other
    projects, and we should know whether they are reachable with document content.

### 6.4 Fuzz it ourselves

A continuous fuzz job, because the upstream project's bug bounty is not our CI:

```rust
// fuzz/fuzz_sanitize.rs — cargo-fuzz
#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let Ok(html) = std::str::from_utf8(data) else { return };
    let rendered = siyana_core::render_html(html);
    let clean = siyana_core::sanitize(&rendered);
    // Invariant: the sanitized output must contain no active content.
    assert!(!clean.to_ascii_lowercase().contains("onerror"));
    assert!(!clean.to_ascii_lowercase().contains("<script"));
    assert!(!clean.to_ascii_lowercase().contains("javascript:"));
    // Invariant: sanitize is idempotent.
    assert_eq!(siyana_core::sanitize(&clean), clean);
});
```text

The **idempotence property** is the useful one: `sanitize(sanitize(x)) ==
sanitize(x)`. A single sanitization pass that can be un-done by a second one is a
strong signal that the parsing contexts differ, which is the mXSS class. Running
this against a real DOM (via a headless browser in the same job) rather than a
string-level mock is what makes it meaningful.

Plus a browser-level differential fuzz: generate random markup, sanitize,
insert, and assert the live DOM contains no event handler, no script element, no
`javascript:` URL, and no unexpected namespace. That catches the parser
differentials a string test cannot.

## 7. Auditing a parser dependency

A Markdown parser's security properties are:

| Property | Why it matters | How to test |
|----------|----------------|-------------|
| **Raw HTML handling** | determines whether we need the sanitizer at all (we do, either way) | render `<script>` and check the output contains it verbatim (conformance), then confirm the sanitizer removes it |
| **Algorithmic complexity** | ReDoS / quadratic blowup | benchmark against the published PoC shapes; assert a time bound |
| **Memory amplification** | a 1 MB input producing 500 MB of AST | assert `maxNodes`/`maxDepth` are enforced |
| **Prototype pollution** | `__proto__` in a reference label or a heading slug | fuzz with `__proto__`, `constructor`, `prototype` |
| **Panic resistance** | a Rust panic in the parse path is a DoS at minimum | fuzz with `cargo-fuzz`, plus a `catch_unwind` around the parse call |
| **Line/column reporting** | not security, but a parser with off-by-one offsets will be blamed for a security bug | spec suite |

Concretely, for `marked` the published mitigations were "avoid running untrusted
markdown through marked or run marked on a worker thread and set a reasonable time
limit" — which tells us the mitigation is **architectural** (a worker with a
timeout), not a config flag. That is why
[01-threat-model.md §5.8](./01-threat-model.md#58-vector-redos--algorithmic-complexity-dos)
makes the worker boundary mandatory rather than optional.

## 8. Monitoring for parser and sanitizer CVEs

An app that ships weekly and reads untrusted files daily has a *responsibility*
to patch, not just an option.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: daily }
    open-pull-requests-limit: 10
    groups:
      dompurify: { patterns: ["dompurify"] }
      parser:    { patterns: ["marked", "markdown-it", "micromark", "remark-*"] }
  - package-ecosystem: cargo
    directory: /src-tauri
    schedule: { interval: daily }
    groups:
      tauri: { patterns: ["tauri", "tauri-*"] }

  # The webview engine we do not control.
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

Additional channels, because Dependabot is not sufficient on its own:

- **GitHub Security Advisories** for the repo, enabled in settings.
- **`cargo audit`** and **`npm audit --audit-level=high`** in CI, failing the build
  on high or critical.
- **`osv-scanner`** across both ecosystems, because it reads OSV data directly and
  catches advisories for crates and npm packages that NVD has not enriched yet.
- **Weekly manual review** of the sanitizer's and parser's GitHub releases pages.
- **`rustsec`** advisory DB via `cargo deny check advisories`.
- A **security.md** in the repo stating the triage SLA: 24 h for XSS-class
  advisories in the sanitizer or parser, 72 h to ship.

```bash
# CI, on every build:
npm audit --audit-level=high || exit 1
cargo audit || exit 1
osv-scanner --lockfile=package-lock.json --lockfile=src-tauri/Cargo.lock || exit 1
```text

The SLA is the part that matters. An advisory without a commitment to a response
time is a wish.

## 9. Reproducible builds

Reproducibility lets a third party verify that a released binary was built from
the published source with the published dependencies — which is the strongest
available answer to "was this build compromised?".

**What we can realistically achieve:**

| Determinism source | Tauri | Electron |
|-------------------|-------|----------|
| Pinned toolchain versions (`rust-toolchain.toml`, `.nvmrc`) | yes | yes |
| Lockfiles | yes | yes |
| Vendored crates (`cargo vendor`) and npm deps | yes | yes |
| Pinned target triple and no host-specific codegen | achievable | harder (Chromium prebuilts) |
| `SOURCE_DATE_EPOCH` for timestamps | yes | partial |
| Byte-identical output across machines | plausible | unlikely (Chromium binaries, signing) |

```toml
# rust-toolchain.toml — exact versions, not "stable"
[toolchain]
channel = "1.90.0"
components = ["rustfmt", "clippy", "llvm-tools-preview"]
```text

Because full byte-reproducibility for an Electron app is unlikely, the Electron
path substitutes **verifiability**: publish the SBOM, publish checksums, and
allow reproducible *source* builds even if the artifact is not byte-identical.
That is an honest position rather than a claimed capability we do not have.

## 10. SBOM

Generate one per release, in a standard format, and publish it.

```yaml
- name: Generate SBOM
  run: |
    npx @cyclonedx/cyclonedx-npm --omit dev --output-format json --output sbom.json
    cargo install cargo-cyclonedx
    cargo cyclonedx --manifest-path src-tauri/Cargo.toml --output-format json \
                    --all-features > sbom-cargo.json
    npx @cyclonedx/cyclonedx-npm -- --json-file sbom.json --json-file sbom-cargo.json \
                                 --output-file sbom.cyclonedx.json
    npx @cyclonedx/cyclonedx-validate --input-file sbom.cyclonedx.json
- uses: actions/upload-artifact@v4
  with: { name: sbom, path: sbom.cyclonedx.json }
```text

Attach `sbom.cyclonedx.json` to the GitHub release and include its SHA-256 in the
signed release manifest. Then, when the next CVE lands, this is a one-line query
instead of a day of archaeology:

```bash
# "Which of our released versions contained the affected component?"
jq -r '.components[] | select(.name=="dompurify") | .version' sbom.cyclonedx.json
```

Without an SBOM, answering that question requires a git bisect over a year of
lockfiles.

## 11. CI secret management

| Rule | Why |
|------|-----|
| Never put a secret in the repository, including in history | it is compromised the moment it is pushed |
| GitHub **Actions secrets** for CI; **OIDC** to cloud where available | short-lived credentials, no long-lived keys |
| **Environment protection rules** on `release` | required reviewers, wait timer, branch restriction |
| **Protect the default branch**; require reviews; dismiss stale approvals on new commits | the release pipeline must not run unreviewed code |
| **Pinned actions by SHA**, not by tag | a moved tag is a compromised action |
| `::add-mask::` immediately on secret read | prevents log leakage |
| Separate signing and test secrets | a test-runner's key should not be able to sign |
| Rotate on any contributor departure | standard, and always forgotten |

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2, pinned by SHA
- uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0, pinned by SHA
```text

Tag-pinned actions are a supply-chain dependency like any other, and a
compromised action runs with the repository's secrets.

```yaml
name: release
on:
  workflow_dispatch:
    inputs:
      confirm: { type: string, required: true }
jobs:
  sign:
    runs-on: ubuntu-latest
    environment: release          # ← protected: reviewers + wait timer
    permissions:
      contents: write             # ← least privilege; no id-token, no packages
      id-token: none
    steps:
      - run: [ build, sign ]      # secret only read inside this environment
```text

## 12. Build-time vs runtime dependency split

Different threat models, different controls.

| | Build-time | Runtime |
|---|-----------|---------|
| **Runs** | on CI, or on a developer machine | in the user's process |
| **Exposure** | secrets, signing keys, the artifact | document content |
| **Attack** | backdoor in the build → backdoor in every install | input parsing → RCE or DoS |
| **Count** | large (webpack, vite, esbuild, tauri-cli, cargo build deps) | small (parser, sanitizer, highlighter) |
| **Control** | lockfile + pinned actions + protected environment + SBOM + review | allowlist + capability config + payload tests |
| **Policy** | allowed to be many; must never see user data | **must be small**; the TCB |

The practical consequence for Tauri: **`Cargo.toml` `[dependencies]` is the TCB
and must be small.** The Tauri CLI itself is a *dev-dependency* and can pull in a
hundred crates; those run at build time only. Keeping the runtime graph small is
what makes the Tauri argument in
[02-webview-sandboxing.md §3.6](./02-webview-sandboxing.md#36-tauri-versus-electron-for-this-project)
true rather than aspirational.

```bash
# CI gate on runtime dependency count, because growth is the risk.
cargo tree --manifest-path src-tauri/Cargo.toml --edges normal \
  | wc -l | awk '$1 > 120 { print "runtime crate count grew to " $1; exit 1 }'
```text

Electron's equivalent problem is that a large `dependencies` block means a large
Node main-process surface, which is exactly the code an XSS reaches if
`nodeIntegration` is ever misconfigured. Same answer: keep it small, and rely on
the preload surface as the real boundary.

## 13. Verification

| # | Check | Assert |
|---|-----|--------|
| 1 | `npm ci` in CI | lockfile unchanged afterwards |
| 2 | `cargo build --locked` | succeeds; lockfile unchanged |
| 3 | `assert-pinned-deps.ts` | critical packages at their pinned versions |
| 4 | A simulated new major of `dompurify` | CI fails until the baseline is deliberately updated |
| 5 | `npm audit --audit-level=high` | clean |
| 6 | `cargo audit`, `osv-scanner` | clean |
| 7 | Every dependency with an install script | enumerated, reviewed, recorded |
| 8 | No action referenced by tag | `grep -n 'uses: .*@[v0-9]' .github/workflows/` returns nothing |
| 9 | Sanitizer allow-list diff between versions | reviewed and recorded in the PR |
| 10 | Fixture snapshot diff | empty for a sanitizer/parser patch; reviewed for anything else |
| 11 | Fuzz job | no invariant violation over N hours |
| 12 | `sanitize(sanitize(x)) == sanitize(x)` | holds over the fuzz corpus, in a real browser |
| 13 | Payload corpus, in a real browser | all 30 cases inert |
| 14 | SBOM generation | valid per `cyclonedx-validate` |
| 15 | SBOM attached to the release | present, and its hash in the signed manifest |
| 16 | Release artifacts signed | `signtool verify` (Windows) / `codesign --verify` (macOS) pass on the built artifact |
| 17 | Tauri updater signature verification | tampered artifact is rejected by a test harness |
| 18 | `autoDownload = false` (Electron) | update requires a user action |
| 19 | Signing key never in a log | grep CI logs for the masked value across a test release |
| 20 | Runtime crate count | below the threshold |
| 21 | Protected `release` environment | configured with reviewers; a test run cannot sign |
| 22 | Reproducible build attempt | documented honestly as achieved or not |

Check 19 deserves a note: the way to test a masking rule is to *deliberately*
attempt a signing run with a canary value and grep the logs. Secret-hygiene
checks that have never been executed are not checks.

## Sources

- Tauri updater, "Signing updates" ("This cannot be disabled") —
  <https://v2.tauri.app/plugin/updater/>
- Tauri capabilities — <https://v2.tauri.app/security/capabilities/>
- Electron autoUpdater and code signing —
  <https://www.electronjs.org/docs/latest/tutorial/updates>
- Electron security checklist, "Keep your application up-to-date" and "Evaluate
  your dependencies" — <https://www.electronjs.org/docs/latest/tutorial/security>
- DOMPurify README, including the server-side DOM warning —
  <https://github.com/cure53/DOMPurify>
- DOMPurify Security Goals & Threat Model —
  <https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model>
- DOMPurify Attack Classes & Bypass History —
  <https://github.com/cure53/DOMPurify/wiki/Attack-Classes-%26-Bypass-History>
- DOMPurify default allow-list wiki, including "the authoritative lists live in
  source" — <https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist>
- GitHub Dependabot configuration reference —
  <https://docs.github.com/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file>
- Renovate configuration — <https://docs.renovatebot.com/configuration-options/>
- OWASP Software Component Verification Standard (SCVS) —
  <https://owasp.org/www-project-software-component-verification-standard/>
- OWASP CycloneDX / SBOM guidance —
  <https://owasp.org/www-project-cyclonedx/>
- CycloneDX specification — <https://cyclonedx.org/>
- SLSA supply-chain levels — <https://slsa.dev/spec/v1.0/levels>
- NIST SP 800-218, Secure Software Development Practices —
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
- OpenSSF Scorecard — <https://scorecard.dev/>
- CWE-1104 Use of Unmaintained Third Party Components —
  <https://cwe.mitre.org/data/definitions/1104.html>
- CWE-1395 Dependency on Vulnerable Third-Party Component —
  <https://cwe.mitre.org/data/definitions/1395.html>
- `cargo-audit` — <https://github.com/rustsec/advisory-db>
- `osv-scanner` — <https://google.github.io/osv-scanner/>
