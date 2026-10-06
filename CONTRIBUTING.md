# Contributing

Thanks for your interest. This project is early and the contribution path is
still short — a PR that follows the conventions below will usually go straight
in.

## The five rules

1. **Branch from `develop`, PR into `develop`.** Never target `main`.
2. **Read the relevant research first.** If you are changing parsing, rendering,
   or security, the corresponding folder in [`research/`](../research/README.md)
   explains the constraints. Please do not fight them without an ADR.
3. **Security is not negotiable.** This app renders untrusted files. If your
   change touches HTML output, link resolution, file paths, or IPC, read
   [`research/11-security/`](../research/11-security/) first and say so in the PR.
4. **CI must be green.** All of it.
5. **Conventional Commits for PR titles**, because we squash-merge.

## Getting set up

> Toolchain decisions are still open — see
> [`docs/adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md`](adr/0003-desktop-framework-tauri-vs-electron-vs-flutter.md).
> These prerequisites work for every candidate.

```bash
# Prerequisites
#   Node.js 20+ (22+ recommended)   https://nodejs.org
#   pnpm 9+                        npm install -g pnpm
#   Rust stable (rustup)           https://rustup.rs
#   Git 2.40+

git clone https://github.com/siyana-code/Siyana-Markdown-Viewer.git
cd Siyana-Markdown-Viewer
git checkout develop
pnpm install
pnpm build
pnpm test
```

Linux additionally needs the webview development packages — for a GTK3
WebKitGTK build these are typically:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
                 libxdo-dev libssl-dev librsvg2-dev patchelf
```

(Verify against [`research/09-platform/02-linux.md`](../research/09-platform/02-linux.md)
— this is the single most common way a Linux dev setup fails.)

## Branching

```bash
git checkout develop
git pull --ff-only
git checkout -b feature/my-change
```

Prefixes, naming rules, and the full workflow are in
[`docs/branching-strategy.md`](branching-strategy.md).

| I am working on… | Branch |
|---|---|
| A new capability | `feature/<scope>-<description>` |
| A bug | `fix/<scope>-<description>` |
| A behaviour-preserving change | `refactor/<scope>-<description>` |
| Documentation | `docs/<description>` |
| Deep-dive study | `research/<topic>` |

## Commits and PRs

- PR title: `feat(parser): support GFM tables with column alignment`
- Body: **what** changed, **why**, and **how you verified it**.
- Link the issue with `Closes #42`.
- Screenshots or a short clip for anything visual.
- Add a note under **Security** if your change can affect how untrusted content
  is handled, even if you believe it cannot.

Small commits with clear messages beat one large commit. We squash on merge, so
the PR body carries the detail — do not bury it in the commit history.

## Code standards

Full list: [`docs/engineering/coding-standards.md`](docs/engineering/coding-standards.md).
The short version:

- TypeScript `strict` mode, no `any` without a comment justifying it.
- Biome for formatting and linting (shared config in `packages/config`).
- Every public function and non-obvious type gets a doc comment explaining
  *why*, not *what*.
- Rust: `cargo clippy -- -D warnings` clean; `#![deny(unsafe_code)]` unless the
  unsafe block has a safety comment.
- Tests next to the code they test.
- Comments explain reasoning. The code already says what it does.

## Testing

Before opening a PR:

```bash
pnpm lint          # format + lint
pnpm typecheck     # TypeScript + Rust
pnpm test          # unit + integration
pnpm test:conformance   # CommonMark + GFM spec suites against packages/core
```

If you touched the parser, **conformance must not regress**. If your change
lowers the pass rate, that needs an ADR explaining why.

See [`docs/engineering/testing-strategy.md`](docs/engineering/testing-strategy.md).

## Adding dependencies

Dependencies are permanent commitments. In the PR:

1. Say why the existing options do not work.
2. Give the licence and confirm it is compatible with MIT.
3. Give the bundle/runtime cost.
4. Note the maintenance status (last release, open issue trend).
5. Check it against our security baseline — a parser, sanitizer, or HTML sink
   needs a security review.

Prefer few dependencies, but do not reimplement something that already exists
well. The rule is *evaluate*, not *minimise*.

## Reporting bugs

Open an issue with:

- What you did, what you expected, what happened
- OS, version, and install method
- The Markdown that triggers it (as a fenced block, please)
- Any console output

Security issues: **do not open a public issue.** See
[`SECURITY.md`](../SECURITY.md).

## Code of conduct

[`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) applies in all project spaces.

## License

Contributions are accepted under the [MIT License](../LICENSE).

## Scopes

Branch scopes are defined in
[`docs/engineering/coding-standards.md`](docs/engineering/coding-standards.md#branch-scopes).
Known scopes: `core`, `parser`, `render`, `sanitize`, `editor`, `search`,
`shell`, `fs`, `theme`, `a11y`, `perf`, `build`, `ci`, `docs`, `research`.