# 04 · Workspace and Persistence

**Question.** What is a workspace, what is in it, where does it live on each
platform, do we need a database, and why is sync out of scope?

**Short answer.** A workspace is a persisted, versioned JSON document describing
one folder's UI state, written atomically and validated on load. **JSON, not
SQLite, until search indexing forces the issue.** Sync is explicitly deferred,
with the reasons written down so nobody "just adds it" in v2.

---

## 1. What is in a workspace

A workspace is **UI and session state for one folder**. It is emphatically *not*
a database of the documents, *not* a search index, and *not* a copy of your
files. If it were deleted tomorrow, the app would reopen the folder with default
state and lose nothing of value.

```ts
// packages/ui/src/workspace/schema.ts
export interface WorkspaceState {
  /** Bump on every breaking schema change; migrate() handles the rest. */
  schemaVersion: 3;

  /** Adapter-local stable id. Never a path, never a global UUID. */
  id: string;
  /** Display name. The folder's basename, or "Untitled" for OPFS. */
  name: string;
  /** Opaque handle, serialized per-adapter. See doc 03 §2. */
  handle: SerializedWorkspaceHandle;
  readonly: true;

  open: {
    /** Ordered tab strip. Last element is the active one. */
    documents: OpenDocumentRef[];
    activeIndex: number;
    /** Layout mode: single | split-v | split-h | grid */
    layout: 'single' | 'split-v' | 'split-h' | 'grid';
  };

  tree: {
    /** Expanded directory paths, workspace-relative, '/' separated. */
    expanded: string[];
    /** Sort order for the sidebar. */
    sort: 'name' | 'modified' | 'added' | 'size';
    sortDirection: 'asc' | 'desc';
    /** Files the user pinned to the top of the sidebar. */
    pinned: string[];
    /** Collapsed by the user (distinct from "not yet visited"). */
    collapsed: string[];
    /** Width of the sidebar in px. */
    sidebarWidth: number;
  };

  view: {
    /** Per-document scroll offsets, by relPath. */
    scroll: Record<string, { top: number; anchor?: string }>;
    /** TOC/heading outline expansion state, by relPath → collapsed heading ids. */
    outlineCollapsed: Record<string, string[]>;
    /** Zoom factor. 1 = 100%. */
    zoom: number;
    /** Column width of the rendered document in px, for "fit" and "fixed" modes. */
    contentWidth: number;
    /** Current theme id, or 'system'. */
    theme: string;
    /** Syntax highlighting theme id, or 'system'. */
    codeTheme: string;
  };

  recent: WorkspaceRecent[];      // see §2
  search: {
    lastQuery: string;
    /** Filters the user had applied: include/exclude globs, case, regex. */
    filters: SearchFilters;
  };

  /** Bookmarks the user created inside this workspace. */
  bookmarks: Bookmark[];

  /** Free-form per-workspace settings bag, namespaced to avoid collisions. */
  meta: Record<string, unknown>;
}

export interface OpenDocumentRef {
  /** Workspace-relative path. The identity we use everywhere above the adapter. */
  relPath: string;
  /** Byte offset the user was at, for restore-on-open. */
  anchorOffset?: number;
  /** Editor mode the user last chose: 'view' | 'edit'. */
  mode: 'view' | 'edit';
  /** Last known content hash, used to skip a re-render if nothing changed. */
  lastHash?: string;
}

export interface WorkspaceRecent {
  relPath: string;
  lastOpenedAt: number;    // epoch ms
  durationMs?: number;     // how long it was in the foreground, accumulated
}

export interface Bookmark {
  id: string;
  relPath: string;
  /** Byte range, or a heading anchor. */
  span?: { start: number; end: number };
  headingAnchor?: string;
  label?: string;          // defaults to the heading text or a 40-char excerpt
  createdAt: number;
}
```

### 1.1 Deliberately excluded

