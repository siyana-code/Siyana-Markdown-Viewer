# 01.3 — Core principles that survive every dialect

> Confidence tags: [`00-method/README.md` §3](../00-method/README.md#3-confidence-tags).
> Every behavioural example in this document was produced by running
> `commonmark@0.31.2` (the CommonMark reference implementation) on
> **2026-10-06**, Node v24.14.1, win32-x64. Nothing here is from memory.

---

## Why this document exists

There is no single "Markdown". There are at least thirteen registered variants
([IANA Markdown Variants registry](https://www.iana.org/assignments/markdown-variants/markdown-variants.xhtml),
last updated 2026-09-24) and an uncounted number of undocumented ones. If we
tried to enumerate "what Markdown supports" we would be maintaining a
compatibility matrix that no other project maintains and that would be wrong
within a year.

So this document does something different: it identifies the properties that
**every** dialect has kept, because they are load-bearing consequences of the
design goal rather than features. A renderer that respects these seven
principles will behave sanely on input that no spec covers. A renderer that
ignores them will produce confidently wrong output on ordinary prose.

---

## Principle 1 — Orthogonal syntax

**Markdown's constructs are independent of each other.** Knowing about headings
tells you nothing about lists; both are "punctuation at the start of a line,
meaning determined by the character".

Where this shows up:

| Orthogonality holds | Where it breaks |
|---------------------|-----------------|
| Block constructs are decided line-by-line, from the start of the line | Setext headings consume the *next* line |
| Inline constructs are decided within a paragraph's text, from anywhere | Link reference definitions consume whole lines *inside* a paragraph |
| A block's *content* is parsed with a disjoint rule set (inline) | HTML blocks suspend both rule sets entirely |
| Nesting is by container blocks (blockquote > list > item) | Emphasis is not a container; it is a delimiter stack |

The CommonMark spec encodes this architecturally: parsing is **two phases**,
and the phases are guaranteed disjoint `[VERIFIED]`,
[§3.1 "Precedence"](https://spec.commonmark.org/0.31.2/#precedence):

> "Indicators of block structure always take precedence over indicators of
> inline structure."

with the canonical demonstration:

```markdown
- `one
- two`
```

→ a `<ul>` with two items (`<li>`one`, `<li>two``), **not** a list containing a
code span. The backtick is inert because the block structure was decided first.

**Consequence for us:** the two phases have different performance and failure
characteristics, and only the first is sequential. The spec is explicit
`[VERIFIED]`:

> "Note that the first step requires processing lines in sequence, but the
> second can be parallelized, since the inline parsing of one block element does
> not affect the inline parsing of any other."

That is the single most useful architectural fact in the whole specification
for a viewer with a 100 MB file open. Detail belongs in
[`10-performance/`](../10-performance/); the principle belongs here.

---

## Principle 2 — Punctuation as marker, not tag

Markdown has no tags. Every construct is a rearrangement of characters the
author was going to type anyway, chosen so the arrangement *resembles the
meaning*:

```markdown
*emphasis*          →  the asterisks look like emphasis
**strong**          →  more asterisks, more force
# heading           →  a hash looks like a section marker
> quoted             →  the bar looks like the margin-quote convention
- item               →  a dash looks like a bullet
=== underline        →  an underline looks like an underline
`code`              →  quote marks around a literal
[text](url)         →  brackets around a reference, destination in parens
```

The design statement `[VERIFIED]`, [Markdown Syntax §Philosophy](https://daringfireball.net/projects/markdown/syntax#philosophy):

> "Markdown's syntax is comprised entirely of punctuation characters, which
> punctuation characters have been carefully chosen so as to look like what they
> mean."

**The load-bearing consequence is negative, and it is the reason Markdown is
hard to parse:** the markers are *in band*. `*` is simultaneously a bullet-list
marker, an emphasis delimiter, a thematic-break character, and a multiplication
sign in `2*3*4`. Disambiguation cannot be done by lexical class; it can only be
done by **position and context**. This produces three of Markdown's most
surprising rules, all verified below:

| Input | Output (verified, `commonmark@0.31.2`) | Why |
|-------|------------------------------------------|-----|
| `2*3*4` | `2<em>3</em>4` | `*` between alphanumerics is still flanking, so it emphasises |
| `a_b_c` | `a_b_c` | `_` intraword is **forbidden** — a deliberate safety trade |
| `foo*bar*baz` | `foo<em>bar</em>baz` | `*` intraword **is** allowed |

Same characters, opposite rules, decided by *which character* and *what
surrounds it*. That is Principle 2's real content: **the character carries the
marker; the context carries the meaning; the two must be kept separate.**

Gruber's justification for the `_` asymmetry is reproduced verbatim in
[§1 "Emphasis and strong emphasis"](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis)
`[VERIFIED]`:

> "Many implementations have also restricted intraword emphasis to the `*`
> forms, to avoid unwanted emphasis in words containing internal underscores.
> (It is best practice to put these in code spans, but users often do not.)"

And PHP Markdown Extra reached the same conclusion independently, with a
better example `[VERIFIED]`, <https://michelf.ca/projects/php-markdown/extra/>:
`Please open the folder "secret_magic_box"` must not become
`secret<em>magic</em>box`.

---

## Principle 3 — The source *is* the document

Stated in [`01-what-is-markdown.md` §3.2](./01-what-is-markdown.md#32-publishable-as-is--the-source-is-a-first-class-artefact)
and repeated here because it has a precise technical meaning:

> A Markdown file is a *complete and sufficient* representation of the document.
> Anything that is not in the file does not exist. There is no sidecar state, no
> layout database, no style table, no "the rest of the document".

Verified from RFC 7763 §2 `[VERIFIED]`: "Magic number(s): None", file
extensions `.md`/`.markdown`, UTI `net.daringfireball.markdown`.

**What this forbids, concretely:**

1. **Round-trip rewriting.** Any write-back risks loss, because Markdown cannot
   represent constructs a rich-text editor produced (colour, font size, exact
   breaks) and because HTML output discards source-level intent (reference
   definitions, hard wraps). See the measured diff behaviour in
   [`01-what-is-markdown.md` §6.6](./01-what-is-markdown.md#66-the-diff-test-is-the-interesting-one).
2. **Relying on the renderer to remember anything.** A viewer that keeps state
   about a document (scroll position, collapsed sections, read/unread marks) must
   store that state *beside* the document, explicitly, and must treat the
   document itself as immutable input.
3. **Partial rendering claims.** If we cannot parse a construct, we must show it
   literally, not guess.

---

## Principle 4 — Block / inline separation is what makes Markdown parseable

Already stated as Principle 1's mechanism; here it is stated as a *design*
principle with a history.

The separation exists because Markdown must be **streamable**. A renderer can
process a document one line at a time (block phase) because block structure is
line-oriented, and only afterwards can it process each paragraph's text
(inline phase). Verified examples that show block phase winning:

| Input | Verified output | Principle shown |
|-------|-----------------|-----------------|
| `# a *b* c` | `<h1>a <em>b</em> c</h1>` | Heading content *is* inline-parsed |
| `Foo *bar*` / `=========` | `<h1>Foo <em>bar</em></h1>` | Setext: block decision first, then inline |
| `- \`one` / `- two\`` | `<ul><li>`one</li><li>two`</li></ul>` | Block wins; inline backtick inert |

The spec's Appendix A describes the exact incremental tree algorithm
`[VERIFIED]`, [Appendix: A parsing strategy](https://spec.commonmark.org/0.31.2/#appendix-a-parsing-strategy):
open/closed blocks, three effects per line (close unmatched, open new, append
text), and the crucial note that a line can be discarded after incorporation, so
"input can be read in a stream".

**The failure mode this principle prevents:** an implementation that tries to
decide block and inline structure in one pass must either backtrack
(pathological complexity, ReDoS class) or guess. Both produce security-relevant
bugs. This principle is a *mitigation*, and it is why we should resist any
proposal to "simplify" the parser into one pass.

---

## Principle 5 — Markup is opt-out; nothing is opt-in

Gruber's rule `[VERIFIED]`, [Markdown Syntax §Inline HTML](https://daringfireball.net/projects/markdown/syntax#html):

> "For any markup that is not covered by Markdown's syntax, you simply use HTML
> itself. There's no need to preface it or delimit it to indicate that you're
> switching from Markdown to HTML; you just use the tags."

And the consequence people trip over `[VERIFIED]`:

> "Note that Markdown formatting syntax is not processed within block-level HTML
> tags. E.g., you can't use Markdown-style `*emphasis*` inside an HTML block."

This "no markup inside HTML blocks" rule is a **parse-state suspension**, and it
is the single most under-modelled feature in Markdown implementations. CommonMark
formalises it with **seven types of HTML block** `[VERIFIED]`,
[§4.6](https://spec.commonmark.org/0.31.2/#html-blocks):

| Type | Start condition | End condition | Why it exists |
|------|-----------------|---------------|---------------|
| 1 | `<pre` `<script` `<style` `<textarea` | matching end tag | These contain *literal* text; a blank line inside `<pre>` must not end the block |
| 2 | `<!--` | `-->` | Comments may contain blank lines |
| 3 | `<?` | `?>` | Processing instructions |
| 4 | `<!` + letter | `>` | Declarations |
| 5 | `<![CDATA[` | `]]>` | |
| 6 | `<` or `</` + one of 62 known block tag names | **blank line** | The common case |
| 7 | any complete open/close tag alone on a line | **blank line** | Unknown/custom tags |

Two details that matter enormously in practice `[VERIFIED]`:

1. Types 6 and 7 end at a **blank line**, so a single blank line resumes
   Markdown parsing in the middle of what looks like one HTML region. Verified
   from the spec:

   ```markdown
   <table><tr><td>
   <pre>
   **Hello**,

   _world_.
   </pre>
   </td></tr></table>
   ```

   → the `**Hello**` stays literal (it is inside the type-6 `<table>` block, which
   the blank line terminated), but `_world_.` becomes `<em>world</em>` because
   parsing resumed. **This is verified spec behaviour and it is genuinely
   counter-intuitive.**

2. Type 7 cannot interrupt a paragraph, and "All types of HTML blocks except
   type 7 may interrupt a paragraph."

**Consequence for us — this is the security surface.** Raw HTML passes through
un-escaped. Different dialects resolve this differently, and we measured the
consequences in [`02-history-and-evolution.md` §4.2](./02-history-and-evolution.md#42-the-measured-result-divergence-is-dominated-by-deliberate-choices):

| Dialect | Policy | Measured effect |
|---------|--------|-----------------|
| CommonMark | Pass through | Author's responsibility |
| GFM | Pass through, minus nine tags (`title`, `textarea`, `style`, `xmp`, `iframe`, `noembed`, `noframes`, `script`, `plaintext`) rewritten to `&lt;…` | 9 known-dangerous tags neutralised `[VERIFIED]` |
| markdown-it default | Escape **all** raw HTML | 57 of its 72 CommonMark deviations; safest, least faithful |
| markdown-it `commonmark` preset | Pass through | 652/652 |

**A blocklist of nine tags is not a security boundary.** It is a compatibility
convenience. `<img src=x onerror=…>`, `<svg onload=…>`, `<math>`, `<form>`,
`<object>`, `<embed>` are all still allowed. See
[`04-the-viewer-problem.md` §7](./04-the-viewer-problem.md#7-trust-boundaries) and
`11-security/`.

**Extensibility note.** Markdown Extra's answer was `markdown="1"` on the tag —
opt *back in*. It is a good pattern: the default stays inert, and opting in is
explicit and visible. `[INFERRED]` If we ever need to let users embed HTML, this
is the shape to copy, not a config flag.

---

## Principle 6 — Backslash escape is the universal escape hatch

Any ASCII punctuation character may be backslash-escaped `[VERIFIED]`,
[§6.1](https://spec.commonmark.org/0.31.2/#backslash-escapes):

```
\!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_\`\{\|\}\~
```

→ `!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~`

And, precisely:

- Backslashes before **non**-punctuation are literal backslashes.
- Escaped characters lose their Markdown meaning: `\*not emphasized\*` →
  `*not emphasized*`, `1\. not a list`, `\# not a heading`.
- Backslashes do **not** escape inside code spans, code blocks, autolinks, or
  raw HTML — but they **do** work in link destinations, link titles, and fenced
  code info strings. Verified: `[foo](/bar\* "ti\*tle")` → `<a href="/bar*"
  title="ti*tle">foo</a>`.
- A backslash at end of line is a hard line break, **not** an escape: `foo\` ⏎
  `bar` → `foo<br />bar`.

**Why this is a principle and not a feature:** it is the *guarantee* that
Markdown syntax is never a dead end. Because every marker is escapable, no
document ever needs a "verbatim" construct beyond code spans, and no construct
can ever steal content the author did not intend to mark up. `[INFERRED]` This is
the escape hatch that makes Principle 5's permissiveness survivable: raw HTML is
opt-out, backslash is the opt-in for literal punctuation.

---

## Principle 7 — Extensibility is by convention, not by specification

Markdown has **no extension mechanism**. There is no `#plugin` directive, no
namespaced syntax, no registry of block types. Yet Markdown has dozens of
extensions in production.

The extensions that succeeded all followed one pattern: **reuse an existing
Markdown construct's shape with a new character, in a new position.**

| Extension | Pattern | Who |
|-----------|---------|-----|
| Footnotes | reuse reference definitions, `[^label]` / `[^label]: …` | Markdown Extra, pandoc, GFM-adjacent tools |
| Definition lists | reuse blockquote laziness, `:` at line start | Markdown Extra |
| Abbreviations | reuse reference definitions, `*[label]: …` | Markdown Extra |
| Task lists | reuse link text, `[ ]` / `[x]` as first inline | GFM |
| Tables | reuse paragraph lines + a delimiter row | Markdown Extra, GFM |
| Fenced code | reuse blockquote's arbitrary-marker idea | Markdown Extra → **promoted into CommonMark** |
| Attributes | `{#id .class}` after the construct | Markdown Extra, pandoc, MultiMarkdown |

Note the direction of travel: **fenced code blocks were invented in Markdown
Extra (2007-ish) and later promoted into CommonMark 0.23+ and GFM.** That is
what "convergence" looks like in practice: not a new version of the core, but a
dialect feature eventually standardised.

Gruber explicitly preserved space for this `[VERIFIED]`,
[Daring Fireball, *Markdoc*, 2022-05-19](https://daringfireball.net/linked/2022/05/19/markdoc):

> "I love their syntax extensions — very true to the spirit of Markdown. They
> use curly braces for their extensions; I'm not sure I ever made this clear,
> publicly, but I avoided using curly braces in Markdown itself — even though
> they are very tempting characters — to unofficially reserve them for
> implementation-specific extensions."

**Consequences for us:**

1. We have **no legitimate way to add a construct**. If we invent syntax, we are
   a dialect, and our users' documents stop being portable. This is the single
   strongest argument for a *small, explicit* extension set — conclusion C8 in
   [`00-method/README.md` §5](../00-method/README.md#5-what-would-falsify-each-major-conclusion).
2. If we must add syntax, follow the established pattern: reuse a shape, pick an
   unclaimed character, and make it inert by default.
3. Never invent a "general extension directive" on our own initiative. It is the
   single change most likely to make our viewer incompatible with every other
   Markdown tool in a way users cannot see.

---

## The deep dive: why emphasis needs delimiter-run rules

Everything above is comparatively easy. This is the hard part, and it is the
most likely place for a viewer to be quietly wrong.

### The problem stated in one sentence

Gruber's *entire* original specification of emphasis is `[VERIFIED]`,
[Markdown Syntax §Emphasis](https://daringfireball.net/projects/markdown/syntax#em):

> "Markdown treats asterisks (`*`) and underscores (`_`) as indicators of
> emphasis. Text wrapped with one `*` or `_` will be wrapped with an HTML `<em>`
> tag; double `*`'s or `_`'s will be wrapped with an HTML `<strong>` tag."
> […] "the lone restriction is that the same character must be used to open and
> close an emphasis span."

That is the whole rule. It is **not** a grammar. It cannot be implemented as a
regular expression or a single-pass scanner, because it is *underdetermined*.

### The naive strategies, and how they fail

We implemented three plausible naive parsers and compared them against the
reference implementation on 12 inputs. All outputs below are **measured**
(`commonmark@0.31.2`, 2026-10-06); `<p>` wrappers stripped for comparison.

- **Naive A** — strong-first regex, non-greedy:
  `s.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>').replace(/(\*|_)(.+?)\1/g, '<em>$2</em>')`
- **Naive B** — single alternation, `<em>` alternative first:
  `s.replace(/\*([^*]+)\*|__([^_]+)__/g, …)`
- **Naive C** — symmetric run-matching, no context:
  find a run of `*`/`_`, find the next run of the same char, tag by length

| Input | CommonMark 0.31.2 (truth) | Naive A | Naive B | Naive C |
|-------|---------------------------|---------|---------|---------|
| `*a **b** c*` | `<em>a <strong>b</strong> c</em>` | ✅ | ❌ `<em>a </em>b<em> c</em>` | ❌ `<em>a </em>b<em> c</em>` |
| `***foo***` | `<em><strong>foo</strong></em>` | ❌ `<strong><em>foo</strong></em>` | ❌ `**<em>foo</em>**` | ❌ `<strong>foo</strong>` |
| `**foo *bar** baz**` | `<em><em>foo <em>bar</em></em> baz</em>*` | ❌ | ❌ | ❌ |
| `**foo **bar baz**` | `**foo <strong>bar baz</strong>` | ❌ | ❌ | ❌ |
| `*foo *bar* baz*` | `<em>foo <em>bar</em> baz</em>` | ❌ `<em>foo </em>bar<em> baz</em>` | ❌ | ❌ |
| `*foo bar *` | `*foo bar *` | ❌ `<em>foo bar </em>` | ❌ | ❌ |
| `a*"foo"*` | `a*"foo"*` | ❌ `a<em>"foo"</em>` | ❌ | ❌ |
| `foo_bar_baz` | `foo_bar_baz` | ❌ `foo<em>bar</em>baz` | ✅ | ❌ |
| `foo*bar*baz` | `foo<em>bar</em>baz` | ✅ | ✅ | ✅ |

**Measured error counts: Naive A wrong on 7 of 12. Naive B wrong on 9 of 12.
Naive C wrong on 11 of 12.**

Now the important part — *why* each fails:

**Failure mode 1 — the delimiter is ambiguous by construction.**
`*a **b** c*` has four `*` characters and two `_`-free candidate pairs. Both
"outer `*`s open and close; the `**` nests" and "each `*` opens and closes
independently" fit the text. Gruber's rule does not say which. CommonMark's
answer is rule 14 (`[Emphasis and strong emphasis](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis)`):
*an interpretation `<em><strong>…</strong></em>` is always preferred to
`<strong><em>…</em></strong>`*, and rule 13: *minimise nestings*. Naive B tries
"`<em>` first" as a textual alternative, which is not the same rule at all —
it produces three separate `<em>` spans and drops the `**`.

**Failure mode 2 — no flanking, so no context.**
`*foo bar *` must not emphasise: the closing `*` is preceded by a space. All
three naive parsers emit `<em>foo bar </em>`. A delimiter that is followed by
whitespace cannot open; one preceded by whitespace cannot close. That single
observation is what makes the rest of the flanking machinery necessary, and the
spec proves it with the paired example `[VERIFIED]`:

```markdown
*foo bar *
.
<p>*foo bar *</p>
```

```markdown
*foo bar
*
.
<p>*foo bar
*</p>
```

— "A line ending also counts as whitespace."

**Failure mode 3 — no Unicode awareness.**
`a*"foo"*` must be literal: the opening `*` is preceded by an alphanumeric and
followed by punctuation, which is neither left- nor right-flanking in a usable
sense. The spec even shows the paired positive case to prove the rule is about
*position*, not about the `*` being "inside quotes":
`*(*foo*)*` → `<em>(<em>foo</em>)</em>` and `*(*foo)` → `*(*foo)` (the `*` is
preceded by punctuation and followed by an alphanumeric, so not right-flanking).
Both verified against `commonmark@0.31.2`.

**Failure mode 4 — no rule for `*` vs `_`.**
`foo_bar_baz` and `foo*bar*baz` differ. No amount of run matching will tell them
apart, because the *runs look identical*. Only the flanking-plus-underscore
rule (rules 2, 4, 6, 8) separates them.

### The actual machinery

CommonMark's solution has four parts, all `[VERIFIED]` from
[§6.4](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis).

**(1) Delimiter runs.** A run is a maximal sequence of one or more `*` (or one
or more `_`) not adjacent to an unescaped copy of itself. So `***` is one run of
length 3, not three runs of length 1. This is the observation naive parsers miss.

**(2) Flanking.** Using Unicode whitespace and Unicode punctuation
(`P` + `S` general categories):

```
left-flanking  := not followed by whitespace
                  and ( not followed by punctuation
                        or ( followed by punctuation and preceded by whitespace/punctuation ) )

right-flanking := not preceded by whitespace
                  and ( not preceded by punctuation
                        or ( preceded by punctuation and followed by whitespace/punctuation ) )
```

Line start and line end count as whitespace. Verified instantiations from the
spec's own examples: `***abc` is left-only; `abc***` is right-only;
`abc***def` is both; `abc *** def` and `a _ b` are **neither** — which is
exactly why `2 * 3 * 4` renders as the literal `2 * 3 * 4` (verified) and why
`a * foo bar*` renders literally (verified).

**(3) The `*`-vs-`_` split.** `*` may open iff it is part of a left-flanking
run; may close iff part of a right-flanking run. `_` may open iff
left-flanking **and** (not right-flanking **or** preceded by punctuation). That
extra clause is what makes `foo-_(bar)_` work while `foo_bar_baz` does not —
verified: `foo-_(bar)_` → `foo-<em>(bar)</em>` and `_(bar)_.` →
`<em>(bar)</em>.`, both because the delimiter is preceded by punctuation.

**(4) The "multiple of 3" rule (rules 9 and 10).** If either delimiter can both
open and close, the sum of the two run lengths must not be a multiple of 3,
unless both lengths are multiples of 3. This exists to break the residual
ambiguity that flanking leaves. It is the least intuitive rule in Markdown and
it is *load-bearing*: it is why `**foo **bar baz**` resolves to
`**foo <strong>bar baz</strong>` (rule 16, later-opening span wins on the same
closer) rather than to `<strong>foo <strong>bar baz</strong>`.

**(5) Tie-breakers 13–17.** These are *preferences*, applied only where the
rules above are compatible with multiple parses:

| # | Rule | Verified example |
|---|------|------------------|
| 13 | Minimise nesting: prefer `<strong>` to `<em><em>` | `***foo***` → `<em><strong>foo</strong></em>` |
| 14 | Prefer `<em><strong>` to `<strong><em>` | `*a **b** c*` → `<em>a <strong>b</strong> c</em>` |
| 15 | On overlap, the **earlier** span wins | `*foo _bar* baz_` → `<em>foo _bar</em> baz_` |
| 16 | On the same closer, the **later-opening (shorter)** span wins | `**foo **bar baz**` → `**foo <strong>bar baz</strong>` |
| 17 | Code spans, links, images and HTML tags **bind tighter** than emphasis | `*[foo*](bar)` → `*<a href="bar">foo*</a>` |

Rule 17 is the one that most often saves a naive parser and it is worth stating
as a rule of thumb for our own renderer code: **if you are unsure what binds
tighter, it binds tighter to the "harder" construct.** Code spans beat emphasis;
brackets beat emphasis; blocks beat everything.

### Why this is linear, not exponential

The temptation is to implement emphasis with recursion or regex backtracking.
The spec forbids it by construction. Appendix A specifies a **delimiter stack**
`[VERIFIED]`:

- Push each delimiter run onto a stack as you scan, recording its character,
  length, and whether it can open / can close.
- On `]`, look for a matching `[` opener on the stack; if found, run *process
  emphasis* with that `[` as `stack_bottom`.
- *process emphasis* scans forward for the first potential closer, then looks
  **backwards** for a matching opener. If found, emit the node, delete the
  delimiters between them from the stack, and consume 1 or 2 delimiters from
  each end. If not found, advance `current_position` and, crucially, set
  `openers_bottom` so future searches for this delimiter type cannot revisit
  positions already proven empty.

`openers_bottom` is the algorithmic trick: it makes the "no opener found" case
amortised O(1) rather than O(n) per closer. `[INFERRED]` — this is my reading of
the algorithm, not a claim from the spec, but it is the only reading under which
the spec's own claim holds:

> "The rules given below capture all of these patterns, while allowing for
> efficient parsing strategies that do not backtrack."

**Consequence for us, and it is a security consequence:** any parser that
backtracks on emphasis is a potential algorithmic-complexity DoS. Our own
conformance work will not catch this — the 652-example corpus is not a
pathological-timing corpus. `11-security/` must include a fuzzing and
pathological-input budget, and `10-performance/` must include a worst-case
timing measurement, not just a throughput number.

---

## Principles → engineering consequences

| Principle | What it forbids us from doing | Where it is enforced |
|-----------|------------------------------|----------------------|
| 1. Orthogonal syntax | Merging the two parse phases into one pass | Parser architecture |
| 2. Punctuation as marker | Treating any character as context-free | Inline parser |
| 3. Source is the document | Writing back to user files in v1; relying on renderer state | Product scope |
| 4. Block/inline separation | One-pass parsing; parse ordering changes | Parser architecture |
| 5. Markup is opt-out | Believing a 9-tag blocklist is a security boundary | Sanitiser design |
| 6. Backslash escape | Adding a "verbatim" construct; treating escapes as global | Inline parser |
| 7. Convention-based extensibility | Inventing new syntax without a strong user-facing reason | Product scope |

---

## Open questions

| Question | Status | Destination |
|----------|--------|-------------|
| Can the flanking rules be simplified without changing the corpus output? | `[UNVERIFIED]` — this is the falsification test for C4 | `04-parsing-internals/`; needs generated pathological cases, not just the 652 |
| Does CommonMark's mod-3 rule survive a CJK-friendly redesign? | `[UNVERIFIED]` — an open proposal exists | Watch commonmark-spec#650 |
| What is the real cost of the flanking classification at Unicode scale? | `[UNVERIFIED]` — no measurement | `10-performance/` |
| Can a naive parser be made safe by *just* adding flanking + rule 17? | `[INFERRED]` — probably not; rules 13–16 are needed for nesting cases | Falsification test for C4 |

Next: [`04-the-viewer-problem.md`](./04-the-viewer-problem.md).
