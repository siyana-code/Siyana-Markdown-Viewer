# 06 — Libraries

> This folder answers one question with evidence: **which Markdown parser,
> which highlighter, which sanitizer, and which front-matter reader do we
> build on?** Every version number, release date, licence and byte count in
> these documents was fetched from a primary source (npm registry API,
> crates.io API, unpkg, GitHub, OSV) rather than recalled. Where a number is
> ours rather than a project's, it says so and it is reproducible with the
> harness described in [07-evaluation-framework](07-evaluation-framework.md).

Verified on: **2026-10-06**. Node **v24.14.1**, npm **11.11.0**.
No Rust toolchain was available on the machine used for these measurements,
which is why [02-rust-parsers](02-rust-parsers.md) relies on published
benchmarks and API docs rather than locally reproduced Rust numbers.

---

## The evaluation criteria

We score every candidate against the same eleven criteria. The weights below
are the ones used in the weighted decision matrix in
[07-evaluation-framework §5](07-evaluation-framework.md#5-weighted-decision-matrix).

| # | Criterion | Weight | What "good" means, concretely |
|---|-----------|--------:|-------------------------------|
| 1 | **CommonMark conformance** | 12% | Measured, not claimed. We ran all 652 examples of the CommonMark **0.31.2** `spec.json` against every JS candidate. See [01-js-parsers §6](01-js-parsers.md#6-commonmark-conformance-measured). |
| 2 | **GFM / extension coverage** | 8% | Tables, task lists, strikethrough, autolink literals, tagfilter, footnotes, definition lists, math, front matter, wikilinks. Extensions we need are cheaper than extensions we have to build. |
| 3 | **Security posture** | 15% | Safe-by-default on raw HTML and dangerous URL schemes, plus a *maintained* advisory history rather than a single ancient CVE. Highest weight because a viewer parses hostile files by definition. |
| 4 | **Bundle size** | 7% | Minified + gzipped, measured via the Bundlephobia API on the exact pinned version. Counted against our web target first, desktop second (the desktop webview pays it in RAM and cold start). |
| 5 | **Parse performance** | 8% | Measured on a real-world corpus of 15 real Markdown documents (570 KiB) plus a synthetic stress corpus. Best-of-9 with per-engine warm-up. |
| 6 | **Maintenance activity** | 12% | Last commit date, release cadence, open-issue count, whether a single maintainer is the only bus. Verified per repository. |
| 7 | **Licence** | 8% | Must be MIT / BSD / Apache-2.0 / ISC — permissive, no copyleft, no field-of-use restrictions. GPL and AGPL are disqualified outright. |
| 8 | **TypeScript support** | 6% | First-party `.d.ts`, ESM with `"exports"`, no `@types/*` shim. |
| 9 | **WASM-ability** | 4% | Can the same parser run in Node (desktop), the browser webview, and a WASM sandbox without three implementations? |
| 10 | **Community** | 10% | GitHub stars (approximate, dated), monthly npm downloads, and — more important — whether real products depend on it. |
| 11 | **Position info / extensibility** | 10% | Does the API expose source positions (`token.map`, mdast `position`, `Point`, `sourcepos`)? Without them, inline WYSIWYG and scroll sync are guesses. See [07-editor-internals/03](../07-editor-internals/03-incremental-parsing.md). |

Weights sum to 100%. Criterion 3 and 6 together carry 27% because a parser
that is both unsafe and abandoned is not a parser, it is a liability.

---

## The documents

| Doc | Covers | Read it when you need |
|-----|--------|----------------------|
| [01-js-parsers.md](01-js-parsers.md) | markdown-it 15, marked 18, micromark 4 / remark 15 / unified 11, commonmark 0.31, plus showdown, snarkdown, YAML/TOML front matter libs | You are choosing the renderer |
| [02-rust-parsers.md](02-rust-parsers.md) | pulldown-cmark 0.13, comrak 0.55, goldmark/rushdown, markdown-rs 1.0, ammonia 4.2, and the WASM/FFI question | Tauri is on the table and you are checking whether Rust buys us anything |
| [03-other-ecosystems.md](03-other-ecosystems.md) | Python, Go, Dart, C, Java/Kotlin, Rust-WASM — for *compatibility* reasoning, not for direct use | A user opens a file and asks "why does it look different from Pandoc?" |
| [04-frontend-highlighting.md](04-frontend-highlighting.md) | Shiki 4.5, `@wooorm/starry-night` 3.11, highlight.js 11.12, Prism 1.30, refractor 5.0 | You are picking how to colour code blocks in arbitrary user documents |
| [05-sanitizer-libraries.md](05-sanitizer-libraries.md) | DOMPurify 3.4.16, sanitize-html 2.18, `hast-util-sanitize` 5.0.2, `@braintree/sanitize-url` 7.1.2, insane, ammonia | You are designing the XSS boundary — start here |
| [06-front-matter.md](06-front-matter.md) | Detection heuristics, the `---` collision with setext and thematic breaks, Jekyll/Hugo/Obsidian/Pandoc variants, what a viewer should *do* with it | You are writing the "open a file" path |
| [07-evaluation-framework.md](07-evaluation-framework.md) | The rubric, the weighted matrix, our three leading candidates scored, and a reproducible benchmark plan with the harness we actually used | You are about to make the decision and want to check our reasoning |

---

## Headline verdict (short form)

The long form, with evidence, is in the documents. The short form:

- **Parser: `markdown-it` 15.0.2.** 99.5% CommonMark (measured, 649/652),
  safe-by-default on both raw HTML and dangerous URL schemes, token stream
  with line-accurate `map` on every block token, the deepest extension
  ecosystem of any JS parser, actively maintained (last commit 2026-09-11,
  three releases in 2026), MIT, first-party TypeScript types bundled since
  v15, dual ESM/CJS, 119M monthly downloads.
- **Editor engine: CodeMirror 6** (`@codemirror/state` 6.7.6 +
  `@codemirror/view` 6.43.13 + `@codemirror/lang-markdown` 6.5.2), with
  `@lezer/markdown` 1.7.2 giving us a real incremental parser with byte
  offsets for free. Detailed reasoning in
  [07-editor-internals/01](../07-editor-internals/01-editor-engines.md).
- **Highlighter: Shiki 4.5.0 with the JavaScript RegExp engine** for the
  desktop path, `@wooorm/starry-night` 3.11.0 as the WASM-backed fallback.
  Justification and the measured cold/warm numbers are in
  [04](04-frontend-highlighting.md).
- **Sanitizer: DOMPurify 3.4.16 as the *last* step, always.** Never trust
  `html: true` output. The advisory history is long and ugly; see
  [05](05-sanitizer-libraries.md) for the specific 2026 cluster and what it
  means for our configuration.

We did **not** choose micromark/remark despite it being the most extensible
and the only one with 100%-class conformance out of the box. The reason is
performance: on our 570 KiB real-world corpus, the full
`remark-parse → remark-rehype → rehype-stringify` pipeline was **4.6× slower
than commonmark.js and 10.8× slower than marked** in the same process, same
machine, same files. For a viewer that must open a 100 MB file, that is not
a trade we can make. The full numbers and methodology are in
[01-js-parsers §7](01-js-parsers.md#7-performance-measured).

---

## Ground rules for this folder

1. **Cite the source inline.** Every version, date and byte count carries a
   note on where it came from. If it came from `registry.npmjs.org`,
   say so. If it is our own measurement, say so *and* say how to reproduce it.
2. **Never invent a benchmark.** Where no credible published number exists we
   write *"no credible published benchmark found"* and describe the
   measurement instead. We did this for Monaco, ProseMirror and every
   editor engine.
3. **Distinguish claim from evidence.** If a project says "100% CommonMark"
   in its README, we record that as a *claim* and then run the suite
   ourselves. Both markdown-it and micromark pass ≥99.4% when configured for
   it; the third project in the running (marked) passes 77%, and its README
   does not claim otherwise.
4. **Record the negative results.** `markdown-it-tester` and
   `markdown-it-benchmark` are cited in older Markdown tutorials. Both return
   **404 on npm and 404 on GitHub** as of 2026-10-06. We note them as absent
   rather than quietly dropping them, because the assignment brief mentioned
   them and someone will otherwise go looking.
