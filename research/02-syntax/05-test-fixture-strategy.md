# 05 — Test fixture strategy

> **Purpose.** Turn [01](01-block-elements.md)–[04](04-edge-cases-and-traps.md)
> into a CI gate that cannot be quietly weakened, and that tells us the truth
> about how conformant we are.
>
> `→` = TAB (U+0009) · `␣` = one SPACE · `␤` = LINE FEED · `␍` = CARRIAGE RETURN · `␀` = NUL · `␃` = BACKTICK. Real backticks appear only as code-span delimiters. See [README §2.0](README.md#20-the-visible-glyph-convention).
>
> **Everything numeric in this document was measured on 2026-10-06** with
> **Windows / Node v24.14.1 / Python 3.12.9**, against
> `marked@18.1.0` and `markdown-it@15.0.2` (both UMD builds loaded via jsDelivr),
> using **CommonMark `spec.json` 0.31.2** (SHA-256
> `d431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20`) and
> **`cmark-gfm/test/spec.txt` 0.29-gfm** (SHA-256
> `7d8e5814befec287ac116786d81ff14e0adc9b13295b4494649e995408fd871c`).

---

## 1. The upstream assets

### 1.1 What exists, and where

| Asset | URL | Size | Examples | Format |
|-------|-----|-----:|---------:|--------|
| CommonMark `spec.txt` | <https://spec.commonmark.org/0.31.2/spec.txt> | 204 857 B | 652 | Markdown with the 32-backtick example fence |
| CommonMark `spec.json` | <https://spec.commonmark.org/0.31.2/spec.json> | 140 487 B | 652 | JSON array |
| CommonMark `spec_tests.py` | <https://spec.commonmark.org/0.31.2/test/spec_tests.py> | — | — | Python conformance runner |
| CommonMark `normalize.py` | same directory | — | — | HTML normalisation |
| GFM `spec.txt` | <https://raw.githubusercontent.com/github/cmark-gfm/master/test/spec.txt> | 216 680 B | 672 | Same fence format, GFM content |
| GFM `spec_tests.py` | <https://raw.githubusercontent.com/github/cmark-gfm/master/test/spec_tests.py> | — | — | |
| GFM `normalize.py` | same directory | — | — | |
| GFM `extensions.txt` | <https://raw.githubusercontent.com/github/cmark-gfm/master/test/extensions.txt> | 21 274 B | — | **cmark-gfm's own extra tests, beyond the 24 spec ones** |
| GFM `regression.txt` | same directory | — | — | |
| GFM `smart_punct.txt` | same directory | — | — | |
| GFM `roundtrip_tests.py` | same directory | — | — | |
| GFM `pathological_tests.py` | same directory | 5 778 B | 21 cases | **DoS suite** |
| GFM `afl_test_cases/test.md` | same directory | 382 B | 1 | AFL corpus seed |

**There is no `spec.json` for GFM.** cmark-gfm ships only `spec.txt`. We must
write our own parser for the ```` ```` ```` `example` fence format, or reuse
`spec_tests.py`.

### 1.2 `spec.json` shape

```jsonc
[
  {
    "markdown":   "\tfoo\tbaz\t\tbim\n",
    "html":       "<pre><code>foo\tbaz\t\tbim\n</code></pre>\n",
    "example":    1,
    "start_line": 355,
    "end_line":   360,
    "section":    "Tabs"
  },
  // … 651 more
]
```

Useful: `section` lets us report conformance **per spec section**, which is far
more actionable than a single number. All 652 entries have all six keys.

### 1.3 The GFM `spec.txt` fence format

```markdown
```````````````````````````````` example
| abc | def |
| --- | --- |
| bar | baz |
.
<table>
…
</table>
````````````````````````````````
```markdown

The content before the `.` line is Markdown; after it is HTML. **Two gotchas:**

1. **Tabs are written as `→` (U+2192).** You must substitute real tabs in *both*
   the Markdown *and* the expected HTML, or the 11 Tabs examples fail.
   (`spec_tests.py` does this.)
2. **The example name after `example` is often empty.** Do not key your report
   on it; use a line number instead.

---

## 2. Conformance by section — the baseline we must beat

CommonMark 0.31.2, 652 examples, from `spec.json`:

| Spec section | Examples | Range | Count | Share |
|--------------|----------|-------|------:|------:|
| Preliminaries — Tabs | §2.2 | 1–11 | 11 | 1.7 % |
| Preliminaries — Backslash escapes | §2.4 | 12–24 | 13 | 2.0 % |
| Preliminaries — Entity/char refs | §2.5 | 25–41 | 17 | 2.6 % |
| Blocks and inlines — Precedence | §3.1 | 42 | 1 | 0.2 % |
| **Leaf blocks** | | | | |
| Thematic breaks | §4.1 | 43–61 | 19 | 2.9 % |
| ATX headings | §4.2 | 62–79 | 18 | 2.8 % |
| Setext headings | §4.3 | 80–106 | 27 | 4.1 % |
| Indented code blocks | §4.4 | 107–118 | 12 | 1.8 % |
| Fenced code blocks | §4.5 | 119–147 | 29 | 4.4 % |
| **HTML blocks** | §4.6 | 148–191 | **44** | 6.7 % |
| Link reference definitions | §4.7 | 192–218 | 27 | 4.1 % |
| Paragraphs | §4.8 | 219–226 | 8 | 1.2 % |
| Blank lines | §4.9 | 227 | 1 | 0.2 % |
| **Container blocks** | | | | |
| Block quotes | §5.1 | 228–252 | 25 | 3.8 % |
| **List items** | §5.2 | 253–300 | **48** | 7.4 % |
| Lists | §5.3 | 301–326 | 26 | 4.0 % |
| **Inlines** | | | | |
| Inlines | §6 | 327 | 1 | 0.2 % |
| Code spans | §6.1 | 328–349 | 22 | 3.4 % |
| **Emphasis and strong emphasis** | §6.2 | 350–481 | **132** | **20.2 %** |
| **Links** | §6.3 | 482–571 | **90** | 13.8 % |
| Images | §6.4 | 572–593 | 22 | 3.4 % |
| Autolinks | §6.5 | 594–612 | 19 | 2.9 % |
| Raw HTML | §6.6 | 613–632 | 20 | 3.1 % |
| Hard line breaks | §6.7 | 633–647 | 15 | 2.3 % |
| Soft line breaks | §6.8 | 648–649 | 2 | 0.3 % |
| Textual content | §6.9 | 650–652 | 3 | 0.5 % |
| **Total** | | | **652** | 100 % |

GFM 0.29-gfm, 672 examples, from `cmark-gfm/test/spec.txt`:

| Section | Count |
|---------|------:|
| Tabs | 11 |
| Backslash escapes | 13 |
| Entity/char refs | 17 |
| Precedence | 1 |
| Thematic breaks | 19 |
| ATX headings | 18 |
| Setext headings | 27 |
| Indented code blocks | 12 |
| Fenced code blocks | 29 |
| HTML blocks | 43 |
| Link reference definitions | 28 |
| Paragraphs | 8 |
| Blank lines | 1 |
| **Tables (extension)** | **8** |
| Block quotes | 25 |
| List items | 48 |
| **Task list items (extension)** | **2** |
| Lists | 26 |
| Inlines | 1 |
| Code spans | 22 |
| Emphasis and strong emphasis | 131 |
| **Strikethrough (extension)** | **2** |
| Links | 87 |
| Images | 22 |
| Autolinks | 19 |
| **Autolinks (extension)** | **11** |
| Raw HTML | 20 |
| **Disallowed Raw HTML (extension)** | **1** |
| Hard line breaks | 15 |
| Soft line breaks | 2 |
| Textual content | 3 |
| **Total** | **672** |

**Key observation for planning:** 34 % of the CommonMark suite is inline
(emphasis + links = 222 examples). That is where conformance effort must go,
not into block parsing.

---

## 3. Repository layout

```
packages/test-fixtures/
├─ package.json                    # private, zero runtime deps
├─ README.md
├─ commonmark/
│  ├─ 0.31.2/
│  │  ├─ spec.json                # vendored, SHA-256 verified in CI
│  │  ├─ spec.txt                 # vendored
│  │  ├─ LICENSE.txt              # CC-BY-SA 4.0
│  │  └─ EXPECTED.json            # OUR recorded pass matrix (see §6)
│  ├─ 0.30/spec.json              # kept when 0.32 lands, to measure the delta
│  └─ 0.29/spec.json
├─ gfm/
│  ├─ 0.29-gfm/
│  │  ├─ spec.txt
│  │  ├─ extensions.txt
│  │  ├─ regression.txt
│  │  └─ LICENSE.txt
├─ extensions/                     # OUR fixtures for doc 03, one file per item
│  ├─ tables.json                 # {id, profile, markdown, html, why, specRef}
│  ├─ task-lists.json
│  ├─ strikethrough.json
│  ├─ autolink-literals.json
│  ├─ tagfilter.json
│  ├─ footnotes.json
│  ├─ definition-lists.json
│  ├─ abbreviations.json
│  ├─ attribute-blocks.json
│  ├─ frontmatter.json
│  ├─ math.json
│  ├─ mermaid.json
│  ├─ wikilinks.json
│  ├─ embeds.json
│  ├─ block-refs.json
│  ├─ logseq-refs.json
│  ├─ callouts.json
│  ├─ comments.json
│  ├─ highlight.json
│  ├─ superscript.json
│  └─ subscript.json
├─ traps/                          # §13 of doc 04, one file per trap
│  ├─ 001-block-over-inline.json
│  ├─ 002-setext-vs-thematic-break.json
│  └─ … 072 items
├─ pathological/                   # §12.5 of doc 04
│  ├─ cases.json                  # {id, name, generator, budgetMs, expect}
│  ├─ afl_test_cases.test.md      # vendored from cmark-gfm
│  └─ LICENSE.txt
└─ snapshots/                      # rendered-HTML snapshots for extension fixtures
   ├─ gfm/
   │  └─ tables__pipe-in-wikilink.html
   └─ …
```text

### 3.1 The fixture record format

One JSON object per case, everywhere:

```
{
  "id": "traps/020-setext-vs-list",
  "profile": "gfm",                 // commonmark | gfm | pandoc
  "markdown": "Foo\n---\nbar\n",
  "html": "<h2>Foo</h2>\n<p>bar</p>\n",
  "why": "CM §4.1 Ex. 59 — setext beats thematic break",
  "specRef": { "doc": "commonmark/0.31.2", "section": "4.1", "example": 59 },
  "tier": "semantic",               // semantic | spec-exact  (see §5)
  "tags": ["ambiguity", "block"]
}
```markdown

`profile` is mandatory: our parser has three profiles
([03 §15.1](03-extensions-and-dialects.md#151-the-mode-model)), and every
fixture must declare which profile it belongs to. A fixture without a profile
is a bug.
```

---

## 4. Running the suite

### 4.1 Canonical command

```text
# CommonMark 0.31.2, both tiers, per-section breakdown
node packages/test-fixtures/bin/run.mjs \
  --spec   packages/test-fixtures/commonmark/0.31.2/spec.json \
  --profile commonmark \
  --tiers  semantic,spec-exact \
  --report section,matrix,junit \
  --out    artifacts/conformance/commonmark-0.31.2.json
```

### 4.2 The reference harness

This is the exact code that produced every number in this document. It is
~90 lines and has no dependencies beyond Node. **Vendor it as
`packages/test-fixtures/bin/harness.mjs`.**

```js
// harness.mjs — two-tier CommonMark / GFM conformance runner.
// Tier "spec-exact": byte comparison after cmark-style whitespace normalisation.
// Tier "semantic":   additionally tolerates
//                      (a) XHTML vs HTML5 void-element serialisation  <br /> == <br>
//                      (b) the newline cmark puts inside an otherwise-empty element
//                      (c) table align="center" vs style="text-align:center"
// Spec §1.3: "not every feature of the HTML samples is mandated by the spec".

const ENT = { quot: '"', lt: '<', gt: '>', amp: '&', nbsp: '\u00a0' };

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, n) => (n in ENT ? ENT[n] : m));

function normalize(s, semantic) {
  let lines = s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, ''));
  if (semantic) {
    const joined = lines.join('\n')
      .replace(/\s*\/>/g, '>')                                             // (a)
      .replace(/<([a-zA-Z][a-zA-Z0-9]*)>\n<\/\1>/g, '<$1></$1>')          // (b)
      .replace(/\sstyle="text-align:\s*(left|center|right)"/g, '')       // (c)
      .replace(/ align="(left|center|right)"/g, ' style="text-align:$1"'); // (c)
    lines = joined.split('\n');
  }
  const out = [];
  let blank = 0;
  for (const l of lines) {
    if (l === '') { blank++; if (blank > 2) continue; } else blank = 0;
    out.push(l);
  }
  return decode(out.join('\n').replace(/^\n+/, '').replace(/\n+$/, ''));
}

