# Shared Solid preferences

Experimental `@muze-labs/solid-preferences`, used by all four apps.

`loadPreferences(session)` returns `{ document, settings }` using
`session.preferencesUrl`, discovered from `pim:preferencesFile` on the WebID.
`savePreferences(session, document, settings)` returns the same shape after a
conditional write. Retain the returned document/ETag for the next save. The session
supplies a Metro client; unknown RDF survives edits. Missing links, missing ETags,
validation errors and remote conflicts are explicit errors.

`defaults`, `readPreferences`, `validatePreferences` and `applyPreferences` are
also exported. Appearance application is separate from persistence.

`launchTarget` is a plain literal, `"tab"` (the default) or `"window"`, on the
suite's preferences subject using `apps:launchTarget`. The shared dialog offers
**Open apps in**; Launcher uses it for app links and its Profile resource form.
The choice is saved with the other Pod preferences. Unsupported structured,
multiple or unknown values are rejected before writing rather than flattened.

Compose `src/dialog.html` into the page, then mount once:

```js
import { preferencesDialog } from '@muze-labs/solid-preferences/dialog.mjs';
const preferences = preferencesDialog(dialogElement, {
  getSession: () => session,
  onChange: settings => { /* react to changed app settings */ }
});
await preferences.load(session);
preferences.show();
```

`reset()` discards the loaded document and restores defaults; `destroy()` removes
bindings and closes the native dialog. All content/field/button rendering uses
SimplyFlow. The vocabulary and current English-only interface are documented in
the root README.
