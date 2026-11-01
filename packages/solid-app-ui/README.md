# Solid Apps shell

Experimental suite UI using SimplyFlow and `@muze-nl/theds`.

Compose `src/shell.html` with app content and the shared preferences dialog at
build time. `shell()` binds its header and preferences scopes and returns the app
content container, session/settings access, status reporting, and operation runner.
The application mounts its own SimplyFlow scope inside `host.main`.

Launcher and Files also compose `src/capabilities.html` and mount
`appServices(host, options)` from `capabilities.mjs`. It owns the SimplyFlow
connection panel, reads the Pod-backed `brokerUrl` preference and clears the
entered app key after use. The returned `client` getter requires an active
connection. Page exit or a changed broker preference disconnects; keys and
connection tokens are never persisted. This panel uses `host.onPreferences`;
future consumers needing another listener should compose their callbacks.

`shell({ acceptLaunch: true })` opts a receiving app into validated launch
context, available as `host.launch`; `host.launchError` describes invalid
input. `host.ready` settles after background session restoration and the
initial `onConnect` callback. Profile uses this to open its launch resource
after session setup. Other apps retain their ordinary startup until their
resource semantics are implemented. Background setup never opens a login popup
or silently replaces a different remembered account. Changing recognized
launch context reloads the opted-in app to repeat those checks.
For `#app-fragment?launch-parameters`, startup consumes only the suffix and
uses `history.replaceState` to retain `#app-fragment`, the current entry and
its existing state. The decoded launch remains in memory; ordinary anchor
changes after consumption do not trigger a reload.

`host.onConnect` attaches app-specific behavior to a connected session;
`host.onPreferences` receives changed settings. `host.run(operation, {network})`
reports operation failures to the shared status area. `host.resource(name)`
resolves a Contacts/Launcher location; `host.requireSession()` explains missing
connections. These are suite choices, not intended as general framework APIs.

Runtime content is rendered only through SimplyFlow. Native dialog/popover lifecycle,
focus, browser downloads and document appearance remain browser operations.

The original Contacts app supplies the visual reference. The compact account
popover contains WebID/connection and Preferences. App titles and toolbars identify
each app; cross-app navigation belongs exclusively to Launcher. Native popovers
provide keyboard focus, Escape and outside-click dismissal.

The connected profile's name appears to the left of the account button. The
shared profile reader handles FOAF, vCard and schema.org names. Profiles without
a name show “Connected”; the dropdown itself contains only its two actions.

The connected account's WebID dialog includes Log out. Logging out clears session
credentials and the remembered WebID, then reloads to discard connected handles.
A storage event disconnects other suite tabs on the same origin. Local data stays
in IndexedDB; the logout control is hidden before a connection is established.