export function measure(spec, render) {
  const exact = { pass: 0, fails: [] };
  const semantic = { pass: 0, fails: [] };
  const bySection = {};

  for (const ex of spec) {
    let actual;
    try {
      actual = render(ex.markdown);
    } catch (e) {
      actual = `THREW:${e.constructor.name}: ${e.message}`;
    }
    const sec = (bySection[ex.section] ??= { exact: 0, semantic: 0, n: 0, failEx: [] });
    sec.n++;

    const e1 = normalize(actual, false) === normalize(ex.html, false);
    const e2 = normalize(actual, true) === normalize(ex.html, true);

    if (e1) { exact.pass++; sec.exact++; } else exact.fails.push(ex.example);
    if (e2) {
      semantic.pass++; sec.semantic++;
    } else {
      semantic.fails.push(ex.example);
      if (sec.failEx.length < 5) sec.failEx.push(ex.example);
    }
  }
  return { exact, semantic, bySection, total: spec.length };
}

// ---- CommonMark driver: spec.json is already JSON ----------------------
export const runCommonMark = (spec, render) => measure(spec, render);

// ---- GFM driver: parse the 32-backtick `example` fence ------------------
export function parseGfmSpec(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const cases = [];
  let section = '(preamble)', inEx = false, md = [], html = null, start = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!inEx) {
      const h = /^#+ (.+)$/.exec(ln);
      if (h) section = h[1];
      const open = /^(`{32}) example\s*(.*)$/.exec(ln);
      if (open) { inEx = true; md = []; html = null; start = i + 1; continue; }
    } else if (/^(`{32})\s*$/.test(ln)) {
      cases.push({
        example: start, section, start_line: start,
        // (1) U+2192 in spec.txt denotes a TAB — substitute in BOTH halves.
        markdown: md.join('\n').replace(/→/g, '\t') + '\n',
        html: (html ?? []).join('\n') + '\n',
      });
      inEx = false;
    } else if (ln === '.') { html = []; }
    else if (html === null) md.push(ln);
    else html.push(ln);
  }
  return cases;
}

