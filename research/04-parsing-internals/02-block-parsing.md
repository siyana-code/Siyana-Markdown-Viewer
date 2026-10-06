# 02 — The block phase (Phase 1)

> **Scope.** Everything that happens between "we have a decoded string" and
> "we have a tree of blocks with raw text attached". The *rules* for each
> construct are in [`../02-syntax/01-block-elements.md`](../02-syntax/01-block-elements.md);
> this document is about **the loop**, the **precedence**, and the two
> computations that are easy to get subtly wrong: **"indent W"** (list item
> content indent) and **tightness propagation**.
>
> The shape of the loop itself is in
> [`01-reference-parsing-strategy.md` §4](01-reference-parsing-strategy.md).

---

## 1. Container blocks vs leaf blocks

CM §3.2:

> We can divide blocks into two types: container blocks, which can contain other
> blocks, and leaf blocks, which cannot.

| | Members | `cmark`'s `accepts_lines()` |
|---|---|---|
| **Container** | block quote, list item, *(list — a meta-container of items)* | — |
| **Leaf** | thematic break, ATX heading, setext heading, indented code, fenced code, HTML block, link reference definition, paragraph | paragraph, heading, code block |

The distinction is not cosmetic: `accepts_lines()` is what stops step 2 of the
per-line loop from descending into a leaf.

```c
static inline bool accepts_lines(cmark_node_type block_type) {
  return (block_type == CMARK_NODE_PARAGRAPH ||
          block_type == CMARK_NODE_HEADING ||
          block_type == CMARK_NODE_CODE_BLOCK);
}
```

and in `open_new_blocks()`:

```c
if (accepts_lines(S_type(*container))) {
  // if it's a line container, it can't contain other containers
  break;
}
```

So: **`headings` and `code_block` are leaves that still accept raw lines.**
That is the only reason `accepts_lines` is not identical to `contains_inlines`:

```c
static inline bool contains_inlines(cmark_node_type block_type) {
  return (block_type == CMARK_NODE_PARAGRAPH ||
          block_type == CMARK_NODE_HEADING);
}
```

`contains_inlines()` is the **phase-2** predicate: only paragraphs and headings
get their raw text parsed as inlines. Code blocks do not — their content is
literal, which is why CM §2.5 says entity and character references are *not*
recognised in code blocks and code spans. [VERIFIED — `inlines.c`, `blocks.c`]

**For our profile.** GFM's table is a new leaf. It accepts lines, does not
contain inlines at the block level (its cells do, later). So a table extension
must add itself to `accepts_lines`-equivalent logic or cells will be parsed as
paragraphs inside the table block.

---

## 2. The per-line classification, in cmark's order

`open_new_blocks()` tries branches in this order. **The order is the
precedence.** Reading it as a priority chain is the only reliable way to
implement it.

| # | Branch | Guard | Opens |
|---|--------|-------|-------|
| 1 | block quote | `!indented && peek == '>'` | `BLOCK_QUOTE` |
| 2 | ATX heading | `!indented && scan_atx_heading_start()` | `HEADING` (leaf) |
| 3 | opening code fence | `!indented && scan_open_code_fence()` | fenced `CODE_BLOCK` (leaf) |
| 4 | HTML block, types 1–6 | `!indented && (scan_html_block_start() \|\| (not paragraph && !maybe_lazy && scan_html_block_start_7()))` | `HTML_BLOCK` |
| 5 | **setext underline** | `!indented && cont is PARAGRAPH && scan_setext_heading_line() && resolve_reference_link_definitions()` **succeeds** | *mutates the paragraph into* `HEADING` |
| 6 | thematic break | `!indented && !(cont is PARAGRAPH && !all_matched) && kill_pos <= first_nonspace && scan_thematic_break()` | `THEMATIC_BREAK` (leaf) |
| 7 | list marker | `(!indented \|\| cont is LIST) && indent < 4 && parse_list_marker(..., cont is PARAGRAPH, ...)` | `LIST` and `LIST_ITEM` |
| 8 | indented code | `indented && !maybe_lazy && !blank` | `CODE_BLOCK` (leaf) |
| 9 | fall through | | `break` |

Three of these deserve the note "this is not the order you would guess".

### 2.1 Setext beats thematic break, and the code shows how

Branch 5 (setext) is **above** branch 6 (thematic break), and its final guard is
a call to `resolve_reference_link_definitions(parser)` — the function that
strips `[foo]: /url` prefixes from a paragraph's accumulated content.

Why? Because of this input:

```markdown
[foo]:
---
```

Per CM §4.7, `[foo]:` alone (no destination) is *not* a valid link reference
definition, so the paragraph keeps its content, and `---` becomes a setext
underline. But:

