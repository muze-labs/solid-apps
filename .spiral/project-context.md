# Solid Apps project context

Intake status: **Complete**

Started: 2026-11-01, at the maintainer's request to read `.spiral-core`
and begin its intake. Every required topic has an explicit disposition.
Human-confirmed complete on: **2026-11-01**, in the intake conversation.
The maintainer answered "yes" to confirmation of the complete frame after
culture, risk-discovery and warning-profile choices were included.

Process source: `.spiral-core/docs/brownfield-intake.md` and
`.spiral-core/prompts/brownfield-intake.md`, inspected at submodule commit
`3c93481336d0e771110a9437c6039df6d7ce078b`.

Repository baseline: `292f753` on local branch `main`. The existing staged
`.gitmodules` change belongs to the maintainer and is outside this intake.

## Required topic dispositions

| Topic | Disposition | Evidence / outstanding question |
| --- | --- | --- |
| Purpose, users/stakeholders, goals | Confirmed by maintainer, 2026-11-01 | Basic suite and ecosystem for productive Solid use; showcase for developers building their own Solid apps. |
| Current posture | Confirmed by maintainer, 2026-11-01 | Exploratory prototype. This does not establish whether any real data is in use. |
| Important outcomes / metrics | Qualitative outcomes confirmed by maintainer; later JavaScript target explicit | Productive Solid use and developers learning/building interoperable apps. Subsequent roadmap adds mobile-first workflows and less than 200 KB gzipped JavaScript per app. |
| Consequential prior decisions / reversibility | Undocumented decisions exist; individual details unknown | Maintainer subsequently identified Muze culture, Weblets work, and thoughts on AI and linked data as influences. Seek relevant rationale during consequential work; do not invent exit costs. |
| Invariants / commitments | Established from current instructions | AGENTS.md supplied by maintainer; constraints below. Additional commitments may emerge in intake. |
| Known / tolerated problems | Unknown; explicitly dispositioned by maintainer | No explicitly tolerated problems identified. Documented limitations below remain unprioritized, not accepted trade-offs. |
| Reliable feedback / reality sources | Confirmed by maintainer | Feedback expands from the maintainer's own use to Muze colleagues, then the Solid community; repository checks provide bounded technical evidence. |
| Knowledge gaps / affinity needs | Dispositioned by maintainer; source collection complete for now | Five Weblets documents retained. Maintainer confirmed these are the last sources to add before continuing intake. Undocumented reasons still require targeted guidance when relevant. |
| Relevant future direction | Governing direction confirmed; no deadlines yet | Broker roadmap governs. Initial post-confirmation assessment places work before Phase 0 exit; candidate findings await maintainer prioritization. |
| Risk-discovery / metric-profile disposition | Dispositioned by maintainer | Three risk lenses adopted. Measure UI/UX and developer experience; uptime is explicitly irrelevant. WPF-HUMAN-001 separately adopted during final frame review. |
| Integration target / pre-merge validation | Dispositioned by maintainer | main is authoritative; maintainer reviews each completed cycle through a PR. Manual validation of the candidate plus latest main is sufficient for now; repeat if main changes. |

Unknown, not relevant, and deliberately deferred are valid answers when
explicitly dispositioned. Pending entries are not treated as answers.

## Purpose, posture and governing direction

The maintainer confirmed on 2026-11-01 that Solid Apps aims to provide a basic
suite of apps and an app ecosystem for people to use Solid productively. It
also serves as a showcase for developers who want to build their own Solid
apps. Both everyday usefulness and developer learning therefore matter.
The maintainer defined user success as productive use of their Solid data
within the limited set of applications defined so far. This is a qualitative
outcome; no numeric threshold or single demonstration task was specified.
Developer success means being able to read the source, understand how the
different stack libraries and ecosystem capabilities are used, and write an
app of their own. Developers may choose different underlying libraries;
ecosystem capabilities must remain available for integration with this suite.

The maintainer confirmed the posture as **exploratory prototype** and selected
the capability-broker roadmap as the governing direction for upcoming work.
This establishes direction, not approval of every proposed protocol detail or
an implementation cycle.

Asked about deadlines, planned migrations or other commitments affecting the
roadmap, the maintainer answered that there are **no deadlines yet**. No other
future commitments have been identified; this does not assert that every
possible migration has been ruled out. Assess the roadmap's current position
from repository evidence after the complete intake frame is confirmed.

The README describes four small browser applications: Launcher, Contacts,
Profile and Files, with shared preferences, local persistence and explicit
Solid synchronization. These capability descriptions are documentation claims;
current user population, deployments and real-data reliance remain unconfirmed.