// (2) Append "\n" to the input: spec.txt examples have no trailing newline,
//     but cmark always terminates the last line of a code block with "\n".
export const runGfm = (text, render) => measure(parseGfmSpec(text), render);
```

### 4.3 Wiring the three profiles

```js
// profiles.mjs
import MarkdownIt from 'markdown-it';

export const PROFILES = {
  commonmark: () => MarkdownIt('commonmark'),

  gfm: () => {
    const md = MarkdownIt({ html: true, linkify: true, typographer: false });
    md.enable(['table', 'strikethrough', 'linkify']);
    // our own plugins, registered here so the profile is the single source of truth
    md.use(require('./plugins/task-lists.mjs'));
    md.use(require('./plugins/footnotes.mjs'));
    md.use(require('./plugins/definition-lists.mjs'));
    md.use(require('./plugins/abbreviations.mjs'));
    md.use(require('./plugins/attribute-blocks.mjs'));
    md.use(require('./plugins/frontmatter.mjs'));
    md.use(require('./plugins/math.mjs'));
    md.use(require('./plugins/wikilinks.mjs'));
    md.use(require('./plugins/embeds.mjs'));
    md.use(require('./plugins/block-refs.mjs'));
    md.use(require('./plugins/callouts.mjs'));
    md.use(require('./plugins/comments.mjs'));
    md.use(require('./plugins/highlight.mjs'));
    md.use(require('./plugins/superscript.mjs'));
    md.use(require('./plugins/tagfilter.mjs'));   // security, not sugar
    md.use(require('./plugins/autolink-literals.mjs')); // our own GFM §6.9 engine
    return md;
  },

  pandoc: () => {
    const md = PROFILES.gfm();
    md.disable('strikethrough');       // free the ~ for subscript
    md.enable('subscript');            // H~2~O
    md.enable('superscript');
    md.enable('exampleLists');
    md.use(require('./plugins/pandoc-attributes.mjs'));
    md.use(require('./plugins/pandoc-shortcut-syntax.mjs'));
    return md;
  },
};
```

**Note the `pandoc` profile.** It *disables* `strikethrough` and *enables*
`subscript`. This is the concrete proof that extensions must be a profile and
not a pile of booleans ([03 §15.1](03-extensions-and-dialects.md#151-the-mode-model)).

---

## 5. Two tiers of conformance

### 5.1 Why one tier is not enough

CommonMark §1.3:

> note that not every feature of the HTML samples is mandated by the spec. For
> example, the spec says what counts as a link destination, but it doesn't
> mandate that non-ASCII characters in the URL be percent-encoded.

Measured consequences:

| Parser | spec-exact | semantic | Gap |
|--------|-----------:|---------:|----:|
| `markdown-it@15.0.2` preset `commonmark` | 649 / 652 = **99.54 %** | **652 / 652 = 100.00 %** | 3 |
| `markdown-it@15.0.2` preset `default` | 591 / 652 = **90.64 %** | **652 / 652 = 100.00 %** | **61** |
| `marked@18.1.0` defaults | 506 / 652 = **77.61 %** | 554 / 652 = **84.97 %** | 48 |

The 61-example gap for markdown-it's `default` preset is **entirely**
serialisation. Verified by diffing:

```text
Example 43   expected "<hr />\n<hr />\n<hr />\n"   actual "<hr>\n<hr>\n<hr>\n"
Example 633  expected "<p>foo<br />\nbaz</p>\n"     actual "<p>foo<br>\nbaz</p>\n"
Example 572  expected "...title=\"title\" />"      actual "...title=\"title\">"
Example 11   expected "<hr />\n"                   actual "<hr>\n"
```

And the **3** examples markdown-it's `commonmark` preset "fails" at the exact
tier are also pure serialisation:

```text
Example 218  "<blockquote>\n</blockquote>"  vs  "<blockquote></blockquote>"
Example 239  "<blockquote>\n</blockquote>"  vs  "<blockquote></blockquote>"
Example 240  "<blockquote>\n</blockquote>"  vs  "<blockquote></blockquote>"
```

`marked`'s 48-example gap is **not** serialisation. Those are real parsing
differences:

| Section | marked semantic failures | Example failing | Correct | marked |
|---------|-------------------------:|-----------------|---------|--------|
| **List items** | 20 / 48 | 254 | correct nesting | `<li>` without the `<p>` wrapper |
| **Lists** | 8 / 26 | 306 | | |
| **HTML blocks** | 12 / 44 | 148 | | |
| **Hard line breaks** | 7 / 15 | 633 | `<p>foo<br />\nbaz</p>` | `<p>foo<br>baz</p>` — **the newline is lost** |
| **Tabs** | 5 / 11 | 4 | `<ul><li><p>foo</p><p>bar</p></li></ul>` | wrong tight/loose |
| **Entity refs** | 4 / 17 | 25 | `© Æ Ď ¾ ℋ ⅆ` | `&copy;` left undecoded |
| Paragraphs | 4 / 8 | 222 | | |
| Autolinks | 4 / 19 | 602 | | |
| Thematic breaks | 3 / 19 | 49 | | |
| Indented code | 3 / 12 | 108 | | |
| Setext | 2 / 27 | 87 | | |
| Block quotes | 2 / 25 | 241 | | |
| Links | 2 / 90 | 503 | | |
| Backslash escapes | 1 / 13 | 16 | | |
| ATX | 1 / 18 | 70 | | |
| Soft breaks | 1 / 2 | 649 | | |

### 5.2 The rules

| Tier | Gate | Rationale |
|------|------|-----------|
| **semantic** | **100 %, hard gate, every PR** | Parsing correctness. 100 % is achievable and therefore a meaningful gate |
| **spec-exact** | **≥ 99 %** hard gate; below that, a **checked-in allow-list** of known-serialisation deviations | Byte-level, but tolerant of the four documented HTML freedoms |

The allow-list lives in `packages/test-fixtures/commonmark/0.31.2/EXPECTED.json`
and is **diffed in CI**. A *new* spec-exact failure is a hard failure. A
*removed* entry requires the PR author to explain why — that is how we prevent
the list from becoming a graveyard.

---

## 6. What GFM actually diverges on

### 6.1 Measured GFM conformance

`markdown-it@15.0.2` against the full 672 GFM examples:

| Configuration | Semantic pass |
|----------------|--------------:|
| `html: true, linkify: false` | **643 / 672 = 95.68 %** |
| `html: true, linkify: true` | 642 / 672 = 95.54 % |
| GFM **non-extension** examples only (648), `linkify: true` | **630 / 648 = 97.22 %** |
| GFM **extension** examples only (24), `linkify: true` | **12 / 24 = 50.00 %** |
| `marked@18.1.0` defaults, full GFM | 553 / 672 = 82.29 % |

`marked` on the **Tables** extension: **2 / 8**.

### 6.2 The four known, explainable divergences

Each needs a fixture that documents the divergence, not a "fix".

| # | Divergence | Detail |
|---|-----------|--------|
| 1 | **Emphasis, 9 of 131 examples** | GFM 0.29 is based on CommonMark **0.29**; we target **0.31.2**. `__foo, __bar__, baz__`: GFM expects `<strong>foo, bar, baz</strong>`; CM 0.31.2 Example 425 expects `<strong>foo, <strong>bar</strong>, baz</strong>`. `markdown-it` follows 0.31.2. **Decision: follow CommonMark. Document it.** 9 examples, all in this family |
| 2 | **Table alignment attribute** | GFM/GFM-spec expects `align="center"`; `markdown-it` emits `style="text-align:center"`. **Decision: emit `style` (HTML5-correct) and normalise `align` in the harness.** cmark-gfm even has a `test/extensions-table-prefer-style-attributes.txt` file, so this is a known, deliberate fork |
| 3 | **Strikethrough element** | GFM expects `<del>`; `markdown-it` emits `<s>`. Both are valid HTML with identical semantics. **Decision: normalise `<del>` ≡ `<s>` in the harness**, or pin a renderer override to emit `<del>` |
| 4 | **Task lists** | Not in the core parser at all. **Decision: our plugin; 0 / 2 until it lands** |
| 5 | **Autolink literals** | `linkify` gets 3 / 11 and does **not** linkify `www.` at all (verified by probe). **Decision: our own GFM §6.9 engine** |

### 6.3 The matrix we check in

`EXPECTED.json` records, per profile:

```json
{
  "profile": "gfm",
  "spec": "commonmark/0.31.2",
  "recorded": "2026-10-06",
  "semantic": { "pass": 652, "total": 652 },
  "specExact": {
    "pass": 649,
    "total": 652,
    "allowList": {
      "218": "cmark emits <blockquote>\n</blockquote>; we emit <blockquote></blockquote>. Serialisation only.",
      "239": "same as 218",
      "240": "same as 218"
    }
  },
  "bySection": { "Emphasis and strong emphasis": { "pass": 132, "total": 132 } }
}
```

---

## 7. Project-specific extension fixtures

### 7.1 Volume

| Group | Source of truth | Minimum fixtures |
|-------|-----------------|------------------:|
| GFM (5 extensions) | GFM spec examples 198–205, 279–280, 491–493, 622–633, 657 | 24 (vendored) + **24** of ours |
| Markdown Extra | The Extra documentation's own examples | 30 |
| Wikilinks / embeds / block refs | Obsidian + Logseq docs | 40 |
| Math | Pandoc + Typora rules | 20 |
| Mermaid / diagram fences | Info-string detection | 8 |
| Callouts | GitHub alerts + Obsidian types | 20 |
| Front matter | YAML/TOML/JSON | 15 |
| Highlight / superscript / comments | markdown-it plugin READMEs | 15 |
| Traps (doc 04 §13) | our own | **72** |
| Pathological (doc 04 §12.5) | cmark | 22 |

**Target: ~350 project-owned fixtures** on top of 1 324 vendored spec examples.

### 7.2 The four-fixture rule

Every extension gets four fixtures. See the checklist in
[03 §16](03-extensions-and-dialects.md#16-extension-fixture-checklist). Worked
example — footnotes:

```js
// extensions/footnotes.json
[
  {
    "id": "fn/positive-basic",
    "profile": "gfm",
    "markdown": "Text.[^1]\n\n[^1]: The note.\n",
    "html": "<p>Text<sup id=\"fnref:1\"><a href=\"#fn:1\" class=\"footnote-ref\" role=\"doc-noteref\">1</a></sup></p>\n<div class=\"footnotes\" role=\"doc-endnotes\">\n<hr />\n<ol>\n<li id=\"fn:1\" role=\"doc-endnote\">\n<p>The note.\n<a href=\"#fnref:1\" class=\"footnote-backref\" role=\"doc-backlink\">&#8617;</a></p>\n</li>\n</ol>\n</div>\n",
    "why": "Markdown Extra 'Footnotes' — the canonical form",
    "specRef": { "doc": "phpextra", "url": "https://michelf.ca/projects/php-markdown/extra/#footnotes" },
    "tier": "semantic",
    "tags": ["footnote", "markdown-extra"]
  },
  {
    "id": "fn/negative-undefined-reference",
    "profile": "gfm",
    "markdown": "Text.[^missing]\n",
    "html": "<p>Text.[^missing]</p>\n",
    "why": "A reference with no definition must stay LITERAL, not vanish",
    "specRef": { "doc": "ours", "rule": "extension design decision" },
    "tier": "semantic",
    "tags": ["footnote", "negative"]
  },
  {
    "id": "fn/interaction-in-code-span",
    "profile": "gfm",
    "markdown": "`[^1]`\n\n[^1]: note\n",
    "html": "<p><code>[^1]</code></p>\n<div class=\"footnotes\" …>…</div>\n",
    "why": "Footnotes must not fire inside a code span (CM §3.1 precedence)",
    "specRef": { "doc": "commonmark/0.31.2", "section": "3.1" },
    "tier": "semantic",
    "tags": ["footnote", "interaction"]
  },
  {
    "id": "fn/conflict-duplicate-label",
    "profile": "gfm",
    "markdown": "a[^x] b[^x]\n\n[^x]: one\n\n[^x]: two\n",
    "html": "…",
    "why": "CONFLICT: Markdown Extra says duplicate labels are invalid; GitHub's cmark-gfm behaviour is unspecified. Decide and document.",
    "specRef": { "doc": "phpextra", "url": "…#footnotes" },
    "tier": "semantic",
    "tags": ["footnote", "conflict"]
  }
]
```

### 7.3 Fuzz-generated fixtures

Random strings are useless as *correctness* fixtures — they have no expected
output. They are excellent as **invariance** fixtures. Three properties to
assert, all machine-checkable without a spec:

| Invariant | Assertion |
|-----------|-----------|
| **Line-ending invariance** | `parse(LF(s))`, `parse(CRLF(s))`, `parse(CR(s))` produce structurally identical ASTs, modulo source offsets |
| **BOM invariance** | `parse(BOM + s)` ≡ `parse(s)` |
| **Round-trip idempotence** | `parse(s) == parse(serialize(parse(s)))` (a "normalise idempotence" check, using our CommonMark serialiser) |
| **No-throw** | `parse(anything)` never throws, never hangs |

These four become a property-based test suite. Generate from a **grammar-aware
fuzzer** (token soup drawn from Markdown metacharacters, weighted toward the
ones in doc 04 §13) rather than uniform random bytes — uniform random almost
never produces a construct.

---

## 8. Snapshot testing

### 8.1 When snapshots are the right tool

Snapshots are for **our own extensions**, where no upstream spec exists and the
expected output is a design decision rather than a fact.

| Use a golden fixture (assert exact) | Use a snapshot (record once, review diffs) |
|--------------------------------------|---------------------------------------------|
| CommonMark (652) | Our extension HTML shapes |
| GFM (672) | Full-document renders for the 72 traps |
| Traps with a known-correct answer | Theme/variant output matrices |

### 8.2 Snapshot hygiene

| Rule | Why |
|------|-----|
| Serialise the **AST**, not the HTML, for most cases | HTML is unstable; the AST is what we designed |
| One snapshot per `(fixture, profile)` pair, filename-addressed | No giant monolith |
| Store a **normalised** snapshot: `prettier`-formatted, sorted attributes | Avoids churn from whitespace |
| **`--ci` mode never writes snapshots** | A missing snapshot in CI is a failure, not a creation |
| Snapshot files carry a `// generated by … do not edit` header | Prevents hand-editing |
| Review snapshots in the PR like code | A changed snapshot is a behaviour change |

