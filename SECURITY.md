# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for a security bug.**

Report privately via GitHub's security advisory form:

> <https://github.com/siyana-code/Siyana-Markdown-Viewer/security/advisories/new>

or by email to the maintainers. If you do not have a private channel you trust,
open an issue titled `security contact request` with no technical detail and we
will arrange one.

Please include:

- The vulnerability and its impact
- Steps to reproduce, ideally with a Markdown payload
- Your OS, app version, and install method
- Whether you have tested whether it reaches file access, code execution, or is
  limited to content spoofing

## What to expect

| Stage | Target |
|---|---|
| Acknowledgement | 48 hours |
| Initial assessment | 7 days |
| Fix released | 30 days from report, or sooner if actively exploited |

We will tell you when we have assessed the report, and we will credit you in
the release notes unless you ask us not to.

We will not pursue legal action over good-faith research, and we will not
pursue anyone who gives us a reasonable window to fix a reported issue before
disclosing.

## Why this matters here

This application **renders files the user did not author.** A `.md` file from an
untrusted source is attacker-controlled input. Because the desktop shell embeds
a browser engine with access to the filesystem, an HTML-injection bug in our
rendering path can escalate from "wrong text on screen" to "arbitrary code
execution with the user's privileges."

That makes our threat model unusually specific. See:

- [`research/11-security/01-threat-model.md`](research/11-security/01-threat-model.md)
- [`research/11-security/05-security-baseline-recommendations.md`](research/11-security/05-security-baseline-recommendations.md)
- [`docs/adr/0005-security-baseline-xss-sanitization.md`](docs/adr/0005-security-baseline-xss-sanitization.md)

The categories we take most seriously, in order:

1. **XSS reaching native capability.** Any script execution in the renderer that
   can reach the filesystem, shell, or IPC bridge.
2. **Path traversal and arbitrary file read** via image references, link
   targets, or front matter.
3. **Code execution via the shell.** Passing untrusted content into a URL
   handler, a protocol handler, or a subprocess.
4. **Content spoofing.** Making Markdown display something it is not — a
   fake link to a real domain, misleading instructions rendered as trusted UI.
   Lower severity, but we care.
5. **Denial of service.** Input that makes the app hang, exhaust memory, or
   burn CPU (ReDoS, pathological nesting, decompression bombs).

## Security-relevant invariants

These are the rules the codebase must not break. Any change that would break one
needs an ADR and a second reviewer.

1. **Untrusted Markdown never reaches `innerHTML` unsanitized.** Sanitization
   is a mandatory pipeline stage, not an optional one.
2. **URL schemes are allowlisted.** Only `http`, `https`, `mailto`, `tel`, and
   relative/fragment URLs. `javascript:`, `data:`, `vbscript:`, `file:` are
   rejected — including after HTML-entity decoding and URL normalisation.
3. **Renderer has no ambient Node access.** `nodeIntegration: false`,
   `contextIsolation: true`, `sandbox: true`, and a minimal, validated preload
   bridge. Any Tauri capability added is reviewed as a security change.
4. **File reads are scoped.** The renderer asks for a specific document; the
   native side resolves and validates the path against the approved root and
   refuses anything that escapes it after symlink resolution.
5. **Encodings are detected, not assumed.** We do not silently treat every file
   as UTF-8; malformed bytes are handled rather than propagated.
6. **Parser limits are enforced.** Nesting depth, input size, link nesting, and
   table dimensions are bounded, and exceeding them degrades rather than hangs.
7. **A parse error never becomes an empty screen.** Failure falls back to safe
   raw-text rendering.
8. **Updates are signature-verified**, not merely checksum-verified.
9. **Dependencies are locked and audited.** `Cargo.lock` and `pnpm-lock.yaml` are
   committed. Parser and sanitizer upgrades get an explicit security review, and
   both carry a minimum version floor (see
   [`docs/adr/0004-markdown-parser-strategy.md`](docs/adr/0004-markdown-parser-strategy.md#minimum-versions-verified-2026-10-06)).
10. **No telemetry, no crash uploads, no analytics** without explicit,
    documented, opt-in user consent.
11. **Sanitized output is never re-contextualized.** Sanitized HTML goes into
    exactly one place — a detached `<div>` — and is never concatenated into a
    wrapper string or re-parsed in a different parsing context. This is the
   control for the mutation-XSS class
   ([CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914)).

## Dependency floors

Set from published advisories, verified 2026-10-06. Crossing a floor upward is a
security change.

| Dependency | Minimum | Advisory |
|---|---|---|
| `markdown-it` | 14.2.0 | [CVE-2026-48988](https://nvd.nist.gov/vuln/detail/CVE-2026-48988) |
| `DOMPurify` | 3.4.16 | [CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238) and the 2026 `IN_PLACE` cluster, incl. `GHSA-6688-9rhm-gjv2` (≤ 3.4.15) |

Full advisory catalogue for every dependency we consider:
[`research/11-security/04-dependency-and-supply-chain.md`](research/11-security/04-dependency-and-supply-chain.md).

## Out of scope

- Vulnerabilities in Chromium, WebKitGTK, or WebView2 themselves — report those
  upstream. We will track and update the runtime.
- Issues requiring a user to deliberately run attacker-supplied binaries.
- Social engineering and phishing content.
- Denial of service from genuinely enormous files where we degrade gracefully
  and tell the user, rather than crashing.
- Reports generated by scanners with no demonstrated impact.

## Security advisories in this repo

We will publish advisories in
`docs/security/advisories/` and reference them from `CHANGELOG.md`. Advisory
numbers follow `GHSA-xxxx-xxxx-xxxx` from GitHub.
