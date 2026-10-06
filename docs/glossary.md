# Glossary

Terms used across this repository, defined once. Where a term is overloaded in
the wider ecosystem, that is noted.

---

## Markdown and formats

**Markdown** — A plain-text markup format created by John Gruber in 2004, using
punctuation characters to indicate formatting. Its design goal is that the
source is readable and writable as plain text.

**CommonMark** — A formal specification of Markdown, created to resolve decades
of dialect divergence. It defines a strict core plus a small set of optional
extensions. It is a specification, not an implementation.

**GitHub Flavored Markdown (GFM)** — GitHub's superset of CommonMark, adding
tables, task lists, strikethrough, autolink literals, and (dangerously) raw HTML
passthrough. Now maintained as a W3C Community Group specification.

**Dialect** — A specific implementation's choices about which syntax it accepts.
"Markdown" on any given site is usually a dialect, not the spec.

**Extension** — Syntax beyond CommonMark: footnotes, wikilinks, math,
admonitions, definition lists. Usually specified informally and implemented
inconsistently.

**Flavour** — A named, coherent set of extensions adopted by a tool, e.g.
Obsidian's or Pandoc's. Usually informal.

**Block** — A top-level structural unit of a document: a paragraph, a heading,
a list, a code block, a table. Blocks can contain inline content but not other
blocks.

**Container block** — A block that can contain other blocks: a block quote, a
list, a list item. Distinguished from *leaf blocks*, which cannot.

**Inline** — Non-structural content within a block: emphasis, code spans,
links, images, autolinks.

**Delimiter run** — A run of `*` or `_` characters. Its length and the
whitespace around it determine whether it can open or close emphasis. This is
the mechanism behind CommonMark's most complex algorithm.

**Flanking** — Whether a delimiter run is *left-flanking*, *right-flanking*, or
both, determined by what precedes and follows it. `intraword` `*` cannot open
emphasis; `intraword` `_` can, which is why `snake_case_word` is untouched but
`snake*case*word` is emphasised.

**Lazy continuation** — A paragraph line that continues a block without repeating
the block's marker, e.g. a line inside a block quote that omits `>`.

**Tight vs loose list** — A tight list has no blank lines between items and
renders without `<p>` wrappers; a loose list has blank lines and renders with
them.

**Link reference definition** — `[label]: destination "title"` — a reusable link
target defined anywhere in the document.

**Front matter** — A metadata block at the top of a document, delimited by
`---`, `+++`, or `;;;`, in YAML, TOML, or JSON. Not part of Markdown; collides
with thematic breaks and Setext headings.

**Wikilink** — `[[Page Name]]` — non-standard internal link syntax from
Obsidian/Logseq and wiki software. Not CommonMark, not GFM.

**Block reference** — `^blockid` — an identifier attached to a block so it can
be linked to. Obsidian/LogText convention.

**MDX** — A format allowing JSX components and JavaScript expressions inside
Markdown. It executes code from the document. This project does not support it,
deliberately.

