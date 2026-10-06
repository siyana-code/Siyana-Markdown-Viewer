# 02 — Rust Markdown parsers

**When does Rust earn its place?** Only if we ship Tauri (or another Rust
shell) *and* either (a) parse on a background thread where a 5× slowdown is
invisible because the UI thread is free, or (b) need memory guarantees or
speed that JS cannot reach. This document establishes what is available and
what it would cost.

**Verification caveat, stated up front:** the machine used for this research
had **no Rust toolchain** (`cargo` and `rustc` both absent — verified).
Therefore every version, date and download count below is from
`crates.io/api/v1/crates/<name>` and GitHub (both fetched), and every
performance claim is either **a number published by the crate author with its
source quoted**, or an explicit statement that **no credible published
benchmark was found**. We have not reproduced any of these locally, and we
say which is which.

Verified 2026-10-06.

---

## 1. Landscape at a glance

| | pulldown-cmark | comrak | goldmark (**Go**) | rushdown (**Rust**) | markdown-rs |
|---|---|---|---|---|---|
| Crate / module | `pulldown-cmark` **0.13.4** | `comrak` **0.55.0** | `github.com/yuin/goldmark` **v1.8.6** | `rushdown` **0.18.0** | `markdown` **1.0.0** |
| Released | 2026-05-20 | 2026-09-06 | 2026-09-03 | 2026-04-30 | **2025-04-23** |
| Licence | **MIT** | **BSD-2-Clause** | MIT | MIT | MIT |
| MSRV | 1.71.1 | **1.89** | n/a | 1.87 | 1.56 |
| Stars (2026-10-06) | 2,734 | 1,717 | 5,055 | 34 | 1,579 |
| Total downloads | 167,489,232 | 8,495,025 | n/a (Go) | 11,193 | 11,334,958 |
| Downloads / 90 days | **51,657,977** | 2,525,213 | n/a | 8,187 | 3,703,529 |
| Architecture | **pull parser** (iterator of events) | arena AST | slice AST with segments | slice AST | state machine → tokens → AST |
| Source positions | `into_offset_iter()` → `(Event, Range)` | `node.sourcepos` | `node.Segment` + `Lines` | segment tree | token `point` + mdast `position` |
| CommonMark | 100% target, fully compliant | **652/652 + GFM 670/670** (badges) | 0.31.2 compliant | 0.31.2 + GFM | claims 100%, 2300+ tests |
| GFM | tables, tasklists, strikethrough, footnotes, `==mark==` | 4 of 5 + tagfilter deprecated in 0.55 | tables, strikethrough, tasklists, deflists | yes (no tagfilter) | 100% GFM + MDX + math + frontmatter |
| Extra extensions | — | **19+**: frontmatter, footnotes, wikilinks, description lists, math, emoji, alerts, spoiler, underline, greentext, CJK emphasis | linkify, typographer, footnotes, deflists, sub/sup, mark, passthrough | — | MDX, math, frontmatter |
| Raw HTML default | **allowed** | **scrubbed since 0.4.0** (opt in via `r#unsafe`) | allowed | **not rendered** | safe by default |

> **A correction to the brief, and it matters.** `goldmark` is **a Go
> library**, not a Rust one. `yuin/goldmark` v1.8.6 is `github.com/yuin/goldmark`
> and Hugo's own `go.mod` on `master` pins `github.com/yuin/goldmark v1.8.6` —
> Hugo is the proof. The **Rust** library by the same author is **`rushdown`**,
> whose README says: *"I wanted something like goldmark written in Rust.
> However, no existing library satisfied these requirements."* At **34 stars**
> and 8,187 downloads/90 days, rushdown is not something we can build a product
> on. It is on this page because the author has published a head-to-head
> benchmark against every other Rust parser, and that benchmark is the best
> Rust data we have (see §6).

---

## 2. pulldown-cmark

### 2.1 What it is

A **pull parser** for CommonMark. Its README's argument for that architecture
is worth quoting because it explains the API:

