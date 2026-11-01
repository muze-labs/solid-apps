# Browser-local capability broker and workspace

Launcher coordinates apps inside the browser. No broker server, connection keys
or broker URL setting is required. The previous network relay is superseded;
its implementation and evaluation remain in Git history.

## Try it locally

Run `npm run dev` and open `http://127.0.0.1:4174/launcher/`. Connect Launcher
through **WebID / connection**, then open Files from its built-in link. Files
keeps its own Solid connection. **Choose in Files** displays selection controls
in that managed Files instance and returns a URL to Launcher. Cancellation
preserves the previous field; selecting does not download or write the resource.

For a cross-origin demonstration, add a shortcut to
`http://localhost:4174/files/`, open it through Launcher, and enable **Allow
resource selection** for that instance in the workspace list. Built-in Files
gets this permission automatically. Exactly one allowed connected provider must
match; multiple providers produce an ambiguity error. An app opened directly
continues to work independently, but does not join this managed session.

Each launch creates a fresh instance. **Preferences → Open apps in** chooses
tabs (default) or windows. The workspace list can focus/restore an instance or
close it individually. Closing an individual instance removes it from the saved
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

`npm run check` covers routing, state and RDF preservation contracts.
`npm run test:browser` covers cross-origin routing, reload/reconnection, distinct
instances, failure recovery, closure and fresh-browser Pod restoration. Chrome
131 received an authorized close-time write in the local fixture. The fixture
uses a test bearer credential through Metro; it does not establish real Solid
OIDC/DPoP behavior at shutdown. Validate that manually with your own provider.
See the [workspace design](../design/solid-managed-workspace.md).
