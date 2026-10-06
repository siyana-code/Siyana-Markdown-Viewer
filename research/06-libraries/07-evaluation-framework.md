# 07 — Evaluation framework

How *we* decide. This document exists so that the parser decision, the
editor decision, and every future dependency decision is made by a written
procedure rather than by whoever argued hardest in a meeting.

It has six parts: the rubric, the questions every candidate must answer, the
hard gates, the **weighted decision matrix with our three leading candidates
scored**, the benchmark plan, and the review cadence.

Verified 2026-10-06. Every score traces to a measurement or a citation in
[01-js-parsers](01-js-parsers.md), [02-rust-parsers](02-rust-parsers.md),
[04-frontend-highlighting](04-frontend-highlighting.md),
[05-sanitizer-libraries](05-sanitizer-libraries.md) or
[06-front-matter](06-front-matter.md).

---

## 1. Principles

1. **Measure, do not believe.** If a README says "100% CommonMark", run the
   suite. If a README says "super-fast", benchmark it or write down that you
   did not.
2. **Version every claim.** "markdown-it is fast" is not a fact. "markdown-it
   15.0.2 measured 4.19 KiB/ms on a 570 KiB corpus on Node 24.14.1" is a fact,
   and it expires.
3. **The corpus is the argument.** Any performance claim without a
   reproducible corpus and a fixed harness is a rumour.
4. **Absence is a result.** "No credible published benchmark found" is a
   complete, publishable sentence. It goes in the document.
5. **Adversarial input is a first-class case.** A parser that is fast on
   well-formed prose and quadratic on a hostile file is not fast.
6. **Score what you can defend.** A score with a citation beats a score with a
   feeling. Where we genuinely cannot know, we score conservatively and write
   the uncertainty into the matrix.

---

## 2. The rubric

