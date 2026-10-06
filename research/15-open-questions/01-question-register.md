# 01 · Question Register

> Sixty questions, none of them hidden. Each has an owner, a status, a
> deadline, and the ADR that will resolve it.

**How to read an entry**

- **Question** — the decision, phrased so it can be answered.
- **Why it matters** — the cost of getting it wrong, or of not deciding.
- **Options** — the real options, not strawmen.
- **Evidence we have** — graded `[V]` verified / `[M]` measured / `[I]` inferred
  / `[A]` anecdotal / `[?]` missing. See [`../README.md`](../README.md).
- **Evidence missing** — what we would need before deciding properly.
- **Owner · Deadline · Status · ADR** — the mechanics.

**Status values:** `open` · `researching` · `decided` · `deferred` · `obsolete`

---

## Index

| Q | Section | Question | Owner | Deadline | Status |
|---|---|---|---|---|---|
| Q-01 | A · Rendering | Which Markdown parser is the core parser? | core | 2026-11-15 | open |
| Q-02 | A · Rendering | Which desktop shell: Tauri, Electron, or something else? | project-lead | 2026-11-15 | open |
| Q-03 | A · Rendering | Rust core or TypeScript core? | core | 2026-11-15 | open |
| Q-04 | A · Rendering | Which dialects ship on by default? | core | 2027-01-15 | open |
| Q-05 | A · Rendering | How do we handle `---` ambiguity (thematic break vs setext vs YAML front matter)? | core | 2027-01-15 | open |
| Q-06 | A · Rendering | Does v1 support editing at all? | project-lead | 2026-11-15 | open |
| Q-07 | A · Rendering | Do we support raw HTML, and in what mode? | security | 2027-01-15 | open |
| Q-08 | A · Rendering | Do we support wikilinks `[[…]]`? | project-lead | 2027-03-31 | open |
| Q-09 | A · Rendering | Which syntax highlighting engine, and is it in `core`? | core | 2027-03-31 | open |
| Q-10 | A · Rendering | Math: KaTeX, MathJax, or neither in v1? | core | 2027-01-15 | open |
| Q-11 | A · Rendering | Mermaid and other diagram languages in-process? | core | 2027-06-30 | open |
| Q-12 | A · Rendering | Footnotes: GFM-native or the extension? | core | 2027-01-15 | open |
| Q-13 | A · Rendering | What is the `maxFileBytes` truncation threshold? | perf | 2027-03-31 | open |
| Q-36 | A · Rendering | Our own block patcher, or a VDOM? | ui | 2027-01-15 | open |
| Q-37 | A · Rendering | Live preview: CodeMirror 6 or ProseMirror? | ui | 2027-06-30 | open |
| Q-38 | A · Rendering | Do remote images load by default? | product | 2027-01-15 | open |
| Q-39 | A · Rendering | Is `content-visibility: auto` safe with our measurement code? | ui | 2027-01-15 | open |
| Q-40 | A · Rendering | Print / PDF output — how far? | product | 2027-06-30 | open |
| Q-41 | A · Rendering | Do we ship EPUB export in v1? | product | 2027-03-31 | open |
| Q-14 | B · Repo | Is Turborepo's Cargo inference reliable enough? | build | 2026-11-15 | open |
| Q-15 | B · Repo | Does `minimumReleaseAge` block security patches? | build | 2027-01-15 | open |
| Q-16 | B · Repo | Does Bun save meaningful CI time here? | build | 2027-06-30 | deferred |
| Q-17 | B · Repo | One `core` or a second WASM renderer? | core | 2028-03-31 | deferred |
| Q-18 | B · Repo | Is `SanitizedDocument` a distinct type? | core | 2027-01-15 | open |
| Q-19 | B · Repo | Shared config package lifetime — does it grow into a landfill? | core | 2028-03-31 | deferred |
| Q-20 | B · Repo | ESLint+Prettier or Biome/Oxlint? | core | 2027-06-30 | open |
| Q-21 | C · Filesystem | Web target: Chromium-only is acceptable? | product | 2027-03-31 | open |
| Q-22 | C · Filesystem | Atomic save on non-atomic platforms — backup or refuse? | desktop | 2027-01-15 | open |
| Q-23 | C · Filesystem | Tauri IPC binary overhead for large files? | desktop | 2026-11-15 | open |
| Q-24 | C · Filesystem | iOS: `NSFileCoordinator` or re-stat-on-resume? | mobile | 2028-03-31 | deferred |
| Q-25 | C · Filesystem | One shadow backup, or rotation? | product | 2027-06-30 | deferred |
| Q-26 | C · Filesystem | Do users want per-workspace bookmarks? | product | 2027-06-30 | deferred |
| Q-27 | C · Filesystem | Workspace write frequency — every scroll settle or on close? | ui | 2027-01-15 | open |
| Q-28 | C · Filesystem | Is `navigator.storage.persist()` worth a prompt? | web | 2027-03-31 | deferred |
| Q-29 | C · Filesystem | Does search force SQLite? | build | 2027-06-30 | deferred |
| Q-30 | C · Filesystem | Should workspace state live beside the notes (git)? | product | 2027-06-30 | open |
| Q-31 | D · Search | Regex, field-scoped, fuzzy — which in v1? | product | 2027-01-15 | open |
| Q-32 | D · Search | What is the real distribution of workspace sizes? | product | 2027-06-30 | deferred |
| Q-33 | D · Search | Is MiniSearch viable on low-end Android? | mobile | 2028-03-31 | deferred |
| Q-34 | D · Search | BM25 or recency/path ranking? | product | 2027-06-30 | deferred |
| Q-35 | D · Search | When is the tier-(c) index gate? | project-lead | 2027-03-31 | open |
| Q-42 | E · Platform | Can `ubuntu-24.04-arm` run our containerised Linux build? | build | 2027-01-15 | open |
| Q-43 | E · Platform | Is `webkit2gtk-4.1` available on Ubuntu 22.04 arm64? | build | 2027-01-15 | open |
| Q-44 | E · Platform | Exact schema of Tauri's generated `bundle.json`? | build | 2026-11-15 | open |
| Q-45 | E · Platform | Does the Microsoft Store accept NSIS, or do we need MSIX? | project-lead | 2027-06-30 | deferred |
| Q-46 | E · Platform | Minimum OS versions: Windows 10, 11, glibc, WebKitGTK? | product | 2027-01-15 | open |
| Q-47 | E · Platform | Release cadence — and how does SmartScreen reputation need it? | project-lead | 2027-01-15 | open |
| Q-48 | F · Scope | Desktop-first or mobile-first sequencing? | project-lead | 2026-11-15 | open |
| Q-49 | F · Scope | Do we support `.mdx`, `.qmd`, `.txt`? | core | 2027-03-31 | open |
| Q-50 | F · Scope | Notebook formats (`.ipynb`)? | product | 2027-06-30 | deferred |
| Q-51 | F · Scope | Is a single-document mode a real product or a fallback? | product | 2027-01-15 | open |
| Q-52 | F · Scope | Scope-creep guard: what is explicitly out of scope for Phase 1? | project-lead | 2026-11-15 | open |
| Q-53 | F · Scope | Plugin/theme ecosystem — ever? | project-lead | 2028-06-30 | deferred |
| Q-54 | F · Scope | Do we sync documents between tabs/windows in one process? | ui | 2027-03-31 | open |
| Q-55 | F · Scope | Accessibility bar: WCAG 2.2 AA floor or AAA target? | design | 2027-01-15 | open |
| Q-56 | F · Scope | Screen-reader testing budget — who, how, how often? | project-lead | 2027-01-15 | open |
| Q-57 | F · Scope | How do we handle the Siyana ecosystem's other apps? | community | 2027-03-31 | open |
| Q-58 | F · Scope | Domain name and website hosting? | project-lead | 2026-12-15 | open |
| Q-59 | G · Identity | Product name: "Siyana Markdown Viewer" or "Siyana Markdown"? | project-lead | 2026-12-15 | open |
| Q-60 | G · Identity | Bundle identifier and reverse-DNS: `dev.siyana.*`? | project-lead | 2026-12-15 | open |
| Q-61 | G · Identity | Keep MIT, or move to a source-available licence? | project-lead | 2027-01-15 | open |
| Q-62 | G · Identity | CLA: required, DCO, or neither? | community | 2027-03-31 | open |
| Q-63 | G · Identity | Telemetry: none at all, or opt-in? | project-lead | 2027-01-15 | open |
| Q-64 | G · Identity | Crash reporting: Sentry, or a local crash log + user paste? | security | 2027-03-31 | open |
| Q-65 | G · Identity | Localization: which languages, and which pipeline? | community | 2027-06-30 | open |
| Q-66 | G · Identity | Funding: sponsors, grants, paid tier, donations? | project-lead | 2027-06-30 | open |
| Q-67 | G · Identity | Governance: who can merge, who can release? | community | 2027-01-15 | open |
| Q-68 | G · Identity | Contributor onboarding path for a Rust+TS codebase | community | 2027-03-31 | open |
| Q-69 | G · Identity | Documentation as a deliverable or an afterthought? | docs | 2027-03-31 | open |
| Q-70 | G · Identity | Security disclosure process and SLA | security | 2027-01-15 | open |
| Q-71 | G · Identity | Dependency policy: Dependabot, review SLA, licence scanning | security | 2027-01-15 | open |
| Q-72 | G · Identity | Bus factor: what if the one Rust maintainer leaves? | project-lead | 2027-03-31 | open |
| Q-73 | G · Identity | Good-first-issue strategy and issue triage load | community | 2027-03-31 | open |
| Q-74 | G · Identity | How do we answer "why not Obsidian?" honestly? | product | 2027-03-31 | open |
| Q-75 | G · Identity | Feature requests: how do we say no in public? | community | 2027-03-31 | open |
| Q-76 | G · Identity | Binary reproducibility — is it a goal? | build | 2027-06-30 | deferred |
| Q-77 | G · Identity | AppImage vs `.deb` vs Flatpak priority for v1 | project-lead | 2027-01-15 | open |
| Q-78 | G · Identity | Store listings: who owns the accounts? | project-lead | 2027-06-30 | deferred |

---

## A · Rendering & parsing

<a id="q-01"></a>
### Q-01 · Which Markdown parser is the core parser?

**Why it matters.** Every output byte depends on this choice. Swapping parsers later
means rewriting the golden tests, re-auditing the sanitize interaction, and
re-deriving the position map (doc 06 §4). It is the highest-leverage and most
expensive-to-reverse decision in the project.

