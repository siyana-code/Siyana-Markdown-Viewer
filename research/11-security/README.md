# 11 — Security

> A Markdown viewer opens arbitrary files from arbitrary places and renders them
> inside a process that can read the user's disk. Treat every `.md` file as
> hostile input, and every renderer compromise as a full compromise.

This folder is a first-class deliverable for this project, not an appendix. Every
decision in [05-rendering](../05-rendering/) is downstream of the threat model in
[01-threat-model.md](./01-threat-model.md).

## Documents

| Doc | Contents |
|-----|----------|
| [01-threat-model.md](./01-threat-model.md) | Assets, adversaries, 14 attack vectors with payloads and mitigations, residual risk, risk matrix |
| [02-webview-sandboxing.md](./02-webview-sandboxing.md) | Electron / Tauri / Flutter compared; recommended configurations; what a renderer compromise means in each |
| [03-filesystem-safety.md](./03-filesystem-safety.md) | Path traversal incl. NTFS-specific attacks, symlinks, TOCTOU, encoding detection, huge files, atomic writes |
| [04-dependency-and-supply-chain.md](./04-dependency-and-supply-chain.md) | Lockfiles, integrity, updater signing, SBOM, reproducible builds, monitoring parser CVEs |
| [05-security-baseline-recommendations.md](./05-security-baseline-recommendations.md) | ~60 numbered MUST-DOs by layer, each with rationale, verification, and CI check |

## Trust boundaries at a glance

```mermaid
flowchart TB
    subgraph UNTRUSTED["⛔ UNTRUSTED — attacker-controlled bytes"]
        MD["*.md file<br/>downloaded, emailed, cloned,<br/>opened from a USB stick"]
        REMOTE["remote image host<br/>chosen by the document author"]
        CLIP["clipboard / drag-drop HTML"]
    end

    subgraph NATIVE["🛡️ NATIVE — our code, the only trusted side"]
        FS["filesystem adapter<br/>realpath + containment +<br/>extension allowlist + size cap"]
        DEC["decoder<br/>BOM sniff, UTF-8/16/LE,<br/>CRLF normalize, cap"]
        PARSE["parser<br/>CommonMark + GFM,<br/>time-bounded"]
        SAN["SANITIZER<br/>tag + attribute +<br/>URL-scheme allowlist"]
        IPC["IPC surface<br/>invoke commands,<br/>capability-gated"]
    end

    subgraph WEBVIEW["⚠️ WEBVIEW — highest-risk component"]
        DOM["styled DOM<br/>sanitized HTML only"]
        HL["syntax highlighter<br/>text-only, class output"]
    end

    subgraph OS["🖥️ OS / USER"]
        SHELL["system shell / browser<br/>openExternal, 4 schemes only"]
        NET["network stack"]
        CREDS["user credentials,<br/>SSH keys, browser data,<br/>password manager"]
    end

    MD --> FS
    FS --> DEC
    DEC --> PARSE
    PARSE --> SAN
    SAN --> DOM
    CLIP --> SAN

    DOM -. "IPC: read file,<br/>open dialog,<br/>openExternal" .-> IPC
    IPC --> FS
    IPC --> SHELL

    REMOTE -. "blocked by default" .-> NET
    SHELL --> NET
    IPC --> OS
    OS --> CREDS

    style SAN fill:#1f6feb33,stroke:#1f6feb,stroke-width:2px
    style WEBVIEW fill:#9a341233,stroke:#dc2626,stroke-width:2px
    style UNTRUSTED fill:#7f1d1d22,stroke:#b91c1c
```text

### The five boundaries, and which of them actually hold

| # | Boundary | Held by | Fails if |
|---|----------|---------|----------|
| 1 | bytes → filesystem adapter | `realpath` + containment + extension allowlist + size cap | path canonicalization is skipped, or the extension check is trusted to do containment's job |
| 2 | text → AST | the parser | ReDoS, unbounded memory, or a parser that enables raw HTML *and* skips the sanitizer |
| 3 | AST → HTML | **the sanitizer** | raw HTML reaches the DOM unfiltered; or the sanitizer is widened for convenience |
| 4 | renderer → native | shell config: contextIsolation, `sandbox: true`, `nodeIntegration: false`, Tauri capabilities + scopes | any one of those defaults is flipped |
| 5 | app → outside world | `openExternal` allowlist (4 schemes), remote-image blocking, `connect-src` CSP | `shell.openExternal` receives a non-allowlisted URL |