The designs propose independently useful applications operating on
user-controlled Solid data, with URI-identified capabilities and replaceable,
user-selected providers. The broker roadmap now governs direction; the other
designs retain their stated status. No design is proof that its assumptions
are implemented.

| Design | Document status / intent | Intake disposition |
| --- | --- | --- |
| [Solid Apps suite roadmap](../design/solid-apps-roadmap.md) | Maintainer additions after the launch-context merge: Zett, Notebook, profile/account consistency, mobile/size budget, local-first automatic sync, PWA, deferred collaboration and decentralized catalogs. | Future direction requested 2026-11-01; no new implementation cycle or delivery order selected. Supplements the broker roadmap. |
| [Capability broker](../design/solid-capability-broker-roadmap.md) | Proposal v0.1; cross-origin resource browser and recipient picker, self-hostable broker, persistent provider choice and cold launch. | Governing direction confirmed by maintainer, 2026-11-01. Initial reality assessment finds Phase 0 exit not yet established; characterize launch context and pilot contracts before relying on them. |
| [Semantic clipboard](../design/solid-semantic-clipboard-design.md) | Proposal v0.1; history of references, explicit selection, destination-owned relationships, initially ephemeral. | Future proposal; priority pending. Calendar/task examples are not evidence those apps exist here. |
| [Semantic Open With](../design/solid-semantic-open-with-design.md) | Proposal v0.1; immediate manual actions and bounded RDF inspection, shape recognition separate from validation. | Future proposal; priority pending. |
| [Optional AI](../design/solid-optional-ai-capabilities.md) | Optional providers return reviewable proposals; ordinary functionality survives their removal. Explicit implementation priority: none for now. | Preserve its stated deferral; do not infer authorization to implement. |

Re-read any human-confirmed governing roadmap before choosing later cycles.
Do not silently promote the latest discovery into a new governing direction.

## Established constraints and culture

Source: current maintainer-supplied [AGENTS.md](../AGENTS.md), corroborated by
the README. These are already instructions, not new approval questions.

- SimplyFlow alone renders runtime content; HTML is composed at build time.
  Escape plain text and use item properties for list command values. Native
  lifecycle, focus, file/download and document-setting operations stay direct.
- Native RDF remains authoritative. Preserve unknown terms, multiple values,
  identities and other subjects; refuse unsupported structured edits.
- Contacts and Profile share profile editing; storage policy stays outside
  that view. Preferences follow the profile's `pim:preferencesFile` link.
- File deletion uses a conditional tombstone in the advertised parent-container
  description and retains bytes. Do not substitute HTTP DELETE. Moves are not
  implemented.
- Keep app-specific assumptions here until independent reuse justifies a lower
  library. External dependencies use npm versions. Shared packages remain
  experimental under `@muze-labs`; publication needs a separate review.
- This composition selects oldm-turtle without changing the shared OLDM default;
  the build checks for absence of N3.
- Preserve the original Contacts visual language, app-owned toolbars, Launcher
  navigation and compact shared account/preferences menu.
- Run `npm run check`, plus browser tests for UI changes. Do not commit or
  publish without a request. Other repositories' user work stays outside scope.

AGENTS.md explicitly adopts the repository's Muze architecture philosophy, Muze
engineering culture and maturity policy; library stewardship applies to shared
packages and tooling. The bundled culture profiles were consulted at the
Spiral submodule commit above. This records the inspected copies, not a claim
that their remote main branches were checked.

The maintainer explicitly adopted **WPF-HUMAN-001: Human Impact and Epistemic**
after its separate purpose was explained during frame review. The unchanged
text is retained locally at
[warning-profiles/human-impact-and-epistemic.md](warning-profiles/human-impact-and-epistemic.md),
pinned to the same source repository and submodule commit above. Its
[adoption record](warning-profiles/README.md) states scope, significance gate
and the remaining mechanical Git-provenance step when commits are authorized.
Its seven signals prompt proportionate inspection, not automatic vetoes.

The existing adoption is now explicitly recorded in [culture.md](culture.md),
with the exact inspected source version, named profile identities and their
distinct scopes. This records authority already present in AGENTS.md rather
than requesting adoption again.