### 8.3 What we deliberately do **not** snapshot

| Thing | Why not |
|-------|---------|
| HTML for CommonMark examples | Upstream already gives us the expected HTML; a snapshot would let a bug become "the expected value" |
| Anything with timestamps, absolute paths, or version strings | Non-deterministic |
| The full CSS bundle | Use a separate visual/perf check |

---

## 9. The pathological and DoS suite

Separate from correctness, because it fails on **time**, not on output.

```bash
node packages/test-fixtures/bin/pathological.mjs \
  --budget-ms 5000 \
  --cases packages/test-fixtures/pathological/cases.json
```

````markdown
```js
// pathological.mjs — every case gets its own timeout, like cmark's harness.
// // A case that exceeds the budget FAILS CI; it is never marked "expected".
import { setTimeout as delay } from 'node:timers/promises';

const BUDGET_MS = 5000;

export async function runCase(render, testCase) {
  const input = testCase.generator();
  const t0 = process.hrtime.bigint();
  let threw = null;
  try {
    render(input);
  } catch (e) {
    threw = e;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return {
    id: testCase.id,
    name: testCase.name,
    bytes: input.length,
    ms: Math.round(ms),
    verdict: threw ? 'THREW' : ms > BUDGET_MS ? 'TIMEOUT' : 'OK',
    threw: threw && `${threw.constructor.name}: ${threw.message}`,
  };
}
```
````

