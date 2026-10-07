# Siyana Markdown Viewer

A fast, safe, local-first Markdown viewer for Windows and Linux, with web and
mobile targets planned.

**The research phase is complete.** 88 documents, ~430 000 words, across
[`../research/`](../research/). Phase 1 has begun at the bottom of the stack:
[`../packages/core/`](../packages/core/) is the rendering engine and
[`../packages/conformance/`](../packages/conformance/) is the CommonMark spec
suite that verifies it.

## Start here

| If you want to… | Read |
|---|---|
| Know what we are building and why | [Product vision](product/vision.md) |
| Understand the phases | [Roadmap](roadmap.md) |
| Contribute | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Understand how code moves | [Branching strategy](branching-strategy.md) |
| See the technical shape of the app | [Architecture overview](architecture/overview.md) |
| Know what has been decided | [ADRs](adr/README.md) |
| See the rendering engine's source | [`packages/core`](../packages/core/src/) |
| Know how well the parser conforms | [Conformance suite](../packages/conformance/README.md) |
| Know how the code is arranged | [Monorepo structure](architecture/monorepo-structure.md) |
| Know the lint and format rules | [Biome configuration](engineering/biome-configuration.md) |
| Know the coding conventions | [Coding standards](engineering/coding-standards.md) |
| Know how we test | [Testing strategy](engineering/testing-strategy.md) |
| Learn Markdown from scratch | [Research: foundations](../research/01-foundations/) |
| Learn how Markdown parsers work | [Research: parsing internals](../research/04-parsing-internals/) |
| Compare the desktop frameworks | [Research: desktop frameworks](../research/08-desktop-frameworks/) |
| Understand the security threat model | [Research: security](../research/11-security/) |
| Understand the Linux and Windows reality | [Research: platform](../research/09-platform/) |
| Look up a term | [Glossary](glossary.md) |

## Two kinds of documentation

The distinction matters, so it is worth stating plainly.

**`docs/` is what we decided.** Architecture, standards, requirements, ADRs.
Documents here are binding. If the code disagrees with `docs/`, either the code
is wrong or the doc needs an ADR.

**`research/` is what we learned.** The deep study of Markdown and of everything
needed to build the tool, written before deciding. Documents there are
exploratory and evidence-backed; they record what is known, what is inferred,
and what is still unknown.

Research feeds decisions. Decisions land in ADRs. ADRs constrain code.

## Decisions made so far

| ADR | Decision | Status |
|---|---|---|
| [0001](adr/0001-use-gitflow-branches.md) | GitFlow-lite: `main` for releases, `develop` as default | Accepted |
| [0002](adr/0002-monorepo-with-workspaces.md) | Monorepo with pnpm and Cargo workspaces | Accepted |
| [0003](adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md) | Tauri vs Electron vs Flutter | **Proposed** — needs a prototype |
| [0004](adr/0004-markdown-parser-strategy.md) | Markdown parser selection (`markdown-it`) | Accepted — implemented, [ADR-0006](adr/0006-core-module-boundaries.md) records the corrections |
| [0005](adr/0005-security-baseline-xss-sanitization.md) | Four-layer security baseline | Accepted |
| [0006](adr/0006-core-module-boundaries.md) | `packages/core` module boundaries; `transform` deferred | Accepted |

[ADR-0003](adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md), the
desktop shell, remains open. It needs a prototype and measurements before it is
binding — see its validation section.

## Principles

1. **Local-first, unconditionally.** No account, no upload, no telemetry, no
   sync service.
2. **Untrusted by default.** A `.md` file is attacker-controlled input. Raw HTML
   disabled, output sanitized, paths scoped, network opt-in.
3. **Plain text is the source of truth.** The file on disk is authoritative.
4. **Correct before clever.** CommonMark conformance is enforced in CI.
5. **Small and fast.** Under 50 MB installed, under 200 MB resident, sub-second
   open on a typical README.
6. **Keyboard first.** Every action has a shortcut.
7. **Accessible from the start.** WCAG 2.2 AA is the floor.
8. **One core, three shells.** Rendering logic is shared across all targets.
9. **Document our decisions.** Every non-obvious choice has an ADR; every claim
   has a source; unknowns are recorded as unknowns.

## Contributing

Read [CONTRIBUTING.md](../CONTRIBUTING.md), then pick up an issue. The
[research issue template](../.github/ISSUE_TEMPLATE/research_task.yml) is a
good entry point if you would rather contribute research than code — the
research corpus is where most of the remaining work is.

## License

[MIT](../LICENSE)
