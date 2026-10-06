# 01 · Obsidian

> **Class: competitor.** The most successful Markdown application ever built,
> and the reason our project needs a specific gap statement rather than a
> feature list.

Research date: **6 October 2026**. All pricing, platform, and licence claims
verified against `obsidian.md`, `obsidian.md/sync`, `obsidian.md/plugins`,
`obsidian.md/roadmap`, `obsidian.md/cli`, `obsidian.md/security`, and
`obsidian.md/license` on that date.

---

## 1. What it is

Obsidian is a **local-files-first knowledge base**. It opens a directory on your
disk — a *vault* — and treats every Markdown file in it as a note in an
interlinked graph. The files stay where they are, in plain Markdown, and you can
read them with any other editor at any time.

This is the founding idea and it is a good one: **no proprietary container, no
import step, no lock-in.** The user owns plain `.md` files. If Obsidian
disappeared tomorrow, nothing is lost.

Its own licence page states the position plainly (verified):

> "Free for everyone — Obsidian is free for all purposes, including personal,
> commercial, and non-profit use."
> "Your data is saved locally on your device and is not sent to our server."
> "You retain ownership of all content you create in Obsidian. We do not claim
> any rights to it. **We own and reserve rights to our content, including
> text, images, and code in the app, which is protected by copyright and other
> laws.**"

That last sentence is the whole legal story: **the app is proprietary, the data
is yours.**

---

## 2. Platform support (verified, `obsidian.md/download`, 6 Oct 2026)

| Platform | Distribution |
|---|---|
| Windows | Universal installer (AppX/`.exe`) |
| macOS | Universal (Apple Silicon + Intel) |
| Linux | **AppImage (x64)**, **AppImage (aarch64/ARM64)**, **Snap**, **Deb**, **Flatpak** (community-maintained) |
| iOS | App Store |
| Android | Google Play **and** a direct APK |
| Browser | The Web Clipper is a **browser extension**, not a web app |

That Linux packaging list is genuinely excellent — including a community-
maintained Flatpak. Most Electron competitors ship one AppImage.

---

## 3. Pricing (verified, `obsidian.md/pricing` and `obsidian.md/sync`, 6 Oct 2026)

| Item | Yearly billing | Monthly billing | Notes |
|---|---|---|---|
| **The app** | **$0** | **$0** | Free forever, all platforms, no account needed |
| **Sync Standard** | **$4** / user / month | **$5** / user / month | 1 vault, **1 GB** total, **5 MB max file size**, 1 month version history |
| **Sync Plus** | **$8** / user / month | **$10** / user / month | 10 vaults, **10 GB** total, **200 MB max file**, 12 month version history, upgradable to 100 GB |
| **Publish** | **$8** / site / month | **$10** / site / month | Publish a vault to the web |
| **Catalyst** | **$25 one-time** | — | Early access to betas, badges. Non-refundable |
| **Commercial** | **$50** / user / year | — | Org support + listing on their site. Non-refundable |

Additional verified details:

- Sync is end-to-end encrypted with **AES-256**; the vendor states staff cannot
  read synced data.
- Shared vaults support real-time collaboration (launched with the roadmap
  entry "Multiplayer — Share notes and edit them collaboratively", **Planned**).
- Sync syncs *configuration*, not just files: editor/file/link settings,
  appearance, themes and snippets, plugins, custom hotkeys, and selective sync
  by file type.
- 40% education/nonprofit discount on Sync and Publish.
- Refunds within 7 days on Sync and Publish; Catalyst, Commercial, and credit
  are non-refundable.
- "Obsidian for Work" is on the roadmap — **workplace configuration options to
  control access to plugins and other features** (Active).

### The business model, and why it matters to us

Obsidian is **100% user-supported**. There is no advertising, no data sale, no
telemetry, and no investor. Their own words on the pricing page: "100%
user-supported. Optional licenses help support the independent development of
Obsidian."

This is a genuinely admirable position and it constrains them in a way that
constrains us differently:

| | Obsidian | Us (projected) |
|---|---|---|
| Revenue | Optional: Sync, Publish, Catalyst, Commercial, Enterprise | MIT, fully free, no paid tier planned |
| Telemetry | None | None |
| Data on disk | Plain Markdown, user-owned | Plain Markdown, user-owned |
| Differentiation | Ecosystem + graph model | Reading craft + accessibility + honesty |

Because we take no money, we can be structurally more opinionated in ways they
cannot. That is a real strategic asset and it belongs in our positioning.

---

## 4. Architecture (partly inference)

Obsidian's application code is **closed source**. What is public:

- `obsidianmd/obsidian-releases` — GitHub repository with the community plugin
  list, the theme list, and the release metadata/changelogs.
- `docs.obsidian.md` — Developer Documentation, including the plugin API and a
  Bases-view guide.
- A community CLI shipped in 1.14 (see §7).

**Inference (not verified):** Obsidian is an Electron/Chromium app. Evidence:
the platform matrix, the plugin API's DOM-oriented design, the `dev:screenshot`
/ `dev:css` / `dev:dom` CLI dev commands, and the general shape of
Chromium-based Electron note apps. Treat as inference.

**Verified security posture** (from `obsidian.md/security`):

| Audit | Date | Auditor |
|---|---|---|
| Obsidian apps, all client code | December 2023 | **Cure53** |
| Obsidian apps, with attention to the Web viewer plugin | December 2024 | **Cure53** |
| Obsidian Sync API, server, cryptography | October 2024 | **Cure53** |
| Obsidian Sync API, server, cryptography | December 2025 | **Trail of Bits** |

Repeated independent third-party audits of client code and sync cryptography is
a *higher* bar than most of our competitors meet. This should inform our own
security posture — see [11 security](../11-security/).

---

## 5. The vault model

A **vault** is just a directory. Inside it:

- `.obsidian/` holds configuration as JSON.
- Markdown files, folders, and attachments sit alongside it, unhierarchical and
  human-obvious.
- The folder tree, tags, properties, and links are all *views* over the same
  files.

What this buys the user:

1. **Durability.** Plain files, any editor, any backup tool, any sync tool
   (git, Syncthing, Dropbox).
2. **Portability.** A vault is a `tar` away.
3. **Reversibility.** Deleting the app loses nothing.

What it costs: Obsidian must handle everything users throw at a directory —
`.docx` files, 500 MB videos, deeply nested trees, non-UTF-8 encodings, symlink
loops. A viewer can assume a much narrower corpus. **This is a structural
advantage we should exploit, not apologise for.**

---

## 6. The linking model — the actual core innovation

Obsidian did not invent `[[wikilinks]]`; it made them frictionless and gave them
consequences.

### 6.1 Wikilinks

`[[Some Note]]` creates a link. `[[Some Note#Section]]` and
`[[Some Note|alias]]` work too. Crucially:

- Link resolution is **fuzzy and forgiving** — case-insensitive, whitespace-
  tolerant, and it will match the shortest unique path.
- Typing `[[` opens an autocomplete listing every note.
- If the link text does not match an existing note, Obsidian **creates** the
  note when you click through. No 404.

### 6.2 Backlinks

Every note automatically shows "Backlinks" — the list of notes that link to it.
This is the mechanism that turns a folder into a *body of work*. It is derived,
zero-configuration, and it is the single most-copied idea in the note-taking
world.

### 6.3 Unlinked mentions

Beyond explicit backlinks, Obsidian surfaces *unlinked mentions*: places where
the note's title appears as plain text without a link. This is what makes a
"second brain" feel like one.

### 6.4 Graph view

A force-directed visualisation of the link graph. Beautiful, seductive, and —
see §9 — of very limited practical value.

### 6.5 The principle underneath all of it

> **Links are cheap, so people write more of them, which makes the corpus more
> valuable, which makes the tool more valuable.**

That is a positive feedback loop, and it is the strongest single idea in the
note-taking world. Whether a *viewer* can exploit it is §8's question.

