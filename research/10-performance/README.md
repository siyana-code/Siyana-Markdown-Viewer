# 10 — Performance

> Performance is not a phase. It is a **budget** that every feature spends from,
> and a **measurement** that tells us when we are out.

| # | Doc | What it answers |
|---|-----|-----------------|
| 01 | [large-files.md](01-large-files.md) | What breaks at 5 KB / 100 KB / 10 MB / 100 MB. Virtual scrolling, `content-visibility`, incremental parse |
| 02 | [rendering-pipeline-performance.md](02-rendering-pipeline-performance.md) | Where the milliseconds actually go: string vs DOM, layout thrashing, paint, fonts, highlighting |
| 03 | [memory-and-startup.md](memory-and-startup.md) | Shell RSS, content cost, profiling tools, leak hunting, cold vs warm start |

---

## The budgets

These are **targets**, not aspirations. They are chosen so that a machine that
can run Windows 11 comfortably is comfortably inside them, and a 2015-era
ultrabook on Ubuntu 22.04 with WebKitGTK 2.36 is not catastrophically outside
them.

Legend: ✅ VERIFIED (measured/benchmarked elsewhere, cited) · 🔧 RECOMMENDED
(our target, our judgement)

### 1. Startup

| Metric | Definition | Target | Measured how |
|--------|------------|--------|--------------|
| **Cold start → first paint** | `exec()` of the binary → first pixel of the window. **Page cache cold.** | **≤ 900 ms** on a 2019-class laptop; ≤ 400 ms on a 2023-class laptop | External wall-clock: `t0 = Date.now()` in the launcher, `t1` from a `performance.mark()` reported to the Rust side, which stamps a Unix epoch ms. Difference. 20 runs, median + p95. |
| **Warm start → first paint** | Same, but the OS page cache is warm | **≤ 450 ms** 2019-class; ≤ 200 ms 2023-class | As above, after one warm-up run, 20 alternating runs |
| **Framework-ready → first paint** | `Builder::setup` / `app.whenReady()` → first paint. This is *our* code's cost, excluding the webview process spawn | **≤ 120 ms** | Internal instrument, same epoch clock |
| **Restore-last-document** | Cold start *and* the previously open document is on screen | **≤ 1500 ms** cold, **≤ 700 ms** warm | Same, plus a mark after the document's first block is painted |

