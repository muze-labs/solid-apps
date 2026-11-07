# Roadmap and next-cycle assessment

Current disposition: the maintainer subsequently authorizes applying the
established pattern across the whole suite, without a separate proof/pilot gate.
CYC-20261107-QG24H-37 is Active and SRC-20261107-QG24H-38 retains that commitment.
Earlier proposed gates below are historical planning, superseded by that direction.

Date: 2026-11-07. Inspected baseline: main at
`45cf58e4fedbfdeea3ccfad4ee2e647bbea48d48`. The working tree was clean.
Status: **Refactor direction selected; concrete scope awaiting confirmation**.
The maintainer redirected the Contacts pilot toward consistent stack usage,
then supplied poef/solid-apps as a reference and clarified that jaqt should be
combined with SimplyFlow models when it simplifies the code. They subsequently
requested investigating inclusion of the moldable app-authoring structure.
The [feasibility investigation](moldability-refactor-investigation.md) recommends
including it, with an early real-feature proof and explicit runtime gaps.
This supersedes the earlier Contacts-only recommendation and the subsequent
proposal to defer all moldability structure. This planning note does not
open a cycle, authorize product implementation or record human acceptance.

## Current roadmap position

The [broker roadmap](../design/solid-capability-broker-roadmap.md) governs broker
work; the [suite roadmap](../design/solid-apps-roadmap.md) adds independent product
direction without a delivery order. Reconciled with current main:

- Launch context and the revised Phase 1 browser-local broker/picker are merged.
  Built-in Files starts on demand, but this is only a bounded part of Phase 2.
- Phase 0's full exit is not established: browse has a concrete contract;
  select-recipient and the durable provider description/registry remain open.
- Phase 2 still lacks a Pod-backed preferred-provider registry. The current
  picker selects one allowed instance or falls back to built-in Files. Multiple
  eligible instances fail explicitly rather than establish a preference.
- Phase 3's recipient picker and independent-provider/client replaceability
  demonstration remain future work.
- Preferences CYC33 and shared/minified bundles CYC34 are Accepted and merged.
  The common/app split is implemented. The size budget has substantial headroom.
- Moldable features, named workspaces/dashboard, account consistency, reduced
  authentication challenges, full offline/automatic sync, PWA, catalogs, Zett
  and Notebook remain future work. No order among these is human-confirmed.

## Candidate risks and evidence limits

These are planning findings, not a claim of a comprehensive security audit or
maintainer-approved priorities. Apply the adopted regression, usability/recovery
and RDF/privacy/authority lenses. WPF-HUMAN-001's evidence and composition signals
matter here: green fixture tests do not establish live authentication or the
absence of intermittent failures.

| Concern | Evidence and consequence | Useful disposition |
| --- | --- | --- |
| Moldability depends on an unproven runtime contract | Contacts' `render()` manually filters/sorts and commands close over private state. Installed simplyflow-app 0.10.3 installs templates/styles without retaining those source sections, skips component start hooks, and merges component/app options. Source retention, override removal and repeatable lifecycle cannot be assumed from initial composition. Converting all apps before checking this could spread incompatible wiring. | Prove one real feature with reconstruction, overrides and reuse before broad conversion. These source observations establish a gap, not proof that all supported solutions are impossible. |
| Account changes share local collections | `openCollection()` uses IndexedDB `solid-apps` and a collection-name key, without WebID partitioning. README explicitly documents shared Contacts/shortcut stores. This risks presenting another account's local records or attaching them to a different Pod during explicit sync. No accidental disclosure or wrong-account write was reproduced here. | Characterize two-account connect/sync/reload before broader multi-account use; confirm the intended ownership/recovery policy before changing it. |
| Child logout conflicts with the requested workspace boundary | Shared shell logout removes the origin-wide remembered WebID; its storage listener logs out and reloads other same-origin apps. The browser suite explicitly expects Contacts logout to disconnect Launcher. The roadmap instead requests that child logout leave Launcher/siblings/workspace open. Managed-child lifecycle consequences and cross-origin behavior need a targeted probe. | A separate workspace/account lifecycle cycle is a credible alternative; retain local drafts and define checkpoint/auth ordering. Do not claim the requested boundary is already satisfied. |
| Workspace recovery has intermittent failure evidence | EVD30 and CYC34 retain readiness/conflict-review timeouts. Later passes do not identify their cause. Extra named-workspace or automatic-sync transitions could make diagnosis harder. | Preserve the failure evidence; add targeted timing/diagnostic investigation when changing these paths. A fresh pass alone cannot close this concern. |
| Provider choice and authority are not yet portable | `chooseFiles()` uses live/saved instance permissions and a built-in Files fallback; there is no linked preferred-provider registry. Future manifests/catalog entries must not silently grant invocation or Pod authority. | Continue broker Phase 2 with explicit user choice, native RDF preservation, validated launch mapping and blocked-popup/cancellation handling. Catalog listing stays separate. |
| Live-provider and offline guarantees are bounded | Chrome fixtures replace authentication. Earlier maintainer evidence establishes solidcommunity.net connection/sign-in, not every write/close/refresh/redirect flow. Contacts explicitly syncs; Files browses through its session. There is no demonstrated complete offline app shell or automatic app-data synchronization. | Investigate valid Metro authorization scope before optimizing 401s; define per-app offline/conflict workflows before adding background sync/PWA claims. |

