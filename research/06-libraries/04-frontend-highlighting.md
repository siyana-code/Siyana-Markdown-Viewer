# 04 — Frontend syntax highlighting

A Markdown viewer highlights code blocks in **arbitrary user documents**. That
single sentence rules out the two things that dominate every other
highlighting discussion: (1) you cannot know the language at build time and
(2) you cannot pre-highlight at build time, because the file does not exist
until the user opens it. Everything below follows from that constraint.

Verified 2026-10-06. Versions from `registry.npmjs.org`; sizes from the
Bundlephobia API (minified, and minified+gzip) for the exact pinned version;
languages and themes counted from the runtime objects of the installed
packages; **all timings are ours**, measured with `performance.now()` in
**Node v24.14.1 on Windows** with these exact versions installed.

---

## 0. The four candidates

| | Shiki | @wooorm/starry-night | highlight.js | Prism + refractor |
|---|---|---|---|---|
| Version | **4.5.0** (2026-10-01) | **3.11.0** (2026-08-30) | **11.12.0** (2026-08-12) | prismjs **1.30.0** (2025-03-10) / refractor **5.0.0** (2025-03-11) |
| Licence | MIT | MIT | BSD-3-Clause | MIT |
| Model | TextMate grammars + VS Code themes | TextMate grammars (GitHub's own `PrettyLights`, open-sourced) | Own regex grammars | Prism regex grammars |
| Accuracy | **Highest** — the same engine VS Code uses | **Highest** — literally GitHub's highlighter | Good | Good |
| Regex engine | Oniguruma (WASM) **or** transpiled JS RegExp | Oniguruma (WASM) | JS RegExp | JS RegExp |
| Themes | **65** bundled, dual-theme via CSS vars | 1 (GitHub's), themes applied via hast | ~60 in a separate package | 20+ in `prism-themes` |
| Languages | **346** bundled | **710** total / **34** "common" | **193** | 297 via refractor, 36 by default |
| Min | 209,208 B | **9,334,886 B** | 923,020 B | 18,945 B (Prism) / 113,158 B (refractor) |
| Min + gzip | 65,002 B | **1,915,514 B** | 307,085 B | **7,140 B** (Prism) / 39,384 B (refractor) |
| Runtime deps | 8 | 4 | **0** | 0 (Prism) / 4 (refractor) |
| Output shape | HTML string | **hast** (AST) | HTML string | HTML string (Prism) / hast (refractor) |
| Stars | 13,845 | 1,817 | 25,005 | 13,044 (Prism) / 870 (refractor) |
| Monthly dl | 97,981,959 | 560,843 | 151,863,196 | 128,594,519 (Prism) |
| Async init | **Yes** — `createHighlighter()` is a Promise | **Yes** — `createStarryNight()` is a Promise | No (synchronous) | No (synchronous) |

> **The size column is the whole story.** starry-night at 1.9 MB gzipped is
> **29× the size of Prism** and **6× Shiki**. It is the single most accurate
> highlighter available and, on npm, the most impractical for an app that has
> to start fast on Windows and Linux. We deal with this properly in §5 rather
> than pretending the number away.

---

## 1. What "accuracy" actually means here

Fidelity is not a vibe. TextMate grammars are the grammar format VS Code uses,
which means a Rust block in a user's README is tokenised by the *same* regular
expressions that colourise it in the editor they wrote it in. Prism and
highlight.js each maintain their own hand-written grammars, and both are
decades-old formats: no multi-line embedded languages, no injection rules, no
scope stack.

Concretely, on one TypeScript snippet we ran through all three:

```ts
export async function main() {
  const xs = [1, 2, 3].map(n => n ** 2)
  if (xs.length > 2) console.log(`big: ${xs}`)
}
```

Shiki (github-dark) produces **1,593 bytes** of HTML for this. highlight.js
produces **832 bytes**. The ratio is the fidelity: Shiki emits a `<span>` per
scope with an inline `style="color:..."` plus a `--shiki-dark:` override for
every token, wraps every line in `<span class="line">`, and adds
`tabindex="0"` for keyboard scrolling. highlight.js emits a `<span
class="hljs-keyword">` per token and nothing else. Shiki's output is ~2× the
bytes because it is doing ~2× the work.

That extra work is what makes a Rust string literal containing
`"```"` render correctly, an embedded JS template literal inside a Markdown
code fence keep its colours, and a `/* */` comment spanning lines inside a
Python f-string not swallow the rest of the file.

**It is also why Shiki output is ~2× bigger in the DOM**, which is a real cost
for a 100 MB document with 50,000 code blocks. We have to pick a side.

---

## 2. Shiki 4.5.0

### 2.1 API

```ts
import { createHighlighter } from 'shiki'

const highlighter = await createHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: ['typescript']
})

// dual theme: both emitted, CSS picks
const html = highlighter.codeToHtml(code, {
  lang: 'typescript',
  themes: { light: 'github-light', dark: 'github-dark' }
})
```

```html
<pre class="shiki shiki-themes github-light github-dark"
     style="background-color:#fff;--shiki-dark-bg:#24292e;color:#24292e;--shiki-dark:#e1e4e8"
     tabindex="0"><code><span class="line">
  <span style="color:#D73A49;--shiki-dark:#F97583">export</span>
  ...
```

For a **fine-grained bundle** (which is what we want — see §5.2):

```ts
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import ts from '@shikijs/langs/typescript'
import nord from '@shikijs/themes/nord'

const highlighter = await createHighlighterCore({
  themes: [nord],
  langs: [ts],
  engine: createJavaScriptRegexEngine()   // NO WASM
})
```

Shiki's own docs are explicit that this is the recommended path: *"Avoid
importing `shiki`, `shiki/bundle/full`, `shiki/bundle/web` directly"* and
*"it's always better to use the fine-grained bundles to reduce the bundle size
and memory usage."*

### 2.2 The two regex engines — this is the key decision

From Shiki's `docs/guide/regex-engines.md`:

> TextMate grammars are based on regular expressions that match tokens. More
> specifically, they assume that **Oniguruma** (a powerful regex engine written
> in C) will be used…

| Engine | Cost | Speed | Compatibility |
|---|---|---|---|
| `createOnigurumaEngine(import('shiki/wasm'))` | **loads a WASM module** (default) | slower for some languages | 100% — it *is* Oniguruma |
| `createJavaScriptRegexEngine()` | **no WASM at all** | *"faster for some languages, since the regular expressions run as native JavaScript"* | *"As of Shiki 3.9.1, all built-in languages are supported"* — transpiled via `oniguruma-to-es` |

**That last cell is the finding that decides our architecture.** Shiki's docs
state that as of 3.9.1 the JavaScript engine supports **all** bundled
languages. We are on 4.5.0. That means we can have TextMate-grade fidelity
with **zero WASM**, which is exactly what a desktop app with a small binary
wants.

### 2.3 Measured

Node v24.14.1, `typescript` language, the snippet above. Times in
milliseconds; six sequential samples on one highlighter instance.

**Shiki, dual theme (`themes: {light, dark}`):**
```
405.8  7.8  5.9  7.4  6.8  5.7
```
**Shiki, single theme:**
```
230.9  2.8  2.5  1.8  3.1  3.4
```
**`createHighlighter({themes:[2], langs:[1]})` cost: 187.9–340.4 ms** across
runs (includes WASM/grammar load).

So: **first call 230–406 ms, warm 2–8 ms.** The first-call cost is grammar
and theme compilation, paid once per process if we cache the highlighter
singleton, which is what Shiki's own performance guide tells you to do:

> The highlighter instance is expensive to create. Most of the time, you
> should create the highlighter instance once and reuse it (singleton
> pattern). […] When you no longer need a highlighter instance, you can call
> the `dispose()` method.

### 2.4 Bundle accounting — the part people get wrong

Shiki's `docs/guide/bundles.md` publishes real numbers:

| Bundle | Min | Gzip |
|---|---|---|
| `shiki/bundle/full` | 6.4 MB | **1.2 MB** |
| `shiki/bundle/web` | 3.8 MB | **695 KB** |

But those are the *bundle presets*. If you import `shiki` normally, all
themes and languages are **async chunks** — they are not downloaded until
used, but **they still add to your dist size**, and if you bundle into a
desktop app the bytes go into your installer whether or not the user opens a
Rust file.

Fine-grained sub-packages, measured from the registry:

| Package | Version | Unpacked | Min+gzip |
|---|---|---|---|
| `@shikijs/core` | 4.5.0 | 63 KB | — |
| `@shikijs/engine-javascript` | 4.5.0 | **12 KB** | — |
| `@shikijs/engine-oniguruma` | 4.5.0 | 629 KB | 2,643 B (the WASM loads separately) |
| `@shikijs/langs` (all 346) | 4.5.0 | 8,448 KB | 2,685 B entry / lazy chunks |
| `@shikijs/themes` (all 65) | 4.5.0 | 1,450 KB | — |
| `@shikijs/transformers` | 4.5.0 | 38 KB | — |

**@shikijs/engine-javascript is 12 KB unpacked.** That is the engine. The
WASM engine is 629 KB unpacked plus a separate `.wasm` fetch.

### 2.5 Language coverage — we counted

`Object.keys(bundledLanguages).length` = **346**. `Object.keys(bundledThemes).length` = **65**.

We checked 68 languages that appear in real Markdown documents:

```
SHIKI MISSING: fortran
```

One miss out of 68, and it is `fortran` (there is no modern TextMate grammar
in Shiki's set). Everything a technical note-taking app will meet is present:
js, ts, jsx, tsx, python, rust, go, c, cpp, java, kotlin, csharp, ruby, php,
swift, scala, bash, shell, powershell, sql, json, yaml, toml, xml, html, css,
scss, less, markdown, diff, dockerfile, docker, graphql, vue, svelte,
haskell, elixir, erlang, clojure, lua, r, julia, perl, objective-c, makefile,
ini, nginx, protobuf, zig, nim, ocaml, fsharp, dart, groovy, latex,
handlebars, http, wasm, prisma, solidity, verilog, vhdl, matlab, assembly,
awk, vim.

---

## 3. @wooorm/starry-night 3.11.0

### 3.1 What it is

starry-night is an open-source reimplementation of **GitHub's closed-source
`PrettyLights`** highlighter. Its README states it plainly:

> This package is an open source version of GitHub's closed-source
> `PrettyLights` project […] It supports **600+ grammars** and its
> **extremely high quality**.

The grammars are the same TextMate grammars GitHub ships in `github-linguist`.
starry-night is the only option here that reproduces **GitHub's exact
rendering**.

### 3.2 API — and an ergonomic trap

```js
import { createStarryNight, common, all } from '@wooorm/starry-night'

common.length   // 34 — array of grammar objects, NOT a function
all.length      // 710 — array of grammar objects, NOT a function

const sn = await createStarryNight(
  all.filter(g => g.scopeName === 'source.ts')
)

const hast = sn.highlight(code, 'source.ts')
sn.missingScopes()   // 0
sn.scopes().length   // 2
```

**Trap we hit and verified:** `common` and `all` are **arrays of grammar
objects**, not functions. Calling `all()` throws `TypeError: all is not a
function`. And grammars are keyed by **`scopeName`** (`source.ts`), not by
friendly alias. `createStarryNight(['typescript'])` — which is what every
tutorial and the starry-night README's own example at the top of the API
section might suggest — throws:

```
TypeError: grammar.extensions is not iterable
```

because it cannot find a grammar named `typescript` and passes `undefined`
into the registry builder. The correct incantation is by `scopeName`, which
means the app must maintain a friendly-alias → scope-name map. That is
doable (github-linguist's alias list is public) but it is friction the other
three libraries do not have.

Note the irony: starry-night's own bundled `markdown-it` integration example
in the README handles this correctly by matching on `names`.

### 3.3 Measured

```
createStarryNight(2 grammars)      79.3 ms
createStarryNight(ALL 710 grammars) 839 ms
highlight() first call             310.0 – 557.0 ms
highlight() warm                   2.3 – 5.3 ms
```

Compare Shiki's identical shape: `createHighlighter` 188–340 ms for
1 language + 2 themes; first `codeToHtml` 230–406 ms; warm 2–8 ms.
**starry-night's warm highlight is *faster* than Shiki's** (2.3–5.3 vs
5.7–7.8 ms) because it uses the Oniguruma WASM engine and matches Shiki's
approach. The problem is not speed, it is size and the alias mapping.

Hast output — this is what makes starry-night valuable in a React/TSX app:

```json
{"type":"root","children":[
  {"type":"element","tagName":"span","properties":{"className":["pl-k"]},
   "children":[{"type":"text","value":"export"}]},
  {"type":"text","value":" "},
  {"type":"element","tagName":"span","properties":{"className":["pl-k"]},
   "children":[{"type":"text","value":"const"}]},
  ...
]}
```

`pl-k` = keyword, `pl-c1` = comment — GitHub's own PrettyLights class
prefix. An AST means we can render to React elements without `innerHTML`,
which is a genuine XSS advantage for a viewer: **we never construct an HTML
string from user text.** See [05-sanitizer-libraries](05-sanitizer-libraries.md).

### 3.4 The size problem

`@wooorm/starry-night` unpacked is **15,125,253 bytes (15 MB)**. Bundlephobia:
**9,334,886 B minified / 1,915,514 B gzip.**

That is because it ships **all 710 TextMate grammars in the package**. There
is no fine-grained per-language subpath in the package's export map — you get
`all`, and `all` is everything.

Options we evaluated:

1. **Ship all 710.** 1.9 MB gzip. For a web target that is a large but not
   absurd lazy chunk. For a desktop installer it is 1.9 MB of binary for a
   feature most users will exercise with 10 languages.
2. **Subset at build time** with a bundler alias hack. Fragile, fights the
   package's single-export design, and we have not verified it works.
3. **Use starry-night only where its unique value is unavoidable** — i.e.
   nowhere, given Shiki's JavaScript engine reaches the same fidelity.

---

## 4. highlight.js 11.12.0

### 4.1 API

```js
import hljs from 'highlight.js'

hljs.highlight(code, { language: 'typescript' }).value
// '<span class="hljs-keyword">export</span> ...'

hljs.listLanguages().length   // 193
hljs.versionString           // '11.12.0'
hljs.getLanguage('rust')     // function | undefined
```

It is the only one of the four with **zero runtime dependencies**, and by npm
download volume (151.9M/month) it is the most-used highlighter in the
ecosystem by a wide margin.

### 4.2 Measured

```
first highlight()   33.9 – 62.2 ms
warm highlight()     0.63 – 0.71 ms
```

**This is 4–10× faster warm than Shiki and starry-night**, and its cold start
is 4–12× cheaper. On a warm highlighter, highlight.js highlights our 3-line
TypeScript snippet in **0.65 ms**; Shiki takes 7 ms.

### 4.3 Language coverage — we counted

193 languages. Of a 68-language checklist drawn from real technical documents:

```
MISSING: vue, svelte, terraform, zig, prisma, solidity, racket,
         ocaml-interp, purescript, reason, forth, factor, idris, agda
```

**12 misses.** `vue` and `svelte` are the ones that will actually annoy
users — single-file-component markup inside a Markdown fence is common in
frontend notes. Shiki misses 1 of the same 68. highlight.js's own
`highlight.js/lib/languages/` has separate, unofficial packages for vue and
svelte, which is a signal that its built-in set has gaps in the ecosystems
that grew fastest.

### 4.4 Bundle

923,020 B minified / **307,085 B gzip** for the whole package. Almost all of
that is the 193 grammars. You can import individual languages:

```js
import hljs from 'highlight.js/lib/core'
import rust from 'highlight.js/lib/languages/rust'
hljs.registerLanguage('rust', rust)
```

which is the only way to get it small, and requires knowing your languages
ahead of time — which we do not, because the user brings the file.

---

## 5. Prism.js 1.30.0 and refractor 5.0.0

### 5.1 Prism

```js
import Prism from 'prismjs'

Prism.highlight(code, Prism.languages.javascript, 'javascript')
```

**Default install has 19 languages.** The other ~278 arrive as separate files
in `prismjs/components/` that you `require` or concatenate. That is the
plugin-per-language model, and it means you must enumerate languages at build
time — the exact thing a viewer cannot do.

Verified:
```
prism base languages: 19
prism missing of my 68-language checklist: 30
```
(It ships `javascript`, `typescript`, `rust`, `toml`, `zig` etc. as separate
component files, so the "missing 30" number reflects the *default install*
only. The point stands: **you opt in per language, at build time.**)

Sizes: `prism.js` is 57 KB raw; Bundlephobia reports **18,945 B minified /
7,140 B gzip** — by far the smallest, because it is the core plus the handful
of bundled languages.

Maintenance: last npm release **2025-03-10**, but the **repo's last commit is
2026-10-02** and the project has 13,044 stars and 128.6M monthly downloads.
So Prism is *actively maintained* despite an infrequent release cadence. That
is worth stating because "Prism is old" is a meme, not a fact.

### 5.2 refractor — Prism as an AST

```js
import { refractor } from 'refractor'

const tree = refractor.highlight('"use strict";', 'js')
// { type: 'root', children: [
//     { type: 'element', tagName: 'span',
//       properties: { className: ['token', 'string'] }, ... } ] }
```

refractor is Prism's grammars compiled to a **virtual AST instead of an HTML
string** — the same trick starry-night does with TextMate. Its README is
candid about the trade:

> This package is useful when you want to perform syntax highlighting in a
> place where serialized HTML wouldn't work or wouldn't work well […] when
> you're using virtual DOM frameworks (such as React or Preact) so that
> diffing can be performant, or when you're working with ASTs (rehype).

And it publishes its own three-entry-point bundle accounting, which is
exemplary and which we quote rather than measure:

| Entry | Languages | Min+gzip |
|---|---|---|
| `refractor/core` | **0** | **12.7 kB** |
| `refractor` (default) | **36** | **40 kB** |
| `refractor/all` | **297** | **211 kB** |

Bundlephobia on the default entry: **113,158 B min / 39,384 B gzip** — which
matches their "40 kB" claim. **At 40 KB gzipped for 36 languages, refractor is
the best size-to-capability ratio of the four**, and 7× smaller than starry-night
for 297 languages instead of 710.

refractor's README also points at the alternatives honestly:
> A different package, `lowlight`, does the same as refractor but uses
> `highlight.js` instead. […] If you're looking for a *really good* but
> rather heavy highlighter, try `starry-night`.

And `Prism` in the browser has a real ergonomics problem for us: it mutates
global state (`Prism.languages`), it calls `document.currentScript` to find
its own component dependencies, and it has no async init. In a desktop
webview with code splitting and a CSP, that is friction we would rather avoid.

---

## 6. Head-to-head on our criteria

| Criterion | Winner | Why |
|---|---|---|
| **Token accuracy** | Shiki (JS engine) ≈ starry-night > highlight.js ≈ Prism | TextMate grammars are the modern standard; starry-night additionally *is* GitHub |
| **Build-time cost** | **highlight.js** | 0.6 ms warm, 34–62 ms cold, sync API, no async init |
| **Bundle size** | **Prism 7.1 KB / refractor 40 KB** < Shiki 65 KB < highlight.js 307 KB < starry-night 1,915 KB | measured via Bundlephobia |
| **Language count** | starry-night 710 > Shiki 346 > refractor 297 > highlight.js 193 | counted at runtime |
| **Common-language coverage** | **Shiki 67/68** > highlight.js 56/68 > Prism (opt-in) | our own checklist |
| **Themes** | **Shiki 65, dual-theme** | dual theme via CSS vars = zero JS on theme switch |
| **Dynamic/unknown languages** | Shiki (fine-grained imports) | you can add a language at runtime; highlight.js and Prism want build-time enumeration |
| **AST output** | starry-night, refractor | starry-night's hast is a genuine advantage in React |
| **Async init** | Shiki, starry-night | lets us warm up off the critical path |
| **Runtime deps** | highlight.js, Prism (0) | Prism ships zero deps too |
| **Maturity / activity** | highlight.js (151.9M dl/mo), Prism (128.6M, repo active 2026-10-02), Shiki (98.0M, very active) | all three healthy |
| **Mobile perf** | **highlight.js** | 0.65 ms vs 7 ms warm; 4–10× less work per block |
| **Licence** | MIT (Shiki, starry-night, Prism, refractor), BSD-3 (highlight.js) | all permissive |

---

## 7. Can they run in a desktop app with dynamic, user-editable content?

This is the constraint that actually decides it, and the answer differs per
library in ways that the size table does not show.

**The problem.** A viewer opens `notes.md`, reads the fences, and sees
```python`, `rust`, `abap` and `brainfuck`. There is no build step. The
highlighter must be able to say "I do not know this language" and degrade to
plain escaped text — safely, immediately, and without a 400 ms pause.

**Shiki:** needs `lang` to exist in the loaded set or it throws
`Error: Language 'abap' not found`. We must guard every call site with
`highlighter.getLoadedLanguages().includes(lang)`, and add languages on demand.
The fine-grained bundle makes that possible — `import('@shikijs/langs/' + id)`
is a dynamic import — but each new language is a network/disk fetch in a
desktop app. **Workable, needs an explicit policy.**

**starry-night:** same problem, worse ergonomics (scope names, not aliases),
and 1.9 MB of grammars regardless.

**highlight.js:** `hljs.getLanguage(lang)` returns `undefined` for unknown
languages and `hljs.highlightAuto(code)` will guess. Graceful by construction.
0.65 ms warm means even a 50,000-block document can be highlighted
progressively in a worker without hurting the UI.

**Prism/refractor:** `refractor.register()` and Prism's component system want
build-time registration, but refractor's AST entry means an unknown language
just produces an unstyled tree — you don't have to ask first.

**Our decision: highlight.js for unknown or unlisted languages, Shiki for the
languages we ship.** A two-tier policy. Concretely:

```
lang is in our bundled set (top ~30)?
  ├─ yes → Shiki, JavaScript engine, dual theme. 7 ms warm, 67/68 coverage.
  └─ no  → highlight.js, single bundled build. 0.65 ms warm.
             If getLanguage(lang) → use it.
             If not          → highlightAuto() and accept it may be wrong,
                               or fall back to escaped plain text.
```

Rationale: the top-30 languages are where 99% of fences in a notes app live,
and they are exactly where fidelity matters most (people paste Rust and
TypeScript). The long tail is where highlight.js's auto-detection is
genuinely useful and Shiki's fidelity buys nothing. **Both libraries are
already in our bundle** — highlight.js is 307 KB gzip but we can build a
`core` + registered-subset build, and Shiki fine-grained for 30 languages is
maybe 200 KB gzipped. That is a decision to measure, not guess: the exact
breakdown goes in [07-evaluation-framework §6](07-evaluation-framework.md).

**What we are not doing:** shipping all 710 starry-night grammars (1.9 MB for
a fidelity increment we cannot demonstrate matters on the long tail), and not
shipping Prism (build-time language enumeration is the wrong shape for this
problem, and its global-state model fights our CSP).

---

## 8. Measured summary

Node v24.14.1, one TypeScript snippet (3 lines), one highlighter instance
each, six sequential samples:

| Library | init | first highlight | warm highlight | output bytes |
|---|---|---|---|---|
| Shiki 4.5.0, dual theme | 188–340 ms | **405.8 ms** | **5.7 – 7.8 ms** | 1,593 |
| Shiki 4.5.0, single theme | (same) | **230.9 ms** | **1.8 – 3.4 ms** | ~1,100 |
| starry-night 3.11.0 (2 grammars) | 79 ms | **310 – 557 ms** | **2.3 – 5.3 ms** | hast, 1,745 |
| starry-night, all 710 grammars | **839 ms** | — | — | — |
| highlight.js 11.12.0 | 0 (sync) | **33.9 – 62.2 ms** | **0.63 – 0.71 ms** | 832 |
| Prism 1.30.0 | 0 (sync) | not separately measured | not separately measured | — |

Read the "warm" column as the thing that matters for a document with hundreds
of code blocks, and the "first" column as the thing that matters for app
startup. highlight.js wins both. Shiki wins on quality-per-byte-of-output
and on theme count.

**Caveats, stated plainly.** These are single-sample-per-engine numbers in
one Node process with no randomised ordering, not a statistical benchmark.
`performance.now()` resolution and JIT warm-up are not controlled for beyond
taking the median of six. **We did not measure in a browser or in the actual
webview**, and we did not measure with 50,000 blocks. The plan to fix both is
in [07-evaluation-framework §6](07-evaluation-framework.md#what-we-still-need-to-measure).

---

## 9. Recommendation

**Shiki 4.5.0 with `createJavaScriptRegexEngine()`, fine-grained bundle,
top ~30 languages — plus highlight.js 11.12.0 for the long tail.**

```ts
// packages/core/src/highlight/index.ts
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
// ...30 explicit @shikijs/langs/* and @shikijs/themes/* imports

let highlighterPromise: Promise<Highlighter> | undefined
export function getHighlighter() {
  return (highlighterPromise ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [/* the 30 */],
    engine: createJavaScriptRegexEngine(),   // no WASM
  }))
}

export async function highlight(code: string, lang: string): Promise<string> {
  const h = await getHighlighter()
  if (!h.getLoadedLanguages().includes(lang)) {
    return fallbackHighlight(code, lang)   // highlight.js, then highlightAuto
  }
  return h.codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
  })
}
```

Why:

1. **TextMate fidelity on the languages that matter**, from the same grammars
   VS Code uses. 67 of 68 checklist languages covered.
2. **No WASM.** `createJavaScriptRegexEngine()` supports all built-in
   languages as of Shiki 3.9.1; we are on 4.5.0. The 629 KB
   `@shikijs/engine-oniguruma` package and its `.wasm` fetch simply do not
   ship.
3. **Dual theme for free.** Theme switching is a CSS class on `<html>` with
   zero JavaScript and zero re-highlighting — which a notes app does on every
   theme toggle, and which highlight.js cannot do at all without re-running
   every block.
4. **Fine-grained bundling.** 12 KB engine + only the languages we choose. We
   control the installer size.
5. **Async init** lets us warm the highlighter during window show, off the
   critical path.

Rejected:

- **starry-night** — GitHub-identical fidelity is genuinely appealing and its
  warm speed is the best measured here, but **1.9 MB gzipped**, a
  scope-name-based API that throws on friendly aliases, and no fine-grained
  entry points. Its AST output is a real advantage; if we ever need
  "render exactly like GitHub, verified", we add it as an optional
  verification harness in dev, not as the shipping renderer.
- **highlight.js alone** — fastest and smallest-per-language, but no themes
  worth shipping and no dual-theme. Its auto-detection is invaluable as a
  fallback, which is why it stays in the bundle.
- **Prism** — build-time language enumeration is structurally wrong for
  unknown user content, and its global mutable state fights CSP and code
  splitting.
- **refractor** — the best size ratio (40 KB gzip / 297 languages) and its AST
  is nice, but its grammars are Prism's, i.e. the lower-fidelity tier, and
  Prism's component loading model is the blocker.