**Options.**
1. `micromark` (4.0.2) — state machine, concrete tokens with positional info,
   100% CommonMark, GFM/MDX/math/frontmatter extensions, fuzz-tested. ESM-only.
   Needs `mdast-util-from-markdown` for an AST.
2. `markdown-it` — CommonMark-compliant, mature plugin ecosystem, larger, token
   stream with inline `map` positions.
3. `marked` — oldest, fastest, **does not match CommonMark or GFM**, unsafe by
   default (per its own docs). Rejected on conformance.
4. `comrak` (0.46.x, Rust) — BSD-2-Clause, cmark-gfm port, exposes an AST,
   but then it is a Rust core (Q-03).
5. `markdown-rs` (crate `markdown`, v1.0.0, MIT) — the Rust sibling of
   micromark; same architecture, same guarantees, `no_std` + alloc.

**Evidence we have.** `[V]` micromark's README states 100% CommonMark compliance,
"smallest CM parser at ±14kb", concrete tokens with positional info, ±2k tests
with 100% coverage and fuzz testing, and explicit "safe by default" HTML handling.
`[V]` markdown-it is described by the micromark maintainers as "good, stable,
essentially CommonMark compliant… rather big. Shines at syntax extensions."
`[V]` marked is described as "the oldest markdown parser on the block… doesn't
match CommonMark or GFM, and is unsafe by default." `[I]` All of the JS
candidates are pure ESM, so Vite/Rollup handle them; none needs a native module.

**Evidence missing.** `[M]` Our own benchmark harness on our corpus, including
pathological inputs. `[?]` Which extensions we actually need (feeds Q-04, Q-10,
Q-12). `[?]` Real measured position-map fidelity from each parser.

**Owner** core · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0004-markdown-parser-strategy.md`

---

<a id="q-02"></a>
### Q-02 · Which desktop shell: Tauri, Electron, Flutter, Wails, native?

**Why it matters.** Determines install size, memory, WebView fragmentation,
security model, auto-updater, Linux distro reach, and the entire Rust-vs-JS
balance of the project. Re-platforming after Phase 1 is a re-platform.

**Options.** Tauri 2.12 (system webview, Rust backend, ~10 MB installs);
Electron 44 (bundled Chromium, consistent behaviour, ~150 MB installs);
Flutter (own renderer, poor Markdown/HTML fidelity, big);
Wails (Go + webview, thinner ecosystem);
native (Qt/GTK, no shared core).

**Evidence we have.** `[V]` Tauri 2.12 shipped 2026-09-26; MSRV raised to 1.90,
Windows 7 dropped, Gradle 8.13 minimum, default iOS minimum 15.0. `[V]` Tauri
uses the *system* webview: WebView2 on Windows, `WKWebView` on macOS/iOS,
`webkit2gtk` (API 4.1, ≥ 2.40) on Linux — so Linux distro support is bounded by
what the distro ships, and Tauri's own issue tracker documents a hard wall for
RHEL 9 (glib 2.68 vs soup3's glib 2.70 requirement). `[V]` Electron 44.5.1
(2026-09-29) ships Chromium 152 and provides Linux **x64 and arm64** binaries;
Electron 44 removed Windows ia32 and Linux armv7l. `[V]` Tauri's AppImage docs
warn that glibc sets the minimum Linux version and recommend building on the
oldest baseline providing `webkit2gtk-4.1` (Ubuntu 22.04 / Debian 12).

**Evidence missing.** `[M]` Actual install size, cold-start time, and idle memory
for a real build of our app in both. `[M]` Rendering fidelity of our specific
CSS features across WebView2 / WebKitGTK. `[?]` How many users we would lose on
old distros by requiring WebKitGTK 4.1.

**Owner** project-lead · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md`

---

<a id="q-03"></a>
### Q-03 · Rust core or TypeScript core?

**Why it matters.** Determines who can contribute, how the core is tested,
whether the web and mobile targets share the same renderer, and how much of the
team can debug it.

**Options.** (a) Pure TS core; (b) Rust→WASM for all three;
(c) Rust native + WASM dual build; (d) split — TS for AST→DOM, Rust for
text-in/text-out.

**Evidence we have.** `[V]` WASM is synchronous from JS, so a WASM parser would
block the JS thread exactly like a JS parser — the "WASM is async" belief is
wrong (doc 02 §4). `[V]` Tauri gives off-thread Rust for free via `invoke`, which
is the strongest technical argument for a Rust core. `[V]` wasm-pack 0.15.0
(May 2026) and wasm-bindgen 0.2.128 are healthy; `-Cpanic=unwind` on wasm now
requires Node 22.22.3+ for `WebAssembly.JSTag`. `[I]` Bundle size: a WASM parser
is ~5–10× a JS parser, which is a poor answer to a size problem.

**Evidence missing.** `[M]` Parse time for our 5 MB reference document in each
option, on the slowest supported machine. `[?]` Whether Tauri `invoke` overhead
makes the native-Rust path slower than a Worker for our workload.

**Owner** core · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0006-shared-core-language.md`

---

<a id="q-04"></a>
### Q-04 · Which Markdown dialects ship on by default?

**Why it matters.** Defaults are product identity. Enabling GFM means GitHub
tables and task lists render; disabling it means a document written on GitHub
looks wrong in our reader, which is a support ticket.

**Options.** CommonMark only; CommonMark + GFM (tables, strikethrough,
autolink literals, tasklists, `tagfilter`); GFM + footnotes + math + frontmatter;
everything with a settings UI.

**Evidence we have.** `[V]` GFM defines five extensions to CommonMark. `[V]`
`comrak`'s CLI shows the extension set it supports and defaults to none enabled.
`[I]` For a *viewer* the GFM set is nearly free (parsers implement it) and its
absence is conspicuous.

**Evidence missing.** `[M]` Frequency of each construct in the corpora we can
find (public technical corpora, our own notes). `[?]` Whether users want a
settings UI for dialects at all, or one correct behaviour.

**Owner** core · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0004-markdown-parser-strategy.md`

---

<a id="q-05"></a>
### Q-05 · How do we handle `---` ambiguity?

**Why it matters.** `---` is a thematic break, a setext H2 underline, a YAML
front-matter fence, a table delimiter, or a list-item marker depending on
context. Getting it wrong mangles real documents, and front matter is the most
common source of "the first heading is missing" bugs in Markdown tools.

**Options.** (1) Front matter only when `---\n…\n---` appears at byte 0 (YAML's
actual rule) — the narrowest and most correct. (2) Same plus `+++` for TOML and
`;;;` for JSON. (3) A setting for "treat leading `---` as front matter".

**Evidence we have.** `[V]` YAML front matter is defined as a `---` document
start at the very beginning of the stream. `[I]` A leading `---` at byte 0 is
far more likely to be front matter than a thematic break, because a document
*starting* with a thematic break is unusual and a document starting with
front matter is extremely common. `[V]` CommonMark resolves the rest
deterministically given the parser.

**Evidence missing.** `[A]` Anecdotal reports of real files starting with `---`
as a break. `[?]` Whether to allow front matter after a BOM or leading
whitespace, and what to do with `---\n---`.

**Owner** core · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0008-frontmatter-and-ambiguous-hyphens.md`

---

<a id="q-06"></a>
### Q-06 · Does v1 support editing at all?

**Why it matters.** This is the largest single scope question. Editing roughly
doubles the filesystem surface (atomic save, autosave, dirty tracking, conflict
handling, recovery files — doc 03 §7), adds an editor dependency, and adds
crash-data-loss risk. A viewer that also edits is a worse viewer until it is a
very good editor.

**Options.** (1) Viewer only. "Plain text is sacred" is strongest. (2) Viewer +
minimal editing (CodeMirror, explicit save only). (3) Full editing with autosave
and live preview. (4) Viewer, with "open in your editor" as the editing story.

**Evidence we have.** `[I]` The README already promises "keyboard first,
accessible, one core three shells" — none of which requires editing.
`[V]` Competitors split: mdBook and Dillinger are viewers; Typora and Obsidian
are editors. `[I]` Editing in a webview is where IME, selection-across-blocks,
and accessibility get hardest (doc 06 §7.6's caret invariant).

**Evidence missing.** `[A]` What users actually asked for in the issue tracker —
"viewer" vs "editor" is a positioning question, not a technical one.
`[?]` Demand from the Siyana ecosystem's existing users, who come from an editor
background.

**Owner** project-lead · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0009-editing-in-v1.md`

---

<a id="q-07"></a>
### Q-07 · Do we support raw HTML, and in what mode?

**Why it matters.** A security posture, a UX promise, and a compatibility
decision at once. Escape-only breaks documents that use HTML for layout; allow-all
is an XSS hole in a tool whose whole value proposition is reading untrusted
files.

**Options.** (1) `escape` — show `<b>x</b>` as text. Safest, least compatible.
(2) `allow-safe` — an element/attribute allowlist with no setting to re-enable
scripts. (3) `strip` — drop the tags, keep the text. (4) Per-file override
("this workspace trusts HTML") with a visible trust indicator.

**Evidence we have.** `[V]` micromark defaults `allowDangerousHtml` to false and
parses HTML "according to CommonMark but shows the HTML as text instead of as
elements". `[V]` marked is described as "unsafe by default". `[V]` GFM's
`tagfilter` exists specifically because GitHub sanitises HTML, so escaped/filtered
output is what the ecosystem already displays. `[I]` For a viewer, escaping shows
the user *what the file says*, which is more truthful than rendering it.

**Evidence missing.** `[M]` How often HTML appears in our test corpus, and how
often it is *load-bearing* (tables via HTML, `<details>`, `<img width>`).
`[?]` Whether `<details>`/`<summary>` alone justifies `allow-safe` — it is the
most common legitimate raw-HTML use and is safe with a tight allowlist.

**Owner** security · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0005-security-baseline-xss-sanitization.md`

---

<a id="q-08"></a>
### Q-08 · Do we support wikilinks `[[Target]]` and `![[Embed]]`?

**Why it matters.** Wikilinks are the signature syntax of the Obsidian/Logseq
world and a top reason people switch tools. But resolving `[[Target]]` means
knowing what files exist — which means a workspace index, which means we are no
longer a single-file viewer. `![[Embed]]` pulls in *other documents*, which
reintroduces the filesystem into the render path and invalidates the "one
document in, one document out" purity that the position map depends on.

**Options.** (1) No. (2) Render as styled text, never resolve. (3) Resolve
within the open workspace only, with a "target not found" state. (4) Full
embedding.

**Evidence we have.** `[A]` Wikilinks are widespread in personal knowledge
management; they are not part of CommonMark, GFM, or any standard. `[I]`
`[[…]]` in standard Markdown is currently a *broken* link syntax, so enabling
wikilinks changes how existing documents render.

**Evidence missing.** `[A]` What fraction of our target users use wikilinks.
`[?]` Cost of making the renderer re-entrant (embedded documents inside
documents) — this is genuinely a research problem, not a feature.

**Owner** project-lead · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0012-wikilinks.md`