| Excluded | Why |
|---|---|
| Document *content* | The file is the source of truth. A workspace that could be out of date with the files is a liability, not a feature. |
| Search index | Separate concern, separate file, separate lifecycle (doc 05). |
| Editor undo history | Undo history is per-session and dies with the process. Reconstructing it from a JSON file is a research project. |
| Settings | Settings are global, not per-workspace, and they belong to the *user*, not the *folder*. Separate file. |
| Permissions/grants as a capability list | Grants are re-validated every session (doc 03 §10). Caching a "yes" is how you get silent data loss. |

### 1.2 Sizing

`expanded` and `scroll` are the fields that grow. Realistic bounds:

- `expanded`: ≤ 2,000 entries ≈ 120 KB worst case for a pathological tree.
- `scroll`: one entry per open document, not per file ever opened. ≤ 100 entries.
- `bookmarks`: unbounded in principle. **Cap at 500 per workspace** and warn.

So: a workspace file is realistically **under 200 KB**, and we hard-cap the
serialized document at 1 MB. Past that, we drop `scroll` first, then the
oldest `recent`, then oldest `bookmarks`, and we tell the user once.

## 2. Recent files — global, not per-workspace

Recent files are a cross-workspace list. They belong in the global settings
file, keyed by adapter + workspace id:

```ts
export interface RecentEntry {
  adapterId: string;
  workspaceId: string;
  workspaceName: string;
  relPath: string;
  lastOpenedAt: number;
  totalDurationMs: number;
  /** Best-effort; may be stale after the folder is deleted. */
  title?: string;
}
```

Cap at 200 entries, LRU by `lastOpenedAt`. Purge on startup any entry whose
workspace can no longer be resolved, because showing a recent file that no
longer exists is worse than not showing it.

## 3. Where it lives on each platform

| Target | Location | How written |
|---|---|---|
| Windows | `%APPDATA%\Siyana\MarkdownViewer\workspaces\<hash>.json` (Roaming — settings follow the user) | `write_atomic` via `crates/smv-fs` |
| Linux | `$XDG_STATE_HOME/siyana-markdown-viewer/workspaces/<hash>.json` (falls back to `~/.local/state`) | same |
| Web | IndexedDB, database `smv`, store `workspaces`, keyed by `workspaceId` | `idb` tx; `structuredClone` of the handle into the same record |
| Android | App-private storage: `filesDir/workspaces/<hash>.json` (internal, not scoped-storage-visible) | `write_atomic` via the Rust shell |
| iOS | `Application Support/workspaces/<hash>.json`, excluded from iCloud backup with `NSURLIsExcludedFromBackupKey` | same |

Note the Linux choice of **`XDG_STATE_HOME`** rather than `XDG_CONFIG_HOME`.
Per the XDG base directory spec, *config* is "configuration data the user wants
to back up or transfer" and *state* is "data that should persist across
reboots but is not important enough to back up". Workspace state is the latter.
Settings are the former.

The `<hash>` is a stable hash of `adapterId + workspace identity` so that
renaming a workspace file is not a migration event.

### 3.1 Web persistence detail

The File System Access handle must be stored in IndexedDB to survive a reload —
this is the documented pattern and Chromium supports structured-cloning
`FileSystemFileHandle`/`FileSystemDirectoryHandle`. Two rules:

```ts
// On load, ALWAYS re-check permission. Never trust a stored handle.
export async function restoreWorkspace(stored: WorkspaceState) {
  const adapter = new FsaAdapter();
  const handle = await adapter.resolve(decodeHandle(stored.handle));
  if (!handle) return { kind: 'stale', reason: 'grant-revoked', stored };
  return { kind: 'ok', workspace: stored, handle };
}

// 'prompt' means: we still have the handle, but the user must click something
// to re-grant. That click is a UX moment, not an error.
if (perm === 'prompt') return { kind: 'needs-gesture', stored };
```

A stale workspace is **kept on disk**, marked stale, and shown greyed out in the
workspace switcher with a "Reconnect" button. Deleting the user's state because
a permission lapsed is unforgivable.

### 3.2 Size limits — verified

The web side is where quota bites. Per MDN (updated Jan 2026):

