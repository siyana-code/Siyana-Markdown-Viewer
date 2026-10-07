# Requirements

Requirements are split by phase. Each is written so that "done" is
demonstrable, not asserted. **MUST** is binding; **SHOULD** is strong
expectation; **MAY** is optional.

Requirement IDs are referenced from tests and PR descriptions.

---

## Phase 1 — Foundation

### Parsing and rendering

| ID | Requirement |
|---|---|
| R-P1-01 | The app **MUST** open a single local `.md` file and render it correctly. |
| R-P1-02 | The renderer **MUST** pass the CommonMark spec suite at a pass rate set in the ADR, with no regressions from the recorded baseline. |
| R-P1-03 | The renderer **MUST** support GitHub Flavored Markdown tables, task lists, strikethrough, and autolink literals. |
| R-P1-04 | The renderer **MUST** produce sanitized HTML as its only output form. No code path **MAY** insert unsanitized content into the DOM. |
| R-P1-05 | Raw HTML in the Markdown source **MUST** be rendered as escaped text, not as live HTML. A per-document opt-in **MAY** exist and **MUST** default to off. |
| R-P1-06 | On any parse or sanitize failure the app **MUST** display the raw source as preformatted text. It **MUST NOT** show an empty view or crash. |
| R-P1-07 | The renderer **MUST** be usable with no UI, no filesystem access, and no shell APIs — a pure function from source text to sanitized HTML. |

### Security baseline

| ID | Requirement |
|---|---|
| R-P1-10 | Every HTML string **MUST** pass the sanitizer before DOM insertion. Enforced by CI. |
| R-P1-11 | The renderer process **MUST** have Node integration disabled, context isolation enabled, and sandboxing enabled. |
| R-P1-12 | The IPC surface **MUST** be limited to named, validated functions. A general-purpose channel is prohibited. |
| R-P1-13 | URL schemes **MUST** be allowlisted to `http`, `https`, `mailto`, `tel`, and relative/fragment URLs. |
| R-P1-14 | The app **MUST** make no network requests as a result of opening a document, without explicit per-document user consent. |
| R-P1-15 | A Content Security Policy **MUST** be configured at the shell and **MUST NOT** be relaxable by document content. |
| R-P1-16 | `Cargo.lock` and `pnpm-lock.yaml` **MUST** be committed, and dependency updates to the parser or sanitizer **MUST** require security review. |

### Encoding and parsing limits

| ID | Requirement |
|---|---|
| R-P1-20 | Encoding **MUST** be detected (UTF-8, UTF-8 with BOM, UTF-16), not assumed. Malformed bytes **MUST** degrade gracefully, not crash. |
| R-P1-21 | Line endings **MUST** be handled for LF, CRLF, and CR. |
| R-P1-22 | The parser **MUST** enforce bounded nesting depth, input size, link nesting, and table dimensions. Exceeding a bound **MUST** degrade (truncate or fall back to raw text), never hang or crash. |
| R-P1-23 | A UTF-8 BOM **MUST** be stripped before parsing and **MUST NOT** appear in output. |

### Tooling

| ID | Requirement |
|---|---|
| R-P1-30 | CI **MUST** run lint, typecheck, tests, and Markdown conformance on every push and PR. |
| R-P1-31 | CI **MUST** reject any PR that targets `main` from a branch that is not `release/*` or `hotfix/*`. |
| R-P1-32 | `pnpm install` and `pnpm build` **MUST** succeed from a clean checkout on Windows and Linux. |
| R-P1-33 | The app **MUST** build on Windows and on Linux from a clean CI runner. |

---

## Phase 2 — Reading experience

### Navigation

| ID | Requirement |
|---|---|
| R-P2-01 | The app **MUST** let the user open a file via a native file dialog. |
| R-P2-02 | The app **MUST** show a recent-files list, ordered by last opened, persisted across sessions. |
| R-P2-03 | The app **MUST** open a folder as a workspace and display a navigable file tree. |
| R-P2-04 | The app **MUST** render a table of contents from the heading structure, nested to at least six levels. |
| R-P2-05 | The TOC **MUST** highlight the section currently in view. |
| R-P2-06 | Every heading **MUST** have a stable anchor, matching GitHub's slug algorithm, and be individually linkable. |
| R-P2-07 | Internal links (`#anchor`) **MUST** scroll to the target. Relative file links **MUST** resolve relative to the current document's directory. |
| R-P2-08 | External links **MUST** open in the system browser, never inside the app. |

