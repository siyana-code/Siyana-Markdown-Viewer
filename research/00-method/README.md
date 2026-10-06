# 00 — Method

> How this research was done, how to read it, and how to attack it.

This folder is the audit trail for everything in `research/`. It exists because
"we chose markdown-it because it is fast" is not a decision anyone can review six
months later. It is a *claim*. This folder records what we checked, against
which primary source, on which date, and how confident we are.

Everything in `research/01-foundations/` and later must carry one of three
confidence tags from [the table below](#confidence-tags). A claim without a tag
is a claim we forgot to check.

---

## 1. Research questions inventory

These are the questions the whole `research/` tree answers. They are numbered so
other documents can cite them (`RQ-04` in `06-libraries/…` means "see
foundations RQ-04"). Status reflects what exists **today (2026-10-06)**.

| ID | Question | Why we ask it | Where answered | Status |
|----|----------|---------------|----------------|--------|
| RQ-01 | What *is* Markdown, defined from first principles, without assuming we know the syntax? | Everything downstream depends on the actual design goal, not the folklore | [`01-foundations/01-what-is-markdown.md`](../01-foundations/01-what-is-markdown.md) | Done |
| RQ-02 | Why did plain text win over HTML and over rich-text documents as a *storage* format? | Determines whether "edit a `.md` file with any editor" is a promise we can make | [`01-foundations/01-what-is-markdown.md`](../01-foundations/01-what-is-markdown.md) | Done |
| RQ-03 | What is the cost, in bytes and in information, of each representation of the same document? | Storage format choice, cache keys, undo granularity | [`01-foundations/01-what-is-markdown.md`](../01-foundations/01-what-is-markdown.md) | Done |
| RQ-04 | What is the real timeline, and who arbitrates the spec? | We must know whose opinion binds us | [`01-foundations/02-history-and-evolution.md`](../01-foundations/02-history-and-evolution.md) | Done |
| RQ-05 | Why did the community fragment, and what did CommonMark actually unify? | Tells us how much "spec compliance" is achievable | [`01-foundations/02-history-and-evolution.md`](../01-foundations/02-history-and-evolution.md) | Done |
| RQ-06 | Which design principles survive *every* dialect, and are therefore safe to rely on? | Our renderer must behave sanely even for input no spec covers | [`01-foundations/03-core-principles.md`](../01-foundations/03-core-principles.md) | Done |
| RQ-07 | Why does emphasis need delimiter-run rules? What does a naive parser get wrong? | This is where most "renderer bugs" actually live | [`01-foundations/03-core-principles.md`](../01-foundations/03-core-principles.md) | Done |
| RQ-08 | What does a *viewer* owe that a *renderer library* does not? | Scope boundary for this project | [`01-foundations/04-the-viewer-problem.md`](../01-foundations/04-the-viewer-problem.md) | Done |
| RQ-09 | Which of those viewer obligations have **no library answer**? | Tells us what we must build ourselves | [`01-foundations/04-the-viewer-problem.md`](../01-foundations/04-the-viewer-problem.md) | Done |
| RQ-10 | Which parser should the desktop app use? | The single most consequential dependency | `06-libraries/` | Open |
| RQ-11 | Electron vs Tauri vs Wails vs Flutter for the window? | Decides language, size model, sandbox story | `08-desktop-frameworks/` | Open |
| RQ-12 | What is the XSS surface of rendering untrusted local `.md`? | Viewer security is remote-code-execution adjacent | `11-security/` | Open |
| RQ-13 | How do we watch the filesystem reliably on Windows and Linux? | Correctness requirement, not a nicety | `14-architecture-options/` | Open |
| RQ-14 | What do large documents do to a browser engine? | Sets hard limits we must design for | `10-performance/` | Open |
| RQ-15 | What can be stolen or corrupted if we render a hostile file? | Trust boundary | `11-security/` | Open |

**Out of scope on purpose (and why):**

- Syntax-level reference tables (`02-syntax/`). Those are mechanical transcriptions
  of the spec; there is nothing to *research*, only to copy accurately.
- Licensing of third-party parsers is deferred until a parser is actually chosen,
  but is flagged as a gate in `06-libraries/`.
- Internationalisation of our own UI. Not a research question until it blocks us.

---

## 2. Source-quality hierarchy

We rank sources. When two sources disagree, the higher one wins and we note the
disagreement rather than silently picking one.

| Tier | Kind | Weight | How we use it |
|------|------|--------|---------------|
| **S1** | Normative specification text — CommonMark 0.31.2, GFM 0.29-gfm, RFC 7763/7764, IANA registries | Defines truth. Quoted verbatim where it matters | "X is defined as…" — never paraphrase into a stronger claim |
| **S2** | Primary author statements — Gruber's own pages, MacFarlane's changelog and forum posts, project READMEs | Authoritative for *intent*, not for *behaviour* | "The author said the goal is X" |
| **S3** | Implementation source code and package registries | Authoritative for *actual behaviour* | "As of version N, library L does X" |
| **S4** | Benchmarks **we ran ourselves**, in this repo, with a checked-in script | Authoritative for our configuration on our machine | Always paired with machine, versions, and date |
| **S5** | Encyclopædic / tertiary (Wikipedia, Markdown Guide) | Orientation only; every load-bearing claim is traced to S1–S3 | Never the final word |
| **S6** | Press, blog posts, forum threads | Context, motivation, and *stated positions* of named people | Used for "who argued what", not for facts |
| **S7** | Vendor marketing, unverified claims | No weight | Recorded only when it tells us what a vendor *claims* |

### Rules that follow from the hierarchy

1. **Never cite S5 for a normative claim.** Wikipedia is used to *find* primary
   sources (its footnotes are genuinely good for this) and to *date* things
   where a primary source exists but is hard to read. Every Wikipedia fact that
   appears in `01-foundations/` is corroborated by S1/S2 in the same sentence or
   the next one.
2. **A version number without a retrieval date is a bug.** "markdown-it is
   fast" is meaningless; "markdown-it 15.0.2 passes 652/652 CommonMark 0.31.2
   examples when run with the `commonmark` preset on Node 24.14.1 / win32-x64
   on 2026-10-06" is a fact.
3. **Our own benchmarks are S4 and never S1.** They describe *our* run on *our*
   machine. They cannot tell you how the library behaves for you. They are also
   the easiest thing to get wrong, so the script is checked in.
4. **Disagreement is data.** Where S1 and a widely-used implementation disagree
   (and they do — see the conformance table in
   [`01-foundations/02-history-and-evolution.md`](../01-foundations/02-history-and-evolution.md)),
   we record both and explain which one we follow and why.
5. **"I could not verify this" is a valid, valuable result.** It goes in the
   document, tagged UNVERIFIED, not into a footnote we forget.

---

## 3. Confidence tags

Applied to load-bearing claims. A reader should be able to grep
`VERIFIED|INFERRED|UNVERIFIED` across `research/` and know exactly where the
soft spots are.

| Tag | Meaning | Test it must pass | What we do with it |
|-----|---------|-------------------|--------------------|
| **[VERIFIED]** | We read the primary source and it says this | Cite the source URL; for behavioural claims, we ran it or read the code | Use as a load-bearing premise |
| **[INFERRED]** | We reasoned to this from verified facts, and the reasoning is stated | The premises are [VERIFIED] and the argument is written out in the document | Use, but do not present as fact to users |
| **[UNVERIFIED]** | We believe it, someone should check it, and it is load-bearing enough to flag | State what would verify it and who could do it | Do not use as a premise for a decision; track it in `15-open-questions/` |

Worked examples from this phase:

| Claim | Tag | Why |
|-------|-----|-----|
| CommonMark 0.31.2 was released 2024-01-28 | [VERIFIED] | `spec.commonmark.org` version index; `changelog.txt` header |
| `*a **b** c*` renders as `<em>a <strong>b</strong> c</em>` | [VERIFIED] | commonmark.js 0.31.2, executed; matches the spec's rule 9/10 machinery |
| CommonMark's emphasis rules exist because `Markdown.pl` was buggy and the prose spec was ambiguous | [VERIFIED] | Stated verbatim in the spec's own Introduction |
| A viewer must resolve relative image paths against the file's directory, not the process CWD | [INFERRED] | Premise: `![](img/x.png)` is a literal, relative link destination in the spec; premise: browsers resolve against the document URL. Argument: our "document URL" is a file path, so we must supply a base. Verified with a mental model, not a run of our (nonexistent) app |
| GitHub will re-adopt CommonMark 1.0 once it ships | [UNVERIFIED] | There is a *claim* on a forum thread that GitHub "abandoned staying in sync"; GitHub has not confirmed. Flagged, not used |

**Tag discipline:** the tags are applied to claims, not to documents. A document
is "verified" only if every load-bearing claim in it is.

---

## 4. Reproducibility notes

### 4.1 What we ran, and how to re-run it

Conformance runs for this phase were executed on:

| Item | Value |
|------|-------|
| Machine | Windows, x64 (we did not record CPU model; irrelevant for correctness) |
| OS | win32 |
| Node | v24.14.1 |
| npm | 11.11.0 |
| Test corpus | `https://spec.commonmark.org/0.31.2/spec.json` — **652 examples** |
| Normaliser | `normalize.py` from `commonmark/commonmark-spec` tag `0.31.2` (downloaded, *not* reimplemented) |
| Libraries | `commonmark@0.31.2`, `markdown-it@15.0.2`, `marked@18.1.0` (all from the public npm registry) |
| Date run | 2026-10-06 |

Reproduce with:

```bash
npm install commonmark@0.31.2 markdown-it@15.0.2 marked@18.1.0
curl -sLO https://spec.commonmark.org/0.31.2/spec.json
curl -sL  -o normalize.py \
  https://raw.githubusercontent.com/commonmark/commonmark-spec/0.31.2/test/normalize.py
# then run the harness described in research/06-libraries/
```

**Two normalisation levels, and why.** The spec's own Introduction says:

> Note that not every feature of the HTML samples is mandated by the spec.
> For example, the spec says what counts as a link destination, but it doesn't
> mandate that non-ASCII characters in the URL be percent-encoded.
> — [CommonMark 0.31.2, §1.3 "About this document"](https://spec.commonmark.org/0.31.2/#about-this-document)

So a raw string comparison over-reports failures: `<br>` vs `<br />`,
`&ouml;` vs `ö`, `/f%C3%B6` vs `/fö` are all explicitly *not* spec violations.
We therefore report two numbers per implementation:

- **strict** — byte equality after trimming. "Does it emit exactly what the
  reference emits?"
- **normalised** — after the spec's own `normalize.py`. "Does it mean the same
  thing?"

The gap between the two is the implementation's serialisation style, not a
conformance defect. Both numbers are reported in
[`01-foundations/02-history-and-evolution.md`](../01-foundations/02-history-and-evolution.md);
neither is quoted alone.

### 4.2 Version pinning

Versioned facts are quoted as "`package@version`, retrieved 2026-10-06". We do
not write "current version" anywhere. If a number here is stale, that is a bug
to file against this file, not a fact to silently update — a version bump that
changes behaviour should change a decision, or at least be acknowledged as not
doing so.

### 4.3 What is *not* reproducible from this repo

- Anything requiring a GUI, a display server, or code signing. Not run.
- Anything requiring a second physical machine. Network-filesystem watcher
  behaviour (see [`04-the-viewer-problem.md`](../01-foundations/04-the-viewer-problem.md))
  is **documented from Node's and Linux's own docs**, not measured by us.
- Performance numbers. We ran correctness, not speed. See `10-performance/`
  for the (still-to-be-written) measurement plan. **No speed claims appear in
  this phase**, deliberately.
- Renderer behaviour in a WebView. Not run.

---

## 5. What would falsify each major conclusion

A conclusion nobody can break is not a conclusion, it is a belief. Each of these
has a stated kill condition.

| # | Conclusion | Where | What would falsify it | How we would find out |
|---|-----------|-------|----------------------|-----------------------|
| C1 | "The design goal is source readability; everything else is negotiable." | `01-what-is-markdown.md` | Finding a construct whose *only* justification is parseability, or a proposal from a major dialect that is machine-optimal and author-hostile and that the community adopted *because* of those properties | Survey shipped syntaxes; if machine-optimal-but-unreadable constructs dominate the real-world corpus, C1 is wrong as a *predictive* rule |
| C2 | "Plain text wins for storage because it is diffable, greppable, tool-agnostic, and vendor-free." | `01-what-is-markdown.md` | Demonstrating that in practice Markdown files are *not* diffable (because syntax is noisy) or not tool-agnostic (because dialects fragment so hard that migration breaks) | Empirical: take N real repos, migrate between dialects, count semantic diffs. We have not done this. If the count is high, C2 is a marketing claim we should stop repeating to users |
| C3 | "CommonMark re-converged the field around an *approximate* target, not a strict one." | `02-history-and-evolution.md` | A major adopter publishing strict CommonMark conformance results, or CommonMark 1.0 shipping with a stability guarantee | Track `talk.commonmark.org` and release notes |
| C4 | "Emphasis is where naive parsers break, and delimiter-run rules are the fix." | `03-core-principles.md` | Showing a simpler rule that produces the same results on the 652-example corpus *and* on the pathological corpus | Formal: define alternative rule sets and diff their outputs across the corpus plus generated cases. Not yet done |
| C5 | "Block/inline separation is what makes Markdown parsable at all." | `03-core-principles.md` | A single-pass design that handles the same corpus without backtracking and without pathological complexity | Look for a published two-pass-free parser that is not O(n²) |
| C6 | "A viewer is mostly app engineering; the parser is maybe 10% of the work." | `04-the-viewer-problem.md` | Measuring the code, test surface, and defect history of a real viewer (Obsidian, Typora, MarkText) | We have not done this measurement. It is listed in `13-competitors/` as required work. If the ratio turns out to be 50/50, our scoping and our roadmap are wrong |
| C7 | "Sanitising the *output* is the only defensible trust boundary for a local viewer." | `04-the-viewer-problem.md` | A proven approach that sanitises or constrains the *input* reliably enough to make output sanitisation optional | Note RFC 7763 §"Security considerations" already recommends analysing the output rather than the Markdown. Attacking that recommendation needs evidence |
| C8 | "Rendering must be CommonMark + a small, explicit extension set, not a grab-bag." | `03-core-principles.md`, `02-history-and-evolution.md` | A real corpus of documents showing that a different extension set serves users materially better | Corpus analysis. Deferred |

---

## 6. Known weaknesses in this phase

Stated plainly, because a research folder that claims completeness is lying.

1. **No corpus analysis.** Every claim about "what people actually write" is
   INFERRED from documents that happen to be published (README files, blog
   posts), not measured over a sample of real vaults/doc-trees.
2. **No performance measurement at all.** Deliberate, but it means
   `10-performance/` starts from zero.
3. **No Windows/Linux filesystem experiments.** The watcher section is built
   entirely from Node's and Linux's documentation, which is authoritative about
   *guarantees* and silent about *what actually happens in the wild*.
4. **Bibliographic bias.** Web sources were reachable and print sources were
   not; Gruber's printed books and Michel Fortin's essays are therefore
   under-represented relative to their importance.
5. **One machine, one OS.** Every benchmark is win32-x64. Cross-platform claims
   about rendering are absent, by construction.
6. **The CommonMark corpus is not a user corpus.** It is adversarial on
   *syntax* and completely silent on *content*: no real prose, no real code
   blocks, no real link graphs. A parser can be 100% conformant and still be
   useless to us. We must build a second corpus.

---

## 7. Changelog of research

Every change to this research tree is logged here. Newest first.

| Date | Change | Affected docs | Reason |
|------|--------|---------------|--------|
| 2026-10-06 | Phase 1 created: method, source index, foundations | `00-method/*`, `01-foundations/*` | Research phase starts before any code |
| 2026-10-06 | Pinned every versioned fact to a retrieval date | all | Prevents "current version" drift |
| 2026-10-06 | Ran 652-example CommonMark 0.31.2 conformance for commonmark.js, markdown-it, marked; recorded both strict and normalised scores | `02-history-and-evolution.md` | Turns "they all diverge" from folklore into data |
| 2026-10-06 | Adopted two-level normalisation using the spec's own `normalize.py` | method §4.1 | The spec explicitly says its HTML samples are not all normative; comparing raw strings would over-report |
| 2026-10-06 | Tagged CommonMark 1.0 status as [UNVERIFIED] rather than "not coming" | `02-history-and-evolution.md` | An open proposal to cut 1.0 exists; it is not a decision |
| 2026-10-06 | Recorded filesystem watcher caveats as documentation-derived, not measured | `04-the-viewer-problem.md` | Honesty about what we did not test |
| — | *Next:* corpus analysis, `02-syntax`, `03-specifications` | — | — |

---

## 8. How to work with this research as a reviewer

1. Pick a conclusion from §5.
2. Find its tag in the document.
3. [VERIFIED] → open the cited URL and check the quote.
4. [INFERRED] → check that the stated premises hold and that the argument
   actually follows. Disagree in an ADR, not in a chat message.
5. [UNVERIFIED] → you have just found our next research task. File it in
   `15-open-questions/` with a name attached to it.

Do not edit a foundations document to fix a typo in a code sample without
updating §7. The changelog is the point.
