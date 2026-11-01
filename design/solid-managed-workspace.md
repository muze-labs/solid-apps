# Launcher-managed browser workspace

**Persistence encoding requires correction.** The maintainer's
[native Turtle rule](../.spiral/sources/SRC-20261101-QG24H-17.md) unconditionally
forbids JSON in main-state Turtle strings, with only a narrow experimental
app-owned opaque field permitted. The JSON-literal persistence described below is
current implementation evidence, not an approved design. Replace it with native
RDF for both Pod state and local caches/baselines; preserve existing data during
that correction. The maintainer accepted the cycle while retaining
[DEF18](../.spiral/defects/DEF-20261101-QG24H-18.md) as Open; that acceptance does
not resolve the native RDF correction.

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

## Checkpoint readiness and reconnect correction

Registration identifies a channel; readiness follows successful restoration.
Show Restoring or a restoration error until then. A checkpoint during restoration
fails with that app's name rather than waiting on Pod reads. Ready apps have a
bounded ten-second checkpoint deadline. Report each failed instance, preserve
last stored state and successful sibling checkpoints, and leave apps open.
Timeout/disconnect triggers channel recovery; saving still requires a fresh
successful checkpoint on retry and never silently uses a stale snapshot.

A child explicitly requests reconnection when its local port is closed, including
pagehide followed by a retained page's resume. Reconnecting the same instance in
the same JS realm reuses its restoration task and live UI instead of replaying
old saved state over drafts. A new realm still restores from its saved snapshot.
Stale channel tasks cannot publish readiness/state into a replacement channel.
This corrects FBK-20261101-QG24H-13 within the existing cycle.

## Write acknowledgement versus next-write validation

A successful conditional PUT acknowledges that checkpoint even when its response
has no ETag. Clear the old validator and prepared body, and persist the accepted
snapshot baseline locally. Do not fail the completed save merely because a future
write cannot yet be prepared. Before another explicit write, reload the native
Pod document to obtain a fresh validator. If its snapshot still equals the
acknowledged baseline, retain pending local edits without a false conflict;
changed remote snapshots still require conflict review. Fresh native RDF remains
the base for preserving unknown terms. Baseline identity is scoped to the target.

A GET genuinely lacking an exposed ETag still prevents updating that existing
resource. A 401 is never parsed as workspace data. No pre-write ETag is reused,
no unconditional replacement is introduced, and ordinary-close attempts require
an already-prepared validator. This corrects FBK-20261101-QG24H-15.

## File-picker activation and bounded on-demand startup

Following FBK20, Choose in Files reuses one eligible, allowed live provider and
focuses its WindowProxy synchronously from the user's click. If no live provider
is available, reuse a saved built-in Files instance or open the suite's built-in
Files URL with current launch context and its existing built-in browse grant.
Never silently re-enable a denied existing instance. Multiple matching instances
require an explicit user choice through the existing grants rather than ranking.

Opening occurs before awaiting network/registration so popup policy is respected.
Wait for the chosen instance's verified readiness, with cancellation, restoration
failure, closed/blocked window and a bounded 30-second startup timeout. Bind the
invocation to that instance, rechecking capability and route permission. Display
opening/waiting/error state through SimplyFlow. Selection or provider cancellation
requests focus on the captured Launcher opener within that user's action; browser
focus restrictions retain manual-switch guidance as a fallback.

This advances the existing cycle with built-in Files startup, not a durable
provider registry, remote catalog discovery or arbitrary provider installation.
DEF18 and the native RDF rule remain unchanged. Focus/startup verification uses
protocol fixtures without invoking the noncompliant persistence encoder.
