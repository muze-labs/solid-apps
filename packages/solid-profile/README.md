# Shared Solid profiles

Experimental `@muze-labs/solid-profile`, used by Contacts and Profile.

The root export provides `readProfile(subject)`, `profileLabel(subject)`,
`applyProfileEdits(subject, edits)`, `fields` and `scalarPredicates`. Subjects
are native OLDM nodes; a read result is a view projection, never the saved graph.
Apply edits only for supplied fields. Unchanged and unknown facts remain intact;
structured-value edits fail before any graph mutation. The caller persists the
returned node/graph. Multiple emails, phones and links use one value per line;
notes retain paragraph breaks.

Compose `src/profile.html` into your page, then mount the SimplyFlow view:

```js
import { profileView } from '@muze-labs/solid-profile/view.mjs';
const view = profileView(container);
view.show(subject, {
  editable: true,
  sourceLabel: 'Private address book',
  async onSave(edits) {
    // Apply/persist in the owning application; show the saved node afterward.
  }
});
```

`profileView(container, { emptyText })` customizes the empty selection message.
`show(null)` clears the selection; `destroy()` removes bindings. The caller owns
selection and storage; the component owns editing drafts and save state. Save
errors remain visible and preserve the draft. Rendered values are plain text.
