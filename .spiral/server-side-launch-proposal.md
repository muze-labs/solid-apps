# Explicit query-parameter launch mode

Status: **Confirmed with maintainer corrections**: follow the application's
description by default; allow users to alter the mode; if neither setting is
present, use `fragment`. This follows the maintainer's request for server-side
Solid app launch support and extends the same active launch-context cycle.

## Understanding and current effective behavior

Some apps need the current WebID and resource URL in the HTTP query, because
their server cannot read a browser fragment. The maintainer wants this mode
to be explicit in an application description or selected by the user.

At the feature's starting state, the shared builder wrote context to the
fragment, preserving the HTTP query. A direct invocation against a URL with
old query values showed
that `?webid=` and `?resource=` still carried the old values even while the
fragment had the current WebID and requested resource. Launcher describes
applications as native RDF `schema:SoftwareApplication` nodes, with name and
URL fields. No parameter-location field or user control was present then.

## Proposed contract

- Add an explicit launch-parameter location, `fragment` or `query`. Preserve
  the current fragment default for existing launch builders.
- Query-based application links are supported when explicitly selected by
  declared app metadata or a user override. Do not infer a mode that overrides
  the explicit default: user override, then app declaration, then `fragment`.
- An application description in the existing launcher RDF may declare the
  app-specific predicate
  `https://vocab.muze.nl/solid-apps#launchParameterLocation`, with literal
  `"query"` or `"fragment"`. This is experimental suite vocabulary, not a
  published ecosystem standard.
- In Add shortcut and on existing shortcuts, offer Follow application, Fragment
  and Query. Follow application is the default and clears only the user's
  override. Store explicit user choices separately as
  `https://vocab.muze.nl/solid-apps#launchParameterLocationOverride`; do not
  overwrite the application's declaration when the user makes a choice.
- Application descriptions already loaded through the launcher collection
  honor that declaration. Fetching remote publisher descriptions and registry
  discovery remain later roadmap work; this slice does not invent discovery.
- Explicit query mode updates only the reserved query parameters, preserves
  unrelated query values and the application fragment, and retains the full
  encoded resource URL including its fragment. It never silently falls back
  between modes if declared metadata is invalid or unsupported.
- Preserve native RDF and unrelated metadata. Refuse ambiguous, multiple or
  structured values for this setting instead of flattening them.
- Launch a fresh app window as before. Query mode sends the WebID and resource
  URL to the destination server; the user-facing choice should make that clear.

## Evaluation

Use tests to establish both builder behavior and actual HTTP query receipt by
a server-side test app. Cover explicit URL mode, RDF-declared mode, user choice,
current-WebID replacement, nested resource fragments, unrelated data preservation
and failure on unsupported metadata. Re-run `npm run check` and browser tests.

## Boundary

This extends the launch interface within roadmap Phase 0. It does not introduce
broker transport, grant permissions, fetch arbitrary app descriptions, or require
browser apps to start consuming server-oriented query parameters.
