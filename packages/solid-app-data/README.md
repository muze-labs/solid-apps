# Solid Apps data composition

Experimental application integration package. This is the suite's composition
of published Solid libraries, not a new persistence framework.

- Root export: native `oldm` context with the Turtle backend, shared vocabulary
  prefixes, URI helpers, conditional `loadDocument`/`copyDocument`/`saveDocument`,
  and `connectSession` for WebID discovery and the Metro authentication lifecycle.
- `collection.mjs`: `openCollection(name, options)` opens an IndexedDB-backed
  SimplySolid resource. `connect(session, url)` connects and synchronizes it.
  The returned `collection` is the published library API, not a second model.
- `link-metadata.mjs`: discovers the parent container description from HTTP Link
  headers and writes conditional `lm:deleted` metadata. It never physically
  deletes resource bytes. Missing descriptions and conflicts are failures.

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