**Boundary 3 is where this project is won or lost.** Every real-world compromise
of a desktop Markdown tool has gone through it: [CVE-2019-20374](https://nvd.nist.gov/vuln/detail/CVE-2019-20374)
(Typora, mXSS in Mermaid → RCE in unsandboxed Electron),
[CVE-2022-21158](https://nvd.nist.gov/vuln/detail/CVE-2022-21158) (MarkText,
`javascript:` link in a document),
[CVE-2023-2318](https://nvd.nist.gov/vuln/detail/CVE-2023-2318) (MarkText, paste
path, `innerHTML` without sanitization → `child_process.exec`).

## The one-paragraph version

A Markdown viewer is a browser. A browser that can run JavaScript inside a
desktop app's renderer is, by construction, an XSS-to-RCE primitive — that is
the entire lesson of CVE-2019-20374 and CVE-2022-21158, and it is why Electron
says its checklist does not cover "displaying arbitrary content from untrusted
sources": *"In fact, the most popular Electron apps … display primarily local
content (or trusted, secure remote content without Node integration)."* We display
arbitrary content. So we must (a) sanitize as a rendering stage with an allowlist,
never a blocklist; (b) configure the shell so that a renderer compromise is a
*UI* compromise rather than a *code execution* compromise — contextIsolation on,
sandbox on, nodeIntegration off, minimal preload bridge, capabilities minimal;
(c) keep the IPC surface small enough to audit line by line; (d) never hand a
document-controlled string to the OS shell; and (e) treat every `.md` file, every
clipboard payload, and every drag-and-drop as hostile.

## Reporting a vulnerability

This project should ship a `SECURITY.md` with a private disclosure route and an
explicit statement that we will not pursue legal action against good-faith
research that does not exfiltrate data, modify user files, or degrade the
service for other users. Given the CVE history of every comparable product,
someone *will* find something; the only question is whether they tell us first.

## Reading order

Security engineering here, in order:

1. This file.
2. [01-threat-model.md](./01-threat-model.md) — what we are defending.
3. [05-security-baseline-recommendations.md](./05-security-baseline-recommendations.md) — the
   concrete, checkable list. This is the one to implement against and to use as
   PR review criteria.
4. [02-webview-sandboxing.md](./02-webview-sandboxing.md) — the shell config.
5. [03-filesystem-safety.md](./03-filesystem-safety.md) — the filesystem adapter.
6. [04-dependency-and-supply-chain.md](./04-dependency-and-supply-chain.md) — the
   long tail.
7. [05-rendering/02-sanitization.md](../05-rendering/02-sanitization.md) — the
   renderer-side implementation of boundary 3.

## Sources

- OWASP Cross Site Scripting Prevention Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- OWASP Application Security Verification Standard 5.0.0 —
  <https://asvs.dev/>
- OWASP Desktop Application Security Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Desktop_App_Security_Cheat_Sheet.html>
- Electron security checklist —
  <https://www.electronjs.org/docs/latest/tutorial/security>
- Tauri IPC — <https://v2.tauri.app/concept/inter-process-communication/>
- Tauri capabilities — <https://v2.tauri.app/security/capabilities/>
- Tauri command scopes — <https://v2.tauri.app/security/scope/>
- Tauri asset protocol scope — <https://v2.tauri.app/security/asset-protocol/>
- Tauri CSP — <https://v2.tauri.app/security/csp/>
- DOMPurify Security Goals & Threat Model —
  <https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model>
- CVE-2019-20374 (Typora, mXSS → RCE) —
  <https://nvd.nist.gov/vuln/detail/CVE-2019-20374>
- CVE-2022-21158 (MarkText, stored XSS via `javascript:`) —
  <https://nvd.nist.gov/vuln/detail/CVE-2022-21158>
- CVE-2023-2318 (MarkText, DOM XSS on paste → RCE) —
  <https://nvd.nist.gov/vuln/detail/CVE-2023-2318>
- CVE-2023-2317 (Typora, DOM XSS via crafted file) —
  <https://www.cve.org/CVERecord?id=CVE-2023-2317>
