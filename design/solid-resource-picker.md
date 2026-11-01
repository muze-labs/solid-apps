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

## Provisioning and authority

The self-hosted broker has a private JSON configuration listing clients with
`application`, `workspace`, exact `origin`, and a random `key` of at least 32
characters. Explicit routes name requester application, provider application
and capability URI within a workspace. An app cannot choose its identity or
workspace through a message. Provisioning is manual for this proof; it is not
the future provider registry. There is no public registration or wildcard CORS.

Each app's shared connection panel reads the broker URL from linked Solid
preferences (`apps:brokerUrl`) and accepts its own connection key. Keys are used
only in memory, cleared from the form, and never saved in the Pod, launch URL
or browser storage. The broker issues a random connection credential. It checks
that credential and the configured exact Origin on every operation. Configure
distinct keys per application. Multiple connections advertising the same routed
provider are an explicit ambiguity error, not an arbitrary choice.

This authenticates a provisioned broker principal, not a browser-supplied WebID.
The operator associates applications with a workspace. Solid authentication and
Pod authorization remain in each app; the broker receives neither Pod tokens
nor read/write authority. Use HTTPS outside loopback; the Node HTTP service
binds to loopback behind an operator-configured HTTPS proxy. Allowed origins
do not defend against compromise of an app already authorized for that route.

## Transport and lifecycle

Use ordinary HTTPS JSON requests with long polling for connection events.
This avoids reliance on third-party iframe storage, cookies or opener access,
and adds no transport dependency. The client owns connection lifecycle and
pending promises; the service owns routing and pending request settlement.

- `POST /connect`: provisioning key in Authorization; returns connection ID,
  connection token and configured identity.
- `POST /connections/{id}/register`: advertise capability URIs allowed by routes.
- `GET /connections/{id}/events`: private event queue, one outstanding poll.
- `POST /connections/{id}/request`: request ID, capability and input.
- `POST /connections/{id}/respond`: request ID and result or error.
- `POST /connections/{id}/cancel`: requester cancellation.
- `DELETE /connections/{id}`: explicit disconnect.

All connection endpoints require the issued bearer token. Requests are bounded
in size and count, time out, and settle once. Disconnect and expired leases
clear pending work. The service routes generic capability URIs and opaque
payloads; it has no browse-specific branches. Cancellation notifies the
provider and leaves the caller's field unchanged. A busy Files UI refuses
another request rather than replacing the one the user is considering.
There is no automatic reconnection/replay of a capability invocation.

## App integration and verification

The app-specific integration stays in this repository. A renderer-independent
client implements the transport; a shared SimplyFlow panel exposes connection
state. Launcher requests selection and can cancel. Files displays the verified
requester identity and adds explicit Select controls without changing ordinary
open/download behavior. The broker URL extends existing linked preferences;
unsupported RDF values are refused rather than flattened.

Verify with real HTTP and Chrome on distinct app origins: selection into the
field, cancellation, no Pod writes/downloads, denied Pod reads, provider loss,
unauthorized origin/key/route/result, ambiguity and timeout. Test the full
existing suite, inspect mobile picker UI and measure the gzip budget including
the shared import graph. The browser uses fixture data, not a user's Pod.
