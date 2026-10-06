# Rendering pipeline

The path from a byte array on disk to pixels on screen, stage by stage. The
question this document answers is: **what runs where, and what happens when it
fails.**

The deeper background is in
[`research/04-parsing-internals/`](../../research/04-parsing-internals/README.md)
and [`research/05-rendering/`](../../research/05-rendering/README.md). This
document is the implementation spec.

---

## Stage 0 — Read (shell, native)

The shell reads the file. Nothing is parsed yet.

```text
resolve path
  → check inside an approved root       (RootScope)
  → follow symlinks, re-check root      (symlink escape is the attack)
  → stat: size, mtime
  → read bytes
```

**Guards:** refuse above the size threshold with an explicit user choice rather
than silently truncating (`R-P3-06`). A read that returns fewer bytes than
`stat` promised means the file is being written concurrently — treat it as a
partial read, not as valid content.

**Failure:** permission denied, file gone, is a directory. One dialog with the
path and the OS error. Nothing else happens.

---

## Stage 1 — Decode (core, main thread)

```text
bytes
  → detect encoding (UTF-8, UTF-8+BOM, UTF-16 LE/BE, Latin-1 fallback)
  → strip BOM
  → normalise line endings (CRLF, CR → LF)
  → replace invalid sequences with U+FFFD rather than throwing
```

**Why this matters:** assuming UTF-8 produces mojibake or a thrown error on
real files. Windows files are frequently UTF-16; files from older tools are
frequently Latin-1 or GBK. Decoding badly is a correctness bug that looks like a
parser bug.

**Limits:** a UTF-16 file is half the size in characters; the byte threshold
applies before decoding.

**Failure:** never fails. Invalid bytes become replacement characters, and the
result carries a `hadReplacementCharacters` flag so the UI can mention it.

---

## Stage 2 — Parse (core, main thread)

Markdown text → AST, with the enabled extension set from the Siyana Markdown
Profile.

Two phases, as every serious parser does: the block phase determines structure,
then the inline phase resolves links, emphasis, and code spans. The inline phase
cannot start until the block phase finishes, because whether a line is a heading
or paragraph text determines how its content is interpreted.

**Limits enforced here**, with a typed error rather than a crash:

| Limit | Default | Behaviour on breach |
|---|---|---|
| Input size | 32 MB | Refuse with a prompt to open anyway in raw mode |
| Container nesting depth | 100 | `limit-exceeded` error |
| Inline nesting depth | 50 | `limit-exceeded` error |
| Link label nesting | 32 | Truncate the nesting |
| Table columns | 1000 | Truncate columns |
| Table rows | 100,000 | Truncate rows |
| Emphasis delimiter stack | 100,000 | `limit-exceeded` error |
| Block quote depth | 100 | `limit-exceeded` error |
| Repeated reference definitions | 100,000 | Truncate |

**Failure:** a `limit-exceeded` or `parse-failure` error is caught by the
caller, which renders the raw source as preformatted text with a notice
(`R-P1-06`). The app never shows an empty view.

---

## Stage 3 — Transform (core, main thread)

Pure AST rewrites. Nothing here generates untrusted markup.

| Transform | What it does |
|---|---|
| Anchors | Assign heading ids using the GitHub slug algorithm, with `-1`/`-2` dedupe |
| Outline | Build the nested heading tree for the TOC |
| Footnotes | Collect references and definitions, renumber, resolve orphans |
| Task lists | Add stable ids so checkbox state can be restored per document |
| Math | Replace math spans with typed placeholder nodes for the math decorator |
| Diagrams | Mark fenced blocks whose info string declares a diagram renderer |
| Media | Annotate image nodes with their resolved base directory |

Footnote reference resolution is worth noting: a reference with no definition
becomes literal text, not a broken link. This matches how GitHub and
markdown-it behave, and it means a malformed footnote degrades rather than
disappearing.

---

## Stage 4 — Serialize (core, main thread)

AST → HTML string, from a fixed vocabulary.

