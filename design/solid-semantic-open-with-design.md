# Semantic Open With for Solid — Design and Roadmap

**Status:** Design proposal, v0.1  
**Scope:** Solid file manager, shape recognition bridge, capability-provider selection  
**Companion designs:** `solid-capability-broker-roadmap.md`, `solid-semantic-clipboard-design.md`  
**Vocabulary base for new Muze terms:** `https://vocab.muze.nl/`

## 1. Purpose

A Solid resource's media type rarely tells us which application should handle its contents. A Turtle document may contain contacts, tasks, events and unrelated statements, possibly without a designated primary entity. The file manager should offer useful **Open with** actions based on recognizable RDF structures, while always allowing the user to choose any installed application or download the original resource.

This must not turn the file manager into a contact/calendar/task parser, turn `oldm-shape` into SHACL, or require the launcher or capability broker to stay open for ordinary URI-based application launching.

## 2. Principles

1. **Semantic recommendations, not restrictions.** Shape recognition recommends handlers; it never decides what a user is allowed to open.
2. **Any matching part of the graph counts.** A document need not have a single primary entity; matching nodes may be anywhere in the inspected graph.
3. **Progressive enhancement.** `Open with other…` and `Download` are available immediately; analysis runs asynchronously and can be cancelled.
4. **Bounded inspection.** Prefer HTTP byte ranges, enforce a client-side byte/time budget even when the server ignores `Range`, and never silently download an unbounded resource for recognition.
5. **Do not confuse recognition with validation.** A useful match on a partial graph is evidence, not proof that the complete graph conforms to a validation shape.
6. **Bridge incompatible representations.** Keep published SHACL shapes and `oldm-shape` unchanged. A third component understands both without either depending on it.
7. **URI-identified capabilities and shapes.** Use stable URIs as public identifiers; use community vocabulary/shape URIs wherever appropriate. Only add `vocab.muze.nl` terms to fill demonstrable gaps.
8. **Keep the user in control.** Remember a preferred handler only after an explicit choice; do not infer Solid access privileges from a shape or from the act of opening a resource.

## 3. Architecture and boundaries

```text
User's Solid workspace / preferences
      ├── installed applications and launch URLs
      ├── capability/provider registrations
      └── optional user-selected handler preferences
                         │
                         ▼
                  File Manager UI
                  ├── immediate actions
                  ├── HTTP inspection (bounded)
                  ├── RDF streaming parser
                  └── Open With recommendations
                              ▲
                              │ recognition results
                              │
                     Shape Recognition Bridge
                     ├── community SHACL adapter
                     ├── oldm-shape descriptor adapter
                     ├── minimal internal recognition model
                     └── graph candidate matching
                              ▲
                              │
                    URI-identified shape declarations
```

**File manager owns** resource selection, feedback, fetching, the displayed menu and application launch. It does not implement shape-language-specific matching or application-specific data rules.

**Shape bridge owns** shape-language adaptation and recognition of nodes in an RDF graph. It is a pure, independently usable library: no network, Solid authentication, UI, app catalog or broker dependencies.

**Provider registry owns** mappings between URI-identified operations, recognized shapes and installed providers. Its persistent source belongs to the user, in Solid. Live broker registrations are a separate, ephemeral concern.

**Applications own** whether and how to use a resource once opened. They receive the existing WebID/resource URL-fragment launch context. An app can decline a resource gracefully.

## 4. User interaction

On selecting a resource, the menu appears **before** inspection completes:

```text
Open with
  ◌ Finding compatible applications…

  Open with other…
  Download
```

As useful evidence arrives, matching applications appear without changing the immediately available actions:

```text
Open with
  Contacts                Contact data detected
  RDF Viewer              Turtle document
  ◌ Inspection incomplete — other apps may be compatible

  Open with other…
  Download
```

`Open with other…` lists **all apps installed in the user's workspace**, regardless of matching shape. It works when automatic recognition is unavailable, unsupported or wrong. `Download` means explicitly download the original resource; clicking the file itself must not trigger a download by default.

Generic format handlers may appear immediately from media type. Shape-based recommendations arrive later. The UI should distinguish `analyzing`, `complete`, `incomplete`, `unsupported` and `failed` without blocking user actions.

## 5. Shape registration and public identifiers

A capability registration associates an operation, an accepted shape **URI**, and an implementation. The following terms are **illustrative proposals**, not yet published vocabulary:

