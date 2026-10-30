# Muze Solid Apps

Four small browser applications using SimplyFlow, the Muze design system and the
Solid stack. This is an experimental, private npm workspace: no packages need to
be published to run it.

## Try it

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4174/>. The launcher links to Contacts, Files and Profile.
Node 20.6 or newer is required for the build; the browser integration harness uses
Node 22 or newer (native WebSocket) and `google-chrome` on PATH. Use localhost or
HTTPS so browser storage, crypto and authentication work. Deploy `www/` as static
files, preserving all four app paths and `/redirect.html`. External dependencies
come from npm; workspace links only connect packages inside this repository.

Contacts and shortcuts work locally in IndexedDB before connecting. Enter a WebID
through **Connect Solid**, then choose **Sync with Solid** in Contacts or Launcher.
The connected WebID is remembered on this origin. Background restoration does not
open a login popup; a user gesture is required when sign-in is needed.

When connected, **WebID / connection** also offers **Log out**. It clears the
current account's cached access, refresh and ID tokens and the remembered WebID.
The app reloads to discard connected clients; other open suite tabs on the same
origin disconnect too. Local contacts and shortcuts remain in IndexedDB. This is
logout from these apps; the identity provider may retain its own login session.

## Applications

| App | Working basic slice |
| --- | --- |
| Launcher | Built-in app links; add/remove personal shortcuts; local persistence and explicit Solid sync. |
| Contacts | Add sparse contacts, search, view/edit profiles, delete with tombstones, local persistence and explicit Solid sync. |
| Profile | Read a WebID profile, edit your connected profile, or edit a local contact using the same component as Contacts. |
| Files | Browse folders, create folders, upload/download binary files, and mark resources deleted through link metadata. |

Contact fields include name, emails, phone numbers, websites, public-profile link
and notes. Names and WebIDs are optional. Editing a private contact does not edit
that person's public profile. Remote profile editing is offered only for your
connected WebID; server authorization remains authoritative. Structured vCard
values are displayed and preserved but cannot yet be edited.

## Shared preferences

Every app opens the same preferences dialog. It loads the URL linked by
`pim:preferencesFile` on the connected WebID; it never guesses a preferences path.
An absent resource may be created at that linked URL. If the profile has no link,
the dialog explains the missing prerequisite; profile-link creation is not part
of this first version.

Settings cover system/light/dark appearance, text size, density, preferred
language, and Contacts/Launcher/Files storage locations. Language is stored and
applied as the document language; the interface currently remains English.
Changing a storage location does not migrate existing data.

The app writes its settings on `<preferences-document#solid-apps>`, using
`https://vocab.muze.nl/solid-apps#` as an **application vocabulary**, not a published
interoperability standard. Storage locations are IRIs. Other settings are literals.
Unknown RDF in the preferences file is preserved. Existing resources require an
ETag and conditional writes; a conflict must be resolved by reloading and reviewing.

Default Contacts and Launcher resources are `apps/solid-apps/contacts.ttl` and
`apps/solid-apps/launcher.ttl` under the first advertised storage root. Files uses
that root unless overridden. Set explicit locations when your Pod has a different
layout. Local address books/shortcuts belong to this browser origin; switching
WebIDs does not create separate local stores or automatically migrate their data.

## Boundaries

| Workspace package | Responsibility |
| --- | --- |
| `solid-profile` | Native RDF profile reads/edits, shared SimplyFlow view/editor. No persistence policy. |
| `solid-preferences` | Linked preferences RDF, validation, document appearance, shared SimplyFlow dialog. |
| `solid-app-data` | This suite's Solid/RDF composition, conditional document writes, local collections, authentication and link metadata bridge. |
| `solid-app-ui` | Shared account dropdown, connection, status and preference wiring, design-system styles. |
| `apps/*` | Each application's commands, storage choices and HTML templates. |

These are experimental workspace packages, not commitments to new general-purpose
stack libraries. Models keep native OLDM graphs authoritative; views use small
projections and drafts. Saving preserves facts the app does not understand.
The build selects oldm-turtle for this suite without changing the shared OLDM
default, and rejects bundles containing N3. Readable bundles and source maps are
included; all dynamic content rendering uses SimplyFlow. Shared HTML is composed
at build time, with no extra runtime template engine.

Native DOM calls handle dialog/popover opening/closing, focus, form reset and file
selection, browser downloads, and document-wide appearance/language. Content,
list items, visibility and button state are SimplyFlow bindings.

The adopted engineering and stewardship rules, with their source links, are in
[AGENTS.md](AGENTS.md). We favor inspectable code, replaceable boundaries, open
RDF, and app-specific choices kept high in the stack. The root lockfile belongs
to the runnable app suite, not a separately released library.

## Deletion and current limits

Contacts and shortcut deletion use Solid Workspace tombstones. File deletion
writes `lm:deleted` using the [PDS Interop link metadata vocabulary](https://pdsinterop.org/solid-link-metadata/)
to the parent container's advertised description resource. If that resource is
not advertised, deletion fails explicitly. File contents remain on the server;
this is soft deletion, not storage reclamation. Visibility outside these apps
depends on other clients/servers honoring the metadata.

Moves/renames, physical cleanup, permissions/sharing editors, recursive operations,
redirect-chain traversal, app provisioning and translated interfaces are follow-up
work. The launcher is a link catalogue; it does not yet provision permissions or
type indexes. Large file uploads are sequential and never overwrite an existing
resource; a partial upload reports how many files succeeded.

Authentication uses the published Metro OIDC popup flow. The integration test uses
an isolated mock Pod; live-provider sign-in still needs a manual test in this suite.

## Verification

```sh
npm run check
npm run test:browser
```

Unit tests cover sparse profiles, multiple values and unknown RDF preservation,
structured-edit rejection, linked preferences, conditional writes and deletion
metadata. The browser test starts its own app and mock-Pod servers, exercises all
four apps, reload persistence, shared profile editing, preferences across apps,
synchronization, binary upload and tombstones. It also checks text escaping and
captures desktop/mobile views in `/tmp/solid-apps-review/`.

## Shared appearance

All four apps follow the original `poef/solid-apps` Contacts styling: blue accent,
square controls, panel spacing and the compact account dropdown. The shared menu
contains WebID/connection and Preferences. Each application has its own toolbar;
only Launcher links to the other applications. Contacts shows profiles inline.