Initially asked about past decisions or commitments beyond AGENTS.md and the
broker roadmap, the maintainer answered **Unknown**. Later, while discussing
knowledge gaps, the maintainer clarified that many design decisions exist but
are undocumented. Some follow from Muze culture, some from the maintainer's
Weblets work, and some from thoughts on AI and linked data. This clarification
supersedes any reading of the earlier answer as absence of prior decisions.
Individual reasons and costs of reversing boundaries remain unknown;
investigate them when material to active work rather than reconstructing a
complete history.

## Outcomes and candidate discovery profiles

The three adopted risk-discovery lenses are now collected in the ordinary
Markdown [risk-profile.md](risk-profile.md), with source/version information.
This is distinct from Spiral's optional warning-profile layer. The maintainer
raised culture and risk profiles during final frame review; the separate
bundled warning profile was separately presented and explicitly adopted.

Confirmed user outcome: people can productively use their Solid data within
the scope of the limited set of applications defined so far. Do not expand the
application set merely to make this outcome easier to demonstrate.

Confirmed developer outcome: readable source demonstrates stack library usage
and ecosystem capabilities well enough to build an independent app. Integration
with the suite's capabilities must be possible with different underlying
libraries. Do not make adoption of this suite's implementation stack a
prerequisite for ecosystem interoperability.

The maintainer selected **UI/UX and developer experience** as the measurement
focus. **Uptime is explicitly irrelevant for these browser apps**, not a target
deferred until later. Apply measurement suggestions only where they help assess
the two selected outcomes; do not import a service operations scorecard.

Possible evidence within that focus includes:

- Users complete core tasks, including recoverable failure paths.
- Shared RDF survives edits without loss of unrelated information.
- Independent apps and providers remain usable and replaceable.
- Early interaction demonstrates whether cross-app capabilities are useful.
- Developers can understand the showcase and build an independent Solid app.

No numerical thresholds were specified. Use qualitative UI/UX and developer
experience evidence, initially from the maintainer's own use, with the feedback
progression recorded below. Supported environments remain unestablished; do not
invent a browser/Pod compatibility promise.

| Profile / lens | Disposition | Reason |
| --- | --- | --- |
| `.spiral-core/profiles/risk-discovery/brownfield-general.md` | Adopted, narrowed to existing behavior and dependency assumptions | Maintainer approved initial investigation of regression risks in these areas. |
| `.spiral-core/profiles/risk-discovery/user-facing-interaction.md` | Adopted, focused on usability and failure recovery | Maintainer approved these as initial assessment concerns. |
| Custom RDF preservation, privacy and cross-app authority lens | Adopted | Maintainer approved this lens for initial assessment; examine relevant data and capability boundaries. |
| `.spiral-core/profiles/metrics/exploratory-product.md` | Narrow to explicitly selected UI/UX and developer experience | Assess productive interaction, source readability, learning stack usage and building interoperable apps with independent library choices. |
| `.spiral-core/profiles/metrics/established-service.md` | Exclude as a general scorecard | Uptime is explicitly irrelevant. Relevant UI/UX observations are covered by the selected custom focus. |

## Documented limitations and feedback sources

Asked about problems or limitations deliberately tolerated during the prototype
stage, the maintainer answered **Unknown**. This dispositions the intake topic
without treating any particular limitation as accepted.

The README reports the following limitations. Documentation is not a human
decision to tolerate them; their priority remains unestablished.

- Live-provider sign-in still needs a manual test; browser integration uses a
  mock Pod.
- Local contacts/shortcuts share an origin across WebIDs; changing storage
  location does not migrate existing data.
- Structured vCard values are preserved but not editable; language preferences
  do not translate the English interface.
- File deletion retains bytes; other clients must honor link metadata for
  compatible visibility. Moves, physical cleanup, sharing editors and recursive
  operations are follow-up work.

Available repository feedback includes unit tests and a documented browser
harness. On 2026-11-01, `npm run check` passed: Node reported two passing test
files and the build produced all four apps. Browser tests were not run for this
documentation-only intake. This check is bounded baseline evidence, not the
post-intake reality assessment or proof of live-provider interoperability.

The maintainer established this sequence for usefulness feedback:

1. Initially, the maintainer's own use.
2. Then, colleagues at Muze.
3. Then, the Solid community.

This is a planned progression, not a claim that colleagues or community members
have already tested the suite. Deployed instances, supported Pod/browser
combinations, incidents, manual test results and operational observations have
not yet been established.

After intake confirmation, the maintainer reported successful manual
**connection and authentication with solidcommunity.net**. This is first-hand
human-reported evidence. Browser/version and a detailed test procedure were
not supplied; do not infer broader provider or operation coverage.

## Knowledge and integration gaps

