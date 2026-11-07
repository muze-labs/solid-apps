# Solid Workbench project context

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

At that instruction, workspace persistence violated the rule in both Pod
snapshots and the local cache/baseline. DEF18 retained that known noncompliance
as a condition of the earlier cycle acceptance. SRC24 subsequently authorizes
its correction without migration because nothing has been released. DES25 and
the current IMP6 now use native workspace/app state and baseline graphs. A new
native cache leaves development records untouched; old-format Pod targets are
refused rather than copied or silently overwritten. Fixtures now use native RDF
and the full application/browser checks are available again. Historical
acceptance does not pre-accept this new correction or authorize merging it.

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
ACC-20261101-QG24H-19 records the acceptance and known gap. That snapshot was accepted,
with no claim that the format has been corrected or the native Turtle rule waived.
The starter page remains deferred. A subsequent request for file-selector test
instructions does not establish a manual picker result; automated coverage is
retained in EVD16. No merge, publication or next cycle is authorized here.


The maintainer's subsequent manual picker check found that routing works but
Files is not focused. They explicitly keep focus and built-in on-demand Files
startup in CYC2. FBK20 records the reproduction and scoped revision; current
cycle status is Active again, while ACC19 preserves the earlier acceptance.
Provider registry work remains later and DEF18 remains Open. Verification of
this routing/UI correction must avoid the known JSON-in-Turtle serializer.

IMP6 now provides the scoped one-click Files flow (implementation 2167765).
EVD21 verifies cold/warm provider activation and selection/cancel routing through
isolated fixtures that do not invoke the forbidden persistence encoder. Return
focus to Launcher is requested but browser-dependent; Chrome headless refused it,
so the UI includes manual-return guidance. Full persistence suites remain pending
native RDF fixture correction under DEF18. CYC2 stays Active for renewed human
evaluation; prior ACC19, the open RDF issue and deferred starter page are retained.


## Native RDF correction in the continued cycle

The maintainer subsequently verified the picker-return/auth-popup correction,
then requested implementing DEF18. SRC24 explicitly removes migration because
the prototype is unreleased. DES25/current IMP6 use native workspace/app state,
local cache and acknowledged-baseline graphs. Old development cache records are
left alone; old-format Pod targets are refused and require a fresh URL. Native
unknown statements, identities, state isolation and the optional opaque string
are preserved, including during conflict and save-timing failures. Full check
and browser suites now run on native fixtures. DEF18 is fixed on the branch;
CYC2 remains Active for renewed evaluation, without merge or publication.


## Unknown-predicate default and existing workspace recovery

SRC27 supersedes the fresh-URL workaround. The maintainer confirms ignoring
unknown predicates on read and preserving them on write as the linked-data
default. They explicitly authorize discarding the retired apps:snapshot at the
current workspace root on an explicit conditional native save. Readers ignore
its value without importing it, other unknown RDF stays intact, and background
close cannot perform this one-time discard. Reload Launcher and use Save to Pod
at the existing URL; no Preferences change is needed. The no-JSON-in-Turtle rule
remains in force, with only the existing opaque app-owned string experiment.


## Unordered product roadmap additions after PR #3

SRC31 records the maintainer's next-cycle input without selecting or starting a
cycle. The suite roadmap now includes fewer avoidable 401 challenges (Metro force
authorization/protected-origin learning to evaluate), account-name opening/reusing
the Profile editor, common versus current-app preferences, multiple workspace
creation/selection, a sparse shortcut dashboard, a suggested add-shortcut dialog,
and a static Turtle catalog index plus per-app manifests including stable external
Solid apps without requiring ecosystem APIs. Existing Theme/Text size controls
are retained as common preferences; storage belongs to the app-specific section.

The maintainer explicitly confirms that closing Launcher still closes managed
apps. Only Launcher logout additionally closes the whole workspace; child-app
logout does not. The dashboard is interpreted as Launcher home, seeded only with
Files links for every profile-advertised storage root. The list is unordered;
these refinements do not reorder broker phases or implement an app store now.
Third-party curation/availability and exact auth policy remain future-cycle work.