---

<a id="q-09"></a>
### Q-09 · Which syntax highlighting engine, and does it belong in `core`?

**Why it matters.** Highlighting is the single heaviest decoration stage
(doc 06 §9: 40 ms p50 / 120 ms p95 for a batch). The engine choice dominates
that, and Shiki-class engines ship hundreds of grammars and a WASM/Oniguruma
runtime.

**Options.** (1) Shiki (accurate, big, WASM TextMate). (2) Prism (small, fast,
regex-based, less accurate). (3) highlight.js (mature, DOM-based, older).
(4) A minimal built-in tokenizer for the ~20 languages we care about.

**Evidence we have.** `[I]` For a *viewer* of technical documents, accurate
highlighting matters more than bundle size — a mis-highlighted Rust file reads
badly. `[I]` Tokenizing (pure) belongs in `core`; rendering spans belongs in
`ui` (doc 02 §5), but that forces `core` to own Shiki's grammar vocabulary.

**Evidence missing.** `[M]` Shiki bundle size and init time in a Worker.
`[M]` Accuracy on our corpus versus Prism. `[?]` Whether `themeAware` highlight
themes are needed, or whether we can ship a fixed token palette derived from our
own theme tokens.

**Owner** core · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0010-syntax-highlighting.md`

---

<a id="q-10"></a>
### Q-10 · Math: KaTeX, MathJax, or neither in v1?

**Why it matters.** `$…$` and `$$…$$` are extremely common in technical and
scientific notes. Math rendering is also the classic XSS-adjacent surface
(`\href`, `\htmlClass`, `\includegraphics`) and a significant bundle.

**Options.** (1) None in v1; render as styled monospace code. (2) KaTeX.
(3) MathJax (full TeX, much bigger). (4) KaTeX with `trust: false` (default).

**Evidence we have.** `[V]` KaTeX defaults to not trusting `\href`/`\url`, which
is the correct posture for untrusted input. `[I]` `$` is also a literal dollar
sign in prose, so enabling math requires a careful delimiter heuristic —
`$5 and $10` must not become math. That heuristic is a source of user-visible
bugs.

**Evidence missing.** `[A]` Frequency of `$` math in our corpus.
`[M]` KaTeX throughput for a document with 300 formulas (it needs layout, so it
cannot be fully workerised).

**Owner** core · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0010-syntax-highlighting.md`

---

<a id="q-11"></a>
### Q-11 · Mermaid and other diagram languages in-process?

**Why it matters.** Mermaid is popular and expensive: a multi-megabyte bundle
that needs a layout pass and injects SVG. It is also an unusual attack surface
(diagram text becomes SVG labels) and a common source of layout jank.

**Options.** (1) No. Show fenced blocks labelled `mermaid` as code.
(2) Mermaid, lazy + intersection-gated. (3) Mermaid behind a setting.

**Evidence we have.** `[V]` Mermaid requires DOM measurement for layout, so it
must run partly on the main thread even if its parse is workerised. `[I]` Our
own pipeline already has an idle + intersection budget for decoration
(doc 06 §6) that Mermaid would fit into — but mermaid's own bundle is the issue,
not the scheduling.

**Evidence missing.** `[M]` Mermaid bundle size and first-diagram latency in a
Worker. `[?]` Whether Mermaid's SVG output is safely sanitisable under our
policy, or whether we would need to render to a canvas.

**Owner** core · **Deadline** 2027-06-30 · **Status** open
**ADR** `docs/adr/0011-diagrams.md`

---

<a id="q-12"></a>
### Q-12 · Footnotes: GFM-native or the classic Pandoc extension?

**Why it matters.** Two incompatible syntaxes exist. GitHub's is
`[^label]` + `[^label]: definition`; the older one uses `[^label]` +
`[ ^label ]:` inside a footnote block. Documents exist in both.

**Options.** (1) GFM only. (2) Both, detected. (3) Neither.

**Evidence we have.** `[V]` GFM specifies footnotes as an extension.
`[V]` micromark ships `micromark-extension-footnote` (the classic form) as a
separate package from its GFM extension. `[I]` Documents written for GitHub are
the more likely input for a viewer whose users read GitHub.

**Evidence missing.** `[A]` Relative frequency of each form in the wild.

**Owner** core · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0004-markdown-parser-strategy.md`

---

<a id="q-13"></a>
### Q-13 · What is the `maxFileBytes` truncation threshold?

**Why it matters.** Determines the worst-case memory and time budget, and is the
difference between "opens anything" and "opens documents". Too low and we
truncate a legitimate huge log; too high and we OOM on a generated file.

**Options.** 8 MiB / 32 MiB / 128 MiB / no limit.

**Evidence we have.** `[V]` Our own performance research set "a 5 MB technical
document must open in under a second and scroll at 60 fps" — so 32 MiB is
roughly 6× the design point. `[I]` Files above a few tens of MiB of Markdown are
almost certainly generated; generated files read better in a text editor.

**Evidence missing.** `[M]` Real memory and time at 32 MiB and 128 MiB.
`[A]` Reports of legitimately huge Markdown files.

**Owner** perf · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0014-large-file-limits.md`

---

<a id="q-36"></a>
### Q-36 · Our own block patcher, or a VDOM (React/Solid)?

**Why it matters.** Doc 06 §7 designs a 40-line block-level patcher. A VDOM
brings mature reconciliation but also runtime, hydration cost, and a mental
model that fights "one mostly-static HTML blob with stable keys".

**Options.** (1) Hand-written block patcher over `data-key` alignment.
(2) React with keyed lists. (3) Solid/signals with keyed `For`.
(4) Preact/htmx-style morphing.

**Evidence we have.** `[I]` Our render emits one HTML string with
`data-blk`/`data-key` attributes — a design that is *maximally* hostile to a VDOM
and *maximally* friendly to a targeted patcher (doc 06 §4, §7.3).
`[I]` VDOM reconciliation over 10,000 blocks is O(n) per keystroke even when only
one block changed, unless the keys are exactly the ones we designed.

**Evidence missing.** `[M]` Both implementations benchmarked against the same
document with a single-paragraph keystroke. `[?]` Whether we want a component
model at all for the surrounding app chrome (tabs, sidebar, settings).

