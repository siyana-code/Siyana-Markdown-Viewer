# Branching strategy

This project uses a **GitFlow-lite** variant. It is the industry-standard
model for software that has a production release line and an in-flight
development line, adapted so that day-to-day work never touches `main`.

## The two permanent branches

| Branch | Purpose | Who commits | Merge target | Protected |
|--------|---------|--------------|--------------|-----------|
| `main` | **Production releases only.** Every commit on `main` is a shipped release. | Maintainers only | `release/*` and `hotfix/*` | Yes — no direct pushes |
| `develop` | **Default branch. Always releasable.** All work integrates here. | Everyone | `feature/*`, `fix/*`, `docs/*`, `phase/*` | Yes — PR required, CI required |

`develop` is the repository's **default branch** on GitHub — every new
contributor starts here, and every PR targets `develop`.

`main` is guaranteed releasable at all times. If `develop` is broken, `main` is
still fine. This is the single most important property of the strategy.

## The branch line diagram

```text
main      ──●───────────────────●───────────────►
           ↑                   ↑
           │  (PR, full CI)    │
release/   │                   │
v0.3.0 ────┘                   │
           ↑                   │
           │  (PR + back-merge) │
hotfix/    │                   │
v0.2.3 ────┘───────────────────┘
           ↑
           │  (PR, full CI)
develop    ──●───●───●───●───●───●───●───●─────►
              \   /     \     \    \   /
feature/      \ /       \     \    \ /
phase/         ●         ●     ●    ●
```text

## Branch prefixes

Every non-permanent branch starts with one of these prefixes. CI reads the
prefix to decide what checks to run.

| Prefix | Cut from | Merges into | Auto-merge? | CI profile |
|--------|----------|-------------|-------------|------------|
| `feature/<scope>-<kebab-description>` | `develop` | `develop` | No — needs 1 review | full |
| `phase/<n>-<kebab-name>` | `develop` | `develop` | No — needs 1 review | full |
| `fix/<scope>-<kebab-description>` | `develop` | `develop` | No — needs 1 review | full |
| `refactor/<scope>-<kebab-description>` | `develop` | `develop` | No — needs 1 review | full |
| `docs/<kebab-description>` | `develop` | `develop` | Yes if CI passes | lint + links |
| `research/<kebab-topic>` | `develop` | `develop` | Yes if CI passes | lint + links |
| `ci/<kebab-description>` | `develop` | `develop` | No — needs 1 review | full |
| `release/<semver>` | `develop` | `main` | No — needs 1 approval + full CI | release |
| `hotfix/<kebab-description>` | `main` | `main` **and** `develop` | No — needs 1 approval | release |

### Naming rules

- **Always kebab-case.** `feature/outline-toc`, not `feature/Outline_TOC`.
- **Always prefix with scope** where a scope table exists in
  [`docs/engineering/coding-standards.md`](engineering/coding-standards.md).
- **Always carry the issue number** when there is one:
  `feature/parser-markdown-it-42` → PR `Closes #42`.
- **Keep it short.** Under ~40 characters after the prefix.

### Issue-numbered branch names

If the branch implements a GitHub issue, embed the number so the PR auto-closes
it. Both forms are accepted:

```text
feature/42-markdown-it-adapter
feature/parser-42-markdown-it-adapter
```

## The workflows

### 1. Starting a feature

```bash
git checkout develop
git pull --ff-only
git checkout -b feature/parser-markdown-it-adapter
```text

### 2. Merging a feature

- Open a PR targeting **`develop`**.
- CI must pass. One review approval is required.
- **Squash merge** into `develop`. Feature branches are never merged with a
  merge commit — the history should read as a sequence of intents, one per line
  of `develop`.
- Delete the branch on merge.

