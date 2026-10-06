# 02 · Risk Register

> The things that could go wrong, ranked honestly. Updated 2026-10-06.

---

## How to read this register

### Scoring

**Likelihood** — the probability the risk materialises within the next 18
months (through end of Phase 1 and into Phase 2):

| Score | Band | Meaning |
|---|---|---|
| 1 | Rare | No known mechanism, or requires an unusual chain |
| 2 | Unlikely | Plausible but we control the conditions |
| 3 | Possible | Expected somewhere in the plan |
| 4 | Likely | Will probably happen unless addressed |
| 5 | Almost certain | Already happening, or a certainty |

**Impact** — the damage if it happens:

| Score | Band | Meaning |
|---|---|---|
| 1 | Negligible | A day's work, no user impact |
| 2 | Minor | A release slips; a few support issues |
| 3 | Moderate | A phase slips; meaningful user impact; a feature is cut |
| 4 | Major | The plan changes; a platform or feature is abandoned |
| 5 | Severe | The project stalls or its trust is materially damaged |

**Exposure = Likelihood × Impact** (1–25). The bands are:

| Exposure | Band | Handling |
|---|---|---|
| 17–25 | **Critical** | Must have an active mitigation *and* a contingency before the phase that triggers it starts |
| 10–16 | **High** | Mitigation committed, owner named, reviewed monthly |
| 5–9 | **Medium** | Mitigation identified; reviewed each milestone |
| 1–4 | **Low** | Logged; monitored |

Exposure is deliberately crude. A risk with likelihood 2 and impact 5 (bus
factor) is more dangerous than likelihood 5 and impact 2 (CI flakiness), and the
multiplication hides that — which is why the **contingency** column is mandatory
and why the register is reviewed by a human, not just sorted by number.

### Status values

`open` · `mitigating` (work is in progress) · `watching` (mitigation planned,
not started) · `accepted` (we decided to live with it, in writing) ·
`realised` (it happened — record what it cost) · `closed` (no longer possible)

### Review cadence

- Every milestone: re-score everything.
- Monthly: re-score anything with exposure ≥ 10.
- Immediately on `realised`: add a line about what it actually cost, because a
  register that never records a realised risk is a fiction.

---

## Summary

