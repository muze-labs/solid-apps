# Including moldable app structure in the refactor

Current disposition: the maintainer subsequently authorizes applying the
established pattern across the whole suite, without a separate proof/pilot gate.
CYC-20261107-QG24H-37 is Active and SRC-20261107-QG24H-38 retains that commitment.
Earlier proposed gates below are historical planning, superseded by that direction.

Date: 2026-11-07. Investigation against main
`45cf58e4fedbfdeea3ccfad4ee2e647bbea48d48`.
Status: planning evidence and proposed scope, not cycle acceptance or an
implementation commitment. The maintainer explicitly requested investigating
whether the moldable design can accompany the stack-consistency refactor.

## Finding

Include the app-authoring foundations in the same proposed refactor. Moving
list behavior into SimplyFlow models is also the right point to expose its
setup, predicates, comparators and commands as editable feature entries.
Splitting commands, reusable actions and data APIs twice would duplicate work.
The required structure is broader than moving functions between files: behavior
must be reconstructible without private closures, and its sources and originals
must remain available through the running app.

This does not establish complete IDE readiness. Installed library composition
supports initial overrides, but live removal and mounted template replacement
need explicit resolution. Do not hide those gaps behind an IDE-ready claim or
silently build an alternative framework to close them.

## Sources and current effective gaps

- `design/Moldable-Solid-Apps.md` defines the app-authoring rules and separately
  describes the later IDE. The suite roadmap expands the app-authoring coverage
  to all four apps, the shared account shell, Preferences and profile editor.
- The prior poef/solid-apps reference at verified GitHub HEAD
  `0b38216edcb26c80bad38a18e9585f18199204c5` already registers component datasets,
  wires named views, changes model options from commands, and uses jaqt in model
  effects. Its explicit component-start loop is evidence that initialization
  orchestration was app-owned there, not proof that today's library runs hooks.
- Current entry points and shared view factories close over state, DOM handles
  and helpers. Public `solid*` handles expose runtime objects rather than complete
  editable definitions. HTML is composed and CSS copied by `scripts/build.mjs`;
  neither is exposed as a named runtime source dataset.
- Installed simplyflow-app 0.10.3 uses `templates`, `styles`, `shortcuts`, `data`
  and app-level `start`. It retains `components` but omits top-level templates
  and styles from the runtime instance. Component `start`/`onError` are skipped
  during merging. Its public custom-option properties can expose explicit APIs
  and definitions without changing library internals.

Relevant library files:

- `node_modules/@muze-labs/simplyflow-app/src/index.mjs`, SHA-256
  `d4e253d2bc893f1225464213b6d43cf0153063bf3ccd0003d123c82ed35482f2`.
- `node_modules/@muze-labs/simplyflow/src/render.mjs`, SHA-256
  `99200c5a273cb4a940286686098b481c75408a12a60a5c42138c299e4c9ce58b`.

## Disposable Chrome characterization

The investigation bundled the installed app layer and its existing simply-render
element with Rollup, then served a static local HTML fixture to Chrome through
the repository's Chrome harness. It used no Pod, tokens, real account or product
changes. Files remain at `/tmp/solid-apps-moldability-probe/probe.mjs` and
`/tmp/solid-apps-moldability-probe/result.json`; temporary files are not durable
repository tests. Syntax checking and all characterization assertions passed.

| Contract | Observed result | Consequence |
| --- | --- | --- |
| Initial app-level overrides | Template, style, command, action and shortcut entries select app-level values. The inspected original component template/action remain intact. | Use library composition directly. Broader preservation across nested entry kinds still needs real-feature tests. |
| Behavior reconstruction and reuse | A component command/action reconstructed from their source ran against a second app's explicit API. It changed only the second app; the first draft/message remained intact. | Functions using supplied `this` and explicit APIs can be portable. This synthetic probe does not prove current app closures are portable. |
| Source retention | Runtime `templates` and `styles` own properties are absent. | Retain authored definitions and readable source explicitly; do not treat bound runtime methods or minified function text as sufficient source. |
| Initialization | App start ran once; component start ran zero times. | Compose initialization explicitly through supported app lifecycle/actions or resolve the precise upstream contract. Do not assume automatic hooks. |
| Live deletion of overrides | Deleting command/action/shortcut properties left them undefined. Removing template/style entries from authored overrides left the current DOM/style unchanged. | Deletion is not a live fallback mechanism. Define supported reapplication/recomposition before claiming override removal works. |
| Destruction | After destroy, the fixture button no longer invoked its previous command listener. | Command cleanup works for this fixture; model effects, behaviors, routes and real feature resource cleanup need further verification. |
| Recreating the app | Recreating with only the component restored the original action, installed template definition and CSS. Already mounted template content still displayed the prior override. | Reconstruction handles some definitions but does not refresh already rendered template clones. Mounted-template replacement remains a concrete integration gap. |

