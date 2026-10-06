# 01.4 — The viewer problem

> Confidence tags: [`00-method/README.md` §3](../00-method/README.md#3-confidence-tags).
> **Important scope note:** the filesystem findings below are derived from
> **vendor documentation**, not from our own experiments. We have not run a
> watcher on Windows or Linux yet. Everything in §4–§5 is `[INFERRED]` from
> `[VERIFIED]` documentation, and is flagged as such in the research log.

---

## 1. The reframe

A Markdown **renderer library** has exactly one job:

```text
markdown string  →  AST  →  HTML string
```text

Everything else is somebody else's problem. It has no opinion about where the
file came from, whether it changed while you were reading it, whether
`./img/x.png` should resolve against the file or against a bundle root, or what
to do if the document is 400 MB.

A Markdown **viewer** is a desktop application whose entire value proposition is
that it takes responsibility for those problems. The library is the *smallest*
part of it.

```mermaid
flowchart LR
    subgraph LIB["What a library gives you"]
        L1["markdown → AST"]
        L2["AST → HTML"]
        L3["652 conformance tests, maybe"]
    end
    subgraph APP["What only the app can give you"]
        A1["Open a file the user double-clicked"]
        A2["Know its real path on disk"]
        A3["Watch it for external edits"]
        A4["Resolve ./img relative to that path"]
        A5["Build a TOC with stable anchors"]
        A6["Refuse to execute what the file says"]
        A7["Survive a half-written file"]
        A8["Remember where the user was"]
        A9["Print / export without losing layout"]
    end
    LIB --> APP
```text

**Conclusion C6** (stated in [`00-method/README.md` §5](../00-method/README.md#5-what-would-falsify-each-major-conclusion)):
*a viewer is mostly app engineering; the parser is maybe 10% of the work.* This
is `[INFERRED]`, not measured. It is the single most consequential estimate in
this phase and **it is falsifiable and we have not falsified it yet** — see §8.

---

## 2. The obligation inventory

Legend: **LIB** = a library can solve this. **APP** = no library answer; we must
build it. **BOTH** = the library gives a primitive; the app must decide policy.

| # | Obligation | Who solves it | Notes |
|---|-----------|---------------|-------|
| 1 | Parse Markdown to an AST | **LIB** | markdown-it / commonmark.js / micromark |
| 2 | Choose a dialect | **BOTH** | Library gives switches; *we* pick CommonMark 0.31.2 + GFM subset |
| 3 | Sanitise the output HTML | **BOTH** | Library gives a sanitiser; *we* pick the policy and the schema |
| 4 | Open a file by absolute path from the OS | **APP** | No Markdown library touches the filesystem |
| 5 | Handle a file with no extension, or a wrong extension | **APP** | Content sniffing vs extension trust |
| 6 | Decode the file (BOM, UTF-16, Latin-1, invalid bytes) | **APP** | Verified failure in §5.5 |
| 7 | Strip front matter before parsing | **APP** | Verified catastrophic failure in §5.6 |
| 8 | Resolve relative image and link paths against the file's directory | **APP** | §5.5 |
| 9 | Reject or neutralise `file://`, UNC and `..` escapes in image src | **APP** | §5.7 |
| 10 | Build a table of contents with anchors | **APP** | §5.4 |
| 11 | Handle duplicate / CJK / punctuation-only headings | **APP** | §5.4 |
| 12 | Decide what an in-document `#anchor` link does when no such anchor exists | **APP** | |
| 13 | Watch the open file for external modification | **APP** | §4 — the hardest one |
| 14 | Survive a file being written concurrently | **APP** | §4.3 |
| 15 | Decide conflict policy when the user edits and the file changes | **APP** | §4.4 |
| 16 | Enumerate a folder tree | **APP** | §3 |
| 17 | Decide what a "workspace" is (one file? a folder? a set of folders?) | **APP** | §3 |
| 18 | Persist session state (open files, scroll, cursor, folds) | **APP** | §6 |
| 19 | Render a 100 MB file | **BOTH** | Library must be O(n) and streaming-capable; we must not build one DOM |
| 20 | Print / export to PDF | **APP** | §7 |
| 21 | Enforce a trust boundary | **APP** | §8 |
| 22 | Keyboard navigation, screen-reader semantics | **APP** | WAI-ARIA |
| 23 | Handle links to *other files* in the workspace | **APP** | Cross-document navigation is not a Markdown concern |

**Of 23 obligations, 2 are purely library problems.** `[INFERRED]`

---

## 3. Folder trees and workspaces

A renderer is given a string. A viewer is given — or must construct — a *set of
paths*.

Design questions, all of which are product decisions with no correct answer,
recorded here so they are made deliberately:

1. **Tree enumeration cost.** A folder of 200 000 `.md` files cannot be
   enumerated, filtered and rendered on the UI thread. This forces: enumeration
   off the main thread, incremental delivery to the UI, and a hard cap or a
   "search instead" fallback.
2. **What counts as a document?** Extensions (`.md`, `.markdown`, `.mdown`,
   `.mkd`, `.mdx`) are a convention, not a rule — RFC 7763 registers
   `.md`/`.markdown` and lists "Magic number(s): None" `[VERIFIED]`. A file
   with no extension containing Markdown will never appear in an
   extension-filtered tree.
3. **Hidden and ignored files.** `.git`, `node_modules`, `.obsidian`-style
   config directories. `.gitignore` is a *Git* convention; a viewer is not Git.
   We need our own rule, and it will annoy somebody.
4. **Symlinks and junctions.** On Windows, directory junctions are not
   symlinks and have different reparse-point semantics. A tree walker that
   follows them naively can loop.
5. **Workspace identity.** A workspace is a set of roots. It must be
   serialisable, stable across renames, and cheap to reopen.

`[INFERRED]` The honest answer to (2)–(3) is a **user-visible setting** with a
sensible default, plus a "no results? show everything" escape hatch. We cannot
guess right and we must not silently hide files.

---

## 4. Watching the filesystem

This is the highest-risk, least-supported part of any Markdown viewer, and it is
worth being blunt about: **Node.js's own documentation says the API is
unreliable in exactly the situations a viewer runs in.**

### 4.1 What the documentation guarantees (and does not)

From [Node.js `fs` docs](https://nodejs.org/api/fs.html), `fs.watch` **Caveats**
section, quoted `[VERIFIED]`:

> "The `fs.watch` API is not 100% consistent across platforms, and is
> unavailable in some situations."
>
> "On Windows, no events will be emitted if the watched directory is moved or
> renamed. An `EPERM` error is reported when the watched directory is deleted."
>
> "The `fs.watch` API does not provide any protection with respect to malicious
> actions on the file system. For example, on Windows it is implemented by
> monitoring changes in a directory versus specific files. This allows
> substitution of a file and fs reporting changes on the new file with the same
> filename."

Platform mapping `[VERIFIED]`, same page:

| OS | Mechanism |
|----|-----------|
| Linux | `inotify(7)` |
| macOS | `kqueue(2)` for files, `FSEvents` for directories |
| Windows | `ReadDirectoryChangesW` |
| BSD | `kqueue(2)` |
| SunOS | event ports |
| AIX | `AHAFS` (must be enabled) |
| IBM i | **not supported** |

And the failure that bites viewers hardest `[VERIFIED]`:

> "On Linux and macOS systems, `fs.watch()` resolves the path to an inode and
> watches the inode. If the watched path is deleted and recreated, it is assigned
> a new inode. The watch will emit an event for the delete but will continue
> watching the *original* inode. Events for the new inode will not be emitted.
> This is expected behavior."

**This is not a bug we can work around. It is the documented behaviour.** An
editor that saves by write-temp-then-rename (which is what most editors do, and
what Git does) changes the inode. The watcher detaches silently.

`[VERIFIED]` Additional hard facts:

- `filename` "is not always guaranteed to be provided" — you must handle `null`.
- Watching "can be unreliable, and in some cases impossible, on network file
  systems (NFS, SMB, etc) or host file systems when using virtualization
  software such as Vagrant or Docker".
- `fs.watchFile` (stat polling, default interval 5007 ms) exists as a fallback
  but "is slower and less reliable".

On Linux, the kernel limits apply `[VERIFIED]`,
[inotify(7)](https://man7.org/linux/man-pages/man7/inotify.7.html):

- `/proc/sys/fs/inotify/max_queued_events` — "Events in excess of this limit are
  dropped, but an `IN_Q_OVERFLOW` event is always generated."
- `/proc/sys/fs/inotify/max_user_instances` — instances per real user ID.
- `/proc/sys/fs/inotify/max_user_watches` — watches per real user ID.

The practical consequence `[INFERRED]`: **watching every file in a 100 000-file
workspace is not possible on Linux.** A watcher over 100 000 directories exceeds
default `max_user_watches` (8192 on most distributions) and the failure is not
an exception — it is `ENOSPC` from `inotify_add_watch`, which most wrappers
swallow.

### 4.2 The design consequences

| Observation | Required design |
|-------------|-----------------|
| Watch follows the inode, not the path | Watch the **directory**, re-resolve the file on each event, and treat a missing file as "temporarily gone", not "deleted" |
| `filename` may be `null` | Always re-stat the directory rather than trusting the event payload |
| Events can be dropped (`IN_Q_OVERFLOW`) | Maintain a periodic low-frequency reconciliation pass; the watcher is a latency optimisation, **never the source of truth** |
| Windows directory watches die on rename | Watch the *parent directory* of every open file, not the file |
| Network filesystems may not work at all | Detect and degrade to explicit "reload" + a warning |
| Linux watch count is capped | Watch only what is *open* plus the workspace roots' immediate children; do not watch the whole tree |

**The single most important design decision here: the filesystem watcher is an
optimisation, not a mechanism.** Truth is obtained by reading the file. The
watcher only decides *when* to read it. Any design that treats the event as the
source of truth will be wrong on at least one of our two target platforms, and
the documentation says so explicitly.

### 4.3 Concurrent writes

A user saves a 3 MB file in a large editor. A watcher fires. We read the file
**mid-write** and render a truncated document. Then the user saves again and we
render the correct one. Between those two moments the user saw garbage.

There is no filesystem API that says "this write is complete". Verified facts
that make it worse `[VERIFIED]`:

- On **AIX**, "Saving and closing a watched file will result in two
  notifications (one for adding new content, and one for truncation)." So even
  a correct implementation sees two events for one save on one platform.
- `fs.watchFile` polls `stat`; a file being rewritten will show an
  intermediate size.

Required mitigation `[INFERRED]`:

1. **Debounce** with a settle window (tens to hundreds of ms).
2. **Validate** the read: valid UTF-8, no NUL, plausible length. If validation
   fails, retry rather than render.
3. **Compare identity**: if `mtime` + `size` + (optionally) a cheap content hash
   are unchanged, skip the reparse entirely.
4. **Never render a partial parse as if it were the document.** If the parse
   throws or validation fails, keep showing the last good render and mark the
   view as "stale".

`[INFERRED]` The trap: "stale" must be visible. A viewer that silently shows the
previous version of a file the user is editing is worse than one that shows an
error.

### 4.4 Edit conflict policy

If the user can edit (even just to fix a typo) *and* the file changes on disk, we
have a conflict. Policies:

| Policy | Behaviour | Cost |
|--------|-----------|------|
| Reload always | Disk wins | Destroys unsaved edits |
| Never reload while dirty | Memory wins | Shows a file that is not on disk |
| Prompt | User decides | Annoying if it fires on every keystroke-plus-save |
| Debounced reload with a dirty guard | Disk wins unless dirty, then prompt | Needs careful state machine |

`[UNVERIFIED]` We have not surveyed what Obsidian/Typora/MarkText actually do.
This is `13-competitors/` work and it is listed as required, not optional.

---

## 5. The file-content problems

These are all "the bytes on disk are not what the parser expects" cases. Each one
produces a visibly broken viewer, and each is app-level.

### 5.1 Encoding

`[INFERRED]` A viewer must handle, at minimum: UTF-8 without BOM (the norm),
UTF-8 **with** BOM (Windows editors add it; Jekyll's own docs warn "very, very
bad things will happen to Jekyll" if a BOM is present, <https://jekyllrb.com/docs/front-matter/> `[VERIFIED]`), UTF-16 LE/BE (rare, but Windows), Latin-1 (legacy files), and **invalid UTF-8** (truncated file, mixed encodings).

Verified consequence of a BOM, from `commonmark@0.31.2`:
`"\uFEFF---\ntitle: Hello\n---\n\nBody\n"` →
`<h2>---\ntitle: Hello</h2><p>Body</p>`. The BOM is absorbed into the first line
and destroys the front-matter *and* the first heading. **One invisible byte
visibly breaks the top of the document.**

RFC 7763 §2 requires `charset` and says "There is no default value" because
neither Gruber's syntax description nor most implementations specify one
`[VERIFIED]`. For a local viewer there is no charset header, so we must guess —
and guess *conservatively*: BOM first, then valid-UTF-8 check, then fall back
with a visible warning rather than silently mangling.

### 5.2 Line endings

CommonMark defines all three `[VERIFIED]`, [§2.1](https://spec.commonmark.org/0.31.2/#characters-and-lines):
"A line ending is a line feed (U+000A), a carriage return (U+000D) not followed
by a line feed, or a carriage return and a following line feed."

This is a **viewer requirement with teeth**: reading a CRLF file as LF-only
makes every line end with a stray `\r`, which changes the raw content of every
line. A CRLF file must be normalised on read (in memory only — we never write
back, per Principle 3 in
[`03-core-principles.md`](./03-core-principles.md)).

### 5.3 Tabs

Also specified `[VERIFIED]`: "Tabs in lines are not expanded to spaces. However,
in contexts where spaces help to define block structure, tabs behave as if they
were replaced by spaces with a tab stop of 4 characters."

`[INFERRED]` Tab stop 4 is a *CommonMark* choice. Files authored for editors
configured with tab width 8 will render differently, and the spec's own example
demonstrates it: `→foo→baz→→bim` and `  →foo→baz→→bim` both produce
`<pre><code>foo→baz→→bim`, i.e. the leading indentation is stripped but internal
tabs are preserved as literal tabs. There is no way for a viewer to know the
author's preferred tab width. CommonMark's answer is the only defensible one.

### 5.4 Links and anchors

Three separate problems that look like one.

**(a) Markdown defines no fragment identifiers.** RFC 7763 §3 `[VERIFIED]`:
"`[MARKDOWN]` does not define any fragment identifiers, but some variants do, and
many types of Markdown processor output (e.g., HTML or PDF) will have
well-defined fragment identifiers. Which fragment identifiers are available for
a given document are variant-defined."

So *every* viewer invents an anchor scheme. The de-facto standard is GitHub's.
Measured behaviour of `github-slugger@2.0.0` (npm, 2026-10-06):

| Heading text | Slug |
|--------------|------|
| `Hello World` (first) | `hello-world` |
| `Hello World` (second) | `hello-world-1` |
| `C++ & You` | `c--you` |
| `Ünïcödé Häding` | `uenicoede-haeding` |
| `100% Done` | `100-done` |
| `---dash---` | `----dash---` |
| `a b  c` (double space) | `a-b--c` |
| `<em>x</em>` | `emxem` |

Three things follow `[INFERRED]`:

1. Duplicate counters make slugs **order-dependent**. Adding a heading above
   another changes its slug, breaking every inbound `#link`. This is GitHub's
   problem too — it is not a bug we can fix, only inherit.
2. Slugs are lossy and collision-prone (`a b  c` → `a-b--c`; two different
   headings can collide). We must detect collisions and disambiguate, or
   navigation silently breaks.
3. **Heading text must be taken from the AST, not the raw source.** Passing the
   raw line `## <em>x</em>` yields `#-emxem`. We must use the *rendered text
   content* of the heading node. This is a real bug class: any implementation
   that slugs the source line will produce anchors that do not match anything.

**(b) Links to other files in the workspace.** `[the changelog](changelog.md)`
is a *relative link*, and the target may or may not exist, may be a directory,
may be outside the workspace, or may be a URL with a scheme. Resolving it against
the CWD is a bug; resolving against the file's own directory is the only
sensible default `[INFERRED]`.

**(c) Links with anchors into other files.** `other.md#section` requires
opening the other file and locating the anchor. If the other file is not open,
does the viewer open a tab, push a view, or follow in place? Product decision,
not a library question.

### 5.5 Images and relative paths

`![Architecture](img/arch.png)` is a literal, relative URL in the output HTML.
A browser loading it in a webview resolves it against the **document base URL**,
which in an Electron/Tauri app is something like `file:///…/index.html` or
`http://localhost:port/` — **not** the Markdown file's directory.

Verified from the CommonMark spec that the link destination is emitted verbatim:
`![foo](train.jpg)` → `<img src="train.jpg" alt="foo" />` `[VERIFIED]`.

`[INFERRED]` Therefore **every** image in every Markdown file opened from a
subdirectory will be broken unless we do something. The options:

| Approach | Consequence |
|----------|-------------|
| Rewrite `src` to an absolute `file://` URL at parse time | Works; requires the parser to know the file's directory; breaks re-serialisation |
| Set `<base href="file:///path/to/file/dir/">` | Elegant, but `<base>` changes resolution for *all* relative URLs in the document, including links we might want elsewhere; and it is document-global so it cannot work for a two-pane or split view |
| Custom URL scheme + protocol handler | Correct for multi-file cases, and needed anyway for the web build |
| Serve over `http://127.0.0.1` | Works, but turns a local file view into a network surface — bad for trust |
| Custom renderer rule (rewrite `image` tokens) | Most surgical; the place to do it |

**Recommendation `[INFERRED]`:** a custom renderer rule at the token level, not
a string post-process, and **not** `<base>`. Reason: token-level rewriting lets
us decide policy per-link (allow / deny / proxy) and keeps the AST intact. See
`05-rendering/`.

### 5.6 Front matter is a parsing problem, not a style problem

Front matter is not in any Markdown spec `[VERIFIED]` — it is the Jekyll
convention (YAML between triple-dashed lines, "must be the first thing in the
file", <https://jekyllrb.com/docs/front-matter/>) and the Hugo convention (YAML,
TOML or JSON). Multiple mutually incompatible conventions.

**And `---` is Markdown syntax.** It is a thematic break, and under Setext rules
`---` under a line of text is an H2.

Measured with `commonmark@0.31.2`, no front-matter handling at all:

| Input | CommonMark output |
|-------|-------------------|
| `---\ntitle: Hello\n---\n\n# Body\n` | `<hr />\n<h2>title: Hello</h2>\n<h1>Body</h1>` |
| `***\ntitle: Hello\n***\n` | `<hr />\n<p>title: Hello</p>\n<hr />` |
| `+++\ntitle = "Hello"\n+++\n` | `<p>+++\ntitle = "Hello"\n+++</p>` |
| `\uFEFF---\ntitle: Hello\n---\n\nBody\n` | `<h2>---\ntitle: Hello</h2>\n<p>Body</p>` |

The first row is the disaster case: **every blog-post-derived Markdown file
starts with a horizontal rule and a heading called "title: Hello".** A viewer
that does not strip front matter renders garbage at the top of a large fraction
of real documents.

The fourth row shows the BOM making it worse: the `---` is swallowed into a
heading.

`[INFERRED]` Required behaviour, in order:

1. Decode (strip BOM) **first**.
2. Detect front matter by: first line is exactly `---` (or `+++`, or `;;;` for
   some tools) **and** a matching closer appears before the first blank line
   followed by Markdown content. Do **not** try to be clever beyond that.
3. Parse the metadata with a real YAML/TOML/JSON parser, with a size limit and a
   depth limit. **Never** `eval` it. A front-matter parser is a common RCE
   vector in other tools.
4. If parsing the metadata fails, **still render the document** and show the raw
   front matter as a code block. Losing the whole document because the metadata
   is malformed is the worst possible behaviour.

**And this is a case where the raw text must be preserved.** If we ever strip
front matter we must be able to put it back byte-identically, or we have
violated Principle 3. Given we do not write back in v1, the safe implementation
is: keep the original bytes, keep the byte offset where the body starts, and
render only the body.

### 5.7 Path escapes

A hostile or merely careless document can contain:

```markdown
![x](../../../../../../etc/passwd)
![x](file:///C:/Windows/win.ini)
![x](\\attacker\share\secret.png)
![x](https://evil.example/track?leak=1)
```

Three distinct risks `[INFERRED]`:

- **Local file disclosure** — rendering a local image into a webview exposes its
  content to whatever the document can do next. If raw HTML and inline
  `<script>` are allowed, the file is exfiltratable.
- **SSRF / tracking pixel** — a remote image causes a network request on render,
  leaking the user's IP and the fact that they opened the file. The OWASP
  [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
  is the reference for why this matters.
- **Unicode direction spoofing** — RFC 7763 §2 warns specifically that
  "malicious Unicode-based Markdown could, for example, surreptitiously change
  the directionality of the text" `[VERIFIED]`. A document can *display* content
  that differs from its content.

`[INFERRED]` These are policy, and policy is ours. Recommended default posture
for v1, to be confirmed in `11-security/`:

| Destination | Default |
|-------------|---------|
| Relative, inside the file's directory subtree | Allow |
| Relative, escaping via `..` | Block, visibly |
| `file://` / UNC | Block |
| `http(s)://` | **Do not auto-fetch.** Render as a link; require an explicit click |
| `data:` | Allow for `image/*` only, size-capped |

---

## 6. Session and workspace persistence

`[INFERRED]` A viewer that forgets what you had open is a worse viewer. But
persistence has a trust boundary and a portability boundary:

- **Where does state live?** A per-workspace file inside the folder is
  discoverable and git-able but pollutes the user's directory. An app-data
  directory keyed by a hash of the absolute path is invisible but breaks if the
  folder is moved or renamed. **Both**: a small `session.json` next to the
  workspace *if the user opts in*, app-data otherwise.
- **What is worth storing?** Open file paths (relative to the workspace root, so
  they survive moves), per-file scroll offset, expanded/collapsed state,
  selected tab, theme, window geometry. **Not** editor state we do not own.
- **Portability across machines.** Absolute paths are useless on another
  machine. Relative-to-root is the only portable choice.
- **Corruption.** State files corrupt. Read defensively; on any parse failure,
  discard and start fresh. Never let bad state prevent startup.
- **The web build changes all of this.** There is no app-data directory; there
  are no absolute paths; the browser has `localStorage` and the File System
  Access API (<https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle>
  `[VERIFIED]`). Whatever state model we choose must have a web story, or we
  will fork the codebase before the web phase starts.

---

## 7. Export and print

Three different jobs that get conflated.

| Job | Mechanism | Hard part |
|-----|-----------|-----------|
| "Print this document" | `window.print()` (<https://developer.mozilla.org/en-US/docs/Web/API/Window/print> `[VERIFIED]`) | A print stylesheet that does not depend on the viewport, does not include app chrome, and paginates code blocks and tables sanely. `@media print` |
| "Export to HTML" | Render to a self-contained `.html` | Image paths must be inlined or made relative to the output; the CSS must be embedded; the anchors must survive |
| "Export to PDF" | Chromium print-to-PDF (Electron `webContents.printToPDF`), or a PDF library | Not available in a web build at all; a Rust shell would need a different route |

`[INFERRED]` Constraints derived from the rest of this document:

1. Print/export requires rendering the **whole** document, so it inherits the
   large-document problem (§9).
2. Export must not silently drop front matter, since we keep the source bytes.
3. Print must work with the document *unselected* and unexpanded — i.e. the
   print stylesheet must be written against the rendering we produce, not
   against the DOM state the user happens to have.

---

## 8. Trust boundaries

This is the section that should shape the architecture most.

### 8.1 What we know from the standards

RFC 7763 §2 `[VERIFIED]`:

> "Markdown interpreted as a precursor to other formats, such as HTML, carries
> all of the security considerations as the target formats. For example, HTML
> can contain instructions to execute scripts, redirect the user to other web
> pages, download remote content, and upload personally identifiable
> information. Markdown also can contain islands of formal markup, such as
> HTML."
>
> "Since Markdown may have different interpretations depending on the tool and
> the environment, a better approach is to analyze (and sanitize or block) the
> output markup, rather than attempting to analyze the Markdown."

The second paragraph is our **conclusion C7**, and it is a decade old and
authoritative. It says: do not try to write a Markdown-subset checker; sanitise
the HTML you produced.

### 8.2 What each layer of the industry does

| Layer | Mechanism | Reference |
|-------|-----------|-----------|
| GFM | `tagfilter` — rewrite `<` to `&lt;` for 9 specific tags | [GFM spec](https://github.github.com/gfm/#disallowed-raw-html-extension-) `[VERIFIED]` |
| marked | **Nothing.** Its README says: "🚨 Marked does not sanitize the output HTML" | <https://github.com/markedjs/marked> `[VERIFIED]` |
| markdown-it | `html: false` and `linkify: false` by default (verified by instantiating `new MarkdownIt()` and reading `.options` on 2026-10-06); also ships a `maxNesting: 100` limit (20 in the `commonmark` preset) as a structural-complexity guard | [README](https://github.com/markdown-it/markdown-it) `[VERIFIED]` |
| rehype-sanitize | AST-level sanitiser that "drops anything that isn't explicitly allowed by a schema (**defaulting to how github.com works**)" | <https://github.com/rehypejs/rehype-sanitize> `[VERIFIED]` |
| DOMPurify | DOM-level sanitiser | <https://github.com/cure53/DOMPurify> `[VERIFIED]` |

`[VERIFIED]` What a GitHub-shaped allow-list actually removes — rehype-sanitize's
own documented example input contains exactly the vectors in §8.3:
`<div onmouseover="alert(…)">`, `<a href="jAva script:alert(…)">`,
`<img src="x" onerror="alert(…)">`, `<iframe src="javascript:…">`,
`<math><mi xlink:href="data:x,<script>…"></math>`, and a `<script>` that calls
`require('child_process').spawn`. The `<math>` case is worth internalising:
**SVG/MathML is an XSS vector and a naive tag blocklist will not catch it.**

`[INFERRED]` A 9-tag blocklist is a compatibility measure, not a boundary.
`<img src=x onerror=…>`, `<svg onload=…>`, `<a href="javascript:">`,
`<math>`, `<details ontoggle=…>` and `<form action=…>` are all still live under
GFM. CWE-79 (<https://cwe.mitre.org/data/definitions/79.html>) `[VERIFIED]` is the
reference for what "still live" means.

### 8.3 The full trust surface of a viewer

A viewer is more exposed than a web page, because:

| Surface | Attack |
|---------|--------|
| Arbitrary remote files | `file://` paths, UNC shares, `..` traversal |
| Raw HTML in Markdown | Script execution in the WebView |
| Inline event handlers | `onerror`, `onload`, `ontoggle` |
| Remote images | SSRF, tracking, IP leak |
| `javascript:` / `data:` URLs | Script execution |
| Malicious Unicode | Bidi spoofing, homoglyph filenames, invisible characters |
| Deeply nested structures | Render-loop DoS — [OWASP DoS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html) `[VERIFIED]`; the CommonMark spec itself notes an ordered-list marker is limited to 1–9 digits because "with 10 digits we start seeing integer overflows in some browsers" `[VERIFIED]` |
| Pathological emphasis | Algorithmic-complexity DoS in the parser (see [`03-core-principles.md`](./03-core-principles.md#why-this-is-linear-not-exponential)) |
| Symlinks / junctions | Tree walk escapes the workspace |
| `file://` in link href | Opens arbitrary local files in the OS |

`[INFERRED]` Three mitigations, in order of value:

1. **Sanitise the output**, per RFC 7763. Not optional. Choose the schema
   explicitly; do not adopt an allow-list by accident.
2. **Render in a context that cannot reach the filesystem.** This is a shell
   choice (`08-desktop-frameworks/`) and it is the strongest single control. A
   webview with `file://` access is not a sandbox.
3. **Do not auto-fetch remote resources.** A viewer that only loads what is on
   disk has a much smaller attack surface.

---

## 9. Large files

`[INFERRED]`, and explicitly **not measured**. We made no performance
measurements in this phase (see
[`00-method/README.md` §6](../00-method/README.md#6-known-weaknesses-in-this-phase)).
The following are *structural* requirements, derived from verified properties of
the format and of browser engines.

Three independent limits, and they bind at different sizes:

| Limit | Nature | Mitigation |
|-------|--------|------------|
| **Parse time** | O(n) for CommonMark blocks, but emphasis/link resolution is stack-based and can be super-linear on adversarial input | Streaming parse; cancellation; a size threshold at which we warn |
| **AST memory** | A 100 MB document with heavy emphasis produces a node count far exceeding 100 MB of JS objects | Chunked parse-and-render; never materialise the whole AST |
| **DOM/layout** | Browsers degrade badly past ~10⁵ DOM nodes. `content-visibility: auto` (<https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility> `[VERIFIED]`) lets the engine skip layout for off-screen content | Render progressively, use `content-visibility`, virtualise the TOC |

The structural facts that make this tractable `[VERIFIED]`:

- CommonMark parsing is two-phase, and **phase 2 is parallelisable per block**
  ("the inline parsing of one block element does not affect the inline parsing
  of any other"). We can parse top-level blocks incrementally.
- `content-visibility` is a real engine primitive, not a polyfill.
- Intersection Observer
  (<https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API>
  `[VERIFIED]`) gives us scroll-driven hooks for lazy image loading and TOC
  highlighting.

`[UNVERIFIED]` **What is the largest document we will actually support?** This is
a product decision with a technical floor underneath it, and we have not measured
the floor. `10-performance/` must produce: parse throughput, peak memory, worst-case
pathological timing, and DOM node counts at 1/10/50/100 MB. **No number in this
document should be read as a target.**

---

## 10. What has no library answer — the summary

For the avoidance of doubt, restated. These are app-level, full stop:

| Problem | Why no library helps |
|---------|---------------------|
| Inode-based watch detachment | It is the documented OS behaviour |
| `IN_Q_OVERFLOW` dropped events | Kernel-level, requires reconciliation design |
| Front matter before parsing | Not a Markdown concern; contradicts the spec's own grammar |
| BOM/encoding detection | Byte-level, before any parser |
| Base-URL resolution for images | Depends on how the app embeds the renderer |
| Anchor scheme | Markdown defines none (RFC 7763 §3) |
| Workspace tree semantics | Product decisions |
| Session persistence | Product decisions |
| Print stylesheet | Product decisions |
| Trust policy | Policy, not implementation |
| Edit-conflict resolution | UX policy |
| Working set during concurrent writes | App-level state machine |

---

## 11. Consequences for the architecture

Requirements that follow, each traceable to a section above:

| # | Requirement | From |
|---|-------------|------|
| V1 | Open files by absolute path; treat the filesystem as the source of truth | §2, §4 |
| V2 | Watch directories, not files; reconcile periodically; never trust the event alone | §4.1, §4.2 |
| V3 | Debounce + validate + keep-last-good-render on every external read | §4.3 |
| V4 | Decode: strip BOM, detect UTF-16, validate UTF-8, warn on fallback | §5.1 |
| V5 | Normalise CRLF/CR in memory; never write back in v1 | §5.2, Principle 3 |
| V6 | Strip front matter using a real YAML/TOML/JSON parser with limits; never `eval`; render the body even if metadata fails | §5.6 |
| V7 | Generate anchors from **AST text content**; detect collisions; disambiguate | §5.4 |
| V8 | Rewrite image `src` at the **token** level with an explicit allow policy; never auto-fetch remote images | §5.5, §5.7 |
| V9 | Sanitise output HTML against an explicitly chosen schema | §8 |
| V10 | Resolve relative links against the containing file's directory, never the process CWD | §5.4, §5.5 |
| V11 | Persist session state relative to the workspace root; tolerate corruption; have a web story from day one | §6 |
| V12 | Design for progressive, chunked rendering from the start | §9 |

---

## 12. Open questions

| Question | Status | Destination |
|----------|--------|-------------|
| What is the real behaviour of `fs.watch` on Windows and Linux in practice? | `[UNVERIFIED]` — documentation only, zero experiments run | `14-architecture-options/`; needs a test harness on both OSes |
| What do Obsidian / Typora / MarkText actually do for conflict resolution and front matter? | `[UNVERIFIED]` | `13-competitors/` — **required before V3 and V6 are finalised** |
| What is our maximum supported document size? | `[UNVERIFIED]` | `10-performance/` |
| Does our chosen shell give us a real sandbox, or do we need to build one? | `[UNVERIFIED]` | `08-desktop-frameworks/`, `11-security/` |
| How should cross-file navigation behave (tab vs replace vs split)? | `[UNVERIFIED]` — product | `12-ux/` |
| Is conclusion C6 ("parser is ~10% of the work") actually true? | `[UNVERIFIED]` — **not measured, and it drives our roadmap** | `13-competitors/`, by code-auditing three real viewers |

Next: [`02-syntax/`](../02-syntax/) — every construct, spec by spec.