Squashing is why we do not need merge commits on `develop`: the PR title and
body become the commit message, and they follow
[Conventional Commits](https://www.conventionalcommits.org/).

### 3. Cutting a release

```bash
git checkout develop
git pull --ff-only
git checkout -b release/0.3.0
```text

On `release/*`:

- Only bug fixes, dependency bumps, and release chores. No new features.
- Full CI, including the platform build matrix, must pass.
- Update `CHANGELOG.md`, bump the version in the workspace manifest, and tag.

```bash
# when release/0.3.0 is green
git checkout main
git merge --no-ff release/0.3.0      # preserves the release as a point in history
git tag -a v0.3.0 -m "Siyana Markdown Viewer v0.3.0"
git push origin main --tags
git checkout develop
git merge --ff-only origin/release/0.3.0
git branch -d release/0.3.0
git push origin develop
```text

`main` receives `--no-ff` on purpose: every release should be visible on the
`main` timeline as a merge, not lost in a linear blur.

### 4. Hotfixing production

```bash
git checkout main
git checkout -b hotfix/v0-2-3-path-traversal
# ... fix, with a regression test ...
git push origin hotfix/v0-2-3-path-traversal
# PR -> main
```

After the hotfix lands on `main`, **immediately** merge `main` back into
`develop` so the fix is not lost when the next release is cut. The merge commit
message on `develop` should reference the hotfix.

A hotfix branch may cherry-pick from `release/*` only if the release is
stalled.

## Merge commit conventions

| From → To | Style | Why |
|-----------|-------|-----|
| `feature/*` → `develop` | Squash | One intent per line; clean blame |
| `docs/*`, `research/*` → `develop` | Squash | Same |
| `release/*` → `main` | `--no-ff` merge | Release visible as a point in history |
| `hotfix/*` → `main` | Squash | Small, self-contained fix |
| `hotfix/*` → `develop` | `--no-ff` merge | Marks that a fix came from production |

## Branch protection

Enable on both `main` and `develop`:

| Setting | `main` | `develop` |
|---------|--------|-----------|
| Require a pull request | Yes | Yes |
| Require approvals | 1 | 1 |
| Require review from Code Owners | Yes | No |
| Dismiss stale approvals on new push | Yes | Yes |
| Require conversation resolution | Yes | Yes |
| Require status checks | full CI | full CI |
| Require branches to be up to date | Yes | Yes |
| Allow force push | **No** | **No** |
| Allow branch deletion | No | No |
| Restrict who can push | Maintainers | Anyone with write |
| Linear history | No (`--no-ff` merges) | Yes (squash only) |

## Rules

1. **Never commit directly to `main`.** Ever.
2. **Never commit directly to `develop`.** Even one-person projects use PRs —
   CI is the safety net that catches the mistake before `main` does.
3. **Never branch a feature off `main`.** You will ship unreleased work.
4. **Every PR targets `develop`** unless it is a release or a hotfix.
5. **`develop` must always be releasable.** If you break it, fix it before
   starting anything else.
6. **Back-merge every hotfix.** Within the hour.
7. **Delete branches on merge.** Stale branches hide real work.
8. **Rebase your own unpushed branches** freely; never rebase a shared one.

## Version numbering

[Semantic Versioning](https://semver.org/):

```text
MAJOR.MINOR.PATCH
  │     │   └── Patch: bug fix only. No user-visible behaviour change.
  │     └────── Minor: new backwards-compatible feature.
  └──────────── Major: breaking change (schema, config, or CLI shape).
```text

Pre-release identifiers during stabilisation:

```text
0.3.0-rc.1     release candidate
0.3.0-beta.2   beta
0.3.0-alpha.5  alpha
```

`0.x` means **pre-1.0**: the API and behaviour may still break. We will follow
semver strictly once we reach `1.0.0`, and say so in the release notes.

During the `0.x` series, Minor bumps may include breaking changes — but they
must be called out explicitly in `CHANGELOG.md` under `BREAKING`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```html
<type>(<optional scope>): <description>

[optional body]

[optional footer: Closes #42, BREAKING CHANGE: ...]
```text

Allowed types: `feat`, `fix`, `docs`, `research`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `style`, `revert`, `security`, `release`.

Examples:

```text
feat(parser): support GFM tables with column alignment
fix(security): block javascript: URLs in image sources
docs(adr): record ADR-0003 desktop framework comparison
perf(render): skip re-parse when the file hash is unchanged
chore(deps): bump markdown-it to 14.1.0
research: add CommonMark parsing strategy deep dive
```

Because `develop` is squash-merged, the PR title must already be a valid
Conventional Commit. Configure GitHub to default the PR title accordingly.

## Tags

```bash
v0.3.0                 # release
v0.3.0-rc.1            # release candidate
v0.3.0-linux-x86_64    # platform build artifact (attached to the release, not usually a git tag)
```text

GitHub Releases attach the installers to the `v0.3.0` tag. The auto-update
manifest that the app consumes is regenerated from the release assets.