| Storage | Limit |
|---|---|
| `localStorage` / `sessionStorage` | 10 MiB total across all browsers; 5 MiB local + 5 MiB session per origin |
| Firefox IndexedDB, best-effort | min(10% of profile disk, **10 GiB** group limit) |
| Firefox IndexedDB, persistent (`navigator.storage.persist()`) | 50% of disk, capped at 8 TiB, exempt from the group limit |
| WebKit (Safari) | up to 80% of disk for browser apps; **20% of disk for non-browser apps that display web content** |
| Chromium | 60% of total disk, shared pool across origins |

Consequences for our design:

1. **Workspace JSON belongs in IndexedDB, not `localStorage`.** Our 200 KB
   worst case is fine either way, but `localStorage` is synchronous and blocks
   the main thread on every read and write. IndexedDB is async. With a
   200 KB string, a synchronous `localStorage` write is a visible hitch.
2. **Request persistent storage explicitly**, once, at first launch, with a
   plain-language prompt. In Firefox this shows a notification asking permission;
   in Safari and Chromium it is granted or denied based on site interaction
   without a prompt. Getting `persist()` means eviction under disk pressure stops
   being a data-loss event.
3. **Handle `QuotaExceededError` on every IndexedDB write.** If we hit quota we
   must degrade (drop the search cache, keep the workspace) and tell the user —
   never silently swallow it.
4. **OPFS is not IndexedDB.** For cached file *content* on the web we would use
   OPFS (`navigator.storage.getDirectory()`), which is a real filesystem in the
   sandbox and is subject to the same quota family.

## 4. Writing and reading: never trust the file

Three failure modes for a state file:

1. **Corrupt** (crash mid-write, disk error, a user editing it in a text editor).
2. **Stale schema** (downgrade: the user runs an old build against a new state file).
3. **Hostile** (someone hand-crafts a state file to exploit our parser).

```ts
// packages/ui/src/workspace/persist.ts
import { z } from './schema';   // hand-rolled validator; zero deps on purpose

const MAX_BYTES = 1024 * 1024;

export async function loadWorkspace(
  read: () => Promise<Uint8Array | null>,
  opts: { appVersion: string },
): Promise<LoadResult> {
  const bytes = await read();
  if (!bytes) return { kind: 'absent' };
  if (bytes.length > MAX_BYTES) return { kind: 'corrupt', reason: 'too-large' };

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { kind: 'corrupt', reason: 'not-json' };
  }

  // Migration first: old schema in, current schema out.
  let v = readInt(raw, 'schemaVersion') ?? 0;
  if (v > CURRENT_SCHEMA_VERSION) {
    // Downgrade. Do NOT attempt to interpret a future schema.
    return { kind: 'future', found: v, ours: CURRENT_SCHEMA_VERSION };
  }
  while (v < CURRENT_SCHEMA_VERSION) {
    raw = MIGRATIONS[v](raw);
    v++;
  }

  // Validate EVERY field. Never trust; never partially apply.
  const parsed = validateWorkspace(raw);
  if (!parsed.ok) {
    // Salvage what we can rather than losing the whole workspace.
    return { kind: 'corrupt', reason: parsed.errors.join(', '), salvaged: salvage(parsed.input) };
  }
  return { kind: 'ok', workspace: parsed.value, warnings: parsed.warnings };
}
```

Field-by-field validation with coercion, not `JSON.parse` and hope:

```ts
function validateWorkspace(raw: unknown): Result<WorkspaceState, string[]> {
  const errors: string[] = [];
  const v = asRecord(raw);

  // Numbers: bounded. A corrupted scrollTop of 1e308 must not reach the DOM.
  const zoom = clampNum(v.zoom, 1, 0.5, 3);
  if (zoom !== v.zoom) errors.push('zoom out of range, clamped');

  const sidebarWidth = clampNum(v.tree?.sidebarWidth, 300, 120, 800);

  // Strings: length-bounded, control-char-stripped.
  const pinned = (arrOf(v.tree?.pinned, MAX_PATH_LEN) as string[])
    .map(sanitizeRelPath)                     // no '..', no leading '/', no NUL
    .filter((s): s is string => s !== null);

  // Arrays: capped. An index of 10 million entries means corruption.
  const expanded = arrOf(v.tree?.expanded, MAX_PATH_LEN).slice(0, 2_000);

  // Never allow the state file to name a file outside the workspace.
  // This is the whole reason open[].relPath is validated at load, not trusted.
  const documents = arrOf(v.open?.documents, 64)
    .map(d => sanitizeRelPath(asString(d?.relPath, 512)))
    .filter((s): s is string => s !== null);

  return errors.length && !hardErrors
    ? { ok: false, errors, input: raw }
    : { ok: true, value: { /* …coerced… */ }, warnings: errors };
}
```

