# Solid Apps roadmap

Status: maintainer-requested direction, recorded 2026-11-01. Implementation is
deferred to future cycles; this update selects no next cycle or delivery order.
All conversation and project documentation should use English. The additions
below are grouped by subject, not priority. The latest refinements come from
[SRC31](../.spiral/sources/SRC-20261101-QG24H-31.md); no new implementation cycle
or delivery order is selected.

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

## Profile and account experience

- Make the account name at the top right of every app open the Profile app for
  the current WebID. Open a new editor window, or reuse/focus an existing editor
  when available, navigating to the current WebID while preserving unsaved work.
  This account shortcut is the requested extension to the existing shared header; general app navigation remains in Launcher.
- After the user changes their name, update the displayed name immediately in
  all already-open suite apps, without requiring reload or reconnect. Native
  profile RDF remains authoritative. Propagating the same user's profile change
  between apps is part of account consistency, independent of the deferred
  collaborative-editing feature.

One presentation detail is pending clarification: when no editor is open,
should this account-name action always create a separate window or follow the
existing tabs/windows preference? Reusing an open editor is requested either way.
Do not infer an answer from the suggested options in the clarification prompt.

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

Theme (System/Light/Dark) and Text size are already implemented in shared
Preferences. Retain dark/light mode and font-size controls explicitly in the
common section. Retain the existing common Density, Preferred language and
Open apps in (tabs/windows) settings there too. The new work is the
clear split and app-specific filtering: today's dialog exposes storage fields
for all apps in every app. Keep common values shared instead of introducing
separate copies for each application.

Future verification: change common theme/text size, open another app and observe
the same preference. Each app's own section exposes its relevant storage options;
Launcher alone exposes workspace creation/switching. Existing preferences and
unrelated native RDF survive saving either section.

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