The maintainer also confirms that the account-name Profile action reuses an open
editor, or follows the existing tabs/windows preference when opening one. The
roadmap's presentation question is resolved; no special forced-window override
is planned for this action.


The maintainer's confirmed PR #3 merge is recorded in ACC32. CYC2 is now Accepted
in current metadata; this post-merge documentation reconciliation does not claim
that acceptance/integration validation was recorded before the merge. EVD30's
intermittent combined-browser readiness failures remain unresolved evidence.
The documentation branch does not itself start another cycle or perform a merge.


## Current refactor cycle, 2026-11-07

Preferences CYC33 and shared/minified bundles CYC34 are Accepted and merged;
main was 45cf58e at the start of this interaction. After roadmap/risk review,
the maintainer selects consistent stack usage and the moldable design as the
next suite-wide refactor. They explicitly direct applying poef/solid-apps' already
visible pattern across all apps/packages, without a separate proof/pilot gate.
CYC-20261107-QG24H-37 is Active on its matching branch. SRC38/DES39/IMP40/EVD41
retain scope, implementation and verification. The IDE and unrelated broker/
workspace/auth feature changes remain deferred. New policy clarifies using jaqt
with SimplyFlow models where it simplifies the code. Existing library contracts,
RDF preservation, tests and human acceptance requirements remain in force.
No acceptance, commit, merge or publication is inferred from implementation.


## Moldable suite cycle accepted, 2026-11-07

The maintainer explicitly accepts CYC-20261107-QG24H-37 and authorizes marking,
committing, merging to main and pushing it. ACC-20261107-QG24H-48 records this
closure, superseding the Active/pending state above. For this cycle, that direct
instruction replaces the usual PR route; pre-merge validation still applies.
The accepted implementation/evidence is 24e48e4d0adc33d3bc3a87b5a57fa5eee0b193fc.
Runtime template composition remains a recorded future investigation, with
build-time expansion sufficient for now. No next cycle or IDE implementation
is selected. No product changes follow the final passing EVD47 checks.


## MVP UI roadmap addition, 2026-11-07

After accepting and merging CYC37, the maintainer requests an MVP UI closer to
poef/solid-apps, removal of testing-oriented interface elements, and more shared
design components such as dialogs and dropdown menus. The suite roadmap records
this future work and requires reading https://lawsofux.com/llms.txt during its
design/implementation. That resource was retrieved and read for this update.
No cycle, control-removal list or delivery priority is selected. This change is
documentation only and does not extend the accepted refactor cycle.


## Readability for people altering their apps, 2026-11-07

The maintainer clarifies the ultimate goal: apps should be easy to alter using
the moldable IDE, including by people without a professional programming
background. They explicitly ask for self-explanatory code and avoidance of clever
programming tricks. AGENTS.md, the moldable design and suite roadmap now record
this as an app-authoring requirement today. Prefer descriptive names and clear
steps/effects; use existing library APIs without adding unnecessary indirection.
This documentation update does not start a refactor or new implementation cycle.


## Second-stage direction: virtual company, 2026-11-07

The maintainer requests a second roadmap stage after the current work, centered
on a "virtual company": Solid apps that help people come together and form a
temporary collaboration to get work done. The explicitly non-exhaustive
capability list includes project management, CRM, documentation / knowledge base,
forms, chat and collaboration. The maintainer clarifies collaboration as live
propagation of shared-data changes between participants, with the corresponding
views updating, rather than collaborative text editing. The suite roadmap
records this outcome and stage order without selecting a delivery mechanism,
app boundaries, architecture or dates. Multi-user collaboration belongs to the
second stage; current same-user sync/account consistency work remains in scope.
No implementation cycle is selected by this documentation-only update.


## Active UI/capability cycle, 2026-11-07