```markdown
[foo]: /url
---
```

*is* a link reference definition followed by nothing, so the paragraph is
entirely consumed, and `---` cannot be a setext underline (there is no paragraph
left to underline) — so it falls through to branch 6 and becomes a thematic
break.

The source comment says so:

```c
// Setext underline only if paragraph content remains after resolving
// reference definitions; otherwise fall through so `---` can still
// be a thematic break.
```

This is a genuinely obscure interaction, it is in the spec (CM §4.7 Example
"link reference definitions can occur inside block containers", and the
setext-after-reference-defs examples in CM §4.3), and it is the reason branch 5
must call the resolver rather than just checking that the paragraph is
non-empty. [VERIFIED]

### 2.2 The thematic break is gated on `all_matched`

```c
} else if (!indented &&
           !(cont_type == CMARK_NODE_PARAGRAPH && !all_matched) &&
           (parser->thematic_break_kill_pos <= parser->first_nonspace) &&
           S_scan_thematic_break(parser, input, parser->first_nonspace)) {
```

`!(cont is PARAGRAPH && !all_matched)` means: **if we are in a paragraph and at
least one container was unmatched, this line cannot be a thematic break.** That
is the laziness rule from CM §5.1 turned into a guard. A `---` that follows an
unmarked lazy-continuation line cannot end the paragraph.

The full rule, stated normatively, is CM §4.1's two precedence clauses:

> If a line of dashes that meets the above conditions for being a thematic break
> could also be interpreted as the underline of a setext heading, the
> interpretation as a setext heading takes precedence.
>
> When both a thematic break and a list item are possible interpretations of a
> line, the thematic break takes precedence.

and §5.2's:

> If any line is a thematic break then that line is not a list item.

### 2.3 The `maybe_lazy` flag

```c
bool maybe_lazy = S_type(parser->current) == CMARK_NODE_PARAGRAPH;
```

Set at the top of `open_new_blocks()`, then cleared at the bottom of the loop
body after the first successful branch:

```c
cont_type = S_type(*container);
maybe_lazy = false;
```

It exists so that branches 4 (HTML block type 7) and 8 (indented code) are
suppressed on the first line when we are inside a paragraph that could receive
a lazy continuation. i.e. **`<pre>` and an indented code block cannot start on
a lazy continuation line.** Consequence:

```markdown
> foo
    bar
```

`bar` is not an indented code block, because the lazy paragraph continues.
Compare CM §4.4: "An indented code block cannot interrupt a paragraph."

---

## 3. HTML blocks: seven start conditions, seven end conditions

CM §4.6 defines HTML blocks by a start condition and a matching end condition:

> There are seven kinds of HTML block, which can be defined by their start and
> end conditions. The block begins with a line that meets a start condition
> (after up to three optional spaces of indentation). It ends with the first
> subsequent line that meets a matching end condition, or the last line of the
> document, or the last line of the container block containing the current HTML
> block, if no line is encountered that meets the end condition. **If the first
> line meets both the start condition and the end condition, the block will
> contain just that line.**

| Type | Start condition | End condition |
|---|---|---|
| 1 | `<pre`, `<script`, `<style`, `<textarea` (case-insensitive) followed by space, tab, `>`, or EOL | line contains `</pre>`, `</script>`, `</style>`, `</textarea>` (need not match the start tag) |
| 2 | `<!--` | line contains `-->` |
| 3 | `<?` | line contains `?>` |
| 4 | `<!` + ASCII letter | line contains `>` |
| 5 | `<![CDATA[` | line contains `]]>` |
| 6 | `<` or `</` + one of 62 block-level tag names, followed by space, tab, EOL, `>`, or `/>` | line is followed by a **blank line** |
| 7 | a complete open tag (any tag name other than `pre`/`script`/`style`/`textarea`) **or** a complete closing tag, followed by zero or more spaces/tabs and EOL | line is followed by a **blank line** |

Plus:

> All types of HTML blocks except type 7 may interrupt a paragraph. Blocks of
> type 7 may not interrupt a paragraph. (This restriction is intended to prevent
> unwanted interpretation of long tags inside a wrapped paragraph as starting
> HTML blocks.)

### 3.1 How the end condition is evaluated

Types 6 and 7 are checked in **step 1** (`parse_html_block_prefix()`), not in
step 3:

```c
static bool parse_html_block_prefix(cmark_parser *parser,
                                    cmark_node *container) {
  int html_block_type = container->as.html_block_type;
  assert(html_block_type >= 1 && html_block_type <= 7);
  switch (html_block_type) {
  case 1: case 2: case 3: case 4: case 5:
    res = true;  break;          // these types of blocks can accept blanks
  case 6: case 7:
    res = !parser->blank; break; // they end at a blank line
  }
  return res;
}
```

