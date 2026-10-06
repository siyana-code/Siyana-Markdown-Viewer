# 05 — Performance and limits

> Complexity theory for Markdown parsing, the pathological cases that break real
> implementations, **measured** throughput/memory/depth data, and the **safe
> limits table** with justified values and defined behaviour on breach.

---

## 1. Complexity theory

### 1.1 The claims, with reasoning

Let *n* = input bytes, *L* = lines, *d* = container nesting depth,
*p* = paragraph length, *k* = number of delimiters on the delimiter stack,
*l* = number of passes over the document.

| Phase | Time | Space | Reasoning |
|-------|------|-------|-----------|
| **Line reading** | **O(n)** | O(max line length) | Every byte is examined once for line-ending and CR normalisation. |
| **Tab expansion** | **O(n)** | O(1) | A virtual-column cursor is monotonic; the column never moves backwards. Pre-expanding tabs would be O(n) too but **loses information** (§2.2 of the spec forbids it). |
| **Container prefix stripping** | **O(L · d)** | O(d) | Per line we walk the open path, at most *d* entries, each consuming a bounded prefix. |
| **Block classification** | **O(n)** | O(1) | Every check is a bounded prefix match; `matchThematicBreak` is O(line) because it must verify all non-whitespace chars are equal, everything else is O(1)–O(10). |
| **Paragraph buffering** | **O(n)** total | O(max *p*) | Lines are appended to a growable buffer. Total appended bytes = n. |
| **Link reference definitions** | **O(n)** | O(total definition bytes) | Amortised O(1) per definition **if** the map hashes without adversarial collision. |
| **Phase 2 scan** | **O(n)** | O(k) | Every byte is examined a constant number of times. |
| **Phase 2 `processEmphasis`, matched** | O(1) amortised | — | Each matched pair consumes 1–2 delimiter characters; intermediate delimiters are unlinked once. |
| **Phase 2 `processEmphasis`, unmatched** | **O(1) amortised with `openers_bottom`**, O(k) without | O(1) extra either way | With: each failed search sets a lower bound that all later searches of the same `(char, len mod 3, canOpen)` class reuse. Without: each of *k* closers scans back over up to *k* openers -> **O(k²)**. |
| **Link tail parsing** | O(1) per `]` | O(depth) | Bounded paren matching. The spec explicitly authorises a nesting limit (§6.3). |
| **Code span scanning** | **O(n)** with a run-length index, **O(n·m)** without | O(runs) | Without an index, each candidate opener rescans forward for its matching run. |
| **Render** | **O(n)** | O(AST) | One tree walk. |
| **Total (typical)** | **O(n · d)** with d = O(1) in practice, i.e. **O(n)** | O(AST) + O(n) | |
| **Total (adversarial)** | **O(n^1.5)** | — | See §3.2 on nested lists: depth is Theta(sqrt(n)) because each level costs 2 spaces. |

### 1.2 Why the AST dominates memory

A Markdown AST is **not** compact. Measured (see §4):

| Structure | Bytes for 10 MiB of Markdown | Ratio |
|-----------|---------------------------|-------|
| Source text | 10.5 MiB | 1.0x |
| `commonmark.js` AST (prose corpus) | 165 MiB heap | **15.7x** |
| `commonmark.js` AST (extension corpus) | 364 MiB heap | **34.7x** |
| `markdown-it` core token stream (prose) | 124 MiB | 11.8x |
| `markdown-it` core token stream (extension) | 314 MiB | 29.9x |
| Rendered HTML (prose) | 11.3 MiB | 1.08x |
| Rendered HTML (extension) | 14.5 MiB | 1.38x |

**Derivation.** Each AST node costs at minimum: a type tag, child pointers,
sibling pointers, a source span, and a length — call it 48–128 bytes of JS heap
(plus GC overhead, often 2x). A 10 MiB document with average line length 48 bytes
has ~205 000 lines. If a quarter of lines become blocks and each block averages
3 children, that is ~150 000 block nodes and ~450 000 inline nodes: ~600 000
nodes x ~256 bytes effective = ~150 MiB. The measured 165 MiB matches.

**Design consequence.** For a 10 MB file we need ~380 MB of headroom for
`commonmark.js`-class ASTs, ~800 MB for extension-heavy content. A viewer that
claims to open arbitrary files must either (a) cap input size, (b) parse in a
worker with a hard heap ceiling and a graceful fallback, or (c) use offset-based
nodes rather than copied strings. We intend (c) — see
[`04-parser-architectures.md` §9.3](04-parser-architectures.md).

### 1.3 Where the time goes

Measured split, 10 MiB prose corpus, `commonmark.js` (median of 5):

| Phase | Time | Share |
|-------|------|-------|
| Parse (phase 1 + phase 2, building the AST) | 984 ms | 76% |
| Render (AST -> HTML) | 220 ms | 17% |
| *(Overlapping full `parse+render` run)* | 1 291 ms | 100% |

Render throughput is **45.4 MiB/s** — nearly 5x the parse rate. Rendering is
cheap; parsing is everything.