`relPath` validation is a **security boundary**, not a nicety. If a
hand-crafted state file can put `"../../../.ssh/id_rsa"` into
`open.documents[0].relPath`, and any code path joins that onto a workspace root
and reads it, we have a local file disclosure bug. Three defences:

1. `sanitizeRelPath` rejects `..` segments, absolute paths, drive letters,
   NUL bytes, and anything over 512 chars — at load.
2. The adapter resolves via `relativePath(ws, handle)`, not string joining, so
   the workspace root is a capability (doc 03 §2).
3. A path that survives 1 but fails 2 is a bug in the adapter and is covered by
   the adapter contract test "walk never escapes the workspace".

### 4.1 Write policy

```ts
export class WorkspaceWriter {
  private pending: WorkspaceState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastWrittenHash: string | null = null;

  /** Coalesced, debounced, never on the hot path. */
  schedule(state: WorkspaceState, reason: WriteReason) {
    this.pending = state;
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(reason); }, 800);
  }

  /** MUST be called on: window close, beforeunload, visibilitychange→hidden,
   *  app suspend (mobile), and before any workspace switch. */
  async flushNow() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } await this.flush('forced'); }

  private async flush(reason: WriteReason) {
    if (!this.pending) return;
    const bytes = encodeCapped(this.pending);
    const hash = blake3_128(bytes);
    if (hash === this.lastWrittenHash) return;   // nothing changed; do not churn disk
    await writeAtomic(bytes);                     // temp + rename
    this.lastWrittenHash = hash;
    telemetry('workspace-written', { bytes: bytes.length, reason });
  }
}
```

Four rules:

1. **Debounce 800 ms and coalesce.** Scroll position changes fire constantly.
2. **Skip identical writes.** Hash-compare before writing. A workspace file
   whose mtime changes every second is a workspace file that ends up in
   `~/.local/share` backups and sync tools' conflict folders.
3. **Always write atomically.** Same temp-in-same-dir + rename as documents.
4. **Flush on the lifecycle events.** `beforeunload` alone is not reliable
   (mobile kills apps without it). `visibilitychange → hidden` and the mobile
   `onPause`/`willResignActive` hooks are the ones that actually fire.

### 4.2 Backup and recovery for state

A state file is small and trivially backed up, so:

- Write `workspaces/<hash>.json.bak` containing the previous good version
  *before* overwriting. Keep exactly one. This costs 200 KB and turns "state
  file corrupt" from a support ticket into a non-event.
- On load failure of the primary, try the `.bak`.
- If both fail, start a fresh workspace and **offer** the corrupt file's path
  in the error so a technical user can recover their state by hand.

## 5. Do we need SQLite?

The honest answer: **no for v1, and here is the decision rule.**

### 5.1 The options

| Option | What it is | Platform matrix |
|---|---|---|
| JSON file (chosen) | One atomic text document per workspace | Works everywhere, trivially |
| `better-sqlite3` | Synchronous, compiled Node addon | Node/桌面 only. **No WASM without a build step, no mobile, no web.** |
| `tauri-plugin-sql` | Official Tauri plugin, `sqlx` under the hood, sqlite/mysql/postgres | Windows/Linux/macOS/Android. **No iOS** per the plugin's own support table (2.4.0). |
| `rusqlite` | Direct Rust SQLite bindings, `bundled` feature compiles SQLite from source | Everywhere Rust runs, including iOS and Android. `bundled` also gives us SQLCipher if we ever want encryption-at-rest. |
| `sql.js` / `@sqlite.org/sqlite-wasm` | SQLite compiled to WASM | Web only. Async-persistence support differs by wrapper; you must explicitly export to OPFS/IndexedDB or you lose data. |