The maintainer reports many undocumented design decisions influenced by Muze
culture, their work on Weblets, and thoughts on AI and linked data. Existing
code and design documents therefore do not contain all relevant intent. Use
the explicitly adopted culture as guidance; do not assume it explains every
project-specific choice. Seek targeted maintainer guidance before relying on
an interpretation that could materially change a consequential decision, and
retain clarified rationale when it will help later work. No complete account
of these decisions is required to finish intake. Supporting sources are being
received one at a time. After supplying five Weblets documents, the maintainer
confirmed that this collection is complete for now and asked to continue intake.
This dispositions the knowledge topic without claiming that all undocumented
design reasoning has been recovered.

### Weblets source: first overview

The maintainer supplied a document titled **Weblets** during intake, identifying
it as the first of several documents they have written on this subject. Its
original creation date and version were not supplied. The text is retained
unchanged at [legacy/weblets-overview.md](legacy/weblets-overview.md), copied
from the conversation attachment `Pasted text.txt` in attachment directory
`a56205a9-ae7e-4c92-97d3-0e2f9aac1d36`. This is background source evidence,
not a newly approved implementation specification.

The source explicitly describes:

- Non-programmers composing custom applications from cooperating web apps.
- Each Weblet remaining a standalone application with its own URL.
- Cross-origin cooperation through a common bus with URI-identified APIs;
  each API defines its own message contract.
- Layout Weblets embedding others, including URL-based drag and drop.
- A component requesting shared services such as file selection from a parent,
  with fallback when no parent or preference exists.
- Components either owning data access or receiving data from a parent and
  sending edits back; these are different persistence responsibilities.
- Discovery and selection by required APIs, with a personalizable catalogue.
- Open questions about iframe costs and linked data versus JSON for core bus
  formats; security considerations are acknowledged but not resolved here.

Intake interpretation: standalone usefulness, URI-identified contracts and
replaceable shared services help explain the direction of the capability
broker. This does not establish that every historical Weblets mechanism belongs
in the current suite. The governing broker roadmap keeps provider windows for
v1 and defers embedding, layout negotiation and an app store. Preserve the
distinction when discussing future designs. The source's historical open
questions and technical claims have not been independently verified or adopted
as present-day architecture decisions.

### Weblets source: Why Weblets?

The maintainer supplied **Why Weblets?** as the second document, directly in
the intake conversation. Its text is retained at
[legacy/why-weblets.md](legacy/why-weblets.md). The introduction refers to
software in 2025; an exact creation date and version were not supplied.

The source motivates Weblets through these concerns and proposed responses:

- Expert-only software development and composition limit who can adapt tools
  to their own needs.
- Applications and centralized data silos act as gatekeepers; Solid Pod
  storage is the proposed default for separating data from applications.
- Reusing libraries still demands costly glue between incompatible designs.
  Weblets propose reusing complete applications, including data access,
  rendering and interaction, through a common communication mechanism.
- APIs have unique URL identities and can be discovered through a fixed API.
  Application contracts still need implementation; shareable bridges could
  translate between otherwise incompatible APIs.
- End users should be able to inspect and alter running Weblet compositions,
  with Smalltalk reflection/introspection cited as an analogy.

Intake interpretation: ecosystem interoperability must address meaningful
contracts and integration effort, in addition to transporting messages.
Framework choice need not be shared by applications. The bridge idea allows
different contracts to coexist without assuming that transport alone makes
their semantics compatible. End-user composition and inspectability provide
longer-term context for the developer showcase and capability ecosystem.

These are the author's motivations and hypotheses, not verified claims that
Weblets eliminate silos or solve reuse. The current broker roadmap remains
the governing direction; this background does not independently authorize
general bridge infrastructure, live code alteration or a composition editor.

### Weblets source: for Solid technical people

The maintainer supplied **weblets for solid technical people** as a third
document directly in the conversation. The text is retained at
[legacy/weblets-for-solid-technical-people.md](legacy/weblets-for-solid-technical-people.md).
Its original creation date and version were not supplied.

This account explicitly adds or clarifies:

- Operational interoperability: independent apps ask one another to perform
  bounded work, above Solid's data, semantics and authorization substrate.
- Private parent-child channels rather than an ambient bus observable by all
  embedded components.
- Connection handshakes advertising provided and requested APIs and available
  services; the parent/root mediates capability discovery and connection.
- Grants scoped to a relationship and specific API, potentially constrained
  by resources, shapes, purpose, duration or user action. Origin alone is not
  sufficient authority; high-risk capabilities require mediation.
