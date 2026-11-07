# Moldable Solid Apps

**Design rules for application authors and AI contributors**

A moldable app lets its users change the app they are running. A user can inspect a feature, edit its HTML, CSS or JavaScript, and try the change in the same app. They can also write a new feature or bring one in from another app. SimplyFlow's `simply.app()` definition is the boundary of what the app exposes for editing.

These rules apply to apps built today with SimplyFlow, Metro, oldm and the Solid workspace APIs. They make the future in-app IDE possible.

## Rules for apps today

### Keep the app and its core task approachable

Apply the suite's [standing feature guardrails](solid-apps-roadmap.md#standing-feature-guardrails)
to every new feature: focused app boundaries, local-first/mobile-first design,
accessible core interactions and small meaningful first loads. Consider separate
capability-connected apps for separate user tasks, while keeping each ordinary
workflow coherent. Exposing editable source does not excuse inaccessible
interaction, avoidable network dependence or unnecessary download cost. Keep the source easy for
people to understand and alter rather than using clever code to save bytes.

### Write for the person changing the app

The ultimate goal is for people to alter these apps through the moldable IDE.
The editable code must be understandable to people without a professional
programming background. Exposing an entry is only part of that goal: someone
should be able to read it, follow what it does and find the step to change.
This is a current app-authoring requirement, not work postponed until the IDE.

Use descriptive names drawn from the user's task, straightforward control flow
and named intermediate values when they make a calculation or decision clearer.
Keep inputs, state changes, storage calls and other effects visible. Avoid
clever language tricks, dense expressions and unnecessary layers that obscure
a simple operation. Prefer a clear sequence of steps over saving a few lines.
Use the existing library APIs directly when they express the operation clearly;
readability does not require reimplementing them or wrapping them in new names.

Keep feature entries focused and their context/dependencies explicit. Add short
comments for reasons or constraints the code cannot explain on its own. When a
comment merely decodes a complicated expression, first try rewriting that
expression. Review a typical edit from the user's perspective: can someone
identify the relevant entry and follow the behavior they want to change without
first learning the whole application or a custom abstraction?

### Reuse the Muze library stack

Use SimplyFlow and the other Muze libraries wherever their public APIs
reasonably meet the feature's requirements. Inspect the installed APIs,
documentation and existing suite integration before implementing equivalent
infrastructure. An editable component composes library capabilities with
app-owned policy. Making it moldable does not require copying library internals
into the dataset or creating a parallel implementation.

Keep markup in HTML and let SimplyFlow render dynamic text, lists, attributes
and visibility through its bindings. Use its state, effects, commands, actions,
routes and component composition where they fit. Do not write a content-rendering
routine, assign HTML or construct content DOM when SimplyFlow can reasonably
render it. A function that derives view data and updates SimplyFlow data is
valid; SimplyFlow still owns rendering. Keep build-time template composition
and useful View Source. The native operations listed in `AGENTS.md`, such as
dialog lifecycle, focus and download activation, remain direct browser calls.

For item lists that need filtering, sorting, paging or other supported list
transformations, use SimplyFlow's model feature and its model effects. Keep
app-specific predicates, comparators and model setup in editable feature
entries. Commands and actions change model options, and SimplyFlow binds the
model's resulting view. Do not duplicate the model pipeline in commands or
render/update helpers. The model remains a UI projection; source data and
native RDF remain authoritative.

Have data APIs use the configured Metro transport and the existing session and
document helpers, including for public/anonymous reads. Do not introduce
app-owned `fetch` or `XMLHttpRequest` paths, a second HTTP client, or competing
authentication, token, retry or discovery mechanisms already supplied by the
libraries. Reuse oldm with the suite's oldm-turtle backend for native RDF
parsing/writing, SimplySolid for supported collection workflows, and Solid
Workspace for supported storage and synchronization workflows. Keep app-specific
storage policy in the component's data API or its suite integration.

When a library cannot meet a required contract, identify the public API checked
and the concrete limitation. Keep any bridge limited to the missing behavior
and preserve the library's failure, lifecycle and data-preservation contracts.
Keep app-specific assumptions in the app composition until independent reuse
justifies shared-library work. Consume external libraries through published npm
versions as required by `AGENTS.md`.

### Define features as vertical slices