```turtle
@prefix cap: <https://vocab.muze.nl/capability#> .

<#contactsOpen>
    cap:capability <https://vocab.muze.nl/capabilities/open> ;
    cap:acceptsShape <https://shapes.example/ContactShape> ;
    cap:application <https://apps.example/contacts/> .
```

Use an appropriate real community shape URI once selected; the example above is a placeholder. The `acceptsShape` relation means that **matching data provides evidence this operation is useful**, not that successful SHACL validation is a mandatory precondition. Multiple shapes and capabilities per application are allowed; multiple providers may advertise the same shape and operation. Provider preference is separate from capability support.

No hardcoded `vcard:Individual → Contacts` rules belong in the file manager.

## 6. The shape recognition bridge

### 6.1 Inputs and outputs

Inputs:

- RDF dataset or stream of **completed parsed quads**;
- one or more URI-identified shape definitions with their source format;
- `complete` flag describing whether the inspected representation is complete;
- explicit evaluation budget, e.g. maximum triples or time.

Output is a set of candidate matches, with the shape URI, matched focus node(s), evidence and inspection status:

```js
{
  shape: 'https://shapes.example/ContactShape',
  focusNode: 'https://pod.example/data.ttl#alice',
  status: 'candidate',  // candidate | confirmed | unknown
  evidence: ['http://www.w3.org/2006/vcard/ns#fn'],
  complete: false
}
```

`confirmed` means the **supported recognition rule** was fully evaluated against a complete local graph, not that the application is guaranteed to handle the resource or that all of SHACL has been validated. No-match can only be conclusive within an explicitly defined, complete inspection scope and supported rule subset.

### 6.2 Adapters and internal recognition model

```text
SHACL document ──────► SHACL adapter ──┐
                                        ├──► minimal recognition model ─► matcher
oldm-shape.describe() ► OLDM adapter ──┘
```

The adapters are **bridges**, not changes to either existing system. Avoid lowering arbitrary SHACL into `oldm-shape` or exporting `oldm-shape` internals as a public format. Both adapters produce only the recognition features the experiment proves necessary.

Start with a narrow, positive-evidence subset: candidate-node selection; presence of characteristic predicates; optionally explicitly asserted RDF types and simple nested-property patterns. Avoid pretending to implement full SHACL targeting, closed shapes, logical negation, `maxCount`, advanced paths or shape recursion. Unsupported constructs yield `unknown` with a reason, never a silent match or rejection.

A library's **validation shape** may be stricter than its **recognition shape**. Do not automatically assume all required validation properties must exist before an app can be recommended. Test whether a limited recognition rule can be derived safely; permit an explicit recognition shape URI when needed.

### 6.3 Graph boundaries

Inspect the available RDF representation, not the entire linked world. Never follow all `owl:sameAs` or linked URIs automatically. Preserve document URI and matched subject URI as separate concepts. The launched app receives the resource URI, and optionally a matching focus node if the existing launch contract can support it; do not revise the launch convention merely for this feature.

## 7. Bounded fetching and parsing

Proposed initial budget: **64 KiB**, configurable after measurement.

1. Open the menu and render immediate actions.
2. Use known media type / cached metadata to show generic handlers.
3. For RDF representations, request `Range: bytes=0-65535` when appropriate.
4. On `206 Partial Content`, inspect `Content-Range` and parse only the delivered bytes.
5. On `200 OK` (server ignored the range), read the response body as a stream, stop at the byte budget, and cancel the reader/request. **Do not call `response.text()` or `arrayBuffer()` before limiting.**
6. On `416`, authorization errors, unsupported range handling or other failures, retain manual actions and explain that suggestions are unavailable.
7. Use a streaming Turtle parser capable of emitting completed triples before EOF. A truncated Turtle statement may fail to parse; retain previously completed quads and classify inspection as incomplete. Do not append invented Turtle syntax to force a result.
8. Cancel work when the menu closes, user chooses an action or a new resource supersedes the previous one.

HTTP range support is not guaranteed by Solid servers; test on the actual servers in use. `HEAD`/`Accept-Ranges` can inform decisions but should not be required for trying a bounded request. Watch out for content encoding and representation negotiation: range byte positions apply to the selected HTTP representation, and content transformations can complicate partial parsing. Never claim full shape nonconformance based on a truncated graph.

An **optional** cache may associate recognized candidates with resource URI, HTTP validator (ETag when present), representation type, matching-shape version and relevant identity context. Cache entries must record whether inspection was complete; invalidate conservatively. Do not persist private RDF content for a performance optimization.

