# Solid Application Capabilities and Broker

**Status:** Governing roadmap, revised 2026-11-01 for a browser-local workspace
**Scope:** Solid application suite, launcher, shared preferences component and cross-origin capability communication  
**Vocabulary namespace:** `https://vocab.muze.nl/capability#` (proposed; not yet published)

Suite-wide direction is recorded in the [Solid Apps roadmap](solid-apps-roadmap.md):
Zett, Notebook, profile/account consistency, mobile and JavaScript-size targets,
local-first automatic sync, PWA support, deferred collaboration and decentralized
app catalogs. These additions do not select the next implementation cycle or
reorder the broker phases below. The maintainer subsequently revised the active
communication cycle: Launcher now owns managed app lifecycle and local routing.
That explicit revision supersedes the former Launcher-independent server design.

## 1. Purpose

Build a small, self-hostable communication mechanism that lets independent Solid applications **offer functionality and interactive UI to other applications**.

The first two examples are:

- A file manager provides a **resource browser** so another app can ask the user to select a file or container.
- A contacts app provides a **recipient picker** so another app can ask the user to select a person or group for sharing.

Eventually a requester should find the user's preferred provider, start it if
needed and receive its result. Apps can live on different origins and in
separate tabs/windows. Managed sessions require Launcher to remain open; closing
it ends the session and retains the app set for restoration. Standalone app use
remains supported.

The long-term direction is small, independently useful applications operating on user-controlled Solid data, with reusable behavior and UI connected through URI-identified capabilities. This is related to Weblets but **does not require** embedded Weblets, iframe UI composition, or iframe layout management. Launcher does manage its opened top-level apps.

## UI-cycle revision, 2026-11-07

CYC-20261107-QG24H-49 adds optional embedded capability presentation and the
[profile-editing contract](solid-profile-editing-capability.md), at the
maintainer's explicit direction. This revises the earlier own-window-only scope.
The same private-port protocol runs through Launcher; transient task providers
are scoped to the caller and omitted from workspace persistence/restoration.
Normal top-level app routing remains supported. The maintainer accepts this
cycle on 2026-11-07 (ACC66). Registry and recipient-picker phases remain future
work; UI-cycle acceptance does not claim those phases are complete.

## 2. Principles and boundaries

1. **URIs identify semantics.** Capabilities, applications, resources, and vocabulary terms use stable URIs. Data exchanged across application boundaries has explicit linked-data meaning.
2. **Separate capability from implementation.** A capability URI identifies *what* is offered, not *who* offers it or where it runs.
3. **Users select providers.** Applications advertise what they implement; a user-controlled registry records which implementation to use.
4. **Applications remain standalone.** A provider continues to work when opened directly, without the launcher or broker.
5. **The broker transports and connects; it does not interpret domain semantics.** It routes capability requests and responses, manages live connections and pending requests, and enforces its connection policy. It does not browse files, select contacts, or access pod data on behalf of applications.
6. **Self-hostable and replaceable.** Launcher is a static browser application. No network broker or mandatory Muze-hosted service is required; the transport stays behind a small renderer-independent interface.
7. **No implicit authority.** A WebID or resource URI in a launch fragment is context, not proof of identity or a grant of access. Capability registration is not authorization to read or write Solid resources.
8. **Keep UI with the provider.** Providers own their interactions and data access. The maintainer revises the embedding deferral in CYC49: a shared dialog can host a provider iframe, with a tab fallback carrying the same capability call. General layout negotiation remains deferred.
9. **Start with actual needs.** Minimize vocabulary, protocol, components and configuration until the two pilot capabilities demonstrate a need for more.

## 3. Architecture

```text
User's Solid Pod (linked preferences + workspace checkpoint)
                         ↕ conditional reads/writes
Launcher / browser-local broker ↔ account-scoped local IndexedDB
        │ private MessagePort           │ private MessagePort
        ▼                               ▼
   Files instance                  Other managed app
   own Solid session               own data/session
```

