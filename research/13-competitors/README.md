# 13 · Competitors & References

> **Question this folder answers:** what have other people already built, what
> did they get right, what did they leave unsolved, and what is the gap we can
> occupy?

Research date: **6 October 2026**. Every price, licence, and platform-support
claim in this folder was checked against the project's own official site or
repository on that date. Anything I could not confirm from a primary source is
marked **UNVERIFIED**.

---

## Documents in this folder

| # | File | Covers |
|---|---|---|
| 01 | [Obsidian](01-obsidian.md) | The local-files-first vault, the plugin boundary, wikilinks and backlinks, Canvas, Bases |
| 02 | [Typora & MarkText](02-typora-and-marktext.md) | The seamless live-preview model; why it is loved and why it is hard |
| 03 | [Logseq & Zettlr](03-logseq-and-zettlr.md) | Block references, outliners, Zettelkasten, and the academic use case |
| 04 | [More tools](04-more-tools.md) | GitHub, VS Code, mdBook, MkDocs Material, Docusaurus, VitePress, Hugo, Jupyter Book, importers, Markmap, mdpdf, glow, mdcat |
| 05 | [Feature matrix](05-feature-matrix.md) | A 20-column comparison of ten tools against our planned viewer |

---

## Method

### What we measure, and in what order

1. **What is it, in one sentence?** If we cannot say what problem it solves,
   we do not understand it, and we will build the wrong thing.
2. **Platform support** — verified against the official download page. Not
   against the marketing homepage.
3. **Licence** — verified against the repository's `LICENSE` file or the
   official licence page. Not against a badge in the README.
4. **Price** — verified against the official pricing page. Where the price is
   bundled or region-dependent, we say so.
5. **Architecture, where publicly knowable** — the language, the stack, the
   process model. Taken from the repository, the docs, or the process list. For
   closed-source apps (Obsidian, Typora), architecture statements are marked as
   inference.
6. **What it does brilliantly.**
7. **Where it is weak.** Honestly, and without rhetoric.
8. **Classification:** *competitor*, *reference implementation*, or
   *inspiration*. This is the most useful column in the whole folder.

### Classification scheme

| Class | Meaning | Consequence for us |
|---|---|---|
| **Competitor** | Solves our problem, in our market, for our user. A user must choose one or the other | We must beat them on something specific |
| **Reference implementation** | Solves the problem, but for a different user (build-time, terminal, IDE, web host). Its output is *input to someone else* | We copy the *output format*, never the code |
| **Inspiration** | Solves a narrow slice well; teaches us a technique or a principle | We adopt the idea |

Most of the tools in this folder are **not** competitors. Only Obsidian and
Typora are direct competitors. The rest are reference implementations whose
*output* we must render, or inspirations whose *techniques* we should adopt.

### The ethics line, stated plainly

**Reading a public repository to understand how something works is normal and
entirely legitimate open-source practice.** It is how every open-source project
has ever learned anything. We will read Obsidian's plugin API docs, mdBook's
theme system, VS Code's preview implementation, glow's terminal layout, and
Zettlr's citation handling.

**Copying code we are not licensed to copy is not.** Specifically:

| Act | Verdict |
|---|---|
| Reading a MIT/Apache/BSD/MPL project's source to learn a technique, then writing our own implementation | ✅ **Fine.** This is what licences are for. Attribution in our source file headers and in our NOTICE. |
| Reading a GPL/AGPL project's source to learn a technique, then writing our own implementation independently | ⚠️ **Legally fine** (ideas are not copyrightable), but GPL's copyleft is *contagious by derivation*: if our implementation is recognisably a derivative — same structure, same names, same distinctive choices — a court could find it a derivative work. We will not read GPL/AGPL source for structural inspiration. We will read its **documentation** and its **issue tracker**, which is where the design *reasons* live. |
| Reading Typora or Obsidian's shipped application to see what features exist | ✅ **Fine** — that is the product's public behaviour, and it is what a user can already see. It is *reverse engineering for interoperability and competitive analysis*, not copying. |
| Disassembling Typora/Obsidian binaries to extract code or assets | ❌ **Never.** Their EULA forbids it and it is simply wrong. |
| Copying a theme's CSS from Obsidian Community Themes into our bundled set | ⚠️ **Only if the theme's own licence permits redistribution.** Check per theme. Most are "personal use" or unlicensed — assume no until proven otherwise. |
| Copying a code block's CSS from mdBook's theme or MkDocs Material's stylesheets | ❌ Unless the licence allows it with attribution — GPL and MPL have different obligations. MPL-2.0 (mdBook) is file-level copyleft: you may use it, but you must keep modified files in MPL and publish their source. That is workable **only** in a dedicated file we never link into proprietary code. Simpler: **write our own.** |