The probe characterizes current behavior, including failures to satisfy the
desired future contract. It does not endorse all observed behavior or establish
that supported solutions are impossible. Route/behavior/transformer overrides,
minified source round trips, actual app state restoration and complete lifecycle
cleanup were not tested by this fixture.

## Proposed combined scope

**Goal:** Refactor the existing suite into inspectable, reusable SimplyFlow
feature datasets while consistently using models/jaqt, configured Metro and the
native-RDF data APIs. Include the design's rules for apps today. Keep the IDE
itself as future work.

For each feature, include named templates/styles, commands, actions, model policy
and initialization entries where needed. Register the feature in `app.components`
and explicitly wire its view. Keep DOM input/native operations in commands,
reusable behavior in actions and persistence policy behind explicit data APIs.
Expose the running app, originals, overrides, readable source, origins and
documented dependencies. Optional sample data/tests can accompany named entries.

| Area | Candidate feature boundaries |
| --- | --- |
| Contacts | List/search/selection, create/delete, inline shared profile editor. |
| Files | Folder navigation/list, upload/download/folder creation/deletion, resource selection. |
| Launcher | Shortcuts and launch settings, resource request, workspace controls. Keep broker authority and checkpoint mechanisms behind explicit APIs. |
| Profile | Resource loading, own-profile selection, shared editable profile view; app-specific persistence policy remains outside the view. |
| Shared UI | Account/connection/status, Preferences common and app-specific entries, shared profile view/editor. Defaults stay inspectable and app-overridable. |

Generate runtime HTML/CSS entries from the same authored files used for build-time
composition. Keep meaningful View Source. Retain authored behavior source before
bundling/minification and document its public dependencies; reconstruction must
not depend on renamed module bindings or hidden closure state. This may require
targeted build changes, without changing the accepted bundle ownership/budget
contracts. Library implementation remains outside the editable app boundary;
suite-owned policy and wiring must not be hidden behind opaque service wrappers.

## Early proof and decision boundary

Use Contacts list/search/selection as an internal first step in the combined
cycle, not a separate required acceptance cycle. Prove source reconstruction,
initialization/cleanup, original-versus-override inspection, removal/reapplication,
template/style/behavior changes and second-host reuse before repeating the
structure across the suite. Include shared-component/app-specific overrides.

Resolve the observed runtime gaps through supported SimplyFlow APIs and only
narrow app-specific source/lifecycle integration. A retained source descriptor is
not a new renderer or override engine; it must leave composition to SimplyFlow.
Do not assume destroy/recreate preserves mounted templates or live drafts: the
probe explicitly shows the template issue, and real draft retention still needs
evidence. If required semantics need library changes or a general replacement
composition layer, report the exact gap and replan. Upstream changes require
separate scope and a published npm version. No other repository changes are
authorized by this investigation.

Full IDE implementation remains excluded: editor UI, inspect-mode UI, persisted
user edits, import/export management, credential-isolated previews and safe
reload controls. Source reconstruction/reuse/override tests are app readiness
evidence and remain in scope even though those IDE facilities are deferred.
Failed readiness checks must stay explicit; partial structural conversion alone
does not make an app ready for the IDE.

## Evaluation basis

In addition to existing functional, browser, RDF preservation and bundle checks:

- Reconstruct replacements from exposed source with documented dependencies in
  production/minified as well as readable builds.
- Inspect originals and app overrides; replace/remove supported named entry
  kinds and observe the effective behavior, including mounted content.
- Register a real slice in a second host with a data API double and explicit
  view wiring; exercise actions without DOM dependencies.
- Change model options and source data without mutating authoritative RDF;
  preserve IDs, selection, pending drafts, failure recovery and unknown RDF.
- Verify initialization/cleanup and repeated application without duplicate
  listeners/effects or silently changing auth, lifecycle or storage policy.
- Keep every app's complete JavaScript graph below 200000 B gzip; measure retained
  source overhead, do not infer size compliance from today's smaller bundles.

These are proposed criteria. The investigation changes documentation only;
implementation still requires confirmation of the combined goal and its cycle
branch/record under the repository's existing Spiral rules.
