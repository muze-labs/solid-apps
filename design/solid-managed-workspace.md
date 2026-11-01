# Launcher-managed browser workspace

Confirmed revision of the resource-picker cycle, 2026-11-01. This replaces the
server relay for managed sessions; the earlier proof remains in Git history.

Launcher is a top-level coordinator. It opens fresh app instances with ordinary
opener relationships and retains their WindowProxy handles. Each instance has
a stable restoration ID. Launcher sends an origin-targeted offer with a private
MessagePort; receivers require `event.source === window.opener`. Launcher checks
the saved app origin and the exact window before accepting registration. Local
reconnection credentials are scoped to an instance and never included in Pod
exports or launch URLs. Reloaded children and Launcher can reconnect. No shared
third-party storage, network relay or service-worker singleton is required.

Capability URIs and browse/result semantics stay as documented in the earlier
picker contract. Only Launcher-controlled connections advertising a capability
can receive a request. The root mediates each routed request; apps cannot inspect
other instances' state or event queues. Results belong to the selected provider
and pending caller. Cancellation, disconnect, ambiguity, timeout and busy state
remain explicit. No capability conveys Pod authorization.

Apps publish JSON-serializable UI/restoration state and accept restored state.
Files demonstrates folder restoration; Profile demonstrates subject restoration;
Contacts demonstrates selected contact/search restoration. Profile/Contacts
also restore open field-edit drafts without applying them to native RDF.
Temporary dialogs and in-flight operations are not restored. Documents and native
RDF remain authoritative in the apps' existing storage. Tokens, clients, DOM
objects, WindowProxy handles and ports are not serialized. Ordinary third-party
links can still open and be tracked, but app-specific restoration requires the
protocol. The browser may sever handles for incompatible COOP policies.

Local workspace state uses the published Solid Workspace IndexedDB source, with
one account-scoped record containing the desired app set, UI state and private
local reconnect data. There is one default workspace in this slice; multiple
named workspaces remain planned. Reloaded Launcher first allows children to
reconnect, then attempts restoration. Popup blocking is visible, with explicit
Restore controls. Individually closed apps leave the desired set; workspace
shutdown preserves it for reopening. Cooperating children monitor the managed
opener's `closed` flag, allowing shutdown even if parent unload cleanup is lost.

Pod storage is a conditional Turtle document from `workspaceResource` in the
existing linked preferences, defaulting to `apps/solid-apps/workspace.ttl` below
the advertised storage root. One `apps:snapshot` RDF JSON literal stores public
restoration state on `<document#workspace>`. Unknown triples, identities and
other subjects are preserved. Unsupported structured/multiple snapshot values
fail before writing. The account and remote resource must match the prepared
target. Loading a remote snapshot does not overwrite pending local changes.

Live state updates write locally and prepare serialized Turtle; they do not PUT
to the Pod. Explicit Save/Save & close checkpoints connected apps, flushes local
state, and waits for a conditional Pod write. Failed saves preserve local state
and leave apps open. Close locally remains possible. On normal tab closure,
Launcher attempts an already-prepared conditional PUT with `keepalive` through
Metro and noninteractive authentication. No login popup is permitted there.
This is best effort, subject to browser lifecycle, authentication and keepalive
size limits. Merely dispatching it is never recorded as confirmed Pod success.

Verify real cross-origin opener/port routing, wrong source/origin/instance,
state acknowledgement, ordinary reload, parent/child closure and restoration.
Use a fixture Pod to test explicit save, close-time PUT receipt, conditional
conflict, denied/offline writes, unknown RDF and fresh-browser restoration.
Record observed tab-close behavior separately from explicit acknowledged saves;
do not generalize one Chrome result to crashes, mobile or all Solid providers.

## Conflict recovery correction

A conflict is a recoverable state, not a permanent refusal. Save operations show
progress and failures beside their controls and retain the last result across
reload. Known local preconditions, including conflicts, are checked before
reserving an authentication window. Local restoration starts even if a Pod read
or preparation fails.

Review fetches the current Pod document and presents both public snapshots.
Only after review may the user explicitly keep local state and conditionally
save against that document's ETag, or use the Pod state and replace/reopen the
managed session. A further 412 revokes the review and requires another review;
there is no unconditional overwrite. Unknown RDF is preserved from the reviewed
native document. Using Pod state does not save app data or profile drafts.
Local cache persistence remains usable when remote serialization/preparation
fails. These corrections follow FBK-20261101-QG24H-11 in the same Active cycle.
