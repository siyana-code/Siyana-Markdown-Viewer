# 03 — Filesystem safety

> The app's job is to read one file the user chose. Everything else on the disk
> is out of scope, and the code that enforces that is small, boring, and must
> be exactly right.

---

## 1. The contract

The filesystem adapter is the only component allowed to touch the disk on the
renderer's behalf. Its contract:

```ts
interface FsAdapter {
  /** Pick files/directories. The only way a path enters the system. */
  open(options: OpenOptions): Promise<PickedPath[]>;

  /** Read a Markdown document, with every validation applied. */
  readDocument(path: string): Promise<ReadResult>;

  /** Write a document. User-initiated only. Atomic. */
  writeDocument(path: string, bytes: Uint8Array): Promise<void>;

  /** List a directory for the file tree. Depth- and count-capped. */
  list(dir: string, opts: ListOptions): Promise<Entry[]>;

  /** Watch for changes. Bounded events. */
  watch(paths: string[], onChange: (p: string) => void): Promise<WatchHandle>;
}
```

**Every path that enters the system goes through `readDocument` or a picker.**
There is no "render this path the frontend already had." A path that reached us
from the renderer is attacker-controlled for the purposes of this document, even
if our own code produced it, because the renderer is the untrusted side of
boundary 4.

## 2. Path traversal, and the Windows special cases

### 2.1 The rule

> **Canonicalize first, then check containment. Never check containment on the
> unresolved string.**

CWE-22 says the same thing:

> "Use a built-in path canonicalization function (such as `realpath()` in C)
> that produces the canonical version of the pathname, which effectively removes
> `..` sequences and symbolic links."
> — <https://cwe.mitre.org/data/definitions/22.html>

```ts
import { realpath } from 'node:fs/promises';
import path from 'node:path';

/**
 * Returns the resolved real path, or null if it is not a regular file.
 * Throws only for programming errors.
 */
async function resolveRealFile(candidate: string): Promise<{ real: string; st: Stats } | null> {
  if (candidate.length > 4096) return null;
  // Strip NUL explicitly: the OS rejects it, but a truncation *before* the
  // rejection is a classic bypass ("ok.txt\0../../../etc/passwd").
  if (candidate.includes('\0')) return null;

  let real: string;
  try {
    real = await realpath(candidate);
  } catch {
    return null;                       // ENOENT, EACCES, ELOOP, ENAMETOOLONG
  }

  const st = await lstat(real);        // NOT stat: we resolved, so this is the target
  if (!st.isFile()) return null;       // never a directory, device, fifo, or socket

  return { real, st };
}

function isInside(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
```

`path.relative` returning a non-`..`-prefixed, non-absolute value is the correct
containment test, because it is computed on two already-canonical paths.
Comparing string prefixes (`candidate.startsWith(root)`) is the classic bug:
`/home/user-evil` starts with `/home/user`.

`lstat` vs `stat` after `realpath` is a subtle but important detail. `realpath`
has already followed symlinks, so `stat` and `lstat` on its result agree for
regular targets — but `lstat` is correct-by-construction if the platform's
`realpath` has any edge behaviour, and it lets us *detect* a final symlink if we
additionally `lstat` the original.

### 2.2 The layered defence

Path resolution is checked at four levels. All four, because each catches a case
the others miss.

```ts
async function readDocument(candidate: string, roots: ReadonlySet<string>): Promise<ReadResult> {
  // ── Level 1: shape ──────────────────────────────────────────────────
  if (candidate.length > 4096 || candidate.includes('\0')) throw new DocError('bad path');

  // ── Level 2: canonicalize + regularity ──────────────────────────────
  const r = await resolveRealFile(candidate);
  if (!r) throw new DocError('not a file');
  const { real, st } = r;

  // ── Level 3: containment in a root the user opened ──────────────────
  if (![...roots].some(root => isInside(real, root))) throw new DocError('outside roots');

  // ── Level 4: extension allowlist ────────────────────────────────────
  const ext = path.extname(real).toLowerCase();
  if (!ALLOWED_MD_EXT.has(ext)) throw new DocError('bad extension');

  // ── Size, before allocation ─────────────────────────────────────────
  if (st.size > MAX_DOCUMENT_BYTES) throw new DocError('too large');

  const bytes = await readFile(real);

  // ── TOCTOU: did it change under us? ────────────────────────────────
  const st2 = await stat(real);
  if (st2.size !== st.size || st2.mtimeMs !== st.mtimeMs || st2.ino !== st.ino) {
    throw new DocError('changed while reading');   // caller retries, bounded
  }

  return { real, bytes, mtimeMs: st.mtimeMs };
}
```

Level 4 deserves an explicit justification, because someone will ask why an
extension check is needed on top of containment. Two reasons:

1. **The user opened a *directory*, not the whole disk.** A user opening
   `~/Downloads` has `~/Downloads/report.pdf` inside an allowed root. Rendering a
   PDF as Markdown is silly; rendering `.env` or `.ssh/id_rsa` that happen to sit
   in a shared directory is a leak of something the user did not mean to expose
   to a document renderer.
2. **It is a cheap second gate on the decode path.** Even if containment is wrong,
   an attacker needs a file whose *extension* is on the list to get bytes out.

The counter-argument is real: users have Markdown in `.mdx`, `.markdown`,
`.txt`, `.text`, `.qmd`, `.rmd`, and unnamed files. So the allowlist is generous
and the *refusal* is specific and explained: "not a recognised text/Markdown
extension — open it anyway?" with an explicit per-file consent that is **not**
persisted as a blanket grant.

### 2.3 The Windows-specific attacks

