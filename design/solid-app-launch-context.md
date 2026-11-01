# Solid Apps launch context

Status: experimental contract, first Launcher-to-Profile implementation.
Governing plan: [capability-broker roadmap](solid-capability-broker-roadmap.md),
Phase 0. The convention described here was established for this suite; it was
not found as an implemented interface in the inspected earlier prototype.

## URL contract

By default, the application URL fragment carries URL-encoded parameters.
Server-side applications can explicitly select the HTTP query instead:

| Parameter | Meaning |
| --- | --- |
| `webid` | The current WebID for identified launches; omitted for anonymous links. |
| `resource` | An explicitly specified Pod file's full HTTP(S) URL, including any fragment. Otherwise omitted. |

For example, the decoded resource `https://pod.example/contacts.ttl#alice`
is kept separate from `https://alice.example/profile/card#me` as account context.
Encode both values with `URLSearchParams`; never concatenate unescaped URLs.

### Optional application fragment

An application can retain its own fragment before a literal `?`:

```text
https://apps.example/profile/#foo?webid=ENCODED_WEBID&resource=ENCODED_RESOURCE
```

Only the suffix after the first **literal, unencoded** question mark is parsed
as launch parameters. The prefix is opaque app state: it is neither decoded
nor interpreted as parameters. An encoded `%3F` does not delimit the suffix.
Question marks inside URL values must be encoded by `URLSearchParams`.

After successful parsing, the opted-in receiver replaces its current history
entry with `https://apps.example/profile/#foo`. It keeps the decoded context
in memory for startup. This neither adds a history entry nor reloads the page,
and existing `history.state` is preserved. An empty prefix leaves no fragment.
The whole suffix is consumed, including unrecognized keys. Invalid launch
parameters leave the original address intact and display an error.

The legacy form without a literal question mark is parsed as before, and its
address is left unchanged. After a prefixed launch is consumed, changing an
ordinary application anchor does not discard or reapply the in-memory launch.
Reloading the cleaned URL does not replay its consumed launch parameters.

### Application defaults and user overrides

The effective parameter location is resolved in this order:

1. A user's explicit override for that application.
2. The location declared in the application description.
3. `fragment` when neither setting is present.

