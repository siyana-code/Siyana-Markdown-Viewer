# Monorepo structure

## Layout

```
Siyana-Markdown-Viewer/
│
├── apps/
│   ├── desktop/                    Phase 1  — the desktop application
│   ├── web/                        Phase 6  — browser / PWA build
│   └── mobile/                     Phase 7  — mobile build
│
├── packages/
│   ├── core/                       the rendering engine. pure.
│   ├── sanitize/                   the sanitization policy. security-critical.
│   ├── ui/                         shared components and theme tokens
│   ├── fs-adapters/                filesystem interface + implementations
│   ├── search/                     outline, TOC, and search index
│   ├── editor/                     Phase 4  — editing models
│   ├── test-fixtures/              spec suites and regression fixtures
│   └── config/                     shared Biome / tsconfig / lint rules
│
├── research/                       the study
├── docs/                           the decisions
│
├── package.json                    workspace root, scripts only
├── pnpm-workspace.yaml
├── Cargo.toml                      workspace root (only if ADR-0003 selects Rust)
├── biome.json
├── tsconfig.base.json
└── .markdownlint-cli2.jsonc
```

## The dependency rule

```
                    ┌──────────────────────────────┐
   may import  ───▶ │  packages/core               │  ───▶ nothing
                    │  packages/sanitize           │
                    │  packages/search             │
                    │  packages/ui (no platform)   │
                    └──────────────────────────────┘
                                     ▲
                    ┌────────────────┴─────────────────┐
   may import       │  packages/fs-adapters,            │  ───▶ core
                    │  packages/ui (platform bits)     │
                    └──────────────────┬────────────────┘
                                       ▲
                    ┌──────────────────┴────────────────┐
   may import       │  apps/desktop, apps/web,          │  ───▶ everything
                    │  apps/mobile                     │
                    └─────────────────────────────────┘
```

1. `core`, `sanitize`, and `search` **must not** import from `apps/*` or from
   any package that touches a platform API. Enforced by a lint rule scoped to
   those packages.
2. A package must not import an app.
3. `ui` is split internally: the presentational components import only from
   `core`/`sanitize`/`search`; the platform-aware pieces import `fs-adapters` and
   are only pulled in by apps.
4. Cycles are a lint error.

## Package responsibilities

### `packages/core`

The rendering engine. Pure and synchronous.

| Module | Responsibility |
|---|---|
| `decode` | Encoding detection, BOM strip, line-ending normalisation, invalid-byte handling |
| `parse` | Markdown → AST, with the enabled extension set and enforced limits |
| `transform` | Anchors/slugs, TOC extraction, footnote collection, task-list ids, math placeholders |
| `serialize` | AST → HTML string from a fixed tag vocabulary |
| `limits` | The bound table, and typed errors when a bound is breached |
| `profile` | The "Siyana Markdown Profile" — which extensions are on, and at what version |

Public surface:

```ts
export interface RenderOptions {
  readonly profile?: MarkdownProfile
  readonly limits?: LimitOverrides
  readonly anchors?: { enabled: boolean; prefix?: string }
  readonly footnotes?: { enabled: boolean }
  readonly rawHtml?: 'escape' | 'allow-if-sanitized'
}

export interface RenderResult {
  readonly html: string           // UNTRUSTED until sanitized
  readonly outline: OutlineNode[]
  readonly footnotes: Footnote[]
  readonly title: string | null
  readonly stats: RenderStats     // block count, byte count, parse duration
}

export type RenderError =
  | { kind: 'limit-exceeded'; limit: LimitName; observed: number; allowed: number }
  | { kind: 'decode-failure'; detail: string }
  | { kind: 'parse-failure'; detail: string }

export function render(source: Uint8Array, options?: RenderOptions): RenderResult
```

The `RenderResult.html` being explicitly marked untrusted is deliberate. It is a
type-level reminder that the sanitizer step has not happened yet.

### `packages/sanitize`

One job: turn untrusted HTML into trusted HTML, or refuse.

