# Solid Apps engineering rules

## Required development workflow

Use the Spiral Developer workflow for implementation in this repository. Read
[Spiral operating instructions](.spiral-core/AGENTS.md) and the project's
[context and integration policy](.spiral/project-context.md) before starting or
continuing implementation. Follow the governing roadmaps and record cycle
scope, evidence, evaluation and human acceptance under `.spiral/`.

Implementation changes, including product code, build configuration,
dependencies and tests, belong on a dedicated `spiral/<CYC-id>-<short-goal>`
branch with a matching cycle record. Confirm the cycle goal and verify the
actual branch before implementation. Existing planning does not waive cycle
isolation. Do not implement on `main`, merge an Active cycle, or treat passing
tests as human acceptance. Preserve existing work when correcting missing
cycle bookkeeping, and record the correction without inventing past approvals.

Documentation-only changes may be made outside a cycle; Git history is
sufficient for those changes. This exception does not cover implementation
mixed into a documentation update. Do not commit, merge or publish unless asked.

## Engineering requirements

This is the Muze-owned Solid Apps monorepo. It explicitly adopts:

- [Muze architecture philosophy](ARCHITECTURE-PHILOSOPHY.md).
- [Muze engineering culture](https://github.com/muze-labs/spiral-developer/blob/main/cultures/muze-engineering.md).
- [Muze library stewardship](https://github.com/muze-labs/spiral-developer/blob/main/cultures/muze-library-stewardship.md)
  for our shared packages and developer tooling.
- [Maturity policy](https://github.com/muze-nl/.github/blob/main/maturity-policy.md).

Required reading before designing or changing an app:
[Moldable Solid Apps](design/Moldable-Solid-Apps.md). Apply its rules for apps
today so each app exposes editable feature datasets for the future in-app IDE.
The IDE itself remains future roadmap work.

Reuse SimplyFlow and the other Muze libraries wherever their public APIs
reasonably meet the requirement. Inspect the installed APIs, documentation and
existing suite composition before adding infrastructure. Prefer direct library
calls or thin app-specific bridges over parallel implementations or wrappers
which merely rename a call. If an API cannot meet a required contract, record
the concrete gap and keep the extra code limited to it.

Use SimplyFlow exclusively for runtime content rendering. Keep markup in HTML
and bind dynamic text, lists, attributes, visibility and commands through
SimplyFlow. Escape plain text with `escape_html`; list command values use
`:value.id` (or another item property). Do not add a second renderer or manually
build content DOM. Templates are composed at build time so View Source stays useful.
Use SimplyFlow's state, effects and bindings where they fit. Functions which
derive view data and update SimplyFlow data are allowed; they must leave content
rendering to SimplyFlow rather than assign HTML or rebuild DOM themselves.

Use SimplyFlow's model feature for UI lists that need filtering, sorting,
paging or other supported list transformations. Reuse its model effects and
options instead of maintaining equivalent array-processing pipelines in
commands or render/update helpers. App-specific predicates and comparators
belong in the model configuration and editable feature entries. Commands and
actions update model options; SimplyFlow binds the resulting view. Keep the
source data and native RDF authoritative; a list model is only a UI projection.

Use jaqt for app-owned selection, sorting and filtering of arrays of objects
where it simplifies the code. Combine jaqt queries with SimplyFlow model effects
when useful: the model owns reactive options and the bound view, and jaqt
expresses the query within that pipeline. Do not maintain a second equivalent
pipeline beside the model. Use the installed public APIs and preserve source
objects, native RDF identity and unrelated data.

Native operations which are not content rendering remain direct: dialog/popover lifecycle,
focus, form reset/file selection, download activation, and document-wide language,
theme and text-size settings. Add exceptions only for a concrete browser need.

Route application HTTP, including public/anonymous reads, through the configured
Metro clients and existing data APIs. Reuse `session.client`,
`createSolidMetroClient`, `session.perform` and the suite's document helpers as
appropriate. Do not add app-owned `fetch`/`XMLHttpRequest` paths or duplicate
HTTP, authentication, token, retry or discovery mechanisms already provided by
the Muze stack. Use oldm with oldm-turtle for RDF parsing/writing, SimplySolid
for supported collection workflows, and Solid Workspace for supported storage
and synchronization workflows. App-specific policy and missing integration
belong in narrow bridges, preserving the libraries' contracts.

Keep native RDF authoritative. UI projections and edit drafts must not replace
shared graphs. Preserve unknown terms, multiple values, identity, and other
subjects. Ignore unknown predicates when reading/projecting; preserve them on
write. Validate the fields we interpret rather than imposing a datatype
allowlist on the whole resource. Refuse unsupported structured edits rather than
flattening them.
Profile editing is shared by Contacts and Profile; storage policy stays outside
the profile view. Preferences use the profile's `pim:preferencesFile` link.

Turtle is the native persistence format for Solid Apps. Model the main state as
native RDF statements with appropriate terms and typed scalar values. Do not
write JSON inside Turtle string literals, including `rdf:JSON`, escaped JSON,
serialized snapshots or baseline blobs in Pod resources, local Turtle caches,
fixtures or migrations, except for the explicitly authorized experiment below.
If a native RDF representation cannot be found in any other case, explain the
concrete issue to the maintainer and resolve it together before writing; do not
invent an exception.

For the unreleased workspace format, the maintainer explicitly authorizes
discarding the retired `apps:snapshot` predicate only on the current workspace
root during an explicit conditional native save. Ignore its value on read;
do not decode/import it or discard other unknown RDF. Background close cannot
perform this one-time cleanup. Other JSON-in-Turtle writes remain forbidden.

The sole authorized exception is a separate, optional app-owned opaque state
string, which may experimentally contain JSON. The app interprets it itself;
the workspace/broker only preserves and returns it. The main state must remain
linked data; do not hide it in that field or use the exception for whole-workspace
snapshots or persistence baselines. This is an explicit interoperability test,
not a preferred persistence pattern: the maintainer considers JSON embedded in
Turtle undesirable and expects objections to it.

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
