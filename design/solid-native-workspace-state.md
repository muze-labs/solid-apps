# Native workspace and app state

Status: implementation design, 2026-11-01. Implements DEF18 and the maintainer's
explicit no-migration decision (SRC24), within the current Active cycle.

Workspace version 2 uses a Workspace root, owner IRI, launcher resource/input,
ordered app-instance links, stable instance IDs, launch IRIs, titles, typed
browse grants and app-owned RDF state. Native local cache roots hold the current
workspace and acknowledged baseline separately, ETag, target IRI, dirty boolean
and per-instance reconnect keys. Reconnect keys never enter Pod exports. Keep
conditional write, conflict/review and post-205 validator-refresh contracts.

App state crosses MessagePorts as `{ turtle, opaque? }`: Turtle is transport
text, parsed and inserted as statements, never stored as a Turtle string literal.
Use `urn:muze:solid-apps:state:` for app-owned named subjects (`root` is required);
blank nodes, cycles, lists, multiple values, typed/language literals and external
resource IRI objects are supported. Refuse named subjects outside that owned
scope, preventing a provider state graph from modifying workspace metadata.
Each instance's graph receives its own storage scope, including blank-node
renaming. Restore reverses the scope mapping. This small contract works with
any developer's RDF library. Only the separate optional app-owned opaque string
may contain JSON, preserved verbatim; no broker interpretation.

Apps preserve their full native state graph and edit only their own known terms.
Files stores its folder IRI; Contacts its selected IRI/filter; Profile its resource
and contact IRIs. Profile/Contacts share draft RDF handling. Draft input strings
live on a draft node with a subject IRI and explicit form-field predicates, not
as changes to the authoritative profile. Empty/incomplete URL inputs remain
explicit input strings, not invented resource IRIs. Unknown native statements
remain authoritative, including local extensions and unrelated Pod subjects.

Use the installed oldm-turtle parser's raw triples at the persistence boundary.
Its object-graph writer expands shared blank nodes and cannot safely write
cycles. A small Turtle triple emitter preserves raw lexical values and blank-node
identity without introducing another parser, RDF dependency or changing shared
OLDM defaults. Graph equality checks exact blank-node isomorphism, bounded with
conservative inequality on exhaustion; ambiguous equality must never waive a
real conflict. No JSON snapshot, baseline string or RDF JSON literal is emitted.

Owned scalar fields require one correctly typed value; unsupported structured or
multiple fields fail before saving. RDF ordering requires a finite well-formed
list. Reuse existing instance/list identities and preserve unknown predicates.
App state that shares blank nodes with unrelated native data cannot be replaced
unsafely: preserve unchanged graphs, otherwise refuse that unsupported edit.

No migration/import of pre-release JSON state. Keep the new account-scoped native
cache, leaving old development cache records alone. Under SRC27, readers ignore
unknown predicates/datatypes and preserve their raw triples. Retired apps:snapshot
at the current workspace root is ignored while loading. Only an explicit native
save discards that obsolete predicate, without decoding/importing its value.
The draft is a raw-triple clone, so preparation never serializes forbidden JSON
or changes the source. Keep If-Match/ETag protection, including 412 recovery.
A background close cannot perform this one-time discard. Unknown predicates and
snapshots on other subjects remain untouched; unrelated RDF JSON still prevents
writing under the native-format rule and is never silently deleted. Known fields
retain their cardinality/type checks. Tests construct retired parsed terms in
memory without emitting a JSON-in-Turtle fixture. The optional opaque field
remains the sole JSON-containing interoperability output.

Verify raw graph/ordering/identity preservation, app graph isolation and unknown
terms, opaque round-trip, malformed-state refusal, baseline reload/conflicts,
401/offline/412 and edits during PUT. Update existing browser fixtures and run
full check/browser suites and JavaScript budget checks. No new UI renderer,
continuous sync, migration, catalog, publication or merge is included.


The [generated example](examples/workspace.ttl) is emitted by the implementation
and independently parsed with RDFLib. It contains one Files instance, its folder
IRI and a launcher resource with fragment; no reconnect key or opaque field is
present. Raw triple output is valid Turtle and keeps graph identity inspectable.

## Readable Turtle output

SRC29 requests a document @base, vocabulary prefixes and less repeated full IRI
text. Retain the supplied document base and resolved input prefixes through raw
cloning. Add common vocabulary bindings without rebinding source aliases, emit
only used prefixes and group each subject's properties. Use installed OLDM URI
helpers for Turtle prefix escaping and exact relative IRI resolution. Keep the
canonical absolute-term representation for graph comparison separate from this
output formatting. Raw blank-node labels, cycles, lists, lexical values and
unknown statements remain unchanged. This changes spelling only, not schema or
identity; independently compare old/new example graphs and test prefix clashes.