- Linked Data-compatible request/result contracts identified by API URIs,
  with inspectable assumptions and support for multiple shape representations.
- Reusable bridges declaring their supported translations, constraints and
  known lossiness.
- A distinction between components performing their own authorized Pod access
  and components receiving scoped data from an authority elsewhere.
- An inspectable runtime graph of components, origins, APIs, grants, data
  sources, vocabulary mappings, transformations and message flows.

Intake interpretation: the earlier term "common bus" must not be taken as
requiring broadcast visibility or ambient authority. This document explicitly
describes private, mediated cooperation. It supplies context for capability
boundaries and inspectability; it does not itself specify a production wire
protocol, prove a security property, or establish that the suite implements
these mechanisms. The governing broker roadmap still sets immediate scope,
including separate provider windows rather than required embedded composition.

### Weblets source: security considerations

The maintainer supplied **Weblet Security Considerations** directly in the
conversation as a fourth source, retained at
[legacy/weblet-security-considerations.md](legacy/weblet-security-considerations.md).
Its original creation date and version were not supplied.

The source identifies message eavesdropping and exfiltration, and inducing a
high-value component to perform unwanted actions. It explores root-mediated
network access, possibly restricted to approved domains; connection consent;
and the tension between containing embedded code and keeping each Weblet
independently usable at its own URL. It also explicitly recognizes the burden
of asking users to approve every connection.

The proposed enforcement mechanisms are exploratory. Claims about browser
support for iframe CSP, meta CSP and generated wrapper documents have not been
verified during intake. If an implementation depends on those claims, check
current authoritative documentation and test the intended confinement boundary.
Do not treat this document as proof that arbitrary embedded content can be
confined by a parent, or that a component declaring itself noncritical makes
its requests safe.

Intake interpretation: privacy and scoped authority concern both which messages
a component can receive and what it can transmit or cause another component to
do. The private-channel account in the preceding source addresses visibility;
this security note adds motivation for controlling network effects and actions.
These documents supply design context, not authorization to exclude Firefox,
change content rendering, add an installation system or impose a confirmation
on every connection. Current AGENTS.md rules and the governing broker roadmap
remain authoritative for the suite.

### Weblets source: security and trust model compared to Solid

The maintainer supplied **weblet security and trust model compared to solid**
as a fifth source through conversation attachment `Pasted text.txt`, attachment
directory `6eeed119-8b1e-476f-b659-7ed864f5f5c4`. Its text is retained unchanged
at [legacy/weblet-security-and-trust-model-compared-to-solid.md](legacy/weblet-security-and-trust-model-compared-to-solid.md).
Its original creation date and version were not supplied.

The central statement is: **Weblets make the relationship the security
object.** The source distinguishes stored-data authorization from operational
authority between live tools. It identifies authority transferred through
composition, semantic confusion and bridge misuse as concerns alongside
eavesdropping and data exfiltration.

The proposed layered model includes browser isolation and origin/source
validation, private channels, grants scoped by requester/provider/operation
and data constraints with duration and revocability, semantic validation and
declared bridge lossiness, user mediation expressed in human consequences,
and inspection of grants and data flows. The aim is narrower, visible,
revocable trust; arbitrary composition is not claimed to be risk-free.

The source also explicitly places AI inside the same authority boundaries:
AI may propose compositions and bridges, request grants and produce inspectable
artifacts, but must not become an ambient superuser. Generated code needs
constrained evaluation before trust. This provides context for the deferred
optional-AI design; it does not bring AI implementation into current scope.

Intake interpretation: a provider's existing Solid access must not silently
become a caller's right to induce any operation it can perform. Data-access
permission and permission to invoke a live capability need distinct reasoning.
These are design intentions, not verified enforcement properties of this suite
or a finalized grant protocol. Revisit concrete enforcement and revocation
semantics when a governed cycle depends on them.

The maintainer's guidance is needed on existing deployments, historical
trade-offs and concrete success criteria. The designs themselves leave
broker identity, launch handshakes, registry/launch metadata, shape contracts
and clipboard lifetime unresolved. Treat these as design questions rather than
established defects or selected implementation tasks.

The maintainer confirmed **`main` as the authoritative integration branch**.
The maintainer confirmed that **each completed cycle is reviewed by them
through a pull request before merging into `main`**. Manual pre-merge
validation is sufficient for now. Handle integration one PR at a time:

- Validate the actual proposed combined result of the candidate and latest
  authoritative `main` immediately before integration.
- Run `npm run check`, plus `npm run test:browser` for UI changes, and Spiral
  integration validation against the current target and candidate.