Launcher defaults to **Follow application**, both when adding a shortcut and
when displaying existing ones. Users can choose **URL fragment (#)** or
**URL query (?)** for each shortcut, then return to Follow application. Returning
clears the override without changing the application's declaration.

In the existing native launcher RDF, an app description can declare its mode:

```turtle
@prefix schema: <https://schema.org/> .
@prefix apps: <https://vocab.muze.nl/solid-apps#> .

<#serverApp> a schema:SoftwareApplication ;
    schema:name "Server-side app" ;
    schema:url <https://server.example/app> ;
    apps:launchParameterLocation "query" .
```

User overrides are separate `apps:launchParameterLocationOverride` literals
on the saved application record. Both predicates accept the plain literal
`"fragment"` or `"query"`. They are experimental suite vocabulary, not a
published interoperability standard. The default comes from descriptions
already present in the launcher collection; fetching publisher descriptions
and registry discovery remain later roadmap work.

With query mode the outgoing link uses `?webid=...&resource=...`; these values
reach the destination's server. The UI makes this consequence visible. The
builder preserves unrelated query parameters and the application's fragment.
When changing modes it removes stale reserved parameters from the inactive
location rather than sending conflicting old and new context.

For identified launches, Launcher supplies its current WebID when connected,
even if a saved URL named an earlier account. Resource URLs are read from either
existing
location and moved intact into the selected one. Conflicting resources in both
locations are rejected. An explicit query in the saved URL does not override
the declared mode or the `fragment` fallback.

Unsupported or structured selected settings produce a visible error instead
of a fallback. A valid user override may supersede an unsupported app default
without modifying it. Unsupported existing user overrides cannot be flattened
through this editor. Unknown RDF, app declarations and other subjects survive
supported edits. The override is explicitly configured as a single-valued
replica setting so that clearing it survives sync.

### Anonymous saved links

**Launch anonymously (omit WebID)** is saved on each launch link, not on the
application globally. Two links to the same application can therefore use
different identity choices. Select it while adding a shortcut or change its
checkbox later; it follows the existing local-save and explicit Solid-sync policy.

The per-link setting is the experimental suite predicate
`apps:anonymousLaunch`, as an RDF boolean literal. Absence means false. Unchecking
removes the setting; its scalar replica policy ensures removal survives sync.
It is independent of the app's parameter mode and the user's mode override.
Unsupported structured or multiple settings cannot be flattened by the editor.

Anonymous URLs have no `webid` parameter in either the query or recognized
launch fragment, including any old saved WebID. They include `resource` only
when explicitly specified in the link URL or resource input. Fragment/query
precedence still applies and unrelated application state is preserved. No empty
identity/resource fields or anonymity token are added. These links work while
Launcher is connected or logged out. The immediate Profile launch form also
offers anonymity and accepts an optional resource.

This is anonymity of the launch context, not a logout or an isolated browser
session. A receiving app may retain cookies, credentials or a remembered account.
Suite Profile normally restores its remembered account when no launch WebID is
supplied; this option does not change that standalone behavior.

An independent implementation can construct the same link using browser APIs:

```javascript
const target = new URL('https://apps.example/profile/');
target.hash = new URLSearchParams({
  webid: currentWebId,
  resource: 'https://pod.example/contacts.ttl#alice'
}).toString();
window.open(target.href, '_blank', 'noopener');
```

Every ordinary launch requests a new app tab by default, with no reusable target
name. **Preferences → Open apps in** can select new windows instead, adding the
`popup` window feature. This suite-wide user setting is saved as the plain
literal `apps:launchTarget` (`"tab"` or `"window"`) in the linked preferences
document, separately from per-shortcut identity and parameter mode. An absent
setting defaults to `"tab"`; Launcher uses the loaded preference at each launch.
Launcher stays open. `noopener` keeps the new target independent of Launcher;
later broker communication uses explicit connections. Browser settings may
control tab presentation or block launches, so the open call runs directly
within the user's launch gesture, before any awaited network work.

The shared suite helpers are exported from
`@muze-labs/solid-app-data/launch.mjs`: `launchUrl(applicationUrl, context)` and
`readLaunchContext(applicationUrl)`. `parseLaunchUrl(applicationUrl)` returns
`{ context, url }`, where `url` is the remaining application URL after consuming
an optional fragment-query suffix. Both readers are pure; the receiving shell
applies the history replacement. They remain app-composition helpers; other
apps need only implement the URL contract, not adopt this library stack.

For query generation, pass `parameterLocation: 'query'` in the context given
to `launchUrl()`. The readers accept the same option in their second argument
to read query parameters explicitly. Query reads do not clean the address;
server apps control their own request handling. Suite Profile continues to opt
into fragment context only.
For anonymous generation, omit `webId` or pass the empty string. With no
resource supplied, `launchUrl(applicationUrl)` removes saved reserved identity
and resource fields while retaining ordinary application state.

## Validation and optional context

- Both URL values must be absolute HTTP(S) URLs without username/password
  credentials. Preserve their own queries, percent encoding and fragments.
- Duplicate, empty or invalid recognized fields are errors. The receiver must
  not fetch a resource from an invalid context.
- An unrelated fragment is ordinary app state. The builder preserves it by
  appending `?` and the encoded launch parameters. An existing fragment-query
  prefix is preserved when updating launch parameters.
- A WebID-only link may select connection context without selecting a resource.
- A resource-only link can open a public profile without a supplied WebID.
- Identified resource launches require Launcher's current connected WebID;
  explicitly anonymous links do not.
- Identified connected Launcher shortcuts are rendered with the current WebID in the
  effective location, without changing their saved URL or app declaration.
  Saved resource/account contexts require a connection when no current WebID
  is available; links with no saved context can still open standalone.

## Profile behavior

Profile reads context before startup and waits for background session setup
before opening the resource. Background setup cannot open an authentication
popup. Explicit WebID/connection remains available when sign-in is needed.
The launch WebID is not automatically saved as the remembered account.

If the receiver remembers a different account, it requests explicit connection
before opening the resource; it does not silently replace that account. After
an explicit matching connection, it retries the pending launch.

Profile fetches the document without its fragment and selects the exact subject
identified by the complete resource URL. For a URL without a fragment, the
requested subject is the document URL itself. It does not guess a primary person
in an arbitrary graph. Missing subjects and denied reads produce visible errors.

Opening a resource does not write the resource, change preferences, or grant
editing rights. Existing rules restrict remote profile editing to the connected
WebID and server authorization remains authoritative. A different selected
person remains read-only.

Changing recognized launch context in an already-open Profile window reloads
it to apply the same startup/account checks. Unrelated anchor changes that
leave decoded context unchanged do not reload it. Normal startup and existing
local `?contact=` links continue to work. A link combining a local contact with
a remote resource is ambiguous and is rejected rather than mixing the stores.

## Boundaries and verification

This is launch context, not a capability grant, broker handshake or provider
registration. Do not place credentials in it. Contacts dataset selection and
Files resource modes need their own acceptance criteria before enabling them.

Content and link attributes remain SimplyFlow bindings over HTML. The native
window-opening operation handles browser navigation only; it renders no
application content. Native history replacement consumes launch-only URL
parameters while preserving the application's fragment and history state.

`test/launch.test.mjs` covers URL preservation and rejected inputs.
`test/browser.mjs` exercises public/contextual reads, changed fragments, denied
and missing subjects, explicit account recovery, existing local contact links,
the launcher-generated URL and a separate receiving target. It checks that
launching leaves resource bytes and preferences unchanged.
It also verifies app-declared query defaults, persisted user overrides and
their removal through sync, and actual query receipt by a server-side test app.
Anonymous cases cover independent links to the same app, persistence and clearing
through sync, omission of WebID while Launcher is connected, and HTTP receipt
with an explicit resource or with neither launch field.