**Owner** ui · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0013-render-update-strategy.md`

---

<a id="q-37"></a>
### Q-37 · Live preview: CodeMirror 6 or ProseMirror?

**Why it matters.** Only matters if live preview ships (Phase 2+). The editor is
the single largest JS dependency after the shell and has the most accessibility
surface.

**Options.** (1) CodeMirror 6 — smaller, better mobile support, plain-JS
transaction model. (2) ProseMirror — the most mature rich-editor foundation,
larger, plugin-heavy. (3) Neither: "edit in your external editor" only.

**Evidence we have.** `[V]` CodeMirror 6 is transaction-based and supports
incremental parsing of nested structures; ProseMirror is document-transform-based
and is the basis of many collaborative editors. `[I]` Our live-preview design
requires only "give me the buffer and tell me what changed" (doc 06 §7.6), which
CodeMirror 6 models more directly.

**Evidence missing.** `[M]` Bundle size and IME quality on Linux WebKitGTK — the
platform most likely to have IME trouble. `[?]` Screen-reader behaviour in both,
which is a genuine accessibility question.

**Owner** ui · **Deadline** 2027-06-30 · **Status** open
**ADR** `docs/adr/0015-editor-engine.md`

---

<a id="q-38"></a>
### Q-38 · Do remote images load by default?

**Why it matters.** Loading `![](https://tracker.example/…)` in a document
reveals the user's IP, reading time, and document content-derived URL to a third
party. Our positioning is "your files never leave your machine" — which is
*false* if we fetch remote images. This is the question where our marketing and
our behaviour can diverge.

**Options.** (1) Load (what every Markdown renderer does).
(2) Block by default, with a per-workspace "allow remote images" setting.
(3) Block always.
(4) Load behind a proxy — **rejected**, we have no server and no telemetry.

**Evidence we have.** `[I]` The README's privacy claim is at risk either way.
`[V]` Our `SecurityPolicy` already separates `allowedImageSchemes` from
`allowedSchemes`, so the switch is a policy value, not a code change.
`[V]` `connect-src 'self'` in the CSP would *block* remote images, so whichever
answer we pick must be reflected in the CSP (doc 06 §11).

**Evidence missing.** `[A]` How much users care versus how much they rely on
remote images (READMEs full of badges and screenshots are common).

**Owner** product · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0016-remote-resources.md`

---

<a id="q-39"></a>
### Q-39 · Is `content-visibility: auto` safe with our measurement code?

**Why it matters.** It is our biggest CSS performance lever (doc 06 §8), and it
changes what `getBoundingClientRect` returns for off-screen elements — they
report the `contain-intrinsic-size` estimate, not the real size. Any measurement
that drives scroll restoration or the scroll-spy could be wrong.

**Options.** (1) Adopt with `contain-intrinsic-size: auto` (remembers last size).
(2) Adopt only above N blocks. (3) Skip it.

**Evidence we have.** `[V]` `content-visibility: auto` skips layout and paint for
off-screen content; `contain-intrinsic-size: auto` makes the browser remember the
real rendered size for next time. `[I]` Scroll-spy via `IntersectionObserver`
should be unaffected; `offsetTop`-based anchoring (doc 06 §8's
`preserveViewport`) needs verification.

**Evidence missing.** `[M]` Measured scroll-anchor drift with and without, on a
5 MB document. `[?]` WebKitGTK behaviour, which is the least predictable of the
three engines.

**Owner** ui · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0013-render-update-strategy.md`

---

<a id="q-40"></a>
### Q-40 · Print and PDF output — how far?

**Why it matters.** "Markdown viewer" users frequently want to print or export to
PDF, and the webview's print pipeline differs across three engines. But a viewer
that prints badly is worse than one that clearly says it cannot.

**Options.** (1) Rely on the webview's print (Cmd+P / Ctrl+P) with a print
stylesheet. (2) Explicit "Print" that builds a clean document and hands it to the
shell. (3) A real PDF pipeline (headless Chromium, WeasyPrint).
(4) Nothing; hide the menu item.

**Evidence we have.** `[V]` Tauri exposes a print capability, and Electron has
`webContents.printToPDF`. `[V]` Browsers can print any page; the work is a
print stylesheet, not a PDF library. `[I]` A dedicated print view is where
`content-visibility` and lazy images must be disabled and code blocks must be
unwrapped — a real chunk of CSS, and a real source of "printed output is wrong"
bugs.

**Evidence missing.** `[A]` Demand. `[M]` Fidelity of the three webviews' print
output for our layout.

**Owner** product · **Deadline** 2027-06-30 · **Status** open
**ADR** `docs/adr/0017-print-and-pdf.md`

---

<a id="q-41"></a>
### Q-41 · Do we ship EPUB export in v1?

**Why it matters.** EPUB is a genuinely different output format: an OPF package,
a manifest, navigation documents, embedded fonts and images, and a *flow* model
rather than a page model. It is a fun, self-contained feature that can absorb
months.

**Options.** (1) No. (2) EPUB 3 export as a Phase 2 feature. (3) Export as
plain HTML or a single-page PDF instead.

**Evidence we have.** `[I]` EPUB is a *distribution* feature, not a *viewer*
feature; it changes the audience from "read my files" to "publish my files".
`[V]` No Markdown library ships EPUB; it is always bespoke.

**Evidence missing.** `[?]` Whether anyone in the Siyana ecosystem needs this —
it may exist as an explicit user request.

**Owner** product · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0018-export-formats.md`

---

## B · Repository and architecture

<a id="q-14"></a>
### Q-14 · Is Turborepo's Cargo inference reliable enough to rely on?

**Why it matters.** Our whole task graph crosses two languages. If Cargo task
inference is unstable, CI gets flaky and we lose trust in the caching layer.

**Options.** (1) Rely on it. (2) Keep the Rust half on plain npm scripts
(doc 01 §12). (3) Use Nx with `@nx/rust`.

**Evidence we have.** `[V]` Turborepo 2.11.5 is current (2026-09-28). `[V]`
2.10.6 (July 2026) added "Support Cargo-only repos" and "Infer Cargo workspace
tasks", with a stream of Cargo fixes through 2.11.x ("Resolve exact cargo profile
outputs", "Resolve Cargo target output layouts", "Disable unresolved Cargo
artifact caching"). `[V]` Turborepo 2.10 added JIT hashing inputs.

**Evidence missing.** `[M]` Actual behaviour on our layout: 6 members, a
`src-tauri` inside `apps/desktop`, and a `wasm32` target. Two hours of trying it
answers this.

**Owner** build · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0002-monorepo-with-workspaces.md`

---

<a id="q-15"></a>
### Q-15 · Does `minimumReleaseAge: 10080` (7 days) block security patches?

**Why it matters.** Supply-chain hardening versus fast security response. A 7-day
delay on a patched transitive dependency is a 7-day exposure window for every
user.

**Options.** (1) Keep 7 days globally with `minimumReleaseAgeExclude` for
security updates. (2) Lower to 24 h. (3) Remove, relying on review.

**Evidence we have.** `[V]` pnpm 10.26 introduced stricter security defaults,
`allowBuilds`, `blockExoticSubdeps`, and integrity hashes for HTTP tarballs;
11.21–11.22 added `minimumReleaseAgeExcludePrune`. `[V]` pnpm 11.26 added
`--trust-lockfile` / `--trust-policy-*` flags. `[I]` A 2-person team reviews
every dependency bump anyway, so the delay is belt-and-braces, not the control.

**Evidence missing.** `[?]` Whether `minimumReleaseAgeExclude` is ergonomic enough
to use weekly without friction.

**Owner** build · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0002-monorepo-with-workspaces.md`

---

<a id="q-16"></a>
### Q-16 · Does Bun save meaningful CI time at our repository size?

**Why it matters.** Bun claims 0.21 s warm install versus pnpm 1.92 s and npm
4.45 s on its own benchmark. At our size the absolute saving is tens of seconds,
and switching would cost us pnpm's strict isolation.

**Options.** (1) No. (2) `bun install` only. (3) `bun test` only.

**Evidence we have.** `[V]` Bun 1.4.2 (Oct 2026); `bun.lock` is a readable text
lockfile since 1.2; Windows ARM64 supported; acquired by Anthropic in Dec 2025
(so abandonment risk is low). `[V]` Bun's benchmark is vendor-produced — we
should discount it and measure ourselves.

**Evidence missing.** `[M]` A `bun install` vs `pnpm install` timing on our
lockfile, three runs, cold store.

**Owner** build · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: CI wall clock exceeds 10 min on a PR)

**ADR** `docs/adr/0002-monorepo-with-workspaces.md`

---

<a id="q-17"></a>
### Q-17 · One `core`, or a second WASM renderer that must agree?

**Why it matters.** Maintaining two renderers that must produce byte-identical
HTML is a correctness tax with no end. One WASM renderer is a size tax. Both are
avoidable by never shipping the second one.

**Options.** (1) TS core only. (2) TS core + Rust core, with a CI test asserting
identical output. (3) WASM core only.

**Evidence we have.** `[I]` Doc 02 §9 gives numeric triggers for escalation; none
is met today. `[V]` `crates/smv-core` is kept WASM-compilable by a CI check so
the option stays cheap.

**Evidence missing.** `[M]` Whether any benchmark trips a trigger.

**Owner** core · **Deadline** 2028-03-31 · **Status** deferred
(revisit trigger: doc 02 §9 row 1 is met)

**ADR** `docs/adr/0006-shared-core-language.md`

---

<a id="q-18"></a>
### Q-18 · Is `SanitizedDocument` a distinct type from `MarkdownDocument`?

**Why it matters.** A distinct type makes "unsanitised HTML reached the DOM" a
*compile error*. One type with a branding field is weaker but halves the API.

**Options.** (1) Two types, two functions. (2) One type with a nominal brand.
(3) One type, documented.

**Evidence we have.** `[I]` The emitter is the only function that produces HTML,
so the type boundary is cheap to enforce. `[I]` A brand requires a private symbol
and a factory function — about 15 lines.

**Evidence missing.** `[M]` Whether two types measurably slow the Worker
(should be zero) and whether the ergonomics hurt callers.

**Owner** core · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0006-shared-core-language.md`

---

<a id="q-19"></a>
### Q-19 · Does `@siyana/config` become a landfill?

**Why it matters.** Config packages accumulate unused configs because deleting
them "might break something". The two-consumers rule prevents this only if
someone enforces it.

**Options.** (1) Enforce the two-consumer rule with a script. (2) Let it grow
and prune quarterly. (3) Duplicate config instead of sharing it.

**Evidence we have.** `[I]` Duplication guarantees drift; growth guarantees a
dependency nobody can remove.

**Evidence missing.** `[M]` Nothing — this is a process decision.

**Owner** core · **Deadline** 2028-03-31 · **Status** deferred
(revisit trigger: config package exceeds 12 files)

**ADR** `docs/adr/0002-monorepo-with-workspaces.md`

---

<a id="q-20"></a>
### Q-20 · ESLint + Prettier, or Biome/Oxlint?

**Why it matters.** Tooling churn is expensive and Biome/Oxlint are genuinely
good. But our Rust half needs `clippy`+`rustfmt` regardless, so more JS tools
means a larger lint surface to keep configured.

**Options.** (1) ESLint + Prettier. (2) Biome v2. (3) Oxlint + Oxfmt (Nx 23.2
integrates these).

**Evidence we have.** `[V]` Nx 23.2 (Sep 2026) shipped Oxlint and Oxfmt
support. `[V]` Biome v2 moved toward type-aware linting without the TypeScript
compiler. `[I]` Our ESLint needs are small and specific: no `node:` in
`packages/*`, no cross-layer imports, no raw `innerHTML`. All three tools can do
that; only ESLint has the widest editor support today.

**Evidence missing.** `[M]` Whether Biome's type-aware rules would catch things
our boundary script misses.

**Owner** core · **Deadline** 2027-06-30 · **Status** open
**ADR** `docs/adr/0019-linting-and-formatting.md`

---

## C · Filesystem and persistence

<a id="q-21"></a>
### Q-21 · Is a Chromium-only web target acceptable?

**Why it matters.** `showDirectoryPicker` is "Limited availability" per MDN:
Chromium 86+, Edge, Opera. Firefox and Safari have OPFS but **not** local-disk
pickers. A web build that only reads local folders in Chromium is a materially
different product in Firefox and Safari.

**Options.** (1) Ship the Chromium experience and degrade honestly.
(2) Ship a "drop files / drop a `.zip`" experience for everyone else.
(3) Ship Chromium-only and say so.
(4) Skip Phase 2.

**Evidence we have.** `[V]` MDN, *Window: showDirectoryPicker()* — "Limited
availability… does not work in some of the most widely-used browsers"; secure
context only; transient user activation required; experimental.
`[V]` `FileSystemDirectoryHandle` itself is Baseline "Widely available" since
March 2023, and OPFS (`navigator.storage.getDirectory()`) is part of the WHATWG
`fs` spec — so the *sandbox* filesystem is portable even though the local-disk
picker is not.

**Evidence missing.** `[A]` Browser market share of our intended web audience.
`[?]` Whether a `.zip`-import experience is acceptable to users who chose us for
local files.

**Owner** product · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0020-web-target-capabilities.md`

---

<a id="q-22"></a>
### Q-22 · Atomic save on non-atomic platforms: shadow backup, or refuse?

**Why it matters.** On the web and mobile, "atomic" writes are not atomic
against concurrent readers. A truncated file is data loss.

**Options.** (1) Write a sibling `.smv-backup` first, always. (2) Refuse to save
without an atomic platform. (3) Save and accept the risk.

**Evidence we have.** `[V]` `FileSystemWritableFileStream.close()` is not atomic
against another reader. `[V]` iOS `replaceItemAtURL:withItemAtURL:backupItemName:`
gives a real backup. `[I]` Option (2) means "our editor cannot save on mobile",
which makes editing-on-mobile impossible and would push us toward Q-06's
"viewer only" answer.

**Evidence missing.** `[M]` Real-world behaviour of Chromium's FSA close on
crash. `[?]` Whether a `.smv-backup` file next to the user's document is
acceptable or becomes clutter.

**Owner** desktop · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0007-filesystem-adapter-contract.md`

---

<a id="q-23"></a>
### Q-23 · Tauri IPC overhead for large binary payloads

**Why it matters.** If transferring a 30 MB `Uint8Array` over Tauri IPC costs
hundreds of milliseconds, the whole pipeline budget (doc 06 §9) is wrong.

**Options.** (1) Measure and optimise (raw response body instead of IPC payload).
(2) Accept it and raise the budget.

**Evidence we have.** `[?]` Nothing measured. `[I]` Tauri's IPC serialises
commands as JSON unless a command returns a raw `Response`; binary should go via
the latter.

**Evidence missing.** `[M]` A benchmark: IPC a 1/10/30/100 MB `Uint8Array` and
measure wall time and allocations.

**Owner** desktop · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0007-filesystem-adapter-contract.md`

---

<a id="q-24"></a>
### Q-24 · iOS external edits: `NSFileCoordinator` or re-stat-on-resume?

**Why it matters.** Apple *requires* `NSFileCoordinator` for external documents
in many contexts, so this may not be a choice. But full coordination is
substantial complexity for a viewer.

**Options.** (1) Full `NSFileCoordinator`. (2) Re-stat on foreground only.
(3) Read-only on iOS — import a copy.

**Evidence we have.** `[V]` Apple's documentation: "Always use file coordinators
to read and write to external documents" and "Always use a file presenter when
displaying the contents of an external document." `[V]` Security-scoped URLs
since iOS 13; `startAccessingSecurityScopedResource()` must bracket every access;
bookmarks can fail to resolve.

**Evidence missing.** `[?]` Whether coordinated reading actually detects edits
made by other apps in the Files provider.

**Owner** mobile · **Deadline** 2028-03-31 · **Status** deferred
(revisit trigger: Phase 3 kickoff)

**ADR** `docs/adr/0021-mobile-storage-model.md`

---

<a id="q-25"></a>
### Q-25 · One shadow backup file, or timestamped rotation?

**Why it matters.** Rotation is friendlier; it also multiplies disk usage and
fills a folder with files.

**Options.** (1) One, overwritten. (2) Last N (e.g. 5), timestamped.
(3) A backup directory outside the workspace.

**Evidence we have.** `[I]` One file is invisible and self-cleaning.

**Evidence missing.** `[A]` Whether anyone recovers from a backup often enough
to justify rotation.

**Owner** product · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: autosave ships)

**ADR** `docs/adr/0009-editing-in-v1.md`

---

<a id="q-26"></a>
### Q-26 · Do users want per-workspace bookmarks?

**Why it matters.** It is a feature with a schema cost (already in
`WorkspaceState`) and a scope cost (a bookmark UI, an index, navigation).

**Options.** (1) Yes. (2) No — remove from the schema. (3) Global bookmarks
across workspaces.

**Evidence we have.** `[?]` No user data.

**Evidence missing.** `[A]` Issue-tracker signal after v1.

**Owner** product · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: 20+ users or 5+ requests)

**ADR** `docs/adr/0022-workspace-schema.md`

---

<a id="q-27"></a>
### Q-27 · Workspace write frequency: on every scroll settle, or on close?

**Why it matters.** Writing on every scroll settle churns disk and lands in
backup/sync tools' conflict folders; writing only on close loses state on a crash.

**Options.** (1) Debounced 800 ms with hash-dedupe and flush on
`visibilitychange→hidden` (chosen in doc 04 §4.1). (2) On close only.
(3) Every N seconds.

**Evidence we have.** `[I]` The browser fires `visibilitychange` reliably; mobile
fires `onPause`/`willResignActive`. `[I]` Hash-dedupe makes frequent writes nearly
free when nothing changed.

**Evidence missing.** `[M]` Measured write volume on a real session.

**Owner** ui · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0022-workspace-schema.md`

---

<a id="q-28"></a>
### Q-28 · Is `navigator.storage.persist()` worth a permission prompt?

**Why it matters.** Firefox shows the user a notification when we request
persistent storage; Safari and Chromium decide silently.

**Evidence we have.** `[V]` Firefox best-effort IndexedDB is min(10% of profile
disk, 10 GiB); persistent is 50% of disk capped at 8 TiB. `[V]` WebKit caps
non-browser web content apps at 20% of disk. `[I]` Our workspace file is ~200 KB
worst case, so the quota is almost never the binding constraint; eviction under
disk pressure is the real risk.

**Evidence missing.** `[?]` Whether eviction actually threatens our data in
practice.

**Owner** web · **Deadline** 2027-03-31 · **Status** deferred
(revisit trigger: Phase 2 kickoff)

**ADR** `docs/adr/0022-workspace-schema.md`

---

<a id="q-29"></a>
### Q-29 · Does tier-(c) search force SQLite?

**Why it matters.** Doc 04 §5.2's rule is "when we need a query that is not a
full scan of memory". Tier (c) is the likely trigger, and choosing an engine
under time pressure is how we end up with the wrong one.

**Options.** (1) No — MiniSearch everywhere with JSON persistence.
(2) Yes — `rusqlite` + FTS5 desktop-only, MiniSearch elsewhere.

**Evidence we have.** `[V]` `rusqlite` 0.40.x bundles SQLite 3.53.2 and SQLCipher
4.14.0, MSRV 1.88. `[V]` `@tauri-apps/plugin-sql` 2.4.0 does **not** support
iOS and uses `sqlx`, so we would use `rusqlite` directly. `[I]` FTS5's
`bm25()`, `snippet()`, and prefix queries are far better than anything we would
write.

**Evidence missing.** `[M]` The tier-(c) gate benchmarks (doc 05 §6.1).

**Owner** build · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: the tier-(c) gate is reached)