Types 1–5 have their end condition tested in **step 3**, after the line has
been appended:

```c
} else if (S_type(container) == CMARK_NODE_HTML_BLOCK) {
  add_line(input, parser);
  int matches_end_condition;
  switch (container->as.html_block_type) {
  case 1: matches_end_condition = scan_html_block_end_1(...); break;  // </script> etc
  case 2: matches_end_condition = scan_html_block_end_2(...); break;  // -->
  case 3: matches_end_condition = scan_html_block_end_3(...); break;  // ?>
  case 4: matches_end_condition = scan_html_block_end_4(...); break;  // >
  case 5: matches_end_condition = scan_html_block_end_5(...); break;  // ]]>
  default: matches_end_condition = 0; break;   // types 6 & 7 handled earlier
  }
  if (matches_end_condition) {
    container = finalize(parser, container);
  }
}
```

**The split matters for correctness, not just speed.** An HTML block that meets
its end condition on its *opening* line must contain exactly one line — that is
what the prose rule guarantees, and the two-phase check (start in step 2, end in
step 3 of the *same* line) is how you get it.

### 3.2 The rule that surprises people: start condition wins for the whole block

CM §4.6 continues:

> HTML blocks continue until they are closed by their appropriate end
> condition, or the last line of the document or other container block. This
> means any HTML **within an HTML block** that might otherwise be recognised as a
> start condition will be ignored by the parser and passed through as-is,
> **without changing the parser's state**.

Worked example from the spec:

```markdown
<table><tr><td>
<pre>
**Hello**,

_world_.
</pre>
</td></tr></table>
```

```html
<table><tr><td>
<pre>
**Hello**,
<p><em>world</em>.
</pre></p>
</td></tr></table>
```

The `<pre>` on line 2 does **not** start a type-1 block, because the parser is
already in a type-6 block. The blank line terminates it, and normal parsing
resumes *inside* the raw text. This is exactly the trap where a naive
implementation that re-tests the start condition per line goes quadratic.

### 3.3 Why the security decision and the conformance decision are separate

`cmark-gfm`'s `tagfilter` is a *rendering* pass over the type-1/6 tags. It does
not change block structure. Conformance requires implementing all seven types
exactly; security requires escaping them. Our profile does the former and lets
[`../06-libraries/05-sanitizer-libraries.md`](../06-libraries/05-sanitizer-libraries.md)
do the latter. Do not let a security decision silently become a conformance
shortcut — a viewer that disables raw HTML is *not* CommonMark-conformant, and
we measure that as a failure. [`../02-syntax/05-test-fixture-strategy.md` §6](../02-syntax/05-test-fixture-strategy.md)

---

## 4. The precedence chain we will implement

The reference implementation's *branch order* and the *spec's statement of
precedence* are not the same list, and conflating them is how you end up with a
parser that fails examples. The spec's own precedence statements, collected:

| Precedence | Source | Example |
|---|---|---|
| Block indicators beat inline indicators | §3.1 | `` - `one␤- two` `` → two list items (Ex. 42) |
| Setext underline > thematic break | §4.1 | `Foo␤---␤bar` → `<h2>Foo</h2>` (Ex. 59) |
| Thematic break > list item | §4.1 | `* Foo␤* * *␤* Bar` (Ex. 60) |
| HTML types 1–6 > paragraph interruption; type 7 may not interrupt | §4.6 | — |
| ATX heading > setext, for the *same* line | §4.2 vs §4.3 | setext lines "cannot be interpretable as … ATX heading" |
| Fenced code > setext | §4.3 | — |
| List item continuation > indented code, when both are possible | §4.4 | `  - foo␤␤    bar` |
| Indented code cannot interrupt a paragraph | §4.4 | `Foo␤    bar` → `<p>Foo␤bar</p>` |

### 4.1 Worked precedence examples

Each of these is a real CommonMark example; each has bitten a hand-rolled parser
at least once.

```markdown
Foo
---
```

→ setext `<h2>`. The `---` **converts the open paragraph**. Setext is not a new
block; it is a reclassification. That is why it is only checked when the
deepest open block is already a paragraph.

```markdown
* Foo
* * *
```

→ `<ul><li>Foo</li></ul><hr /><ul>…`. Thematic break wins over list item (§4.1).

```markdown
-    one

  two
```

→ `<ul><li>one</li></ul><pre><code> two</code></pre>`. **Content indent is
6** (marker `-` width 1 + 5 spaces? no — `-` + 4 spaces = 5, then the extra
space makes 6), so 2 spaces is not enough and `two` becomes an indented code
block *at top level*. See §5.

