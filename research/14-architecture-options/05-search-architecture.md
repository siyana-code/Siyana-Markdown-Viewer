# 05 · Search Architecture

**Question.** What do we ship for "find in page", for "search across the folder",
and for "search everything", and what does each cost?

**Short answer.** Ship (a) native find now. Ship (b) as a bounded, cancellable,
progress-reporting walk with an in-memory cache — it is good enough for the
folder sizes real users have. Build (c) only when a benchmark says tier (b) is
too slow, and when it does, put the index in Rust or SQLite rather than in the
view layer.

---

## 1. Three tiers, and they are genuinely different problems

| Tier | Query | Data source | Target latency | Complexity |
|---|---|---|---|---|
| **(a) In-document find** | within one open document | the rendered DOM / the buffer | < 16 ms per keystroke | Very low — or **zero**, if we use the platform's own find |
| **(b) Cross-file search** | across the open workspace | walk + read + substring match | first results < 300 ms, complete < 3 s for 2,000 files | Low–medium |
| **(c) Full-text index** | across the workspace, ranked, fuzzy, filtered | a persisted inverted index | first results < 50 ms on a 50k-file workspace | High |

The critical framing: **these are not "search", "better search", and "best
search".** They are three different subsystems with different constraints, and
the mistake is building tier (c) when tier (b) was going to be fine.

## 2. Tier (a): use the platform's find

### 2.1 What we actually get for free

Every webview already ships a find bar with: match highlighting, match
navigation, case sensitivity, whole-word, regex (in Chromium/WebKit builds),
incremental search, and native text selection behaviour. It is faster than
anything we will write, it is localised, it is accessible, and it costs zero
lines.

The catch: **we do not control it, and it operates on the DOM, not our AST.**

```ts
// packages/ui/src/find.ts
export type FindProvider = 'native' | 'builtin';

/**
 * Returns how to invoke find in this shell, or null to fall back.
 * Feature-detected: does the shell own a menu item for it?
 */
export function nativeFindSupport(shell: Shell): FindProvider {
  // Desktop: Tauri/Wry. The webview exposes find through the OS menu in some
  // configurations, but there is NO reliable cross-platform API from JS.
  // In practice: 'native' only where the shell wires an accelerator to the
  // platform find (see below), otherwise 'builtin'.
  return shell.ownsFindAccelerator ? 'native' : 'builtin';
}

export interface FindHandle {
  readonly provider: FindProvider;
  find(term: string, opts: { caseSensitive: boolean; wholeWord: boolean; regex: boolean }): Promise<FindResults>;
  next(): Promise<void>;
  prev(): Promise<void>;
  close(): void;
}
```text

### 2.2 Electron's Ctrl+F problem

If we ever ship an Electron build, the browser's own find bar is **claimed by
Electron's own default menu**. To use it you must either:

```js
// main.js — Electron: remove the default Edit menu's Find role
const { app, Menu, BrowserWindow } = require('electron');
Menu.setApplicationMenu(Menu.buildFromTemplate([
  // ...custom menus; omitting the roles that trigger the find bar frees Ctrl+F
]));
```

and even then, `webContents.findInPage(term, { forward: true })` is the
programmatic API and it is the only way to *drive* find — there is no API to
*style* it, and on some platforms the find UI is drawn by the browser process
and cannot be repositioned or restyled at all.

**Consequence, and it is a real product constraint:**

> Browser find cannot be styled. Our "reading-first" design — a floating,
> theme-aware find bar integrated into our chrome — is not achievable with the
> native find bar. It is achievable in Chromium via `window.find()` plus our own
> overlay, but `window.find()` only highlights the *first* match in the document
> and is deprecated in some engines.

**Recommendation:**