```ts
export interface SanitizePolicy {
  readonly allowedTags: ReadonlySet<string>
  readonly allowedAttributes: ReadonlySet<string>
  readonly allowedSchemes: ReadonlySet<string>
  readonly allowRemoteImages: boolean
  readonly allowDataImages: boolean
  readonly maxDataUriBytes: number
}

export const DEFAULT_POLICY: SanitizePolicy

export function sanitize(html: string, policy?: SanitizePolicy): SanitizeResult
export function isSafeUrl(url: string, scheme: ReadonlySet<string>): boolean
```

Exported separately so it can be reviewed, tested, and fuzzed on its own, and so
the security-critical code has one address in the repository.

### `packages/ui`

| Module | Responsibility |
|---|---|
| `theme` | Theme tokens as CSS custom properties; light/dark/system resolution |
| `content-style` | The content stylesheet. Typography, spacing, every block type |
| `chrome` | Window chrome: navigation, TOC, search panel, settings |
| `viewer` | Inserts sanitized content; owns re-render and scroll-spy |
| `keys` | The keyboard map and the shortcut reference |
| `decorators` | Code highlighting, math, diagrams. Deferred and cached |

`viewer` is the only place in the codebase permitted to insert rendered content,
and it accepts only a value that has been through `sanitize`.

### `packages/fs-adapters`

```ts
export interface FileSystemAdapter { /* see architecture/overview.md */ }
export function createDesktopAdapter(scope: RootScope): FileSystemAdapter
export function createWebAdapter(caps: WebFsCapabilities): FileSystemAdapter
export function createMobileAdapter(): FileSystemAdapter
```

`RootScope` is the security-relevant object: it holds the approved roots and is
the thing that refuses a traversal.

### `packages/search`

| Module | Responsibility |
|---|---|
| `outline` | Build the heading tree from a `RenderResult` |
| `query` | Search execution against a document set |
| `index` | Optional persistent index; absent in Phase 2 |
| `chunker` | Read files and yield to the event loop so the UI never blocks |

### `packages/test-fixtures`

- The CommonMark `spec.json` suite, vendored with its version.
- The GFM spec suite, same.
- Our own regression fixtures, each referencing the issue it came from.
- Hostile inputs for the fuzzer, including the payload classes from
  [`research/11-security/01-threat-model.md`](../../research/11-security/01-threat-model.md).

## Workspace configuration

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `package.json` (root)

Scripts only — no code:

```json
{
  "name": "siyana-markdown-viewer",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --filter=desktop",
    "test": "turbo run test",
    "test:conformance": "turbo run test:conformance --filter=@siyana/test-fixtures",
    "test:fuzz": "turbo run test:fuzz --filter=@siyana/fuzz",
    "lint": "biome check . && turbo run lint",
    "lint:fix": "biome check --write .",
    "format:check": "biome format .",
    "typecheck": "turbo run typecheck && cargo check --workspace",
    "conformance:report": "node packages/test-fixtures/bin/report.ts"
  }
}
```

### `Cargo.toml` (workspace root, only if a Rust component is adopted)

```toml
[workspace]
resolver = "2"
members = ["crates/siyana-core"]

[workspace.package]
version = "0.1.0"
edition = "2021"
rust-version = "1.80"
license = "MIT"

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
thiserror = "2"
```

Both lockfiles are committed. For an application, a reproducible build is a
security property.

## Versioning

Fixed (locked-step). Every internal package carries the workspace version and
they are released together. A version skew between `core` and `ui` is a bug, not
a feature — we ship one application, not a library with consumers.

## Build orchestration

Turbo or Nx, decided with
[ADR-0003](../adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md). The
requirement is the same either way: a docs-only change must not trigger the
desktop build matrix.

## Directory conventions

- Tests live beside the code they test, in `*.test.ts`.
- Public module entry points are `index.ts`; internals are not re-exported.
- No cross-package deep imports. `@siyana/core/parse/internal` is a lint error;
  if it is needed, it should be exported properly or moved.
- No barrel file that re-exports everything. It defeats tree-shaking and hides
  the dependency graph.

## Related

- [Architecture overview](overview.md)
- [Rendering pipeline](rendering-pipeline.md)
- [ADR-0002](../adr/0002-monorepo-with-workspaces.md)
- [`research/14-architecture-options/01-monorepo-strategy.md`](../../research/14-architecture-options/01-monorepo-strategy.md)