### Find and search

| ID | Requirement |
|---|---|
| R-P2-10 | Find-in-document **MUST** be available and **SHOULD** use the webview's native find where it can be unclaimed. |
| R-P2-11 | The app **MUST** offer cross-file search over the open workspace. |
| R-P2-12 | Search **MUST NOT** block the UI thread on large workspaces. Progress **MUST** be indicated. |
| R-P2-13 | Search results **MUST** show the matching line with context. |

### Content

| ID | Requirement |
|---|---|
| R-P2-20 | Code blocks **MUST** be syntax-highlighted for the languages declared in the fence info string. |
| R-P2-21 | Highlighting **MUST** degrade to plain text for unknown languages, without an error. |
| R-P2-22 | Highlighting **MUST NOT** block the UI thread on large documents; it **MUST** run off the main thread or be deferred. |
| R-P2-23 | Images with relative paths **MUST** resolve against the document's directory. |
| R-P2-24 | Remote images **MUST** be blocked by default, with an obvious per-document opt-in. |
| R-P2-25 | Broken images **MUST** show a placeholder, not a broken-image icon or a layout collapse. |
| R-P2-26 | Tables **MUST** be horizontally scrollable when wider than the viewport and **MUST NOT** break document layout. |
| R-P2-27 | Front matter **MUST** be parsed and either displayed or hidden, per a documented rule. It **MUST NOT** render as a stray thematic break. |
| R-P2-28 | The app **SHOULD** support footnotes, definition lists, strikethrough, and task list interaction. |

### Presentation

| ID | Requirement |
|---|---|
| R-P2-30 | Light, dark, and system themes **MUST** be available and **MUST** follow the OS preference when set to system. |
| R-P2-31 | Users **MUST** be able to supply custom themes as CSS custom properties, without rebuilding the app. |
| R-P2-32 | The app **MUST** support a focus/distraction-free mode that hides all chrome. |
| R-P2-33 | Content measure **MUST** be constrained for readability on wide displays, and **SHOULD** be user-adjustable. |
| R-P2-34 | User settings **MUST** persist across sessions and **MUST NOT** be lost if the settings file is corrupt — the app **MUST** fall back to defaults. |

### Keyboard

| ID | Requirement |
|---|---|
| R-P2-40 | Every action **MUST** be reachable by keyboard. |
| R-P2-41 | A shortcut reference **MUST** be viewable in-app. |
| R-P2-42 | Default browser and OS shortcuts that conflict with the app (`Ctrl/Cmd+F`, `Ctrl/Cmd+P`, `Ctrl/Cmd+W`, `Ctrl/Cmd+N`, `Ctrl/Cmd+T`, `F5`, `F12`, `Ctrl/Cmd+Shift+I`) **MUST** be either unclaimed or handled deliberately. |
| R-P2-43 | Navigation shortcuts **MUST** not fire while the user is typing in a text field. |

### Session

| ID | Requirement |
|---|---|
| R-P2-50 | On restart the app **MUST** restore the open workspace, open documents, scroll positions, and window geometry. |
| R-P2-51 | Restoring a session **MUST NOT** fail if a file has been moved or deleted; the app **MUST** indicate the problem and continue. |

---

## Phase 3 — Trust and distribution

### Security hardening

| ID | Requirement |
|---|---|
| R-P3-01 | The parser and sanitizer pipeline **MUST** survive a fuzzing campaign with no construct escaping sanitization. |
| R-P3-02 | File reads **MUST** be confined to the approved workspace root, verified after symlink resolution. |
| R-P3-03 | The app **MUST** refuse to load content from paths that escape the root, and **MUST** log the attempt. |
| R-P3-04 | The app **MUST** detect external modification of open files and offer reload, keep-mine, and save-as. |
| R-P3-05 | Reads **MUST** be resilient to files being written concurrently — partial reads **MUST** be handled, not treated as valid. |
| R-P3-06 | Inputs above the size threshold **MUST** be refused or warned about with an explicit user choice, not silently truncated. |

### Distribution

