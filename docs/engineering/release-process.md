# Release process

## Overview

```text
  develop
     │  full CI green, milestone reached
     ▼
  release/0.3.0        fixes only, no features
     │  full CI green incl. platform matrix
     ▼
  main                 --no-ff merge + tag v0.3.0
     │  GitHub Release, installers, auto-update manifests
     ▼
  published
```

Full CI runs on every release. A release never bypasses it. The only thing the
tag adds is the semver and `CHANGELOG.md` consistency checks.

## Versioning

[Semantic Versioning](https://semver.org/). Pre-1.0, Minor bumps may contain
breaking changes, but they must be listed under `BREAKING` in the release notes.

| Version | Meaning |
|---|---|
| `0.1.0` | First render. Not useful to a normal user yet. |
| `0.3.0` | Reading MVP. This is the release we want people trying. |
| `0.9.0` | Signed builds, auto-update, hardening complete. |
| `1.0.0` | We make a stability promise. |
| `1.2.0` | Editing, without corruption. |
| `1.4.0` | Web build. |
| `1.6.0` | Mobile. |

## Cutting a release

### 1. Open the release branch

```bash
git checkout develop && git pull --ff-only
git checkout -b release/0.3.0
```text

### 2. Stabilise

Only these on a release branch:

| Allowed | Not allowed |
|---|---|
| Bug fixes | New features |
| Dependency updates, including security | Refactoring for its own sake |
| Documentation fixes | Formatting of unrelated files |
| Performance fixes | Changes to the extension profile |

### 3. Version bump

```bash
pnpm version 0.3.0 --no-git-tag-version
```

One version for the whole workspace — see
[ADR-0002](../adr/0002-monorepo-with-workspaces.md#versioning).

### 4. Changelog

```markdown
## [0.3.0] - 2026-11-14

### Added
- Cross-file search over the workspace ([#142](https://github.com/siyana-code/Siyana-Markdown-Viewer/issues/142))

### Fixed
- Tables wider than the viewport broke document layout ([#151](https://github.com/siyana-code/Siyana-Markdown-Viewer/issues/151))

### Security
- Rejected `javascript:` URLs in image sources before sanitization ([#160](https://github.com/siyana-code/Siyana-Markdown-Viewer/issues/160))
```text

Every user-visible change links its issue. Every security change is listed under
`Security` with a plain description of the impact — not a CVE number alone.

### 5. Verify before tagging

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:conformance
pnpm test:fuzz
pnpm bench -- --compare
```

Plus, manually:

- [ ] Clean-install on a clean Windows VM
- [ ] Clean-install on Ubuntu LTS, current Fedora, and a third family
- [ ] Screen-reader pass (NVDA, Orca)
- [ ] Keyboard-only pass
- [ ] Print and PDF output reviewed
- [ ] Auto-update tested from the previous version, with a signature
- [ ] Zero open items in the security baseline checklist
- [ ] Fuzzing campaign clean

The last three are the ones we are most likely to skip and least able to
afford skipping.

### 6. Merge and tag

```bash
git checkout main
git merge --no-ff release/0.3.0
git tag -a v0.3.0 -m "Siyana Markdown Viewer v0.3.0"
git push origin main --tags

git checkout develop
git merge --ff-only origin/release/0.3.0
git branch -d release/0.3.0
git push origin develop
```text

Pushing the tag triggers `.github/workflows/release.yml`, which re-verifies the
version, reruns the quality gates, builds every platform, and publishes to
GitHub Releases.

## Platform artifacts

| Platform | Target triple | Artifacts | Signed |
|---|---|---|---|
| Windows x64 | `x86_64-pc-windows-msvc` | MSI, NSIS `.exe` | Authenticode |
| Linux x64 | `x86_64-unknown-linux-gnu` | AppImage, deb, rpm | GPG (deb/rpm) |
| Linux arm64 | `aarch64-unknown-linux-gnu` | AppImage, deb | GPG (deb) |
| Portable | any | zip | Yes |

Notes:

- AppImage is the Linux default because it needs no distribution packaging
  decision. deb is provided because distribution repositories reach far more
  users. rpm is provided for Fedora/openSUSE.
- The portable build exists so a user with a broken updater, an air-gapped
  machine, or a restrictive policy can still install.
- macOS is not built before Phase 3. When it is, it requires Developer ID
  signing and notarisation or users will hit Gatekeeper warnings.

## Auto-update

**Updates are signature-verified, not merely checksum-verified.** A checksum
served from the same endpoint as the file proves only that the file was not
corrupted in transit; it proves nothing if that endpoint is compromised. A
signature made with a key we control proves the file came from us.

| Platform | Mechanism | Signature |
|---|---|---|
| Windows | Tauri updater | minisign |
| Linux (AppImage, deb) | Tauri updater | minisign |
| Portable zip | Manual download | Authenticode on the inner binary |

Update failure behaviour (`R-P3-13`): a failed update leaves the previous
version runnable. No partial replacement, no orphaned temp files. The update
manifest is served over HTTPS and carries the signature.

Staged rollout: the newest release is offered to 10% of users, then 50%, then
100%, over roughly 48 hours. An update failure rate above a threshold halts the
rollout.

## Hotfixes

```bash
git checkout main
git checkout -b hotfix/v0-3-0-path-traversal
# fix + regression test referencing the issue
```

1. PR targets `main`, needs one approval, needs full CI.
2. After merge: **immediately** merge `main` into `develop` with `--no-ff` and a
   message referencing the hotfix.
3. Tag `v0.3.1`, which triggers the release pipeline.
4. If the fix is security-relevant, also cut a release branch from `develop` for
   the next minor, so the fix is in the `develop` line as well.

## Security releases

Extra steps over a normal release:

1. Fix on a `hotfix/` branch from `main`, with a regression test that reproduces
   the exploit.
2. Add the payload class to the fuzzing corpus and the hostile-input catalogue.
3. Publish a GitHub Security Advisory, even if we did not receive an external
   report. Silence about a fix we found ourselves is not better than silence
   about one we were told about.
4. Add an entry under `Security` in `CHANGELOG.md` describing the impact in
   plain language and what a user should do.
5. Verify auto-update carries the fix, and check adoption after 48 hours.

## Deprecation policy

Before removing a feature or changing behaviour in a `0.x` release:

1. Announce it in the release notes of the previous version.
2. Keep it working for at least two minor releases.
3. Log deprecation warnings in debug builds.
4. Never remove behaviour without a `BREAKING` entry in the changelog.

After `1.0.0`, a feature may be removed only in a major release, with six
months' notice in the changelog.

## Rollback

If a release is bad:

| Situation | Action |
|---|---|
| Bad build, fix is quick | Yanking the release and shipping `0.3.1` |
| Bad build, fix is slow | Yanking the release, publishing `0.3.1` with the previous commit |
| Actively exploited vulnerability | Yank, publish a hotfix, and publish an advisory |
| Corrupted artifacts in the release | Delete and re-upload — auto-update never sees an artifact it has already downloaded |

The previous version always remains downloadable from the GitHub Release page.
The updater will not offer a version the user has already skipped, so a yanked
release does not reappear.

## Checklist

Cutting:

- [ ] Release branch cut from `develop`
- [ ] Version bumped across the workspace
- [ ] `CHANGELOG.md` updated, issues linked
- [ ] All verification commands green
- [ ] Clean-install tested on Windows
- [ ] Clean-install tested on three Linux families
- [ ] Screen-reader pass
- [ ] Keyboard-only pass
- [ ] Auto-update tested with signature verification
- [ ] Security baseline checklist has zero open items
- [ ] Fuzzing campaign clean
- [ ] `--no-ff` merge to `main`
- [ ] Tag pushed

Publishing:

- [ ] GitHub Release created with notes from the changelog
- [ ] All platform artifacts present
- [ ] Artifact signatures verified
- [ ] Update manifests regenerated
- [ ] `develop` fast-forwarded to the release branch
- [ ] Release branch deleted
- [ ] Announcement posted with known limitations and verified platforms