---

## 7. The plugin boundary

Obsidian's plugin model is the second great idea, and the one most relevant to
our architecture.

### 7.1 What is public

- **8,449 community plugins and 826 themes** (verified, `obsidian.md/plugins`,
  6 Oct 2026). Categories listed include Integrations (1,250), Files (1,171),
  AI (1,019), Sidebar (903), Editing (898), Visualization (807), Automation
  (729), Links (692).
- Developer Documentation at `docs.obsidian.md`, including a Bases-view plugin
  guide.
- A community-maintained plugin list in the `obsidianmd/obsidian-releases`
  repository.
- As of March 2026, a **community directory** with "an automated review system
  for plugins and themes" (roadmap, launched).

### 7.2 The architectural lesson

Obsidian's core is closed, but the *extension point* is public and stable enough
that 8,449 plugins exist. That is the pattern we should copy **in shape**:

- A **narrow, stable, documented** core API surface.
- A **documented plugin capability model** rather than "the plugin can call any
  API we happen to export."
- **Per-plugin permissions** so installing a plugin does not silently grant
  everything. Their roadmap item "Obsidian for Work — Workplace configuration
  options to control access to plugins" is a recognition that this matters at
  enterprise scale.

Our position is stronger in one specific way: **because our core is open source
(MIT), the plugin API is not an API we have to keep backwards-compatible for
marketing reasons.** We can version it explicitly, break it, and say so in a
changelog. Obsidian cannot.

### 7.3 The CLI (verified, 1.14)

Obsidian shipped a first-party CLI that is a genuine scriptability surface:

```text
obsidian daily                                    # today's daily note
obsidian daily:append content="- [ ] Buy groceries"
obsidian search query="meeting notes"
obsidian search query="status::active" vault="Notes" format=json
obsidian create name="Trip to Paris" template=Travel
obsidian tags counts
obsidian tasks daily
obsidian diff file=README from=1 to=3
obsidian files sort=modified limit=5 --copy
obsidian unresolved                                # unresolved links
obsidian eval "app.vault.getFiles().length"        # execute JS
obsidian plugin:reload my-plugin
```

Their own framing: "Command your vault. Anything you can do in Obsidian you can
do from the command line" and "Obsidian CLI is a programmatic playground for
plain text."

A roadmap item (March 2026) adds a "Headless client for Sync" for exactly this
purpose.