Windows has four path features that make naive checks fail. All four are in the
CWE catalogue with dedicated entries.

**1. NTFS Alternate Data Streams.** Every NTFS file has a `:$DATA` stream.
OWASP: "Since they are difficult to find they are often used by hackers to hide
files on machines that they've compromised."
<https://owasp.org/www-community/attacks/Windows_alternate_data_stream>

```
notes.md::$DATA                 # the default stream — same file, different spelling
notes.md:hidden.txt             # a completely separate hidden file
\\?\C:\path::$DATA
```

CWE-69: "Improper Handling of Windows `::DATA` Alternate Data Stream."
<https://cwe.mitre.org/data/definitions/69.html>

A filter that blocks `..` but not `:` will happily read `notes.md:secret.txt`.
And a *deny list* keyed on extension is defeated by appending a stream: a file
blocked as `config.json` is readable as `config.json::$DATA`.

This is not theoretical. [CVE-2026-53571](https://www.sentinelone.com/vulnerability-database/cve-2026-53571)
is a Vite dev-server `server.fs.deny` bypass on Windows using exactly
`::$DATA` suffixes and 8.3 short names, exposing `.env` and certificate files.

Mitigation: reject any path component containing `:` on Windows, except the
drive-letter colon at index 1. Then canonicalize. Note that
`path.win32.normalize` does **not** strip ADS — it treats `:` as part of a
filename.

**2. 8.3 short filenames.** `PROGRA~1` is `Program Files`. A deny list or an
exact-path comparison that does not resolve short names can be bypassed by using
the short form, or bypassed *against* you if you canonicalize and then compare
against a string the user typed in short form.

CWE-58: "Path Equivalence: Windows 8.3 Filename."
<https://cwe.mitre.org/data/definitions/58.html>

Mitigation: canonicalization resolves short names on most platforms; the
containment check must run on the *resolved* path, never on the user's string.
CVE-2026-53571's fix "resolves Windows 8.3 short names before applying
`server.fs.deny` checks" — that is the pattern.

**3. UNC paths and device paths.**

```
\\server\share\file.md      # UNC; may carry NTLM credentials to an attacker server
\\.\PhysicalDrive0          # device path; raw disk access
\\?\C:\Windows\System32\... # extended-length prefix, bypasses MAX_PATH normalization
\\.\GLOBALROOT\Device\...   # namespace escape
```

CWE-40: "Path Traversal: `\UNC\share\name` (Windows UNC Share)."
<https://cwe.mitre.org/data/definitions/40.html>

Mitigations:

- **Reject `\\`** at the start of any path that did not come from the user's own
  picker. A user who genuinely needs a document on a network share picks it
  through the native dialog, which produces an absolute path we then canonicalize
  and check against the roots they opened.
- **Reject `\\?\`, `\\.\`, and `\\??\`** unconditionally, before canonicalization.
- The UNC-credential leak deserves its own note: opening a UNC path in a Windows
  process can send the user's NetNTLM hash to the attacker's server. This is
  [CWE-200](https://cwe.mitre.org/data/definitions/200.html)-adjacent and is a
  genuine risk for any app that resolves document-controlled paths. Rejecting
  UNC in document-controlled paths removes it.

**4. Drive-relative paths.** `C:notes.md` means "notes.md relative to the current
directory *on drive C*", not a path rooted at C. CWE-39:
"Path Traversal: `C:dirname`."
<https://cwe.mitre.org/data/definitions/39.html>

Mitigation: reject any path where a colon appears anywhere other than index 1 on
Windows, before canonicalization.

### 2.4 The complete rejection rules

```ts
function isSafeCandidatePath(p: string): boolean {
  if (p.length === 0 || p.length > 4096) return false;
  if (p.includes('\0')) return false;                       // truncation
  if (process.platform === 'win32') {
    if (/[:]/.test(p.slice(2))) return false;               // ADS (CWE-69)
    if (/^\\\\/.test(p)) return false;                      // UNC / device (CWE-40)
    if (/^\/\/[?.]/.test(p)) return false;                  // \\?\ and \\.\ explicitly
    if (/^[A-Za-z]:[^\\/]/.test(p)) return false;           // drive-relative (CWE-39)
  }
  return true;
}
```

This is a **shape** filter, applied before canonicalization. It does not replace
canonicalization and containment — it removes inputs where canonicalization is
unreliable or has side effects (UNC credential transmission). Two layers for two
different jobs.

### 2.5 Payload corpus

Every one of these must be refused, and the test asserts the error class:

| Payload (as `![](…)` or as a file argument) | Expected |
|--------------------------------------------|----------|
| `../../../../.ssh/id_rsa` | `outside roots` |
| `..%2f..%2f..%2fetc/passwd` | decoded, then `outside roots` |
| `..\..\..\Windows\win.ini` | `outside roots` |
| `/etc/shadow` | `outside roots` (absolute) |
| `file:///C:/Users/victim/.aws/credentials` | refused (we never honour `file:`) |
| `C:\Users\victim\.ssh\id_rsa` | `outside roots` |
| `C:notes.md` | refused (`bad path`) |
| `notes.md::$DATA` | refused (`bad path`) |
| `notes.md:hidden` | refused (`bad path`) |
| `\\server\share\x.png` | refused (`bad path`) |
| `\\.\PhysicalDrive0` | refused (`bad path`) |
| `\\?\C:\Windows\notepad.exe` | refused (`bad path`) |
| `PROGRA~1\…` (inside an allowed root) | fine — canonicalization resolves it |
| `%c0%ae%c0%ae/` (overlong UTF-8 dot-dot) | decoded once, then `outside roots` |
| `....//....//etc/passwd` (CWE-33) | `outside roots` |
| `..;/..;/etc/passwd` (Tomcat-style, harmless here) | treated as a literal filename, not found |
| a 3 KB path of `../` repeated | refused (`bad path`, length) |
| `\0` anywhere | refused (`bad path`) |
| a **symlink** inside an allowed root pointing outside | `outside roots` (realpath resolves first) |
| a **junction** on Windows pointing outside | `outside roots` |
| a path with `\\?\` prefix that resolves inside | refused (`bad path`) — we do not support the extended form |

CWE has entries for the multi-dot and separator variants: CWE-33
([`....`](https://cwe.mitre.org/data/definitions/33.html)), CWE-34
([`....//`](https://cwe.mitre.org/data/definitions/34.html)), CWE-35
([`.../...//`](https://cwe.mitre.org/data/definitions/35.html)), CWE-36
([`/../filedir`](https://cwe.mitre.org/data/definitions/36.html)), CWE-24
([`../filedir`](https://cwe.mitre.org/data/definitions/24.html)).

## 3. Symlinks, junctions, and directory walk loops

### 3.1 Following is sometimes correct, following blindly is never

Two operations with opposite correct answers:

- **Reading a user-picked document:** follow symlinks. Users symlink their notes
  directory and expect it to work. The safety property is that the *resolved*
  target must still be inside an opened root.
- **Walking a directory to build a file tree:** follow symlinks **with a loop
  detector**, or refuse to follow them. A notes folder may legitimately contain a
  symlink into another notes folder.

### 3.2 Loop detection

A two-line loop causes an infinite walk, unbounded memory, and a hung app:

```
~/notes/a/link -> ~/notes
```

The detection is a visited-set of `(dev, ino)` pairs:

```ts
async function* walk(dir: string, budget: WalkBudget): AsyncGenerator<Entry> {
  const seen = new Set<string>();          // "dev:ino"
  const stack: Array<{ dir: string; depth: number }> = [{ dir, depth: 0 }];

  while (stack.length > 0) {
    const { dir, depth } = stack.pop()!;

    if (depth > budget.maxDepth) { report('max depth reached'); continue; }
    if (budget.entriesSeen >= budget.maxEntries) { report('truncated'); break; }
    if (budget.bytesSeen >= budget.maxBytes) { report('truncated'); break; }

    const key = await inodeKey(dir);
    if (seen.has(key)) { report('loop skipped'); continue; }
    seen.add(key);

    for (const e of await readdirSafe(dir)) {
      budget.entriesSeen++;
      if (++budget.bytesSeen > budget.maxBytes) break;
      yield { name: e.name, path: join(dir, e.name), depth };

      if (e.isDirectory) {
        stack.push({ dir: join(dir, e.name), depth: depth + 1 });
      } else if (e.isSymlink) {
        // Resolve before deciding: a symlink to a file is included as a file;
        // a symlink to a directory is followed, and the inode check above
        // catches a loop on the next iteration.
        const t = await statOrNull(join(dir, e.name));
        if (t?.isDirectory()) stack.push({ dir: join(dir, e.name), depth: depth + 1 });
      }
    }
  }
}

interface WalkBudget { maxDepth: 6; maxEntries: 50_000; maxBytes: 512 * 1024 * 1024; entriesSeen: number; bytesSeen: number; }
```

`maxDepth: 6` and `maxEntries: 50_000` are not arbitrary; they are the point at
which a user with more files than that is better served by search than by a tree,
and at which the walk is definitely a bug rather than a preference. Truncation is
**reported in the UI**, not silent.

### 3.3 Windows junctions and hard links

On Windows, `DirEntry.isSymbolicLink()` is false for a **junction** in some Node
versions, so the symlink branch never fires and the walk follows the junction.
Mitigations:

- Always `stat` (which follows) to decide directory-ness, never trust the dirent
  type alone. Then the inode check catches loops regardless of how the traversal
  got there.
- Hard links cannot be detected at all: two directory entries, one inode. The
  inode `seen` set prevents walking the same directory twice, which is the
  property we actually need.

### 3.4 Symlink attacks during read

A symlink can be swapped between `realpath` and `read`:

```bash
while :; do rm -f /tmp/x.md; ln -s ~/.ssh/id_rsa /tmp/x.md; sleep 0.01; done
```

Mitigations, in order of effectiveness:

1. **Open first, then check the opened handle.** On Linux, `open(path, O_RDONLY |
   O_NOFOLLOW)` refuses to open a symlink at the final component. On Windows, use
   `FILE_FLAG_OPEN_REPARSE_POINT` and check for reparse points. This closes the
   final-component race entirely.
2. **Compare inode after open.** `fstat(fd).ino === expected_ino`. If a swap
   happened, the inode differs and we reject. Available via
   `fs.promises.open()` + `fh.stat()`.
3. **`O_PATH` + `openat`**, for the directories in a walk. Linux-specific; the
   `openat`-relative pattern is the correct answer for a fully race-free walker,
   and Node does not expose it, so this needs a small native module.

```ts
async function readDocumentRaceFree(candidate: string, roots: ReadonlySet<string>) {
  const r = await resolveRealFile(candidate);
  if (!r) throw new DocError('not a file');
  if (![...roots].some(root => isInside(r.real, root))) throw new DocError('outside roots');
  const ext = path.extname(r.real).toLowerCase();
  if (!ALLOWED_MD_EXT.has(ext)) throw new DocError('bad extension');
  if (r.st.size > MAX_DOCUMENT_BYTES) throw new DocError('too large');

  const fh = await open(r.real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const st = await fh.stat();
    if (!st.isFile()) throw new DocError('not a file');
    // The handle refers to what we validated, not to what the name points at now.
    if (st.ino !== r.st.ino || st.dev !== r.st.dev) throw new DocError('changed while reading');
    const bytes = await fh.readFile();
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocError('too large');
    return { real: r.real, bytes, mtimeMs: st.mtimeMs };
  } finally {
    await fh.close();
  }
}
```

`O_NOFOLLOW` on the **final** component only. Interior symlinks are followed —
which is correct, because canonicalization already resolved them and the
containment check was done on the resolved path.

**Residual risk:** a race on an *interior* directory component remains possible on
Linux without `openat`. This is documented in
[15-open-questions](../15-open-questions/) as an accepted, low-probability,
low-impact residual (the attacker must already have local write access to a
directory inside an opened root, at which point they could just write the file
directly).

## 4. Permissions errors

`EACCES`, `EPERM`, and `EROFS` are ordinary outcomes, not exceptions to route to
a crash reporter.

```ts
export function explainFsError(e: NodeJS.ErrnoException, path: string): DocError {
  switch (e.code) {
    case 'ENOENT':   return { code: 'not-found',    hint: 'The file was moved or deleted.' };
    case 'EACCES':
    case 'EPERM':    return { code: 'denied',       hint: 'Permission denied. Check the file\'s permissions.' };
    case 'EISDIR':   return { code: 'is-directory', hint: 'That is a folder, not a file.' };
    case 'ELOOP':    return { code: 'symlink-loop', hint: 'Too many symbolic links in the path.' };
    case 'ENAMETOOLONG': return { code: 'name-too-long', hint: 'The path is too long.' };
    case 'ENOTDIR':  return { code: 'not-a-dir',    hint: 'A path component is not a directory.' };
    case 'EMFILE':
    case 'ENFILE':   return { code: 'too-many-open', hint: 'Too many open files. Close some documents.' };
    case 'ENOMEM':   return { code: 'out-of-memory', hint: 'Out of memory.' };
    case 'ETIMEDOUT':return { code: 'timeout',      hint: 'The network share did not respond.' };
    case 'EROFS':    return { code: 'read-only',    hint: 'The disk is read-only.' };
    default:         return { code: 'io-error',     hint: e.message ?? 'I/O error.', technical: true };
  }
}
```

Three properties this table encodes:

- **No absolute paths in the hint unless the user chose the path.** Showing
  `C:\Users\victim\.ssh\` in a toast for a failed traversal is a small
  information leak into the UI, and the UI may be screen-shared. We show the
  basename and the directory the *user* opened.
- **A network share timing out is a first-class state**, not an error toast. UNC
  paths mean the file may live on a machine that is asleep.
- **`ELOOP` gets its own message** because it is a real and confusing condition
  for users with symlink chains, and "permission denied" would send them down the
  wrong debugging path.

## 5. TOCTOU and concurrent modification

### 5.1 What editors actually do

Four patterns, and only one of them is dangerous:

| Pattern | Example | What we observe |
|---------|---------|-----------------|
| **Truncate-then-write** | `fopen(path, "w")` | A **partial file**. `# Half-writ` renders as a valid-looking short document |
| **Write-temp-then-rename** | VS Code, JetBrains, git | Either the old file or the new one. **Never a mix.** This is the good pattern |
| **Lock file** | `.~lock.notes.md#`, `notes.md~`, `.notes.md.swp`, `4913` (Vim) | An extra file appears; the document itself is stable |
| **Append** | log files | Growing `size` |

The dangerous combination is: the user saves with the first pattern, our
watcher fires mid-write, and we then **write back** what we read. That destroys
user data. Mitigation: we never write to a document the user did not explicitly
ask us to modify, and we write atomically (§9).

### 5.2 The read loop

```ts
export async function readStable(path: string, opts: {
  roots: ReadonlySet<string>;
  attempts?: number;
  settleMs?: number;
} = {}): Promise<ReadResult> {
  const attempts = opts.attempts ?? 4;
  const settleMs = opts.settleMs ?? 120;

  let lastErr: DocError = { code: 'io-error', hint: 'Unknown error.' };
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(settleMs * i);          // linear backoff, bounded
    try {
      return await readDocumentRaceFree(path, opts.roots);
    } catch (e) {
      lastErr = explainFsError(e, path);
      // Only these are worth retrying: the file is being written right now.
      if (lastErr.code !== 'io-error' && lastErr.code !== 'timeout') throw lastErr;
    }
  }
  throw { ...lastErr, hint: `${lastErr.hint} The file may be being saved by another program.` };
}
```

Four attempts with linear backoff totalling ~1.2 s covers every real editor
write. A slow network share gets its own longer timeout path.

### 5.3 Debouncing the watcher

Raw `fs.watch` fires several events per save, and on Linux it can fire for
accesses, not just writes.

```ts
export class DocumentWatcher {
  #pending = new Map<string, NodeJS.Timeout>();
  #handles: FSWatcher[] = [];

  watch(paths: string[], onChange: (p: string) => void) {
    for (const p of paths) {
      const w = watch(p, { persistent: false }, () => this.#schedule(p, onChange));
      this.#handles.push(w);
    }
    return { dispose: () => { this.#handles.forEach(h => h.close()); } };
  }

  #schedule(p: string, onChange: (p: string) => void) {
    clearTimeout(this.#pending.get(p));
    this.#pending.set(p, setTimeout(() => {
      this.#pending.delete(p);
      onChange(p);                       // then readStable() handles stability
    }, 250));
  }
}
```

250 ms debounce coalesces the multi-event burst of a single save. Beyond that,
`readStable` handles the rest. The two mechanisms are complementary and both are
needed; debouncing alone leaves the race, and retrying alone fires five reads
per save.

### 5.4 Atomic-rename detection

The write-temp-then-rename pattern changes the inode. Detecting it lets us skip a
pointless re-parse and, more importantly, lets us keep the old content on screen
until the new one is fully read:

```ts
const before = await stat(path);
const result = await readStable(path, { roots });
if (result.mtimeMs !== before.mtimeMs) {
  // The file was replaced between our stat and our read; the result is the
  // newer one, which is correct. Nothing to do, but note it in the log.
}
```

The rename also breaks `fs.watch` on the *path*: watching a file that gets
replaced by rename requires watching the **directory**, not the file. On Linux,
`inotify` follows the inode and drops the watch when the file is replaced. So the
watcher watches directories and filters:

```ts
// Watch directories; filter to the files we care about. This is the only
// pattern that survives atomic-rename editors.
watch(parentDirOf(doc), (event, filename) => {
  if (filename && openPaths.has(join(parentDirOf(doc), filename.toString()))) {
    onChange(join(parentDirOf(doc), filename.toString()));
  }
});
```

## 6. Encoding detection: you may not assume UTF-8

### 6.1 The rule

> Never call `TextDecoder('utf-8')` on the first 4 KB and assume the answer.

The correct algorithm is **BOM first, then statistical detection, then UTF-8
with replacement, and tell the user what we chose.** This is the order that
produces the fewest surprises, because a BOM is unambiguous and everything else
is a guess we make honestly.

### 6.2 The algorithm

```ts
export interface DecodeResult {
  text: string;
  encoding: string;         // the name we used, for the status bar
  confidence: 'certain' | 'high' | 'low' | 'assumed';
  hadBom: boolean;
  hadInvalidBytes: boolean;
  newline: 'lf' | 'crlf' | 'cr' | 'mixed';
  bytesRead: number;
  truncated: boolean;
}

export function decodeDocument(bytes: Uint8Array): DecodeResult {
  // ── 1. BOM: the only certain signal ────────────────────────────────
  const BOMS: Array<[Uint8Array, string]> = [
    [new Uint8Array([0xEF, 0xBB, 0xBF]), 'utf-8'],       // UTF-8 BOM
    [new Uint8Array([0xFF, 0xFE, 0x00, 0x00]), 'utf-32le'],// UTF-32LE BOM
    [new Uint8Array([0x00, 0x00, 0xFE, 0xFF]), 'utf-32be'],// UTF-32BE BOM
    [new Uint8Array([0xFF, 0xFE]), 'utf-16le'],          // UTF-16LE BOM
    [new Uint8Array([0xFE, 0xFF]), 'utf-16be'],          // UTF-16BE BOM
  ];

  for (const [bom, enc] of BOMS) {
    if (startsWith(bytes, bom)) {
      const text = new TextDecoder(enc).decode(bytes.subarray(bom.length));
      return finish(text, enc, 'certain', true, bytes.length);
    }
  }

  // ── 2. Heuristic: the NUL-byte distribution ────────────────────────
  //    UTF-16LE ASCII text is "h\0e\0l\0l\0o\0"; UTF-16BE is "\0h\0e\0l\0l";
  //    UTF-32 has three NULs per ASCII char. UTF-8 and Latin-1 have none.
  if (looksLikeUtf32Le(bytes)) return finish(decodeStrict(bytes, 'utf-32le'), 'utf-32le', 'high', false, bytes.length);
  if (looksLikeUtf32Be(bytes)) return finish(decodeStrict(bytes, 'utf-32be'), 'utf-32be', 'high', false, bytes.length);

  const nuls = countByte(bytes.subarray(0, SNIFF), 0x00);
  if (nuls > SNIFF * 0.05) {
    // NULs present, and they are not a UTF-32 pattern: almost certainly UTF-16.
    const evenNuls = countEvenIndices(bytes.subarray(0, SNIFF), 0x00);
    const enc = evenNuls > nuls / 2 ? 'utf-16le' : 'utf-16be';
    return finish(decodeStrict(bytes, enc), enc, 'high', false, bytes.length);
  }

  // ── 3. UTF-8 validity over the sniff window ────────────────────────
  const fatal = new TextDecoder('utf-8', { fatal: false });
  const probe = fatal.decode(bytes.subarray(0, SNIFF));
  if (!probe.includes('\uFFFD')) {
    return finish(fatal.decode(bytes), 'utf-8', 'high', false, bytes.length);
  }

  // ── 4. UTF-8 with replacement, and say so ──────────────────────────
  //    Replacement characters are visible to the user; silently producing them
  //    is how mojibake becomes everyone's problem.
  const lossy = fatal.decode(bytes);
  return finish(lossy, 'utf-8', 'low', false, bytes.length, /* hadInvalidBytes */ true);
}
```

`SNIFF` is 64 KB — long enough for a 16-bit-statistics detection to be
confident, short enough that a wrong guess on the first byte does not ruin the
whole document.

### 6.3 What "strict" means for UTF-16

`decodeStrict` on a UTF-16 candidate uses `{ fatal: true }`; if it throws, we
fall back to lossy UTF-8 with a warning rather than returning nothing:

```ts
function decodeStrict(bytes: Uint8Array, enc: string): string {
  try {
    return new TextDecoder(enc, { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);   // lossy; caller reports it
  }
}
```

Guessing wrong about UTF-16 and then decoding as UTF-8 gives the classic
`H Texts ar htiPs at an Empty Loom` — every second character dropped, because
NUL bytes are being consumed as content. Getting this right is worth the whole
routine.

### 6.4 Latin-1 and friends

We do **not** attempt Latin-1/CP1252 detection. The reason is specific: a
Windows-1252 file containing a byte in the 0x80–0x9F range decoded as UTF-8
produces replacement characters, whereas decoded as CP1252 it produces the correct
`é` or `—`. But a file containing a few CJK UTF-8 sequences decoded as CP1252
produces mojibake, which is arguably worse than visible replacement characters.

Decision: UTF-8 with replacement, and **surface the replacement count in the UI**
("3 characters could not be decoded — re-save as UTF-8?"). Honest failure beats
confident wrongness.

```ts
const replacements = (text.match(/\uFFFD/g) ?? []).length;
if (replacements > 0) statusBar.showEncodingWarning(replacements);
```

### 6.5 Newlines

```ts
function detectNewline(text: string): 'lf' | 'crlf' | 'cr' | 'mixed' {
  let crlf = 0, lf = 0, cr = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 13) { if (text.charCodeAt(i + 1) === 10) { crlf++; i++; } else cr++; }
    else if (c === 10) lf++;
  }
  if (crlf && lf) return 'mixed';
  if (crlf) return 'crlf';
  if (lf) return 'lf';
  if (cr) return 'cr';
  return 'lf';
}
```

- **Bare CR** is old-Mac (pre-OS X) and also appears in files produced by some
  tools and by hand-crafted payloads. CommonMark 0.31.2 §2.1 treats line
  endings generically; a parser that does not accept bare CR will render such a
  file as one giant paragraph.
- **Mixed** is normal in files assembled from multiple sources and is not worth
  a warning, but it must not be normalized in a way that changes content
  positions.
- **Normalize before parsing**: `text.replace(/\r\n?/g, '\n')`. This keeps byte
  offsets for line numbers consistent across platforms and removes the CR from
  hard-break detection (CommonMark's two-trailing-spaces hard break, and the
  backslash hard break, both need a clean `\n`).
- **Preserve the original for writing.** When we save, we write back in the
  detected style, because a full-file line-ending change is a diff the user did
  not ask for.

### 6.6 Lone surrogates and invalid sequences

```ts
// Detect unpaired surrogates, which survive in JS strings and break
// toLowerCase(), the slugger regex, and URL encoding in different ways.
function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      i++;
    } else if (c >= 0xDC00 && c <= 0xDFFF) {
      return true;
    }
  }
  return false;
}
```

Where it bites, and the mitigation, is in
[05-rendering/01-ast-to-html.md §2.2](../05-rendering/01-ast-to-html.md#22-dedupe-precisely):
the heading slug is generated with `toLowerCase()` and a regex that only handles
surrogate pairs present in valid text. A lone surrogate produces an `id` the URL
parser will percent-encode, so a `#deep-link` will not match. Mitigation: strip
lone surrogates from the slug input before generating, and test with a fixture.

## 7. Very large files

### 7.1 Do not read-all by default

`readFile` on a 400 MB file is a 400 MB allocation, then a 400 MB string, then a
400 MB AST, then a DOM. Four copies, none of them needed.

```ts
const LIMITS = {
  /** Render directly. Above this, offer to open in "safe/large" mode. */
  inlineRenderBytes: 8 * 1024 * 1024,
  /** Hard refuse above this, with an explicit user override. */
  hardCapBytes: 256 * 1024 * 1024,
  /** Characters after which we warn about pathological structure. */
  warnChars: 2_000_000,
  /** Maximum AST node count. */
  maxNodes: 2_000_000,
  /** Maximum AST depth. */
  maxDepth: 256,
};
```

| Size | Behaviour |
|------|-----------|
| ≤ 8 MB | render normally |
| 8–64 MB | render with a progress indicator; offer "open in large-file mode" (virtualized, no search index) |
| 64–256 MB | **warn first**, show the size, require confirmation, then open in large-file mode only |
| > 256 MB | refuse; suggest an external editor |
| > `maxNodes` or `maxDepth` | stop parsing, render what parsed plus a clear diagnostic |

The warning is not decoration: a 200 MB file opened without consent is a
denial-of-service attack the user can *see happening*, which is a far better
outcome than an unresponsive window.

### 7.2 Streaming

For the large-file path we read in chunks and hand chunks to the parser, which
must therefore be an **incremental** parser. This is a real design constraint on
`packages/core`: the parser interface is chunk-in, events-out, and the AST
builder is the only stateful part.

```ts
async function* readChunks(path: string, size = 1 << 20): AsyncGenerator<Uint8Array> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.allocUnsafe(size);
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, size, null);
      if (bytesRead === 0) return;
      yield new Uint8Array(buf.subarray(0, bytesRead));
    }
  } finally {
    await fh.close();
  }
}
```

Chunk boundaries must be handled by the decoder, not by luck: a multi-byte UTF-8
sequence or a UTF-16 surrogate pair can straddle a chunk boundary. Use
`TextDecoder` with `{ stream: true }`, which buffers the partial sequence for you.
This is exactly the class of bug that produces the first 4 KB of a document
rendering correctly and the rest as mojibake.

## 8. Extensions, and the "not a Markdown file" question

```ts
const ALLOWED_MD_EXT = new Set([
  '.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn', '.mkdn', '.mdtxt', '.mdtext',
  '.text', '.txt',
  '.qmd', '.rmd',          // Quarto, R Markdown
  '.mdx',                  // JSX-flavoured Markdown — content will not render, but it is Markdown
  '.textile', '.org', '.wiki',   // not Markdown, but users put them in notes folders
]);
```

Two consequences of `'.txt'` being on the list, both accepted:

- A `.txt` file is rendered as Markdown. Some plain-text documents contain `<`
  and `&` in ways that look like HTML blocks. CommonMark type 7 requires "a
  complete open tag … followed by the end of the line", so most plain text is
  safe; and the sanitizer catches the rest.
- `.txt` is the extension attackers use least and users use often, so keeping it
  avoids a "my notes don't open" bug report.

A file with **no** extension is not refused outright; it is offered with an
explicit "this file has no extension — open it as Markdown?" prompt, and the
answer is remembered for that path only.

## 9. Atomic writes and temp files

### 9.1 The pattern

```ts
export async function writeDocument(target: string, bytes: Uint8Array, opts: {
  roots: ReadonlySet<string>;
  newline: 'lf' | 'crlf' | 'cr';
}): Promise<void> {
  // 1. Validate the target with the SAME rules as a read, plus write permission.
  const r = await resolveRealFile(target);
  if (!r) throw new DocError('not a file');
  if (![...opts.roots].some(root => isInside(r.real, root))) throw new DocError('outside roots');
  if (!ALLOWED_MD_EXT.has(path.extname(r.real).toLowerCase())) throw new DocError('bad extension');
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocError('too large');

  // 2. Preserve the mode/ACLs the user had.
  const mode = (await stat(r.real)).mode;

  // 3. Temp file in the SAME directory (same filesystem ⇒ rename is atomic),
  //    with O_EXCL so we never follow an existing symlink or clobber a
  //    pre-planted file.
  const dir = path.dirname(r.real);
  const tmp = path.join(dir, `.${path.basename(r.real)}.${randomBytes(8).toString('hex')}.tmp`);

  let fh: FileHandle;
  try {
    fh = await open(tmp, 'wx', mode & 0o777);
    await fh.writeFile(toNativeNewlines(bytes, opts.newline));
    await fh.sync();                       // durability before the rename
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  } finally {
    await fh?.close();
  }

  try {
    // 4. Atomic on POSIX and on Windows (ReplaceFileW semantics via rename).
    await rename(tmp, r.real);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}
```

Four things each prevent a distinct disaster:

| Choice | Prevents |
|--------|----------|
| `O_EXCL` (`'wx'`) | overwriting a file an attacker pre-created as a symlink to something sensitive; also prevents two instances clobbering each other's temp file |
| temp in the **same directory** | `rename` across filesystems is not atomic; `EXDEV` would silently degrade to a copy |
| `fh.sync()` before rename | a crash after the rename leaves a zero-length file (the classic "PowerPoint ate my file") |
| `mode & 0o777` | not silently widening a `0600` file's permissions to `0644`, which is a real information leak on a shared machine |

### 9.2 Temp file hygiene

- **Never** use the system temp directory for a temp file whose *content* is
  user data. On Linux `/tmp` is world-readable and sticky; on Windows `%TEMP%` is
  per-user but still a poor place for content the user did not ask us to spill.
  Same-directory temps (above) solve it.
- **Clean up on crash.** A `.notes.md.a1b2c3d4e5f6a7b8.tmp` left behind after a
  hard kill is harmless but confusing. On startup, sweep temp files matching our
  own naming pattern **that are older than 24 h** and that we can prove are ours
  (name prefix + a magic first line we write).
- **Do not delete temps we do not own.** A sweep must not race with a concurrent
  instance. Age threshold plus magic-byte check, and it logs what it removes.

### 9.3 No write path from document content

**This is the invariant, and it is worth stating as a rule rather than a
feature:** there is no path from a rendered Markdown document to a write. The
document cannot ask us to save, cannot name an output path, and cannot cause an
export without a user action on an explicit dialog.

Export writes to a path the user chose in a save dialog, and only there. Export
content comes from sanitized HTML
([05-rendering/05-export-and-print.md §4](../05-rendering/05-export-and-print.md#4-single-file-html-export)),
so a document cannot inject a path into a filename.

## 10. Concurrent editing and locking

### 10.1 Advisory locks

OS-level exclusive locks are cross-platform hostile: `flock` does not exist on
Windows, `LockFileEx` does not exist on Linux, and NFS and SMB behave differently
for both. The standard answer for an editor is **advisory** locking via a lock
file, and here is what that means concretely:

```
.notes.md.lock     # our own, contains pid + timestamp + hostname
```

```ts
export async function acquireLock(target: string): Promise<Lock | null> {
  const lockPath = path.join(path.dirname(target), `.${path.basename(target)}.lock`);
  try {
    const fh = await open(lockPath, 'wx');          // fails if it exists
    await fh.writeFile(`${process.pid}\n${Date.now()}\n${os.hostname()}\n`);
    await fh.close();
    return { path: lockPath, release: async () => { await unlink(lockPath).catch(() => {}); } };
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    return null;                                     // locked
  }
}
```

### 10.2 Stale locks

A lock file left by a crashed process blocks the user forever, which is worse
than no lock at all. A lock is stale if:

1. It is older than a threshold (say 30 s) **and**
2. Either the pid does not exist **or** the file has not been touched since we
   last refreshed it.

```ts
async function isStale(lockPath: string, maxAgeMs = 30_000): Promise<boolean> {
  let st: Stats;
  try { st = await stat(lockPath); } catch { return true; }   // gone ⇒ stale
  if (Date.now() - st.mtimeMs < maxAgeMs) return false;
  const [pidRaw] = (await readFile(lockPath, 'utf8')).split('\n');
  const pid = Number(pidRaw);
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try { process.kill(pid, 0); return false; }                  // alive ⇒ not stale
  catch (e: any) { return e.code === 'ESRCH'; }                // dead ⇒ stale
}
```

A live-process check is a heuristic on a remote share, and a pid check is
meaningless across machines — hence the mtime threshold as the primary signal and
the pid as a tiebreaker. Document that as a heuristic, not as a guarantee.

### 10.3 The honest position on multi-instance editing

A Markdown **viewer** does not need lock files at all. It needs them only if it
edits. So:

- **Read-only mode (v0.1): no locks, no write path, no problem.** Two instances
  reading the same file is completely fine and needs no coordination.
- **Editing mode: locks, plus a conflict banner, plus mtime-based staleness
  detection.** If the file changed on disk since we loaded it, show a banner
  ("This file changed on disk. Reload / Keep my version") and make the user
  choose. **Never silently overwrite and never silently reload.** Both destroy
  user work in the specific way that generates the worst bug reports.
- **No three-way merge in v0.1.** Reload-or-keep is honest and safe. A merge UI
  for Markdown is a project of its own and its own security surface.

## 11. Verification

| # | Test | Assert |
|---|-----|--------|
| 1 | The traversal corpus in §2.5 | every case refused with the stated error class |
| 2 | `isInside('/root-evil', '/root')` | `false` (the prefix bug) |
| 3 | Symlink inside root → `/etc/passwd` | `outside roots` |
| 4 | Symlink loop `a/link -> .` | walk terminates, reports "loop skipped" |
| 5 | Walk of a directory with 100 000 files | truncated at `maxEntries`, reports truncation |
| 6 | FIFO / socket / device node as the "document" | refused (`not a file`) |
| 7 | A file being written while we read | `readStable` returns complete content or throws `changed while reading`; never partial |
| 8 | Atomic-rename editor save | watcher still fires; content updates |
| 9 | `fs.watch` on a file replaced by rename | directory watch catches it |
| 10 | Write to a read-only file | `denied`, with the mode in the log |
| 11 | Write to a `0600` file | mode preserved |
| 12 | Pre-existing temp symlink | `O_EXCL` refuses; we do not write through it |
| 13 | Kill during write | no zero-length target file; a `.tmp` remains, swept after 24 h |
| 14 | Write across a filesystem boundary | `EXDEV` handled; no partial target |
| 15 | UTF-8 with BOM | BOM stripped; `hadBom` true; no `﻿` in the first heading |
| 16 | UTF-16LE with BOM | correct text, not `H Texts ar…` |
| 17 | UTF-16LE **without** BOM | detected by NUL distribution; correct text |
| 18 | UTF-16BE without BOM | detected; correct text |
| 19 | Latin-1 with `0x92` (curly quote) | replacement char shown; UI warns; text otherwise intact |
| 20 | Bare CR line endings | parsed as line breaks, not one paragraph |
| 21 | CRLF | normalized; written back as CRLF |
| 22 | Mixed endings | parsed correctly; warning shown; written back as detected |
| 23 | Lone surrogate in a heading | no crash; `id` is a valid fragment |
| 24 | Multi-byte char straddling a 1 MB chunk boundary | no replacement character at the boundary |
| 25 | 300 MB file | refused above the hard cap, with the size in the message |
| 26 | 10 MB file | large-file mode; progress; no OOM |
| 27 | UNC path | refused before any network access |
| 28 | A file on a disconnected share | timeout state, not a crash |
| 29 | Stale lock file with a dead pid | reclaimed |
| 30 | Live lock file | respected; no overwrite |

Tests 15–24 belong in a table-driven suite with fixture files checked into
`packages/test-fixtures/encoding/`, because they are all things that will
regress when someone upgrades a dependency's decoder.

## Sources

- MITRE CWE v4.8 catalogue — <https://cwe.mitre.org/data/published/cwe_v4.8.pdf>
- CWE-22 Path Traversal — <https://cwe.mitre.org/data/definitions/22.html>
- CWE-39 `C:dirname` — <https://cwe.mitre.org/data/definitions/39.html>
- CWE-40 `\UNC\share\name` — <https://cwe.mitre.org/data/definitions/40.html>
- CWE-58 Windows 8.3 Filename — <https://cwe.mitre.org/data/definitions/58.html>
- CWE-59 Link Resolution Before File Access / zip-slip —
  <https://cwe.mitre.org/data/definitions/59.html>
- CWE-61 UNIX Symbolic Link Following — <https://cwe.mitre.org/data/definitions/61.html>
- CWE-69 Windows `::DATA` Alternate Data Stream —
  <https://cwe.mitre.org/data/definitions/69.html>
- CWE-367 TOCTOU — <https://cwe.mitre.org/data/definitions/367.html>
- OWASP, Windows Alternate Data Streams —
  <https://owasp.org/www-community/attacks/Windows_alternate_data_stream>
- CVE-2026-53571, Windows path-deny bypass via ADS and 8.3 short names —
  <https://www.sentinelone.com/vulnerability-database/cve-2026-53571>
- WHATWG Encoding Standard (the authoritative decoding algorithm, including
  BOM handling and the replacement-character rule) —
  <https://encoding.spec.whatwg.org/>
- Unicode Standard Annex #50, UTF-16 in the UTF-8 encoding —
  <https://www.unicode.org/reports/tr50/>
- Node.js `fs` documentation (`realpath`, `open` with `O_NOFOLLOW`, `FileHandle`) —
  <https://nodejs.org/api/fs.html>
- CommonMark 0.31.2 §2.1 Characters and lines (line-ending definitions) —
  <https://spec.commonmark.org/0.31.2/#characters-and-lines>