```markdown
> foo
-----
```

→ `<blockquote><p>foo</p></blockquote><hr />`. The `-----` did not match the
block quote, so the paragraph would have to be lazily continued — but a setext
underline cannot be lazy (CM §4.3) and a thematic break cannot interrupt a
lazily-matched paragraph (§5.1 laziness + §4.1). Result: quote closes, break.

```markdown
---
---
```

→ two `<hr />`. The first `---` is a thematic break because there is no open
paragraph to become a setext heading. CM §4.3: "Setext heading text lines must
not be interpretable as block constructs other than paragraphs."

```markdown
[foo]: /url
---
```

→ `<hr />`, **not** a setext heading with an empty body. See §2.1: the paragraph
was entirely consumed by the reference definition.

---

## 5. "Indent W" — the content-indent computation

This is the hardest single idea in CM §5.2, and the spec itself flags it:

> It is tempting to think of this in terms of columns: the continuation blocks
> must be indented at least to the column of the first character other than a
> space or tab after the list marker. **However, that is not quite right.** The
> spaces of indentation after the list marker determine how much *relative*
> indentation is needed. Which column this indentation reaches will depend on how
> the list item is embedded in other constructions.

[VERIFIED — CM §5.2]

### 5.1 The three construction rules

CM §5.2 states three rules, not one:

| Rule | First block of the item | Marker | Spacing after marker | Required indent for subsequent lines |
|---|---|---|---|---|
| **#1 Basic case** | starts with a non-space, non-tab character | `M`, width `W` | 1 ≤ `N` ≤ 4 spaces | **`W + N`** |
| **#2 Starts with indented code** | an indented code block | `M`, width `W` | one space | **`W + 1`** |
| **#3 Starts with a blank line** | a single blank line | `M`, width `W` | — | **`W + 1`** |

Rule #1 exceptions:

> 1. When the first list item in a list interrupts a paragraph … then (a) the
>    lines *Ls* must not begin with a blank line, and (b) if the list item is
>    ordered, the start number must be 1.
> 2. If any line is a thematic break then that line is not a list item.

And an important scope limit:

> Note that rules #1 and #2 only apply to two cases: (a) cases in which the
> lines to be included in a list item begin with a character other than a space
> or tab, and (b) cases in which they begin with an indented code block.

The third case — first block begins with 1–3 spaces of indentation — is handled
by observing that removing up to 3 spaces of indentation "can always be removed
without a change in interpretation, allowing rule #1 to be applied."

### 5.2 Why `N ≤ 4` and what happens past it