The maintainer confirms the MVP UI work, specifying common dropdown, dialog and
list/details design components, clear menu highlighting, visible dialog footer
actions and prefixed globally visible names. They then propose using capabilities
with a dialog/iframe host, making profile editing another capability, and confirm:
"Agreed, lets see if we can make it work." This supersedes the earlier own-profile
new-tab preference and scoped embedding deferral. CYC49/SRC50/DES51 retain that
commitment on spiral/CYC-20261107-QG24H-49-capability-dialog-ui, from main 7fabcc1.
The existing uncommitted assessment update is retained on this branch.

The cycle uses a shared private solid-design package based on the-ds, keeps
SimplyFlow rendering and provider-owned Metro/native RDF writes, and adds scoped
transient provider connections through Launcher. Profile editing and Files
selection use the dialog, with a tab continuation when framing fails. No general
registry, recipient capability, stage-two collaboration, auth-policy rewrite or
live IDE is included. Runtime composition remains separately deferred. IMP52/EVD53
will retain final implementation/evaluation; human acceptance remains pending.
No commit, merge or push is authorized by this implementation instruction.


## UI/capability cycle acceptance, 2026-11-07

The maintainer accepts the integrated CYC49 result: "Very happy with that. Mark
it accepted, commit and merge it to main! :)" ACC66 records this acceptance and
exact implementation/evidence references. CYC49 is now Accepted, superseding the
Active/pending state above. The request authorizes a direct local main merge for
this cycle instead of the normal PR route. No push or package publication is
requested. EVD65 retains the final checks and earlier failures/limits.

The accepted result includes provider-owned Profile/Files dialog tasks and tab
continuation, shared design components, accessible menus/toasts, stable loading,
provider readiness and 300ms content/dialog transitions with reduced motion.
Native RDF, conditional writes and guarded draft/save close behavior remain.
Session-renewal authorization and its recovery UI are retained future roadmap
work, as are named workspaces, registry/recipient work, automatic sync/PWA,
runtime composition/live IDE and stage-two collaboration.


## Session renewal/recovery cycle, 2026-11-07

After CYC49 acceptance, the maintainer explicitly selects session renewal and
recovery, then confirms "Yes, use refresh-first recovery" following the current
behavior/gap checkpoint. CYC-20261107-QG24H-67 is Active on its matching isolated
branch. SRC68/DES69/IMP70/EVD71 record the selection, confirmed boundary,
implementation and evidence. No commit, merge, push or publication is requested.

Keep Metro responsible for tokens, silent refresh, discovery, OIDC/DPoP and HTTP.
The suite requests supported offline authorization with consent, supplies shared
sign-in recovery, and retains drafts/conditional saves. Narrow bridges cover
structured refresh rejection, lazy authorization parameters and request-scoped
cancellation. Same-origin renewal updates waiting apps without replacing drafts.
Hidden-iframe authentication and broader account/logout ownership remain later.
Synthetic provider checks do not establish live refresh-token issuance, and
human acceptance remains pending. Previous cycle acceptance does not accept this
implementation. Original app/Preferences UI roadmap additions are preserved.


## Session recovery cycle accepted, 2026-11-07

The maintainer explicitly says: "You can mark this cycle as accepted, commit and
merge to main and push." ACC72 records acceptance of CYC67 implementation and
evidence at be9c1261a7e49177512e84bc9e6d5e019ee1fbb3. CYC67 is Accepted,
superseding the Active/pending statements above. This authorizes direct local
main integration instead of a PR, and pushing main; it does not request package
publication. Product code remains at the final passing check/browser snapshot.

The accepted work includes refresh-first recovery, preserved drafts/conditional
saves and cancellation, shared authorization updates and animated shared toasts.
Live recovery was confirmed by the maintainer; refresh-token issuance itself is
not proven. The reported Preferences ETag/repeated-save failure and unexplained
prefs.ttl URL, and a shared form visual language, are retained future roadmap
work. They are not fixed or waived by accepting this cycle. Hidden-iframe sign-in,
broader account ownership/logout and the remaining app UI work stay deferred.


## Solid Workbench naming and onboarding direction, 2026-11-07