- Record the results in the PR. If `main` changes before integration, repeat
  validation against the new target rather than relying on stale evidence.
- Preserve causal commits through normal merge history. Human cycle acceptance
  and PR review remain required; validation alone does not authorize merge.

Automated checks and a merge queue were explained as alternatives; a manual
serialized boundary is the selected initial approach. No automated queue is
required by this intake decision.

No `.github` directory was present during initial inspection;
this does not establish remote branch protection or CI settings.

No branch, commit, hook, workflow or remote configuration was changed by intake.

## Open conversation

First answers received on 2026-11-01:

1. Purpose: a basic suite and ecosystem for productive Solid use, also a
   developer showcase for building independent Solid apps.
2. Posture: exploratory prototype.
3. Direction: use the broker roadmap as the governing direction.
4. User success: productive use of their Solid data within the limited set of
   applications defined so far; no more specific task or threshold supplied.
5. Developer success: learn stack usage and ecosystem capabilities by reading
   the source, then build an app; other library choices must still permit
   integration with the suite through its capabilities.
6. Past decisions or commitments beyond AGENTS.md and the broker roadmap:
   explicitly **Unknown**.
7. Problems or limitations deliberately tolerated during the prototype stage:
   explicitly **Unknown**.
8. Usefulness feedback: initially the maintainer's own use, then Muze
   colleagues, then the Solid community.
9. Knowledge gaps: many undocumented decisions draw on Muze culture, the
   maintainer's Weblets work, and thoughts on AI and linked data. Individual
   decisions require targeted guidance when relevant.
10. First Weblets overview supplied and retained as background evidence;
    maintainer offered additional documents to retrieve.
11. Second document, Why Weblets?, supplied and retained: motivations around
    user composition, data independence, complete-application reuse, shareable
    API bridges and inspection/alteration of running compositions.
12. Third document, weblets for solid technical people, supplied and retained:
    operational interoperability, private channels, relationship-scoped grants,
    explicit bridge constraints/lossiness and an inspectable runtime graph.
13. Fourth document, Weblet Security Considerations, supplied and retained:
    threats from snooping, exfiltration and unwanted actions; exploratory
    network confinement and consent approaches with unverified CSP assumptions.
14. Fifth document, weblet security and trust model compared to solid, supplied
    and retained: relationships as security objects, scoped/revocable live
    authority distinct from Pod access, layered enforcement and bounded AI.
15. Maintainer confirmed no more documents to add before continuing intake.
16. Future commitments: no deadlines yet. The broker roadmap remains governing.
17. Initial risk-discovery focus approved: existing behavior/dependency
    assumptions that could cause regressions; usability and failure recovery;
    RDF preservation, privacy and authority between apps. These are lenses for
    investigation, not assertions that defects exist or priorities for fixes.
18. Measurement focus: UI/UX and developer experience. Maintainer explicitly
    rejected uptime as irrelevant for browser apps. No numerical targets were
    supplied; do not treat an operations metric profile as the default.
19. Integration target: maintainer confirmed `main` as authoritative.
20. Review boundary: maintainer reviews each completed cycle through a pull
    request before it merges into `main`.
21. Pre-merge validation: manual validation is sufficient for now, following
    explanation of manual versus automated alternatives. Record checks on the
    proposed combined result with latest main; rerun if main changes. Project
    checks, UI browser tests when applicable, and Spiral integration validation
    form the manual boundary; serialize integration without a required queue.
22. During final frame review the maintainer raised culture and risk profiles.
    Existing culture adoption and approved risk-discovery lenses have been
    made explicit in culture.md and risk-profile.md.
23. Maintainer explicitly approved adding WPF-HUMAN-001, Human Impact and
    Epistemic. The unchanged profile is retained with its exact external source
    version and an adoption record; its existing Turtle descriptor remains in
    the pinned submodule. Exact local
    Git-linked adoption relations await authorized causal commits; no foreign
    Git ancestry or placeholder hashes were invented.
24. Maintainer confirmed the complete project frame, including culture,
    risk-discovery and warning-profile choices. Intake marked Complete.
25. Maintainer reported successful connection and authentication with
    solidcommunity.net and prioritized assessment candidate 1: establish the
    actual launch context. Concrete contract and implementation choices remain
    to be settled from evidence and targeted clarification.
26. Launch-resource clarification: a resource is a file inside a storage Pod;
    prefer its full URL, preserving the option of a fragment on that URL.
    Application-specific resource handling remains to be settled.