**Lesson:** a serious document tool needs a scriptability surface, and shipping
one *inside the app* is a differentiator almost nobody has taken. See
[02 §4](02-navigation-and-find.md#4-search) for the index that would back it.

---

## 8. What Obsidian does brilliantly

### 8.1 The linking philosophy

Covered above. It is the product.

### 8.2 Live Preview

Obsidian's editing mode renders formatting inline rather than in a side panel.
It has iterated substantially — the 1.13 changelog (May 2026) includes "Image
zoom and resize" in Live Preview, and 1.14 (2026) added "Highlight colors" with
multiple highlight colours.

The *model* is right: one surface, WYSIWYG where you are looking, source where
you need it. See [01-reading-ux §11](../12-ux/01-reading-ux.md#11-the-second-verb-editing-deferred-not-refused)
for our take, and
[02-typora-and-marktext](02-typora-and-marktext.md) for the older, purer version
of this idea.

### 8.3 Theming

Obsidian's theming is CSS-custom-property-based with a public snippet system.
Themes are community-authored (826 of them), shareable, and composable with
snippets. This is a **correct** model and it validates
[03 §4](../12-ux/03-theming.md#4-themes-as-data-not-code) — with the caveat
that CSS-based themes are an injection surface that a JSON-token design would
avoid. See the trade-off note there.

### 8.4 Local-first, done properly

No account required to use the app. No telemetry. Nothing sent to the server
unless you opt into Sync or Publish. That is a promise almost no competitor can
match and we should match it exactly.

### 8.5 Being honest about money

"100% user-supported", optional purchases, no dark patterns, 7-day refunds on
services. Obsidian runs a sustainable business *without* locking anyone in.

### 8.6 Security posture

Four independent third-party audits in three years (Cure53 ×3, Trail of Bits).
Published reports. This is what "we care about your data" should look like.

### 8.7 Ecosystem scale

8,449 plugins. Excalidraw, Dataview (now partly superseded by Bases), Tasks,
Templater, Kanban, and thousands more. No one builds this from scratch and no
one should.

---

## 9. Where Obsidian is weak

Honest assessment, and each item is either a lesson or an opening for us.

### 9.1 Performance on large vaults

The most-cited weakness. Rendering and indexing degrade as vault size and
plugin count grow, because:

- The plugin system allows arbitrary per-keystroke work, and 20+ plugins is a
  common configuration.
- Every plugin can observe every file event, so N plugins × M file changes is N×M
  work.
- **"Obsidian for Work — Workplace configuration options to control access to
  plugins"** is on the roadmap as *Active*, which is a tacit acknowledgement
  that plugin surface area is a real problem.

Our opportunity: **a viewer that deliberately has a tiny, bounded core and does
not let extensions run in the render path.**

### 9.2 Closed core

The application is closed source. This has consequences:

- Core bugs cannot be diagnosed by users; every issue becomes
  "help the Obsidian team fix their closed app."
- Performance problems cannot be profiled by the community.
- Security audit findings are *reported*, not reproducible. (They published the
  reports, which is more than most, but it is not the same.)
- A plugin author cannot patch a core bug.

Our position: an MIT core means every performance regression is somebody's
reproducible bug report.

### 9.3 Feature accretion and conceptual load

Obsidian now ships: core plugins for Canvas, Bases, Sync, Publish, Web Clipper,
Unique Note Identifiers, Templates, Workspaces, Bases kanban views, Bases group
reordering, image zoom/resize, highlight colours, CLI, Quick Capture widgets,
share sheets, and more. Bases alone is a database/query engine with formulas,
filters, and multiple view types (table, cards, list, and per roadmap calendar
and kanban).

**None of this is bad engineering. All of it is a cost to a user whose job is
simply to read a Markdown file.** The onboarding tax is real, and it is the gap
we intend to occupy. See §11.

### 9.4 Graph view is largely theatre

It looks spectacular and answers very few questions a person actually has. It
is a screenshot generator. A person reading a document wants: what links here,
what does this link to, and where do I go next. A linear list answers all three
in a fraction of the space.

**Our position:** backlinks and outbound-links panels. No graph view, ever.

### 9.5 The reading experience is a mode, not the default

Obsidian's reading ("Reading view") is a *view mode* you switch into. In Live
Preview — the default — you are always looking at partly-marked-up source.
For a person whose entire task is reading, that is the wrong default. There is
even a roadmap item — **"Obsidian Reader — Distraction-free reading view for
Web Clipper", launched March 2026** — which is Obsidian reaching for the
reading-mode primitive that other apps have had for a decade.

That is the clearest possible signal about the gap.

### 9.6 Accessibility is not a headline

Obsidian's own docs and marketing do not make an accessibility claim. There is
no published WCAG conformance statement. Community plugins exist for some
needs. There is no evidence in the public material of a WCAG 2.2 AA target, and
a Chromium app with a very large third-party plugin surface is *hard* to make
conformant.

**We do not claim Obsidian is inaccessible.** We claim that a WCAG 2.2 AA
conformance statement is something we can make and they have not, and that is a
real differentiator with real users behind it. See
[04-accessibility](../12-ux/04-accessibility.md).

### 9.7 Sync file-size ceilings

Sync Standard caps files at **5 MB** and Plus at **200 MB**. (Verified, from
`obsidian.md/sync`.) That is a hard ceiling on what you can sync, presented
quietly.

### 9.8 Mobile is a constrained experience

Quick Capture, widgets, share sheets, and a *separate* mobile app for the DB
version of Logseq's cousin… Obsidian's mobile apps are capable but visibly
behind desktop, and the roadmap shows "Background Sync on mobile" still Active
and "PDF annotation" still Planned.

---

## 10. Canvas and Bases (verified from the roadmap and dev docs)

### Canvas

An infinite whiteboard stored as a **`.canvas` file** in the vault (JSON in an
Open Canvas format — the `jsoncanvas` topic is present in the
`obsidianmd/obsidian-releases` repository, alongside `bases` and `markdown`).
Cards hold text or file references; connections are edges with labels.

**Status (roadmap):** "Canvas support for Publish" is **Planned**.

**Lesson:** the *file format is the feature*. Because a canvas is a plain JSON
file in the vault, it is durable, diffable, and scriptable. If we ever add
something like this, it must be a file in the user's directory, never an opaque
database row. That principle generalises: **anything a user creates must be a
file they own.**

### Bases

A core plugin — introduced in Obsidian 1.9 — that lets a user build
**database-like views over notes**: view, edit, sort, and filter files and their
**properties** (YAML front matter). Views can be tables, cards, or lists, each
with its own display/sort/filter configuration; multiple views per base.

The 1.14 desktop changelog (1 Oct 2026, verified) shows Bases continuing to grow:
"Added 'Hide column' to the right-click menu of a kanban column", "A base made
with 'Create new base' now names its first view 'View' instead of 'Table'",
and, notably, "Search in the File Explorer, Bookmarks, Outline, and Sync views
now matches the full path of each item." The mobile 1.14 changelog (5 Oct 2026)
adds "Bases: Fixed exporting a view as a CSV file."

**Roadmap:** "Bases support for Publish" — **Active**. "Calendar view for
Bases" — Planned. "Kanban view for Bases" — launched in 1.14. "Create and
reorder groups in Bases" — launched in 1.14.

**Lesson, and the important one:**

> Bases is Obsidian admitting that **front matter is the real structure of a
> knowledge base, and that users want to *query* it, not just read it.**

That is a big claim and it is right. It is also the clearest evidence of the
**feature-acceleration risk**: a Markdown reader does not need a query engine. A
Markdown *viewer* certainly does not. If we ever touch this area, the honest
version is a *filterable document list* — `path:`, `modified:`, `tag:` — which
is [02 §4.4](../12-ux/02-navigation-and-find.md#44-search-ux) and is a rounding
error by comparison.

### An importer, as a class of tool

The community plugin list includes **Importer** ("Convert your data to Markdown
files you can use in Obsidian. Works with Apple Notes, OneNote, Evernote,
Notion, Google Keep, and many other formats") and **Airtable import** (roadmap,
July 2026). Importers are where a large chunk of the ecosystem's effort goes,
and where a lot of users' first contact with Markdown happens.

**Lesson for us:** we will not build importers. We will, however, be *readable
by* them, which means (a) reading whatever Markdown they emit, correctly, and
(b) not requiring front matter we do not understand. That argues for
**front-matter tolerance**: parse it, display the useful keys, never choke, never
rewrite.

---

## 11. What we learn, what we copy, what we must not do

### What we learn — adopt as design principles

| # | Lesson | Where it lands for us |
|---|---|---|
| L1 | **Local files first.** The user owns plain files in a folder. No container, no import, no lock-in | Folder model in [14-architecture-options](../14-architecture-options/); "Open a file or a folder" as the only concept in the UI |
| L2 | **The plugin boundary is the product's leverage.** A narrow, stable, documented API beats a feature checklist | Design the core API surface and a permission model *before* the features. See [14]((../14-architecture-options/)) |
| L3 | **Links are cheap; backlinks are derived.** Never make the user maintain a link graph by hand | Backlinks panel in [02 §9](../12-ux/02-navigation-and-find.md#9-backlinks), built from the same parse pass as search |
| L4 | **Forgiving link resolution.** Fuzzy, case-insensitive, path-tolerant. Never a 404 | Anchor handling in [02 §2](../12-ux/02-navigation-and-find.md#2-heading-anchals) |
| L5 | **One index, many features.** The parse pass that enables search also enables backlinks | `packages/core` produces one AST per document; both features consume it |
| L6 | **Anything a user creates is a file they own.** Canvas is JSON in the vault, not a DB row | General rule for us, including themes ([03 §4](../12-ux/03-theming.md#4-themes-as-data-not-code)) and settings |
| L7 | **Security posture is a feature.** Independent audits, published reports | [11 security](../11-security/) should include a threat model and, eventually, an audit |
| L8 | **Money without strings.** They prove you can be solvent and open at the same time | MIT, no paid tier, no telemetry — and say so in the README |
| L9 | **Front matter is real structure.** Parse it, display it, never choke on it | Front-matter tolerance, never rewriting |
| L10 | **A CLI is a differentiator.** Scriptability inside the app | `siyana open`, `siyana search --format=json`, `siyana export` — cheap, and nobody in our space does it |

### What we copy — behaviour, never code

- The *idea* of a local folder as the unit.
- The *idea* of derived backlinks.
- The *idea* of a documented, permission-scoped plugin API.
- The *shape* of the free/optional-paid model.

None of these are Obsidian's code. Obsidian's application code is closed
source and copyright-protected; there is nothing to copy even if we wanted to,
which is a useful fact.

### What we must NOT do

| Do not | Why |
|---|---|
| **Replicate the proprietary core** | It is closed source. We cannot see it, cannot use it, and attempting to clone a proprietary product's internals is both impossible and wrong. What we build must be our own architecture, chosen on the merits |
| **Build a graph view** | Beautiful and useless. See §9.4 |
| **Build a query engine** | Bases proves users want it; it also proves how fast a Markdown app accumulates features nobody asked for. A viewer that can filter a file list is the whole of what we need |
| **Ship an app with a plugin runtime in the render path** | The performance and security cost is structural (see §9.1). If we ever add plugins, they must run outside the render path, be permission-scoped, and be off by default |
| **Claim "we do everything Obsidian does, but lighter"** | That is not a positioning. See §12 |
| **Copy a community theme's CSS** | Per-theme licences vary; most are personal-use or unlicensed. Bundle our own |
| **Make the graph view the hero image** | |

---

## 12. The gap, stated precisely

Obsidian's roadmap is the strongest evidence for our positioning. Read their
shipped-and-shipped list again: Canvas, Bases, Sync, Publish, Web Clipper,
CLI, mobile Quick Capture, share sheets, widgets, multi-platform, themes,
snippets, plugins, graph view, unique note IDs, templates, workspaces, bases
kanban, bases calendar (planned), multiplayer (planned), PDF annotation
(planned), "Obsidian for Work" (active).

And read this roadmap item, **launched March 2026**:

> "**Obsidian Reader** — Distraction-free reading view for Web Clipper."

They shipped a *reading view*. For a *clipper*. In 2026. Because they did not
have one in the app.

**That is the gap, and it is written in their own roadmap.**

> ### The gap
>
> **A Markdown application for people who want to read Markdown, not organise
> it.**
>
> Not a vault. Not a graph. Not a query engine. Not a plugin host. Not a
> sync service. A **viewer** that opens a file in under 200 ms and gives you a
> beautiful, accessible, distraction-free page to read — and then gets out of
> the way.
>
> Concretely, the things nobody offers:
>
> | | |
> |---|---|
> | **Open fast** | Cold start to first paint under 200 ms on a 10 MB README. No vault scan, no plugin boot, no welcome wizard |
> | **Read for hours** | Real focus mode, a real typographic scale, a real measure, a reading position that survives a crash. See [01-reading-ux](../12-ux/01-reading-ux.md) |
> | **Be honest** | No account. No telemetry. No upsell. No "you have 3 notes left". Works fully offline, always |
> | **Be accessible** | A published **WCAG 2.2 AA** conformance statement, and the architecture to keep it true. See [04-accessibility](../12-ux/04-accessibility.md) |
> | **Be narrow** | A deliberately small feature set. Every feature must justify its cost in a reader's attention. No graph view. No query language. No plugin runtime in the render path |
> | **Be a good citizen** | A stable CLI. A stable rendering core other tools can embed. Correct GitHub-compatible output so files render identically everywhere |
>
> **Obsidian is trying to become a knowledge-management platform. We are going
> to be the best reader in the world, and we are going to be free, MIT, and
> accessible.** Those are not the same product, and both are needed.
## Sources

- Overview — <https://obsidian.md/>
- Pricing — Sync/Publish tiers, Catalyst \$25 one-time, Commercial \$50/user/year, 40% education and nonprofit discount, 7-day refunds on services with Catalyst/Commercial non-refundable — <https://obsidian.md/pricing>
- Sync — Standard (\$4 annual-billed / \$5 monthly; 1 vault, 1 GB, 5 MB max file, 1 month history) and Plus (\$8 / \$10; 10 vaults, 10 GB, 200 MB max file, 12 month history, upgradable to 100 GB); AES-256 end-to-end encryption; configuration syncing; selective sync; shared vaults — <https://obsidian.md/sync>
- Download matrix — Windows universal, macOS universal, Linux AppImage (x64), AppImage (aarch64/ARM64), Snap, Deb, community Flatpak; iOS App Store; Android Google Play and APK — <https://obsidian.md/download>
- License overview — "free for all purposes, including personal, commercial, and non-profit use"; "Your data is saved locally on your device"; "We own and reserve rights to our content, including text, images, and code in the app, which is protected by copyright" — <https://obsidian.md/license>
- Community plugins and themes — 8,449 plugins and 826 themes; categories Integrations 1,250 / Files 1,171 / AI 1,019 / Sidebar 903 / Editing 898 / Visualization 807 / Automation 729 / Links 692; the `Importer` plugin's supported sources; the March 2026 community directory with automated review — <https://obsidian.md/plugins>
- Roadmap — Bases support for Publish (Active), Calendar view for Bases (Planned), Canvas support for Publish (Planned), Multiplayer (Planned), PDF annotation (Planned), Obsidian for Work (Active), Obsidian Reader for the Web Clipper (Launched March 2026), Headless client for Sync (Launched March 2026), Sort search results by relevance (Launched October 2026), Airtable import (July 2026), Kanban view for Bases and group reordering (1.14) — <https://obsidian.md/roadmap>
- CLI — `daily`, `daily:append`, `search`, `create`, `tags counts`, `tasks daily`, `diff`, `files --copy`, `unresolved`, `eval`, `plugin:reload`, `dev:errors`, `dev:css`, `dev:dom`; TUI; `/usr/local/bin/obsidian` symlink requiring administrator privileges; `~/.local/bin` on PATH; "the Obsidian app must be running" — <https://obsidian.md/cli>
- Security — Cure53 audit of the apps December 2023; Cure53 audit of the apps with attention to the Web viewer plugin December 2024; Cure53 audit of the Sync API/server/cryptography October 2024; Trail of Bits audit of the Sync API/server/cryptography December 2025 — <https://obsidian.md/security>
- Developer Documentation — plugin API and the Bases-view plugin guide — <https://docs.obsidian.md/>
- `obsidianmd/obsidian-releases` — community plugin list, theme list, repository topics including `bases`, `jsoncanvas`, `markdown` — <https://github.com/obsidianmd/obsidian-releases>
- Changelog — desktop v1.14.4 (1 October 2026) and mobile v1.14 (5 October 2026), including the Bases changes and "Search in the File Explorer, Bookmarks, Outline, and Sync views now matches the full path of each item" — <https://obsidian.md/changelog/>
- **INFERENCE, not verified:** that the application is Electron/Chromium. Supporting evidence: the platform matrix, the DOM-oriented plugin API surface, and the `dev:screenshot` / `dev:css` / `dev:dom` CLI commands. Treated as inference throughout §4.