### 1.4 The two-traversal overhead

Phase 1 reads every byte to find block structure. Phase 2 reads the paragraph
text again to find inline structure. That is a second O(n) pass. There is no way
around it without violating §3.1 (block precedence).

Measured cost: on a paragraph-only corpus, `commonmark.js` achieves **144 MiB/s**
— close to pure scanning speed, because the "second pass" over plain prose does
almost nothing (no delimiters to push). On a nested-emphasis corpus it drops to
**3.9 MiB/s**, a 37x difference, entirely inside phase 2. See §4.3.

---

## 2. Time budget for a 10 MB file

### 2.1 What the existing evidence says

| Source | Measurement | Extrapolated rate |
|--------|-------------|-------------------|
| `cmark` README (C) | *War and Peace* (~3.2 MB) in **127 ms** on a ten-year-old laptop | **~25 MiB/s** |
| `commonmark.js` (JS/WASM), prose corpus | 10 MiB in 1 291 ms | **7.74 MiB/s** |
| `commonmark.js`, extension-heavy corpus | 10 MiB in 2 501 ms | **4.19 MiB/s** |
| `markdown-it` `'commonmark'` preset, prose | 10 MiB in 2 989 ms | 3.35 MiB/s |
| `markdown-it` default preset, extension-heavy | 10 MiB in 9 423 ms | **1.06 MiB/s** |

`cmark`'s figure is the outlier and it is the reference implementation in C with
no AST-consumer overhead beyond HTML rendering. Treat **~25 MiB/s** as the
ceiling for a well-written native implementation and **~4–8 MiB/s** as the
realistic JS target.

### 2.2 Deriving our budget

Requirement: *"parse a 10 MB Markdown file in < X ms"*.

We pick X by reasoning about what the user is waiting for:

| Constraint | Implication |
|------------|-------------|
| A viewer opening a file shows a window; the user perceives the first paint | **First meaningful paint <= 400 ms** even if the full parse takes longer |
| Parsing runs off the UI thread in a worker | UI stays responsive; only the total matters for "time to interactive" |
| Typing latency budget for a live-preview editor | **<= 16 ms per keystroke** — one frame. This, not the 10 MB case, is the hard real-time constraint. |
| The 10 MB case is a power-user edge case (a book, an exported doc set, a generated file) | Sub-2 s total is acceptable if the first screen appears fast |

**Our commitment:**

| Metric | Target (10 MiB) | Target (1 MiB, typical) |
|--------|-----------------|--------------------------|
| Time to first renderable screen (first N blocks) | **<= 400 ms** | <= 40 ms |
| Full parse (AST complete) | **<= 1 500 ms** | <= 150 ms |
| Full render to HTML string | <= 500 ms | <= 50 ms |
| Parse throughput, sustained | >= 6 MiB/s | — |
| Incremental reparse of one paragraph | <= 2 ms | <= 2 ms |
| Incremental reparse of one container | <= 20 ms | <= 20 ms |

The 1 500 ms target corresponds to **6.7 MiB/s**, which is 27% of `cmark`'s
measured C rate and 87% of `commonmark.js`'s measured JS rate on our prose corpus,
with margin for extension-heavy content.

**If we implement in Rust** (via `comrak`), 10 MB in **~400 ms** is a realistic
target and the JS number becomes irrelevant. That is a significant input to the
build-vs-adopt decision and belongs in ADR-0004 and
[`../06-libraries/`](../06-libraries/).

### 2.3 The one-line answer to "what X?"

> **X = 1 500 ms**, with a hard ceiling of 3 000 ms after which we abort the parse
> and show the file with a "this file is too large to render fully" state.
>
> Derivation: 10 MiB / 1 500 ms = 6.7 MiB/s, which is 27% of `cmark`'s measured
> C rate and 87% of `commonmark.js`'s measured JS rate on our prose corpus, with
> margin for extension-heavy content.

---

## 3. Pathological input: measured

### 3.1 Method

