# Solid Semantic Clipboard — Design and Roadmap

**Status:** Proposal v0.1 — for the Solid apps repository  
**Related design:** `solid-capability-broker-roadmap.md`  
**Proposed vocabulary namespace:** `https://vocab.muze.nl/clipboard#` (not published)  
**Guiding idea:** **Copy adds a reference. Paste uses a reference. Neither destroys the previous selection.**

## 1. Purpose

Provide a small, linked-data-native clipboard shared by independent Solid applications. Unlike a conventional single-slot clipboard, it maintains a **history of selected resources**. Unlike conventional copying, its default action is **linking**, not duplicating data.

Examples:

- Select a person in Contacts; later select that person from clipboard history to add them as a calendar attendee.
- Select a document in Files; link it from a task without copying its bytes.
- Select several project resources in one application; reuse those references elsewhere, potentially hours later.

The destination application decides what relationship to create. The clipboard **never infers or writes a relationship** merely because a resource was selected.

This is a separate component of the Solid application suite, complementary to the capability broker and the launcher. It should work even when the launcher is closed. It must remain self-hostable and must not require a Muze-hosted service.

## 2. Principles

1. **References first.** The normal clipboard item identifies a resource by URI; it does not clone the resource or snapshot its graph.
2. **History is foundational.** Copy appends an entry; it does not overwrite the previous entry. Users can revisit earlier selections.
3. **Linked data throughout.** The identity of resources, classes, properties and capabilities uses URIs. Turtle is an inspectable canonical example; JSON-LD may be used at runtime.
4. **Paste is contextual.** The receiving application (and ultimately the user) decides whether a reference becomes an attendee, attachment, association, mention, etc.
5. **Clipboard is not authorization.** Possessing a URI or asserted type conveys no permission to fetch or modify the resource.
6. **Minimal metadata.** Avoid fetching target resource contents just to populate clipboard history. Labels and types are optional hints, not verified facts.
7. **Privacy by default.** Don't transmit every selection to a broker server or automatically persist sensitive history to a pod.
8. **Independently replaceable.** Storage, selection UI, browser clipboard integration, and inter-app transport are separate boundaries.
9. **Native clipboard coexistence.** Do not intercept ordinary browser copy/paste or prevent copying text, images or files.
10. **Small first release.** Avoid building a general-purpose data migration, graph-editing or semantic reasoning engine.

## 3. Scope and non-goals

**v1 should:**

- Append a selection with one or more resource URIs.
- Keep an ordered history within a user's active clipboard session.
- Show a history picker, including selecting an older item directly.
- Let independent apps on different origins add entries and request user-selected entries through the existing capability broker.
- Support filtering by exact RDF type URI, when types are supplied (not ontology inference).
- Allow individual deletion and clearing history.
- Return the chosen references to the receiving app; the app decides what to do with them.
- Work without launcher involvement and without any persistent data write to the pod.

**Not in v1:** graph snapshots; automatic copying of referenced data; drag and drop; synchronization across devices; OS clipboard history replacement; generic RDF editing; ontology inference; cross-user sharing; silent background clipboard reads; automatic permission changes; embedding provider UI inside another app.

## 4. Concepts and boundaries

| Concept | Responsibility |
|---|---|
| Selection | One explicitly chosen resource URI or ordered set of URIs |
| Clipboard entry | Selection plus timestamp and optional provenance/presentation hints |
| History store | Ordered entries, deletion and retention; initially ephemeral |
| Clipboard UI | Presents history and lets user select an entry |
| Clipboard provider | Offers copy/history-selection operations to other apps |
| Capability broker | Finds and connects providers; does not store or interpret clipboard contents |
| Destination application | Interprets pasted selection and creates a relationship, after applicable user action |
| Solid pod | Optional future durable history storage, controlled by user |

**Separate copy from paste.** Copy is a selection-recording operation. Paste is a user-triggered selection retrieval followed by an application-specific action. They need not occur close together in time.

### Interaction

```text
Contacts app         Clipboard provider        Broker        Calendar app
    │                      │                      │               │
    ├─ add(person URI) ───►│                      │               │
    │                      │  history records URI │               │
    │                      │                      │◄─ select ─────┤
    │                      │◄──── route/select ───┤               │
    │                      ├─ user picks entry ──►│──────────────►│
    │                      │                      │               ├─ writes
    │                      │                      │               │  meeting → attendee URI
```

This diagram shows a logical exchange. The actual transport is the broker's shared-origin iframe/client API and network relay across top-level sites, as described in the companion design.

## 5. Initial linked-data model

Use existing `rdf:type`, `rdfs:label`, `prov:wasAttributedTo` (only if meaningful), and `dcterms:created` where they fit. Introduce **only** clipboard-specific structure that cannot be expressed clearly with existing terms.

