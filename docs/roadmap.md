# Roadmap

The desktop app ships first. Web and mobile follow, sharing the same core.

## Phase 0 — Research and planning ✅

**Goal:** understand Markdown, the ecosystem, and the platform reality well
enough that the implementation is a series of small certainties rather than a
series of discoveries.

| Deliverable | Where |
|---|---|
| Markdown foundations, syntax, specs | `research/01-foundations/`, `research/02-syntax/`, `research/03-specifications/` |
| Parsing internals and algorithm | `research/04-parsing-internals/` |
| Rendering and sanitization | `research/05-rendering/` |
| Library evaluation (parser, editor, highlighter, sanitizer) | `research/06-libraries/`, `research/07-editor-internals/` |
| Desktop framework comparison | `research/08-desktop-frameworks/` |
| Windows and Linux reality | `research/09-platform/` |
| Performance budgets and techniques | `research/10-performance/` |
| Security threat model and baseline | `research/11-security/` |
| UX, theming, accessibility | `research/12-ux/` |
| Competitor analysis | `research/13-competitors/` |
| Architecture options and monorepo design | `research/14-architecture-options/` |
| Open questions and risk register | `research/15-open-questions/` |

**Exit criteria:** every blocking question in the register has an answer, and
the four decisions that change the architecture (shell, parser, editor engine,
sanitization strategy) are recorded as ADRs.

## Phase 1 — Foundation (desktop skeleton)

**Goal:** an empty-but-real desktop app with the full toolchain wired up.

- [ ] Monorepo scaffolding: `pnpm` workspaces + `cargo` workspace
- [ ] `packages/core`: parse → AST → sanitized HTML, no UI, no I/O
- [ ] CommonMark conformance harness running in CI
- [ ] `packages/ui`: theme tokens, content stylesheet, layout shell
- [ ] `apps/desktop`: chosen shell with a hardened security baseline
- [ ] Open a file → render it. No editing, no tree, no search.
- [ ] Basic error handling: a parse failure shows raw text, never a blank window

**Exit criteria:** `README.md` from this repository renders correctly inside
the app, and the CommonMark suite passes at the target conformance rate.

## Phase 2 — Reading experience (desktop MVP)

**Goal:** a viewer people would actually keep open.

- [ ] File open dialog, recent files, session restore
- [ ] Folder tree / workspace navigation
- [ ] Table of contents with scroll-spy
- [ ] Heading anchors and `#fragment` navigation
- [ ] In-document find (native webview find)
- [ ] Cross-file search over the workspace
- [ ] Code syntax highlighting
- [ ] Image resolution for relative paths, with the security policy applied
- [ ] Light / dark / auto themes; user themes from CSS custom properties
- [ ] Full keyboard shortcut map
- [ ] Link handling: internal anchors, relative files, external URLs
- [ ] Settings UI, persisted to the app data directory
- [ ] Accessibility pass: WCAG 2.2 AA, screen-reader smoke test

**Exit criteria:** opens a 200-file folder and a 5 MB file without a stall; no
console errors; passes our accessibility checklist.

## Phase 3 — Trust and polish (desktop v1.0)

**Goal:** safe to install on a machine we do not own.

- [ ] Full implementation of the security baseline
      (`research/11-security/05-security-baseline-recommendations.md`)
- [ ] Fuzzing of the parser with the sanitizer attached
- [ ] Windows signing (Authenticode) and SmartScreen reputation work
- [ ] Linux AppImage + deb; verify on a clean Ubuntu LTS and Fedora
- [ ] Auto-update with signature verification; staged rollout
- [ ] Print and export-to-PDF
- [ ] Standalone single-file HTML export
- [ ] File-watching with conflict resolution (reload / keep mine / save as)
- [ ] Performance gates in CI; crash reporting (opt-in, local-first)
- [ ] `v1.0.0` release

**Exit criteria:** clean-machine install works on Windows and two Linux
distros, updates verify, and the security checklist has zero open items.

## Phase 4 — Editing

**Goal:** optional, non-destructive editing. A viewer that can edit but never
traps your content.

- [ ] Editing model decision (live preview vs seamless) — see
      `research/07-editor-internals/02-editing-models.md`
- [ ] Saving that never corrupts the file (atomic write, backup)
- [ ] External-edit detection and conflict UI
- [ ] Dirty state, autosave, undo history
- [ ] Round-trip tests: parse → edit → serialize must preserve untouched
      content byte-for-byte

## Phase 5 — Extensions

**Goal:** a documented extension surface, so the community can fill the gaps
we will not.

- [ ] Declared, versioned "Siyana Markdown Profile" of extensions
- [ ] Plugin API for render transforms
- [ ] Math, Mermaid, and diagram rendering as plugins rather than core

## Phase 6 — Web

- [ ] Static build of `packages/core` + `packages/ui`
- [ ] Filesystem adapter: File System Access API where available, OPFS as a
      fallback, drag-and-drop and multi-file input otherwise
- [ ] Deploy to GitHub Pages and/or Cloudflare Pages
- [ ] IndexedDB-backed workspace and search index

## Phase 7 — Mobile

- [ ] Platform decision (React Native / Flutter / Capacitor) — recorded as an ADR
- [ ] Sandboxed storage model: document pickers, no arbitrary paths
- [ ] Touch-first navigation, drawer, swipe between documents
- [ ] Share-sheet open and export

## Deliberately out of scope (for now)

| Item | Why |
|---|---|
| Cloud sync | Requires accounts, servers, and a conflict-resolution research project of its own. See `research/14-architecture-options/04-workspace-and-sync.md`. |
| Collaboration | Same reasons. |
| Plugin marketplace | Needs the extension surface to be stable first (Phase 5). |
| Notebook formats (`.ipynb`) | Different problem, different renderer. |
| `.mdx` / JSX in Markdown | Executes user code. Fundamentally at odds with the safety principle. |

---

## Milestones

| Milestone | Tag | Meaning |
|---|---|---|
| Research complete | — | Phases 0 exit criteria met |
| First render | `0.1.0` | A file opens and renders |
| Reading MVP | `0.3.0` | Folder tree, TOC, search, themes |
| Safe and distributable | `0.9.0` | Signed builds, auto-update, hardening done |
| Desktop stable | `1.0.0` | Our stability promise begins |
| Editor | `1.2.0` | Editing without corruption |
| Web | `1.4.0` | Browser build shipped |
| Mobile | `1.6.0` | Mobile shipped |

---

## How phases map to branches

Each phase that needs more than one person or more than a week gets a
`phase/<n>-<name>` long-lived branch cut from `develop`, with `feature/*`
branches hanging off it. See
[`branching-strategy.md`](branching-strategy.md).
