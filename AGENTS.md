# Solid Apps engineering rules

This is the Muze-owned Solid Apps monorepo. It explicitly adopts:

- [Muze architecture philosophy](ARCHITECTURE-PHILOSOPHY.md).
- [Muze engineering culture](https://github.com/muze-labs/spiral-developer/blob/main/cultures/muze-engineering.md).
- [Muze library stewardship](https://github.com/muze-labs/spiral-developer/blob/main/cultures/muze-library-stewardship.md)
  for our shared packages and developer tooling.
- [Maturity policy](https://github.com/muze-nl/.github/blob/main/maturity-policy.md).

Use SimplyFlow exclusively for runtime content rendering. Keep markup in HTML
and bind dynamic text, lists, attributes, visibility and commands through
SimplyFlow. Escape plain text with `escape_html`; list command values use
`:value.id` (or another item property). Do not add a second renderer or manually
build content DOM. Templates are composed at build time so View Source stays useful.

Native operations which are not content rendering remain direct: dialog/popover lifecycle,
focus, form reset/file selection, download activation, and document-wide language,
theme and text-size settings. Add exceptions only for a concrete browser need.

Keep native RDF authoritative. UI projections and edit drafts must not replace
shared graphs. Preserve unknown terms, multiple values, identity, and other
subjects. Refuse unsupported structured edits rather than flattening them.
Profile editing is shared by Contacts and Profile; storage policy stays outside
the profile view. Preferences use the profile's `pim:preferencesFile` link.

Turtle is the native persistence format for Solid Apps. Never write a string
containing JSON inside a Turtle file, under any circumstances. This includes
`rdf:JSON` literals, escaped JSON, serialized snapshots and baseline blobs, in
Pod resources, local Turtle caches, fixtures and migrations. Model persistent
data as native RDF statements with appropriate terms and typed scalar values.
If a native RDF representation cannot be found, explain the concrete issue to
the maintainer and resolve it together before writing; do not invent an exception.

Delete/move semantics must follow PDS Interop link metadata. Current file deletion
writes a conditional tombstone to the advertised parent-container description;
it retains bytes. Do not silently substitute HTTP DELETE. Moves are not implemented.

Keep app-specific assumptions in this monorepo until independent reuse justifies
a lower library. External dependencies must be npm versions, not sibling links.
New shared packages stay experimental under `@muze-labs`; publication readiness
requires its own review. Do not change the shared OLDM parser default: this app
composition selects oldm-turtle and the build checks that N3 is absent.

Use braces around control-flow bodies, readable intermediate values, and roughly
80-column source. Put else/catch/finally on their own lines. Prefix thrown errors
with their module. Test observable contracts, including failure and preservation
of data; avoid tests which simply repeat implementation structure.

Run `npm run check`; for UI changes also run `npm run test:browser` (Chrome needed).
Do not commit or publish unless asked. Existing user work in other repositories
is outside this change.

Use the original `poef/solid-apps` Contacts visual language: blue accent, square
controls, panel layouts and compact account dropdown. App navigation belongs only
to the Launcher. Each app owns its toolbar; the shared account menu contains
WebID/connection and Preferences. Contacts renders profiles inline.