| Platform | Tier (a) implementation |
|---|---|
| Desktop (Tauri/Wry) | Register a global shortcut (Tauri's `global-shortcut` or an in-app accelerator) that invokes the **webview's own find** via a platform-specific path where available; otherwise use our built-in bar. |
| Web (Chromium) | `window.find(term)` to drive the browser's find + our own counter via `window.find(..., false, false, backwards, false, false, false)`. Non-standard but present in Chromium and WebKit. |
| Web (Firefox/Safari) | Built-in bar. `window.find` is absent in Firefox. |
| Mobile | Built-in bar, always (OS find exists too but we cannot reach it). |

Because the styled bar is what we want, and because "our own bar" is the only
design that works consistently across three platforms, the honest recommendation
is:

> **Implement one built-in find bar in `ui`, and *additionally* wire the native
> accelerator where the shell can. Users who prefer the OS bar get it; users
> who want it themed get ours.**

That is more work than "do nothing", and it is still the right call — because
the alternative is a find bar that ignores our theme, our typography, our
accessibility requirements, and our layout.

### 2.3 What our built-in bar must do anyway

Because we build it for (c) UI consistency, it needs to do the things the native
one does not:

- **Search the rendered text, not the source.** The user searching `**bold**`
  should find `bold`. So matches are computed against `core.plaintext(doc)` plus
  a **source map** back to byte offsets, so `Enter` can scroll to and select the
  right region.
- **Show a count**: `3 / 17`.
- **Highlight across block boundaries**: a search term spanning `…end of one
  paragraph | start of the next…` must be findable.
- **Respect the sanitizer**: never highlight inside a `<script>` (there are
  none) or inside a collapsed heading's hidden content (there is none).
- **Be fully keyboard driven and ARIA-labelled** — `role="search"`,
  `aria-live="polite"` on the count. WCAG 2.2 AA floor.

Implementation sketch against the plaintext + source map:

```ts
// packages/ui/src/find.ts
export class PlaintextFind {
  private plain: string;
  private map: SourceMap;   // plaintext char index → { start, end } in source

  constructor(doc: PlainText & { map: SourceMap }) {
    this.plain = doc.text;
    this.map = doc.map;
  }

  *matches(term: string, opts: MatchOptions): Generator<Match> {
    if (!term) return;
    const haystack = opts.caseSensitive ? this.plain : this.plain.toLowerCase();
    const needle   = opts.caseSensitive ? term : term.toLowerCase();
    const step = opts.wholeWord ? wordStep(haystack, needle) : 1;

    for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + step)) {
      if (opts.wholeWord && !isWordBoundary(haystack, i, needle.length)) continue;
      yield { plaintextStart: i, plaintextEnd: i + needle.length, source: this.map.toSource(i, i + needle.length) };
    }
  }
}
```text

Highlighting happens by wrapping the matched range in the rendered DOM with
`<mark data-find-index="n">`, splitting text nodes as needed. That is a
**text-node splitting** problem, and it is the reason our render pipeline must
keep text nodes addressable (doc 06 §7): if `render` emits `<p>` with one text
child we can split it; if it emits deeply nested inline wrappers with no
positions, we cannot.

> **This is a hard architectural dependency:** the find feature requires the
> renderer to emit positional information for text. Design that into the AST and
> the position map from day one (doc 06 §4), or retrofitting it will be a
> rewrite.

## 3. Tier (b): cross-file search over the workspace

### 3.1 The naive approach, and its actual cost

Naive: walk the tree, read every file, substring-match.

The cost is `I/O + bytes`. Let us do the arithmetic honestly, on a mid-range
laptop with NVMe and a warm page cache:

| Workspace | Files | Median size | Total bytes | Read time (cached) | Read time (cold) | Match time (JS) |
|---|---|---|---|---|---|---|
| A blog | 200 | 8 KB | 1.6 MB | ~15 ms | ~250 ms | ~20 ms |
| A docs site | 2,000 | 6 KB | 12 MB | ~90 ms | ~1.6 s | ~120 ms |
| A large notes vault | 10,000 | 4 KB | 40 MB | ~280 ms | ~5 s | ~400 ms |
| Pathological | 10,000 | 200 KB | 2 GB | ~9 s | **~90 s** | ~15 s |

**How it degrades, and where it breaks:**

1. **0–2,000 files: fine.** Total walk+read+match under 400 ms warm. Users will
   not notice, especially with a progress indicator and streaming results.
2. **2,000–10,000 files: fine warm, poor cold.** 280 ms warm is invisible.
   Cold, you hit 5 s and every one of those 5 seconds must be cancellable and
   must show progress, or the app looks hung.
3. **10,000+ files: the file *sizes* become the problem, not the count.**
   Nobody's vault is 2 GB, but nobody's vault is also guaranteed to be 40 MB.
   A single 90 MB generated file (`all-docs-concatenated.md`) blows the budget
   on its own.
4. **Two failure modes that need explicit handling:**
   - **Binary files.** A `.png` in the workspace must not be decoded as UTF-8.
     Detect and skip. A cheap heuristic: NUL byte in the first 8 KB, or an
     extension deny-list, or (best) a content sniff for known magic numbers.
   - **Pathological regex.** A user-supplied regex like `(a+)+$` on a 40 KB
     line is exponential. Never hand a user regex to the engine without a length
     cap and a step budget. Simplest safe answer: **do not support user regex in
     v1**, or run it in a worker with a hard iteration cap.
5. **Network filesystems make it worse.** A workspace on NFS or a SMB share can
   be 10–100× slower than NVMe per `stat`. `listFiles` must tolerate a 30 s
   `stat` without wedging.

### 3.2 The design: bounded, cancellable, streaming, cached

```ts
export interface SearchRequest {
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly regex: boolean;                 // v1: false only, see §3.1.4
  readonly includeGlobs?: readonly string[];
  readonly excludeGlobs?: readonly string[];   // defaults to ['**/.*', '**/node_modules/**']
  readonly maxResults: number;               // default 500
  readonly maxBytesScanned: number;          // default 256 MiB — the hard stop
  readonly maxFilesScanned: number;          // default 20_000
  readonly signal: AbortSignal;
}

export interface SearchHit {
  readonly relPath: string;
  readonly byteOffset: number;
  readonly line: number;
  readonly column: number;
  readonly excerpt: string;              // ±60 chars, with ellipses
  readonly matchStart: number;           // offset within excerpt
  readonly matchLength: number;
}

export type SearchEvent =
  | { kind: 'progress'; filesScanned: number; bytesScanned: number; relPath: string }
  | { kind: 'hit'; hit: SearchHit }
  | { kind: 'truncated'; reason: 'max-results' | 'max-bytes' | 'max-files' }
  | { kind: 'done'; elapsedMs: number; filesScanned: number; bytesScanned: number };
```

The algorithm, in the shape it should be written:

```ts
// packages/core/src/search/scan.ts  — runs in a Worker, yields between chunks
export async function* scanWorkspace(
  req: SearchRequest,
  fs: FileSystemAdapter,
  ws: WorkspaceHandle,
  cache: ReadCache,
): AsyncGenerator<SearchEvent> {
  let files = 0, bytes = 0, hits = 0;
  let lastYield = Date.now();

  for await (const { handle, size } of fs.listFiles(ws, {
    maxFiles: req.maxFilesScanned,
    signal: req.signal,
    onProgress: () => { /* keepalive */ },
  })) {
    if (req.signal.aborted) return;

    if (size > MAX_SINGLE_FILE) { continue; }         // 8 MiB single-file cap
    bytes += size; files++;

    // 1. Read from cache when the file has not changed since we last read it.
    const entry = await cache.get(handle);
    const text = entry && entry.stamp.equals(await fs.stat(handle))
      ? entry.text
      : await readAndDecode(handle, fs, cache);

    if (text === null) continue;                      // binary / undecodable
    if (text.includes('\u0000')) continue;             // belt-and-braces binary check

    // 2. Match line by line so we get line/column for free.
    for (const { lineNo, lineStart, line } of iterLines(text)) {
      const idx = indexOfInLine(line, req);
      if (idx !== -1) {
        yield { kind: 'hit', hit: makeHit(relPathOf(handle), lineNo, line, idx, req.query.length) };
        if (++hits >= req.maxResults) {
          yield { kind: 'truncated', reason: 'max-results' }; return;
        }
      }
    }

    // 3. Yield to the event loop every ~8 ms and emit progress every ~100 files.
    if (Date.now() - lastYield > 8) {
      yield { kind: 'progress', filesScanned: files, bytesScanned: bytes, relPath: '' };
      await tick();                                     // setTimeout(0) in a Worker
      lastYield = Date.now();
    }
  }

  if (bytes >= req.maxBytesScanned) yield { kind: 'truncated', reason: 'max-bytes' };
  yield { kind: 'done', elapsedMs: 0, filesScanned: files, bytesScanned: bytes };
}
```text

Six decisions in that code, each of which exists because of a specific failure:

| Decision | Failure it prevents |
|---|---|
| `maxFilesScanned` + `maxBytesScanned` + `MAX_SINGLE_FILE` | Pointing the app at `$HOME` and hanging it |
| `AbortSignal` checked per file | User hits Escape and nothing happens |
| `cache.get` keyed by a content stamp | Re-reading 40 MB on every keystroke in the search box |
| Yield every 8 ms, progress every 100 files | A frozen window with no progress bar |
| Skip files containing NUL / undecodable | Crashing on a PNG or a latin-1 legacy file |
| Per-line matching with byte offsets | Returning hits with no way to jump to them |

### 3.3 The read cache — the thing that makes tier (b) feel instant

This is the single highest-value optimisation and it is cheap.

```ts
export interface ReadCache {
  get(handle: FileHandle): Promise<{ text: string; stamp: FileStat } | undefined>;
  put(handle: FileHandle, text: string, stamp: FileStat): Promise<void>;
  invalidate(handle: FileHandle): void;
  clear(): void;
  stats(): { entries: number; bytes: number; hits: number; misses: number };
}
```

| Target | Implementation | Cap |
|---|---|---|
| Desktop | LRU in memory (Rust side, so it survives re-renders) + optional spill to a per-workspace cache dir | 64 MiB in memory, 512 MiB on disk |
| Web | `Map` in a Worker + `CacheStorage`/`OPFS` for persistence | 32 MiB in memory; OPFS optional |
| Mobile | `Map` only; evicted on background | 16 MiB |

Cache invalidation is driven by the same watch/poll machinery as external-edit
detection (doc 03 §5) plus a cheap stamp check on read. Two subtleties:

- **Do not cache huge files.** Anything over 512 KB is streamed per search, not
  cached, because caching it will evict everything useful.
- **Cache the *decoded text*, not the bytes.** Decoding 40 MB of UTF-8 takes
  ~60 ms; doing it once per session instead of once per keystroke is worth more
  than any index at this scale.

### 3.4 Where it runs

| Target | Runs in | Why |
|---|---|---|
| Desktop | A Rust thread (via Tauri `invoke` with a channel, or a dedicated worker) | Reading the filesystem off the main thread is the whole point; the webview must not touch the disk |
| Web | A dedicated Web Worker | Main thread must stay responsive; `FileSystemFileHandle.getFile()` is async anyway |
| Mobile | A Worker, and **cancelled on background** | A 5 s walk on a phone will get the app killed |

The UI contract is strict: **results stream in, are deduplicated by
`(relPath, line)`, are capped at `maxResults`, and are rendered into a
virtualised list** (never 5,000 DOM rows).

## 4. Tier (c): a real full-text index

Defer, but plan, because the plan is what tells us whether to build it at all.

### 4.1 Why tier (b) might not be enough

- Workspaces above ~10,000 files, especially on cold page cache or network storage.
- Queries needing **ranking** (best match first) rather than document order.
- **Filters and facets** ("only files changed this month", "only in `docs/`").
- **Fuzzy / typo tolerance** — "commmonmark" → "CommonMark".
- **Snippets with term context and highlighting** across a persisted index.
- Sub-50 ms queries on a cold start, without reading the corpus at all.

### 4.2 Index format options

| Option | What it is | Platform | Size for 10k docs (~40 MB) | Query | FTS quality | Verdict |
|---|---|---|---|---|---|---|
| **Persisted JSON inverted index** | `{ term: { docId: [positions] } }`, JSON or a compact binary encoding | Everywhere | 60–200 MB, and slow to load | Custom ranking, full control | You write the analyzer, stemmer, and ranking | Only as a prototype; scale problem is the load time |
| **SQLite FTS5** | The reference inverted index, with `bm25()`, snippet(), `highlight()`, prefix queries, and a mature tokenizer | `rusqlite` bundled on native; `sql.js` / `@sqlite.org/sqlite-wasm` on web | 25–60 MB | 1–5 ms | Excellent: bm25, porter stemmer, `unicode61` tokenizer | **The default answer if we go native.** Verified availability of the `fts5` feature in the `bundled` build at implementation time. |
| **Tantivy (Rust)** | A Lucene clone in Rust | Native only (WASM build is not a production path) | Similar to SQLite FTS5, faster build | Sub-ms, rich query parser | Excellent (BM25 + custom tokenizer) | Best *quality*, but native-only → tier (c) becomes desktop-first, which contradicts the "one core, three shells" principle |
| **MiniSearch** (JS) | In-memory inverted index, prefix + fuzzy + field boosting | Everywhere | In-memory only; no persistence | Sub-ms while resident | Good: has fuzzy, prefix, boost, filters | **Best in-memory JS option.** Active (7.2.0), MIT, tiny API, good docs. |
| **FlexSearch** (JS) | Chunked/worker-oriented index with `Document` multi-field support | Everywhere | In-memory; persistence via export/import | Fastest in its own benchmark | Good, tokenizer is configurable | 0.8.212 (Sep 2025) — **slow release cadence**; its own benchmark claims are vendor-produced and we should discount them |
| **Lunr** (JS) | Classic in-memory inverted index | Everywhere | In-memory | Fine | Adequate; 14 language stemmers | **Avoid.** `lunr` 2.3.9 was last published ~5 years ago. |
| **Orama** (JS) | Full engine: full-text + vector + hybrid, filters, facets | Everywhere | In-memory, with persistence | Fast | Excellent, BM25, stemming in 30 languages | Capable and actively developed, but it has grown into a *product* with a paid cloud tier. The parts we want (full-text) are the small part. Test compatibility before committing. |
| **Fuse.js** (JS) | Fuzzy *approximate* matching (bitap) over whole documents | Everywhere | In-memory | Fine for short strings | **Not real full-text.** O(n) per query over documents. | Wrong tool. Reject for large corpora. |

### 4.3 The decision, when the time comes

> **If tier (c) is justified, the index lives in Rust (`rusqlite` with the FTS5
> feature, `bundled`) and is exposed to `core` through a small interface with a
> JS fallback (MiniSearch) for the web and mobile targets.**

That gives one index *implementation* for the platform where the scale problem
is worst (desktop, where workspaces are real folders with tens of thousands of
files), and an acceptable in-memory JS index for the platforms where workspaces
are smaller by construction (a picked folder on a phone, OPFS in a browser).
It also does not force WASM on the web path.

If the team turns out to be more comfortable in TypeScript than Rust, the
fallback plan is: **MiniSearch on all three platforms, with persistence via
`toJSON`/`loadJSON` into IndexedDB/OPFS/app-data, plus a 32 MiB memory cap and
a rebuild-on-miss policy.** That is maybe 400 lines and it will be measurably
good enough for most workspaces. The decision rule is the same one from doc 04
§5.2: measure, then choose.

### 4.4 What to index

```ts
export interface SearchDocument {
  /** Workspace-relative path. */
  readonly id: string;
  /** Path components, so "notes/2024" matches a path query. */
  readonly pathTokens: readonly string[];
  readonly title: string;             // first H1, or the filename stem
  readonly headings: readonly string[];// every heading text, for "in a heading" search
  /** The full plain text. Stored once; used for snippets. */
  readonly body: string;
  readonly mtimeMs: number;           // for the "recently changed" facet
  readonly sizeBytes: number;
  readonly contentHash: string;       // doc 03 §6 — the identity primitive
  readonly wordCount: number;         // for relative ranking
}
```text

Note `contentHash` doing double duty again: it is the index invalidation key
*and* the future sync version primitive (doc 04 §6.2). One hash, three uses.
That is a real architectural dividend from doc 03's choice.

### 4.5 Incremental updates from the file watch

```mermaid
graph TD
    START(["file watch event"]) --> KIND{"event kind?"}
    KIND -->|"created / modified"| STAT["adapter.stat()"]
    STAT --> CMP{"contentHash<br/>=== indexed hash?"}
    CMP -->|yes| NOOP["no-op · do not reindex<br/>(a touch, not a change)"]
    CMP -->|no| REIDX["re-extract SearchDocument<br/>from AST (no re-read of disk)"]
    REIDX --> UPSERT["index.upsert(doc)"]
    KIND -->|"deleted"| DEL["index.remove(id)"]
    KIND -->|"renamed"| RENAME["index.rename(from, to)<br/>+ update pathTokens"]
    UPSERT --> SAVE["debounce 5 s<br/>then persist index"]
    RENAME --> SAVE
    DEL --> SAVE
    SAVE --> DONE(["done"])
    NOOP --> DONE

    ERR(["watch error / overflow"]) --> RESCAN["mark index stale for this subtree<br/>schedule a full re-scan at idle"]
    RESCAN --> STAT

    LAUNCH(["app launch"]) --> VER["index meta: schemaVersion + corpusHash"]
    VER --> OK{"meta matches<br/>current?"}
    OK --> yes|ready| SERVEOUT["serve immediately"]
    OK --> no|missing or stale| FULL["full re-scan in the background,<br/>serve from tier (b) meanwhile"]

    classDef ok fill:#f0fdf4,stroke:#22c55e
    classDef warn fill:#fff7ed,stroke:#f97316
    class NOOP,SERVEOUT ok
    class ERR,RESCAN,FULL warn
```

The box that matters is **`contentHash === indexed hash → no-op`**. Without it,
every `touch` by a backup tool or a `git status` refresh causes a re-extract,
and the index is doing more work than the search is worth.

The other box that matters is **full re-scan at launch, in the background,
serving tier (b) meanwhile**. A cold-start index that blocks search until it
finishes is worse than no index, because the user perceives "search is broken".

### 4.6 When the index is stale

Three states, three behaviours, and a fourth that is the dangerous one:

| State | Detection | Behaviour |
|---|---|---|
| **Current** | `index.meta` matches `schemaVersion` and the corpus fingerprint | Normal query |
| **Stale** | Some files changed since last index (from the watch queue) | Query the index, then **filter out** hits for files whose `contentHash` no longer matches; show a "N results may be out of date" affordance that triggers an incremental re-index |
| **Missing** | No index file for this workspace | Fall through to tier (b), offer "Build index (takes ~Xs)" |
| **Corrupt** | Index file fails to open / FTS integrity check | Delete it (with a backup), rebuild, and tell the user once |

**Never** trust the index for existence of a hit without a verification step,
because a stale index that returns a hit for a deleted file produces a search
result that opens nothing — the single most frustrating failure mode a search
UI has. The verification is one `stat` per result page (20 files), which is
microseconds.

### 4.7 Index persistence

| Target | Where | Format |
|---|---|---|
| Desktop | `<appdata>/index/<workspaceHash>.idx` (or `.sqlite` if FTS5) | Whatever the engine needs; written atomically |
| Web | IndexedDB `smv` store `search-index`, or OPFS for large corpora | Serialised MiniSearch JSON, or a persisted OPFS SQLite |
| Mobile | App sandbox `files/index/` | Same |

Sizing, for 10,000 docs / 40 MB of Markdown: MiniSearch in-memory is roughly
**4–5× the corpus** (160–200 MB) — that is the number from FlexSearch's own
benchmark table, where MiniSearch's memory footprint for that corpus was ~4,777
units against Lunr's 2,443 and FlexSearch's 16, and those units are relative.
An FTS5 database for the same corpus is typically 25–60 MB, i.e. *comparable to
the source text*, which is the number that actually matters for disk.

**Conclusion that follows from the sizes:** on mobile and in the browser, a
persisted full index of a large workspace is a poor trade. Reinforces the §4.3
decision: native index on desktop only.

## 5. The indexing pipeline

```mermaid
flowchart TD
    subgraph INPUT["1 · Sources"]
        W["watch event"] --> DET["adapter.stat()"]
        DET --> STAMP{"contentHash changed?"}
        STAMP -->|no| DROP["drop"]
        STAMP -->|yes| READ["adapter.readBytes()"]
    end

    subgraph DECODE["2 · Decode"]
        READ --> ENC["core.encoding:<br/>BOM → UTF-8 validate → heuristic<br/>(UTF-16, opt-in legacy codepages)"]
        ENC --> TXT["text: string<br/>+ encoding + hadErrors"]
    end

    subgraph EXTRACT["3 · Extract (pure, in core)"]
        TXT --> AST["core.parse()"]
        AST --> META["core.searchdoc():<br/>title · headings · pathTokens · body"]
        AST --> TOC["core.outline()<br/>(cached for TOC + heading-scoped hits)"]
    end

    subgraph ANALYZE["4 · Analyse"]
        META --> TOK["tokenise:<br/>unicode61-ish, lowercase,<br/>keep CJK as bigrams"]
        TOK --> STOP["stopwords (en + zh)"]
        STOP --> STEM["stem (Porter2) — optional,<br/>toggle, hurts CJK"]
        META --> FACET["facets:<br/>mtime bucket · dir · size bucket"]
    end

    subgraph INDEX["5 · Index"]
        TOK --> UPSERT["upsert into index"]
        FACET --> UPSERT
        UPSERT --> ST{"engine"}
        ST -->|"desktop"| FTS5["SQLite FTS5 (rusqlite, bundled)<br/>bm25() · snippet() · prefix"]
        ST -->|"web / mobile"| MINIS["MiniSearch<br/>prefix · fuzzy · boost · filter"]
    end

    subgraph PERSIST["6 · Persist (debounced 5 s)"]
        FTS5 --> ATOMIC["write-temp + rename"]
        MINIS --> ATOMIC
        ATOMIC --> META2["meta: schemaVersion · corpusHash · docCount · builtAt"]
    end

    subgraph SERVE["7 · Serve"]
        META2 --> QUERY["core/search: query(index, request) → SearchHit[]"]
        QUERY --> VERIFY["verify existence of each result page<br/>(1 stat per file)"]
        VERIFY --> RANK["rank · snippet · highlight ranges"]
        RANK --> UI["virtualised result list"]
    end

    classDef pure fill:#e8f4ff,stroke:#3b82f6
    classDef idx fill:#fdf4ff,stroke:#a855f7
    class META,TOC,TOK,STOP,STEM,FACET,QUERY,RANK pure
    class FTS5,MINIS,ATOMIC idx
```text

Note the split of responsibilities: stages 2–4 are **pure functions in `core`**
(doc 02), so the indexer is a pure function of the document and can be tested in
Node with no filesystem at all. Only stage 1 touches an adapter and only stage 5
touches an engine. That is the payoff of the layering.

## 6. Phased plan

```mermaid
gantt
    dateFormat YYYY-MM-DD
    axisFormat %b %Y
    title Search rollout

    section Tier A — find in page
    Native accelerator wiring          :a1, 2026-11-16, 7d
    Built-in styled find bar          :a2, after a1, 20d
    Cross-block matching + source map :a3, after a2, 14d
    Match count + a11y pass           :a4, after a3, 7d

    section Tier B — cross-file
    Bounded walk in Rust/Worker       :b1, 2026-12-14, 14d
    Streaming results + progress      :b2, after b1, 10d
    Read cache (LRU + stamps)         :b3, after b2, 10d
    Filters + include/exclude globs   :b4, after b3, 7d
    Benchmarks on 1k/10k/50k corpora  :b5, after b4, 7d

    section Gate
    DECIDE: index or not (ADR-0007)   :milestone, g1, after b5, 0d

    section Tier C — conditional
    SQLite FTS5 engine + persistence  :c1, after g1, 20d
    Incremental update from watcher   :c2, after c1, 14d
    Stale-index handling + verify     :c3, after c2, 10d
    Ranking + facets + snippets       :c4, after c3, 14d
```

**The gate is the point of this chart.** `g1` is a real decision with a real
deadline, backed by `b5`'s benchmarks. If tier (b) answers a query in under
300 ms on a 10,000-file workspace, tier (c) does not get built — and the plan
above is how we avoid discovering that after writing 60 days of Rust.

### 6.1 Benchmark plan (must exist before the gate)

```ts
// packages/core/bench/search.bench.ts
const CORPORA = [
  { name: 'blog',       files: 200,   bytes: 1.6e6 },
  { name: 'docs',       files: 2_000, bytes: 12e6 },
  { name: 'vault-10k',  files: 10_000, bytes: 40e6 },
  { name: 'vault-50k',  files: 50_000, bytes: 220e6 },
  { name: 'pathological', files: 40, bytes: 90e6 },   // few huge files
];

// Measure: cold walk, warm walk (cache hit), cold read (page cache dropped),
// and p50/p95 per-keystroke latency while results stream.
// Gate criteria, to be agreed at g1:
//   tier B must keep p95 keystroke->first-result < 150 ms on docs
//   and complete a single-term query on vault-10k in < 2 s warm.
```text

## 7. Security considerations

Search touches untrusted files more than any other feature, because it *reads
them all*.

| Risk | Mitigation |
|---|---|
| Reading a huge file to serve one query | `MAX_SINGLE_FILE` (8 MiB), `maxBytesScanned` (256 MiB) hard stops, both surfaced in the UI |
| Regex DoS via user-supplied regex | No user regex in v1. If added: worker + step budget + 30 s wall clock |
| Memory exhaustion from the read cache | Hard byte caps per platform (doc 04 §3.1 style): 64/32/16 MiB desktop/web/mobile, LRU |
| Matching inside a hidden/binary region | Match against `core.plaintext()`, never against rendered HTML |
| Index poisoning via a crafted file | The index stores extracted text, not HTML. Rendering a search hit re-runs the full render pipeline; the index never produces DOM |
| Snippet leaking deleted content | A hit whose file is gone is filtered at query time by the verification stat (doc 04 §4.6) |
| Path traversal via a crafted relPath in a persisted index | `sanitizeRelPath` on load (doc 04 §4), and results are resolved through the adapter's `resolve()`, never string-joined |

## 8. Testing

```ts
describe('tier B scan', () => {
  it('finds matches with correct line/column/byteOffset', …);
  it('respects maxFilesScanned and emits truncated(max-files)', …);
  it('respects maxBytesScanned and emits truncated(max-bytes)', …);
  it('skips files containing NUL bytes', …);
  it('skips files larger than MAX_SINGLE_FILE', …);
  it('never follows a symlink out of the workspace', …);
  it('aborts within one file of AbortSignal', …);            // not "within 100ms"
  it('yields to the event loop at least every 16 ms', …);      // flaky in CI; generous bound
  it('is case-insensitive by default and exact when asked', …);
  it('honours includeGlobs/excludeGlobs', …);
  it('does not re-read a file whose stamp is unchanged (cache hit counter)', …);
});

describe('tier A find', () => {
  it('matches across a paragraph boundary', …);
  it('maps a plaintext match back to the correct source byte range', …);
  it('highlights without splitting nested inline elements incorrectly', …);
  it('does not highlight inside a collapsed tree node (there is none)', …);
  it('reports 0/N correctly and wraps around', …);
});

describe('index (when built)', () => {
  it('rebuilds deterministically from the same corpus', …);   // same contentHash
  it('reports stale rather than returning hits for deleted files', …);
  it('detects a corrupt index and rebuilds instead of crashing', …);
  it('reindexes on watch without a full re-scan', …);          // assert upsert count
});
```

## 9. Decision summary

| Question | Answer | Confidence |
|---|---|---|
| Tier (a) implementation | Own styled bar in `ui`, **plus** a native accelerator where the shell can reach one | High |
| Native find styling | Impossible — accept it, and provide ours as the default | High |
| Positional data requirement | Text must be addressable; the renderer must emit a position map from day one | High |
| Tier (b) shape | Bounded walk + streaming results + LRU read cache keyed by content stamp | High |
| Tier (b) limits | 20,000 files / 256 MiB / 8 MiB per file / 500 results, all surfaced | High |
| Where tier (b) runs | Rust thread on desktop, Worker on web/mobile, cancelled on mobile background | High |
| User regex | Not in v1 | High |
| Tier (c) timing | After a benchmark gate (ADR-0007), not before | High |
| Tier (c) engine | SQLite FTS5 via `rusqlite` `bundled`, desktop-only; MiniSearch elsewhere | Medium |
| Tier (c) rejected | Tantivy (native-only), Lunr (unmaintained), Fuse.js (not full-text), FlexSearch (slow cadence) | High |
| Stale-index behaviour | Filter by current `stat`, offer incremental re-index | High |
| Index identity | `contentHash` (doc 03) — one primitive, three uses | High |

## 10. What we still do not know

- **Q-31** — Do users want regex, field-scoped (`heading:foo`), or fuzzy search in
  v1? Each is a support-surface decision. Owner: product.
- **Q-32** — What is the real distribution of workspace sizes among our users?
  If the median is 200 files, tier (b) alone is provably sufficient and tier (c)
  is dead weight. Owner: product, via issues and support after v1.
- **Q-33** — Is MiniSearch's memory footprint acceptable on a low-end Android
  device, or does mobile need a different approach entirely? Owner: mobile.
- **Q-34** — What ranking do users expect? BM25 (relevant-looking) or
  path/recency (what I remember)? A hybrid weights are guessable and wrong often.
  Owner: product + UX research.
- **Q-35** — Does the tier-(c) gate belong at the end of Phase 1 or after Phase 2
  (web)? Phase 1 users are desktop-only, which is where the scale problem lives,
  which argues for deciding in Phase 1. Owner: project lead.

## 11. Sources

- MDN / WHATWG `window.find` and the deprecation/consistency situation;
  `showOpenFilePicker` availability (Chromium-only) — cross-referenced from
  doc 03 §1. Retrieved 2026-10-06.
- FlexSearch's published benchmark table (its own README, so vendor-produced and
  to be discounted) used only for the *relative memory* ratios: FlexSearch 16,
  MiniSearch 4,777, Lunr 2,443, Orama 5,355, bm25 33,963, Fuse 247,107 — a
  reminder that "fast query" and "small memory" trade off hard.
  `flexsearch` npm: 0.8.212, published Sep 2025.
- `minisearch` npm: 7.2.0, active; documents prefix, fuzzy, field boost, and
  filters — the feature set we would need from a JS fallback.
- `lunr` npm: 2.3.9, last publish ~5 years ago — the basis for rejecting Lunr.
- Orama: current marketing and feature set (full-text, vector, hybrid, filters,
  facets, BM25, stemming in 30 languages) plus its expansion into a commercial
  cloud product; basis for "capable but wrong shape for us".
- SQLite FTS5 documentation: `bm25()`, `snippet()`, `highlight()`, prefix indexes,
  and the `unicode61` tokenizer with `remove_diacritics`; feature-flag build
  requirement — **verify the `fts5` feature is present in the bundled SQLite from
  `rusqlite` at implementation time.**
- `rusqlite` 0.40.x release notes (bundled SQLite 3.53.2, MSRV 1.88) — cited for
  the build-complexity argument in §4.2.
- Tantivy: Rust full-text search library; **noted as native-only for our
  purposes** — no maintained WASM production path as of 2026-10-06.
- GitHub `chokidar` README, for the atomic-write and debounce behaviour that the
  index's incremental-update path depends on.
