# Browser-local capability broker and workspace

Launcher coordinates apps inside the browser. No broker server, connection keys
or broker URL setting is required. The previous network relay is superseded;
its implementation and evaluation remain in Git history.

## Try it locally

Run `npm run dev` and open `http://127.0.0.1:4174/launcher/`. Connect Launcher
through **WebID / connection**, then click **Choose in Files**. Launcher focuses
one allowed live Files provider, or opens/reuses a built-in Files instance if
needed. No manual pre-opening is required. Files keeps its own Solid connection;
connect there if requested. Selection controls return a URL to Launcher without
downloading or writing the selected resource. Cancellation preserves the field.

Startup opens synchronously from the click and waits up to 30 seconds for the
verified app connection. Cancel selection also cancels that wait. Blocked popups,
closed apps, setup failures and timeouts are reported. Existing denied instances
are never silently granted. Multiple eligible providers require enabling the
workspace's **Allow resource selection** for just one instance.

Focus is requested for Files and, after selection/cancellation, for Launcher.
Browsers can refuse focus requests; the UI tells you to switch tabs if needed.
The isolated Chrome proof verifies Files tab activation and returned results;
it does not guarantee the return-to-Launcher focus on every browser. Launcher
advertises a unique live window name through its verified opener handshake;
selection/cancellation targets that existing tab during the user's click. The
isolated Chrome test verifies the return without opening another tab. This hint
is separate from stored workspace state and does not grant a capability.

Protected browsing may still require the provider's sign-in window. The Solid
session retains and closes that window even when authorization first becomes
necessary after an identity token was cached. The callback's “Completing
sign-in…” page should disappear after the response is handled. Popup blocking,
denied consent and noninteractive sign-in refusal remain visible errors.

For a cross-origin demonstration, add a shortcut to
`http://localhost:4174/files/`, open it through Launcher, and enable **Allow
resource selection** for that instance in the workspace list. Built-in Files
gets this permission automatically. Exactly one allowed connected provider must
match; multiple providers produce an ambiguity error. An app opened directly
continues to work independently, but does not join this managed session.

Each launch creates a fresh instance. **Preferences → Open apps in** chooses
tabs (default) or windows. The workspace list can focus/restore an instance or
close it individually. It distinguishes Restoring, Connected and setup errors.
Save collects fresh state from ready apps with a ten-second deadline. A failed
checkpoint names the app and leaves apps open; successfully collected sibling
state stays local. Reconnecting a current client preserves its live UI and does
not replay old restoration state. An older already-open client may need a reload
to reconnect safely; save its in-app edits before reloading. Closing an individual instance removes it from the saved
set. Closing the workspace retains the set for reopening. Allow popups for
multiple-app restoration; **Restore apps** and individual restore buttons provide
recovery when the browser blocks automatic startup.

## Save and restore

State updates are stored locally in account-scoped IndexedDB. Files publishes
its folder; Profile publishes its subject; Contacts publishes selection/search.
Profile/Contacts also retain an open profile-edit draft without applying it to
the underlying RDF. Temporary dialogs, active capability requests and in-flight
operations are not resumed. External apps need the managed-app protocol to
publish their own restoration state.

The default Pod document is `apps/solid-apps/workspace.ttl` beneath the connected
WebID's advertised storage root. **Preferences → Workspace resource** can name
another document. The existing linked `pim:preferencesFile` remains the source
of settings. Ensure the parent container exists and the account can write there.
The document stores one default workspace; named workspace creation is future
work. Shortcut collection sync remains a separate operation.