> Pull parsing … has become popular for XML, especially for memory-conscious
> applications, because it uses dramatically less memory than constructing a
> document tree, but is much easier to use than push parsers.

And:

> Another advantage is that source-map information (the mapping between
> parsed blocks and offsets within the source text) is readily available; you
> can call `into_offset_iter()` to create an iterator that yields
> `(Event, Range)` pairs.

### 2.2 API

```rust
use pulldown_cmark::{Parser, Options, Event, html::push_html};

let mut options = Options::empty();
options.insert(Options::ENABLE_TABLES);
options.insert(Options::ENABLE_FOOTNOTES);
options.insert(Options::ENABLE_TASKLISTS);
options.insert(Options::ENABLE_STRIKETHROUGH);

let parser = Parser::new_ext(markdown_input, options);

let mut html_output = String::new();
push_html(&mut html_output, parser);
```

Transformations are `.map()` over the event stream, which is genuinely
ergonomic:

```rust
// soft break -> hard break
let parser = parser.map(|event| match event {
    Event::SoftBreak => Event::HardBreak,
    _ => event
});

// abbreviations
let parser = parser.map(|event| match event {
    Event::Text(text) => Event::Text(text.replace("abbr", "abbreviation").into()),
    _ => event
});

// max nesting depth, streaming, O(1) memory
let mut max_nesting = 0; let mut level = 0;
for event in parser {
    match event {
        Event::Start(_) => { level += 1; max_nesting = max_nesting.max(level) }
        Event::End(_) => level -= 1,
        _ => ()
    }
}
```

`TextMergeStream::new(parser)` exists to smooth over the fact that
consecutive `Text` events can occur because of how the parser evaluates the
source — a real ergonomic wart worth knowing about.

**Position mapping, which we need:**

```rust
for (event, range) in parser.into_offset_iter() {
    // range: Range<usize> into the ORIGINAL source
}
```

This is exactly the API shape our block-cache and scroll-sync work needs, and
it is *better* than markdown-it's (`Range` is a byte offset, not a line
index, so no line-number search is required).

### 2.3 Assessment

**167 million total downloads, 51.7 million in the last 90 days** — by far the
most-used Rust Markdown parser in existence. `pulldown-cmark-escape` alone has
12.5M downloads/90 days. It is used as a library dependency across the Rust
ecosystem, which is the strongest maintenance signal available.

Limitations:

- **No plugin system.** You cannot add syntax from outside the crate. It is
  CommonMark + a fixed GFM subset + `==mark==`. If we need `attrs`,
  `container`, `math` or `==wikilink==`, we fork or preprocess.
- **Raw HTML is emitted by default.** `Event::Html`/`Event::InlineHtml` come
  straight through. For a viewer this means the Rust side cannot be our
  security boundary without adding `ammonia`.
- The CHANGELOG shows real churn: 0.13.2 (2026-03-21), 0.13.3 (2026-03-22),
  0.13.4 (2026-05-20) — three releases in two months, i.e. actively worked
  on. Last repo commit 2026-09-30.

**Verdict: if we go Rust, pulldown-cmark is the default.** Zero-`unsafe`
(the only `unsafe` is behind the opt-in `simd` feature), tiny, fast,
source-mapped, and de-facto. Its lack of an extension API is the real cost.

---

## 3. comrak

### 3.1 What it is

"A 100% CommonMark-compatible GitHub Flavored Markdown parser and
formatter". Its README carries hard evidence badges:

```
CommonMark: 652/652   (pinned to commonmark-spec commit 9103e34)
GFM:        670/670   (pinned to cmark-gfm test/spec.txt commit 2f13eee)
```

It is the **GitLab Markdown parser** — that is the field-proven claim worth
noting, and it is the reason GitLab chose it.

### 3.2 API — and the arena trick

The one-shot path:

```rust
use comrak::{markdown_to_html, Options};

assert_eq!(
    markdown_to_html("¡Olá, **世界**!", &Options::default()),
    "<p>¡Olá, <strong>世界</strong>!</p>\n"
);
```