Note the trap: `tauri-plugin-sql` does not support iOS (per the plugin's own
documentation, v2.4.0), and it uses `sqlx` rather than `rusqlite`. If we adopt
SQLite we almost certainly want `rusqlite` **directly in the Rust shell**, not
through the Tauri plugin, because we need iOS and we want `bundled` for a known
SQLite version.

### 5.2 The decision rule

> **Move from JSON to SQLite when we need a query that is not a full scan of a
> document we already hold in memory — specifically, when tier-(c) search
> (doc 05) needs an on-disk inverted index or when the workspace grows enough
> that loading the whole state costs more than 16 ms.**

Until then, JSON wins on every axis:

| Axis | JSON | SQLite |
|---|---|---|
| Platform coverage | 100% | Desktop + mobile via `rusqlite`; web needs WASM + explicit persistence plumbing |
| Schema evolution | A migration function; humans can read and fix the file | Migrations work but the file is no longer hand-editable or diffable |
| Debuggability | `cat`, `jq`, `git diff` | A binary blob |
| Crash safety | temp + rename is atomic and trivially correct | WAL, checkpoints, and a corrupt-DB recovery story |
| Performance at our scale | Sub-ms parse of 200 KB | Sub-ms too — no advantage |
| Dependency risk | Zero | `rusqlite` compiles C; MSRV and build complexity (`rusqlite` 0.40 raised its floor to Rust 1.88 while bundling SQLite 3.53) |
| Recovery when it breaks | Read the file | Restore from backup, or hope WAL replay covers it |

`rusqlite` is genuinely excellent and its bundled SQLite tracks upstream closely
(bundled SQLCipher 4.14.0 in the 0.40 line). But we would be adding a
native-code dependency, a second storage engine, and a second failure mode to
store a few hundred kilobytes of UI state. That is a bad trade at 200 KB and a
fine trade at 200 MB.

### 5.3 The migration path, if we take it

Design the schema so migration is mechanical:

```sql
-- v4, if we ever get here
CREATE TABLE workspace_meta (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  schema_version INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE doc_state (
  workspace_id TEXT NOT NULL, rel_path TEXT NOT NULL,
  anchor_offset INTEGER, mode TEXT NOT NULL, last_hash TEXT,
  scroll_top REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, rel_path)
) WITHOUT ROWID;
CREATE TABLE tree_state (
  workspace_id TEXT NOT NULL, rel_path TEXT NOT NULL,
  expanded INTEGER NOT NULL, pinned INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, rel_path)
) WITHOUT ROWID;
CREATE VIRTUAL TABLE search_index USING fts5(
  rel_path UNINDEXED, heading, body,
  tokenize = 'unicode61 remove_diacritics 2'
);
```

Two notes on the schema: `WITHOUT ROWID` is correct for these
(primary-key-lookup) tables and halves the storage; and the FTS5 tokenizer
`unicode61 remove_diacritics 2` is the right default for CJK-plus-Latin mixed
content — `remove_diacritics 2` also folds non-spacing marks that
`unicode61` alone leaves behind.

**Write the JSON schema so it can be mechanically translated to these tables**:
flat maps of `relPath → small record`, no nesting deeper than two, no arrays
inside arrays, no polymorphism. That is already true of `WorkspaceState`, which
is why this migration is cheap to have *available* without paying for it.

## 6. Sync: explicitly out of scope for v1

### 6.1 Why not

The reason is not effort. The reason is that **sync forces you to decide the
file format is stable, and it is not stable yet.**

