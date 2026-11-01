# Solid Application Capabilities and Broker

**Status:** Design proposal / roadmap (v0.1)  
**Scope:** Solid application suite, launcher, shared preferences component and cross-origin capability communication  
**Vocabulary namespace:** `https://vocab.muze.nl/capability#` (proposed; not yet published)

Suite-wide direction is recorded in the [Solid Apps roadmap](solid-apps-roadmap.md):
Zett, Notebook, profile/account consistency, mobile and JavaScript-size targets,
local-first automatic sync, PWA support, deferred collaboration and decentralized
app catalogs. These additions do not select the next implementation cycle or
reorder the broker phases below.

## 1. Purpose

Build a small, self-hostable communication mechanism that lets independent Solid applications **offer functionality and interactive UI to other applications**.

The first two examples are:

- A file manager provides a **resource browser** so another app can ask the user to select a file or container.
- A contacts app provides a **recipient picker** so another app can ask the user to select a person or group for sharing.

A provider need not already be running. The requesting app must be able to find the user's preferred provider, launch it when necessary, and receive its result. Apps may run on different origins and in separate browser windows; the launcher need not remain open.

The long-term direction is small, independently useful applications operating on user-controlled Solid data, with reusable behavior and UI connected through URI-identified capabilities. This is related to Weblets but **does not require** embedded Weblets, iframe UI composition, or a window manager.

## 2. Principles and boundaries

1. **URIs identify semantics.** Capabilities, applications, resources, and vocabulary terms use stable URIs. Data exchanged across application boundaries has explicit linked-data meaning.
2. **Separate capability from implementation.** A capability URI identifies *what* is offered, not *who* offers it or where it runs.
3. **Users select providers.** Applications advertise what they implement; a user-controlled registry records which implementation to use.
4. **Applications remain standalone.** A provider continues to work when opened directly, without the launcher or broker.
5. **The broker transports and connects; it does not interpret domain semantics.** It routes capability requests and responses, manages live connections and pending requests, and enforces its connection policy. It does not browse files, select contacts, or access pod data on behalf of applications.
6. **Self-hostable and replaceable.** The broker endpoint comes from the user's existing Solid preferences. No particular Muze-hosted service is mandatory.
7. **No implicit authority.** A WebID or resource URI in a launch fragment is context, not proof of identity or a grant of access. Capability registration is not authorization to read or write Solid resources.
8. **Keep UI with the provider.** For v1, the provider presents its own window. Embedded presentation and layout negotiation are later concerns.
9. **Start with actual needs.** Minimize vocabulary, protocol, components and configuration until the two pilot capabilities demonstrate a need for more.

## 3. Architecture

```text
                   User's Solid Pod
                ┌─────────────────────┐
                │ WebID / preferences │
                │  ├─ broker URI      │
                │  └─ registry URI    │
                │                     │
                │ Provider registry   │
                │  browse → file app  │
                │  recipient → contacts│
                └─────────────────────┘
                         │
         reads preferences/registry (user-authorized client)
                         │
   ┌─────────────────────┴────────────────────────┐
   ▼                                              ▼
Requesting app                                Providing app
(its own window)                             (its own window)
   │                                              │
   └─ shared client / broker iframe ──────────────┘
                         │
                         ▼
                 Self-hosted broker
                 - live connections
                 - advertised capabilities
                 - pending requests
                 - routing / policy
```

**Existing interfaces:** The launcher is an ordinary webpage that starts
applications in fresh tabs. A shared preferences entry point is present in
the apps. The broker URI becomes one additional existing preference.

The initial Phase 0 assessment did not establish the previously assumed
WebID/resource launch interface in this checkout. The first implementation
defines it in [Solid Apps launch context](solid-app-launch-context.md) and
proves Launcher-to-Profile resource opening. Use that contract for subsequent
work; resource selection in Contacts and Files still needs its own acceptance
criteria. URL context does not establish authentication or a capability grant.

The next cycle implements the [initial resource-picker contract](solid-resource-picker.md):
Launcher requests a selection from an already-open Files app. The initial
broker uses explicit per-app/workspace provisioning and route policy, with
`apps:brokerUrl` in the existing preferences. Publisher discovery, a persistent
provider registry and provider cold launch remain future work. An independent
browser client can use the same contract without Launcher. See
[operator setup](../broker/README.md). Cycle acceptance remains a human decision;
the prototype does not establish the entire roadmap's completion.

### Responsibilities

