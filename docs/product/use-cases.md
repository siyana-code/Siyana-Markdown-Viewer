# Use cases

Use cases are written from the reader's point of view, not the feature's. Each
one lists what forces the design, because a requirement that serves no use case
is a feature we have not earned.

---

## UC-1: Read a README

> **As a** developer evaluating a library, **I want to** open its `README.md`
> from disk and see it rendered, **so that** I can judge the library without
> leaving my file manager.

**Forces:**
- Double-click to open. File association registration.
- Fast: this is a 5 KB file. Sub-second cold start to first render.
- The `README.md` is almost always the only file opened. The app should not feel
  like a workspace application.
- Contains badges, tables, task lists, code blocks with unknown languages,
  relative links to other repo files, and shields.io images.

**Design consequences:** first-run opens a document, not a workspace. Relative
links to files not in a workspace open the workspace. Images are resolved
against the document's directory, which may be the only file we were given.

---

## UC-2: Read a long technical document

> **As a** reader, **I want to** open a 2 MB specification and scroll through it
> smoothly, **so that** I can read it for an hour without fighting the tool.

**Forces:**
- 2 MB of text is roughly 40,000 lines and a lot of DOM nodes.
- Most of it is off-screen at any moment.
- Code blocks are syntax-highlighted.
- Tables are wider than the viewport.

**Design consequences:** three levels of laziness — do not parse what you will
not render, do not build DOM you will not display, do not lay out what you
cannot see. `content-visibility: auto` with `contain-intrinsic-size` is the
single highest-leverage CSS technique here. Highlighting is deferred and cached.
See [`research/10-performance/01-large-files.md`](../../research/10-performance/01-large-files.md).

---

## UC-3: Skim for a section

> **As a** reader, **I want to** see the document's structure and jump to the
> part I care about, **so that** I do not scroll through 200 pages to find the
> API reference.

**Forces:**
- Headings nest up to six levels.
- Long documents have long TOCs that need their own scrolling.
- The user should know where they are without scrolling.

**Design consequences:** a sticky, collapsible, scroll-spy TOC. Anchor links on
every heading, using GitHub's slug algorithm so links copied from a browser
still work. Keyboard navigation between headings. The TOC must not steal width
from a narrow window.

---

## UC-4: Follow a link

> **As a** reader, **I want to** click a link to another file or an anchor and
> land in the right place, **so that** I can follow documentation as a trail.

**Forces:**
- Links are relative to the *document's* directory, not the app's working
  directory.
- Links may point outside an opened workspace.
- Links may be external URLs, which must open in the system browser and never
  inside the app.
- Links may be `javascript:` or `data:` URLs, which are hostile.
- Fragments may not resolve — the target may lack that heading.

**Design consequences:** all of `R-P2-07`, `R-P2-08`, and the entire URL
allowlist in [ADR-0005](../adr/0005-security-baseline-xss-sanitization.md).
An unresolvable anchor must show a quiet notice, not an error dialog.

---

## UC-5: Read something you did not write

> **As a** user, **I want to** open a `.md` file from a download or a cloned
> repository **so that** I can read it, **and I want to** be certain it cannot
> harm my machine.

**Forces:**
- The file is attacker-controlled. This is the defining constraint of the app.
- It may contain raw HTML designed to escape the renderer.
- It may reference local files via image paths — a path traversal attempt.
- It may reference remote images — a tracking pixel that leaks that the user
> opened it.
- It may contain a `javascript:` link styled to look like a button.
- It may be a decompression or ReDoS bomb.

**Design consequences:** this is why the app is four layers deep. See
[`research/11-security/01-threat-model.md`](../../research/11-security/01-threat-model.md).
This use case justifies refusing to render raw HTML.

---

## UC-6: Read a folder of notes

> **As a** note-taker, **I want to** open a folder of notes and browse it,
> **so that** I can find the note I wrote last month.

**Forces:**
- File trees can be large and deep.
- Searching is the real navigation mechanism; the tree is secondary.
- Search must not freeze the app on a big vault.
- The app must remember which notes I had open.

**Design consequences:** search is the priority, the tree is a convenience
(`R-P2-11`, `R-P2-12`). Search runs off the main thread with progress
reporting. Session restore (`R-P2-50`) handles a tree that changed while the app
was closed.

---

## UC-7: Read code-heavy documentation

> **As a** developer, **I want to** read documentation that is mostly code with
> proper syntax highlighting, **so that** I can understand it.

**Forces:**
- Info strings declare languages that the app may not have a grammar for.
- Highlighting a large document's code blocks is expensive.
- Code blocks should wrap or scroll — this is a preference, not a fact.
- Line numbers may help; they are optional.

**Design consequences:** unknown language degrades to plain text with no error
(`R-P2-21`). Highlighting is deferred and cached per block
(`R-P2-22`). Wrap-versus-scroll is a user setting with a sensible default.

---

## UC-8: Read documents with math, diagrams, or footnotes

