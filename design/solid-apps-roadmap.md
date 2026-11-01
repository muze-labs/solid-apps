# Solid Apps roadmap

Status: maintainer-requested direction, recorded 2026-11-01. Implementation is
deferred to future cycles; this update selects no next cycle or delivery order.
All conversation and project documentation should use English.

This records suite-wide direction alongside the
[capability-broker roadmap](solid-capability-broker-roadmap.md), which continues
to govern broker implementation. The broker phases do not schedule every app
or product improvement below. The accepted launch-context cycle was merged
into `main` as `c906322`; the items below are future work, not implemented claims.

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
  the current WebID. This is the requested account-specific extension to the
  existing shared header; general app navigation remains in Launcher.
- After the user changes their name, update the displayed name immediately in
  all already-open suite apps, without requiring reload or reconnect. Native
  profile RDF remains authoritative. Propagating the same user's profile change
  between apps is part of account consistency, independent of the deferred
  collaborative-editing feature.

The communication mechanism and behavior across origins remain design choices.
A future verification should open several apps, change the name in Profile,
and observe each header update without rewriting unrelated profile data.

## Mobile first and JavaScript budget

Design and validate core workflows on mobile first, preserving the suite's
existing visual language and supporting larger screens as well.

Target: **less than 200 KB of gzipped JavaScript per app**. Measure the app and
its required shared dependencies together; a small entry file alone does not
establish compliance. Define the reproducible gzip measurement and workflow
coverage when planning enforcement. Record current sizes before optimizing;
this document does not claim that the current build meets the target.

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

Git repositories are a possible publication mechanism, not a selected
requirement. Decide the smallest useful catalog representation, how a supplied
URL resolves to it, and how updates and duplicate entries work in a future
cycle. App descriptions should fit the existing launch contract and capability
declarations. Catalog discovery and a user's preferred capability-provider
registry have separate responsibilities; a listing does not grant Pod access.

A future verification should add two independent catalog URLs, discover and
add app links from both, and retain the other source when one is unavailable
or removed. This is a planned suite feature beyond the initial broker proof.

## Source inspection and planning boundary

The maintainer supplied the roadmap requirements directly. GitHub pages could
not be retrieved during this update. Existing local sources were inspected
read-only:

- `poef/zett` at `014a8887568482d185fadd48442372d0e7e2afaa`: committed
  `package.json`, `src/app.mjs` and `www/index.html`. The checkout contains
  unrelated user changes; those were not used as the historical baseline or
  modified. The separate `muze-labs/zett` version remains uninspected.
- `muze-labs/cobalt-note` at `32c86bbfcc015390ad5479abde75e9e9695c57b6`:
  README, notebook package metadata, exports and note-type API documentation.

This documentation-only update is on `docs/solid-apps-roadmap`, outside an
implementation cycle. No dependencies, runtime behavior or build checks are
changed. Before selecting the next cycle, reconcile this direction, the broker
phases and retained workspace work with the maintainer's priorities.
