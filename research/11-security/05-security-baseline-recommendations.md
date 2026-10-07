# 05 — Security baseline recommendations

> A numbered, checkable list. Every item: what to do, why, how to verify, and a
> CI check where one is possible.

This document is meant to be **used**, not read once. It is the PR review
criteria for security-relevant changes, the release gate, and the onboarding
checklist. It is organized by layer, in the order the layers appear in the
pipeline, because that is the order in which a mistake becomes a vulnerability.

**Status legend.** Each item is one of:

- **MUST** — a release blocker. CI fails, the release does not ship.
- **SHOULD** — required before v1.0, tracked in the issue backlog.
- **NICE** — quality-of-implementation; no security impact if absent.

**How to use this in review.** Any diff touching `packages/core`, the shell
configuration, the filesystem adapter, the sanitizer, or the release workflow is
reviewed against the relevant sections. The review comment cites the item number,
which makes security review fast and makes the reasoning auditable later.

**Count:** 12 parser, 16 sanitizer, 11 renderer, 18 shell, 14 filesystem,
8 network, 17 dependencies, 15 CI/release. 111 items.

---

## Layer 1 — Parser (12 items)

The parser turns untrusted bytes into structure. Its failure modes are
availability and correctness; it does not itself decide what is safe to render.

### P1. MUST — Parse in a Web Worker with a hard timeout

**What.** Every parse runs off the main thread in a worker, with a wall-clock
budget (500 ms for interactive typing, 5 s for a file open). On timeout, kill
the worker, discard all partial output, and report the failure.