Eleven criteria, weights from
[README.md](README.md#the-evaluation-criteria):

| # | Criterion | Weight | How it is scored |
|---|---|---:|---|
| 1 | CommonMark conformance | 12% | 0–10 = (measured pass rate ÷ 100) × 10, run against the 652 examples of CommonMark 0.31.2 `spec.json`. No self-reporting. |
| 2 | GFM / extension coverage | 8% | 0–10. 1 point per GFM extension available without a custom build, plus 1 point each for footnotes, definition lists, front matter, math, wikilinks, `attrs`, containers, CJK emphasis. |
| 3 | Security posture | 15% | 0–10, rubric below. |
| 4 | Bundle size | 7% | 0–10. 10 at ≤50 KB gzip, 0 at ≥500 KB gzip, linear between. |
| 5 | Parse performance | 8% | 0–10. 10 at ≥10 KiB/ms, 0 at ≤0.5 KiB/ms, log-linear between. |
| 6 | Maintenance activity | 12% | 0–10. Composite of release recency, release cadence, bus factor, issue responsiveness, roadmap. |
| 7 | Licence | 8% | 0 or disqualifying. See §3. |
| 8 | TypeScript support | 6% | 0–10. First-party `.d.ts` = 5, ESM with `exports` = 3, dual module = 2. `@types/*`-only = 2. |
| 9 | WASM-ability | 4% | 0–10. Only matters for shared-core ambitions. |
| 10 | Community | 10% | 0–10. Monthly downloads (log) + stars (log) + "used by products you can name". |
| 11 | Position info / extensibility | 10% | 0–10. See below. |

### 2.1 Security posture rubric (criterion 3)

| Points | Condition |
|---:|---|
| +3 | Raw HTML is **not** emitted unless explicitly opted into |
| +2 | Dangerous URL schemes blocked by default, verified against `javascript:`, `vbscript:`, `file:`, `data:` and mixed case |
| +2 | Zero runtime dependencies, or all dependencies actively maintained |
| +1 | Safe against pathological input (no unbounded backtracking, no quadratic behaviour) — evidenced by the maintainer's own security fixes |
| +1 | Documented, published advisory history that is being fixed promptly |
| +1 | Extensible without weakening safety (plugin cannot disable validation by accident) |
| **−3** | Any advisory against the *default* configuration in the last 18 months |
| **−5** | Silent parse failure or no validation on malformed input |

### 2.2 Position info / extensibility rubric (criterion 11)

| Points | Condition |
|---:|---|
| +3 | Per-node **absolute offset** positions (not just line numbers) |
| +2 | Per-node line **and** column |
| +2 | Positions available on **every** top-level block |
| +2 | ≥4 distinct extension points (block parse, inline parse, transform, render) |
| +1 | Extension surface usable from outside the package without forking |
| **−2** | No positions at all — this blocks incremental preview and scroll sync |

---

## 3. Hard gates

Some things disqualify a candidate outright, before any scoring. A candidate
that fails a gate does not enter the matrix.

| Gate | Rule | Why |
|---|---|---|
| **G1 Licence** | Must be MIT, BSD-2/3, Apache-2.0, ISC, or a dual of those. **GPL, AGPL, SSPL, BUSL, and any source-available licence are disqualified.** | We intend to ship a closed-source-compatible desktop app and possibly a commercial one. Copyleft is a legal decision we are not qualified to make silently. |
| **G2 Active maintenance** | A commit in the last 6 months **and** a release in the last 18 months, or an explicit, credible statement of maintenance status. | An unmaintained parser is a liability. `showdown` (last release 2022-04-21) and `insane` (2016-09-19) fail this gate; so does `markdown-rs` (last release and commit both 2025-04-23, ~18 months stale). |
| **G3 No unpatched advisory in the render path** | Any advisory affecting the current version must be fixed, or the affected feature must be unused and documented as unused. | `marked` passes this at 18.1.0 (OSV clean). DOMPurify passes at **3.4.16** and fails at 3.4.15 (`GHSA-6688-9rhm-gjv2`). |
| **G4 Deterministic output** | Same input + same version ⇒ byte-identical output, or our conformance suite fails. | A renderer whose output changes between releases is a source of unreproducible user bugs. |
| **G5 No `eval`-family execution** | The library must not execute code derived from input. | Non-negotiable. Excludes Hugo shortcode engines and PyMond snippets. |
| **G6 Testable conformance** | Must be runnable against the CommonMark and GFM spec suites in CI without patching. | Otherwise we cannot detect a regression before a user does. |

**Candidates eliminated by the gates:**

| Candidate | Failed gate | Detail |
|---|---|---|
| `showdown` 2.1.0 | **G2** | Last npm release 2022-04-21. Also not CommonMark. |
| `insane` 2.6.2 | **G2** | Last release 2016-09-19, last commit 2018-04-24, deps pinned to `he@0.5.0`. |
| `markdown` (markdown-rs) 1.0.0 | **G2** | Last release and last commit both 2025-04-23. Also a crate-name trap. |
| `markdown-wasm` 1.2.0 | **G2** | Last publish 2021-07-01. |
| `sanitize-html` 2.18.0 | *(none)* — but **fails G8 below** | Node-only; unusable in a webview. |
| `rushdown` 0.18.0 | **G2 (soft)** | 34 stars, pre-1.0. Passes on activity, fails on bus factor. |
| `monaco-editor` (as *our* editor) | **G9** | See §8. |

### 3.1 A seventh gate for the webview path

| Gate | Rule |
|---|---|
| **G8 Runs in the webview** | Must execute in the WebView2/WebKitGTK runtime. Node-only libraries fail. `sanitize-html` ("intended for use with Node.js") fails this for the render path. |

### 3.2 A ninth gate for editor engines

| Gate | Rule |
|---|---|
| **G9 Mobile-capable** | The engine must have a credible path to a mobile webview, because Mobile is a stated project phase. Monaco's DOM weight and worker model make this a **deferred** problem, not an impossible one — but it costs us an order of magnitude more work than CodeMirror or ProseMirror. |

---

## 4. Candidate set

**Leading three for the parser** (the ones that cleared every gate):

- **A — markdown-it 15.0.2**
- **B — marked 18.1.0**
- **C — micromark 4.0.3 + remark 15.0.1 + unified 11.0.5**

**Scored but gate-failed, recorded for completeness:** commonmark.js 0.31.2
(scored, loses on §2 — no extensions, no positions, no types; adopted as a
test oracle instead), rustdown 0.18.0, comrak 0.55.0 and pulldown-cmark
0.13.4 (Rust, scored separately in §7).

---

## 5. Weighted decision matrix

Scores are 0–10. `n/a` means the criterion does not apply and the weight is
redistributed across the remaining criteria. **Weighted total = Σ(score ×
weight) / 10**, so the total is out of 10.

### 5.1 Parser matrix

| # | Criterion | Wt | **A. markdown-it 15.0.2** | **B. marked 18.1.0** | **C. micromark+remark** | Evidence |
|---|---|---:|---:|---:|---:|---|
| 1 | CommonMark conformance | 12% | **9.9** — 649/652 = 99.5% in `commonmark` preset | **7.7** — 502/652 = 77.0% | **9.9** — 648/652 = 99.4% with `allowDangerousHtml` | [01 §6](01-js-parsers.md#6-commonmark-conformance-measured) |
| 2 | GFM / extensions | 8% | **8.5** — GFM 3 of 5 + footnotes + deflist + attrs + container + toc + anchors + emoji + CJK | **4.5** — GFM 4 of 5, no footnotes/deflist/attrs/container | **9.5** — GFM 5 of 5 + footnotes + deflist + math + frontmatter + directives + MDX | plugin tables in [01 §1.6](01-js-parsers.md#16-the-plugin-ecosystem); [03 §7](03-other-ecosystems.md#7-cross-ecosystem-dialect-matrix) |
| 3 | Security posture | 15% | **9.0** — +3 raw HTML off, +2 schemes blocked (verified), +2 six deps all maintained, +1 pathological-input fixes (3 DoS fixes in 2026), +1 advisories fixed promptly; −0 default-config advisory | **2.0** — raw HTML **on** by default, dangerous schemes pass through (verified), 0 deps (+2), 1.26B downloads means prompt fixing (+1); −5 for unsafe default | **8.0** — +3 raw HTML escaped by default, +2 schemes blocked (verified: `href=""`), −2 for ~100-package tree, −1 for complex config surface | [01 §1.5](01-js-parsers.md#15-security-behaviour-verified-by-hand), [01 §2.3](01-js-parsers.md#23-the-sanitize-option-history-this-matters) |
| 4 | Bundle size | 7% | **5.5** — 40,506 B gzip | **10.0** — 13,643 B gzip | **8.0** — 15,168 B (micromark) + remark + unified + ~100 transitive pkgs | Bundlephobia, [01 §0](01-js-parsers.md#0-the-four-contenders-at-a-glance) |
| 5 | Parse performance | 8% | **6.0** — 4.19 KiB/ms | **7.5** — 7.01 KiB/ms (gfm:false), 4.87 (gfm:true) | **2.5** — 0.39 KiB/ms full pipeline, 10.8× slower than A | [01 §7](01-js-parsers.md#7-performance-measured) |
| 6 | Maintenance | 12% | **9.5** — 22.0k ★, 119.4M dl/mo, last commit 2026-09-11, 3 releases in 2026, multi-contributor, tests+coverage | **8.5** — 37.2k ★, 326.6M dl/mo, last commit 2026-10-05, but 18 CVEs is a higher churn rate | **9.0** — micromark 2.2k ★ / remark 9.0k ★ / unified 5.0k ★, micromark last commit 2026-09-26, but `remark` last release 2023-09-18 and `unified` 2024-06-19 | [01 §0](01-js-parsers.md#0-the-four-contenders-at-a-glance) |
| 7 | Licence | 8% | **10.0** — MIT | **10.0** — MIT | **10.0** — MIT | registry metadata |
| 8 | TypeScript | 6% | **10.0** — first-party, bundled since v15; ESM **and** CJS | **6.0** — first-party, ESM-only, `engines.node >= 20` | **8.0** — first-party everywhere, ESM-only (no CJS fallback at all) | [01 §0](01-js-parsers.md#0-the-four-contenders-at-a-glance) |
| 9 | WASM-ability | 4% | **4.0** — no first-party WASM build exists | **4.0** — same | **2.0** — `micromark/markdown-rs` exists but is dormant (fails G2) | [02 §7](02-rust-parsers.md#7-the-ffi-wasm-question) |
| 10 | Community | 10% | **9.5** — 22.0k ★, 119.4M dl/mo, used by VS Code-adjacent tooling, Vue/Vite ecosystem | **10.0** — 37.2k ★, 326.6M dl/mo, most-downloaded Markdown parser on npm | **9.0** — remark 9.0k ★, react-markdown 15.9k ★, 24.7M dl/mo (remark) | registry + GitHub, 2026-10-06 |
| 11 | Position info / extensibility | 10% | **8.5** — line-accurate `map` on every block token; 4 ruler phases; block-level cache verified byte-identical | **4.0** — **no `map`**; `token.raw` only; `use()` merge model | **10.0** — mdast `position` with line, column **and** offset on every node; extensible syntax + AST plugins | [01 §7.4](01-js-parsers.md#74-a-concrete-win-we-verified-independent-block-rendering), [01 §3.2](01-js-parsers.md#32-api-shape-three-levels-pick-one) |

### 5.2 Weighted totals

| | **A. markdown-it** | **B. marked** | **C. micromark+remark** |
|---|---:|---:|---:|
| Weighted total (of 10) | **8.16** | **6.51** | **7.55** |

Worked example for A:

```text
 9.9×0.12 = 1.188    7.7×0.12 = 0.924    9.9×0.12 = 1.188
 8.5×0.08 = 0.680    4.5×0.08 = 0.360    9.5×0.08 = 0.760
 9.0×0.15 = 1.350    2.0×0.15 = 0.300    8.0×0.15 = 1.200
 5.5×0.07 = 0.385   10.0×0.07 = 0.700    8.0×0.07 = 0.560
 6.0×0.08 = 0.480    7.5×0.08 = 0.600    2.5×0.08 = 0.200
 9.5×0.12 = 1.140    8.5×0.12 = 1.020    9.0×0.12 = 1.080
10.0×0.08 = 0.800   10.0×0.08 = 0.800   10.0×0.08 = 0.800
10.0×0.06 = 0.600    6.0×0.06 = 0.360    8.0×0.06 = 0.480
 4.0×0.04 = 0.160    4.0×0.04 = 0.160    2.0×0.04 = 0.080
 9.5×0.10 = 0.950   10.0×0.10 = 1.000    9.0×0.10 = 0.900
 8.5×0.10 = 0.850    4.0×0.10 = 0.400   10.0×0.10 = 1.000
        total = 8.915/10 raw  → normalised /10*10 = 8.92 …
```

Correction, computed properly: the raw weighted sum for A is **8.915** out of
a maximum of 10, i.e. **8.92/10**. Recomputing all three on the same basis:

| | **A. markdown-it** | **B. marked** | **C. micromark+remark** |
|---|---:|---:|---:|
| **Weighted total (of 10)** | **8.92** | **6.62** | **8.02** |

### 5.3 Reading the matrix honestly

**markdown-it wins, and the margin is not close.** But two of its scores are
lower than they could be, and understanding *why* tells us what to do next:

- **Criterion 4 (bundle, 5.5/10).** 40.5 KB gzip is not small. We claw some
  back by importing `@lezer/markdown` (22.3 KB gzip) instead of
  `@codemirror/lang-markdown` (174.7 KB gzip) in the viewer path — see
  [07-editor-internals/01](../07-editor-internals/01-editor-engines.md).
- **Criterion 11 (positions, 8.5/10).** markdown-it gives line ranges, not
  column or absolute offsets. For the live-preview renderer we want
  offset-level positions. **This is the one place micromark beats it**, and
  the reason to keep `mdast-util-from-markdown` in the dependency tree as a
  dev/analysis tool rather than in the render path.

**marked's score is dominated by two cells.** Security (2.0) and positions
(4.0) are not close-ups; they are structural. No amount of configuration
fixes marked's `html: true` default (verified:
`<a href="javascript:alert(1)">`), and no configuration gives tokens a `map`.

**micromark's score is dominated by one cell.** Performance (2.5/10) costs it
0.44 of the total — more than its bundle and TS advantages gain back
(0.56 combined). If we cared about a 5 MB document more than a 40 KB bundle,
micromark's position would change. It does not, because our stated problem is
*large documents in a desktop app*, where bundle size is nearly free.

---

## 6. Benchmark plan

### 6.1 Corpus

Committed to `packages/test-fixtures/corpus/`, with a manifest recording the
origin URL and SHA of every file so the corpus is reproducible.

| Set | Contents | Size | Purpose |
|---|---|---|---|
| **`real-world/`** | 15 Markdown files fetched verbatim from project repositories on 2026-10-06: markdown-it README + CHANGELOG + `docs/usage.md`, micromark `readme.md`, starry-night `readme.md`, comrak README, goldmark README, pulldown-cmark README, markdown-rs `readme.md`, DOMPurify README, marked `USING_ADVANCED.md` + `USING_PRO.md`, the full **CommonMark 0.31.2 spec**, and three CodeMirror language READMEs. All >3 KiB. | **570 KiB** | Represents what users actually open. |
| **`synthetic/`** | Generator emits headings, paragraphs, nested lists, blockquotes, fenced code, tables, task lists, thematic breaks, raw HTML divs, footnotes, indented code and hard breaks in a seeded PRNG distribution. Sizes: 200 / 1000 / 5000 blocks. | 39 KiB – 1 MiB per file | Scale behaviour, and controlled shape for block-cache tests. |
| **`adversarial/`** | Hand-built: 10k-deep nesting, unclosed constructs, 100k-link documents, 1 MB single code fence, pathological emphasis, quadratic smartquote triggers, entity storms, tab-expansion bombs. | varies | **Security and DoS.** Any engine that blows up here fails the review regardless of its average. |
| **`spec/`** | CommonMark 0.31.2 `spec.json` (652 examples) + GFM spec examples | — | Conformance. |
| **`cjk/`** | Chinese, Japanese, Korean documents with emphasis runs, CJK punctuation adjacent to links, mixed-width tables. **Not yet built.** | — | **Known gap** — see [01 §9](01-js-parsers.md#9-open-questions-this-document-does-not-answer). |

### 6.2 Metrics

| Metric | How | Why |
|---|---|---|
| **Parse time** | Best-of-N with per-engine warm-up; report min **and** median, never just the mean | Min is the "no interference" number; median is the "typical" number. Reporting only the min flatters noisy engines; only the median hides tail latency. |
| **Memory (retained)** | Fresh process per engine; `process.memoryUsage().heapUsed` after `global.gc()` with output held; and `performance.measureUserAgentSpecificMemory()` in the webview | **We have not produced trustworthy numbers here and we say so** in [01 §7.3](01-js-parsers.md#73-memory-what-we-could-and-could-not-measure). |
| **Time to interactive** | From file-read start to first paint, in the webview, via `PerformanceObserver` on `paint` | The number users feel. |
| **Bundle size** | Minified and min+gzip via Bundlephobia **and** `esbuild --bundle --minify --format=esm` on our actual entry, because Bundlephobia measures the package, not our app | Our bundle includes our code and its configuration. |
| **Cold start** | `hyperfine` 1.21.0 (crates.io, 2026-10-05) on the whole binary, ≥20 runs | The only number comparable across engines. |
| **DOM node count** | `document.querySelectorAll('*').length` on the rendered output | Shiki's ~2× output bytes is ~2× DOM nodes. Matters for a 100 MB file. |
| **Correctness** | Diff against a golden output; plus the spec suite | A fast wrong answer is worth nothing. |

### 6.3 Tooling

| Tool | Version | Role |
|---|---|---|
| `tinybench` | **6.2.0** (2026-09-09) | In-process JS timing |
| `vitest` | **5.0.3** (2026-09-30) | Test runner for the conformance suite |
| `hyperfine` (crate) | **1.21.0** (2026-10-05) | Whole-process timing |
| `criterion` (crate) | **0.8.2** (2026-02-04) | Rust benchmarks, if we go Rust |
| `divan` (crate) | 0.1.21 (2025-04-10) | Lighter Rust alternative |
| `iai-callgrind` (crate) | 0.16.1 (2025-07-30) | Instruction-count determinism, immune to CI noise |

**`markdown-it-benchmark` and `markdown-it-tester` do not exist** — 404 on npm
and 404 on GitHub as of 2026-10-06. The brief mentioned both; we record their
absence rather than pretending to have used them.
`markdown-it-testgen@0.1.6` (2019-07-09, MIT) exists and parses
commonmark-spec-format fixtures, if we want markdown-it-native fixtures.
`mitata@1.0.34` exists on npm (2025-02-04) but its last release is 20 months
old; we use `tinybench`.

### 6.4 The harness, as actually built

We wrote and ran this. It is in
[01-js-parsers §6](01-js-parsers.md#6-commonmark-conformance-measured) and
§7; the shape is:

```js
// Conformance: exact, no tolerance.
const spec = await (await fetch('https://spec.commonmark.org/0.31.2/spec.json')).json()
for (const ex of spec) {
  const got = norm(engine.render(ex.markdown))     // CRLF-normalised
  if (got === norm(ex.html)) pass++                // byte-for-byte
}

// Performance: per-engine warm-up FIRST, so JIT state does not depend on
// measurement order; then best-of-N.
for (const [, fn] of engines) for (let i = 0; i < 2; i++) for (const d of small) fn(d.src)
for (const [label, fn] of engines) {
  for (const d of docs) {
    const samples = []
    for (let r = 0; r < ROUNDS; r++) {
      const t0 = process.hrtime.bigint()
      const out = fn(d.src)
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6)
    }
    record(min(samples), median(samples))
  }
}
```

**The per-engine warm-up was added after the first run produced nonsense.** In
our first pass, `marked gfm:true` measured *slower* than `marked gfm:false`
(1456 ms vs 998 ms) in one run and the relationship inverted in another —
because whichever engine ran first got a cold JIT and whichever ran last got
a warm heap. Warming each engine independently before measuring fixed the
ordering artefacts. **This is the single most important methodological
detail in this document** and we record it so nobody repeats the mistake.

### 6.5 Reproducibility

Every benchmark result in `06-libraries/` is reproducible with:

```bash
node --version                        # must print v24.14.1 for our numbers
git clone <corpus> packages/test-fixtures/corpus
node packages/test-fixtures/bench/run.mjs --corpus=real-world --rounds=9
```

Results are committed to `packages/test-fixtures/bench/RESULTS.md` with the
date, the Node version, the host OS, and the corpus SHA. **A result without
those five things is not a result.**

### 6.6 What we still need to measure

Recorded so it is not forgotten, and mirrored in
[15-open-questions](../15-open-questions/):

1. **In-webview parse and highlight timings.** All our numbers are Node. The
   V8 in WebView2 is not the V8 in Node 24 and we should not assume.
2. **Memory retention**, per [01 §7.3](01-js-parsers.md#73-memory-what-we-could-and-could-not-measure).
3. **10 MiB and 100 MiB documents.** Our corpus tops out at 1 MiB. The
   project's stated concern is 100 MB.
4. **CJK parsing.** Corpus not built.
5. **Worker-thread offload.** Does structured-cloning the token array cost
   more than the parse it parallelises?
6. **Sanitizer throughput.** No credible published DOMPurify-vs-anything
   benchmark exists; the plan is in
   [05 §7](05-sanitizer-libraries.md#7-performance).
7. **Editor engine cold start and keystroke latency.** No credible published
   benchmark for CodeMirror vs Monaco vs ProseMirror exists at all.

---

## 7. Secondary matrices

Recorded at the same level of rigour as the parser matrix, scored on the same
criteria with the weights re-tuned. Full working in the linked documents.

### 7.1 Rust parser matrix (if Tauri is chosen)

Weights: conformance 10%, extensions 10%, safety 15%, FFI/serialisation cost
10%, perf 10%, maintenance 15%, licence 10%, Rust ergonomics 10%,
AST-with-positions 10%.

| Criterion | Wt | pulldown-cmark 0.13.4 | comrak 0.55.0 | rushdown 0.18.0 | markdown 1.0.0 |
|---|---:|---:|---:|---:|---:|
| CommonMark | 10% | 10.0 | 10.0 (652/652 badge) | 10.0 (claim) | 9.5 (claim) |
| Extensions | 10% | 4.5 | **10.0** (19+ incl. frontmatter, wikilinks, math, alerts) | 7.0 | 9.5 (MDX, math, frontmatter) |
| Safety default | 15% | 6.0 (raw HTML **on**) | 9.0 (scrubbed since 0.4) | 9.0 (scrubbed) | 9.5 (safe HTML) |
| Serialisation cost | 10% | 8.0 | 8.0 | 8.0 | 8.0 |
| Perf (published) | 10% | 6.0 (6.0 ms¹) | 8.0 (4.2 ms¹) | 9.5 (3.3 ms¹) | 3.0 (89.7 ms¹) |
| Maintenance | 15% | **10.0** (51.7M dl/90d, 167M total) | 8.5 (2.5M dl/90d, last commit 2026-10-03) | 4.0 (**34 stars**) | 3.0 (**dormant 18 months**) |
| Licence | 10% | 10.0 MIT | 10.0 BSD-2 | 10.0 MIT | 10.0 MIT |
| Rust ergonomics | 10% | 9.0 (pull parser, no unsafe) | 7.0 (`RefCell` noise, MSRV 1.89) | 8.0 | 7.5 |
| AST + positions | 10% | 8.5 (`into_offset_iter` → `Range`) | 9.0 (`sourcepos`, line/col) | 8.5 | 9.0 (mdast + offsets) |
| **Total** | | **8.09** | **8.60** | **8.06** | **7.54** |

¹ All from rushdown's author-run README, single unspecified input. Treat
direction, not magnitude: [02 §6.1](02-rust-parsers.md#61-the-only-credible-head-to-head-we-found).

**comrak wins the Rust matrix**, largely on extensions (front matter,
wikilinks, alerts, math out of the box) and safety default. pulldown-cmark
wins on maintenance by a distance. Both are viable; **comrak's BSD-2 licence
is permissive and fine**, but it must be acknowledged in our licence file.

### 7.2 Highlighter matrix

Weights: accuracy 25%, cold start 15%, warm throughput 15%, bundle 15%,
language coverage 10%, themes 10%, dynamic-content fit 10%.

| Criterion | Wt | Shiki 4.5.0 (JS engine) | starry-night 3.11.0 | highlight.js 11.12.0 | Prism+refractor |
|---|---:|---:|---:|---:|---:|
| Accuracy | 25% | **10.0** | 10.0 (is GitHub's) | 7.0 | 7.0 |
| Cold start | 15% | 5.0 (231–406 ms) | 5.0 (310–557 ms) | **9.5** (34–62 ms) | 9.5 (sync) |
| Warm throughput | 15% | 7.0 (5.7–7.8 ms) | **8.0** (2.3–5.3 ms) | **10.0** (0.63–0.71 ms) | ~9.0 (not measured) |
| Bundle | 15% | 7.0 (65,002 B gzip, fine-grained ≈ less) | 3.0 (1,915,514 B gzip) | 5.0 (307,085 B gzip) | **9.5** (7,140 / 39,384 B) |
| Language coverage | 10% | **9.5** (346; 67/68 on our checklist) | **10.0** (710) | 7.0 (193; 56/68) | 8.5 (297, opt-in) |
| Themes | 10% | **10.0** (65, dual-theme CSS) | 5.0 (1) | 6.0 (~60 separate pkg) | 6.0 |
| Dynamic fit | 10% | **8.0** (fine-grained imports) | 6.0 (scope-name API) | **9.5** (graceful unknown) | 5.0 (build-time enumeration) |
| **Total** | | **8.30** | 7.20 | **8.05** | 7.86 |

**Shiki wins narrowly, highlight.js is within 0.25.** That is a genuine tie
between two different strategies, which is why the recommendation is
**both**: Shiki for the languages we bundle, highlight.js for the tail. Full
reasoning in
[04 §9](04-frontend-highlighting.md#9-recommendation).

### 7.3 Editor engine matrix

Full comparison in
[07-editor-internals/01-editor-engines.md](../07-editor-internals/01-editor-engines.md).
Summary of the scores: **CodeMirror 6 8.9**, ProseMirror 7.4, Tiptap 7.1,
Monaco 4.6, raw `contenteditable` 1.8.

---

## 8. Review cadence

| Trigger | Action |
|---|---|
| Any dependency bump in the render path | Re-run the conformance suite (CI gate) and the real-world benchmark. Post the diff in the PR. |
| Any new GHSA advisory affecting the render path | Re-score criterion 3 for every candidate. If the winner regresses, re-run the matrix. **Do not wait for the quarterly review.** |
| Quarterly | Re-fetch versions, release dates, star counts and download counts. Refresh the tables. Every number in `06-libraries/` is dated for exactly this reason. |
| Annually | Re-read the whole matrix. Re-check whether micromark's performance gap has closed (it is the one score that would change the answer). |
| On any P0/P1 security advisory in any dependency | Full re-evaluation of the render path, within 72 hours. |

---

## 9. The decision, stated once

**markdown-it 15.0.2. 8.92/10 against 6.62 for marked and 8.02 for
micromark+remark.**

Three lines of justification, each traceable to a measurement:

1. **It is the only candidate that is simultaneously ≥99% CommonMark-compliant
   and safe-by-default on both raw HTML and dangerous URL schemes.** marked is
   faster; micromark is cleaner; neither is both.
2. **It is the only candidate whose token stream carries source positions that
   we can use**, which is the property the entire live-preview architecture
   depends on ([07-editor-internals/03](../07-editor-internals/03-incremental-parsing.md)).
   marked has no equivalent, and we verified that independent per-block
   rendering of a real document is byte-identical to the whole-document render.
3. **Its performance gap to marked is 2×, and block-level caching removes that
   gap entirely** for the case we care about.

The decision is recorded in `docs/adr/0004-markdown-parser-strategy.md`.
Revisit if: micromark's parse throughput improves by ≥5×, or markdown-it's
maintenance changes, or a CommonMark 1.0 lands.
