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

No migration/import of pre-release JSON state. Use a new account-scoped native
cache database, leaving old development records alone. Old-format Pod targets
fail visibly; select a fresh resource through Preferences. Do not silently drop
or overwrite old JSON. All fixtures use native RDF; the experimental opaque
field alone has a JSON-containing interoperability example.

Verify raw graph/ordering/identity preservation, app graph isolation and unknown
terms, opaque round-trip, malformed-state refusal, baseline reload/conflicts,
401/offline/412 and edits during PUT. Update existing browser fixtures and run
full check/browser suites and JavaScript budget checks. No new UI renderer,
continuous sync, migration, catalog, publication or merge is included.


The [generated example](examples/workspace.ttl) is emitted by the implementation
and independently parsed with RDFLib. It contains one Files instance, its folder
IRI and a launcher resource with fragment; no reconnect key or opaque field is
present. Raw triple output is valid Turtle and keeps graph identity inspectable.