27. Launch-WebID clarification: the launcher should always supply its current
    WebID. The maintainer agreed to the Launcher-to-Profile first slice in
    launch-context-proposal.md; execution is tracked by cycle
    CYC-20261101-QG24H-1.
28. During implementation the maintainer clarified that launch opens a new app
    window, preserving Launcher and existing app windows. The broker remains
    the planned live communication mechanism; opener access is not required
    for this launch slice.
29. Cycle CYC-20261101-QG24H-1 implements the Launcher-to-Profile launch proof,
    with project checks, browser checks and Spiral snapshot validation passing.
    Integrated human evaluation was pending at that point; later acceptance
    is recorded below and in the cycle.
30. The maintainer requested optional fragment-query support: with a literal
    `?` inside the app fragment, parse only its suffix and consume it so the
    remaining address is `url#foo`. Preserve encoded question marks and full
    resource URLs. This extends the same active launch-context cycle.
31. The maintainer requested explicit HTTP-query launch mode for server-side
    apps, with user-selectable overrides. Clarified precedence: user override,
    application declaration, then fragment when unset. App declarations and
    user overrides are separate settings; returning to Follow application
    removes only the override. Implemented and verified within the same cycle;
    remote description discovery remains future registry work.
32. The maintainer requested anonymous launching: omit WebID and include
    resource only if specified. Clarified that this choice is saved per launch
    link, allowing different choices for multiple links to the same app. This
    explicitly extends the current-WebID rule. It controls the URL, not the
    receiving app's existing authentication/session state.
33. Local testing refined launch presentation: new tabs are the default, with
    a shared Pod-backed preference to select new windows instead.
34. The maintainer accepted both the Launcher changes and the deferred roadmap
    addition for Pod-synced, user-created workspaces on 2026-11-01. Cycle
    CYC-20261101-QG24H-1 is Accepted; workspace implementation remains deferred.
35. Repository operations: the maintainer explicitly authorized the agent to
    commit changes itself, but prohibited merging. This supersedes the earlier
    no-commit instruction for authorized work; publishing is not authorized.
36. The maintainer merged the accepted launch-context cycle; repository state
    confirmed `main` at `c906322`. They then requested roadmap additions before
    a new cycle: Zett, a cobalt-note-based Notebook, a Profile link on the
    top-right name, immediate name updates across apps, mobile-first design
    with JavaScript below 200 KB gzip, offline operation and automatic sync
    when connectivity returns, explicit PWA support in every app, collaboration
    later, and a simple decentralized app store with multiple catalog URLs.
    Git is a possibility for catalog publication, not a selected requirement.
    This direction is recorded in `design/solid-apps-roadmap.md`; implementation
    remains future work. The update uses a documentation branch without
    opening a new implementation cycle.
37. The maintainer requested that the Muze architecture philosophy be read and
    included in this repository as another engineering culture document. The
    complete parent-directory guide was read and copied unchanged to
    `ARCHITECTURE-PHILOSOPHY.md`; AGENTS.md and `.spiral/culture.md` now reference
    that copy, with source dates and a checksum recorded in the culture index.
    This makes the existing adoption self-contained.
38. The maintainer agreed to a new cross-origin resource-picker cycle: Launcher
    asks an already-open Files app to select a resource, and receives its URL.
    The roadmap/culture documentation was confirmed merged on remote main at
    `4c8b285`. Cycle CYC-20261101-QG24H-2 starts there on its own branch and
    continues the broker roadmap with explicit, manually provisioned scoped
    routing. The result is implemented and automated verification is recorded
    in the cycle; human acceptance is pending. No agent merge is authorized.

39. During evaluation the maintainer questioned the server bottleneck and
    proposed a service worker, then selected Launcher itself as browser-local
    broker and workspace owner. Ordinary opener access is explicitly accepted.
    SRC-20261101-QG24H-8 retains the revised commitment; REQ4 and DES9 replace
    the server architecture for this still-Active cycle. Managed apps close and
    restore with Launcher. State updates remain local; explicit Save & close
    acknowledges a conditional Pod checkpoint before closing. Browser-X saving
    is a bounded best-effort keepalive attempt, not confirmed success. Named
    workspaces and full offline/PWA/app-data sync remain future work.

Conversation/documentation language: **English**, explicitly requested by the
maintainer. Conversation preference: ask **one question at a time** until intake is
finished. Persist answers and continue through the remaining topics without
presenting a bundled questionnaire.

