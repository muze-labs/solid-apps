# Profile editing capability

Status: implemented for evaluation in Active CYC-20261107-QG24H-49. This scoped
contract does not complete the planned recipient-picker capability or provider
registry. Capability URI: `https://vocab.muze.nl/capabilities/edit-profile`.

The request identifies the profile subject:

```js
{ '@id': 'https://person.example/profile/card#me' }
```

The provider displays the profile and lets the user edit it. The current Profile
provider only edits its connected account's own WebID. A WebID in the request or
launch context is not authentication or permission to write. If necessary, the
user connects in the provider; its own Metro/session APIs perform data access.
The provider copies the loaded native RDF document, applies supported edits and
saves conditionally, retaining other subjects, unknown terms and structured data.
Unsupported structured edits are refused by the existing shared profile logic.

A successful completion returns the subject URI after saving and refreshing:

```js
{ '@id': 'https://person.example/profile/card#me' }
```

The caller validates the subject and refreshes its own account display. No profile
graph, passwords or access tokens are sent in capability messages. This is not a
credential sandbox: same-origin pages retain ordinary same-origin browser access.
The caller never saves a provider's UI projection to the Pod.

The existing capability error/result channel carries `cancelled`, `denied`,
`invalid`, `busy`, `timeout` and `disconnected` failures as appropriate. There is
no reply claiming success merely for opening the editor. Cancellation does not
undo a write already accepted by the Pod.

## Presentation and lifecycle

The shared dialog hosts the provider in an iframe. Launcher selects from explicit
built-in provider mappings, issues a caller-scoped transient ticket and routes
the existing private-port protocol. The host verifies the provider-ready message's
window and origin before transferring the ports. Launcher separately verifies
the caller window/origin and ticket; attachment is one-time. Providers need no
access to the caller's DOM or app framework to implement the protocol.

The host owns title/close chrome; the provider owns editing, validation and the
visible Save/Cancel footer. `solid-apps-task` marks an invocation presentation,
with the parent frame or opener as its host. A normal URL still opens the
standalone app. Task instances and their keys are excluded from durable workspace
snapshots and restoration. Normal checkpoints refuse to proceed past an unsaved
provider draft or active save. Task drafts are held in the live provider, not
persisted as new workspace snapshots; forced browser closure remains a separate
best-effort boundary.

Frame readiness has a bounded startup wait. Once editing begins, the call waits
for completion or explicit cancellation rather than expiring after one minute.
The outer Close/Escape asks whether the provider can close. An active save blocks
close; a draft requires explicit discard. Routing errors keep the provider visible
so its draft is not silently destroyed. If the provider cannot answer the close
check, the user can explicitly discard and close.

If framing is unavailable, the user can continue the same pending call in a tab.
The host opens that tab in the click, then attaches the same kind of scoped port
connection; the provider still owns its data and save. The returned result reaches
the original caller and the transient tab closes. If the app has no Launcher
connection, the fallback is an ordinary standalone app link instead. A registry,
general layout negotiation and automatic credential sharing remain out of scope.

`browse` uses the same host presentation without changing its resource-URI result
contract. Existing top-level Files routing is retained and tested separately.


## Loading presentation (accepted CYC49 refinement)

Transport readiness and visible content readiness are separate. A task provider
can construct ManagedApp with `waitForPresentation: true`. Its initial
`solid-apps:embedded-ready` message advertises `presentation: "explicit"`.
After preparing its request-specific UI, call `managed.presentationReady()`;
it sends `solid-apps:presentation-ready` with the current task `id` to the
validated host origin. Profile and Files signal after initial view binding,
including a visible connection/error state when content cannot be loaded.

The host accepts that signal only from the current provider window, exact origin
and current task ID. It grants no data authority and cannot complete a request.
While loading, the frame retains its final viewport but is concealed and inert,
with a centered loading status. Reveal does not move focus. Animation respects
prefers-reduced-motion, and the outer Close remains usable throughout.

Providers without the explicit advertisement use iframe load plus transport
attachment as the presentation fallback. A provider promising a signal gets a
five-second grace period after attachment, then the host reveals it even if the
signal was omitted. This is a presentation deadline, not a request timeout.
Without successful attachment, native load alone is insufficient; the existing
framing/startup failure and tab-continuation path remains. Delayed signals from
another task cannot reveal a later invocation. CYC49 is accepted on 2026-11-07; ACC66 records the boundary.


The ready reveal crossfades the loading indicator out and the provider content
in over 0.3 seconds. Reduced-motion preference reveals immediately. Duplicate
ready signals do not restart the transition; closing cleans up its timer.
