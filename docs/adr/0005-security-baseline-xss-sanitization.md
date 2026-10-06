# ADR-0005: Security baseline — sanitization and XSS defence

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Siyana Markdown Viewer maintainers
- **Consulted:**
  - [`research/11-security/01-threat-model.md`](../../research/11-security/01-threat-model.md)
  - [`research/11-security/02-webview-sandboxing.md`](../../research/11-security/02-webview-sandboxing.md)
  - [`research/11-security/05-security-baseline-recommendations.md`](../../research/11-security/05-security-baseline-recommendations.md)
  - [`research/05-rendering/02-sanitization.md`](../../research/05-rendering/02-sanitization.md)

## Context

This application's input is **entirely attacker-controlled**. A user opens a
`.md` file that came from an email, a cloned repository, a download, or a
collaborator. The desktop shell embeds a browser engine with filesystem access.

The escalation path is short and well-trodden:

```
Markdown file
  → parser (raw HTML passthrough)
    → sanitizer (if present, or missing)
      → DOM insertion
        → script execution in the renderer
          → IPC bridge
            → filesystem read/write, process launch, network egress
```

This is not hypothetical. Electron and Markdown viewers have a long history of
exactly this class of bug. Our security posture is therefore not an
afterthought — it is the constraint that limits every other decision, including
the shell choice ([ADR-0003](0003-desktop-framework-tauri-vs-electron-vs-flutter.md))
and the parser choice ([ADR-0004](0004-markdown-parser-strategy.md)).

## Decision

We adopt a **defence-in-depth** model with four independent layers. A failure
of any single layer must not be exploitable.

### Layer 1 — Parser: minimal HTML generation

The parser is configured to produce as little raw HTML as possible.

- **Raw HTML in Markdown is disabled at the parser.** Not "sanitized later" —
  disabled. Where the syntax allows raw HTML, we emit escaped text instead.
- Generated HTML is built from a fixed vocabulary of tags and attributes that we
  control. Attribute values are always escaped by the parser.
- `javascript:` and `data:` URLs are rejected **during parsing**, so they never
  reach the sanitizer as live URLs.

Rationale: sanitization is a filter, and filters are harder to prove correct
than an allowlist applied at the source. The parser is the only place that
decides what HTML exists, so it is the right place to decide most of it.

### Layer 2 — Sanitizer: mandatory allowlist

Every HTML string passes through `DOMPurify` (or `ammonia` on the Rust side)
before it reaches the DOM. This layer exists even though Layer 1 is strict,
because it is the layer that protects us when Layer 1 is bypassed by a parser
bug.

- **Tag allowlist.** Block lists do not work; allow lists do.
- **Attribute allowlist.** Including `rel` and `target` handling on links.
- **URL scheme allowlist:** `http`, `https`, `mailto`, `tel`, and relative or
  fragment URLs. Everything else is dropped. This check is applied **after**
  HTML-entity decoding and after URL normalisation, so `java&#115;cript:` and
  `javascript&colon;` are caught.
- **`<svg>`, `<math>`, `<foreignObject>`, `<style>`, `<script>`, `<iframe>`,
  `<object>`, `<embed>`, `<form>` and every `on*` handler** are removed. These
  are the classic bypass vectors.
- **`<svg>`, `<math>`, `<foreignObject>`, `<style>`, `<script>`, `<iframe>`,
  `<object>`, `<embed>`, `<form>` and every `on*` handler** are removed. These
  are the classic bypass vectors.
- **`data:` URLs** are permitted only for images, only for a safe MIME allowlist,
  and only below a size cap.

### Sanitizer version floor

`DOMPurify` **MUST** be at least **3.4.0**. The default configuration was
bypassable in 3.0.1 through 3.3.3 via prototype pollution
([CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238)). Three
other 2026 advisories are relevant to how we use it:

- [CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914) (mXSS via
  re-contextualization) — sanitized output that is inserted into a *second,
  different* parsing context (`<xmp>`, `<script>`, `<noscript>`, …) can be
  mutated back into executable markup. Our single insertion point, into a
  detached `<div>`, avoids this. The constraint is now explicit: **sanitized
  HTML is never re-contextualized.**
