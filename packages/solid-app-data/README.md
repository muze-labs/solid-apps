# Solid Apps data composition

Experimental application integration package. This is the suite's composition
of published Solid libraries, not a new persistence framework.

`capabilities.mjs` provides the initial renderer-independent `CapabilityClient`
and the browse capability contract. Connect with a provisioned app key, then
`request(browseCapability, browseInput, { signal })`; validate the result with
`selectionUrl(result)`. Providers advertise `capabilities` in constructor
options, receive `onRequest(event)` and answer with `respond(event.id, { result })`
or `{ error: { code, message } }`. `onCancel` clears provider UI and
`disconnect()` rejects pending work. No invocation is automatically replayed.
See the [protocol](../../design/solid-resource-picker.md) and
[broker setup](../../broker/README.md). These are experimental suite interfaces,
not independently published packages or Solid authorization grants.

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
new documents use If-None-Match. It returns the new ETag. A failed write does not
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
