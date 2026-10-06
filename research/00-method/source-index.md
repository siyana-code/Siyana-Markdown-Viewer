# Source index

Annotated bibliography for the Siyana Markdown Viewer research phase.

**Rules for this file**

- Every URL below was fetched and returned HTTP 200 during verification on
  **2026-10-06**. URLs that returned 404/405/ERR are excluded, not annotated
  with a warning — see [§Rejected](#rejected-candidates) at the bottom for the
  ones we threw away and why.
- "Authoritative for" states the *narrow* claim each source may be used to
  support. A source outside its lane is a source we do not cite.
- Tier refers to the hierarchy in [`README.md` §2](./README.md#2-source-quality-hierarchy).
- "Last verified" is the date we confirmed the resource was live, not the date
  the content was published. Publication dates are given inline where relevant.

---

## Tier S1 — Normative specifications

| # | Source | Publisher | URL | Type | Authoritative for | Last verified |
|---|--------|-----------|-----|------|--------------------|---------------|
| 1 | CommonMark Spec — version index | John MacFarlane / commonmark | <https://spec.commonmark.org/> | spec | Which spec versions exist and their release dates. Latest = **0.31.2, 2024-01-28** | 2026-10-06 |
| 2 | CommonMark Spec 0.31.2 (rendered) | John MacFarlane / commonmark | <https://spec.commonmark.org/0.31.2/> | spec | The normative behaviour of CommonMark: block types, inline types, emphasis delimiter rules 1–17, HTML blocks types 1–7, link/image grammar | 2026-10-06 |
| 3 | CommonMark `spec.txt` (machine-readable source) | John MacFarlane / commonmark | <https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/spec.txt> | spec source | The spec's *prose rationale*: the "Why is a spec needed?" list of 14 ambiguities, the "About this document" non-normativity caveat, Appendix A parsing strategy and the delimiter-stack algorithm | 2026-10-06 |
| 4 | CommonMark `changelog.txt` | John MacFarlane / commonmark | <https://spec.commonmark.org/changelog.txt> | spec | Exactly what changed in each version. Verified: 0.31.2 = "Fix packaging bug (date not updated in spec.txt)" | 2026-10-06 |
| 5 | CommonMark conformance corpus, 0.31.2 | commonmark | <https://spec.commonmark.org/0.31.2/spec.json> | test corpus | 652 numbered examples. Used as our conformance test suite. We verified the count is 652 | 2026-10-06 |
| 6 | CommonMark conformance corpus, earlier versions | commonmark | <https://spec.commonmark.org/0.30/spec.json> · <https://spec.commonmark.org/0.28/spec.json> | test corpus | Growth of the corpus over time: 0.22=599, 0.23=604, 0.24=613, 0.25=616, 0.26=618, 0.27=622, 0.28=624, 0.29=649, 0.30=652, 0.31.2=652 | 2026-10-06 |
| 7 | CommonMark "dingus" (live tester) | commonmark | <https://spec.commonmark.org/dingus/> | tool | Interactive confirmation of any parse; powered by the reference implementation | 2026-10-06 |
| 8 | CommonMark `normalize.py` (test harness) | John MacFarlane / commonmark | <https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/test/normalize.py> | code | The canonical definition of "these two HTML outputs mean the same thing". We downloaded and ran this rather than writing our own comparator | 2026-10-06 |
| 9 | GitHub Flavored Markdown Spec — **0.29-gfm (2019-04-06)** | GitHub | <https://github.github.com/gfm/> | spec | GFM as a strict superset of CommonMark. Confirmed the page self-labels version 0.29-gfm and dates to 2019-04-06 | 2026-10-06 |
| 10 | GFM spec source (extension markers) | GitHub / cmark-gfm | <https://raw.githubusercontent.com/github/cmark-gfm/master/test/spec.txt> | spec source | The exact set of GFM extensions — verified by counting `## … (extension)` headings: **tables, task list items, strikethrough, autolinks, disallowed raw HTML**. Five, no more | 2026-10-06 |
| 11 | RFC 7763 — *The text/markdown Media Type* | IETF (S. Leonard, Penango) | <https://www.rfc-editor.org/rfc/rfc7763.html> | RFC (Informational) | Registration of `text/markdown`, extensions `.md`/`.markdown`, UTI `net.daringfireball.markdown`; §1.2 "Markdown Is About Writing and Editing"; §2 security considerations ("a better approach is to analyze (and sanitize or block) the output markup, rather than attempting to analyze the Markdown"); §3 fragment identifiers (Markdown defines none) | 2026-10-06 |
| 12 | RFC 7764 — *Guidance on Markdown: Design Philosophies, Stability Strategies, and Select Registrations* | IETF (S. Leonard) | <https://www.rfc-editor.org/rfc/rfc7764.html> | RFC (Informational) | §1.1 the plain-text→informal-markup→formal-markup→binary formality spectrum; §1.2 Gruber's motivation; §1.3 "the primary arbiter of the syntax's success is *running code*"; §3 registration templates for CommonMark, GFM, pandoc, MultiMarkdown, Fountain, PHP Markdown Extra | 2026-10-06 |
| 13 | IANA "Markdown Variants" registry | IANA | <https://www.iana.org/assignments/markdown-variants/markdown-variants.xhtml> | registry | Live list of registered variants. Page states **Last Updated 2026-09-24**. Registered: Original, MultiMarkdown, GFM, pandoc, Fountain, CommonMark, kramdown-rfc2629, rfc7328, Extra, SSW, quarto, myst, mdc. Also records that "Standard", "Common" and "Markdown" are **reserved identifiers** | 2026-10-06 |
| 14 | HTML Standard — parsing | WHATWG | <https://html.spec.whatwg.org/multipage/parsing.html> | spec | The reference CommonMark defers to for HTML tokenisation edge cases (unquoted attribute values, comment syntax, CDATA) | 2026-10-06 |
| 15 | HTML Sanitization / XSS (CWE-79) | MITRE | <https://cwe.mitre.org/data/definitions/79.html> | standard | The canonical definition of cross-site scripting, for the trust-boundary section | 2026-10-06 |
| 16 | OWASP Denial of Service Cheat Sheet | OWASP | <https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html> | guidance | Regex-amplification and algorithmic-complexity classes, for the sanitiser choice | 2026-10-06 |
| 17 | OWASP SSRF Prevention Cheat Sheet | OWASP | <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html> | guidance | Why image `src` in a hostile document is an SSRF vector if we fetch it for the user | 2026-10-06 |
| 18 | WAI-ARIA 1.2 | W3C | <https://www.w3.org/TR/wai-aria-1.2/> | spec | Roles for a document viewer: landmarks, heading hierarchy, `aria-live` for external-change announcements | 2026-10-06 |
| 19 | inotify(7) | man7 / Linux | <https://man7.org/linux/man-pages/man7/inotify.7.html> | man page | `max_queued_events`, `max_user_instances`, `max_user_watches`; `IN_Q_OVERFLOW` and dropped events. The hard limits behind "watch the whole vault" | 2026-10-06 |

---

## Tier S2 — Primary author statements and project documentation

| # | Source | Publisher | URL | Type | Authoritative for | Last verified |
|---|--------|-----------|-----|------|--------------------|---------------|
| 20 | *Markdown* (project page) | John Gruber / Daring Fireball | <https://daringfireball.net/projects/markdown/> | project page | The "overriding design goal" quote; Markdown 1.0.1 dated **17 Dec 2004**; Perl 5.6.0+ requirement; Movable Type / Blosxom / BBEdit integration | 2026-10-06 |
| 21 | *Markdown: Syntax* | John Gruber / Daring Fireball | <https://daringfireball.net/projects/markdown/syntax> | docs | The canonical (and famously incomplete) syntax description. Especially §Philosophy, §Inline HTML ("HTML is a *publishing* format; Markdown is a *writing* format"), §Links, §Emphasis (the entire original emphasis rule is one sentence) | 2026-10-06 |
| 22 | *Markdown: Basics* | John Gruber / Daring Fireball | <https://daringfireball.net/projects/markdown/basics> | docs | The short-form tutorial Gruber actually links to | 2026-10-06 |
| 23 | *Markdown: License* | John Gruber / Daring Fireball | <https://daringfireball.net/projects/markdown/license> | licence | Current licence: **BSD-style**, © 2004 John Gruber. Note the 2004-03 archived page says GPL + $50/domain; the licence changed | 2026-10-06 |
| 24 | *Introducing Markdown* (2004-03) | John Gruber / Daring Fireball | <https://daringfireball.net/2004/03/introducing_markdown> | announcement | Original launch post, March 2004 | 2026-10-06 |
| 25 | Markdown project page, March 2004 (Wayback) | Internet Archive | <https://web.archive.org/web/20040311230924/https://daringfireball.net/projects/markdown/index.text> | archive | **Markdown 1.0b1, 9 March 2004** — the first public release, with its then-current GPL/$50-per-domain licensing | 2026-10-06 |
| 26 | *atx* | Aaron Swartz | <https://www.aaronsw.com/2002/atx/> | docs | The 2002 precursor CommonMark credits for the `#` heading syntax and the required space after `#`. CommonMark cites `aaronsw.com/2002/atx/atx.py` directly | 2026-10-06 |
| 27 | *Markdown* (weblog entry 1189) | Aaron Swartz | <https://www.aaronsw.com/weblog/001189> | announcement | Swartz's 19 March 2004 post on the project he co-designed | 2026-10-06 |
| 28 | *Markdoc* (2022-05-19) | John Gruber / Daring Fireball | <https://daringfireball.net/linked/2022/05/19/markdoc> | commentary | Gruber states he deliberately avoided `{`/`}` in Markdown "to unofficially reserve them for implementation-specific extensions". Extensibility-by-convention, from the author | 2026-10-06 |
| 29 | CommonMark front page | commonmark | <https://commonmark.org/> | project page | "Markdown.pl was quite buggy… was not a satisfactory replacement for a spec"; the current maintainer list; adopters (Discourse, GitHub, GitLab, Reddit, Qt, Stack Exchange, Swift) | 2026-10-06 |
| 30 | CommonMark quick reference / interactive tutorial | commonmark | <https://commonmark.org/help/> | docs | Short spec-derived cheat sheet — useful for cross-checking our own teaching material | 2026-10-06 |
| 31 | commonmark-spec repository | commonmark | <https://github.com/commonmark/commonmark-spec> | code/docs | The spec's own README states the design intent behind resolving ambiguity ("considerations of simplicity, readability, expressive power, and consistency"), and that the spec is "written from the point of view of the human writer, not the computer reader" | 2026-10-06 |
| 32 | commonmark-spec releases | commonmark | <https://github.com/commonmark/commonmark-spec/releases> | releases | Release dates: 0.31.2 (2024-01-28), 0.31.1, 0.31.0 (both 2024-01-28), 0.30 (2021-06-20), 0.29 (2019-04-08) | 2026-10-06 |
| 33 | List of CommonMark Implementations | commonmark wiki | <https://github.com/commonmark/commonmark-spec/wiki/List-of-CommonMark-Implementations> | index | The maintained list of implementations across ~30 languages. Starting point for `06-libraries/` | 2026-10-06 |
| 34 | PHP Markdown / PHP Markdown Lib | Michel Fortin | <https://michelf.ca/projects/php-markdown/> | project page | Current release **2.0.0, September 2022**, requires PHP 7.4+ | 2026-10-06 |
| 35 | *PHP Markdown Extra* | Michel Fortin | <https://michelf.ca/projects/php-markdown/extra/> | docs | The Extra feature set (fenced code, tables, definition lists, footnotes, abbreviations, special attributes, `markdown="1"` in HTML blocks) and the **intraword-underscore** decision, with the `secret_magic_box` example | 2026-10-06 |
| 36 | MDTest | Michel Fortin / John Gruber | <https://github.com/michelf/mdtest> | code/docs | The pre-CommonMark test suite, derived from Gruber's own MarkdownTest. Last push **2022-02-23** — effectively abandoned. CommonMark's own front page calls it "obsolete" | 2026-10-06 |
| 37 | Jekyll — Front Matter | Jekyll project | <https://jekyllrb.com/docs/front-matter/> | docs | The de-facto front matter convention: YAML between triple-dashed lines, must be first in file; explicit Windows/BOM warning | 2026-10-06 |
| 38 | Hugo — Front matter | Hugo project | <https://gohugo.io/content-management/front-matter/> | docs | A *competing* front matter standard (YAML / TOML / JSON), proving front matter is convention rather than specification | 2026-10-06 |
| 39 | Node.js `fs` documentation | Node.js | <https://nodejs.org/api/fs.html> | docs | `fs.watch` and `fs.watchFile` semantics and, critically, the **Caveats** section: platform inconsistency, Windows rename/move silence, inode-following on Linux/macOS, optional `filename` argument, unreliability on NFS/SMB/Vagrant/Docker | 2026-10-06 |
| 40 | Rust `std::fs` | Rust project | <https://doc.rust-lang.org/std/fs/index.html> | docs | The alternative filesystem API, for the Rust-side of the desktop app | 2026-10-06 |
| 41 | `notify` crate | Rust ecosystem | <https://docs.rs/notify/latest/notify/> | docs | The de-facto Rust file-watching abstraction (wraps inotify / ReadDirectoryChangesW / FSEvents / kqueue) | 2026-10-06 |
| 42 | File API | MDN | <https://developer.mozilla.org/en-US/docs/Web/API/File_API> | docs | `File` / `Blob` / `FileReader` semantics for the web target | 2026-10-06 |
| 43 | File System Handle API | MDN | <https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle> | docs | The persistence story for the web/PWA target: re-acquiring permission to a file the user opened | 2026-10-06 |
| 44 | `window.print()` | MDN | <https://developer.mozilla.org/en-US/docs/Web/API/Window/print> | docs | The print/PDF export entry point in a web-rendered document | 2026-10-06 |
| 45 | `content-visibility` | MDN | <https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility> | docs | Browser-level virtualisation primitive — candidate for very large documents | 2026-10-06 |
| 46 | Intersection Observer API | MDN | <https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API> | docs | Scroll-driven lazy work (lazy image loading, TOC highlighting) | 2026-10-06 |
| 47 | markdown-it README | markdown-it contributors | <https://github.com/markdown-it/markdown-it> | docs | Claims: "Follows the CommonMark spec + adds syntax extensions & sugar"; "Configurable syntax"; "Safe by default". A *claim*, to be tested — see `06-libraries/` | 2026-10-06 |
| 48 | markdown-it architecture | markdown-it contributors | <https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md> | docs | The three-chain (`core`/`block`/`inline`) rule architecture, token-stream (not AST) representation, and the explicit reasoning "Why not an AST? It's not needed for our tasks. We follow the KISS principle." | 2026-10-06 |
| 49 | marked README | marked contributors | <https://github.com/markedjs/marked> | docs | Marked's own warning: "**Marked does not sanitize the output HTML.**" — a first-party confirmation of the trust-boundary problem | 2026-10-06 |
| 50 | micromark | micromark contributors | <https://github.com/micromark/micromark> | code/docs | The CommonMark-compliant parser behind the unified/remark ecosystem, plus `micromark-extension-gfm` for the GFM deltas | 2026-10-06 |
| 51 | mdast | syntax-tree | <https://github.com/syntax-tree/mdast> | docs | The **tree** representation, as opposed to markdown-it's flat token stream. The decision between them is ours | 2026-10-06 |
| 52 | unified | unified contributors | <https://github.com/unifiedjs/unified> | docs | The pluggable processor pipeline (parse → transform → serialize). Note the correct org is `unifiedjs`, **not** `remarkjs` | 2026-10-06 |
| 53 | cmark-gfm | GitHub | <https://github.com/github/cmark-gfm> | code | GitHub's C implementation; release **0.29.0.gfm.13 (2023-07-21)** — the code that actually renders README files on github.com | 2026-10-06 |
| 54 | pandoc | John MacFarlane / contributors | <https://github.com/jgm/pandoc> · manual: <https://pandoc.org/MANUAL.html> | code/docs | The multi-output converter; the canonical example of "Markdown as a document interchange format". Release **3.12, 2026-09-29** | 2026-10-06 |
| 55 | goldmark | yuin | <https://github.com/yuin/goldmark> | code | Pure-Go CommonMark implementation. Release **v2.1.6, 2026-09-27** | 2026-10-06 |
| 56 | blackfriday | Russ Cox et al. | <https://github.com/russross/blackfriday> | code | The Go "reference-ish" implementation that explicitly does *not* follow CommonMark — evidence that dialect divergence is a deliberate choice | 2026-10-06 |
| 57 | MDX | mdx-js | <https://github.com/mdx-js/mdx> | code | A CommonMark superset adding JSX/ESM — the strongest existing example of "Markdown as an application language", and a cautionary tale about what happens when Markdown grows a plugin surface | 2026-10-06 |
| 58 | github-slugger | Flet / GitHub | <https://github.com/Flet/github-slugger> | code | The *de facto* heading-anchor algorithm: GitHub's slug rules, deduplication counters. Since Markdown defines no fragment identifiers (RFC 7763 §3), this is our reference implementation for anchors | 2026-10-06 |
| 59 | rehype-sanitize | rehype / unified | <https://github.com/rehypejs/rehype-sanitize> | code | AST-level HTML sanitisation with a GitHub-derived default schema — a candidate for the trust boundary. Release 6.0.0 (2023-08-26) | 2026-10-06 |
| 60 | DOMPurify | cure53 | <https://github.com/cure53/DOMPurify> | code | The DOM-level sanitiser marked itself recommends | 2026-10-06 |
| 61 | Quill Delta format | Quill | <https://quilljs.com/docs/delta/> | docs | A real rich-text editor's internal document format — used as the "representation three" in the cost comparison. Notable claim: Delta fixes HTML's *ambiguity* "without the ambiguity and complexity of HTML" but not its verbosity | 2026-10-06 |
| 62 | ProseMirror | ProseMirror | <https://prosemirror.net/> | docs | The tree-based editor model — the second real rich-text internal representation, for comparison | 2026-10-06 |
| 63 | Obsidian releases | Obsidian | <https://github.com/obsidianmd/obsidian-releases> | releases | The largest commercial Markdown-note viewer; used in `13-competitors/` | 2026-10-06 |
| 64 | MarkText | MarkText | <https://github.com/marktext/marktext> | code | The closest open-source analogue to our stated goal (a Markdown *viewer*) | 2026-10-06 |
| 65 | Electron docs | Electron | <https://www.electronjs.org/docs/latest/> | docs | Candidate desktop shell for the desktop-first target | 2026-10-06 |
| 66 | Tauri | Tauri | <https://tauri.app/> | docs | Candidate desktop shell; relevant because a Rust backend forces the watcher design into Rust | 2026-10-06 |

---

## Tier S4 — Benchmarks we ran ourselves

| # | Source | Publisher | URL | Type | Authoritative for | Last verified |
|---|--------|-----------|-----|------|--------------------|---------------|
| 67 | Our CommonMark 0.31.2 conformance run | This project | Script to be checked in at `research/06-libraries/` (not yet written) | benchmark | 2026-10-06, Node v24.14.1 / win32-x64, corpus = 652 examples, comparator = the spec's own `normalize.py`: `commonmark@0.31.2` 652/652 strict; `markdown-it@15.0.2` `commonmark` preset 649 strict / **652 normalised**; `markdown-it` default 519 / 580; `marked@18.1.0` default 498 / 640 | 2026-10-06 |
| 68 | npm registry metadata | npm | <https://registry.npmjs.org/markdown-it> and siblings | registry API | Authoritative "version as of date": `markdown-it` 15.0.2 (2026-09-11), `marked` 18.1.0 (2026-10-05), `commonmark` 0.31.2 (2024-09-19), `micromark` 4.0.3 (2026-09-26), `unified` 11.0.5 (2024-06-19), `remark` 15.0.1 (2023-09-18), `rehype-sanitize` 6.0.0 (2023-08-26), `micromark-extension-gfm` 3.0.0 (2023-06-26), `mdast-util-from-markdown` 2.1.0 (2026-10-03). `marked` first published **0.0.1 on 2011-07-24** | 2026-10-06 |
| 69 | GitHub REST API (`repos`, `releases`) | GitHub | <https://api.github.com/repos/{owner}/{repo}> | registry API | Authoritative repo creation dates and latest-release tags: `markdown-it` created 2014-12-19, `commonmark.js` 2015-01-24, `cmark-gfm` 2016-12-01, `pandoc` 2010-03-20, `mdtest` 2012-07-01 | 2026-10-06 |

---

## Tier S5/S6 — Orientation and context (never load-bearing alone)

| # | Source | Publisher | URL | Type | Use | Last verified |
|---|--------|-----------|-----|------|-----|---------------|
| 70 | *Markdown* | Wikipedia | <https://en.wikipedia.org/wiki/Markdown> | encyclopaedia | Orientation and, more usefully, a well-footnoted trail of primary citations. Its infobox dates (Markdown 1.0.1 = 2004-12-17; CommonMark initial release 2014-10-25) match the primary sources | 2026-10-06 |
| 71 | *Markdown Extra* | Wikipedia | <https://en.wikipedia.org/wiki/Markdown_Extra> | encyclopaedia | Adoption list for Extra (Drupal, Textpattern, TYPO3) | 2026-10-06 |
| 72 | *Lightweight markup language* | Wikipedia | <https://en.wikipedia.org/wiki/Lightweight_markup_language> | encyclopaedia | The category Markdown belongs to, and its neighbours (Setext, Textile, reST, AsciiDoc) | 2026-10-06 |
| 73 | *Setext* | Wikipedia | <https://en.wikipedia.org/wiki/Setext> | encyclopaedia | The `===` / `---` heading convention Markdown inherited | 2026-10-06 |
| 74 | *Atx (markup language)* | Wikipedia | <https://en.wikipedia.org/wiki/Atx_(markup_language)> | encyclopaedia | Swartz's 2002 predecessor, and the naming of "atx-style" headings | 2026-10-06 |
| 75 | *WYSIWYG* | Wikipedia | <https://en.wikipedia.org/wiki/WYSIWYG> | encyclopaedia | The rich-text-editor tradition Markdown was positioned against | 2026-10-06 |
| 76 | *AsciiDoc* | Wikipedia | <https://en.wikipedia.org/wiki/AsciiDoc> | encyclopaedia | The direct competitor CommonMark's own Introduction uses for its readability argument (AsciiDoc is easier to *write*, Markdown easier to *read*) | 2026-10-06 |
| 77 | *reStructuredText* | Wikipedia | <https://en.wikipedia.org/wiki/reStructuredText> | encyclopaedia | The other major 2002-era lightweight markup language, and a contrast case: it requires blank lines before lists even inside list items; CommonMark deliberately does not | 2026-10-06 |
| 78 | *The Future of Markdown* | Jeff Atwood / Coding Horror, 25 Oct 2012 | <https://blog.codinghorror.com/the-future-of-markdown/> | announcement | The origin of the CommonMark effort, and Atwood's stated motivation | 2026-10-06 |
| 79 | *Standard Markdown is now Common Markdown* | Jeff Atwood / Coding Horror, 4 Sep 2014 | <https://blog.codinghorror.com/standard-markdown-is-now-common-markdown/> | announcement | The rename, and why the name "Markdown" could not be claimed | 2026-10-06 |
| 80 | *Is HTML a Humane Markup Language?* | Jeff Atwood / Coding Horror, 2008 | <https://blog.codinghorror.com/is-html-a-humane-markup-language/> | article | The "humane markup" framing, quoted by RFC 7764 §1.1 | 2026-10-06 |
| 81 | *A formal spec for GitHub Markdown* | GitHub Engineering, 14 Mar 2017 | <https://githubengineering.com/a-formal-spec-for-github-markdown/> | announcement | The date GFM stopped being undocumented folklore | 2026-10-06 |
| 82 | CommonMark discussion forum | Discourse / commonmark | <https://talk.commonmark.org/> | forum | The only place where "what is the spec actually going to do" gets decided before it ships | 2026-10-06 |
| 83 | *Issues we MUST resolve before 1.0 release* | commonmark forum | <https://talk.commonmark.org/t/issues-we-must-resolve-before-1-0-release-6-remaining/1287> | forum | The live 1.0 blocker list; page last updated 2025-10-13 | 2026-10-06 |
| 84 | *The case for calling it Version 1.0* | commonmark/commonmark-spec issue #788, opened 2025-02-03 | <https://github.com/commonmark/commonmark-spec/issues/788> | issue | The strongest statement of the "1.0 is symbolic, stability is real" argument, plus the CJK-emphasis concern | 2026-10-06 |
| 85 | Babelmark 3 | babelmark | <https://babelmark.github.io/> | tool | Live cross-implementation comparison; the empirical instrument for the fragmentation question. (Client-rendered, so a static fetch shows only the shell) | 2026-10-06 |
| 86 | The Markdown Guide | Matt Cone | <https://www.markdownguide.org/> · <https://www.markdownguide.org/extended-syntax/> | tutorial | Widely-used tutorial. **Not** a specification: it describes a de-facto union dialect with no version. Useful only for checking what beginners are taught | 2026-10-06 |
| 87 | Babelmark 2 (Wayback) | John MacFarlane | <https://web.archive.org/web/20170718113552/http://johnmacfarlane.net/babelmark2/> | archive | The predecessor tool; the live FAQ URL is dead, so the archive is the citable copy | 2026-10-06 |

---

## Rejected candidates

Verified during the 2026-10-06 sweep and **deliberately not cited**:

| URL | Result | Note |
|-----|--------|------|
| `https://github.com/remarkjs/unified` | 404 | Wrong organisation. Use `unifiedjs/unified`. A careless copy-paste would have produced a dead citation. |
| `https://github.com/gruber/markdown` | 404 | No such official repository. `Markdown.pl` ships only as `Markdown_1.0.1.zip` on daringfireball.net. |
| `https://daringfireball.net/projects/markdown/markdown.pl` | 404 | The Perl script is not browsable on that path. |
| `https://johnmacfarlane.net/babelmark2/faq.html` | 404 | Only the Wayback capture is live (row 87). |
| `https://arstechnica.com/information-technology/2014/10/markdown-throwdown-…` | 405 | Real article, refuses automated requests. Excluded rather than cited from memory. |
| `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Guides/CORS` | 404 | MDN restructured URLs; found the live equivalent separately where needed. |
| `https://github.com/sindresorhus/glow` | 404 | Terminal Markdown viewer has moved; not yet relocated. |
| `https://github.com/proseio/prosemirror` | 404 | Wrong org; ProseMirror's site is the citable surface. |

---

## Maintenance rule

When a source's content changes materially (a new spec version, a new release, a
changed licence), the row is updated **and** a line is added to
[`README.md` §7](./README.md#7-changelog-of-research) and to
[`research-log.md`](./research-log.md). A stale source index is worse than none,
because it launders an unverified claim into a citation.
