# Vision

## The problem

Markdown is everywhere. Every repository has a `README.md`, every product has
documentation written in it, every note-taking system stores it, and every AI
project publishes it. It is the most widely used plain-text format in software.

The tools for reading it are worse than they should be:

| What people use | The problem |
|---|---|
| GitHub, raw in a browser | Not a viewer. No navigation, no local files, no editing. |
| A browser-based editor (Dillinger, StackEdit) | **Your files are uploaded somewhere.** Often someone else's server. |
| A heavyweight editor (Obsidian, Typora, Notion) | Owns your files. Subscriptions. Sync accounts. Features you did not ask for. |
| A terminal renderer (`glow`, `bat`) | No images, no links that work, no TOC, no math. |
| Your OS's default text editor | No rendering. |
| A IDE preview (VS Code) | Tied to an editor. |

The gap: **a viewer that opens a file from your disk, renders it beautifully,
and does nothing else.** No account, no upload, no subscription, no sync
service, no telemetry.

## What we are building

A fast, safe, local-first Markdown viewer for Windows and Linux, with web and
mobile targets later. It opens a file and renders it. That is the product.

The discipline this requires is the hard part. A Markdown viewer is trivially
easy to build badly — parse with a library, inject HTML, ship. It is
non-trivial to build well, because "well" means:

- Getting the CommonMark edge cases right, so legitimate documents render
  correctly.
- Not executing anything in the document, because the document is untrusted.
- Being fast on a 5 MB file, not just a 5 KB one.
- Working on Linux distributions we do not control, with webviews we did not
  ship.
- Being usable with a keyboard and a screen reader.
- Not corrupting anyone's files.

Every one of those is a research problem, which is why
[`research/`](../../research/) is the largest part of this repository right now.

## Who it is for

| Audience | What they need |
|---|---|
| Developers reading docs | Fast open, good code blocks, working links, no install ceremony |
| Writers and researchers | Distraction-free reading, printable, exportable |
| Students | Offline, no subscription, no account |
| Technical writers | Correct rendering of the syntax they use, including footnotes and math |
| Screen-reader and keyboard users | Full accessibility, not as an afterthought |
| Privacy-conscious users | No telemetry, no network access by default, verifiable |
| Anyone with a slow machine or a metered connection | Small footprint, offline-first |

We are explicitly **not** trying to be an Obsidian replacement. We are not
building a knowledge graph, a plugin marketplace, a sync service, or a
collaboration platform. Those are separate products with separate problems.

## What "done" looks like

1. Double-click a `.md` file. It opens correctly and fast.
2. Render a 5 MB technical document without stuttering.
3. Open a `.md` file downloaded from the internet. Nothing bad happens. This is
   not a feature we add later — it is a property we must have from day one.
4. Read it with a keyboard only, or with a screen reader.
5. Install it on a clean Ubuntu machine and on a clean Windows machine, and it
   works.
6. It does not call home.

## Principles

These are constraints, not aspirations. When they conflict, they are the tiebreak.

### 1. Local-first, unconditionally

Files are read from the user's disk and stay there. No account. No upload. No
sync server. No analytics. No crash reports unless the user opts in, per
session.

### 2. Untrusted by default

A `.md` file is attacker-controlled input. We do not ask whether the user trusts
it. Raw HTML is disabled, output is sanitized, paths are scoped, and network
access is opt-in. See
[ADR-0005](../adr/0005-security-baseline-xss-sanitization.md).

### 3. Plain text is the source of truth

The file on disk is authoritative. We never make a proprietary format the
master copy. Our workspace metadata lives in a sidecar file, and losing it costs
nothing but preferences.

### 4. Correct before clever

A viewer that renders `*a **b** c*` correctly is more useful than one with
eleven features and a subtle emphasis bug. CommonMark conformance is a hard
requirement, verified in CI on every change.

### 5. Small and fast

Under 50 MB installed, under 200 MB resident, sub-second open on a typical
README, 60 fps on a large document. A reader app should feel like a native
utility.

### 6. Keyboard first

Every action has a shortcut. Nothing requires a pointer. Commands are
discoverable. We will not ship a feature that can only be reached by a menu
click.

### 7. Accessible from the start

WCAG 2.2 AA is the floor. Semantic HTML is not optional — a document full of
`<div>`s is unreadable by a screen reader, and that is our failure, not the
user's.

### 8. One core, three shells

Parser and rendering logic are platform-independent and shared. Platform code
lives behind interfaces. The web build should be a repackaging, not a rewrite.

### 9. Document our decisions

Every non-obvious choice has an ADR. Every claim in this repository has a
source. Unknowns are recorded as unknowns rather than guessed at.

## Anti-goals

| Not doing | Why |
|---|---|
| Cloud sync or accounts | Requires servers, auth, and a conflict-resolution research project. Different product. |
| Collaboration / real-time editing | Same. |
| A plugin marketplace | The extension surface must be stable first. |
| An Obsidian clone | Different product, vastly larger scope. |
| Notebook (`.ipynb`) support | A different renderer with fundamentally different semantics. |
| MDX / JSX in Markdown | Executes user code. Incompatible with principle 2. |
| Telemetry, in any form | Principle 1. |
| AI features | Would require sending content off-device, or shipping a model. Both compromise principle 1. |
| Mobile-first sequencing | Desktop is where reading happens. Mobile follows in Phase 7. |

## Success measures

Deliberately boring, because vanity metrics would push us toward the wrong
product:

| Measure | Target |
|---|---|
| Cold start to first render | Under 700 ms on a modest laptop |
| Idle memory | Under 200 MB |
| Install size | Under 50 MB |
| Open a 5 MB document | Under 2 s |
| Scroll frame rate on a large document | 60 fps |
| CommonMark conformance | No regressions, from CI |
| Open security advisories | Zero at `1.0` |
| Users reporting a crash on a normal file | Zero |
| Network requests without consent | Zero, verified by testing |
| Requests to add a login or a sync button | A signal we are solving the wrong problem |

## Related documents

- [Requirements](requirements.md) — what Phase 1 and 2 must deliver
- [Use cases](use-cases.md) — the jobs we are designing for
- [Roadmap](../roadmap.md) — phases and milestones
- [Research](../../research/README.md) — the study behind all of this