The [launch contract](solid-app-launch-context.md) defines WebID/resource
context. It grants no authentication or capability authority. The
[managed-workspace design](solid-managed-workspace.md) replaces the earlier
server proof with Launcher-owned windows, origin/instance-bound channels,
restoration state and conditional Pod checkpoints. The
[browse contract](solid-resource-picker.md) retains its URI/result semantics.
The maintainer merged the managed-workspace cycle as `798d59b` (PR #3).
See the [local guide](../broker/README.md) and retained verification limits in
[EVD30](../.spiral/evidence/EVD-20261101-QG24H-30.md).

Service workers were explored as an alternative: same-origin workers/storage
can be partitioned across different top-level sites, and workers have no
localStorage. A shared third-party iframe does not solve this reliably. Explicit
opener relationships avoid that assumption for this managed session. The prior
server proof established routing without Launcher; that criterion is superseded
for the revised architecture, not claimed as passing evidence for it.

### Responsibilities

| Part | Responsibility | Does not do |
|---|---|---|
| Launcher / workspace | Open/close/restore app instances, route calls and enforce grants | Interpret provider domain semantics |
| Existing Solid preferences | Locate app data and workspace document | Store live connections or secrets |
| Future Pod provider registry | Select implementations by capability URI | Act as a global app store |
| Shared managed-app client | Bind to opener, publish/restore state, handle calls | Require the caller's renderer or libraries |
| Provider application | Implement capability UI with its own data authority | Implicitly grant caller Pod permissions |


## 4. Linked-data model

**Proposed namespace:** `https://vocab.muze.nl/capability#`. Example instance URIs and capability names below are illustrative. Do not publish them as stable contracts before testing the pilots.

### 4.1 Three distinct identifiers

| Identifier | Example | Meaning |
|---|---|---|
| Capability | `https://vocab.muze.nl/capabilities/browse` | A defined operation independent of implementation |
| Application | `https://files.example/app/#app` | A software provider |
| Resource | `https://pod.example/documents/` | Data concerned by the operation |

The capability URI should dereference to human- and machine-readable Linked Data. Its request and result semantics should be documented independently of implementation and transport. **Exact URI match** is sufficient for v1; no inference, negotiation or approximate matching.

### 4.2 Minimal proposed terms

| Term | Meaning | Timing |
|---|---|---|
| `cap:provides` | An application implements a capability | v1 |
| `cap:registry` | User's provider-registry document URI | v1 (unless an existing preferences predicate fits) |
| `cap:application` | Implementation URI selected for a capability | v1 |
| `cap:Capability` | Class for a capability description | Optional initially |
| `cap:input`, `cap:output` | Link to input/output contract or SHACL shape | Introduce only when needed |

Prefer established vocabulary terms (e.g., `rdfs:label`, `schema:SoftwareApplication`) where appropriate. Don't invent a second general application ontology.

### 4.3 Application description (publisher-controlled)

```turtle
@prefix cap: <https://vocab.muze.nl/capability#> .
@prefix schema: <https://schema.org/> .

<https://files.example/app/#app>
    a schema:SoftwareApplication ;
    schema:name "File Manager" ;
    cap:provides <https://vocab.muze.nl/capabilities/browse> .
```

This is a declaration of capability, **not proof of trust or authority**. The app's canonical launch URL may differ from the descriptive application URI; a documented launch URL (or an explicit mapping) is required for on-demand opening. Do not infer executable URLs from arbitrary RDF identifiers.

### 4.4 User-controlled preferences and provider registry

The existing Solid preferences mechanism remains authoritative. Add references using the established profile/preference conventions where possible:

```turtle
@prefix cap: <https://vocab.muze.nl/capability#> .

<#me>
    cap:registry <./capability-providers.ttl> .
```

The registry records the user's preferred provider (and, if needed, its validated launch URL):

```turtle
@prefix cap: <https://vocab.muze.nl/capability#> .

<#fileBrowser>
    cap:provides <https://vocab.muze.nl/capabilities/browse> ;
    cap:application <https://files.example/app/#app> .
```

These are **illustrative Turtle fragments**, not a finalized registry schema. In particular, decide how to represent executable launch URLs and multiple choices only after examining the existing Solid apps' application metadata and preferences model.

The registry stays in the user's pod. A broker may cache advertised instances and user-supplied provider selections, but its cache is not the durable source of truth. Prefer having an authorized client read the private registry rather than granting the broker broad pod access.

### 4.5 Invocation payloads

The public JavaScript API may remain convenient:

```js
const resource = await capabilities.request(
  'https://vocab.muze.nl/capabilities/browse',
  { /* capability-defined linked-data request */ }
);
```

The data exchanged has URI-defined predicates and types; JSON-LD is a useful wire representation. A compact JSON view is acceptable only when its context is unambiguous and shared by the capability contract. URIs in results identify resources; receiving a URI does **not** grant access to it.

## 5. Runtime behavior

### 5.1 Live provider

1. Launcher opens a managed app and offers an origin-targeted private channel.
2. Provider registers on that bound channel and advertises capability URIs.
3. Requester asks for a capability URI with a request ID and linked-data arguments.
4. Broker routes the request to the selected connected provider.
5. Provider presents its own UI and returns a linked-data result or a cancellation/error.
6. Broker forwards the result; the requester resolves its pending call.

### 5.2 Provider not running

1. Requester resolves the user's preferred provider from the Solid registry.
2. If absent, Launcher opens the configured application using the launch convention.
3. The new instance registers through an origin/window-bound private channel.
4. Broker routes the original request; the provider handles UI and returns the result.

**Browser constraint:** Launcher can open apps only under browser window policy. Popup blockers typically require a direct user gesture. Where launch requires asynchronous lookup, pre-resolve provider metadata or open a placeholder window synchronously during the gesture, then navigate it. Design the interaction to work when the provider must be opened manually. The request needs timeout, cancellation and a clear failure state.

### 5.3 Cross-origin transport

- Launcher checks the opened WindowProxy and exact app origin, then transfers a
  private MessagePort with an explicit target origin. Children accept offers
  only from their captured opener. Local instance secrets support reconnection
  after reload; secrets are never exported to the Pod or launch URLs.
- `PortConnection` owns bounded calls/replies/cancellation. Current route policy
  permits only Launcher to request browse from explicitly allowed instances.
- No shared third-party storage, worker singleton or relay service is assumed.
  COOP can sever opener relationships. Ordinary opener access deliberately trusts
  linked apps, including the browser's cross-origin opener-navigation surface.
- Host embedding, layout negotiation and a broader routing/delegation policy
  remain deferred. Managed children monitor opener closure; standalone apps
  continue to run when opened directly.

## 6. Minimal wire protocol (proposal)

The broker must understand **transport operations**, not capability semantics. Start with:

| Operation | Purpose |
|---|---|
| `register` | Associate authenticated live instance with advertised capability URIs |
| `request` | Start a capability invocation with ID, URI and arguments |
| `response` | Complete request with result or error |
| `cancel` | Cancel a pending invocation |

Use request IDs, a target connection or provider selection, timeouts and connection lifecycle handling. Broker controls routing and policy; capability-specific input/output validation belongs to the communicating apps (and may use SHACL later).

**Open decision:** Whether protocol operation identifiers should themselves be URI-valued (rather than short strings). Prefer URI-defined semantics in the published protocol while keeping the developer-facing JS API terse. The broker's framing vocabulary should not proliferate into an application ontology.

## 7. Security and authority boundaries

These are minimum acceptance requirements, not optional hardening:

- A launch fragment's WebID is **not** authentication; the broker authenticates clients independently and associates them with an appropriate user/workspace context.
- A provider's claim that it implements `browse` does not make it trustworthy. The user's explicit provider choice and verified application origin/identity must control routing.
- Establish a binding between the launched provider, its verified origin/identity and the outstanding request. A random correlation token alone is not authorization; use short-lived, single-use, scoped launch handshakes and protect them from disclosure/replay.
- Restrict messages to authenticated, authorized application connections. An installed app must not automatically talk to every other app.
- `postMessage` handlers validate source and origin; never send sensitive messages to wildcard target origins.
- Launcher uses its own Solid session only for its workspace/preferences data. Providers use their own Solid sessions for domain data; routing does not transfer tokens or blanket Pod access.
- Selecting a WebID or resource URI does **not** implicitly grant Solid access to it.
- Handle cancellation, disconnect, reload, navigation, popup blocking and broker outages without hanging requests or silently changing provider.
- Document the privacy implications of routing capability arguments/results through a broker; do not claim end-to-end confidentiality unless added and tested.

**Explicitly not in v1:** generalized delegation of Solid access rights, automatic permission grants, arbitrary remote execution, or AI authority to choose unapproved providers.

## 8. Implementation roadmap

### Phase 0 — Inspect and specify existing interfaces

- Document the current Solid apps' WebID/resource fragment format and existing preferences vocabulary.
- Inspect current launcher/prototype and shared preferences component for reusable mechanisms.
- Choose the exact capability URIs and document the semantic contract of `browse` and `select-recipient`.
- Decide the smallest compatible provider description and registry representation; avoid duplicate preferences mechanisms.

**Exit:** Two concrete capability contracts, known launch conventions and no unowned namespace assumptions.

### Phase 1 — Two-app communication proof

- Build a browser-local Launcher broker with registration, scoped request/response, cancellation and disconnect handling.
- Build a renderer-independent managed-app client with per-instance state and restore hooks.
- Implement `browse` in the file manager and invoke it from a second app **while the file manager is already running**.
- Show a UI in the file manager window; return the chosen resource URI.

**Revised exit:** Two apps on different origins communicate through Launcher;
managed instances reconnect on reload and close/restore with their workspace.
Explicit Pod save/close waits for acknowledgement; ordinary close-time saving
is separately evaluated as best effort. The transport has no file-manager logic.
The former Launcher-closed exit applies only to the superseded server proof.

### Phase 2 — Persistent provider registration and on-demand start

The maintainer explicitly keeps a bounded first step in CYC2: Choose in Files
opens the built-in Files app when needed, focuses it, and returns focus after
selection/cancellation. This avoids manual pre-opening for the built-in picker.
It does not establish the persistent preferred-provider registry described below.

- Add a provider-registry reference through existing linked Solid preferences.
- Persist the user's chosen `browse` provider in their pod.
- Resolve the configured provider, start it if absent, bind the new instance to the pending request and return the selection.
- Address popup blocking and manual-launch fallback.

**Exit:** A new browser session can invoke `browse` without manually opening the file manager first.

### Phase 3 — Second capability and replaceability

- Implement recipient selection in a contacts app, returning a WebID or appropriately identified contact resource.
- Implement a second compatible `browse` provider (or a minimal test double hosted on another origin).
- Change the user's preferred provider **without changing the caller**.
- Exercise the protocol with a separately implemented client/provider and an independently hosted Launcher. Keep browser-local routing replaceable without a mandatory service.

**Exit:** Both capability reuse and broker replaceability are demonstrated, with no mandatory Muze-hosted service.

### Phase 4 — Evaluate before extending

- Record actual complexity: new vocabulary terms, lines of client/broker code, setup steps, failure cases and user-facing decisions.
- Test failures (offline broker, untrusted origin, stale provider, denied access, cancelled dialog, multiple providers and concurrent requests).
- Decide whether SHACL contracts, a richer app manifest, provider ranking/discovery, or URI-valued protocol message types are justified by evidence.
- Only then consider Weblets embedding, embedded provider UIs, provider selection via AI, or automatic workspace composition.

**Exit:** Explicit keep/change/remove decisions rather than automatic scope expansion.

### Retained roadmap item — Pod-synced workspaces

**Status:** Partially advanced by the explicitly revised managed-workspace cycle.
One default workspace now checkpoints the open app set, context and restoration
state locally and to a Pod on explicit save/close; browser-X attempts a prepared
keepalive write. Named workspace creation, selection and full definition/shortcut
portability remain future work. The latest
[suite roadmap](solid-apps-roadmap.md#workspaces-launcher-dashboard-and-logout)
places creation/switching in Launcher-specific preferences and defines the
sparse shortcut home and per-storage-root Files defaults. This is not continuous app-data synchronization.

The maintainer noticed “Shortcut saved on this device” and requested that the
workspace also sync to their Solid Pod, with the option to create new
workspaces. Launcher already supports explicit shortcut sync to one configured
Turtle resource; it does not yet offer creation or selection of distinct
workspaces.

Desired outcome:

- Create named workspaces and switch between them through Launcher-specific
  preferences, offering workspace choice when multiple exist. Each has its own
  collection of app links, dataset/resource contexts and restoration state.
- Launcher logout closes the active workspace and managed apps. Closing Launcher
  still closes managed apps; logout in another managed app does not close the
  whole workspace. Define save/logout ordering and failure recovery in the cycle.
- Sync workspace definitions and their launch links to the user's Solid Pod,
  then reopen them in another browser or device. Retain local use before
  connecting and communicate whether changes are local or synced.
- Preserve each link independently, including multiple links to the same app,
  resource URLs, anonymous launching and parameter-mode overrides.

Before named-workspace implementation, settle identity and RDF representation,
discovery through the existing linked preferences, migration of current
shortcuts, and automatic-sync behavior, recovery and conflict handling. The
maintainer's subsequent local-first direction selects automatic sync when
connectivity returns; the earlier manual/automatic choice is superseded. Keep the
suite-wide Tabs/Windows preference separate unless a concrete workspace need
justifies changing its scope. Workspace sync stores configuration; it does not
copy the datasets referenced by links. The current managed-workspace slice also
tracks opened tabs/windows and their restoration state.

Acceptance for a future cycle: create two workspaces, add distinct links, sync
both, reload them in a fresh browser, and switch without mixing their contents.
Verify per-link settings, unknown RDF preservation and visible handling of
offline changes and sync conflicts. These criteria remain prospective.

## 9. Non-goals for the initial version

- Embedded desktop/layout management beyond the managed top-level app set.
- An app store, installer or pod-provisioning system as part of the initial
  broker proof. Simple decentralized app catalogs are separately planned in
  the suite roadmap. Its first catalog format is now a static Turtle index plus
  one manifest per app, including stable external Solid apps without requiring
  ecosystem support. This product feature does not introduce a provider registry
  or reorder these broker phases.
- A central mandatory Muze broker.
- A universal UI component framework or renderer.
- Automatic capability matchmaking by inferred similarity.
- Ontology reasoning or mandatory SHACL processing in the broker.
- Silent app launching, implicit permission delegation or uncontrolled AI routing.
- Independently running managed sessions after Launcher closes; the revised lifecycle deliberately ends and restores them.

## 10. Key unresolved decisions

1. **Existing preferences vocabulary:** Which profile/preferences predicates and storage locations do the current apps already use? Extend that mechanism rather than creating a parallel one.
2. **Provider description and launch metadata:** How is the application identity related to the actual launch URL and supported invocation contexts?
3. **Broader connection policy:** Current window/origin/instance binding and explicit browse grant cover Launcher requests. How should app-to-app grants and durable provider trust be mediated?
4. **On-demand launch handshake:** How is a newly opened instance securely matched to the caller's request without putting durable credentials in URL fragments?
5. **UI activation:** Is opening/focusing a provider window enough for both pilots? Keep embedded UI as a separate later capability.
6. **Capability contract evolution:** Do incompatible changes require new capability URIs? The initial rule should be that one URI denotes one stable contract.
7. **Multiple providers:** Start with a single user preference per capability; define fallback or selection rules only after a use case demands them.

## 11. Acceptance tests

The minimum architectural proof is:

- [ ] A requesting app invokes `https://vocab.muze.nl/capabilities/browse` without knowing a file manager's implementation URL.
- [ ] A file manager on another origin presents its existing UI and returns a URI.
- [ ] Managed apps close with Launcher and restore without duplicated instances. Standalone use remains independent.
- [ ] The provider can be started on demand when not running.
- [ ] The preferred provider can be replaced through the user's Solid registry without modifying the requester.
- [ ] A contacts app similarly offers recipient selection.
- [ ] A separately implemented/hosted compatible client can use the same capability semantics.
- [ ] Invalid origins, impersonated providers, stale handshakes and unauthorized requests are rejected.
- [ ] Closing/cancelling a provider, losing the broker connection, or denying Solid access fails visibly and safely.
- [ ] Neither the broker nor a received URI grants the requester implicit pod permissions.

## 12. Design summary

**Solid decouples data from applications. URI-identified capabilities can decouple useful behavior and interactive UI from applications.**

Launcher owns the live browser workspace and routes capabilities over private
channels. Its Pod document stores restoration configuration, not connections or
authorization. Later provider discovery can select and start implementations
through the same launch/connection boundary. Apps retain independent standalone
use; managed sessions intentionally depend on Launcher while active.