**Why.** ReDoS is a documented, repeated reality in this exact ecosystem:
[CVE-2022-21680](https://nvd.nist.gov/vuln/detail/CVE-2022-21680) and
[CVE-2022-21681](https://nvd.nist.gov/vuln/detail/CVE-2022-21681) in `marked`
both list the mitigation as "run marked on a worker thread and set a reasonable
time limit to prevent draining resources". A worker with a timeout *is* the
mitigation. A main-thread parse with no timeout is a frozen window.

**Verify.** A fixture with the published ReDoS PoC completes or times out within
the budget, and the UI stays responsive (a spinner animates) throughout.

**CI.** `npm run test:redos` — asserts each PoC shape finishes under budget in
the worker and that the main thread is not blocked (measured via
`performance.now()` deltas in the test page).

### P2. MUST — Enforce maximum AST node count and depth

**What.** The parser aborts when nodes exceed `maxNodes` (2 000 000) or depth
exceeds `maxDepth` (256), producing a diagnostic rather than a truncated
silently-broken document.

**Why.** Deep nesting is a DoS and an mXSS vector at once. Past the engine's
nesting limit — 512 in Blink and WebKit per [WebKit bug 63082](https://bugs.webkit.org/show_bug.cgi?id=63082),
adopted by Gecko for compatibility — descendants are flattened into siblings, so
"source nesting ≠ final DOM ancestry". A sanitizer that walks the DOM sees a
different tree than the author wrote.

**Verify.** 8192-deep nesting aborts at the cap with a clear message.

**CI.** Unit test with depth 256 (at the cap, must succeed) and 8192 (must
abort).

### P3. MUST — Cap input size before allocating

**What.** Refuse files above 256 MB; warn and use large-file mode between 8 MB and
256 MB; render normally below 8 MB.

**Why.** O1–O6 are undermined by a single document that exhausts memory. A
visible refusal is a much better outcome than an unresponsive window.

**Verify.** A 300 MB file produces the refusal dialog.

**CI.** Unit test on the size branches with sparse fixture files.

### P4. MUST — Never emit raw HTML outside the sanitizer's path

**What.** The renderer's output goes to exactly one function,
`sanitize()`, before any insertion. There is no `innerHTML` assignment, no
`dangerouslySetInnerHTML`, no `document.write`, and no second rendering path that
bypasses it.

**Why.** CommonMark *requires* raw HTML pass-through (spec §4.6), so the parser
cannot be the control. This is the exact vector behind
[CVE-2019-20374](https://nvd.nist.gov/vuln/detail/CVE-2019-20374) (Typora),
[CVE-2022-21158](https://nvd.nist.gov/vuln/detail/CVE-2022-21158) and
[CVE-2023-2318](https://nvd.nist.gov/vuln/detail/CVE-2023-2318) (MarkText).

**Verify.** Code search returns only sanitized sinks; the payload corpus passes.

**CI.** `rg -n '\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|dangerouslySetInnerHTML' packages apps`
— every hit must be annotated with the sanitizer that guards it, and a custom
lint rule fails the build on an unguarded sink.

### P5. MUST — Pass the CommonMark 0.31.2 and GFM spec suites

**What.** The renderer is validated against `spec_tests.py` (652 examples) and the
GFM spec, in CI.

**Why.** Two reasons. Correctness: users' files depend on it. Security: a
spec-conformant renderer is a renderer whose output we have *seen*, so an
anomalous change is detectable. Spec conformance is a cheap tripwire for
behavioural regressions in a security-relevant component.

**Verify.** Zero failures, no skips.

**CI.** `npm run test:spec` on every commit.

### P6. MUST — Disable `typographer` unless its cost profile is measured

**What.** `typographer: false` by default.

**Why.** [CVE-2026-48988](https://nvd.nist.gov/vuln/detail/CVE-2026-48988) is a
quadratic O(n²) blowup in `markdown-it`'s smartquotes rule, from `replaceAt()`
doing O(n) slicing per quote character. It affects quote-heavy documents. The
upstream advisory notes it "is disabled by default, [but] many production apps
enable it for smart typography, making the issue relevant" — which describes us.

**Verify.** A 200 000-quote fixture parses in under budget with the flag off.

**CI.** Benchmark test with the flag on and off; the numbers are recorded in the
PR that enables it.

### P7. MUST — Test for prototype pollution from document text

**What.** Fuzz with `__proto__`, `constructor`, `prototype`, `toString` in heading
text, link labels, reference definitions, and slug inputs. All slug and
occurrence maps use `Object.create(null)`.

**Why.** [CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238) was a
default-configuration DOMPurify bypass caused by an `|| {}` fallback inheriting
from `Object.prototype`. `github-slugger` uses `Object.create(null)` for exactly
this reason. A heading literally named `# __proto__` must not break anything.

**Verify.** No pollution after parsing any of those inputs.

**CI.** Fuzz target plus explicit unit tests for each string in each position.

### P8. SHOULD — Reject documents with more than 2 000 000 characters without a prompt

**What.** Warn and offer large-file mode.

**Why.** Pathological-but-not-attack input is still a DoS.

**Verify.** The warning appears; mode still works.

**CI.** Unit test.

### P9. SHOULD — Handle lone surrogates explicitly

**What.** Detect unpaired surrogates after decoding; strip them from slug input;
never emit an `id` containing one.

**Why.** A lone surrogate breaks `toLowerCase()`, the GitHub slugger regex
(which only matches valid surrogate pairs), and URL encoding in different ways,
producing a `#fragment` that does not resolve.

**Verify.** A fixture with a lone surrogate in a heading produces a valid,
resolvable `id`.

**CI.** Unit test with a hand-built fixture.

### P10. SHOULD — Prefer `RETURN_DOM_FRAGMENT` for the screen path

**What.** The screen path uses DOMPurify's fragment return, so the
serialize/reparse step never happens.

**Why.** mXSS is *defined* as the gap between the tree the sanitizer inspected
and the tree the sink built. Returning a fragment removes the gap rather than
mitigating it. See [CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914)
for what re-contextualization costs.

**Verify.** The screen path does not call `innerHTML` with a string at all.

**CI.** Assertion in the E2E suite.

### P11. SHOULD — Normalize newlines before parsing; preserve them for writing

**What.** CRLF and bare CR → LF for parsing; write back in the detected style.

**Why.** Bare-CR files are real (old-Mac, some tools, hand-crafted payloads) and a
parser that rejects them renders the file as one paragraph. Full-file line-ending
changes on save are an unrequested diff.

**Verify.** Bare-CR fixture parses correctly; saved bytes retain the original
style.

**CI.** Unit tests with CRLF, CR, LF, and mixed fixtures.

### P12. NICE — Publish parsing performance numbers per release

**What.** A tracked benchmark: parse time and memory for 1 MB, 10 MB, and a
pathological fixture.

**Why.** Performance regressions in a parser are availability regressions, and
they are much easier to notice in a tracked number than in a bug report.

**Verify.** Numbers in the release notes; significant regressions block the
release.

**CI.** Benchmark job with a comparison threshold.

---

## Layer 2 — Sanitizer (16 items)

This layer is the keystone. Every item here is non-negotiable.

### S1. MUST — Sanitize immediately before insertion

**What.** `sanitize()` is the last transformation before DOM insertion. Nothing
sits between it and the sink.

**Why.** DOMPurify's README: "if you *first* sanitize HTML and then modify it
afterwards, you might easily **void the effects of sanitization**." OWASP says
the same. The gap between sanitization and insertion is where every
re-contextualization bypass lives.

**Verify.** Code review; no post-sanitize string manipulation.

**CI.** Lint rule: `innerHTML = <expr>` where `<expr>` is not a direct
`sanitize()` call or a whitelisted variable.

### S2. MUST — Allowlist tags, never blocklist

**What.** The configuration uses `ALLOWED_TAGS` / `USE_PROFILES`, never
`blockedTags` / `blockedTagsRe`.

**Why.** Blocklists must enumerate danger, which is not a finite set. DOMPurify
added `<selectedcontent>` to its forbidden list in 3.4.5 because the browser
re-clones content *after* sanitization — a tag that was not a known threat a year
earlier. OWASP: use "a sanitizer with a good HTML sanitizing algorithm that uses
allowlists".

**Verify.** The config file contains no blocklist key.

**CI.** Grep the sanitizer config for `FORBID_TAGS` used *instead of* an
allowlist (we use `FORBID_TAGS` only as an additive narrowing on top of
`USE_PROFILES`, and that is asserted explicitly).

### S3. MUST — Restrict to the HTML profile: `USE_PROFILES: { html: true }`

**What.** No SVG, no MathML in rendered Markdown.

**Why.** Namespace confusion is where most mXSS lives. Bentkowski's
[DOMPurify 2.0.17 bypass](https://research.securitum.com/mutation-xss-via-mathml-mutation-dompurify-2-0-17-bypass/)
was exactly this: an element's owning namespace mutated across a
serialize/reparse. Integration points (`<svg><foreignObject>`,
`<math><annotation-xml encoding="text/html">`) deliberately re-enter HTML parsing.
Rendered Markdown has no legitimate need for either.

**Verify.** No `<svg>` or `<math>` in the DOM after rendering any fixture.

**CI.** Payload corpus cases 2, 4, 6, 7, 24.

### S4. MUST — Deny `style` elements and `style` attributes

**What.** `FORBID_TAGS: ['style']` and `FORBID_ATTR: ['style']`.

**Why.** DOMPurify is explicit: "DOMPurify is **not** a CSS sanitizer. Both the
`<style>` *element* and the `style` *attribute* are allowed by default." CSS-based
data exfiltration (attribute selectors + resource URLs) is an explicit non-goal.
It is also the only thing preventing a `position: fixed; inset: 0` clickjacking
overlay.

**Verify.** No `style` attribute and no `<style>` element in the DOM for any
fixture, including raw-HTML fixtures.

**CI.** Payload corpus cases 19, 20.

### S5. MUST — Deny all `on*` attributes, and enforce it with a hook

**What.** Denied by omission (not in the attribute allowlist), plus an
`uponSanitizeAttribute` hook that clears `keepAttr`/`forceKeepAttr` for any
`/^on/i` attribute.

**Why.** Belt and braces against a misconfiguration. Note the hook discipline:
`afterSanitize*` hooks run *after* validation and are not re-checked, so attacker
input must never be written there. `uponSanitize*` hooks run before validation,
so their output is re-checked.

**Verify.** No `[on*]` attribute in the DOM for any fixture.

**CI.** Payload corpus cases 1, 6–12.

### S6. MUST — URL scheme allowlist: `http`, `https`, `mailto`, `tel`, relative

**What.** Exactly those four schemes plus relative and fragment URLs. Everything
else is denied.

**Why.** `javascript:` is the canonical Markdown XSS.
[CVE-2022-21158](https://nvd.nist.gov/vuln/detail/CVE-2022-21158) (MarkText) was
a stored XSS via a `javascript:` link in a document, and its JPCERT/CC advisory
(JVN#89524240) rates impact as "an arbitrary script may be executed on the PC of
the user using the product".

**Verify.** Every scheme in the corpus is classified correctly.

**CI.** Payload corpus cases 11, 12, 13, 14.

### S7. MUST — `data:` only for `img[src]`, raster types only, size-capped, sniffed

**What.** `data:image/{png,jpeg,gif,webp,bmp}` (plus `x-icon`), base64 only,
≤ 8 MB decoded, with the sniffed MIME type required to match the declared one.
`image/svg+xml` is **banned**.

**Why.** Embedded images are a real Markdown feature, so a blanket ban is a
usability regression. But an SVG is a *document* with script capability, and its
safety in `<img>` is a property of the consumer's context, not of the bytes.
Matching `markdown-it`'s default (`gif/png/jpeg/webp` only) keeps us aligned with
the ecosystem. Sniffing prevents a polyglot from reaching the decoder on the
strength of a string the author wrote. `CVE-2018-5773` in `markdown2` is the
canonical "small syntactic variation defeats the filter" case.

**Verify.** Case 14 (`svg+xml`) has no `href`; case 29 (20 MB) is refused with a
placeholder and no OOM.

**CI.** Payload corpus cases 13, 14, 28, 29.

### S8. MUST — Classify URLs with `new URL()`, not a hand-written regex

**What.** Strip ASCII control characters and whitespace, then
`new URL(cleaned, base)` and check `parsed.protocol`. Do not customize
`ALLOWED_URI_REGEXP`.

**Why.** OWASP: "Do not try to sanitize the URL by escaping or encoding the
characters — attackers can bypass that." Every hand-rolled URL regex in history
has been bypassed. And DOMPurify's threat model warns that
`ALLOWED_URI_REGEXP` "runs against attacker-controlled values", so a
catastrophically-backtracking pattern becomes an attacker-triggerable ReDoS.

**Verify.** `jav&#x09;ascript:`, `java\nscript:`, and `java%0ascript:` are all
classified as blocked.

**CI.** Payload corpus cases 11, 12.

### S9. MUST — Deny protocol-relative URLs

**What.** `//host/path` is refused or normalized against our own scheme.

**Why.** In the app, `//evil.example/x.png` resolves to our custom scheme and
fails; in an **exported** HTML file it resolves to `https://evil.example/x.png` —
a fetch we did not intend, from a reader's browser. `sanitize-html`'s defaults set
`allowProtocolRelative: true`; we do not.

**Verify.** Case 30 has no `href`.

**CI.** Payload corpus case 30.

### S10. MUST — `SAFE_FOR_XML` and `SANITIZE_DOM` on, always

**What.** Never disabled, by configuration or by hook.

**Why.** `SAFE_FOR_XML` (default on) is the narrow attribute-value guard that
rejects comment/CDATA closers and rawtext/RCDATA closing tags inside attributes;
[CVE-2026-0540](https://nvd.nist.gov/vuln/detail/CVE-2026-0540) was caused by
five rawtext element names being missing from that regex. `SANITIZE_DOM` removes
DOM-clobbering constructs and removes any `<form>` that shadows a probed member.

**Verify.** Config assertion in the E2E suite.

**CI.** Assert the runtime config object equals the frozen baseline.

### S11. MUST — Deny `iframe`, `object`, `embed`, `base`, `meta`, `link`, `form`

**What.** All absent from the allowlist. `base` and `meta` are explicit
`FORBID_TAGS` entries because of their specific powers.

**Why.** `base` rewrites **every** relative URL in the document — DOMPurify
calls it a landmine. `meta http-equiv="refresh"` redirects, and `charset`
switching can change how later bytes decode, which is an mXSS lever.
`link rel=preload`/`prefetch` leaks and `rel=stylesheet` is CSS injection.

**Verify.** Cases 17, 18, 21 produce no such elements.

**CI.** Payload corpus cases 17, 18, 21.

### S12. MUST — Prefix every generated `id`, and deny `name`

**What.** Heading ids are `h-<slug>`; footnote ids are `fn-`/`fnref-`; `name` is
denied on every element.

**Why.** DOM clobbering. DOMPurify's threat model: "markup such as
`<img src=x name=getElementById>` … shadows properties/methods on `document`,
`window`, or form objects." PortSwigger's ["DOM Clobbering strikes
back"](https://portswigger.net/research/dom-clobbering-strikes-back) shows the
modern refinements. One `name` attribute and one unprefixed `id` is all an
attacker needs to influence app logic. `markdown-it`'s own docs say: "don't allow
plugins to generate arbitrary element `id` and `name` … always add prefixes to
avoid DOM clobbering."

**Verify.** Case 15 removed; no `name` in the DOM.

**CI.** Payload corpus case 15.

### S13. MUST — `data-*` denied on document content

**What.** `ALLOW_DATA_ATTR: false`. Any `data-*` we need is added *after*
sanitization, by us.

**Why.** DOMPurify: "DOMPurify can't know your app later reads `data-target` as a
URL or HTML — if it does, you've made a sink DOMPurify never validated."

**Verify.** No `data-*` from document content survives.

**CI.** Fixture assertion.

### S14. MUST — The sanitizer config is frozen, and widening it is a labelled security change

**What.** `Object.freeze` the config. Any `ADD_TAGS`, `ADD_ATTR`,
`ADD_URI_SAFE_ATTR`, `ALLOW_UNKNOWN_PROTOCOLS`, `CUSTOM_ELEMENT_HANDLING`, or
`SAFE_FOR_XML: false` requires a `security-review` label, a written
justification, and a new regression test.

**Why.** DOMPurify's threat model: "DOMPurify's secure **defaults are the
product**. Most application-specific bypasses are born the moment someone widens
the allow-list." Every historical bypass of a *configurable* sanitizer began as a
feature request.

**Verify.** PR label check.

**CI.** A workflow that fails a PR touching the sanitizer config without the
label.

### S15. MUST — Run the payload corpus in a real browser

**What.** The 30-case corpus
([05-rendering/02-sanitization.md §10](../05-rendering/02-sanitization.md#10-sanitizer-test-corpus-must-exist-before-v01-ships))
runs in Chromium via Playwright, asserting against the **live DOM after
insertion**, not the returned string.

**Why.** DOMPurify's guidance: string comparison is a weak test, because "an
assertion that the string does not contain 'onerror'" misses parser mutation and
encoding entirely. "Better test: insert and inspect the resulting DOM." Our
sanitizer runs in the same engine that will render the output, so the test must
too.

**Verify.** All 30 pass; each assertion is `!container.querySelector('[onerror]')`
style, not `!clean.includes(...)`.

**CI.** `npm run test:sanitize` — a blocker.

### S16. SHOULD — Fuzz the sanitizer, asserting idempotence

**What.** A `cargo-fuzz` target plus a browser-level differential fuzzer, both
asserting: `sanitize(sanitize(x)) === sanitize(x)`; the inserted DOM has no event
handler, no `<script>`, no `javascript:` URL, no unexpected namespace; and the
depth-8192 payload is inert.

**Why.** Idempotence is the sharpest available signal that parsing contexts agree.
A single pass that a second pass can undo means the two parses differ — the mXSS
class.

**Verify.** No invariant violation over a defined corpus/iteration count.

**CI.** Nightly fuzz job with a fixed seed corpus in the repo.

---

## Layer 3 — Renderer and DOM (11 items)

### R1. MUST — No `innerHTML` with unsanitized content

Covered by P4 as a hard rule; repeated here because this is where reviewers look
for it. Every sink is annotated with its guard.

### R2. MUST — Escape text and attributes with context-correct escapers

**What.** Text: `&`, `<`, `>`. Double-quoted attributes: `&`, `<`, `>`, `"`, `'`,
plus NUL → U+FFFD. Attribute values are always double-quoted; single quotes are
forbidden in output.

**Why.** OWASP's HTML attribute context guidance: "Use HTML attribute encoding …
and surround the value with `"` or `'`." Fixing the quote character removes the
"did we remember to escape the other one" bug class. Escaping `>` in attributes is
defense in depth against dangling-markup/PostXSS re-contextualization.

**Verify.** The renderer has unit tests per character per context.

**CI.** Unit tests; plus a CommonMark spec run, which exercises escaping broadly.

### R3. MUST — The renderer's emitted tag/attribute set is a subset of the allowlist

**What.** A single exported constant listing every tag and attribute the renderer
can emit; a test asserts it is a subset of the sanitizer's allowlist.

**Why.** The most likely route to our own compromise is not a sanitizer bug — it
is a rendering bug that gets "fixed" by widening the allowlist. If the renderer's
surface is machine-checked against the allowlist, that mistake is caught by CI
instead of shipped.

**Verify.** The subset test.

**CI.** `npm run test:renderer-surface`.

### R4. MUST — Never emit `style`, `on*`, `name`, or `srcdoc`

Covered by S4, S5, S12, S11. Restated as a renderer-side rule because the renderer
is where a future feature would be tempted to add them.

### R5. MUST — Insert exactly once; never post-process

**What.** Sanitize → insert. No regex replace on the sanitized string, no template
interpolation, no second library's HTML insertion, no rawtext wrapper.

**Why.** [CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914): mXSS
via re-contextualization into `<xmp>`, `<script>`, `<iframe>`, `<noembed>`,
`<noframes>`, `<noscript>`.

**Verify.** Code review; S1's lint rule.

**CI.** Lint rule.

### R6. MUST — Escape the slug even though the regex removed the dangerous characters

**What.** The heading slug is escaped like any attribute value before
interpolation.

**Why.** Defense in depth. "The regex removed it" is a claim about an upstream
dependency's behaviour that a dependency update could invalidate.

**Verify.** Unit test with a slug containing `"`, `<`, `&`.

**CI.** Unit test.

### R7. MUST — Empty slugs fall back to a positional id; never emit `id=""`

**What.** A heading that slugifies to empty gets `h-<blockIndex>`.

**Why.** `id=""` is invalid, and a slug starting with a digit is an invalid CSS
selector that throws. A throwing selector in a TOC click handler is a crash from a
document containing `# !!!`.

**Verify.** `# !!!`, `# ---`, `# …` produce valid resolvable ids.

**CI.** Unit test.

### R8. MUST — Slug occurrence maps use a null prototype

**What.** `Object.create(null)` for the dedupe counter; never `{}` or `|| {}`.

**Why.** [CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238) was
precisely an `|| {}` fallback inheriting from `Object.prototype`. A heading named
`# __proto__` or `# constructor` must not collide with an inherited member.

**Verify.** `# __proto__` produces `h-__proto__` and pollutes nothing.

**CI.** Unit test with `__proto__`, `constructor`, `toString`, `hasOwnProperty`.

### R9. MUST — Ids are a pure function of the document

**What.** Rendering the same bytes twice produces the same ids, regardless of
what was rendered before. A fresh slugger per document.

**Why.** Exported files and shared deep links depend on stable ids. A slugger
shared across documents makes ids depend on render order.

**Verify.** Render A, B, A again; the two As have identical ids.

**CI.** Unit test.

### R10. SHOULD — `dir` comes from our own fixed table, never `dir="auto"`

**What.** `dir="rtl"` is set on a code block only when the fence language is in a
fixed RTL set. `dir="auto"` is never emitted.

**Why.** `dir="auto"` derives directionality from content, which is
attacker-influenced — the basis of Trojan Source–style confusion attacks (see
[Unicode UAX #9](https://www.unicode.org/reports/tr9/)).

**Verify.** Fence languages `he`, `ar`, `fa` produce `dir="rtl"`; nothing produces
`dir="auto"`.

**CI.** Unit test.

### R11. SHOULD — Language tokens filtered to `[A-Za-z0-9_+#.-]`

**What.** Before interpolating a fence language into `class` or `lang`.

**Why.** Attribute injection. ```` ```" onload="alert(1) ```` must not produce an
event handler.

**Verify.** The fence test matrix in
[05-rendering/01-ast-to-html.md §6](../05-rendering/01-ast-to-html.md#6-verification).

**CI.** Unit test.

---

## Layer 4 — Shell (18 items)

### H1. MUST — `contextIsolation: true`

**What.** Every renderer. Default since Electron 12; set explicitly anyway.

**Why.** "Even when `nodeIntegration: false` is used, to truly enforce strong
isolation and prevent the use of Node primitives contextIsolation must also be
used." Electron's security checklist.

**Verify.** Probe payload returns `blocked` for `require`.

**CI.** E2E check 1 in
[02-webview-sandboxing.md §6](./02-webview-sandboxing.md#6-verification).

### H2. MUST — `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `nodeIntegrationInSubFrames: false`

**What.** All three, on every window.

**Why.** Checklist item 2. Note that setting `nodeIntegration: true` also disables
context isolation and process sandboxing.

**Verify.** Probe payload.

**CI.** E2E check 2.

### H3. MUST — `sandbox: true`, enforced globally

**What.** Per-window `sandbox: true` plus `app.enableSandbox()`.

**Why.** Checklist item 4, default since 20.0.0. "Loading, reading or processing
any untrusted content in an unsandboxed process, including the main process, is
not advised." And: "Disabling context isolation also disables process sandboxing,
regardless of the default."

**Verify.** Probe payload; `app.enableSandbox()` present.

**CI.** E2E check 3; static assertion on the config.

### H4. MUST — A minimal preload bridge with no generic escape hatch

**What.** Named functions only. No `invoke(command, args)`. Only primitives cross
the bridge. Each function validates its arguments.

**Why.** A generic bridge reintroduces the entire native surface with extra steps.
The bridge file must be auditable in one read.

**Verify.** `preload.js` is under ~100 lines and contains no generic invoker.

**CI.** Line-count and pattern check on `preload.js`.

### H5. MUST — Validate the IPC sender, not just its presence

**What.** Compare `event.senderFrame.url` against the exact expected bundle URL;
throw on mismatch.

**Why.** Without sender identity, any frame the document manages to create
inherits the bridge.

**Verify.** A payload creating an iframe and calling the bridge is rejected.

**CI.** E2E check 4.

### H6. MUST — Re-validate every IPC argument in the main process

**What.** The preload checks for ergonomics; the main-process handler re-validates
everything, including a fresh canonicalization of any path.

**Why.** The preload is not the trust boundary; the main process is. A future
refactor that adds a caller in the preload must not be able to skip validation.

**Verify.** Every `ipcMain.handle` calls its validator first.

**CI.** Code review; a check that no handler body lacks a validation call.

### H7. MUST — Deny navigation, new windows, and `<webview>`

**What.** `will-navigate` → `preventDefault()` unless our own bundle;
`will-redirect` → prevent; `will-frame-navigate` → prevent;
`setWindowOpenHandler` → `deny`; `will-attach-webview` → prevent.

**Why.** Checklist items 12, 13, and the `<webview>` items 11. A document that
can navigate our window navigates it to a phishing page with our chrome.

**Verify.** Navigation attempts from a document are prevented and logged.

**CI.** E2E checks 5, 6.

### H8. MUST — `shell.openExternal` gets only `http`, `https`, `mailto`, `tel`, and only from a user gesture

**What.** Strip control characters, parse with `new URL()`, check the scheme
against a four-element set, and require a genuine user gesture.

**Why.** Checklist item 14: "Do not use `shell.openExternal` with untrusted
content." On Windows, `openExternal` is `ShellExecute`, which will run an `.exe`,
follow a `.lnk`, or hit a UNC path.

**Verify.** A document calling `open()` does not cause a launch.

**CI.** E2E check 5; unit tests over the scheme table including `file:`,
`javascript:`, `ms-msdt:`, `smb:`.

### H9. MUST — Deny all permission requests and all device access

**What.** `setPermissionRequestHandler` → always `false`;
`setPermissionCheckHandler` → `false`; `setDevicePermissionHandler` → `false`.

**Why.** "By default, Electron will automatically approve all permission requests
unless the developer has manually configured a custom handler." A Markdown viewer
needs no camera, microphone, geolocation, notifications, USB, or HID.

**Verify.** `getUserMedia` is denied.

**CI.** E2E check 7.

### H10. MUST — A restrictive CSP with `script-src 'self'` and no `unsafe-inline`

**What.** Set via `onHeadersReceived` (Electron) or `tauri.conf.json` (Tauri).
`default-src 'none'` where possible. Never a CDN origin. Never
`script-src` with `unsafe-eval`.

**Why.** Tauri: "**Avoid loading remote content such as scripts served over a
CDN as they introduce an attack vector.** … You should make it as restricted as
possible, only allowing the webview to load assets from hosts you trust, and
preferably own."

**Verify.** `fetch('https://example.com')` from the renderer is blocked.

**CI.** E2E check 8; static check that the CSP has no `unsafe-inline` in
`script-src` and no `https:` in `script-src`.

### H11. MUST — Trusted Types with a DOMPurify-backed default policy

**What.** `require-trusted-types-for 'script'` in the CSP and
`trustedTypes.createPolicy('default', { createHTML: s => DOMPurify.sanitize(s, CONFIG) })`.

**Why.** OWASP: Trusted Types "is one of the few controls that eliminates entire
classes of DOM XSS rather than mitigating them." It converts a missed
sanitization call site from an XSS into a thrown exception. Note DOMPurify's
constraint: the policy needs `RETURN_TRUSTED_TYPE: false` because `createHTML`
expects a normal string.

**Verify.** `el.innerHTML = '<img src=x onerror=alert(1)>'` throws; no `onerror`
in the DOM.

**CI.** E2E check 9; a static check that any `innerHTML` assignment in app code
(not in tests) is wrapped by the policy.

### H12. MUST — `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-src 'none'`, `frame-ancestors 'none'`

**What.** All five directives present.

**Why.** Each blocks a specific escape. `base-uri 'none'` blocks the tag we deny at
the sanitizer layer from being reintroduced by a CSP gap; `object-src 'none'`
blocks plugin content; `frame-ancestors 'none'` prevents our window being framed
by a malicious parent.

**Verify.** Static assertion on the CSP string.

**CI.** CSP assertion test.

### H13. MUST — Custom protocols, never `file://`

**What.** `mdapp://` for the bundle, `mdimg://` for validated media, registered
privileged; the asset handler re-`realpath`s and re-checks containment on every
request, and takes an **opaque token**, not a path, from the renderer.

**Why.** Checklist item 17: "Avoid usage of the `file://` protocol and prefer
usage of custom protocols." An opaque token means the renderer cannot name an
arbitrary path at all; re-resolving on each request means a symlink swapped after
registration does not help.

**Verify.** Attempting to request an unregistered token, and re-pointing a
registered symlink, both fail.

**CI.** E2E checks 12, 13; a test that swaps a symlink mid-session.

### H14. MUST — Tauri: explicit capabilities, minimal permissions, no fs/shell/http/clipboard

**What.** A `capabilities/viewer.json` with only `core:event`, `core:path`, and
two `core:window` permissions. No `fs:*`, `shell:*`, `http:*`,
`clipboard-manager:*`, `opener:*`, `updater:*`.

**Why.** "Tauri provides … a capabilities system, to granularly enable and
constrain the core exposure to the application frontend running in the system
WebView." "A Markdown viewer needs none of them, and the whole point of a
capability system is that 'we need it eventually' is not a reason to include it
now."

**Verify.** `checkPermissions` in the renderer reports nothing beyond the list;
attempting a denied permission fails.

**CI.** Snapshot the resolved permission set and diff against a committed
allowlist.

### H15. MUST — Tauri: explicit `AppManifest::commands`, explicit asset-protocol scope

**What.** `build.rs` lists exactly seven commands; `assetProtocol.scope` is an
explicit allowlist with `requireLiteralLeadingDot: true`.

**Why.** "By default, **all** commands that you registered in your app … are
allowed to be used by all the windows and webviews of the app." The careful
reader's assumption is the opposite of the behaviour. And Tauri documents that a
wrong glob silently fails to match, so the scope must be reviewed, not guessed.

**Verify.** A command not in the manifest is rejected; a path inside a deny glob
is refused even though it matches an allow glob.

**CI.** E2E checks 11, 13, 14, 15.

### H16. MUST — Flip all Electron fuses, before signing

**What.** `runAsNode`, `nodeOptions`, `nodeCliInspect` disabled;
`cookieEncryption`, `embeddedAsarIntegrityValidation`, `onlyLoadAppFromAsar`
enabled.

**Why.** `runAsNode` blocks the `ELECTRON_RUN_AS_NODE` living-off-the-land trick.
`embeddedAsarIntegrityValidation` + `onlyLoadAppFromAsar` together "ensure that it
is impossible to load non-validated code" — on a machine where another user can
write to the install directory, that is the difference between "local attacker
can rewrite our JS" and "they cannot".

**Verify.** Read the fuse bytes from the built binary in CI.

**CI.** Fuse assertion; and a test that a patched `app.asar` is refused.

### H17. MUST — Set the window title natively, after rendering

**What.** `document.title` in the renderer is overwritten from the file's basename
in native code, after every render.

**Why.** Cheap defense against UI spoofing: a compromised renderer cannot
impersonate a system permission prompt.

**Verify.** A document setting `document.title` has no effect on the OS title bar.

**CI.** E2E.

### H18. SHOULD — Refuse unrequested window geometry changes

**What.** `will-resize` / `will-move` are prevented unless the user initiated the
gesture.

**Why.** A renderer that can resize itself to cover the screen can overlay other
windows.

**Verify.** A payload calling `window.resizeTo` does not resize the window.

**CI.** E2E.

---

## Layer 5 — Filesystem (14 items)

### F1. MUST — Canonicalize before checking containment; never prefix-match strings

**What.** `realpath` (or `std::fs::canonicalize`) then `path.relative`-based
containment, both times.

**Why.** CWE-22: "Use a built-in path canonicalization function … that produces
the canonical version of the pathname, which effectively removes `..` sequences
and symbolic links." And `candidate.startsWith(root)` is wrong: `/root-evil`
starts with `/root`.

**Verify.** `isInside('/root-evil', '/root')` is `false`; the traversal corpus is
refused.

**CI.** Unit tests including the `/root-evil` case and the full corpus from
[03-filesystem-safety.md §2.5](./03-filesystem-safety.md#25-payload-corpus).

### F2. MUST — Containment against roots the user has explicitly opened

**What.** A `Set<string>` of canonicalized roots, populated only by the file
picker, checked on every access.

**Why.** Least privilege. A user who opened `~/notes` has not consented to
`~/.ssh`. This is also the natural translation of the Tauri fs scope model.

**Verify.** A path inside `~/notes` and a sibling `~/notes-backup/x.md` behave
correctly.

**CI.** Unit tests.

### F3. MUST — Extension allowlist

**What.** A generous Markdown/text list; everything else refused or offered with
explicit per-file consent.

**Why.** Two reasons: the user opened a *directory*, not the disk, so
`.env`/`.ssh` in a shared folder must not be renderable; and it is a second,
independent gate that does not depend on containment being correct.

**Verify.** `.env` inside an allowed root is not rendered as Markdown.

**CI.** Unit tests.

### F4. MUST — Windows: reject `:` outside the drive letter, `\\` prefixes, `\\?\`, `\\.\`, drive-relative paths

**What.** A shape filter applied *before* canonicalization, since canonicalization
is unreliable or has side effects for these forms.

**Why.** NTFS alternate data streams ([CWE-69](https://cwe.mitre.org/data/definitions/69.html)),
UNC shares ([CWE-40](https://cwe.mitre.org/data/definitions/40.html) — which also
risks leaking the user's NetNTLM hash to an attacker server), device paths, and
drive-relative paths ([CWE-39](https://cwe.mitre.org/data/definitions/39.html)).
Not hypothetical: [CVE-2026-53571](https://www.sentinelone.com/vulnerability-database/cve-2026-53571)
bypassed Vite's Windows path-deny list with `::$DATA` and 8.3 short names.
Canonicalization does **not** strip ADS — `path.normalize` treats `:` as part of a
filename.

**Verify.** The ADS, UNC, device, and drive-relative cases in the corpus.

**CI.** Corpus, on Windows runners.

### F5. MUST — Reject NUL bytes and over-long paths

**What.** `includes('\0')` → refuse; length > 4096 → refuse.

**Why.** Truncation attacks; and platform limits (`ENAMETOOLONG`).

**Verify.** `"ok.txt\0../../etc/passwd"` refused.

**CI.** Unit tests.

### F6. MUST — Read through an `O_NOFOLLOW` handle and compare inode after open

**What.** `open(real, O_RDONLY | O_NOFOLLOW)`, then compare `fh.stat().ino`/`.dev`
against the pre-open `lstat`.

**Why.** TOCTOU ([CWE-367](https://cwe.mitre.org/data/definitions/367.html)): a
symlink swapped between the check and the open defeats a check-then-open sequence.

**Verify.** A symlink-flipping loop cannot get us to read a file outside the root.

**CI.** A test that swaps the symlink in a tight loop while reading repeatedly.

### F7. MUST — Refuse non-regular files

**What.** `st.isFile()` required; directories, FIFOs, sockets, character devices,
and block devices refused.

**Why.** Reading a FIFO blocks forever; reading `/dev/zero` is an infinite memory
fill. CWE-73, "External Control of File Name or Path."

**Verify.** Corpus row: a FIFO is refused.

**CI.** Unit test with an `mkfifo`.

### F8. MUST — Directory walks: depth, entry, and byte budgets, with an inode `seen` set

**What.** `maxDepth: 6`, `maxEntries: 50 000`, `maxBytes: 512 MB`, and a
`Set<"dev:ino">` to break loops. Report truncation in the UI.

**Why.** A symlink loop (`a/link -> ..`) makes the walk infinite. On Windows,
junctions do not always report as symlinks, so the inode check must catch the loop
regardless of how traversal got there. Truncation must be visible: a silently
truncated file tree is a correctness bug the user cannot diagnose.

**Verify.** Loop terminates with "loop skipped"; a 100 000-file directory
truncates with a message.

**CI.** Unit tests for both.

### F9. MUST — Encoding: BOM, then heuristic, then lossy UTF-8 with a warning

**What.** The five BOMs; then NUL-distribution analysis for UTF-16/32; then UTF-8
validity over a 64 KB window; then lossy with a visible replacement-character
count.

**Why.** Windows Notepad's "UTF-16 LE" and many older Windows editors produce
UTF-16 with a BOM, but plenty of files have none. Decoding UTF-16LE ASCII as
UTF-8 produces `H Texts ar htiPs at an Empty Loom` — every second character
dropped. We do **not** guess Latin-1: confident wrongness is worse than visible
replacement characters.

**Verify.** Fixture corpus: UTF-8, UTF-8+BOM, UTF-16LE+BOM, UTF-16LE no BOM,
UTF-16BE, UTF-32LE, Latin-1 with `0x92`, bare CR, CRLF, mixed, lone surrogate.

**CI.** Table-driven tests over checked-in fixtures.

### F10. MUST — Normalize newlines before parsing; preserve for writing

Covered by P11. Repeated because it is both a correctness and a security-adjacent
concern (bare CR is a parser-differential vector).

### F11. MUST — Atomic writes: `O_EXCL` temp in the same directory, `fsync`, `rename`, preserve mode

**What.** The pattern in
[03-filesystem-safety.md §9.1](./03-filesystem-safety.md#91-the-pattern).

**Why.** `O_EXCL` prevents writing through a pre-planted symlink and prevents two
instances clobbering each other's temp. Same-directory means `rename` is atomic
(`EXDEV` would degrade to a copy). `fsync` before rename prevents a
zero-length file after a crash. Preserving mode prevents silently widening `0600`
to `0644`.

**Verify.** Kill the process mid-write; the target is intact and a `.tmp` remains.

**CI.** A test that aborts the write at each step.

### F12. MUST — No write path from document content

**What.** A document cannot cause a write, cannot name an output path, and
cannot trigger an export. Export writes only to a user-chosen save-dialog path.

**Why.** O5. This is the invariant that makes the export safe — see
[05-rendering/05-export-and-print.md §5](../05-rendering/05-export-and-print.md#5-how-to-make-an-exported-html-file-safe),
where the invariant is what allows the export to reuse the sanitized HTML
verbatim.

**Verify.** Code search: no write function is reachable from a document-driven
code path.

**CI.** Static check plus E2E: opening a document produces zero file-system
writes.

### F13. SHOULD — Debounce the watcher 250 ms and watch directories, not files

**What.** Coalesce events; watch the parent directory and filter by filename.

**Why.** A raw watcher fires several times per save and, on Linux, fires for
accesses. And `inotify` follows the inode, so watching a file that an editor
replaces by rename loses the watch. Debouncing alone leaves the race; retrying
alone does five reads per save; both are needed.

**Verify.** An atomic-rename save produces exactly one content update.

**CI.** E2E with a script that performs the rename dance.

### F14. SHOULD — No archive extraction in v0.1; if added, reject escaping entries

**What.** Tell users to extract archives themselves. If we ever add it: reject
entries whose resolved path escapes the destination, reject absolute paths, `..`,
UNC, and device paths, reject symlink entries, and enforce total-size and
entry-count limits.

**Why.** [CWE-59](https://cwe.mitre.org/data/definitions/59.html) names zip-slip
explicitly: "filenames with path traversal sequences that cause the files to be
written outside of the directory under which the archive is expected to be
extracted." Impact is arbitrary file write → code execution on next login. The
honest engineering answer for v0.1 is not to build the feature.

**Verify.** A zip with `../../evil.sh` entries is refused, or the feature is absent.

**CI.** Test present only if the feature exists.

---

## Layer 6 — Network (8 items)

### N1. MUST — Remote images blocked by default, per-document opt-in

**What.** Rewritten to a local placeholder. A per-document tri-state:
`off` / `on` / `off-once`. The status bar shows the blocked count.

**Why.** DOMPurify's non-goals: it "will **NOT** reliably stop HTML that requests
external resources (tracking pixels, prefetch, etc.). There are too many ways to
do it." A Markdown document is a tracking surface the user does not know they are
offering.

**Verify.** Opening a document with 200 remote images issues zero network requests.

**CI.** Playwright with request interception; assert no request to the fixture's
canary host.

### N2. MUST — `img-src` in CSP contains no remote scheme in the default state

**What.** `img-src 'self' mdimg: mdapp: data: blob:`. Widened only while the user
has opted in for the current document, then restored.

**Why.** The backstop for shapes the rewrite misses (CSS `background-image`,
`video poster`, `link rel=preload` if it ever slips through).

**Verify.** A raw-HTML `<img src="https://…">` does not fetch.

**CI.** E2E with interception.

### N3. MUST — `connect-src` limited to our own origin/IPC

**What.** Electron: `connect-src 'self'`. Tauri: `ipc: http://ipc.localhost`.
Never `*`, never a wildcard, never an API host "for telemetry".

**Why.** This is O4 at the platform level, and it is why the remote-image feature
requires a deliberate permission rather than a CSP edit.

**Verify.** `fetch('https://example.com')` from the renderer is blocked.

**CI.** E2E.

### N4. MUST — `shell.openExternal` allowlist (duplicate of H8, stated for the network layer)

**Why.** Listed here so the network layer's checklist is complete on its own.

### N5. MUST — HTTPS only for any application-level request

**What.** If any feature ever makes a request (a link-preview fetcher, an update
check with a custom backend), it is `https:` only. No `http:`, no `ws:`.

**Why.** Electron's checklist item 1: "Any resources not included with your
application should be loaded using a secure protocol like HTTPS."

**Verify.** Static check: no `http://` URL literals outside tests and comments.

**CI.** `rg -n '"http://' packages apps` reviewed.

### N6. MUST — The updater endpoint is HTTPS and signature-verified

**What.** Fixed `https://` endpoint; Tauri signature verification cannot be
disabled; Electron verifies code signature.

**Why.** "Tauri's updater needs a signature to verify that the update is from a
trusted source. **This cannot be disabled.**"

**Verify.** A tampered artifact is rejected by a test harness.

**CI.** Test.

### N7. SHOULD — No telemetry, no analytics, no crash-upload by default

**What.** Zero outbound requests other than an explicit update check. If
opt-in crash reporting is ever added, it is off by default, scrubbed, and
documented.

**Why.** A reading tool that phones home is a different product. And every
outbound endpoint is an attack surface that must be monitored for the app's life.

**Verify.** A full session with network interception shows only the update check
(or nothing).

**CI.** E2E.

### N8. SHOULD — Update checks are user-initiated or silent-but-cached, never auto-downloading

**What.** `autoDownload = false`; show a badge; install on user action (or on
quit, if the user enabled that).

**Why.** A silently-downloading app gives a compromised CDN a code-execution timer.

**Verify.** No download occurs without a user action.

**CI.** E2E.

---

## Layer 7 — Dependencies (17 items)

### D1. MUST — Committed lockfiles; `npm ci` and `cargo build --locked`

**What.** `package-lock.json` and `Cargo.lock` in the repo. CI installs with
`--frozen-lockfile`/`npm ci`/`--locked`.

**Why.** A library may use ranges; an app may not. The install that CI runs *is*
our build.

**Verify.** CI fails if the lockfile would change.

**CI.** `git diff --exit-code package-lock.json` after install.

### D2. MUST — Exact versions for the sanitizer, parser, and highlighter

**What.** `"dompurify": "3.4.16"` — no caret. The critical set is machine-asserted.

**Why.** A caret means a new release that introduces a bypass is picked up by the
next build automatically. That is precisely the exposure window that has existed
for DOMPurify advisories.

**Verify.** `assert-pinned-deps.ts` fails when a critical version drifts.

**CI.** The assertion script.

### D3. MUST — Integrity verification never disabled

**What.** No `--no-verify`, no `ignore-scripts=true`, no registry overrides.

**Why.** The lockfile's `integrity` field is the entire supply-chain guarantee.

**Verify.** Grep finds nothing.

**CI.** The grep checks.

### D4. MUST — Every dependency with an install script is enumerated and reviewed

**What.** `npm ls --json | jq 'hasInstallScript'` produces a reviewed list;
`build.rs` crates similarly.

**Why.** A malicious `postinstall` runs as us. We choose not to globally disable
(the legitimate native builds need it) — which makes enumeration the control.

**Verify.** The list exists, is current, and each entry has a recorded decision.

**CI.** The enumeration command; the reviewed list is committed and diffed.

### D5. MUST — Dependabot for security, daily

**What.** `npm` and `cargo`, `interval: daily`, grouped by advisory, with the
critical packages in their own group labelled `security, review-required`.

**Why.** Weekly cadence is too slow for a sanitizer advisory in an app that opens
untrusted files daily.

**Verify.** The config is present and the schedule is daily.

**CI.** Config assertion.

### D6. MUST — Renovate for version bumps, with security updates disabled

**Why.** Avoids duplicate PRs while keeping granular control over grouping and
auto-merge (which is off).

**Verify.** No duplicate PRs; grouping as configured.

**CI.** Config assertion.

### D7. MUST — A stated triage SLA: 24 h for XSS-class sanitizer/parser advisories, 72 h to ship

**What.** Written in `SECURITY.md` and in the release runbook.

**Why.** An advisory without a response commitment is a wish. For an app that
opens untrusted files daily, "low severity" on a sanitizer is critical.

**Verify.** The SLA is documented.

**CI.** None (process control); rehearsed once per year.

### D8. MUST — Review the sanitizer's source at our pinned version

**What.** Diff `src/tags.ts` and `src/attrs.ts` between the previous and new
pinned versions. A new tag or attribute in a patch release is a security event.

**Why.** DOMPurify's allow-list wiki explicitly says "**The authoritative current
lists live in source**" and that its own enumeration "has not been kept in sync
with the library." Reading HEAD tells you nothing about what we ship.

**Verify.** The diff is in the PR.

**CI.** Checkbox in the dependency-PR template.

### D9. MUST — Review fixture snapshot diffs on any parser or sanitizer change

**What.** Regenerate `packages/test-fixtures/__snapshots__` and read the diff.

**Why.** The highest-signal review step available. A silent change in how an
attribute is escaped, or a tag that disappears, is a change in security posture
whether or not the release notes say so.

**Verify.** The diff is reviewed; a non-empty diff requires an explicit
justification in the PR.

**CI.** Snapshot comparison job; the diff is posted as a PR artifact.

### D10. MUST — Advisory scanning in CI: `npm audit`, `cargo audit`, `osv-scanner`

**What.** All three, failing on high/critical.

**Why.** `osv-scanner` reads OSV directly and catches crates and npm packages NVD
has not enriched yet — which is often, for fast-moving packages.

**Verify.** CI is green or the exceptions are documented.

**CI.** The three commands.

### D11. MUST — `npm audit`/`cargo audit` exceptions are explicit, dated, and owned

**What.** A committed `audit-exceptions.json` with a reason and an expiry for each.

**Why.** A permanently ignored advisory is an invisible hole. An expiry turns it
into a recurring task.

**Verify.** No exception is past its expiry.

**CI.** A check that fails on an expired exception.

### D12. MUST — Pinned toolchain versions

**What.** `rust-toolchain.toml` with an exact channel and components; `.nvmrc`;
the Tauri CLI as a dev-dependency at an exact version.

**Why.** "Stable" is a moving target. A toolchain update that changes code
generation between two builds of the same source is both a reproducibility
failure and an unaudited change.

**Verify.** The files exist with exact versions.

**CI.** Config assertion; the build fails if the toolchain is absent.

### D13. MUST — SBOM generated per release, validated, and published

**What.** CycloneDX JSON from both ecosystems, validated with
`cyclonedx-validate`, uploaded as a release artifact, and its SHA-256 recorded in
the signed release manifest.

**Why.** "Which of our released versions contained the affected component?" is a
one-line query with an SBOM and a day of archaeology without one.

**Verify.** The SBOM exists on the release and validates.

**CI.** Generation + validation + upload.

### D14. MUST — Signed artifacts; signature verification is not optional

**What.** Tauri: `tauri signer`, pubkey in config, verification cannot be
disabled. Electron: code signing, with the private key in CI-only secrets.

**Why.** An unsigned update channel is an arbitrary-code-execution channel.

**Verify.** Verification of the built artifact succeeds; a tampered artifact is
rejected.

**CI.** `signtool verify` / `codesign --verify` on the artifact; a test harness
that feeds a tampered artifact to the updater.

### D15. MUST — Signing keys: generated offline, stored offline, never logged, rotation rehearsed

**What.** Generated offline; the private key only as a masked CI secret; access
limited to a protected `release` environment with required reviewers;
`::add-mask::` on read; two offline backups; a documented rotation procedure
rehearsed annually.

**Why.** Losing the Tauri key means we can never publish an update to existing
installs — a self-inflicted end-of-life. Stealing it means a signed malicious
update reaching every user.

**Verify.** A deliberate canary signing run produces no occurrence of the value in
the logs.

**CI.** The canary log-grep test.

### D16. MUST — GitHub Actions pinned by SHA; protected branches; protected `release` environment

**What.** `uses: actions/checkout@11bd719…` (SHA, not tag); branch protection on
`main` with required reviews and stale-approval dismissal; `release` as a
protected environment with reviewers and a wait timer; least-privilege
`permissions:` per job.

**Why.** A tag-pinned action is a supply-chain dependency with the repository's
secrets. A moved tag is a compromised action. And the release pipeline must not
run unreviewed code.

**Verify.** `grep -n 'uses: .*@[v0-9]' .github/workflows/` is empty; branch
protection is configured.

**CI.** The grep; a config review.

### D17. SHOULD — Attempt reproducible builds; document honestly if not achieved

**What.** Pinned toolchain, vendored dependencies, `SOURCE_DATE_EPOCH`, no
host-specific codegen. For Electron, publish the SBOM and checksums even if
byte-identical output is not achieved.

**Why.** Reproducibility is the strongest available answer to "was this build
compromised?" Claiming it without achieving it is worse than not claiming it.

**Verify.** A documented statement of what is and is not reproducible, per shell.

**CI.** Two builds on clean runners, diffed; result recorded in the release
notes either way.

---

## Layer 8 — CI and release (15 items)

### C1. MUST — All tests green; spec suite, payload corpus, and E2E security checks are release blockers

**What.** `test:spec`, `test:sanitize`, `test:e2e-security`, `test:fixtures`,
`test:encoding`, `test:path-traversal` all blocking.

**Why.** A green build is the only release gate that is actually enforced.

**Verify.** No required check is non-blocking in branch protection.

**CI.** The workflow.

### C2. MUST — A static security lint pass

**What.** Rules for: unguarded `innerHTML`; `getElementById` in content code;
blocklist usage in the sanitizer config; `style` in emitted attributes; unpinned
actions; `--no-verify`; `http://` literals; new dependencies without review.

**Why.** Each rule encodes a decision that would otherwise be a review comment,
and review comments get missed under time pressure.

**Verify.** The rules exist and fail on a seeded violation.

**CI.** `npm run lint:security`, with self-tests proving each rule fires.

### C3. MUST — Fuzzing runs in CI (short) and nightly (long)

**What.** Parser fuzz, sanitizer fuzz with idempotence assertions, and a
browser-level differential fuzz. Nightly runs for hours.

**Why.** Upstream bug bounties are not our CI.

**Verify.** No invariant violations.

**CI.** Short run per commit; long run nightly with a fixed seed corpus committed
so failures reproduce.

### C4. MUST — E2E security assertions on every commit

**What.** The 16 checks in
[02-webview-sandboxing.md §6](./02-webview-sandboxing.md#6-verification), run
against a real browser with a real document.

**Why.** Configuration errors (`nodeIntegration` flipped, fuses not flipped, CSP
missing) are invisible in unit tests and are the most likely regression from a
refactor.

**Verify.** All pass.

**CI.** Playwright job.

### C5. MUST — Cross-platform test matrix: Windows + Linux

**What.** Every filesystem and path test runs on both.

**Why.** ADS, UNC, device paths, 8.3 short names, drive letters, reserved names,
and CRLF are Windows-only; symlinks and LF are Linux-only. Testing on one platform
means the other one's traversal corpus is untested.

**Verify.** Matrix configured.

**CI.** The matrix.

### C6. MUST — Branch protection with required reviews and dismissed stale approvals

**What.** `main` protected; two approvals; stale approvals dismissed on new
commits; required status checks enforced; force-push and deletion blocked.

**Verify.** Settings configured and enforced.

**CI.** A configuration check via the GitHub API in the release workflow.

### C7. MUST — `SECURITY.md` with a private disclosure route and a good-faith policy

**What.** A contact, a response-time commitment, an explicit statement that
good-faith research that does not exfiltrate data, modify user files, or degrade
the service will not be pursued, and a CVE credit policy.

**Why.** Given the CVE history of every comparable product, someone will find
something. The only question is whether they tell us first.

**Verify.** The file exists.

**CI.** Config assertion.

### C8. MUST — Release notes list security-relevant changes explicitly

**What.** A "Security" section naming every dependency update that touched the
sanitizer or parser, every CSP or capability change, and every new network
destination.

**Why.** Users of a viewer that opens untrusted files need to know when the
security posture changed.

**Verify.** The section exists and is not empty for releases touching those areas.

**CI.** Template check.

### C9. MUST — Reproducible-build attempt on every release

Covered by D17; repeated as a release-gate item because a release is where it is
measured.

### C10. SHOULD — Coverage thresholds on the sanitizer, path validator, and shell config

**What.** ≥ 95% line and branch coverage on `packages/core/src/sanitize.ts`,
`packages/fs-adapters`, and the main-process handlers; 100% on the IPC handler
validators.

**Why.** These are the security-critical files, and a coverage drop there is a
review signal.

**Verify.** Coverage gate.

**CI.** Coverage job with per-path thresholds.

### C11. SHOULD — Dependency update PRs cannot auto-merge

**What.** `automerge: false` everywhere in `renovate.json5`.

**Why.** An auto-merged minor bump of the sanitizer is an unreviewed change to
the component that keeps boundary 3 intact. Even with tests, the tests are ours.

**Verify.** Config assertion.

**CI.** Config assertion.

### C12. SHOULD — A runbook for the XSS-class advisory

**What.** Triage within 24 h; determine affected versions; ship within 72 h
regardless of the advisory's own severity; add the PoC to the corpus permanently;
consider a dependency-free defensive mitigation in the interim (tighten
`FORBID_TAGS`/`FORBID_ATTR`, reduce `USE_PROFILES`, disable a parser feature).

**Why.** The advisory severities are calibrated for browsers, not for a desktop
app that executes files. "Moderate" on a sanitizer is critical here.

**Verify.** The runbook exists and has been walked through once.

**CI.** None (process control).

### C13. SHOULD — A runbook for a compromised release

**What.** Who to notify, how to revoke (publish a signed advisory telling users to
check a signature against a known-good fingerprint), how to rotate the signing
key, how to ship a fixed version, what to say publicly.

**Why.** The signing-key rotation path must never be exercised for the first time
during an incident.

**Verify.** Written; key-rotation rehearsed.

**CI.** None (process control).

### C14. SHOULD — Architectural decision records for every security-relevant choice

**What.** ADRs for: shell choice, parser choice, sanitizer choice and config, raw
HTML policy, remote image default, paste policy, archive policy, signing scheme.

**Why.** Every item above is a decision someone will want to revisit. A
recorded rationale with a date is what prevents the decision being silently
reversed by a well-meaning feature request.

**Verify.** The ADRs exist and are referenced from the code.

**CI.** None (process control).

### C15. NICE — Third-party security review before v1.0

**What.** An external review focused on the sanitizer config, the shell
configuration, the IPC surface, and the path validator.

**Why.** All four are areas where a second pair of eyes is cheap relative to a
compromise, and where an internal review is structurally blind to its own
assumptions.

**Verify.** A report exists and its findings are triaged.

**CI.** None (process control).

---

## Reviewer quick reference

When reviewing a PR, these are the questions, in order, and the item numbers
they map to:

| # | Question | Items |
|---|----------|-------|
| 1 | Does this PR add a path from document bytes to a DOM insertion? If yes, does it go through `sanitize()`? | P4, S1, R1, R5 |
| 2 | Does this PR widen any allowlist, or add an `ADD_*` sanitizer option? | S14, R3 |
| 3 | Does this PR add a new tag, attribute, or URL scheme to the output? | S6–S13, R3, R4 |
| 4 | Does this PR add a new IPC function, permission, or capability? | H4, H6, H14, H15 |
| 5 | Does this PR add a new network destination or change the CSP? | N1–N8, H10, H13 |
| 6 | Does this PR add a new file path from renderer to disk? | F1–F8, F12 |
| 7 | Does this PR add a new dependency, or change a pinned version? | D1–D4, D8, D9 |
| 8 | Does this PR touch the release pipeline or any signing key? | C6, C7, D15, D16 |
| 9 | Does this PR add a paste, drag-drop, archive, or clipboard feature? | §5.9, §5.15 of the threat model |
| 10 | Does this PR touch `preload.js` or the capability files? | H1–H8, H14–H16 |

**One rule that overrides all of them:** if a change makes a sanitizer, path, or
shell check *narrower for the document and broader for the app*, it is a security
improvement. If it does the reverse, it needs a security review and a test.

## Sources

- OWASP Cross Site Scripting Prevention Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- OWASP ASVS 5.0.0, ch. 1 Encoding and Sanitization, ch. 5 File Handling —
  <https://asvs.dev/>
- OWASP Desktop App Security Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Desktop_App_Security_Cheat_Sheet.html>
- Electron security checklist —
  <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron fuses — <https://www.electronjs.org/docs/latest/tutorial/fuses>
- Tauri capabilities — <https://v2.tauri.app/security/capabilities/>
- Tauri command scopes — <https://v2.tauri.app/security/scope/>
- Tauri asset protocol scope — <https://v2.tauri.app/security/asset-protocol/>
- Tauri CSP — <https://v2.tauri.app/security/csp/>
- Tauri updater — <https://v2.tauri.app/plugin/updater/>
- DOMPurify Security Goals & Threat Model —
  <https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model>
- DOMPurify Attack Classes & Bypass History —
  <https://github.com/cure53/DOMPurify/wiki/Attack-Classes-&-Bypass-History>
- DOMPurify allow-list wiki ("authoritative lists live in source") —
  <https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist>
- CommonMark 0.31.2 §4.6 HTML blocks — <https://spec.commonmark.org/0.31.2/#html-blocks>
- CWE-22, CWE-39, CWE-40, CWE-58, CWE-59, CWE-69, CWE-73, CWE-367 —
  <https://cwe.mitre.org/data/published/cwe_v4.8.pdf>
- OWASP Windows Alternate Data Streams —
  <https://owasp.org/www-community/attacks/Windows_alternate_data_stream>
- CVE-2019-20374, CVE-2022-21158, CVE-2023-2318, CVE-2023-2317 (product XSS→RCE)
- CVE-2022-21680, CVE-2022-21681, CVE-2026-48988 (parser ReDoS/DoS)
- CVE-2024-45801, CVE-2026-0540, CVE-2026-41238, CVE-2026-47423, CVE-2026-65914
  (sanitizer bypasses)
- CVE-2026-53571 (Windows ADS/8.3 path-deny bypass)
