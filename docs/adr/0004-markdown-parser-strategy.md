# ADR-0004: Markdown parser strategy

- **Status:** Proposed
- **Date:** 2026-10-06
- **Deciders:** Pending — depends on ADR-0003 and on measured benchmarks
- **Consulted:**
  - [`research/06-libraries/README.md`](../../research/06-libraries/README.md)
  - [`research/06-libraries/01-js-parsers.md`](../../research/06-libraries/01-js-parsers.md)
  - [`research/06-libraries/02-rust-parsers.md`](../../research/06-libraries/02-rust-parsers.md)
  - [`research/06-libraries/07-evaluation-framework.md`](../../research/06-libraries/07-evaluation-framework.md)
  - [`research/04-parsing-internals/`](../../research/04-parsing-internals/README.md)

## Context

Parsing is the core of this application. Everything else is presentation. The
parser choice determines:

1. **Correctness.** How close to CommonMark we get on the spec's own test suite.
2. **Safety.** The parser produces an AST or HTML that a sanitizer then
   processes. A parser with an HTML-escaping bug is a security bug.
3. **Extendability.** We need tables, task lists, footnotes, and possibly
   wikilinks, math, and diagrams. A parser without a plugin story forces us to
   fork it.
4. **Performance.** Parse time for the common case (a 5 KB README) and the hard
   case (a 5 MB technical document), in whatever JS engine our shell provides.
5. **Portability.** The same parser must run in the desktop webview, in a
   browser for Phase 6, and in Phase 7 mobile.
6. **Bundle size.** It ships to every user.

## Decision criteria

| Criterion | Weight | Rationale |
|---|---|---|
| CommonMark conformance | 25% | A viewer that mangles `*a **b** c*` is visibly broken. |
| Security posture | 20% | HTML escaping and raw-HTML handling are attack surface. |
| Extension mechanism | 15% | We will need extensions we do not have today. |
| Cross-target portability | 15% | Desktop, web, mobile. |
| Performance | 15% | See `research/10-performance/`. |
| Ecosystem and maintenance | 10% | A dead parser is a security liability. |

## Candidates

Full analysis in
[`research/06-libraries/01-js-parsers.md`](../../research/06-libraries/01-js-parsers.md)
and [`research/06-libraries/02-rust-parsers.md`](../../research/06-libraries/02-rust-parsers.md).

### JavaScript / TypeScript

| Library | CommonMark | GFM | Extensions | Notes |
|---|---|---|---|---|
| `markdown-it` | Excellent | Via plugins | Large plugin ecosystem | The pragmatic default. Correctness-first. MIT. |
| `marked` | Very good | Built in | Fewer plugins | Faster by default; GFM on by default. Has had XSS-relevant history. |
| `micromark` / `remark` / `unified` | Excellent (the reference-quality path) | First-class extension family | Best-in-class, by far | Complexity and a large dependency tree. |

### Rust

| Crate | CommonMark | GFM | Notes |
|---|---|---|---|
| `pulldown-cmark` | Yes | Options | Streaming; fast |
| `comrak` | Yes | Extensions | AST with source positions; used by GitLab |
| `goldmark` | Yes | Opt-in extensions | Very fast; used by Hugo |

`ammonia` is the Rust HTML sanitizer, equivalent in role to DOMPurify.

## Decision

**Proposed: `markdown-it` (≥ 14.2.0, `typographer` off) in TypeScript for the
renderer, with `DOMPurify` (≥ 3.4.16) for sanitization, plus `ammonia` available
on the Rust side if ADR-0003 selects Tauri and a Rust parser is later justified.**

Reasoning:

1. **`markdown-it` for correctness first.** The common failure mode for a
   Markdown viewer is subtle misrendering of emphasis, lists, or links in
   legitimate documents. `markdown-it` is the most correctness-focused library
   with a real plugin ecosystem, and its conformance to the CommonMark spec is
   the best available in JavaScript. For an application whose entire value is
   rendering text correctly, that ordering is right.
