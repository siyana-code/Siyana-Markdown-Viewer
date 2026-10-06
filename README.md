# Siyana Markdown Viewer

A fast, safe, local-first Markdown viewer for **Windows and Linux** — with Web
and Mobile targets planned.

Open a `.md` file and it just works. No account, no upload, no tracking, no
telemetry. Your files never leave your machine.

---

## Status

| Target | Phase | State |
|--------|-------|-------|
| Desktop (Windows + Linux) | Phase 1 | 🔬 Research complete, implementation not started |
| Web | Phase 2 | ⏳ Planned |
| Mobile | Phase 3 | ⏳ Planned |

This repository is currently in its **research and planning phase**. See
[`docs/roadmap.md`](docs/roadmap.md) for the full plan and
[`research/`](research/) for the deep study that informs it.

---

## Why this exists

Markdown is the most portable text format in software, but the tools around it
are fragmented:

- **Heavyweight editors** that own your files and hide the plain text.
- **Web-only viewers** that need your files uploaded somewhere.
- **Subscripted, account-gated tools** for a format that is free and local.

A viewer should do one thing well: open a Markdown file from your disk and
render it beautifully, instantly, and safely. Nothing else is required.

### Design principles

1. **Local-first, always.** Your files are read from disk and stay there.
2. **Safe by default.** A `.md` file is untrusted input. Raw HTML, scripts, and
   path traversal are handled, not ignored. See
   [`research/11-security/`](research/11-security/).
3. **Plain text is sacred.** We never make Markdown the only way to read a
   document, but we never corrupt it either.
4. **Fast on real files.** A 5 MB technical document must open in under a second
   and scroll at 60 fps. See [`research/10-performance/`](research/10-performance/).
5. **Keyboard first.** Every action has a shortcut; nothing needs the mouse.
6. **Accessible.** A reading app has an unusually high bar — WCAG 2.2 AA is the
   floor, not the goal. See [`research/12-ux/04-accessibility.md`](research/12-ux/04-accessibility.md).
7. **One core, three shells.** Parser and rendering logic are shared across
   desktop, web, and mobile. See
   [`research/14-architecture-options/02-shared-core.md`](research/14-architecture-options/02-shared-core.md).

---

## Repository map

```text
docs/       Decisions and reference docs for THIS project (ADRs, roadmap, standards)
research/   The deep study: Markdown, parsers, shells, security, platform reality
apps/       desktop/ (Phase 1), web/ (Phase 2), mobile/ (Phase 3)
packages/   core/, ui/, fs-adapters/, test-fixtures/
```

- [`docs/`](docs/README.md) — what we decided and why
- [`research/`](research/README.md) — what we learned and why we believe it

---

## Branching

`main` is for production releases only. `develop` is the default branch and the
integration branch for all work.

```text
main      ──●──────────────●──────────────►   production releases (tagged)
           ↑              ↑
           │   (release)  │
develop    ──●───●──●───●──●──●──●──●──►        default branch, always shippable
              \     /        \      /
feature/…      \   /          \    /
release/…       \ /            \  /
hotfix/…         X              X
```

Branches are cut from `develop`, never from `main` (except `hotfix/*`).

| Prefix | Cut from | Merges into | Purpose |
|--------|----------|-------------|---------|
| `feature/<scope>-<description>` | `develop` | `develop` | New functionality |
| `phase/<number>-<name>` | `develop` | `develop` | A whole roadmap phase |
| `fix/<scope>-<description>` | `develop` | `develop` | Bug fixes |
| `refactor/<scope>-<description>` | `develop` | `develop` | Behaviour-preserving changes |
| `docs/<description>` | `develop` | `develop` | Documentation and research |
| `research/<topic>` | `develop` | `develop` | Deep-dive study |
| `release/<version>` | `develop` | `main` | Release stabilisation |
| `hotfix/<description>` | `main` | `main` + `develop` | Production-only fixes |

Full details, naming rules, and the merge workflow:
[`docs/branching-strategy.md`](docs/branching-strategy.md).

---

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. In short:

1. Branch from `develop` using a prefix from the table above.
2. Open a PR against `develop` — never against `main`.
3. `main` is only touched by a release or a hotfix.

We are early-stage and the issue tracker is open to new contributors.

---

## License

[MIT](LICENSE) — see [`LICENSE`](LICENSE).

---

## Part of Siyana

Maintained under the [siyana-code](https://github.com/siyana-code) organisation
alongside
[Siyana-Lang](https://github.com/siyana-code/Siyana-Lang),
[Siyana-Chat](https://github.com/siyana-code/Siyana-Chat),
[Siyana-Seed](https://github.com/siyana-code/Siyana-Seed), and
[brand](https://github.com/siyana-code/brand) (design tokens).