**The budget is 5 s**, copied from `cmark`'s `TIMEOUT = 5`. Rationale: it is
long enough that a correct implementation on a loaded CI runner passes, and
short enough that a quadratic regression is caught in one CI run rather than
after ten.

`cmark`'s own harness has an `allowed_failures` dict containing exactly one
entry (`"many references"`, a hash-collision case). **We start with an empty
dict.** An entry added must come with an issue link.

### 9.1 Fuzzing

| Engine | Tool | Scope |
|--------|------|-------|
| JS/TS | `@jazzer.js/fuzz` (libFuzzer + coverage guidance) | `parse()` entry point; 10-minute job nightly |
| Rust | `cargo-fuzz` | same |
| Corpus | `packages/test-fixtures/pathological/afl_test_cases/` + our traps | seeds |

Every crash the fuzzer finds becomes a numbered fixture the same day.

---

## 10. Licensing and attribution

| Asset | Licence | Consequence of vendoring |
|-------|---------|--------------------------|
| CommonMark `spec.txt` / `spec.json` | **CC-BY-SA 4.0** | The vendored directory becomes **share-alike**. Anyone redistributing our repo must attribute John MacFarlane and share alike on that directory |
| cmark-gfm `spec.txt`, `extensions.txt`, `pathological_tests.py` | **CC-BY-SA 4.0** | Same |
| cmark-gfm `afl_test_cases/test.md` | CC-BY-SA 4.0 (repo-level) | Same |
| Obsidian help prose | Proprietary | **Do not vendor.** Cite and paraphrase |
| Logseq docs | Repo-level, check before vendoring | Cite only |
| Typora / MarkText / VS Code docs | Proprietary | Cite only |
| IANA registry, RFC 7763/7764 | Freely redistributable with attribution | Safe to quote |

