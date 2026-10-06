# 05 — Export and printing

> Printing is a second HTML parser. Export is a third trust context. Both are
> places where the sanitization guarantees can quietly stop applying.

---

## 1. What export paths exist, and what each one is for

| Path | Output | Renderer | Effort | Where |
|------|--------|----------|--------|-------|
| **A. Print dialog** | paper / OS print pipeline | webview | low | v0.1 |
| **B. Print-to-PDF** | one `.pdf` | webview's `printToPDF` (Electron) / OS print-to-PDF | low | v0.1 |
| **C. Standalone HTML** | one `.html` | none — opened later, elsewhere | medium | v0.2 |
| **D. HTML + assets folder** | `.html` + `assets/` | none | low | v0.2 |
| **E. Plain text** | `.txt` | strip markup from the AST | trivial | v0.1 |
| **F. PDF via external engine** | one `.pdf` | headless Chromium / LaTeX / WeasyPrint | high | later |

The security-relevant fact is that **A–D all consume the same sanitized HTML**
([05-rendering/README.md](./README.md#the-three-output-paths-share-one-trusted-core))
and none of them may modify it.

```mermaid
flowchart LR
    A["sanitized HTML<br/>+ content.css + tokens"] --> B["Print stylesheet<br/>@media print"]
    A --> C["Print dialog"]
    A --> D["webview printToPDF<br/>Electron / OS"]
    A --> E["Export writer<br/>inlines CSS + fonts + images"]
    E --> F["standalone .html"]
    A --> G["Plain-text renderer<br/>walks the AST, no HTML"]
```text

## 2. The print stylesheet

Already covered in
[03-styling-and-themes.md §8](./03-styling-and-themes.md#8-print-stylesheet).
Expanded here with the parts that only matter on paper.

### 2.1 Page geometry and the margin box

```css
@media print {
  /* A4 default; US Letter is a setting. Named sizes are honoured by Chromium
     and by most OS print pipelines; "auto" respects the printer's own default
     and is the safest fallback. */
  @page { size: A4; margin: 18mm 16mm; }

  /* Running header/footer. Chromium supports margin boxes; support is
     inconsistent elsewhere, so the design must work without them. */
  @page {
    @bottom-center {
      content: counter(page) " / " counter(pages);
      font: 9pt var(--font-sans);
      color: var(--fg-muted);
    }
    @top-left  { content: string(doctitle); font: 9pt var(--font-sans); color: var(--fg-muted); }
  }
}
```text

`string(doctitle)` requires the title to be set on the element:

```html
<article class="markdown-body"><h1>Document title</h1>…</article>
```text

Chromium's `string-set: doctitle content()` on the first heading supplies the
value. Because support varies, the document must look correct with the margin
boxes absent.

### 2.2 Break control

The three properties that matter, and what each one actually does:

| Property | Effect | Use it for |
|----------|--------|-----------|
| `break-inside: avoid` | try to keep the box on one page | short quotes, figures, small tables, headings |
| `break-after: avoid` / `page-break-after: avoid` | don't strand the thing that *follows* | headings, and any element that must not be separated from its caption |
| `orphans` / `widows` | minimum lines of a paragraph left/right at a break | all prose |

```css
@media print {
  p, li { orphans: 3; widows: 3; }

  h1, h2, h3, h4, h5, h6 { break-after: avoid; break-inside: avoid; }

  figure, blockquote, .admonition, pre, img { break-inside: avoid; }
  pre { break-inside: auto; }          /* long code MUST be allowed to split */
  pre > code { break-inside: auto; }

  table { break-inside: auto; }        /* ditto */
  thead  { display: table-header-group; }   /* repeat headers every page */
  tfoot  { display: table-footer-group; }
  tr     { break-inside: avoid; }

  li { break-inside: avoid; }
}
```

The `pre` and `table` lines look contradictory and are not. A 400-line code
block that cannot split produces either a blank half-page or a page that is
entirely pushed past the printer's limit. The correct behaviour is: **allow the
split, but make the split legible** — repeat the language label, keep the
padding, and never split *between* the `<pre>` border and its first line:

```css
@media print {
  pre {
    break-inside: auto;
    border: 1px solid var(--code-border);
    /* Chromium honours orphans/widows on block containers' line boxes. */
    orphans: 2; widows: 2;
  }
  /* Avoid a break immediately after the opening fence by keeping the first
     line with the box: not expressible directly, so we rely on orphans. */
}
```text

If a document needs line numbers, the gutter must be a real element with
`break-inside: avoid` and the numbers printed as part of the line box — a CSS
`counter` in a `::before` will renumber per page fragment in some engines, which
is a visible bug:

```css
@media print {
  .code-block[data-line-numbers] > pre { padding-inline-start: 3.2em; }
  .code-block[data-line-numbers] > pre code { counter-reset: ln; }
  .code-block[data-line-numbers] > pre code > .line { counter-increment: ln; }
  .code-block[data-line-numbers] > pre code > .line::before {
    content: counter(ln);
    display: inline-block; inline-size: 2.6em;
    margin-inline-end: 0.6em;
    text-align: end;
    color: var(--fg-subtle);
    user-select: none;
  }
}
```text

`.line` spans are real DOM nodes for print purposes, which means the screen
renderer does not use them (they break soft wrap). Generate them only in the
print DOM clone. See §3.4.

### 2.3 Colour on paper

```css
@media print {
  :root {
    --bg: #ffffff;
    --fg: #000000;
    --code-bg: #f6f8fa;
    --code-border: #d0d7de;
    --quote-border: #999999;
    --fg-muted: #444444;      /* 9.7:1 on white */
    --syn-comment: #4a4a4a;   /* still ≥ 4.5:1 */
    --bg-inset: #f6f8fa;
    --table-stripe: #ffffff;  /* stripes read as dirt on paper */
  }

  /* Backgrounds are opt-in, because a dark document printed on a mono laser
     printer is a solid black rectangle. */
  :root[data-print-colour="off"] * {
    background: transparent !important;
    box-shadow: none !important;
  }
  :root[data-print-colour="on"] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```text

Syntax highlighting in print is a real design decision. Token colours tuned for
a backlit screen are frequently below 4.5:1 on paper. Options:

1. **Monochrome code** — print code in `--fg` with weight/italic distinctions
   only. Robust, less informative.
2. **Print-tuned token colours** — a second `--syn-*` set validated against
   white paper. Informative, more work.
3. **User setting**, defaulting to 1.

We ship 3, default 1, with 2 available as a theme option. The comment colour is
never below body contrast in any of them — see
[03-styling-and-themes.md §3.3](./03-styling-and-themes.md#33-contrast).

### 2.4 Link destinations on paper

```css
@media print {
  a { color: var(--fg); text-decoration: underline; }
  a[href^="http"]::after,
  a[href^="https"]::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: var(--fg-muted);
    word-break: break-all;
  }
  /* Fragments, mailto, tel, and links whose text already IS the href add
     nothing and make the output unreadable. */
  a[href^="#"]::after,
  a[href^="mailto:"]::after,
  a[href^="tel:"]::after,
  a.is-autolink::after { content: ""; }
}
```

`is-autolink` is a class **we** emit for `<https://…>` autolinks
([01-ast-to-html.md §1.2](./01-ast-to-html.md#12-inline-nodes)), where the text
is already the URL. Printing the URL twice is the classic GFM print bug.

### 2.5 Hiding chrome

```css
@media print {
  .app-chrome, .toolbar, .sidebar, .toc-pane, .statusbar, .scrollbar,
  .code-block__bar, .heading-anchor, .selection-toolbar, .find-bar {
    display: none !important;
  }
  .markdown-body {
    position: static;
    max-width: none;
    margin: 0;
    padding: 0;
    box-shadow: none;
    transform: none;      /* kill any zoom/pan transform */
  }
  .scroller { overflow: visible !important; height: auto !important; }
}
```text

The `overflow: visible !important` on the scroll container is essential. In a
virtualized document list the scroller is `overflow-y: auto` with a fixed height;
printing that produces one page containing the visible slice. The print
stylesheet must unwind the app's layout constraints, and there is no way to
detect at print time that it failed — it silently produces a truncated document.

**A printed-document smoke test in CI:** render a 300-page document, print to
PDF via headless Chromium, and assert the PDF page count is within ±2 of the
expected count computed from a known fixture. That catches the whole class of
"print stylesheet produced one page" bugs.

---

## 3. Webview print-to-PDF

### 3.1 Electron

```js
// main process
const { app, BrowserWindow } = require('electron');

ipcMain.handle('export:pdf', async (event, { html, opts }) => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The export window is a separate, minimal surface. It loads ONLY the
      // sanitized document we build below — never user content.
      preload: path.join(app.getAppPath(), 'preload-export.js'),
    },
  });

  // Build the document as a data-less, script-free page.
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  // ^ Better: write to a temp file and loadFile(), because some engines cap
  // data: URL length and because loadURL with data: has weaker origin semantics.

  const pdf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: false,
    margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
    preferCSSPageSize: true,      // let @page { size } win
    generateTaggedPDF: true,      // accessibility: a real tagged PDF, not a picture
    generateDocumentOutline: true,// PDF bookmarks from <h1>-<h6>
    displayHeaderFooter: false,
    duplex: false,
  });

  win.destroy();
  return pdf;
});
```text

`generateTaggedPDF` and `generateDocumentOutline` are the two options worth
turning on. The outline one means a 200-page exported document has a navigable
bookmark tree in every PDF reader, which is the single highest-value thing an
export can do. Both are Electron `printToPDF` options:
<https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions>.

**Do not print the main window.** Printing the live window means printing
whatever the user currently has scrolled to, with whatever hover state is
active, with the sidebar open, and with the selection highlighted. Build a clean
document.

`printBackground: false` by default; expose it as "include background colours"
so the setting in §2.3 has a home.

### 3.2 Tauri

Tauri does not expose `printToPDF` as a first-class API. Three routes, in
descending order of preference:

| Route | How | Trade-off |
|-------|-----|-----------|
| **A. System print-to-PDF** | invoke `window.print()` and let the OS print dialog do it. On Linux, `lp`/`cups-pdf`; on Windows, the "Microsoft Print to PDF" driver | Native UX, but the filename and location are chosen by a system dialog we do not control, and it is unavailable in some Linux setups |
| **B. Headless Chromium as a sidecar** | bundle a `chrome-headless-shell` / `chromium` binary and run `--headless --print-to-pdf` | Deterministic, scriptable, headless-only, adds a large binary and a second supply-chain artifact to sign |
| **C. A Rust PDF library** | `printpdf` / `typst` rendering from the AST, skipping HTML entirely | No CSS, no images from the document, enormous work — not viable for fidelity |

**Recommendation: A for v0.1, B as a v0.3 "silent PDF export" feature** where the
user wants a specific path with no dialog. Document that a Linux user without a
CUPS PDF backend cannot use PDF export, and detect it up front rather than
failing after the dialog closes.

### 3.3 The export window/document

The export document is built from three parts and nothing else:

```ts
async function buildExportDocument(doc: RenderResult, theme: Theme, opts: ExportOpts) {
  // 1. The SAME sanitized HTML the screen renders. No re-parse, no re-render,
  //    no post-processing. If export needs different HTML, that is a bug —
  //    fix it in the renderer, which is covered by the spec tests.
  const body = doc.html;

  // 2. A stylesheet assembled from our own files. Never from the document.
  const css = [
    readAssetSync('/css/reset.css'),
    renderTokensAsCss(theme),              // the active theme, as variables
    readAssetSync('/css/content.css'),
    readAssetSync('/css/print.css'),       // or screen.css when opts.screen
  ].join('\n');

  // 3. A CSP that survives the file:// context.
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",           // we inline <style>; no external CSS
    "img-src data: asset: http://asset.localhost",   // data: because inlined
    "font-src data:",
    "script-src 'none'",                   // ← the whole point
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="${doc.lang}" data-theme="${theme.mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">
<title>${escapeText(doc.title)}</title>
<style>${css}</style>
</head>
<body>
<article class="markdown-body">${body}</article>
</body>
</html>`;
}
```text

`script-src 'none'` in the exported file is what makes an export safe to email
to somebody. A reader opening `export.html` in a browser gets a document with no
ability to run script, no ability to load remote resources (`default-src
'none'`), and no ability to be redirected (`base-uri 'none'`). That is the
practical meaning of "the export is safe" — see §5.

### 3.4 Print-only DOM

Two transformations are legitimate in the print DOM, and both are ours (not the
document's):

1. **Line wrappers for line numbers.** Wrap each line of a code block in
   `<span class="line">`. This reads `textContent` and rebuilds spans — it never
   re-parses markup and never sees anything but escaped text, because the source
   is the *text node* of the sanitized `<code>`.
2. **URL annotation for footers.** Add a `::after` via CSS, not via DOM.

Do not "clean up" the export DOM in any other way. Every DOM manipulation after
sanitization is a re-contextualization risk in the spirit of
[CVE-2026-65914](https://nvd.nist.gov/vuln/detail/CVE-2026-65914).

## 4. Single-file HTML export

### 4.1 What must be inlined

| Asset | Method | Notes |
|-------|--------|-------|
| CSS | `<style>` with the assembled stylesheet | requires `style-src 'unsafe-inline'` |
| Theme tokens | CSS custom properties in the same `<style>` | |
| Web fonts | `@font-face` with `src: url(data:font/woff2;base64,…)` | **only if we ship fonts**; the default stack uses `ui-*` generics and needs nothing |
| Images | `data:` URIs | see §4.2 |
| Syntax highlighting | already inline `<span class="…">` | nothing to do |
| TOC / navigation | inline `<nav>` + fragment links | works because ids are already in the HTML |
| Scripts | **none** | `script-src 'none'` |

### 4.2 Images: inlined vs linked, with real numbers

Base64 inflates by 4/3. A Markdown document with 15 MB of PNGs produces a
~20 MB HTML file. Numbers:

| Source | Base64 size |
|--------|-------------|
| 100 KB image | 133 KB |
| 1 MB image | 1.33 MB |
| 10 MB image | 13.3 MB |
| 15 MB of images | ~20 MB HTML |

Policy from [04-media-and-images.md §9.1](./04-media-and-images.md#91-the-export-cache):

| Total inlined | Mode |
|---------------|------|
| ≤ 16 MB | inline everything — the default "one file you can email" experience |
| 16–64 MB | inline, but show the computed size **before** writing |
| > 64 MB | offer linked mode instead |

**Linked mode** writes `out.html` plus `out.assets/` with relative paths and a
`<base href="out.assets/">`… no, without a `<base>`; simply relative `src`
values, and a note in a README in the folder. Also offers `file://` correctness
by keeping the directory structure relative rather than flat.

### 4.3 Making the file self-contained

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- The exported document is inert. This is what makes it safe to send. -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'">
<title>My Document</title>
<style>/* reset + tokens + content + print, concatenated */</style>
</head>
<body>
<article class="markdown-body">…sanitized, unmodified…</article>
</body>
</html>
```

Four correctness details:

1. **`<meta charset>` must be in the first 1024 bytes** or some engines guess
   wrong and produce mojibake. It is second here, immediately after `<html>`.
2. **No `<base>`** (see
   [04-media-and-images.md §2.1](./04-media-and-images.md#21-option-a-base-hreffile)).
3. **The `<html lang>` attribute** must be present — it drives `hyphens: auto`
   ([03-styling-and-themes.md §4.5](./03-styling-and-themes.md#45-hyphenation))
   and `:lang()` rules.
4. **No `<script>` at all**, not even a "copy code" helper. A self-contained HTML
   export that needs JS to be useful is not self-contained; and if we later add
   JS, it breaks under the CSP we just wrote.

### 4.4 The exported file's trust context is different — and worse

This is the part that gets missed. Inside our app, the export is rendered by our
webview with our CSP, our sandbox, our permissions. **Once it is written to disk,
it will be opened by a full browser, possibly uploaded, possibly emailed.**

Consequences:

| Risk | Why it is different from in-app | Mitigation |
|------|--------------------------------|------------|
| **The reader's browser runs it** | A full browser with a real origin, cookies, extensions | `script-src 'none'`, `default-src 'none'` |
| **Extensions inject scripts** | Extensions match on selectors like `code`, `pre`; ours are plentiful | Narrow the DOM: no `<script>`, no `on*`, minimal elements |
| **A DOM-clobbering foothold** | `id="main"`/`name` in a reader's page could confuse reader-side code | We generate prefixed ids ([01](./01-ast-to-html.md#2-id-generation-the-github-slugger-algorithm)); deny `name` |
| **Referrer leakage** | `<a href="…">` in an exported file tells the destination who sent it | Optional: strip `href` and render the URL as text in "anonymised export" mode |
| **The file becomes a phishing page** | An exported `invoice.md` with our app's styling looks authentic | Offer a footer in print/PDF output: "Exported from Siyana Markdown Viewer" — and for exports, no scripts, ever |
| **Remote images leak the reader** | If we allowed `https:` in `img-src`, opening the export beacons the reader | `img-src data:` only. Remote images stay as placeholders with a visible host |

The recommended default export therefore has **no remote resources of any kind**.
That is a deliberate reduction in fidelity relative to in-app viewing, and it is
the right trade: the exported file travels, and we do not control its readers.

### 4.5 Size and streaming

For a large export, do not build a single 64 MB string and hand it to the file
API. Stream:

```ts
async function writeExport(dest: fs.FileHandle, parts: AsyncIterable<string>) {
  for await (const chunk of parts) await dest.write(chunk);   // 'wx' flag: no overwrite
  await dest.close();
}
```text

`wx` is deliberate: exporting over an existing file without asking loses work
when the export later fails. Write to `name.html.part` and rename on success —
the atomic-rename pattern in
[11-security/03-filesystem-safety.md §9](../11-security/03-filesystem-safety.md#9-atomic-writes-and-temp-files).

---

## 5. How to make an exported HTML file safe

The checklist, in order:

1. **Sanitize.** The exported HTML is byte-identical to what the app renders. If
   the app's own sanitization is sound, the export inherits it. There is no
   second sanitizer, and there is no "light" export mode that skips it.
2. **No scripts.** `script-src 'none'`, and do not emit `<script>`.
3. **No network.** `default-src 'none'`, `img-src data:` (plus `asset:` where the
   platform requires it). Remote images become text placeholders.
4. **No forms, no frames, no plugins, no base.** `object-src 'none'`,
   `form-action 'none'`, `frame-src 'none'`, `base-uri 'none'`.
5. **No dangerous attributes.** Already true — the sanitizer denied `on*`,
   `style`, `srcdoc`, `name`. Re-run the export document through the *same*
   sanitizer as a belt-and-braces check? **No** — the sanitizer has already run,
   and running it twice on a string that we then concatenate into a template is
   exactly the re-contextualization pattern. Instead, assert (in CI) that the
   export template introduces nothing the sanitizer would have removed: a
   snapshot test of the export for a known payload must equal the in-app render
   plus the wrapper.
6. **CSP as a `<meta>`** — note that CSP delivered by `<meta>` cannot use
   `frame-ancestors`, `report-uri`, or `sandbox`. That is acceptable here and is
   the standard trade for a self-contained file.
7. **A provenance footer** (optional setting): a small `<footer>` with the app
   name, the source file's basename, and the export timestamp. Deterrent value
   against repurposing, and honest provenance.

**A residual risk we accept and document:** an exported file can be edited. If a
user exports, edits the HTML to add a script, and reopens it, that is a new
document and our sanitizer's contract does not apply. Nothing can prevent this,
and pretending otherwise is the mistake.

---

## 6. Export to plain text

Trivial from the AST and genuinely useful — it is how you paste into an email,
a commit message box, or a search index.

```ts
export function toPlainText(ast: Document, opts: { width?: number } = {}): string {
  const out: string[] = [];
  walk(ast, node => {
    switch (node.type) {
      case 'heading':
        out.push('', '#'.repeat(node.level) + ' ' + inlineTextOf(node.children), '');
        return SKIP_CHILDREN;
      case 'paragraph':      out.push(inlineTextOf(node.children), ''); return SKIP_CHILDREN;
      case 'codeBlock':      fence(out, node.value, node.info ?? ''); return SKIP_CHILDREN;
      case 'thematicBreak':  out.push('---', ''); return SKIP_CHILDREN;
      case 'listItem':       out.push('  '.repeat(depth) + '- ' + inlineTextOf(node.children)); return;
      case 'image':          out.push(`[image: ${node.alt ?? node.destination}]`); return SKIP_CHILDREN;
      case 'link':           out.push(text + ' <' + node.destination + '>'); return SKIP_CHILDREN;
      case 'inlineCode':     out.push('`' + node.value + '`'); return SKIP_CHILDREN;
      case 'softbreak':      out.push('\n'); return;
      case 'hardbreak':      out.push('\n'); return;
      case 'htmlBlock':
      case 'htmlInline':
        out.push(stripTags(node.raw));      // no rendering, just drop the tags
        return SKIP_CHILDREN;
      default: return;
    }
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
```text

Two decisions worth stating:

- **Raw HTML becomes its text, not nothing.** `stripTags` on the *raw source*
  (after removing `<…>` and collapsing whitespace) keeps the words a user wrote.
  Silently dropping `<div>` and its contents loses content.
- **Link text is preserved alongside the destination** (`text <url>`), because
  plain-text consumers (email clients, TUI pager views) may not fetch URLs.

Plain text has **no sanitizer involvement**: it never produces HTML, so the
XSS question does not arise. It does have a *disclosure* question — an exported
`.txt` may contain links and filenames the reader did not expect — which is a
content question, not a security one.

---

## 7. PDF via a headless renderer (option F, later)

When the in-webview PDF is not good enough (large documents, deterministic
output, batch export), the same sanitized HTML is rendered by headless
Chromium:

```text
chromium --headless=new --disable-gpu --no-sandbox-in-container \
  --print-to-pdf=out.pdf --no-pdf-header-footer \
  --virtual-time-budget=10000 \
  file:///path/to/export.html
```

Notes from experience:

- `--virtual-time-budget` waits for layout and inlined resources deterministically;
  without it, output is racy and images are sometimes missing.
- The input must be the **export file** (§4), not the app's live DOM, for the
  same reason `printToPDF` uses a fresh window: determinism.
- `--no-sandbox` inside a container is required for Chromium's own sandbox to
  work in CI; that is a CI-only concession and must never appear in shipped code.
- For reproducible output, pin the Chromium version — the same HTML through two
  Chromium majors can paginate differently. Record the Chromium version in the
  PDF metadata.
- LaTeX-based export (`pandoc` → PDF) gives better typography and worse fidelity
  for HTML-heavy documents. It is a separate pipeline from the one in this
  document and does not share the sanitizer's guarantees, so it takes the
  *already-exported* HTML as input rather than the Markdown.

## 8. Verification

| Check | Assert |
|-------|--------|
| **Export equals render** | for a corpus of fixture documents, `exportBody === appBody` byte-for-byte. Any difference is a bug, not a feature |
| **Payload inertness in export** | every payload from [02-sanitization.md §10](./02-sanitization.md#10-sanitizer-test-corpus-must-exist-before-v01-ships) exported, then loaded in headless Chromium; assert no script executes and no network request is made (Playwright route interception) |
| **Self-containment** | export with all network interfaces blocked offline; assert it renders identically |
| **Print page count** | 300-page fixture → PDF page count within ±2 of expected |
| **Break behaviour** | no heading is the last element on a page; no table row is split across pages |
| **Long code block splits cleanly** | a 400-line block produces ≥ 2 pages with no orphaned first line |
| **Table headers repeat** | a 60-row table spanning 3 pages has `<thead>` on each |
| **Link URLs printed** | every external link shows its URL; fragments and autolinks do not |
| **Colour modes** | both `print-colour` settings render legibly (screenshot diff against a committed baseline) |
| **Atomic write** | killing the process mid-export leaves no partial `.html` |
| **No overwrite** | exporting to an existing path prompts |
| **Size accounting** | reported inline size matches actual file size within 1% |
| **Windows CRLF** | exported `.html` uses the platform newline, matching the app's own line-ending policy |
| **Plain text round-trip** | for each fixture, `plainText` contains every text node in document order |

## Sources

- Electron `webContents.printToPDF` —
  <https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions>
- Electron security checklist (export window must use contextIsolation,
  sandbox, no nodeIntegration) —
  <https://www.electronjs.org/docs/latest/tutorial/security>
- Tauri process model and IPC —
  <https://v2.tauri.app/concept/inter-process-communication/>
- Tauri CSP (for the asset source list in the export CSP) —
  <https://v2.tauri.app/security/csp/>
- MDN, CSS paged media, `@page`, margin boxes, `break-inside`, `orphans`/`widows`,
  `print-color-adjust` — <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_paged_media>
- W3C, CSS Fragmentation Module Level 3 —
  <https://www.w3.org/TR/css-break-3/>
- Chromium `Page.printToPDF` (for the headless path) —
  <https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF>
- HTML spec, handling `<meta http-equiv="Content-Security-Policy">` and its
  restrictions — <https://html.spec.whatwg.org/multipage/semantics.html>
- DOMPurify, context-bound output and re-contextualization (CVE-2026-65914) —
  <https://github.com/cure53/DOMPurify/wiki/Attack-Classes-%26-Bypass-History>
- OWASP XSS Prevention Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
