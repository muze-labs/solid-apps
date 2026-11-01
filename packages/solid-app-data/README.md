# Solid Apps data composition

Experimental application integration package. This is the suite's composition
of published Solid libraries, not a new persistence framework.

`capabilities.mjs` exposes renderer-independent `ManagedApp`, `PortConnection`
and the browse capability contract. `ManagedApp` connects to its Launcher opener,
registers capabilities, publishes `getState()` JSON and calls `restoreState(state)`.
Providers receive `onRequest(event)`, answer with `respond(event.id, { result })`
or `{ error: { code, message } }`, and clear selection UI through `onCancel`.
Validate returned URLs with `selectionUrl`. Calls have cancellation, timeout and
disconnect handling; invocations are not replayed on reconnect. A new client
registers with `restoring: true`, then publishes state and sends `ready` after
restoration. `restore-error` reports setup failure. Closed-port resumes explicitly
request reconnection; same-instance reconnection reuses live state/restoration
rather than resetting UI drafts. Stale channel tasks cannot publish into a new
channel. Launcher checkpoints ready apps with a ten-second deadline, reports
failures per app and never closes apps using a silently substituted cached state.

`workspace-broker.mjs` owns browser windows, instance identity, private ports and
explicit route policy. `whenReady(id, { signal, timeout })` waits for a verified
ready instance and reports cancellation, blocked/closed windows and setup errors.
`request(..., { providerId })` can bind an invocation to that selected instance
while still checking route permission. Requesting asks the provider window for
focus; responding asks the opener for focus. Browser policy can refuse either.
Launcher-specific built-in Files discovery/startup stays in its `picker.mjs`. `workspace-state.mjs` uses the published Solid Workspace
IndexedDB source for local state and native RDF for conditional Pod checkpoints.
A successful workspace PUT can omit its ETag. That checkpoint stays acknowledged;
its old validator is discarded. A later explicit write refreshes the native
resource/validator, comparing its snapshot with the target-scoped acknowledged
baseline to distinguish pending local edits from concurrent remote edits.
Validator refresh for a write preserves the caller's snapshot rather than
silently adopting a different remote workspace. Closure requires an already
prepared valid conditional body. Live updates do not write the Pod. `reviewConflict(session, url)` loads the
current native Pod document; `resolveConflict(session, url, 'local' | 'pod')`
requires that review. Keeping local prepares a conditional save against the
reviewed ETag; using Pod changes the local snapshot without a PUT. A subsequent
412 revokes the review. Remote preparation errors do not poison local updates. Credentials and reconnect keys are excluded
from public snapshots. See the [workspace guide](../../broker/README.md) and
[design](../../design/solid-managed-workspace.md). These are experimental suite
interfaces; capability routing grants no Solid authorization.

- Root export: native `oldm` context with the Turtle backend, shared vocabulary
  prefixes, URI helpers, conditional `loadDocument`/`copyDocument`/`saveDocument`,
  and `connectSession` for WebID discovery and the Metro authentication lifecycle.
- `collection.mjs`: `openCollection(name, options)` opens an IndexedDB-backed
  SimplySolid resource. `connect(session, url)` connects and synchronizes it.
  The returned `collection` is the published library API, not a second model.
- `link-metadata.mjs`: discovers the parent container description from HTTP Link
  headers and writes conditional `lm:deleted` metadata. It never physically
  deletes resource bytes. Missing descriptions and conflicts are failures.
- `launch.mjs`: validates and reads launch fragments, and builds application
  URLs carrying the current WebID and a full resource URL. Nested resource
  fragments survive. `parseLaunchUrl()` also returns the remaining URL for the
  optional `#app-fragment?parameters` form; `%3F` is not a separator. The codec
  is pure; receivers apply any address cleanup. URL context grants no authority.
  Pass `parameterLocation: 'query'` to the builder context or reader options
  for explicit server-side query support; the default remains `fragment`.
  Omit `webId` for anonymous generation. Reserved WebIDs are removed from both
  locations; `resource` is emitted only if supplied.
  See the suite's
  `design/solid-app-launch-context.md` contract for independent consumers.

`saveDocument` rejects existing documents without an ETag and uses If-Match;
new documents use If-None-Match. It returns the new ETag when supplied; callers
must reload before another edit when that response omits its validator. A failed write does not
imply rollback of a server-side change; reload before retrying an uncertain result.

`session.perform(operation, { interactive })` owns the authentication popup for
an operation, closing it afterward. Interactive operations must start from a
user gesture. Background operations pass `interactive:false` and never open one.
See the suite README for known scope and manual sign-in verification still needed.

`session.logout()` disables that session/client, closes its reserved popup and
clears the account's OAuth2/ID-token values through Metro's public stores. It
preserves issuer discovery/client registration, other accounts and user data.
This bridge uses the issuer + WebID scope of the published Metro-OIDC version.
It does not revoke tokens or end the provider's own login session. The owning UI
removes its remembered WebID and reloads to discard connected resource handles.