Required intake topics and the additional warning-profile decision have
explicit dispositions and the maintainer confirmed the complete frame.
Next determine the roadmap's actual implementation position and compare the
confirmed UI/UX, developer experience and risk frame with evidence. Present
candidate findings for human prioritization before selecting a development
cycle. Intake completion does not imply acceptance of those findings or
authorization of a product implementation cycle.

## Initial reality assessment

The [initial assessment](reality-assessment.md) compares the confirmed frame
with code, documentation, the passing browser suite and a disposable launch
probe. It places the governing roadmap before Phase 0 exit and presents three
unprioritized candidates: establish the actual launch context, obtain
live-provider connection evidence, and collect UI/UX and developer-experience
observations. The maintainer subsequently reported successful connection and
authentication with solidcommunity.net and selected the launch-context
candidate. UI/UX/developer observations remain unprioritized; the concrete
launch-contract cycle is being formed. Intake remains Complete.

## Intake boundary

This is intake setup, not a normal development cycle. Repository documentation
is evidence for a proposed frame, not proof of current runtime behavior or
human acceptance of future designs. After all topics are dispositioned and
the maintainer confirms the frame, assess reality and present candidate risks
for human prioritization before choosing a development cycle.

## Managed workspace evaluation correction

The maintainer recovered a Pod-conflict error after Save & close appeared inert.
FBK11 traces the missing recovery path; DES9 and IMP6 now provide retained status,
review of local/Pod versions and explicit conditional resolution. EVD12 verifies
reload recovery and newer-remote-version refusal. The original differing Pod
version's cause is unknown, and choosing the maintainer's version remains their
UI decision. The active cycle has not been accepted or merged.

The next maintainer evaluation reported an app checkpoint timeout (FBK13).
IMP6 now separates ready/restoring state, allows ten seconds, identifies failed
apps and reconnects current-client ports without replaying saved state over live
drafts. EVD14 verifies slow capture, stale-port recovery and failure preservation.
Existing open tabs may require reload to use the correction. Actual user-case
attribution and human acceptance remain pending in the same Active cycle.

FBK15 adds decisive provider response evidence: CSS PUT 205 omits ETag while
its corrected authorized GET 200 returns and exposes a strong ETag. IMP6 now
separates acknowledged saves from next-write validator acquisition and persists
a target-scoped baseline. EVD16 verifies the exact pattern throughout the browser
fixture, without accessing the user's Pod. Human acceptance remains pending.

## Mandatory native Turtle rule, 2026-11-01

The maintainer initially forbade writing JSON inside any Turtle string, then
explicitly authorized only the narrow experimental app-owned exception below.
Turtle remains the native persistence format for Solid Apps.
Use native RDF statements, terms and typed scalar values, including for workspace
state, local caches, baselines, fixtures and migrations. If an appropriate native
representation cannot be found, explain the concrete issue and resolve it with
the maintainer before writing. No general rdf:JSON exception is allowed. The source
is SRC-20261101-QG24H-17; AGENTS.md and culture.md now retain this hard rule.

Current workspace persistence violates the rule in both Pod snapshots and the
local Turtle cache/baseline. DES9 and IMP6 explicitly flag this known noncompliance.
The existing code/encoding is retained as evidence, not an approved exception.
This request records the rule and noncompliance; no runtime migration is claimed.
Native RDF correction remains required; the maintainer subsequently permits
cycle acceptance with this issue explicitly retained as DEF18. No application
tests were run for the documentation change because the current fixtures/codec
write the newly forbidden encoding. Spiral metadata validation remains applicable.

The maintainer also explicitly permits a separate app-owned opaque state string
for app-specific state that is not linked data. The workspace/broker must preserve
that value without interpreting it; the main state remains native linked data.
SRC17 retains the instructions and explicit exception: this optional app-owned
field may experimentally contain JSON, solely to test interoperability. The
maintainer considers that ugly and expects others to object. This is not a
preferred persistence pattern and does not exempt main state, whole-workspace
snapshots or baselines. No runtime encoding change or migration is implemented
by the documentation update.


## Cycle acceptance with an open native RDF issue

On 2026-11-01 the maintainer explicitly accepted CYC-20261101-QG24H-2 provided
the native RDF correction is kept. DEF-20261101-QG24H-18 is retained as Open;
ACC-20261101-QG24H-19 records the acceptance and known gap. The cycle is Accepted,
with no claim that the format has been corrected or the native Turtle rule waived.
The starter page remains deferred. A subsequent request for file-selector test
instructions does not establish a manual picker result; automated coverage is
retained in EVD16. No merge, publication or next cycle is authorized here.