## 8. Security and agency

- Fetch resources only with the user's existing Solid authorization; identifying a matching shape never grants read permission.
- Labels, literal values, resource URIs and shape declarations can be untrusted. Escape displayed content and validate URLs before navigation.
- Do not automatically fetch URIs found inside RDF graphs or remote shape dependencies without a bounded, explicit policy.
- Prefer vetted/pinned known shape definitions for v1; protect against hostile or computationally expensive shape documents.
- A provider's advertised capabilities are claims, not proof of trustworthiness.
- `Open with other…` must remain available even if all recognition subsystems fail.
- Any future “always open with” preference needs explicit user approval and a reversible setting.

## 9. Implementation roadmap

### Phase 0 — Fixtures and baseline

Create fixtures representing: (a) complete contacts graph; (b) mixed graph with contacts whose subject is not the primary document subject; (c) untyped but recognizable contact; (d) malformed/truncated Turtle ending mid-statement; (e) large non-contact Turtle; (f) unsupported SHACL feature. Record the actual `oldm-shape` descriptor format and choose one or two suitable published community shapes.

**Pass:** Expected candidate matches and unknown results are documented before coding.

### Phase 1 — Progressive file-manager menu

Implement immediate `Open with other…` and `Download`, no implicit file download on click; launch registered apps using the existing WebID/resource fragment; show loading/error/incomplete status. Add generic media-type handlers without requiring RDF inspection.

**Pass:** With the network stalled, manual open and download are available immediately; non-running registered apps can be launched.

### Phase 2 — Bounded RDF inspection

Implement HTTP Range attempt, client-side stream byte budget, abort handling, incremental RDF parsing, and reliable completeness reporting.

**Pass:** Against a large resource and a server that ignores Range, automatic inspection never reads beyond its configured budget (allowing for network/buffer granularity); partial Turtle cannot silently become a definitive no-match.

### Phase 3 — Shape bridge proof of concept

Build a pure matcher over an intentionally small recognition model, plus two adapters: SHACL subset and `oldm-shape.describe()` subset. Return matching focus nodes and evidence; report unsupported constructs.

**Pass:** Both adapters identify the same recognized contact in mixed graphs when their rules are semantically equivalent; incomplete fixtures produce candidates or unknown, not false certainty. No changes to `oldm-shape` or community shapes are required.

### Phase 4 — Registry-driven recommendations

Associate capability URI + accepted shape URI + provider application URL in the user's Solid registry. The file manager consults these registrations, progressively inserts suggestions and invokes the selected provider. No app-specific matching conditions inside file-manager code.

**Pass:** Add a second contact app (including one that isn't running); switching its registration changes Open With options without changing file-manager source. `Open with other…` lists even non-matching apps.

### Phase 5 — Review and stabilization (optional)

Measure common resource sizes, first suggestion latency, matcher costs, and the proportion of real resources recognized. Decide only then whether matching belongs in a standalone library, whether to support further SHACL features, and whether Shape Tree or Type Index hints provide enough value to add.

## 10. Explicitly deferred

- Complete SHACL or ShEx validation engine.
- Automatic ontology reasoning or semantic similarity matching.
- Recursive graph crawling and large-data indexing service.
- Automatically granting access based on a matching type or shape.
- Application installation, app store, or AI-based handler recommendation.
- Browser window management and embedded Weblet UI.
- Automatic permanent default-handler changes.

## 11. Open questions / investigation gates

1. Which published Solid community shapes have stable, dereferenceable URIs and sufficient recognition semantics for the first actual apps?
2. What exactly does `oldm-shape.describe()` expose in the current package, and which features can be adapted without private APIs?
3. How should the bridge represent **partial evidence** without conflating shape validation and structural recognition?
4. Does the existing WebID/resource launch fragment support a *focus node* independently of document URI? If not, is that needed for v1?
5. Which target Solid servers support byte ranges for Turtle, and how do they behave for authenticated and content-negotiated requests?
6. Which capability and registry predicates already exist in Solid community vocabularies, so that `vocab.muze.nl` introduces only the missing glue?

## 12. Success criterion

A user clicks a Turtle resource containing contacts alongside unrelated RDF, sees immediate **Open with other…** and **Download**, and subsequently sees **Open with Contacts** when bounded, partial or full analysis finds suitable evidence. The user can open the resource in a registered contacts app using the existing launch URL even if that app wasn't running. Replacing either the contacts app or the shape-recognition adapter requires no modification of the file manager or of `oldm-shape`.