**ADR** `docs/adr/0023-storage-engine.md`

---

<a id="q-30"></a>
### Q-30 · Should workspace state live beside the notes, in git?

**Why it matters.** Sidecar state travels with the notes through git and backups,
which is genuinely useful — and also produces merge conflicts in
`.md.siyana-workspace.json` for every collaborator who does not have the app.

**Options.** (1) App data only (current). (2) Sidecar next to the file,
gitignored by default. (3) Both, with sidecar as an opt-in sync.

**Evidence we have.** `[I]` Collaborators without our app would see an untracked
file in their status output; some users commit everything.

**Evidence missing.** `[A]` How many users use git for their notes.

**Owner** product · **Deadline** 2027-06-30 · **Status** open
**ADR** `docs/adr/0022-workspace-schema.md`

---

## D · Search

<a id="q-31"></a>
### Q-31 · Regex, field-scoped queries, fuzzy — which ship in v1?

**Why it matters.** Each is a support surface. Regex is a DoS vector
(doc 05 §3.1.4); fuzzy is a quality judgement users will have opinions about.

**Options.** (1) Literal + case + whole-word only. (2) Add regex (worker,
step-budgeted). (3) Add `heading:` / `path:` field syntax. (4) Add fuzzy.

**Evidence we have.** `[I]` Literal + case + whole-word covers most usage.
`[V]` MiniSearch natively offers prefix, fuzzy, boost, and filters if we need
them later, so deferring costs little.

**Evidence missing.** `[A]` Demand.

**Owner** product · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0024-search-scope.md`

---

<a id="q-32"></a>
### Q-32 · What is the real distribution of workspace sizes?

**Why it matters.** If the median workspace is 200 files, tier (b) is provably
sufficient and tier (c) is dead weight (doc 05 §4.1). If it is 20,000 files, we
are building the wrong thing first.

**Evidence we have.** `[?]` None. `[I]` Our own notes repositories are a biased
sample.

**Evidence missing.** `[A]` A rough count from issue reporters and the Siyana
ecosystem's existing users.

**Owner** product · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: v1 released)

**ADR** `docs/adr/0024-search-scope.md`

---

<a id="q-33"></a>
### Q-33 · Is a JS index viable on low-end Android?

**Why it matters.** Mobile has the least memory and the most constrained JS heap
(Hermes/JSC in a webview). A 4–5× corpus memory multiplier (doc 05 §4.7) may not
fit.

**Evidence we have.** `[V]` FlexSearch's own table shows MiniSearch's memory
footprint for a reference corpus at 4,777 units against FlexSearch's 16 and
Lunr's 2,443 — vendor-produced, but the *ratio* is informative.
`[I]` Mobile workspaces are small by construction (a picked folder).

**Evidence missing.** `[M]` Heap use on a 2 GB Android device.

**Owner** mobile · **Deadline** 2028-03-31 · **Status** deferred
(revisit trigger: Phase 3 kickoff)

**ADR** `docs/adr/0024-search-scope.md`

---

<a id="q-34"></a>
### Q-34 · BM25 or recency/path ranking?

**Why it matters.** Users remember "I wrote this recently" and "it was in my
notes folder" more than they remember "it was topically relevant". BM25 is what
search engines do; it is not what memory does.

**Options.** (1) BM25. (2) Recency. (3) Path prefix boost. (4) Hybrid with
tuned weights.

**Evidence we have.** `[V]` MiniSearch and FTS5 both give BM25-style scoring for
free. `[I]` Hybrid weights are guessable and often wrong.

**Evidence missing.** `[A]` What users expect — a real research question.

**Owner** product · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: tier (c) ships)

**ADR** `docs/adr/0024-search-scope.md`

---

<a id="q-35"></a>
### Q-35 · When is the tier-(c) index gate?

**Why it matters.** Doc 05 §6 makes tier (c) conditional on a benchmark. Without
a date, "later" means "eventually", and eventually means we build it without
data.

**Options.** (1) End of Phase 1 (desktop users have real workspaces).
(2) After Phase 2 web ships. (3) Never, unless a user complains.

**Evidence we have.** `[I]` Desktop-only users are the ones with
10,000-file workspaces; web/mobile users do not. That argues for deciding in
Phase 1.

**Evidence missing.** `[M]` The tier-(b) benchmarks on 1k/10k/50k corpora.

**Owner** project-lead · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0024-search-scope.md`

---

## E · Platform, packaging and release

<a id="q-42"></a>
### Q-42 · Can `ubuntu-24.04-arm` run our containerised Linux build?

**Why it matters.** Our Linux matrix needs arm64. If we must cross-compile, the
recipe (`cross` toolchain, `dpkg --add-architecture arm64`,
`libwebkit2gtk-4.1-dev:arm64`) is 20 lines of extra CI.

**Options.** (1) Native ARM runner. (2) `cross` from x64. (3) Drop Linux ARM
from v1.