Proposed terms (names subject to pilot review):

| Term | Meaning |
|---|---|
| `clip:Entry` | A historical copy/selection event |
| `clip:resource` | A resource URI included in the selection; can occur more than once |

Optional future terms (do **not** standardize before the pilot): `clip:selectionOrder` / RDF List support for ordered multi-selection, `clip:sourceApplication`, retention policy predicates, selection-specific shapes.

Example of a **single-reference** entry:

```turtle
@prefix clip: <https://vocab.muze.nl/clipboard#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <https://schema.org/> .

<#copy-123> a clip:Entry ;
    dcterms:created "2026-11-01T10:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
    clip:resource <https://pod.example/contacts/alice#id> .

# Optional, unverified hints retained as entry-scoped metadata
# rather than assertions about the target resource:
# <#copy-123> ...
```

**Important:** Don't assert `<resource> a schema:Person` or its label inside clipboard storage unless the implementation explicitly distinguishes provenance and understands that these are *claims made by the copying app*. For v1, prefer an entry's URI and timestamp alone; the UI may display a shortened URI. Avoid building an RDF graph that accidentally makes temporary metadata look like facts about the resource.

The first version can simply limit each entry to **one resource URI**, while designing its API to accept an array of URIs. Before shipping multi-selection, decide whether order is semantically important. Repeated `clip:resource` triples form an unordered RDF set; an RDF List is one option if order matters.

**Identity:** Each copy action creates a distinct entry ID even if the same resource was previously copied. This preserves copy history and recency. De-duplication, if desired, is a separate UI policy.

## 6. Capability contracts

The clipboard provider advertises capabilities with stable URI identifiers (proposed):

```text
https://vocab.muze.nl/capabilities/clipboard-add
https://vocab.muze.nl/capabilities/clipboard-select
```

These identify *behaviors*, not particular clipboard implementations. The provider is chosen via the user's capability registry, as in the companion broker design. A provider can be launched on demand when not running.

Illustrative JavaScript convenience API:

```javascript
await clipboard.add({ resources: [personURI] });

const selection = await clipboard.select({
  accepts: ["https://schema.org/Person"]
});

// The receiving application chooses the relation:
await calendar.addAttendee(eventURI, selection.resources[0]);
```

The transport payload must not rely on private meanings of short property names. Formalize the linked-data request/result shapes, or provide an agreed JSON-LD `@context`, once the pilot demonstrates the minimum required fields. `accepts` is an **optional UI filter**, not a guarantee of authenticity or accessibility.

**No implicit silent reads:** `clipboard.select()` displays or requires a user-controlled selection interface. A separate explicit “paste most recent” action could be added later, guarded by a user gesture and appropriate consent.

## 7. Storage, lifetime and synchronization

### v1: ephemeral clipboard history

The history lives with the **clipboard provider** while its service is active. The broker only routes operations and keeps temporary connection/pending-request state. It must not retain selection content as a durable server-side history.

The preferred operating model is one user-selected clipboard provider for the workspace/session. A new provider instance can be launched on demand, but **history cannot survive its loss without storage**. This is an explicit limitation of v1, not something the broker can solve automatically.

Acceptable pilot options:

- Keep provider window/session open for duration of the test; or
- Persist history locally in browser storage in the provider's own top-level site, with user-visible clear/delete controls.

Cross-site iframe storage partitioning means we must **not** assume that a hidden iframe from the same broker domain yields one shared local store across unrelated top-level origins. Nor can a browser-session-only provider guarantee continuity if all provider contexts close.

### Later: opt-in persistence in Solid

A user preference can point to a private clipboard history resource in their pod. A provider can then load/save selected entries subject to the user's authorization. This could support cross-device use or durable history, but requires explicit retention, access-control, cleanup, concurrency and conflict behavior. **Do not automatically synchronize every copied reference.**

The user's existing preferences mechanism is also where the configured clipboard provider is found, via the provider registry; do not invent a second global registry.

## 8. UI behavior

The initial UI can be an independent clipboard window supplied by the clipboard provider, opened/focused through the capability broker:

- Most recent selections first.
- Each row shows a safe fallback display (short URI), optional user-provided label, and age.
- Click an item to return its reference(s) directly to the requesting app.
- An optional filter narrows visible entries to matching asserted types.
- Delete individual entries; clear history with confirmation.
- Empty, unavailable, cancelled and inaccessible selections have understandable states.

The clipboard picker **does not** decide whether a selected Person becomes an attendee, organizer or another relation. That decision belongs to the destination and its UI. Future Weblets could embed the same picker without changing clipboard semantics.

## 9. Browser-native clipboard integration

