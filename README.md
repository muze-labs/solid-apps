# Muze Solid Apps

Four small browser applications using SimplyFlow, the Muze design system and the
Solid stack. This is an experimental, private npm workspace: no packages need to
be published to run it.

See the [Solid Apps roadmap](design/solid-apps-roadmap.md) for planned apps,
mobile/local-first and PWA requirements, account improvements and decentralized
app catalogs. These are future direction, not current feature claims.

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

Launcher manages apps opened through it, checkpoints their restoration state
locally, and can save that default workspace to your Pod. **Save & close** waits
for a confirmed save; the browser close button attempts a best-effort save.
Reopening restores the saved app set, subject to popup permission. See the
[workspace guide](broker/README.md) for setup and limitations. Creating multiple
named workspaces remains [planned](design/solid-capability-broker-roadmap.md#retained-roadmap-item--pod-synced-workspaces).
Shortcut collection sync is separate.

When connected, **WebID / connection** also offers **Log out**. It clears the
current account's cached access, refresh and ID tokens and the remembered WebID.
The app reloads to discard connected clients; other open suite tabs on the same
origin disconnect too. Local contacts and shortcuts remain in IndexedDB. This is
logout from these apps; the identity provider may retain its own login session.

## Applications

| App | Working basic slice |
| --- | --- |
| Launcher | Shortcuts and explicit Solid sync; browser-local capability routing; app lifecycle and local/Pod workspace checkpoints. |
| Contacts | Add sparse contacts, search, view/edit profiles, delete with tombstones, local persistence and explicit Solid sync. |
| Profile | Read a WebID profile, edit your connected profile, or edit a local contact using the same component as Contacts. |
| Files | Browse folders, create folders, upload/download binary files, and mark resources deleted through link metadata. |

Contact fields include name, emails, phone numbers, websites, public-profile link
and notes. Names and WebIDs are optional. Editing a private contact does not edit
that person's public profile. Remote profile editing is offered only for your
connected WebID; server authorization remains authoritative. Structured vCard
values are displayed and preserved but cannot yet be edited.

## Launch a profile resource

In Launcher, enter a full resource URL under **Open a profile resource**, then
choose **Open in Profile**. Connect to Solid unless selecting anonymous launch.
A fresh Profile tab (or window, if selected in Preferences)
opens the requested subject, including a fragment such as `contacts.ttl#alice`.
Launcher supplies its current WebID for identified launches and remains open.
Allow new tabs if your browser blocks the launch.

Profile reports inaccessible resources or missing subjects. Opening a resource
does not save changes or change preferences. A launch link names account
context; it does not grant access. If a different account is remembered, use
**WebID / connection** to connect explicitly before opening the resource.

The [launch-context contract](design/solid-app-launch-context.md) documents how
independent apps can construct compatible links using their own libraries.
This resource-opening slice supports Profile; launch-resource handling for
Contacts and Files remains later work.

Each shortcut has a **Launch mode** choice. **Follow application** uses the
mode declared in its RDF description, falling back to URL fragments when none
is set. You can override it with **URL query (?)** for a server-side app or
**URL fragment (#)**, then return to Follow application. Query mode sends your
WebID and resource URL to the app's server; fragment mode keeps them in the
browser's launch fragment, outside that HTTP request. These declarations
currently come from the launcher collection;
remote application-description discovery is later work.

**Launch anonymously (omit WebID)** is saved separately for each shortcut,
so you can link the same app more than once with different choices. Anonymous
links contain no WebID and include a resource only when specified. They work
without connecting Launcher. The Profile launch form also offers this option
and accepts an optional resource. Omitting WebID does not sign you out of a
receiving app that already has its own session.

## Shared preferences

**Choose in Files** opens the built-in Files app on demand or focuses an allowed
existing instance, using private browser message channels. Files need not already
be open. It retains its own Solid connection. See the [workspace guide](broker/README.md)
for connection and permission steps. Selection returns a URL into Launcher's
resource field; cancellation preserves its previous value. Both apps keep their
own Solid sessions.

Every app offers common preferences plus its own storage settings: Contacts has
its address-book resource, Launcher has shortcut and workspace resources, and
Files has its root container. Profile currently has only common settings.
Saving leaves other apps' storage settings and unrelated RDF unchanged.
The dialog loads the URL linked by
`pim:preferencesFile` on the connected WebID; it never guesses a preferences path.
An absent resource may be created at that linked URL. If the profile has no link,
the dialog explains the missing prerequisite; profile-link creation is not part
of this first version.

Settings cover system/light/dark appearance, text size, density, preferred
language, app launch presentation, and Contacts/Launcher/Files/workspace storage
locations.
**Open apps in** chooses new tabs (the default) or new windows for Launcher links
and the Profile resource form. The choice is saved in your linked preferences
file and used when Launcher loads it. Browser settings can affect presentation.
Language is stored and
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
The build selects oldm-turtle for every app and the authentication callback
without changing the shared OLDM default, and rejects the build if its import
graph contains oldm-n3 or N3. They remain installed as transitive dependencies of
the upstream OLDM facade, but that facade is replaced by the suite's Turtle
composition when bundling. Readable bundles and source maps are
included; all dynamic content rendering uses SimplyFlow. Shared HTML is composed
at build time, with no extra runtime template engine.

Native DOM calls handle dialog/popover opening/closing, focus, form reset and file
selection, browser downloads, app-window navigation, and document-wide
appearance/language. Content, list items, visibility and button state are
SimplyFlow bindings.

The adopted engineering and stewardship rules, with their source links, are in
[AGENTS.md](AGENTS.md) and the [culture index](.spiral/culture.md). The
[Muze architecture philosophy](ARCHITECTURE-PHILOSOPHY.md) is included in this
repository. We favor inspectable code, replaceable boundaries, open
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
an isolated mock Pod. The maintainer reports successful manual connection and
authentication with solidcommunity.net; other provider/browser combinations
and the new launch flow still need their own live verification.

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

The harness waits for app initialization, the rendered Profile resource field,
and managed-child reconnection before dependent assertions. Page load, a profile
heading or a restored conflict alone does not establish those later states.
Earlier combined runs had intermittent readiness failures; the Profile case was
reproduced as an assertion preceding the input binding update. The workspace
wait closes an observed synchronization gap, without establishing the cause of
the earlier workspace failure. Checks use isolated fixtures, not real OIDC.

The build measures each app's JavaScript import graph plus the authentication
callback, counting shared chunks once per app. It writes `www/size-report.json`
and rejects totals of 200,000 gzip bytes or more for either output variant
(gzip level 6; source maps are excluded). The report's `apps` entries describe
minified production graphs; `readableApps` contains readable totals, and
`servedVariant` identifies which entry scripts the generated pages load. This
budget measures compressed JavaScript, not offline/PWA support.

Rollup builds two shared ES modules: `assets/shared/data.js` contains Metro,
OLDM with oldm-turtle, Solid Workspace, and shared data/session helpers;
`assets/shared/ui.js` contains SimplyFlow, SimplySolid, and shared suite views.
The UI bundle imports data; data has no UI dependency. Each app's
`assets/<app>/src/index.js` contains its own remaining code, including modules
used only by that app. The small `assets/redirect.js` authentication callback
imports data alone. The app and callback graphs reuse the same emitted modules
instead of bundling duplicate RDF or reactive runtimes.

Every build also emits matching `.min.js` modules using Rollup's Terser plugin.
Minified modules import only the minified graph. Both variants retain source
maps with original source content; function/class names and object property
names remain available for inspection. `npm run build` makes app pages and the
authentication callback load minified scripts. `npm run dev` selects readable
scripts through `npm run build -- --readable`. Both sets remain available in
`www/assets/` with either selection.

The build checks these shared-layer boundaries and writes
`www/bundle-report.json` with each bundle's modules, imports and gzip size.
Source maps include source text. Rebuilding replaces the generated assets
directory so retired chunks are not deployed alongside the current outputs.

## Shared appearance

All four apps follow the original `poef/solid-apps` Contacts styling: blue accent,
square controls, panel spacing and the compact account dropdown. The shared menu
contains WebID/connection and Preferences. Each application has its own toolbar;
only Launcher links to the other applications. Contacts shows profiles inline.

## Editable app features

Launcher, Contacts, Files and Profile now register named SimplyFlow feature
components. Each feature lives in its own `src/components/<feature>.mjs`
module in the owning app or shared package. `src/features.mjs` is the consistent
re-export index; source metadata points through it to the defining component file.
Shared account/connection, Preferences and profile editing use the
same structure. The profile editor is registered directly in the owning Contacts
or Profile app; its persistence policy stays with that app.

Inspect `launcherApp`, `contactsApp`, `filesApp` or `profileApp` in the browser.
The existing `solidLauncher`, `solidContacts`, `solidFiles` and `solidProfile`
handles remain available. Each main app exposes:

- `components`: original named SimplyFlow datasets, with templates, commands,
  actions and other entries belonging to each feature.
- `definition.sources`: authored behavior source and source-file origins,
  captured before minification. For example,
  `contactsApp.definition.sources.contactList.actions.matchesPerson`.
- `definition.modules`: readable app-owned data/launch helper modules and their
  import dependencies where those helpers form a separate API boundary.
- `definition.overrides`: app-level entry sections supplied to SimplyFlow.
  Native SimplyFlow composition selects them over component defaults.
- `definition.instances`: the account and Preferences app instances, each with
  its own registered components, source entries, API and definition.
- `api`: explicit callable dependencies and data APIs. Shared profile dependencies
  are under `api.profile`. `runtime` holds app-owned service/model state;
  `data` holds the reactive view projection and drafts.

Editable functions use SimplyFlow's supplied `this`: `this.data`, `this.actions`,
`this.api`, `this.runtime` and `this.container`. Commands read UI input and perform
native UI operations; named actions can be called with values and data API
fixtures. Source reconstruction does not require the original module closure or
bundler-local variable names. The build retains readable sources in production
as well as readable bundles; source retention is included in the size budget.

HTML remains in authored `.html` files. `{{view:name:./feature.html}}` wires a named
view at build time to an ordinary SimplyFlow field/template binding. The generated
page contains the template markup for useful View Source. Runtime template entries
use `import template from './feature.html' with { type: 'text' }`. These text
imports preserve the authored UTF-8 source, including its root wrapper. Styles
and retained module sources also use text imports. Shared account/Preferences
imports explicitly request build-time composition with `?template` and the same
text attribute; includes and app-specific placeholders are expanded there.
Rollup and the Node test loader handle text imports for the supported runtimes.
`?entries` imports capture authored named behavior and its origins. These build
steps add no runtime renderer or second component merger.

Contacts search/sort, Files visibility/picker state, Launcher shortcut selection
and profile detail lists use SimplyFlow models. jaqt expresses queries inside
model effects where useful. Commands change model options and actions refresh
source projections without replacing native RDF. Named predicates/comparators
remain editable. Picker/provider and workspace object queries also reuse jaqt.

`test/features.test.mjs` checks model refresh, draft/RDF preservation and Files
failure contracts with data doubles. Browser checks also reconstruct retained
production sources and wire the migrated Contacts list into a separate fixture
host with a template override. Existing end-to-end and RDF preservation coverage
remains in place. Fixtures do not establish credential-isolated IDE previews or
live Solid OIDC behavior.

The in-app IDE, persisted user edits, live template reapplication/reset controls
and preview isolation remain future roadmap work. Installed-library limitations
and their evidence are retained in `.spiral/moldability-refactor-investigation.md`.