**Evidence we have.** `[V]` GitHub-hosted `ubuntu-24.04-arm` exists at
$0.005/min (cheaper than x64's $0.006). `[V]` Tauri documents an ARM AppImage
recipe. `[V]` Electron ships Linux arm64 prebuilt binaries, so the audience
exists.

**Evidence missing.** `[M]` Whether the 2-core ARM runner can compile a Tauri app
in reasonable time and whether our `ghcr.io/…/ubuntu-22.04` image has an arm64
manifest.

**Owner** build · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0025-linux-distribution.md`

---

<a id="q-43"></a>
### Q-43 · Is `webkit2gtk-4.1` available on Ubuntu 22.04 **arm64**?

**Why it matters.** Tauri requires WebKitGTK 4.1 (≥ 2.40). Tauri lists
`webkit2gtk-4.1` for Ubuntu 22.04 x64. If arm64 22.04 lacks it, our baseline
image needs a different approach for ARM.

**Options.** (1) Verify and pin. (2) Build ARM on a newer base and accept a
higher glibc floor for ARM only. (3) Drop ARM.

**Evidence we have.** `[V]` Tauri requires `webkit2gtk-4.1`; the API 4.1 packages
exist on Arch, Debian 12+, Ubuntu 22.04+, and Fedora 37+. `[V]` Tauri maintains
an explicitly incomplete distro/WebKit version table.

**Evidence missing.** `[?]` arm64 package availability on 22.04.

**Owner** build · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0025-linux-distribution.md`

---

<a id="q-44"></a>
### Q-44 · Exact schema of Tauri's generated `bundle.json`

**Why it matters.** `merge-updater-manifests.mjs` reads it to build the combined
`latest.json`. Getting the schema wrong means a release with a broken updater.

**Options.** (1) Read `bundle.json`. (2) Generate `latest.json` ourselves from
the CLI's output paths and our own `tauri signer sign` invocations.

**Evidence we have.** `[V]` Tauri generates `latest.json` per build; Tauri 2.12
added `requireSignedVersion` and `tauri signer sign --app-version`.
`[?]` The precise `bundle.json` shape at 2.12.

**Evidence missing.** `[M]` Run `tauri build` once and inspect the output.

**Owner** build · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0026-updater-manifest.md`

---

<a id="q-45"></a>
### Q-45 · Does the Microsoft Store accept NSIS, or do we need MSIX?

**Why it matters.** A Store listing is the *only* way to avoid SmartScreen
warnings entirely (Microsoft's own words). If it needs MSIX, that is a packaging
workstream.

**Options.** (1) Investigate MSIX packaging for Tauri. (2) Store listing via
whatever packaging is accepted. (3) Rely on reputation accumulation.

**Evidence we have.** `[V]` Microsoft's mitigation list puts "Publish to the
Microsoft Store where feasible" first. `[V]` EV no longer bypasses SmartScreen;
reputation cannot transfer between versions unless signed with the same publisher
identity.

**Evidence missing.** `[?]` Store packaging requirements for a Tauri app.

**Owner** project-lead · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: Windows adoption warrants it)

**ADR** `docs/adr/0027-windows-distribution.md`

---

<a id="q-46"></a>
### Q-46 · Minimum OS versions

**Why it matters.** Every floor we set is a user we exclude, and Linux floors
are especially expensive because they come from glibc and WebKitGTK, not from
our choice.

**Options.**
- Windows: 10 (pre-22H2) / 10 / 11.
- Linux: glibc 2.31 (Ubuntu 20.04) / 2.34 (22.04) / 2.35 (24.04).
- WebKitGTK: 2.40 (Tauri's minimum) / whatever the oldest supported distro has.

**Evidence we have.** `[V]` Tauri 2.12 dropped Windows 7 and raised MSRV to
1.90. `[V]` Windows 10 reached end of support on 14 Oct 2025, per Microsoft.
`[V]` Tauri v2 requires `webkit2gtk-4.1` (Ubuntu 22.04+, Fedora 37+); Tauri v1's
`webkit2gtk-4.0` reached CentOS/RHEL 8–9. `[V]` Tauri's AppImage docs recommend
building on the oldest base providing 4.1 — Ubuntu 22.04 or Debian 12.

**Evidence missing.** `[A]` Which distros our actual users are on.

**Owner** product · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0025-linux-distribution.md`

---

<a id="q-47"></a>
### Q-47 · Release cadence, and how SmartScreen reputation depends on it

**Why it matters.** SmartScreen reputation is per-file-hash and does not transfer
between versions. A frequent release cadence means many new hashes each earning
reputation from zero; a slow cadence means fewer warnings but slower delivery.

**Options.** (1) Monthly. (2) Every 6–8 weeks. (3) "When ready".
(4) Continuous (autotiler) — worst case for reputation.

**Evidence we have.** `[V]` Microsoft: unsigned files build reputation from zero
per version; signed files can inherit publisher reputation; EV does not bypass.
`[I]` Cadence is also a project-health question: a solo maintainer on a fixed
cadence will slip.

**Evidence missing.** `[A]` Whether our audience will notice either way.

**Owner** project-lead · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0028-release-cadence.md`

---

## F · Scope and sequencing

<a id="q-48"></a>
### Q-48 · Desktop-first or mobile-first?

**Why it matters.** The repo's stated order is Desktop → Web → Mobile. Reversing
it changes what the shared core must be (mobile-first forces capability flags to
be designed up-front; desktop-first lets you prototype on the easiest platform).

**Options.** (1) Desktop first (current plan). (2) Mobile first.
(3) Parallel, with the core frozen early.

**Evidence we have.** `[V]` The README commits to Desktop (Windows + Linux)
first. `[I]` Desktop is where the hardest problems live (full FS, watching,
atomic writes) and solving them first is where the architecture gets proven.
`[I]` Mobile cannot watch files and has revocable grants, so a mobile-first core
would be built against the weakest platform.

**Evidence missing.** `[A]` Where our users are.

**Owner** project-lead · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0029-platform-sequencing.md`

---

<a id="q-49"></a>
### Q-49 · Do we support `.mdx`, `.qmd`, `.txt`?

**Why it matters.** File extensions are a promise. `.mdx` executes JSX by
definition, which is a security posture question. `.qmd` is a specific tool's
dialect. `.txt` is plain text and trivially safe.

**Options.** (1) `.md`/`.markdown`/`.mdown`/`.mkd`/`.mdtxt` only.
(2) Plus `.txt` as plain text (no parsing).
(3) Plus `.mdx` with JSX stripped.
(4) Plus `.qmd`.

**Evidence we have.** `[V]` micromark ships MDX support as a separate extension
(so it is possible). `[I]` Rendering an `.mdx` file as *Markdown* is close to
correct if we escape JSX rather than evaluate it — which is a defensible
behaviour. `[V]` QMD is a Quarto dialect with its own semantics.

**Evidence missing.** `[A]` How many users have `.mdx`/`.qmd` files they want to
read.

**Owner** core · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0004-markdown-parser-strategy.md`

---

<a id="q-50"></a>
### Q-50 · Notebook formats (`.ipynb`)?

**Why it matters.** Notebooks are JSON with Markdown cells, outputs, and
execution metadata. Supporting them means a JSON viewer, a cell model, and
output rendering (images, plots, tracebacks). It is a second document format
with its own sanitizer surface.

**Options.** (1) No. (2) Read-only notebooks: render Markdown cells, show outputs,
no execution. (3) Full notebook support.

**Evidence we have.** `[I]` Read-only notebook rendering is genuinely useful and
is roughly "render a list of Markdown documents", which our pipeline can already
do — but the output types (base64 PNGs, SVG plots, ANSI text) each need their own
handling.

**Evidence missing.** `[A]` Demand.

**Owner** product · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: 5+ explicit requests)

**ADR** `docs/adr/0018-export-formats.md`

---

<a id="q-51"></a>
### Q-51 · Is single-document mode a real product or a fallback?

**Why it matters.** If someone opens one file with no folder, do they get a
stripped-down mode (no sidebar, no workspace, no search) or the full app with an
empty workspace?

**Options.** (1) A distinct, deliberately simple "single file" mode.
(2) Full app with a pseudo-workspace of one file.
(3) Blocked: require a folder.

**Evidence we have.** `[I]` Opening a file from a file manager or
`xdg-open`/`open` is the most natural first-run flow, and requiring a folder
first would be hostile. `[I]` A distinct mode means a second layout, a second set
of tests, and a second accessibility pass.

**Evidence missing.** `[M]` Nothing; this is a design judgement.

**Owner** product · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0030-single-file-mode.md`

---

<a id="q-52"></a>
### Q-52 · What is explicitly out of scope for Phase 1?

**Why it matters.** Scope creep from trying to be an Obsidian clone is a named
risk. A written exclusion list is the only reliable defence.

**Options.** (a) Draft the list.

**Evidence we have.** `[I]` Candidates for exclusion: editing (if Q-06 says no),
wikilinks, embedding, plugins, themes beyond a few, sync, mobile, EPUB, PDF
beyond print, PDF import, notebooks, `.mdx` execution, collaboration.

**Evidence missing.** `[?]` Nothing — this is a commitment, not research.

**Owner** project-lead · **Deadline** 2026-11-15 · **Status** open
**ADR** `docs/adr/0031-phase-1-scope.md`

---

<a id="q-53"></a>
### Q-53 · Plugin / theme ecosystem — ever?

**Why it matters.** An ecosystem is a permanent maintenance and security
surface. A plugin system in a tool that renders untrusted files is a plugin
system that can be attacked through plugins.

**Options.** (1) Never. (2) Themes only, declarative and sandboxed.
(3) A full plugin API.

**Evidence we have.** `[I]` Themes are the most requested "ecosystem" feature in
this category and are the least dangerous, because a theme is CSS we inject.

**Evidence missing.** `[?]` Whether themes alone satisfy the community.

**Owner** project-lead · **Deadline** 2028-06-30 · **Status** deferred
(revisit trigger: v1 adoption)

**ADR** `docs/adr/0032-extensibility.md`

---

<a id="q-54"></a>
### Q-54 · Do we sync documents across tabs/windows in one process?

**Why it matters.** Two tabs on the same file is a data-loss bug waiting to
happen: both hold buffers, both can save, one wins silently.

**Options.** (1) Single-instance with tabs inside one window (simplest).
(2) Multi-window, single writer, others follow read-only.
(3) Multi-window, multi-writer, with cross-tab conflict handling.

**Evidence we have.** `[V]` Tauri supports both single-instance and
multi-window. `[I]` Option (3) means every save goes through a cross-window
lock and every conflict becomes a UI event — expensive, and unnecessary for a
viewer.

**Evidence missing.** `[M]` Nothing.

**Owner** ui · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0033-window-model.md`

---

<a id="q-55"></a>
### Q-55 · Accessibility bar: WCAG 2.2 AA floor, or AAA target?

**Why it matters.** The README already promises WCAG 2.2 AA as a floor. AA
covers contrast, focus visibility, keyboard access, and names. AAA covers
reflow at 400% and sign language — largely not applicable to a document reader,
but "reading comfort" and "structured navigation" are where a reading app's
real accessibility lives (headings, landmarks, a document outline screen-reader
user can navigate).

**Options.** (1) AA floor, audited. (2) AA + a reading-specific bar: real heading
structure, landmarks, a skip link, `aria-live` on search results, full keyboard
navigation, and reduced-motion support.

**Evidence we have.** `[V]` Our pipeline emits real headings with ids and can
emit landmarks; `content-visibility` and animations need `prefers-reduced-motion`
handling. `[I]` A Markdown viewer's accessibility is mostly about whether the
heading structure survives sanitisation and decoration — which we control.

**Evidence missing.** `[M]` An audit against a real screen reader (NVDA, VoiceOver,
Orca).

**Owner** design · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0034-accessibility-bar.md`

---

<a id="q-56"></a>
### Q-56 · Screen-reader testing: who, how, how often?

**Why it matters.** Accessibility claims without screen-reader testing are
unverified. But screen-reader testing requires either expertise or money.

**Options.** (1) The maintainer tests with NVDA/VoiceOver/Orca each release.
(2) Hire an audit once before v1.0. (3) Rely on automated axe checks only.

**Evidence we have.** `[V]` Automated tools catch roughly a third of issues;
they do not catch "the document outline is unusable in a screen reader".

**Evidence missing.** `[?]` Budget.

**Owner** project-lead · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0034-accessibility-bar.md`

---

<a id="q-57"></a>
### Q-57 · How do we handle the Siyana ecosystem's other apps?

**Why it matters.** The organisation ships Siyana-Lang, Siyana-Chat,
Siyana-Seed, and brand. A viewer that duplicates or conflicts with them wastes
the ecosystem's value; a viewer that ignores them looks standalone.

**Options.** (1) Fully standalone; cross-link only. (2) Deep integration with
Siyana-Seed's notes. (3) Shared component and token library via the `brand`
repo.

**Evidence we have.** `[V]` The README lists the sibling projects and the
`brand` repo for design tokens. `[I]` A shared token package is a small,
high-leverage integration that does not require product coupling.

**Evidence missing.** `[?]` What Siyana-Seed's storage format is, and whether a
viewer that opens Seed notes would be useful or would create a compatibility
obligation.

**Owner** community · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0035-ecosystem-integration.md`

---

<a id="q-58"></a>
### Q-58 · Domain name and website hosting

**Why it matters.** The domain is printed on SmartScreen warnings, on the Store
listing, and in every support answer. It is effectively permanent. Hosting must
be free or near-free for a self-funded project.

**Options.** (a) `siyana.app/markdown-viewer`? `markdownviewer.siyana.org`?
A dedicated domain? (b) GitHub Pages + the org domain.

**Evidence we have.** `[I]` Project pages need: a download page per platform, a
privacy statement, a security policy, a changelog, and documentation. All are
static. GitHub Pages is free and versioned with the repo.

**Evidence missing.** `[?]` Whether we own a root domain or a subdomain.
`[?]` Whether localised documentation needs a CMS (we would rather not).

**Owner** project-lead · **Deadline** 2026-12-15 · **Status** open
**ADR** `docs/adr/0036-project-identity.md`

---

## G · Naming, licensing, sustainability and community

<a id="q-59"></a>
### Q-59 · Product name: "Siyana Markdown Viewer" or "Siyana Markdown"?

**Why it matters.** It is the string in every window title, installer name,
process name, `latest.json`, Store listing, and support answer. Also the name
users search for, where "Markdown viewer" is a generic phrase with a lot of
competition.

**Options.** (1) Keep "Siyana Markdown Viewer". (2) "Siyana Markdown".
(3) Something shorter and more distinctive.

**Evidence we have.** `[V]` The repo, README, and docs all say "Siyana Markdown
Viewer". `[I]` "Viewer" sets an expectation that we then either honour (Q-06) or
break.

**Evidence missing.** `[A]` What people call it when they talk about it.

**Owner** project-lead · **Deadline** 2026-12-15 · **Status** open
**ADR** `docs/adr/0036-project-identity.md`

---

<a id="q-60"></a>
### Q-60 · Bundle identifier and reverse-DNS namespace

**Why it matters.** Baked into the MSI product code, the AppImage/`deb`
package name, the macOS bundle id, the Android application id, the Flatpak app
id, the updater's on-disk layout, and the app-data directory name. Changing it
after release means users' settings and permissions are orphaned, and Store
listings cannot be renamed meaningfully.

**Options.** `dev.siyana.markdownviewer` · `org.siyana.mdviewer` ·
`io.siyana.markdown` · `app.siyana.mdv`.

**Evidence we have.** `[I]` `siyana-code` is the GitHub org, so `…siyana…` in
the identifier is consistent. `[I]` A short, lowercase, hyphen-free id is best
practice across all five packaging systems.

**Evidence missing.** `[?]` Whether the domain from Q-58 should drive the reverse
DNS (it should, but we need to know the domain first).

**Owner** project-lead · **Deadline** 2026-12-15 · **Status** open
**ADR** `docs/adr/0036-project-identity.md`

---

<a id="q-61"></a>
### Q-61 · Keep MIT, or move to a source-available licence?

**Why it matters.** MIT is what the repo has. Moving later (to BUSL, AGPL,
Apache-2.0, or a dual licence) is a breaking change for contributors and users.

**Options.** (1) MIT forever. (2) Apache-2.0 (adds an explicit patent grant).
(3) BUSL or similar source-available (restricts competing use).

**Evidence we have.** `[V]` The repo is MIT, copyright 2026 Siyana.
`[I]` Dependencies are compatible: `comrak` is BSD-2-Clause, `markdown-rs` and
micromark are MIT, Tauri is MIT/Apache-2.0.

**Evidence missing.** `[?]` Whether there is any intent to monetise, which would
argue for Apache-2.0's patent grant or for a source-available licence.

**Owner** project-lead · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0037-licensing.md`

---

<a id="q-62"></a>
### Q-62 · CLA, DCO, or neither?

**Why it matters.** Determines who holds copyright, what a contributor can
promise, and how painful a licence change would be. A CLA (e.g. via
`cla-assistant`) is friction on every PR.

**Options.** (1) No CLA, no DCO — implicit contribution under the repo licence
(the GitHub default). (2) DCO (`-s` sign-off) via `dco-action`.
(3) CLA.

**Evidence we have.** `[I]` For a small MIT project with outside contributors,
"no CLA" is the friendliest and is what the README implies
("the issue tracker is open to new contributors"). A DCO is lightweight and
protects relicensing ability.

**Evidence missing.** `[?]` Whether the project wants the option to relicense
later.

**Owner** community · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0038-contributor-licensing.md`

---

<a id="q-63"></a>
### Q-63 · Telemetry: none at all, or opt-in?

**Why it matters.** The README promises "no tracking, no telemetry" in the
first paragraph. Keeping that promise is a differentiator; adding opt-in
telemetry would be a partial retreat. Doc 02 §6.5 makes the default a no-op that
*throws* if used, which is a strong structural commitment.

**Options.** (1) None, ever; performance data stays local in a built-in panel.
(2) Opt-in, off by default, with a clear consent screen and a visible
"telemetry on" indicator.
(3) Anonymous crash reports only, with consent.

**Evidence we have.** `[I]` The privacy claim is load-bearing for the project's
positioning. `[V]` A local performance panel (doc 06 §10) gives us debugging
value without any network.

**Evidence missing.** `[A]` Whether users would opt in if asked — and whether
asking would cost us more trust than the data is worth.

**Owner** project-lead · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0039-privacy-and-telemetry.md`

---

<a id="q-64"></a>
### Q-64 · Crash reporting: Sentry, or a local crash log the user can paste?

**Why it matters.** Crash reports are how we find out that a Linux webview
combination is broken — a named risk. But a crash report may contain file paths
and document-derived content, which is a privacy problem in a local-first tool.

**Options.** (1) No crash reporting; a "copy diagnostics" button that produces a
redacted report the user chooses to send. (2) Opt-in Sentry with scrubbing.
(3) Consent-gated Sentry for crashes only.

**Evidence we have.** `[I]` Option (1) is privacy-clean but will lose us reports
from users who do not know how to file one. `[V]` Local diagnostics need
`?bug=1` in the URL, a crash handler, and an explicit redaction step.

**Evidence missing.** `[?]` How much a diagnostic bundle helps without user
cooperation. `[?]` Whether paths in crash reports are considered sensitive enough
to matter (probably yes: a filename can be a person's name).

**Owner** security · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0039-privacy-and-telemetry.md`

---

<a id="q-65"></a>
### Q-65 · Localization: which languages, and which pipeline?

**Why it matters.** UI strings plus a whole documentation site. A
non-English UI in a small project often becomes unmaintained and embarrassing.

**Options.** (1) English only; document the string-extraction API and accept
community translations later. (2) `i18next`/ICU from day one, English + Chinese.
(3) A full crowd-sourced pipeline.

**Evidence we have.** `[I]` The Siyana organisation is Chinese-adjacent, which
suggests a real Chinese-speaking audience. `[V]` The Siyana ecosystem's other
projects presumably have existing translation assets we could reuse — unverified.

**Evidence missing.** `[?]` Whether the sibling apps are translated and where
their string catalogues live. `[?]` Whether we want to commit to maintaining
translations we cannot read.

**Owner** community · **Deadline** 2027-06-30 · **Status** open
**ADR** `docs/adr/0040-localization.md`

---

<a id="q-66"></a>
### Q-66 · Funding: sponsors, grants, paid tier, donations?

**Why it matters.** A signing certificate, a Store account, an Apple account,
and a domain all cost money, and Linux ARM runners are free but macOS runners are
not. "Local-first, no account" is compatible with sponsorship but not obviously
with a paid tier.

**Options.** (1) GitHub Sponsors + Open Collective. (2) Grant applications
(SFD, NLNet, SovereignTech). (3) A paid tier with sync (which reopens Q-63).
(4) None; pay out of pocket.

**Evidence we have.** `[V]` GitHub-hosted macOS runners cost $0.062/min and are
free in public repos, so CI is not the cost driver. `[V]` Store developer
programmes and code-signing services have real annual costs.

**Evidence missing.** `[?]` Whether grant programmes accept a project at our
stage. `[?]` The maintainer's own appetite for fundraising.

**Owner** project-lead · **Deadline** 2027-06-30 · **Status** open
**ADR** `docs/adr/0041-funding.md`

---

<a id="q-67"></a>
### Q-67 · Governance: who merges, who releases?

**Why it matters.** With one or two maintainers, "governance" is really "what
happens when the maintainer is unavailable". Without a written answer, a
sick maintainer stalls everything.

**Options.** (1) Sole maintainer decides and releases. (2) Write a minimal
`MAINTAINERS.md` with a documented delegation path. (3) A formal council — no.

**Evidence we have.** `[V]` The README says PRs target `develop` and `main` is
release-only. `[V]` CODEOWNERS is already listed in the planned repo layout.

**Evidence missing.** `[?]` Whether there is a second person who could
co-maintain.

**Owner** community · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0042-governance.md`

---

<a id="q-68"></a>
### Q-68 · Contributor onboarding for a Rust + TypeScript codebase

**Why it matters.** A dual-language repo is a real barrier. `pnpm i && cargo
build` is not always enough (Linux needs `webkit2gtk-4.1` dev packages; the
Windows build needs MSVC).

**Options.** (1) A `CONTRIBUTING.md` with per-platform setup, a
`./scripts/dev-setup.sh`, and a devcontainer. (2) Just documentation.

**Evidence we have.** `[V]` Tauri's prerequisites docs list distinct Debian,
Arch, Fedora, and openSUSE package sets including `libwebkit2gtk-4.1-dev`.
`[V]` Windows needs the MSVC toolchain and WebView2.

**Evidence missing.** `[M]` Time-to-first-successful-build for a new contributor
on each platform. `[?]` Whether a devcontainer is viable given the Linux build
needs a pinned 22.04 image (Q-46) — it actually is, and is probably the answer.

**Owner** community · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0043-contributor-onboarding.md`

---

<a id="q-69"></a>
### Q-69 · Documentation as a deliverable or an afterthought?

**Why it matters.** We have produced a large `research/` tree. Someone has to
turn it into a user manual, an architecture doc, and a contributor guide, and
that is a real time cost.

**Options.** (1) `research/` is the deliverable; user docs come after v1.
(2) Ship user docs with v0.1.

**Evidence we have.** `[V]` The repo already plans `docs/product/`,
`docs/architecture/`, `docs/engineering/`, and `docs/glossary.md`.
`[I]` A Markdown viewer whose docs are excellent is a differentiator.

**Evidence missing.** `[?]` Available time.

**Owner** docs · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0044-documentation-strategy.md`

---

<a id="q-70"></a>
### Q-70 · Security disclosure process and response SLA

**Why it matters.** We read untrusted files. A vulnerability in our sanitizer is
remote code execution for anyone who opens a malicious `.md`. That makes our
security posture a product feature and demands a real disclosure process.

**Options.** (1) `SECURITY.md` with a private email and a 90-day disclosure
window. (2) GitHub Security Advisories only. (3) Both, with a published SLA.

**Evidence we have.** `[V]` Our threat model (research/11) makes XSS
RCE-adjacent, which raises the bar on our own process.
`[V]` The planned repo layout already includes `SECURITY.md`.

**Evidence missing.** `[?]` Whether anyone is available to actually respond. A
published SLA we cannot meet is worse than none.

**Owner** security · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0045-security-response.md`

---

<a id="q-71"></a>
### Q-71 · Dependency policy: Dependabot, review SLA, licence scanning

**Why it matters.** A parser CVE in the dependency chain is a named risk. A
licence change upstream (MIT → BUSL, as `notify` itself contemplates for v5) is
also a named risk.

**Options.** (1) Dependabot weekly for npm, `cargo audit` in CI, licence check
in CI, 7-day review SLA. (2) Manual updates. (3) Renovate with aggressive
grouping.

**Evidence we have.** `[V]` pnpm's supply-chain hardening (10.26+):
`allowBuilds`, `blockExoticSubdeps`, tarball integrity hashes, `--trust-lockfile`.
`[V]` The `notify` crate's own documentation states licensing "will change from
version 5 to Artistic 2.0" — a concrete, currently-occurring example of
upstream licence drift in a dependency we are considering.

**Evidence missing.** `[?]` Whether an automated licence scanner (e.g.
`cargo-deny`, `license-checker`) is worth the CI minutes.

**Owner** security · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0046-dependency-policy.md`

---

<a id="q-72"></a>
### Q-72 · Bus factor: what if the one Rust maintainer leaves?

**Why it matters.** Explicitly a named risk. The Rust core and the Tauri shell
are where the deepest knowledge sits, and it is concentrated.

**Options.** (1) Keep the Rust surface as small as possible (doc 02 §8's narrow
option (c)). (2) Document the Rust internals thoroughly. (3) Recruit a second
maintainer. (4) Accept it and write an ARCHITECTURE.md good enough to hand over.

**Evidence we have.** `[I]` Narrowing the Rust surface is the real mitigation —
everything else is documentation. `[I]` The adapter contract test suite (doc 02
§10, doc 03 §11) means the platform-specific knowledge is expressed as tests,
which is the most transferable form it can take.

**Evidence missing.** `[?]` Whether the person exists.

**Owner** project-lead · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0047-bus-factor.md`

---

<a id="q-73"></a>
### Q-73 · Good-first-issue strategy and issue triage load

**Why it matters.** An open issue tracker invites triage work. One person cannot
triage a popular open-source project and also build it.

**Options.** (1) Curated `good first issue` list with reproduction steps.
(2) Labels + a stale-bot. (3) A contributing guide that asks reporters to
reproduce against the current release.

**Evidence we have.** `[V]` The README says "the issue tracker is open to new
contributors", which is an invitation that creates an obligation.

**Evidence missing.** `[?]` Expected issue volume. `[M]` Nothing.

**Owner** community · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0048-community-process.md`

---

<a id="q-74"></a>
### Q-74 · How do we honestly answer "why not Obsidian?"

**Why it matters.** This will be the most common question and the most common
place we could be dishonest. The honest answer is partly "we are much smaller and
do much less", which is a fine answer.

**Options.** (a) Write the comparison honestly, including what Obsidian does
better.

**Evidence we have.** `[V]` research/13 is a competitor analysis; Obsidian is
closed-source, proprietary, and has an enormous plugin ecosystem.
`[I]` Our genuine differentiators: no account, no telemetry, MIT, open
development, a viewer that opens a single file without a vault.

**Evidence missing.** `[?]` Whether to publish the comparison at all, given it
invites an argument we cannot win on features.

**Owner** product · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0049-positioning.md`

---

<a id="q-75"></a>
### Q-75 · How do we say no in public?

**Why it matters.** Scope creep is a named risk, and the way a maintainer says no
determines whether a community forms around the project or leaves.

**Options.** (1) A documented "out of scope" list with reasoning (Q-52) and a
template that requires the issue author to acknowledge it. (2) Silence.
(3) "It's on the roadmap" for everything.

**Evidence we have.** `[I]` This folder is the raw material: every question has a
deadline and options, which is exactly what makes a "no, and here's why, and
here's what would change our mind" answer possible.

**Evidence missing.** `[?]` Nothing — process.

**Owner** community · **Deadline** 2027-03-31 · **Status** open
**ADR** `docs/adr/0048-community-process.md`

---

<a id="q-76"></a>
### Q-76 · Binary reproducibility — is it a goal?

**Why it matters.** Reproducible builds would let a user verify that the binary
they downloaded is the one we built from the tag — a strong answer to SmartScreen
distrust and supply-chain concerns.

**Options.** (1) Not a goal. (2) Aim for `diffoscope`-clean Linux builds.
(3) Publish SLSA provenance attestations instead, which is much cheaper.

**Evidence we have.** `[V]` GitHub artifact attestations provide SLSA Build
Level 2, and Level 3 with reusable workflows; they are free for public repos and
require no build-system changes. `[I]` True bit-for-bit reproducibility across
our three platforms would require pinning everything including the Rust
toolchain and the webview system libraries — high effort, low user-visible payoff.

**Evidence missing.** `[M]` How close a Linux AppImage is to reproducible today.

**Owner** build · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: distribution trust becomes a blocker)