| Part | Responsibility | Does not do |
|---|---|---|
| Launcher / workspace | Save and start preferred app + dataset contexts | Window management or required message routing |
| Existing Solid preferences | Point to broker and provider registry | Store live connections |
| Provider registry in the user's pod | Persist the user's chosen provider for each capability URI | Act as a global app store |
| Shared app client + optional hidden iframe | Connect each app to its configured broker; expose a tiny API | Interpret `browse` or recipient semantics |
| Broker | Authenticate/associate connections, route requests, track pending calls | Own pod data or render provider UI |
| Provider application | Implement capability and its UI | Require callers to know its internal framework |

The preferences UI and the communication transport may ship together, but should remain conceptually separate: communication must continue when the preferences menu is closed.

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
| `cap:broker` | Configured broker service URI | v1 (unless an existing preferences predicate fits) |
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
    cap:broker <https://broker.example/> ;
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

1. Requesting app reads the broker URI from the user's existing preferences and connects.
2. Provider connects, establishes its authenticated session, and advertises capability URIs.
3. Requester asks for a capability URI with a request ID and linked-data arguments.
4. Broker routes the request to the selected connected provider.
5. Provider presents its own UI and returns a linked-data result or a cancellation/error.
6. Broker forwards the result; the requester resolves its pending call.

### 5.2 Provider not running

1. Requester resolves the user's preferred provider from the Solid registry.
2. If no suitable trusted provider is connected, the requester **launches** the configured application using the existing WebID/resource fragment convention, with a narrowly scoped request correlation/handshake value.
3. The provider connects to the same broker and securely claims the pending request.
4. Broker routes the original request; the provider handles UI and returns the result.

**Browser constraint:** A remote broker cannot open windows in a user's browser. Popup blockers typically require a direct user gesture. Where launch requires asynchronous lookup, pre-resolve provider metadata or open a placeholder window synchronously during the gesture, then navigate it. Design the interaction to work when the provider must be opened manually. The request needs timeout, cancellation and a clear failure state.

### 5.3 Cross-origin transport

- Parent application ↔ embedded broker client: `postMessage` with validated `event.origin`, `event.source` and explicit `targetOrigin`.
- Shared-origin client frames ↔ broker service: a network connection (e.g., WebSocket) if applications live on different top-level sites.
- Do **not** assume cross-site embedded iframes can share `BroadcastChannel`, `SharedWorker` or storage: browser partitioning can prevent that despite identical iframe origins.
- The iframe is a possible client adapter, not the definition of the protocol. The transport should remain replaceable and reusable by Weblets later.

For v1, routing via the broker is sufficient. Direct `MessagePort` handoff, host embedding, layout negotiation and persistent UI composition are deferred.

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
- The broker does not need blanket permissions to the user's pod. Provider UI performs any necessary Solid authorization using the appropriate established mechanisms.
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

- Build a minimal self-hostable broker with registration, request/response, cancellation and disconnect handling.
- Build a tiny shared client (and iframe adapter if needed) to connect across application origins.
- Implement `browse` in the file manager and invoke it from a second app **while the file manager is already running**.
- Show a UI in the file manager window; return the chosen resource URI.

**Exit:** Two apps on different origins communicate while the launcher is closed, and the broker remains unaware of file-manager semantics.

### Phase 2 — Persistent provider registration and on-demand start

- Add broker and provider-registry references to the user's existing Solid preferences.
- Persist the user's chosen `browse` provider in their pod.
- Resolve the configured provider, start it if absent, bind the new instance to the pending request and return the selection.
- Address popup blocking and manual-launch fallback.

**Exit:** A new browser session can invoke `browse` without manually opening the file manager first.

### Phase 3 — Second capability and replaceability

- Implement recipient selection in a contacts app, returning a WebID or appropriately identified contact resource.
- Implement a second compatible `browse` provider (or a minimal test double hosted on another origin).
- Change the user's preferred provider **without changing the caller**.
- Deploy a separate broker implementation or independently hosted instance and switch only the broker preference.

**Exit:** Both capability reuse and broker replaceability are demonstrated, with no mandatory Muze-hosted service.

### Phase 4 — Evaluate before extending

- Record actual complexity: new vocabulary terms, lines of client/broker code, setup steps, failure cases and user-facing decisions.
- Test failures (offline broker, untrusted origin, stale provider, denied access, cancelled dialog, multiple providers and concurrent requests).
- Decide whether SHACL contracts, a richer app manifest, provider ranking/discovery, or URI-valued protocol message types are justified by evidence.
- Only then consider Weblets embedding, embedded provider UIs, provider selection via AI, or automatic workspace composition.