| Reason | Detail |
|---|---|
| **No server, no auth, no accounts** | A sync backend is an always-on service with a database, a deployment pipeline, backups, incident response, and a privacy policy. Our entire value proposition is "no account, your files never leave your machine". Shipping sync undercuts the thing people chose us for. |
| **The Markdown files are shared with non-app users** | This is the killer. Our users' `.md` files are also read by GitHub, Obsidian, VS Code, `cat`, a blog engine, and a colleague's editor. **The file format is therefore a public contract we do not control and must not break.** Any sync design that requires a private envelope (CRDT state, encrypted sidecar, a database of ops) cannot be the only way our users' files work. |
| **Conflict resolution is its own research project** | See doc 03 §6.2. Line-based 3-way merge is wrong for Markdown; AST-aware merge has no practical inverse; CRDTs are correct and change the file format. None of these is "just merge". |
| **We cannot test it honestly** | Sync bugs are data loss. To test conflict resolution you need two clients, two orders of operations, a network that lies, and adversarial interleavings. A one-person team cannot fuzz that adequately while also shipping a Markdown viewer. |
| **Storage quota and lifecycle** | Where does the encrypted blob live? In the workspace next to the files? Then it is a new thing users must back up, and it is in `.gitignore` debates forever. In app data? Then a user moving to a new machine has to find and copy it. Both are bad. |

### 6.2 What a future sync design would have to handle

Written down so that whoever attempts it does not rediscover this from scratch,
and so that v1's data structures do not accidentally preclude it.

**1. Source of truth: the Markdown file. Always.**

No design may make a private format authoritative. Consequences:
- The Markdown file must always be complete and readable on its own.
- Any sync metadata lives *beside* it (a sidecar) or *inside* it as comments
  (which pollute the user's file — bad) or in a central store (which needs a
  server).
- Therefore the realistic options are: (a) whole-file last-writer-wins with
  content-hash-based conflict detection, or (b) a CRDT whose checkpoint format
  is itself valid Markdown.

**(2) CRDT vs last-writer-wins.**

| | Last-writer-wins (LWW) | CRDT (Yjs / Automerge / Loro) |
|---|---|---|
| Silent data loss | **Yes**, and it is the normal outcome | No |
| Concurrent edits | Unresolvable without user interaction | Merged, but can produce text neither human wrote |
| File stays plain Markdown | ✅ Yes | ❌ No — Yjs writes a binary update blob |
| Offline-first | ✅ | ✅ |
| Server requirement | Small (blob store + hash) | Larger (auth, room management, compaction) |
| Realistic for us in v1 | ✅ | ❌ |

Our recommendation for a *future* v3+, if it happens: **whole-file LWW with
mandatory conflict copies.** When two devices write the same file, keep both —
the winner on disk, the loser as `name.md.siyana-conflict-<device>-<ts>.md`
with a header comment explaining where it came from. It is simple, it is
honest, it never loses data, and it keeps the file format pure. It is *not*
great for collaborative editing, and we should say so plainly if we ever ship it.

**(3) Ordering.** Conflict detection needs a total order per file. `mtime` is
unreliable across devices (clock skew, different filesystems' granularity —
FAT is 2 s). Content-addressed versioning (store `blake3(content)` as the
version id) removes the clock dependency entirely and makes detection
content-based, which is the same primitive we already built for external-edit
detection in doc 03 §6. **That reuse is a genuine architectural argument for
using content hashes everywhere, and it is why doc 03 chose them.**

**(4) Tombstones.** Deleting a file must propagate, and a delete must not be
resurrected by a device that had not seen it. Minimum viable: a tombstone entry
`{ relPath, deletedAt, deletedByDevice }` with a retention window (say 30 days)
kept server-side. Without tombstones, "restore from trash" on one device
un-deletes on every device.

**(5) Identity.** Is a document identified by path or by content?
- By **path** (what the filesystem says): renames are deletes + creates, so a
  rename on device A becomes "deleted on A, created on A" for device B, and if
  B also created a file at that path, you get a spurious conflict.
- By **content hash**: robust to renames, but then two genuinely different
  documents with identical content are indistinguishable (usually harmless) and
  *editing* always looks like a delete+create, which is worse.
- Practical answer: **path within a workspace identity**, with a
  `movedFrom` hint recorded on the write so renames can be detected heuristically
  (same content hash, one delete + one create in the same sync window).