2. **The plugin story matters and we will need it.** Tables, task lists,
   footnotes, anchors, and TOC are all plugins rather than forks. When we add
   wikilinks or math in Phase 5, they should be plugins too.
3. **One implementation for all three targets.** A TypeScript parser runs in the
   Tauri webview, in a browser for Phase 6, and in React Native or a Capacitor
   webview for Phase 7. A Rust parser would need a WASM build to reach the web
   target, which adds a build pipeline and a synchronisation boundary.
4. **`DOMPurify` is the industry-standard in-browser sanitizer**, with a
   documented threat model and a history of fast response to bypass reports.

### Deliberately rejected

**`marked` as the default.** Faster, and GFM by default, but its extension model
is thinner and its advisory history is worse: published XSS and ReDoS issues
including [CVE-2017-1000427](https://nvd.nist.gov/vuln/detail/CVE-2017-1000427),
[CVE-2017-17461](https://github.com/advisories/GHSA-p9wx-2529-fp83),
[CVE-2022-21680](https://nvd.nist.gov/vuln/detail/CVE-2022-21680), and
[CVE-2022-21681](https://nvd.nist.gov/vuln/detail/CVE-2022-21681). We may
revisit for a performance-critical path; we will not make it the default.

**`micromark`/`remark`/`unified`.** The best standards story and the best
extension architecture in existence. Rejected as a *default* because the
complexity cost is real: a deeply nested plugin pipeline is harder for a
newcomer, harder to constrain in a security review, and harder to reason about
when something fails. It remains the best choice if we need CommonMark at a level
`markdown-it` cannot reach, or if a required extension has no `markdown-it`
equivalent.

**A Rust parser (pulldown-cmark, comrak, goldmark) in v1.** Attractive if
ADR-0003 selects Tauri: we would already own a Rust toolchain, and these are
fast. Rejected for v1 for two reasons. First, portability — reaching the web
target means WASM, which adds a build pipeline and an async boundary around what
is currently a synchronous operation. Second, it splits the renderer across two
languages before we know we need it. Revisit if the benchmark in the validation
section shows JavaScript parsing is a bottleneck.

**Writing our own parser.** Not seriously considered. A CommonMark-conformant
parser is a large, subtle, security-critical piece of software. The spec's own
test suite has hundreds of edge cases precisely because the problem is hard. We
will contribute to an existing project instead.

**MDX.** Excluded permanently. MDX executes JavaScript from the document. That
is incompatible with the safety principle in [ADR-0005](0005-security-baseline-xss-sanitization.md).

## Minimum versions (verified 2026-10-06)

Version floors are part of this decision, not an implementation detail. Each of
these has a published advisory, and each is a reminder that a parser dependency
is a security dependency.

| Dependency | Floor | Why |
|---|---|---|
| `markdown-it` | **≥ 14.2.0** | [CVE-2026-48988](https://nvd.nist.gov/vuln/detail/CVE-2026-48988) — quadratic O(n²) DoS in the smartquotes rule when `typographer: true`. 160 KB of quote characters caused ~21 s of CPU in the published PoC. Also [CVE-2022-21670](https://nvd.nist.gov/vuln/detail/CVE-2022-21670) (ReDoS) and [CVE-2025-7969](https://nvd.nist.gov/vuln/detail/CVE-2025-7969) (XSS in the fence renderer, disputed by the vendor but the bug class is real). Current release at the time of writing: 15.0.2. |
| `DOMPurify` | **≥ 3.4.16** | [CVE-2026-41238](https://nvd.nist.gov/vuln/detail/CVE-2026-41238) — prototype-pollution XSS bypass affecting 3.0.1–3.3.3 in the default configuration. Then a further cluster in 2026, including [CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914) (mXSS via re-contextualization), [CVE-2026-47423](https://nvd.nist.gov/vuln/detail/CVE-2026-47423) (`<selectedcontent>` re-clone bypass), and `GHSA-6688-9rhm-gjv2` (Oct 2026, IN_PLACE mode, affects ≤ 3.4.15). 3.4.0 was the floor for the *first* of these; the rest of the cluster needs 3.4.16. Full analysis: [`research/06-libraries/05-sanitizer-libraries.md`](../../research/06-libraries/05-sanitizer-libraries.md). |

**Operational consequences of these findings:**

1. `typographer: true` **MUST** stay off in v1. It is the option that turns
   CVE-2026-48988 from unreachable into reachable, and its benefit (curly
   quotes) is cosmetic.
2. DOMPurify **MUST** be pinned to a floor, not floating, and Dependabot must
   treat it as a security-critical dependency — see
   [`11-security/04-dependency-and-supply-chain.md`](../../research/11-security/04-dependency-and-supply-chain.md).
3. The mXSS class in CVE-2026-65914 is a direct argument for
   [ADR-0005](0005-security-baseline-xss-sanitization.md): sanitized output must
   never be re-inserted into a different parsing context. Our single insertion
   point, into a detached `<div>`, avoids it. That constraint is now explicit in
   the baseline.
4. `marked` is disqualified as the default on this evidence alone, independent of
   its features: it carries a longer chain of published XSS and ReDoS advisories.

Full catalogue: [`research/11-security/04-dependency-and-supply-chain.md`](../../research/11-security/04-dependency-and-supply-chain.md).

## Consequences

### Good

- One parser implementation shared by all three targets.
- A large, maintained, MIT-licensed dependency with a real test suite.
- CommonMark correctness out of the box, verified in CI on every PR.
- Extensions arrive as plugins, which keeps `packages/core` from forking.
- `DOMPurify` gives us a sanitizer with a published threat model.

### Bad / accepted costs

- **We inherit `markdown-it`'s extension semantics**, including its choices
  about HTML passthrough. We will need to configure it conservatively.
- **Performance ceiling is JS speed.** We will measure, and we will add a
  `Research:` note if it matters.
- **Bundle size.** `markdown-it` plus `DOMPurify` plus a highlighter is
  non-trivial. We will load the highlighter lazily.
- **Raw HTML policy must be explicit.** `markdown-it` passes raw HTML through by
  default. We will disable it at the parser and rely on sanitization as the
  second layer — two independent layers, per ADR-0005.
- **Extension gaps are possible.** If a feature we need has no plugin, we will
  write one. That is a maintenance obligation we are choosing.

### Follow-up work

- [ ] Run the CommonMark spec suite against the candidates in CI and record real
      pass rates.
- [ ] Benchmark on a corpus of real documents: a README, a long technical doc, a
      5 MB file, and a deliberately pathological file.
- [ ] Benchmark in the actual WebKitGTK engine on Linux, not only in Node.
- [ ] Write the "Siyana Markdown Profile" — a versioned declaration of which
      extensions are REQUIRED, OPTIONAL, and UNSUPPORTED
      ([`research/03-specifications/03-extension-standards.md`](../../research/03-specifications/03-extension-standards.md)).
- [ ] Decide on a syntax highlighter (`Shiki` vs `highlight.js` vs `Prism`) —
      [`research/06-libraries/04-frontend-highlighting.md`](../../research/06-libraries/04-frontend-highlighting.md).
- [ ] Build a fuzzing harness: random and mutated Markdown fed to
      parser + sanitizer, asserting no unescaped HTML escapes the pipeline.

## Validation

We will revisit this decision if:

1. CommonMark conformance is below our target, or a regression is detected.
2. Parsing a 5 MB document exceeds our time budget in the WebKitGTK engine.
3. A security advisory affects the parser or a required plugin.
4. A required extension has no maintainable plugin and a fork becomes
   attractive.
5. The Rust route becomes clearly superior once the Tauri toolchain exists.

Fuzzing results are the strongest signal here. If the parser plus sanitizer
pipeline cannot survive a fuzzing campaign without an escaping bug, the
architecture is wrong, not just the library.