**Exit:** Explicit keep/change/remove decisions rather than automatic scope expansion.

### Retained roadmap item — Pod-synced workspaces

**Status:** Accepted roadmap addition, 2026-11-01; implementation deferred.
Record for future planning only. No implementation is authorized yet and no
delivery order relative to the broker phases has been selected.

The maintainer noticed “Shortcut saved on this device” and requested that the
workspace also sync to their Solid Pod, with the option to create new
workspaces. Launcher already supports explicit shortcut sync to one configured
Turtle resource; it does not yet offer creation or selection of distinct
workspaces.

Desired outcome:

- Create named workspaces and switch between them, each with its own collection
  of app links and dataset/resource contexts.
- Sync workspace definitions and their launch links to the user's Solid Pod,
  then reopen them in another browser or device. Retain local use before
  connecting and communicate whether changes are local or synced.
- Preserve each link independently, including multiple links to the same app,
  resource URLs, anonymous launching and parameter-mode overrides.

Before implementation, settle workspace identity and RDF representation,
discovery through the existing linked preferences, migration of current
shortcuts, and automatic-sync behavior, recovery and conflict handling. The
maintainer's subsequent local-first direction selects automatic sync when
connectivity returns; the earlier manual/automatic choice is superseded. Keep the
suite-wide Tabs/Windows preference separate unless a concrete workspace need
justifies changing its scope. Workspace sync stores configuration; it does not
copy the datasets referenced by links or manage open browser tabs/windows.

Acceptance for a future cycle: create two workspaces, add distinct links, sync
both, reload them in a fresh browser, and switch without mixing their contents.
Verify per-link settings, unknown RDF preservation and visible handling of
offline changes and sync conflicts. These criteria remain prospective.

## 9. Non-goals for the initial version

- A window manager or desktop environment.
- An app store, installer or pod-provisioning system as part of the initial
  broker proof. Simple decentralized app catalogs are separately planned in
  the suite roadmap.
- A central mandatory Muze broker.
- A universal UI component framework or renderer.
- Automatic capability matchmaking by inferred similarity.
- Ontology reasoning or mandatory SHACL processing in the broker.
- Silent app launching, implicit permission delegation or uncontrolled AI routing.
- A dependency on the launcher remaining open.

## 10. Key unresolved decisions

1. **Existing preferences vocabulary:** Which profile/preferences predicates and storage locations do the current apps already use? Extend that mechanism rather than creating a parallel one.
2. **Provider description and launch metadata:** How is the application identity related to the actual launch URL and supported invocation contexts?
3. **Broker session identity:** How do clients authenticate and prove they participate in the user's intended communication space, without giving the broker broad Solid access?
4. **On-demand launch handshake:** How is a newly opened instance securely matched to the caller's request without putting durable credentials in URL fragments?
5. **UI activation:** Is opening/focusing a provider window enough for both pilots? Keep embedded UI as a separate later capability.
6. **Capability contract evolution:** Do incompatible changes require new capability URIs? The initial rule should be that one URI denotes one stable contract.
7. **Multiple providers:** Start with a single user preference per capability; define fallback or selection rules only after a use case demands them.

## 11. Acceptance tests

The minimum architectural proof is:

- [ ] A requesting app invokes `https://vocab.muze.nl/capabilities/browse` without knowing a file manager's implementation URL.
- [ ] A file manager on another origin presents its existing UI and returns a URI.
- [ ] The request works when the launcher has been closed.
- [ ] The provider can be started on demand when not running.
- [ ] The preferred provider can be replaced through the user's Solid registry without modifying the requester.
- [ ] A contacts app similarly offers recipient selection.
- [ ] Switching to an independently hosted broker requires changing configuration, not application code.
- [ ] Invalid origins, impersonated providers, stale handshakes and unauthorized requests are rejected.
- [ ] Closing/cancelling a provider, losing the broker connection, or denying Solid access fails visibly and safely.
- [ ] Neither the broker nor a received URI grants the requester implicit pod permissions.

## 12. Design summary

**Solid decouples data from applications. URI-identified capabilities can decouple useful behavior and interactive UI from applications.**

The user's pod stores the broker location and preferred capability providers. The broker connects live applications; if a provider is absent, a browser-side client launches it using the existing Solid app launch convention. Each application remains independent, the broker remains tiny, and no permanent application or launcher must stay open merely to make a capability available.