Rules:

- Only tags we emit are ever produced. There is no path from input to an
  arbitrary tag.
- All attribute values are escaped by construction. No string concatenation of
  user data into markup.
- Raw HTML in the source is **escaped as text**, per
  [ADR-0005](../adr/0005-security-baseline-xss-sanitization.md). It does not
  reach this stage as live HTML.
- URL values are checked against the scheme allowlist during serialization. A
  rejected URL becomes a non-link span, with the original recorded for the
  status bar so the user can see what was refused.

**Output is untrusted.** This matters: `RenderResult.html` is marked as such in
the type. The next stage is mandatory.

---

## Stage 5 — Sanitize (packages/sanitize, main thread)

`DOMPurify` with a fixed policy.

- Tag allowlist. Blocklists are not used anywhere in this project.
- Attribute allowlist, per tag where it matters.
- `on*` handlers removed.
- `<svg>`, `<math>`, `<foreignObject>`, `<style>`, `<script>`, `<iframe>`,
  `<object>`, `<embed>`, `<form>` removed.
- URL schemes allowlisted to `http`, `https`, `mailto`, `tel`, and
  relative/fragment. Checked **after** entity decoding and URL normalisation, so
  `java&#115;cript:` and `javascript&colon;` are caught.
- `data:` permitted only for images, only for a MIME allowlist, only under a
  size cap.
- `rel="noopener noreferrer"` added to every link that opens externally.

**Why keep this if serialization is already strict:** because it is the layer
that survives a bug in the layer above. A plugin upgrade that re-enables HTML,
an escaping mistake in a decorator, a future refactor that starts concatenating
— none of them are sufficient for XSS while the sanitizer is in place.

**Failure:** if the sanitizer throws or returns an empty result for non-empty
input, we render the raw source as preformatted text. The unsanitized string is
never inserted (`R-P1-10`).

---

## Stage 6 — Insert (packages/ui, main thread)

```ts
// The only sanctioned insertion path.
const container = document.createElement('div')
container.innerHTML = sanitizedHtml    // sanitizedHtml is the ONLY argument
                                     // to innerHTML anywhere in the codebase
viewer.replaceChildren(container)
```text

Enforced by:

1. A lint rule banning `innerHTML` outside `packages/ui/viewer`.
2. The insertion function taking a branded `SanitizedHtml` type, so unsanitized
   strings do not type-check at the call site.

**Why a detached element first:** inserting into a live tree triggers layout per
mutation. Building detached and inserting once is measurably faster and avoids
intermediate layout.

**Semantic preservation:** the sanitizer is configured to keep `id`, `class`
(allowlisted values), `lang`, `dir`, `title`, `alt`, `href`, `colspan`,
`rowspan`, `align`, `start`, `type`, and `checked`. Flattening headings or
tables into generic containers would break screen readers (`R-P3-41`), so the
policy is part of the accessibility contract, not a detail.

---

## Stage 7 — Decorate (packages/ui, deferred)

Runs after first paint, in idle time. Never on the critical path.

| Decorator | Runs | Cached by |
|---|---|---|
| Syntax highlighting | Worker, batched | `codeHash + language + theme` |
| Math | Lazy-loaded library, IntersectionObserver | Rendered AST of the expression |
| Diagrams | Lazy-loaded renderer | `codeHash + renderer + theme` |
| Link resolution | Immediate (cheap) | Path resolution result |

Decorators are individually fault-tolerant: a decorator that throws leaves its
block undecorated and logs. The rest of the document renders normally.

Highlighting runs in a Web Worker because it is the only CPU-heavy stage. Its
cache key includes the theme, so a theme change re-highlights rather than
showing code in the wrong colours.

---

## Stage 8 — Paint

What the user sees. Two things happen immediately after insertion:

- **Scroll-spy.** An `IntersectionObserver` over headings updates the TOC
  highlight. Observers, not scroll handlers — a scroll listener that reads
  layout on every frame is the classic cause of jank.
