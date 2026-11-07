# Solid Workbench moldability and readability review

Review date 7 November 2026  
Repository `muze-labs/solid-workbench`  
Reviewed commit `71d2737d5e7203188f503b50d184d606556f2c8f`

## Assessment

Solid Workbench has a credible foundation for a future runtime IDE. Its named feature datasets, explicit dependencies, retained function source, and SimplyFlow composition provide much of the necessary structure. Several current patterns still make live replacement incomplete or make useful behavior difficult to find.

Readability is uneven. Small Contacts actions are approachable for someone with modest programming knowledge. Workspace coordination and lifecycle code demand substantially more understanding. This judgment comes from code inspection and tracing representative edits. It has yet to be evaluated with non-professional programmers.

The review uses the agreed design in which the end user makes personal overrides in a layer loaded last, original components remain available, and SimplyFlow or lower-level libraries own listeners and live rendering updates. Marketplace publishing is a separate concern.

## Existing strengths

- **Named features give the IDE useful entry points.** Contacts separates list behavior, editing, and session initialization into registered components. Its exposed app handle provides access to the running instance.
- **Editable functions use explicit context.** Most inspected feature entries reach dependencies through `this.api`, other actions through `this.actions`, and working state through `this.data` and `this.runtime`.
- **The build retains authored source.** The `?entries` build mechanism records readable function text and source locations before minification. `exposeDefinition()` exposes components, source metadata, and app-level definition entries.
- **There is relevant test coverage.** Feature tests exercise model filtering and draft preservation. The browser harness contains a test that reconstructs Contacts actions from retained source and mounts them with a template override in another host.

[Contacts composition](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/apps/contacts/src/index.mjs) · [Source extraction](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/scripts/templates.mjs) · [Definition exposure](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/packages/solid-app-data/src/definition.mjs) · [Feature tests](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/test/features.test.mjs) · [Browser source reconstruction test](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/test/support/features.mjs)

## Findings and recommendations

### 1. Captured action references can bypass later overrides

**High priority for live replacement.**

`profileView()` returns a widget whose `show`, `draft`, `restoreDraft`, and `destroy` properties hold action references captured during initialization. The shell similarly copies actions onto `host`. Workspace construction also passes actions directly as callbacks.

The installed `@muze-labs/simplyflow-app` 0.10.3 binds an action when it is retrieved. Replacing the action afterward leaves previously captured references pointing to the old function. For example, replacing `showProfile` would update direct calls through `view.actions.showProfile`, while an existing widget's `show()` still invokes the previous function.

A focused Node probe using the installed action proxy reproduced this behavior:

```javascript
const widget = { show: owner.actions.showProfile };

owner.actions.showProfile = function () {
  return 'override';
};

owner.actions.showProfile(); // 'override'
widget.show();               // 'original'
```

**Recommendation.** Define how long-lived callers reach the current action. This can be handled by stable callable references in SimplyFlow, or by resolving the action at invocation in the app's bridges. For example, a bridge can call `view.actions.showProfile(...args)` inside a forwarding function. Check widgets, host methods, registered callbacks, and listeners together.

Verify that an already-running instance uses a replacement and returns to the original behavior after the override is removed. The probe establishes the reference-capture problem; browser integration still needs verification.