Native copy/paste should continue to work. A deliberate “Copy reference” action can also write `text/uri-list` or `text/plain` with the URI, where supported, as a fallback for ordinary applications. Support for richer custom MIME types varies across browsers; do not depend on it for cross-origin semantic history.

Never capture all system clipboard content in the background. Browser clipboard reads require explicit user interaction/permissions and are not an appropriate foundation for the shared history.

## 10. Security and privacy

- **Explicit action:** Only add selected references when the user asks to copy/select them; avoid indiscriminate collection.
- **No ambient reads:** An arbitrary application connected to the broker must not enumerate the user's clipboard history. Selection should be explicitly user-mediated and scoped to the requesting app.
- **Trusted provider:** The user's registry selects a clipboard provider; broker registration alone does not make a provider trustworthy.
- **Authenticated routing:** Enforce broker session/workspace boundaries, sender origin checks, and per-request correlation/nonces. A WebID in a URL fragment is context, not authentication.
- **No authority transfer:** A copied resource URI is not an access token. The destination app must obtain its own legitimate access, and writes require its own authorization.
- **Minimize leakage:** Resource URIs, labels and timestamps may expose personal information. Keep history out of broker logs, analytics, URLs, and unsolicited network requests.
- **Retention controls:** Delete and clear must actually affect all maintained copies within the chosen storage model. Expiry policies may follow later.
- **No invisible writes:** Pasting must not silently mutate the user's data without the destination application's understood action.

## 11. Incremental roadmap

### Phase 0 — Contract sketch

- Agree on one resource-reference entry, immutable entry ID and timestamp.
- Define draft capability URIs and provider registration within the existing registry.
- Agree on explicit copy and user-mediated select behavior.
- Document the provider lifecycle and accept that the first pilot may lose history on shutdown.

**Exit:** Two apps can agree on request/result structure with no clipboard-specific framework.

### Phase 1 — Single-provider proof of concept

- Implement a small history store in a clipboard provider app.
- Add and display resource URI references; delete and clear.
- Use the broker to add and select entries across two different app origins.
- Test the launcher being closed and a missing clipboard provider being launched on demand.

**Exit:** A contact copied in Contacts can be selected from history in Calendar, and Calendar links it as an attendee without copying the contact record.

### Phase 2 — Interoperability and replacement

- Replace the clipboard provider with a second independently implemented provider, keeping capability URIs and contracts.
- Verify that applications do not depend on a Muze broker endpoint or hardcoded clipboard implementation.
- Pilot a file reference being linked from a task.
- Test cancellations, multiple concurrent requests, inaccessible resources, malformed metadata and permission denial.

**Exit:** Provider and broker can each be replaced without changing consumer application code.

### Phase 3 — Optional persistence and improved UI

Only after v1 demonstrates value:

- Add user-opt-in history storage in their Solid pod.
- Define private storage ACL expectations and deletion semantics.
- Add cross-device merge/concurrency behavior if needed.
- Consider multi-selection, type-filtered history and native clipboard representations.
- Explore embedded picker UI through Weblets without coupling the clipboard data model to layout.

## 12. Acceptance tests

1. **History:** Copy A, then B; both remain selectable in reverse chronological order.
2. **Linking:** Pasting a contact into an event writes the chosen attendee link; no contact data is duplicated.
3. **Application-defined semantics:** The same copied resource can be attached, mentioned or linked differently by different destinations.
4. **Cross-origin:** Separate browser windows on different origins interoperate through the broker; launcher can be closed.
5. **Cold provider:** An app can invoke the clipboard selector when the provider is not already running; the user can start it. Existing ephemeral history is only promised if the chosen store survives shutdown.
6. **Replacement:** Swap the clipboard provider and self-hosted broker; no change to consumer capability calls.
7. **Privacy:** Another connected app cannot silently enumerate clipboard history or read protected resources from a copied URI.
8. **Fallback:** Ordinary text copy/paste remains functional without the semantic clipboard provider.
9. **Recovery:** Closed, denied, cancelled and timed-out requests return clear outcomes without hanging.

## 13. Open questions (do not pre-solve)

- Should the default v1 provider use memory only, or explicitly opt in to local durable browser storage?
- Does copy history keep repeated copies of the same URI, or coalesce them in the UI?
- When does an RDF type hint justify filtering, and who is allowed to claim it?
- Is ordered multi-selection required by an actual consumer?
- How does a user verify which app is requesting a clipboard selection?
- Which existing vocabulary, if any, should express clipboard selection entries without introducing even `clip:Entry` and `clip:resource`?
- How much of the selection result should carry provenance, if any, without misrepresenting the target resource?

## 14. Design invariant

**The clipboard keeps a history of references. The destination creates relationships. The broker only connects applications.**

Do not merge these responsibilities merely because one implementation can conveniently perform all three.
