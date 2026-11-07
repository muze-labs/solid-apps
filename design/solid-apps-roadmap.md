# Solid Apps roadmap

Status: maintainer-requested direction, recorded 2026-11-01. Implementation is
deferred to future cycles; this update selects no next cycle or delivery order.
All conversation and project documentation should use English. The additions
below are grouped by subject, not priority. Earlier refinements come from
[SRC31](../.spiral/sources/SRC-20261101-QG24H-31.md). The moldable-app additions
follow the maintainer's 2026-11-07 request and the linked design; no new
implementation cycle or delivery order is selected.

This records suite-wide direction alongside the
[capability-broker roadmap](solid-capability-broker-roadmap.md), which continues
to govern broker implementation. The broker phases do not schedule every app
or product improvement below. The launch-context cycle was merged as `c906322`
and the managed-workspace/resource-picker cycle as `798d59b` (PR #3). The merged
baseline includes one native-RDF workspace, conditional checkpoints and the
Files picker. Items below describe future work or refinements, not implemented
claims unless explicitly identified as existing behavior.

## Applications

### Zett

Bring the maintainer's unfinished Zett application into the suite's roadmap.
The source references supplied by the maintainer are
[muze-labs/zett](https://github.com/muze-labs/zett) and
[poef/zett](https://github.com/poef/zett).

The locally available `poef/zett` source presents Zett as a Solid editor, with
worksheets containing resources and views of RDF entities and properties.
Treat it as an existing application to assess and continue, rather than
inferring requirements from the name. Before an implementation cycle, compare
the two repositories with the maintainer, settle which is the source to carry
forward, and select a useful first workflow. Integration must follow this
suite's native-RDF preservation and rendering rules.

### Notebook

Add a notebook application based on the notebook package in
[muze-labs/cobalt-note](https://github.com/muze-labs/cobalt-note/tree/main/packages/notebook),
currently named `@muze-labs/cobalt-notebook`.

That package coordinates note selection and navigation through note adapters;
the application owns its note list, toolbar and persistence. Plan the Solid app
around that boundary. Choose the initial note types, persistence representation
and editor integration during a future cycle. Follow the published-npm
dependency policy; this roadmap does not add sibling repository links.

## Moldable apps and the future in-app IDE

Added at the maintainer's request on 2026-11-07, following
[Moldable Solid Apps](Moldable-Solid-Apps.md), now required reading in
`AGENTS.md`. Apply the design's rules for apps today to Launcher, Contacts,
Files and Profile, and from the first integration of Zett and Notebook. Make
each app ready for the IDE as its features are developed; building the IDE is
separate future work. This addition selects no implementation cycle.

### Current gaps

The four current apps use SimplyFlow, but their entry points create separate
view instances with commands that close over module-local state and helpers.
The shared shell, Preferences and profile view use similar factories. Existing
`window.solidLauncher`, `solidContacts`, `solidFiles` and `solidProfile` handles
expose runtime objects, but do not provide complete editable feature datasets.
`scripts/build.mjs` composes HTML and copies shared CSS separately; those sources
are not exposed as named entries in the running app definition. Existing module
and browser tests are not associated with editable entries. The roadmap has not
previously covered these prerequisites or the IDE workflow.

### Foundations to add to every app

- Define app-owned features as named SimplyFlow component datasets containing
  their templates, styles, commands, actions and relevant bindings, routes or
  initialization behavior. Behavior-only components are valid. Register them in
  `app.components` and explicitly include their views in the owning templates.
  Choose boundaries around useful features, rather than splitting by file type.
- Expose the running app and its editable definitions through a documented
  public handle. Retain useful source for each named entry, component originals
  and app-level overrides, with enough origin information to find the active
  definition. A running dataset must be sufficient without a source checkout.
  Keep build-time HTML composition and useful View Source; generate runtime
  entries from the same HTML/CSS sources so there is no second maintained copy.
- Keep DOM reads, feedback and native UI operations in commands. Put reusable
  behavior and state changes in actions, and storage operations behind an
  explicit data API. Editable replacements must work with SimplyFlow's context
  and documented public dependencies, without recreating private module
  closures. Keep implementation helpers private only when their behavior does
  not need to be edited. Metro, oldm and workspace libraries remain callable
  dependencies outside the app's editing boundary; suite-owned feature wiring
  belongs inside it.
- Use SimplyFlow models for list filtering, sorting, paging and other supported
  transformations in every app. Replace equivalent manual array pipelines in
  UI update helpers with model effects and options. Expose app-specific model
  setup, predicates and comparators as editable entries; commands/actions change
  options and SimplyFlow binds the resulting view. Keep native RDF authoritative.
- Preserve SimplyFlow's component/app override precedence. An edit replaces an
  entry by the same name in the app's corresponding section, leaving the
  component original inspectable. Removing the override must reveal the
  underlying definition. Verify this for every supported entry kind, including
  templates, styles, commands, actions and key bindings; do not add another
  renderer or a competing composition system.
- Associate optional sample data and tests with the named parts they describe.
  Provide fixtures and data API doubles for meaningful previews and action
  tests, while retaining existing end-to-end and RDF preservation coverage.

Check the published SimplyFlow API before migrating features. The installed
`@muze-labs/simplyflow-app` 0.10.3 uses `templates`, `styles` and `shortcuts` for
the design's HTML, CSS and key-binding concepts. It installs templates/styles
without retaining those app-level source sections on the runtime instance,
and its component merge skips component `start` hooks. Resolve source retention,
override restoration and component initialization against the supported API;
do not assume the design's examples are already executable here. If library
work is needed, keep it separately scoped and consume a published npm version.

### Coverage by application

- **Launcher:** expose shortcut listing/editing/launching, resource selection,
  and workspace controls as editable slices. Keep app behavior accessible while
  broker routing, session authority and conditional checkpoint mechanisms remain
  behind explicit APIs. Future catalog and named-workspace features must follow
  the same model. App navigation continues to belong to Launcher.
- **Contacts:** expose list/filter/selection, contact creation and deletion, and
  inline profile viewing/editing. Replace the list update helper's manual
  filtering/sorting pipeline with a SimplyFlow model. Expose its app-specific
  rules, selection and save behavior through named entries. Keep contact drafts
  and the authoritative RDF distinct; reuse the shared profile component.
- **Files:** expose folder navigation/listing, upload/download, folder creation,
  deletion and resource-picker interaction. Actions take values rather than DOM
  elements. Retain root checks, conditional writes and PDS Interop tombstones
  behind the data API; importing or editing a slice grants no new authority.
- **Profile:** expose resource loading, own-profile selection and the shared
  profile editor. Keep storage policy in the app's data API so Contacts and
  Profile can use the same editable view with different persistence policies.
  Preserve unsupported RDF and refuse edits that would flatten structure.
- **Zett:** assess the chosen source against these requirements during intake.
  Plan worksheet, resource, entity/property view and editing boundaries from its
  actual workflows; make the first integrated workflow moldable rather than
  wrapping the whole application in one opaque component.
- **Notebook:** expose note selection/list/navigation, toolbar and note-adapter
  integration as app-owned slices. Keep the published notebook package behind
  its API; expose the suite's adapter and persistence choices without requiring
  users to edit the dependency's internals. Select concrete slices with the
  initial note types and editor integration.

The shared account shell, Preferences and profile editor must also expose their
app-owned parts through registered datasets. Include app-specific preference
templates. Shared defaults remain inspectable and overridable per app without
forking the shared component. Preserve the existing visual language, inline
Contacts profiles and native-operation exceptions.

### Acceptance before calling an app ready for the IDE

For each app, verify that a user can locate a rendered control's named template
and command, inspect their originals, and replace a template, style and behavior
through app-level entries. Run a replacement reconstructed from the exposed
source with only documented context/dependencies to catch hidden closure or
bundler dependencies. Removing overrides must restore the original behavior.
For list features, verify that changing model options or source items updates
the bound filtered/sorted view without mutating the authoritative source.
Exercise an action without DOM access using a data API double. Register a slice
in a second app/test host and explicitly wire its view, demonstrating reuse
without the source app's private state. Check initialization and cleanup without
duplicate listeners or effects, and preserve drafts and RDF through the change.
These checks establish app readiness; they do not claim an IDE already exists.

### Later IDE work

- Open the IDE beside the app in the same page. Navigate components and named
  entries, show origins and active overrides, and offer an inspect mode that
  jumps from a rendered control to its template and active command.
- Create or import component datasets, register them, and let the user wire
  them into views. Export either the original component or a copy with that
  component's app overrides applied, in the same editable import format.
- Preview drafts with sample data and run associated tests in isolated state
  without live write credentials or write-capable APIs. A test double alone in
  the live app's credential context does not establish this isolation.
- Apply valid edits on explicit save, live wherever possible; optionally update
  valid HTML/CSS while typing. Persist app-level edits locally, with Pod storage
  as another possible destination. Choose the format, dependency loading and
  runtime update mechanism during IDE design. Native Turtle and RDF preservation
  rules still apply to Pod resources and Turtle caches. This does not expand
  the workspace's opaque-state exception or authorize JSON-in-Turtle snapshots.
- Provide correction after runtime errors, reload/reset controls, and a safe
  reload that skips local changes even if both app and IDE fail. Retain skipped
  edits for separate recovery. Verify import/export round trips, isolation from
  live writes, failed-edit recovery and safe reload with broken overrides.

Keep the ordinary app usable without the IDE and retain the per-app JavaScript
budget. Plan IDE loading and measure its cost explicitly when implementing it.

## Profile and account experience

- Make the account name at the top right of every app open the Profile app for
  the current WebID. Reuse/focus an existing editor when available, navigating
  to the current WebID while preserving unsaved work. When opening an editor,
  follow the existing tabs/windows preference. This account shortcut is the
  requested extension to the shared header; general app navigation remains in
  Launcher.
- After the user changes their name, update the displayed name immediately in
  all already-open suite apps, without requiring reload or reconnect. Native
  profile RDF remains authoritative. Propagating the same user's profile change
  between apps is part of account consistency, independent of the deferred
  collaborative-editing feature.

The communication mechanism and behavior across origins remain design choices.
A future verification should open several apps, change the name in Profile,
and observe each header update without rewriting unrelated profile data.

## Authentication and avoidable 401 challenges

Reduce avoidable challenge-first requests while the user is signed in. Current
sessions force authorization for writes; reads can still encounter a 401 before
authorization is attempted. The maintainer reports many visible 401 responses.

Evaluate Metro force authorization for requests to the current storage Pod. A
preferred candidate to investigate is remembering which origins return a 401
and proactively authorizing subsequent requests there. Keep that knowledge scoped
to the current account and the middleware's valid Pod/origin/token scope. Verify
redirect handling as part of that scope.
The exact learning, lifetime and Pod/path/origin boundaries need verification
in the implementation cycle. These are proposals, not a settled auth policy.
Genuine expired-session or denied-access failures must remain visible.

Future verification: compare network traces before/after for public and protected
resources, multiple storage locations and a different account. Avoid repeatedly
challenging a known protected origin without breaking anonymous/public access.

## Common and app-specific preferences

Present a common section shared across all apps and a separate section containing
only options relevant to the current app. Storage settings belong in that app's
section. In Launcher, workspace creation and switching are app-specific options.
Use the existing profile-linked preferences file and preserve unknown RDF;
separating the UI does not itself require moving settings to new files.

Implemented in Preferences cycle `CYC-20261107-QG24H-33`: the common/app-specific
split and per-app storage filtering, with partial writes preserving omitted RDF
settings.
Named workspace creation and switching remain future work.

The common section includes Theme (System/Light/Dark), Text size, Density,
Preferred language and Open apps in (tabs/windows). Common values remain shared
instead of introducing separate copies for each application.

Verification covers common appearance across apps, per-app storage fields and
preservation of omitted settings and unrelated native RDF. Launcher workspace
creation/switching still needs its own implementation and verification.

## Workspaces, Launcher dashboard and logout

Support multiple named workspaces and offer workspace choice when more than one
is available. Creating a workspace and switching workspaces belong in Launcher's
app-specific preferences. Workspace identity, discovery through linked preferences,
Pod/local persistence and switching recovery extend the existing
[Pod-synced workspace direction](solid-capability-broker-roadmap.md#retained-roadmap-item--pod-synced-workspaces).
Keep each workspace's shortcuts, resource contexts, pending edits and restoration
state distinct. The current implementation checkpoints only one default workspace.

The maintainer explicitly clarifies the lifecycle:

- Closing Launcher still closes its managed apps.
- Logging out of Launcher also closes the active workspace and its managed apps.
- Logging out of another managed app does not close Launcher, sibling apps or
  the whole workspace.

Design checkpoint/save and logout ordering before implementing it, including
failure/offline behavior and retention of recoverable local changes. This does
not add collaborative editing or an independent broker service.

Treat the dashboard as Launcher's home screen. Make it sparse, like a phone home
screen: show the shortcuts the user added. Seed only Files links for **every
storage location advertised by the user's profile**, not just the first location.
Each default Files shortcut must open its corresponding root. Contacts, Profile
and other suite apps should not be permanent default tiles. The common account
controls and own-profile link remain available independently of shortcut tiles.
Preserve existing user shortcuts and their per-link launch settings.

A suggested (+) icon opens a dialog to add a shortcut, keeping the add form off
the main screen. Retain adding an arbitrary app URL; catalog selection can feed
that flow. Exact placement is a future UI decision, not a fixed icon/layout spec.

Future verification: create two workspaces with different shortcuts, switch and
reopen without mixing state, and check the specified Launcher/child logout
behavior. With multiple profile storage roots, the default home contains only
the corresponding Files links; adding a shortcut through the dialog adds that
item without introducing permanent built-in app tiles.

## Mobile first and JavaScript budget

Design and validate core workflows on mobile first, preserving the suite's
existing visual language and supporting larger screens as well.

Target: **less than 200 KB of gzipped JavaScript per app**. Measure the app and
its required shared dependencies together, including the auth callback. The
merged build now enforces a strict 200000-byte limit on the complete graph;
[EVD30](../.spiral/evidence/EVD-20261101-QG24H-30.md) records the current passing
sizes and verification limits. Preserve that enforcement as features are added;
a small entry file alone does not establish compliance.

## Local first and automatic sync

Apps must continue to work without a network connection. Keep locally available
data and pending edits usable, then sync automatically when connectivity
returns. Local edits must survive reloads and failed sync attempts. Show pending,
synced and failed/conflicting states clearly, and preserve changes when access
or authentication needs the user's attention.

This changes the intended direction from today's explicit manual sync.
The existing local replicas are a starting point, not proof of complete offline
operation. Define per-app offline workflows, data availability and conflict
handling in future cycles; resources not yet available locally cannot be
assumed to work offline. Apply the same automatic-sync direction to the planned
[Pod-synced workspaces](solid-capability-broker-roadmap.md#retained-roadmap-item--pod-synced-workspaces).

A future verification should make edits offline, reload without losing them,
restore connectivity, and observe automatic Pod synchronization. Cover an
expired session and a conflicting remote change without silently discarding
local work.

## Explicit PWA support in every app

Make PWA support an explicit requirement for Launcher, Contacts, Files, Profile,
and the planned Zett and Notebook apps. Plan install metadata, an appropriate
offline app shell, app-specific launch URLs and a clear update lifecycle.
Verify installed and ordinary browser use, including offline reopening and
updates that preserve pending local changes. Select the exact implementation
and supported-browser checks in the relevant cycle; PWA support is not claimed
to exist merely because the apps are browser applications.

## Collaboration later

Collaborative editing and multi-user live sessions are outside current scope.
Revisit them later with their own requirements and acceptance criteria. This
deferral does not postpone automatic synchronization of one user's data,
workspace portability, or consistent account information across their apps.

## Simple decentralized app store

Allow users to configure an app-catalog URL and to use **more than one catalog
source**. Sources are decentralized and independently hostable; no single Muze
service or mandatory central store should be needed. Keep adding a source and
choosing an app simple.

Start with a placeholder catalog implemented as a static **folder of `.ttl`
files**: one `index.ttl` and one manifest per available application. The index
must supply each app's **name, icon and link to its manifest**. The manifest
provides the application's actual launch description; reuse the existing launch
contract and capability descriptions where supported. Final vocabulary/shape
choices belong to the implementation cycle. No catalog or manifest files are
created by this roadmap update.

Seed it with the available suite applications and add a selection of existing
stable Solid apps, even when they do not participate in this ecosystem. Verify
the candidates' current availability and documented launching behavior when
curating the first catalog; no third-party shortlist or stability claim is
selected here. Ordinary external apps must be usable as launch links without
pretending that they implement broker, capability or state-restoration APIs.

A catalog folder can be published through Git/static hosting, but Git is not a
mandatory runtime dependency or the selected hosting service. Keep independent
catalog URLs and support for multiple sources. Define updates and duplicate
entries in a future cycle. Catalog discovery and a user's preferred capability-
provider registry have separate responsibilities; a listing does not grant Pod
access or make an external app a compatible capability provider.

Future verification: load the index and per-app manifests, display each name and
icon, and add launch links from both suite and third-party entries. Add two
independent catalog URLs and retain the other source when one is unavailable or
removed. Ordinary external apps launch without requiring ecosystem cooperation.

## Source inspection and planning boundary

The maintainer supplied the roadmap requirements directly. During the original
roadmap update, GitHub pages could not be retrieved and these local sources were
inspected read-only:

- `poef/zett` at `014a8887568482d185fadd48442372d0e7e2afaa`: committed
  `package.json`, `src/app.mjs` and `www/index.html`. At that inspection the
  checkout contained unrelated user changes; those were not used as the historical baseline or
  modified. The separate `muze-labs/zett` version remains uninspected.
- `muze-labs/cobalt-note` at `32c86bbfcc015390ad5479abde75e9e9695c57b6`:
  README, notebook package metadata, exports and note-type API documentation.

The original documentation update was on `docs/solid-apps-roadmap`. The latest
refinement is on `docs/launcher-workspace-roadmap`, outside a new implementation
cycle and after the maintainer's PR #3 merge. No dependencies, runtime behavior
or build configuration change. Before selecting the next cycle, reconcile this direction, the broker
phases and retained workspace work with the maintainer's priorities.

## Managed-workspace revision, 2026-11-01

The maintainer explicitly advanced one part of workspace persistence in the
active broker cycle: Launcher owns opened apps and checkpoints one default
workspace locally and to the Pod at explicit save/close. Browser-X uses a
best-effort prepared write. Subsequent roadmap additions above refine named-workspace selection, preferences, logout,
home-screen and catalog behavior. Named workspaces, continuous automatic app-data
sync, PWA rollout and collaboration still require future implementation cycles.
The [managed-workspace design](solid-managed-workspace.md) records the boundary.
