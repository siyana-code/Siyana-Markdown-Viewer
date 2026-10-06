# System architecture

## Context

Siyana Markdown Viewer is a local-first Markdown reader. It runs as a desktop
application on Windows and Linux, with web and mobile targets planned. It has no
backend, no accounts, and no network dependency.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          The user's machine                        │
│                                                                     │
│   ┌──────────────────┐    ┌──────────────────────────────────┐      │
│   │   Untrusted      │    │      Siyana Markdown Viewer      │      │
│   │   input          │    │                                  │      │
│   │                  │    │  ┌────────────────────────────┐  │      │
│   │  .md files       │───▶│  │  packages/core             │  │      │
│   │  folders         │    │  │  decode → parse → AST      │  │      │
│   │  images          │    │  │  → sanitize → HTML string  │  │      │
│   │  settings        │    │  └─────────────┬──────────────┘  │      │
│   │                  │    │                │                 │      │
│   │  hostile HTML    │    │  ┌─────────────▼──────────────┐  │      │
│   │  path traversal  │    │  │  packages/ui               │  │      │
│   │  ReDoS payloads  │    │  │  content styles, chrome,   │  │      │
│   └──────────────────┘    │  │  TOC, search UI            │  │      │
│                           │  └─────────────┬──────────────┘  │      │
│                           │                │                 │      │
│                           │  ┌─────────────▼──────────────┐  │      │
│                           │  │  Shell (Tauri)             │  │      │
│                           │  │  ├ window + webview        │  │      │
│                           │  │  ├ capability-gated IPC     │  │      │
│                           │  │  └ filesystem + settings   │  │      │
│                           │  └────────────────────────────┘  │      │
│                           └──────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                         opt-in only, per document
                                   ▼
                            The internet
```

## Containers

### 1. `packages/core` — the rendering engine

Pure, synchronous, no I/O, no UI, no platform APIs.

```text
markdown bytes
   │
   ▼
┌──────────────┐
│  decode      │  encoding detection, BOM strip, line-ending normalise
└──────┬───────┘
       ▼
┌──────────────┐
│  parse       │  CommonMark + declared extensions → AST
└──────┬───────┘  (enforced limits; throws on limit breach)
       ▼
┌──────────────┐
│  transform   │  slug/anchor generation, TOC extraction, footnotes,
└──────┬───────┘  task-list ids, math/diagram placeholders
       ▼
┌──────────────┐
│  serialize   │  AST → HTML string, from a fixed tag vocabulary
└──────┬───────┘  with escaped attribute values
       ▼
┌──────────────┐
│  sanitize    │  DOMPurify allowlist: tags, attributes, URL schemes
└──────┬───────┘
       ▼
   sanitized HTML string  ──▶  packages/ui
```

Hard constraints on this package:

- **No DOM.** It produces a string. Sanitization happens in the browser
  context, not here, but the string it produces is untrusted until it has been
  through the sanitizer.
- **No filesystem, no network, no IPC.**
- **Enforced limits.** Nesting depth, input size, link nesting, table
  dimensions. Exceeding a bound raises a typed error that the caller converts
  into the raw-text fallback — never a hang.
- **Deterministic.** Same input, same output, everywhere. That is what makes
  conformance testing and snapshot testing possible.

### 2. `packages/ui` — presentation

Everything the user sees: the content stylesheet, theme tokens, the chrome
(navigation, TOC, search, settings), and keyboard handling.

Its most important job is **not** looking generic: the content stylesheet is
what makes a document readable. Typography, measure, rhythm, and code block
treatment are the product. See
[`research/12-ux/01-reading-ux.md`](../../research/12-ux/01-reading-ux.md).

It receives sanitized HTML and puts it in the DOM. It never calls `innerHTML`
with anything that has not been through the sanitizer, which is enforced by a
lint rule.

### 3. `apps/desktop` — the shell

The window, the IPC bridge, the native capabilities: file dialogs, filesystem
access scoped to the workspace root, settings persistence, window state, and the
auto-updater.

The shell owns every trust decision. It validates paths, enforces scopes, and
resolves symlinks before any renderer-requested read happens. See
[ADR-0005](../adr/0005-security-baseline-xss-sanitization.md).

### 4. `packages/fs-adapters` — the filesystem boundary

One interface, several implementations, because the three targets have genuinely
different filesystem models:

| Target | Model |
|---|---|
| Desktop | Real paths. Full read, write, and watch. Scoped to a workspace root. |
| Web | `FileSystemDirectoryHandle` where available; OPFS as a fallback; input and drag-drop otherwise. No watch. |
| Mobile | Sandboxed document pickers. No arbitrary paths. No watch. |

Capabilities are feature-detected at runtime, not inferred from the platform.

```ts
interface FileSystemAdapter {
  readonly capabilities: {
    canRead: boolean
    canWrite: boolean
    canWatch: boolean
    hasRealPaths: boolean
  }