The AST path, which is where the design gets interesting. Nodes are allocated
in a caller-supplied `Arena` and are **bound by its lifetime** — no `Rc`,
no `Box`, one allocation strategy for the whole document:

```rust
use comrak::nodes::NodeValue;
use comrak::{format_html, parse_document, Arena, Options};

fn replace_text(document: &str, orig: &str, replacement: &str) -> String {
    let arena = Arena::new();
    let root = parse_document(&arena, document, &Options::default());

    for node in root.descendants() {
        if let NodeValue::Text(ref mut text) = node.data_mut().value {
            *text = text.to_mut().replace(orig, replacement).into()
        }
    }

    let mut html = String::new();
    format_html(root, &Options::default(), &mut html).unwrap();
    html
}
```

```rust
// Node types we would care about for source mapping:
use comrak::nodes::{AstNode, NodeValue, Sourcepos};
let node: &AstNode = root.first_child().unwrap();
let sp: &Sourcepos = node.data.borrow().sourcepos;
// sp.start.line, sp.start.column, sp.end.line, sp.end.column
```

`node.data.borrow()` is a `RefCell` borrow — the arena makes nodes cheap but
you pay for it at every access. And **MSRV 1.89** is high; that constrains
which Rust toolchains can build us.

### 3.3 Security — comrak got this right

From its README:

> As with `cmark` and `cmark-gfm`, Comrak will scrub raw HTML and potentially
> dangerous links. This change was introduced in Comrak 0.4.0 in support of a
> safe-by-default posture, **and later adopted by our contemporaries.**

So comrak **defaults to stripping raw HTML and dangerous links**, and you opt
in with `options.r#unsafe = true`. From a security-baseline perspective
comrak is the best-behaved Rust parser out of the box.

Note this *changes* our security model if we pick it: output from comrak is
already sanitised-ish, which tempts you to skip a second sanitizer. **Do not
skip it.** Two independent layers is the whole point; see
[05-sanitizer-libraries](05-sanitizer-libraries.md).

### 3.4 Extensions — the best in Rust

Comrak supports four of GFM's five extensions (tables, task lists,
strikethrough, autolinks) and **deprecated tagfilter in 0.55.0, removing it in
0.56.0** with the reasoning that it is "poorly designed, specific to GitHub's
CommonMark transition of 2017, and should not be used". That is a maintainer
making a defensible standards call rather than a compat shim.

Beyond that, comrak ships its own extensions, none enabled by default:

> Superscript, Header IDs, Footnotes, Inline footnotes, Description lists,
> Front matter, Multi-line blockquotes, Math, Emoji shortcodes, **Wikilinks**,
> Underline, Spoiler text, "Greentext", Alerts, CJK friendly emphasis.

`Wikilinks`, `Front matter`, `Alerts` (GitHub alerts), `Math`, and
`CJK friendly emphasis` are **all four things a Siyana-class note editor
needs and none of which any JS parser gives us for free**. That is a real
argument for comrak on feature grounds alone.

### 3.5 Assessment