Use a SimplyFlow component dataset for a feature that a user might want to inspect, change, or reuse as a unit. The dataset can hold the feature's design and interaction logic, including HTML templates, CSS, commands, key bindings, actions, and the app-specific code that uses lower-level APIs such as `solid-workspace`. Include the parts the feature needs. A component can provide behavior without a view.

Choose the boundary per app and component. A contacts list might own filtering and data access, or several contact views might reuse those through another component. Make that choice where the feature is designed.

### Put editable behavior in the app definition

Put app-owned code, markup, and styles in named entries in `simply.app()`, directly or through `app.components`. The running app must expose those entries as the parts a user can inspect and replace. Keep the representation useful as source in its own right, since the IDE may have only the running dataset and no checkout of the original project.

Editable code can use the context SimplyFlow supplies and call names available in public scope. A private module helper can stay private when it serves the implementation. If users need to change what the helper does, put that behavior in an editable entry. In particular, avoid making a replacement function depend on a private module closure that the IDE cannot recreate. Explicit libraries such as Metro and oldm provide callable APIs. Their source lies outside the app's editing boundary.

### Separate commands, actions, and data access

Keep DOM access and UI feedback in commands. Put app behavior and state changes in actions that commands, shortcuts, and routes can reuse. Have actions call the data API for storage operations. Keep details such as HTTP requests and authentication behind the data API or the Solid workspace and transport libraries it uses. These roles can live in the same vertical slice. [SimplyCode architecture](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/README.md#L10-L56)

### Keep examples and tests with the parts they describe

A component can carry sample data for its templates and tests for its commands and actions. Keep these optional and associate them with the relevant named entry. A contact-list template can carry sample contacts, and a filter action can carry a test that uses those or other fixtures. Use fixture data or test doubles for storage calls during tests. [SimplyCode template editor](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/components/component-component-html/componentTemplates/componentComponentTemplate.html#L15-L43) · [SimplyCode action editor](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/components/component-actions/componentTemplates/componentActions.html#L15-L40)

### Register components and wire them into views explicitly

A newly authored or imported slice is a component dataset. Include it in `app.components`. If an existing template or view should offer the new feature, edit that template or view to include it. A component may provide a `start` hook that uses JavaScript's `import()` to load a library when needed.

### Keep originals and apply personal overrides last

Keep the original component definitions and authored source available for
inspection and reuse. A user's personal override layer applies after those
originals and the app's own definitions. Replace a named entry in its matching
section; removing that personal override reveals the previously effective app
or component definition. Do not lose an app-owned default override by restoring
only the component's definition. Use SimplyFlow's existing composition rules;
its current sections include `templates`, `styles`, `actions`, `commands` and
`shortcuts`. A dedicated component versus app-level personal layer remains an
IDE implementation choice.

### Resolve current actions at invocation

A long-lived widget method, host method, callback, timer or event connection
must invoke the current effective action. Do not capture a bound action during
initialization if that would bypass later replacement. Preserve arguments,
return values/promises, SimplyFlow context/error handling and listener cleanup.
Use supported library dispatch; when its API binds at retrieval, a narrow
forwarding callback can resolve `this.actions.actionName` when invoked. Keep
that wiring readable and local rather than adding a second component runtime.
An invocation already in progress continues; replacement affects later calls.

The installed SimplyFlow action table supports assigning a replacement function
and restoring a previously effective authored function. Keep that raw definition
as the original; a retrieved bound callable may already include error handling.
Source metadata exposed through
`view.definition` is separate: changing it alone does not apply runtime edits.
The future IDE must coordinate its personal layer and effective definitions
through SimplyFlow. This contract does not claim a persistent override manager,
automatic model reevaluation or live template replacement already exists.

### Known limitation: build-time composition

The current suite expands shared account/Preferences includes, app titles and
app-specific Preferences markup at build time. The resulting templates are
exposed in the running app; the original include relationships and placeholder
expansion cannot be changed there without rebuilding. Retaining the expanded
source does not make that composition editable at runtime.

The maintainer accepts this boundary for now (2026-11-07). Revisit runtime
composition using SimplyFlow templates and/or fields as part of future
moldability work. No mechanism is selected yet. The present build-time rule
remains in force until that design is revisited; the
[suite roadmap](solid-apps-roadmap.md#deferred-runtime-template-composition)
retains the follow-up.

## The future in-app IDE

The IDE opens beside the running application in the same browser page. A user with some programming knowledge can navigate from the app to a component and then to one of its editable parts. Where an app entry overrides a component entry, show which definition is active and keep the original available to inspect. The IDE also lets the user create a component dataset or import one and add it to the app.

Offer an inspect mode that starts from the running interface. Selecting a control opens the template entry that rendered it and, where the control invokes a named command, lets the user jump to the active command. Show the origin of each entry and any app-level override. [SimplyCode preview backlog](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/TODO#L42-L72)

Let the user preview a draft with sample data and run the relevant tests before applying it. Preview and test code must run without access to the live app's write credentials or write-capable APIs. Keep preview and test state separate from the running app's state. [SimplyCode component preview](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/components/previews/componentTemplates/componentPreview.html#L1-L13) · [SimplyCode test runner](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/base-components/automatic-tests/commands/autoRunTests.js)

Apply valid edits to the running app on explicit save, live wherever possible. For HTML and CSS, the IDE can also offer live updates as the user types, applying an edit when the content is valid. Saving writes app-level changes to local storage, for example the local filesystem or IndexedDB. In a Solid environment, the user's pod is another possible destination.

Export a component in the same editable dataset format the IDE accepts for import. Let the user export the original component or a copy with the app's overrides for that component applied. The exported copy can be imported into another app and wired into a view there. [SimplyCode part persistence](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/components/data-format/dataApi/savePart.js#L145-L195) · [SimplyCode app publishing](https://github.com/SimplyEdit/simplycode/blob/ce16ec7f21bd97e3a6fb1ff04fd25e23f75fed8c/pages/publish/commands/saveAppHtml.js)

If a change causes a runtime error and the IDE is still usable, the user can correct the entry there. Give the IDE controls to reload or reset the app. Also provide a safe reload that skips all local changes and remains reachable when both the app and the IDE fail. Skipping changes lets the user start from the original app and recover their edits separately.

The storage format, dependency loading details, and runtime update mechanism belong to the IDE implementation. The app design depends on the editable parts and SimplyFlow's composition rules.

### Definition history, sharing and upstream changes

The future IDE's undo/redo history tracks definition edits separately from the
app's data history. Undoing a template/action edit must not undo a contact edit,
and app undo must not remove a personal customization. Saving/applying personal
overrides remains separate from optional marketplace publishing and discovery.

Effective template changes need notification to SimplyFlow's rendering runtime,
including when an override is removed, preserving bound working state. The
accepted build-time include-composition boundary still applies until revisited.
Choose the runtime API in that future work rather than implementing a second
renderer in an app.

Retain source origins for inspection and maintenance. An upstream update may
change the original entry beneath a personal override; how to identify its base
version, show that change and recover remains an open design question. Upstream
source maintenance and package publication are separate from runtime IDE edits.

## Reference example

The Contacts app in `poef/solid-apps` exposes the running app as `globalThis.contactsApp`. Its `solidContacts` component groups named HTML templates, CSS, and commands. The filter command sets a model option, while the app entry point defines the filtering effect. This is an example of the available structure and a concrete place to decide what belongs in a slice. [Contacts component](https://github.com/poef/solid-apps/blob/0b38216edcb26c80bad38a18e9585f18199204c5/src/components/solid-contacts.mjs) · [App entry point](https://github.com/poef/solid-apps/blob/0b38216edcb26c80bad38a18e9585f18199204c5/src/contacts/index.mjs)

## Contributor review

- Can a person without a professional programming background follow the editable code and identify a straightforward change, without decoding clever tricks?
- Does the feature reuse the relevant Muze library APIs, with any missing capability documented concretely?
- Does SimplyFlow render all runtime content, and do application HTTP requests use the configured Metro/data APIs?
- Do lists use SimplyFlow models for filtering, sorting, paging and other supported transformations, with editable app-specific rules?
- Can a user find and change each app-owned part of the feature through named entries in the running app?
- Can a replacement run with SimplyFlow's supplied context and the public APIs it calls?
- Can a different command, shortcut, or route reuse the action without depending on the DOM?
- Can another app register the component dataset and explicitly wire it into a view?
- Can an app override a named entry and still inspect or restore the component's original definition?