| ID | Requirement |
|---|---|
| R-P3-10 | Windows builds **MUST** be Authenticode-signed. |
| R-P3-11 | Linux builds **MUST** ship as at least AppImage and deb. |
| R-P3-12 | Auto-update **MUST** verify a cryptographic signature, not merely a checksum. |
| R-P3-13 | A failed update **MUST** leave the app in a working state — the previous version **MUST** remain runnable. |
| R-P3-14 | A portable or zip build **MUST** exist as an escape hatch for users who cannot update. |
| R-P3-15 | The app **MUST** be verified on a clean Windows machine and on at least two Linux distributions from different families, before each release. |
| R-P3-16 | The README **MUST** state which Linux distributions are verified and which are unverified. |

### Output

| ID | Requirement |
|---|---|
| R-P3-20 | Printing **MUST** produce a layout without application chrome, with sensible page-break behaviour for headings, code blocks, and tables. |
| R-P3-21 | Export to PDF **MUST** be available. |
| R-P3-22 | Export to a **self-contained** single-file HTML **MUST** be available, with styles inlined and no unsanitized content. |
| R-P3-23 | Export **MUST NOT** modify the source document. |

### Performance gates

| ID | Requirement |
|---|---|
| R-P3-30 | Cold start to first render **MUST** be under 700 ms on the reference machine. |
| R-P3-31 | Idle memory **MUST** be under 200 MB. |
| R-P3-32 | Opening a 5 MB Markdown file **MUST** complete in under 2 s. |
| R-P3-33 | Scrolling a 5 MB document **MUST** sustain 60 fps on the reference machine. |
| R-P3-34 | Performance budgets **MUST** be measured in CI or in a documented, repeatable benchmark script — not asserted. |

### Accessibility

| ID | Requirement |
|---|---|
| R-P3-40 | The app **MUST** meet WCAG 2.2 AA for its own UI. |
| R-P3-41 | Rendered documents **MUST** retain semantic HTML: headings, lists, blockquotes, tables, and figures **MUST NOT** be flattened to generic containers. |
| R-P3-42 | All functionality **MUST** be operable by keyboard alone, with a visible focus indicator. |
| R-P3-43 | Content **MUST** reflow at 320 CSS px width and support 200% text zoom. |
| R-P3-44 | External file-change events **MUST** be announced to screen readers via a live region. |
| R-P3-45 | A screen-reader smoke test on NVDA (Windows) and Orca (Linux) **MUST** be performed before `1.0.0`. |

---

## Phase 4 — Editing

| ID | Requirement |
|---|---|
| R-P4-01 | Editing **MUST** be optional; the app **MUST** be fully usable as a read-only viewer. |
| R-P4-02 | Saving **MUST** be atomic: write to a temporary file, then rename. A crash mid-save **MUST NOT** corrupt the document. |
| R-P4-03 | Round-trip tests **MUST** verify that content we did not modify is preserved byte-for-byte. |
| R-P4-04 | A failed parse of edited content **MUST** show the error with the offending line, and **MUST NOT** discard the user's text. |
| R-P4-05 | Undo history **MUST** span at least the current session. |
| R-P4-06 | The app **MUST** detect and surface conflicts from external modification rather than silently overwriting. |

---

## Non-functional, all phases

| ID | Requirement |
|---|---|
| R-NF-01 | The app **MUST** make zero network requests unless the user has opted in, verified by automated testing. |
| R-NF-02 | The app **MUST NOT** collect telemetry, analytics, or crash data without explicit, documented, per-session opt-in. |
| R-NF-03 | Settings **MUST** be stored outside the workspace directory by default, or the user **MUST** be told when they are not. |
| R-NF-04 | The app **MUST** not require administrative privileges to install or run. |
| R-NF-05 | The app **MUST** produce no telemetry-adjacent artefacts: no unique install ID transmitted, no crash dumps uploaded automatically. |
| R-NF-06 | The app **MUST** run correctly on a machine with no internet connection, indefinitely. |
| R-NF-07 | The app **MUST** be licensed under MIT, and every dependency **MUST** be MIT-, Apache-2.0-, BSD-, or ISC-compatible. |

---

## Explicitly out of scope

Cloud sync, accounts, collaboration, a plugin marketplace, notebook formats
(`.ipynb`), MDX, EPUB import, telemetry, AI features, and macOS (Phase 1-3 —
see [`roadmap.md`](../roadmap.md)). Each exclusion has a rationale in
[`vision.md`](vision.md#anti-goals).