**(6) Ordering of operations must be idempotent.** Every sync write must be
`PUT /files/{relPath}` with the full content plus a base hash, and the server
must reject a write whose `baseHash` is not the current version — returning
`409` with the current version. That makes the whole thing a compare-and-swap
loop with no CRDT and no op log, which is ~200 lines of server.

**(7) Encryption.** Per-workspace keys, client-side, so the server is as dumb as
a blob store. Key management (passphrase vs device key vs key file) is a UX
design problem, not an engineering one, and it needs user research.

**(8) Selective sync.** Large workspaces will not fit on a phone. Needs
per-workspace opt-in, per-directory exclusions, and a clear "not synced" badge.

### 6.3 What v1 must *not* do that would make future sync harder

Cheap to observe now, expensive to fix later:

- **Do not** write private data into the user's `.md` files (no injected YAML
  ids, no hidden HTML comments with sync ids). Keep our formats in sidecar
  files with a clearly documented name (`foo.md.siyana-workspace.json`).
- **Do not** assume we can change the on-disk extension list. `.md`, `.markdown`,
  `.txt` forever.
- **Do not** store mtime as anything other than a display hint.
- **Do** keep content hashes everywhere, even though nothing in v1 needs them
  cross-device. They cost ~16 bytes and they are what makes a future sync
  content-based rather than clock-based.

## 7. Security considerations for persisted state