- **Visible-block initialisation.** `content-visibility: auto` plus
  `contain-intrinsic-size` means off-screen content costs almost nothing to lay
  out and paint. This is the single highest-leverage CSS technique for large
  documents. See
  [`research/10-performance/01-large-files.md`](../../research/10-performance/01-large-files.md).

---

## Re-render: the edit path

Typing must not re-parse and re-insert the whole document. The strategy:

```
keystroke
  → update the source buffer
  → mark dirty byte ranges
  → map dirty ranges to top-level blocks (via recorded source spans)
  → re-parse ONLY dirty blocks
  → sanitize the small resulting fragment
  → replace only those children
  → schedule decoration for the changed blocks
```text

Three things make this work:

1. **Source spans.** The parse step records the byte range of every top-level
   block. This is the hard requirement, and it is the main reason the parser
   choice in [ADR-0004](../adr/0004-markdown-parser-strategy.md) matters more
   than raw parse speed.
2. **Debouncing.** Parse on idle, not on keystroke. 50-100 ms feels immediate;
   parsing on every character feels laggy.
3. **Per-child replacement.** `replaceChild` on the affected nodes, not
   `replaceChildren` on the container.

Block boundaries that cross a change are re-parsed together. A block is the
unit, not the character, which is why a partially typed `**bold` is fine — the
whole paragraph re-parses.

---

## Cost model

| Stage | Where | Budget for a 5 MB document |
|---|---|---|
| Read | Native | ≤ 200 ms |
| Decode | Main | ≤ 100 ms |
| Parse | Main | ≤ 800 ms |
| Transform | Main | ≤ 50 ms |
| Serialize | Main | ≤ 150 ms |
| Sanitize | Main | ≤ 200 ms |
| Insert | Main | ≤ 150 ms |
| Paint | Renderer | ≤ 200 ms |
| **Total to first render** | | **under 2 s** (`R-P3-32`) |

Decoration (highlighting, math, diagrams) is outside this budget entirely, by
design.

If parse time exceeds the budget, the fix is `content-visibility` plus deferred
parsing of off-screen blocks — not a faster regex. See
[`research/10-performance/`](../../research/10-performance/README.md).

---

## Instrumentation

Every stage reports duration and output size to a debug panel behind a
developer shortcut. The numbers are used by the CI benchmark harness, so the
budgets above are measured rather than believed.

```
[render] read 84ms  decode 31ms  parse 612ms  transform 18ms
         serialize 96ms  sanitize 142ms  insert 88ms  paint 74ms
         → 214 blocks, 5.2 MB source, 1.9 MB DOM
         decoration deferred: 148 code blocks queued
```diff

---

## Failure matrix

| Stage | Failure | User sees | Never |
|---|---|---|---|
| Read | Permission denied | Dialog with the OS error | An empty view |
| Read | Being written concurrently | Partial content, notice | A silently truncated document |
| Decode | Invalid bytes | Replacement characters, notice | A crash |
| Parse | Limit exceeded | Raw source as preformatted text | A hang or a blank window |
| Parse | Malformed input | Raw source as preformatted text | Unescaped source in the DOM |
| Serialize | Internal error | Raw source as preformatted text | Unescaped source in the DOM |
| Sanitize | Throws or empties | Raw source as preformatted text | The unsanitized string in the DOM |
| Insert | DOM error | Raw source as preformatted text | An empty container |
| Decorate | Any decorator throws | The block, undecorated | A lost document |

The invariant holds in every row: **something is on screen, and it is safe.**

---

## Related

- [Architecture overview](overview.md)
- [ADR-0004](../adr/0004-markdown-parser-strategy.md)
- [ADR-0005](../adr/0005-security-baseline-xss-sanitization.md)
- [`research/05-rendering/`](../../research/05-rendering/README.md)
- [`research/10-performance/02-rendering-pipeline-performance.md`](../../research/10-performance/02-rendering-pipeline-performance.md)