Best feature set, best documented compliance, best security default,
arena-based memory behaviour, used in production at GitLab scale. Costs: BSD
(not MIT — permissive, fine, but check the project's own policy), **MSRV
1.89** (the highest of the Rust parsers, which will annoy distro packagers),
`RefCell` borrow noise, 8.5M downloads vs pulldown-cmark's 167M.

**Verdict: the strongest Rust candidate on features.** Its extension
configuration is a plain struct of booleans — no plugin trait, so it is
markdown-it-like in *ergonomics* and pulldown-cmark-like in *rigidity*.

---

## 4. goldmark and rushdown

`goldmark` is Go; it is in this document only because Hugo uses it and
because its Rust sibling published the best available Rust benchmark.

**goldmark v1.8.6** (2026-09-03), MIT, 5,055 stars. Hugo's `go.mod` on `master`
pins `github.com/yuin/goldmark v1.8.6` plus
`hugo-goldmark-extensions/extras v0.7.0`,
`hugo-goldmark-extensions/passthrough v0.5.0`, `yuin/goldmark-emoji v1.0.6`.
goldmark's own performance claim: *"goldmark's performance is on par with
that of cmark, the CommonMark reference implementation written in C."* It is
AST-based and preserves source position of nodes via `Segment` + `Lines`. It
is **not usable from a Rust or JS shell** except through WASM, and Hugo ships a
WASM playground at 5–10 MB (per its README) — too heavy for a desktop app
whose whole point is a small binary.

**rushdown v0.18.0** (2026-04-30), MIT, **34 stars**, 11,193 downloads total.
The author states the motivation precisely: *"I needed a Markdown parser that
met the following requirements: Written in Rust; Compliant with CommonMark;
Fast; Extensible from the outside of the crate; AST-based."* It is the direct
answer to "goldmark, but Rust". It is also 34 stars and, by its own admission,
pre-1.0 with a young API.

Its security default matches comrak's: *"By default, rushdown does not render
raw HTML or potentially-dangerous URLs."*

**Verdict: not adoptable.** If we ever want goldmark's ergonomics in Rust,
rushdown is the name to watch, and we should watch it without depending on it.

---

## 5. markdown-rs — verification result

The brief asked us to verify whether `markdown-rs` exists and what its status
is. It does — with a naming gotcha.

| Fact | Value | Source |
|---|---|---|
| GitHub repo | `wooorm/markdown-rs`, **1,579 stars**, not archived | GitHub |
| **crates.io name** | **`markdown`**, *not* `markdown-rs` | crates.io |
| Latest version | **1.0.0**, published **2025-04-23** | crates.io |
| Licence | MIT (Titus Wormer) | `license` file |
| MSRV | 1.56 | Cargo.toml |
| Downloads | 11.3M total, 3.7M in 90 days | crates.io |
| Last repo commit | **2025-04-23** | commit atom feed |

**There is also a crate literally named `markdown-rs` — it is a different,
abandoned project.** `crates.io/api/v1/crates/markdown-rs` returns version
`0.1.0`, **one version ever**, published 2023-07-02, **14,196 total
downloads**, 693 in 90 days, `repository: null`. Nobody is using it and
nobody is maintaining it. **Anyone who writes `markdown-rs = "1"` in a
Cargo.toml gets the wrong crate.** The correct line is `markdown = "1"`.

Status of the real project: **dormant.** Last release and last commit both
2025-04-23 — roughly 18 months stale as of this writing. 1.0.0 means the API
promised stability; it does not mean it is being worked on.

On quality, the README's claims are specific and checkable:

> implemented as a state machine (`#![no_std]` + `alloc`) that emits concrete
> tokens, so that every byte is accounted for, with positional info.
> While most markdown parsers work towards compliancy with CommonMark (or GFM),
> this project goes further by following how the reference parsers (`cmark`,
> `cmark-gfm`) work, which is confirmed with thousands of extra tests.

Claimed feature checklist, verbatim: 100% CommonMark, 100% GFM / 100% MDX /
frontmatter / math, 100% safe Rust and 100% safe HTML by default, 2300+ tests
with 100% coverage and fuzz testing, mdast AST. **`#![no_std]` + `alloc` is
genuinely unusual and useful** — it means the crate can be used in an
embedded or constrained context, and it constrains the parser to allocation
discipline.

API:

```rust
fn main() {
    println!("{}", markdown::to_html("## Hi, *Saturn*! 🪐"));
}
// <h2>Hi, <em>Saturn</em>! 🪐</h2>

fn main() -> Result<(), markdown::message::Message> {
    println!("{}", markdown::to_html_with_options(
        "* [x] contact ~Mercury~Venus at hi@venus.com!",
        &markdown::Options::gfm()
    )?);
}
// <ul>
//   <li>
//     <input checked="" disabled="" type="checkbox" />
//     contact <del>Mercury</del>Venus at
//     <a href="mailto:hi@venus.com">hi@venus.com</a>!
//   </li>
// </ul>

fn main() -> Result<(), markdown::message::Message> {
    println!("{:?}", markdown::to_mdast("# Hi *Earth*!", &markdown::ParseOptions::default())?);
}
// Root { children: [Heading { children: [Text { value: "Hi ", position:
//   Some(1:3-1:6 (2-5)) }, Emphasis { c...
```

Note the mdast positions: `Some(1:3-1:6 (2-5))` — line:column *and* absolute
offset, the same shape micromark produces. It is the **micromark author's Rust
port by design**: the README says *"This Rust crate has a sibling project in
JavaScript: micromark."*

**Verdict: technically the most interesting crate here, and the wrong one to
depend on.** It is dormant, the crate name is a trap, and 1.0.0 with no
commits for 18 months means security patches will not arrive. If it restarts,
revisit.

---

## 6. Performance: what is actually published

### 6.1 The only credible head-to-head we found

**rushdown's README**, verbatim:

```text
rushdown-cached         time: 3.1845 ms
rushdown                time: 3.3427 ms
markdown-rs             time: 89.692 ms
comrak                  time: 4.2451 ms
pulldown-cmark          time: 6.0037 ms
cmark                   time: 3.6439 ms
goldmark                time: 5.6161 ms
```

**What this is and is not.** It is reproducible: rushdown ships a `bench`
crate and the README says *"You can run this benchmark by `make bench`"*. It
is **author-run, by the author of one of the compared crates**, on one input.
markdown-rs at 89.7 ms versus comrak at 4.2 ms is a **21×** spread that is
almost certainly dominated by markdown-rs's `to_html` building a full mdast
before compiling — an apples-to-oranges comparison (AST-then-render versus
streaming render), not necessarily a 21× parser-speed difference.

**We take one thing from it and one we discard.** Take: markdown-rs is *slow
in this configuration*. Discard: any claim about relative cmark/rushdown/
comrak ordering beyond ~2×, since three of those five are within 1.6× of each
other and the input is unspecified.

### 6.2 What we could not find

- **No credible published benchmark** comparing pulldown-cmark, comrak and
  markdown-rs on a *corpus*, with the input published. Criterion's
  `Markdown Parsing Speed Test` exists as a crate family and comrak has
  Criterion benches in-tree, but we found no shared, versioned, reproducible
  cross-crate numbers.
- **No credible published benchmark** of any Rust parser against
  markdown-it or marked on the same input.
- **No published memory benchmark** comparing arena (comrak) vs arena-free
  (pulldown-cmark events) vs pull-parse for a 10 MiB document.

### 6.3 How we would measure it, if we go Rust

Do **not** trust a Rust-vs-JS comparison across languages; V8's JIT is
extremely good at this workload and a naive cross-language benchmark usually
measures the harness. Instead:

1. **Same corpus.** The 15-file real-world corpus in
   [01-js-parsers §7](01-js-parsers.md#7-performance-measured) plus the
   synthetic 740 KiB generator, committed to `packages/test-fixtures`.
2. **Two separate harnesses, each idiomatic**, each reporting p50/p95/min, not
   best-of-N. Criterion (`criterion` 0.8.2, updated 2026-02-04) or `divan`
   (0.1.21) on the Rust side; `tinybench` (6.2.0, 2026-09-09) on the JS side.
3. **Measure the boundary, not the parser.** Under Tauri the question is
   "how long is the UI thread blocked?", so measure
   `invoke()` round-trip including serialisation of the result. If the parse
   happens in Rust and the HTML crosses to JS as a string, serialisation cost
   is on the critical path and is easy to forget.
4. **Memory**, with `/proc/self/status` `VmHWM` on Linux and
   `GetProcessMemoryInfo` on Windows, in a fresh process per engine.
5. **`hyperfine` 1.21.0** (crates.io, 2026-10-05) for whole-binary
   end-to-end numbers, so we can state "opening a 10 MiB file takes X ms"
   rather than "parsing takes Y ms".

---

## 7. The FFI / WASM question

### 7.1 Under Tauri there is no FFI problem

If the shell is Tauri, Rust and JS are separated by **serialisation, not
FFI**. `tauri::command` takes owned arguments and returns
`serde_json::Value` or `String`. The cost is one JSON/string copy across the
IPC boundary. Two consequences:

- We do **not** need `wasm-bindgen`, and we do **not** need a C ABI.
- The right architecture is: parse in a Rust `async` task (or a
  `std::thread`), return a finished HTML string plus a block index
  (`Vec<BlockSpan>`), and let the webview do nothing but set `innerHTML` of a
  sanitised fragment.

That is *simpler* than FFI, and it moves the expensive work off the UI thread
entirely — which is the actual reason to consider Rust.

### 7.2 WASM, for a web target

If we later want the *same* parser in the browser without shipping Rust to
JS, `wasm-bindgen` 0.2.129 (2026-09-25, 141.7M downloads/90 days — the most
used Rust-to-WASM toolchain by a wide margin) is the mechanism.

**We found no maintained, first-party WASM build of pulldown-cmark, comrak,
markdown-rs or ammonia on crates.io.** Checks performed, all **404**:
`pulldown-cmark-wasm`, `comrak-wasm`, `markdown-wasm`, `ammonia-wasm`.

What exists on npm instead:

| Package | Version | Published | Base | Assessment |
|---|---|---|---|---|
| `markdown-wasm` | 1.2.0 | **2021-07-01** | **md4c** (C) | 1,674 stars. Claims "31 kB gzipped", CommonMark compliant. **Five years stale.** md4c passes CommonMark 0.31.2 and is used by Blender, LibreOffice, ONLYOFFICE, Qt and Stellarium — so the core is solid, but the WASM binding is unmaintained and md4c has no GFM extensions. |
| `@ptdgrp/markdown-wasm` | 1.1.4 | 2026-08-14 | comrak | **2 stars.** A personal comrak→WASM binding. Correct choice of underlying parser, no adoption, no API stability guarantee. |
| `html-to-markdown-wasm` / `@xberg-io/html-to-markdown-wasm` | 2.18.0 / 3.17.1 | — | ? | Wrong direction (HTML→MD). Not relevant. |

**Assessment.** Do **not** build the web target on a WASM Markdown parser.
markdown-it already runs in every browser we care about at 4.19 KiB/ms
(measured, §7 of the JS doc), which is faster than shipping a 1–2 MB WASM
module. WASM for Markdown is a solved problem nobody needs solved again.

### 7.3 What WASM *is* good for here

Syntax highlighting. `markdown-wasm` exists precisely because md4c-in-WASM is
faster than JS highlighters for some workloads. And Oniguruma — which TextMate
grammars require — **is** a C regex engine that everyone runs via WASM:
Shiki's default engine is `createOnigurumaEngine(import('shiki/wasm'))`.
So: **Markdown in JS, Oniguruma in WASM, that is the split.**

---

## 8. Sanitisation in Rust: `ammonia`

If we parse in Rust, we can sanitise in Rust, before the HTML ever crosses
the boundary. That is genuinely attractive: the HTML string that reaches the
webview is already safe, and we shrink the attack surface of the IPC channel.

### 8.1 What it is

> A whitelist-based HTML sanitization library. It is designed to prevent
> cross-site scripting, layout breaking, and clickjacking caused by untrusted
> user-provided HTML being mixed into a larger web page.
>
> Ammonia uses **html5ever** to parse and serialize document fragments **the
> same way browsers do**, so it is extremely resilient to syntactic
> obfuscation.

That last sentence is the whole selling point. mXSS and obfuscation bypasses
in JS sanitizers exist because the sanitizer's parser and the browser's
parser disagree. `html5ever` is Servo's HTML5 parser and agrees with browsers
by construction. **Rust has no DOMPurify.** This is its closest equivalent and
it is arguably *stronger* than the JS option, because it removes the
"does my parser match the browser's parser" failure mode entirely.

### 8.2 Version and maintenance

| Fact | Value |
|---|---|
| Version | **4.2.1**, published **2026-10-03** |
| Licence | **MIT OR Apache-2.0** (dual) |
| MSRV | 1.85 |
| Stars | 679 (`rust-ammonia/ammonia`, `master` branch) |
| Downloads | 17,668,835 total, 5,082,149 in 90 days |
| Last commit | 2026-10-03 — **actively maintained, same week as this research** |
| OpenSSF Best Practices | yes |

### 8.3 API

```rust
use ammonia::clean;
use pulldown_cmark::{Parser, Options, html::push_html};

let text = "[a link](http://www.example.com/)";

let mut options = Options::empty();
options.insert(Options::ENABLE_TABLES);
let mut md_parse = Parser::new_ext(text, options);

let mut unsafe_html = String::new();
push_html(&mut unsafe_html, md_parse);

let safe_html = clean(&*unsafe_html);
assert_eq!(safe_html, "<a href=\"http://www.example.com/\">a link</a>");
```

Configuration is builder-based, which is what a security-critical allowlist
should be — you can see every knob:

```rust
let mut builder = ammonia::Builder::new();
builder
    .tags(hashset!["p", "a", "strong", "em", "code", "pre", "table"])
    .generic_attributes(hashset!["id", "class"])
    .link_rel(None)            // add rel="noopener noreferrer"
    .url_relative(UrlRelative::PassThrough)
    .clean_content_tags(hashset!["script", "style"]);
let cleaned = builder.clean(&unsafe_html);
```

The `clean_content_tags` option is worth understanding: normally a disallowed
tag is *unwrapped* (its text survives); `clean_content_tags` names tags whose
**text content is discarded too**. You want `script`, `style`, `iframe`,
`object`, `embed`, `noscript` in there.

### 8.4 The published performance comparison

> It takes about fifteen times longer to sanitize an HTML string using
> **bleach**-2.0.0 with html5lib-0.999999999 than it does using Ammonia 1.0.
>
> ```text
> $ cargo run --release
> 87539 nanoseconds to clean up the intro to the Ammonia docs.
> $ python bleach_bench.py
> (1498800.015449524, 'nanoseconds to clean up the intro to the Ammonia docs.')
> ```
>
> — i.e. ~87.5 µs vs ~1,498,800 ns ≈ **1.50 ms**; a ~17× difference.

This is **ammonia's own benchmark** against a Python library, on a small
document, comparing across languages *and* across parser generations. Treat
the ratio as suggestive, not as a JS-vs-Rust number. There is **no credible
published DOMPurify-vs-ammonia benchmark**; see
[05-sanitizer-libraries](05-sanitizer-libraries.md) for how we would settle
it.

### 8.5 Assessment

The strongest sanitizer on this page, by architectural argument rather than
by measurement. Its constraints: it is a **whitelist**, so every element and
attribute a user might legitimately want must be opted in; `class` on `<a>` is
a phishing vector (a sanitized link can look like a trusted one) so it is not
allowed by default; and it sanitizes **HTML**, not the Markdown AST, so it
cannot know that a `javascript:` URL came from an *author* rather than from
raw HTML.

---

## 9. Comparison table

| | pulldown-cmark 0.13.4 | comrak 0.55.0 | rushdown 0.18.0 | markdown (markdown-rs) 1.0.0 | cmark 0.31.2 (C) |
|---|---|---|---|---|---|
| Licence | MIT | **BSD-2-Clause** | MIT | MIT | BSD-2-Clause |
| MSRV | 1.71.1 | **1.89** | 1.87 | 1.56 | C99 |
| Published | 2026-05-20 | 2026-09-06 | 2026-04-30 | **2025-04-23** | 2026-02-14 |
| Last commit | 2026-09-30 | 2026-10-03 | 2026-04-30 | **2025-04-23** | — |
| Downloads (90d) | **51.7M** | 2.5M | 8,187 | 3.7M | n/a |
| Architecture | pull events | arena AST | slice AST | no_std state machine | arena AST |
| CommonMark | 100% | **652/652** | 100% | claimed 100% | **reference impl** |
| GFM | 4 of 5 | 4 of 5 (tagfilter removed 0.56) | yes (no tagfilter) | 100% + MDX | 4 of 5 (separate `cmark-gfm`) |
| Own extensions | `==mark==` only | **19+**: frontmatter, footnotes, wikilinks, math, alerts, spoiler, emoji, deflist, CJK | — | MDX, math, frontmatter | — |
| Extensible from outside | **no** | config struct only | **yes** (explicit design goal) | options struct | no |
| Source positions | `into_offset_iter()` → `Range` | `node.sourcepos` (line/col) | segment tree | mdast `position` + `Point` | byte offsets |
| Raw HTML default | **allowed** | **scrubbed** | **scrubbed** | **safe** | **scrubbed** |
| Published perf | — (only in comparisons) | 4.25 ms¹ | **3.34 ms¹** | 89.7 ms¹ | 3.64 ms¹ |
| Verdict | **default if Rust** | **best features if Rust** | not adoptable (34★) | dormant, name trap | oracle |

¹ All from rushdown's own README, author-run, single unspecified input, not
independently reproduced. See §6.1 for why we only trust the direction.

---

## 10. Does Rust earn its place?

**Not for the parser.** Our measured JS numbers say markdown-it at 4.19 KiB/ms
is fast enough once block-level caching removes whole-document re-parsing, and
markdown-it gives us a *better* extension story (four ruler phases, per-token
line maps, 40+ community plugins) than any Rust parser except comrak's
extension *config*.

**Rust earns its place for these four reasons, in order:**

1. **Parse off the UI thread.** Under Tauri, a Rust task parsing 10 MiB does
   not block the webview at all. In JS we would need a Web Worker plus
   serialisation of the token array — which may or may not be a win, and we
   have not measured it.
2. **ammonia.** html5ever-based sanitisation in the same process, before the
   IPC boundary. Removing the parser/browser disagreement failure mode is a
   structural security win, not a tuning win.
3. **Memory predictability.** No GC pauses on a 100 MB file. For a viewer that
   is explicitly in scope, "no stop-the-world GC while scrolling" is a
   user-visible property.
4. **Binary size and startup.** A Rust static binary with a JS payload we
   control, versus shipping a Chromium.

**Recommendation: keep the parser in TypeScript.** markdown-it in the
frontend, `ammonia` in the Rust shell as a *second* sanitiser, parse off the
main thread with a worker. This is a **reversible** decision: comrak's
`markdown_to_html` behind a Tauri command is a drop-in behind the same
interface our `packages/core` renderer already exposes, and we can benchmark
both later with the harness in §6.3.

Record the open question in
[15-open-questions](../15-open-questions/): *does the Tauri IPC + serialisation
cost of shipping a 3 MB HTML string to the webview exceed the JS parsing cost
it replaces?*

---

## 11. Quick reproduction

```bash
# versions and downloads
curl https://crates.io/api/v1/crates/pulldown-cmark
curl https://crates.io/api/v1/crates/comrak
curl https://crates.io/api/v1/crates/markdown        # NOT markdown-rs
curl https://crates.io/api/v1/crates/rushdown
curl https://crates.io/api/v1/crates/ammonia

# the only published Rust head-to-head
curl -s https://raw.githubusercontent.com/yuin/rushdown/main/README.md | sed -n '/Benchmark/,/Security/p'

# Hugo's use of goldmark (proves goldmark is Go, not Rust)
curl -s https://raw.githubusercontent.com/gohugoio/hugo/master/go.mod | grep goldmark

# the WASM gap
for c in pulldown-cmark-wasm comrak-wasm markdown-wasm ammonia-wasm; do
  curl -s -o /dev/null -w "$c %{http_code}\n" https://crates.io/api/v1/crates/$c
done
# -> all four print 404
```
