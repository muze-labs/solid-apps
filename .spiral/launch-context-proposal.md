# Launch context: proposal for the first implementation cycle

Status: **Confirmed**. The maintainer answered "agreed" to this first-cycle
proposal after clarifying full resource URLs and the current launcher WebID.
Execution is tracked in `cycles/CYC-20261101-QG24H-1.md`.

Subsequent steering: launching creates a **new window** containing the app;
it must not reuse the Launcher window or another existing app window.
Local testing clarified that a **new tab** should be the default presentation;
each launch still creates a new target and leaves existing apps intact.
Further steering makes tabs/windows a saved user preference in the shared
Preferences dialog, with tabs as the default.
During evaluation the maintainer also requested an optional application-fragment
prefix: `#foo?webid=...&resource=...` parses only the suffix after the first
literal `?`, then leaves `#foo` in the address. Encoded `%3F` is not a delimiter.
This extends the same confirmed cycle; the legacy format remains supported.

## Settled intent and evidence

- A resource is a file in a storage Pod, identified by its full URL. Preserve
  any fragment on that URL; it may identify something within the file.
- The launcher always supplies its **current WebID**, as explicitly clarified
  by the maintainer. Do not invent an independent account-selection control
  for constructing launch links.
- Current app startup does not consume a shared WebID/resource launch context.
  The existing mock-Pod browser probe establishes that a sample launch fragment
  leaves the connection form blank and does not load the requested resource.
- The inspected original checkout does not establish the assumed convention
  either. SimplyFlow has configurable routing, but no shared launch route is
  configured by this suite.

## Proposed cycle goal

Make a launch link convey the launcher's current WebID and a complete resource
URL to a receiving Solid app, and establish a tested, documented contract for
reading that context without corrupting the resource's own fragment.

This continues the capability-broker roadmap's Phase 0. It resolves a missing
interface that on-demand providers and Open With would otherwise have to guess.
It does not claim to complete all of Phase 0 or establish broker authorization.

## Proposed representation

Use URL-encoded `webid` and `resource` values in the application's fragment:

```text
https://apps.example/profile/#webid=https%3A%2F%2Falice.example%2Fprofile%23me&resource=https%3A%2F%2Falice.example%2Fcontacts.ttl%23bob
```

The decoded resource is `https://alice.example/contacts.ttl#bob`; its fragment
belongs to the resource, independently of the app URL's outer fragment.
WebID and resource remain separate values. Treat URL context as untrusted
input and use the suite's HTTP(S) URL validation. Do not place credentials or
an authority-granting token in these fields.

The key names and serialization are a proposed local contract, not a claim
that an earlier public convention exists. Preserve ordinary standalone app
startup and the existing local `?contact=` link behavior.

## Proposed first observable slice

Use Launcher and Profile to prove the common launch contract. Profile already
has a read path accepting an RDF subject URL, so this slice can demonstrate a
real resource opening while preserving the subject fragment. The launcher's
current WebID supplies account context; existing authentication remains
authoritative, and the link itself grants no access or editing rights.

Make the encoding/decoding contract available within this monorepo so later
Files/Contacts support and independently implemented apps can follow the same
documented format. No independently published package is implied.

Files and Contacts have materially different resource behavior: a file may be
selected within a container, while a Contacts resource may be an address book
distinct from the existing local replica. Their concrete loading and storage
semantics need their own acceptance criteria. Do not silently merge a supplied
address book into local data as a side effect of proving the link contract.

## Evaluation

- A launcher-generated link uses the current session's WebID.
- A resource URL containing its own fragment round-trips intact.
- Following the link opens the specified profile subject, rather than merely
  storing decoded parameters where no app behavior uses them.
- Existing authentication controls read/write access. Launching does not
  change saved preferences or create a write to the resource.
- Missing/invalid context has an understandable outcome; ordinary startup
  and existing local contact links remain useful.
- Observable preservation/failure tests, `npm run check`, and browser tests
  cover the integrated slice.

## Scope boundary

This cycle would establish one end-to-end launch proof. Broker transport,
provider registration, permission delegation, clipboard and semantic recognition
remain later roadmap work. It ends when this interface and its working proof
can be evaluated; additional consumers should reuse the contract after their
resource semantics are settled.