The `cmark-gfm` pathological suite
(<https://raw.githubusercontent.com/github/cmark-gfm/master/test/pathological_tests.py>)
is the canonical corpus. It runs each shape in a subprocess with a **5-second
timeout** and fails the build on timeout.

Its *scaling-factor* test is stronger than an absolute timeout, because it
catches **complexity regressions** rather than environment-dependent slowdowns:
build each shape at size *k* and *2k*, and compare. Ratio ~ 2 -> linear.
Ratio ~ 4 -> quadratic.

We ran both shapes and both parsers. **All measurements 2026-10-06, Node
24.14.1, `commonmark@0.31.2` and `markdown-it@15.0.2`.**

### 3.2 Results

**k = 6 000 -> 12 000** (2x scaling):

| Shape | `commonmark.js` | `markdown-it` | Verdict |
|-------|-----------------|---------------|---------|
| nested brackets `[[[...a...]]]` | 24.4 -> 23.1 ms (**x0.95**) | 22.2 -> 49.9 ms (x2.25) | ~linear |
| many emph closers, no openers (`a_ `) | 13.3 -> 23.9 ms (x1.79) | 50.1 -> 89.9 ms (x1.80) | ~linear |
| many emph openers, no closers (`_a `) | 13.0 -> 24.7 ms (x1.90) | 40.3 -> 94.3 ms (x2.34) | ~linear |
| many link closers, no openers (`a]`) | 7.0 -> 26.4 ms (**x3.78**) | 4.1 -> 8.6 ms (x2.13) | **super-linear** |
| many link openers, no closers (`[a`) | 6.8 -> 13.8 ms (x2.04) | 26.1 -> 55.4 ms (x2.12) | ~linear |
| nested strong emph | 66.7 -> 184.7 ms (x2.77) | 296.3 -> 426.7 ms (x1.44) | ~linear |
| mismatched openers/closers (`*a_ `) | 20.9 -> 41.1 ms (x1.96) | 64.1 -> 146.4 ms (x2.28) | ~linear |
| link openers + emph closers (`[ a_`) | 10.3 -> 22.4 ms (x2.18) | 66.1 -> 130.6 ms (x1.97) | ~linear |
| **unclosed links** (`[a](b` repeated) | 6 905 -> 30 823 ms (**x4.46**) | 38.9 -> 51.1 ms (x1.31) | **super-linear** |
| nested block quotes (`> > > ...`) | 9.2 -> 15.4 ms (x1.69) | 0.5 -> 0.6 ms (x1.26) | ~linear |

**k = 1 000 -> 2 000** (2x scaling):

| Shape | `commonmark.js` | `markdown-it` | Verdict |
|-------|-----------------|---------------|---------|
| **deeply nested lists** | 4 592 -> 42 225 ms (**x9.20**) | 11.1 -> 49.7 ms (**x4.50**) | **super-linear** |
| **backticks (unclosed, increasing)** | 531 -> 4 193 ms (**x7.90**) | 14.7 -> 142.1 ms (**x9.64**) | **super-linear** |
| many reference definitions | 6.1 -> 13.6 ms (x2.23) | 11.5 -> 18.6 ms (x1.62) | ~linear |
| pattern `[ (](` repeated | 5.3 -> 10.9 ms (x2.07) | 7.4 -> 11.7 ms (x1.58) | ~linear |
| pattern `![[]()` repeated | 15.7 -> 64.7 ms (**x4.13**) | 17.4 -> 31.1 ms (x1.78) | **super-linear** |
| unclosed `<!--` | 13.3 -> 33.8 ms (x2.55) | 16.4 -> 56.8 ms (x3.46) | borderline |

> The `plain paragraph` control shape at k=1 000 completes in 0.1 ms, which is
> below timer resolution and produced a spurious x3.09 "SUPER-LINEAR" verdict.
> **Our own harness must refuse to classify a shape when the base measurement is
> under ~2 ms** — otherwise noise becomes a finding.

### 3.3 The headline finding

`commonmark@0.31.2` — the **official JavaScript reference implementation**, which
passes 652/652 — has catastrophic behaviour on unclosed links:

| Repetitions | Input size | Parse time (parse only) | `markdown-it` |
|-------------|-----------|------------------------|---------------|
| 5 000 | 25 KB | **2 351 ms** | 13.7 ms |
| 10 000 | 50 KB | **10 126 ms** | 24.9 ms |
| 20 000 | 100 KB | **51 394 ms** | 35.1 ms |

**100 KB of text takes 51 seconds.** Scaling factor between doublings is ~4.3
and ~5.1, i.e. **worse than quadratic**. `markdown-it` parses the same input
**1 470x faster**.

This is not a theoretical concern. It is a denial-of-service primitive against
any application that parses untrusted Markdown with the reference
implementation, and it is the same class of bug as
[CVE-2023-22486](https://github.com/github/cmark-gfm/security/advisories/GHSA-r572-jvj2-3m8p)
("polynomial time complexity issue in cmark-gfm").

**Three conclusions:**

1. **Conformance and robustness are independent.** Test both, forever.
2. **Do not adopt `commonmark.js` as a runtime dependency.** Use it as an oracle
   in tests, where its slowness does not matter.
3. **Every limit in §6 is load-bearing.** A depth limit does not help here; a
   *delimiter-count limit* and a *per-`]`-work budget* do.

### 3.4 Why each shape is hard

| Shape | Why a naive implementation goes quadratic |
|-------|------------------------------------------|
| `a] ` repeated | Each `]` walks back to the top of the delimiter stack looking for `[`, finds none, gives up. *k* closers x *k* stack depth. The spec's `process_emphasis` `openers_bottom` bound does **not** cover `look for link or image`. |
| `[a](b` repeated | Same backward walk, plus a `(` that opens and never closes, so each link-tail attempt scans further. |
| nested lists (`"  " * i + "* a\n"`) | Depth is Theta(sqrt(n)). Per line we walk the open path of length Theta(sqrt(n)). **O(n^1.5)**. |
| backticks, increasing runs | `"e" + "`" * x` for x = 1...N: each new opening run of length *x* scans forward looking for a run of length *x*. Naively O(N^2). The fix is a **run-length index**: `Map<length, positions[]>`, queried by binary search. |
| `![[]()` repeated | Image openers accumulate on the delimiter stack; each `]` walks back past all of them. |
| many reference definitions | A weak string hash collides adversarially. `cmark-gfm`'s test constructs collisions deliberately with a 16-bucket hash. |

### 3.5 The `openers_bottom` relevance, measured

`commonmark.js` scales x1.79 on `a_ ` and `markdown-it` x1.80. Both are near
linear, so **both implementations have the `openers_bottom` optimisation.** This
is the empirical proof that the appendix's optimisation is load-bearing and
widely implemented — but note that `a] ` (link closers) at x3.78 shows the
optimisation does **not** extend to `look for link or image`.

---

## 4. Recursion depth, stack overflow, and the hard limits

### 4.1 Measured nesting behaviour

`markdown-it` exposes `options.maxNesting`, which we confirmed defaults to
**20**:

```js
const md = new MarkdownIt('commonmark');
md.options.maxNesting          // => 20

md.render('> '.repeat(30) + 'a')   // 20 <blockquote> elements
md.render('> '.repeat(100) + 'a')  // still 20 -- silently truncated
new MarkdownIt({ maxNesting: 200 }).render('> '.repeat(100) + 'a')  // 100
```

**Behaviour on breach: silently stop nesting.** No error, no exception. The
remainder of the input after depth 20 becomes literal text inside the 20th
blockquote. Measured timings confirm this is why `markdown-it` parsed
100 000-deep block quotes in **2.2 ms** while `commonmark.js` took 283 ms —
the latter actually builds the full tree.

### 4.2 Measured stack behaviour

| Nesting kind | depth | `commonmark.js` parse | `markdown-it` core | Notes |
|--------------|-------|-----------------------|-------------------|-------|
| brackets `[[[...a...]]]` | 1 000 | 5.9 ms | 7.0 ms | inline, no tree depth issue |
| brackets | 100 000 | 70.5 ms | 156.1 ms | still fine |
| block quotes `> > > ...` | 100 000 | 149 ms | **2.0 ms** | `markdown-it` capped at 20 |
| emphasis `*a *a *a ...` | 100 000 | 419 ms | 762 ms | |
| **lists** (2-space indent per level) | 1 000 | **6 700 ms** | **12.4 ms** | `commonmark.js` 540x slower |
| lists | 2 000 | (did not complete in 15 min budget) | — | `commonmark.js` x9.20 per doubling |

Two findings:

1. **`commonmark.js` nested-list parsing is O(n^1.5)** and effectively unusable
   past ~1 500 levels.
2. **Neither implementation crashed** at 100 000 emphasis or bracket depth. JS
   engines grow the stack, or the algorithms are iterative. But this is
   engine-specific, and native Rust or C parsers **do** stack-overflow on deeply
   nested trees during a *recursive* render walk.

### 4.3 Per-construct throughput

Best-of-7 medians, Node 24.14.1:

| Construct | Bytes | `commonmark.js` MiB/s | `markdown-it` MiB/s | Ratio |
|-----------|-------|-----------------------|---------------------|-------|
| paragraph of prose | 1 860 | **144.2** | 30.0 | 4.8x |
| ATX heading (23 B) | 23 | 4.7 | 2.8 | 1.7x |
| bullet list (36 B, 3 items) | 36 | 2.7 | 1.4 | 1.9x |
| fenced code (46 B) | 46 | 9.7 | 7.3 | 1.3x |
| **nested emphasis** | 840 | **3.9** | **0.8** | 4.9x |
| links + references | 768 | 6.0 | 3.5 | 1.7x |
| raw HTML block | 44 | 6.9 | 8.7 | 0.8x |
| deeply nested block quotes (30 deep) | 66 | 4.8 | 1.9 | 2.5x |

**Reading this table.**

- **Prose is 4–37x cheaper per byte than anything with structure.** A prose-only
  document is a best case; an emphasis-heavy document is a worst case. Any
  benchmark must state its corpus mix. This is why our 10 MiB throughput numbers
  differ by 2.3x between the prose and extension corpora.
- **Small blocks are dominated by per-node overhead.** A 23-byte heading costs
  0.005 ms; that is ~4.7 MiB/s *not* because headings are expensive to parse but
  because there is a fixed ~2 us per block.
- **Nested emphasis is the expensive case**, at 3.9 MiB/s for `commonmark.js` and
  **0.8 MiB/s** for `markdown-it`. A 10 MiB file of nothing but nested emphasis
  would take **2.1 s in `commonmark.js` and 12.5 s in `markdown-it`.**

---

## 5. ReDoS and user-authored regular expressions

### 5.1 The parser itself

**A conformant CommonMark parser contains no backtracking regular expressions on
the main path.** This is not an accident — the spec's emphasis rules were
explicitly designed to "allow for efficient parsing strategies that do not
backtrack" (§6.2):

> The rules given below capture all of these patterns, while allowing for
> efficient parsing strategies that do not backtrack.

That sentence is a ReDoS-avoidance requirement written into the specification.

**Our rule:** no regex on the hot path. Matchers for thematic breaks, ATX
headings, fences, list markers, HTML block starts and link tails are hand-written
scanners with explicit character-class checks. Each is provably O(line length)
with no nested quantifiers over ambiguous classes.

### 5.2 Where regexes legitimately appear

| Site | Regex | Risk | Control |
|------|-------|------|---------|
| Entity table lookup | none (hash map) | — | Build the table at build time from `entities.json` |
| Line-ending normalisation | `/\r\n?/g` | none — linear | |
| Trailing-whitespace trim at line end | `/\s+$/` | **ReDoS-prone** if written as `/\s+\s*$/` | Use `/[ \t]+$/` — a single character class, provably linear |
| Heading slug generation | user titles | **the real risk** | See §5.3 |
| User-supplied search patterns | user input | **critical** | See §5.4 |

### 5.3 Heading slugs — the most likely ReDoS in a viewer

If we generate heading slugs (which we must, for `](#anchor)` resolution), we
will write something like:

```ts
// VULNERABLE. Two adjacent unbounded quantifiers over overlapping classes.
function slug(s: string): string {
  return s.toLowerCase()
        .replace(/[^\w\s-]/g, '')   // class A
        .replace(/\s+/g, '-')      // overlaps with \s in the previous class
        .replace(/-+/g, '-')
        .trim();
}
```

The `[\w\s-]` followed by `\s+` construction is a classic exponential-backtracking
shape: for a string of *n* spaces and punctuation there are exponentially many
ways to split the match.

**The safe rewrite**, with reasons:

```ts
function slug(title: string): string {
  // 1. Single pass, no overlapping quantifiers. Map every disallowed char to
  //    nothing rather than trying to match runs of "allowed" chars.
  let out = '';
  for (const cp of title) {
    if (isAllowedSlugChar(cp)) out += cp;      // explicit predicate, no regex
    else if (isSpace(cp)) out += '-';          // collapse via a flag, not \s+
    // everything else: dropped
  }
  // 2. Collapse runs of '-' with a linear loop.
  // 3. Trim leading/trailing '-' with indexOf/slice, not a regex.
}
```

An explicit character loop is **provably O(n)** with a constant factor of one, and
it is not a class of bug we can get wrong.

### 5.4 Search

Full-text search over a user's notes is the other ReDoS surface. Requirements:

- **Never** compile a user string into a regex. If regex search is offered, use
  a fixed grammar of user-selectable tokens (`AND`, `OR`, `NOT`, quoted phrases)
  and parse it ourselves.
- **Bound the query length** (256 characters).
- **Bound the evaluated automaton.** Build the query automaton once, then run it
  over the index. Cost is O(query length x index size), both bounded.
- **Never run search on the main thread.** It belongs in a worker with a
  cancellation token, so a slow query degrades to "still searching" rather than
  a frozen window.

---

## 6. Safe limits

> **Principle.** A limit exists to convert an unbounded cost into a *bounded,
> reported* cost. Every limit must (a) have a value chosen from evidence,
> (b) define what happens on breach, and (c) **report**, never silently
> truncate. Silent truncation is worse than the bug it prevents: the user sees a
> wrong document.

### 6.1 The table

| # | Limit | Value | Justification | On breach |
|---|-------|-------|---------------|-----------|
| **L1** | **Max input size** | **hard 64 MiB**, warn 16 MiB | 64 MiB at 6.7 MiB/s = 9.5 s worst case, and ~2.3 GiB of AST at the measured 34.7x ratio. 16 MiB is ~3x the largest real-world single Markdown file we know of, and at 16 MiB the AST is ~550 MiB, survivable. | Above hard: refuse, show file metadata and a byte/line count, offer "open in read-only text mode". Never attempt the parse. |
| **L2** | **Max container nesting depth** | **32** | `markdown-it` ships 20 as its default and real documents never exceed ~6. 32 leaves 5x headroom over any plausible human-authored nesting while keeping the open-path walk and the render stack short. | Stop descending; render the excess as literal text inside the depth-32 container; emit `ParseNotice{kind:'nesting-limit', depth:32}`. |
| **L3** | **Max list nesting depth** | **16** | Sub-lists beyond ~6 are unreadable in source. 16 is generous. Distinct from L2 because the list parser's indent arithmetic compounds the cost. | Same as L2, with `depthKind:'list'`. |
| **L4** | **Max emphasis nesting depth** | **16** | Real emphasis nesting is <=4. Beyond 16 the AST is pathological and browsers will also struggle. | Stop opening new emph nodes; remaining delimiters render literally. |
| **L5** | **Max link/image nesting** | **1** | Not a limit we impose — **the spec forbids it**: "Links may not contain other links, at any level of nesting" (§6.3). We implement it by deactivating earlier `[` openers. | n/a (spec-mandated). |
| **L6** | **Max unbalanced bracket depth** | **32** | Protects the backward walk in `look for link or image`, which is the shape that made `commonmark.js` take 51 s (§3.3). Balanced brackets beyond 32 nest deeper than any human writes. | Stop pushing `[` openers; remaining `[` are literal. |
| **L7** | **Max delimiter stack entries** | **10 000** | Direct bound on the backward scan. 10 000 delimiters at ~64 bytes each is 640 KB — acceptable. Reached only by adversarial input. | Drop the oldest entries (they become literal) and emit a notice. **This is the limit that actually fixes the unclosed-links DoS.** |
| **L8** | **Max link-destination paren nesting** | **32** | The spec **explicitly authorises this**: "Implementations may impose limits on parentheses nesting to avoid performance issues with pathological cases like `[a]((((((((((((((...`" (§6.3, spec.txt line 7500). | Stop consuming parens; the rest is literal text after `(`. |
| **L9** | **Max backtick run length** | **1 024** | Real code fences and code spans never use 1 024 backticks. Bounds the code-span run-length index. | Treat runs longer than the limit as literal backtick text. |
| **L10** | **Max code fence length** | **1 024** characters | Matches L9. This is the fence character run length; the *content* length is unbounded. | A longer run is not a fence; it is literal text. |
| **L11** | **Max info string length** | **4 KiB** | Info strings are language identifiers plus a few options. 4 KiB is 4 000x more than any real one. | Truncate the info string; keep the code block. |
| **L12** | **Max table columns** | **256** | A 256-column table cannot be rendered legibly and cannot fit a screen. Real tables are <20. The extension has a DoS history ([GHSA-7gc6-9qr5-hc85](https://github.com/github/cmark-gfm/security/advisories/GHSA-7gc6-9qr5-hc85)). | Extra cells are dropped; emit a notice with the original count. |
| **L13** | **Max table row cells matched to header** | **header count +/- 8** | GFM: "Cells in one column don't need to match length." A 10 000-cell row against a 2-column header is adversarial. | Cells beyond `headerCount + 8` are dropped; notice emitted. |
| **L14** | **Max line length** | **1 MiB** | A single 1 MiB line is not a document. It is a data dump or an attack. | The line is truncated at 1 MiB, the rest of the physical line discarded, notice emitted. |
| **L15** | **Max link reference definitions** | **100 000** | Each definition is >= 8 bytes, so 100 000 is ~1 MiB of references. The map is the main unbounded structure in phase 1, and weak-hash collisions are a documented attack (`cmark-gfm`'s `reference collisions` test). | Additional definitions are ignored; notice emitted with the count. |
| **L16** | **Max link label length** | **999 characters** | **Spec-mandated**: "A link label can have at most 999 characters inside the square brackets" (§6.3, spec.txt line 7972). | Longer labels are not reference labels. |
| **L17** | **Max ordered-list start number** | **9 999 999 999** | **Spec-mandated**: markers are "a sequence of 1--9 arabic digits" (§5.2, spec.txt line 4106), with the stated reason "with 10 digits we start seeing integer overflows in some browsers". | Treat as not-a-list-marker -> paragraph. |
| **L18** | **Max autolink literal length** | **2 048** characters | GFM autolinks have a quadratic-complexity DoS history ([GHSA-cgh3-p57x-9q7q](https://github.com/github/cmark-gfm/security/advisories/GHSA-cgh3-p57x-9q7q)) and the trailing-punctuation / paren-balancing scan is super-linear in the worst case. 2 048 is 20x longer than any real URL. | Truncate the autolink at 2 048 and close it; notice emitted. |
| **L19** | **Max autolink paren rebalance passes** | **1** | GFM requires a single scan of the autolink counting parens. More than one pass is a bug, not a tuning knob. | n/a (algorithm invariant). |
| **L20** | **Max HTML block length** | **1 MiB** | A type-1 HTML block runs until its terminator; `<script>` with no `</script>` would otherwise swallow the rest of the file as raw HTML, which is both a DoS and a security problem. | Terminate the block at 1 MiB; the remainder is parsed as Markdown. **This limit is also a security control** — see [`../11-security/`](../11-security/). |
| **L21** | **Max HTML nesting depth in output** | **100** | Browsers themselves cap or flatten deep nesting; we should not emit pathological DOM. | Emit as sibling flat structures. |
| **L22** | **Parse time budget** | **3 000 ms** (warn 1 500 ms) | §2.3. | At 3 000 ms the parse is **abandoned**, not paused. Emit `ParseNotice{kind:'time-limit'}`, render everything parsed so far, and offer "retry without extensions" (measurably ~2x faster). |
| **L23** | **Max notices per document** | **1 000** | A pathological file could generate millions of notices; the diagnostics panel must not OOM. | Stop recording, set a single "many issues" summary notice. |
| **L24** | **Max concurrent parses** | **2** (1 render + 1 prewarm) | Each parse may hold 300–800 MB. Two workers plus the render tree plus the source is the practical ceiling on a 16 GB machine; on 8 GB, **1**. | Queue with LRU cancellation. |
| **L25** | **Max open file handles** | — *(not a parser limit)* | — | Filesystem concern, tracked in [`../10-performance/`](../10-performance/). |

### 6.2 Interaction between limits

The limits are not independent, and the order of application matters:

1. **L1 (input size) is checked first**, before any allocation. It is the only
   limit that prevents memory exhaustion outright.
2. **L14 (line length) is checked during line reading**, so no buffer can exceed
   1 MiB plus one line's overhead.
3. **L2/L3 (nesting) is checked in phase 1**, during container open. Bounds the
   open-path walk.
4. **L7 (delimiter stack) is checked in phase 2**, on push. This is the one that
   actually kills the unclosed-links DoS.
5. **L20 (HTML block length) is checked in phase 1**, on the HTML block's
   continuation. Bounds both time and raw-HTML exposure.
6. **L22 (time budget) is checked in the phase-1 loop**, every 4 096 lines. The
   catch-all for anything the other limits miss.

### 6.3 Why "report, never silently truncate"

Every limit row above specifies a notice. This is a deliberate product decision
and it is the one thing most Markdown viewers get wrong.

Consider a viewer that silently caps list nesting at 20. A user opens a document
with a 24-deep list. They see a plausible-looking render. They do not know
anything was dropped. If they share that document, or screenshot it, the error
propagates. **Silent corruption is worse than a visible failure**, and it is
worse than the DoS we were trying to prevent, because it is permanent.

The notice pipeline:

```ts
interface ParseNotice {
  kind:
    | 'nesting-limit'          // L2, L3, L4
    | 'bracket-limit'          // L6
    | 'delimiter-limit'        // L7
    | 'html-block-truncated'   // L20
    | 'input-too-large'        // L1
    | 'time-limit'             // L22
    | 'line-truncated'         // L14
    | 'table-truncated'        // L12, L13
    | 'autolink-truncated'     // L18
    | 'references-truncated'   // L15
    | 'unsupported-construct'; // profile level, see
                               // ../03-specifications/03-extension-standards.md §5.4
  limit: number;
  span?: SourceSpan;           // where
  detail: string;              // human-readable, in the user's locale
}
```

All notices are collected on the parse result, counted, and surfaced:
1. as a **banner** if any limit was hit,
2. as a **count** in the document-info panel,
3. as **inline markers** in an optional strict render mode.

### 6.4 The `markdown-it` precedent, and why we go further

`markdown-it` caps at 20 and silently truncates (§4.1). That is a reasonable
compromise for a *library*, where the caller may not want diagnostics. It is not
acceptable for an *application* whose job is to show the user someone else's
document. We take the limit and add the reporting.

---

## 7. Security implications of the limits

Three limits are security controls, not just performance controls:

| Limit | Security role |
|-------|---------------|
| **L20 — HTML block length** | Without it, a 10 MB file containing `<script>` with no closing tag becomes 10 MB of raw HTML passed to the sanitiser and then to the DOM. Bounding it means at most 1 MiB of untrusted raw HTML per block. |
| **L18 — autolink literal length** | GFM autolink detection has two published DoS advisories. A length bound plus a single-pass algorithm removes the class. |
| **L22 — time budget** | A worker that can be abandoned at 3 000 ms cannot be used to wedge the application. This is the difference between "a bad file takes a while" and "the app hangs forever". |

The full security model is in [`../11-security/`](../11-security/). The point here
is that **the limits are load-bearing for safety, not just for speed**, and
should be reviewed by whoever writes that document.

---

## 8. What to measure in CI

From the job design in
[`../03-specifications/04-conformance-testing.md` §7](../03-specifications/04-conformance-testing.md):

| Measurement | Gate |
|-------------|------|
| Every shape in the `cmark-gfm` pathological list | completes in < 5 s |
| Scaling ratio per shape (k vs 2k) | <= 3.2 |
| Throughput on the fixed 10 MiB prose corpus | >= 6 MiB/s, non-blocking but trended |
| Throughput on the fixed 10 MiB extension corpus | >= 3 MiB/s |
| Peak heap on the 10 MiB corpus | <= 600 MiB |
| Time to first screen | <= 400 ms |
| Every limit in §6 fires | the notice test suite passes |

**The 3.2 scaling-ratio threshold** is the single most valuable gate in this
document. It is how you catch a quadratic regression that a fixed 5-second
timeout would miss on your particular hardware.

---

## 9. What we have *not* measured

Honesty about the gaps, so nobody over-trusts these numbers:

| Gap | Why | Planned |
|-----|-----|---------|
| **Rust/C numbers** | We have no toolchain in this environment | Benchmark `comrak` natively once the repo has a Rust workspace |
| **Windows vs Linux** | All measurements are Windows 11 | Repeat on Linux in CI; expect ±20% |
| **Electron/Tauri overhead** | Not applicable at the parser layer, but IPC and structured-clone costs are | `../10-performance/` |
| **Real-world corpus** | Our corpora are synthetic | Build a corpus from the `../02-syntax/` fixtures and from babelmark divergence cases |
| **`pulldown-cmark` and `comrak` scaling** | Rust crates not available here | Add to the pathological CI job |
| **Memory for our own implementation** | Not written yet | The CI gate exists; the number is a target, not a result |

---

## 10. Reproducing these numbers

All measurements in this document were produced by scripts in
`D:\Dev\Temp\opencode\mdbench\`, run on Windows 11 with Node 24.14.1:

| Script | Produces |
|--------|----------|
| `gen.js <bytes> <out>` | extension-heavy synthetic corpus |
| `gen-prose.js <bytes> <out>` | prose-heavy synthetic corpus |
| `bench2.js <file> <reps>` | phase-separated throughput table (§1.3, §2.1) |
| `micro.js` | per-construct throughput (§4.3) |
| `mem.js <file>` | peak heap (§1.2) |
| `scaling.js <k>` | 2x scaling, emphasis/link shapes (§3.2) |
| `scaling2.js <k>` | 2x scaling, block/other shapes (§3.2) |
| `unclosed.js` | the unclosed-links DoS table (§3.3) |
| `depth.js <kind>` | nesting depth behaviour (§4.1, §4.2) |
| `conform.js <spec.json>` | CommonMark 0.31.2 conformance |

Node flags used: `--max-old-space-size=10240` (large corpora), `--expose-gc`
(memory measurement). Corpus generation is deterministic; the same
`node gen.js 10485760 bench10mb.md` always produces byte-identical output.

**Reproduce:**

```bash
npm i markdown-it@15.0.2 commonmark@0.31.2 marked@18.1.0
node gen-prose.js 10485760 prose10mb.md
node gen.js 10485760 bench10mb.md
node --expose-gc --max-old-space-size=10240 mem.js prose10mb.md
node --max-old-space-size=10240 bench2.js prose10mb.md 5
node micro.js
node scaling.js 6000
node scaling2.js 1000
node unclosed.js
node depth.js list
```

---

## Sources

- `cmark-gfm` pathological corpus and 5-second-timeout harness:
  <https://raw.githubusercontent.com/github/cmark-gfm/master/test/pathological_tests.py>
- `cmark-gfm` CTest wiring (spec, roundtrip, entity, pathological):
  <https://raw.githubusercontent.com/github/cmark-gfm/master/test/CMakeLists.txt>
- `cmark` README — *War and Peace* in 127 ms, 10 000x faster than `Markdown.pl`,
  "extensively fuzz-tested using american fuzzy lop":
  <https://raw.githubusercontent.com/github/cmark-gfm/master/README.md>
- Security advisories (all from <https://github.com/github/cmark-gfm/releases>):
  - [CVE-2023-22486 / GHSA-r572-jvj2-3m8p](https://github.com/github/cmark-gfm/security/advisories/GHSA-r572-jvj2-3m8p) — polynomial-time DoS
  - [GHSA-cgh3-p57x-9q7q](https://github.com/github/cmark-gfm/security/advisories/GHSA-cgh3-p57x-9q7q) — autolink extension polynomial-time DoS
  - [GHSA-7gc6-9qr5-hc85](https://github.com/github/cmark-gfm/security/advisories/GHSA-7gc6-9qr5-hc85) — table extension DoS
  - [GHSA-mc3g-88wq-6f4x](https://github.com/github/cmark-gfm/security/advisories/GHSA-mc3g-88wq-6f4x) — heap corruption via integer overflow
  - [GHSA-r8vr-c48j-fcc5](https://github.com/github/cmark-gfm/security/advisories/GHSA-r8vr-c48j-fcc5), [GHSA-w4qg-3vf7-m9x7](https://github.com/github/cmark-gfm/security/advisories/GHSA-w4qg-3vf7-m9x5) — further polynomial-time fixes
- CommonMark 0.31.2 §6.2 (emphasis designed "for efficient parsing strategies that
  do not backtrack"), §6.3 line 7500 (explicit authorisation of a paren-nesting
  limit), §6.3 line 7972 (999-character link label), §5.2 line 4106 (1–9 digit
  list marker), §4.7 (link reference definitions):
  <https://spec.commonmark.org/0.31.2/>
- Appendix A.4 (`openers_bottom`, the two procedures):
  <https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/spec.txt> lines 9636–9757
- `markdown-it` `maxNesting` default (20) — verified empirically:
  `node -e "new (require('markdown-it'))('commonmark').options.maxNesting"`
- CommonMark §6.1 (backtick strings) — the code-span run-length requirement
- OWASP XSS Filter Evasion Cheat Sheet — the reason GFM's 9-tag blocklist is
  insufficient: <https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html>
- **Our own measurements**, all 2026-10-06, scripts at
  `D:\Dev\Temp\opencode\mdbench\` (see §10). Raw numbers quoted verbatim; no
  figure in this document is estimated without being labelled.
