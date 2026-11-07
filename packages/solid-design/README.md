# Solid design components

Experimental, private `@muze-labs/solid-design` components for the suite, based on
`@muze-nl/theds`. These are ordinary SimplyFlow datasets with authored styles and
small commands. They add no renderer or component-merging system. Publication
and use beyond the suite require their own review.

Register the components you use in your SimplyFlow app:

```js
import {
  muzeSolidDesignDialog,
  muzeSolidDesignDropdown,
  muzeSolidDesignListDetails
} from '@muze-labs/solid-design';

const components = {
  muzeSolidDesignDialog,
  muzeSolidDesignDropdown,
  muzeSolidDesignListDetails
};
```

The suite loads the-ds base stylesheet. This package supplies the shared layout
and interaction styles through SimplyFlow's `styles` entries. Public entries,
commands, styles and CSS classes carry `muzeSolidDesign` / `muze-solid-design`
prefixes. Existing the-ds classes and variables retain their `ds-` namespace.
Keep app-specific bindings and commands in the owning app.

## Dialogs

Use a native `<dialog class="ds-dialog muze-solid-design-dialog">`. Its form or
content contains `.muze-solid-design-dialog-header`,
`.muze-solid-design-dialog-content` and `.muze-solid-design-dialog-footer`.
Content scrolls within the viewport limit; the header and footer stay visible.
The title is optional; give untitled dialogs an accessible label. A close button
uses `.muze-solid-design-dialog-close` and an accessible name.

Use `actions.muzeSolidDesignOpenDialog(dialog)` and
`actions.muzeSolidDesignCloseDialog(dialog)` for shared native lifecycle motion.
The latter returns a promise that resolves after native close and focus return.
The `muzeSolidDesignCloseDialog` command closes the nearest dialog through that
action. Use it only when closing is safe. Forms that have unsaved work or an in-flight save supply their own
close command; the capability host checks its provider before closing. Opening,
closing and focus remain native browser operations. SimplyFlow renders the
content and binds its state.

## Dropdowns

Add `.muze-solid-design-dropdown` to a the-ds dropdown. Its link/button rows get
consistent full-width targets and clear blue hover, keyboard-focus and current
item styling. Use the-ds markup with a native popover and a prefixed, unique ID.
Use `data-simply-shortcuts="muzeSolidDesignDropdown"` on the dropdown wrapper
to enable Arrow Down/Up on its trigger and rows. Arrows open the native popover,
focus the first/last row and wrap through enabled visible rows. Native Tab,
Enter/Space, Escape and outside-click behavior remains available. Pointer opening
does not force focus onto a row. Hover takes visual precedence over keyboard
focus so only the row under the pointer is highlighted. No second activation
system is needed.

## Lists and details

Add `.muze-solid-design-list-details` to a container with two `.ds-panels-pane`
children, using `.ds-panels-list` and `.ds-panels-details`. On wider screens these
are adjacent panes; on smaller screens they are horizontally scrollable panes
with snap positions. Each pane scrolls independently. List toolbars stay visible
at its lower edge.

A details-pane Back button can use `.muze-solid-design-list-back` and the command
`muzeSolidDesignShowList`. The app's selection command scrolls/focuses its details
pane when appropriate. Lists, details and selection data remain owned by the app;
this component provides presentation and navigation, not a parallel list model.


## Toasts

Register `muzeSolidDesignToast` and mount its `muze-solid-design-toast` template in
the owning app. Initialize `data.muzeSolidDesignNotice` to
`{ text: '', visibility: { hidden: '' } }` and provide `runtime: {}`. Call
`actions.muzeSolidDesignNotify(text)` for nonessential completion confirmations.
It replaces the current notice, announces through a polite atomic status region,
and expires after eight seconds unless hovered/focused. Dismissal is labelled;
keyboard dismissal returns focus to the previous control. Destroying the instance
clears its timer and listener. Plain text is escaped by SimplyFlow.

Keep essential information, errors and recovery actions available inline rather
than timing them out. Mount an instance within a modal for feedback from that
modal; content outside a native modal is inert. The suite supplies `host.notify`
for ordinary app confirmations and a separate Preferences instance. No toast
animation or automatic focus change is used. This is a latest-notice surface,
not a persistent notification inbox.


Shared dialogs use 300ms fade/scale and native backdrop animations; reduced
motion skips them. Native modality remains until closing finishes. Simple dialogs
can opt into animated Escape with
`data-simply-behavior="muzeSolidDesignDialog"`. Guarded capability dialogs keep
their own cancel listener and invoke the shared close action only after permission
to close is established. Fullscreen phone layout applies below 720px. Native Web
Animations fills Firefox's missing CSS deferred-overlay transition support;
no dialog method is patched and no backdrop DOM is constructed.