- **Save to Pod** checkpoints participating apps and waits for a conditional PUT.
  A successful response without an ETag (including CSS's 205 response) still
  confirms the save. Before a later write, Launcher reads the current native
  document for a fresh ETag. It retains the acknowledged snapshot baseline so
  pending local edits do not create a false conflict against its own last save.
- **Save & close** waits for that acknowledgement, then closes managed apps.
  Failed/conflicting/offline writes leave apps open and retain local state.
- **Close locally** checkpoints locally and closes apps without a Pod write.
- The browser's ordinary close button attempts a prepared conditional PUT with
  `keepalive` and noninteractive authentication. This is best effort, capped at
  60 KB of Turtle, and never marks the local snapshot as remotely confirmed.

If the browser refuses to close a manually opened Launcher tab, it reports that
the managed apps have closed and leaves the Launcher for you to close. On
reopening, local pending state wins over an unconfirmed remote result; conflicting
Pod changes are reported rather than overwritten. **Review Pod conflict** reads
the current Pod version and shows both snapshots. **Keep local and save to Pod**
replaces that reviewed snapshot conditionally, preserving other RDF; another
remote change requires another review. **Use Pod version and reopen apps**
replaces the local session, including drafts, and restores the Pod app set.
Last-operation errors survive a reload and appear beside the workspace buttons.
A known conflict is checked before reserving a sign-in window. A fresh browser can restore
an acknowledged snapshot after connecting to the same account.

## Native workspace and app state

Workspace version 2 stores workspaces, ordered app instances, resource links,
UI state and draft inputs as native RDF. The local current workspace and accepted
baseline are separate native graphs, with ETag/target/dirty metadata and local
reconnect keys. No main-state snapshot or baseline is a JSON literal.

An app supplies `{ turtle, opaque? }` to `ManagedApp.getState` and receives the
same contract in `restoreState`. Turtle is transport text: the broker parses and
merges its triples, never saves that text as a Turtle literal. Describe
`urn:muze:solid-apps:state:root`; keep any other named subjects within
`urn:muze:solid-apps:state:`. Blank nodes, lists, cycles, typed/language literals,
multiple values and external resource IRI objects are supported. Each instance
gets its own stored graph scope. An app cannot write workspace metadata through
its state. Keep and edit the full graph so unknown terms survive UI updates.

The optional `opaque` value is an app-owned string, returned verbatim. Only this
field may experimentally contain JSON; main state must remain linked data. This
exception is an interoperability experiment, not the preferred encoding.
The suite's `AppState` helper is optional: other apps can use their own RDF stack
and supply the same Turtle contract. Profile and Contacts share native draft
handling; draft form strings do not alter the actual profile graph.

There is deliberately no migration for this unreleased prototype. The native
cache starts fresh in `solid-apps-managed-workspaces-native`; old development
cache records are left untouched. If Preferences still point to an old JSON Pod
workspace, select a fresh URL (for example `workspace-native.ttl`) before saving.
The old target is refused, never silently overwritten or copied into new state.
See the [format design](../design/solid-native-workspace-state.md) and
[generated native example](../design/examples/workspace.ttl).

## Boundaries and evidence

Origin-targeted `postMessage` offers transfer private MessagePorts. Launcher
binds each connection to an exact window, origin and local instance identity.
Reconnect secrets stay in browser storage, outside Pod snapshots and launch
URLs. Apps cannot grant themselves access to other instances. Capability routing
conveys no Solid permissions; each provider retains its own authentication.

Ordinary opener access is intentional. A malicious external app may navigate
its opener; use trusted managed links. COOP can sever opener relationships, and
uncooperative apps cannot provide state or reliable self-closure after a browser
crash. Participating apps monitor a captured opener reference to close after a
normal Launcher close. This is browser lifecycle behavior, not a crash guarantee.

`npm run test:picker` exercises activation/startup policy, grants, cancellation
and cross-origin tab handoff without invoking workspace persistence. The full
`npm run check` and `npm run test:browser` now exercise native RDF fixtures,
including graph preservation, local baselines, conditional saves, conflict
recovery, reload/reconnection, distinct instances and fresh-browser restoration.
Chrome 131 received an authorized close-time write in the local fixture. The
fixture uses a test bearer credential through Metro; it does not establish real
Solid OIDC/DPoP behavior at shutdown. Validate that manually with your provider.
See the [workspace design](../design/solid-managed-workspace.md).