  openDocument(pathOrHandle: PathRef): Promise<RawFile>
  listDirectory(pathOrHandle: PathRef): Promise<Entry[]>
  writeDocument(pathOrHandle: PathRef, bytes: Uint8Array): Promise<void>
  watch(pathOrHandle: PathRef, onChange: () => void): Promise<WatchHandle>

  resolveLocalAsset(basePath: PathRef, relative: string): Promise<AssetRef | null>
  showOpenDialog(options: OpenOptions): Promise<PathRef[]>
}
```text

The `resolveLocalAsset` method is where path traversal is refused, so there is
one place to review rather than several.

## Rendering pipeline

The full flow, from a double-click to pixels.

```
1. Shell      user double-clicks a .md file
2. Shell      resolve the path, check it is inside the workspace root
3. Shell      read the bytes              ── no parse, no DOM yet
4. Core       detect encoding, strip BOM, normalise line endings
5. Core       parse to AST                ── limits enforced
6. Core       transform: slugs, TOC, footnotes, task ids
7. Core       serialize to HTML
8. UI         sanitize with DOMPurify     ── mandatory, no bypass
9. UI         build the TOC and outline
10. UI        insert the sanitized content into a detached element
11. UI        decorate: highlight code, render math, render diagrams
              ── deferred to idle; never on the critical path
12. UI        paint
```text

Error handling at every step:

| Failure | Behaviour |
|---|---|
| Cannot read the file | Dialog with the path and the OS error. Nothing else happens. |
| Decode failure | Render as bytes with replacement characters, and warn. |
| Parse throws (limit breach) | Render the raw source as preformatted text. Notice at the top. |
| Sanitizer throws or rejects | Render the raw source as preformatted text. Never the unsanitized string. |
| Decorator throws | Render the block undecorated. The rest of the document is unaffected. |
| Renderer crashes | Tauri window remains; the app restarts the view from the current document state. |

The invariant: **there is always something on screen, and it is always safe.**

## Re-render strategy

Re-parsing and re-inserting the entire document on every keystroke is what
makes live-preview editors feel bad. We avoid it three ways:

1. **Block-level granularity.** The document is parsed as a sequence of
   top-level blocks. Only blocks whose source span changed are re-parsed and
   re-rendered; the rest of the DOM is left alone.
2. **Deferred decoration.** Syntax highlighting, math, and diagrams run after
   first paint, in idle time, and their results are cached per block.
3. **No wholesale `innerHTML`.** Even when the whole document changes, we
   replace children individually rather than reassigning a container's HTML.

Source-span mapping is what makes (1) possible. The parser records where each
block came from, so a changed byte range maps to a set of blocks. Options for
getting those spans are compared in
[`research/04-parsing-internals/04-parser-architectures.md`](../../research/04-parsing-internals/04-parser-architectures.md).

## Trust boundaries

| Boundary | Crossed by | Enforcement |
|---|---|---|
| File → app | A `.md` file | Treated as hostile. Parsed with raw HTML disabled. |
| App → renderer | Sanitized HTML | DOMPurify allowlist. No bypass path exists. |
| Renderer → native | IPC calls | Named, validated functions. Tauri capabilities are the allowlist. |
| Renderer → filesystem | Path-scoped reads | Root confinement, symlink resolution, path validation. |
| App → network | Nothing by default | No network capability unless the user opts in, per document. |
| Document → settings | Settings file on load | Parsed defensively; corrupt settings fall back to defaults. |

## Why these choices

| Decision | Reason | Where it is argued |
|---|---|---|
| Renderer as HTML/CSS | Markdown rendering, theming, and a11y semantics are web problems. | [ADR-0003](../adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md) |
| Four-layer security model | One layer's bug must not be exploitable. | [ADR-0005](../adr/0005-security-baseline-xss-sanitization.md) |
| Pure, deterministic core | Conformance and snapshot testing require it; web/mobile reuse requires it. | [ADR-0002](../adr/0002-monorepo-with-workspaces.md) |
| Established parser over our own | CommonMark conformance is a large, subtle, security-critical problem. | [ADR-0004](../adr/0004-markdown-parser-strategy.md) |
| Adapter interfaces for filesystem | The three targets have genuinely different models. | [`research/14-architecture-options/02-shared-core.md`](../../research/14-architecture-options/02-shared-core.md) |

## Related documents

- [Monorepo structure](monorepo-structure.md) — where each piece lives
- [Rendering pipeline](rendering-pipeline.md) — the step-by-step detail
- [ADR-0003](../adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md) — the shell
- [ADR-0004](../adr/0004-markdown-parser-strategy.md) — the parser
- [ADR-0005](../adr/0005-security-baseline-xss-sanitization.md) — security
- [`research/14-architecture-options/`](../../research/14-architecture-options/README.md) — the options we chose between