🔧 **Why "first paint" and not "window opened".** ✅ **VERIFIED** — an empty
window *"may seem fast, but the user expects content"*. A researcher's
conclusion, and the right one: *"Confusing the window opening with the content
loading"* is listed as a measurement mistake
([urhoba — Startup time comparison, 2026-09-24](https://www.urhoba.net/en/post/startup-time-comparison)).

🔴 **A warning we must internalise before choosing a framework.** ✅ **VERIFIED**,
same source, same date, same empty skeleton, Ubuntu 24.04.4 container, 2 vCPU,
8 GB RAM, **no GPU**, Xvfb 1280×800, WebKitGTK 2.52.6:

| Configuration | n | External (exec → first page loaded) | Internal |
|---|---|---|---|
| Electron 44.4.5 (Chromium 152.0.7977.130), default | 10 | **260 ms** (243–291) | 167 ms |
| Tauri 2.11.6, default | 10 | **798.5 ms** (772–853) | 770 ms |
| Electron, `--disable-gpu` | 5 | 234–253 ms | — |
| Tauri, `WEBKIT_DISABLE_COMPOSITING_MODE=1` | 5 | 735–776 ms | — |

*"In Tauri, the setup closure was reached within 130–175 ms. The bulk of the time
passed after this, during the startup of WebKit processes and the loading of the
page."* And the author's honest caveat: *"A container with no GPU and a virtual
screen does not represent a real desktop… Since Tauri uses WebView2
(Chromium-based) on Windows, the memory profile may be completely different. Do
not decide without measuring on your own target platforms."*

🔧 **Therefore our #1 performance deliverable before we build any features is our
own measurement harness on real hardware, both OSes.** The framework decision in
[08-desktop-frameworks](../08-desktop-frameworks/) rests on this, and we should
not pretend it can be decided from marketing pages.

### 2. Render

| Metric | Definition | Target | Measured how |
|--------|------------|--------|--------------|
| **Parse throughput** | Canonical text → block AST, in a worker | **≥ 40 MB/s** single-thread (≈ 250 ms/MB) | `packages/core/bench/parse.bench.ts` over the test corpus; `node --cpu-prof` to attribute time |
| **Parse to first visible block** | `openDocument()` → first block's pixels | **≤ 120 ms** for a 100 KB document | `performance.mark('parse:first-block')` + `requestAnimationFrame` |
| **Full document to screen (100 KB)** | All blocks in the DOM | **≤ 500 ms** | `performance.mark('parse:done')` + double-`rAF` |
| **Re-render on file change** | Watcher event → new pixels | **≤ 150 ms** (p95) for a 100 KB doc | Watcher timestamp → `rAF` timestamp |
| **Full document to screen (10 MB book)** | | **≤ 4 s**, with the first block visible at ≤ 150 ms | Same marks |
| **Scroll FPS** | Frames/sec while scrolling a 10 MB book | **≥ 55 fps p50, ≥ 45 fps p1** on 2019-class hardware | `PerformanceObserver` on `long-animation-frame` + a rAF-based FPS counter driven by wheel events; run on a throttled CI runner for regression detection |
| **Time to interactive after open** | User can scroll/click/type | **≤ 250 ms** | First frame with a trusted user event handler attached |
| **Keyboard→paint latency** | Keypress → pixel | **≤ 16 ms** (one frame) | `event.timeStamp` → `rAF` callback timestamp |

### 3. Memory

| Metric | Definition | Target | Measured how |
|--------|------------|--------|--------------|
| **Idle memory (shell only, empty app)** | Total RSS of the process tree after launch with no document, 60 s | **≤ 350 MiB** Windows (WebView2), **≤ 450 MiB** Linux (WebKitGTK 2.52+), **≤ 600 MiB** for the same on WebKitGTK 2.36 | See [03](03-memory-and-startup.md) — **sum the process tree, report RSS *and* PSS** |
| **Idle memory (shell + typical doc)** | Open a 100 KB technical doc, scroll to the end, wait 30 s | **≤ 550 MiB** | Same + DevTools heap snapshot to attribute the JS-side growth |
| **Memory ceiling (100 MB pathological file)** | Open the 100 MB generated file | **≤ 900 MiB**, and must not OOM on a 4 GB machine | Same, plus a "graceful degradation" assertion — see [01](01-large-files.md#25-engine-limits) |
| **Leak budget** | Idle RSS after 20 open/close cycles vs. after 1 | **Δ ≤ 5%** | Automated soak test in CI (nightly), fail on regression |
| **Steady-state after 8 h** | Same as above but 8 h | **Δ ≤ 10%** vs 1 h | Manual, pre-release |

### 4. Build and payload

| Metric | Target | Why |
|--------|--------|-----|
| Frontend bundle, initial (shell only) | **≤ 250 KB** gzipped | Everything else is lazy |
| Parser + highlighter + renderer (lazy chunk) | **≤ 400 KB** gzipped | Loaded after first paint |
| Cold-start blocking JS on the main thread | **≤ 30 ms total** | Everything else is deferred or in a worker |
| Number of long tasks (>50 ms) during startup | **0** | Verified in CI via `PerformanceObserver` |

---

## How each number gets measured

### The harness

🔧 **RECOMMENDED** — one harness, four entry points, results written as JSON to
`perf/results/<date>-<commit>.json`:

```text
packages/perf/
├─ runner.mjs            # orchestrates a full measurement run
├─ scenarios/
│  ├─ startup.mjs        # cold/warm, with and without a restored document
│  ├─ render.mjs         # parse → DOM → paint marks for 5 KB..100 MB
│  ├─ scroll.mjs         # FPS under programmatic scroll
│  └─ memory.mjs         # process-tree RSS/PSS sampling over time
├─ fixtures/             # symlinks into packages/test-fixtures/sizes/
└─ analyze.mjs           # median/p95, diff vs. the last recorded run, exit code
```text

### Startup measurement (external, not internal)

✅ **VERIFIED** — the correct methodology, and the specific reason internal
timing is insufficient: *"Internal measurement misses the time elapsed before the
framework's own startup. Therefore, the primary comparison should be the external
measurement"* ([urhoba](https://www.urhoba.net/en/post/startup-time-comparison)).

- **External**: the launcher records `Date.now()` immediately before `exec`.
  The app, at its own first-paint mark, writes a Unix epoch ms to stdout (or to
  `$LOG/session.log` on Windows — ✅ **VERIFIED**, *"since the release build on
  Windows does not open a console window… you must print these lines to a file
  instead of standard output"*). The runner subtracts.
- **Cold**: reboot, or on Linux
  `sync; echo 3 | sudo tee /proc/sys/vm/drop_caches` — ✅ **VERIFIED** warning:
  *"this command affects the entire system, so use it only on a test machine."*
- **n ≥ 20, alternating A/B, median + p95 + range.** ✅ **VERIFIED**: *"If you
  measure one entirely and then the other, a background task could skew the
  results of a single application."*
- **Always release builds.** ✅ **VERIFIED**: measuring `tauri dev` or
  `electron .` measures the dev server, not the product.

### Render measurement

```js
// The three marks that define "render".
performance.mark('doc:open:start');            // watcher/IPC handed us the text
performance.mark('doc:parsed');                // full block AST exists
performance.mark('doc:dom:inserted');          // all blocks are in the DOM
requestAnimationFrame(() => requestAnimationFrame(() => {
  performance.mark('doc:painted');             // two rAFs = the frame is on screen
  performance.measure('doc:open', 'doc:open:start', 'doc:painted');
}));
```

🔧 The **double-`rAF`** is not cargo cult: a single `rAF` runs *before* paint, so
one `rAF` measures "scheduled", not "visible". Two is the cheapest correct
proxy short of the compositor-callback API.

### Memory measurement

✅ **VERIFIED** — the single most important methodological point, and the one
almost everyone gets wrong: *"Both Electron and Tauri operate as multi-process.
If you only measure the main process, the result will be misleading. Always look
at the total of the process tree"*, and *"Settling for a single measurement. Take
at least five measurements and report the median and range"*
([urhoba — Measuring package size and memory usage, 2026-09-24](https://www.urhoba.net/en/post/measuring-package-size-and-memory-usage)).

That article's `bellek.sh` is close to what we need; here is ours, extended to
sample over time and to work on Windows:

```bash
#!/usr/bin/env bash
# perf/tree-rss.sh <seconds> <cmd...>   — Linux/macOS
wait_s=$1; shift
"$@" >/dev/null 2>&1 & root=$!
sleep "$wait_s"
tree() { echo "$1"; for c in $(pgrep -P "$1"); do tree "$c"; done; }
rss=0; pss=0; n=0
for p in $(tree "$root"); do
  [ -r "/proc/$p/smaps_rollup" ] || continue
  r=$(awk '/^Rss:/{print $2}' "/proc/$p/smaps_rollup")
  s=$(awk '/^Pss:/{print $2}' "/proc/$p/smaps_rollup")
  rss=$((rss+r)); pss=$((pss+s)); n=$((n+1))
done
echo "procs=$n rss_mib=$((rss/1024)) pss_mib=$((pss/1024))"
kill "$root" 2>/dev/null; wait "$root" 2>/dev/null
```text

```powershell
# perf/tree-rss.ps1 <seconds> <exe> — Windows
param([int]$WaitSeconds, [string]$Exe)
$p = Start-Process $Exe -PassThru
Start-Sleep -Seconds $WaitSeconds
$procs = @()
$frontier = @($p.Id)
while ($frontier.Count) {
  $next = @()
  foreach ($id in $frontier) {
    $procs += $id
    # ⚠️ include children whose parent chain reaches $p; msedgewebview2.exe is
    # shared with other apps, so filter by our userDataFolder on the cmdline.
    $next += (Get-CimInstance Win32_Process -Filter "ParentProcessId=$id").ProcessId
  }
  $frontier = $next
}
$procs | ForEach-Object {
  $pr = Get-Process -Id $_ -ErrorAction SilentlyContinue
  if ($pr) { [pscustomobject]@{ pid = $_; name = $pr.ProcessName; ws_MiB = [math]::Round($pr.WorkingSet64/1MB,1) } }
}
Stop-Process -Id $p.Id -Force
```

🔴 **The WebView2 filtering trap.** ✅ **VERIFIED** — *"In Tauri, WebView2
processes appear as `msedgewebview2.exe`. Keep in mind that if you filter by this
name, you might also count processes of other applications using WebView2"*. On
Windows we must set a **per-app `userDataFolder`** so WebView2 spawns processes
with a distinguishable `--user-data-dir`, and filter on that. Otherwise our memory
numbers are contaminated by every other Tauri app the machine has ever run.

### Budget enforcement

🔧 **RECOMMENDED** — a perf budget that is not enforced in CI is a wish.

| Job | When | Gate |
|-----|------|------|
| `perf/startup` | every PR, throttled runner | Warm start p95 ≤ 600 ms (CI runner has no GPU, so a relaxed ceiling) |
| `perf/render` | every PR | `doc:painted` for the 100 KB fixture ≤ 700 ms; long tasks during startup = 0 |
| `perf/memory` | nightly | Idle RSS delta over 20 open/close cycles ≤ 5% |
| `perf/size` | every PR | Frontend initial bundle ≤ 250 KB gz (fail the build) |
| `perf/full` | pre-release, real hardware | Every target in §1–§3 above |

Each writes `perf/results/*.json`; `analyze.mjs` diffs against the last release
and fails if any metric regressed **> 10%**.

---

## Why the targets are where they are

### Startup

🔧 **250 ms warm** is the number Obsidian, Typora and Zed-class apps hit, and it is
the point below which users stop noticing launch. 🔧 **900 ms cold on a
2019-class laptop** is generous on purpose: cold start is dominated by disk I/O
and by whatever the webview process spawn costs, neither of which is under our
control, and the population that notices cold start is the population that also
cannot afford a bigger bundle.

The **120 ms framework-ready → first paint** budget is the one that is fully ours.
It is where "did we do work in `setup()` that we should have deferred" shows up.

### Render

🔧 **≤ 150 ms to first visible block** regardless of file size is the most
important target in this document. It is the difference between "the app opened
my document" and "the app is thinking about my document." It is achievable for
100 MB by *not parsing the rest of the file yet*, which is
[01-large-files.md](01-large-files.md)'s entire subject.

### Memory

🔧 **350 MiB idle** is not arbitrary. ✅ **VERIFIED** — the same 2026-09-24
measurement, same environment, empty skeletons, 5 s after startup, idle:

| Configuration | Processes | Total RSS | Total PSS |
|---|---|---|---|
| Electron 44.4.5, default | 7 | 596–615 MiB | 264–269 MiB |
| Tauri 2.11.6, default | 3 | 417 MiB | 267–268 MiB |
| Electron, `--disable-gpu` | 8 | 529–560 MiB | 212–217 MiB |
| Tauri, `WEBKIT_DISABLE_COMPOSITING_MODE=1` | 3 | 321 MiB | 183–184 MiB |

And ✅ **VERIFIED** — the same source's conclusion, which we have adopted
verbatim as policy: *"Looking at RSS, Tauri seems to use less memory. However,
looking at PSS, which distributes shared pages, the two applications yielded
almost the same result in this environment. **Which metric you report changes the
result.**"*

So: **we report both, and we never claim a memory number from a single-process
measurement.** The three Tauri processes were the app itself (~146 MiB RSS),
`WebKitNetworkProcess` (~47 MiB) and `WebKitWebProcess` (~225 MiB) — the DOM
lives in a process we do not own, which is why the DevTools heap snapshot and the
OS-level RSS answer different questions and we must take both.

### The honest caveat

Every number in this folder is a **target on our hardware, measured by us**. The
figures cited from web.dev and from the urhoba series are other people's numbers
on other people's machines, cited so we have an order of magnitude and a
methodology. 🔧 We will publish our own harness and our own results when the
shell exists. Anything else is marketing.

---

## Legend used throughout this folder

| Marker | Meaning |
|--------|---------|
| ✅ **VERIFIED** | Stated or measured by a cited primary source, with the number and its conditions |
| 🟡 **UNVERIFIED** | Community report or our inference; a lead, not a fact |
| 🔧 **RECOMMENDED** | Our judgement. A decision, not a fact about the world |