### 10.1 Required attribution file

`packages/test-fixtures/README.md` must contain, verbatim in substance:

> The CommonMark specification examples in `commonmark/` and the GitHub Flavored
> Markdown specification examples in `gfm/` are derived from work by
> **John MacFarlane** and **GitHub, Inc.**, licensed under
> **Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0)**.
> Full text: <https://creativecommons.org/licenses/by-sa/4.0/>.
>
> The pathological-input shapes in `pathological/` are derived from
> `test/pathological_tests.py` in `github/cmark-gfm`, also CC-BY-SA 4.0.
>
> All files under `extensions/` and `traps/` are original work, MIT, © the
> Siyana Markdown Viewer contributors.

### 10.2 Share-alike scope, precisely

CC-BY-SA 4.0 share-alike applies to **adapted material**. Two readings:

| Reading | Implication |
|---------|-------------|
| **Narrow (recommended)** | Only the vendored spec directories are CC-BY-SA. Everything we author is MIT. Attribute clearly and mark the directories |
| Broad | Any file derived from the spec examples is CC-BY-SA, including fixtures we transcribe into `traps/` |

**Recommendation:** avoid the ambiguity by *not* copying spec example text into
`traps/`. Instead, each trap fixture records `specRef: {example: 59}` and
re-derives the case ourselves. Where we must quote verbatim (documentation), we
quote inside prose with attribution. This is what `micromark` and
`markdown-it` do.

