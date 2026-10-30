# Solid Apps shell

Experimental suite UI using SimplyFlow and `@muze-nl/theds`.

Compose `src/shell.html` with app content and the shared preferences dialog at
build time. `shell()` binds its header and preferences scopes and returns the app
content container, session/settings access, status reporting, and operation runner.
The application mounts its own SimplyFlow scope inside `host.main`.

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
