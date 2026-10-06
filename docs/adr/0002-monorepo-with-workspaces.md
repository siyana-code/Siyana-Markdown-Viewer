# ADR-0002: Use a monorepo with JS and Cargo workspaces

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Siyana Markdown Viewer maintainers
- **Consulted:** `research/14-architecture-options/01-monorepo-strategy.md`

## Context

We will build three targets — desktop, web, mobile — that share the majority of
their logic. The renderer (Markdown → AST → sanitized HTML), the theme system,
the table-of-contents logic, the outline model, the search index, and the
settings model are all platform-independent. Only the filesystem, windowing,
and shell integration differ.

We may also have a Rust core (ADR-0003 and ADR-0004 decide whether we do), which
means two build systems in one repository.

Requirements:

1. **One clone.** A contributor runs one `install` and one `test`.
2. **Shared code has one obvious home.** Not copied into three apps.
3. **Shared config, shared lint rules, shared test fixtures.**
4. **Independent versioning is not needed.** We ship one product, not a library
   with consumers.
5. **CI should not become slow** as packages accumulate.

## Decision

We use a **monorepo** with two workspace roots that coexist:

- **`pnpm` workspaces** for TypeScript/JavaScript packages.
- **A Cargo workspace** for Rust crates, if and when ADR-0003 settles on a Rust
  component.

Layout:

```text
apps/
  desktop/           # desktop shell (first)
  web/               # browser build
  mobile/            # mobile build
packages/
  core/              # parse -> AST -> sanitized HTML. No UI, no I/O.
  ui/                # shared components + theme tokens
  sanitize/          # HTML sanitization policy. Security-critical.
  fs-adapters/       # filesystem interface + per-platform implementations
  search/            # outline, TOC, and search index logic
  test-fixtures/     # CommonMark + GFM spec suites, our own regression fixtures
  config/            # shared Biome, tsconfig, and lint configuration
```text

Rules:

1. **`packages/core`, `packages/sanitize`, and `packages/search` have no
   platform dependencies.** They may not import from `apps/*`. They must run in
   a bare browser, a Node worker, and a webview without shims.
2. **Every platform-specific behaviour goes through an interface** declared in a
   `packages/*` package and implemented in `apps/*` or a `*-adapters` package.
3. **Fixed (locked-step) versioning.** Every published-internal package shares
   the workspace version. We are an application; a version skew between
   `core` and `ui` is a bug, not a feature.
4. **`Cargo.lock` and `pnpm-lock.yaml` are committed.** Reproducible builds are
   a security property for a desktop app.
5. **A package cannot depend on an app.**
6. **CI uses a dependency graph** (`turbo` or `nx` — decided with
   ADR-0003) so a docs-only change does not run the whole matrix.

## Alternatives considered

**Polyrepo with published shared packages.** Rejected. Cross-repo atomic
changes are the killer: a breaking change to `core` would need coordinated
releases across three repositories with independent CI queues and version
publishing. For a small team this is pure overhead.

**npm workspaces only, no Cargo.** Rejected as premature, not wrong. If ADR-0003
selects Electron or Flutter, there is no Cargo root and this ADR simply has one
workspace instead of two. The decision is written to tolerate that.

**A single root package with `src/` subfolders and import paths.** Rejected. No
enforced boundary, so `core` will eventually import a filesystem call, and we
will discover it when the web build fails. Package boundaries are enforced by
the module system; folder conventions are not.

**Nx or Turborepo vs bare workspaces.** Deferred to ADR-0003, because the
choice interacts with whether we have a Rust root. Bare `pnpm` workspaces with a
hand-written topological CI order are a viable fallback if adding a build
orchestrator is not worth it at our scale.

**Independent versioning (changesets).** Rejected. It only pays off when you
publish libraries that consumers adopt at different speeds. We publish one
application.

## Consequences

### Good

- One clone, one install, one test command. A new contributor's first step is
  the same for docs and for code.
- Core logic is written once and tested once, then reused by three targets.
- Test fixtures live in one package; adding a regression test for a parser bug
  benefits every target.
- Shared configuration is enforceable: one Biome config, one `tsconfig.base`.
- Local refactors across packages are a single commit, so history stays legible.

### Bad / accepted costs

- **Build-graph complexity.** Cached task graphs, topological ordering, and
  cache invalidation are now our problem rather than the package manager's.
- **Tooling friction.** Some editors and IDE features degrade on large
  workspaces. Mitigation: keep the package count modest (roughly a dozen), and
  each package coherent.
- **Two build systems if we adopt Rust.** Cargo and pnpm have separate lockfiles,
  separate caches, and separate test runners. Accepted; the alternative (a
  subprocess or WASM boundary) is worse.
- **Risk of a "grab bag" repo.** Without discipline this becomes the place
  abandoned experiments accumulate. Mitigation: explicit ownership, and
  deleting branches and directories that lose their reason to exist.
- **CI cost grows with matrix size.** Mitigated by dependency-graph-aware CI so
  unchanged packages do not rerun.

### Follow-up work

- Decide on Turborepo vs Nx vs plain workspaces once ADR-0003 fixes the toolchain.
- Define the boundary lint rules that prevent `core` from importing platform
  code (an ESLint/Biome `no-restricted-imports` rule scoped to those packages).
- Add `packages/config` before there is a second consumer, not before.
- Write the adapter interfaces before the first app exists — see
  `research/14-architecture-options/02-shared-core.md` for the proposed shapes.

## Validation

We will know this was the right call if the web build in Phase 6 can be created
by writing only adapter implementations and a thin entry point, with no changes
to `packages/core`. If instead we find ourselves editing `core` to serve a
platform-specific need, the boundary is wrong and we should move code into
adapters rather than widening `core`.