**CommonMark Profile** (our term) - See
[Siyana Markdown Profile](#siyana-markdown-profile), below.

---

## Parsing

**AST (Abstract Syntax Tree)** — The structured representation a parser produces.
A tree of nodes: document → blocks → inlines.

**Two-phase parsing** — Block phase first, then inline phase. The inline phase
cannot begin until the block phase is complete, because whether a line is a
heading or paragraph text determines how its content is interpreted.

**Delimiter stack** — The algorithm for resolving emphasis: openers and closers
are pushed and popped in order, allowing correct nesting of `*` and `_`.

**Openers bottom** — A delimiter-stack optimisation that tracks the lowest
possible opener position, avoiding an O(n²) scan.

**Source span / sourcepos** — The byte or line range a node was parsed from.
Required for incremental re-rendering and for mapping DOM positions back to text.

**Tokenizer / lexer** — The stage that splits input into tokens before or during
parsing.

**Round-trip preservation** — Editing a document and saving must leave
untouched content byte-for-byte identical. A correctness requirement, not a
nicety.

**ReDoS** — Regular expression denial of service: input crafted to trigger
catastrophic backtracking. A real risk in regex-based Markdown parsers.

---

## Security

**XSS (Cross-Site Scripting)** — Injecting executable script through untrusted
content. In a desktop app with a webview, XSS can escalate to file access and
code execution.

**Sanitization** — Passing HTML through an allowlist filter to remove anything
dangerous. Allowlists, never blocklists.

**CSP (Content Security Policy)** — A response header or meta tag restricting what
a document may load and execute. Defence in depth; it does not replace
sanitization.

**DOMPurify** — The standard in-browser HTML sanitizer. Maintained with a
published threat model.

**ammonia** — The Rust HTML sanitizer; the Rust-side equivalent of DOMPurify.

**URL scheme allowlist** — Permitting only `http`, `https`, `mailto`, `tel`, and
relative or fragment URLs, so `javascript:` and `data:` cannot execute.

**Capability / permission model** — Tauri's approach to IPC: the renderer is
granted an explicit, declared set of native operations. The alternative (v1's
allowlist) was configuration rather than capability.

**Trust boundary** — A point where data moves between contexts with different
privileges. Every one in this app is documented.

**Path traversal** — Escaping an intended directory via `../` or an absolute
path, to read or write files that were not offered.

**Symlink escape** — Traversing a symlink out of the workspace root. Defeated by
resolving symlinks and re-checking containment.

**TOCTOU** — Time-of-check to time-of-use: a check passes, then the state
changes before the operation. Relevant when a sync client rewrites a file between
our `stat` and our `read`.

**Fuzzing** — Feeding generated and mutated input to a system and asserting
invariants hold.

**SSRF** — Server-side request forgery. Not directly applicable to a local app,
but the same discipline applies to remote image references.

**NTFS alternate data stream** — Hidden data attached to a file as `file.txt:stream`.
A file-path attack surface on Windows.

---

## Desktop platforms and shells

**WebView2** — Microsoft's Chromium-based embedded browser for Windows
applications. Ships as an Evergreen runtime that updates itself, or can be
bundled as a Fixed Version. This is what Tauri and (with Electron's own
Chromium) desktop webview rendering rely on.

**WebKitGTK** — The GTK binding to WebKit used as the rendering engine on Linux
desktops. Its version varies by distribution, which is the main source of Linux
portability problems for webview-based apps.

**Electron** — A framework shipping its own Chromium and Node.js with each app.
Maximum consistency across platforms at the cost of install size and memory.

**Tauri** — A framework using the *system* webview with a Rust backend. Small
installs and low memory, at the cost of cross-platform webview inconsistency and
a Rust toolchain.

**Flutter** — Google's UI toolkit rendering to its own surface via Skia/Impeller,
not a system webview. Perfect visual consistency and one codebase for desktop,
web, and mobile, at the cost of no HTML/CSS and no DOM.

**Wry / Tao** — Tauri's Rust webview and window crates.

**Impeller** — Flutter's rendering backend, replacing Skia on some platforms.

**AppImage** — A self-contained Linux executable bundle requiring no
installation. Portable, but depends on FUSE.

**deb / rpm** — Debian and RPM package formats. Reach distribution users, but
require packaging decisions per distribution.

**MSI / NSIS** — Windows installer formats. NSIS produces the familiar
Setup.exe; MSI is the standard Windows Installer format.

**MSIX** — Microsoft's modern application packaging format. Not currently used
by this project.

**Authenticode** — Windows code signing. Required for SmartScreen reputation and
for Electron auto-update to work on Windows.

**Notarization** — Apple's process for verifying a signed app. Applies when we
ship macOS.

**minisign** — A small, fast signature scheme used by Tauri's updater to verify
update artifacts.

**Flatpak / Snap** — Linux distribution formats with their own sandboxing. Both
constrain which webview version the app gets, which is a genuine tension for an
app that renders Markdown with web technologies.

**Wayland** — The Linux display protocol replacing X11. Webview behaviour and
global keyboard shortcuts under Wayland are restricted relative to X11.

**xdg-desktop-portal** — The standard interface through which sandboxed Linux apps
request access to files outside their sandbox.

**XDG directories** — The standard Linux config, data, and cache locations:
`~/.config`, `~/.local/share`, `~/.cache`.

---

## Our project terms

### Siyana Markdown Profile

Our versioned, published declaration of which
Markdown extensions are supported, and how. REQUIRED / OPTIONAL / UNSUPPORTED
per extension. It exists because no post-CommonMark standard does.
See [`research/03-specifications/03-extension-standards.md`](../research/03-specifications/03-extension-standards.md).

**Siyana Markdown Viewer** — This project.

**The core** — `packages/core`: the pure Markdown → HTML rendering engine, with
no UI, I/O, or platform dependencies.

**An adapter** — A platform-specific implementation behind an interface defined
in a shared package.

**Trusted root** — A directory the app has been permitted to read. All
filesystem access is confined to one.

**Sanitized HTML** — HTML that has passed the sanitizer. Branded at the type
level so unsanitized strings cannot be passed where it is required.

**Workspace** — An opened folder, plus the metadata the app keeps about it.

**Focus mode** — A distraction-free reading view with all chrome hidden.

**Focusable** — Related to WCAG; an element that can receive keyboard focus. A
focus indicator that is invisible is a common and severe accessibility bug.

---

## Standards

**CommonMark spec** — <https://spec.commonmark.org/> — The Markdown
specification. Includes `spec.json` with the executable test suite.

**GFM spec** — <https://github.github.com/gfm/> — GitHub Flavored Markdown.

**WCAG 2.2 AA** — The accessibility conformance level this project targets.
**AA** is the second of three levels (A, AA, AAA). Our floor, not our goal.

**Semantic Versioning** — `MAJOR.MINOR.PATCH`, with pre-release identifiers.

**Conventional Commits** — A commit message convention. Required for PR titles
because we squash-merge.

**Keep a Changelog** — The changelog format we follow.

**ADR** — Architecture Decision Record. Numbered, immutable once accepted,
superseded rather than edited.

**SPDX** — Software bill of materials identifier format.

**SBOM** — Software Bill of Materials: a machine-readable inventory of a build's
dependencies.

---

## Quality and process

**Conformance** — The degree to which an implementation matches a specification,
measured by running the specification's own test suite.

**Regression** — A previously passing test that now fails. Detected regardless of
the absolute pass rate.

**Baseline** — A recorded result that future runs are compared against.

**Guardrail** — A limit or check that prevents a known failure mode.

**Invariant** — A property that must hold at all times. Ours: something is
always on screen, and it is always safe.

**Definition of done** — The checklist a change must satisfy to be complete. See
[`docs/engineering/testing-strategy.md`](engineering/testing-strategy.md).

---

## Design and typography

**Measure** — The width of a line of text, usually expressed in characters
(`ch`). Optimal reading is roughly 45–75 characters.

**Line height** — Vertical space between lines, usually as a unitless ratio.
Around 1.5–1.7 for body text.

**Vertical rhythm** — Consistent spacing derived from a base unit, so everything
aligns.

**Fout / FOIT** — Flash of unstyled text / flash of invisible text. The visual
cost of font loading, mitigated by `font-display`.

**Leading** — Another name for line height. Same thing.

**Ligatures** — Glyph substitutions for letter pairs, e.g. `fi`. Controlled with
`font-feature-settings`.

---

## Search

**Inverted index** — A map from term to the documents containing it. The basis of
efficient full-text search.

**FTS5** — SQLite's built-in full-text search extension.

**Tantivy** — A Rust full-text search library, the engine behind some search
tools.

**Minisearch / FlexSearch / Lunr / Orama** — JavaScript full-text search
libraries with different size and feature tradeoffs.

**N-gram** — A character sequence of length *n* used for substring matching
where word boundaries are unreliable — relevant for CJK search.

---

## Related

- [`research/README.md`](../research/README.md)
- [`docs/roadmap.md`](roadmap.md)
- [Architecture overview](architecture/overview.md)