**This is a legal question. Get it reviewed before shipping.** It belongs in
ADR-0004 or a sibling ADR.

---

## 11. CI gates

### 11.1 The required matrix

```yaml
# .github/workflows/conformance.yml — sketch
jobs:
  commonmark:
    strategy:
      matrix:
        profile: [commonmark]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: node packages/test-fixtures/bin/run.mjs --profile ${{ matrix.profile }}
            --spec commonmark/0.31.2/spec.json --tiers semantic,spec-exact
      - run: node packages/test-fixtures/bin/check-allowlist.mjs   # §5.2

  gfm:
    strategy:
      matrix:
        profile: [gfm, pandoc]
    steps:
      - run: node packages/test-fixtures/bin/run.mjs --profile ${{ matrix.profile }}
            --spec commonmark/0.31.2/spec.json --tiers semantic
      - run: node packages/test-fixtures/bin/run.mjs --profile ${{ matrix.profile }}
            --spec gfm/0.29-gfm/spec.txt --tiers semantic
      - run: node packages/test-fixtures/bin/run-extensions.mjs --profile ${{ matrix.profile }}

  integrity:
    steps:
      - run: node packages/test-fixtures/bin/verify-sha256.mjs   # §1.1
      - run: node packages/test-fixtures/bin/verify-fixture-shape.mjs  # every fixture has profile/tier/why
```

### 11.2 Thresholds

| Gate | Threshold | Escalation |
|------|----------|------------|
| CommonMark semantic, `commonmark` profile | **652 / 652** | PR blocked |
| CommonMark semantic, `gfm` profile | **652 / 652** | PR blocked |
| CommonMark semantic, `pandoc` profile | 652 minus **documented** exclusions | PR blocked on new exclusions |
| CommonMark spec-exact | ≥ 99 % and no new allow-list entries | PR blocked |
| GFM extension examples (our `gfm` profile) | ≥ 20 / 24 | PR blocked; new failures always blocked |
| Project extension fixtures | **100 %** | PR blocked |
| Trap fixtures | **100 %** | PR blocked |
| Pathological cases | **0 timeouts**, **0 throws** | PR blocked |
| Fuzzing | 0 crashes | Nightly only; blocks the next release |

### 11.3 The report we want on every run

```text
CommonMark 0.31.2 · profile=gfm · Node 24.14.1 · 2026-10-06

  semantic    652/652  (100.00%)  ✓ PASS
  spec-exact  649/652  ( 99.54%)  ✓ PASS  (3 allow-listed)

  §2.2  Tabs                                11/11   100%
  §2.4  Backslash escapes                   13/13   100%
  …
  §6.2  Emphasis and strong emphasis       132/132 100%   ← the one that matters
  §6.3  Links                               90/90   100%
  …

GFM 0.29-gfm · profile=gfm
  core (648)     630/648  ( 97.22%)  ✗ 18 failures
  extensions (24)  20/24   ( 83.33%)  ✗ 4 failures
    §4.10 Tables                     8/8    100%
    §5.3 Task list items             2/2    100%
    §6.5 Strikethrough               2/2    100%
    §6.9 Autolink literals          5/11    45%   ← our engine, still a work item
    §6.11 Disallowed raw HTML        1/1    100%
    (2 failures are the documented align-vs-style divergence)

Extensions (ours)  312/312  (100.00%)  ✓ PASS
Traps (ours)        72/72  (100.00%)  ✓ PASS
Pathological        21/21  within 5000 ms  ✓ PASS
  slowest: unclosed-emphasis-openers  41 ms
```