Our project is MIT (`docs/README.md`, repository layout). MIT is compatible
with MIT/Apache/BSD and with MPL-2.0 only under the file-level copyleft rules.
**The simplest policy that keeps us safe and keeps the code clean: read
documentation and behaviour; write every line of code and CSS ourselves.**

### A note on tone

Obsidian has ~8,400 community plugins and tens of millions of users because it
solved a real problem extremely well. Typora is the most-loved Markdown editor
ever built. Logseq and Zettlr are the only serious options for academic
Zettelkasten work. Nothing below is a takedown. The purpose is to find the gaps,
and the gaps are real and specific.

---

## Verified snapshot, 6 October 2026

| Product | Licence | Price | Platforms (verified) | Class |
|---|---|---|---|---|
| **Obsidian** | Proprietary (closed source). Their own licence page: "free for all purposes, including personal, commercial, and non-profit use", with optional paid Catalyst/Commercial licences | App **free**. Sync Standard **$4/user/mo annual** ($5 monthly); Sync **Plus $8/user/mo annual** ($10 monthly). Publish **$8/site/mo annual** ($10 monthly). Catalyst **$25 one-time**. Commercial **$50/user/yr** | Windows (universal), macOS (universal), Linux (AppImage x64, Snap, Deb, AppImage aarch64, Flatpak), iOS (App Store), Android (Google Play + APK) | Competitor |
| **Typora** | Proprietary, EULA. By Qiyun (Shanghai) Technology Ltd; EULA published 16 Jan 2019, updated 6 Sep 2026 | **$14.99** one-time, **15-day free trial**, up to **3 devices** | macOS, Windows (x64, x86, ARM), Linux (`.deb`, snap, binary x64/ARM). Windows 10/11 required (Win 7/8 builds exist) | Competitor |
| **MarkText** | **MIT** (verified from the repository `LICENSE` and README) | Free / donation-funded | Linux, macOS (11+), Windows (10/11, x64 + arm64) | Inspiration |
| **Logseq** | **AGPL-3.0** (verified from `LICENSE.md`) | Free / donation-funded | Windows, macOS, Linux, iOS; Android "coming soon" for the DB version | Reference (different product) |
| **Zettlr** | **GPL-3.0** (verified from the GitHub API licence field) | Free / donation-funded | Windows (x64), macOS (Intel + Apple Silicon), Debian/Ubuntu (x64 + ARM), Fedora/RHEL (x64 + ARM), AppImage (x64 + ARM). 32-bit not supported | Reference (academic) |
| **VS Code preview** | Part of VS Code — **MIT** for the `vscode` repo; the Markdown extension ships with VS Code | Free | Windows, macOS, Linux, and VS Code for the Web | Reference implementation |
| **GitHub rendering** | Service; the underlying `github/markup` and `github/html-pipeline` gems are **MIT** | Free to view | Web only | Reference implementation (the canonical one) |
| **mdBook** | **MPL-2.0** (verified from the project README: "All the code in this repository is released under the Mozilla Public License v2.0") | Free, builds HTML | Any machine with a Rust toolchain | Reference implementation |
| **MkDocs Material** | **MIT** (verified from the GitHub API) | Free (Insiders tier is paid — see doc 04) | Any machine with Python | Reference implementation |
| **glow** | **MIT** (verified from the repository `LICENSE`) | Free | macOS, Linux, Windows (Chocolatey/Scoop/Winget), plus BSD, Nix, Termux | Inspiration (minimal UI) |
| **mdcat** | **MPL-2.0** | Free | Terminal. **Archived** — the README states "This repository is no longer maintained" and points to a maintained fork | Inspiration |

Star counts (GitHub API, 6 Oct 2026) for scale, not for judgement:
`marktext/marktext` 62.1k · `logseq/logseq` 45.1k · `charmbracelet/glow` 27.6k ·
`squidfunk/mkdocs-material` 27.5k · `gohugoio/hugo` 90.0k ·
`rust-lang/mdBook` (API rate-limited at time of writing — UNVERIFIED) ·
`Zettlr/Zettlr` 13.7k · `swsnr/mdcat` 2.4k · `jupyter-book/jupyter-book` 4.3k.

Obsidian community ecosystem (verified from `obsidian.md/plugins`, 6 Oct 2026):
**8,449 plugins and 826 themes.**

---

## The gap, stated up front

Read [05-feature-matrix.md](05-feature-matrix.md) for the evidence. The short
version:

> **Every tool that reads Markdown *well* is either an editor (Typora,
> MarkText, Zettlr) or a vault/knowledge system (Obsidian, Logseq). Every tool
> that reads Markdown *correctly at scale* is a build-time site generator
> (mdBook, MkDocs Material, Docusaurus, VitePress) or a host (GitHub).**
>
> **Nobody has built a viewer that is a first-class reader: fast to open one
> file, beautiful to read for hours, honest about what it does not do,
> accessible to WCAG 2.2 AA, scriptable, and free of the note-taking
> overhead.**

That is the space. The rest of this folder is the evidence for it.