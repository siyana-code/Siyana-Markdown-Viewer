# 02 — Inline elements

> **Scope.** Everything that appears *inside* a block's raw text: escapes,
> entities, code spans, emphasis, links, images, autolinks, raw inline HTML,
> hard and soft line breaks, and plain text.
>
> **Reading convention.** Same as [01](01-block-elements.md). Example numbers
> refer to **CommonMark 0.31.2** unless prefixed `GFM Ex.`. `→` is U+2192 as
> used by the spec for a real tab, and `␣`/trailing markers are called out in
> prose when trailing whitespace is significant.
>
> **Spec section map** (verified against <https://spec.commonmark.org/0.31.2/>):

| § | Title | Examples |
|---|-------|----------:|
| §6 (intro) | Inlines | 327 |
| §2.4 | Backslash escapes | 12–24 |
| §2.5 | Entity and numeric character references | 25–41 |
| §6.1 | Code spans | 328–349 |
| §6.2 | Emphasis and strong emphasis | **350–481 (132)** |
| §6.3 | Links | 482–571 (90) |
| §6.4 | Images | 572–593 (22) |
| §6.5 | Autolinks | 594–612 (19) |
| GFM §6.9 | Autolinks (extension) | 622–633 |
| §6.6 | Raw HTML | 613–632 (20) |
| §6.7 | Hard line breaks | 633–647 (15) |
| §6.8 | Soft line breaks | 648–649 (2) |
| §6.9 | Textual content | 650–652 (3) |

---

## 1. What "inline" means (§6)

```text
RULE (CM §6)

  Inlines are parsed SEQUENTIALLY from the beginning of the character stream
  to the end (left to right, in left-to-right languages).
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `` ␃hi␃lo␃ `` → `<p><code>hi</code>lo\`</p>␃ | **Valid**, §6 Ex. 327 | `hi` is parsed as code; the trailing backtick is literal. No backtracking to a longer code span |

The word **sequential** is the whole implementation strategy. Combined with
CM §3.1 (block structure first, then per-block inline parsing) and Appendix A,
the algorithm is:

```text
Phase 2 (Appendix A, "Phase 2: inline structure")
  walk the block tree
  for each paragraph / heading / table cell:
    scan its raw text left to right, maintaining a DELIMITER STACK
```

### 1.1 Inline precedence, in one table

When two constructs could match at the same position, this order decides. It is
derived from CM §6.1–6.6 and Appendix A.

| Rank | Construct | Authority | Beats |
|-----:|-----------|-----------|-------|
| 1 | Backslash escape | §2.4 | everything |
| 2 | Entity / numeric character reference | §2.5 | everything (but **cannot** create structure, §2.5) |
| 3 | Code span | §6.1 | emphasis, links |
| 4 | Raw HTML tag | §6.6 | emphasis, links |
| 5 | Autolink | §6.5 | emphasis, links |
| 6 | Link / image | §6.3 | emphasis |
| 7 | Emphasis / strong emphasis | §6.2 | nothing |
| 8 | Hard / soft line break | §6.7–6.8 | — |
| 9 | Plain text | §6.9 | — |

Ranks 3–5 all have the **same** precedence and are resolved by *"whoever starts
first"* (§6.1 examples 343–346). Ranks 3–5 beat 6, which beats 7:

| Syntax | Verdict | Note |
|--------|---------|------|
| `` *foo␃*␃ `` → `<p>*foo<code>*</code></p>` | **Valid**, §6.1 Ex. 341 | The second `*` is inside a code span, so it cannot close emphasis |
| `[not a \`link](/foo\`)` → `<p>[not a <code>link](/foo</code>)</p>` | **Valid**, §6.1 Ex. 342 | Code beats link |
| `` ␃<a href="␃">␃ `` → `<p><code>&lt;a href=&quot;</code>&quot;&gt;\`</p>␃ | **Valid**, §6.1 Ex. 343 | First-one-wins ⇒ code |
| `<a href="\`">` → `<p><a href="\`"></p>` | **Valid**, §6.1 Ex. 344 | First-one-wins ⇒ HTML tag |
| `` ␃<https://foo.bar.\␃baz>␃ `` → code | **Valid**, §6.1 Ex. 345 | |
| `<https://foo.bar.\`baz>␃ → autolink | **Valid**, §6.1 Ex. 346 | |
| `*[foo*](/uri)` → `<p>*<a href="/uri">foo*</a></p>` | **Valid**, §6.3 Ex. 521 | **Links beat emphasis.** CommonMark §6.2 rule 17 |
| `[foo *bar](baz*)` → `<p><a href="baz*">foo *bar</a></p>` | **Valid**, §6.3 Ex. 522 | |

---

## 2. Backslash escapes (CM §2.4, Examples 12–24)

```text
RULE (CM §2.4)

  Any ASCII PUNCTUATION character may be backslash-escaped.
```

### 2.1 The complete escapable set — ASCII punctuation, verbatim from §2.1

```text
   !  "  #  $  %  &  '  (  )        U+0021 – U+002F
   :  ;  <  =  >  ?  @               U+003A – U+0040
   [  \  ]  ^  _  `                  U+005B – U+0060
   {  |  }  ~                        U+007B – U+007E
```

That is **32 characters**. Note what is **not** there: space, tab, newline, and
every non-ASCII character — including `«`, `φ`, and `→`.

| Syntax | Verdict | Notes |
|--------|---------|-------|
| All 32 escaped punctuation in one line → all rendered literally | **Valid**, §2.4 Ex. 12 | The canonical "all escapes" fixture |
| `\→\A\a\ \3\φ\«` → `<p>\→\A\a\ \3\φ\«</p>` | **Invalid** (as escapes), §2.4 Ex. 13 | A backslash before a non-punctuation character is a **literal backslash**. This is why `\A` does not become `A` |
| `\*not emphasized*` → literal | **Valid**, §2.4 Ex. 14 | Escaped characters are *regular* characters afterwards |
| `\&ouml; not a character entity` → literal `&ouml;` | **Valid**, §2.4 Ex. 14 | Escape beats entity decoding |
| `\\*emphasis*` → `<p>\<em>emphasis</em></p>` | **Valid**, §2.4 Ex. 15 | An escaped backslash is literal, so the `*` still opens emphasis |
| `foo\` / `bar` → `<p>foo<br />\nbar</p>` | **Valid**, §2.4 Ex. 16 | A backslash at end of line is a **hard break** (§6.7), not an escape |
| ` ␃␃ \[\` ␃␃ ` → `<p><code>\[\`</code></p>` | **Valid**, §2.4 Ex. 17 | **Escapes do not work in code spans** |
| `    \[\]` (indented) / `~~~\n\[\]\n~~~` → literal | **Valid**, §2.4 Ex. 18–19 | Nor in code blocks |
| `<https://example.com?find=\*>` → `%5C*` | **Valid**, §2.4 Ex. 20 | Nor in autolinks |
| `<a href="/bar\/)">` → passed through raw | **Valid**, §2.4 Ex. 21 | Nor in raw HTML |
| `[foo](/bar\* "ti\*tle")` → `<a href="/bar*" title="ti*tle">foo</a>` | **Valid**, §2.4 Ex. 22 | **But** they *do* work in link destinations and titles |
| `[foo]: /bar\* "ti\*tle"` | **Valid**, §2.4 Ex. 23 | …and in reference definitions |
| ```` ␃␃␃ foo\+bar ```` → `class="language-foo+bar"` | **Valid**, §2.4 Ex. 24 | …and in fenced code info strings |

### 2.2 The three places that break naive escape handling

| Trap | Input | Correct | Naive |
|------|-------|---------|-------|
| Escape inside code | `` ␃\*␃ `` | `<code>*</code>` | `<code>\*</code>` |
| Escape inside raw HTML | `<a href="\*">` | raw `<a href="\*">` | `href="*"` |
| `\` before a non-punctuation char | `\A` | `\A` | `A` |
| `\\` before a punctuation char | `\\*` | `\` then `*` opens emphasis | `\` escapes the `\` so `*emphasis*` matches — **wrong** |
| `\` at EOL in a heading | `### foo\` | `<h3>foo\</h3>` (literal) | hard break inside a heading |

---

## 3. Entity and numeric character references (CM §2.5, Examples 25–41)

```text
RULE (CM §2.5)

  Valid HTML entity references and numeric character references may be used in
  place of the corresponding Unicode character, with these exceptions:

    (1) They are NOT recognized in code blocks and code spans.
    (2) They CANNOT stand in place of special characters that define
        structural elements in CommonMark.
```

The authoritative entity list is the WHATWG document
<https://html.spec.whatwg.org/entities.json>, as referenced by §2.5.

### 3.1 Grammar

| Form | Grammar | Range |
|------|---------|-------|
| Named | `&` + any valid HTML5 entity name + `;` | ~2 231 names |
| Decimal | `&#` + **1–7** arabic digits + `;` | U+0000–U+9FFFFF |
| Hexadecimal | `&#` + (`X` or `x`) + **1–6** hex digits + `;` | U+0000–U+10FFFF |

Limits came from CommonMark 0.29 (changelog: *"Limit numerical entities to 6 hex
or 7 decimal digits … This is all that is needed given the upper bound on
unicode code points"*), re-tested in 0.30 (*"Test new entity length constraints"*).

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `&nbsp; &amp; &copy; &AElig; &Dcaron;` / `&frac34; &HilbertSpace; &DifferentialD;` / `&ClockwiseContourIntegral; &ngE;` | **Valid**, §2.5 Ex. 25 | `&HilbertSpace;` is a single code point; `&DifferentialD;` is one; `&ngE;` is **two** code points (`≧` `̸`) |
| `&#35; &#1234; &#992; &#0;` → `# Ӓ Ϡ �` | **Valid**, §2.5 Ex. 26 | `&#0;` → U+FFFD |
| `&#X22; &#XD06; &#xcab;` | **Valid**, §2.5 Ex. 27 | Both `X` and `x` accepted |
| `&nbsp &x; &#; &#x` / `&#87654321;` / `&#abcdef0;` / `&ThisIsNotDefined; &hi?;` | **Invalid**, §2.5 Ex. 28 | No semicolon, empty, too many digits, too many hex digits, undefined name — all literal |
| `&copy` → `<p>&amp;copy</p>` | **Invalid**, §2.5 Ex. 29 | **HTML5 allows `&copy` without `;`; CommonMark deliberately does not**, "because it makes the grammar too ambiguous" |
| `&MadeUpEntity;` → literal | **Invalid**, §2.5 Ex. 30 | |
| `<a href="&ouml;&ouml;.html">` → raw, entities preserved | **Valid**, §2.5 Ex. 31 | Entities are **not** decoded inside raw HTML |
| `[foo](/f&ouml;&ouml; "f&ouml;&ouml;")` → `href="/f%C3%B6%C3%B6"` | **Valid**, §2.5 Ex. 32 | Decoded in destinations; percent-encoding policy not mandated |
| ```` ␃␃␃ f&ouml;&ouml; ```` → `class="language-föö"` | **Valid**, §2.5 Ex. 34 | Decoded in info strings |
| `` ␃f&ouml;&ouml;␃ `` → `<code>f&amp;ouml;&amp;ouml;</code>` | **Valid**, §2.5 Ex. 35 | Literal in code spans |
| `    f&ouml;f&ouml;` → literal in code block | **Valid**, §2.5 Ex. 36 | |
| `&#42;foo&#42;` / `*foo*` → `<p>*foo*\n<em>foo</em></p>` | **Valid**, §2.5 Ex. 37 | **Entities cannot create structure.** `&#42;` is a literal `*`, not a delimiter |
| `&#42; foo` / `* foo` → `<p>* foo</p><ul><li>foo</li></ul>` | **Valid**, §2.5 Ex. 38 | Same rule for bullet markers |
| `foo&#10;&#10;bar` → `<p>foo\n\nbar</p>` | **Valid**, §2.5 Ex. 39 | **`&#10;` does not create a line ending**, so no paragraph break |
| `&#9;foo` → `<p>→foo</p>` | **Valid**, §2.5 Ex. 40 | **`&#9;` is a literal tab, not indentation** |
| `[a](url &quot;tit&quot;)` → literal | **Valid**, §2.5 Ex. 41 | Entities are **not** recognized as title delimiters |

### 3.2 Renderer obligation

CM §1.3: *"Conforming CommonMark parsers need not store information about
whether a particular character was represented in the source using a Unicode
character or an entity reference."* We therefore **decode to the code point and
forget the provenance**. Consequence: we cannot round-trip
`&amp;` → `&amp;amp;`. That is correct.

---

## 4. Emphasis and strong emphasis (CM §6.2, Examples 350–481)

**This is the largest section of the spec: 132 of 652 examples (20.2 %).** It is
also the only place where a hand-written parser is most likely to be wrong.
Everything below is required reading for whoever implements it.

### 4.1 The definitions, verbatim in structure

```text
DEFINITION (CM §6.2)

  A DELIMITER RUN is either
    (a) a sequence of one or more * characters that is not preceded or followed
        by a non-backslash-escaped * character, or
    (b) a sequence of one or more _ characters that is not preceded or followed
        by a non-backslash-escaped _ character.

  A LEFT-FLANKING DELIMITER RUN is a delimiter run that is
    (1) not followed by Unicode whitespace, and
    either
    (2a) not followed by Unicode punctuation, or
    (2b) followed by Unicode punctuation and preceded by Unicode whitespace or
         Unicode punctuation.

  A RIGHT-FLANKING DELIMITER RUN is a delimiter run that is
    (1) not preceded by Unicode whitespace, and
    either
    (2a) not preceded by Unicode punctuation, or
    (2b) preceded by Unicode punctuation and followed by Unicode whitespace or
         Unicode punctuation.

  For purposes of these definitions, the BEGINNING AND THE END OF THE LINE
  count as Unicode whitespace.
```

### 4.2 Flanking classification table (from §6.2, verified against `markdown-it`)

| Input shape | Left-flanking? | Right-flanking? |
|-------------|:--------------:|:---------------:|
| `***abc` | **yes** | no |
| `  _abc` | **yes** | no |
| `**"abc"` | **yes** | no |
| ` _"abc"` | **yes** | no |
| `abc***` | no | **yes** |
| `abc_` | no | **yes** |
| `"abc"**` | no | **yes** |
| `"abc"_` | no | **yes** |
| `abc***def` | **yes** | **yes** |
| `"abc"_"def"` | **yes** | **yes** |
| `abc *** def` | no | no |
| `a _ b` | no | no |
| `$` (Unicode symbol, `Sc`) | counts as **punctuation** | counts as **punctuation** |
| `\u00a0` (non-breaking space) | counts as **whitespace** | counts as **whitespace** |

The last two rows are the ones naive implementations get wrong, and they have
dedicated fixtures (§6.2 Examples 353 and 354).

> **Historical note.** The idea of left-/right-flanking comes from Roopesh
> Chander's **vfmd**, which used the term *"emphasis indicator string"*. vfmd's
> rules are more complex than CommonMark's (§6.2 says so explicitly).

### 4.3 The 17 rules

CM §6.2 numbers its rules 1–17. They are reproduced here exactly, because the
implementation is a transcription of this list.

| # | Rule |
|---|------|
| 1 | A single `*` can **open** emphasis **iff** it is part of a left-flanking delimiter run. |
| 2 | A single `_` can **open** emphasis **iff** it is part of a left-flanking delimiter run **and either** (a) not part of a right-flanking delimiter run, **or** (b) part of a right-flanking delimiter run *preceded by* Unicode punctuation. |
| 3 | A single `*` can **close** emphasis **iff** it is part of a right-flanking delimiter run. |
| 4 | A single `_` can **close** emphasis **iff** it is part of a right-flanking delimiter run **and either** (a) not part of a left-flanking delimiter run, **or** (b) part of a left-flanking delimiter run *followed by* Unicode punctuation. |
| 5 | A double `**` can **open** strong emphasis **iff** it is part of a left-flanking delimiter run. |
| 6 | A double `__` can **open** strong emphasis **iff** it is part of a left-flanking delimiter run **and either** (a) not part of a right-flanking delimiter run, **or** (b) part of a right-flanking delimiter run preceded by Unicode punctuation. |
| 7 | A double `**` can **close** strong emphasis **iff** it is part of a right-flanking delimiter run. |
| 8 | A double `__` can **close** strong emphasis **iff** it is part of a right-flanking delimiter run **and either** (a) not part of a left-flanking delimiter run, **or** (b) part of a left-flanking delimiter run followed by Unicode punctuation. |
| 9 | Any nonempty sequence of inline elements can be the contents of an *emphasized* span. |
| 10 | Any nonempty sequence of inline elements can be the contents of a *strongly emphasized* span. |
| 11 | *(the `_`-excess rule, applied to `*`)* — see §4.4 |
| 12 | *(the same, applied to `_`)* — see §4.4 |
| 13 | A literal `*`/`_` character cannot occur at the beginning or end of `*`-delimited (resp. `_`-delimited) emphasis unless backslash-escaped. |
| 14 | Emphasis nesting resolution — see §4.5 |
| 15 | Overlap resolution — see §4.6 |
| 16 | Same-closer resolution — see §4.6 |
| 17 | Code spans, links, images, and HTML tags group more tightly than emphasis. |

### 4.4 The rule of three — the single most-missed rule

```text
RULE (CM §6.2, emphasis)

  Emphasis begins with a delimiter that can open emphasis and ends with a
  delimiter that can close emphasis, using the SAME character (_ or *) as the
  opening delimiter. The opening and closing delimiters must belong to SEPARATE
  delimiter runs.

  If ONE of the delimiters can BOTH open and close emphasis, then the SUM OF
  THE LENGTHS of the delimiter runs containing the opening and closing
  delimiters MUST NOT BE A MULTIPLE OF 3 UNLESS BOTH LENGTHS ARE MULTIPLES
  OF 3.

RULE (CM §6.2, strong emphasis)  -- identical, with length >= 2 delimiters
```

That is the **rule of three**. Both copies of it matter: one for `*`/`**`, one
for `_`/`__`.

| Syntax | Verdict | What the rule of three did |
|--------|---------|---------------------------|
| `*foo**bar*` → `<p><em>foo**bar</em></p>` | **Valid**, §6.2 Ex. 412 | `*` run len 1 + `**` run len 2 = 3, a multiple of 3, but not both multiples of 3 ⇒ **no match**. The alternative `<em>foo</em><em>**bar</em>` is precluded |
| `*foo**bar**baz*` → `<p><em>foo<strong>bar</strong>baz</em></p>` | **Valid**, §6.2 Ex. 411 | |
| `***foo** bar*` → `<p><em><strong>foo</strong> bar</em></p>` | **Valid**, §6.2 Ex. 413 | 3 + 2 = 5, not a multiple of 3 ⇒ match as `**` inside `*` |
| `*foo **bar***` → `<p><em>foo <strong>bar</strong></em></p>` | **Valid**, §6.2 Ex. 414 | 1 + 3 = 4 ⇒ match |
| `*foo**bar***` → `<p><em>foo<strong>bar</strong></em></p>` | **Valid**, §6.2 Ex. 415 | |
| `foo***bar***baz` → `<p>foo<em><strong>bar</strong></em>baz</p>` | **Valid**, §6.2 Ex. 416 | **Both** runs are length 3, so the sum (6) being a multiple of 3 does not block it. This is the 0.29 change: *"Match interior delimiter runs if lengths of both are multiples of 3 … gives better results on `a***b***c`"* (changelog 0.29) |
| `foo******bar*********baz` → `<p>foo<strong><strong><strong>bar</strong></strong></strong>***baz</p>` | **Valid**, §6.2 Ex. 417 | |
| `**foo*` → `<p>*<em>foo</em></p>` | **Valid**, §6.2 Ex. 442 | **Excess delimiters go OUTSIDE**, not inside |
| `*foo**` → `<p><em>foo</em>*</p>` | **Valid**, §6.2 Ex. 443 | |
| `***foo**` → `<p>*<strong>foo</strong></p>` | **Valid**, §6.2 Ex. 444 | |
| `****foo*` → `<p>***<em>foo</em></p>` | **Valid**, §6.2 Ex. 445 | |
| `**foo***` → `<p><strong>foo</strong>*</p>` | **Valid**, §6.2 Ex. 446 | |
| `*foo****` → `<p><em>foo</em>***</p>` | **Valid**, §6.2 Ex. 447 | |
| `foo ___` → literal | **Valid**, §6.2 Ex. 448 | |
| `foo _\__` → `<p>foo <em>_</em></p>` | **Valid**, §6.2 Ex. 449 | Escaped delimiter inside |
| `foo _*_` → `<p>foo <em>*</em></p>` | **Valid**, §6.2 Ex. 450 | Different character inside is fine |
| `foo _____` → literal | **Valid**, §6.2 Ex. 451 | |
| `foo __\___` → `<p>foo <strong>_</strong></p>` | **Valid**, §6.2 Ex. 452 | |
| `foo __*__` → `<p>foo <strong>*</strong></p>` | **Valid**, §6.2 Ex. 453 | |
| `__foo_` → `<p>_<em>foo</em></p>` | **Valid**, §6.2 Ex. 454 | |
| `_foo__` → `<p><em>foo</em>_</p>` | **Valid**, §6.2 Ex. 455 | |
| `___foo__` → `<p>_<strong>foo</strong></p>` | **Valid**, §6.2 Ex. 456 | |
| `____foo_` → `<p>___<em>foo</em></p>` | **Valid**, §6.2 Ex. 457 | |
| `__foo___` → `<p><strong>foo</strong>_</p>` | **Valid**, §6.2 Ex. 458 | |
| `_foo____` → `<p><em>foo</em>___</p>` | **Valid**, §6.2 Ex. 459 | |
| `**` alone → literal | **Valid**, §6.2 Ex. 420 | **No empty emphasis** |
| `****` alone → literal | **Valid**, §6.2 Ex. 421 | **No empty strong emphasis** |
| `__` alone → literal | **Valid**, §6.2 Ex. 434 | |
| `____` alone → literal | **Valid**, §6.2 Ex. 435 | |

### 4.5 Rule 14 — nesting resolution

```text
RULE (CM §6.2, rule 14)

  1. The number of nestings should be MINIMIZED. An interpretation
     <strong>…</strong> is always preferred to <em><em>…</em></em>.
  2. An interpretation <em><strong>…</strong></em> is ALWAYS preferred to
     <strong><em>…</em></strong>.
```

| Syntax | Verdict | Note |
|--------|---------|------|
| `***foo***` → `<p><em><strong>foo</strong></em></p>` | **Valid**, §6.2 Ex. 467 | `<em><strong>` beats `<strong><em>` |
| `_____foo_____` → `<p><em><strong><strong>foo</strong></strong></em></p>` | **Valid**, §6.2 Ex. 468 | Minimise nestings first, then rule 14's preference |
| `****foo****` → `<p><strong><strong>foo</strong></strong></p>` | **Valid**, §6.2 Ex. 464 | Strong inside strong **is** allowed |
| `****foo****` → `<p><strong><strong>foo</strong></strong></p>` | **Valid**, §6.2 Ex. 464 | |
| `__foo_ bar_` → `<p><em><em>foo</em> bar</em></p>` | **Valid**, §6.2 Ex. 408 | |
| `*foo *bar**` → `<p><em>foo <em>bar</em></em></p>` | **Valid**, §6.2 Ex. 409 | |
| `*foo **bar** baz*` → `<p><em>foo <strong>bar</strong> baz</em></p>` | **Valid**, §6.2 Ex. 410 | |
| `__foo __bar__ baz__` → `<p><strong>foo <strong>bar</strong> baz</strong></p>` | **Valid**, §6.2 Ex. 425 | **GFM 0.29 disagrees — see [05 §6](05-test-fixture-strategy.md#6-what-gfm-actually-diverges-on)** |
| `**foo **bar****` → `<p><strong>foo <strong>bar</strong></strong></p>` | **Valid**, §6.2 Ex. 427 | |
| `**foo*bar*baz**` → `<p><strong>foo<em>bar</em>baz</strong></p>` | **Valid**, §6.2 Ex. 429 | |
| `***foo* bar**` → `<p><strong><em>foo</em> bar</strong></p>` | **Valid**, §6.2 Ex. 430 | |
| `**foo *bar***` → `<p><strong>foo <em>bar</em></strong></p>` | **Valid**, §6.2 Ex. 431 | |
| `****foo** bar__` → `<p><strong><strong>foo</strong> bar</strong></p>` | **Valid**, §6.2 Ex. 426 | |
| `**_foo_**` → `<p><em><em>foo</em></em></p>` | **Valid**, §6.2 Ex. 461 | Rule 13 consequence: emphasis nested directly inside emphasis **must use different delimiters** |
| `***_foo_***` → `<p><em><em>foo</em></em></p>` | **Valid**, §6.2 Ex. 463 | |
| `******foo******` → `<p><strong><strong><strong>foo</strong></strong></strong></p>` | **Valid**, §6.2 Ex. 466 | Rule 13 applies to arbitrarily long runs |

### 4.6 Rules 15 and 16 — overlap resolution

```text
RULE (CM §6.2, rule 15)

  When two potential emphasis spans OVERLAP, so that the second begins before
  the first ends and ends after the first ends, THE FIRST TAKES PRECEDENCE.

RULE (CM §6.2, rule 16)

  When there are two potential emphasis spans with the SAME CLOSING DELIMITER,
  the SHORTER one (the one that OPENS LATER) takes precedence.
```

| Syntax | Verdict | Rule |
|--------|---------|------|
| `*foo _bar* baz_` → `<p><em>foo _bar</em> baz_</p>` | **Valid**, §6.2 Ex. 469 | 15 |
| `*foo __bar *baz bim__ bam*` → `<p><em>foo <strong>bar *baz bim</strong> bam</em></p>` | **Valid**, §6.2 Ex. 470 | 15 |
| `**foo **bar baz**` → `<p>**foo <strong>bar baz</strong></p>` | **Valid**, §6.2 Ex. 471 | 16 |
| `*foo *bar baz*` → `<p>*foo <em>bar baz</em></p>` | **Valid**, §6.2 Ex. 472 | 16 |

### 4.7 `*` versus `_`: the intraword rule

This is the single most visible behavioural difference between the two marker
characters.

| Syntax | Verdict | Note |
|--------|---------|------|
| `foo*bar*` → `<p>foo<em>bar</em></p>` | **Valid**, §6.2 Ex. 355 | **Intraword `*` emphasis IS allowed** |
| `5*6*78` → `<p>5<em>6</em>78</p>` | **Valid**, §6.2 Ex. 356 | |
| `*foo*bar` → `<p><em>foo</em>bar</p>` | **Valid**, §6.2 Ex. 370 | Closing intraword is fine |
| `foo**bar**` → `<p>foo<strong>bar</strong></p>` | **Valid**, §6.2 Ex. 381 | |
| `**foo**bar` → `<p><strong>foo</strong>bar</p>` | **Valid**, §6.2 Ex. 396 | |
| `foo_bar_` → literal | **Valid**, §6.2 Ex. 360 | **Intraword `_` emphasis is NOT allowed** |
| `5_6_78` → literal | **Valid**, §6.2 Ex. 361 | |
| `пристаням_стремятся_` → literal | **Valid**, §6.2 Ex. 362 | Cyrillic counts as alphanumeric, not punctuation |
| `aa_"bb"_cc` → literal | **Valid**, §6.2 Ex. 363 | The first run is right-flanking, the second left-flanking ⇒ no pair |
| `foo-_(bar)_` → `<p>foo-<em>(bar)</em></p>` | **Valid**, §6.2 Ex. 364 | **Exception:** both flanking *and* preceded by punctuation ⇒ opener allowed (rule 2b) |
| `foo__(bar)__` → `<p>foo-<strong>(bar)</strong></p>` | **Valid**, §6.2 Ex. 390 | |
| `_foo_bar` → literal | **Valid**, §6.2 Ex. 374 | |
| `_пристаням_стремятся` → literal | **Valid**, §6.2 Ex. 375 | |
| `_foo_bar_baz_` → `<p><em>foo_bar_baz</em></p>` | **Valid**, §6.2 Ex. 376 | The *inner* `_` are both preceded and followed by alphanumerics ⇒ never delimiters |
| `__foo__bar` → literal | **Valid**, §6.2 Ex. 400 | |
| `5__6__78` → literal | **Valid**, §6.2 Ex. 401 | |
| `пристаням__стремятся__` → literal | **Valid**, §6.2 Ex. 402 | |
| `__foo__bar__baz__` → `<p><strong>foo__bar__baz</strong></p>` | **Valid**, §6.2 Ex. 402 | |
| `_(bar)_.` → `<p><em>(bar)</em>.</p>` | **Valid**, §6.2 Ex. 377 | Rule 4b exception (closing both-flanking but followed by punctuation) |
| `__(bar)__.` → `<p><strong>(bar)</strong>.</p>` | **Valid**, §6.2 Ex. 403 | |

**Practical consequence.** `snake_case_words`, `__init__`, `my_var_`, `foo_1_2`
and file paths like `a_b_c.md` are all safe from accidental emphasis with `_`,
which is exactly why the spec is asymmetric. It is *not* a rendering bug; it is
the design.

### 4.8 The first 20 examples of the emphasis suite, verbatim

These are **Examples 350–369**, i.e. examples 1–20 of §6.2. Transcribed exactly
from <https://spec.commonmark.org/0.31.2/spec.json> and checked against
`markdown-it@15.0.2` on 2026-10-06 (all 20 reproduced identically). Use these as
the first 20 of your emphasis regression suite.

| # | Source | HTML | Rule exercised | `markdown-it` output |
|--:|--------|------|----------------|----------------------|
| 350 | `*foo bar*` | `<p><em>foo bar</em></p>` | Rule 1 + rule 3, plain case | ✅ match |
| 351 | `a * foo bar*` | `<p>a * foo bar*</p>` | Opener followed by whitespace ⇒ not left-flanking ⇒ rule 1 fails | ✅ match |
| 352 | `a*"foo"*` | `<p>a*&quot;foo&quot;*</p>` | Opener preceded by alphanumeric, followed by punctuation ⇒ neither 2a nor 2b ⇒ not left-flanking | ✅ match |
| 353 | `*␣a␣*` (U+00A0 around `a`) | `<p>*␣a␣*</p>` | **Unicode non-breaking space counts as whitespace** ⇒ opener not left-flanking | ✅ match |
| 354 | `*$*alpha.` / `*£*bravo.` / `*€*charlie.` | `<p>*$*alpha.</p>` ×3 | **Unicode symbols (`Sc`) count as punctuation** ⇒ not left-flanking | ✅ match |
| 355 | `foo*bar*` | `<p>foo<em>bar</em></p>` | **Intraword `*` is allowed** | ✅ match |
| 356 | `5*6*78` | `<p>5<em>6</em>78</p>` | Intraword, digits | ✅ match |
| 357 | `_foo bar_` | `<p><em>foo bar</em></p>` | Rule 2(a): left-flanking and not right-flanking (followed by space / preceded by BOL-whitespace) | ✅ match |
| 358 | `_ foo bar_` | `<p>_ foo bar_</p>` | Opener followed by whitespace ⇒ fails rule 2 | ✅ match |
| 359 | `a_"foo"_` | `<p>a_&quot;foo&quot;_</p>` | Same as 352 but for `_` | ✅ match |
| 360 | `foo_bar_` | `<p>foo_bar_</p>` | **Intraword `_` rejected** by rule 2's extra condition | ✅ match |
| 361 | `5_6_78` | `<p>5_6_78</p>` | Intraword, digits | ✅ match |
| 362 | `пристаням_стремятся_` | `<p>пристаням_стремятся_</p>` | Cyrillic = alphanumeric ⇒ intraword rejected | ✅ match |
| 363 | `aa_"bb"_cc` | `<p>aa_&quot;bb&quot;_cc</p>` | First `_` right-flanking only, second left-flanking only ⇒ cannot pair | ✅ match |
| 364 | `foo-_(bar)_` | `<p>foo-<em>(bar)</em></p>` | **Rule 2(b) escape hatch:** left-flanking *and* right-flanking, but preceded by punctuation ⇒ opener allowed | ✅ match |
| 365 | `_foo*` | `<p>_foo*</p>` | Rule 3: closing delimiter must match the opening character | ✅ match |
| 366 | `*foo bar *` | `<p>*foo bar *</p>` | Closer preceded by whitespace ⇒ not right-flanking | ✅ match |
| 367 | `*foo bar` / `*` | `<p>*foo bar\n*</p>` | **A line ending counts as whitespace** for flanking | ✅ match |
| 368 | `*(*foo)` | `<p>*(*foo)</p>` | Second `*` preceded by `(` (punctuation) and followed by `f` ⇒ not right-flanking | ✅ match |
| 369 | `*(*foo*)*` | `<p><em>(<em>foo</em>)</em></p>` | The positive counterpart of 368: the inner `*` pair works because rule-of-three allows 1+1=2 (not a multiple of 3) | ✅ match |

> **How the "markdown-it output" column was obtained.** All 20 pairs were read
> from `https://spec.commonmark.org/0.31.2/spec.json` (see
> [README §4.1](README.md#41-sha-256-of-the-machine-readable-inputs) for the
> pinned hash) and re-checked against `markdown-it@15.0.2` preset `commonmark` on
> 2026-10-06: **20 / 20 identical** at the semantic tier.
> When you transcribe these into fixtures, take them from `spec.json`, not from
> this table, so that a transcription slip cannot hide a real failure.

### 4.9 The delimiter-stack algorithm (Appendix A, "process emphasis")

CM Appendix A gives the reference algorithm. Reproduced because the rules alone
are not enough to guarantee linearity.

```text
PROCEDURE process emphasis (parameter: stack_bottom)

  Let current_position point to the element on the delimiter stack just above
  stack_bottom (or the first element if stack_bottom is NULL).

  Keep openers_bottom for each delimiter type (*, _), indexed to
    (a) the length of the closing delimiter run (modulo 3), AND
    (b) whether the closing delimiter can also be an OPENER.
  Initialise openers_bottom to stack_bottom.

  Repeat until we run out of potential CLOSERS:

    1. Move current_position forward until we find the first potential closer
       with delimiter * or _ (the potential closer closest to the beginning of
       the input — the first one in parse order).

    2. Look back in the stack (staying above stack_bottom and the
       openers_bottom for this delimiter type) for the first matching potential
       OPENER ("matching" means same delimiter).

    3. If one is found:
         a. If both closer and opener runs have length >= 2 => STRONG,
            otherwise regular.
         b. Insert an emph/strong node after the text node of the opener.
         c. Remove any delimiters BETWEEN the opener and closer from the stack.
         d. Remove 1 (regular) or 2 (strong) delimiters from the opening and
            closing text nodes. If they become empty, remove them and remove
            the corresponding stack element. If the closing node is removed,
            reset current_position to the next element in the stack.

    4. If none is found:
         a. Set openers_bottom to the element before current_position.
         b. If the closer at current_position is not a potential opener, remove
            it from the stack.
         c. Advance current_position.

  Afterwards, remove all delimiters above stack_bottom from the stack.
```

```text
PROCEDURE look for link or image  (Appendix A)

  On hitting a ] character:
    1. Look BACKWARDS through the delimiter stack for an opening [ or ![.
    2. If none: return a literal ] text node.
    3. If found but not ACTIVE: remove it from the stack, return literal ].
    4. If found and active: try to parse ahead for inline link/image,
       reference link/image, collapsed reference, or shortcut reference.
    5. If that fails: remove the opening delimiter from the stack, return ].
    6. If it succeeds:
         a. Return a link/image node whose children are the inlines after the
            text node pointed to by the opening delimiter.
         b. Run process emphasis on these inlines, with the [ opener as
            stack_bottom.
         c. Remove the opening delimiter.
         d. If it is a LINK (not an image), set all [ delimiters BEFORE the
            opening delimiter to INACTIVE.
```

**Delimiters are pushed on:** a run of `*` or `_` characters, or a `[` or `![`.
The text node is inserted with the symbols as literal content, and a pointer to
it goes on the stack. Each stack entry records: type, number of delimiters,
"active" flag (all start active), and whether it is a potential opener, a
potential closer, or both.

**Why `openers_bottom` is indexed by length mod 3 and by "can also open":** that
is the rule of three, encoded as an index so the search is amortised. Getting
this index wrong is exactly how an implementation becomes quadratic.

---

## 5. Code spans (CM §6.1, Examples 328–349)

```text
RULE (CM §6.1)

  A BACKTICK STRING is a string of one or more backtick characters (`) that is
  neither preceded nor followed by a backtick.

  A code span begins with a backtick string and ends with a backtick string of
  EQUAL LENGTH.

  Contents are normalized:
    1. Line endings are converted to SPACES.
    2. If the resulting string both begins and ends with a space character, but
       does not consist ENTIRELY of space characters, a SINGLE space is removed
       from the front and back.
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `` ␃foo␃ `` → `<p><code>foo</code></p>` | **Valid**, §6.1 Ex. 328 | |
| ` ␃␃ foo \` bar ␃␃ ` → `<p><code>foo \` bar</code></p>` | **Valid**, §6.1 Ex. 329 | Two backticks because the content contains one; also demonstrates one-space stripping |
| `` ␃ `` ```` ␃␃ ```` `` → ␃<p><code>``</code></p>␃ | **Valid**, §6.1 Ex. 330 | **The motivation for stripping** — lets you put a backtick at the edge |
| `` ␃  ``  ```` ␃␃ → ````<p><code> ␃␃ </code></p>␃ | **Valid**, §6.1 Ex. 331 | **Only ONE space per side is stripped** |
| `` ␃ a␃ `` → `<p><code> a</code></p>` | **Valid**, §6.1 Ex. 332 | Stripping requires BOTH sides |
| `` ␃␣b␣␃ `` (U+00A0) → spaces preserved | **Valid**, §6.1 Ex. 333 | **Only U+0020 is stripped, not Unicode whitespace** |
| `` ␃␣␃ `` and `` ␃␣␣␃ `` (only spaces) → preserved | **Valid**, §6.1 Ex. 334 | Changelog 0.29: *"Don't strip spaces in code span containing only spaces … allows one to include a code span with just spaces"* |
| ```` ␃␃\nfoo\nbar  \nbaz\n␃␃ ```` → `<p><code>foo bar   baz</code></p>` | **Valid**, §6.1 Ex. 335 | Line endings → spaces; interior runs of spaces preserved |
| `` ␃foo   bar \nbaz␃ `` → `<p><code>foo   bar  baz</code></p>` | **Valid**, §6.1 Ex. 337 | **Interior spaces are NOT collapsed** (0.29: *"Code spans: don't collapse interior space"*) |
| `` ␃foo\␃bar␃ `` → `<p><code>foo\</code>bar\`</p>␃ | **Valid**, §6.1 Ex. 338 | **Backslash escapes do not work**; the `\` is literal, so the backtick string closes early |
| ` ␃␃foo`bar␃␃ ` → `<p><code>foo\`bar</code></p>` | **Valid**, §6.1 Ex. 339 | "Backslash escapes are never needed, because one can always choose a string of n backticks" |
| `` ␃ `` ```` ␃␃ bar ```` `` → ␃<p><code>foo `` bar</code></p>␃ | **Valid**, §6.1 Ex. 340 | |
| ```` ␃␃␃foo␃␃ ```` → ````<p>␃␃␃foo␃␃</p>```` | **Valid**, §6.1 Ex. 347 | **Unclosed backtick string ⇒ literal backticks** |
| `` ␃foo `` → `<p>`foo</p>␃ | **Valid**, §6.1 Ex. 348 | |
| `` ␃foo``bar`` `` → `<p>`foo<code>bar</code></p>␃ | **Valid**, §6.1 Ex. 349 | **Opening and closing runs must be EQUAL length.** Here the ```` ␃␃ ```` after `foo` does not match the opening ` ` ␃ |

### 5.1 The CSS requirement

CM §6.1 says outright: *"browsers will typically collapse consecutive spaces
when rendering `<code>` elements, so it is recommended that the following CSS be
used: `code{white-space: pre-wrap;}`"*.

**We must ship this CSS.** Without it, CM Example 337 renders wrong in every
browser. This is one of the very few places the spec states a CSS requirement.

---

## 6. Links (CM §6.3, Examples 482–571)

**90 examples** — the second-largest section.

### 6.1 Link anatomy

```markdown
RULE (CM §6.3)

  A link contains link text, a link destination (the URI), and optionally a
  link title.

  LINK TEXT: a sequence of zero or more inline elements enclosed by [ and ].
    - Links may NOT contain other links, at any level of nesting. If multiple
      otherwise valid link definitions appear nested inside each other, the
      INNER-MOST definition is used.
    - Brackets are allowed in the link text only if (a) backslash-escaped, or
      (b) they appear as a MATCHED PAIR of brackets.
    - Backtick code spans, autolinks, and raw HTML tags bind more tightly than
      the brackets in link text.
    - The brackets in link text bind more tightly than emphasis markers.

  LINK DESTINATION: either
    (a) a sequence of zero or more characters between an opening < and a closing
        > that contains no line endings or UNESCAPED < or > characters, or
    (b) a nonempty sequence of characters that does not start with <, does not
        include ASCII control characters or space, and includes parentheses only
        if (a) backslash-escaped or (b) part of a balanced pair of unescaped
        parentheses.

        Implementations MAY impose limits on parentheses nesting, but AT LEAST
        THREE LEVELS of nesting should be supported.

  LINK TITLE: either
    (a) characters between straight double-quotes ("), including a " only if
        backslash-escaped, or
    (b) characters between straight single-quotes ('), including a ' only if
        backslash-escaped, or
    (c) characters between matching parentheses ((…)), including a ( or ) only
        if backslash-escaped.

  Titles may span multiple lines but may NOT contain a blank line.

  INLINE LINK = link text immediately followed by `(`, an optional destination,
  an optional title, and `)`. These four components may be separated by spaces,
  tabs, and UP TO ONE LINE ENDING. If both destination and title are present
  they must be separated by spaces, tabs, and up to one line ending.
```

### 6.2 Inline links

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `[link](/uri "title")` | **Valid**, §6.3 Ex. 482 | |
| `[link](/uri)` / `[link]()` / `[link](<>)` / `[link](/)` | **Valid**, §6.3 Ex. 483–486 | Destination may be empty |
| `[](./target.md)` → `<a href="./target.md"></a>` | **Valid**, §6.3 Ex. 484 | **Empty link text is legal** (added in 0.30: *"Add inline link examples with empty link text"*) |
| `[link](/my uri)` → literal | **Invalid**, §6.3 Ex. 488 | Spaces require `<…>` |
| `[link](</my uri>)` → `/my%20uri` | **Valid**, §6.3 Ex. 489 | Percent-encoding policy not mandated |
| `[link](foo` / `bar)` → literal | **Invalid**, §6.3 Ex. 490 | **No line endings in a destination, even inside `<…>`** |
| `[link](<foo` / `bar>)` → literal | **Invalid**, §6.3 Ex. 491 | |
| `[a](<b)c>)` → `href="b)c"` | **Valid**, §6.3 Ex. 492 | `)` is legal inside `<…>` |
| `[link](<foo\>)` → literal | **Invalid**, §6.3 Ex. 493 | **Pointy brackets enclosing the destination must be unescaped** |
| `[link](\(foo\))` → `href="(foo)"` | **Valid**, §6.3 Ex. 495 | |
| `[link](foo(and(bar)))` → `href="foo(and(bar))"` | **Valid**, §6.3 Ex. 496 | Balanced parens unescaped, unlimited |
| `[link](foo(and(bar))` → literal | **Invalid**, §6.3 Ex. 497 | Unbalanced |
| `[link](foo\(and\(bar\))` → `href="foo(and(bar)"` | **Valid**, §6.3 Ex. 498 | |
| `[link](foo\)\:)` → `href="foo):"` | **Valid**, §6.3 Ex. 500 | |
| `[link](#fragment)`, `[link](https://example.com?foo=3#frag)` | **Valid**, §6.3 Ex. 501 | |
| `[link](foo\bar)` → `href="foo%5Cbar"` | **Valid**, §6.3 Ex. 502 | **A backslash before a non-escapable character is a LITERAL backslash**, percent-encoded in the URL |
| `[link](foo%20b&auml;)` → `href="foo%20b%C3%A4"` | **Valid**, §6.3 Ex. 503 | Entity decoded; existing percent-escapes untouched |
| `[link]("title")` → `href="%22title%22"` | **Valid**, §6.3 Ex. 504 | **Titles can often be parsed as destinations, so omitting the destination silently swallows the title into the URL.** This is the single most surprising link fixture |
| `[link](/url "title")` / `'title'` / `(title)` | **Valid**, §6.3 Ex. 505 | All three delimiters |
| `[link](/url "title \"&quot;")` → `title="title &quot;&quot;"` | **Valid**, §6.3 Ex. 506 | Escapes and entities in titles |
| `[link](/url␣"title")` (U+00A0) → literal | **Invalid**, §6.3 Ex. 507 | **NBSP is not one of the permitted separators**; only space, tab, and one line ending |
| `[link](/url "title "and" title")` → literal | **Invalid**, §6.3 Ex. 508 | No nested same-type quotes without escapes |
| `[link](/url 'title "and" title')` → valid | **Valid**, §6.3 Ex. 509 | Use a different quote type |
| `[link](   /uri` / `  "title"  )` | **Valid**, §6.3 Ex. 510 | Whitespace and up to one line ending around components |
| `[link] (/uri)` → literal | **Invalid**, §6.3 Ex. 511 | **No whitespace between link text and `(`** |
| `[link [foo [bar]]](/uri)` | **Valid**, §6.3 Ex. 512 | Matched bracket pairs OK |
| `[link] bar](/uri)` → literal | **Invalid**, §6.3 Ex. 513 | Unbalanced |
| `[link [bar](/uri)` → `<p>[link <a href="/uri">bar</a></p>` | **Valid**, §6.3 Ex. 514 | **Link text grouping beats emphasis grouping** |
| `[link \[bar](/uri)` | **Valid**, §6.3 Ex. 515 | Escaped bracket |
| `[link *foo **bar** \`#\`*](/uri)` | **Valid**, §6.3 Ex. 516 | Link text is parsed as full inline content |
| `[![moon](moon.jpg)](/uri)` | **Valid**, §6.3 Ex. 517 | **Images may be link text** |
| `[foo [bar](/uri)](/uri)` → `[foo <a href="/uri">bar</a>](/uri)` | **Valid**, §6.3 Ex. 518 | **No nested links.** The inner one wins |
| `[foo *[bar [baz](/uri)](/uri)*](/uri)` | **Valid**, §6.3 Ex. 519 | Innermost wins |
| `![[[foo](uri1)](uri2)](uri3)` → `<img src="uri3" alt="[foo](uri2)" />` | **Valid**, §6.3 Ex. 520 | Same rule for images |
| `*[bar*](/url)` → `<p>*<a href="/url">bar*</a></p>` | **Valid**, §6.3 Ex. 521 | Rule 17 |
| `[foo *bar](baz*)` → `<a href="baz*">foo *bar</a>` | **Valid**, §6.3 Ex. 522 | |
| `*foo [bar* baz]` → `<p><em>foo [bar</em> baz]</p>` | **Valid**, §6.3 Ex. 523 | **Brackets that are NOT part of a link do not take precedence** |
| `[foo <bar attr="](baz)">` → literal | **Valid**, §6.3 Ex. 524 | Raw HTML binds more tightly |
| `[foo\`](/uri)\␃␃ → literal | **Valid**, §6.3 Ex. 525 | Code span binds more tightly |
| `[foo<https://example.com/?search=](uri)>` → autolink | **Valid**, §6.3 Ex. 526 | |

### 6.3 The three reference-link forms

```text
RULE (CM §6.3)

  FULL REFERENCE LINK      [text][label]     label matches a definition
  COLLAPSED REFERENCE LINK [label][]         equivalent to [label][label]
  SHORTCUT REFERENCE LINK  [label]           not followed by [] or a label
                                           equivalent to [label][]

  LINK LABEL begins with [ and ends with the FIRST ] that is not
  backslash-escaped. Between the brackets there must be at least one character
  that is not a space, tab, or line ending.

  Unescaped square brackets are NOT allowed inside the label's brackets.
  A LINK LABEL CAN HAVE AT MOST 999 CHARACTERS inside the square brackets.
```

**Label normalization** (this is what "matches" means):

```text
RULE (CM §6.3)

  To normalize a label:
    1. strip off the opening and closing brackets,
    2. perform the UNICODE CASE FOLD,
    3. strip leading and trailing spaces, tabs, and line endings,
    4. collapse consecutive internal spaces, tabs, and line endings to a
       single space.
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `[foo][bar]` + `[bar]: /url "title"` | **Valid**, §6.3 Ex. 527 | |
| `[foo][BaR]` + `[bar]: /url` → resolves | **Valid**, §6.3 Ex. 539 | Case-insensitive |
| `[ẞ]` + `[SS]: /url` → resolves | **Valid**, §6.3 Ex. 540 | **Full Unicode case fold**, not ASCII uppercase. 0.30 note: *"Use better example to test unicode case fold … The earlier test could be passed by implementations that just uppercase"* |
| `[Foo` / `  bar]: /url` + `[Baz][Foo bar]` → resolves | **Valid**, §6.3 Ex. 541 | Internal whitespace collapses |
| `[foo] [bar]` + `[bar]: /url` → `[foo] <a…>bar</a>` | **Valid**, §6.3 Ex. 542 | **No whitespace allowed between link text and label.** 0.23 change, to prevent accidental capture of consecutive shortcut references |
| `[foo]` / `[bar]` → two paragraphs, `bar` linked | **Valid**, §6.3 Ex. 543 | |
| `[foo]: /url1` / `[foo]: /url2` → `/url1` | **Valid**, §6.3 Ex. 544 | First definition wins. Spec notes *"It is desirable in such cases to emit a warning"* |
| `[bar][foo\!]` + `[foo!]: /url` → **no match** | **Valid**, §6.3 Ex. 545 | Matching is on the **raw normalized string**, not on parsed inline content |
| `[foo][ref[]` → literal | **Invalid**, §6.3 Ex. 546 | Unescaped brackets in label |
| `[[[foo]]]` → literal | **Invalid**, §6.3 Ex. 548 | |
| `[foo][ref\[]` + `[ref\[]: /uri` → resolves | **Valid**, §6.3 Ex. 549 | Escaped bracket allowed in label |
| `[bar\\]: /uri` + `[bar\\]` → `bar\` | **Valid**, §6.3 Ex. 550 | In this example the `]` is **not** backslash-escaped |
| `[]` + `[]: /uri` → literal | **Invalid**, §6.3 Ex. 551 | Label must contain a non-space/tab/EOL character |
| `[foo][]` | **Valid**, §6.3 Ex. 553 | Collapsed |
| `[*foo* bar][]` | **Valid**, §6.3 Ex. 554 | Label content is parsed as inlines |
| `[Foo][]` + `[foo]:` → resolves | **Valid**, §6.3 Ex. 555 | |
| `[foo] ` / `[]` → the `[]` is literal | **Valid**, §6.3 Ex. 556 | No whitespace between the two bracket groups |
| `[foo]` + `[foo]: /url` | **Valid**, §6.3 Ex. 557 | Shortcut |
| `[[*foo* bar]]` → `[<a…><em>foo</em> bar</a>]` | **Valid**, §6.3 Ex. 559 | Nested brackets in a shortcut label |
| `[[bar [foo]` → `[[bar <a href="/url">foo</a>` | **Valid**, §6.3 Ex. 560 | Unbalanced outer bracket |
| `\[foo]` + `[foo]: /url` → literal `[foo]` | **Valid**, §6.3 Ex. 563 | |
| `[foo*]: /url` + `*[foo*]` → `*<a>foo*</a>` | **Valid**, §6.3 Ex. 564 | Label ends at the first `]` |
| `[foo][bar]` with `[foo]` **and** `[bar]` defined → `/url2` | **Valid**, §6.3 Ex. 565 | **Full references beat shortcut references** |
| `[foo][]` with only `[foo]` defined | **Valid**, §6.3 Ex. 566 | |
| `[foo]()` with `[foo]: /url1` → `href=""` | **Valid**, §6.3 Ex. 567 | **Inline links take precedence over references** |
| `[foo](not a link)` + `[foo]: /url1` → `<a href="/url1">foo</a>(not a link)` | **Valid**, §6.3 Ex. 568 | A *failed* inline link falls through to a shortcut reference |
| `[foo][bar][baz]` with only `[baz]` → `[foo]<a>bar</a>` | **Valid**, §6.3 Ex. 569 | `bar` matched, `foo` did not |
| `[foo][bar][baz]` with `[baz]` and `[bar]` → `[foo]`→`/url2`, `bar`→`/url2`, `baz`→`/url1` | **Valid**, §6.3 Ex. 570 | |
| `[foo][bar][baz]` with `[baz]` and `[foo]` → `[foo]<a>bar</a>` | **Valid**, §6.3 Ex. 571 | `[foo]` is **not** a shortcut reference because it is followed by a label, even though `[bar]` is undefined |

### 6.4 The 999-character label limit

CM §6.3 states the limit without a dedicated example. **Our fixture must
include** a label of exactly 999 characters (must match) and 1000 characters
(must not match). This is a cheap defence against a pathological
label-scanning loop. → [04 §8](04-edge-cases-and-traps.md#8-link-label-nesting-and-the-999-character-limit)

---

## 7. Images (CM §6.4, Examples 572–593)

```text
RULE (CM §6.4)

  Syntax for images is like the syntax for links, with ONE difference: instead
  of link text there is an IMAGE DESCRIPTION. The rules are the same as for link
  text, except that

    (a) an image description starts with ![ rather than [, and
    (b) an IMAGE DESCRIPTION MAY CONTAIN LINKS.
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `![foo](/url "title")` → `<img src="/url" alt="foo" title="title" />` | **Valid**, §6.4 Ex. 572 | |
| `![foo *bar*]` + `[foo *bar*]: train.jpg "train & tracks"` → `alt="foo bar"` | **Valid**, §6.4 Ex. 573 | **`alt` is the PLAIN STRING content only** — no formatting, no tags |
| `![foo ![bar](/url)](/url2)` → `src="/url2" alt="foo bar"` | **Valid**, §6.4 Ex. 574 | Nested image allowed |
| `![foo [bar](/url)](/url2)` → `alt="foo bar"` | **Valid**, §6.4 Ex. 575 | **Links allowed in the description** (the exception in the rule) |
| `![foo *bar*][]` + `[foo *bar*]: train.jpg` | **Valid**, §6.4 Ex. 576 | Collapsed |
| `![foo *bar*][foobar]` + `[FOOBAR]: train.jpg` | **Valid**, §6.4 Ex. 577 | Case-insensitive |
| `![](/url)` → `<img src="/url" alt="" />` | **Valid**, §6.4 Ex. 581 | Empty description legal |
| `![[foo]]` + `[[foo]]: /url "title"` → literal | **Invalid**, §6.4 Ex. 590 | Unescaped brackets in label |
| `!\[foo]` + `[foo]: /url` → literal `![foo]` | **Valid**, §6.4 Ex. 592 | Escape the `[` |
| `\![foo]` + `[foo]: /url` → `!<a href="/url">foo</a>` | **Valid**, §6.4 Ex. 593 | Escape the `!` instead |

### 7.1 Renderer obligations for images

CM §6.4 recommends: *"in rendering to HTML, only the plain string content of the
image description be used."* We must therefore strip all inline markup when
computing `alt`, and additionally strip quotes and newlines when the description
spans lines. Note that `title="train &amp; tracks"` in Example 573 shows the
title **is** entity-escaped in the attribute.

---

## 8. Autolinks (CM §6.5, Examples 594–612)

```markdown
RULE (CM §6.5)

  Autolinks are ABSOLUTE URIs and EMAIL ADDRESSES inside < and >. They are
  parsed as links, with the URL or email address as the link label.

  URI AUTOLINK: < + absolute URI + >
    An absolute URI = a SCHEME + ":" + zero or more characters other than ASCII
    control characters, space, <, and >. If the URI includes these characters
    they must be percent-encoded.
    A SCHEME is 2–32 characters beginning with an ASCII letter and followed by
    any combination of ASCII letters, digits, +, ., or -.

  EMAIL AUTOLINK: < + email address + >
    Label = the email; URL = mailto: + the email.
    The email matches the non-normative HTML5 regex:
      /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?
        (?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `<http://foo.bar.baz>` | **Valid**, §6.5 Ex. 594 | |
| `<https://foo.bar.baz/test?q=hello&id=22&boolean>` | **Valid**, §6.5 Ex. 595 | `&` becomes `&amp;` in output |
| `<irc://foo.bar:2233/baz>` | **Valid**, §6.5 Ex. 596 | Scheme need not be registered |
| `<MAILTO:FOO@BAR.BAZ>` | **Valid**, §6.5 Ex. 597 | Uppercase fine |
| `<a+b+c:d>` | **Valid**, §6.5 Ex. 598 | |
| `<made-up-scheme://foo,bar>`, `<https://../>`, `<localhost:5001/foo>` | **Valid**, §6.5 Ex. 599–601 | |
| `<https://foo.bar/baz bim>` → escaped | **Invalid**, §6.5 Ex. 602 | **Spaces not allowed in autolinks** |
| `<https://example.com/\[\>` → `%5C%5B%5C` | **Valid**, §6.5 Ex. 603 | **Backslash escapes do not work inside autolinks** |
| `<foo@bar.example.com>` → `mailto:` | **Valid**, §6.5 Ex. 604 | |
| `<foo+special@Bar.baz-bar0.com>` | **Valid**, §6.5 Ex. 605 | |
| `<foo\+@bar.example.com>` → escaped | **Invalid**, §6.5 Ex. 606 | No escapes in email autolinks |
| `<>` → `&lt;&gt;` | **Invalid**, §6.5 Ex. 607 | |
| `< https://foo.bar >` → escaped | **Invalid**, §6.5 Ex. 608 | No whitespace |
| `<m:abc>` → escaped | **Invalid**, §6.5 Ex. 609 | Scheme must be **2–32** chars, `m` is 1 |
| `<foo.bar.baz>` → escaped | **Invalid**, §6.5 Ex. 610 | No `@`, no scheme |
| `https://example.com` → plain text | **Invalid** (in CommonMark), §6.5 Ex. 611 | **This is what GFM §6.9 changes** |
| `foo@bar.example.com` → plain text | **Invalid** (in CommonMark), §6.5 Ex. 612 | Same |

### 8.1 GFM autolink literals (GFM §6.9, Examples 622–633)

```text
RULE (GFM §6.9)

  Autolinks can be constructed WITHOUT < and >, but under a smaller set of
  circumstances. All such recognized autolinks can only come at the BEGINNING OF
  A LINE, AFTER WHITESPACE, or after any of the delimiting characters *, _, ~, (.

  EXTENDED WWW AUTOLINK: recognized when the text "www." is followed by a VALID
  DOMAIN. A valid domain = segments of alphanumerics, _ and - separated by .
  There must be at least one period, and NO UNDERSCORES in the last two segments.
  The scheme http is inserted automatically.

  EXTENDED URL AUTOLINK: recognized when one of the schemes http:// or https://
  is followed by a valid domain, then zero or more non-space non-< characters
  subject to PATH VALIDATION.

  EXTENDED EMAIL AUTOLINK: recognized within any text node, per the rules below.
  mailto: is added automatically.

  EXTENDED PROTOCOL AUTOLINK: mailto: or xmpp: followed by a valid email.
```

**Path validation** (all four rules, verbatim intent from GFM §6.9):

| Rule | Fixture | Result |
|------|---------|--------|
| Trailing `?` `!` `.` `,` `:` `*` `_` `~` are **not** part of the link | GFM Ex. 624 `Visit www.commonmark.org.` → link is `www.commonmark.org` | But `.` **may** appear in the interior: `www.commonmark.org/a.b.` → link is `www.commonmark.org/a.b` |
| If it ends in `)`, count all parens; if there are more closing than opening, unmatched trailing `)` are excluded | GFM Ex. 625 | `www.google.com/search?q=Markup+(business)` links fully; `…+(business)))` leaves `))` outside |
| Paren check **only** applies when the link ends in `)` | GFM Ex. 626 | `www.google.com/search?q=(business))+ok` links fully |
| If it ends in `;`, and the preceding text looks like `&` + alphanumerics, exclude it | GFM Ex. 627 | `…?q=commonmark&hl=en` links; `…&hl;` stops before `&hl;` |
| `<` immediately ends the autolink | GFM Ex. 628 | `www.commonmark.org/he<lp` → link is `/he` |
| Email: `.` `-` `_` `+` allowed before `@`; **only `.` may end it** | GFM Ex. 631, 632 | `a.b-c_d@a.b-` and `…a.b_` are **not** links; `…a.b.` links and the trailing `.` stays outside |
| Email: last char of the domain must not be `-` or `_` | GFM Ex. 632 | |

### 8.2 Measured behaviour of a real parser on GFM §6.9

We ran `markdown-it@15.0.2` with `linkify: true` against the GFM spec's
extension examples on 2026-10-06:

| Configuration | GFM extension examples passed |
|----------------|------------------------------:|
| `markdown-it` with `linkify: true` | **3 / 11** |
| `markdown-it` with `linkify: false` | **0 / 11** |
| `markdown-it` all GFM examples | 643 / 672 = 95.68 % |

Probes of the same build:

| Input | Output |
|-------|--------|
| `www.commonmark.org` | `www.commonmark.org` — **not linkified** |
| `visit http://example.com now` | `visit <a href="http://example.com">http://example.com</a> now` |
| `mail me at foo@bar.baz` | `mail me at <a href="mailto:foo@bar.baz">foo@bar.baz</a>` |
| `see https://x.co/a.` | `see <a href="https://x.co/a">https://x.co/a</a>.` |

**Conclusion.** `markdown-it`'s `linkify` implements the *scheme* and *email*
parts of GFM §6.9 but **not** the `www.` part, and its paren/punctuation
handling differs from the spec. If we ship bare-URL linkification, it must be
our own rule engine matching GFM §6.9 exactly, with fixtures from GFM Examples
622–633. → [03 §5](03-extensions-and-dialects.md#5-gfm-autolink-literals-gfm-69)

---

## 9. Raw inline HTML (CM §6.6, Examples 613–632)

```text
RULE (CM §6.6)

  Text between < and > that looks like an HTML tag is parsed as a raw HTML tag
  and will be rendered in HTML WITHOUT ESCAPING. Tag and attribute names are
  not limited to current HTML tags, so custom tags (and even DocBook tags) may
  be used.
```

Grammar, transcribed from §6.6:

| Term | Definition |
|------|-----------|
| **tag name** | An ASCII letter followed by zero or more ASCII letters, digits, or hyphens (-) |
| **attribute** | Spaces, tabs, and up to one line ending; an attribute name; an optional attribute value specification |
| **attribute name** | An ASCII letter, `_`, or `:`, followed by zero or more ASCII letters, digits, `_`, `.`, `:`, or `-`. (XML restricted to ASCII; HTML5 is laxer) |
| **attribute value specification** | Optional spaces/tabs and up to one line ending, `=`, optional spaces/tabs and up to one line ending, and a value |
| **unquoted value** | A nonempty string of characters **not** including spaces, tabs, line endings, `"`, `'`, `=`, `<`, `>`, or `` ␃ `` |
| **single-quoted value** | `'`, zero or more characters not including `'`, and a final `'` |
| **double-quoted value** | `"`, zero or more characters not including `"`, and a final `"` |
| **open tag** | `<`, tag name, zero or more attributes, optional spaces/tabs and up to one line ending, an optional `/`, and `>` |
| **closing tag** | `</`, tag name, optional spaces/tabs and up to one line ending, and `>` |
| **HTML comment** | `<!-->`, `<!--->`, or `<!--`, a string not containing `-->`, and `-->` |
| **processing instruction** | `<?`, a string not containing `?>`, and `?>` |
| **declaration** | `<!`, an ASCII letter, zero or more characters not containing `>`, and `>` |
| **CDATA section** | `<![CDATA[`, a string not containing `]]>`, and `]]>` |

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `<a><bab><c2c>` | **Valid**, §6.6 Ex. 613 | Custom/foreign tags fine |
| `<a/><b2/>` | **Valid**, §6.6 Ex. 614 | Void elements |
| `<a  /><b2` / `data="foo" >` | **Valid**, §6.6 Ex. 615 | Whitespace incl. one line ending inside a tag |
| `<a foo="bar" bam = 'baz <em>"</em>'` / `_boolean zoop:33=zoop:33 />` | **Valid**, §6.6 Ex. 616 | Mixed quote styles, boolean attributes, colons in names |
| `Foo <responsive-image src="foo.jpg" />` | **Valid**, §6.6 Ex. 617 | Custom element |
| `<33> <__>` → escaped | **Invalid**, §6.6 Ex. 618 | Tag name must start with an ASCII letter |
| `<a h*#ref="hi">` → escaped | **Invalid**, §6.6 Ex. 619 | Illegal attribute name |
| `<a href="hi'> <a href=hi'>` → escaped | **Invalid**, §6.6 Ex. 620 | Illegal attribute values |
| `< a><` / `foo><bar/ >` / `<foo bar=baz` / `bim!bop />` → escaped | **Invalid**, §6.6 Ex. 621 | Illegal whitespace |
| `<a href='bar'title=title>` → escaped | **Invalid**, §6.6 Ex. 622 | **Missing whitespace between attributes** |
| `</a></foo >` | **Valid**, §6.6 Ex. 623 | Closing tag |
| `</a href="foo">` → escaped | **Invalid**, §6.6 Ex. 624 | No attributes in closing tags |
| `foo <!-- this is a --` / `comment - with hyphens -->` | **Valid**, §6.6 Ex. 625 | Hyphens inside comments are fine |
| `foo <!--> foo -->` | **Valid**, §6.6 Ex. 626 | `<!-->` and `<!--->` are complete comments |
| `foo <?php echo $a; ?>` | **Valid**, §6.6 Ex. 627 | PI |
| `foo <!ELEMENT br EMPTY>` | **Valid**, §6.6 Ex. 628 | Declaration |
| `foo <![CDATA[>&<]]>` | **Valid**, §6.6 Ex. 629 | CDATA |
| `foo <a href="&ouml;">` → **raw, entity preserved** | **Valid**, §6.6 Ex. 630 | Entities are NOT decoded in raw HTML |
| `foo <a href="\*">` → raw | **Valid**, §6.6 Ex. 631 | **Backslash escapes do not work in HTML attributes** |
| `<a href=\"">` → escaped | **Invalid**, §6.6 Ex. 632 | The `"` closes the attribute |

> **0.31 change.** Changelog 0.31: *"Remove restrictive limitation on inline
> comments; now we match the HTML spec."* The comment grammar above is the
> current one.

### 9.1 Security implications

Inline HTML is the *higher*-risk of the two raw-HTML paths because it appears
inside a `<p>` we generated, and because attribute values can carry
`onerror=`, `style=`, and `javascript:`.

| Risk | Must-do |
|------|---------|
| `<img src=x onerror=alert(1)>` | Attribute allow-list; strip every `on*` |
| `<a href="javascript:…">` | Scheme allow-list at render time |
| `<style>` / `<link rel=stylesheet>` inside a paragraph | Strip entirely, or scope |
| `<iframe>` / `<object>` / `<embed>` | Strip |
| Malformed HTML that breaks out of the DOM tree | Render into a scoped root; never string-concatenate into our own document |
| Attribute-value injection into *our* elements | We never copy user attribute values into our own attributes — §6.6 tags stay tags or get stripped, they are never reinterpreted |

---

## 10. Hard line breaks (CM §6.7, Examples 633–647)

```text
RULE (CM §6.7)

  A line ending — NOT in a code span or HTML tag — that is PRECEDED BY TWO OR
  MORE SPACES and does NOT occur at the end of a block is parsed as a hard line
  break, rendered as <br />.
```

There is a second, more visible syntax: a **backslash before the line ending**
(§2.4 Ex. 16).

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `foo␣␣` / `baz` → `<p>foo<br />\nbaz</p>` | **Valid**, §6.7 Ex. 633 | |
| `foo\` / `baz` → `<p>foo<br />\nbaz</p>` | **Valid**, §6.7 Ex. 634 | |
| `foo␣␣␣␣␣␣␣` / `baz` → `<br />` | **Valid**, §6.7 Ex. 635 | **More than two is fine** |
| `foo␣␣` / `     bar` → `<br />` then `bar` | **Valid**, §6.7 Ex. 636 | **Leading spaces on the next line are ignored** |
| `*foo␣␣` / `bar*` → `<em>foo<br />\nbar</em>` | **Valid**, §6.7 Ex. 638 | Breaks work inside emphasis |
| `` ␃code␣␣ `` / `span` ␃␃ → `<code>code   span</code>` | **Valid**, §6.7 Ex. 640 | **No break inside a code span** — the 2 spaces survive as code |
| `` ␃code\␃ `` / `span` ␃␃ → `<code>code\ span</code>` | **Valid**, §6.7 Ex. 641 | Nor with a backslash |
| `<a href="foo␣␣` / `bar">` → raw, spaces preserved | **Valid**, §6.7 Ex. 642 | **No break inside an HTML tag** |
| `<a href="foo\` / `bar">` → raw | **Valid**, §6.7 Ex. 643 | |
| `foo\` alone → `<p>foo\</p>` | **Invalid**, §6.7 Ex. 644 | **Neither syntax works at the end of a block** |
| `foo␣␣` alone → `<p>foo</p>` | **Invalid**, §6.7 Ex. 645 | Same |
| `### foo\` → `<h3>foo\</h3>` | **Invalid**, §6.7 Ex. 646 | |
| `### foo␣␣` → `<h3>foo</h3>` | **Invalid**, §6.7 Ex. 647 | |

### 10.1 The "relaxed rule" that is not actually relaxed

Gruber's original says you must *end a line with two or more spaces*. CommonMark
is strictly more permissive in two ways and strictly less in one:

| Situation | Gruber | CommonMark |
|-----------|--------|------------|
| Two trailing spaces mid-paragraph | break | break |
| **More than two trailing spaces** | break | break (Ex. 635) — same |
| **Trailing spaces at end of paragraph** | break-ish | **stripped** (§4.8 Ex. 226) — **not** a break |
| Trailing backslash | not a syntax | break (Ex. 634) — **new** |

The relaxation people remember is the backslash. The gotcha people hit is the
last-row: a `<br>` you wanted at the bottom of a paragraph does not exist.

**Renderer note.** Many viewers (including Obsidian, by default) offer a
"Strict line breaks" setting that turns *every* newline into `<br>`. Obsidian's
docs describe exactly the three CM behaviours and gate them behind that setting.
We should offer the same toggle, defaulting to **CM behaviour**.

---

## 11. Soft line breaks (CM §6.8, Examples 648–649)

```text
RULE (CM §6.8)

  A regular line ending — not in a code span or HTML tag — that is not
  preceded by two or more spaces or a backslash is parsed as a SOFTBREAK.

  A soft line break may be rendered in HTML either as a line ending or as a
  space. The result will be the same in browsers.
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `foo` / `baz` → `<p>foo\nbaz</p>` | **Valid**, §6.8 Ex. 648 | |
| `foo␣` / `␣baz` → `<p>foo\nbaz</p>` | **Valid**, §6.8 Ex. 649 | **Spaces at end of the line AND beginning of the next line are removed** |

**Implementation decision.** Emit `\n` in the HTML source and set
`p { white-space: pre-wrap; }`? **No.** The spec explicitly allows either, and
`\n` in HTML source collapses to a space unless `white-space` is changed — which
would break indentation in `pre`. We emit a **literal space**, which is robust
under every inherited `white-space` value. The optional "hard breaks everywhere"
toggle then rewrites softbreaks to `<br />` at render time.

---

## 12. Textual content (CM §6.9, Examples 650–652)

```text
RULE (CM §6.9)

  Any characters not given an interpretation by the above rules will be parsed
  as plain textual content.
```

| Syntax | Verdict | Notes |
|--------|---------|-------|
| `hello $.;'there` | **Valid**, §6.9 Ex. 650 | |
| `Foo χρῆν` | **Valid**, §6.9 Ex. 651 | |
| `Multiple␣␣␣␣␣spaces` → preserved verbatim | **Valid**, §6.9 Ex. 652 | **Interior spaces in text are preserved exactly.** HTML collapses them unless we emit `white-space: pre-wrap` on prose containers or replace them with `&nbsp;`. **Design decision: preserve them in the AST; normalise in CSS.** |

---

## 13. Inline-parser checklist

- [ ] Every one of the **32** ASCII punctuation characters is escapable; everything else is not (§2.4 Ex. 12–13).
- [ ] `\X` for non-punctuation `X` yields a **literal backslash plus X** (§2.4 Ex. 13).
- [ ] `\\` consumes both backslashes; the following character is then unescaped (§2.4 Ex. 15).
- [ ] Entities are not recognised in code spans/blocks, and cannot create structure (§2.5 Ex. 37–40).
- [ ] Numeric limits are 1–7 decimal, 1–6 hex (§2.5 Ex. 26–28).
- [ ] Code span backtick strings must match **exactly** in length; unclosed ⇒ literal (§6.1 Ex. 347–349).
- [ ] Code span strips **one** space per side, only if **both** sides have one and the content is not **all** spaces (§6.1 Ex. 331–334).
- [ ] Code span converts line endings to spaces and does **not** collapse interior runs (§6.1 Ex. 335, 337).
- [ ] Flanking classification uses **Unicode** whitespace and **Unicode** punctuation, with BOL/EOL as whitespace (§6.2).
- [ ] `_` openers/closers carry the extra intraword condition (rules 2, 4, 6, 8) — §6.2 Examples 360–403.
- [ ] The **rule of three** is implemented, including the both-multiples-of-3 exception (§6.2 Ex. 412–417).
- [ ] Excess delimiters render **outside** the span, not inside (§6.2 Ex. 442–459).
- [ ] No empty emphasis or strong emphasis (§6.2 Ex. 420, 421, 434, 435).
- [ ] `openers_bottom` is indexed by **(length mod 3, can-also-open)** for both `*` and `_` (Appendix A).
- [ ] Code spans, autolinks and raw HTML bind before link brackets; brackets bind before emphasis (§1.1).
- [ ] Links never nest; the innermost wins; `[` delimiters before a link become inactive (§6.3 Ex. 518–520).
- [ ] Reference labels are normalised with **Unicode case fold** and collapsed whitespace; matched ≤ 999 chars (§6.3 Ex. 539–541, 549).
- [ ] No whitespace between link text and link label, and none between the two bracket groups (§6.3 Ex. 542, 556).
- [ ] Autolink schemes are 2–32 chars; escapes do not apply inside (§6.5 Ex. 609, 603).
- [ ] Image `alt` is the **plain string** content only (§6.4 Ex. 574–575).
- [ ] Hard breaks need 2+ spaces or a trailing backslash, must not be inside code/tag, and must not be at block end (§6.7).
- [ ] Soft breaks strip trailing spaces on the previous line and leading spaces on the next (§6.8 Ex. 649).
- [ ] Interior spaces in text are preserved in the AST (§6.9 Ex. 652).

---

## 14. Where we deliberately diverge from a strict reading

These are the places where a *viewer* has a product decision that the spec does
not make. Each needs an ADR.

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Render raw HTML or strip it? | pass through / strip / strip-with-allowlist | **Strip with an allow-list by default**, offer a per-document "trusted" toggle. See [11-security](../11-security/). |
| 2 | Soft break → `\n` or space? | §6.8 allows both | **Space** in the HTML, `white-space` untouched. |
| 3 | `code { white-space: pre-wrap }` | required by §6.1 | **Ship it.** |
| 4 | Soft break → `<br />` globally? | Obsidian's "Strict line breaks" | Offer the toggle, **default off** (CM behaviour). |
| 5 | Emit `id` anchors on headings? | not mandated | **Yes**, generated deterministically from the heading text, so `#fragment` links work. Document the slug algorithm. |
| 6 | Table alignment: `align=` or `style=`? | cmark-gfm vs markdown-it | **`style="text-align:…"`**, because `align` is deprecated in HTML5. Noted as a GFM deviation in the fixture. |
| 7 | Extension conflicts: `~~x~~` is GFM strikethrough but pandoc `subscript` | — | GFM default; pandoc mode is a separate opt-in ([03 §12](03-extensions-and-dialects.md#12-our-recommendation-matrix)). |

**Next:** [03-extensions-and-dialects.md](03-extensions-and-dialects.md) —
everything beyond CommonMark, plus the cross-tool compatibility matrix.
