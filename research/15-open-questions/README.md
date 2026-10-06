# 15 · Open Questions

> Everything we do **not** know, tracked instead of hidden.

Research that pretends to have no open questions is marketing, not research. This
folder is the honest remainder: the decisions that are genuinely undecided, the
evidence that exists, the evidence that does not, who owns each call, and the
date after which it becomes someone else's problem.

---

## What is in here

| # | Doc | What it is |
|---|-----|-----------|
| 01 | [Question register](01-question-register.md) | 78 numbered questions. Every one has: why it matters, options, evidence we have, evidence we are missing, who decides, by when, and the ADR that will resolve it. |
| 02 | [Risk register](02-risk-register.md) | 22 risks with likelihood, impact, exposure score, mitigation, contingency, owner, and status. Includes the ones that end projects. |
| 03 | [Decision schedule](03-decision-schedule.md) | Which decisions must land before which milestone, in what order, and by when. With a gantt chart and a slip policy. |

## How the register is maintained

### Rules

1. **Every question has an owner.** Not a team, not "the maintainers" — a role
   or a name. An unowned question is a question nobody will ever answer, and it
   is worse than not having written it down because it looks handled.

2. **Every question has a status.** Exactly one of:

   | Status | Meaning |
   |--------|---------|
   | `open` | Not yet decided. The default for everything in this folder. |
   | `researching` | Someone is gathering the missing evidence. Owner is named. |
   | `decided` | Answered. The ADR exists and is linked. Entry is kept for history. |
   | `deferred` | Deliberately postponed with a stated revisit trigger. |
   | `obsolete` | The question no longer applies (a plan changed). Kept for history. |

3. **Every question has a decision deadline.** A date, not "when we get to it".
   The deadline is the date by which **not** having decided has a cost — usually
   a milestone. If a deadline passes without a decision, the
   [slip policy](03-decision-schedule.md#slip-policy) applies: the default
   option wins and the risk register is updated. **A default that is applied
   automatically is strictly better than a decision that is deferred
   indefinitely.**

4. **Every question links the ADR that will resolve it.** Even if that ADR does
   not exist yet. Naming `docs/adr/0004-markdown-parser-strategy.md` before
   writing it makes the deadline concrete and gives the owner a file to create.

5. **New questions get numbers. Existing numbers are never reused or
   renumbered.** When a question is marked `decided`, the entry stays. Renumbering
   breaks every cross-reference from `research/` and from issues.

### Where a question goes when it becomes a decision

```text
question (this folder, status: open)
   ↓  owner decides, evidence attached
PR (docs/pr/00NN-<slug>.md)        ← the evidence and the reasoning
   ↓  reviewed
ADR (docs/adr/00NN-<slug>.md)      ← the decision, status: Accepted / Superseded
   ↓  question entry updated: status: decided, link: ADR path
roadmap + risk register updated
```text

The `docs/pr/` step is not bureaucracy. An ADR without attached evidence is a
decision nobody can audit in six months, and in a small project the reasoning is
the only durable artefact.

### How to use this folder as a contributor

If you are reading a question and you have information that resolves or narrows
it, open a PR that:

- moves the entry to `researching` or `decided`,
- states the evidence with a **source** (spec text, official docs, source file,
  measurement) — not a preference,
- and, if you are proposing an answer, writes the ADR.

Questions marked `decided` with no ADR link are bugs in this folder. Report them.

## Conventions

- **Owner roles:** `project-lead`, `core`, `ui`, `desktop`, `mobile`, `web`,
  `security`, `build`, `docs`, `community`, `design/brand`.
- **Evidence grades:**
  - `[V]` **Verified** against a primary source in `research/` with a citation.
  - `[M]` **Measured** by us — a benchmark or a test run, with the method noted.
  - `[I]` **Inferred** — reasoned from verified facts, not itself verified.
  - `[A]` **Anecdotal** — community or competitor behaviour. Useful, weak.
  - `[?]` **Missing** — nobody has looked.
- Dates are ISO 8601. Roadmap phases are named as in
  [`docs/roadmap.md`](../../docs/roadmap.md).

## The five that would hurt most to get wrong

If everything else in this folder is allowed to slide, these are the ones where
being wrong is expensive and late:

| Q | Question | Why it is the expensive kind |
|---|----------|-------------------------------|
| [Q-01](../15-open-questions/01-question-register.md#q-01) | Which Markdown parser | Every output byte depends on it. Swapping a parser is a rewrite of the golden tests, the sanitizer interaction, and the position map. |
| [Q-02](../15-open-questions/01-question-register.md#q-02) | Which desktop shell | Determines bundle size, WebView fragmentation, the security model, and the auto-updater. Changing it after Phase 1 is a re-platform. |
| [Q-06](../15-open-questions/01-question-register.md#q-06) | Editing in v1 or not | It roughly doubles the filesystem and session surface (doc 03 §7). Shipping a viewer and calling it a viewer is a coherent product; shipping a half-editor is not. |
| [Q-08](../15-open-questions/01-question-register.md#q-08) | Raw HTML policy | A security posture, a UX promise, and a compatibility decision, all in one. Getting it wrong in either direction has a real cost. |
| [Q-13](../15-open-questions/01-question-register.md#q-13) | The name | Baked into bundle ids, the reverse-DNS identifier, the URL, the store listings, and every future import. Effectively permanent. |

## Current tally

| Section | Questions | Decided | Open / researching |
|---|---|---|---|
| A · Rendering & parsing | 19 | 0 | 19 |
| B · Repository & architecture | 7 | 0 | 7 |
| C · Filesystem & persistence | 10 | 0 | 10 |
| D · Search | 5 | 0 | 5 |
| E · Platform, packaging & release | 6 | 0 | 6 |
| F · Product scope & sequencing | 11 | 0 | 11 |
| G · Naming, licensing, sustainability, community | 20 | 0 | 20 |
| **Total** | **78** | **0** | **78** |

(Q numbers are global and deliberately not contiguous within sections — the
ranges were fixed as cross-references were written into `research/14` and are
kept stable so those links keep working.)

Nothing is decided. That is correct for a project that has just finished its
research phase: the outputs of `research/14` and `research/15` are inputs to
`docs/adr/`, and the first ADR batch lands at the start of Phase 1.

## Related

- [`../14-architecture-options/`](../14-architecture-options/) — the architecture
  space this register is deciding between
- [`../00-method/`](../00-method/) — how research claims are graded, which is the
  same grading used here
- [`../../docs/roadmap.md`](../../docs/roadmap.md) — the milestones the deadlines
  are anchored to
- [`../../docs/adr/`](../../docs/adr/) — where decisions land