After accepting/merging/pushing CYC67, the maintainer reports renaming the GitHub
repository to solid-workbench. They request "Solid Workbench" as the Launcher's
name and solid-workbench as the local directory name. CYC73 is Active on
spiral/CYC-20261107-QG24H-73-solid-workbench-name for this small display/checkout
rename, with direct maintainer intent as its confirmed goal. IMP74/EVD75 retain
execution and verification. Existing URLs, persisted/package IDs and historical
Spiral artifacts remain stable. No commit, merge or push is requested here.

The maintainer also reaffirms multiple workspace support and user switching,
already present in the suite roadmap. On app/Workbench startup, unsigned-in users
should receive a sign-in/sign-up style dialog. Sign-up must be designed first
around a decentralized system, including provider/account/data choices. These
are roadmap additions only; the rename does not implement them or silently
replace local-only/anonymous flows. Their concrete interaction design remains
future work.


The maintainer's CYC73 feedback revises the app URL to /workbench/ as well as
its display name. They explicitly decline backwards compatibility and can
remove their old workspace.ttl themselves. Generate no /launcher/ alias and
remove only the retired build output; do not touch Pod data. The roadmap also
records shorter swb-/swb_ suite-owned UI prefixes, with actual collision-based
qualifiers and a later coordinated refactor rather than a mass rename now.


## Solid Workbench naming accepted, 2026-11-07

The maintainer confirms "Works fine, commit, merge and push". ACC76 records
acceptance of CYC73 implementation/evidence at
7a3e660b58c64d51e9bc9d4c01467f397e6ad1b8. CYC73 is Accepted, superseding its
Active/pending state above. The request authorizes direct normal main integration
instead of a PR and pushing main; no package publication is requested.

The accepted name and canonical route are Solid Workbench and /workbench/.
The old generated /launcher/ entry is removed without compatibility or Pod-data
migration, as explicitly requested. Origin and local checkout use solid-workbench.
Workspace switching, startup sign-in/sign-up with decentralized signup design
first, and swb-/swb_ UI prefix refactoring are recorded future roadmap work.
No new implementation cycle or delivery order is selected by this acceptance.


## Standing feature guardrails confirmed, 2026-11-07

The maintainer proposes avoiding feature-heavy apps in favor of focused apps,
considering local-first/mobile-first for every feature, declining features whose
core task cannot be made accessible, and keeping the download for meaningful
interaction small enough for slow connections. After discussing concrete checks,
they explicitly answer "agreed".

AGENTS.md, the suite roadmap and moldable design now record those constraints,
including the existing readability requirement. Each cycle briefly states and
evaluates app boundaries, offline/recovery behavior, phone interaction, accessible
interaction and download impact. The existing complete-graph limit below 200000
bytes of gzipped JavaScript per app remains a ceiling, not a target; first-use
assessment also covers other assets, required requests and usable core tasks on
a cold cache. No new numeric total-transfer/time limit is invented.

This documentation-only agreement selects no implementation cycle and does not
claim existing apps already satisfy full offline, accessibility or first-use
performance requirements. No product code, tests, build configuration or budget
enforcement is changed. No commit, merge or push is requested.


## Preferences save recovery selected, 2026-11-07

The maintainer confirms the proposed reliable Preferences cycle: "Ok, lets do
that." CYC-20261107-QG24H-77 is Active on its matching dedicated branch from
accepted main 71d2737d5e7203188f503b50d184d606556f2c8f. DES78 records the confirmed
save/recovery intent and actual-API probes; IMP79/EVD80 retain implementation
and evaluation. This continues the Preferences reliability roadmap item.

The implementation distinguishes acknowledged writes from acquiring the next
ETag, reacquires a missing strong validator only after whole-RDF comparison,
keeps conditional writes, and preserves unknown native RDF in Preferences.
The dialog retains choices through failed requests and offers explicit Pod
review/restore of user edits. It removes the bare source URL. Existing session
renewal/recovery remains reused. No dependency, automatic sync, full offline
startup or reload-persistent Preferences draft cache is added. Those local-first
limitations remain explicit; wider forms styling is a separate roadmap item.
Human acceptance, commit, merge and push have not been requested for CYC77.
