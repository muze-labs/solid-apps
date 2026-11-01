# Resource picker and initial broker

Experimental suite contract, 2026-11-01. Continues broker Phases 0 and 1.

## Capability semantics

`https://vocab.muze.nl/capabilities/browse` requests one file or container URL.
Input is an empty JSON-LD node with context
`{"@vocab":"https://vocab.muze.nl/capability#"}`. A result is a JSON-LD node
`{"@id":"https://pod.example/resource"}`. The complete HTTP(S) URI is returned,
including its query/fragment when supplied by a provider. No bytes are moved,
downloaded or written. A URI grants no access. Files selects among resources
actually listed by its authorized Solid session, within its configured root.
The caller validates the result before replacing its field.

The companion recipient pilot is
`https://vocab.muze.nl/capabilities/select-recipient`: one explicit selection
returns an `@id` identifying the selected WebID or contact, not implied access
rights or a mailbox address. Its implementation, shape filters and registry
remain deferred. Both URIs are provisional and not asserted to dereference yet.

## Managed transport and authority

The server relay described in the original version of this document is
superseded by the [browser-local workspace design](solid-managed-workspace.md).
The capability semantics above remain current. Launcher opens an instance,
checks its origin/window, and offers a private MessagePort. Only explicitly
allowed providers receive selection requests. Files uses its own Solid session;
a WebID in a launch URL establishes neither routing nor Pod authorization.

`PortConnection` frames calls, replies and cancellation with unique request IDs.
Pending/outstanding work is bounded, requests expire, and disconnect rejects
pending work. A busy Files UI refuses another request instead of replacing the
selection the user is considering. Capability invocations are not replayed on
reconnect. Multiple allowed live providers produce an ambiguity error.

Launcher validates a returned HTTP(S) URL before changing its resource draft.
Cancellation preserves the previous field. Files owns picker UI, selection and
its existing data policy. SimplyFlow renders content; no second renderer is
introduced. Test cross-origin routing, cancellation, provider loss, denied reads,
source/origin/instance checks and per-instance grants. The browser proof uses
fixture data; see [setup and evidence limits](../broker/README.md).