**ADR** `docs/adr/0026-updater-manifest.md`

---

<a id="q-77"></a>
### Q-77 · AppImage vs `.deb` vs Flatpak priority for v1

**Why it matters.** Linux packaging is where most of our distribution effort
goes, and each format has different reach.

**Options.** (1) AppImage + `.deb`. (2) All three including Flatpak.
(3) Flatpak first (auto-updates, verified builds).

**Evidence we have.** `[V]` AppImage carries its own webview and needs
`chmod +x`; it does not carry glibc, so the build host sets the floor.
`[V]` `.deb` integrates with `apt` and systemd but ties us to a distribution
family's dependency versions. `[V]` Tauri's AppImage docs require building on
the oldest base providing `webkit2gtk-4.1` (Ubuntu 22.04 / Debian 12).

**Evidence missing.** `[A]` Which distros our users are on — this determines the
whole answer and we have no data.

**Owner** project-lead · **Deadline** 2027-01-15 · **Status** open
**ADR** `docs/adr/0025-linux-distribution.md`

---

<a id="q-78"></a>
### Q-78 · Who owns the store and signing accounts?

**Why it matters.** An organisation account that only one person can access is
a single point of failure for releases *and* for the project's identity.

**Options.** (1) Organisation-owned accounts, at least two maintainers with
access. (2) Personal accounts, documented.

**Evidence we have.** `[I]` The project lives under the `siyana-code` GitHub
organisation, which is a good starting point. `[V]` Azure Trusted Signing
requires an identity with a tenant, a client id, and a signing profile — all of
which belong to someone.

**Evidence missing.** `[?]` Whether the organisation has, or will get, the
required Azure and Store accounts.

**Owner** project-lead · **Deadline** 2027-06-30 · **Status** deferred
(revisit trigger: a signing account is created)

**ADR** `docs/adr/0042-governance.md`

---

## Related

- [Risk register](02-risk-register.md) — the things that could go wrong
- [Decision schedule](03-decision-schedule.md) — when each of these lands
- [`../14-architecture-options/`](../14-architecture-options/) — the technical
  context for Q-01 through Q-47