| Threat | Mitigation |
|---|---|
| Path traversal via a hand-edited state file | `sanitizeRelPath` at load; adapter resolves via capability not string join; contract test |
| Local privilege escalation via a state file that names a system path | Above. Plus: never persist the workspace handle as a bare path in the *state* file on desktop — persist it separately, in a file only the user can write, and validate that the workspace id matches |
| Resource exhaustion via a huge state file | 1 MB hard cap, read fully into memory before parsing, reject before `JSON.parse` |
| Prototype pollution via `JSON.parse` output | Use `Object.create(null)` for parsed maps, or an explicit field-by-field copy. **Never spread a parsed object into a target object.** |
| Sensitive content leaking into logs | Log `relPath` and byte counts only. Never log `buffer`. Never log `bookmarks[].label` (it is a quote of the user's document) |
| Crash-dump / swap-file exposure of `buffer` in recovery files | Recovery files are in app data, not next to user docs; documented; deleted on save; we do not read them ourselves except on launch |

The prototype-pollution note is worth belabouring because it is the classic
JSON-state bug:

```ts
// ❌ NEVER
const next = { ...JSON.parse(await read()), sidebarWidth: 420 };

// ✅
const raw = JSON.parse(await read());
const next = {
  schemaVersion: CURRENT,
  tree: { expanded: arrOf(raw.tree?.expanded), pinned: sanitizeAll(raw.tree?.pinned) },
  // …explicit, field by field
};
```

## 8. Testing

```ts
describe('workspace persistence', () => {
  it('rejects a state file with schemaVersion > current without crashing', …);
  it('clamps zoom to [0.5, 3] and reports a warning', …);
  it('drops any open document whose relPath escapes the workspace', …);
  it('truncates expanded[] at 2000 entries', …);
  it('falls back to .bak when the primary is corrupt JSON', …);
  it('migrates v1 → v2 → v3 through every registered migration', …);
  it('never writes twice when the state hash is unchanged', …);
  it('flushes on visibilitychange→hidden', …);
  it('salvages bookmarks when the tree section is corrupt', …);
  it('a 1 MB+ state file is rejected without allocating 1 GB', …);
  it('does not prototype-pollute via a "__proto__" key in meta', …);
});
```

Property tests worth having:

```ts
it('any WorkspaceState survives a save/load round trip unchanged', (state) => {
  const bytes = encode(state);
  const back = load(encode(load(bytes).workspace)).workspace;
  expect(back).toEqual(state);
});

it('load never throws for any byte input', (bytes) => {
  expect(() => load(bytes)).not.toThrow();
});
```

## 9. Decision summary

| Question | Answer | Confidence |
|---|---|---|
| What is a workspace | Persisted per-folder UI/session state, versioned JSON | High |
| Storage format | **JSON**, one file per workspace, atomically written, hash-deduped | High |
| Validation | Field-by-field coercion + path sanitisation; never trust; always back up | High |
| Location | `%APPDATA%` / `$XDG_STATE_HOME` / IndexedDB / app sandbox | High |
| `.bak` | Yes, one generation, always | High |
| SQLite | **No in v1.** Rule: adopt when a non-linear-memory query is needed (tier-c search) or state > 16 ms to load | High |
| SQLite *how*, if adopted | `rusqlite` with `bundled`, directly in the Rust shell — **not** `tauri-plugin-sql` (no iOS support, uses `sqlx`) | Medium-high |
| Web storage | IndexedDB, not `localStorage` (sync); request `navigator.storage.persist()`; handle `QuotaExceededError` | High |
| Sync | **Out of scope for v1.** Reasons recorded in §6.1 | High |
| Future sync shape | Whole-file LWW + mandatory conflict copies + CAS loop; content-hash versioning; sidecar metadata only | Medium |
| CRDT | Rejected: changes the file format, which our users share with everyone else | High |

## 10. What we still do not know

- **Q-26** — Do users actually want per-workspace bookmarks, or is that a
  notepad with extra steps? Owner: product, via support/issue data after v1.
- **Q-27** — Should the workspace file be written on *every* scroll settle, or
  only on close? (We chose debounced with flush-on-hide; unvalidated by users.)
- **Q-28** — Is `navigator.storage.persist()` worth a permission prompt in
  Firefox, given that 10 GiB best-effort is already a lot for a workspace file?
  Owner: web.
- **Q-29** — When tier-(c) search lands, does it force SQLite, or does a
  persisted JSON inverted index survive long enough? The decision rule in §5.2
  needs a benchmark either way. Owner: search.
- **Q-30** — Should the workspace state file be committed to the user's notes
  folder so it travels with git? (`foo.md.siyana-workspace.json` next to the
  file, gitignored by default.) Tempting; causes merge conflicts in git. Owner:
  product.

## 11. Sources

- MDN, *Storage quotas and eviction criteria* (page last modified 5 Jan 2026):
  localStorage/sessionStorage 10 MiB total, 5 MiB + 5 MiB per origin; Firefox
  best-effort min(10% of profile disk, 10 GiB group limit), persistent 50% of
  disk capped at 8 TiB; WebKit 80% of disk for browser apps and 20% for
  non-browser apps that display web content; earlier Safari behaviour starts at
  1 GiB and prompts for more in 200 MB increments. Retrieved 2026-10-06.
- MDN, *Storage API* (`navigator.storage.estimate()`), and *The Storage
  Standard* concept of config vs state. Retrieved 2026-10-06.
- `@tauri-apps/plugin-sql` 2.4.0 npm page and `plugins-workspace` v2 docs —
  platform table shows Windows/Linux/macOS/Android supported, **iOS not**, and
  the plugin requires Rust ≥ 1.77.2 and uses `sqlx`. Retrieved 2026-10-06.
- `rusqlite` release notes (0.39.0 → 0.40.2): bundled SQLite 3.53.2, bundled
  SQLCipher 4.14.0, "Lower MSRV to 1.88.0", and a `SAVEPOINT` SQL-injection fix
  in 0.40.1 — cited as evidence that a native SQLite binding is a real supply
  chain dependency. Retrieved 2026-10-06.
- SQLite FTS5 `unicode61` tokenizer options (`remove_diacritics 2`) — standard
  SQLite documentation; **verify the exact option spelling against the bundled
  SQLite version at implementation time.**
- Android Developers, *App data and files* (private app storage is not
  affected by scoped storage) — basis for the Android workspace location.
- Apple, `NSURLIsExcludedFromBackupKey` / Application Support guidance.
  Retrieved 2026-10-06.
- Content-hash-as-version reasoning, cross-referenced from doc 03 §6 — the
  primitive already exists, which is what makes a future CAS-based sync a small
  change rather than a rewrite.