A per-section report is what makes the suite usable. "652/652" tells you nothing;
"§6.2 is 132/132" tells you where the risk is.

---

## 12. Maintenance

| Event | Action |
|-------|--------|
| CommonMark 0.32 releases | Add `commonmark/0.32/spec.json`; run **both** versions; diff the failing set; do **not** delete 0.31.2 |
| cmark-gfm updates `spec.txt` | Verify SHA-256, re-run, update `EXPECTED.json` with a dated entry |
| We add an extension | Four fixtures minimum ([§7.2](#72-the-four-fixture-rule)) + an ADR |
| We find a CommonMark bug | Report on <https://talk.commonmark.org/>; **do not** locally deviate — add a documented allow-list entry |
| A trap is fixed | Remove the fixture **in the same PR** that fixes it, and note the removal in the changelog |
| The allow-list grows by 5+ entries | Trigger an ADR review of our HTML renderer; a growing allow-list is a smell, not a strategy |

### 12.1 The doc-lint gate for [README §2.0](README.md#20-the-visible-glyph-convention)

These six files *show* Markdown inside Markdown, which is the easiest place in the
repo to silently corrupt a fixture. Four checks run in CI over
`research/02-syntax/*.md`; all four must pass before a docs PR merges.

| # | Check | Rule | Why it exists |
|:-:|-------|------|---------------|
| 1 | **Table well-formedness** | Every table row splits into the same number of cells as its header, using GFM §4.10 cell splitting (an unescaped `\|` always ends a cell) | A missing pipe silently merges two rows and the reference stops matching the source |
| 2 | **Span parseability** | No prose line contains a code span that cannot be parsed by CommonMark §6.1 | A run-together backtick pair makes the *documentation* mis-render, which is the one failure a reader cannot detect |
| 3 | **Glyph purity** | Inside a code span, TAB / LF / CR / NUL / BACKTICK never appear as content — they are written `→`, `␤`, `␍`, `␀`, `␃` | A real backtick written by hand where `␃` belongs closes the span early, so the reader sees the wrong syntax |
| 4 | **Provenance** | Every row citing `§X.Y Ex. N` decodes (glyphs → characters) to something reconstructible from that example in the vendored `spec.json` | The check that actually caught the corruption: a dropped space in Ex. 329 and a spurious trailing backtick in Ex. 349 |

**Escape hatch (three, and only three).** Check 3 permits a real character in
span content when:

- it is inside a **fenced** code block — those are real source, not citations;
- the span is quoting **JavaScript**, e.g. the `"\\`"` string literal in this
  document's harness listing;
- the span is README §2.0's own self-demonstration of a real backtick.

Anything else fails. When adding a row, write the glyph and not the character,
and run the gate before you open the PR.

### 12.2 What the gate has already caught

Kept as evidence that the gate earns its place in CI:

| Found | Where | Consequence had it shipped |
|-------|-------|------------------------------|
| `Ex. 329` shown as ``␃␃foo ␃bar␃␃`` — two spaces dropped | 02 §5 | A reader would conclude §6.1 strips interior spaces |
| `Ex. 349` HTML column carried a trailing ``␃`` that the spec does not emit | 02 §5 | The reference would have taught a wrong output; markdown-it and the spec agree, the doc did not |
| `Ex. 333`/`334` wrote U+00A0 as the ``␣`` SPACE glyph | 02 §5 | Would imply NBSP is stripped by §6.1 — the exact opposite of the rule |
| `Ex. 118` used two ``··`` MIDDLE DOTs for trailing spaces | 01 §7 | An undocumented glyph would have crept into every future fixture |
| Row 4 of 01 §8 pointed at a mangled fence glyph run | 01 §8.1 | Unreadable rationale for a real engineering decision |


---

## 13. Definition of done

The syntax reference is complete when:

- [ ] `packages/test-fixtures/commonmark/0.31.2/spec.json` is vendored, SHA-256-verified, and 652/652 semantic in the `commonmark` profile.
- [ ] `packages/test-fixtures/gfm/0.29-gfm/spec.txt` is vendored and its fence parser is covered by its own unit tests (tabs, empty example names, the `.` separator).
- [ ] All 350 project fixtures exist, each with `profile`, `tier`, `why`, and `specRef`.
- [ ] All 72 traps from [04 §13](04-edge-cases-and-traps.md#13-the-master-trap-table) exist.
- [ ] All 21 pathological shapes run inside a 5 s budget with zero throws.
- [ ] The three profile matrix jobs are green in CI and cannot be bypassed with `.skip`.
- [ ] The allow-list in `EXPECTED.json` has a comment and a URL for every entry.
- [ ] `packages/test-fixtures/README.md` carries the CC-BY-SA attribution.
- [ ] The **first** licence-scope decision is in an ADR.

**Previous:** [03-extensions-and-dialects.md](03-extensions-and-dialects.md)
**Up:** [README.md](README.md) · [research index](../README.md)