Native RDF correction is implemented on main and covered by preservation tests.
Do not report the old JSON snapshot implementation as current merely because
DEF18's companion status still says Active. Some context/evidence documents also
retain historical pending-status prose; current acceptance records and Git
ancestry establish the merged cycle position. Documentation reconciliation is
separate from claiming a new product defect.

## Reference inspection

GitHub HEAD for `https://github.com/poef/solid-apps.git` was verified read-only
with `git ls-remote` as `0b38216edcb26c80bad38a18e9585f18199204c5`, matching
the local checkout at `/home/auke/git/poef/solid-apps`. GitHub web retrieval failed;
committed source was read with `git show HEAD:<path>`. That checkout has unrelated
uncommitted work, which was inspected separately as current local evidence and
was neither changed nor attributed to the published commit.

At that committed version:

- `src/contacts/index.mjs:27` constructs the model, then uses state effects with
  jaqt `select`, `orderBy`, `where` and `groupBy`; a Metro JSON API supplies data.
- `src/components/solid-contacts.mjs` groups named templates, styles and commands.
  Templates bind `contacts.view.current`; its filter command updates only
  `model.state.options.filterBy`.
- `src/contacts/www/index.html` explicitly wires the component views into panels.
- App actions, state, API and registered components are exposed together through
  `globalThis.contactsApp`.

These establish the intended composition pattern, not a requirement to copy old
API names or behavior. Current packages use `templates`, `styles`, `data` and
`start`, rather than the old `html`, `css`, `state` and `hooks.start`. Current
native-RDF preservation and storage/authorization contracts remain authoritative.
In particular, old derivations that mutate contact objects must become UI
projections rather than changes to authoritative native RDF.

## Proposed next cycle: stack consistency and moldable feature datasets

**Goal / Understanding:** Refactor the existing four apps and suite-owned shared
code to consistently use the adopted stack: SimplyFlow renders content and owns
transformed UI-list models; jaqt expresses object-array queries where it simplifies
the code, including inside model effects; configured Metro/data APIs own HTTP.
Include named feature datasets, explicit actions/data APIs, inspectable source,
originals and app overrides as specified for apps today in the moldable design.
Preserve current user workflows, drafts, native RDF and conditional writes.

**Current effective behavior / evidenced gaps:**

- Contacts uses a manual person/search/filter/sort pipeline in its view update
  helper. Files filters tombstoned entries before binding them. Launcher filters
  shortcut types in its update helper. The shared profile view filters visible
  detail fields. These are candidates for model-owned projections.
- Picker/provider routing and workspace code use additional app-owned object
  queries. Review these for direct jaqt use, independently of UI-list models.
  Prefer supported RDF graph APIs for RDF operations; using jaqt must not flatten
  graphs or change preservation/identity semantics.
- The inspected runtime apps/packages contain no app-owned `fetch` or
  XMLHttpRequest path and no manual HTML/text content writes. Profile anonymous
  reads already use `createSolidMetroClient`; Files passes `session.client` into
  SolidAdapter and downloads through that client. The temporary download anchor
  is the authorized native-operation exception. Do not invent renderer/HTTP
  rewrites where the current composition already satisfies the rule.
- jaqt 0.10.7 is installed transitively. Declare a published direct dependency
  in packages that start importing it rather than relying on hoisting.

**SimplyFlow/jaqt compatibility probe:** A disposable Node probe verified that
jaqt `where().orderBy().toArray()` preserves frozen input order and row identity,
and queries inside model effects react to search-option changes. An initial
probe falsified the assumption that replacing `model.state.data` automatically
updates the constructor's captured first input. A public `addEffect` source
effect reading `this.state.data` before downstream query effects supports source
replacement and insertion as well. The corrected probe passed all those checks.
This is integration evidence, not permission to modify library internals or a
claim of browser rendering coverage.