If more than 4 spaces follow the marker, or the item starts with a blank line,
the spacing is treated as **one** space (rules #2/#3). Worked examples:

```markdown
-    one

  two
```

content indent = 1 (marker) + 1 (the >4 spaces case collapses to 1) + … let us
be exact. `cmark` computes it:

```c
// compute padding:
S_advance_offset(parser, input, parser->first_nonspace + matched - parser->offset, false);
save_partially_consumed_tab = parser->partially_consumed_tab;
save_offset = parser->offset;
save_column  = parser->column;

while (parser->column - save_column <= 5 && S_is_space_or_tab(peek_at(input, parser->offset))) {
  S_advance_offset(parser, input, 1, true);
}

i = parser->column - save_column;
if (i >= 5 || i < 1 ||
    // only spaces after list marker:
    S_is_line_end_char(peek_at(input, parser->offset))) {
  data->padding = matched + 1;      // <- rules #2 / #3
  parser->offset = save_offset;
  parser->column = save_column;
  parser->partially_consumed_tab = save_partially_consumed_tab;
  if (i > 0) { S_advance_offset(parser, input, 1, true); }
} else {
  data->padding = matched + i;      // <- rule #1: W + N
}
```

Read that as: **count up to 6 columns of post-marker spacing. If the count
reaches 5+ (i.e. 5 or 6 spaces, meaning 5+ spaces after the marker), or the
count is 0, or the marker is followed only by whitespace to end of line, use
`W + 1`. Otherwise use `W + i`.**

`matched` is the marker width. And crucially the padding is stored as a
*relative* quantity alongside the marker's own indent:

```c
data->marker_offset = parser->indent;   // W's contribution from the left
```

so the item's continuation test is:

```c
static bool parse_node_item_prefix(cmark_parser *parser, cmark_chunk *input,
                                   cmark_node *container) {
  if (parser->indent >= container->as.list.marker_offset + container->as.list.padding) {
    S_advance_offset(parser, input, container->as.list.marker_offset + container->as.list.padding, true);
    return true;
  } else if (parser->blank && container->first_child != NULL) {
    S_advance_offset(parser, input, parser->first_nonspace - parser->offset, false);
    return true;
  }
  return false;
}
```

`indent` is a **virtual column count from the start of the line**, and
`marker_offset + padding` is a *threshold in that same coordinate system*.
Because `marker_offset` is the marker's own column on its line, nesting works
without recomputing anything.

### 5.3 The columns fallacy, with the spec's own example

CM §5.2's second example:

```markdown
   > > 1.  one
>>
>>     two
```

→

```html
<blockquote><blockquote><ol><li><p>one</p><p>two</p></li></ol></blockquote></blockquote>
```

Here `two` is in the *same column* as the list marker `1.`, yet it is inside the
list item, "because there is sufficient indentation after the last containing
blockquote marker."

And the converse:

```markdown
>>- one
>>
  >  > two
```

→ `two` is **not** in the list item, despite being far to the right of `one`,
"because it is not indented far enough past the blockquote marker."

**The lesson:** never store "the column where content begins". Store "the
indent, in columns from the line start, that a continuation line must reach."
[INFERRED from the spec's warning + the `marker_offset + padding` code; the two
examples above are CM §5.2's and pass in both reference implementations.]

### 5.4 Tabs and the content indent

Because `indent` is a virtual column computed with a 4-column tab stop
(`S_advance_offset(..., columns=true)` sets `partially_consumed_tab` when it
lands mid-tab), `cmark` can advance a *column* count without ever losing the
literal tab. `add_line()` then re-inserts the partial tab as spaces:

```c
static void add_line(cmark_chunk *ch, cmark_parser *parser) {
  if (parser->partially_consumed_tab) {
    parser->offset += 1;                 // skip over tab
    chars_to_tab = TAB_STOP - (parser->column % TAB_STOP);
    for (i = 0; i < chars_to_tab; i++) cmark_strbuf_putc(&parser->content, ' ');
  }
  cmark_strbuf_put(&parser->content, ch->data + parser->offset, ch->len - parser->offset);
}
```

This is why "just expand tabs to spaces at load time" is wrong: CM §2.2 requires
internal tabs in code blocks and code spans to survive literally. →
[`../02-syntax/01-block-elements.md` §1.2](../02-syntax/01-block-elements.md)

---

## 6. Tightness — computed at list close, by walking children

CM §5.3 defines it in one sentence:

> A list is **loose** if any of its constituent list items are separated by
> blank lines, or if any of its constituent list items directly contain two
> block-level elements with a blank line between them. Otherwise a list is
> **tight**. (The difference in HTML output is that paragraphs in a loose list
> are wrapped in `<p>` tags, while paragraphs in a tight list are not.)

`cmark` implements it in `finalize()` for `CMARK_NODE_LIST` (§6 of
[`01-reference-parsing-strategy.md`](01-reference-parsing-strategy.md)):

```c
b->as.list.tight = true;  // tight by default
item = b->first_child;
while (item) {
  // check for non-final non-empty list item ending with blank line:
  if (S_last_line_blank(item) && item->next) { b->as.list.tight = false; break; }
  // recurse into children of list item, to see if there are spaces between them:
  subitem = item->first_child;
  while (subitem) {
    if ((item->next || subitem->next) && S_ends_with_blank_line(subitem)) {
      b->as.list.tight = false; break;
    }
    subitem = subitem->next;
  }
  b->as.list.tight || (item = item->next);
}
item = item->next;
}
```

Two subtleties:

1. **`item->next` in the guard.** A blank line at the end of the *last* item
   does not make the list loose, because it is the end of the list, not a
   separator between items.
2. **`(item->next || subitem->next)`** — the same reasoning one level down: a
   trailing blank line inside the last block of the last item is not a
   separator.

And `S_ends_with_blank_line()` descends through lists and list items:

```c
static bool S_ends_with_blank_line(cmark_node *node) {
  while (!S_last_line_checked(node)) {
    S_set_last_line_checked(node);
    if (S_type(node) != CMARK_NODE_LIST && S_type(node) != CMARK_NODE_ITEM) break;
    if (!node->last_child) break;
    node = node->last_child;
  }
  return S_last_line_blank(node);
}
```

**So tightness is computed by descending to the *last* descendant**, which is
why it is O(list depth) at close time and why an implementation that tracks
tightness *during* the loop gets nested-list cases wrong.

### 6.1 The blank-line flag, and what deliberately does not set it

```c
const bool last_line_blank =
  (parser->blank && ctype != CMARK_NODE_BLOCK_QUOTE &&
   ctype != CMARK_NODE_HEADING && ctype != CMARK_NODE_THEMATIC_BREAK &&
   !(ctype == CMARK_NODE_CODE_BLOCK && container->as.code.fenced) &&
   !(ctype == CMARK_NODE_ITEM && container->first_child == NULL &&
     container->start_line == parser->line_number));
```

with the source comment:

> block quote lines are never blank as they start with `>` and we don't count
> blanks in fenced code for purposes of tight/loose lists or breaking out of
> lists. we also don't set `last_line_blank` on an empty list item.

That is the whole of CM §5.3's "loose" definition, made executable. A blank line
inside a fenced code block does not loosen a list; an empty list item's own
trailing blank line does not loosen a list. Both are spec examples (CM §5.3).

### 6.2 The `last_line_blank` reset up the tree

```c
tmp = container;
while (tmp->parent) {
  S_set_last_line_blank(tmp->parent, false);
  tmp = tmp->parent;
}
```

A non-blank line anywhere clears the flag on every ancestor. That is what makes
`S_ends_with_blank_line()` meaningful: the flag means "the *last* line I saw in
this subtree was blank", not "there is a blank line somewhere in here".

**For our renderer.** Tightness is an HTML-level decision (`<p>` or not). If we
render from markdown-it's token stream we get it for free from `token.hidden`;
if we ever build our own AST we must replicate this. Recommend: keep the
reference implementation's answer and expose it as a property rather than
recomputing it. [RECOMMENDED]

---

## 7. Pseudocode — the whole block loop, condensed

Reference form with our profile's additions marked. [VERIFIED structure; the
`FRONT MATTER`, `TABLE`, `ALERTS` branches are ours]

```text
PROCEDURE parse_phase1(text, profile):
  # ---- PRE-PASS, outside CommonMark entirely ----
  body, meta := strip_front_matter(text)     # BREAKS-COMMONMARK; see 03-extension-standards
  root := DOCUMENT (open)

  FOR line IN split_lines(body):
      S_process_line(line)

  close_all_open(root)
  return root

PROCEDURE S_process_line(line):
  ensure line ends with a line ending
  offset := 0 ; column := 0 ; first_nonspace := 0
  indent := 0 ; blank := is_blank(line) ; kill_pos := 0

  # ---- STEP 1 ----
  last_matched := check_open_blocks(line)   # may close a fenced code block early
  all_matched  := (last_matched != NULL)

  # ---- STEP 2 ----
  container := open_new_blocks(last_matched, line, all_matched)

  # ---- STEP 3 ----
  add_text_to_container(container, last_matched, line)

# ----------------------------------------------------------------------

PROCEDURE check_open_blocks(line):
  cont := root
  WHILE cont.last_child is open:
      cont := cont.last_child
      find_first_nonspace(line)             # sets indent, blank
      IF NOT try_continuation(cont, line):  # per-type prefix predicate
          RETURN cont.parent                # last MATCHED, nothing closed
  RETURN cont

PROCEDURE open_new_blocks(cont, line, all_matched):
  maybe_lazy := (cont.current is PARAGRAPH)
  LOOP:
      find_first_nonspace(line)
      indented := (indent >= 4)

      # precedence is the branch ORDER — do not reorder
      IF NOT indented AND line[first_nonspace] == '>':
          consume('>'); consume(one space/tab if present)
          cont := add_child(cont, BLOCK_QUOTE)
      ELSE IF NOT indented AND atx_heading(line, first_nonspace):
          cont := add_child(cont, HEADING); set level; consume opener
          BREAK                                        # leaf
      ELSE IF NOT indented AND open_code_fence(line, first_nonspace):
          cont := add_child(cont, CODE_BLOCK); record char + length + offset
          BREAK
      ELSE IF NOT indented AND html_block_start_1_to_6(line):
          cont := add_child(cont, HTML_BLOCK); record type 1..6
          # deliberately DO NOT consume the tag: it is part of the text
      ELSE IF NOT indented AND html_block_start_7(line)
              AND cont is not PARAGRAPH AND NOT maybe_lazy:
          cont := add_child(cont, HTML_BLOCK); record type 7; BREAK
      # >>> PROFILE: GFM table would be tested HERE, after html_block, before
      #     setext, because a table must win over a paragraph it follows <<<
      ELSE IF NOT indented AND cont is PARAGRAPH
              AND setext_underline(line, first_nonspace)
              AND resolve_reference_link_definitions(cont.content) is non-empty:
          cont.type := HEADING ; cont.level := lev ; cont.setext := true
          consume(rest of line); BREAK
      ELSE IF NOT indented AND NOT (cont is PARAGRAPH AND NOT all_matched)
              AND kill_pos <= first_nonspace
              AND thematic_break(line, first_nonspace):
          cont := add_child(cont, THEMATIC_BREAK); consume(rest); BREAK
      ELSE IF (NOT indented OR cont is LIST) AND indent < 4
              AND list_marker(line, first_nonspace, interrupts_paragraph):
          W := matched ; N := spacing (see §5.2)
          marker_offset := indent
          padding := (N in 1..4 AND line has content after) ? W + N : W + 1
          IF cont is not LIST OR NOT lists_match(cont, data):
              cont := add_child(cont, LIST); copy list data
          cont := add_child(cont, LIST_ITEM); copy list data
          maybe_lazy := false
      ELSE IF indented AND NOT maybe_lazy AND NOT blank:
          consume(4 columns); cont := add_child(cont, CODE_BLOCK); BREAK
      ELSE IF profile.alert AND NOT indented AND cont is BLOCK_QUOTE
              AND line[first_nonspace+1] == '[' AND alert_type(...):
          attach ALERT node to the block quote's first child; BREAK
      ELSE:
          BREAK

      IF accepts_lines(cont.type): BREAK
      maybe_lazy := false
  RETURN cont

PROCEDURE add_text_to_container(container, last_matched, line):
  find_first_nonspace(line)
  if blank and container.last_child: set_last_line_blank(container.last_child)
  compute last_line_blank for container (see §6.1) and clear it on all ancestors

  IF current != last_matched AND container == last_matched
     AND NOT blank AND current is PARAGRAPH:
      add_line(line)                    # LAZY CONTINUATION
      RETURN

  WHILE current != last_matched: current := finalize(current)

  IF container is CODE_BLOCK:               add_line(line)
  ELSE IF container is HTML_BLOCK:
      add_line(line)
      IF end_condition_met(container, line): container := finalize(container)
  ELSE IF blank:                            pass
  ELSE IF accepts_lines(container.type):
      IF container is ATX HEADING: strip closing # run
      skip(first_nonspace - offset); add_line(line)
  ELSE:
      container := add_child(container, PARAGRAPH)
      skip(first_nonspace - offset); add_line(line)
  current := container
```

---

## 8. `markdown-it`'s block parser, for comparison

`markdown-it` does **not** implement Appendix A's open/closed tree. It has a
**rule chain** — an ordered list of `(state, startLine, endLine, silent) ->
boolean` functions — and the chain order *is* the precedence.

```ts
const _rules = [
  ['table',    r_table,      ['paragraph', 'reference']],
  ['code',     r_code],
  ['fence',    r_fence,      ['paragraph', 'reference', 'blockquote', 'list']],
  ['blockquote', r_blockquote,['paragraph', 'reference', 'blockquote', 'list']],
  ['hr',       r_hr,         ['paragraph', 'reference', 'blockquote', 'list']],
  ['list',     r_list,       ['paragraph', 'reference', 'blockquote']],
  ['reference',r_reference],
  ['html_block',r_html_block,['paragraph', 'reference', 'blockquote']],
  ['heading',  r_heading,    ['paragraph', 'reference', 'blockquote']],
  ['lheading', r_lheading],
  ['paragraph',r_paragraph]
]
```

The third array is the "can be terminated by" list: it tells the rule which
already-open containers will be closed when this rule fires, which is
`markdown-it`'s equivalent of Appendix A's close-before-open. The dispatcher:

```ts
while (line < endLine) {
  state.line = line = state.skipEmptyLines(line)
  if (line >= endLine) break
  if (state.sCount[line] < state.blkIndent) break          // container unmatched
  if (state.level >= maxNesting) { state.line = endLine; break }   // DEPTH CAP
  for (let i = 0; i < len; i++) {
    ok = rules[i](state, line, endLine, false)
    if (ok) {
      if (prevLine >= state.line) throw new Error("block rule didn't increment state.line")
      break
    }
  }
  if (!ok) throw new Error('none of the block rules matched')
  state.tight = !hasEmptyLines
  ...
}
```

Three observations:

1. **`table` is first**, not fourth. Because it also carries
   `['paragraph','reference']` as terminators, ordering it first is safe; the
   `alt` list is what enforces precedence, not the position. This is a
   different (and arguably more modular) encoding of the same idea than cmark's
   branch order.
2. **`code` (indented) is second**, because it is a cheap negated test. Again
   the `alt` list does the real work.
3. **`maxNesting` is enforced here**, with the comment "If nesting level
   exceeded - skip tail to the end. That's not ordinary situation and we should
   not care about content." Note it does **not** throw; it silently stops. Our
   profile wants a typed error instead. [RECOMMENDED — see `05` §7]
4. **`state.tight` is a running flag**, not computed at list close. It is
   `!hasEmptyLines`, where `hasEmptyLines` is set when the *previous* line was
   blank. That is a cheaper approximation of CM §5.3 that happens to be exact
   for the fixture corpus. We do not know of a case where it diverges;
   flagging it as [UNVERIFIED] rather than asserting equivalence.

---

## 9. Things a block parser must get right that have nothing to do with grammar

| Concern | Why | Where |
|---|---|---|
| **Line endings** | CM §2.1: LF, CR, and CRLF are *all* line endings; mixed endings in one document are legal. `cmark` handles a chunk boundary falling between CR and LF (`last_buffer_ended_with_cr`). | [`../02-syntax/01-block-elements.md` §1.1](../02-syntax/01-block-elements.md) |
| **BOM** | `cmark`'s `S_parser_feed()` skips a UTF-8 BOM only on the very first chunk. | `04-edge-cases-and-traps.md` §7.2 |
| **NUL** | CM §2.3 requires U+0000 → U+FFFD, and `cmark`'s pathological suite asserts `abc\ufffd?de\ufffd?`. | §1.3 of `02-syntax/01` |
| **Source positions** | `cmark` records `start_line`/`start_column`/`end_line`/`end_column` on every node. `markdown-it` records `token.map = [startLine, endLine]`. Both are needed for our incremental renderer. | [`../06-libraries/01-js-parsers.md` §7.4](../06-libraries/01-js-parsers.md) |
| **Ordered list start digits** | CM §5.2: 1–9 digits. `cmark` comments "we limit to 9 digits to avoid overflow, assuming max int is 2^31-1. This also seems to be the limit for 'start' in some browsers." | §5.2 of this document |
| **Quadratic blank lines in deep lists** | `cmark`'s `check_open_blocks()` has an explicit early-out: "Avoid quadratic behavior caused by iterating deeply nested lists for each blank line." | [`05-performance-and-limits.md` §3](05-performance-and-limits.md) |

---

## 10. Review checklist for the block phase

- [ ] Every line goes through match → open → add, in that order, exactly once.
- [ ] Unmatched open blocks are *not* closed in step 1.
- [ ] New block starts close unmatched blocks before opening.
- [ ] Branch order encodes precedence, and the `---`/`* * *`/`|` cases from §4.1
      all produce the spec's output.
- [ ] Setext is checked **only** when the deepest matched block is a paragraph,
      **and** after resolving reference definitions.
- [ ] All seven HTML block types implemented, with the start-condition-wins rule
      and the "only 1–6 may interrupt a paragraph" rule.
- [ ] List content indent stored as `marker_offset + padding` relative to line
      column, **not** as an absolute column.
- [ ] Rules #1/#2/#3 of CM §5.2 distinguished, including `N > 4` → `W + 1`.
- [ ] Ordered marker width capped at 9 digits.
- [ ] Tightness computed at list close by descending to last descendants, with
      the `item->next` guards.
- [ ] `last_line_blank` not set by fenced-code blanks, block-quote lines,
      heading/break lines, or empty list items.
- [ ] Nesting depth capped, and breach produces a typed error, not a throw and
      not silence.
- [ ] Source spans recorded on every block.

---

## 11. Sources

All fetched 2026-10-06.

- CommonMark 0.31.2 §2.1–2.2, §3.1–3.2, §4.1–4.9, §5.1–5.3: <https://spec.commonmark.org/0.31.2/>
- CommonMark `spec.txt` 0.31.2 (list-item rules 1–4, tightness prose, HTML block table, the two "columns" examples): <https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/spec.txt>
- `cmark` `src/blocks.c` — `check_open_blocks`, `open_new_blocks`, `add_text_to_container`, `add_child`, `finalize`, `parse_list_marker`, `parse_node_item_prefix`, `parse_html_block_prefix`, `S_scan_thematic_break`, `S_find_first_nonspace`, `S_advance_offset`, `add_line`: <https://raw.githubusercontent.com/commonmark/cmark/master/src/blocks.c>
- `markdown-it` `src/parser_block.ts` (rule chain + `alt` lists + `maxNesting`): <https://raw.githubusercontent.com/markdown-it/markdown-it/master/src/parser_block.ts>
- `markdown-it` `src/presets/default.ts` (`maxNesting: 100`) and `commonmark.ts` (`maxNesting: 20`): <https://raw.githubusercontent.com/markdown-it/markdown-it/master/src/presets/>
- `cmark` `test/pathological_tests.py` ("deeply nested lists", "empty lines in deeply nested lists"): <https://raw.githubusercontent.com/commonmark/cmark/master/test/pathological_tests.py>
- The normative rules themselves are documented, construct by construct, in [`../02-syntax/01-block-elements.md`](../02-syntax/01-block-elements.md). **This document does not repeat them and neither should an implementer.**