- [CVE-2026-47423](https://nvd.nist.gov/vuln/detail/CVE-2026-47423) —
  `<selectedcontent>` causes the browser to re-clone content *after* the
  sanitizer has walked it. `<selectedcontent>` is not on our allowlist.
- [CVE-2026-0540](https://nvd.nist.gov/vuln/detail/CVE-2026-0540) — an earlier
  bypass in the same period.

The lesson these carry together: **a sanitizer is a filter, and filters are
defeated by using their output somewhere other than where they expect it.** That
is why Layer 1 exists. See
[`research/11-security/04-dependency-and-supply-chain.md`](../../research/11-security/04-dependency-and-supply-chain.md).

### Layer 3 — Renderer: no ambient capability

- **Content Security Policy** is set at the shell level, not by the document. A
  document cannot relax it.
- **`innerHTML` is banned for document content.** Rendering goes through the
  sanitized string into a detached element that is then inserted, or through
  DOM construction APIs. A lint rule enforces this.
- **The renderer process has no Node access.** `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true`. The preload bridge exposes a small
  set of named, validated functions — not a general IPC channel.
- **Every Tauri capability is reviewed as a security change**, added in its own
  PR, with an explicit scope.

### Layer 4 — Native: path scoping and input validation

- File reads are **scoped to an approved root**. Paths are resolved and
  normalised, symlinks are resolved, and anything that escapes the root after
  resolution is refused.
- **Remote images are blocked by default.** A document that references
  `https://tracker.example/pixel` must not leak the fact that the user opened
  it. Opt-in per document, not opt-out.
- Filenames and paths from documents are validated against Windows and Linux
  path rules before use.
- **No document content is ever passed to a subprocess**, a shell, or a URL
  handler without validation.

### Failure behaviour

**A parse or sanitize failure must never produce an empty window.** The failure
path is: log, show the raw source as preformatted text, and offer the user a way
to report it. Degrading to plain text is always available and always safe.

## Alternatives considered

**Sanitize only, at the sanitizer layer.** Simpler — one filter, one place to
audit. Rejected because it makes the sanitizer the single point of failure, and
sanitizer bypasses are a recurring category of CVE. Two independent layers mean a
parser bug is not automatically an XSS.

**Disable raw HTML in the parser only, no sanitizer.** Also simple. Rejected
because it relies entirely on our parser configuration being correct across
plugin upgrades. A plugin that re-enables HTML would silently reintroduce the
problem. The sanitizer is the belt to the parser's braces.

**Blocklist sanitization.** Rejected outright. Blocklists are enumerated
incomplete; new parser features produce new sinks.

**Escape everything and render as plain text.** Safe, useless. Rejected.

**Sandbox the renderer harder — separate process, restricted OS sandbox.**
Worthwhile and complementary, and Tauri gives us some of it. Rejected as the
*primary* defence because OS-level sandboxing varies enormously between
Windows and Linux and cannot be relied on uniformly. We use it as an additional
layer.

**Trust the user.** Rejected. The whole point of the threat model is that the
file did not come from the user. "It's just a Markdown file" is the assumption
that makes this app dangerous.

## Consequences

### Good

- The dangerous input is constrained at every stage, and no single bug is
  sufficient for exploitation.
- Every layer is testable independently, and the fuzzing harness can target the
  pipeline as a whole.
- The security posture is reviewable by a human reading four rules rather than
  auditing an unfamiliar library.
- Raw HTML in Markdown being disabled is a **product decision with a security
  justification**, which resolves a long-running ambiguity in the community.

### Bad / accepted costs

- **Some documents will render differently than on GitHub.** A document using
  raw HTML will show it as text. We will document this clearly and provide a
  per-document opt-in for users who need it, off by default.
- **The parser layer and the sanitizer layer can disagree** about what is valid,
  producing output that looks odd. We will test the composed pipeline, not each
  layer in isolation.
- **Performance cost.** Sanitization is not free. We will measure it, and it is
  on the hot path for every render. If it is significant, we will batch and
  debounce, not skip it.
- **Maintenance cost of keeping the invariant.** The ban on `innerHTML` needs a
  lint rule or it will be violated by accident within a month.
- **Remote image blocking will surprise people** who are used to documents
  loading images from a CDN. The opt-in path must be obvious.

### Follow-up work

- [ ] Implement the four layers, with the exact configurations recorded in
      `research/11-security/05-security-baseline-recommendations.md`.
- [ ] Write a **fuzzing harness**: generate and mutate Markdown, run it through
      parser + sanitizer, assert that no executable construct survives. Run it in
      CI on a schedule, not only on demand.
- [ ] Add the lint rules that enforce the renderer and filesystem invariants.
- [ ] Add a CI check that no Tauri capability is added without review.
- [ ] Build the remote-image opt-in with a clear, per-document UI.
- [ ] Have an external security review before `1.0.0`.
- [ ] Publish a security model page for users.

## Validation

This ADR is a commitment, not a preference. It is violated if:

- Any rendered HTML string can reach the DOM without passing the sanitizer.
- Any document-referenced path can read outside the approved root.
- The renderer can reach Node, an unrestricted IPC channel, or the filesystem
  directly.
- A document can cause a network request without explicit user consent.
- Fuzzing finds an escaping construct that survives the pipeline.

Any of those is a release blocker, not a bug for the next patch.
