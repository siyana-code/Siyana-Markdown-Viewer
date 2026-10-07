# 01 — The reference parsing strategy

> The single most important architecture document for our renderer. It is a
> close reading of the CommonMark specification's Appendix: *A parsing strategy*
> (spec.txt lines 9420–9757), plus the design reasoning that the appendix implies
> but does not state.

---

## 1. What the appendix is, and its normative weight

The appendix's opening sentence sets its status precisely:

> In this appendix we describe some features of the parsing strategy used in the
> CommonMark reference implementations.

Read carefully, that is **descriptive**. The appendix documents `cmark`'s and
`commonmark.js`'s strategy; it does not add requirements. The normative
requirements live in §§1–6.

That said, the appendix is *in practice* the tightest constraint in the whole
document, for a reason worth stating up front:

> **Any implementation that passes 652/652 is doing something structurally
> equivalent to this appendix.**

Not byte-equivalent. Not the same data structures. But equivalent in the sense
that matters: it resolves deferred decisions by **buffering and deciding at
close time**, never by **backtracking and retrying**. If your architecture
backtracks, you will find the pathological cases where the reference
implementations do not. See
[`05-performance-and-limits.md`](05-performance-and-limits.md) §3 for measured
examples of exactly this — including one in the reference implementation itself.

## 2. The two phases

The appendix's overview states the two phases. Paraphrased with the exact
division of labour:

**Phase 1 (block structure).** Input lines are consumed and the block structure
of the document — its division into paragraphs, block quotes, list items, and so
on — is constructed. Text is assigned to these blocks but **not parsed**. Link
reference definitions are parsed and a map of links is constructed.

**Phase 2 (inline structure).** The raw text contents of paragraphs and headings
are parsed into sequences of Markdown inline elements (strings, code spans, links,
emphasis, and so on), **using the map of link references constructed in phase 1**.

Three consequences that are easy to miss:

| Consequence | Detail |
|-------------|--------|
| Phase 1 assigns text but does not interpret it | The paragraph node holds an opaque `string` buffer plus a line-count. It has no idea the text contains `*` characters. |
| Phase 1 *does* parse one thing inline-ish | Link reference definitions, because building the link map is phase 1's job. But it does so on the paragraph's raw lines at close time, before phase 2 touches the content. |
| Phase 2 input is not raw document text | It is the *post-definition-stripped* paragraph content. The phase-1 close hook physically removes definition lines from the buffer. |

That last point is easy to get wrong. `parseInlines()` for phase 2 receives a
buffer that is **shorter** than the lines that produced it.

## 3. The document tree and the open/closed invariant