| ID | Risk | L | I | **Exposure** | Band | Owner | Status |
|---|---|---|---|---|---|---|---|
| [R-01](#r-01) | Linux WebView fragmentation blocks the Linux release | 4 | 4 | **16** | High | desktop | open |
| [R-02](#r-02) | A parser or dependency CVE reaches users | 3 | 5 | **15** | High | security | open |
| [R-03](#r-03) | Windows SmartScreen suppresses downloads and adoption | 5 | 3 | **15** | High | project-lead | open |
| [R-04](#r-04) | Scope creep toward an Obsidian clone | 5 | 4 | **20** | **Critical** | project-lead | open |
| [R-05](#r-05) | Pathological files hang or crash the app | 4 | 3 | **12** | High | core | open |
| [R-06](#r-06) | Bus factor: the one person who understands the Rust core leaves | 2 | 5 | **10** | High | project-lead | open |
| [R-07](#r-07) | Licence incompatibility in a dependency | 2 | 4 | **8** | Medium | security | open |
| [R-08](#r-08) | Other Siyana projects compete for the same time | 4 | 4 | **16** | High | project-lead | open |
| [R-09](#r-09) | Distribution friction: MSI, Flatpak, Store rejections | 4 | 3 | **12** | High | build | open |
| [R-10](#r-10) | Community trust: reading untrusted files without demonstrable security maturity | 3 | 5 | **15** | High | security | open |
| [R-11](#r-11) | `main` never ships — the project never leaves the lab | 4 | 4 | **16** | High | project-lead | open |
| [R-12](#r-12) | Cross-platform architecture is over-engineered for one maintainer | 4 | 3 | **12** | High | project-lead | open |
| [R-13](#r-13) | External-edit data loss on desktop | 3 | 5 | **15** | High | desktop | open |
| [R-14](#r-14) | Accessibility gap discovered late | 3 | 4 | **12** | High | design | open |
| [R-15](#r-15) | Remote images leak reading habits (privacy claim is false) | 4 | 3 | **12** | High | product | open |
| [R-16](#r-16) | Mobile permission grants evaporate and we lose users' folders | 5 | 3 | **15** | High | mobile | open |
| [R-17](#r-17) | CI cache or build-graph rot makes releases unreliable | 3 | 3 | **9** | Medium | build | open |
| [R-18](#r-18) | Superseded Rust/TS dependencies force a painful upgrade | 4 | 2 | **8** | Medium | build | open |
| [R-19](#r-19) | Legal/trademark risk on the name or the domain | 2 | 4 | **8** | Medium | project-lead | open |
| [R-20](#r-20) | Burnout — a solo maintainer hits the wall | 3 | 5 | **15** | High | project-lead | open |
| [R-21](#r-21) | Search scope creep delays the reader | 3 | 3 | **9** | Medium | core | open |
| [R-22](#r-22) | The web target is Chromium-only and users feel misled | 3 | 3 | **9** | Medium | web | open |

---

## Critical

<a id="r-04"></a>
### R-04 · Scope creep toward an Obsidian clone

**Likelihood 5 · Impact 4 · Exposure 20 · Critical · Owner project-lead · Status open**

**What it is.** The single most likely way this project fails. Obsidian, Logseq,
and Typora all do a lot; a Markdown viewer that adds a plugin system, a graph
view, backlinks, canvas, and a sync service stops being a viewer and becomes a
half-built Obsidian that is worse at everything.

**Why it is likely.** Feature requests arrive with enthusiasm, not with cost
estimates. Every individual "yes" is defensible. The failure is cumulative and
only visible from the outside.

**Mitigation.**
- A written out-of-scope list per phase, decided at Phase 1 kickoff
  ([Q-52](01-question-register.md#q-52)), published in the README.
- Every feature request answered with: scope, cost, and what it displaces.
  Never just "on the roadmap" ([Q-75](01-question-register.md#q-75)).
- The [question register](01-question-register.md) is the honest backlog: a
  question with options and a deadline can be turned into a "no" that is
  clearly a decision rather than an evasion.
- A hard rule derived from our own positioning: **if a feature cannot be
  implemented by opening a file and rendering it, it is a different product.**

**Contingency.** If, at the end of Phase 1, the shipped app is recognisably "an
Obsidian that is worse", stop, cut to the minimal viewer, and ship that. The
cost of a small, sharp tool is recoverable; the cost of a sprawling one is a
permanent reputation problem.

**Review trigger.** Any PR that touches more than three of the core, ui, and
adapters packages at once.

---

## High

*Ordered by exposure, highest first.*

<a id="r-01"></a>
### R-01 · Linux WebView fragmentation blocks the Linux release

**Likelihood 4 · Impact 4 · Exposure 16 · High · Owner desktop · Status open**

**What it is.** Tauri on Linux uses the *system* `webkit2gtk`, and Tauri 2
requires the **4.1 API (≥ 2.40)**, which uses libsoup3. That sets a hard
floor: distributions without `webkit2gtk-4.1` cannot run the app at all.

**Evidence.** `[V]` Tauri migrated from `webkit2gtk-4.0` to `4.1` in v2 for
Flatpak/GNOME-runtime reasons, acknowledging it "raises the minimum supported
Linux version". `[V]` Tauri issue #9039 documents a concrete wall: RHEL/CentOS 9
ships glib 2.68.4 while `soup3` requires gio ≥ 2.70, so Tauri v2 does not build
or run there. `[V]` Tauri's own webview-version table is described as
"a very incomplete list". `[V]` Tauri v1's `4.0` reached CentOS/RHEL 8–9;
v2's `4.1` reaches Ubuntu 22.04+ and Fedora 37+.

**Why it is likely.** Enterprise and immutable distros (RHEL, CentOS Stream,
Alma, Rocky, older Ubuntu LTS) lag. Users there are exactly the users who would
value a fast local viewer.

**Mitigation.**
- Detect the WebKitGTK version at startup and show an **actionable** error with
  the exact package name for the user's distribution — never a crash, never a
  generic message. This converts the most common Linux support issue from a
  mystery into a one-line fix.
- Publish the supported-distribution matrix in the README with the *reason*
  (glibc floor, WebKitGTK floor), not just the list.
- Add a `--version` / "diagnostics" command that prints webview version, glibc
  version, and our minimums, so bug reports are self-diagnosing.
- AppImage carries its own webview and sidesteps most of this; make it the
  recommended Linux artefact.
- Track Tauri's webkit2gtk-5.0 (GTK4) migration as the eventual fix for the
  `soup3`/glib wall.

**Contingency.** If Linux support is still fragile at the Phase 1 exit review,
ship Windows first and Linux as "best effort, supported distributions listed".
Do **not** ship a Linux build that fails on the user's distribution without
saying so — that is how a project loses its Linux reputation permanently.

**Review trigger.** Any new distribution support claim in the README.

---

<a id="r-03"></a>
### R-03 · Windows SmartScreen suppresses downloads and adoption

**Likelihood 5 · Impact 3 · Exposure 15 · High · Owner project-lead · Status open**

**What it is.** Every user who downloads from GitHub sees "Windows protected
your PC" and must click "More info → Run anyway". For a tool asking people to
open a file they downloaded from the internet, that friction at first-run is
fatal to adoption.

**Evidence.** `[V]` Microsoft Learn (28 Sep 2026): without a signature the user
sees "Windows protected your PC" and must choose "Run anyway", and **enterprise
policy can prevent continuation entirely**. `[V]` A valid OV or EV certificate
still warns until reputation accumulates. `[V]` "EV certificates no longer
bypass SmartScreen" — that behaviour was removed. `[V]` "When a file is not
signed, SmartScreen reputation must build for each new version of your files,
starting with zero reputation." `[V]` "Reputation cannot transfer from previous
versions unless both were signed using the same publisher identity."

**Why it is likely.** It is the default state for every new Windows project.
Almost certain.

**Mitigation.**
- Sign **every** release from the first signed version onward. Unsigned files
  start from zero reputation; signed files can inherit publisher reputation.
- Use **Azure Trusted Signing** — Microsoft's own recommended path, keys held in
  the cloud, no certificate to lose. Do not buy an EV certificate expecting it
  to solve this.
- **Open a Microsoft Store listing in Phase 2.** Per Microsoft, Store-distributed
  apps are signed by a Microsoft certificate and are never subject to download
  warnings. It is the only warning-free path.
- Publish `SHA256SUMS` and a signed `latest.json` so a cautious user has a way
  to verify.
- Document in the README what the warning is and why it appears, in one
  sentence, rather than pretending it does not exist.

**Contingency.** If adoption stalls: prioritise the Store listing, publish a
`sha256`-verified portable `.zip`, and add an in-app "verify this download"
explanation. If all else fails, consider distributing via `winget` (which has its
own reputation model) or Scoop.

**Review trigger.** Every Windows release — check that the signature is present
and that the installer hash is new.

---

<a id="r-02"></a>
### R-02 · A parser or dependency CVE reaches users

**Likelihood 3 · Impact 5 · Exposure 15 · High · Owner security · Status open**

**What it is.** We render untrusted input. A vulnerability in the parser, the
sanitizer, the HTML emitter, the webview, or any of ~200 npm and ~150 crates
dependencies is a code-execution path for anyone who opens a hostile `.md`.

**Evidence.** `[V]` The threat model in `research/11` treats XSS in a viewer as
RCE-adjacent. `[V]` Real precedents exist in the ecosystem:
**CVE-2026-71476** (Nx's self-hosted remote cache extracted unvalidated tar
entries → arbitrary write; fixed 22.7.7 / 23.0.2) and **CVE-2026-48027** (a
compromised Nx Console extension build, 18.95.0, live in the VS Code Marketplace
for ~18 minutes on 19 May 2026 and OpenVSX for ~36 minutes) show that the build
toolchain itself is an attack surface. `[V]` pnpm's `blockExoticSubdeps`,
`allowBuilds`, and tarball integrity hashing (10.26) exist because this is a real
problem.

**Mitigation.**
- **Minimise the untrusted-input surface**: a pure `core` with no `node:`
  builtins, enforced by `scripts/check-boundaries.mjs` in CI.
- **Sanitise during transform, not after** (doc 06 §3), with a policy value
  injected into `core` — one implementation to audit for all three platforms.
- **CSP with `connect-src 'self'`** so the app *cannot* make network requests,
  turning "no telemetry, files never leave your machine" into an enforced
  property rather than a promise.
- `cargo audit` and `pnpm audit --audit-level high` in CI on **every** release.
- Dependabot for npm; `cargo update` reviewed weekly.
- **Fuzz the parser** in CI (doc 02 §10) — the parser is the largest untrusted
  input handler we own.
- A `SECURITY.md` with a private reporting address ([Q-70](01-question-register.md#q-70)).
- CodeQL weekly for JS/TS.

**Contingency.** A sanitizer escape is a **security incident**: publish an
advisory, cut a release within 72 hours, and default `rawHtml` to `escape` in a
hotfix if the fix is uncertain.

**Review trigger.** Any dependency bump that touches the parser, the sanitizer,
or the DOM emitter path.

---

<a id="r-10"></a>
### R-10 · Community trust: untrusted-file reader without demonstrable security maturity

**Likelihood 3 · Impact 5 · Exposure 15 · High · Owner security · Status open**

**What it is.** Our entire value proposition rests on the user's files being
safe to open. A security incident — or simply a visible absence of security
engineering — would end adoption permanently, because the failure mode of our
product is "a document that attacks the reader."

**Why impact 5.** Trust is the product. Unlike a slow feature roadmap, trust
loss is not recoverable by shipping faster later.

**Mitigation.**
- Publish the threat model (`research/11`) and the security baseline ADR
  (`0005-security-baseline-xss-sanitization.md`) as *documents a user can read*.
- Publish the `SecurityPolicy` as a documented, typed object (doc 06 §3) so users
  and reviewers can see exactly what is allowed.
- Ship the raw-text fallback and the CSP, and say so in the README.
- Adopt a vulnerability disclosure process with a real SLA ([Q-70](01-question-register.md#q-70)).
- **Do not add remote resource loading by default**
  ([Q-38](01-question-register.md#q-38)) — see R-15.
- Publish SBOM and SLSA provenance attestations in Phase 2.
- Be visibly responsive to security reports. Nothing else builds this.

**Contingency.** If an incident occurs: publish a detailed, honest post-mortem
within 72 hours including the timeline, the root cause, and the fix. Do not go
quiet — going quiet converts a bug into a betrayal.

**Review trigger.** Any change to `SecurityPolicy`, the CSP, or the raw-text
fallback.

---

<a id="r-08"></a>
### R-08 · Other Siyana projects compete for the same time

**Likelihood 4 · Impact 4 · Exposure 16 · High · Owner project-lead · Status open**

**What it is.** The organisation maintains Siyana-Lang, Siyana-Chat,
Siyana-Seed, and this project. Attention is the scarce resource. A viewer with
no users is worse than no viewer, because it consumed the time that would have
gone somewhere useful.

**Mitigation.**
- **Time-box Phase 1 to a fixed end date.** A viewer is a bounded project; an
  editor is not. This is the strongest argument for [Q-06](01-question-register.md#q-06)
  being "viewer only".
- Make the shared core genuinely reusable so Siyana-Seed or Siyana-Lang can
  consume it. Reuse is the payoff for the architecture work and it converts
  this project from "a fourth app" to "the shared rendering layer".
- Integrate the `brand` repo's design tokens so the ecosystem looks like one
  family ([Q-57](01-question-register.md#q-57)).
- Publish the research. Even if the app stalls, the research is a real
  contribution to the ecosystem and to the Markdown community.
- Track effort per project in the open, so the trade-off is visible rather than
  hidden.

**Contingency.** If Phase 1 slips past its end date, cut scope to the minimal
viewer (single file, no editing, no workspace) and ship it. A small shipped tool
beats a large unshipped one.

**Review trigger.** Any Phase 1 milestone slipping by more than two weeks.

---

<a id="r-11"></a>
### R-11 · `main` never ships — the project never leaves the lab

**Likelihood 4 · Impact 4 · Exposure 16 · High · Owner project-lead · Status open**

**What it is.** A research phase that grows into a research phase. Perfect ADRs,
ever-deeper open questions, no binary.

**Why it is likely.** Research is more comfortable than shipping, and shipping a
crude first version feels like lowering a standard we have written down.

**Mitigation.**
- **Ship an internal build at every milestone.** Not a release — a build. The
  habit of producing an artifact is what prevents this.
- Define Phase 1 exit as "a signed installer opens a file", not "all of Phase 1
  is done".
- Put a date in the roadmap and treat it as a commitment. A missed date is
  information; an absent date is not.
- The [decision schedule](03-decision-schedule.md) gives every decision a
  deadline precisely so that "we have not decided" becomes visible rather than
  comfortable.
- Cut the phase-1 scope list (R-04) *before* starting, so the exit criteria are
  short enough to actually hit.

**Contingency.** If no signed build exists 90 days before the Phase 1 target,
ship whatever exists, publicly, with a "this is an early preview" label. Early
and rough beats late and theoretical.

**Review trigger.** Any month in which no artifact was produced.

---

<a id="r-13"></a>
### R-13 · External-edit data loss on desktop

**Likelihood 3 · Impact 5 · Exposure 15 · High · Owner desktop · Status open**

**What it is.** The user has the file open in our app, saves it from another
editor, and our app overwrites their changes — or the reverse. On a local-first
tool this is the single most unforgivable failure.

**Evidence.** `[V]` Watchers are noisy: an editor save produces
`open`/`write`/`write`/`close`/`rename` bursts, and editors that use
write-to-temp-then-rename produce events that look like a delete plus a create.
`[V]` `notify`'s documentation notes that FSEvents' security model can hide
events for files you do not own.

**Mitigation.**
- **Content hash, not mtime, is the truth** (doc 03 §6). mtime is a cheap
  reject only.
- Track the hash of what we last wrote and suppress self-triggered events.
- **Atomic writes**: temp in the same directory + `sync_all` + rename + parent
  directory fsync, so a crash mid-write can never leave a truncated target.
- The three-button conflict banner (Reload / Keep mine / Save a copy as) with
  **no auto-merge and no overwrite** unless the user chose to.
- The full adapter contract test suite, including "save is atomic: never leaves a
  truncated target" (doc 03 §11).
- A `touched-but-identical` state so a tool that rewrites identical bytes does
  not trigger a scary dialog.

**Contingency.** If a data-loss report arrives, the first release afterwards must
be a fix with a regression test named after the report. Not a silent fix.

**Review trigger.** Any change to the watch, save, or conflict code paths.

---

<a id="r-16"></a>
### R-16 · Mobile permission grants evaporate and users lose folders

**Likelihood 5 · Impact 3 · Exposure 15 · High · Owner mobile · Status open**

**What it is.** On Android, a persisted SAF URI grant **does not survive a device
restart**, and is lost if the document is moved or deleted. On iOS, a
security-scoped bookmark can fail to resolve at any time. The user reopens the
app and their folder is gone.

**Evidence.** `[V]` Android's own documentation: "If the user's device has
restarted, you'd have to send the user back to the system picker", and "Even
after calling `takePersistableUriPermission()`, your app doesn't retain access to
the URI if the associated document is moved or deleted."
`[V]` Apple: security-scoped URLs must be bracketed with
`startAccessingSecurityScopedResource()`, and bookmarks must be resolved with
failure handled.

**Why likelihood 5.** It is the documented platform behaviour, not an edge case.

**Mitigation.**
- Treat a revoked grant as an **expected state**, not an error: `resolve()`
  returns `null` (doc 03 §3) and the UI shows a "Reconnect folder" affordance.
- **Never delete the user's workspace state when a grant lapses.** Mark it
  stale, grey it out in the switcher, keep the file (doc 04 §3.1). Losing a
  user's state because a permission lapsed is unforgivable.
- Re-validate on every foreground, not once at launch.
- Show a persistent indicator when a workspace is connected via a revocable
  grant, so users know they may need to reconnect.
- Consider copying into the app sandbox for a "portable library" mode — at the
  cost of the "files stay where they are" promise.

**Contingency.** If revocation proves too hostile, ship mobile as
**import-a-copy-and-read** (read-only), which is a worse product but a truthful
one, and say so clearly.

**Review trigger.** Phase 3 kickoff.

---

<a id="r-20"></a>
### R-20 · Burnout — a solo maintainer hits the wall

**Likelihood 3 · Impact 5 · Exposure 15 · High · Owner project-lead · Status open**

**What it is.** One or two people maintaining a cross-platform desktop app with a
Rust core, three shells, a release pipeline, and a security surface. The
ambition is larger than the team by construction.

**Mitigation.**
- **Time-boxed phases with explicit exit criteria** (R-11). A project with an end
  date can be finished; an open-ended one cannot.
- Cut the ecosystem expectations early (R-04) so the scope matches the team.
- Say no publicly and in writing ([Q-75](01-question-register.md#q-75)) — saying
  no is a burnout prevention technique.
- Write the "we are not doing this yet" list into the README so it does not have
  to be re-litigated.
- Recruit early and specifically: documentation and triage contributions are as
  valuable as code and are easier to give.
- **Take the bus factor seriously (R-06)**: keep the Rust surface narrow so the
  knowledge is transferable.

**Contingency.** If the maintainer has to step back, publish a status: what
exists, what is supported, and what a new maintainer would need. A project that
can be handed over is a project that survives its maintainer.

**Review trigger.** Any month where the roadmap slips and the response is
"work more hours" rather than "cut scope".

---

## High (continued) and Medium

*High-band entries continue here; the band is shown on each entry because
likelihood × impact is a crude score and the human read is the real one.*

<a id="r-05"></a>
### R-05 · Pathological files hang or crash the app

**Likelihood 4 · Impact 3 · Exposure 12 · High · Owner core · Status open**

**What it is.** A file that makes the app freeze, blank, or crash. Markdown has a
long tail: 50,000-character lines, 10,000-deep blockquotes, 100,000 links,
huge tables, a single 90 MB generated file, a zip-bomb-shaped base64 image.

**Mitigation.**
- Hard caps at every stage: depth 64, line length 1 MiB, table cells 200,000,
  link definitions 10,000, `maxFileBytes` 32 MiB, `maxFilesScanned`,
  `maxBytesScanned`.
- **Iterative** AST walking with a depth limit (a recursive walker on a 10,000-deep
  list is an uncatchable failure in some engines).
- `content-visibility: auto` plus `contain: layout style` so layout does not
  degrade on long documents.
- The error containment ladder (doc 06 §6): a parse error must never blank the
  app, and there must be a *readable* fallback.
- **Fuzz in CI**: 10k mutated inputs per commit, plus `cargo-fuzz` nightly
  (doc 02 §10, doc 06 §12).
- Yield to the event loop every 8 ms in every scan, with progress.

**Contingency.** If a class of pathological input cannot be bounded, add a
specific test for it *and* a specific cap, and document the limit in the README.

**Review trigger.** Any user report of a freeze, or any change to the caps.

---

<a id="r-12"></a>
### R-12 · Cross-platform architecture over-engineered for one maintainer

**Likelihood 4 · Impact 3 · Exposure 12 · High · Owner project-lead · Status open**

**What it is.** We have written a monorepo, two workspaces, four adapters, a
worker pipeline, a task graph, a release matrix, and a three-layer abstraction —
before the app works on *any* platform. The architecture becomes the project.

**Mitigation.**
- **Phase 1 builds only `apps/desktop`.** `apps/web` and `apps/mobile` are empty
  directories until their phase. The interfaces are designed for three
  platforms; the *implementations* are not written until needed.
- The adapter contract suite runs against the **memory adapter** first, so one
  implementation exists before three.
- Every abstraction must pass a test: "is this needed by more than one thing
  *today*?" If not, it is a comment.
- Reject feature requests that require a new abstraction layer.

**Contingency.** If the abstraction is delaying a working app, collapse
`packages/ui` into `apps/desktop` and keep only `core` and `fs-adapters` as
packages. Two packages is still a monorepo worth having.

**Review trigger.** Any new package that has exactly one consumer.

---

<a id="r-14"></a>
### R-14 · Accessibility gap discovered late

**Likelihood 3 · Impact 4 · Exposure 12 · High · Owner design · Status open**

**What it is.** WCAG 2.2 AA is promised in the README. Retrofitting
accessibility into a DOM-rendering pipeline after it is built is expensive,
because the fixes are structural (heading semantics, landmarks, focus
management, reduced motion) rather than cosmetic.

**Mitigation.**
- The bar and the budget are decided at Phase 1 kickoff
  ([Q-55](01-question-register.md#q-55), [Q-56](01-question-register.md#q-56)),
  not at v1.0.
- Structural guarantees in the pipeline: real `<h1>`–`<h6>`, a landmark
  structure, stable ids for heading anchors, `prefers-reduced-motion` respected
  by the scroll-spy and any animation.
- `role="search"` + `aria-live="polite"` on the find bar's count from day one.
- Keyboard access is a design principle in the README, so every new control must
  be reachable — and a test asserts it.
- `axe` in the component test suite.

**Contingency.** If a full audit cannot be afforded, at minimum test with one
real screen reader before v1.0 and publish the result, including failures.

**Review trigger.** Any new interactive control.

---

<a id="r-15"></a>
### R-15 · Remote images leak reading habits, making the privacy claim false

**Likelihood 4 · Impact 3 · Exposure 12 · High · Owner product · Status open**

**What it is.** The README's first paragraph says "your files never leave your
machine". If we load `![](https://tracker.example/pixel.png)` from a document, we
have told a third party the user's IP, the time, and a URL derived from their
document. The privacy claim is then false in a way users can discover with a
proxy.

**Evidence.** `[V]` Our `SecurityPolicy` already separates `allowedImageSchemes`,
so this is a policy value. `[V]` `connect-src 'self'` in the CSP would block it —
which means whichever way we decide, the CSP must be updated to match.

**Mitigation.**
- Decide explicitly ([Q-38](01-question-register.md#q-38)) and make the CSP
  agree with the decision, not the marketing copy.
- If remote images load by default, **amend the README** to say exactly what is
  and is not sent. Do not leave a false claim in place.
- If they are blocked by default, provide a per-workspace toggle with a clear
  label ("this workspace loads images from the internet").
- Never proxy. We have no server and no telemetry; adding one would break both
  the architecture and the promise.

**Contingency.** If this is discovered after release and images were loading,
that is a privacy incident, not a bug: publish a fix, a corrected README, and a
clear changelog note.

**Review trigger.** Any change to `allowedImageSchemes` or the CSP.

---

<a id="r-09"></a>
### R-09 · Distribution friction: MSI, Flatpak, and Store rejections

**Likelihood 4 · Impact 3 · Exposure 12 · High · Owner build · Status open**

**What it is.** Packaging is more likely to delay a release than code is.
NSIS translations, MSI upgrade codes, AppImage FUSE requirements on distros that
do not ship FUSE, Flatpak runtime availability, Snap review queues, Store
listing review — each is a multi-week, low-visibility project.

**Evidence.** `[V]` Tauri 2.11.4 fixed an AppImage bug where `.desktop` and
`.DirIcon` were absolute symlinks, breaking some AppImage managers like
AppManager — packaging bugs are real and upstream. `[V]` Electron 44's removal of
Windows ia32 and Linux armv7l builds shows how packaging targets get taken away.
`[V]` AppImage requires FUSE on some distributions.

**Mitigation.**
- v1 ships exactly two Linux artefacts (`.deb`, AppImage) and one Windows pair
  (NSIS `.exe`, `.msi`). Everything else is Phase 2.
- The Linux build runs in a **pinned Ubuntu 22.04 container** so the glibc floor
  is controlled and reviewable (doc 07 §3.5).
- A CI assertion that the produced binary's highest required `GLIBC_` symbol has
  not moved, so an accidental floor increase fails the build.
- Sign from the first signed release (R-03) rather than retrofitting later.
- Read Tauri and electron-builder release notes for packaging changes as part of
  the monthly dependency review.

**Contingency.** If Flatpak is delayed, it is delayed — `.deb` and AppImage
cover the large majority of desktop Linux. Do not let a third packaging format
delay the release.

**Review trigger.** Any change to the bundle configuration.

---

<a id="r-06"></a>
### R-06 · Bus factor: the one person who understands the Rust core leaves

**Likelihood 2 · Impact 5 · Exposure 10 · High · Owner project-lead · Status open**

**What it is.** Knowledge of `crates/smv-fs` (atomic writes, `notify`,
Windows `MoveFileEx`), the Tauri build, and the WASM invariant is concentrated in
one person. Their loss stalls the project.

**Why impact 5.** Without that knowledge the architecture cannot be maintained
or safely changed, and a project that cannot be maintained dies.

**Mitigation.**
- **Narrow the Rust surface** (doc 02 §8): Rust owns text-in/text-out and file
  IO; it does not own the renderer. Every line of Rust not written is knowledge
  not concentrated.
- **Express platform knowledge as tests**, not as code comments: the shared
  adapter contract suite (doc 03 §11) is five runs of one file, and it is the
  specification of the FS layer.
- Write `ARCHITECTURE.md` as a handover document, not a summary: what the
  constraints are, why each exists, and what breaks if you change it.
- Comments that explain **why**, not what. `[I]` "no clock in `core`" is a rule
  someone will otherwise "fix".
- Recruit a second maintainer even if they contribute rarely.

**Contingency.** If that happens, freeze the Rust side: no new Rust beyond bug
fixes, and invest the freed capacity in TypeScript, where the knowledge is more
widely held.

**Review trigger.** Annually, and immediately if the primary maintainer's
availability changes.

---

<a id="r-17"></a>
### R-17 · CI cache or build-graph rot makes releases unreliable

**Likelihood 3 · Impact 3 · Exposure 9 · Medium · Owner build · Status open**

**What it is.** A stale cache producing a broken artifact, or a task graph that
has grown so complex that nobody can explain a 12-minute build.

**Evidence.** `[V]` `Swatinem/rust-cache` documents working around
`cargo#8603` / `actions/cache#403`, which otherwise corrupt caches on macOS
runners — cache corruption is a known, real class of failure.
`[V]` Turborepo's Cargo support landed in 2.10.6 (July 2026) with a stream of
Cargo fixes through 2.11.x, so that layer is young.

**Mitigation.**
- Pin the Rust toolchain exactly so the cache key is stable
  ([Q-14](01-question-register.md#q-14)).
- `pnpm install --frozen-lockfile` and `cargo test --locked` everywhere: a
  release that re-resolves dependencies is not reproducible.
- Never use a cache-bypass flag in CI; model un-cacheable tasks explicitly.
- Build the frontend **once** on Linux and share the artifact, so all three
  bundles are identical by construction.
- Only one job creates the release, so a failed sibling cannot leave a
  half-published release.
- The escape hatch in doc 01 §12 exists precisely so we can drop Cargo task
  inference without rewriting the pipeline.

**Contingency.** If caching becomes untrustworthy, disable it and accept a longer
build. A slow correct build beats a fast wrong one.

**Review trigger.** Any release that has to be re-run more than once.

---

<a id="r-18"></a>
### R-18 · Superseded dependencies force a painful upgrade

**Likelihood 4 · Impact 2 · Exposure 8 · Medium · Owner build · Status open**

**What it is.** A dependency we depend on is abandoned or changes its licence,
and we are on a version we cannot upgrade from. TypeScript 6→7, Vite 7→8, Tauri
2.x majors, and `notify` 4→5 are live examples of the cadence.

**Evidence.** `[V]` TypeScript 6.0 changed defaults (`module` → `esnext`,
`target` → ES2025) and deprecated `--moduleResolution node`; 7.0 is the native
port. `[V]` Tauri 2.12 raised MSRV to 1.90 and dropped Windows 7.
`[V]` `notify`'s documentation states its licensing "will change from version 5 to
Artistic 2.0" — a licence change already planned in a crate we are considering.

**Mitigation.**
- Prefer small, focused dependencies with permissive licences and broad
  alternatives (doc 15 Q-07 rejects `marked` on conformance grounds, which also
  reduces lock-in).
- Dependabot weekly so upgrades are small and frequent rather than big and rare.
- A dependency review in the monthly process ([Q-71](01-question-register.md#q-71)).
- `cargo-deny` / a licence check in CI to catch licence drift early.
- Accept churn on *our* side (we are the app, not a library) — no API
  compatibility obligation to anyone.

**Contingency.** If a critical dependency is abandoned, replace it. We are a
consumer, so we can always leave — which is a genuine advantage over being a
library with dependents.

**Review trigger.** Monthly dependency review.

---

<a id="r-07"></a>
### R-07 · Licence incompatibility in a dependency

**Likelihood 2 · Impact 4 · Exposure 8 · Medium · Owner security · Status open**

**What it is.** A dependency changes licence (or we add one) in a way that
conflicts with MIT distribution. `notify` → Artistic 2.0 at v5 is a live example.

**Evidence.** `[V]` Current licences in our likely tree: micromark MIT,
markdown-it MIT, marked MIT, comrak **BSD-2-Clause**, markdown-rs MIT, Tauri
MIT/Apache-2.0, wasm-bindgen MIT/Apache-2.0, rusqlite MIT, MiniSearch MIT,
FlexSearch Apache-2.0, Orama Apache-2.0, chokidar MIT, notify **CC0 now /
Artistic 2.0 planned for v5**. All are permissive today.

**Mitigation.**
- An automated licence check in CI (`cargo-deny`, `license-checker`,
  `pnpm licenses list`) with an allowlist of expected licences.
- Review the licence *diff* on every bump, not just the version.
- `pnpm.overrides` to pin a safe version if an upstream relicences.
- Keep the dependency count small; fewer licences to track.

**Contingency.** Replace the dependency or fork it. As a consumer we always have
that option.

**Review trigger.** Every dependency bump; monthly otherwise.

---

<a id="r-19"></a>
### R-19 · Legal or trademark risk on the name or the domain

**Likelihood 2 · Impact 4 · Exposure 8 · Medium · Owner project-lead · Status open**

**What it is.** "Siyana" is in use by other projects (notably SiYama, a different
application). The GitHub organisation already exists, which implies the mark is
in use in good faith, but a trademark search has not been done, and the domain
may be unavailable.

**Evidence.** `[V]` The organisation is `siyana-code` and the repo references
Siyana-Lang, Siyana-Chat, Siyana-Seed. `[?]` No trademark search has been
performed; we are not lawyers and this needs professional input if the project
ever grows.

**Mitigation.**
- Do the name and bundle-id decisions once ([Q-59](01-question-register.md#q-59),
  [Q-60](01-question-register.md#q-60), [Q-58](01-question-register.md#q-58))
  **before** any release, because they are effectively permanent.
- Check domain availability for the candidate names before committing.
- Keep the reverse-DNS id under the organisation's control rather than a
  personal account (R-22 / [Q-78](01-question-register.md#q-78)).

**Contingency.** A name change before the first release is cheap; after users
have installed it, it is not.

**Review trigger.** Project-identity ADR ([Q-58](01-question-register.md#q-58)).

---

<a id="r-21"></a>
### R-21 · Search scope creep delays the reader

**Likelihood 3 · Impact 3 · Exposure 9 · Medium · Owner core · Status open**

**What it is.** Search is where features feel most valuable and are most likely
to expand: regex, fuzzy, facets, ranking, an index, a query language. A viewer
that is 80% search engine is not a viewer.

**Mitigation.**
- The phased plan with a **hard gate** (doc 05 §6): ship (a), ship (b) as a
  bounded walk, and build (c) only if benchmarks justify it.
- The benchmark plan is written in advance (doc 05 §6.1) so the gate is
  data-driven rather than enthusiasm-driven.
- No user-supplied regex in v1 (a DoS vector with no research value).
- The read cache makes tier (b) feel instant without an index.

**Contingency.** Ship tier (a) + (b) and call search done. It is genuinely
useful.

**Review trigger.** Any PR that adds a search feature before the gate.

---

<a id="r-22"></a>
### R-22 · The web target is Chromium-only and users feel misled

**Likelihood 3 · Impact 3 · Exposure 9 · Medium · Owner web · Status open**

**What it is.** The File System Access API's local-disk pickers are Chromium-only
as of 2026-10-06. A Firefox or Safari user gets a materially degraded app, and
if the marketing does not say so, they will feel misled.

**Evidence.** `[V]` MDN marks `showDirectoryPicker()` "Limited availability… does
not work in some of the most widely-used browsers", secure-context only,
experimental. `[V]` `FileSystemDirectoryHandle` is Baseline since March 2023 and
OPFS is in the WHATWG spec, so the *sandbox* filesystem is portable even though
the local-disk picker is not.

**Mitigation.**
- Decide the web scope explicitly ([Q-21](01-question-register.md#q-21)) before
  Phase 2 starts.
- Feature-detect, never sniff the user agent (doc 03 §3), so a browser that gains
  the API gets the full experience with no code change.
- Show the real capability set to the user at first run on the web: "This browser
  can open a folder" vs "This browser can only read files you drop here".
- Honest README and website copy, per platform.

**Contingency.** If the degraded web experience is not acceptable, narrow Phase 2
to "open a dropped file or a `.zip`" and say that is what it is.

**Review trigger.** Phase 2 kickoff.

---

## Realised

*(None yet. When a risk is realised, record: date, what happened, actual cost,
what changed in the register, and the link to the fix.)*

---

## Review log

| Date | Change | By |
|---|---|---|
| 2026-10-06 | Register created from the research phase. 22 risks registered. | research |

---

## Related

- [Question register](01-question-register.md) — the open decisions behind these risks
- [Decision schedule](03-decision-schedule.md) — when mitigations land
- [`../14-architecture-options/`](../14-architecture-options/) — the technical
  mitigations referenced throughout (doc 03 §7 atomic saves, doc 06 §6 error
  containment, doc 07 §6 signing)