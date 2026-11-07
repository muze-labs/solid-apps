# Solid Workbench and apps roadmap

Naming update, 2026-11-07: the repository is now
[muze-labs/solid-workbench](https://github.com/muze-labs/solid-workbench), and
the Launcher is named **Solid Workbench**. Earlier references to Launcher
describe that app's role. Its canonical app route is /workbench/; the maintainer
explicitly declines a /launcher/ compatibility entry or old-workspace migration.
Other app routes, package names, RDF identifiers and historical document/artifact
names are retained.

Status: maintainer-requested direction, recorded 2026-11-01, with subsequent
refinements below. Work is selected through future implementation cycles; this
update selects no next cycle. The maintainer places a second, virtual-company
stage after the current suite work. Items within each stage remain grouped by
subject, not priority. All conversation and project documentation should use
English. Earlier refinements come from
[SRC31](../.spiral/sources/SRC-20261101-QG24H-31.md). The moldable-app additions
follow the maintainer's 2026-11-07 request and the linked design; no new
implementation cycle or delivery order within either stage is selected.

This records suite-wide direction alongside the
[capability-broker roadmap](solid-capability-broker-roadmap.md), which continues
to govern broker implementation. The broker phases do not schedule every app
or product improvement below. The launch-context cycle was merged as `c906322`
and the managed-workspace/resource-picker cycle as `798d59b` (PR #3). The merged
baseline includes one native-RDF workspace, conditional checkpoints and the
Files picker. Items below describe future work or refinements, not implemented
claims unless explicitly identified as existing behavior.

## Standing feature guardrails

Confirmed by the maintainer on 2026-11-07 after discussing focused apps,
local-first/mobile-first design, accessibility and slow-connection usability.
These are standing planning and delivery constraints for both roadmap stages,
not optional polish or proof that current apps already meet them.

- **Focused apps:** keep each app centered on a clear user purpose. Consider a
  separate capability-connected app when a feature introduces a separate task.
  Split around coherent workflows, not an arbitrary feature count; users should
  not have to assemble fragments of one ordinary task across many tiny apps.
- **Local-first and mobile-first:** define what works offline, what data must
  already be available, and how edits survive reload, reconnection, expired
  authorization and conflicts. Start with the phone workflow and verify it
  there before expanding to desktop. Network-dependent parts must be explicit;
  uncached resources cannot be assumed to work offline.
- **Accessible core tasks:** ship only an interaction that can be completed with
  keyboard and assistive technology. Prefer native controls; design labels,
  focus, feedback and alternatives to gestures alongside the feature. Redesign
  or defer an inaccessible core interaction rather than postponing accessibility.
  Use appropriate automated checks and manual review; passing tests or a good
  screenshot alone does not establish accessible task completion.
- **Small meaningful first use:** keep the existing complete-app JavaScript
  limit below 200000 gzip bytes, including shared dependencies and the auth
  callback, as a ceiling rather than a target. Also measure the cold-cache
  transfer and required requests across HTML, CSS, JavaScript, fonts, images
  and data needed for the core task, plus time until that task is usable on a
  representative slow connection. Define the task for each app/feature; a
  loading shell is not success. Optional functionality may load later, while
  the existing complete-graph budget remains enforced. Do not rely on a warm
  cache to disguise first-use cost. No additional numeric transfer/time limit
  or specific network profile is selected by this agreement.

Retain the existing readability requirement: small apps should be easy for
people to understand and alter, without compressed or clever source code.
Before implementing each cycle, briefly state the feature's app boundary,
offline/recovery behavior, phone interaction, accessible interaction and download
impact. Evaluate the same claims with relevant evidence. If the proposed feature
cannot meet these constraints, redesign, split or defer it rather than silently
waive them. This agreement does not start a cycle, implement offline/sync/PWA
support or certify the accessibility/performance of existing apps.

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

The maintainer further clarifies that the ultimate goal is easy alteration
through the moldable IDE by people without a professional programming background.
Readable, self-explanatory feature code is therefore a requirement for apps today:
prefer clear names and straightforward steps, and avoid clever tricks and
unnecessary indirection. Apply the design's
[readability rules](Moldable-Solid-Apps.md#write-for-the-person-changing-the-app)
to new and changed features, including shared MVP UI components.

### Deferred: runtime template composition

On 2026-11-07 the maintainer accepts build-time composition as sufficient for
now and explicitly asks to revisit it later. Shared account and Preferences
includes, app titles and app-specific Preferences insertion are expanded during
the build. The running app retains the resulting templates, but cannot change
those composition relationships or re-expand their source placeholders without
a rebuild. This is a current moldability limitation.

Investigate composing these views at runtime through named SimplyFlow templates
and/or fields, so users can change their composition in the running app. These
are candidate mechanisms, not a selected implementation. Keep SimplyFlow as the
runtime renderer and assess how to retain useful View Source. Reconcile the
current build-time composition rule when that future design is selected. This
follow-up is deferred; it does not extend the current refactor or select a cycle.
FBK-20261107-QG24H-46 retains the maintainer's decision.

### Baseline before the accepted moldable refactor

The observations below describe the pre-CYC37 baseline. CYC37 was accepted and
merged as b9650ba: named feature datasets, explicit contexts/APIs, model-based
lists, per-component files and retained HTML/CSS/behavior sources are implemented.
Maintain those foundations during UI work. Live template reapplication, complete
override restoration and the in-app IDE remain future work; the accepted source
foundation does not establish every IDE-readiness criterion below.

The four current apps use SimplyFlow, but their entry points create separate
view instances with commands that close over module-local state and helpers.
The shared shell, Preferences and profile view use similar factories. Existing
`window.solidLauncher`, `solidContacts`, `solidFiles` and `solidProfile` handles
expose runtime objects, but do not provide complete editable feature datasets.
`scripts/build.mjs` composes HTML and copies shared CSS separately; those sources
are not exposed as named entries in the running app definition. Existing module
and browser tests are not associated with editable entries. The roadmap has not
previously covered these prerequisites or the IDE workflow.

### Foundations to maintain in every app

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

- Make the account name at the top right of every app open profile viewing and
  editing for the current WebID. On 2026-11-07 the maintainer revises the earlier
  separate-editor preference: request the Profile provider through a capability,
  normally hosted in an iframe dialog in the current app, with a tab fallback
  continuing the request when embedding is unavailable. Reuse the provider's
  editor and preserve unsaved work. CYC49 is accepted on 2026-11-07; the
  [capability contract](solid-profile-editing-capability.md) records the boundary.
  General app navigation remains in Launcher.
- After the user changes their name, update the displayed name immediately in
  all already-open suite apps, without requiring reload or reconnect. Native
  profile RDF remains authoritative. Propagating the same user's profile change
  between apps is part of account consistency, independent of the deferred
  collaborative-editing feature.

Immediate propagation of name changes to other already-open apps remains
future work; the capability caller refreshes its own account display.
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

### Startup sign-in and decentralized sign-up

Requested by the maintainer on 2026-11-07. On loading Solid Workbench or any
suite app, present a shared sign-in/sign-up style dialog when the user is not
signed in. Attempt existing session restoration first so a signed-in user does
not receive an unnecessary prompt. Reuse the current Metro authentication and
shared dialog components; distinguish first-use onboarding from stale-session
recovery rather than creating another authentication mechanism.

**Design sign-up before implementation.** The experience must support Solid's
decentralized model rather than imply one central Workbench account service.
Explore choosing an identity and Pod provider, using an existing account or
self-hosting, and explaining where the account and data live. Provider choice,
discovery, account/storage relationships and any handoff back to the app need
explicit design; no default provider, signup service or flow is selected here.

Resolve dismissal/local-only use, deliberate anonymous launches and embedded
capability behavior in that design. Keep existing public content and drafts
safe, and do not assume that a missing signed-in session means the user must
create a new account. Evaluate first visits, restored sessions, cancellation,
provider choice and return from signup across apps and phone/desktop layouts.
This is roadmap work, not implementation of a startup dialog in the rename
cycle.

### Expired authorization and sign-in recovery

Accepted [CYC67](../.spiral/cycles/CYC-20261107-QG24H-67.md) implements
refresh-first renewal and explicit recovery. ACC72 records the maintainer's
acceptance and commit/merge/push instruction. Hidden-iframe sign-in is deferred.
[DES69](../.spiral/designs/DES-20261107-QG24H-69.md) records the Metro boundary;
[EVD71](../.spiral/evidence/EVD-20261107-QG24H-71.md) records verification and
live-provider limits. The later reported Preferences repeated-save ETag problem
below remains future work; cycle acceptance does not establish that it is fixed.

Added at the maintainer's request on 2026-11-07 after live Profile capability
feedback. Same-origin tabs and dialogs already share Metro's token/key stores.
The reported case had an expired access token, no refresh token and a cached
identity token in both contexts. Reconnecting resolved it. Public profile
content remained available while protected preferences left a sign-in warning.
[Investigation evidence](../.spiral/evidence/EVD-20261107-QG24H-57.md) records
this distinction and the Firefox reproduction.

Prioritize refresh-token authorization and understandable recovery UI. Request
refresh authorization through Metro with the required provider consent; verify
issuance rather than assuming a scope guarantees a refresh token. Existing
sessions without a refresh token need a fresh authorized sign-in. Reuse valid
credentials and silently refresh when possible across same-origin suite apps,
including embedded capability providers. Keep account/issuer/DPoP validation and
provider-owned data access; capability messages must not carry OAuth credentials.

If interaction is needed, show a nonblocking notice specific to the operation,
with a clear **Sign in again** action. Examples: "Sign in again to load your
preferences" or "Sign in again to save to your Pod. Your edits are still here."
Keep available content and editing usable, preserve drafts, and avoid a raw
library error or an automatic login modal. A requested save may offer **Sign in
and save**, then resume that conditional save after successful authentication.
Retain conflict handling and pending work if authentication fails or is cancelled.
Distinguish connectivity, server and denied-access failures from expired
credentials; a preferences failure must not imply that the public profile failed
to open. After recovery, update affected same-origin app/dialog status without
requiring a reload or overwriting drafts.

As a later optional fallback, evaluate one bounded hidden-iframe authorization
attempt with OIDC `prompt=none`, after credential reuse/refresh and before asking
for interaction. Fall back on login/consent/interaction-required responses,
framing refusal or timeout; do not loop or display login UI in a hidden frame.
The identity-provider frame is cross-site even when suite apps share an origin.
Browser cookie partitioning and provider framing rules can prevent reuse of the
issuer's browser session. Verify supported browsers/providers and keep explicit
sign-in available. Implement missing lifecycle/parameter support in the Metro
stack rather than adding a parallel app-owned authentication mechanism.

References: [OIDC offline access and consent](https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess),
[OIDC silent authorization](https://openid.net/specs/openid-connect-core-1_0-errata2.html#AuthRequest)
and [Firefox cookie partitioning](https://support.mozilla.org/en-US/kb/total-cookie-protection-and-website-breakage-faq).

Future verification: valid shared access token; expired token with successful
silent refresh; expired token without refresh authorization; cancelled/failed
sign-in with a retained draft; sign-in followed by the original conditional save;
network failure, access denial and write conflict. Cover tabs and embedded
providers in Firefox and Chrome. For the optional iframe path, cover silent
success, interaction required, blocked cookies/framing and timeout. This is
future roadmap work, not implementation or acceptance of an auth change in CYC49.

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

### Preferences source display and recovery after saving

Reported by the maintainer on 2026-11-07 during CYC67 evaluation. Selected as
CYC-20261107-QG24H-77 after the guardrail discussion; implementation and evaluation
are on its dedicated branch, awaiting human acceptance. EVD80 records the
bounded regression/browser evidence. The following preserves the original gap;
it is not a claim that the live provider's response has been captured.

- Remove the unexplained `prefs.ttl` URL from the ordinary Preferences dialog.
  If source information serves a useful diagnostic task, give it a clear label
  in secondary details rather than presenting a bare URL above the settings.
- Investigate the reported sequence: save Theme as Light, then change it to
  Browser default and save again. The second save reports:
  "solid-app-data: This server supplied no ETag. Safe editing requires a
  conditional write." This leaves the user without an actionable recovery path.
  The cause and whether the preceding write was acknowledged remain unverified.
- Provide understandable save status and a safe recovery action, retaining the
  selected settings and any other unsaved form values. Distinguish a failed
  write from a successful write whose next-write validator is unavailable.
  Reuse the existing Metro/document and conditional-save contracts; investigate
  safe validator reacquisition without adopting conflicting remote changes or
  silently falling back to an unconditional write. An error rewording alone
  does not resolve the recovery problem.

Evaluate repeated saves in the same open dialog, missing ETags on write/read
responses, connection failures and concurrent Pod changes. Verify retained
edits, accurate acknowledgement and a usable retry/recovery path, while
preserving unknown RDF. This report does not establish a root cause or a fix.

## Workspaces, Launcher dashboard and logout

Support multiple named workspaces and offer workspace choice when more than one
is available. Creating a workspace and switching workspaces belong in Launcher's
app-specific preferences. Workspace identity, discovery through linked preferences,
Pod/local persistence and switching recovery extend the existing
[Pod-synced workspace direction](solid-capability-broker-roadmap.md#retained-roadmap-item--pod-synced-workspaces).
Keep each workspace's shortcuts, resource contexts, pending edits and restoration
state distinct. The current implementation checkpoints only one default workspace.

Reaffirmed by the maintainer on 2026-11-07: support multiple workspaces and let
the user switch between them in Solid Workbench. Make the active workspace and
switching action clear, and protect unsaved changes during a switch. This
extends the existing named-workspace item rather than creating a duplicate
feature; creation, selection and switching remain future implementation work.

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

## MVP UI and reusable design components

Added at the maintainer's request on 2026-11-07. Bring Launcher, Contacts,
Files and Profile closer to the UI in
[poef/solid-apps](https://github.com/poef/solid-apps), turning the current
prototype screens into an MVP UI for ordinary use. Review the reference UI
alongside the current suite when selecting this work. Retain its blue accent,
square controls, panel layouts and compact account dropdown, with app-owned
toolbars, Launcher-only app navigation and inline profiles in Contacts.

Inventory the visible controls and remove those present mainly for testing or
demonstrating implementation details from the ordinary app interface. Choose
what to remove from actual user workflows; keep necessary account, save/sync,
error and recovery interactions understandable and reachable. Developer checks
belong in tests or explicit developer tooling rather than permanent product
controls. This item does not predetermine a list of controls to delete.

Create and reuse common design components across the suite, including dialogs
and dropdown menus, wherever the interaction is shared. Inspect the installed
the-ds and SimplyFlow APIs and existing suite components first; extend that
composition rather than introduce a parallel design system. Shared components
must follow the moldable feature structure, expose app-specific content and
commands, and keep SimplyFlow responsible for runtime rendering. Retain direct
native dialog/popover lifecycle and focus operations where appropriate.

Required reading when designing or implementing this item:
[Jon Yablonski's Laws of UX](https://lawsofux.com/llms.txt), read during this
roadmap update on 2026-11-07. Use the relevant principles to assess concrete
choices: familiar interactions (Jakob's Law), fewer competing choices (Hick's
Law), lower cognitive load, clear visual grouping, and usable targets (Fitts's
Law). Treat these as design guidance and check the resulting workflows with
users; they do not supply a ready-made layout or an arbitrary numerical limit
on controls.

Future evaluation: review the core flows in all four apps on mobile and desktop
against the reference UI; verify that testing-oriented clutter is gone while
necessary feedback and recovery remain available. Check shared dialogs and menus
for consistent behavior, keyboard operation and focus return. Preserve the
JavaScript budget and existing data/RDF contracts. This is a roadmap item, not
a selected cycle, a new delivery order or an implementation change.

### Short suite prefixes

Requested by the maintainer on 2026-11-07. Use **swb-** or **swb_** as the
default namespace for suite-owned MVP UI names where it avoids conflicts;
there is no need to include Muze or the full package name. Prefer swb- for
HTML IDs/classes/template names and data-swb-* attributes, --swb-* for custom
CSS properties, and swb_ for JavaScript names such as commands/actions that
need a shared namespace. Add a short feature/app qualifier only where an actual
collision requires it, keeping names readable and easy to alter.

Plan a coordinated refactor of existing long suite-owned prefixes across
component definitions, authored templates/styles, bindings, references and
verification. Keep third-party library names/public APIs intact and preserve
editable feature reconstruction and embedding behavior. This is UI naming,
not a rename of persisted RDF, capability identifiers or published packages.
It is recorded future work; CYC73 does not silently rewrite all existing names.

### Remaining UI work per app and in Preferences

Clarified by the maintainer on 2026-11-07 after accepting CYC49. The shared UI
foundation is accepted, but each application still needs its own UI improvements.
Review Launcher, Contacts, Files and Profile individually, including their task
flows, content layout, toolbars, forms and feedback. Apply the same expectation
to future apps as they join the suite.

The Preferences dialogs also need a dedicated UI review, covering both common
settings and each app's settings: grouping, labels, explanations, save/recovery
flows and usability on phones. Reusing the shared dialog component does not
complete the design of the settings inside it.

Carry forward the reference visual language, Laws of UX guidance, accessibility,
mobile/desktop checks and shared components above. Define concrete improvements
from each app's workflows when selecting future cycles; this addition selects no
implementation cycle or delivery order.

### Shared visual language for forms

Requested by the maintainer on 2026-11-07. Establish a coherent form design
across every app and dialog, including Preferences and profile editing. Define
consistent labels, help text, grouping, spacing, control appearance, required
and optional fields, validation/error feedback, and primary/secondary actions.
Include editing, saving, disabled and recovery states so shared appearance also
communicates the interaction consistently.

Build reusable form patterns/components on the existing the-ds/SimplyFlow
composition and blue-accent, square-control visual language. Keep app-specific
fields and behavior editable through named feature datasets. Evaluate keyboard
and screen-reader use, focus visibility, error association and phone layouts;
apply the Laws of UX guidance above. This is future design work, without a
selected implementation cycle, control library replacement or delivery date.

## Mobile first and JavaScript budget

Apply the [standing feature guardrails](#standing-feature-guardrails) to each
new feature. Design and validate core workflows on mobile first, preserving the
suite's existing visual language and supporting larger screens as well.

Target: **less than 200 KB of gzipped JavaScript per app**. Measure the app and
its required shared dependencies together, including the auth callback. The
merged build now enforces a strict 200000-byte limit on the complete graph;
[EVD30](../.spiral/evidence/EVD-20261101-QG24H-30.md) records the current passing
sizes and verification limits. Preserve that enforcement as features are added;
a small entry file alone does not establish compliance. This ceiling is not a
target to fill, and JavaScript size alone does not establish useful first-load
performance. Also evaluate the complete cold first-use path and the actual core
task, as specified in the standing guardrails.

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

## Second stage: virtual company

Added at the maintainer's request on 2026-11-07. After the current suite work,
center a second stage on a "virtual company": a set of Solid apps that makes it
easy for people to come together, form a temporary collaboration and get work
done. The shared purpose is supporting people working together; the concrete
workflows and app boundaries will be developed when planning this stage.

The initial capability list includes:

- **Project management.**
- **CRM (customer relationship management).**
- **Documentation / knowledge base.**
- **Forms.**
- **Chat.**
- **Live collaboration through data updates.** Changes to shared data made by
  one participant propagate to other participants' open apps, and the relevant
  views update without requiring a manual reload.

This list is open and explicitly not exhaustive. Detailed workflows and feature
sets remain to be defined; these capabilities do not prescribe separate apps
or particular products. Record further capabilities as the maintainer develops
the idea. This establishes stage order without selecting an implementation
cycle, delivery date or technical architecture.

Carry forward the suite's Solid interoperability, native RDF preservation and
moldable design requirements, including readable code that people without a
professional programming background can understand and alter.

### Collaboration through live data and views

The maintainer explicitly defines collaboration here as live updates of shared
data and the views that display it. For example, when one participant changes
a project item, another participant viewing that shared data sees the change
in their open app. Collaborative text editing, such as simultaneous keystrokes
or shared cursors in an editor, is outside this requirement.

Plan the data-change delivery mechanism, access boundaries and handling of local
unsaved edits, concurrent changes and reconnection when selecting implementation
work. Keep native RDF authoritative and use SimplyFlow to update the views.
Future verification should use two participants with access to shared data,
change it in one app and observe the relevant view update in the other without
a manual reload, while preserving pending local edits.

This multi-user capability belongs to the second stage. Automatic synchronization
of one user's data, workspace portability and consistent account information
across their apps remain part of the current suite direction.

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