The exact wording (paraphrased from the appendix's Overview):

> At each point in processing, the document is represented as a tree of blocks.
> The root of the tree is a `document` block. The document may have any number of
> other blocks as children. These children may, in turn, have other blocks as
> children. **The last child of a block is normally considered open**, meaning
> that subsequent lines of input can alter its contents. (Blocks that are not
> open are closed.)

This gives an O(1) structural invariant that the whole algorithm rests on:

> **At most one block per depth level is open at any time. The open blocks form a
> single path from the root to the deepest open block.**

"Descending through last children down to the last open block" (the appendix's
own phrase) is therefore not a traversal — it is **following the `lastChild`
chain**, which is already the open path.

### 3.1 Consequences

1. **Closing a block closes all its descendants.** `closeBlock()` at depth *d*
   closes blocks at depths *d*, *d-1*, … down to the root's last child. This is
   what makes "a block quote requires a `>` character" (the appendix's example
   continuation condition) well-defined: the moment the block quote stops
   matching, everything inside it is finished.
2. **Opening a block is O(1).** Append to the parent's `lastChild`.
3. **The open path has length ≤ nesting depth**, so the "iterate the open blocks"
   loop is O(depth) per line. This is where deep nesting becomes expensive — see
   §7.
4. **Streaming is free.** Once a line has been incorporated it can be
   discarded. The appendix says so explicitly. We do not need the whole document
   in memory for phase 1.

## 4. Per-line procedure

The appendix gives the effect a line can have. Paraphrased:

> The line is analyzed and, depending on its contents, the document may be
> altered in one or more of the following ways:
> 1. One or more open blocks may be closed.
> 2. One or more new blocks may be created as children of the last open block.
> 3. Text may be added to the last (deepest) open block remaining on the tree.
>
> Once a line has been incorporated into the tree in this way, it can be
> discarded, so input can be read in a stream.

Then, the three steps. Paraphrased from the appendix's "For each line, we follow
this procedure":

### Step 1 — Match continuation, do **not** close yet

> First we iterate through the open blocks, starting with the root document, and
> descending through last children down to the last open block. Each block imposes
> a condition that the line must satisfy if the block is to remain open. For
> example, a block quote requires a `>` character. A paragraph requires a
> non-blank line. In this phase we may match all or just some of the open blocks.
> **But we cannot close unmatched blocks yet, because we may have a lazy
> continuation line.**

**This is the crux of the algorithm.** You *may* stop matching at any point. The
moment you stop is not a decision to close — it is a decision to *stop
consuming container prefixes*. Everything below the stop point stays open, in
case this line turns out to be a lazy continuation.

### Step 2 — Look for new starts, **then** close

> Next, after consuming the continuation markers for existing blocks, we look for
> new block starts (e.g. `>` for a block quote). If we encounter a new block
> start, we close any blocks unmatched in step 1 before creating the new block as
> a child of the last matched container block.

Note the ordering, which is load-bearing:

```text
MATCH (soft)  -->  LOOK FOR START  -->  CLOSE UNMATCHED  -->  OPEN NEW  -->  ADD TEXT
      ^                                     ^
      +---- lazy continuation lives --------+
         in the gap between these two
```

If you closed unmatched blocks *during* step 1, you would break lazy
continuation:

```markdown
> Lorem ipsum
dolor sit amet.
```

Line 2 has no `>`. Step 1 stops matching at the `block_quote`. If we closed the
block quote, line 2 would become a top-level paragraph — wrong. Instead, we
defer: we stop matching, then look for a new block start in the remaining text
(`dolor sit amet.` has none), and only then, having found no start, do we treat
the line as a continuation of the still-open paragraph.

### Step 3 — Add text to the deepest open block

> Finally, we look at the remainder of the line (after block markers like `>`,
> list markers, and indentation have been consumed). This is text that can be
> incorporated into the last open block (a paragraph, code block, heading, or raw
> HTML).

### The deferred cases

The appendix names two block types that are *not* recognised at line-read time:

> Setext headings are formed when we see a line of a paragraph that is a setext
> heading underline.
>
> Reference link definitions are detected when a paragraph is closed; the
> accumulated text lines are parsed to see if they begin with one or more
> reference link definitions. Any remainder becomes a normal paragraph.

So there are **two distinct deferral mechanisms**, and conflating them is a
classic bug:

| Deferred case | Trigger | Scope | Where handled |
|--------------|---------|-------|---------------|
| **Setext heading** | a line while a paragraph is open that matches a setext underline | that paragraph only | close-continuation hook, per line |
| **Link reference definition** | paragraph close | strips leading definitions from the buffer; the rest survives as a paragraph | close-finalise hook, once |

Setext is checked *while the paragraph is still open* (it is a continuation-line
condition). Link reference definitions are checked *when the paragraph closes*.
Different hooks, different timing.

## 5. Worked trace

The appendix's four-line example, with the effect of each line:

```markdown
> Lorem ipsum dolor
sit amet.
> - Qui *quodsi iracundia*
> - aliquando id
```

| Line | Step 1 (match) | Step 2 (look for start) | Step 3 (add text) | Tree |
|------|----------------|--------------------------|-------------------|------|
| `> Lorem ipsum dolor` | `document` matches (always); `block_quote` opens in step 2 | `>` => open `block_quote`; `Lorem ipsum dolor` => open `paragraph` | `Lorem ipsum dolor` => paragraph | `document > block_quote > paragraph` |
| `sit amet.` | `document` yes; `block_quote` **no** (no `>`); `paragraph` yes (non-blank) | remaining text `sit amet.` has no start | `sit amet.` => paragraph (lazy continuation) | `document > block_quote > paragraph` (`"Lorem ipsum dolor\nsit amet."`) |
| `> - Qui *quodsi iracundia*` | `document` yes; `block_quote` yes (strips `> `) | `- ` => open `list`, `list_item`, `paragraph` | `Qui *quodsi iracundia*` => paragraph | `document > block_quote > list > list_item > paragraph` |
| `> - aliquando id` | `document` yes; `block_quote` yes; `list` yes (bullet); `list_item` **no** (no marker) | `- ` => open new `list_item`, `paragraph` | `aliquando id` | `document > block_quote > list > list_item > paragraph` |

Note line 4: the `list` **stays open** while the `list_item` closes and a new one
opens. This is what makes `* a\n* b` a single list rather than two lists, and it
is why list containers have a continuation condition ("the line is a list item
of the same type") rather than a marker requirement.

## 6. Phase 2

Paraphrased from the appendix:

> Once all of the input has been parsed, all open blocks are closed.
>
> We then "walk the tree," visiting every node, and parse raw string contents of
> paragraphs and headings as inlines. At this point we have seen all the link
> reference definitions, so we can resolve reference links as we go.

And the result:

```tree
document
  block_quote
    paragraph
      str "Lorem ipsum dolor"
      softbreak
      str "sit amet."
    list (type=bullet tight=true bullet_char=-)
      list_item
        paragraph
          str "Qui "
          emph
            str "quodsi iracundia"
      list_item
        paragraph
          str "aliquando id"
```

Three things to note:

1. **The line ending became a `softbreak` node.** Line-ending → node conversion
   happens in phase 2, not phase 1. Phase 1 stores lines joined by `\n` and
   phase 2 splits them into `str` + `softbreak` (or `linebreak` if the line ended
   with two spaces or a backslash — §6.7 of the spec).
2. **`*quodsi iracundia*` became `emph`.** Purely a phase-2 product.
3. **Tightness (`tight=true`) was already decided.** It is a phase-1 property
   computed at list close. See
   [`02-block-parsing.md` §8](02-block-parsing.md).

### 6.1 Why phase 2 is parallelisable

Because the appendix's model gives each leaf block an *independent* raw string,
and the link reference map is global and already final, `inlineParse(text_i)`
depends only on `text_i` and the shared map. That is a pure function of its
inputs. Hence:

- deterministic and independently testable;
- safe to run in N workers;
- safe to memoise on `(rawText, profileVersion, linkMapGeneration)`;
- safe to run incrementally when a paragraph's text changes.

## 7. The inline algorithm, in the appendix's own terms

Appendix A.4 gives the algorithm the reference implementations use. We reproduce
the structure and quote the key passages, because the exact wording of a few
sentences is what makes the algorithm implementable.

### 7.1 Delimiter stack construction

The appendix describes the stack as:

> When we're parsing inlines and we hit either
> - a run of `*` or `_` characters, or
> - a `[` or `![`
>
> we insert a text node with these symbols as its literal content, and we add a
> pointer to this text node to the delimiter stack.
>
> The delimiter stack is a doubly linked list. Each element contains a pointer to
> a text node, plus information about
> - the type of delimiter (`[`, `![`, `*`, `_`)
> - the number of delimiters,
> - whether the delimiter is "active" (all are active to start), and
> - whether the delimiter is a potential opener, a potential closer, or both
> (which depends on what sort of characters precede and follow the delimiters).

Note: "a **run** of `*` or `_` characters". The stack holds *runs*, not
individual characters. This is essential — it is why `***foo***` is one entry
with `count = 3`, not three entries, and it is why the emphasis algorithm can
decide em-vs-strong from the run length.

Note also: the **flankingness** determination ("which depends on what sort of
characters precede and follow the delimiters") is precomputed at push time from
spec §6.2's left-flanking / right-flanking definitions. Do not recompute it
later.

### 7.2 The two procedures

The appendix defines exactly two procedures, triggered at two points:

| Procedure | Trigger |
|-----------|---------|
| *look for link or image* | when a `]` is encountered |
| *process emphasis* | at end of input (with `stack_bottom = NULL`), **and** after a successful link is built (with the `[` opener as `stack_bottom`) |

And one trigger for the link procedure's third behaviour:

> If we have a link (and not an image), we also set all `[` delimiters before the
> opening delimiter to *inactive*. (This will prevent us from getting links
> within links.)

Full treatment, with pseudocode and the resolution rules in order, is in
[`03-inline-parsing.md`](03-inline-parsing.md).

### 7.3 `openers_bottom` — the one-sentence optimisation that matters

The appendix's *process emphasis* says:

> We keep track of the `openers_bottom` for each delimiter type (`*`, `_`),
> indexed to the length of the closing delimiter run (modulo 3) and to whether
> the closing delimiter can also be an opener. Initialize this to `stack_bottom`.

and, on failing to find a matching opener:

> Set `openers_bottom` to the element before `current_position`. (We know that
> there are no openers for this kind of closer up to and including this point, so
> this puts a lower bound on future searches.)

**Why this is the whole ballgame.** Consider the canonical pathological input
`"a_ " * 65000` (the `cmark-gfm` suite's "many emph closers with no openers",
~195 KB). Without `openers_bottom`, every `_` closer walks backwards over the
entire stack looking for an opener, finds none, and moves on: **O(n²)**. With it,
the first `_` sets `openers_bottom[*][1][false]` just below itself, and every
subsequent `_` in the same category terminates its backward scan immediately:
**O(n)**.

The index key is the delimiter run length **modulo 3** because spec §6.2 rules
9–10 use the modulo-3 rule ("the sum of the lengths of the delimiter runs
containing the opening and closing delimiters must not be a multiple of 3 unless
both lengths are multiples of 3"). Two closers with the same length mod 3 and
the same can-open-ness have *identical* matching behaviour, so a failed search
for one is a valid lower bound for the other.

The second component — "whether the closing delimiter can also be an opener" — is
needed because a delimiter that is both an opener and a closer is never
*discarded* on a failed match. The appendix says:

> If the closer at `current_position` is not a potential opener, remove it from
> the delimiter stack (since we know it can't be a closer either).

That removal is what makes the `openers_bottom` bound permanent. If it were kept
as a candidate opener, the bound would be wrong.

We measured this: `commonmark.js` and `markdown-it` both scale at ×1.79 and
×1.80 respectively on this shape — i.e. both have the optimisation. See
[`05-performance-and-limits.md` §3.2](05-performance-and-limits.md).

### 7.4 The one thing `openers_bottom` does *not* cover

It bounds the **emphasis** search only. The *look for link or image* procedure's
backward walk for a `[` opener is a different, unbounded scan. That is why
`commonmark.js` scales at ×3.78 on `"a] "` repeated and ×4.46 on `"[a](b"`
repeated (measured), and why our safe-limits table includes an explicit
**max delimiter stack entries** limit. See
[`05-performance-and-limits.md` §3.3 and §6.1](05-performance-and-limits.md).

## 8. Design decisions we must make, and what the appendix leaves open

The appendix is a *strategy*, not an interface. These are the decisions it does
not make for us:

| Decision | Options | Our inclination | Rationale |
|----------|---------|-----------------|-----------|
| **Node representation** | Arena/indices, tagged pointers, boxed nodes | **Arena with index handles** | Enables cheap structural sharing for incremental reparse; avoids GC pressure; makes deep trees cheap to clone. |
| **Where link reference parsing lives** | Phase 1 close hook vs a separate pre-pass | **Phase 1 close hook** | Streaming, and it is what the appendix says. |
| **Line-ending normalisation** | Pre-normalise the whole buffer, or per line | **Per line** | Pre-normalising changes byte offsets and breaks source mapping. |
| **Tab handling** | Expand at load, or virtual columns | **Virtual columns** | The spec says internal tabs are literal but indentation contexts use a 4-column tab stop. Expanding loses information and changes rendered code content. |
| **Text storage** | Re-slice the source string, or copy | **Offsets into the source string** (rope/slice) | Zero-copy for large files; but requires careful handling of the front-matter-stripped case. |
| **Phase 2 scheduling** | Inline, threaded, or deferred-to-worker | **Deferred to a worker** (see [`../10-performance/`](../10-performance/)) | Phase 2 is embarrassingly parallel; keeps the main thread free for scrolling. |
| **Setext vs thematic break vs list item precedence** | Not in the appendix | See [`02-block-parsing.md` §4](02-block-parsing.md) | This is spec §4.1/§4.3/§5.2 territory, not appendix territory. |
| **Recursion in the render walk** | Recursive or explicit stack | **Explicit stack** | Recursion depth = nesting depth; a document can legally be 100 000 deep, and native stacks are much smaller than JS heaps. |

## 9. The traps

Seven ways to get this wrong, drawn from the spec text and from observed parser
behaviour:

1. **Closing unmatched blocks in step 1.** Breaks lazy continuation. Everything
   indented-looking inside a block quote becomes a top-level block.
2. **Recognising link reference definitions eagerly.** Breaks
   `[foo]: /url "title"` inside a paragraph's continuation lines, and breaks the
   "remainder becomes a paragraph" rule.
3. **Recognising setext headings eagerly, as a line classification.** The setext
   underline is only a setext underline *while a paragraph is open*. A `===`
   line with no open paragraph is a paragraph.
4. **Pushing individual delimiter characters instead of runs.** Breaks
   `***foo***` and makes the modulo-3 rule unimplementable.
5. **Omitting `openers_bottom`.** Correct output, quadratic time. See §7.3.
6. **Forgetting that phase 2's input has had definition lines stripped.** A
   subtle off-by-N that shows up only in documents that use reference links.
7. **Implementing the render walk recursively.** A 100 000-deep block quote
   stack-overflows. Measured: `commonmark.js` handles 100 000-deep block quotes
   in 149 ms (it uses an iterative walk), but a naive recursive implementation in
   Rust or C will not.

## 10. The algorithm, condensed

For the full worked pseudocode see
[`02-block-parsing.md` §10](02-block-parsing.md) (block loop) and
[`03-inline-parsing.md` §10](03-inline-parsing.md) (inline loop). The strategy in
one block:

```text
PHASE 1 — BLOCK STRUCTURE
  doc := new Document()
  line_no := 0
  for each line in input:                       # streaming; line can be dropped after
      line_no += 1
      # --- STEP 1: match continuation, never close yet ---
      cursor := line
      matched := [doc]                          # always matches
      for blk in open_blocks_after(doc):        # follow last_child chain
          if not blk.try_continue(cursor):       # consumes its own prefix if it matches
              break                             # <-- stop, do NOT close
          matched.push(blk)

      # --- STEP 2: look for new starts, then close what we skipped ---
      parent := matched.last
      if rest_of(cursor) starts a new block:    # in the precedence order of 02-.../§3
          close_blocks_below(parent)            # deferred close
          new_blk := open_block(parent, start)  # may recurse (list -> item -> para)
          cursor := rest_of(cursor)

      # --- STEP 3: add text to the deepest open block ---
      add_text(last_open_block, cursor)

      # --- deferred: only while the deepest open block is a paragraph ---
      if last_open_block is paragraph and cursor is a setext underline:
          convert paragraph to setext heading (level 1 for '=', 2 for '-')
          close it

  close_all_open_blocks()

  # --- paragraph finalisation (runs once per paragraph, at close) ---
  finalise(paragraph):
      while buffer starts with a valid link reference definition:
          record it in the global link-reference map; remove those lines
      # leftover stays a paragraph

PHASE 2 — INLINE STRUCTURE
  walk(block_tree):
      if block is paragraph | heading | table cell:
          parse_inlines(block.raw_text, link_ref_map)   # push delimiters
          process_emphasis(NULL)                        # resolve at end of input
      for child in block.children: walk(child)
```

## 11. Falsification tests for this design

If you are not convinced the two-phase model is *necessary* (rather than merely
common), these are the experiments that would falsify it:

| Experiment | If it passes, two-phase is… |
|-----------|----------------------------|
| Can a single-pass parser handle `` - `one\n- two` `` correctly? | not necessary for this case |
| Can a single-pass parser handle `[x]` before `[x]: /u` without buffering? | not necessary for this case |
| Can a single-pass parser handle `Foo\n---\n- bar` without backtracking? | not necessary |
| Can a single-pass parser produce correct output on the 652-example suite without backtracking? | **not necessary at all** |

We have not found such a parser, and the 14 ambiguities the spec enumerates in
§1.3 all have the same shape: the decision depends on information that is not
available yet. Treat "two-phase" as load-bearing.

---

## 12. Sources

- CommonMark 0.31.2, **Appendix: A parsing strategy**, spec.txt lines
  9420–9757: <https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/spec.txt>
  (rendered: <https://spec.commonmark.org/0.31.2/#appendix-a-parsing-strategy>)
- §3.1 Precedence and §3.2 Container blocks and leaf blocks: same document,
  lines 825–868
- §6.2 Emphasis and strong emphasis (flankingness, modulo-3 rule): lines 6098–6300
- GFM spec — contains the **identical** parsing-strategy appendix: <https://github.github.com/gfm/>
- Reference implementation (C), `cmark`: <https://github.com/commonmark/cmark>
- Reference implementation (JS), `commonmark.js`: <https://github.com/commonmark/commonmark.js>
- `cmark-gfm` pathological corpus (used for the `openers_bottom` demonstration):
  <https://raw.githubusercontent.com/github/cmark-gfm/master/test/pathological_tests.py>
- Our `openers_bottom` relevance and depth measurements:
  `D:\Dev\Temp\opencode\mdbench\scaling.js`, `scaling2.js`, `depth.js`, 2026-10-06