**Why now:** The maintainer selected refactoring before further feature work.
It removes parallel list/query logic and establishes how the stack is composed
before extending the apps. Their subsequent moldability investigation request
shows why doing component/behavior boundaries together avoids extracting the same
features twice. Source reconstruction and override behavior are app-readiness
criteria; implementation of the future IDE remains excluded.

**Plan continuity:** **Deliberate deviation** from broker progression for one
refactor cycle, continuing the suite's adopted library/model/rendering rules.
Broker phase order is unchanged.

**Likely work:** Audit the four apps and shared packages against the rules;
replace manual transformed-list pipelines with supported SimplyFlow model
effects/options; use jaqt within effects or other object-array queries where
clearer; keep command input/native UI handling separate from reusable actions
and data APIs where the touched behavior requires it. Preserve build-time HTML
composition and existing visual language. Package app-owned features and shared
UI as named datasets; derive runtime template/style entries from the same source
files; retain portable behavior source and explicit dependencies. First prove
the intended structure with real Contacts list/search/selection and its reuse,
then apply the verified pattern across the suite. See the investigation for
per-app coverage and observed library limitations. Do not mechanically replace
primitive array operations, independent test assertions or library internals.

**Evaluation basis:** Existing search/sort/selection, shortcut, profile, picker,
workspace and Preferences behavior remains observable and preserved. Verify model
option changes, source replacement/insertion, empty results, stable identities,
selection and draft retention, initialization/cleanup, and no mutation of native
RDF by projections. Exercise affected data actions without DOM dependencies and
preserve failure/conditional-write/unknown-RDF contracts. Run `npm run check`,
`npm run test:browser`, full bundle budgets/ownership checks, and applicable
Spiral validation on the dedicated branch. Also verify named source reconstruction
in minified/readable builds, originals/overrides and their removal/reapplication,
second-host reuse and complete source retention, as detailed in the investigation.
Do not claim full IDE readiness while any required app-authoring check fails.
Maintainer evaluation remains separate
from test results. A code scan complements behavioral checks; it is not a proof
that the effective system has no indirect HTTP or rendering violations.

**Non-goals:** IDE facilities (editor, persisted edits, preview isolation,
import/export management, inspect-mode UI and safe-reload controls), new rendering/query frameworks,
new app features, provider registry, recipient picker, account-store partitioning,
logout-policy changes, named workspaces, catalogs, automatic sync/PWA, Zett and
Notebook. Build work is limited to dependencies, single-source runtime datasets
and source retention necessary for this refactor; no new bundler redesign.

**Pause/replan:** Return to the maintainer if a required contract cannot be met
through supported APIs and a narrow app bridge, or if a change would alter storage,
authorization, RDF semantics or user-visible product policy. Record concrete
library gaps, especially source retention, component initialization and live
override/mounted-template replacement. If those require upstream work, replan
before repeating an unsupported structure across the suite. Other repositories
and publication remain outside this work.

**Cycle sizing:** Consistent stack composition across the existing suite is the
selected coherent maintenance outcome; moldable feature structure extends that
proposal in response to the maintainer's latest investigation request. Work in
small verified steps internally;
do not add separate feature goals merely because adjacent gaps are found.

After maintainer confirmation, allocate a CYC identity with the Spiral CLI,
create its matching dedicated branch from accepted main, verify the actual
branch, and record commitment/scope before implementation. No ID or human
approval is invented by this note.

## Fresh baseline verification

- `npm run check`: passed all eleven test files and the four-app build.
- Minified complete app graphs including callback: Launcher 95486 B, Contacts
  86278 B, Files 87733 B, Profile 86214 B; each below 200000 B.
- `npm run test:browser`: passed all three Chrome suites (general apps, managed
  workspace and cross-origin picker) against production minified entries.
  The initial sandboxed attempt could not listen on localhost (`EPERM`); the
  authorized rerun outside that restriction completed successfully. This was an
  environment failure, not evidence of a product defect. The fresh pass does not
  establish a cause or fix for the previously retained intermittent failures.
- `git diff --check`: passed again after the reference-inspection update.
  Changes remain documentation-only: this note and the clarified
  jaqt/model policy in root AGENTS.md.

Checks use repository fixtures and do not access the maintainer's Pod. No product
source, dependency or build configuration is changed by this assessment.