[Profile widget](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/packages/solid-profile/src/view.mjs#L74) · [Shell action copies](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/packages/solid-app-ui/src/index.mjs#L145) · [Workspace callbacks](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/apps/launcher/src/components/workspace-controls.mjs#L121)

### 2. App-owned CSS is only partly represented in component datasets

**High priority for meaningful visual editing.**

The shared `packages/solid-app-ui/src/style.css` contains 744 lines, including Contacts, Profile, and workspace rules. The build copies it directly to `apps.css`. Those rules are available as stylesheet source, but they lack the named component entries used by the proposed IDE.

A user can inspect the Contacts list template and actions while still needing to discover a separate shared stylesheet to change its appearance. Some design components already demonstrate the intended pattern by importing CSS into named `styles` entries.

**Recommendation.** Put app-owned style rules into the relevant component's `styles` entries. Keep genuinely shared app styling in a named shared component and continue using external design libraries through their public interfaces. Preserve stylesheet order and cascade behavior during the change.

Verify a visual override and its removal through the same definition mechanism used for other component parts.

[Shared CSS](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/packages/solid-app-ui/src/style.css#L213) · [CSS copying in the build](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/scripts/build.mjs#L24) · [Existing named styles](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/packages/solid-design/src/components/list-details.mjs)

### 3. App lifecycle code still owns event registration

**Priority for enforcing the agreed runtime boundary.**

Launcher registers and removes `beforeunload` and `pagehide` listeners. Account lifecycle does the same for `storage` and `hashchange`. Both capture action references during initialization.

Cleanup is present. The remaining architectural issue is ownership. The agreed design assigns listener registration and cleanup to SimplyFlow or the appropriate lower-level library.

**Recommendation.** Identify the missing public binding capability and implement it at that lower layer. Components should declare which action handles the event. Define replacement behavior alongside registration and cleanup so a live edit reaches existing bindings.

Verify one delivery per event, current-action dispatch after replacement, and cleanup when the app is destroyed.

[Launcher lifecycle](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/apps/launcher/src/components/lifecycle.mjs#L75) · [Account lifecycle](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/packages/solid-app-ui/src/components/account-lifecycle.mjs#L45)

### 4. Some editable entries remain difficult to understand

**Priority for end-user usability.**

The smaller Contacts entries have clear names and short sequences of steps. `matchesPerson`, `setSearch`, and `saveContact` provide plausible starting points for meaningful changes.

Workspace controls contain denser decisions and more coordination. `renderWorkspace()` expresses status through nested conditional expressions. `createWorkspace()` combines provider choices, persistence state, authorization callbacks, and broker construction.

**Recommendation.** Simplify particular edits users are likely to make. A named `workspaceStatus(record)` action would expose the status decision in straightforward control flow. Keep infrastructure behind existing library APIs and give app-owned choices clear editable names. Introduce an entry when it makes a meaningful change easier to locate.

[Contacts list actions](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/apps/contacts/src/components/contact-list.mjs#L41) · [Contact editing](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/apps/contacts/src/components/contact-editing.mjs) · [Workspace controls](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/apps/launcher/src/components/workspace-controls.mjs#L101)

### 5. The repository design needs reconciliation with subsequent decisions

The repository adds useful readability requirements and explicitly records an accepted limitation around build-time template composition. It retains earlier override wording and omits the later decisions about the final personal override layer, separate IDE undo history, template-change notifications, marketplace separation, and upstream-version concerns.

**Recommendation.** Reconcile the repository document with those decisions while preserving its newer project-specific additions. This gives future AI contributors one consistent set of rules.

[Repository design](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/design/Moldable-Solid-Apps.md) · [Roadmap](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/design/solid-apps-roadmap.md)

## Representative changes from an end user's perspective

| Desired change | Current entry point | Assessment |
| --- | --- | --- |
| Change how Contacts matches a search | `contactList.actions.matchesPerson` | Small and understandable. Live application of the edit still needs to trigger model reevaluation. |
| Change what happens when a contact is saved | `contactEditing.actions.saveContact` | Clear sequence of data update, save, refresh, selection, and feedback. |
| Change the Contacts list appearance | `contactList.templates` plus shared CSS | Template is discoverable. Style ownership needs improvement. |
| Change a workspace status label or condition | `workspaceControls.actions.renderWorkspace` | Discoverable after tracing the feature, but the nested expression adds unnecessary effort. |
| Change profile display behavior live | `profileDetails.actions.showProfile` | Entry is exposed. Captured widget references prevent all callers from following a replacement. |

## Planned work and accepted limits

The runtime IDE, personal override persistence, and live template update mechanism remain future work. `exposeDefinition()` currently supplies metadata; assigning an entry in that metadata does not by itself implement live replacement.

The repository explicitly accepts build-time template composition for now. Expanded templates are exposed, while changing the original include structure requires rebuilding. Retain this as a tracked limitation during the review.

[Definition metadata](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/packages/solid-app-data/src/definition.mjs) · [Accepted composition boundary](https://github.com/muze-labs/solid-workbench/blob/71d2737d5e7203188f503b50d184d606556f2c8f/design/Moldable-Solid-Apps.md)

## Recommended order

1. Reconcile the design documents so implementation follows the current decisions.
2. Resolve current-action dispatch for long-lived references.
3. Expose app-owned CSS as named component entries.
4. Move app lifecycle listener ownership to the appropriate lower-level APIs.
5. Review readability through concrete user edits, beginning with workspace status and feature configuration.

Use a small live-edit acceptance scenario for each change. Check behavior in an existing instance, restoration of the original, and preservation of working data.

## Verification

| Check | Result |
| --- | --- |
| Repository revision | `71d2737d5e7203188f503b50d184d606556f2c8f` |
| `npm run check` | Passed, including 107 tests and the production build |
| JavaScript size checks | Passed the repository's 200 KB gzip budget for all four apps |
| Captured-action probe | Reproduced old behavior through an existing reference after replacing the action |
| Browser integration suite | Unverified because Chrome was unavailable in the review environment |
| End-user readability | Evaluated through source inspection and representative change paths; user testing remains outstanding |

The review covers the suite's composition, representative feature datasets, source-retention mechanism, relevant installed SimplyFlow behavior, and existing tests. It supports the findings above; full interactive verification of every app remains future work.