> **As a** student or researcher, **I want to** read documents containing
> mathematical notation, diagrams, or footnotes, **so that** I can use documents
> written for paper or for a web publishing platform.

**Forces:**
- Math is not in CommonMark. Dialects disagree on `$...$` versus `\(...\)` and
  on `$$...$$`.
- Mermaid and similar diagram fences require executing a renderer.
- Footnotes are a Markdown Extra extension, not CommonMark.
- All of these are extensions we must declare support for explicitly.

**Design consequences:** this is why the "Siyana Markdown Profile" needs to be
a published, versioned declaration
([`research/03-specifications/03-extension-standards.md`](../../research/03-specifications/03-extension-standards.md)).
Math and diagrams are Phase 5, implemented as plugins, because each is a
security surface of its own — Mermaid in particular executes user-supplied
content to draw a diagram.

---

## UC-9: Print or share

> **As a** reader, **I want to** print a document or export it as a PDF or a
> standalone HTML file, **so that** I can share it or read it on a device that
> cannot run the app.

**Forces:**
- Printing must not include application chrome.
- Headings, code blocks, and tables must not be split badly across pages.
- A standalone HTML export must be self-contained and must not smuggle
  unsanitized content.
- Export must never modify the source.

**Design consequences:** `R-P3-20` through `R-P3-23`. The standalone export is a
security-sensitive path: it takes our sanitized output and inlines styles, so
the sanitization boundary has to hold through the export step too.

---

## UC-10: Work across a sync folder

> **As a** user whose notes sync between machines via Dropbox or Syncthing,
> **I want to** open a note I wrote on another machine, **so that** my notes
> work the same everywhere.

**Forces:**
- The file changes underneath us. The sync client may write it mid-read.
- Sync clients make temporary files, use atomic renames, and may briefly leave
  `.tmp`, `.swp`, or partial files in the tree.
- We must not treat a partially-written file as valid.

**Design consequences:** `R-P3-04` and `R-P3-05`. Debounced reload, detection
by content hash rather than mtime, and a partial-read heuristic. This use case
is a common source of "the viewer ate my file" bugs and deserves explicit
testing.

---

## UC-11: Read with a keyboard only

> **As a** keyboard-driven user, **I want to** do everything without a mouse,
> **so that** I can read efficiently.

**Forces:**
- The webview intercepts some shortcuts by default.
- Focus must be predictable and always visible.
- Commands must be discoverable without a mouse.

**Design consequences:** `R-P2-40` through `R-P2-43`. The Electron/Tauri
default shortcuts must be unclaimed deliberately
([`research/12-ux/02-navigation-and-find.md`](../../research/12-ux/02-navigation-and-find.md)).

---

## UC-12: Read with a screen reader

> **As a** blind or low-vision user, **I want to** have documents read aloud
> with correct structure, **so that** I can read documentation.

**Forces:**
- Semantic HTML must survive sanitization — no flattening to `<div>`.
- Heading levels must be correct in the accessibility tree.
- The document must reflow at 320 px and at 200% zoom.
- **Does the webview expose the accessibility tree to the OS screen reader at
  all?** This is an open question with a hard consequence; see the validation
  section of [ADR-0003](../adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md).

**Design consequences:** `R-P3-40` through `R-P3-45`. If the accessibility tree
is not exposed by the chosen webview, that is a reason to change shells, not a
reason to lower the bar.

---

## UC-13: Read on a laptop with no internet

> **As a** user on a plane or behind a firewall, **I want** the app to work
> completely offline, **so that** I can read anything, anywhere.

**Forces:**
- Fonts, grammars, and diagram renderers must not be fetched at runtime.
- No feature may require a network call.

**Design consequences:** `R-NF-06`. This is why the highlighter must work
offline and why remote images are opt-in rather than opt-out.

---

## UC-14: Trust but verify

> **As a** security-conscious user, **I want to** see what the app does with my
> files, **so that** I can decide whether to trust it.

**Forces:**
- The app is open source and should be auditable.
- There is no telemetry, and that claim should be verifiable.
- The security model should be published in plain language.

**Design consequences:** publish the security model, keep the ADR history, make
the dependency tree inspectable, and make "no network requests" a tested
property rather than a promise.

---

## Non-goals as use cases

These are things users will ask for that we will decline. Recording them is
part of the design.

| Requested | Response |
|---|---|
| "Add cloud sync" | Out of scope. Use a sync folder (UC-10), which works today. |
| "Add a plugin for my notes format" | Not yet. The extension surface lands in Phase 5; a plugin API now would be a breaking change later. |
| "Add backlinks / graph view" | Different product. We render documents; we do not model knowledge. |
| "Add MDX support" | It executes JavaScript from the document. It contradicts UC-5. No. |
| "Add telemetry so we know what is used" | Contradicts UC-13 and UC-14. No. |
| "Add AI summarisation" | Requires sending the document off the machine. Contradicts principle 1. No. |
